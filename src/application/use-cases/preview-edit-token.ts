import crypto from "node:crypto";
import type { EditToken } from "../../contracts/index.js";

export function sha256Text(value: string): string {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

export function createPreviewToken(input: {
  path: string;
  before: string;
  after: string;
  now?: Date;
}): EditToken {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  return {
    preview_token: crypto.randomUUID(),
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    files: [
      {
        path: input.path,
        base_hash: sha256Text(input.before),
        after_hash: sha256Text(input.after),
        change_count: input.before === input.after ? 0 : 1
      }
    ],
    operation: "bounded_text_edit",
    mutation_class: "workspace_write"
  };
}
