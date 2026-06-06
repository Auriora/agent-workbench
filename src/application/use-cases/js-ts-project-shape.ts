import type { FileCatalogEntry } from "../../domain/models/index.js";

export type JsTsProjectShape = {
  package_manifests: string[];
  workspace_files: string[];
  tsconfig_files: string[];
  source_files: string[];
  test_files: string[];
  generated_files: string[];
  package_roots: string[];
  has_typescript: boolean;
  has_javascript: boolean;
};

export function detectJsTsProjectShape(files: readonly FileCatalogEntry[]): JsTsProjectShape {
  const packageManifests = files.map((file) => file.path).filter(isPackageJsonPath).sort();
  const workspaceFiles = files.map((file) => file.path).filter(isJsTsWorkspaceFile).sort();
  const tsconfigFiles = files.map((file) => file.path).filter(isTsConfigPath).sort();
  const sourceFiles = files
    .filter((file) => isJsTsLanguage(file.file_identity.language))
    .map((file) => file.path)
    .filter((filePath) => !isJsTsGeneratedPath(filePath))
    .sort();
  const testFiles = sourceFiles.filter(isJsTsTestPath);
  const generatedFiles = files
    .filter((file) => isJsTsLanguage(file.file_identity.language))
    .map((file) => file.path)
    .filter(isJsTsGeneratedPath)
    .sort();
  const packageRoots = packageManifests.map(packageRootFromManifest).sort();

  return {
    package_manifests: packageManifests,
    workspace_files: workspaceFiles,
    tsconfig_files: tsconfigFiles,
    source_files: sourceFiles,
    test_files: testFiles,
    generated_files: generatedFiles,
    package_roots: Array.from(new Set(packageRoots)),
    has_typescript: files.some((file) => file.file_identity.language === "typescript"),
    has_javascript: files.some((file) => file.file_identity.language === "javascript")
  };
}

export function isJsTsLanguage(language: string): boolean {
  return language === "javascript" || language === "typescript";
}

export function isPackageJsonPath(filePath: string): boolean {
  return basename(filePath) === "package.json";
}

export function isTsConfigPath(filePath: string): boolean {
  const name = basename(filePath);
  return name === "tsconfig.json" || (name.startsWith("tsconfig.") && name.endsWith(".json"));
}

export function isJsTsWorkspaceFile(filePath: string): boolean {
  const name = basename(filePath);
  return (
    name === "pnpm-workspace.yaml" ||
    name === "pnpm-workspace.yml" ||
    name === "pnpm-lock.yaml" ||
    name === "yarn.lock" ||
    name === "package-lock.json" ||
    name === "bun.lockb" ||
    name === "bun.lock" ||
    name === "npm-shrinkwrap.json"
  );
}

export function isJsTsTestPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.startsWith("e2e/") ||
    lower.includes("/e2e/") ||
    lower.includes("/__tests__/") ||
    /(^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(lower)
  );
}

export function isJsTsGeneratedPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes("/generated/") ||
    lower.includes("/__generated__/") ||
    lower.includes("/gen/") ||
    lower.includes("/dist/") ||
    lower.includes("/build/")
  );
}

export function jsTsPackageRootForPath(filePath: string, packageRoots: readonly string[]): string | undefined {
  const normalizedPath = normalize(filePath);
  const sortedRoots = [...packageRoots].sort((left, right) => right.length - left.length || left.localeCompare(right));
  return sortedRoots.find((root) => root === "." || normalizedPath === root || normalizedPath.startsWith(`${root}/`));
}

export function isJsTsProjectConfigPath(filePath: string): boolean {
  return isPackageJsonPath(filePath) || isTsConfigPath(filePath) || isJsTsWorkspaceFile(filePath);
}

function packageRootFromManifest(filePath: string): string {
  const directory = normalize(filePath).replace(/(^|\/)package\.json$/u, "");
  return directory.length === 0 ? "." : directory.replace(/\/$/u, "");
}

function basename(filePath: string): string {
  const normalized = normalize(filePath).toLowerCase();
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function normalize(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/u, "");
}
