import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  describe,
  expect,
  it,
  vi
} from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import { applyWorkspaceEdit } from "../../src/application/use-cases/apply-workspace-edit.js";
import { computeImpact } from "../../src/application/use-cases/compute-impact.js";
import { findReferences } from "../../src/application/use-cases/find-references.js";
import { getTaskContext } from "../../src/application/use-cases/get-task-context.js";
import { getRepoOverview } from "../../src/application/use-cases/get-repo-overview.js";
import { getRepoScope } from "../../src/application/use-cases/get-repo-scope.js";
import { getScannedRepoStatus } from "../../src/application/use-cases/get-repo-status.js";
import { planVerification } from "../../src/application/use-cases/plan-verification.js";
import { previewWorkspaceEdit } from "../../src/application/use-cases/preview-workspace-edit.js";
import { searchSymbols } from "../../src/application/use-cases/search-symbols.js";
import { InMemoryEditPreviewStoreAdapter } from "../../src/infrastructure/edit-preview-store/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter,
  WorkspaceSafetyAdapter
} from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore } from "../../src/infrastructure/sqlite/index.js";
import { buildApplyWorkspaceEditEnvelope, buildPreviewWorkspaceEditEnvelope } from "../../src/presentation/workspace-edit-presenter.js";
import { buildFindReferencesEnvelope } from "../../src/presentation/find-references-presenter.js";
import { buildImpactEnvelope } from "../../src/presentation/impact-presenter.js";
import { buildRepoOverviewEnvelope } from "../../src/presentation/repo-overview-presenter.js";
import { buildRepoScopeEnvelope } from "../../src/presentation/repo-scope-presenter.js";
import { buildStatusEnvelope } from "../../src/presentation/status-presenter.js";
import { buildSymbolSearchEnvelope } from "../../src/presentation/symbol-search-presenter.js";
import { buildTaskContextEnvelope } from "../../src/presentation/task-context-presenter.js";
import { buildVerificationPlanEnvelope } from "../../src/presentation/verification-plan-presenter.js";
import { createAgentWorkbenchServer } from "../../src/server.js";
import { resolveStdioLaunchConfig } from "../../src/mcp/stdio-launch.js";
import { sha256Text } from "../../src/application/use-cases/preview-edit-token.js";

type StdioMessage = {
  id?: number;
  result?: {
    contents?: Array<{ text: string }>;
    content?: Array<{ text: string }>;
    resources?: Array<{ uri: string; name: string }>;
    tools?: Array<{ name: string; description: string }>;
  };
};

type McpEnvelope = StdioMessage["result"] & {
  contents?: Array<{ text: string }>;
  content?: Array<{ text: string }>;
};

type PresenterGoldens = {
  status: ReturnType<typeof buildStatusEnvelope>;
  scope: ReturnType<typeof buildRepoScopeEnvelope>;
  overview: ReturnType<typeof buildRepoOverviewEnvelope>;
  context: ReturnType<typeof buildTaskContextEnvelope>;
  symbolSearch: ReturnType<typeof buildSymbolSearchEnvelope>;
  findReferences: ReturnType<typeof buildFindReferencesEnvelope>;
  impact: ReturnType<typeof buildImpactEnvelope>;
  verificationPlan: ReturnType<typeof buildVerificationPlanEnvelope>;
  preview: ReturnType<typeof buildPreviewWorkspaceEditEnvelope>;
};

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
    const messages = await runStdioSmoke(path.resolve("tests/fixtures/fixture-mixed-language-platform"), [
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
    const listedResources = messageWithId(messages, 2) as {
      result: { resources: Array<{ uri: string; name: string }> };
    };
    const statusResource = messageWithId(messages, 3) as {
      result: { contents: Array<{ text: string }> };
    };
    const scopeResource = messageWithId(messages, 4) as {
      result: { contents: Array<{ text: string }> };
    };
    const overviewResource = messageWithId(messages, 5) as {
      result: { contents: Array<{ text: string }> };
    };
    const listedTools = messageWithId(messages, 6) as {
      result: { tools: Array<{ name: string; description: string }> };
    };
    const taskContext = messageWithId(messages, 7) as {
      result: { content: Array<{ text: string }> };
    };
    const verificationPlan = messageWithId(messages, 8) as {
      result: { content: Array<{ text: string }> };
    };
    const parsed = JSON.parse(statusResource.result.contents[0]?.text ?? "{}") as {
      data: {
        repo_root: string;
        runtime_state: string;
        adapter_coverage: Array<{ domain: string; name: string }>;
      };
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
    expect(parsed.data).toEqual(
      expect.objectContaining({
        repo_root: path.resolve("tests/fixtures/fixture-mixed-language-platform")
      })
    );
    expect(["cold", "refreshing", "fresh", "partial"]).toContain(parsed.data.runtime_state);
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
        }),
        expect.objectContaining({
          name: "preview_workspace_edit"
        }),
        expect.objectContaining({
          name: "apply_workspace_edit"
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
          display: "pnpm run typecheck",
          execution: "not_executed"
        })
      ])
    );
    expect(parsedVerificationPlan.data.static_feedback).toBeUndefined();
  });

  it("starts graph warmup for the local repo on MCP startup", async () => {
    const fixtureRoot = createCleanFixtureCopy({
      prefix: "agent-workbench-mcp-warmup-",
      sourceRoot: path.resolve("tests/fixtures/fixture-basic-python")
    });
    const session = await createStdioSession(fixtureRoot);

    try {
      await session.call({
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
      });
      session.notify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      });

      const symbolSearch = await waitForWarmSymbolSearch(session, "Runner");
      expect(symbolSearch.data).toMatchObject({
        query: "Runner",
        repo_root: fixtureRoot
      });
      expect(symbolSearch.data.symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Runner",
            path: "src/sample_pkg/service.py"
          })
        ])
      );

      const status = parseResponseEnvelope<StatusEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 100,
          method: "resources/read",
          params: {
            uri: "repo:///status"
          }
        })
      );
      expect(status.data).toMatchObject({
        repo_root: fixtureRoot,
        runtime_state: "fresh",
        freshness: "fresh",
        warmup_state: "complete"
      });
    } finally {
      await session.close();
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("returns fixture MVP responses shaped by presenter envelopes", async () => {
    const fixtureRoot = createFixtureCopy("agent-workbench-mcp-server-");
    const expectedFixtureRoot = createFixtureCopy("agent-workbench-mcp-expected-");
    const expectedNow = new Date("2026-05-31T12:00:00.000Z");
    const edits = [{ path: "package.json", replacement_text: "{\n  \"name\": \"fixture-mixed-language-platform\"\n}\n" }];

    vi.useFakeTimers();
    vi.setSystemTime(expectedNow);

    try {
      const expected = normalizeFixturePaths(
        JSON.parse(JSON.stringify(await buildPresenterGoldens({
          fixtureRoot: expectedFixtureRoot,
          now: expectedNow,
          edits
        }))) as PresenterGoldens,
        expectedFixtureRoot,
        fixtureRoot
      );
      const session = await createStdioSession(fixtureRoot, {
        startGraphWarmup: false
      });
      await session.call({
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
      });
      await session.notify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      });
      const listedResources = parseResponseEnvelope<ListedResourcesEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 2,
          method: "resources/list",
          params: {}
        })
      );
      const statusResource = parseResponseEnvelope<StatusEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 3,
          method: "resources/read",
          params: {
            uri: "repo:///status"
          }
        })
      );
      const scopeResource = parseResponseEnvelope<ScopeEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 4,
          method: "resources/read",
          params: {
            uri: "repo:///scope"
          }
        })
      );
      const overviewResource = parseResponseEnvelope<OverviewEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 5,
          method: "resources/read",
          params: {
            uri: "repo:///overview"
          }
        })
      );
      const listedTools = parseResponseEnvelope<ListedToolsEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 6,
          method: "tools/list",
          params: {}
        })
      );
      const taskContext = parseResponseEnvelope<ContextEnvelope>(
        await session.call({
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
        })
      );
      const symbolSearch = parseResponseEnvelope<SymbolSearchEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 8,
          method: "tools/call",
          params: {
            name: "symbol_search",
            arguments: {
              query: "Runner"
            }
          }
        })
      );
      const findReferences = parseResponseEnvelope<FindReferencesEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 9,
          method: "tools/call",
          params: {
            name: "find_references",
            arguments: {
              symbol: "Runner"
            }
          }
        })
      );
      const impact = parseResponseEnvelope<ImpactEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: {
            name: "impact",
            arguments: {
              node_id: "symbol-1"
            }
          }
        })
      );
      const previewResponse = parseResponseEnvelope<PreviewEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 11,
          method: "tools/call",
          params: {
            name: "preview_workspace_edit",
            arguments: {
              edits
            }
          }
        })
      );
      const applyResponse = parseResponseEnvelope<ApplyEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 12,
          method: "tools/call",
          params: {
            name: "apply_workspace_edit",
            arguments: {
              preview_token: previewResponse.data.preview.preview_token,
              edits
            }
          }
        })
      );
      const verificationPlan = parseResponseEnvelope<VerificationPlanEnvelope>(
        await session.call({
          jsonrpc: "2.0",
          id: 13,
          method: "tools/call",
          params: {
            name: "verification_plan",
            arguments: {
              files: ["package.json"],
              changed_files: ["package.json"]
            }
          }
        })
      );

      await session.close();

      const expectedPreview = normalizeFixturePaths(
        {
          ...expected.preview,
          data: {
            ...expected.preview.data,
            preview: {
              ...expected.preview.data.preview,
              preview_token: previewResponse.data.preview.preview_token,
              created_at: previewResponse.data.preview.created_at,
              expires_at: previewResponse.data.preview.expires_at
            },
            changed_files: previewResponse.data.changed_files,
            next_actions: previewResponse.data.next_actions
          }
        },
        expectedFixtureRoot,
        fixtureRoot
      );
      const expectedApply = await buildExpectedApplyEnvelope({
        fixtureRoot: expectedFixtureRoot,
        previewToken: previewResponse.data.preview.preview_token,
        preview: previewResponse.data.preview,
        edits,
        now: expectedNow,
        nowUnixMs: expectedNow.getTime()
      });
      const expectedVerificationPlan = await buildExpectedVerificationPlanEnvelope({
        fixtureRoot: expectedFixtureRoot
      });

      expect(listedResources.resources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ uri: "repo:///status", name: "status" }),
          expect.objectContaining({ uri: "repo:///scope", name: "scope" }),
          expect.objectContaining({ uri: "repo:///overview", name: "overview" })
        ])
      );

      expect(statusResource).toMatchObject({
        contract_version: expected.status.contract_version,
        data: {
          repo_root: fixtureRoot
        },
        errors: []
      });
      expect(["cold", "refreshing", "fresh", "partial"]).toContain(statusResource.data.runtime_state);
      expect(scopeResource).toEqual(expected.scope);
      expect(overviewResource).toEqual(expected.overview);
      expect(taskContext).toEqual(expected.context);
      expect(symbolSearch).toEqual(expected.symbolSearch);
      expect(findReferences).toEqual(expected.findReferences);
      expect(impact).toEqual(expected.impact);
      expect(previewResponse).toEqual(expectedPreview);
      expect(
        normalizeFixturePaths(expectedApply, expectedFixtureRoot, fixtureRoot)
      ).toEqual(applyResponse);
      expect(
        normalizeFixturePaths(expectedVerificationPlan, expectedFixtureRoot, fixtureRoot)
      ).toEqual(verificationPlan);

      expect(listedTools.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "symbol_search" }),
          expect.objectContaining({ name: "find_references" }),
          expect.objectContaining({ name: "impact" }),
          expect.objectContaining({ name: "preview_workspace_edit" }),
          expect.objectContaining({ name: "apply_workspace_edit" }),
          expect.objectContaining({ name: "verification_plan" })
        ])
      );
    } finally {
      vi.useRealTimers();
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
      fs.rmSync(expectedFixtureRoot, { recursive: true, force: true });
    }
  });
});

type ListedResourcesEnvelope = {
  resources: Array<{ uri: string; name: string }>;
};

type StatusEnvelope = {
  data: {
    repo_root: string;
    runtime_state: string;
    freshness: string;
    warmup_state?: string;
    adapter_coverage: Array<{ domain: string; name: string }>;
  };
};

type ScopeEnvelope = {
  data: { languages: string[]; capability_counts: Record<string, number> };
};

type OverviewEnvelope = {
  data: { platforms: string[]; key_files: Array<{ path: string }> };
};

type ListedToolsEnvelope = {
  tools: Array<{ name: string; description: string }>;
};

type ContextEnvelope = {
  data: { task: string; requested_files: Array<{ path: string; exists: boolean }> };
};

type SymbolSearchEnvelope = {
  data: {
    symbols: Array<unknown>;
    repo_root: string;
    snapshot_id: string;
    query: string;
    next_actions: unknown[];
  };
};

type FindReferencesEnvelope = {
  data: {
    repo_root: string;
    snapshot_id: string;
    target?: unknown;
    references: unknown[];
    next_actions: unknown[];
  };
};

type ImpactEnvelope = {
  data: {
    repo_root: string;
    snapshot_id: string;
    start_node_ids: string[];
    affected_symbols: unknown[];
    affected_files: unknown[];
    edge_count: number;
    reached_depth: number;
    traversal_truncated: boolean;
    next_actions: unknown[];
  };
};

type PreviewEnvelope = {
  data: {
    repo_root: string;
    preview: {
      preview_token: string;
      created_at: string;
      expires_at: string;
      files: unknown[];
      operation: string;
      mutation_class: string;
    };
    changed_files: unknown[];
    next_actions: unknown[];
  };
};

type ApplyEnvelope = {
  data: {
    repo_root: string;
    preview_token: string;
    applied_files: unknown[];
    status: string;
    next_actions: unknown[];
  };
};

type VerificationPlanEnvelope = {
  data: {
    repo_root: string;
    status: string;
    summary: string;
    planned_commands: Array<{ display: string; execution: string }>;
    static_feedback?: unknown;
  };
};

type StdioSession = {
  call: (message: { id: number } & Record<string, unknown>) => Promise<StdioMessage>;
  notify: (message: Record<string, unknown>) => void;
  close: () => Promise<void>;
};

async function createStdioSession(
  repoRoot: string,
  options: { startGraphWarmup?: boolean } = {}
): Promise<StdioSession> {
  const input = new PassThrough();
  const output = new PassThrough();
  const transport = new StdioServerTransport(input, output);
  const server = createAgentWorkbenchServer(path.resolve(repoRoot), {
    startGraphWarmup: options.startGraphWarmup
  });
  let stdout = "";
  const pendingCalls = new Map<number, { resolve: (message: StdioMessage) => void; reject: (error: Error) => void }>();

  output.setEncoding("utf8");
  output.on("data", (chunk: string) => {
    stdout += chunk;
    const lines = stdout.split("\n");
    stdout = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const parsed = JSON.parse(line) as StdioMessage;
      const id = parsed.id;
      if (typeof id !== "number") {
        continue;
      }
      const matcher = pendingCalls.get(id);
      if (matcher) {
        pendingCalls.delete(id);
        matcher.resolve(parsed);
      }
    }
  });

  await server.connect(transport);

  const call = (message: { id: number } & Record<string, unknown>): Promise<StdioMessage> => {
    const id = message.id;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingCalls.delete(id);
        reject(new Error(`Timed out waiting for MCP response id=${id}: ${JSON.stringify(message)}`));
      }, 4000);
      pendingCalls.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject
      });
      input.write(`${JSON.stringify(message)}\n`);
    });
  };

  return {
    call,
    notify(message: Record<string, unknown>) {
      input.write(`${JSON.stringify(message)}\n`);
    },
    async close() {
      input.end();
      await transport.close();
      for (const waiter of pendingCalls.values()) {
        waiter.reject(new Error("MCP session closed before response"));
      }
      pendingCalls.clear();
      expect(stdout).toBe("");
      return Promise.resolve();
    }
  };
}

async function runStdioSmoke(repoRoot: string, inputMessages: unknown[]): Promise<StdioMessage[]> {
  const session = await createStdioSession(repoRoot);
  try {
    const responses: StdioMessage[] = [];
    for (const message of inputMessages) {
      if (hasMessageId(message)) {
        responses.push(await session.call(message));
      } else {
        session.notify(message as Record<string, unknown>);
      }
    }
    return responses;
  } finally {
    await session.close();
  }
}

function hasMessageId(message: unknown): message is { id: number } & Record<string, unknown> {
  return (
    typeof message === "object" &&
    message !== null &&
    "id" in message &&
    typeof (message as { id?: unknown }).id === "number"
  );
}

function messageWithId(messages: StdioMessage[], id: number): StdioMessage {
  const message = messages.find((entry) => entry.id === id);
  if (!message) {
    throw new Error(`Missing MCP response for id=${id}`);
  }
  return message;
}

function parseResponseEnvelope<T extends object>(message: StdioMessage): T {
  if (message.result?.content?.[0]?.text !== undefined) {
    return JSON.parse(message.result.content[0].text) as T;
  }
  if (message.result?.contents?.[0]?.text !== undefined) {
    return JSON.parse(message.result.contents[0].text) as T;
  }
  if (message.result?.resources !== undefined) {
    return {
      resources: message.result.resources
    } as T;
  }
  if (message.result?.tools !== undefined) {
    return {
      tools: message.result.tools
    } as T;
  }
  throw new Error("Unable to parse MCP response envelope");
}

async function waitForWarmSymbolSearch(
  session: StdioSession,
  query: string
): Promise<SymbolSearchEnvelope> {
  let lastEnvelope: SymbolSearchEnvelope | undefined;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const envelope = parseResponseEnvelope<SymbolSearchEnvelope>(
      await session.call({
        jsonrpc: "2.0",
        id: 50 + attempt,
        method: "tools/call",
        params: {
          name: "symbol_search",
          arguments: {
            query
          }
        }
      })
    );
    lastEnvelope = envelope;
    if (envelope.data.symbols.length > 0) {
      return envelope;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Graph warmup did not expose symbol_search results: ${JSON.stringify(lastEnvelope)}`);
}

async function buildPresenterGoldens(input: {
  fixtureRoot: string;
  now: Date;
  edits: Array<{ path: string; replacement_text: string }>;
}): Promise<PresenterGoldens> {
  const { fixtureRoot, now, edits } = input;
  const scanner = new FileCatalogScannerAdapter();
  const workspace = new WorkspaceFileAdapter({ repoRoot: fixtureRoot });
  const safety = new WorkspaceSafetyAdapter({ repoRoot: fixtureRoot });
  const graphStore = openGraphStore(graphStorePath(fixtureRoot));
  const previews = new InMemoryEditPreviewStoreAdapter();
  const clock = {
    now: () => now,
    nowIso8601: () => now.toISOString(),
    nowUnixMs: () => now.getTime()
  };

  try {
    const statusResult = await getScannedRepoStatus({
      repo_root: fixtureRoot,
      scanner
    });
    const scopeResult = await getRepoScope({
      repo_root: fixtureRoot,
      scanner
    });
    const overviewResult = await getRepoOverview({
      repo_root: fixtureRoot,
      scanner
    });
    const contextResult = await getTaskContext({
      request: {
        task: "Update package validation",
        files: ["package.json"],
        symbols: [],
        max_files: 10,
        max_docs: 5
      },
      scanner,
      graph: graphStore,
      snapshots: graphStore,
      catalog: graphStore,
      workspace,
      default_repo_root: fixtureRoot
    });
    const symbolSearchResult = await searchSymbols({
      request: {
        query: "Runner",
        exact: false,
        languages: [],
        max_results: 20,
        source_byte_limit: 0
      },
      graph: graphStore,
      snapshots: graphStore,
      catalog: graphStore,
      workspace,
      default_repo_root: fixtureRoot
    });
    const findReferencesResult = await findReferences({
      request: {
        symbol: "Runner",
        max_depth: 1,
        max_results: 50
      },
      graph: graphStore,
      snapshots: graphStore,
      catalog: graphStore,
      workspace,
      default_repo_root: fixtureRoot
    });
    const impactResult = await computeImpact({
      request: {
        node_id: "symbol-1",
        max_depth: 2,
        max_nodes: 50,
        direction: "both"
      },
      graph: graphStore,
      snapshots: graphStore,
      catalog: graphStore,
      workspace,
      default_repo_root: fixtureRoot
    });
    const verificationResult = await planVerification({
      request: {
        files: ["package.json"],
        changed_files: ["package.json"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner,
      workspace,
      default_repo_root: fixtureRoot
    });

    return {
      status: buildStatusEnvelope(statusResult),
      scope: buildRepoScopeEnvelope(scopeResult),
      overview: buildRepoOverviewEnvelope(overviewResult),
      context: buildTaskContextEnvelope(contextResult),
      symbolSearch: buildSymbolSearchEnvelope(symbolSearchResult),
      findReferences: buildFindReferencesEnvelope(findReferencesResult),
      impact: buildImpactEnvelope(impactResult),
      verificationPlan: buildVerificationPlanEnvelope(verificationResult),
      preview: buildPreviewWorkspaceEditEnvelope(await previewWorkspaceEdit({
        request: {
          edits,
          expires_in_ms: 600_000
        },
        workspace,
        safety,
        previews,
        clock,
        default_repo_root: fixtureRoot
      }))
    };
  } finally {
    graphStore.close();
  }
}

type ApplyGoldenInput = {
  fixtureRoot: string;
  previewToken: string;
  preview: {
    preview_token: string;
    created_at: string;
    expires_at: string;
  };
  edits: Array<{ path: string; replacement_text: string }>;
  now: Date;
  nowUnixMs: number;
};

async function buildExpectedApplyEnvelope(input: ApplyGoldenInput): Promise<ReturnType<typeof buildApplyWorkspaceEditEnvelope>> {
  const { fixtureRoot, previewToken, preview, edits, now, nowUnixMs } = input;
  const workspace = new WorkspaceFileAdapter({ repoRoot: fixtureRoot });
  const safety = new WorkspaceSafetyAdapter({ repoRoot: fixtureRoot });
  const previews = new InMemoryEditPreviewStoreAdapter();
  const fileData = await Promise.all(
    edits.map(async (edit) => {
      const before = await workspace.readText({ path: edit.path });
      return {
        path: edit.path,
        base_hash: sha256Text(before),
        after_hash: sha256Text(edit.replacement_text),
        change_count: before === edit.replacement_text ? 0 : 1
      };
    })
  );

  await previews.put({
    preview: {
      preview_token: previewToken,
      created_at: preview.created_at,
      expires_at: preview.expires_at,
      files: fileData,
      operation: "bounded_text_edit",
      mutation_class: "workspace_write"
    }
  });

  const applyResult = await applyWorkspaceEdit({
    request: {
      preview_token: previewToken,
      edits
    },
    workspace,
    safety,
    previews,
    clock: {
      now: () => now,
      nowIso8601: () => now.toISOString(),
      nowUnixMs: () => nowUnixMs
    },
    default_repo_root: fixtureRoot
  });
  return buildApplyWorkspaceEditEnvelope(applyResult);
}

async function buildExpectedVerificationPlanEnvelope(input: { fixtureRoot: string }): Promise<ReturnType<typeof buildVerificationPlanEnvelope>> {
  const { fixtureRoot } = input;
  const scanner = new FileCatalogScannerAdapter();
  const workspace = new WorkspaceFileAdapter({ repoRoot: fixtureRoot });

  const verificationPlan = await planVerification({
    request: {
      files: ["package.json"],
      changed_files: ["package.json"],
      include_static_feedback: true,
      max_commands: 10
    },
    scanner,
    workspace,
    default_repo_root: fixtureRoot
  });

  return buildVerificationPlanEnvelope(verificationPlan);
}

function graphStorePath(repoRoot: string): string {
  const cacheDir = path.join(repoRoot, ".cache", "agent-workbench");
  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, "graph.sqlite");
}

function normalizeFixturePaths<T>(value: T, sourceRoot: string, targetRoot: string): T {
  if (typeof value === "string") {
    if (value === sourceRoot) {
      return targetRoot as T;
    }
    if (value.startsWith(`${sourceRoot}/`)) {
      return value.replace(sourceRoot, targetRoot) as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFixturePaths(item, sourceRoot, targetRoot)) as T;
  }
  if (value instanceof Date) {
    return value as T;
  }
  if (value !== null && typeof value === "object") {
    const next = Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        const normalizedValue = normalizeFixturePaths(item, sourceRoot, targetRoot);
        return normalizedValue === undefined ? [] : [[key, normalizedValue]];
      })
    );
    return next as T;
  }
  return value;
}

function createFixtureCopy(prefix: string): string {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.cpSync(
    path.resolve("tests/fixtures/fixture-mixed-language-platform"),
    destination,
    { recursive: true }
  );
  return destination;
}

function createCleanFixtureCopy(input: { prefix: string; sourceRoot: string }): string {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), input.prefix));
  fs.cpSync(input.sourceRoot, destination, {
    recursive: true,
    filter: (source) => path.basename(source) !== ".cache" && path.basename(source) !== "__pycache__"
  });
  return destination;
}
