/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  sourceSectionSchema,
  symbolReferenceSchema,
  type RuntimeError,
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

export const PUBLIC_MCP_FAILURE_MESSAGE_MAX_UTF8_BYTES = 512;

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
  redacted = redactAbsolutePathText(redacted);
  redacted = redacted.replace(
    /(^|[\s"'`=(:,;{\[])((?:\.\.[\\/])(?:[^\s"'`)]+))/gu,
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

export function sanitizePublicMcpFailureMessage(message: string, fallback: string): string {
  const sanitizedFallback = redactAndBoundPresentationText(fallback, {
    context: "message",
    max_utf8_bytes: PUBLIC_MCP_FAILURE_MESSAGE_MAX_UTF8_BYTES
  });
  if (!isUsablePublicFailureMessage(sanitizedFallback)) {
    throw new Error("Public MCP failure fallback must contain fixed actionable text.");
  }
  const sanitizedMessage = redactAndBoundPresentationText(message, {
    context: "message",
    max_utf8_bytes: PUBLIC_MCP_FAILURE_MESSAGE_MAX_UTF8_BYTES
  });
  if (isUsablePublicFailureMessage(sanitizedMessage)) {
    return sanitizedMessage;
  }
  return sanitizedFallback;
}

export function sanitizePublicMcpRuntimeErrors(
  errors: RuntimeError[] | undefined,
  fallback: string
): RuntimeError[] | undefined {
  return errors?.map((error) => ({
    ...error,
    message: sanitizePublicMcpFailureMessage(error.message, fallback)
  }));
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
        }),
    repository: input.repository === undefined
      ? undefined
      : {
          repository_key: redactPresentationText(input.repository.repository_key, { context: "source" }),
          path_prefix: redactPresentationText(input.repository.path_prefix, { context: "path" }),
          state: input.repository.state
        }
  });
}

function redactOptionalSymbolText(value: string | undefined): string | undefined {
  return value === undefined
    ? undefined
    : redactPresentationText(value, { context: "source" });
}

function redactSecretLikeText(value: string): string {
  return value
    .replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/gu, "[REDACTED_PRIVATE_KEY]")
    .replace(
      /(\bauthorization\b["']?\s*:\s*["']?\s*)(bearer|basic)(\s+)(?!\[REDACTED\])([^\s"'`,;)}\]]+?)(?=[.!?]?(?:\s|$|["'`,;)}\]]))/giu,
      (
        match,
        prefix: string,
        scheme: string,
        spacing: string,
        credential: string,
        offset: number,
        source: string
      ) =>
        isLikelyAuthorizationCredential(
          scheme,
          credential,
          source.slice(offset + match.length)
        )
          ? `${prefix}${scheme}${spacing}[REDACTED]`
          : match
    )
    .replace(
      /(\b(?:api[_-]?key|token|password|secret)\b["']?\s*[:=]\s*["']?)(?!\[REDACTED\])(?!\b(?:api[_-]?key|token|password|secret)\b\s*[:=])([^\s"'`,;)}\]]+?)(?=[.!?]?(?:\s|$|["'`,;)}\]]))/giu,
      "$1[REDACTED]"
    );
}

function isLikelyAuthorizationCredential(
  scheme: string,
  value: string,
  trailingText: string
): boolean {
  if (scheme.toLowerCase() === "basic") {
    return value.length >= 4 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/u.test(value);
  }
  return !(value.toLowerCase() === "access" && /^\s+required\b/iu.test(trailingText));
}

function isUsablePublicFailureMessage(value: string): boolean {
  const normalized = value
    .replace(
      /\bauthorization\b["']?\s*:\s*["']?\s*(?:bearer|basic)\s+\[(?:REDACTED(?:_[A-Z_]+)?)\]["']?/giu,
      " "
    )
    .replace(
      /\b(?:api[_-]?key|token|password|secret)\b["']?\s*[:=]\s*["']?\[(?:REDACTED(?:_[A-Z_]+)?)\]["']?/giu,
      " "
    )
    .replace(/\[(?:REDACTED(?:_[A-Z_]+)?)\]/gu, " ")
    .replace(/[\s"'`=,:;.!?()[\]{}<>/\\|_-]+/gu, "");
  return normalized.length > 0;
}

function hasTraversalSegment(value: string): boolean {
  return /(^|[\\/])\.\.([\\/]|$)/u.test(value);
}

function isAbsoluteHostPath(value: string): boolean {
  if (
    /^[A-Za-z]:[\\/]/u.test(value) ||
    /^~[\\/]/u.test(value) ||
    /^\\\\\?\\UNC\\[^\\/\s"'`)]+[\\/][^\\/\s"'`)]+(?:[\\/]|$)/u.test(value) ||
    /^\\\\\?\\[A-Za-z]:[\\/]/u.test(value) ||
    /^\\\\\.\\[A-Za-z]:[\\/]/u.test(value) ||
    /^\\\\[^\\/\s"'`)]+[\\/][^\\/\s"'`)]+(?:[\\/]|$)/u.test(value)
  ) {
    return true;
  }
  return /^\/(?:data|etc|home|mnt|opt|private|root|srv|tmp|usr|users|var|workspace|workspaces)[\\/]/iu.test(value);
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

function redactAbsolutePathText(value: string): string {
  let redacted = value;
  redacted = redacted.replace(
    /(^|[\s"'`=(:,;{\[])((?:\\\\\?\\UNC\\[^\\/\s"'`),;\]}]+[\\/][^\\/\s"'`),;\]}]+(?:[\\/][^\s"'`,;\]}]+)?|\\\\\?\\[A-Za-z]:[\\/][^\s"'`,;\]}]+|\\\\\.\\[A-Za-z]:[\\/][^\s"'`,;\]}]+))/giu,
    "$1[REDACTED_ABSOLUTE_PATH]"
  );
  redacted = redacted.replace(
    /(^|[\s"'`=(:,;{\[])((?:\\\\[^\\/\s"'`),;\]}]+[\\/][^\\/\s"'`),;\]}]+(?:[\\/][^\s"'`,;\]}]+)?))/gu,
    "$1[REDACTED_ABSOLUTE_PATH]"
  );
  redacted = redacted.replace(
    /(^|[\s"'`=(:,;{\[])((?:[A-Za-z]:[\\/][^\s"'`,;\]}]+))/gu,
    "$1[REDACTED_ABSOLUTE_PATH]"
  );
  redacted = redacted.replace(
    /(^|[\s"'`=(:,;{\[])((?:~[\\/][^\s"'`,;\]}]+))/gu,
    "$1[REDACTED_ABSOLUTE_PATH]"
  );
  redacted = redacted.replace(
    /(^|[\s"'`=(:,;{\[])(\/(?:data|etc|home|mnt|opt|private|root|srv|tmp|usr|users|var|workspace|workspaces)[\\/][^\s"'`),;\]}]+)/giu,
    "$1[REDACTED_ABSOLUTE_PATH]"
  );
  return redacted;
}
