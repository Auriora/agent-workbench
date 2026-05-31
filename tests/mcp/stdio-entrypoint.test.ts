import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import { createAgentWorkbenchServer } from "../../src/server.js";
import { resolveStdioLaunchConfig } from "../../src/mcp/stdio-launch.js";

describe("stdio MCP entrypoint", () => {
  it("uses cwd as the default repo root", () => {
    expect(
      resolveStdioLaunchConfig({
        argv: [],
        cwd: "/workspace/project",
        env: {}
      })
    ).toEqual({
      repoRoot: "/workspace/project"
    });
  });

  it("uses AGENT_WORKBENCH_DEFAULT_REPO_ROOT when provided", () => {
    expect(
      resolveStdioLaunchConfig({
        argv: [],
        cwd: "/launcher",
        env: {
          AGENT_WORKBENCH_DEFAULT_REPO_ROOT: "../target"
        }
      })
    ).toEqual({
      repoRoot: "/target"
    });
  });

  it("lets explicit repo root arguments override the environment", () => {
    expect(
      resolveStdioLaunchConfig({
        argv: ["--repo-root", "fixtures/repo"],
        cwd: "/workspace",
        env: {
          AGENT_WORKBENCH_DEFAULT_REPO_ROOT: "/env/repo"
        }
      })
    ).toEqual({
      repoRoot: "/workspace/fixtures/repo"
    });

    expect(
      resolveStdioLaunchConfig({
        argv: ["--repo-root=/direct/repo"],
        cwd: "/workspace",
        env: {}
      })
    ).toEqual({
      repoRoot: "/direct/repo"
    });
  });

  it("is exposed through the package mcp script", () => {
    expect(packageJson.scripts.mcp).toBe("node --import tsx src/mcp/stdio.ts");
    expect(fs.existsSync(path.resolve("src/mcp/stdio.ts"))).toBe(true);
    expect(fs.existsSync(path.resolve("src/mcp/stdio-launch.ts"))).toBe(true);
  });

  it("connects over stdio and exposes repo resources", async () => {
    const messages = await runStdioSmoke([
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "agent-workbench-test",
            version: "0.1.0"
          }
        }
      },
      {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "resources/list",
        params: {}
      },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "resources/read",
        params: {
          uri: "repo:///status"
        }
      },
      {
        jsonrpc: "2.0",
        id: 4,
        method: "resources/read",
        params: {
          uri: "repo:///scope"
        }
      },
      {
        jsonrpc: "2.0",
        id: 5,
        method: "resources/read",
        params: {
          uri: "repo:///overview"
        }
      },
      {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/list",
        params: {}
      },
      {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "context_for_task",
          arguments: {
            task: "Update package validation",
            files: ["package.json"]
          }
        }
      },
      {
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: {
          name: "verification_plan",
          arguments: {
            files: ["package.json"],
            changed_files: ["package.json"]
          }
        }
      }
    ]);
    const listedResources = messages.find((message) => message.id === 2) as {
      result: { resources: Array<{ uri: string; name: string }> };
    };
    const statusResource = messages.find((message) => message.id === 3) as {
      result: { contents: Array<{ text: string }> };
    };
    const scopeResource = messages.find((message) => message.id === 4) as {
      result: { contents: Array<{ text: string }> };
    };
    const overviewResource = messages.find((message) => message.id === 5) as {
      result: { contents: Array<{ text: string }> };
    };
    const listedTools = messages.find((message) => message.id === 6) as {
      result: { tools: Array<{ name: string; description: string }> };
    };
    const taskContext = messages.find((message) => message.id === 7) as {
      result: { content: Array<{ text: string }> };
    };
    const verificationPlan = messages.find((message) => message.id === 8) as {
      result: { content: Array<{ text: string }> };
    };
    const parsed = JSON.parse(statusResource.result.contents[0]?.text ?? "{}") as {
      data: { adapter_coverage: Array<{ domain: string; name: string }> };
    };
    const parsedScope = JSON.parse(scopeResource.result.contents[0]?.text ?? "{}") as {
      data: { languages: string[]; capability_counts: Record<string, number> };
    };
    const parsedOverview = JSON.parse(overviewResource.result.contents[0]?.text ?? "{}") as {
      data: { platforms: string[]; key_files: Array<{ path: string }> };
    };
    const parsedTaskContext = JSON.parse(taskContext.result.content[0]?.text ?? "{}") as {
      data: { task: string; requested_files: Array<{ path: string; exists: boolean }> };
    };
    const parsedVerificationPlan = JSON.parse(verificationPlan.result.content[0]?.text ?? "{}") as {
      data: { planned_commands: Array<{ display: string; execution: string }>; static_feedback?: unknown };
    };

    expect(listedResources.result.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uri: "repo:///status",
          name: "status"
        }),
        expect.objectContaining({
          uri: "repo:///scope",
          name: "scope"
        }),
        expect.objectContaining({
          uri: "repo:///overview",
          name: "overview"
        })
      ])
    );
    expect(parsed.data.adapter_coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "language",
          name: "python"
        }),
        expect.objectContaining({
          domain: "package_manager",
          name: "npm"
        })
      ])
    );
    expect(parsedScope.data.languages).toEqual(
      expect.arrayContaining(["python", "typescript", "json", "infrastructure", "yaml"])
    );
    expect(parsedScope.data.capability_counts).toMatchObject({
      partial_semantic: 1,
      resource_backed: 3,
      unsupported: 1
    });
    expect(parsedOverview.data.platforms).toEqual(["docker", "github_actions", "node"]);
    expect(parsedOverview.data.key_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "package.json" }),
        expect.objectContaining({ path: "Dockerfile" })
      ])
    );
    expect(listedTools.result.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "context_for_task"
        }),
        expect.objectContaining({
          name: "verification_plan"
        })
      ])
    );
    expect(parsedTaskContext.data).toMatchObject({
      task: "Update package validation",
      requested_files: [
        expect.objectContaining({
          path: "package.json",
          exists: true
        })
      ]
    });
    expect(parsedVerificationPlan.data.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          display: "pnpm typecheck",
          execution: "not_executed"
        })
      ])
    );
    expect(parsedVerificationPlan.data.static_feedback).toBeUndefined();
  });
});

async function runStdioSmoke(inputMessages: unknown[]): Promise<Array<{ id?: number; result?: unknown }>> {
  const expectedResponseIds = inputMessages
    .map((message) => (hasMessageId(message) ? message.id : undefined))
    .filter((id): id is number => typeof id === "number");
  const input = new PassThrough();
  const output = new PassThrough();
  const messages: Array<{ id?: number; result?: unknown }> = [];
  let stdout = "";
  const transport = new StdioServerTransport(input, output);
  const server = createAgentWorkbenchServer(
    path.resolve("tests/fixtures/fixture-mixed-language-platform")
  );

  const responsesReady = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for stdio responses: ${JSON.stringify(messages)}`));
    }, 2000);
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      stdout += chunk;
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        messages.push(JSON.parse(line) as { id?: number; result?: unknown });
      }
      if (expectedResponseIds.every((id) => messages.some((message) => message.id === id))) {
        clearTimeout(timeout);
        resolve();
      }
    });
    output.on("error", reject);
  });

  await server.connect(transport);
  for (const message of inputMessages) {
    input.write(`${JSON.stringify(message)}\n`);
  }
  await responsesReady;
  input.end();
  await transport.close();

  expect(stdout).toBe("");
  return messages;
}

function hasMessageId(message: unknown): message is { id: unknown } {
  return typeof message === "object" && message !== null && "id" in message;
}
