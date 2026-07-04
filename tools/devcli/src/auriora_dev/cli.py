# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import re
from pathlib import Path

import typer


app = typer.Typer(
    no_args_is_help=True,
    help="Stable developer CLI for the lite project template.",
)
spec_app = typer.Typer(help="Work with visible repo spec files.")
app.add_typer(spec_app, name="spec")


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _spec_paths() -> dict[str, Path]:
    root = _repo_root()
    return {
        "requirements": root / "docs" / "spec" / "requirements.md",
        "design": root / "docs" / "spec" / "design.md",
        "tasks": root / "docs" / "spec" / "tasks.md",
    }


def _spec_dir_paths() -> dict[str, Path]:
    root = _repo_root()
    return {
        "requirements_dir": root / "docs" / "spec" / "requirements",
        "design_dir": root / "docs" / "spec" / "design",
        "tasks_dir": root / "docs" / "spec" / "tasks",
    }


def _placeholder(name: str, detail: str) -> None:
    typer.secho("Template Placeholder", fg=typer.colors.CYAN, bold=True)
    typer.echo(f"{name}: {detail}")


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    slug = slug.strip("-")
    if not slug:
        raise typer.BadParameter("Could not derive a usable slug from the input.")
    return slug


def _write_if_missing(path: Path, content: str) -> None:
    if path.exists():
        raise typer.BadParameter(f"{path.relative_to(_repo_root())} already exists.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


@app.command()
def setup() -> None:
    """Install or verify local development prerequisites."""
    _placeholder(
        "setup",
        "Replace this command with project-specific environment setup steps.",
    )


@app.command()
def dev() -> None:
    """Run the project locally."""
    _placeholder(
        "dev",
        "Replace this command with the local run workflow for the project.",
    )


@app.command()
def lint() -> None:
    """Run formatting and lint checks."""
    _placeholder(
        "lint",
        "Replace this command with project-specific lint and formatting checks.",
    )


@app.command()
def test() -> None:
    """Run automated tests."""
    _placeholder(
        "test",
        "Replace this command with project-specific automated tests.",
    )


@spec_app.command("show")
def spec_show() -> None:
    """Show the visible spec files used by the template."""
    paths = _spec_paths()
    typer.secho("Visible spec files", bold=True)
    for name, path in paths.items():
        exists = "present" if path.exists() else "missing"
        typer.echo(f"- {name}: {path.relative_to(_repo_root())} [{exists}]")

    dir_paths = _spec_dir_paths()
    typer.echo("")
    typer.secho("Optional split spec directories", bold=True)
    for name, path in dir_paths.items():
        exists = "present" if path.exists() else "not in use"
        typer.echo(f"- {name}: {path.relative_to(_repo_root())} [{exists}]")


@spec_app.command("check")
def spec_check() -> None:
    """Fail if any of the default spec files are missing."""
    missing = [path for path in _spec_paths().values() if not path.exists()]
    if missing:
        for path in missing:
            typer.secho(
                f"Missing {path.relative_to(_repo_root())}",
                fg=typer.colors.RED,
            )
        raise typer.Exit(code=1)

    typer.secho("All default spec files are present.", fg=typer.colors.GREEN)
    typer.echo(
        "Keep requirements, design, tasks, and code consistent as work evolves."
    )


@spec_app.command("scaffold-split")
def spec_scaffold_split(
    kind: str = typer.Argument(..., help="One of: requirements, design"),
) -> None:
    """Create a split requirements or design directory with an index template."""
    root = _repo_root()
    normalized = kind.strip().lower()
    if normalized not in {"requirements", "design"}:
        raise typer.BadParameter("kind must be 'requirements' or 'design'.")

    split_dir = root / "docs" / "spec" / normalized
    index_path = split_dir / "README.md"

    title = "Requirements" if normalized == "requirements" else "Design"
    content = f"""# {title}

Use this directory when one `{normalized}.md` file is no longer enough.

## Suggested organization

- one file per feature, domain, or subsystem
- one overview or index entry in this file
- keep names short and obvious

## Files

- [{title} overview](../{normalized}.md)

Add focused files here as the project grows.
"""

    if index_path.exists():
        typer.secho(
            f"{index_path.relative_to(root)} already exists.",
            fg=typer.colors.YELLOW,
        )
        raise typer.Exit(code=0)

    _write_if_missing(index_path, content)
    typer.secho(
        f"Created {index_path.relative_to(root)}",
        fg=typer.colors.GREEN,
    )


@spec_app.command("new-task")
def spec_new_task(
    title: str = typer.Argument(..., help="Short title for the task file"),
    slug: str | None = typer.Option(
        None,
        "--slug",
        help="Optional slug override for the filename.",
    ),
) -> None:
    """Create a new short-lived checklist task file under docs/spec/tasks/."""
    root = _repo_root()
    task_slug = slug or _slugify(title)
    task_path = root / "docs" / "spec" / "tasks" / f"{task_slug}.md"

    content = f"""# {title}

Status: Active

Use this file for a short-lived implementation effort.
Task markers:

- [ ] not started
- [-] in progress
- [x] done

## Scope

- describe the feature, refactor, bug fix, or migration

## Phase 1: Scope and alignment

- [x] 1. Confirm the problem and scope
- [-] 1.1 Align requirements and design
  - Document the required behavior
  - Confirm the design still matches the code
  - _Requirements: 1.1, 1.2_
- [ ] 1.2 Identify verification needs

## Phase 2: Implementation

- [ ] 2. Update the code
- [ ] 2.1 Add or update tests
- [ ] 2.2 Verify the behavior end to end

## Phase 3: Close out

- [ ] 3. Update requirements if needed
- [ ] 3.1 Update design if needed
- [ ] 3.2 Mark all completed items accurately

## Notes

- update requirements and design if this task changes them
- keep code, requirements, and design consistent before closing this file
"""

    _write_if_missing(task_path, content)
    typer.secho(
        f"Created {task_path.relative_to(root)}",
        fg=typer.colors.GREEN,
    )
    typer.echo("Use docs/spec/tasks.md for the current default workflow, or use")
    typer.echo("docs/spec/tasks/ when you want short-lived task history.")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
