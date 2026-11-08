/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MessageChannel, Worker } from "node:worker_threads";
import { execFileSync } from "node:child_process";
import { resolveRefreshProfileConfig, runRefreshProfile } from "../../src/debug/refresh-profile.js";
import { GraphBuildWatchSession } from "../../src/infrastructure/runtime/graph-build-watch-session.js";

const temporaryRoots: string[] = [];
const profilingAvailable = typeof process.threadCpuUsage === "function";
function fixture(files = 2): { root: string; source: string; output: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-refresh-profile-test-"));
  temporaryRoots.push(root);
  const source = path.join(root,"source");fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,"README.md"),"# Refresh profiling fixture\n");
  for(let index=0;index<files;index++)fs.writeFileSync(path.join(source,`${String(index).padStart(3,"0")}.py`),`def helper_${index}():\n    return helper_${(index+1)%files}()\n`);
  return {root,source,output:path.join(root,"profiles")};
}
afterEach(()=>{for(const root of temporaryRoots.splice(0))fs.rmSync(root,{recursive:true,force:true});});

describe("actual production refresh worker profiling",()=>{
  it("rejects ambiguous CLI arguments before any work",()=>{
    expect(()=>resolveRefreshProfileConfig(["--repo",".","--output","x","--runs","0"])).toThrow("positive safe integer");
    expect(()=>resolveRefreshProfileConfig(["--repo",".","--output","x","--unexpected","1"])).toThrow("Usage");
    expect(resolveRefreshProfileConfig(["--repo",".","--output","x"])).toMatchObject({runs:5,max_files:2000});
  });
  it("refuses CLI configuration from outside the owning checkout",()=>{
    expect(()=>resolveRefreshProfileConfig(["--repo",".","--output","x"],os.tmpdir())).toThrow("checkout root");
  });
  it("returns an explicit unsupported-capability block without a profiling fallback",async()=>{
    const f=fixture();
    const descriptor=Object.getOwnPropertyDescriptor(process,"threadCpuUsage");
    Object.defineProperty(process,"threadCpuUsage",{value:undefined,configurable:true,writable:true});
    try {
      expect(await runRefreshProfile({repo_root:f.source,output_root:f.output,runs:1,max_files:2000})).toEqual({schema_version:1,state:"blocked",code:"worker_thread_cpu_unavailable",completed_runs:0});
      expect(fs.existsSync(f.output)).toBe(false);
    } finally {
      if(descriptor)Object.defineProperty(process,"threadCpuUsage",descriptor);
      else Reflect.deleteProperty(process,"threadCpuUsage");
    }
  });
  it("blocks output within a source, including symlink aliases, without creating files",async()=>{
    const f=fixture();
    const nested=path.join(f.source,"output");
    expect(await runRefreshProfile({repo_root:f.source,output_root:nested,runs:1,max_files:2000})).toMatchObject({state:"blocked"});
    expect(fs.existsSync(nested)).toBe(false);
    fs.symlinkSync(f.source,path.join(f.root,"alias"),"dir");
    expect(await runRefreshProfile({repo_root:f.source,output_root:path.join(f.root,"alias","output"),runs:1,max_files:2000})).toMatchObject({state:"blocked"});
    expect(fs.existsSync(nested)).toBe(false);
  });
  it("retains existing output rather than overwriting evidence",async()=>{
    const f=fixture();fs.mkdirSync(f.output);fs.writeFileSync(path.join(f.output,"sentinel"),"retain");
    expect(await runRefreshProfile({repo_root:f.source,output_root:f.output,runs:1,max_files:2000})).toMatchObject({state:"blocked"});
    expect(fs.readFileSync(path.join(f.output,"sentinel"),"utf8")).toBe("retain");
  });
  it.skipIf(!profilingAvailable || process.platform === "win32")("uses canonical safe Git metadata without fsmonitor execution or GIT_DIR retargeting",async()=>{
    const f=fixture(1);const foreign=fixture(1);
    const safeEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith("GIT_")));
    const git=(source:string,args:string[])=>execFileSync("git",["--no-optional-locks","-c","core.fsmonitor=false","-c","core.hooksPath=/dev/null","-c","commit.gpgSign=false","-c","user.name=Fixture","-c","user.email=fixture@example.invalid","-C",source,...args],{env:{...safeEnv,GIT_CONFIG_NOSYSTEM:"1",GIT_CONFIG_GLOBAL:"/dev/null"},encoding:"utf8"});
    for(const root of [f.source,foreign.source]) {git(root,["init","-q"]);git(root,["add","."]);git(root,["commit","--no-verify","-qm",root===f.source?"target":"foreign"]);}
    const expectedHead=git(f.source,["rev-parse","HEAD"]).trim();
    const foreignHead=git(foreign.source,["rev-parse","HEAD"]).trim();expect(expectedHead).not.toBe(foreignHead);
    const marker=path.join(f.root,"unexpected-fsmonitor");const probe=path.join(f.root,"fsmonitor-probe");
    fs.writeFileSync(probe,`#!/bin/sh\nprintf invoked > "${marker}"\n`);fs.chmodSync(probe,0o755);
    git(f.source,["config","core.fsmonitor",probe]);
    const indexPath=path.join(f.source,".git","index");const indexBefore=fs.readFileSync(indexPath);
    const oldGitDir=process.env.GIT_DIR;process.env.GIT_DIR=path.join(foreign.source,".git");
    try {
      const result=await runRefreshProfile({repo_root:f.source,output_root:f.output,runs:1,max_files:2000});
      expect(result.state).toBe("complete");
      if(result.state!=="complete")throw new Error(JSON.stringify(result));
      expect(result.identity.source).toMatchObject({state:"available",head:{status:"available",head_object_id:expectedHead}});
      expect(fs.existsSync(marker)).toBe(false);expect(fs.readFileSync(indexPath)).toEqual(indexBefore);
    } finally {if(oldGitDir===undefined)delete process.env.GIT_DIR;else process.env.GIT_DIR=oldGitDir;}
  },15000);
  it.skipIf(!profilingAvailable)("profiles actual worker CPU and preserves its publication/results over repeated cold runs",async()=>{
    const f=fixture(3);const before=fs.readdirSync(f.source);
    const result=await runRefreshProfile({repo_root:f.source,output_root:f.output,runs:2,max_files:2000});
    expect(result.state).toBe("complete");
    if(result.state!=="complete")throw new Error(JSON.stringify(result));
    expect(result.runs).toHaveLength(2);
    expect(result.runs[0].semantic_digest).toBe(result.runs[1].semantic_digest);
    expect(result.runs[0].evidence_counts.nodes).toBeGreaterThan(0);
    expect(result.runs[0].worker_cpu_us).toBeGreaterThan(0);
    expect(result.runs[0].generation_process_cpu_us.user + result.runs[0].generation_process_cpu_us.system).toBeGreaterThan(0);
    expect(result.runs[0].passes.flatMap(pass=>pass.progress_intervals).some(x=>x.progress.phase==="extraction")).toBe(true);
    const profile=JSON.parse(fs.readFileSync(result.runs[0].passes[0].profile_path,"utf8"));
    expect(profile.nodes.some((node:{callFrame:{url:string}})=>node.callFrame.url.includes("startup-graph-warmup-worker"))).toBe(true);
    expect(fs.readdirSync(f.source)).toEqual(before);
    expect(fs.existsSync(path.join(f.source,".cache"))).toBe(false);
    expect(fs.statSync(f.output).mode&0o777).toBe(0o700);
    expect(fs.statSync(path.join(f.output,"report.json")).mode&0o777).toBe(0o600);
  },30000);
  it.skipIf(!profilingAvailable)("keeps the canonical public worker message stream identical with and without profiling",async()=>{
    const f=fixture(3);
    async function workerMessages(profile:boolean):Promise<unknown[]> {
      const output=path.join(f.root,profile?"profile-worker":"plain-worker");fs.mkdirSync(output);
      const messages:unknown[]=[];
      const {port1,port2}=new MessageChannel();
      let debugReceipt:unknown;
      port1.on("message",value=>{debugReceipt=value;});
      const endpointClosed=new Promise<void>(resolve=>port1.once("close",resolve));
      const watcher = new GraphBuildWatchSession({repo_root:f.source,paths:["."],skipped_roots:[],enabled:true,debounce_ms:25,event_budget:2000});
      const watcherObservation = await watcher.start();
      const workerData={executionId:"equivalent-worker",repoRoot:f.source,databasePath:path.join(output,"graph.sqlite"),snapshotId:"12345",configIdentity:"default",maxFiles:2000,retainLatestSnapshots:3,retainLatestFreshSnapshots:2,controllerGeneration:123,invalidationGeneration:0,deadlineAt:new Date(Date.now()+60000).toISOString(),timeoutMs:60000,watcherObservation};
      const worker=new Worker(new URL(profile?"../../src/debug/refresh-profile-worker-entrypoint.mjs":"../../src/infrastructure/workers/startup-graph-warmup-worker-entrypoint.mjs",import.meta.url),{
        workerData:profile?{...workerData,refreshProfile:{port:port2,profile_path:path.join(output,"worker.cpuprofile")}}:workerData,
        transferList:profile?[port2]:[]
      });
      const exited=new Promise<void>((resolve,reject)=>{
        worker.on("message",message=>{
          if ((message as {type?:string}).type === "graph_build_observation_request") {
            const request = message as {request_id:string;operation:"observe"|"register_directory";path?:string;repository_key?:string};
            void (request.operation === "observe" ? Promise.resolve(watcher.observe()) : watcher.registerDirectory({path:request.path!,repository_key:request.repository_key}))
              .then(result=>worker.postMessage({...message as object,type:"graph_build_observation_ack",accepted:true,result}));
            return;
          }
          messages.push(message);
        });
        worker.once("error",reject);worker.once("exit",code=>code===0?resolve():reject(new Error(`exit ${code}`)));
      });
      if(!profile){port2.close();}
      await exited;await endpointClosed;await watcher.close();
      if(profile)expect(debugReceipt).toMatchObject({state:"complete",schema_version:1});
      return messages;
    }
    const plain=await workerMessages(false),profiled=await workerMessages(true);
    expect(profiled).toEqual(plain);
    expect(profiled).toContainEqual(expect.objectContaining({type:"partial",result:expect.objectContaining({partial_kind:"publish_seed"})}));
    expect(profiled.every(message=>["progress","complete","partial"].includes((message as {type:string}).type))).toBe(true);
  },30000);
  it.skipIf(!profilingAvailable)("retains failed worker profiling evidence separately without a success summary",async()=>{
    const f=fixture();fs.mkdirSync(f.output);
    const {port1,port2}=new MessageChannel();let receipt:unknown;
    port1.on("message",value=>{receipt=value;});
    const closed=new Promise<void>(resolve=>port1.once("close",resolve));
    const messages:unknown[]=[];let errorObserved=false;
    const worker=new Worker(new URL("../../src/debug/refresh-profile-worker-entrypoint.mjs",import.meta.url),{
      workerData:{controllerGeneration:-1,invalidationGeneration:0,refreshProfile:{port:port2,profile_path:path.join(f.output,"failed.cpuprofile")}},transferList:[port2]
    });
    worker.on("message",message=>messages.push(message));
    worker.once("error",()=>{errorObserved=true;});
    const exitCode=await new Promise<number>(resolve=>worker.once("exit",resolve));
    await closed;
    expect(exitCode).not.toBe(0);expect(errorObserved).toBe(true);
    expect(receipt).toMatchObject({state:"failed",schema_version:1});
    expect(receipt).not.toHaveProperty("summary");
    expect(messages).not.toContainEqual(expect.objectContaining({type:"complete"}));
    expect(JSON.parse(fs.readFileSync(path.join(f.output,"failed.cpuprofile"),"utf8")).nodes.length).toBeGreaterThan(0);
  },15000);
  it.skipIf(!profilingAvailable)("uses durable continuations and reaches final resolution in the canonical worker",async()=>{
    const f=fixture(260);
    const result=await runRefreshProfile({repo_root:f.source,output_root:f.output,runs:1,max_files:2000});
    expect(result.state).toBe("complete");
    if(result.state!=="complete")throw new Error(JSON.stringify(result));
    expect(result.runs[0].worker_invocations).toBeGreaterThan(1);
    expect(result.runs[0].passes.flatMap(x=>x.progress_intervals).some(x=>x.progress.phase==="resolution")).toBe(true);
    expect(result.runs[0].evidence_counts.files).toBe(261);
    expect(result.runs[0].evidence_counts.edges).toBeGreaterThan(0);
    expect(fs.readdirSync(path.join(f.output,"run-1")).filter(x=>x.endsWith(".cpuprofile"))).toHaveLength(result.runs[0].worker_invocations);
  },30000);
  it.skipIf(!profilingAvailable)("returns blocked evidence rather than a thrown or successful run for an unreadable input",async()=>{
    const f=fixture();
    const unreadable=path.join(f.source,"000.py");
    fs.chmodSync(unreadable,0);
    try {
      const result=await runRefreshProfile({repo_root:f.source,output_root:f.output,runs:1,max_files:2000});
      expect(result).toMatchObject({state:"blocked",code:"source_identity_unavailable",completed_runs:0});
      expect(result).not.toHaveProperty("summary");
      expect(fs.existsSync(path.join(f.output,"run-1"))).toBe(false);
    } finally {fs.chmodSync(unreadable,0o600);}
  });
  it.skipIf(!profilingAvailable)("reports an empty source as complete only with an actual published empty graph",async()=>{
    const f=fixture(0);fs.unlinkSync(path.join(f.source,"README.md"));
    const result=await runRefreshProfile({repo_root:f.source,output_root:f.output,runs:1,max_files:2000});
    expect(result.state).toBe("complete");
    if(result.state!=="complete")throw new Error(JSON.stringify(result));
    expect(result.runs[0].evidence_counts.files).toBe(0);
    expect(result.runs[0].passes).toHaveLength(2);
    expect(result.runs[0].passes.at(-1)?.progress_intervals.some(item=>item.progress.phase==="finalizing")).toBe(true);
  },15000);
});
