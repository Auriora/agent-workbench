import { buildFileCatalogEntry } from "../../domain/policies/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";

export function buildStatBackedFileCatalogEntry(input: {
  path: string;
  size_bytes: number;
  mtime_ms: number;
}): FileCatalogEntry {
  return buildFileCatalogEntry({
    file_identity: {
      path: input.path,
      language: inferLanguageFromPath(input.path),
      content_hash: `stat:${input.size_bytes}:${Math.trunc(input.mtime_ms)}`,
      size_bytes: input.size_bytes,
      mtime_ms: input.mtime_ms
    }
  });
}

function inferLanguageFromPath(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
  const filename = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
  const ext = filename.slice(filename.lastIndexOf("."));
  const stem = filename.replace(/\.[^.]*$/, "");

  if (ext === ".py" || ext === ".pyi") return "python";
  if (ext === ".ts" || ext === ".tsx") return "typescript";
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") return "javascript";
  if (ext === ".cs") return "csharp";
  if (ext === ".go") return "go";
  if (ext === ".rs") return "rust";
  if (ext === ".java") return "java";
  if (ext === ".c") return "c";
  if (
    ext === ".cc" ||
    ext === ".cpp" ||
    ext === ".cxx" ||
    ext === ".h" ||
    ext === ".hh" ||
    ext === ".hpp" ||
    ext === ".hxx"
  ) {
    return "cpp";
  }
  if (ext === ".sh" || filename === "bashrc" || filename === "zshrc") return "shell";
  if (filename === "dockerfile" || ext === ".tf" || ext === ".tfvars") return "infrastructure";
  if (ext === ".yaml" || ext === ".yml") return "yaml";
  if (ext === ".md" || ext === ".markdown" || ext === ".mdx") return "markdown";
  if (ext === ".json" || ext === ".jsonc") return "json";
  if (ext === ".toml") return "toml";
  if (
    ext === ".cfg" ||
    ext === ".config" ||
    ext === ".ini" ||
    ext === ".env" ||
    stem === "pyproject" ||
    filename === "pyproject.toml" ||
    filename === "setup.cfg" ||
    stem === "requirements" ||
    stem === "config" ||
    stem.startsWith(".")
  ) {
    return "config";
  }
  if (filename === "package.json") return "json";
  return "text";
}
