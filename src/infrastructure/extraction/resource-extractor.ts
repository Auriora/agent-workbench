import path from "node:path";
import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Node,
  type YAMLMap,
  type YAMLSeq
} from "yaml";
import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphEdgeWriteModel,
  GraphNodeWriteModel,
  UnresolvedReferenceWriteModel
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
    const cloudFormation = cloudFormationTemplateExtraction(input);
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
      ...cloudFormation.nodes
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
      edges: cloudFormation.edges,
      unresolved_references: cloudFormation.unresolved_references,
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

function cloudFormationTemplateExtraction(input: ExtractionRequest): {
  nodes: GraphNodeWriteModel[];
  edges: GraphEdgeWriteModel[];
  unresolved_references: UnresolvedReferenceWriteModel[];
} {
  if (!isCloudFormationTemplate(input)) {
    return {
      nodes: [],
      edges: [],
      unresolved_references: []
    };
  }

  const structured = parseCloudFormationTemplate(input);
  if (structured !== undefined) {
    return structured;
  }

  return cloudFormationTemplateLineScan(input);
}

function cloudFormationTemplateLineScan(input: ExtractionRequest): {
  nodes: GraphNodeWriteModel[];
  edges: GraphEdgeWriteModel[];
  unresolved_references: UnresolvedReferenceWriteModel[];
} {
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
  return {
    nodes,
    edges: [],
    unresolved_references: []
  };
}

function parseCloudFormationTemplate(input: ExtractionRequest): {
  nodes: GraphNodeWriteModel[];
  edges: GraphEdgeWriteModel[];
  unresolved_references: UnresolvedReferenceWriteModel[];
} | undefined {
  const document = parseDocument(input.content, {
    keepSourceTokens: true,
    prettyErrors: false,
    strict: false
  });
  if (document.errors.length > 0 || !isMap(document.contents)) {
    return undefined;
  }
  const resources = mapValue(document.contents, "Resources");
  if (!isMap(resources)) {
    return undefined;
  }

  const resourceNames = new Set(
    resources.items
      .map((item) => scalarString(yamlNode(item.key)))
      .filter((name): name is string => name !== undefined)
  );
  const nodes: GraphNodeWriteModel[] = [];
  const edges: GraphEdgeWriteModel[] = [];
  const unresolvedReferences: UnresolvedReferenceWriteModel[] = [];
  const lineStarts = lineStartOffsets(input.content);

  for (const item of resources.items) {
    const logicalId = scalarString(yamlNode(item.key));
    const resourceYamlNode = yamlNode(item.value);
    if (logicalId === undefined || !isMap(resourceYamlNode)) {
      continue;
    }

    const resource = resourceYamlNode;
    const resourceType = scalarString(mapValue(resource, "Type"));
    const handler = scalarString(findMapValue(resource, ["Properties", "Handler"]));
    const eventSources = lambdaEventSources(resource);
    const unsupportedIntrinsics = new Set<string>();
    const resourceNode = cloudFormationResourceNode({
      input,
      logicalId,
      resourceType,
      handler,
      eventSources,
      sourceRange: nodeRange(item.key, input.content, lineStarts),
      unsupportedIntrinsics
    });
    nodes.push(resourceNode);

    const handlerNode = handler === undefined
      ? undefined
      : cloudFormationHandlerNode({
        input,
        logicalId,
        handler,
        eventSources,
        sourceRange: nodeRange(item.key, input.content, lineStarts)
      });
    if (handlerNode !== undefined) {
      nodes.push(handlerNode);
      edges.push({
        id: `${handlerNode.id}:template-resource:${resourceNode.id}`,
        source_node_id: handlerNode.id,
        target_node_id: resourceNode.id,
        kind: "routes_to_template_resource",
        source_range: nodeRange(item.key, input.content, lineStarts),
        provenance: "cloudformation_handler_template_resolution",
        confidence: 0.7,
        metadata: {
          provenance: "cloudformation_handler_template_resolution",
          semantic_scope: "template_resource_routing",
          logical_id: logicalId,
          resource_backed: true,
          reference_name: logicalId
        }
      });
    }

    for (const eventSource of eventSources) {
      const eventNode = cloudFormationEventSourceNode({
        input,
        logicalId,
        eventSource,
        sourceRange: nodeRange(eventSource.node, input.content, lineStarts)
      });
      nodes.push(eventNode);
      edges.push({
        id: `${resourceNode.id}:event-source:${eventSource.name}`,
        source_node_id: resourceNode.id,
        target_node_id: eventNode.id,
        kind: "lambda_event_source",
        source_range: nodeRange(eventSource.node, input.content, lineStarts),
        provenance: "cloudformation_event_source_scan",
        confidence: 0.7,
        metadata: {
          provenance: "cloudformation_event_source_scan",
          semantic_scope: "template_event_source_routing",
          logical_id: logicalId,
          event_name: eventSource.name,
          event_type: eventSource.type,
          resource_backed: true
        }
      });
      if (handlerNode !== undefined) {
        edges.push({
          id: `${handlerNode.id}:event-source:${eventSource.name}`,
          source_node_id: handlerNode.id,
          target_node_id: eventNode.id,
          kind: "lambda_event_source",
          source_range: nodeRange(eventSource.node, input.content, lineStarts),
          provenance: "cloudformation_event_source_scan",
          confidence: 0.7,
          metadata: {
            provenance: "cloudformation_event_source_scan",
            semantic_scope: "template_event_source_routing",
            logical_id: logicalId,
            event_name: eventSource.name,
            event_type: eventSource.type,
            resource_backed: true
          }
        });
      }
    }

    collectTemplateReferences({
      input,
      sourceNode: resourceNode,
      node: resource,
      resourceNames,
      path: ["Resources", logicalId],
      lineStarts,
      references: unresolvedReferences,
      unsupportedIntrinsics
    });
    if (unsupportedIntrinsics.size > 0) {
      resourceNode.metadata = {
        ...resourceNode.metadata,
        unsupported_intrinsics: [...unsupportedIntrinsics].sort()
      };
    }
  }

  return {
    nodes,
    edges,
    unresolved_references: unresolvedReferences
  };
}

function cloudFormationResourceNode(input: {
  input: ExtractionRequest;
  logicalId: string;
  resourceType?: string;
  handler?: string;
  eventSources: readonly CloudFormationEventSource[];
  sourceRange: ReturnType<typeof lineRange>;
  unsupportedIntrinsics: Set<string>;
}): GraphNodeWriteModel {
  const kind = input.resourceType?.includes("Serverless::Function") || input.resourceType?.includes("Lambda::Function")
    ? "lambda_function"
    : "cloudformation_resource";
  return {
    id: nodeId(input.input.snapshot_id, input.input.path, kind, input.logicalId),
    kind,
    name: input.logicalId,
    qualified_name: `${input.input.path}:${input.logicalId}`,
    file_path: input.input.path,
    language: input.input.language,
    source_range: input.sourceRange,
    signature: input.resourceType,
    metadata: {
      domain: "infrastructure",
      capability_level: "resource_backed",
      evidence_kinds: ["config", "infra_parser"],
      provenance: "cloudformation_resource_scan",
      semantic_scope: "template_declarations_only",
      handler: input.handler,
      event_sources: eventSourceSummaries(input.eventSources)
    }
  };
}

function cloudFormationHandlerNode(input: {
  input: ExtractionRequest;
  logicalId: string;
  handler: string;
  eventSources: readonly CloudFormationEventSource[];
  sourceRange: ReturnType<typeof lineRange>;
}): GraphNodeWriteModel {
  const handlerTarget = lambdaHandlerTarget(input.handler);
  return {
    id: nodeId(input.input.snapshot_id, input.input.path, "lambda_handler_binding", `${input.logicalId}:${input.handler}`),
    kind: "lambda_handler_binding",
    name: input.handler,
    qualified_name: `${input.input.path}:${input.logicalId}:${input.handler}`,
    file_path: input.input.path,
    language: input.input.language,
    source_range: input.sourceRange,
    signature: `${input.logicalId} -> ${input.handler}`,
    metadata: {
      domain: "infrastructure",
      capability_level: "resource_backed",
      evidence_kinds: ["config", "infra_parser"],
      provenance: "cloudformation_handler_scan",
      semantic_scope: "handler_string_only",
      logical_id: input.logicalId,
      handler_file_candidate: handlerTarget?.file_paths[0],
      handler_file_candidates: handlerTarget?.file_paths,
      handler_export_candidate: handlerTarget?.export_name,
      handler_resolution: "pending_file_match",
      event_sources: eventSourceSummaries(input.eventSources)
    }
  };
}

type CloudFormationEventSource = {
  name: string;
  type?: string;
  node: Node;
};

function lambdaEventSources(resource: YAMLMap): CloudFormationEventSource[] {
  const events = findMapValue(resource, ["Properties", "Events"]);
  if (!isMap(events)) {
    return [];
  }
  return events.items.flatMap((item) => {
    const name = scalarString(yamlNode(item.key));
    const eventNode = yamlNode(item.value);
    if (name === undefined || !isMap(eventNode)) {
      return [];
    }
    return [{
      name,
      type: scalarString(mapValue(eventNode, "Type")),
      node: eventNode
    }];
  });
}

function cloudFormationEventSourceNode(input: {
  input: ExtractionRequest;
  logicalId: string;
  eventSource: CloudFormationEventSource;
  sourceRange: ReturnType<typeof lineRange>;
}): GraphNodeWriteModel {
  return {
    id: nodeId(input.input.snapshot_id, input.input.path, "lambda_event_source", `${input.logicalId}:${input.eventSource.name}`),
    kind: "lambda_event_source",
    name: input.eventSource.name,
    qualified_name: `${input.input.path}:${input.logicalId}:${input.eventSource.name}`,
    file_path: input.input.path,
    language: input.input.language,
    source_range: input.sourceRange,
    signature: eventSourceLabel(input.eventSource),
    metadata: {
      domain: "infrastructure",
      capability_level: "resource_backed",
      evidence_kinds: ["config", "infra_parser"],
      provenance: "cloudformation_event_source_scan",
      semantic_scope: "template_event_source_routing",
      logical_id: input.logicalId,
      event_name: input.eventSource.name,
      event_type: input.eventSource.type
    }
  };
}

function eventSourceSummaries(eventSources: readonly CloudFormationEventSource[]): string[] {
  return eventSources.map(eventSourceLabel).sort();
}

function eventSourceLabel(eventSource: CloudFormationEventSource): string {
  return eventSource.type === undefined ? eventSource.name : `${eventSource.name}:${eventSource.type}`;
}

function collectTemplateReferences(input: {
  input: ExtractionRequest;
  sourceNode: GraphNodeWriteModel;
  node: Node | null | undefined;
  resourceNames: ReadonlySet<string>;
  path: readonly string[];
  lineStarts: readonly number[];
  references: UnresolvedReferenceWriteModel[];
  unsupportedIntrinsics: Set<string>;
}): void {
  const tagged = shortFormIntrinsic(input.node);
  if (tagged !== undefined) {
    emitIntrinsicReferences({
      ...input,
      intrinsic: tagged.intrinsic,
      value: tagged.value,
      path: [...input.path, tagged.intrinsic]
    });
  }

  if (isMap(input.node)) {
    for (const item of input.node.items) {
      const key = scalarString(yamlNode(item.key));
      const childPath = key === undefined ? input.path : [...input.path, key];
      if (key !== undefined && isIntrinsicKey(key)) {
        emitIntrinsicReferences({
          ...input,
          intrinsic: key,
          value: yamlNode(item.value),
          path: childPath
        });
        continue;
      }
      collectTemplateReferences({
        ...input,
        node: yamlNode(item.value),
        path: childPath
      });
    }
    return;
  }

  if (isSeq(input.node)) {
    for (const [index, item] of input.node.items.entries()) {
      collectTemplateReferences({
        ...input,
        node: yamlNode(item),
        path: [...input.path, String(index)]
      });
    }
  }
}

function emitIntrinsicReferences(input: {
  input: ExtractionRequest;
  sourceNode: GraphNodeWriteModel;
  value: Node | null | undefined;
  resourceNames: ReadonlySet<string>;
  path: readonly string[];
  lineStarts: readonly number[];
  references: UnresolvedReferenceWriteModel[];
  unsupportedIntrinsics: Set<string>;
  intrinsic: string;
}): void {
  const intrinsic = normalizeIntrinsicName(input.intrinsic);
  if (intrinsic === "Ref") {
    const target = scalarString(input.value);
    if (target !== undefined) {
      addCloudFormationReference({ ...input, target, referenceKind: "cloudformation_ref", confidence: 0.75 });
    }
    return;
  }

  if (intrinsic === "Fn::GetAtt") {
    const target = getAttTarget(input.value);
    if (target !== undefined) {
      addCloudFormationReference({ ...input, target, referenceKind: "cloudformation_getatt", confidence: 0.75 });
    }
    return;
  }

  if (intrinsic === "Fn::Sub") {
    for (const target of subTargets(input.value)) {
      addCloudFormationReference({ ...input, target, referenceKind: "cloudformation_sub", confidence: 0.55 });
    }
    if (!hasShortFormIntrinsicTag(input.value)) {
      traverseIntrinsicValue(input);
    }
    return;
  }

  if (intrinsic === "Fn::Join") {
    traverseIntrinsicValue(input);
    return;
  }

  if (intrinsic === "Fn::ImportValue") {
    const target = scalarString(input.value);
    if (target !== undefined) {
      addCloudFormationReference({
        ...input,
        target,
        referenceKind: "cloudformation_import_value",
        confidence: 0.35,
        external: true
      });
    }
    if (!hasShortFormIntrinsicTag(input.value)) {
      traverseIntrinsicValue(input);
    }
    return;
  }

  if (intrinsic === "DependsOn") {
    for (const target of stringValues(input.value)) {
      addCloudFormationReference({ ...input, target, referenceKind: "cloudformation_depends_on", confidence: 0.85 });
    }
    return;
  }

  input.unsupportedIntrinsics.add(intrinsic);
  if (isScalar(input.value)) {
    return;
  }
  traverseIntrinsicValue(input);
}

function traverseIntrinsicValue(input: {
  input: ExtractionRequest;
  sourceNode: GraphNodeWriteModel;
  value: Node | null | undefined;
  resourceNames: ReadonlySet<string>;
  path: readonly string[];
  lineStarts: readonly number[];
  references: UnresolvedReferenceWriteModel[];
  unsupportedIntrinsics: Set<string>;
  intrinsic: string;
}): void {
  collectTemplateReferences({
    ...input,
    node: input.value,
    path: [...input.path, "value"]
  });
}

function addCloudFormationReference(input: {
  input: ExtractionRequest;
  sourceNode: GraphNodeWriteModel;
  value: Node | null | undefined;
  resourceNames: ReadonlySet<string>;
  path: readonly string[];
  lineStarts: readonly number[];
  references: UnresolvedReferenceWriteModel[];
  unsupportedIntrinsics: Set<string>;
  intrinsic: string;
  target: string;
  referenceKind: string;
  confidence: number;
  external?: boolean;
}): void {
  if (input.target.startsWith("AWS::")) {
    return;
  }
  const referenceName = input.target.includes(".") ? input.target.slice(0, input.target.indexOf(".")) : input.target;
  if (looksSecretLike(referenceName)) {
    return;
  }
  input.references.push({
    id: `${input.sourceNode.id}:${input.referenceKind}:${input.references.length}`,
    source_node_id: input.sourceNode.id,
    source_file_path: input.input.path,
    reference_name: referenceName,
    reference_kind: input.referenceKind,
    source_range: nodeRange(input.value, input.input.content, input.lineStarts),
    candidate_metadata: {
      provenance: "cloudformation_intrinsic_scan",
      semantic_scope: input.external === true ? "external_stack_reference" : "template_resource_reference",
      intrinsic: normalizeIntrinsicName(input.intrinsic),
      expression_path: input.path.join("."),
      confidence: input.confidence,
      resource_backed: true,
      target_kind: input.resourceNames.has(referenceName) ? "logical_resource" : "external_or_parameter"
    }
  });
}

function mapValue(map: YAMLMap, key: string): Node | null | undefined {
  const value = map.items.find((item) => scalarString(yamlNode(item.key)) === key)?.value;
  return yamlNode(value);
}

function findMapValue(map: YAMLMap, pathParts: readonly string[]): Node | null | undefined {
  let current: Node | null | undefined = map;
  for (const part of pathParts) {
    if (!isMap(current)) {
      return undefined;
    }
    current = mapValue(current, part);
  }
  return current;
}

function shortFormIntrinsic(node: Node | null | undefined): { intrinsic: string; value: Node | null | undefined } | undefined {
  if (!isScalar(node) || typeof node.tag !== "string" || !node.tag.startsWith("!")) {
    return undefined;
  }
  return {
    intrinsic: node.tag,
    value: node
  };
}

function hasShortFormIntrinsicTag(node: Node | null | undefined): boolean {
  return isScalar(node) && typeof node.tag === "string" && node.tag.startsWith("!");
}

function normalizeIntrinsicName(intrinsic: string): string {
  const normalized = intrinsic.startsWith("!") ? intrinsic.slice(1) : intrinsic;
  if (normalized === "GetAtt") return "Fn::GetAtt";
  if (normalized === "Sub") return "Fn::Sub";
  if (normalized === "Join") return "Fn::Join";
  if (normalized === "ImportValue") return "Fn::ImportValue";
  return normalized;
}

function isIntrinsicKey(key: string): boolean {
  return key === "DependsOn" || key === "Ref" || key.startsWith("Fn::");
}

function scalarString(node: Node | null | undefined): string | undefined {
  if (!isScalar(node)) {
    return undefined;
  }
  return typeof node.value === "string" || typeof node.value === "number" ? String(node.value) : undefined;
}

function getAttTarget(node: Node | null | undefined): string | undefined {
  const scalar = scalarString(node);
  if (scalar !== undefined) {
    return scalar.split(".")[0];
  }
  if (isSeq(node)) {
    return scalarString(yamlNode(node.items[0]));
  }
  return undefined;
}

function subTargets(node: Node | null | undefined): string[] {
  const template = isSeq(node) ? scalarString(yamlNode(node.items[0])) : scalarString(node);
  if (template === undefined) {
    return [];
  }
  const targets = new Set<string>();
  for (const match of template.matchAll(/\$\{([A-Za-z][A-Za-z0-9:.]*)\}/gu)) {
    const raw = match[1] ?? "";
    const name = raw.includes(".") ? raw.slice(0, raw.indexOf(".")) : raw;
    if (name !== "" && !name.startsWith("AWS::")) {
      targets.add(name);
    }
  }
  return [...targets].sort();
}

function stringValues(node: Node | null | undefined): string[] {
  const scalar = scalarString(node);
  if (scalar !== undefined) {
    return [scalar];
  }
  if (isSeq(node)) {
    return node.items.map((item) => scalarString(yamlNode(item))).filter((value): value is string => value !== undefined);
  }
  return [];
}

function lineStartOffsets(content: string): number[] {
  const starts = [0];
  for (const [index, character] of [...content].entries()) {
    if (character === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function yamlNode(value: unknown): Node | null | undefined {
  return value as Node | null | undefined;
}

function nodeRange(node: unknown, content: string, lineStarts: readonly number[]): ReturnType<typeof lineRange> {
  const candidate = node as { range?: unknown } | null | undefined;
  const range = Array.isArray(candidate?.range) ? candidate.range : undefined;
  const offset = typeof range?.[0] === "number" ? range[0] : 0;
  const line = lineForOffset(offset, lineStarts);
  const lineText = content.split(/\r?\n/u)[line - 1] ?? "";
  return lineRange(lineText, line);
}

function lineForOffset(offset: number, lineStarts: readonly number[]): number {
  let line = 1;
  for (const [index, start] of lineStarts.entries()) {
    if (start > offset) {
      break;
    }
    line = index + 1;
  }
  return line;
}

function looksSecretLike(value: string): boolean {
  return /(secret|token|password|credential|apikey|api_key)/iu.test(value);
}

function isCloudFormationTemplate(input: ExtractionRequest): boolean {
  const lower = input.path.toLowerCase();
  if (!(input.language === "yaml" || input.language === "json")) {
    return false;
  }
  if (!/(^|\/)(template|sam|cloudformation)[^/]*\.(ya?ml|json)$/u.test(lower) && !lower.includes("/sam/")) {
    return false;
  }
  return /(^|\n)\s*(?:"(?:AWSTemplateFormatVersion|Transform|Resources)"\s*:|AWSTemplateFormatVersion|Transform:\s*AWS::Serverless|Resources:)/u.test(input.content);
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
