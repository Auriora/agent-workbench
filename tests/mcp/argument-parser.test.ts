/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  boundedRowLimitArgument,
  editOperationArgument,
  enumArgument,
  formatMcpArgumentError,
  parseMcpArguments,
  payloadModeArgument,
  repoPathArgument,
  repoRootArgument,
  sourcePositionArgument,
  sourceRangeArgument,
  traversalDepthArgument,
  usageContextArgument,
  validationTargetArgument
} from "../../src/interface-adapters/mcp/arguments/index.js";

describe("MCP argument parser helpers", () => {
  const parserSchema = z
    .object({
      repo_root: repoRootArgument,
      file_path: repoPathArgument,
      position: sourcePositionArgument,
      range: sourceRangeArgument,
      direction: enumArgument(["incoming", "outgoing", "both"]),
      row_limit: boundedRowLimitArgument(100, 20),
      traversal_depth: traversalDepthArgument(5, 1),
      payload_mode: payloadModeArgument.default("metadata_only"),
      usage_context: usageContextArgument,
      edit_operation: editOperationArgument,
      validation_target: validationTargetArgument
    })
    .strict();

  it("parses typed MCP argument categories with defaults", () => {
    const parsed = parseMcpArguments(parserSchema, {
      repo_root: "/repo",
      file_path: "src/index.ts",
      position: { line: 3, column: 0 },
      range: {
        start_line: 3,
        start_column: 0,
        end_line: 4,
        end_column: 2
      },
      direction: "both",
      edit_operation: "bounded_text_edit",
      validation_target: "tests/mcp/argument-parser.test.ts"
    });

    expect(parsed).toMatchObject({
      repo_root: "/repo",
      file_path: "src/index.ts",
      row_limit: 20,
      traversal_depth: 1,
      payload_mode: "metadata_only",
      usage_context: {},
      edit_operation: "bounded_text_edit",
      validation_target: "tests/mcp/argument-parser.test.ts"
    });
  });

  it.each([
    ["repo_root", { repo_root: "" }],
    ["file_path", { file_path: "/abs/path.ts" }],
    ["file_path traversal", { file_path: "../path.ts" }],
    ["position", { position: { line: 0, column: 0 } }],
    [
      "range",
      {
        range: {
          start_line: 4,
          start_column: 1,
          end_line: 3,
          end_column: 1
        }
      }
    ],
    ["direction", { direction: "sideways" }],
    ["row_limit", { row_limit: 101 }],
    ["traversal_depth", { traversal_depth: 6 }],
    ["payload_mode", { payload_mode: "raw_backend" }],
    ["usage_context", { usage_context: { agent: 42 } }],
    ["edit_operation", { edit_operation: "raw_patch" }],
    ["validation_target", { validation_target: "../tests" }]
  ])("rejects invalid %s input with a formatted message", (_caseName, override) => {
    const base = {
      repo_root: "/repo",
      file_path: "src/index.ts",
      position: { line: 1, column: 0 },
      range: {
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 1
      },
      direction: "incoming",
      row_limit: 10,
      traversal_depth: 1,
      payload_mode: "metadata_only",
      usage_context: { agent: "codex" },
      edit_operation: "bounded_text_edit",
      validation_target: "tests/unit.test.ts"
    };

    try {
      parseMcpArguments(parserSchema, { ...base, ...override });
      throw new Error("expected parser to reject invalid input");
    } catch (error) {
      expect(formatMcpArgumentError(error)).not.toEqual("Invalid MCP arguments.");
    }
  });
});
