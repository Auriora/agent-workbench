#!/usr/bin/env node
import {
  emitAdditionalContext,
  feedbackMode,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "./hook-common.js";

const PATH_KEYS = ["path", "file_path", "filename"];

export function extractChangedFiles(payload) {
  const files = new Set();
  const toolInput = objectValue(payload.tool_input);
  for (const key of PATH_KEYS) {
    const value = toolInput[key];
    if (typeof value === "string") {
      files.add(value);
    }
  }

  const oldPath = toolInput.old_path;
  const newPath = toolInput.new_path;
  if (typeof oldPath === "string") {
    files.add(oldPath);
  }
  if (typeof newPath === "string") {
    files.add(newPath);
  }

  for (const file of extractFilesFromToolResponse(payload.tool_response)) {
    files.add(file);
  }

  return [...files].filter((file) => !file.startsWith("/") && !file.includes(".."));
}

export function buildPostEditContext(payload, env = process.env) {
  if (feedbackMode(env) !== "basic") {
    return undefined;
  }

  const files = extractChangedFiles(payload);
  if (files.length === 0) {
    return undefined;
  }

  const preview = files.slice(0, 5).join(", ");
  const suffix = files.length > 5 ? `, and ${files.length - 5} more` : "";
  return [
    `Agent Workbench noticed changed files: ${preview}${suffix}.`,
    "Use the MCP verification_plan/static_feedback path for these files.",
    "The hook did not run analysis and did not produce partial results."
  ].join(" ");
}

function objectValue(value) {
  return typeof value === "object" && value !== null ? value : {};
}

function extractFilesFromToolResponse(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const matches = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:[AMDR]|[A-Z][a-z]+)\s+(.+)$/);
    if (match?.[1]) {
      matches.push(match[1].trim());
    }
  }
  return matches;
}

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildPostEditContext(payload);
  if (context) {
    emitAdditionalContext(context);
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
