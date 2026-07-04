# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import json
import os
from pathlib import Path

import typer


def resolve_repo_root(repo_root: Path | None = None) -> Path:
    if repo_root is not None:
        root = repo_root.expanduser().resolve()
        if _is_repo_root(root):
            return root
        raise typer.BadParameter(f"{root} is not an Agent Workbench repository root.")

    env_root = os.environ.get("AGENT_WORKBENCH_REPO_ROOT")
    if env_root:
        return resolve_repo_root(Path(env_root))

    candidates = [Path.cwd(), Path(__file__).resolve()]
    for candidate in candidates:
        for path in [candidate, *candidate.parents]:
            if _is_repo_root(path):
                return path

    raise typer.BadParameter("Could not find the Agent Workbench repository root.")


def _is_repo_root(path: Path) -> bool:
    package_json = path / "package.json"
    if not package_json.exists():
        return False
    try:
        data = json.loads(package_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    return (
        data.get("name") == "@auriora/agent-workbench"
        and (path / "pnpm-lock.yaml").exists()
        and (path / "docs").is_dir()
    )


def relative_to_root(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except ValueError:
        return str(path)
