/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type HookModule = {
  buildPostEditContext(payload: unknown, env?: NodeJS.ProcessEnv): string | undefined;
  buildPostEditFeedback(payload: unknown, env?: NodeJS.ProcessEnv): {
    status: string;
    outcome: string;
    checked_files: string[];
    findings: Array<{ message: string; category: string; blocking: boolean }>;
    deferred_checks: Array<{ reason: string; outcome: string; count: number; paths?: string[] }>;
    visible_message?: string;
    next_actions: Array<{ tool: string; args: Record<string, unknown> }>;
  };
};

const fixtureRoot = path.resolve("tests/fixtures/fixture-post-edit-feedback");
const hookPath = path.resolve("plugins/agent-workbench/hooks/post-edit-feedback.js");

describe("post-edit hook fixtures", () => {
  let hook: HookModule;
  let originalPath: string | undefined;
  let logPath: string;

  beforeEach(async () => {
    hook = (await import(pathToFileURL(hookPath).href)) as HookModule;
    originalPath = process.env.PATH;
    logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-hook-log-")), "hook.jsonl");
    process.env.AGENT_WORKBENCH_HOOK_LOG_PATH = logPath;
  });

  afterEach(() => {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    delete process.env.AGENT_WORKBENCH_HOOK_LOG_PATH;
  });

  it("keeps clean changed files silent", () => {
    const feedback = hook.buildPostEditFeedback(payload(["src/clean.ts"]));

    expect(feedback).toMatchObject({
      status: "done",
      outcome: "checked",
      checked_files: ["src/clean.ts"],
      findings: [],
      deferred_checks: [],
      visible_message: undefined
    });
    expect(hook.buildPostEditContext(payload(["src/clean.ts"]), basicFeedbackEnv(logPath))).toBeUndefined();
    expect(readHookRecords(logPath)).toEqual([]);
  });

  it("runs diagnostics in silent mode without visible hook output", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-silent-edit-"));
    fs.mkdirSync(path.join(tempRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, "src/bad.json"), "{\"ok\": \n");

    expect(hook.buildPostEditContext({
      cwd: tempRoot,
      tool_name: "write",
      tool_input: {
        file_path: "src/bad.json"
      }
    }, {
      ...process.env,
      AGENT_WORKBENCH_HOOK_FEEDBACK: "silent",
      AGENT_WORKBENCH_HOOK_LOG_PATH: logPath
    })).toBeUndefined();
    expect(readHookRecords(logPath)).toEqual([]);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("writes opt-in redacted payload summaries for hook debugging", () => {
    const debugLogPath = path.join(path.dirname(logPath), "debug.jsonl");
    const feedback = hook.buildPostEditFeedback({
      cwd: fixtureRoot,
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_input: {
        file_path: "src/clean.ts",
        content: "do not log this"
      },
      tool_response: {
        code: 0,
        output: "do not log this either"
      }
    }, {
      ...process.env,
      AGENT_WORKBENCH_HOOK_DEBUG: "1",
      AGENT_WORKBENCH_HOOK_LOG_PATH: debugLogPath
    });

    expect(feedback.outcome).toBe("checked");
    expect(readHookRecords(debugLogPath)).toEqual([
      expect.objectContaining({
        status: "payload_summary",
        hook_event_name: "PostToolUse",
        tool_name: "apply_patch",
        tool_input_keys: ["content", "file_path"],
        tool_response: {
          kind: "object",
          keys: ["code", "output"],
          code: 0
        },
        tool_succeeded: true,
        extracted_files: ["src/clean.ts"],
        checked_files: ["src/clean.ts"],
        outcome: "checked",
        finding_count: 0
      })
    ]);
    expect(fs.readFileSync(debugLogPath, "utf8")).not.toContain("do not log this");
  });

  it("returns concise actionable findings for syntax and generated-file fixtures", () => {
    const feedback = hook.buildPostEditFeedback(payload(["src/bad.json", "generated/out.txt"]));

    expect(feedback.status).toBe("needed");
    expect(feedback.outcome).toBe("actionable");
    expect(feedback.findings).toEqual([
      expect.objectContaining({
        message: "Generated/local artifact changed: generated/out.txt.",
        category: "edit_risk",
        blocking: false
      }),
      expect.objectContaining({
        message: expect.stringContaining("JSON syntax error in src/bad.json"),
        category: "diagnostic",
        blocking: false
      })
    ]);
    expect(feedback.visible_message).toContain("generated/out.txt");
    expect(feedback.visible_message).toContain("src/bad.json");
  });

  it("logs timeout-based diagnostic unavailability without visible hook output", () => {
    const binRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-slow-python-"));
    fs.writeFileSync(path.join(binRoot, "python3"), "#!/bin/sh\n/bin/sleep 5\n", {
      mode: 0o755
    });
    process.env.PATH = binRoot;

    const feedback = hook.buildPostEditFeedback(payload(["src/bad.py"]));

    expect(feedback).toMatchObject({
      status: "done",
      findings: [],
      visible_message: undefined
    });
    expect(readHookRecords(logPath)).toEqual([
      expect.objectContaining({
        status: "check_unavailable",
        command: "python3",
        path: "src/bad.py"
      })
    ]);
  });

  it("logs missing diagnostic commands without visible hook output", () => {
    process.env.PATH = "";

    const feedback = hook.buildPostEditFeedback(payload(["src/bad.py"]));

    expect(feedback).toMatchObject({
      status: "done",
      findings: [],
      visible_message: undefined
    });
    expect(readHookRecords(logPath)).toEqual([
      expect.objectContaining({
        status: "check_unavailable",
        command: "python3",
        path: "src/bad.py",
        error: "ENOENT"
      })
    ]);
  });

  it("logs too-many-files deferral while checking only the inline budget", () => {
    const feedback = hook.buildPostEditFeedback(
      payload([
        "src/multi-1.ts",
        "src/multi-2.ts",
        "src/multi-3.ts",
        "src/multi-4.ts",
        "src/multi-5.ts",
        "src/multi-6.ts"
      ])
    );

    expect(feedback).toMatchObject({
      status: "done",
      outcome: "queued",
      findings: [],
      visible_message: undefined,
      deferred_checks: [
        {
          reason: "too_many_files",
          outcome: "queued",
          count: 1,
          paths: ["src/multi-6.ts"]
        }
      ]
    });
    expect(feedback.checked_files).toHaveLength(6);
    expect(readHookRecords(logPath)).toEqual([
      expect.objectContaining({
        status: "checks_deferred",
        reason: "too_many_files",
        file_count: 6
      })
    ]);
    fs.writeFileSync(logPath, "");
    expect(hook.buildPostEditContext(
      payload([
        "src/multi-1.ts",
        "src/multi-2.ts",
        "src/multi-3.ts",
        "src/multi-4.ts",
        "src/multi-5.ts",
        "src/multi-6.ts"
      ]),
      basicFeedbackEnv(logPath)
    )).toBeUndefined();
    expect(readHookRecords(logPath)).toEqual([
      expect.objectContaining({
        status: "checks_deferred",
        reason: "too_many_files",
        file_count: 6
      })
    ]);
  });

  it("logs multi-file skipped checks for large files without visible hook output", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-large-edit-"));
    fs.mkdirSync(path.join(tempRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, "src/large-a.json"), " ".repeat(600 * 1024));
    fs.writeFileSync(path.join(tempRoot, "src/large-b.json"), " ".repeat(600 * 1024));

    const feedback = hook.buildPostEditFeedback({
      cwd: tempRoot,
      tool_name: "write",
      tool_input: {},
      tool_response: "Modified src/large-a.json\nModified src/large-b.json"
    });

    expect(feedback).toMatchObject({
      status: "done",
      outcome: "skipped",
      checked_files: ["src/large-a.json", "src/large-b.json"],
      findings: [],
      visible_message: undefined,
      deferred_checks: [
        {
          reason: "diagnostics_skipped",
          outcome: "skipped",
          count: 2,
          paths: ["src/large-a.json", "src/large-b.json"]
        }
      ]
    });
    expect(readHookRecords(logPath)).toEqual([
      expect.objectContaining({
        status: "check_skipped",
        reason: "large_or_unreadable_file",
        path: "src/large-a.json"
      }),
      expect.objectContaining({
        status: "check_skipped",
        reason: "large_or_unreadable_file",
        path: "src/large-b.json"
      })
    ]);
  });

  it("classifies failed or unknown tool results as errored without hook output", () => {
    const failedPayload = {
      cwd: fixtureRoot,
      tool_name: "write",
      tool_input: {
        path: "src/clean.ts"
      },
      tool_response: {
        code: 1
      }
    };
    const feedback = hook.buildPostEditFeedback(failedPayload);

    expect(feedback).toMatchObject({
      status: "done",
      outcome: "errored",
      checked_files: ["src/clean.ts"],
      findings: [],
      visible_message: undefined,
      deferred_checks: [
        {
          reason: "diagnostics_error",
          outcome: "errored",
          count: 1
        }
      ]
    });
    expect(hook.buildPostEditContext(failedPayload, basicFeedbackEnv(logPath))).toBeUndefined();
  });
});

function payload(files: string[]) {
  return {
    cwd: fixtureRoot,
    tool_name: "write",
    tool_input: {},
    tool_response: files.map((file) => `Modified ${file}`).join("\n")
  };
}

function basicFeedbackEnv(logPath: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    AGENT_WORKBENCH_HOOK_FEEDBACK: "basic",
    AGENT_WORKBENCH_HOOK_LOG_PATH: logPath
  };
}

function readHookRecords(logPath: string): Array<Record<string, unknown>> {
  if (!fs.existsSync(logPath)) {
    return [];
  }
  return fs
    .readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
