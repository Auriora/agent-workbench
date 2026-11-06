/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { getIntegrationHealth } from "../../src/application/use-cases/get-integration-health.js";

describe("daemon lifetime health evidence", () => {
  it("marks unavailable lifetime evidence as blocked without changing freshness", async () => {
    const result = await getIntegrationHealth({
      request: {
        repo_root: "/repo",
        discovery_state: "unknown",
        discovered_tools: [],
        discovered_resources: [],
        discovered_prompts: []
      },
      default_repo_root: "/repo",
      runtime_version: "0.1.0",
      profile: "unknown",
      surfaces: [],
      daemon: {
        pid: 42,
        socket_path: "/tmp/daemon.sock",
        repo_root: "/repo",
        connected_clients: 0,
        lifetime_evidence: {
          status: "unavailable",
          reason: "store_unreadable"
        },
        diagnostics: {
          async getDiagnostics() {
            return {
              repo_identity: "/repo",
              controller_generation: 1,
              diagnostic_revision: 0,
              worker_invocations: 0,
              execution_state: "idle" as const,
              graph_freshness: "cold" as const,
              activity_lease_held: false,
              worker_termination_state: "not_required" as const
            };
          }
        }
      }
    });

    expect(result.health.daemon_lifetime_evidence).toEqual({
      status: "unavailable",
      reason: "store_unreadable"
    });
    expect(result.meta.freshness).toBe("cold");
    expect(result.meta.verification_status).toBe("blocked");
  });

  it("retains lifetime evidence when refresh diagnostics are unavailable", async () => {
    const result = await getIntegrationHealth({
      request: {
        repo_root: "/repo",
        discovery_state: "unknown",
        discovered_tools: [],
        discovered_resources: [],
        discovered_prompts: []
      },
      default_repo_root: "/repo",
      runtime_version: "0.1.0",
      profile: "unknown",
      surfaces: [],
      daemon: {
        pid: 42,
        socket_path: "/tmp/daemon.sock",
        repo_root: "/repo",
        connected_clients: 0,
        lifetime_evidence: {
          status: "available",
          current: {
            daemon_id: "daemon",
            launch_token: "launch",
            pid: 42,
            runtime_version: "0.1.0",
            started_at: "2026-11-06T10:00:00.000Z",
            timestamp: "2026-11-06T10:00:00.000Z",
            phase: "ready",
            reason: "admitted"
          }
        },
        diagnostics: {
          async getDiagnostics() {
            throw new Error("refresh diagnostics unavailable");
          }
        }
      }
    });

    expect(result.health.daemon_lifetime_evidence?.status).toBe("available");
    expect(result.health.daemon).toBeUndefined();
    expect(result.meta.verification_status).toBe("blocked");
  });
});
