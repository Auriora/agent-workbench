/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  referenceCursorPayloadSchema,
  type ReferenceCursorPayload
} from "../../contracts/index.js";
import type {
  ReferenceCursorCodecPort,
  ReferenceCursorDecodeResult
} from "../../ports/index.js";

type CursorEnvelope = {
  version: 1;
  key_epoch: string;
  payload: string;
  tag: string;
};

export function createReferenceCursorCodec(input: {
  key?: Uint8Array;
  key_epoch?: string;
} = {}): ReferenceCursorCodecPort {
  const key = Buffer.from(input.key ?? randomBytes(32));
  const keyEpoch = input.key_epoch ?? randomBytes(16).toString("base64url");

  return {
    key_epoch: keyEpoch,
    encode(payload) {
      const parsed = referenceCursorPayloadSchema.parse(payload);
      if (parsed.key_epoch !== keyEpoch) {
        throw new Error("Reference cursor payload key epoch does not match the active codec.");
      }
      const encodedPayload = Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");
      const envelope: CursorEnvelope = {
        version: 1,
        key_epoch: keyEpoch,
        payload: encodedPayload,
        tag: sign(encodedPayload, keyEpoch, key)
      };
      return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
    },
    decode(cursor): ReferenceCursorDecodeResult {
      const envelope = parseEnvelope(cursor);
      if (envelope === null) {
        return { ok: false, code: "invalid_cursor" };
      }
      if (envelope.key_epoch !== keyEpoch) {
        return { ok: false, code: "cursor_expired" };
      }
      const expectedTag = Buffer.from(sign(envelope.payload, envelope.key_epoch, key), "base64url");
      const actualTag = decodeBase64Url(envelope.tag);
      if (actualTag === null || actualTag.length !== expectedTag.length || !timingSafeEqual(actualTag, expectedTag)) {
        return { ok: false, code: "invalid_cursor" };
      }
      try {
        const payload = referenceCursorPayloadSchema.parse(
          JSON.parse(Buffer.from(envelope.payload, "base64url").toString("utf8"))
        );
        if (payload.key_epoch !== envelope.key_epoch) {
          return { ok: false, code: "invalid_cursor" };
        }
        return { ok: true, payload };
      } catch {
        return { ok: false, code: "invalid_cursor" };
      }
    }
  };
}

function sign(payload: string, keyEpoch: string, key: Buffer): string {
  return createHmac("sha256", key)
    .update("reference-cursor-v1\n", "utf8")
    .update(keyEpoch, "utf8")
    .update("\n", "utf8")
    .update(payload, "utf8")
    .digest("base64url");
}

function parseEnvelope(cursor: string): CursorEnvelope | null {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<CursorEnvelope>;
    if (value.version !== 1 || typeof value.key_epoch !== "string" ||
        typeof value.payload !== "string" || typeof value.tag !== "string") {
      return null;
    }
    return value as CursorEnvelope;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): Buffer | null {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}
