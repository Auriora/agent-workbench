# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import typer


@dataclass(frozen=True)
class CommandSpec:
    argv: tuple[str, ...]
    cwd: Path
    label: str
    mutates: bool = False
    timeout_seconds: int | None = None


@dataclass(frozen=True)
class CommandResult:
    spec: CommandSpec
    exit_code: int
    elapsed_seconds: float
    skipped: bool = False


class CommandExecutor(Protocol):
    def __call__(self, spec: CommandSpec) -> int: ...


class CommandFailed(RuntimeError):
    def __init__(self, result: CommandResult) -> None:
        self.result = result
        super().__init__(
            f"{result.spec.label} failed with exit code {result.exit_code}"
        )


def format_argv(argv: tuple[str, ...]) -> str:
    return " ".join(argv)


def run_command(
    spec: CommandSpec,
    *,
    dry_run: bool = False,
    executor: CommandExecutor | None = None,
) -> CommandResult:
    typer.echo(f"==> {spec.label}")
    typer.echo(f"cwd: {spec.cwd}")
    typer.echo(f"cmd: {format_argv(spec.argv)}")

    if dry_run:
        typer.echo("dry-run: skipped")
        return CommandResult(spec=spec, exit_code=0, elapsed_seconds=0.0, skipped=True)

    start = time.monotonic()
    if executor is None:
        completed = subprocess.run(
            spec.argv,
            cwd=spec.cwd,
            timeout=spec.timeout_seconds,
            check=False,
        )
        exit_code = completed.returncode
    else:
        exit_code = executor(spec)

    elapsed = time.monotonic() - start
    result = CommandResult(spec=spec, exit_code=exit_code, elapsed_seconds=elapsed)
    if exit_code != 0:
        typer.secho(
            f"failed: {spec.label} exited {exit_code} after {elapsed:.1f}s",
            fg=typer.colors.RED,
        )
        raise typer.Exit(code=exit_code)

    typer.secho(f"passed: {spec.label} ({elapsed:.1f}s)", fg=typer.colors.GREEN)
    return result


def run_plan(
    plan: list[CommandSpec],
    *,
    dry_run: bool = False,
    executor: CommandExecutor | None = None,
) -> list[CommandResult]:
    results: list[CommandResult] = []
    for spec in plan:
        results.append(run_command(spec, dry_run=dry_run, executor=executor))
    return results


def summarize(results: list[CommandResult]) -> None:
    if not results:
        typer.secho("No stages ran.", fg=typer.colors.YELLOW)
        return
    typer.secho("Summary", bold=True)
    for result in results:
        status = "dry-run" if result.skipped else "passed"
        typer.echo(f"- {result.spec.label}: {status}")
