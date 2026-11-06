#!/usr/bin/env python3
## Copyright (C) 2026 Auriora
## SPDX-License-Identifier: GPL-3.0-or-later
"""Build and verify the sealed native grammar package artifacts."""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import gzip
import stat
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = ROOT / "packaging" / "agent-workbench" / "native-grammars"
MANIFEST_PATH = ARTIFACT_ROOT / "manifest.json"
MAX_ARCHIVE_BYTES = 100 * 1024 * 1024

ARTIFACTS = {
    "tree-sitter-ruby": {
        "package_name": "tree-sitter-ruby",
        "source_version": "0.23.1",
        "corrected_version": "0.23.1-awb.1",
        "url": "https://registry.npmjs.org/tree-sitter-ruby/-/tree-sitter-ruby-0.23.1.tgz",
        "sha512": "d9/RXgWjR6HanN7wTYhS5bpBQLz1VkH048Vm3CodPGyJVnamXMGb8oEhDypVCBq4QnHui9sTXuJBBP3WtCw5RA==",
        "source_sha256": "1f0f0c100e31ddf650962ebb1f1fb8420bdbabccd49582f6e731ea7478db639d",
        "source_inventory_sha256": "4cfedd84525d10e5ba1ed3e2b843e422fbb6b6c20efa585b0c0149a048cc959c",
        "archive_sha256": "3ec09920812e280e5e4237ccc45205f3c4b234271c8640f5111960acfad72c8e",
        "original_package_json_sha256": "07fb6a02a020df5fcedd8cc968b266de69eb6e5a1f1e43bd7c5817306339019c",
        "original_metadata": {"peerDependencies": {"tree-sitter": "^0.21.1"}},
        "metadata": {"peerDependencies": {"tree-sitter": "^0.25.0"}},
    },
    "tree-sitter-typescript": {
        "package_name": "tree-sitter-typescript",
        "source_version": "0.23.2",
        "corrected_version": "0.23.2-awb.1",
        "url": "https://registry.npmjs.org/tree-sitter-typescript/-/tree-sitter-typescript-0.23.2.tgz",
        "sha512": "e04JUUKxTT53/x3Uq1zIL45DoYKVfHH4CZqwgZhPg5qYROl5nQjV+85ruFzFGZxu+QeFVbRTPDRnqL9UbU4VeA==",
        "source_sha256": "0fdf63c35930a75885145d75ee63cb879da2d49db9bfe454bd8e60b08ba778a1",
        "source_inventory_sha256": "a7056927b68a756fa9ed3552f09888723f648ce73adf007e6f7f5b05532c537f",
        "archive_sha256": "a3e2e1088e152d742e3cae1466235fb91e4cc23e52696cbbbe91bfaa62fdc731",
        "original_package_json_sha256": "26892ef49837678a747f81e344ed26938ec5804e29e003ad34fd5a3c87c68baf",
        "original_metadata": {"peerDependencies": {"tree-sitter": "^0.21.0"}, "dependencies": {"tree-sitter-javascript": "^0.23.1"}},
        "metadata": {
            "peerDependencies": {"tree-sitter": "^0.25.0"},
            "dependencies": {"tree-sitter-javascript": "^0.25.0"},
        },
    },
}


def fail(message: str) -> None:
    raise RuntimeError(message)


def digest_bytes(data: bytes, algorithm: str = "sha256") -> str:
    return hashlib.new(algorithm, data).hexdigest()


def integrity_bytes(data: bytes) -> str:
    return "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode("ascii")


def inventory_digest(files: dict[str, bytes], modes: dict[str, int]) -> str:
    rows = [
        {"name": name, "sha256": digest_bytes(data), "mode": modes[name]}
        for name, data in sorted(files.items())
    ]
    canonical = json.dumps(rows, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return digest_bytes(canonical)


def safe_member(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "\\" in name:
        fail(f"unsafe archive member path: {name!r}")
    if path.parts[0:1] != ("package",):
        fail(f"archive member is outside package/: {name!r}")
    return path


def read_archive(path: Path) -> tuple[dict[str, bytes], dict[str, int]]:
    contents: dict[str, bytes] = {}
    modes: dict[str, int] = {}
    with tarfile.open(path, "r:gz") as tar:
        seen: set[str] = set()
        total = 0
        for member in tar.getmembers():
            safe_member(member.name)
            if member.name in seen:
                fail(f"duplicate archive member: {member.name}")
            seen.add(member.name)
            if not (member.isdir() or member.isreg()):
                fail(f"archive member is not regular: {member.name}")
            if member.size < 0 or member.size > MAX_ARCHIVE_BYTES:
                fail(f"archive member is too large: {member.name}")
            total += member.size
            if total > MAX_ARCHIVE_BYTES:
                fail("archive expanded size exceeds limit")
            if member.isdir():
                continue
            handle = tar.extractfile(member)
            if handle is None:
                fail(f"cannot read archive member: {member.name}")
            contents[member.name] = handle.read()
            modes[member.name] = stat.S_IMODE(member.mode)
    if "package/package.json" not in contents:
        fail("archive does not contain package/package.json")
    return contents, modes


def corrected_package(original: bytes, artifact: dict[str, object]) -> tuple[bytes, dict[str, dict[str, object]]]:
    try:
        value = json.loads(original.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail(f"invalid package metadata: {exc}")
    if value.get("name") != artifact["package_name"]:
        fail(f"unexpected source package name: {value.get('name')!r}")
    if value.get("version") != artifact["source_version"]:
        fail(f"unexpected source package version: {value.get('version')!r}")
    for section, patch in dict(artifact["original_metadata"]).items():
        target = value.get(section, {})
        for key, expected in dict(patch).items():
            if target.get(key) != expected:
                fail(f"unexpected original {section}.{key} metadata")
    changes: dict[str, dict[str, object]] = {"version": {"from": value["version"], "to": artifact["corrected_version"]}}
    value["version"] = artifact["corrected_version"]
    for section, patch in dict(artifact["metadata"]).items():
        target = value.setdefault(section, {})
        for key, expected in dict(patch).items():
            changes[f"{section}.{key}"] = {"from": target.get(key), "to": expected}
            target[key] = expected
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8"), changes


def write_archive(path: Path, files: dict[str, bytes], modes: dict[str, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as output:
        with gzip.GzipFile(fileobj=output, mode="wb", filename="", mtime=0, compresslevel=9) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as tar:
                for name in sorted(files):
                    info = tarfile.TarInfo(name)
                    info.size = len(files[name])
                    info.mode = modes[name]
                    info.mtime = 0
                    info.uid = info.gid = 0
                    info.uname = info.gname = ""
                    tar.addfile(info, io.BytesIO(files[name]))


def rebuild() -> None:
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    entries: dict[str, object] = {"schema_version": 1, "artifacts": {}}
    with tempfile.TemporaryDirectory(prefix="awb-native-grammar-") as tmp:
        for name, artifact in ARTIFACTS.items():
            source_path = Path(tmp) / f"{name}.tgz"
            with urllib.request.urlopen(str(artifact["url"]), timeout=60) as response:
                source = response.read(MAX_ARCHIVE_BYTES + 1)
            if len(source) > MAX_ARCHIVE_BYTES:
                fail(f"source archive exceeds size limit: {name}")
            if integrity_bytes(source) != "sha512-" + str(artifact["sha512"]):
                fail(f"source integrity mismatch: {name}")
            source_path.write_bytes(source)
            files, modes = read_archive(source_path)
            original_manifest = files["package/package.json"]
            corrected, changes = corrected_package(original_manifest, artifact)
            files["package/package.json"] = corrected
            output = ARTIFACT_ROOT / f"{name}-{artifact['corrected_version']}.tgz"
            write_archive(output, files, modes)
            entries["artifacts"][name] = {
                "source": {"url": artifact["url"], "version": artifact["source_version"], "integrity": integrity_bytes(source), "sha256": digest_bytes(source)},
                "source_member_inventory_sha256": inventory_digest({**files, "package/package.json": original_manifest}, modes),
                "corrected_version": artifact["corrected_version"],
                "archive": output.name,
                "archive_sha256": digest_bytes(output.read_bytes()),
                "allowed_metadata_changes": changes,
                "members": {key: {"sha256": digest_bytes(value), "mode": modes[key]} for key, value in sorted(files.items()) if key != "package/package.json"},
                "original_package_json_sha256": digest_bytes(original_manifest),
                "original_package_json_base64": base64.b64encode(original_manifest).decode("ascii"),
                "original_package_json_mode": modes["package/package.json"],
                "corrected_package_json_sha256": digest_bytes(corrected),
            }
    MANIFEST_PATH.write_text(json.dumps(entries, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    check()


def check() -> None:
    if not MANIFEST_PATH.is_file():
        fail(f"missing provenance manifest: {MANIFEST_PATH}")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if set(manifest) != {"schema_version", "artifacts"} or manifest.get("schema_version") != 1:
        fail("unsupported provenance schema")
    if set(manifest.get("artifacts", {})) != set(ARTIFACTS):
        fail("provenance artifact keys do not match the pinned artifact set")
    for name, recorded in manifest["artifacts"].items():
        artifact = ARTIFACTS[name]
        expected_record_keys = {
            "source", "source_member_inventory_sha256", "corrected_version", "archive",
            "archive_sha256", "allowed_metadata_changes", "members",
            "original_package_json_sha256", "original_package_json_base64",
            "original_package_json_mode", "corrected_package_json_sha256",
        }
        if set(recorded) != expected_record_keys:
            fail(f"provenance fields do not match the pinned schema: {name}")
        expected_archive = f"{name}-{artifact['corrected_version']}.tgz"
        expected_source = {
            "url": artifact["url"],
            "version": artifact["source_version"],
            "integrity": "sha512-" + artifact["sha512"],
            "sha256": artifact["source_sha256"],
        }
        if recorded.get("source") != expected_source:
            fail(f"pinned source provenance mismatch: {name}")
        if recorded.get("archive") != expected_archive or recorded.get("corrected_version") != artifact["corrected_version"]:
            fail(f"archive identity mismatch: {name}")
        if recorded.get("archive_sha256") != artifact["archive_sha256"]:
            fail(f"archive hash is not pinned: {name}")
        original = base64.b64decode(recorded.get("original_package_json_base64", ""), validate=True)
        if digest_bytes(original) != artifact["original_package_json_sha256"] or recorded.get("original_package_json_sha256") != artifact["original_package_json_sha256"]:
            fail(f"original package metadata provenance mismatch: {name}")
        if recorded.get("source_member_inventory_sha256") != artifact["source_inventory_sha256"]:
            fail(f"source member inventory is not pinned: {name}")
        path = ARTIFACT_ROOT / recorded["archive"]
        if not path.is_file():
            fail(f"missing corrected archive: {path}")
        archive = path.read_bytes()
        if digest_bytes(archive) != artifact["archive_sha256"]:
            fail(f"corrected archive hash mismatch: {name}")
        files, modes = read_archive(path)
        package = files.get("package/package.json")
        if package is None or digest_bytes(package) != recorded["corrected_package_json_sha256"]:
            fail(f"corrected package metadata mismatch: {name}")
        expected_package, expected_changes = corrected_package(original, artifact)
        if package != expected_package or recorded.get("allowed_metadata_changes") != expected_changes:
            fail(f"unauthorized package metadata change: {name}")
        source_files = dict(files)
        source_files["package/package.json"] = original
        source_modes = dict(modes)
        source_modes["package/package.json"] = int(recorded.get("original_package_json_mode", -1))
        if inventory_digest(source_files, source_modes) != artifact["source_inventory_sha256"]:
            fail(f"source member inventory mismatch: {name}")
        expected_members = set(recorded["members"])
        if set(files) - (expected_members | {"package/package.json"}):
            fail(f"unrecorded payload member: {name}")
        if expected_members - set(files):
            fail(f"missing payload member: {name}")
        for member, expected in recorded["members"].items():
            if digest_bytes(files[member]) != expected["sha256"] or modes[member] != expected["mode"]:
                fail(f"upstream payload member changed: {name}:{member}")
        try:
            package_value = json.loads(package.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            fail(f"invalid corrected metadata {name}: {exc}")
        if package_value.get("version") != recorded["corrected_version"]:
            fail(f"corrected version mismatch: {name}")
    print(f"native grammar artifact check passed ({len(manifest.get('artifacts', {}))} artifacts)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.rebuild == args.check:
        parser.error("choose exactly one of --rebuild or --check")
    try:
        rebuild() if args.rebuild else check()
    except Exception as exc:
        print(f"native grammar artifact check failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
