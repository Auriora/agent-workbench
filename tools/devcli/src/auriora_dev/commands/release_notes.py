# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal


STABLE_TAG_RE = re.compile(
    r"^v(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)$"
)
SEMVER_RE = re.compile(
    r"^(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)$"
)


ReleaseFormat = Literal["draft", "github", "markdown", "agent"]


class ReleaseNotesError(RuntimeError):
    pass


@dataclass(frozen=True)
class ReleaseFileChange:
    status: str
    raw_status: str
    score: int | None
    path: str
    old_path: str | None
    area: str


@dataclass(frozen=True)
class ReleaseCommit:
    hash: str
    short_hash: str
    subject: str
    body: str
    author: str
    date: str
    files: list[ReleaseFileChange]


@dataclass(frozen=True)
class ReleaseValidationEvidence:
    summary: str
    source: Literal["note", "file"]
    path: str | None


@dataclass(frozen=True)
class ReleaseNoteCandidate:
    id: str
    section: str
    title: str
    summary: str
    rationale: str
    confidence: Literal["low", "medium", "high"]
    audiences: list[str]
    areas: list[str]
    commit_hashes: list[str]
    paths: list[str]
    review_needed: bool


@dataclass(frozen=True)
class ReleaseNotesEvidence:
    from_ref: str
    to_ref: str
    selected_from_tag: str | None
    from_revision: str
    to_revision: str
    version: str
    repository: str
    repository_root: str
    branch: str
    generated_at: str
    commits: list[ReleaseCommit]
    files: list[ReleaseFileChange]
    areas: dict[str, list[str]]
    candidate_groups: list[ReleaseNoteCandidate]
    validation: ReleaseValidationEvidence | None
    skipped_enrichment: list[str]


def normalize_display_version(version: str) -> str:
    normalized = version.removeprefix("v")
    if SEMVER_RE.match(normalized) is None:
        raise ReleaseNotesError(f"Expected a semantic version like 0.4.0, got {version!r}.")
    return normalized


def candidate_id(area: str, paths: list[str], commits: list[str]) -> str:
    payload = "\n".join([area, *sorted(paths), *sorted(commits)])
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:10]


def collect_release_notes_evidence(
    root: Path,
    *,
    from_ref: str | None,
    to_ref: str,
    version: str,
    validation_note: str | None,
    validation_file: Path | None,
) -> ReleaseNotesEvidence:
    root = root.resolve()
    selected_from_tag: str | None = None
    if from_ref is None:
        selected_from_tag = latest_stable_release_tag(root, to_ref)
        if selected_from_tag is None:
            raise ReleaseNotesError(
                "No --from ref was supplied and no reachable stable release tag was found."
            )
        from_ref = selected_from_tag

    from_revision = git_stdout(root, "rev-parse", "--verify", from_ref)
    to_revision = git_stdout(root, "rev-parse", "--verify", to_ref)
    commit_count = int(git_stdout(root, "rev-list", "--count", f"{from_ref}..{to_ref}"))
    if commit_count == 0:
        raise ReleaseNotesError(f"Git range {from_ref}..{to_ref} has no commits.")

    range_files = parse_name_status(
        git_stdout(root, "diff", "--name-status", f"{from_ref}..{to_ref}")
    )
    commits = parse_commits(
        git_stdout(
            root,
            "log",
            "--reverse",
            "--format=%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1f%b%x1e",
            f"{from_ref}..{to_ref}",
        )
    )
    commits_with_files = [
        ReleaseCommit(
            hash=commit.hash,
            short_hash=commit.short_hash,
            subject=commit.subject,
            body=commit.body,
            author=commit.author,
            date=commit.date,
            files=collect_commit_files(root, commit.hash),
        )
        for commit in commits
    ]
    if not range_files and all(not commit.files for commit in commits_with_files):
        raise ReleaseNotesError(f"Git range {from_ref}..{to_ref} has no changed files.")

    areas = area_index(range_files)
    validation = collect_validation(root, validation_note=validation_note, validation_file=validation_file)
    candidates = build_candidates(range_files, commits_with_files)
    return ReleaseNotesEvidence(
        from_ref=from_ref,
        to_ref=to_ref,
        selected_from_tag=selected_from_tag,
        from_revision=from_revision,
        to_revision=to_revision,
        version=normalize_display_version(version),
        repository=git_stdout(root, "config", "--get", "remote.origin.url", allow_empty=True) or root.name,
        repository_root=str(root),
        branch=git_stdout(root, "branch", "--show-current", allow_empty=True) or "detached",
        generated_at=datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        commits=commits_with_files,
        files=range_files,
        areas=areas,
        candidate_groups=candidates,
        validation=validation,
        skipped_enrichment=["GitHub PR metadata was not requested."],
    )


def git_stdout(root: Path, *args: str, allow_empty: bool = False) -> str:
    completed = subprocess.run(
        ("git", *args),
        cwd=root,
        check=False,
        text=True,
        capture_output=True,
    )
    if completed.returncode != 0:
        if allow_empty:
            return ""
        detail = completed.stderr.strip() or completed.stdout.strip()
        raise ReleaseNotesError(f"git {' '.join(args)} failed: {detail}")
    output = completed.stdout.rstrip("\n")
    if not output and not allow_empty:
        return ""
    return output


def latest_stable_release_tag(root: Path, to_ref: str) -> str | None:
    tags = git_stdout(root, "tag", "--merged", to_ref, allow_empty=True).splitlines()
    stable_tags: list[tuple[tuple[int, int, int], str]] = []
    for tag in tags:
        match = STABLE_TAG_RE.match(tag.strip())
        if match is None:
            continue
        stable_tags.append(
            (
                (
                    int(match.group("major")),
                    int(match.group("minor")),
                    int(match.group("patch")),
                ),
                tag.strip(),
            )
        )
    if not stable_tags:
        return None
    return sorted(stable_tags)[-1][1]


def parse_commits(output: str) -> list[ReleaseCommit]:
    commits: list[ReleaseCommit] = []
    for record in output.split("\x1e"):
        record = record.strip("\n")
        if not record:
            continue
        fields = record.split("\x1f", 5)
        if len(fields) != 6:
            raise ReleaseNotesError("Malformed git log record while parsing release commits.")
        full_hash, short_hash, author, date, subject, body = fields
        commits.append(
            ReleaseCommit(
                hash=full_hash.strip(),
                short_hash=short_hash.strip(),
                author=author.strip(),
                date=date.strip(),
                subject=subject.strip(),
                body=body.strip(),
                files=[],
            )
        )
    return commits


def collect_commit_files(root: Path, commit_hash: str) -> list[ReleaseFileChange]:
    output = git_stdout(root, "show", "--name-status", "--format=", commit_hash, allow_empty=True)
    return parse_name_status(output)


def parse_name_status(output: str) -> list[ReleaseFileChange]:
    changes: list[ReleaseFileChange] = []
    for line in output.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        raw_status = parts[0]
        status = raw_status[0]
        score: int | None = None
        if status in {"R", "C"}:
            if len(parts) != 3 or not raw_status[1:].isdigit():
                raise ReleaseNotesError(f"Malformed rename/copy name-status row: {line!r}.")
            score = int(raw_status[1:])
            old_path = parts[1]
            path = parts[2]
        else:
            if len(parts) != 2:
                raise ReleaseNotesError(f"Malformed name-status row: {line!r}.")
            old_path = None
            path = parts[1]
        changes.append(
            ReleaseFileChange(
                status=status,
                raw_status=raw_status,
                score=score,
                old_path=old_path,
                path=path,
                area=classify_area(path),
            )
        )
    return changes


def classify_area(path: str) -> str:
    if path.startswith("src/") or path.startswith(".well-known/mcp/"):
        return "runtime_mcp"
    if path.startswith("tools/devcli/") or path.startswith("scripts/"):
        return "cli_automation"
    if path == "package.json" or path.startswith("packaging/") or path.startswith("plugins/"):
        return "packaging_install"
    if path == "README.md" or path.startswith("docs/runbooks/") or path.startswith("docs/reference/"):
        return "docs_runbooks"
    if path.startswith("tests/") or path.startswith(".github/workflows/"):
        return "tests_validation"
    if (
        path.startswith("docs/specs/")
        or path.startswith("docs/backlog/")
        or path == "docs/backlog/README.md"
    ):
        return "specs_planning"
    return "internal_maintenance"


def audiences_for_area(area: str) -> list[str]:
    mapping = {
        "runtime_mcp": ["agent_user", "operator"],
        "cli_automation": ["maintainer", "operator"],
        "packaging_install": ["end_user", "maintainer"],
        "docs_runbooks": ["end_user", "agent_user"],
        "tests_validation": ["maintainer"],
        "specs_planning": ["internal"],
        "internal_maintenance": ["internal"],
    }
    return mapping.get(area, ["internal"])


def section_for_area(area: str) -> str:
    if area == "packaging_install":
        return "Packaging And Install Notes"
    if area in {"runtime_mcp", "cli_automation", "docs_runbooks"}:
        return "Changed"
    if area == "tests_validation":
        return "Validation"
    return "Needs Review"


def confidence_for_area(area: str) -> Literal["low", "medium", "high"]:
    if area in {"packaging_install", "runtime_mcp", "cli_automation"}:
        return "high"
    if area in {"docs_runbooks", "tests_validation"}:
        return "medium"
    return "low"


def area_index(files: list[ReleaseFileChange]) -> dict[str, list[str]]:
    areas: dict[str, list[str]] = {}
    for change in files:
        areas.setdefault(change.area, [])
        if change.path not in areas[change.area]:
            areas[change.area].append(change.path)
    return {area: sorted(paths) for area, paths in sorted(areas.items())}


def build_candidates(
    range_files: list[ReleaseFileChange],
    commits: list[ReleaseCommit],
) -> list[ReleaseNoteCandidate]:
    candidates: list[ReleaseNoteCandidate] = []
    for area, paths in area_index(range_files).items():
        commit_hashes: list[str] = []
        for commit in commits:
            if any(change.area == area for change in commit.files):
                commit_hashes.append(commit.hash)
        confidence = confidence_for_area(area)
        title = title_for_area(area, paths)
        rationale = (
            f"Grouped {len(paths)} path(s) in {area}"
            + (
                f" with {len(commit_hashes)} commit(s) touching the same area."
                if commit_hashes
                else "."
            )
        )
        candidates.append(
            ReleaseNoteCandidate(
                id=candidate_id(area, paths, commit_hashes),
                section=section_for_area(area),
                title=title,
                summary=(
                    f"Review {area.replace('_', ' ')} changes across {len(paths)} path(s)."
                ),
                rationale=rationale,
                confidence=confidence,
                audiences=audiences_for_area(area),
                areas=[area],
                commit_hashes=commit_hashes,
                paths=paths,
                review_needed=confidence != "high" or not commit_hashes,
            )
        )
    return candidates


def title_for_area(area: str, paths: list[str]) -> str:
    labels = {
        "runtime_mcp": "Runtime and MCP behavior changed",
        "cli_automation": "Developer CLI and automation changed",
        "packaging_install": "Packaging and install flow changed",
        "docs_runbooks": "Documentation and runbooks changed",
        "tests_validation": "Tests and validation changed",
        "specs_planning": "Specs and planning changed",
        "internal_maintenance": "Internal maintenance changed",
    }
    if len(paths) == 1:
        return f"{labels.get(area, 'Release evidence changed')}: {paths[0]}"
    return labels.get(area, "Release evidence changed")


def collect_validation(
    root: Path,
    *,
    validation_note: str | None,
    validation_file: Path | None,
) -> ReleaseValidationEvidence | None:
    if validation_note and validation_file is not None:
        raise ReleaseNotesError(
            "Pass either --validation-note or --validation-file, not both."
        )
    if validation_note:
        return ReleaseValidationEvidence(summary=validation_note, source="note", path=None)
    if validation_file is None:
        return None
    path = validation_file if validation_file.is_absolute() else root / validation_file
    if not path.exists():
        raise ReleaseNotesError(f"Validation file does not exist: {path}")
    return ReleaseValidationEvidence(
        summary=path.read_text(encoding="utf-8").strip(),
        source="file",
        path=str(path),
    )


def evidence_to_json(evidence: ReleaseNotesEvidence) -> str:
    return json.dumps(asdict(evidence), indent=2) + "\n"


def render_release_notes(
    evidence: ReleaseNotesEvidence,
    *,
    release_format: ReleaseFormat,
    include_evidence: bool,
    final: bool,
) -> str:
    lines: list[str] = []
    if release_format != "github":
        reviewed_date = evidence.generated_at.split("T", 1)[0]
        status = "published" if final else "draft"
        lines.extend(
            [
                "---",
                f"title: Agent Workbench v{evidence.version} release notes",
                "doc_type: release-notes",
                f"status: {status}",
                "owner: platform",
                f"last_reviewed: {reviewed_date}",
                "---",
                "",
            ]
        )
    lines.extend([f"# Agent Workbench v{evidence.version}", ""])
    state = "Final reviewed notes" if final else "Generated draft; review before publishing"
    lines.extend([f"> {state}.", ""])

    grouped: dict[str, list[ReleaseNoteCandidate]] = {}
    for candidate in evidence.candidate_groups:
        section = "Needs Review" if candidate.review_needed else candidate.section
        grouped.setdefault(section, []).append(candidate)

    section_order = [
        "Highlights",
        "Added",
        "Changed",
        "Fixed",
        "Packaging And Install Notes",
        "Upgrade Notes",
        "Validation",
        "Known Issues",
        "Needs Review",
    ]
    for section in section_order:
        candidates = grouped.get(section, [])
        if not candidates:
            continue
        lines.extend([f"## {section}", ""])
        for candidate in candidates:
            lines.append(f"- {candidate.title}")
            if release_format in {"draft", "markdown", "agent"}:
                evidence_summary = (
                    f"{short_commit_list(evidence, candidate)}, {path_summary(candidate.paths)}"
                )
                lines.append(f"  - Evidence: {evidence_summary}")
                lines.append(f"  - Confidence: {candidate.confidence}")
                lines.append(f"  - Rationale: {candidate.rationale}")
                if candidate.review_needed:
                    lines.append(
                        "  - Reviewer action: confirm wording, move to another section, or omit"
                    )
        lines.append("")

    if evidence.validation is not None:
        validation_heading = "Validation" if "Validation" not in grouped else "Validation Evidence"
        lines.extend(
            [
                f"## {validation_heading}",
                "",
                f"- {evidence.validation.summary}",
                f"  - Source: {evidence.validation.source}",
                "",
            ]
        )
    elif evidence.validation is None and release_format in {"draft", "markdown", "agent"}:
        lines.extend(["## Validation", "", "- No validation evidence was supplied.", ""])

    if include_evidence or release_format in {"markdown", "agent"}:
        lines.extend(render_evidence_section(evidence))

    if release_format == "agent":
        lines.extend(render_agent_rules(evidence))

    return "\n".join(lines).rstrip() + "\n"


def short_commit_list(evidence: ReleaseNotesEvidence, candidate: ReleaseNoteCandidate) -> str:
    lookup = {commit.hash: commit.short_hash for commit in evidence.commits}
    values = [
        lookup.get(commit_hash, commit_hash[:8])
        for commit_hash in candidate.commit_hashes[:5]
    ]
    if len(candidate.commit_hashes) > 5:
        values.append("...")
    return ", ".join(values) if values else "area-level file evidence only"


def path_summary(paths: list[str]) -> str:
    if len(paths) <= 3:
        return ", ".join(paths)
    return ", ".join(paths[:3]) + f", and {len(paths) - 3} more path(s)"


def render_evidence_section(evidence: ReleaseNotesEvidence) -> list[str]:
    return [
        "## Evidence",
        "",
        f"- Range: `{evidence.from_ref}..{evidence.to_ref}`",
        f"- From revision: `{evidence.from_revision}`",
        f"- To revision: `{evidence.to_revision}`",
        f"- Branch: `{evidence.branch}`",
        f"- Commits: {len(evidence.commits)}",
        f"- Changed files: {len(evidence.files)}",
        f"- Skipped enrichment: {'; '.join(evidence.skipped_enrichment)}",
        "",
    ]


def render_agent_rules(evidence: ReleaseNotesEvidence) -> list[str]:
    return [
        "## Agent Refinement Rules",
        "",
        "- Use the evidence above as the source of truth.",
        "- Group by consumer outcome, not commit count.",
        "- Do not claim validation that was not supplied.",
        "- Preserve Needs Review items when uncertainty remains.",
        f"- Produce final Markdown for Agent Workbench v{evidence.version}.",
        "",
    ]


def render_agent_instructions(
    evidence: ReleaseNotesEvidence,
    *,
    evidence_output: Path | None,
) -> str:
    lines = [
        f"# Release Notes Refinement Instructions For Agent Workbench v{evidence.version}",
        "",
        (
            "Use the generated evidence as the source of truth. Produce concise "
            "Markdown suitable for `awb release github --notes-file`."
        ),
        "",
    ]
    if evidence_output is not None:
        lines.extend([f"- Evidence JSON: `{evidence_output}`", ""])
    else:
        lines.extend(["## Compact Evidence", "", *render_evidence_section(evidence)])
    lines.extend(
        [
            "## Rules",
            "",
            "- Include repository frontmatter when writing `docs/release-notes/vX.Y.Z.md`.",
            "- Group related commits into consumer-visible outcomes.",
            (
                "- Include package, install, command, MCP, compatibility, upgrade, "
                "and validation impacts when evidence supports them."
            ),
            "- Avoid unsupported claims and marketing language.",
            "- Keep unresolved uncertainty in Needs Review or Known Issues.",
            "",
        ]
    )
    return "\n".join(lines)


def write_text_output(path: Path, text: str, *, dry_run: bool) -> None:
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
