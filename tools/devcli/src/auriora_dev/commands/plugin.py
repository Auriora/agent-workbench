# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import typer

from auriora_dev.runner import CommandSpec, run_plan, summarize


CACHEBUSTER = Path("/home/bcherrington/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py")


def build_refresh_plan(root: Path) -> list[CommandSpec]:
    return [
        CommandSpec(
            ("python3", str(CACHEBUSTER), "plugins/agent-workbench"),
            root,
            "Refresh plugin cachebuster",
            mutates=True,
        ),
        CommandSpec(
            ("codex", "plugin", "add", "agent-workbench@auriora-local"),
            root,
            "Register local Codex plugin",
            mutates=True,
        ),
    ]


def _plugin_line(output: str) -> str | None:
    for line in output.splitlines():
        if "agent-workbench" in line:
            return line.strip()
    return None


def register(app: typer.Typer) -> None:
    plugin_app = typer.Typer(no_args_is_help=True, help="Codex plugin status and refresh workflows.")

    @plugin_app.command("status")
    def status() -> None:
        if shutil.which("codex") is None:
            typer.secho("Codex CLI unavailable; plugin status is degraded.", fg=typer.colors.YELLOW)
            raise typer.Exit(code=0)
        completed = subprocess.run(
            ("codex", "plugin", "list"),
            check=False,
            text=True,
            capture_output=True,
        )
        typer.echo(completed.stdout, nl=not completed.stdout.endswith("\n") if completed.stdout else True)
        if completed.returncode != 0:
            typer.secho("codex plugin list failed.", fg=typer.colors.RED)
            raise typer.Exit(code=completed.returncode)
        line = _plugin_line(completed.stdout)
        if line is None:
            typer.secho("agent-workbench plugin is not listed.", fg=typer.colors.YELLOW)
            return
        enabled = "enabled" in line.lower() or "installed" in line.lower()
        status_text = "installed/enabled" if enabled else "installed, enablement unclear"
        typer.secho(f"agent-workbench: {status_text}", fg=typer.colors.GREEN if enabled else typer.colors.YELLOW)
        typer.echo(line)

    @plugin_app.command("refresh")
    def refresh(
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print commands without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        typer.secho("This updates local Codex plugin registration.", fg=typer.colors.YELLOW)
        results = run_plan(build_refresh_plan(root), dry_run=dry_run)
        summarize(results)
        typer.echo("Restart Codex to rediscover skills, hooks, MCP tools, and plugin metadata.")

    app.add_typer(plugin_app, name="plugin")
