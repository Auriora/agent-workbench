/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { createPreviewToken, sha256Text } from "../../src/application/use-cases/preview-edit-token.js";

describe("edit preview tokens", () => {
  it("captures base and after hashes without mutating files", () => {
    const token = createPreviewToken({
      path: "src/example.py",
      before: "old\n",
      after: "new\n",
      now: new Date("2026-05-07T00:00:00Z")
    });

    expect(token).toMatchObject({
      created_at: "2026-05-07T00:00:00.000Z",
      expires_at: "2026-05-07T00:10:00.000Z",
      operation: "bounded_text_edit",
      mutation_class: "workspace_write",
      files: [
        {
          path: "src/example.py",
          base_exists: true,
          base_hash: sha256Text("old\n"),
          after_hash: sha256Text("new\n"),
          change_count: 1
        }
      ]
    });
  });
});
