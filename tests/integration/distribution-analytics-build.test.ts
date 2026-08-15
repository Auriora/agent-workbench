/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
// @ts-expect-error -- ESM .mjs helper imported into the TS test via esbuild.
import * as distributionConfig from "../../scripts/distribution-analytics-config.mjs";

const {
  DISTRIBUTION_ANALYTICS_ENABLED_DEFINE,
  DISTRIBUTION_POSTHOG_TOKEN_DEFINE,
  distributionAnalyticsDefines
} = distributionConfig;

describe("distribution analytics build configuration", () => {
  it("keeps ordinary source and development builds analytics-disabled", () => {
    expect(distributionAnalyticsDefines({})).toEqual({
      [DISTRIBUTION_ANALYTICS_ENABLED_DEFINE]: "false",
      [DISTRIBUTION_POSTHOG_TOKEN_DEFINE]: JSON.stringify("")
    });
  });

  it("injects configured release defaults without transforming the token", () => {
    expect(distributionAnalyticsDefines({
      AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED: "true",
      AGENT_WORKBENCH_DISTRIBUTION_POSTHOG_PROJECT_TOKEN: "  phc_release_test  "
    })).toEqual({
      [DISTRIBUTION_ANALYTICS_ENABLED_DEFINE]: "true",
      [DISTRIBUTION_POSTHOG_TOKEN_DEFINE]: JSON.stringify("phc_release_test")
    });
  });

  it("fails a selected release build when its token is absent", () => {
    expect(() => distributionAnalyticsDefines({
      AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED: "true"
    })).toThrow("Distribution analytics was enabled without");
  });

  it("rejects ambiguous build enablement values", () => {
    expect(() => distributionAnalyticsDefines({
      AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED: "yes"
    })).toThrow("must be true, false, 1, or 0");
  });

  it("configures every official release bundle build with the governed secret", () => {
    const workflow = YAML.parse(fs.readFileSync(
      path.resolve(".github/workflows/release.yml"),
      "utf8"
    )) as {
      jobs: {
        package: {
          steps: Array<{ name?: string; env?: Record<string, string> }>;
        };
      };
    };
    const expected = {
      AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED: "true",
      AGENT_WORKBENCH_DISTRIBUTION_POSTHOG_PROJECT_TOKEN: "${{ secrets.POSTHOG_PROJECT_TOKEN }}"
    };
    for (const name of ["Build runtime", "Validate npm package payload", "Build release tarball"]) {
      const step = workflow.jobs.package.steps.find((candidate) => candidate.name === name);
      expect(step?.env).toMatchObject(expected);
    }

    const windowsWorkflow = YAML.parse(fs.readFileSync(
      path.resolve(".github/workflows/windows-portable-preflight.yml"),
      "utf8"
    )) as {
      on: {
        workflow_call: {
          secrets: Record<string, { required: boolean }>;
        };
      };
      jobs: {
        "windows-portable-preflight": {
          steps: Array<{ name?: string; if?: string; env?: Record<string, string> }>;
        };
      };
    };
    expect(windowsWorkflow.on.workflow_call.secrets.POSTHOG_PROJECT_TOKEN.required).toBe(false);
    const windowsBuild = windowsWorkflow.jobs["windows-portable-preflight"].steps.find(
      (candidate) => candidate.name === "Build configured Windows release runtime"
    );
    expect(windowsBuild).toMatchObject({
      if: "${{ inputs.source_inputs_artifact != '' }}",
      env: expected
    });

    const releaseWindowsJob = (workflow as unknown as {
      jobs: {
        "windows-portable-preflight": { secrets?: Record<string, string> };
      };
    }).jobs["windows-portable-preflight"];
    expect(releaseWindowsJob.secrets).toEqual({
      POSTHOG_PROJECT_TOKEN: "${{ secrets.POSTHOG_PROJECT_TOKEN }}"
    });
  });
});
