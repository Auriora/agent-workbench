/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import {
  RUBY_TREE_SITTER_GRAMMAR,
  rubyTreeSitterGrammarForLanguage,
  rubyTreeSitterGrammarForPath
} from "../../src/infrastructure/tree-sitter/index.js";

describe("ruby tree-sitter parser path", () => {
  it("registers the Ruby grammar name and dependency", () => {
    expect(RUBY_TREE_SITTER_GRAMMAR).toBe("tree-sitter-ruby");
    expect(packageJson.dependencies).toMatchObject({
      "tree-sitter-ruby": expect.any(String)
    });
  });

  it("maps Ruby files and language tokens to the Ruby parser", () => {
    expect(rubyTreeSitterGrammarForLanguage("ruby")).toBe("ruby");
    expect(rubyTreeSitterGrammarForLanguage("python")).toBeNull();
    expect(rubyTreeSitterGrammarForPath("app/models/widget.rb")).toBe("ruby");
    expect(rubyTreeSitterGrammarForPath("app/controllers/home_controller.rb")).toBe("ruby");
    expect(rubyTreeSitterGrammarForPath("app/lib/tasks/sync.rake")).toBeNull();
    expect(rubyTreeSitterGrammarForPath("app/service.rb.erb")).toBeNull();
    expect(rubyTreeSitterGrammarForPath("app/main.ts")).toBeNull();
  });
});
