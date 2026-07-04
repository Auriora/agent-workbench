# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import typer

from auriora_dev.commands.package import build_package_check_plan
from auriora_dev.runner import CommandSpec, run_plan, summarize


def build_preflight_plan(root: Path, *, with_integration: bool) -> list[CommandSpec]:
    return [
        *build_package_check_plan(root, with_integration=with_integration),
    ]


def _print_metadata(root: Path) -> None:
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    typer.echo(f"package: {package.get('name')} {package.get('version')}")
    for path in [
        root / "packaging" / "agent-workbench" / "Containerfile",
        root / ".github" / "workflows" / "release-ghcr.yml",
        root / "packaging" / "agent-workbench" / "npm-package.json",
    ]:
        state = "present" if path.exists() else "missing"
        typer.echo(f"{path.relative_to(root)}: {state}")


def register(app: typer.Typer) -> None:
    release_app = typer.Typer(no_args_is_help=True, help="Release preflight checks.")

    @release_app.command("preflight")
    def preflight(
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        with_integration: bool = typer.Option(False, "--with-integration", help="Run focused integration tests."),
        allow_dirty: bool = typer.Option(False, "--allow-dirty", help="Continue when the working tree is dirty."),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print commands without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        _print_metadata(root)
        if not dry_run:
            status = subprocess.run(
                ("git", "status", "--short"),
                cwd=root,
                check=False,
                text=True,
                capture_output=True,
            )
            if status.returncode != 0:
                typer.secho("git status --short failed.", fg=typer.colors.RED)
                raise typer.Exit(code=status.returncode)
            if status.stdout.strip() and not allow_dirty:
                typer.secho("Working tree is dirty; pass --allow-dirty to continue.", fg=typer.colors.RED)
                typer.echo(status.stdout, nl=not status.stdout.endswith("\n"))
                raise typer.Exit(code=1)
        results = run_plan(build_preflight_plan(root, with_integration=with_integration), dry_run=dry_run)
        summarize(results)
        typer.echo("Preflight does not push tags, publish npm, publish GHCR, or create releases.")

    app.add_typer(release_app, name="release")
