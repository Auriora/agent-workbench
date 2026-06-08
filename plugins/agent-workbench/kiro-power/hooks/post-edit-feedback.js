#!/usr/bin/env node
import {
  buildPostEditContext
} from "../../hooks/post-edit-feedback.js";
import {
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "../../hooks/hook-common.js";

export function extractKiroChangedFiles(payload) {
  const files = new Set();
  const toolInput = objectValue(payload.tool_input);

  for (const key of ["path", "file_path", "filename", "old_path", "new_path"]) {
    const value = toolInput[key];
    if (typeof value === "string") {
      files.add(value);
    }
  }

  const operations = toolInput.operations;
  if (Array.isArray(operations)) {
    for (const operation of operations) {
      const operationObject = objectValue(operation);
      for (const key of ["path", "file_path", "filename", "old_path", "new_path"]) {
        const value = operationObject[key];
        if (typeof value === "string") {
          files.add(value);
        }
      }
    }
  }

  return [...files];
}

export function buildKiroPostEditContext(payload, env = process.env) {
  const changedFiles = extractKiroChangedFiles(payload);
  if (changedFiles.length === 0) {
    return buildPostEditContext(payload, env);
  }

  const messages = [];
  for (const changedFile of changedFiles) {
    const message = buildPostEditContext(
      {
        ...payload,
        tool_input: {
          ...objectValue(payload.tool_input),
          path: changedFile
        }
      },
      env
    );
    if (message) {
      messages.push(message);
    }
  }

  return messages.length > 0 ? messages.join("\n") : undefined;
}

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildKiroPostEditContext(payload);
  if (context) {
    process.stdout.write(`${context}\n`);
  }
}

function objectValue(value) {
  return typeof value === "object" && value !== null ? value : {};
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
