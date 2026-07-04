# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

from pathlib import Path

import typer

from auriora_dev.runner import CommandSpec, run_plan, summarize


def build_smoke_plan(root: Path, repo: Path, *, timeout: int) -> list[CommandSpec]:
    repo_arg = str(repo)
    return [
        CommandSpec(
            ("pnpm", "debug:mcp-status", "--", repo_arg),
            root,
            "MCP runtime status",
            timeout_seconds=timeout,
        ),
        CommandSpec(
            ("pnpm", "debug:mcp-use-case", "--", "scope", repo_arg),
            root,
            "MCP scope smoke",
            timeout_seconds=timeout,
        ),
        CommandSpec(
            ("pnpm", "debug:mcp-use-case", "--", "overview", repo_arg),
            root,
            "MCP overview smoke",
            timeout_seconds=timeout,
        ),
        CommandSpec(
            (
                "pnpm",
                "debug:mcp-use-case",
                "--",
                "context",
                repo_arg,
                "--task",
                "Smoke test bounded context retrieval.",
            ),
            root,
            "MCP context smoke",
            timeout_seconds=timeout,
        ),
    ]


def register(app: typer.Typer) -> None:
    mcp_app = typer.Typer(no_args_is_help=True, help="Bounded MCP smoke checks.")

    @mcp_app.command("smoke")
    def smoke(
        repo: Path = typer.Option(..., "--repo", help="Repository to smoke test."),
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Agent Workbench repository root override."),
        timeout: int = typer.Option(30, "--timeout", min=1, help="Per-step timeout in seconds."),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print commands without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        target = repo.expanduser().resolve()
        if not target.exists():
            raise typer.BadParameter(f"{target} does not exist.")
        results = run_plan(build_smoke_plan(root, target, timeout=timeout), dry_run=dry_run)
        summarize(results)

    app.add_typer(mcp_app, name="mcp")
