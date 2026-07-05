# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Any

import typer

from auriora_dev.commands.package import build_package_check_plan
from auriora_dev.commands.release_notes import (
    ReleaseNotesError,
    collect_release_notes_evidence,
    evidence_to_json,
    render_agent_instructions,
    render_release_notes,
    write_text_output,
)
from auriora_dev.runner import CommandSpec, run_plan, summarize


SEMVER_RE = re.compile(
    r"^(?P<major>0|[1-9]\d*)\."
    r"(?P<minor>0|[1-9]\d*)\."
    r"(?P<patch>0|[1-9]\d*)"
    r"(?P<suffix>[-+][0-9A-Za-z.-]+)?$"
)

VERSION_JSON_POINTERS = (
    ("package.json", ("version",)),
    ("packaging/agent-workbench/package-manifest.json", ("version",)),
    (".well-known/mcp/server-card.json", ("version",)),
    ("plugins/agent-workbench/.codex-plugin/plugin.json", ("version",)),
    ("plugins/agent-workbench/claude-plugin/.claude-plugin/plugin.json", ("version",)),
)

INSTALL_COMMAND_JSON_POINTERS = (
    ("packaging/agent-workbench/package-manifest.json", ("install_command",)),
    ("packaging/agent-workbench/package-manifest.json", ("codex", "plugin_install_model")),
    ("packaging/agent-workbench/npm-package.json", ("install_command",)),
)

CURRENT_DOC_PATHS = (
    "README.md",
    "docs/runbooks/install-agent-workbench.md",
    "packaging/agent-workbench/README.md",
    "plugins/agent-workbench/README.md",
)


def build_preflight_plan(root: Path, *, with_integration: bool) -> list[CommandSpec]:
    return [
        *build_package_check_plan(root, with_integration=with_integration),
    ]


def release_tag(version: str) -> str:
    return f"v{normalize_version(version)}"


def tarball_name(version: str) -> str:
    return f"auriora-agent-workbench-{normalize_version(version)}.tgz"


def install_command(version: str) -> str:
    normalized = normalize_version(version)
    return (
        "npm install -g "
        f"https://github.com/Auriora/agent-workbench/releases/download/v{normalized}/"
        f"auriora-agent-workbench-{normalized}.tgz"
    )


def build_github_release_plan(
    root: Path,
    *,
    version: str,
    notes_file: Path | None,
    title: str | None,
    draft: bool,
    prerelease: bool,
    existing: bool,
    create_tag: bool,
    push_tag: bool,
    preflight: bool,
    with_integration: bool,
) -> list[CommandSpec]:
    normalized = normalize_version(version)
    tag = release_tag(normalized)
    tarball = tarball_name(normalized)
    plan: list[CommandSpec] = []
    if preflight:
        plan.extend(build_preflight_plan(root, with_integration=with_integration))
    plan.append(
        CommandSpec(
            ("env", "npm_config_cache=/tmp/agent-workbench-npm-cache", "npm", "pack"),
            root,
            "Create GitHub release tarball",
            mutates=True,
        )
    )
    if existing:
        plan.append(
            CommandSpec(
                ("gh", "release", "upload", tag, tarball, "--clobber"),
                root,
                "Upload tarball to existing GitHub release",
                mutates=True,
            )
        )
        return plan
    if create_tag:
        plan.append(
            CommandSpec(("git", "tag", tag), root, "Create release tag", mutates=True)
        )
    if push_tag:
        plan.append(
            CommandSpec(
                ("git", "push", "origin", tag),
                root,
                "Push release tag",
                mutates=True,
            )
        )
    release_argv = ["gh", "release", "create", tag, tarball, "--title", title or tag]
    if notes_file is None:
        release_argv.append("--generate-notes")
    else:
        release_argv.extend(["--notes-file", str(notes_file)])
    if draft:
        release_argv.append("--draft")
    if prerelease:
        release_argv.append("--prerelease")
    plan.append(
        CommandSpec(tuple(release_argv), root, "Create GitHub release", mutates=True)
    )
    return plan


def normalize_version(version: str) -> str:
    normalized = version.removeprefix("v")
    if SEMVER_RE.match(normalized) is None:
        raise ValueError(f"Expected a semantic version like 0.4.0, got {version!r}.")
    return normalized


def bump_semver(version: str, part: str) -> str:
    match = SEMVER_RE.match(normalize_version(version))
    if match is None:
        raise ValueError(f"Cannot bump non-semver version {version!r}.")
    major = int(match.group("major"))
    minor = int(match.group("minor"))
    patch = int(match.group("patch"))
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    if part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    raise ValueError(f"Unsupported version part {part!r}.")


def current_package_version(root: Path) -> str:
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    version = package.get("version")
    if not isinstance(version, str):
        raise ValueError("package.json#/version is missing or is not a string.")
    return normalize_version(version)


def update_release_version(root: Path, version: str) -> list[Path]:
    normalized = normalize_version(version)
    changed: list[Path] = []
    command = install_command(normalized)
    replacements = {
        re.compile(r"v\d+\.\d+\.\d+"): f"v{normalized}",
        re.compile(r"auriora-agent-workbench-\d+\.\d+\.\d+\.tgz"): tarball_name(normalized),
    }

    for relative, pointer in VERSION_JSON_POINTERS:
        path = root / relative
        data = _read_json(path)
        if _set_json_pointer(data, pointer, normalized):
            _write_json(path, data)
            changed.append(path)

    for relative, pointer in INSTALL_COMMAND_JSON_POINTERS:
        path = root / relative
        data = _read_json(path)
        if _set_json_pointer(data, pointer, command):
            _write_json(path, data)
            changed.append(path)

    for relative in CURRENT_DOC_PATHS:
        path = root / relative
        text = path.read_text(encoding="utf-8")
        updated = text
        for pattern, replacement in replacements.items():
            updated = pattern.sub(replacement, updated)
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            changed.append(path)

    return sorted(set(changed))


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    return value


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def _set_json_pointer(data: dict[str, Any], pointer: tuple[str, ...], value: str) -> bool:
    current: Any = data
    for key in pointer[:-1]:
        if not isinstance(current, dict) or key not in current:
            raise ValueError(f"Missing JSON object path: {'/'.join(pointer)}")
        current = current[key]
    if not isinstance(current, dict):
        raise ValueError(f"Missing JSON object path: {'/'.join(pointer)}")
    final_key = pointer[-1]
    if current.get(final_key) == value:
        return False
    current[final_key] = value
    return True


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
        results = run_plan(
            build_preflight_plan(root, with_integration=with_integration),
            dry_run=dry_run,
        )
        summarize(results)
        typer.echo("Preflight does not push tags, publish npm, publish GHCR, or create releases.")

    @release_app.command("bump-version")
    def bump_version(
        version: str | None = typer.Argument(
            None,
            help="Target version, for example 0.4.0 or v0.4.0.",
        ),
        part: str | None = typer.Option(
            None,
            "--part",
            help="Semver part to bump: major, minor, or patch.",
        ),
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print changed files without writing them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        if version is None:
            if part is None:
                typer.secho("Pass a target version or --part major|minor|patch.", fg=typer.colors.RED)
                raise typer.Exit(code=2)
            version = bump_semver(current_package_version(root), part)
        elif part is not None:
            typer.secho("Pass either a target version or --part, not both.", fg=typer.colors.RED)
            raise typer.Exit(code=2)
        normalized = normalize_version(version)
        typer.echo(f"target version: {normalized}")
        if dry_run:
            typer.echo("dry-run: would update release metadata and current install docs")
            return
        changed = update_release_version(root, normalized)
        if not changed:
            typer.echo("Version metadata already matches.")
            return
        typer.secho("Updated release version metadata:", fg=typer.colors.GREEN)
        for path in changed:
            typer.echo(f"- {path.relative_to(root)}")

    @release_app.command("github")
    def github_release(
        version: str | None = typer.Argument(
            None,
            help="Release version. Defaults to package.json#/version.",
        ),
        notes_file: Path | None = typer.Option(
            None,
            "--notes-file",
            help="Release notes file for gh release create.",
        ),
        title: str | None = typer.Option(None, "--title", help="Release title. Defaults to v<version>."),
        draft: bool = typer.Option(False, "--draft", help="Create the GitHub release as a draft."),
        prerelease: bool = typer.Option(
            False,
            "--prerelease",
            help="Mark the GitHub release as a prerelease.",
        ),
        existing: bool = typer.Option(
            False,
            "--existing",
            help="Upload the tarball to an existing GitHub release.",
        ),
        no_tag: bool = typer.Option(False, "--no-tag", help="Do not create a local git tag."),
        no_push_tag: bool = typer.Option(
            False,
            "--no-push-tag",
            help="Do not push the git tag before creating the release.",
        ),
        skip_preflight: bool = typer.Option(False, "--skip-preflight", help="Skip release preflight checks."),
        with_integration: bool = typer.Option(
            False,
            "--with-integration",
            help="Run focused integration tests during preflight.",
        ),
        allow_dirty: bool = typer.Option(False, "--allow-dirty", help="Continue when the working tree is dirty."),
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
        dry_run: bool = typer.Option(False, "--dry-run", help="Print commands without running them."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        root = resolve_repo_root(repo_root)
        normalized = normalize_version(version or current_package_version(root))
        if not dry_run and not allow_dirty:
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
            if status.stdout.strip():
                typer.secho("Working tree is dirty; pass --allow-dirty to continue.", fg=typer.colors.RED)
                typer.echo(status.stdout, nl=not status.stdout.endswith("\n"))
                raise typer.Exit(code=1)
        plan = build_github_release_plan(
            root,
            version=normalized,
            notes_file=notes_file,
            title=title,
            draft=draft,
            prerelease=prerelease,
            existing=existing,
            create_tag=not no_tag and not existing,
            push_tag=not no_push_tag and not existing,
            preflight=not skip_preflight,
            with_integration=with_integration,
        )
        results = run_plan(plan, dry_run=dry_run)
        summarize(results)

    @release_app.command("notes")
    def release_notes(
        from_ref: str | None = typer.Option(
            None,
            "--from",
            help="Lower bound ref. Defaults to latest reachable stable vX.Y.Z tag.",
        ),
        to_ref: str = typer.Option("HEAD", "--to", help="Upper bound ref."),
        version: str | None = typer.Option(
            None,
            "--version",
            help="Display version. Defaults to package.json#/version.",
        ),
        output: Path | None = typer.Option(None, "--output", help="Markdown output path."),
        release_format: str = typer.Option(
            "draft",
            "--format",
            help="Output format: draft, github, markdown, or agent.",
        ),
        include_evidence: bool = typer.Option(
            False,
            "--include-evidence",
            help="Include compact evidence in Markdown output.",
        ),
        evidence_output: Path | None = typer.Option(
            None,
            "--evidence-output",
            help="Structured JSON evidence output path.",
        ),
        validation_note: str | None = typer.Option(
            None,
            "--validation-note",
            help="Manual validation summary to include.",
        ),
        validation_file: Path | None = typer.Option(
            None,
            "--validation-file",
            help="Local validation evidence file to include.",
        ),
        final: bool = typer.Option(
            False,
            "--final",
            help="Mark output as maintainer-reviewed final notes.",
        ),
        dry_run: bool = typer.Option(
            False,
            "--dry-run",
            help="Print generated notes without writing files or directories.",
        ),
        agent_instructions: Path | None = typer.Option(
            None,
            "--agent-instructions",
            help="Write an agent-ready refinement prompt.",
        ),
        repo_root: Path | None = typer.Option(None, "--repo-root", help="Repository root override."),
    ) -> None:
        from auriora_dev.repo import resolve_repo_root

        if release_format not in {"draft", "github", "markdown", "agent"}:
            typer.secho("--format must be one of: draft, github, markdown, agent.", fg=typer.colors.RED)
            raise typer.Exit(code=2)
        root = resolve_repo_root(repo_root)
        try:
            evidence = collect_release_notes_evidence(
                root,
                from_ref=from_ref,
                to_ref=to_ref,
                version=version or current_package_version(root),
                validation_note=validation_note,
                validation_file=validation_file,
            )
            markdown = render_release_notes(
                evidence,
                release_format=release_format,  # type: ignore[arg-type]
                include_evidence=include_evidence,
                final=final,
            )
            if evidence_output is not None:
                evidence_path = evidence_output if evidence_output.is_absolute() else root / evidence_output
                write_text_output(evidence_path, evidence_to_json(evidence), dry_run=dry_run)
                if not dry_run:
                    typer.echo(f"Wrote evidence: {evidence_path.relative_to(root)}")
            else:
                evidence_path = None
            if agent_instructions is not None:
                agent_path = agent_instructions if agent_instructions.is_absolute() else root / agent_instructions
                write_text_output(
                    agent_path,
                    render_agent_instructions(evidence, evidence_output=evidence_output),
                    dry_run=dry_run,
                )
                if not dry_run:
                    typer.echo(f"Wrote agent instructions: {agent_path.relative_to(root)}")
            if output is not None and not dry_run:
                output_path = output if output.is_absolute() else root / output
                write_text_output(output_path, markdown, dry_run=False)
                typer.echo(f"Wrote release notes: {output_path.relative_to(root)}")
                return
            typer.echo(markdown)
        except ReleaseNotesError as exc:
            typer.secho(str(exc), fg=typer.colors.RED)
            raise typer.Exit(code=1) from exc

    app.add_typer(release_app, name="release")
