/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(".");
const script = path.join(repoRoot, "scripts", "native-grammar-artifacts.py");
const artifactRoot = path.join(repoRoot, "packaging", "agent-workbench", "native-grammars");

function runCheck(root = artifactRoot): string {
  const moduleProbe = [
    "import importlib.util, pathlib, sys",
    `spec=importlib.util.spec_from_file_location('artifacts', ${JSON.stringify(script)})`,
    "module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)",
    `module.ARTIFACT_ROOT=pathlib.Path(${JSON.stringify(root)})`,
    `module.MANIFEST_PATH=pathlib.Path(${JSON.stringify(path.join(root, "manifest.json"))})`,
    "module.check()",
  ].join("; ");
  return execFileSync("python3", ["-c", moduleProbe], { encoding: "utf8" });
}

function copyFixture(): string {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-native-grammar-test-"));
  fs.cpSync(artifactRoot, temporaryRoot, { recursive: true });
  return temporaryRoot;
}

function repackWithMutation(archive: string, memberName: string, packageMetadata: boolean): { archiveSha256: string; memberSha256: string } {
  const helper = String.raw`
import gzip, hashlib, io, json, pathlib, stat, sys, tarfile

archive = pathlib.Path(sys.argv[1])
target = sys.argv[2]
package_metadata = sys.argv[3] == "1"
entries = []
with tarfile.open(archive, "r:gz") as source:
    for member in source.getmembers():
        data = None
        if member.isreg():
            handle = source.extractfile(member)
            if handle is None:
                raise RuntimeError(member.name)
            data = handle.read()
            if member.name == target:
                if package_metadata:
                    value = json.loads(data.decode("utf-8"))
                    value["x-unauthorized-metadata"] = "must be rejected"
                    data = (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
                else:
                    data += b"\n/* unauthorized payload mutation */\n"
        entries.append((member.name, member, data))

with archive.open("wb") as output:
    with gzip.GzipFile(fileobj=output, mode="wb", filename="", mtime=0, compresslevel=9) as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as destination:
            for name, original, data in sorted(entries):
                info = tarfile.TarInfo(name)
                info.mode = stat.S_IMODE(original.mode)
                info.mtime = 0
                info.uid = info.gid = 0
                info.uname = info.gname = ""
                if original.isdir():
                    info.type = tarfile.DIRTYPE
                    info.size = 0
                    destination.addfile(info)
                else:
                    assert data is not None
                    info.size = len(data)
                    destination.addfile(info, io.BytesIO(data))

archive_bytes = archive.read_bytes()
member_bytes = next(data for name, _, data in entries if name == target)
assert member_bytes is not None
print(json.dumps({
    "archiveSha256": hashlib.sha256(archive_bytes).hexdigest(),
    "memberSha256": hashlib.sha256(member_bytes).hexdigest(),
}))
`;
  return JSON.parse(execFileSync("python3", ["-c", helper, archive, memberName, packageMetadata ? "1" : "0"], { encoding: "utf8" }));
}

describe("sealed native grammar artifacts", () => {
  it("verifies the checked-in upstream payloads offline", () => {
    expect(runCheck()).toContain("2 artifacts");
  });

  it("rejects a changed native payload member and leaves the checkout untouched", () => {
    const temporaryRoot = copyFixture();
    try {
      const archive = path.join(temporaryRoot, "tree-sitter-ruby-0.23.1-awb.1.tgz");
      const bytes = fs.readFileSync(archive);
      bytes[bytes.length - 1] ^= 0x01;
      fs.writeFileSync(archive, bytes);
      expect(() => runCheck(temporaryRoot)).toThrow(/archive hash mismatch|payload member changed/);
      expect(runCheck()).toContain("2 artifacts");
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it.each([
    ["empty manifest", (manifest: Record<string, unknown>) => ({})],
    ["source URL tamper", (manifest: Record<string, any>) => {
      manifest.artifacts["tree-sitter-ruby"].source.url = "https://example.invalid/tampered.tgz";
      return manifest;
    }],
    ["archive path tamper", (manifest: Record<string, any>) => {
      manifest.artifacts["tree-sitter-ruby"].archive = "other.tgz";
      return manifest;
    }],
  ])("rejects %s in the provenance manifest", (_label, mutate) => {
    const temporaryRoot = copyFixture();
    try {
      const manifestPath = path.join(temporaryRoot, "manifest.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      fs.writeFileSync(manifestPath, JSON.stringify(mutate(manifest), null, 2));
      expect(() => runCheck(temporaryRoot)).toThrow();
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("rejects coordinated archive and manifest tampering", () => {
    const temporaryRoot = copyFixture();
    try {
      const manifestPath = path.join(temporaryRoot, "manifest.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const archive = path.join(temporaryRoot, manifest.artifacts["tree-sitter-ruby"].archive);
      const member = "package/src/grammar.json";
      const digests = repackWithMutation(archive, member, false);
      manifest.artifacts["tree-sitter-ruby"].archive_sha256 = digests.archiveSha256;
      manifest.artifacts["tree-sitter-ruby"].members[member].sha256 = digests.memberSha256;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      expect(() => runCheck(temporaryRoot)).toThrow();
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }, 30_000);

  it("rejects coordinated unauthorized package metadata with updated mutable hashes", () => {
    const temporaryRoot = copyFixture();
    try {
      const manifestPath = path.join(temporaryRoot, "manifest.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const archive = path.join(temporaryRoot, manifest.artifacts["tree-sitter-ruby"].archive);
      const digests = repackWithMutation(archive, "package/package.json", true);
      manifest.artifacts["tree-sitter-ruby"].archive_sha256 = digests.archiveSha256;
      manifest.artifacts["tree-sitter-ruby"].corrected_package_json_sha256 = digests.memberSha256;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      expect(() => runCheck(temporaryRoot)).toThrow();
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
