import type { AdapterEvidence, AdapterDomain, CapabilityLevel, EvidenceKind } from "../../contracts/index.js";
import type { FileCatalogEntry, FileIdentity } from "../models/index.js";

type FileCapabilityInput = {
  path: string;
  language: string;
  indexed?: boolean;
};

const partialSemanticLanguages = new Set(["python"]);
const resourceBackedLanguageNames = new Set(["c", "cpp", "csharp", "go", "javascript", "typescript"]);
const unsupportedLanguageNames = new Set([
  "java",
  "rust"
]);
const configLanguages = new Set(["config", "json", "toml", "yaml"]);
const documentationLanguages = new Set(["markdown", "text"]);

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function lowerBasename(value: string): string {
  const normalized = normalizePath(value);
  return normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
}

function extension(value: string): string {
  const filename = lowerBasename(value);
  const lastDot = filename.lastIndexOf(".");
  return lastDot <= 0 ? "" : filename.slice(lastDot);
}

function isGithubWorkflow(filePath: string): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  return normalized.includes(".github/workflows/") && (normalized.endsWith(".yml") || normalized.endsWith(".yaml"));
}

function isPackageManifest(filePath: string): boolean {
  const filename = lowerBasename(filePath);
  const ext = extension(filePath);
  return (
    filename === "package.json" ||
    filename === "pyproject.toml" ||
    filename === "go.mod" ||
    filename === "cargo.toml" ||
    ext === ".sln" ||
    ext === ".csproj" ||
    ext === ".fsproj" ||
    ext === ".vbproj"
  );
}

function packageManifestName(filePath: string): string {
  const filename = lowerBasename(filePath);
  if (filename === "package.json") {
    return "npm";
  }
  if (filename === "pyproject.toml") {
    return "python";
  }
  if (filename === "go.mod") {
    return "go";
  }
  if (filename === "cargo.toml") {
    return "cargo";
  }
  if ([".sln", ".csproj", ".fsproj", ".vbproj"].includes(extension(filePath))) {
    return "dotnet";
  }
  return "package_manager";
}

function isInfrastructureFile(filePath: string): boolean {
  const filename = lowerBasename(filePath);
  const ext = extension(filePath);
  return (
    filename === "dockerfile" ||
    filename === "docker-compose.yml" ||
    filename === "docker-compose.yaml" ||
    ext === ".tf" ||
    ext === ".tfvars" ||
    isGithubWorkflow(filePath)
  );
}

function evidence(
  input: FileCapabilityInput,
  domain: AdapterDomain,
  capabilityLevel: CapabilityLevel,
  evidenceKinds: EvidenceKind[],
  confidence: AdapterEvidence["confidence"]
): AdapterEvidence {
  return {
    domain,
    name: input.language,
    capability_level: input.indexed === false ? "unsupported" : capabilityLevel,
    evidence_kinds: input.indexed === false ? [] : evidenceKinds,
    paths: [normalizePath(input.path)],
    provenance: "file_identity",
    confidence,
    metadata: {}
  };
}

export function describeFileCapability(input: FileCapabilityInput): AdapterEvidence {
  if (isPackageManifest(input.path)) {
    return {
      ...evidence(input, "package_manager", "resource_backed", ["config"], "high"),
      name: packageManifestName(input.path)
    };
  }

  if (isInfrastructureFile(input.path)) {
    return evidence(input, "infrastructure", "resource_backed", ["config"], "high");
  }

  if (partialSemanticLanguages.has(input.language)) {
    return evidence(input, "language", "partial_semantic", ["parser"], "high");
  }

  if (resourceBackedLanguageNames.has(input.language)) {
    return evidence(input, "language", "resource_backed", ["heuristic"], "high");
  }

  if (unsupportedLanguageNames.has(input.language)) {
    return evidence(input, "language", "unsupported", [], "high");
  }

  if (configLanguages.has(input.language)) {
    return evidence(input, "config", "resource_backed", ["config"], "high");
  }

  if (documentationLanguages.has(input.language)) {
    return evidence(input, "documentation", "resource_backed", ["docs"], "medium");
  }

  return evidence(input, "language", "unsupported", [], "medium");
}

export function buildFileCatalogEntry(input: {
  file_identity: FileIdentity;
  indexed?: boolean;
  skipped_reason?: string;
}): FileCatalogEntry {
  const indexed = input.indexed ?? true;
  return {
    path: input.file_identity.path,
    file_identity: input.file_identity,
    indexed,
    skipped_reason: input.skipped_reason,
    adapter_evidence: describeFileCapability({
      path: input.file_identity.path,
      language: input.file_identity.language,
      indexed
    })
  };
}

export function summarizeAdapterEvidence(
  entries: readonly FileCatalogEntry[]
): readonly AdapterEvidence[] {
  const byKey = new Map<string, AdapterEvidence>();

  for (const entry of entries) {
    const current =
      entry.adapter_evidence ??
      describeFileCapability({
        path: entry.path,
        language: entry.file_identity.language,
        indexed: entry.indexed
      });
    const key = `${current.domain}:${current.name}:${current.capability_level}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, { ...current, paths: [...current.paths], evidence_kinds: [...current.evidence_kinds] });
      continue;
    }

    existing.paths = Array.from(new Set([...existing.paths, ...current.paths])).sort();
    const evidenceKinds = Array.from(new Set<EvidenceKind>([...existing.evidence_kinds, ...current.evidence_kinds]));
    evidenceKinds.sort();
    existing.evidence_kinds = evidenceKinds;
    existing.confidence =
      existing.confidence === "high" || current.confidence === "high"
        ? "high"
        : existing.confidence === "medium" || current.confidence === "medium"
          ? "medium"
          : "low";
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const leftKey = `${left.domain}:${left.name}:${left.capability_level}`;
    const rightKey = `${right.domain}:${right.name}:${right.capability_level}`;
    return leftKey.localeCompare(rightKey);
  });
}
