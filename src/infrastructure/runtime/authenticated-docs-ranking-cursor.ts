/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { docsRankingCursorPayloadSchema, type DocsRankingCursorPayload } from "../../contracts/index.js";
import type { DocsRankingCursorCodecPort, DocsRankingCursorDecodeResult } from "../../ports/index.js";

const MAX_CURSOR_LENGTH = 8192;

type CursorEnvelope = {
  version: 1;
  key_epoch: string;
  payload: string;
  tag: string;
};

export function createDocsRankingCursorCodec(input: {
  key?: Uint8Array;
  key_epoch?: string;
} = {}): DocsRankingCursorCodecPort {
  const key = Buffer.from(input.key ?? randomBytes(32));
  const keyEpoch = input.key_epoch ?? randomBytes(16).toString("base64url");
  return {
    encode(payload) {
      const parsed = docsRankingCursorPayloadSchema.parse(payload);
      const encodedPayload = Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");
      const envelope: CursorEnvelope = {
        version: 1,
        key_epoch: keyEpoch,
        payload: encodedPayload,
        tag: sign(encodedPayload, keyEpoch, key)
      };
      const cursor = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
      if (cursor.length > MAX_CURSOR_LENGTH) throw new Error("Ranked documentation cursor exceeds its bound.");
      return cursor;
    },
    decode(cursor): DocsRankingCursorDecodeResult {
      const envelope = parseEnvelope(cursor);
      if (envelope === null) return { ok: false, code: "invalid_cursor" };
      if (envelope.key_epoch !== keyEpoch) return { ok: false, code: "cursor_expired" };
      const actual = decodeBase64Url(envelope.tag);
      const expected = Buffer.from(sign(envelope.payload, envelope.key_epoch, key), "base64url");
      if (actual === null || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        return { ok: false, code: "invalid_cursor" };
      }
      try {
        const payload: DocsRankingCursorPayload = docsRankingCursorPayloadSchema.parse(
          JSON.parse(Buffer.from(envelope.payload, "base64url").toString("utf8"))
        );
        return { ok: true, payload };
      } catch {
        return { ok: false, code: "invalid_cursor" };
      }
    }
  };
}

function sign(payload: string, keyEpoch: string, key: Buffer): string {
  return createHmac("sha256", key)
    .update("docs-ranking-cursor-v1\n", "utf8")
    .update(keyEpoch, "utf8")
    .update("\n", "utf8")
    .update(payload, "utf8")
    .digest("base64url");
}

function parseEnvelope(cursor: string): CursorEnvelope | null {
  if (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<CursorEnvelope>;
    if (value.version !== 1 || typeof value.key_epoch !== "string" || typeof value.payload !== "string" ||
        typeof value.tag !== "string" || value.payload.length > MAX_CURSOR_LENGTH) return null;
    return value as CursorEnvelope;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): Buffer | null {
  try { return Buffer.from(value, "base64url"); } catch { return null; }
}
