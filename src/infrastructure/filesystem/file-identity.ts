/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FileIdentityPort } from "../../ports/index.js";
import type { FileIdentity } from "../../domain/models/index.js";
import { catalogSkipReason, normalizeCatalogPath } from "../../domain/policies/index.js";
import { readRootIgnoreRules } from "./ignore-file-policy.js";
import { isNestedGitRepository } from "./nested-git-repository.js";

export const QT_TRANSLATION_PREFIX_BYTES = 16_384;

export type TypeScriptFormatClassification = "typescript" | "qt-translation";

/** Recognise a complete bounded Qt TS prolog without parsing XML. */
export function classifyTypeScriptPrefix(content: string): TypeScriptFormatClassification {
  const bytes = Buffer.from(content.slice(0, QT_TRANSLATION_PREFIX_BYTES), "utf8");
  const bounded = bytes.subarray(0, QT_TRANSLATION_PREFIX_BYTES);
  // Validate encoding only through the signature. A later body character may
  // straddle the byte bound without invalidating an already complete root tag.
  content = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bounded);
  const bomLength = content.codePointAt(0) === 0xfeff ? 1 : 0;
  let offset = bomLength;
  offset = skipXmlWhitespace(content, offset);
  let markerSeen = false;
  let declarationSeen = false;
  let doctypeSeen = false;
  let asciiDeclaration = false;

  if (content.startsWith("<?xml", offset)) {
    const end = content.indexOf("?>", offset + 5);
    const declaration = end < 0 ? undefined : content.slice(offset, end + 2);
    const encoding = declaration === undefined ? undefined : xmlDeclarationEncoding(declaration);
    if (encoding === undefined) return "typescript";
    declarationSeen = true;
    markerSeen = true;
    asciiDeclaration = encoding === "ascii";
    offset = end + 2;
  }

  while (true) {
    offset = skipXmlWhitespace(content, offset);
    if (content.startsWith("<!--", offset)) {
      const end = content.indexOf("-->", offset + 4);
      const body = end < 0 ? undefined : content.slice(offset + 4, end);
      if (body === undefined || body.endsWith("-") || body.includes("--")) return "typescript";
      offset = end + 3;
      continue;
    }
    if (content.startsWith("<?", offset)) {
      const end = content.indexOf("?>", offset + 2);
      if (end < 0 || !isProcessingInstruction(content.slice(offset, end + 2))) return "typescript";
      offset = end + 2;
      continue;
    }
    if (content.startsWith("<!DOCTYPE", offset)) {
      if (doctypeSeen || (!declarationSeen && markerSeen)) return "typescript";
      const end = content.indexOf(">", offset + 9);
      if (end < 0 || !isQtDoctype(content.slice(offset, end + 1))) return "typescript";
      doctypeSeen = true;
      markerSeen = true;
      offset = end + 1;
      continue;
    }
    break;
  }

  offset = skipXmlWhitespace(content, offset);
  if (!markerSeen || !content.startsWith("<TS", offset)) return "typescript";
  const rootEnd = completeStartTag(content, offset + 3);
  if (rootEnd === undefined) return "typescript";
  const signature = content.slice(0, rootEnd + 1);
  if (signature.includes("\ufffd")) return "typescript";
  for (const character of signature) {
    if (!isValidXmlCharacter(character.codePointAt(0)!)) return "typescript";
  }
  if (asciiDeclaration && /[^\x00-\x7f]/u.test(signature.slice(bomLength))) return "typescript";
  return "qt-translation";
}

function skipXmlWhitespace(value: string, offset: number): number {
  while (offset < value.length && /[\t\n\r ]/u.test(value[offset]!)) offset += 1;
  return offset;
}

function xmlDeclarationEncoding(value: string): "ascii" | "utf8" | undefined {
  const match = /^<\?xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(['"])(?:1\.0|1\.1)\1(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(['"])([Uu][Tt][Ff]-8|[Uu][Ss]-[Aa][Ss][Cc][Ii][Ii]|[Aa][Ss][Cc][Ii][Ii])\2)?(?:[ \t\r\n]+standalone[ \t\r\n]*=[ \t\r\n]*(['"])(?:yes|no)\4)?[ \t\r\n]*\?>$/.exec(value);
  if (match === null) return undefined;
  const encoding = match[3]?.toLowerCase();
  return encoding === undefined || encoding === "utf-8" ? "utf8" : "ascii";
}

function isValidXmlCharacter(codePoint: number): boolean {
  return codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function isProcessingInstruction(value: string): boolean {
  return /^\?(?!xml(?:[ \t\r\n]|\?>))[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \t\r\n](?:[^?]|\?(?!>))*)?\?>$/iu.test(value.slice(1));
}

function isQtDoctype(value: string): boolean {
  return /^<!DOCTYPE[ \t\r\n]+TS[ \t\r\n]*>$/u.test(value);
}

function completeStartTag(value: string, offset: number): number | undefined {
  if (offset >= value.length || !/[\t\n\r />]/u.test(value[offset]!)) return undefined;
  let quote: string | undefined;
  let end: number | undefined;
  for (let index = offset; index < value.length; index += 1) {
    const character = value[index]!;
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "\"" || character === "'") quote = character;
    else if (character === ">") {
      end = index;
      break;
    }
  }
  if (end === undefined || quote !== undefined) return undefined;
  const body = value.slice(offset, end);
  let index = 0;
  const attributes = new Set<string>();
  let attributeCount = 0;
  while (index < body.length) {
    const whitespaceStart = index;
    while (index < body.length && /[\t\n\r ]/u.test(body[index]!)) index += 1;
    const separated = index > whitespaceStart;
    if (index === body.length) return end;
    if (body[index] === "/") return index === body.length - 1 ? end : undefined;
    if (attributeCount > 0 && !separated) return undefined;
    const nameStart = index;
    if (!/[A-Za-z_:]/u.test(body[index]!)) return undefined;
    index += 1;
    while (index < body.length && /[A-Za-z0-9_.:-]/u.test(body[index]!)) index += 1;
    const name = body.slice(nameStart, index);
    if (attributes.has(name)) return undefined;
    attributes.add(name);
    while (index < body.length && /[\t\n\r ]/u.test(body[index]!)) index += 1;
    if (body[index] !== "=") return undefined;
    index += 1;
    while (index < body.length && /[\t\n\r ]/u.test(body[index]!)) index += 1;
    const valueQuote = body[index];
    if (valueQuote !== "\"" && valueQuote !== "'") return undefined;
    index += 1;
    while (index < body.length && body[index] !== valueQuote) {
      const code = body.charCodeAt(index);
      if (body[index] === "<" || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)) return undefined;
      if (body[index] === "&") {
        const entityEnd = body.indexOf(";", index + 1);
        if (entityEnd < 0 || !isValidXmlEntity(body.slice(index + 1, entityEnd))) return undefined;
        index = entityEnd + 1;
        continue;
      }
      index += 1;
    }
    if (index >= body.length) return undefined;
    index += 1;
    attributeCount += 1;
  }
  return end;
}

function isValidXmlEntity(entity: string): boolean {
  if (["amp", "lt", "gt", "apos", "quot"].includes(entity)) return true;
  if (entity.startsWith("#x")) {
    if (!/^#x[0-9a-f]+$/iu.test(entity)) return false;
    return isValidXmlCharacter(Number.parseInt(entity.slice(2), 16));
  }
  if (entity.startsWith("#")) {
    if (!/^#[0-9]+$/u.test(entity)) return false;
    return isValidXmlCharacter(Number.parseInt(entity.slice(1), 10));
  }
  return false;
}

function hashText(value: string): string {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function hasRootPrefix(relativePath: string, roots: readonly string[]): boolean {
  return roots.some((root) => {
    const normalizedRoot = normalizeRelativePath(root).replace(/^\/+|\/+$/g, "");
    if (normalizedRoot.length === 0) {
      return false;
    }
    if (normalizedRoot === ".") {
      return true;
    }
    return relativePath === normalizedRoot || relativePath.startsWith(`${normalizedRoot}/`);
  });
}

export class FileIdentityAdapter implements FileIdentityPort {
  public async compute(input: { path: string; content: string }): Promise<FileIdentity> {
    const language = await this.inferLanguage({ path: input.path, content: input.content });
    const stats = fs.statSync(input.path);

    return {
      path: normalizeRelativePath(input.path),
      language,
      content_hash: hashText(input.content),
      size_bytes: stats.size,
      mtime_ms: stats.mtimeMs
    };
  }

  public async inferLanguage(input: { path: string; content?: string }): Promise<string> {
    const filename = normalizeRelativePath(path.basename(input.path)).toLowerCase();
    const ext = normalizeRelativePath(path.extname(input.path)).toLowerCase();
    const stem = filename.replace(/\.[^.]*$/, "");

    if (ext === ".py" || ext === ".pyi") {
      return "python";
    }

    if (ext === ".ts" || ext === ".tsx") {
      if (ext === ".ts" && input.content !== undefined && classifyTypeScriptPrefix(input.content) === "qt-translation") {
        return "xml";
      }
      return "typescript";
    }

    if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") {
      return "javascript";
    }

    if (ext === ".cs" || ext === ".razor" || ext === ".cshtml") {
      return "csharp";
    }

    if (ext === ".rb") {
      return "ruby";
    }

    if (ext === ".go") {
      return "go";
    }

    if (ext === ".rs") {
      return "rust";
    }

    if (ext === ".java") {
      return "java";
    }

    if (ext === ".c") {
      return "c";
    }

    if (
      ext === ".cc" ||
      ext === ".cpp" ||
      ext === ".cxx" ||
      ext === ".h" ||
      ext === ".hh" ||
      ext === ".hpp" ||
      ext === ".hxx"
    ) {
      return "cpp";
    }

    if (ext === ".sh" || filename === "bashrc" || filename === "zshrc") {
      return "shell";
    }

    if (filename === "dockerfile" || ext === ".tf" || ext === ".tfvars") {
      return "infrastructure";
    }

    if (ext === ".yaml" || ext === ".yml") {
      return "yaml";
    }

    if (ext === ".md" || ext === ".markdown" || ext === ".mdx") {
      return "markdown";
    }

    if (ext === ".json" || ext === ".jsonc") {
      return "json";
    }

    if (ext === ".toml") {
      return "toml";
    }

    if (
      ext === ".cfg" ||
      ext === ".config" ||
      ext === ".ini" ||
      ext === ".env" ||
      ext === ".sln" ||
      ext === ".csproj" ||
      ext === ".fsproj" ||
      ext === ".vbproj" ||
      stem === "pyproject" ||
      filename === "pyproject.toml" ||
      filename === "setup.cfg" ||
      stem === "requirements" ||
      stem === "config" ||
      stem.startsWith(".")
    ) {
      return "config";
    }

    if (filename === "package.json") {
      return "json";
    }

    return "text";
  }

  public async isSkipped(input: {
    path: string;
    repo_root: string;
    indexed_roots: readonly string[];
    skipped_roots: readonly string[];
  }): Promise<boolean> {
    const absoluteRepoRoot = path.resolve(input.repo_root);
    const absolutePath = path.resolve(input.path);

    const relativeToRepo = path.relative(absoluteRepoRoot, absolutePath);
    const isInsideRepo =
      relativeToRepo === "" || (!relativeToRepo.startsWith("..") && !path.isAbsolute(relativeToRepo));
    if (!isInsideRepo) {
      return true;
    }

    const relativePath = normalizeCatalogPath(relativeToRepo === "" ? "." : relativeToRepo);
    if (relativePath.length === 0 || relativePath === ".") {
      return false;
    }

    if (hasRootPrefix(relativePath, input.indexed_roots) === false && input.indexed_roots.length > 0) {
      return true;
    }

    const stats = statPathOrNull(absolutePath);
    return (
      catalogSkipReason({
        relativePath,
        isDirectory: stats?.isDirectory() ?? false,
        skippedRoots: input.skipped_roots,
        gitignoreRules: readRootIgnoreRules(absoluteRepoRoot),
        hasNestedGitRepository: stats?.isDirectory() === true && isNestedGitRepository(absoluteRepoRoot, absolutePath)
      }) !== null
    );
  }
}

function statPathOrNull(absolutePath: string): fs.Stats | null {
  try {
    return fs.statSync(absolutePath);
  } catch (_error) {
    return null;
  }
}
