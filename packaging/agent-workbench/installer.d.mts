// Type declarations for the shell-free installer (spec 033) so TS callers and
// tests importing it get typed exports instead of an implicit-any module.

export interface InstallOptions {
  source?: string;
  prefix?: string;
  codexHome?: string;
  writeCodexConfig?: boolean;
  dryRun?: boolean;
}

export interface InstallResult {
  sourceRoot: string;
  installRoot: string;
  codexHome: string;
  launcherPath: string;
  dryRun: boolean;
  actions: string[];
}

export interface ParsedArgs {
  source?: string;
  prefix?: string;
  codexHome?: string;
  writeCodexConfig: boolean;
  dryRun: boolean;
  help: boolean;
}

/** Required package components validated before any copy. */
export const REQUIRED_PATHS: string[];

/** Top-level components copied into the install root. */
export const COPY_COMPONENTS: string[];

/** Usage text printed for --help. */
export const USAGE: string;

export class InstallError extends Error {}

export function parseArgs(argv: string[]): ParsedArgs;

/** Resolve a command to a full path across PATH and (on Windows) PATHEXT. */
export function resolveOnPath(command: string, env?: NodeJS.ProcessEnv): string | null;

/** Per-OS, actionable remediation text for a missing prerequisite key. */
export function remediation(
  key: "node" | "pnpm" | "python" | "make" | "cxx" | "msvc",
  platform?: NodeJS.Platform
): string;

/** Run the install; throws InstallError on validation/prerequisite failure. */
export function install(options?: InstallOptions): InstallResult;
