# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import os
from pathlib import Path

import typer

from auriora_dev.runner import CommandSpec, run_plan, summarize


DEFAULT_SPEC_RUNTIME = Path(
    "/home/bcherrington/.codex/plugins/cache/auriora-local/spec-lifecycle-manager/0.2.1/skills/spec-lifecycle-manager/scripts/spec_runtime.py"
)


def spec_runtime_path() -> Path:
    return Path(os.environ.get("SPEC_LIFECYCLE_RUNTIME", str(DEFAULT_SPEC_RUNTIME)))


def build_spec_plan(root: Path, command: str, path: Path | None = None) -> list[CommandSpec]:
    runtime = spec_runtime_path()
    argv = ["python3", str(runtime), command]
    argv.append(str(path) if path is not None else ".")
    return [CommandSpec(tuple(argv), root, f"Spec lifecycle {command}")]


def register(app: typer.Typer) -> None:
    spec_app = typer.Typer(no_args_is_help=True, help="Spec lifecycle wrappers for docs/specs packages.")

    @spec_app.command("list")
    def list_specs(
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print commands without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        results = run_plan(build_spec_plan(root, "scan"), dry_run=dry_run)
        summarize(results)

    @spec_app.command("summary")
    def summary(
        path: Path = typer.Argument(..., help="Spec package path, for example docs/specs/028-dev-cli-workflow-tools."),
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print commands without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        results = run_plan(build_spec_plan(root, "summary", path), dry_run=dry_run)
        summarize(results)

    @spec_app.command("lint")
    def lint(
        path: Path = typer.Argument(..., help="Spec package path, for example docs/specs/028-dev-cli-workflow-tools."),
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print commands without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        results = run_plan(build_spec_plan(root, "lint", path), dry_run=dry_run)
        summarize(results)

    app.add_typer(spec_app, name="spec")
