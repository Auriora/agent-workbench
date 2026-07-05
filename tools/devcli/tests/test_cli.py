# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from typer.testing import CliRunner

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "tools" / "devcli" / "src"
sys.path.insert(0, str(SRC))

from auriora_dev.cli import app  # noqa: E402
from auriora_dev.commands.cache import inspect_database  # noqa: E402
from auriora_dev.commands.check import build_check_plan  # noqa: E402
from auriora_dev.commands.mcp import build_smoke_plan  # noqa: E402
from auriora_dev.commands.package import build_install_plan, build_package_check_plan  # noqa: E402
from auriora_dev.commands.plugin import build_refresh_plan  # noqa: E402
from auriora_dev.commands.release import (  # noqa: E402
    build_github_release_plan,
    build_preflight_plan,
    build_release_tag_plan,
    update_release_version,
    verify_release_artifacts,
)
from auriora_dev.commands.release_notes import parse_name_status  # noqa: E402
from auriora_dev.commands.spec import build_spec_plan  # noqa: E402


class CliTests(unittest.TestCase):
    def test_help_exposes_awb_commands_without_template_placeholders(self) -> None:
        result = CliRunner().invoke(app, ["--help"])
        self.assertEqual(result.exit_code, 0, result.output)
        for expected in ["check", "package", "plugin", "mcp", "cache", "spec", "release", "doctor"]:
            self.assertIn(expected, result.output)
        self.assertNotIn("Template Placeholder", result.output)
        self.assertNotIn("lite project template", result.output)

    def test_check_plan_order(self) -> None:
        plan = build_check_plan(ROOT, typecheck=True, tests=True, plugin=True)
        self.assertEqual(
            [spec.argv for spec in plan],
            [
                ("pnpm", "typecheck"),
                ("pnpm", "test"),
                ("pnpm", "run", "validate:plugin"),
            ],
        )

    def test_package_check_plan_is_dry_run_safe_by_default(self) -> None:
        plan = build_package_check_plan(ROOT, with_integration=False)
        self.assertEqual(plan[0].argv, ("pnpm", "run", "validate:plugin"))
        self.assertEqual(
            plan[1].argv,
            ("scripts/install-agent-workbench-package.sh", "--dry-run", "--skip-codex-config"),
        )
        self.assertEqual(plan[2].argv, ("pnpm", "pack:dry-run"))
        self.assertEqual(len(plan), 3)

    def test_install_plan_passes_supported_options(self) -> None:
        plan = build_install_plan(
            ROOT,
            prefix=Path("/tmp/prefix"),
            codex_home=Path("/tmp/codex"),
            skip_codex_config=True,
            dry_run=True,
        )
        self.assertEqual(
            plan[0].argv,
            (
                "scripts/install-agent-workbench-package.sh",
                "--prefix",
                "/tmp/prefix",
                "--codex-home",
                "/tmp/codex",
                "--skip-codex-config",
                "--dry-run",
            ),
        )
        self.assertFalse(plan[0].mutates)

    def test_plugin_refresh_plan_is_explicitly_mutating(self) -> None:
        plan = build_refresh_plan(ROOT)
        self.assertTrue(all(spec.mutates for spec in plan))
        self.assertEqual(plan[0].argv, ("codex", "plugin", "add", "agent-workbench@auriora-local"))

    def test_spec_plan_targets_docs_specs_runtime(self) -> None:
        with patch.dict(os.environ, {"SPEC_LIFECYCLE_RUNTIME": "/tmp/lifecycle-runtime"}):
            plan = build_spec_plan(ROOT, "lint", Path("docs/specs/028-dev-cli-workflow-tools"))
        self.assertEqual(plan[0].argv[0], "python3")
        self.assertEqual(plan[0].argv[1], "/tmp/lifecycle-runtime")
        self.assertEqual(plan[0].argv[2:], ("lint", "docs/specs/028-dev-cli-workflow-tools"))

    def test_mcp_smoke_plan_uses_supported_debug_use_cases(self) -> None:
        plan = build_smoke_plan(ROOT, ROOT, timeout=5)
        self.assertEqual(plan[0].argv[:2], ("pnpm", "debug:mcp-status"))
        self.assertEqual(plan[1].argv[2:5], ("--", "scope", str(ROOT)))
        self.assertEqual(plan[2].argv[2:5], ("--", "overview", str(ROOT)))
        self.assertEqual(plan[3].argv[2:5], ("--", "context", str(ROOT)))
        self.assertTrue(all(spec.timeout_seconds == 5 for spec in plan))

    def test_release_preflight_reuses_package_check_without_publish_steps(self) -> None:
        plan = build_preflight_plan(ROOT, with_integration=False)
        argv = [spec.argv for spec in plan]
        self.assertIn(("pnpm", "pack:dry-run"), argv)
        self.assertNotIn(("git", "push"), argv)
        self.assertNotIn(("npm", "publish"), argv)

    def test_github_release_plan_creates_tarball_tag_and_release(self) -> None:
        plan = build_github_release_plan(
            ROOT,
            version="0.4.0",
            notes_file=Path("notes.md"),
            title=None,
            draft=False,
            prerelease=False,
            existing=False,
            create_tag=True,
            push_tag=True,
            preflight=False,
            with_integration=False,
        )
        self.assertEqual(
            [spec.argv for spec in plan],
            [
                ("env", "npm_config_cache=/tmp/agent-workbench-npm-cache", "npm", "pack"),
                ("git", "tag", "-a", "v0.4.0", "-m", "Release v0.4.0"),
                ("git", "push", "origin", "v0.4.0"),
                (
                    "gh",
                    "release",
                    "create",
                    "v0.4.0",
                    "auriora-agent-workbench-0.4.0.tgz",
                    "--title",
                    "v0.4.0",
                    "--notes-file",
                    "notes.md",
                ),
            ],
        )
        self.assertTrue(all(spec.mutates for spec in plan))

    def test_release_tag_plan_creates_annotated_tag_and_pushes(self) -> None:
        plan = build_release_tag_plan(
            ROOT,
            version="0.4.0",
            remote="origin",
            push=True,
            force=False,
        )

        self.assertEqual(
            [spec.argv for spec in plan],
            [
                ("git", "tag", "-a", "v0.4.0", "-m", "Release v0.4.0"),
                ("git", "push", "origin", "v0.4.0"),
            ],
        )
        self.assertTrue(all(spec.mutates for spec in plan))

    def test_release_tag_plan_force_replaces_tag_and_pushes_forcefully(self) -> None:
        plan = build_release_tag_plan(
            ROOT,
            version="v0.4.0",
            remote="upstream",
            push=True,
            force=True,
        )

        self.assertEqual(
            [spec.argv for spec in plan],
            [
                ("git", "tag", "-f", "-a", "v0.4.0", "-m", "Release v0.4.0"),
                ("git", "push", "--force", "upstream", "v0.4.0"),
            ],
        )

    def test_github_release_plan_uploads_existing_release_without_tag_steps(self) -> None:
        plan = build_github_release_plan(
            ROOT,
            version="v0.4.0",
            notes_file=None,
            title="ignored",
            draft=True,
            prerelease=True,
            existing=True,
            create_tag=True,
            push_tag=True,
            preflight=False,
            with_integration=False,
        )
        self.assertEqual(
            [spec.argv for spec in plan],
            [
                ("env", "npm_config_cache=/tmp/agent-workbench-npm-cache", "npm", "pack"),
                (
                    "gh",
                    "release",
                    "upload",
                    "v0.4.0",
                    "auriora-agent-workbench-0.4.0.tgz",
                    "--clobber",
                ),
            ],
        )

    def test_bump_version_updates_release_metadata_and_current_docs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for relative in [
                "packaging/agent-workbench",
                ".well-known/mcp",
                "plugins/agent-workbench/.codex-plugin",
                "plugins/agent-workbench/claude-plugin/.claude-plugin",
                "docs/runbooks",
            ]:
                (root / relative).mkdir(parents=True, exist_ok=True)
            for relative, payload in [
                ("package.json", {"name": "@auriora/agent-workbench", "version": "0.3.0"}),
                (
                    "packaging/agent-workbench/package-manifest.json",
                    {
                        "version": "0.3.0",
                        "install_command": "old",
                        "codex": {"plugin_install_model": "old"},
                    },
                ),
                ("packaging/agent-workbench/npm-package.json", {"install_command": "old"}),
                (".well-known/mcp/server-card.json", {"version": "0.3.0"}),
                ("plugins/agent-workbench/.codex-plugin/plugin.json", {"version": "0.3.0"}),
                ("plugins/agent-workbench/claude-plugin/.claude-plugin/plugin.json", {"version": "0.3.0"}),
            ]:
                (root / relative).write_text(json.dumps(payload) + "\n", encoding="utf-8")
            for relative in [
                "README.md",
                "docs/runbooks/install-agent-workbench.md",
                "packaging/agent-workbench/README.md",
                "plugins/agent-workbench/README.md",
            ]:
                (root / relative).write_text(
                    "npm install -g https://github.com/Auriora/agent-workbench/releases/download/v0.3.0/auriora-agent-workbench-0.3.0.tgz\n",
                    encoding="utf-8",
                )

            changed = update_release_version(root, "0.4.0")

            self.assertIn(root / "package.json", changed)
            package = json.loads((root / "package.json").read_text(encoding="utf-8"))
            manifest = json.loads(
                (root / "packaging/agent-workbench/package-manifest.json").read_text(
                    encoding="utf-8"
                )
            )
            npm_contract = json.loads(
                (root / "packaging/agent-workbench/npm-package.json").read_text(
                    encoding="utf-8"
                )
            )
            self.assertEqual(package["version"], "0.4.0")
            self.assertEqual(manifest["version"], "0.4.0")
            self.assertNotIn("version", npm_contract)
            self.assertIn("v0.4.0/auriora-agent-workbench-0.4.0.tgz", manifest["install_command"])
            self.assertIn("v0.4.0/auriora-agent-workbench-0.4.0.tgz", (root / "README.md").read_text(encoding="utf-8"))

    def test_verify_release_artifacts_requires_matching_metadata_and_release_note(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = self._make_release_artifacts_fixture(Path(tmp))

            notes_path = verify_release_artifacts(root, "v0.4.0")

            self.assertEqual(notes_path, root / "docs/release-notes/v0.4.0.md")

    def test_verify_release_artifacts_reports_missing_release_note(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = self._make_release_artifacts_fixture(Path(tmp))
            (root / "docs/release-notes/v0.4.0.md").unlink()

            with self.assertRaisesRegex(ValueError, "Missing release notes"):
                verify_release_artifacts(root, "0.4.0")

    def test_release_tag_command_dry_run_checks_artifacts_and_pushes_tag(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = self._make_release_artifacts_fixture(Path(tmp))

            result = CliRunner().invoke(
                app,
                ["release", "tag", "0.4.0", "--repo-root", str(root), "--dry-run"],
            )

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertIn("release notes: docs/release-notes/v0.4.0.md", result.output)
            self.assertIn("cmd: git tag -a v0.4.0 -m Release v0.4.0", result.output)
            self.assertIn("cmd: git push origin v0.4.0", result.output)

    def test_release_tag_command_requires_clean_tree_unless_forced(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = self._make_release_artifacts_fixture(Path(tmp))
            (root / "uncommitted.txt").write_text("dirty\n", encoding="utf-8")

            blocked = CliRunner().invoke(
                app,
                ["release", "tag", "0.4.0", "--repo-root", str(root), "--dry-run"],
            )
            forced = CliRunner().invoke(
                app,
                ["release", "tag", "0.4.0", "--repo-root", str(root), "--dry-run", "--force"],
            )

            self.assertEqual(blocked.exit_code, 1, blocked.output)
            self.assertIn("Working tree is dirty; pass --force to continue.", blocked.output)
            self.assertEqual(forced.exit_code, 0, forced.output)
            self.assertIn("cmd: git tag -f -a v0.4.0 -m Release v0.4.0", forced.output)

    def test_release_name_status_parser_preserves_rename_and_copy_scores(self) -> None:
        changes = parse_name_status("M\tREADME.md\nR100\told.md\tnew.md\nC085\tsrc/a.py\tsrc/b.py\n")

        self.assertEqual(changes[0].status, "M")
        self.assertIsNone(changes[0].old_path)
        self.assertEqual(changes[1].status, "R")
        self.assertEqual(changes[1].raw_status, "R100")
        self.assertEqual(changes[1].score, 100)
        self.assertEqual(changes[1].old_path, "old.md")
        self.assertEqual(changes[1].path, "new.md")
        self.assertEqual(changes[2].status, "C")
        self.assertEqual(changes[2].score, 85)

    def test_release_notes_dry_run_uses_latest_tag_and_per_commit_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = self._make_release_notes_fixture(Path(tmp))

            result = CliRunner().invoke(
                app,
                [
                    "release",
                    "notes",
                    "--repo-root",
                    str(root),
                    "--version",
                    "0.4.0",
                    "--dry-run",
                    "--include-evidence",
                ],
            )

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertIn("# Agent Workbench v0.4.0", result.output)
            self.assertIn("Generated draft; review before publishing", result.output)
            self.assertIn("Packaging and install flow changed", result.output)
            self.assertIn("Developer CLI and automation changed", result.output)
            self.assertIn("Range: `v0.3.0..HEAD`", result.output)
            self.assertIn("Commits: 3", result.output)

    def test_release_notes_writes_markdown_json_and_agent_instructions(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = self._make_release_notes_fixture(Path(tmp))

            result = CliRunner().invoke(
                app,
                [
                    "release",
                    "notes",
                    "--repo-root",
                    str(root),
                    "--version",
                    "0.4.0",
                    "--validation-note",
                    "python -m unittest tools/devcli/tests/test_cli.py passed",
                    "--output",
                    "docs/release-notes/v0.4.0-draft.md",
                    "--evidence-output",
                    "docs/release-notes/v0.4.0-evidence.json",
                    "--agent-instructions",
                    "docs/release-notes/v0.4.0-agent.md",
                    "--format",
                    "markdown",
                ],
            )

            self.assertEqual(result.exit_code, 0, result.output)
            notes = root / "docs/release-notes/v0.4.0-draft.md"
            evidence_path = root / "docs/release-notes/v0.4.0-evidence.json"
            agent = root / "docs/release-notes/v0.4.0-agent.md"
            self.assertTrue(notes.exists())
            self.assertTrue(evidence_path.exists())
            self.assertTrue(agent.exists())
            evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
            self.assertEqual(evidence["selected_from_tag"], "v0.3.0")
            self.assertEqual(evidence["version"], "0.4.0")
            self.assertIn("from_revision", evidence)
            self.assertIn("to_revision", evidence)
            self.assertEqual(len(evidence["commits"]), 3)
            self.assertTrue(any(commit["files"] for commit in evidence["commits"]))
            self.assertIn("docs/release-notes/v0.4.0-evidence.json", agent.read_text(encoding="utf-8"))
            self.assertIn("python -m unittest", notes.read_text(encoding="utf-8"))

    def test_release_notes_dry_run_does_not_create_output_parent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = self._make_release_notes_fixture(Path(tmp))

            result = CliRunner().invoke(
                app,
                [
                    "release",
                    "notes",
                    "--repo-root",
                    str(root),
                    "--version",
                    "0.4.0",
                    "--output",
                    "docs/release-notes/v0.4.0-draft.md",
                    "--evidence-output",
                    "docs/release-notes/v0.4.0-evidence.json",
                    "--agent-instructions",
                    "docs/release-notes/v0.4.0-agent.md",
                    "--dry-run",
                ],
            )

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertFalse((root / "docs/release-notes").exists())
            self.assertIn("# Agent Workbench v0.4.0", result.output)

    def test_release_notes_empty_range_exits_nonzero_without_writing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = self._make_release_notes_fixture(Path(tmp), after_tag_commits=False)

            result = CliRunner().invoke(
                app,
                [
                    "release",
                    "notes",
                    "--repo-root",
                    str(root),
                    "--from",
                    "v0.3.0",
                    "--version",
                    "0.4.0",
                    "--output",
                    "docs/release-notes/v0.4.0-draft.md",
                ],
            )

            self.assertEqual(result.exit_code, 1, result.output)
            self.assertIn("has no commits", result.output)
            self.assertFalse((root / "docs/release-notes").exists())

    def test_release_notes_help_lists_evidence_and_review_options(self) -> None:
        result = CliRunner().invoke(app, ["release", "notes", "--help"])

        self.assertEqual(result.exit_code, 0, result.output)
        for expected in [
            "--from",
            "--to",
            "--version",
            "--output",
            "--format",
            "--include-evidence",
            "--evidence-output",
            "--validation-note",
            "--validation-file",
            "--final",
            "--dry-run",
            "--agent-instructions",
        ]:
            self.assertIn(expected, result.output)

    def test_cache_inspect_missing_database(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data = inspect_database(Path(tmp) / "missing.sqlite")
        self.assertEqual(data["status"], "missing")
        self.assertEqual(data["size_bytes"], 0)

    def test_cache_inspect_fixture_database(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "graph.sqlite"
            with sqlite3.connect(db) as conn:
                conn.executescript(
                    """
                    create table snapshots (id text, freshness text, created_at text);
                    create table files (id text);
                    create table nodes (id text);
                    create table edges (id text);
                    create table docs (id text);
                    insert into snapshots values ('s1', 'fresh', '2026-07-04T00:00:00Z');
                    insert into files values ('f1');
                    insert into nodes values ('n1');
                    insert into edges values ('e1');
                    insert into docs values ('d1');
                    """
                )
            data = inspect_database(db)
        self.assertEqual(data["status"], "present")
        self.assertEqual(data["metrics"]["snapshots"], 1)
        self.assertEqual(data["metrics"]["files"], 1)
        self.assertEqual(data["metrics"]["unresolved_references"], "unavailable")
        self.assertEqual(data["latest_snapshot"]["id"], "s1")
        json.dumps(data)

    def _make_release_notes_fixture(self, root: Path, *, after_tag_commits: bool = True) -> Path:
        (root / "docs").mkdir(parents=True)
        (root / "tools/devcli/src").mkdir(parents=True)
        (root / "packaging/agent-workbench").mkdir(parents=True)
        (root / "package.json").write_text(
            json.dumps({"name": "@auriora/agent-workbench", "version": "0.3.0"}) + "\n",
            encoding="utf-8",
        )
        (root / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n", encoding="utf-8")
        self._git(root, "init")
        self._git(root, "config", "user.email", "dev@example.com")
        self._git(root, "config", "user.name", "Dev User")
        (root / "README.md").write_text("Agent Workbench\n", encoding="utf-8")
        self._git(root, "add", ".")
        self._git(root, "commit", "-m", "Initial release baseline")
        self._git(root, "tag", "v0.3.0")
        self._git(root, "tag", "v0.4.0-rc.1")

        if after_tag_commits:
            (root / "tools/devcli/src/release_tool.py").write_text("print('notes')\n", encoding="utf-8")
            self._git(root, "add", ".")
            self._git(root, "commit", "-m", "Add release notes command")
            package = json.loads((root / "package.json").read_text(encoding="utf-8"))
            package["version"] = "0.4.0"
            (root / "package.json").write_text(json.dumps(package) + "\n", encoding="utf-8")
            self._git(root, "add", ".")
            self._git(root, "commit", "-m", "Update package metadata")
            (root / "docs/runbooks").mkdir(parents=True)
            (root / "docs/runbooks/release.md").write_text("Release notes workflow\n", encoding="utf-8")
            self._git(root, "add", ".")
            self._git(root, "commit", "-m", "Document release notes workflow")
        return root

    def _make_release_artifacts_fixture(self, root: Path) -> Path:
        for relative in [
            "packaging/agent-workbench",
            ".well-known/mcp",
            "plugins/agent-workbench/.codex-plugin",
            "plugins/agent-workbench/claude-plugin/.claude-plugin",
            "docs/release-notes",
        ]:
            (root / relative).mkdir(parents=True, exist_ok=True)
        install_command = (
            "npm install -g "
            "https://github.com/Auriora/agent-workbench/releases/download/v0.4.0/"
            "auriora-agent-workbench-0.4.0.tgz"
        )
        for relative, payload in [
            ("package.json", {"name": "@auriora/agent-workbench", "version": "0.4.0"}),
            (
                "packaging/agent-workbench/package-manifest.json",
                {
                    "version": "0.4.0",
                    "install_command": install_command,
                    "codex": {"plugin_install_model": install_command},
                },
            ),
            ("packaging/agent-workbench/npm-package.json", {"install_command": install_command}),
            (".well-known/mcp/server-card.json", {"version": "0.4.0"}),
            ("plugins/agent-workbench/.codex-plugin/plugin.json", {"version": "0.4.0"}),
            ("plugins/agent-workbench/claude-plugin/.claude-plugin/plugin.json", {"version": "0.4.0"}),
        ]:
            (root / relative).write_text(json.dumps(payload) + "\n", encoding="utf-8")
        (root / "docs/release-notes/v0.4.0.md").write_text(
            "# Agent Workbench v0.4.0\n\n## Highlights\n\n- Release fixture.\n",
            encoding="utf-8",
        )
        (root / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n", encoding="utf-8")
        self._git(root, "init")
        self._git(root, "config", "user.email", "dev@example.com")
        self._git(root, "config", "user.name", "Dev User")
        self._git(root, "add", ".")
        self._git(root, "commit", "-m", "Prepare release")
        return root

    def _git(self, root: Path, *args: str) -> None:
        subprocess.run(("git", *args), cwd=root, check=True, text=True, capture_output=True)


if __name__ == "__main__":
    unittest.main()
