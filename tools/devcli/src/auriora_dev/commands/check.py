# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

from pathlib import Path

import typer

from auriora_dev.runner import CommandSpec, run_plan, summarize


def build_check_plan(
    root: Path,
    *,
    typecheck: bool,
    tests: bool,
    plugin: bool,
) -> list[CommandSpec]:
    plan: list[CommandSpec] = []
    if typecheck:
        plan.append(CommandSpec(("pnpm", "typecheck"), root, "TypeScript typecheck"))
    if tests:
        plan.append(CommandSpec(("pnpm", "test"), root, "Vitest suite"))
    if plugin:
        plan.append(
            CommandSpec(
                ("pnpm", "run", "validate:plugin"),
                root,
                "Plugin and package metadata validation",
            )
        )
    return plan


def register(app: typer.Typer) -> None:
    @app.command("check")
    def check(
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        typecheck: bool = typer.Option(True, "--typecheck/--no-typecheck"),
        tests: bool = typer.Option(True, "--tests/--no-tests"),
        plugin: bool = typer.Option(True, "--plugin/--no-plugin"),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print commands without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        plan = build_check_plan(root, typecheck=typecheck, tests=tests, plugin=plugin)
        if not plan:
            raise typer.BadParameter("At least one check stage must be enabled.")
        results = run_plan(plan, dry_run=dry_run)
        summarize(results)
