# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

from pathlib import Path

import typer

from auriora_dev.runner import CommandSpec, run_plan, summarize


FOCUSED_INTEGRATION_TESTS = (
    "tests/integration/codex-integration-profile.test.ts",
    "tests/integration/common-integration-profile.test.ts",
)


def build_package_check_plan(root: Path, *, with_integration: bool) -> list[CommandSpec]:
    plan = [
        CommandSpec(("pnpm", "run", "validate:plugin"), root, "Plugin and package metadata validation"),
        CommandSpec(
            ("scripts/install-agent-workbench-package.sh", "--dry-run", "--skip-codex-config"),
            root,
            "Package installer dry-run",
        ),
        CommandSpec(("pnpm", "pack:dry-run"), root, "NPM package payload dry-run"),
    ]
    if with_integration:
        plan.append(
            CommandSpec(
                ("pnpm", "exec", "vitest", "run", *FOCUSED_INTEGRATION_TESTS),
                root,
                "Focused package integration tests",
            )
        )
    return plan


def build_install_plan(
    root: Path,
    *,
    prefix: Path | None,
    codex_home: Path | None,
    skip_codex_config: bool,
    dry_run: bool,
) -> list[CommandSpec]:
    argv = ["scripts/install-agent-workbench-package.sh"]
    if prefix is not None:
        argv.extend(["--prefix", str(prefix)])
    if codex_home is not None:
        argv.extend(["--codex-home", str(codex_home)])
    if skip_codex_config:
        argv.append("--skip-codex-config")
    if dry_run:
        argv.append("--dry-run")
    return [CommandSpec(tuple(argv), root, "Install local Agent Workbench package", mutates=not dry_run)]


def register(app: typer.Typer) -> None:
    package_app = typer.Typer(no_args_is_help=True, help="Package validation and local install workflows.")

    @package_app.command("check")
    def package_check(
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        with_integration: bool = typer.Option(
            False,
            "--with-integration",
            help="Also run focused package integration tests.",
        ),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print commands without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        results = run_plan(build_package_check_plan(root, with_integration=with_integration), dry_run=dry_run)
        summarize(results)
        if not with_integration:
            typer.echo("Focused integration tests skipped; pass --with-integration to run them.")

    @package_app.command("install-local")
    def install_local(
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        prefix: Path | None = typer.Option(None, "--prefix", help="npm global prefix override."),
        codex_home: Path | None = typer.Option(None, "--codex-home", help="Codex home override for plugin registration."),
        skip_codex_config: bool = typer.Option(False, "--skip-codex-config", help="Do not register the Codex plugin."),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print installer actions without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        plan = build_install_plan(
            root,
            prefix=prefix,
            codex_home=codex_home,
            skip_codex_config=skip_codex_config,
            dry_run=dry_run,
        )
        results = run_plan(plan)
        summarize(results)
        typer.echo("Next: awb plugin status")

    app.add_typer(package_app, name="package")
