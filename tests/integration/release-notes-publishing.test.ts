/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

// @ts-expect-error -- ESM .mjs helper imported into the TS test via esbuild.
import { renderGitHubReleaseNotes } from "../../scripts/ci/render-github-release-notes.mjs";

const pinnedActions = {
  attest: "actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6",
  checkout: "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  downloadArtifact: "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
  setupNode: "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  setupPython: "actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065",
  uploadArtifact: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
  dockerBuildPush: "docker/build-push-action@10e90e3645eae34f1e60eeb005ba3a3d33f178e8",
  dockerLogin: "docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9",
  dockerMetadata: "docker/metadata-action@c299e40c65443455700f0fdfc63efafe5b349051",
  dockerSetupBuildx: "docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f"
} as const;

type WorkflowJob = {
  needs?: string | string[];
  outputs?: Record<string, string>;
  permissions?: Record<string, string>;
  "runs-on"?: string;
  steps?: Array<{
    env?: Record<string, string>;
    name?: string;
    run?: string;
    shell?: string;
    uses?: string;
    with?: Record<string, string | boolean>;
  }>;
  uses?: string;
  with?: Record<string, string | boolean>;
};

function parseWorkflow(filePath: string) {
  return YAML.parse(fs.readFileSync(filePath, "utf8")) as {
    jobs: Record<string, WorkflowJob>;
    on?: Record<string, unknown>;
  };
}

function workflowJobNeeds(job: WorkflowJob | undefined) {
  expect(job, "workflow job missing").toBeDefined();
  if (!job?.needs) return [];
  return Array.isArray(job.needs) ? job.needs : [job.needs];
}

function workflowStep(job: WorkflowJob | undefined, name: string) {
  expect(job, "workflow job missing").toBeDefined();
  const step = job?.steps?.find((candidate) => candidate.name === name);
  expect(step, `${name} step missing`).toBeDefined();
  return step!;
}

describe("GitHub release-note publishing", () => {
  it("removes only leading YAML frontmatter and preserves the Markdown body", () => {
    const body = "# Agent Workbench v0.6.2\n\n---\n\nBody with `code`.\n";
    const source = [
      "---",
      "title: Agent Workbench v0.6.2 release notes",
      "status: published",
      "---",
      body
    ].join("\n");

    expect(renderGitHubReleaseNotes(source)).toBe(body);
  });

  it("leaves a document without leading frontmatter byte-for-byte unchanged", () => {
    const source = "# Release\r\n\r\nBody\r\n---\r\nFooter\r\n";

    expect(renderGitHubReleaseNotes(source)).toBe(source);
  });

  it.each([
    ["unclosed", "---\ntitle: Release\n# Body", /not closed/],
    ["invalid YAML", "---\ntitle: [release\n---\n# Body\n", /malformed/],
    ["non-mapping YAML", "---\nrelease\n---\n# Body\n", /YAML mapping/]
  ])("rejects %s leading frontmatter", (_case, source, expected) => {
    expect(() => renderGitHubReleaseNotes(source)).toThrow(expected);
  });

  it("keeps public release publication behind package, reusable Windows preflight, attestation, and GHCR gates", () => {
    const releaseWorkflowPath = path.resolve(".github/workflows/release.yml");
    const ghcrWorkflowPath = path.resolve(".github/workflows/release-ghcr.yml");
    const windowsWorkflowPath = path.resolve(".github/workflows/windows-portable-preflight.yml");
    const releaseWorkflow = parseWorkflow(releaseWorkflowPath);
    const ghcrWorkflow = parseWorkflow(ghcrWorkflowPath);
    const windowsWorkflow = parseWorkflow(windowsWorkflowPath);
    const releaseWorkflowText = fs.readFileSync(releaseWorkflowPath, "utf8");
    const ghcrWorkflowText = fs.readFileSync(ghcrWorkflowPath, "utf8");
    const windowsWorkflowText = fs.readFileSync(windowsWorkflowPath, "utf8");

    const packageJob = releaseWorkflow.jobs.package;
    const windowsPreflightJob = releaseWorkflow.jobs["windows-portable-preflight"];
    const publishGhcrJob = releaseWorkflow.jobs["publish-ghcr"];
    const publishReleaseJob = releaseWorkflow.jobs["publish-release"];
    const windowsPreflightImpl = windowsWorkflow.jobs["windows-portable-preflight"];
    const ghcrJob = ghcrWorkflow.jobs.ghcr;

    expect(releaseWorkflow.jobs["build-windows-portable"]).toBeUndefined();
    expect(releaseWorkflow.jobs["smoke-windows-portable"]).toBeUndefined();

    expect(packageJob?.["runs-on"]).toBe("ubuntu-latest");
    expect(windowsPreflightImpl?.["runs-on"]).toBe("windows-2022");
    expect(publishReleaseJob?.["runs-on"]).toBe("ubuntu-latest");
    expect(ghcrJob?.["runs-on"]).toBe("ubuntu-latest");

    expect(workflowJobNeeds(windowsPreflightJob)).toEqual(["package"]);
    expect(workflowJobNeeds(publishGhcrJob)).toEqual(["package", "windows-portable-preflight"]);
    expect(workflowJobNeeds(publishReleaseJob)).toEqual([
      "package",
      "windows-portable-preflight",
      "publish-ghcr"
    ]);

    expect(windowsPreflightJob?.uses).toBe("./.github/workflows/windows-portable-preflight.yml");
    expect(windowsPreflightJob?.with).toMatchObject({
      ref: "${{ needs.package.outputs.release_git_sha }}",
      release_version: "${{ needs.package.outputs.release_version }}",
      release_git_sha: "${{ needs.package.outputs.release_git_sha }}",
      source_inputs_artifact: "release-source-inputs"
    });

    expect(publishGhcrJob?.uses).toBe("./.github/workflows/release-ghcr.yml");
    expect(publishGhcrJob?.with).toMatchObject({
      git_sha: "${{ needs.package.outputs.release_git_sha }}",
      version: "${{ needs.package.outputs.release_version }}",
      publish_latest: "${{ needs.package.outputs.publish_latest == 'true' }}"
    });

    expect(packageJob?.steps?.[0]).toMatchObject({
      uses: pinnedActions.checkout
    });
    expect(packageJob?.steps?.[1]).toMatchObject({
      uses: pinnedActions.setupNode,
      with: { "node-version": "24" }
    });
    expect(packageJob?.steps?.[2]).toMatchObject({
      uses: pinnedActions.setupPython,
      with: { "python-version": "3.12" }
    });

    const packageToolchain = workflowStep(packageJob, "Verify release toolchain identities");
    expect(packageToolchain.run).toContain('pnpm_version="$(pnpm --version)"');
    expect(packageToolchain.run).toContain('gh --version | sed -n \'1p\'');
    const refuseExistingRelease = workflowStep(packageJob, "Refuse an existing public release");
    expect(refuseExistingRelease.env).toMatchObject({
      TAG: "${{ steps.release.outputs.tag }}"
    });
    expect(refuseExistingRelease.run).toContain('if gh release view "${TAG}" >/dev/null 2>&1; then');
    expect(refuseExistingRelease.run).toContain("publish a new corrective version instead of rerunning it");

    const releaseTypecheck = releaseWorkflowText.indexOf("pnpm typecheck");
    const releaseBuild = releaseWorkflowText.indexOf("pnpm build-runtime");
    const releaseContracts = releaseWorkflowText.indexOf("pnpm check:contracts");
    const releaseDevCliTest = releaseWorkflowText.indexOf("pnpm test:devcli");
    const releaseTest = releaseWorkflowText.indexOf("pnpm test\n");
    const releaseValidate = releaseWorkflowText.indexOf("pnpm run validate:plugin");
    expect(releaseTypecheck).toBeGreaterThan(-1);
    expect(releaseBuild).toBeGreaterThan(-1);
    expect(releaseContracts).toBeGreaterThan(-1);
    expect(releaseDevCliTest).toBeGreaterThan(-1);
    expect(releaseTest).toBeGreaterThan(-1);
    expect(releaseValidate).toBeGreaterThan(-1);
    expect(releaseTypecheck).toBeLessThan(releaseBuild);
    expect(releaseBuild).toBeLessThan(releaseContracts);
    expect(releaseContracts).toBeLessThan(releaseDevCliTest);
    expect(releaseBuild).toBeLessThan(releaseTest);
    expect(releaseBuild).toBeLessThan(releaseValidate);

    const stageSourceInputs = workflowStep(packageJob, "Stage release source inputs");
    expect(stageSourceInputs.env?.SOURCE_INPUTS_DIR).toBe("${{ runner.temp }}/release-source-inputs");
    expect(stageSourceInputs.run).toContain('cp "${RELEASE_TARBALL}" "${SOURCE_INPUTS_DIR}/"');
    expect(stageSourceInputs.run).toContain('cp "${GITHUB_RELEASE_NOTES}" "${SOURCE_INPUTS_DIR}/"');

    const uploadSourceInputs = workflowStep(packageJob, "Upload release source inputs");
    expect(uploadSourceInputs).toMatchObject({
      uses: pinnedActions.uploadArtifact,
      with: {
        name: "release-source-inputs",
        path: "${{ runner.temp }}/release-source-inputs/*",
        "if-no-files-found": "error"
      }
    });
    expect(packageJob?.steps?.some((step) => step.name === "Publish GitHub release")).toBe(false);

    expect(packageJob?.outputs).toMatchObject({
      release_tag: "${{ steps.release.outputs.tag }}",
      release_version: "${{ steps.release.outputs.version }}",
      release_git_sha: "${{ steps.release.outputs.git_sha }}",
      release_tarball: "${{ steps.release.outputs.tarball }}",
      publish_latest: "${{ steps.release.outputs.publish_latest }}"
    });

    expect(windowsWorkflowText).toContain("pull_request:");
    expect(windowsWorkflowText).toContain("workflow_dispatch:");
    expect(windowsWorkflowText).toContain("workflow_call:");
    expect(windowsPreflightImpl?.steps?.[0]).toMatchObject({
      uses: pinnedActions.checkout,
      with: { ref: "${{ inputs.ref || github.event.pull_request.head.sha || github.sha }}" }
    });
    expect(windowsPreflightImpl?.steps?.[1]).toMatchObject({
      uses: pinnedActions.setupNode,
      with: { "node-version": "22.23.1" }
    });

    const windowsToolchain = workflowStep(windowsPreflightImpl, "Verify Windows portable toolchain identities");
    expect(windowsToolchain.shell).toBe("pwsh");
    expect(windowsToolchain.run).toContain('if ($nodeVersion -ne "v22.23.1")');
    expect(windowsToolchain.run).toContain('Write-Host "pnpm=$(pnpm --version)"');

    const downloadStagedSourceInputs = workflowStep(
      windowsPreflightImpl,
      "Download staged release source inputs"
    );
    expect(downloadStagedSourceInputs).toMatchObject({
      uses: pinnedActions.downloadArtifact
    });

    const installWindowsDependencies = workflowStep(
      windowsPreflightImpl,
      "Install locked Windows dependencies"
    );
    expect(installWindowsDependencies.run).toBe("pnpm install --frozen-lockfile");
    expect(installWindowsDependencies).not.toHaveProperty("if");
    expect(installWindowsDependencies.env).toMatchObject({
      CXXFLAGS: "-std=c++20",
      _CL_: "/std:c++20"
    });

    const stageWorkspaceSourceInputs = workflowStep(
      windowsPreflightImpl,
      "Stage workspace release source inputs"
    );
    expect(stageWorkspaceSourceInputs.run).toContain("pnpm build-runtime");
    expect(stageWorkspaceSourceInputs.run).toContain("npm pack --ignore-scripts --json");
    expect(stageWorkspaceSourceInputs.run).toContain("npm pack did not return exactly one filename");
    expect(stageWorkspaceSourceInputs.run).toContain("process.stdout.write(result[0].filename)");
    expect(stageWorkspaceSourceInputs.run).toContain('mv "${tarball}" "${SOURCE_INPUTS_DIR}/${tarball}"');

    const verifyStagedSourceInputs = workflowStep(
      windowsPreflightImpl,
      "Verify staged release source inputs"
    );
    expect(verifyStagedSourceInputs.run).toContain('test -f "${SOURCE_INPUTS_DIR}/${RELEASE_TARBALL_NAME}"');
    expect(verifyStagedSourceInputs.run).toContain(
      'test -f "${SOURCE_INPUTS_DIR}/agent-workbench-github-release-notes.md"'
    );

    const deployRuntime = workflowStep(
      windowsPreflightImpl,
      "Deploy production runtime for Windows portable build"
    );
    expect(deployRuntime.shell).toBe("pwsh");
    expect(deployRuntime.run).toContain("$env:HOME = $stateDir");
    expect(deployRuntime.run).toContain("$env:USERPROFILE = $stateDir");
    expect(deployRuntime.run).toContain('$env:LOCALAPPDATA = Join-Path $stateDir "AppData\\\\Local"');
    expect(deployRuntime.run).toContain("pnpm --filter . deploy --prod $env:DEPLOYMENT_DIR");

    const buildCandidate = workflowStep(windowsPreflightImpl, "Build Windows portable candidate");
    expect(buildCandidate.shell).toBe("pwsh");
    expect(buildCandidate.run).toContain("node scripts/ci/build-windows-portable.mjs");
    expect(buildCandidate.run).toContain("--package $tarballPath");
    expect(buildCandidate.run).toContain("--deployment $env:DEPLOYMENT_DIR");
    expect(buildCandidate.run).toContain("--lockfile pnpm-lock.yaml");
    expect(buildCandidate.run).toContain("--git-sha $env:RELEASE_GIT_SHA");
    expect(buildCandidate.run).toContain('Set-Content -Path "${zipPath}.sha256"');
    expect(buildCandidate.run).not.toContain("-NoNewline");
    expect(buildCandidate.run).not.toContain("npm install --prefix");

    const smokeCandidate = workflowStep(windowsPreflightImpl, "Smoke Windows portable candidate");
    expect(smokeCandidate.shell).toBe("pwsh");
    expect(smokeCandidate.run).toContain(
      '& (Join-Path $bundleRoot "node.exe") scripts/ci/windows-portable-smoke.mjs'
    );
    expect(smokeCandidate.run).toContain('$bundleRoot = Join-Path $env:EXTRACT_ROOT $env:BUNDLE_DIR');
    expect(smokeCandidate.run).toContain('Expand-Archive -Path (Join-Path $env:CANDIDATE_DIR $env:ZIP_NAME) -DestinationPath $env:EXTRACT_ROOT');
    expect(smokeCandidate.run).toContain('--expected-version "${env:RELEASE_VERSION}"');
    expect(smokeCandidate.run).toContain('--git-sha "${env:RELEASE_GIT_SHA}"');
    expect(smokeCandidate.run).not.toContain("npm ");
    expect(smokeCandidate.run).not.toContain("pnpm ");
    expect(smokeCandidate.run).not.toContain("build-windows-portable.mjs");

    const uploadCandidate = workflowStep(windowsPreflightImpl, "Upload Windows portable candidate");
    expect(uploadCandidate).toMatchObject({
      uses: pinnedActions.uploadArtifact,
      with: {
        name: "windows-portable-candidate",
        path: "${{ steps.release.outputs.candidate_dir }}/*",
        "if-no-files-found": "error"
      }
    });

    expect(publishReleaseJob?.permissions).toEqual({
      contents: "write",
      attestations: "write",
      "artifact-metadata": "write",
      "id-token": "write"
    });
    expect(publishReleaseJob?.steps?.[0]).toMatchObject({
      uses: pinnedActions.checkout,
      with: { ref: "${{ needs.package.outputs.release_git_sha }}" }
    });

    const verifyCandidateChecksum = workflowStep(publishReleaseJob, "Verify Windows portable candidate checksum");
    expect(verifyCandidateChecksum.env).toMatchObject({
      WINDOWS_ZIP:
        "windows-portable-candidate/agent-workbench-v${{ needs.package.outputs.release_version }}-windows-x64.zip",
      WINDOWS_SHA256:
        "windows-portable-candidate/agent-workbench-v${{ needs.package.outputs.release_version }}-windows-x64.zip.sha256"
    });
    expect(verifyCandidateChecksum.run).toContain('actual="$(sha256sum "${WINDOWS_ZIP}" | awk \'{print $1}\')"');
    expect(verifyCandidateChecksum.run).toContain('expected="$(awk \'{print $1}\' "${WINDOWS_SHA256}")"');
    expect(verifyCandidateChecksum.run).toContain('Windows portable checksum mismatch for ${WINDOWS_ZIP}');

    const attestStep = workflowStep(publishReleaseJob, "Attest Windows portable candidate");
    expect(attestStep).toMatchObject({
      uses: pinnedActions.attest,
      with: {
        "subject-path":
          "windows-portable-candidate/agent-workbench-v${{ needs.package.outputs.release_version }}-windows-x64.zip"
      }
    });

    const publishRelease = workflowStep(publishReleaseJob, "Publish GitHub release");
    expect(publishRelease.env).toMatchObject({
      TAG: "${{ needs.package.outputs.release_tag }}",
      GITHUB_RELEASE_NOTES: "release-source-inputs/agent-workbench-github-release-notes.md",
      TARBALL: "release-source-inputs/${{ needs.package.outputs.release_tarball }}",
      WINDOWS_ZIP:
        "windows-portable-candidate/agent-workbench-v${{ needs.package.outputs.release_version }}-windows-x64.zip",
      WINDOWS_SHA256:
        "windows-portable-candidate/agent-workbench-v${{ needs.package.outputs.release_version }}-windows-x64.zip.sha256"
    });
    expect(publishRelease.run).toContain('if gh release view "${TAG}" >/dev/null 2>&1; then');
    expect(publishRelease.run).toContain('read -r expected_windows_sha expected_windows_name < "${WINDOWS_SHA256}"');
    expect(publishRelease.run).toContain('actual_windows_sha="$(sha256sum "${WINDOWS_ZIP}" | awk \'{print $1}\')"');
    expect(publishRelease.run).toContain("Windows portable checksum sidecar does not match the staged ZIP.");
    expect(publishRelease.run).toContain(
      'GitHub release ${TAG} already exists; publish a new corrective version instead of mutating it.'
    );
    expect(publishRelease.run).toContain("exit 1");
    expect(publishRelease.run).toContain(
      'gh release create "${TAG}" "${asset_paths[@]}" --title "${TAG}" --notes-file "${GITHUB_RELEASE_NOTES}"'
    );
    expect(publishRelease.run).not.toContain("--clobber");
    expect(publishRelease.run).not.toContain("gh release edit");
    expect(publishRelease.run).not.toContain("gh release upload");
    expect(publishRelease.run).not.toContain("gh release download");
    expect(releaseWorkflowText).not.toContain("actions/attest-build-provenance@");

    expect(ghcrWorkflowText).toContain("workflow_call:");
    expect(ghcrWorkflowText).not.toContain("workflow_dispatch:");
    expect(ghcrJob?.steps?.[1]).toMatchObject({
      uses: pinnedActions.checkout,
      with: { ref: "${{ inputs.git_sha }}" }
    });
    expect(workflowStep(ghcrJob, "Validate release git SHA input").run).toContain(
      'if [[ ! "${RELEASE_GIT_SHA}" =~ ^[0-9a-f]{40}$ ]]; then'
    );
    expect(workflowStep(ghcrJob, "Verify checked-out release identity").run).toContain(
      'checked_out_sha="$(git rev-parse HEAD)"'
    );
    expect(workflowStep(ghcrJob, "Verify GHCR toolchain identities").run).toContain("docker buildx version");
    expect(ghcrJob?.steps?.some((step) => step.uses === pinnedActions.dockerSetupBuildx)).toBe(true);
    expect(ghcrJob?.steps?.some((step) => step.uses === pinnedActions.dockerLogin)).toBe(true);
    expect(ghcrJob?.steps?.some((step) => step.uses === pinnedActions.dockerMetadata)).toBe(true);
    expect(ghcrJob?.steps?.some((step) => step.uses === pinnedActions.dockerBuildPush)).toBe(true);
    expect(ghcrWorkflowText).toContain("type=raw,value=${{ inputs.version }}");
    expect(ghcrWorkflowText).toContain("type=raw,value=latest,enable=${{ inputs.publish_latest }}");
    expect(ghcrWorkflowText).toContain("org.opencontainers.image.revision=${{ inputs.git_sha }}");

    expect(releaseWorkflowText).toContain(
      'node scripts/ci/render-github-release-notes.mjs "${NOTES}" "${GITHUB_RELEASE_NOTES}"'
    );
    expect(releaseWorkflowText).not.toContain('--notes-file "${NOTES}"');
  });
});
