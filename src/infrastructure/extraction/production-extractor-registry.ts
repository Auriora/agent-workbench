/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  CppDeclarationExtractorAdapter,
  GoDeclarationExtractorAdapter,
  JavaScriptTypeScriptTreeSitterExtractorAdapter,
  PythonTreeSitterExtractorAdapter,
  RubyTreeSitterExtractorAdapter
} from "../tree-sitter/index.js";
import { ExtractorRegistryAdapter } from "./extractor-registry.js";

export const PRODUCTION_EXTRACTOR_LANGUAGES = [
  "c",
  "cpp",
  "go",
  "javascript",
  "typescript",
  "python",
  "ruby"
] as const;

export function createProductionExtractorRegistry(): ExtractorRegistryAdapter {
  const extractors = new ExtractorRegistryAdapter();
  extractors.register(new CppDeclarationExtractorAdapter({ language: "c" }));
  extractors.register(new CppDeclarationExtractorAdapter({ language: "cpp" }));
  extractors.register(new GoDeclarationExtractorAdapter());
  extractors.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "javascript" }));
  extractors.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "typescript" }));
  extractors.register(new PythonTreeSitterExtractorAdapter());
  extractors.register(new RubyTreeSitterExtractorAdapter());
  return extractors;
}
