# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

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
from auriora_dev.commands.release import build_preflight_plan  # noqa: E402
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
        self.assertEqual(plan[1].argv, ("codex", "plugin", "add", "agent-workbench@auriora-local"))

    def test_spec_plan_targets_docs_specs_runtime(self) -> None:
        plan = build_spec_plan(ROOT, "lint", Path("docs/specs/028-dev-cli-workflow-tools"))
        self.assertEqual(plan[0].argv[0], "python3")
        self.assertIn("spec_runtime.py", plan[0].argv[1])
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


if __name__ == "__main__":
    unittest.main()
