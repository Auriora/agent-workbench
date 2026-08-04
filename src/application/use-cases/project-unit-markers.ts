/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type {
  ProjectUnitKind,
  ProjectUnitMarker,
  ProjectUnitMarkerEvidenceSource
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type { ProjectUnitCandidate } from "./project-unit-discovery.js";
import { normalizeRepoPath, uniqueSorted } from "./validation-utils.js";

const DEFAULT_MAX_MARKERS = 20;
const DEFAULT_MAX_LIMITATIONS = 20;
const VALIDATION_PURPOSE = /\b(?:builds?|checks?|lints?|specs?|tests?|typechecks?|validate|validation)\b/iu;

export type ScriptMarkerGuidance = {
  script_path: string;
  evidence_path: string;
  evidence_source: Exclude<ProjectUnitMarkerEvidenceSource, "manifest">;
  purpose: string;
  state?: "usable" | "unreadable" | "oversized" | "malformed" | "conflicting";
};

export type ProjectUnitMarkerLimitation = {
  kind:
    | "invalid_marker_path"
    | "script_not_found"
    | "script_not_extensionless"
    | "guidance_unreadable"
    | "guidance_oversized"
    | "guidance_malformed"
    | "guidance_conflict"
    | "guidance_purpose_missing"
    | "marker_cap_exceeded";
  path: string;
  evidence_paths: string[];
  message: string;
};

export type ProjectUnitMarkerRecognition = {
  candidates: ProjectUnitCandidate[];
  limitations: ProjectUnitMarkerLimitation[];
};

export function recognizeProjectUnitMarkers(input: {
  files: readonly FileCatalogEntry[];
  script_guidance?: readonly ScriptMarkerGuidance[];
  max_markers?: number;
  max_limitations?: number;
}): ProjectUnitMarkerRecognition {
  const maxMarkers = input.max_markers ?? DEFAULT_MAX_MARKERS;
  const maxLimitations = input.max_limitations ?? DEFAULT_MAX_LIMITATIONS;
  const filePaths = new Set(input.files.map((file) => safePath(file.path)).filter(isPresent));
  const markers: Array<{ root: string; kind: ProjectUnitKind; marker: ProjectUnitMarker }> = [];
  const limitations: ProjectUnitMarkerLimitation[] = [];

  for (const file of input.files) {
    const filePath = safePath(file.path);
    if (filePath === undefined) {
      pushLimitation(limitations, maxLimitations, {
        kind: "invalid_marker_path",
        path: file.path,
        evidence_paths: [],
        message: "Project marker paths must be normalized repo-relative paths."
      });
      continue;
    }
    const manifest = manifestMarker(filePath);
    if (manifest !== undefined) {
      markers.push(manifest);
    }
  }

  const guidanceByScript = new Map<string, ScriptMarkerGuidance[]>();
  for (const guidance of input.script_guidance ?? []) {
    const scriptPath = safePath(guidance.script_path);
    const evidencePath = safePath(guidance.evidence_path);
    const limitation = guidanceLimitation(guidance, scriptPath, evidencePath, filePaths);
    if (limitation !== undefined) {
      pushLimitation(limitations, maxLimitations, limitation);
      continue;
    }
    const accepted = guidanceByScript.get(scriptPath!) ?? [];
    accepted.push({ ...guidance, script_path: scriptPath!, evidence_path: evidencePath! });
    guidanceByScript.set(scriptPath!, accepted);
  }

  for (const [scriptPath, guidance] of [...guidanceByScript.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const evidenceKeys = new Set(guidance.map((item) =>
      JSON.stringify([item.evidence_source, item.evidence_path, item.purpose.trim().toLowerCase()])
    ));
    if (evidenceKeys.size > 1) {
      pushLimitation(limitations, maxLimitations, {
        kind: "guidance_conflict",
        path: scriptPath,
        evidence_paths: uniqueSorted(guidance.map((item) => item.evidence_path)),
        message: "Conflicting extensionless-script guidance was not used as marker evidence."
      });
      continue;
    }
    const admitted = guidance[0];
    if (admitted === undefined) continue;
    markers.push({
      root: directoryOf(scriptPath),
      kind: "repository_script",
      marker: {
        path: scriptPath,
        kind: "extensionless_script",
        evidence_source: admitted.evidence_source,
        evidence_path: admitted.evidence_path
      }
    });
  }

  const sortedMarkers = markers.sort((left, right) =>
    left.root.localeCompare(right.root) || left.marker.path.localeCompare(right.marker.path)
  );
  if (sortedMarkers.length > maxMarkers) {
    pushLimitation(limitations, maxLimitations, {
      kind: "marker_cap_exceeded",
      path: ".",
      evidence_paths: [],
      message: `Project marker recognition was capped at ${maxMarkers} markers.`
    });
  }

  const candidatesByKey = new Map<string, ProjectUnitCandidate>();
  for (const recognized of sortedMarkers.slice(0, maxMarkers)) {
    const key = `${recognized.root}\0${recognized.kind}`;
    const current = candidatesByKey.get(key);
    candidatesByKey.set(key, {
      root: recognized.root,
      kind: recognized.kind,
      markers: [...(current?.markers ?? []), recognized.marker]
    });
  }

  return {
    candidates: [...candidatesByKey.values()].sort((left, right) =>
      left.root.localeCompare(right.root) || left.kind.localeCompare(right.kind)
    ),
    limitations
  };
}

function manifestMarker(filePath: string): { root: string; kind: ProjectUnitKind; marker: ProjectUnitMarker } | undefined {
  const basename = path.posix.basename(filePath);
  const root = directoryOf(filePath);
  if (basename.toLowerCase().endsWith(".csproj")) {
    return { root, kind: "dotnet", marker: { path: filePath, kind: "csproj", evidence_source: "manifest" } };
  }
  if (basename === "pom.xml") {
    return { root, kind: "maven", marker: { path: filePath, kind: "pom_xml", evidence_source: "manifest" } };
  }
  if (basename === "Cargo.toml") {
    return { root, kind: "cargo", marker: { path: filePath, kind: "cargo_toml", evidence_source: "manifest" } };
  }
  return undefined;
}

function guidanceLimitation(
  guidance: ScriptMarkerGuidance,
  scriptPath: string | undefined,
  evidencePath: string | undefined,
  filePaths: ReadonlySet<string>
): ProjectUnitMarkerLimitation | undefined {
  const pathValue = scriptPath ?? guidance.script_path;
  const evidencePaths = evidencePath === undefined ? [] : [evidencePath];
  if (scriptPath === undefined || evidencePath === undefined) {
    return { kind: "guidance_malformed", path: pathValue, evidence_paths: evidencePaths, message: "Script guidance contains an invalid repo-relative path." };
  }
  if (guidance.state !== undefined && guidance.state !== "usable") {
    const kindByState = {
      unreadable: "guidance_unreadable",
      oversized: "guidance_oversized",
      malformed: "guidance_malformed",
      conflicting: "guidance_conflict"
    } as const;
    return { kind: kindByState[guidance.state], path: scriptPath, evidence_paths: [evidencePath], message: `Extensionless-script guidance is ${guidance.state} and was not admitted.` };
  }
  if (!filePaths.has(scriptPath)) {
    return { kind: "script_not_found", path: scriptPath, evidence_paths: [evidencePath], message: "The script named by guidance was not present in bounded catalog evidence." };
  }
  if (path.posix.extname(scriptPath) !== "") {
    return { kind: "script_not_extensionless", path: scriptPath, evidence_paths: [evidencePath], message: "Only extensionless scripts use documented script-marker admission." };
  }
  if (!VALIDATION_PURPOSE.test(guidance.purpose)) {
    return { kind: "guidance_purpose_missing", path: scriptPath, evidence_paths: [evidencePath], message: "Script guidance did not identify a validation or build purpose." };
  }
  return undefined;
}

function safePath(value: string): string | undefined {
  const normalized = normalizeRepoPath(value);
  if (normalized === ".") return normalized;
  if (normalized.startsWith("/") || normalized.endsWith("/") || normalized.includes("\\") || normalized.includes("\0")) return undefined;
  if (normalized.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) return undefined;
  return normalized;
}

function directoryOf(filePath: string): string {
  const directory = path.posix.dirname(filePath);
  return directory === "." ? "." : directory;
}

function pushLimitation(limitations: ProjectUnitMarkerLimitation[], max: number, limitation: ProjectUnitMarkerLimitation): void {
  if (limitations.length < max) limitations.push(limitation);
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
