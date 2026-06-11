import { describe, expect, it } from "vitest";
import type { FileCatalogEntry } from "../../src/domain/models/index.js";
import type { WorkspaceFilePort } from "../../src/ports/index.js";
import {
  cmakeValidationCommands,
  type CMakeTargetEvidence
} from "../../src/application/use-cases/validation-ecosystems.js";
import {
  configuredPackageCommands,
  detectPackageManager,
  selectPackageScripts,
  type PackageScriptEvidence
} from "../../src/application/use-cases/validation-package-scripts.js";
import { discoverValidationProtocol } from "../../src/application/use-cases/validation-environment.js";
import { buildStaticFeedback } from "../../src/application/use-cases/validation-static-feedback.js";

describe("validation planner rule units", () => {
  it("selects package-local scripts for selected workspace files", () => {
    const packages: PackageScriptEvidence[] = [
      packageEvidence({
        package_json_path: "package.json",
        directory: ".",
        scripts: { test: "vitest run" }
      }),
      packageEvidence({
        package_json_path: "apps/web/package.json",
        directory: "apps/web",
        scripts: { test: "vitest run --project web", typecheck: "tsc -p tsconfig.json" },
        tsconfig_paths: ["apps/web/tsconfig.json"],
        workspace_config_paths: ["pnpm-workspace.yaml"]
      })
    ];

    const selected = selectPackageScripts({
      packages,
      selectedEntries: [catalogEntry("apps/web/src/app.ts", "typescript")],
      includeAll: false
    });
    const commands = configuredPackageCommands(selected, [
      { script: "typecheck", reason: "TypeScript package scripts are configured." },
      { script: "test", reason: "Package test script is configured." }
    ]);

    expect(commands.map((command) => command.display)).toEqual([
      "pnpm --dir apps/web run typecheck",
      "pnpm --dir apps/web run test",
      "pnpm run test"
    ]);
    expect(commands[0]?.reason).toContain("Package evidence: apps/web/package.json");
    expect(commands[0]?.reason).toContain("tsconfig evidence: apps/web/tsconfig.json");
    expect(detectPackageManager(new Set(["package.json", "bun.lockb"]))).toBe("bun");
  });

  it("plans CMake build commands for the target nearest the selected source", () => {
    const targets: CMakeTargetEvidence[] = [
      {
        name: "core",
        kind: "library",
        path: "CMakeLists.txt",
        sources: ["src/core.cpp"]
      },
      {
        name: "service_tests",
        kind: "executable",
        path: "tests/CMakeLists.txt",
        sources: ["../src/service.cpp", "service_tests.cpp"]
      }
    ];

    const commands = cmakeValidationCommands({
      discovery: {
        localCMakeFiles: ["tests/CMakeLists.txt"],
        cmakeTargets: targets
      },
      selectedEntries: [catalogEntry("tests/service_tests.cpp", "cpp")],
      includeAll: false
    });

    expect(commands.map((command) => command.display)).toEqual([
      "cmake -S . -B build",
      "cmake --build build --target service_tests",
      "ctest --test-dir build"
    ]);
    expect(commands[1]?.reason).toContain("tests/CMakeLists.txt declares executable target service_tests");
  });

  it("discovers repo-local validation policy without planning blocked host commands", async () => {
    const workspace = new MemoryWorkspace({
      ".agent-workbench/validation-policy.json": JSON.stringify({
        validation: {
          environment: "docker",
          host_commands: "blocked",
          commands: [
            {
              command: "docker",
              args: ["compose", "run", "--rm", "app", "go", "test", "./..."],
              reason: "Project validation runs in Docker."
            },
            {
              command: "go",
              args: ["test", "./...", "&&", "rm", "-rf", "/"],
              reason: "Unsafe metacharacter-bearing command should be ignored."
            }
          ]
        }
      })
    });

    const protocol = await discoverValidationProtocol(workspace);

    expect(protocol.requiresDockerValidation).toBe(true);
    expect(protocol.blocksHostCommands).toBe(true);
    expect(protocol.evidencePaths).toEqual([".agent-workbench/validation-policy.json"]);
    expect(protocol.policyCommands.map((command) => command.display)).toEqual([
      "docker compose run --rm app go test ./..."
    ]);
  });

  it("reports static feedback only for changed files missing from the scanned catalog", () => {
    const feedback = buildStaticFeedback(
      ["src/service.ts", "missing/config.json", "./src/service.ts"],
      [catalogEntry("src/service.ts", "typescript")]
    );

    expect(feedback).toEqual({
      status: "actionable",
      checked_files: ["missing/config.json", "src/service.ts"],
      findings: [
        expect.objectContaining({
          path: "missing/config.json",
          message: "Changed file was not found in the scanned repository."
        })
      ]
    });
  });
});

function packageEvidence(input: {
  package_json_path: string;
  directory: string;
  scripts: Record<string, string>;
  tsconfig_paths?: string[];
  workspace_config_paths?: string[];
}): PackageScriptEvidence {
  return {
    package_json_path: input.package_json_path,
    directory: input.directory,
    package_manager: "pnpm",
    scripts: input.scripts,
    tsconfig_paths: input.tsconfig_paths ?? [],
    workspace_config_paths: input.workspace_config_paths ?? []
  };
}

function catalogEntry(filePath: string, language: string): FileCatalogEntry {
  return {
    path: filePath,
    indexed: true,
    file_identity: {
      path: filePath,
      language,
      content_hash: `hash:${filePath}`,
      size_bytes: 10,
      mtime_ms: 1
    }
  };
}

class MemoryWorkspace implements WorkspaceFilePort {
  constructor(private readonly files: Record<string, string>) {}

  async readText(input: { path: string }): Promise<string> {
    const content = this.files[input.path];
    if (content === undefined) {
      throw new Error(`${input.path} not found`);
    }
    return content;
  }

  async readBinary(input: { path: string }): Promise<Uint8Array> {
    return new TextEncoder().encode(await this.readText(input));
  }

  async writeText(): Promise<void> {
    throw new Error("MemoryWorkspace is read-only in validation planner tests");
  }

  async writeBinary(): Promise<void> {
    throw new Error("MemoryWorkspace is read-only in validation planner tests");
  }

  async stat(input: { path: string }): Promise<{
    exists: boolean;
    is_file: boolean;
    size_bytes: number;
    mtime_ms: number;
  }> {
    const content = this.files[input.path];
    return {
      exists: content !== undefined,
      is_file: content !== undefined,
      size_bytes: content?.length ?? 0,
      mtime_ms: 1
    };
  }

  async deletePath(): Promise<void> {
    throw new Error("MemoryWorkspace is read-only in validation planner tests");
  }

  async ensureDirectory(): Promise<void> {
    throw new Error("MemoryWorkspace is read-only in validation planner tests");
  }
}
