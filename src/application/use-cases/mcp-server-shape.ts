import path from "node:path";

export type McpTransport = "stdio" | "http_sse" | "streamable_http" | "docker" | "devcontainer";
export type McpConfidence = "high" | "medium" | "low";

export type McpServerShape = {
  detected: boolean;
  confidence: McpConfidence;
  transports: McpTransport[];
  entrypoints: string[];
  tool_registries: string[];
  protocol_docs: string[];
  environment_files: string[];
  reasons: string[];
};

export function detectMcpServerShape(pathsInput: Iterable<string>): McpServerShape {
  const paths = [...pathsInput].map(normalizeRepoPath).sort();
  const entrypoints = paths.filter(isMcpEntrypointPath);
  const toolRegistries = paths.filter(isMcpToolRegistryPath);
  const protocolDocs = paths.filter(isMcpProtocolDocPath);
  const environmentFiles = paths.filter(isMcpEnvironmentPath);
  const dependencyEvidence = paths.filter(isMcpDependencyEvidencePath);
  const mcpSpecificEvidenceCount =
    entrypoints.length +
    toolRegistries.length +
    protocolDocs.length +
    dependencyEvidence.length;
  const detected = mcpSpecificEvidenceCount > 0;
  const transports = detected ? detectMcpTransports(paths) : [];
  const confidence: McpConfidence =
    entrypoints.length > 0 && (toolRegistries.length > 0 || transports.length > 0 || dependencyEvidence.length > 0)
      ? "high"
      : entrypoints.length > 0 || toolRegistries.length > 0 || transports.length > 0
        ? "medium"
        : detected
          ? "low"
          : "low";

  return {
    detected,
    confidence,
    transports,
    entrypoints,
    tool_registries: toolRegistries,
    protocol_docs: protocolDocs,
    environment_files: environmentFiles,
    reasons: [
      ...(entrypoints.length > 0 ? [`MCP server entrypoint evidence: ${entrypoints.slice(0, 3).join(", ")}`] : []),
      ...(toolRegistries.length > 0 ? [`MCP tool registry evidence: ${toolRegistries.slice(0, 3).join(", ")}`] : []),
      ...(protocolDocs.length > 0 ? [`MCP protocol documentation evidence: ${protocolDocs.slice(0, 3).join(", ")}`] : []),
      ...(transports.length > 0 ? [`MCP transport evidence: ${transports.join(", ")}`] : []),
      ...(environmentFiles.length > 0 ? [`MCP container/environment evidence: ${environmentFiles.slice(0, 3).join(", ")}`] : []),
      ...(dependencyEvidence.length > 0 ? [`MCP dependency/config evidence: ${dependencyEvidence.slice(0, 3).join(", ")}`] : [])
    ]
  };
}

export function isMcpServerEvidencePath(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath);
  if (isIgnoredEvidencePath(normalized)) {
    return false;
  }
  return (
    isMcpEntrypointPath(normalized) ||
    isMcpToolRegistryPath(normalized) ||
    isMcpProtocolDocPath(normalized) ||
    isMcpDependencyEvidencePath(normalized)
  );
}

export function mcpEvidenceReason(filePath: string): string | undefined {
  const normalized = normalizeRepoPath(filePath);
  if (isMcpEntrypointPath(normalized)) {
    return "MCP server entrypoint evidence.";
  }
  if (isMcpToolRegistryPath(normalized)) {
    return "MCP tool registry evidence.";
  }
  if (isMcpProtocolDocPath(normalized)) {
    return "MCP protocol documentation evidence.";
  }
  if (isMcpDependencyEvidencePath(normalized)) {
    return "MCP dependency or server configuration evidence.";
  }
  return undefined;
}

export function mcpTransportLabels(transports: readonly McpTransport[]): string[] {
  return transports.map((transport) => {
    if (transport === "http_sse") return "HTTP/SSE";
    if (transport === "streamable_http") return "streamable HTTP";
    return transport;
  });
}

function detectMcpTransports(paths: readonly string[]): McpTransport[] {
  const transports = new Set<McpTransport>();
  for (const filePath of paths) {
    const lower = filePath.toLowerCase();
    if (/stdio/u.test(lower)) transports.add("stdio");
    if (/sse|http-sse|http_sse/u.test(lower)) transports.add("http_sse");
    if (/streamable[-_]?http/u.test(lower)) transports.add("streamable_http");
    if (isMcpEnvironmentPath(filePath)) {
      if (lower.includes("devcontainer")) transports.add("devcontainer");
      if (lower.includes("docker") || lower.includes("compose")) transports.add("docker");
    }
  }
  return [...transports].sort();
}

function isMcpEntrypointPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (isIgnoredEvidencePath(lower)) {
    return false;
  }
  const basename = path.posix.basename(lower);
  return (
    /\.(?:[cm]?[jt]sx?|py|go|rs)$/u.test(lower) &&
    /(^|\/)(mcp[-_]?server|server[-_]?mcp|mcp[-_]?stdio|mcp[-_]?sse|mcp[-_]?http|mcp[-_]?streamable|stdio[-_]?server|sse[-_]?server|streamable[-_]?http[-_]?server)\./u.test(basename)
  ) || /(^|\/)(mcp-server|mcp_server|mcp)\/(server|index|main|stdio|sse|http|http-server|sse-server|streamable-http-server)\.(?:[cm]?[jt]sx?|py|go|rs)$/u.test(lower);
}

function isMcpToolRegistryPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (isIgnoredEvidencePath(lower)) {
    return false;
  }
  return (
    /\.(?:[cm]?[jt]sx?|py|go|rs)$/u.test(lower) &&
    lower.includes("mcp") &&
    /(^|\/)(tools?|tool-registry|tool_registry|registr(?:y|ies)|handlers?)\./u.test(path.posix.basename(lower))
  );
}

function isMcpProtocolDocPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (isIgnoredEvidencePath(lower)) {
    return false;
  }
  return (
    lower.endsWith(".md") &&
    lower.includes("mcp") &&
    (/protocol|transport|stdio|sse|streamable|inspector|tools[-_]?list|call[-_]?tool/u.test(lower) ||
      lower === "readme.md" ||
      lower.endsWith("/readme.md"))
  );
}

function isMcpDependencyEvidencePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (isIgnoredEvidencePath(lower)) {
    return false;
  }
  return (
    lower.endsWith("/mcp.json") ||
    lower === "mcp.json" ||
    lower.endsWith("/.well-known/mcp/server-card.json") ||
    lower.endsWith("/mcp/server-card.json") ||
    lower.endsWith("/mcp-server.json") ||
    lower === "mcp-server.json"
  );
}

function isMcpEnvironmentPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (isIgnoredEvidencePath(lower)) {
    return false;
  }
  return (
    lower === "dockerfile" ||
    lower.endsWith("/dockerfile") ||
    lower.endsWith("docker-compose.yml") ||
    lower.endsWith("docker-compose.yaml") ||
    lower.endsWith("compose.yml") ||
    lower.endsWith("compose.yaml") ||
    lower.startsWith(".devcontainer/")
  );
}

function isIgnoredEvidencePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.startsWith("tests/fixtures/") ||
    lower.startsWith(".cache/") ||
    lower.startsWith(".tmp/") ||
    lower.includes("/fixtures/") ||
    lower.includes("/fixture") ||
    lower.startsWith("generated/") ||
    lower.includes("/generated/") ||
    /(^|\/)(vendor|third_party|thirdparty|3rdparty|external|extern)\//u.test(lower)
  );
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}
