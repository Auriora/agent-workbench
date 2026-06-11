import type { WorkspaceFilePort } from "../../ports/index.js";

export function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

export function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function statIfPresent(
  workspace: WorkspaceFilePort,
  filePath: string
): Promise<{ exists: boolean; is_file: boolean; size_bytes: number }> {
  try {
    return await workspace.stat({ path: filePath });
  } catch (_error) {
    return { exists: false, is_file: false, size_bytes: 0 };
  }
}
