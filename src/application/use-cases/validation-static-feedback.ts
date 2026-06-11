import type { StaticFeedback } from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { normalizeRepoPath, uniqueSorted } from "./validation-utils.js";

export function buildStaticFeedback(
  changedFiles: readonly string[],
  files: readonly FileCatalogEntry[]
): StaticFeedback {
  const knownPaths = new Set(files.map((file) => file.path));
  const checkedFiles = uniqueSorted(changedFiles.map(normalizeRepoPath));
  const findings = checkedFiles
    .filter((filePath) => knownPaths.has(filePath) === false)
    .map((filePath) => ({
      path: filePath,
      severity: "warning" as const,
      message: "Changed file was not found in the scanned repository.",
      suggested_action: "Verify the path before relying on this validation plan."
    }));

  return {
    status: findings.length > 0 ? "actionable" : "silent",
    checked_files: checkedFiles,
    findings
  };
}
