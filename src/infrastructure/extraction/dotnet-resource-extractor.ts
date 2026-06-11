import path from "node:path";
import type { ExtractionRequest, GraphNodeWriteModel } from "../../domain/models/index.js";
import { fullFileRange, lineRange, nodeId, uniqueSorted } from "./resource-shared.js";

export function dotnetResourceNodes(input: ExtractionRequest): GraphNodeWriteModel[] {
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

function isDotnetProjectPath(filePath: string): boolean {
  return filePath.endsWith(".csproj") || filePath.endsWith(".fsproj") || filePath.endsWith(".vbproj");
}
