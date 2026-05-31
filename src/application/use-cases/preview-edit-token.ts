import crypto from "node:crypto";
import type { EditToken } from "../../contracts/index.js";

export function sha256Text(value: string): string {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

export function createPreviewToken(input: {
  path?: string;
  before?: string;
  after?: string;
  files?: Array<{ path: string; before: string; after: string }>;
  now?: Date;
  expiresInMs?: number;
}): EditToken {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (input.expiresInMs ?? 10 * 60 * 1000));
  const files =
    input.files ??
    (input.path !== undefined && input.before !== undefined && input.after !== undefined
      ? [{ path: input.path, before: input.before, after: input.after }]
      : []);
  if (files.length === 0) {
    throw new Error("Preview token requires at least one file.");
  }

  return {
    preview_token: crypto.randomUUID(),
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    files: files.map((file) => ({
      path: file.path,
      base_hash: sha256Text(file.before),
      after_hash: sha256Text(file.after),
      change_count: file.before === file.after ? 0 : 1
    })),
    operation: "bounded_text_edit",
    mutation_class: "workspace_write"
  };
}
