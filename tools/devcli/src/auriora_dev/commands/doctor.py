# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import shutil
import sys

import typer


def _tool(name: str) -> str:
    path = shutil.which(name)
    return path if path is not None else "unavailable"


def register(app: typer.Typer) -> None:
    @app.command("doctor")
    def doctor() -> None:
        """Report local toolchain availability without mutating the machine."""
        typer.echo(f"python: {sys.version.split()[0]}")
        for name in ["node", "pnpm", "codex", "docker", "git"]:
            typer.echo(f"{name}: {_tool(name)}")
        typer.echo("Install the CLI with: pip install --no-build-isolation -e tools/devcli")
