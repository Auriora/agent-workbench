/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  sourceSectionSchema,
  symbolReferenceSchema,
  type SymbolReference
} from "../contracts/index.js";

export type PresentationRedactionContext = "source" | "path" | "message";

export type PresentationRedactionKind =
  | "source_text"
  | "repo_relative_path"
  | "absolute_path"
  | "workspace_escape"
  | "secret_like";

export type PresentationRedactionResult = {
  kind: PresentationRedactionKind;
  value: string;
  redacted: boolean;
};

export function classifyPresentationValue(
  value: string,
  options: { context?: PresentationRedactionContext } = {}
): PresentationRedactionResult {
  const context = options.context ?? "message";
  const secretRedacted = redactSecretLikeText(value);
  if (secretRedacted !== value) {
    return {
      kind: "secret_like",
      value: secretRedacted,
      redacted: true
    };
  }
  if (hasTraversalSegment(value)) {
    return {
      kind: "workspace_escape",
      value,
      redacted: true
    };
  }
  if (isAbsoluteHostPath(value)) {
    return {
      kind: "absolute_path",
      value,
      redacted: true
    };
  }
  if (context === "path" && isRepoRelativePathLike(value)) {
    return {
      kind: "repo_relative_path",
      value: normalizeSlashes(value),
      redacted: false
    };
  }
  return {
    kind: "source_text",
    value,
    redacted: false
  };
}

export function redactPresentationValue(
  value: string,
  options: { context?: PresentationRedactionContext } = {}
): PresentationRedactionResult {
  const classified = classifyPresentationValue(value, options);
  if (classified.kind === "absolute_path") {
    return {
      ...classified,
      value: "[REDACTED_ABSOLUTE_PATH]"
    };
  }
  if (classified.kind === "workspace_escape") {
    return {
      ...classified,
      value: "[REDACTED_WORKSPACE_ESCAPE]"
    };
  }
  return classified;
}

export function redactPresentationText(
  value: string,
  options: { context?: PresentationRedactionContext } = {}
): string {
  const context = options.context ?? "message";
  let redacted = redactSecretLikeText(value);
  redacted = redacted.replace(
    /(^|[\s"'`=(:])((?:[A-Za-z]:[\\/])(?:[^\s"'`)]+))/gu,
    "$1[REDACTED_ABSOLUTE_PATH]"
  );
  redacted = redacted.replace(
    /(^|[\s"'`=(:])(\/(?:home|users|tmp|var|etc|opt|usr|mnt|private|workspace|workspaces|root)\/(?:[^\s"'`)]+))/giu,
    "$1[REDACTED_ABSOLUTE_PATH]"
  );
  redacted = redacted.replace(
    /(^|[\s"'`=(:])((?:\.\.[\\/])(?:[^\s"'`)]+))/gu,
    "$1[REDACTED_WORKSPACE_ESCAPE]"
  );
  if (context === "path") {
    return redactPresentationValue(redacted, { context }).value;
  }
  return redacted;
}

export function redactAndBoundPresentationText(
  value: string,
  options: {
    context?: PresentationRedactionContext;
    max_utf8_bytes: number;
  }
): string {
  const redacted = redactPresentationText(value, { context: options.context });
  const encoder = new TextEncoder();
  if (encoder.encode(redacted).byteLength <= options.max_utf8_bytes) {
    return redacted;
  }
  let bounded = "";
  let byteCount = 0;
  for (const character of redacted) {
    const characterBytes = encoder.encode(character).byteLength;
    if (byteCount + characterBytes > options.max_utf8_bytes) {
      break;
    }
    bounded += character;
    byteCount += characterBytes;
  }
  return bounded;
}

/**
 * Sanitizes every free-text field exposed by a public symbol reference while
 * preserving its typed, repository-relative path and graph identity fields.
 * The input is never mutated, so graph storage remains an internal concern.
 */
export function sanitizeSymbolReference(input: SymbolReference): SymbolReference {
  return symbolReferenceSchema.parse({
    node_id: input.node_id,
    kind: input.kind,
    name: input.name,
    qualified_name: input.qualified_name,
    path: input.path,
    language: input.language,
    source_range: {
      start_line: input.source_range.start_line,
      start_column: input.source_range.start_column,
      end_line: input.source_range.end_line,
      end_column: input.source_range.end_column
    },
    signature: redactOptionalSymbolText(input.signature),
    docstring: redactOptionalSymbolText(input.docstring),
    capability_level: input.capability_level,
    evidence_kinds: input.evidence_kinds,
    source_section: input.source_section === undefined
      ? undefined
      : sourceSectionSchema.parse({
          path: input.source_section.path,
          start_line: input.source_section.start_line,
          end_line: input.source_section.end_line,
          byte_count: input.source_section.byte_count,
          truncated: input.source_section.truncated,
          caveat: input.source_section.caveat,
          text: redactPresentationText(input.source_section.text, { context: "source" })
        })
  });
}

function redactOptionalSymbolText(value: string | undefined): string | undefined {
  return value === undefined
    ? undefined
    : redactPresentationText(value, { context: "source" });
}

function redactSecretLikeText(value: string): string {
  return value
    .replace(/(api[_-]?key|token|password|secret)=([^\s"'`),.;]+)/giu, "$1=[REDACTED]")
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gu, "[REDACTED_PRIVATE_KEY]");
}

function hasTraversalSegment(value: string): boolean {
  return /(^|[\\/])\.\.([\\/]|$)/u.test(value);
}

function isAbsoluteHostPath(value: string): boolean {
  if (/^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("~/")) {
    return true;
  }
  return /^\/(?:home|users|tmp|var|etc|opt|usr|mnt|private|workspace|workspaces|root)\//iu.test(value);
}

function isRepoRelativePathLike(value: string): boolean {
  const normalized = normalizeSlashes(value);
  if (normalized.startsWith("/") || normalized.length === 0) {
    return false;
  }
  return normalized.includes("/") && /\.[A-Za-z0-9]{1,12}$/u.test(normalized);
}

function normalizeSlashes(value: string): string {
  return value.replaceAll("\\", "/");
}
