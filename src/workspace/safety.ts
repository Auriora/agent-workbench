import fs from "node:fs";
import path from "node:path";

const DEFAULT_GENERATED_ROOTS = [".cache", "generated", "dist", "build"];
const DEFAULT_VENDOR_ROOTS = ["node_modules", ".venv", "venv", "__pycache__"];

export type PathDecision =
  | {
      allowed: true;
      absolutePath: string;
      relativePath: string;
      readOnly: boolean;
    }
  | {
      allowed: false;
      reason: "path_refused";
      message: string;
      requestedPath: string;
    };

export type WorkspaceSafetyPolicy = {
  repoRoot: string;
  generatedRoots?: string[];
  vendorRoots?: string[];
  allowGeneratedWrites?: boolean;
};

function normalizeRepoRoot(repoRoot: string): string {
  return fs.realpathSync(repoRoot);
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function hasRootPrefix(relativePath: string, roots: string[]): boolean {
  return roots.some((root) => relativePath === root || relativePath.startsWith(`${root}/`));
}

export function resolveWorkspacePath(
  policy: WorkspaceSafetyPolicy,
  requestedPath: string,
  options: { write?: boolean } = {}
): PathDecision {
  const repoRoot = normalizeRepoRoot(policy.repoRoot);
  const candidate = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(repoRoot, requestedPath);

  let realCandidate: string;
  try {
    realCandidate = fs.realpathSync(candidate);
  } catch {
    realCandidate = fs.realpathSync(path.dirname(candidate));
    realCandidate = path.join(realCandidate, path.basename(candidate));
  }

  if (!isInside(repoRoot, realCandidate)) {
    return {
      allowed: false,
      reason: "path_refused",
      message: "Path resolves outside the repository root.",
      requestedPath
    };
  }

  const relativePath = path.relative(repoRoot, realCandidate).split(path.sep).join("/");
  const generatedRoots = policy.generatedRoots ?? DEFAULT_GENERATED_ROOTS;
  const vendorRoots = policy.vendorRoots ?? DEFAULT_VENDOR_ROOTS;
  const readOnly =
    hasRootPrefix(relativePath, generatedRoots) || hasRootPrefix(relativePath, vendorRoots);

  if (options.write && readOnly && !policy.allowGeneratedWrites) {
    return {
      allowed: false,
      reason: "path_refused",
      message: "Generated or vendor paths are read-only by default.",
      requestedPath
    };
  }

  return {
    allowed: true,
    absolutePath: realCandidate,
    relativePath,
    readOnly
  };
}

export function redactSecretLikeText(value: string): string {
  return value
    .replace(/(api[_-]?key|token|password|secret)=([^\s]+)/gi, "$1=[REDACTED]")
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]");
}
