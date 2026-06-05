import path from "node:path";
import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel
} from "../../domain/models/index.js";
import { describeFileCapability } from "../../domain/policies/index.js";
import type { ExtractorPort } from "../../ports/index.js";

const resourceLanguages = new Set(["config", "json", "toml", "yaml", "markdown", "text", "infrastructure"]);

export class ResourceExtractorAdapter implements ExtractorPort {
  public readonly language = "resource";

  public supports(input: { language: string; path: string }): boolean {
    const capability = describeFileCapability({
      path: input.path,
      language: input.language
    });
    return capability.capability_level === "resource_backed" || resourceLanguages.has(input.language);
  }

  public async extract(input: ExtractionRequest): Promise<ExtractionBatch> {
    const capability = describeFileCapability({
      path: input.path,
      language: input.language
    });
    const extractedAt = new Date(0).toISOString();
    const nodes: GraphNodeWriteModel[] = [
      {
        id: nodeId(input.snapshot_id, input.path, "resource", input.path),
        kind: "resource",
        name: path.basename(input.path),
        qualified_name: input.path,
        file_path: input.path,
        language: input.language,
        source_range: fullFileRange(input.content),
        metadata: {
          domain: capability.domain,
          capability_level: capability.capability_level,
          evidence_kinds: capability.evidence_kinds,
          provenance: capability.provenance
        }
      },
      ...cmakeTargetNodes(input),
      ...dotnetResourceNodes(input),
      ...cloudFormationTemplateNodes(input)
    ];

    return {
      snapshot_id: input.snapshot_id,
      source_path: input.path,
      extractor_id: "resource-backed",
      language: input.language,
      file_identity: {
        path: input.path,
        language: input.language,
        content_hash: `content:${Buffer.byteLength(input.content, "utf8")}`,
        size_bytes: Buffer.byteLength(input.content, "utf8"),
        mtime_ms: 0,
        indexed_at: extractedAt
      },
      nodes,
      edges: [],
      unresolved_references: [],
      diagnostics_hints: [],
      test_hints: [],
      extracted_at: extractedAt
    };
  }
}

function dotnetResourceNodes(input: ExtractionRequest): GraphNodeWriteModel[] {
  const lower = input.path.toLowerCase();
  if (lower.endsWith(".sln")) {
    return dotnetSolutionProjectNodes(input);
  }
  if (isDotnetProjectPath(lower)) {
    return dotnetProjectNodes(input);
  }
  return [];
}

function dotnetSolutionProjectNodes(input: ExtractionRequest): GraphNodeWriteModel[] {
  const nodes: GraphNodeWriteModel[] = [];
  const lines = input.content.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    const match = /^Project\("[^"]+"\)\s*=\s*"([^"]+)",\s*"([^"]+\.(?:csproj|fsproj|vbproj))",\s*"([^"]+)"/u.exec(line);
    if (!match) {
      continue;
    }
    const name = match[1] ?? "";
    const projectPath = match[2]?.replaceAll("\\", "/") ?? "";
    const projectGuid = match[3] ?? "";
    nodes.push({
      id: nodeId(input.snapshot_id, input.path, "dotnet_solution_project", `${name}:${projectPath}`),
      kind: "dotnet_solution_project",
      name,
      qualified_name: `${input.path}:${name}`,
      file_path: input.path,
      language: input.language,
      source_range: lineRange(line, index + 1),
      signature: projectPath,
      metadata: {
        domain: "package_manager",
        capability_level: "resource_backed",
        evidence_kinds: ["config"],
        provenance: "dotnet_solution_scan",
        semantic_scope: "project_declarations_only",
        project_path: projectPath,
        project_guid: projectGuid
      }
    });
  }
  return nodes;
}

function dotnetProjectNodes(input: ExtractionRequest): GraphNodeWriteModel[] {
  const metadata = dotnetProjectMetadata(input.content);
  return [
    {
      id: nodeId(input.snapshot_id, input.path, "dotnet_project", input.path),
      kind: "dotnet_project",
      name: path.basename(input.path),
      qualified_name: input.path,
      file_path: input.path,
      language: input.language,
      source_range: fullFileRange(input.content),
      signature: metadata.target_frameworks.join(";") || metadata.sdk,
      metadata: {
        domain: "package_manager",
        capability_level: "resource_backed",
        evidence_kinds: ["config"],
        provenance: "dotnet_project_scan",
        semantic_scope: "project_metadata_only",
        sdk: metadata.sdk,
        target_frameworks: metadata.target_frameworks,
        output_type: metadata.output_type,
        package_references: metadata.package_references,
        project_references: metadata.project_references,
        is_test_project: metadata.is_test_project,
        parse_warnings: metadata.parse_warnings
      }
    }
  ];
}

function dotnetProjectMetadata(content: string): {
  sdk?: string;
  target_frameworks: string[];
  output_type?: string;
  package_references: string[];
  project_references: string[];
  is_test_project: boolean;
  parse_warnings: string[];
} {
  const parseWarnings: string[] = [];
  const projectTag = /<Project\b([^>]*)>/iu.exec(content);
  if (projectTag === null) {
    parseWarnings.push("Project root element was not found.");
  }
  const sdk = projectTag === null ? undefined : xmlAttribute(projectTag[1] ?? "", "Sdk");
  const targetFrameworks = uniqueSorted([
    ...xmlTagValues(content, "TargetFramework"),
    ...xmlTagValues(content, "TargetFrameworks").flatMap((value) => value.split(";"))
  ].map((value) => value.trim()).filter(Boolean));
  const outputType = xmlTagValues(content, "OutputType")[0];
  const packageReferences = xmlElementAttributes(content, "PackageReference", "Include");
  const projectReferences = xmlElementAttributes(content, "ProjectReference", "Include").map((value) => value.replaceAll("\\", "/"));
  const isTestProject = xmlTagValues(content, "IsTestProject").some((value) => value.trim().toLowerCase() === "true") ||
    packageReferences.some((reference) => /^(xunit|nunit|mstest\.testframework)$/iu.test(reference));

  return {
    sdk,
    target_frameworks: targetFrameworks,
    output_type: outputType,
    package_references: packageReferences,
    project_references: projectReferences,
    is_test_project: isTestProject,
    parse_warnings: parseWarnings
  };
}

function xmlTagValues(content: string, tagName: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([^<]*)<\\/${tagName}>`, "giu");
  for (const match of content.matchAll(pattern)) {
    values.push(xmlDecode(match[1] ?? ""));
  }
  return values;
}

function xmlElementAttributes(content: string, elementName: string, attributeName: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`<${elementName}\\b([^>]*)\\/?>`, "giu");
  for (const match of content.matchAll(pattern)) {
    const value = xmlAttribute(match[1] ?? "", attributeName);
    if (value !== undefined) {
      values.push(value);
    }
  }
  return uniqueSorted(values);
}

function xmlAttribute(attributeText: string, attributeName: string): string | undefined {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, "iu");
  const match = pattern.exec(attributeText);
  return match === null ? undefined : xmlDecode(match[1] ?? "");
}

function xmlDecode(value: string): string {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function cloudFormationTemplateNodes(input: ExtractionRequest): GraphNodeWriteModel[] {
  if (!isCloudFormationTemplate(input)) {
    return [];
  }

  const nodes: GraphNodeWriteModel[] = [];
  const lines = input.content.split(/\r?\n/u);
  let inResources = false;
  let currentResource: {
    name: string;
    line: number;
    type?: string;
    handler?: string;
  } | undefined;

  function flushResource(): void {
    if (currentResource === undefined) {
      return;
    }
    const kind = currentResource.type?.includes("Serverless::Function") || currentResource.type?.includes("Lambda::Function")
      ? "lambda_function"
      : "cloudformation_resource";
    nodes.push({
      id: nodeId(input.snapshot_id, input.path, kind, currentResource.name),
      kind,
      name: currentResource.name,
      qualified_name: `${input.path}:${currentResource.name}`,
      file_path: input.path,
      language: input.language,
      source_range: lineRange(lines[currentResource.line - 1] ?? "", currentResource.line),
      signature: currentResource.type,
      metadata: {
        domain: "infrastructure",
        capability_level: "resource_backed",
        evidence_kinds: ["config", "infra_parser"],
        provenance: "cloudformation_resource_scan",
        semantic_scope: "template_declarations_only",
        handler: currentResource.handler
      }
    });
    if (currentResource.handler !== undefined) {
      const handlerTarget = lambdaHandlerTarget(currentResource.handler);
      nodes.push({
        id: nodeId(input.snapshot_id, input.path, "lambda_handler_binding", `${currentResource.name}:${currentResource.handler}`),
        kind: "lambda_handler_binding",
        name: currentResource.handler,
        qualified_name: `${input.path}:${currentResource.name}:${currentResource.handler}`,
        file_path: input.path,
        language: input.language,
        source_range: lineRange(lines[currentResource.line - 1] ?? "", currentResource.line),
        signature: `${currentResource.name} -> ${currentResource.handler}`,
        metadata: {
          domain: "infrastructure",
          capability_level: "resource_backed",
          evidence_kinds: ["config", "infra_parser"],
          provenance: "cloudformation_handler_scan",
          semantic_scope: "handler_string_only",
          logical_id: currentResource.name,
          handler_file_candidate: handlerTarget?.file_paths[0],
          handler_file_candidates: handlerTarget?.file_paths,
          handler_export_candidate: handlerTarget?.export_name,
          handler_resolution: "pending_file_match"
        }
      });
    }
    currentResource = undefined;
  }

  for (const [index, line] of lines.entries()) {
    if (/^Resources:\s*$/u.test(line)) {
      inResources = true;
      continue;
    }
    if (inResources && /^[A-Za-z_][A-Za-z0-9_]*:\s*$/u.test(line)) {
      flushResource();
      inResources = false;
      continue;
    }
    if (!inResources) {
      continue;
    }
    const resourceMatch = /^  ([A-Za-z][A-Za-z0-9]+):\s*$/u.exec(line);
    if (resourceMatch) {
      flushResource();
      currentResource = {
        name: resourceMatch[1] ?? "",
        line: index + 1
      };
      continue;
    }
    if (currentResource === undefined) {
      continue;
    }
    const typeMatch = /^    Type:\s*([A-Za-z0-9:._-]+)\s*$/u.exec(line);
    if (typeMatch) {
      currentResource.type = typeMatch[1];
      continue;
    }
    const handlerMatch = /^\s+Handler:\s*([A-Za-z0-9_./:-]+)\s*$/u.exec(line);
    if (handlerMatch) {
      currentResource.handler = handlerMatch[1];
    }
  }
  flushResource();
  return nodes;
}

function isCloudFormationTemplate(input: ExtractionRequest): boolean {
  const lower = input.path.toLowerCase();
  if (!(input.language === "yaml" || input.language === "json")) {
    return false;
  }
  if (!/(^|\/)(template|sam|cloudformation)[^/]*\.(ya?ml|json)$/u.test(lower) && !lower.includes("/sam/")) {
    return false;
  }
  return /(^|\n)(AWSTemplateFormatVersion|Transform:\s*AWS::Serverless|Resources:)/u.test(input.content);
}

function lambdaHandlerTarget(handler: string): { file_paths: string[]; export_name: string } | undefined {
  const normalized = handler.trim().replaceAll("\\", "/");
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === normalized.length - 1) {
    return undefined;
  }
  const modulePath = normalized.slice(0, lastDot);
  const exportName = normalized.slice(lastDot + 1);
  if (!/^[A-Za-z0-9_./-]+$/u.test(modulePath) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(exportName)) {
    return undefined;
  }
  const candidateExtensions = [".py", ".ts", ".js", ".mjs", ".cjs"];
  const existingExtension = path.extname(modulePath);
  return {
    file_paths: existingExtension.length > 0 ? [modulePath] : candidateExtensions.map((extension) => `${modulePath}${extension}`),
    export_name: exportName
  };
}

function lineRange(line: string, lineNumber: number) {
  return {
    start_line: lineNumber,
    start_column: 0,
    end_line: lineNumber,
    end_column: line.length
  };
}

function cmakeTargetNodes(input: ExtractionRequest): GraphNodeWriteModel[] {
  if (path.basename(input.path) !== "CMakeLists.txt") {
    return [];
  }

  const nodes: GraphNodeWriteModel[] = [];
  const lines = input.content.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    const match = /^\s*add_(library|executable)\s*\(\s*([A-Za-z_][A-Za-z0-9_.:-]*)\b([^)]*)\)/u.exec(line);
    if (!match) {
      continue;
    }
    const targetKind = match[1] === "library" ? "cmake_library" : "cmake_executable";
    const targetName = match[2] ?? "";
    nodes.push({
      id: nodeId(input.snapshot_id, input.path, targetKind, targetName),
      kind: targetKind,
      name: targetName,
      qualified_name: `${input.path}:${targetName}`,
      file_path: input.path,
      language: input.language,
      source_range: {
        start_line: index + 1,
        start_column: line.indexOf("add_"),
        end_line: index + 1,
        end_column: line.length
      },
      signature: line.trim(),
      metadata: {
        domain: "build",
        capability_level: "resource_backed",
        evidence_kinds: ["config"],
        provenance: "cmake_target_scan",
        semantic_scope: "target_declarations_only",
        sources: sourceList(match[3] ?? "")
      }
    });
  }
  return nodes;
}

function sourceList(value: string): string[] {
  return value
    .trim()
    .split(/\s+/u)
    .filter((part) => part.length > 0 && !part.startsWith("$<"));
}

function isDotnetProjectPath(filePath: string): boolean {
  return filePath.endsWith(".csproj") || filePath.endsWith(".fsproj") || filePath.endsWith(".vbproj");
}

function fullFileRange(content: string) {
  const lines = content.split("\n");
  const endLine = Math.max(1, lines.length);
  const lastLine = lines[lines.length - 1] ?? "";
  return {
    start_line: 1,
    start_column: 0,
    end_line: endLine,
    end_column: lastLine.length
  };
}

function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
