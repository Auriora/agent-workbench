/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
