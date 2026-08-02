/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Parser from "tree-sitter";
import Ruby from "tree-sitter-ruby";

export const RUBY_TREE_SITTER_GRAMMAR = "tree-sitter-ruby";

export type RubyParser = {
  parse(input: string): Parser.Tree;
};

export type RubyScope = {
  kind: "module" | "class" | "singleton_class";
  name: string;
  qualifiedName: string;
};

type RubyRouteContext = {
  controllerModules: string[];
  routePathPrefixSegments: string[];
  resourceController?: string;
  resourceName?: string;
  actionScope?: "member" | "collection";
};

type RubyResourceRouteOptions = {
  controllerName?: string;
  moduleName?: string;
  pathName?: string;
};

export type RubyDeclaration = {
  kind: "module" | "class" | "singleton_class" | "method" | "singleton_method" | "constant";
  name: string;
  qualifiedName: string;
  signature?: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  metadata: Record<string, unknown>;
};

export type RubyReference = {
  name: string;
  kind: "ruby_require" | "ruby_require_relative" | "ruby_load" | "ruby_inheritance" | "ruby_constant" | "ruby_call" | "ruby_include" | "ruby_extend" | "ruby_prepend" | "ruby_route" | "ruby_model_dsl" | "ruby_alias" | "ruby_visibility" | "ruby_dynamic";
  sourceQualifiedName?: string;
  static: boolean;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  metadata: Record<string, unknown>;
};

export type RubyExtraction = {
  declarations: RubyDeclaration[];
  references: RubyReference[];
};

const parser = new Parser();
parser.setLanguage(Ruby as Parser.Language);

const DEFAULT_PARSER: RubyParser = {
  parse(input: string): Parser.Tree {
    return parser.parse(input);
  }
};

const STATIC_REQUIRE_NAMES = new Set(["require", "require_relative"]);
const STATIC_LOAD_NAMES = new Set(["load", "autoload", "autoload_relative"]);
const STATIC_MIXIN_NAMES = new Set(["include", "extend", "prepend"]);
const STATIC_ROUTE_NAMES = new Set(["get", "post", "put", "patch", "delete", "resource", "resources", "match", "root", "draw"]);
const STATIC_ROUTE_CONTEXT_NAMES = new Set(["namespace", "scope", "member", "collection", "resources", "resource"]);
const STATIC_MODEL_DSL_NAMES = new Set([
  "belongs_to",
  "has_many",
  "has_one",
  "has_and_belongs_to_many",
  "validates",
  "before_validation",
  "before_save",
  "before_create",
  "before_update",
  "before_destroy"
]);

export function rubyTreeSitterGrammarForLanguage(input: string): "ruby" | null {
  return input === "ruby" ? "ruby" : null;
}

export function rubyTreeSitterGrammarForPath(filePath: string): "ruby" | null {
  return filePath.toLowerCase().endsWith(".rb") ? "ruby" : null;
}

export class RubyParserAdapter {
  private readonly parser: RubyParser;

  constructor(input: { parser?: RubyParser } = {}) {
    this.parser = input.parser ?? DEFAULT_PARSER;
  }

  public extractRuby(source: string, sourceFilePath?: string): RubyExtraction {
    const tree = this.parser.parse(source);
    const declarations: RubyDeclaration[] = [];
    const references: RubyReference[] = [];
    const scopes: RubyScope[] = [];
    const routeContextStack: RubyRouteContext[] = [];
    const classSeen = new Map<string, number>();
    const moduleSeen = new Map<string, number>();

    const visit = (node: Parser.SyntaxNode): void => {
      if (node.type === "alias") {
        const aliasNode = node;
        const aliasFrom = aliasNode.namedChildren[0];
        const aliasTo = aliasNode.namedChildren[1];
        const fromName = aliasFrom === null ? undefined : firstSymbolOrString(aliasFrom) ?? constantName(aliasFrom) ?? identifierName(aliasFrom);
        const toName = aliasTo === null ? undefined : firstSymbolOrString(aliasTo) ?? constantName(aliasTo) ?? identifierName(aliasTo);
        if (fromName !== undefined && toName !== undefined) {
          references.push(literalReference({
            kind: "ruby_alias",
            name: toName,
            sourceQualifiedName: scopes.at(-1)?.qualifiedName,
            node: aliasNode,
            metadata: {
              declaration_source: "tree-sitter-ruby",
              alias_from: fromName,
              alias_to: toName
            }
          }));
        } else {
          references.push(dynamicReference({
            name: "alias",
            sourceQualifiedName: scopes.at(-1)?.qualifiedName,
            node: aliasNode,
            metadata: {
              declaration_source: "tree-sitter-ruby",
              reason: "non_literal_alias"
            }
          }));
        }
        return;
      }

      if (node.type === "identifier" && isVisibilityIdentifier(node) && node.parent?.type !== "call") {
        references.push(literalReference({
          kind: "ruby_visibility",
          name: node.text,
          sourceQualifiedName: scopes.at(-1)?.qualifiedName,
          node,
          metadata: {
            declaration_source: "tree-sitter-ruby",
            visibility: node.text,
            visibility_scope: node.parent?.parent?.type === "method"
              ? "method"
              : node.parent?.parent?.type === "class" || node.parent?.parent?.type === "module" || node.parent?.parent?.type === "singleton_class"
                ? "scope"
                : "unknown",
            visibility_targets: []
          }
        }));
      }

      if (node.type === "class") {
        const declaration = declarationFromClassNode(node, scopes, classSeen);
        if (declaration !== null) {
          declarations.push(declaration);
          const inheritance = inheritanceFromClassNode(declaration, node);
          if (inheritance !== null) {
            references.push(inheritance);
          }
          const scope: RubyScope = {
            kind: "class",
            name: declaration.name,
            qualifiedName: declaration.qualifiedName
          };
          scopes.push(scope);
          visitBody(node);
          scopes.pop();
          return;
        }
      }

      if (node.type === "module") {
        const declaration = declarationFromModuleNode(node, scopes, moduleSeen);
        if (declaration !== null) {
          declarations.push(declaration);
          const scope: RubyScope = {
            kind: "module",
            name: declaration.name,
            qualifiedName: declaration.qualifiedName
          };
          scopes.push(scope);
          visitBody(node);
          scopes.pop();
          return;
        }
      }

      if (node.type === "singleton_class") {
        const declaration = declarationFromSingletonClassNode(node, scopes);
        if (declaration !== null) {
          declarations.push(declaration);
          const scope: RubyScope = {
            kind: "singleton_class",
            name: declaration.name,
            qualifiedName: declaration.qualifiedName
          };
          scopes.push(scope);
          visitBody(node);
          scopes.pop();
          return;
        }
      }

      if (node.type === "method" || node.type === "singleton_method") {
        const declaration = declarationFromMethodNode(node, scopes);
        if (declaration !== null) {
          declarations.push(declaration);
        }
      } else if (node.type === "assignment") {
        const declaration = declarationFromAssignment(node, scopes);
        if (declaration !== null) {
          declarations.push(declaration);
        }
      } else if (node.type === "call") {
        const sourceQualifiedName = scopes.at(-1)?.qualifiedName;
        const methodName = node.childForFieldName("method")?.text;
        const args = node.childForFieldName("arguments");
        const routeContext = currentRouteContext(routeContextStack);
        const nextRouteContext = methodName === undefined
          ? undefined
          : routeContextFromCall(methodName, args, routeContext);
        references.push(...referencesFromCall(
          node,
          sourceQualifiedName,
          routeContext,
          sourceFilePath,
          methodName
        ));
        if (nextRouteContext !== undefined) {
          const block = routeCallBlock(node);
          if (block !== null) {
            if (args !== null) {
              visit(args);
            }
            routeContextStack.push(nextRouteContext);
            visit(block);
            routeContextStack.pop();
            return;
          }
        }
      } else if ((node.type === "constant" || node.type === "scope_resolution") &&
        shouldExtractConstantReference(node)) {
        const name = declarationNameFromNode(node);
        if (name !== undefined) {
          references.push(literalReference({
            kind: "ruby_constant",
            name,
            sourceQualifiedName: scopes.at(-1)?.qualifiedName,
            node,
            metadata: {
              reference_scope: "static_constant",
              declaration_source: "tree-sitter-ruby"
            }
          }));
        }
      }

      visitChildren(node);
    };

    const visitBody = (node: Parser.SyntaxNode): void => {
      const body = node.childForFieldName("body")
        ?? firstNamedChildOfType(node, ["body_statement"]);
      if (body === undefined) {
        return;
      }
      for (let index = 0; index < body.namedChildCount; index += 1) {
        const child = body.namedChild(index);
        if (child !== null) {
          visit(child);
        }
      }
    };

    const visitChildren = (node: Parser.SyntaxNode): void => {
      for (let index = 0; index < node.namedChildCount; index += 1) {
        const child = node.namedChild(index);
        if (child !== null) {
          visit(child);
        }
      }
    };

    for (let index = 0; index < tree.rootNode.namedChildCount; index += 1) {
      const child = tree.rootNode.namedChild(index);
      if (child !== null) {
        visit(child);
      }
    }

    return { declarations, references };
  }
}

export function extractRuby(source: string, sourceFilePath?: string): RubyExtraction {
  return new RubyParserAdapter().extractRuby(source, sourceFilePath);
}

function declarationFromClassNode(
  node: Parser.SyntaxNode,
  scopes: readonly RubyScope[],
  seen: Map<string, number>
): RubyDeclaration | null {
  const nameNode = node.childForFieldName("name");
  const nameText = declarationNameFromNode(nameNode ?? firstNamedChildOfType(node, ["constant", "scope_resolution"]));
  if (nameText === undefined) {
    return null;
  }
  const qualifiedName = qualifyName(nameText, scopes);
  const count = seen.get(qualifiedName) ?? 0;
  const metadata: Record<string, unknown> = {
    declaration_kind: "class",
    declaration_source: "tree-sitter-ruby",
    declaration_stability: "static",
    static_source: "declaration"
  };
  if (count > 0) {
    metadata.reopened = true;
    metadata.reopen_sequence = count + 1;
  }
  seen.set(qualifiedName, count + 1);
  const superclass = superclassFromClassNode(node);
  if (superclass !== undefined) {
    metadata.static_superclass = superclass;
  }
  return {
    kind: "class",
    name: nameText.split(".").at(-1) ?? nameText,
    qualifiedName,
    signature: firstLine(node.text),
    startLine: nameNode?.startPosition.row !== undefined ? nameNode.startPosition.row + 1 : node.startPosition.row + 1,
    startColumn: nameNode?.startPosition.column ?? node.startPosition.column,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column,
    metadata
  };
}

function declarationFromModuleNode(
  node: Parser.SyntaxNode,
  scopes: readonly RubyScope[],
  seen: Map<string, number>
): RubyDeclaration | null {
  const nameNode = node.childForFieldName("name");
  const nameText = declarationNameFromNode(nameNode ?? firstNamedChildOfType(node, ["constant", "scope_resolution"]));
  if (nameText === undefined) {
    return null;
  }
  const qualifiedName = qualifyName(nameText, scopes);
  const count = seen.get(qualifiedName) ?? 0;
  const metadata: Record<string, unknown> = {
    declaration_kind: "module",
    declaration_source: "tree-sitter-ruby",
    declaration_stability: "static",
    static_source: "declaration"
  };
  if (count > 0) {
    metadata.reopened = true;
    metadata.reopen_sequence = count + 1;
  }
  seen.set(qualifiedName, count + 1);
  return {
    kind: "module",
    name: nameText.split(".").at(-1) ?? nameText,
    qualifiedName,
    signature: firstLine(node.text),
    startLine: nameNode?.startPosition.row !== undefined ? nameNode.startPosition.row + 1 : node.startPosition.row + 1,
    startColumn: nameNode?.startPosition.column ?? node.startPosition.column,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column,
    metadata
  };
}

function declarationFromSingletonClassNode(
  node: Parser.SyntaxNode,
  scopes: readonly RubyScope[]
): RubyDeclaration | null {
  const receiver = node.childForFieldName("value");
  if (receiver === null || receiver.type !== "self") {
    return null;
  }
  const parentScope = scopes.at(-1)?.qualifiedName;
  const qualifiedName = parentScope === undefined ? "<<self>>" : `${parentScope}.<<self>>`;
  return {
    kind: "singleton_class",
    name: "<<self>>",
    qualifiedName,
    signature: firstLine(node.text),
    startLine: node.startPosition.row + 1,
    startColumn: node.startPosition.column,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column,
    metadata: {
      declaration_kind: "singleton_class",
      declaration_source: "tree-sitter-ruby",
      declaration_stability: "static"
    }
  };
}

function declarationFromMethodNode(
  node: Parser.SyntaxNode,
  scopes: readonly RubyScope[]
): RubyDeclaration | null {
  const nameNode = node.childForFieldName("name");
  if (nameNode === null) {
    return null;
  }
  const name = nameNode.text;
  const scope = scopes.at(-1);
  const isSelfReceiver = node.childForFieldName("receiver")?.type === "self";
  const scopeQualifiedName = scope?.kind === "singleton_class"
    ? scope.qualifiedName.endsWith(".<<self>>")
      ? scope.qualifiedName.slice(0, -".<<self>>".length)
      : scope.qualifiedName
    : scope?.qualifiedName;
  const kind = scope?.kind === "singleton_class" || node.type === "singleton_method" || isSelfReceiver
    ? "singleton_method"
    : "method";
  const separator = kind === "singleton_method" ? "." : "#";
  const qualifiedName = scopeQualifiedName === undefined ? name : `${scopeQualifiedName}${separator}${name}`;
  return {
    kind,
    name,
    qualifiedName,
    signature: firstLine(node.text),
    startLine: nameNode.startPosition.row + 1,
    startColumn: nameNode.startPosition.column,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column,
    metadata: {
      declaration_kind: kind,
      declaration_source: "tree-sitter-ruby",
      declaration_stability: "static"
    }
  };
}

function declarationFromAssignment(node: Parser.SyntaxNode, scopes: readonly RubyScope[]): RubyDeclaration | null {
  const lhs = node.namedChildren[0];
  if (lhs === null || !isConstantLike(lhs)) {
    return null;
  }
  const nameText = declarationNameFromNode(lhs);
  if (nameText === undefined) {
    return null;
  }
  return {
    kind: "constant",
    name: nameText.split(".").at(-1) ?? nameText,
    qualifiedName: qualifyName(nameText, scopes),
    signature: firstLine(node.text),
    startLine: lhs.startPosition.row + 1,
    startColumn: lhs.startPosition.column,
    endLine: lhs.endPosition.row + 1,
    endColumn: lhs.endPosition.column,
    metadata: {
      declaration_kind: "constant",
      declaration_source: "tree-sitter-ruby",
      declaration_stability: "static"
    }
  };
}

function declarationNameFromNode(node: Parser.SyntaxNode | undefined | null): string | undefined {
  if (node === null || node === undefined) {
    return undefined;
  }
  if (node.type === "constant") {
    return node.text;
  }
  if (node.type === "scope_resolution") {
    const parts = node.namedChildren
      .filter((child) => child.type === "constant")
      .map((child) => child.text)
      .filter(Boolean);
    return parts.length > 0 ? parts.join(".") : undefined;
  }
  return undefined;
}

function qualifyName(value: string, scopes: readonly RubyScope[]): string {
  const normalized = value.replace(/::/gu, ".");
  if (normalized.includes(".")) {
    return normalized;
  }
  const parentQualifiedName = scopes.at(-1)?.qualifiedName;
  if (parentQualifiedName === undefined || parentQualifiedName.length === 0) {
    return normalized;
  }
  return `${parentQualifiedName}.${normalized}`;
}

function superclassFromClassNode(node: Parser.SyntaxNode): string | undefined {
  const superclassNode = node.childForFieldName("superclass");
  const target = superclassNode === null ? undefined : firstNamedChildOfType(superclassNode, ["constant", "scope_resolution"]);
  return declarationNameFromNode(target);
}

function inheritanceFromClassNode(
  declaration: RubyDeclaration,
  node: Parser.SyntaxNode
): RubyReference | null {
  const superclass = declaration.metadata.static_superclass;
  if (superclass === undefined || typeof superclass !== "string") {
    return null;
  }
  const nodeForRange = node.childForFieldName("superclass") ?? node;
  return literalReference({
    kind: "ruby_inheritance",
    name: superclass,
    sourceQualifiedName: declaration.qualifiedName,
    node: nodeForRange,
    metadata: {
      reference_scope: "class_inheritance",
      declaration_source: "tree-sitter-ruby"
    }
  });
}

function shouldExtractConstantReference(node: Parser.SyntaxNode): boolean {
  const parent = node.parent;
  if (parent === null) {
    return true;
  }
  if (node.type === "constant" && parent.type === "scope_resolution") {
    return false;
  }
  if ((parent.type === "class" || parent.type === "module") && parent.childForFieldName("name")?.id === node.id) {
    return false;
  }
  if (parent.type === "assignment" && parent.namedChild(0)?.id === node.id) {
    return false;
  }
  if (parent.type === "superclass") {
    return false;
  }
  return true;
}

function routeCallBlock(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
  const block = node.childForFieldName("block") ??
    node.childForFieldName("body") ??
    firstNamedChildOfType(node, ["do_block", "block"]) ??
    null;
  if (block === null) {
    return null;
  }
  return block.childForFieldName("body") ?? block.childForFieldName("value") ?? block;
}

function currentRouteContext(stack: readonly RubyRouteContext[]): RubyRouteContext {
  const top = stack.at(-1);
  if (top === undefined) {
    return {
      controllerModules: [],
      routePathPrefixSegments: []
    };
  }
  return {
    controllerModules: [...top.controllerModules],
    routePathPrefixSegments: [...top.routePathPrefixSegments],
    resourceController: top.resourceController,
    resourceName: top.resourceName,
    actionScope: top.actionScope
  };
}

function referencesFromCall(
  node: Parser.SyntaxNode,
  sourceQualifiedName: string | undefined,
  routeContext: RubyRouteContext,
  sourceFilePath: string | undefined,
  methodNameOverride?: string
): RubyReference[] {
  const methodNode = node.childForFieldName("method");
  const methodName = methodNameOverride ?? methodNode?.text;
  if (methodName === undefined) {
    return [];
  }
  const args = node.childForFieldName("arguments");
  const argsOnly = args === null ? [] : args.namedChildren.filter((child) => child.type !== "pair");

  if (isRequireName(methodName)) {
    return requirementReferences(methodName, argsOnly, sourceQualifiedName);
  }
  if (isLoadName(methodName)) {
    return loadReferences(methodName, argsOnly, sourceQualifiedName, args);
  }
  if (isVisibilityName(methodName)) {
    return visibilityReferences(methodName, args, sourceQualifiedName, methodNode);
  }
  if (STATIC_MIXIN_NAMES.has(methodName)) {
    return mixinReferences(methodName, argsOnly, sourceQualifiedName);
  }
  if (STATIC_ROUTE_NAMES.has(methodName)) {
    return routeReferences(methodName, args, sourceQualifiedName, routeContext, sourceFilePath);
  }
  if (STATIC_MODEL_DSL_NAMES.has(methodName)) {
    return modelDslReferences(methodName, args, sourceQualifiedName);
  }

  if (methodNode === null) {
    return [];
  }
  return [literalReference({
    kind: "ruby_call",
    name: methodName,
    sourceQualifiedName,
    node: methodNode,
    metadata: {
      declaration_source: "tree-sitter-ruby",
      call_form: "generic"
    }
  })];
}

function routeContextFromCall(
  methodName: string,
  args: Parser.SyntaxNode | null,
  routeContext: RubyRouteContext
): RubyRouteContext | undefined {
  if (!STATIC_ROUTE_CONTEXT_NAMES.has(methodName)) {
    return undefined;
  }
  const argumentsNodes = args === null ? [] : args.namedChildren;

  if (methodName === "namespace" || methodName === "scope") {
    const scopeNames = routeScopeContextFromArguments(methodName, argumentsNodes);
    if (scopeNames.moduleName === undefined && scopeNames.pathName === undefined) {
      return undefined;
    }
    const nextControllerModules = scopeNames.moduleName === undefined
      ? []
      : [scopeNames.moduleName];
    const nextPathSegments = scopeNames.pathName === undefined
      ? []
      : [scopeNames.pathName];
    return {
      controllerModules: [...routeContext.controllerModules, ...nextControllerModules],
      routePathPrefixSegments: [...routeContext.routePathPrefixSegments, ...nextPathSegments],
      resourceController: undefined,
      resourceName: undefined,
      actionScope: undefined
    };
  }

  if (methodName === "member" || methodName === "collection") {
    if (routeContext.resourceName === undefined) {
      return undefined;
    }
    return {
      controllerModules: [...routeContext.controllerModules],
      routePathPrefixSegments: [...routeContext.routePathPrefixSegments],
      resourceController: routeContext.resourceController,
      resourceName: routeContext.resourceName,
      actionScope: methodName
    };
  }

  if (methodName === "resource" || methodName === "resources") {
    const resourceName = argumentsNodes[0] === undefined ? undefined : firstSymbolOrString(argumentsNodes[0]);
    if (resourceName === undefined) {
      return undefined;
    }
    const normalizedResourceName = firstPathComponent(resourceName);
    const resourceOptions = routeResourceOptionsFromArguments(argumentsNodes);
    if (resourceOptions === null) {
      return undefined;
    }
    const controllerResourceName = methodName === "resource"
      ? routePluralizedResourceName(normalizedResourceName)
      : resourceOptions.controllerName === undefined
        ? normalizedResourceName
        : resourceOptions.controllerName;
    const routePathName = resourceOptions.pathName === undefined ? normalizedResourceName : resourceOptions.pathName;
    const nextControllerModules = resourceOptions.moduleName === undefined
      ? [...routeContext.controllerModules]
      : [...routeContext.controllerModules, resourceOptions.moduleName];
    return {
      controllerModules: [...nextControllerModules],
      routePathPrefixSegments: [...routeContext.routePathPrefixSegments, routePathName],
      resourceController: scopedRouteControllerPath(
        { ...routeContext, controllerModules: nextControllerModules },
        controllerResourceName
      ),
      resourceName: normalizedResourceName,
      actionScope: undefined
    };
  }

  return undefined;
}

function routeScopeContextFromArguments(
  methodName: string,
  args: readonly Parser.SyntaxNode[]
): {
  moduleName?: string;
  pathName?: string;
} {
  if (methodName === "namespace") {
    const firstArg = args[0] === undefined ? undefined : firstSymbolOrString(args[0]);
    const normalized = firstArg === undefined ? undefined : trimRouteSegment(firstArg);
    if (normalized === undefined || normalized.length === 0) {
      return {};
    }
    return { moduleName: normalized, pathName: normalized };
  }

  if (args.length === 0) {
    return {};
  }

  const pairValues = routeScopePairs(args);
  const moduleName = pairValues.moduleName;
  const pathName = pairValues.pathName;
  if (moduleName === undefined && pathName === undefined) {
    const firstArg = args[0] === undefined ? undefined : firstSymbolOrString(args[0]);
    if (firstArg === undefined) {
      return {};
    }
    const normalized = trimRouteSegment(firstArg);
    return normalized === undefined ? {} : { pathName: normalized };
  }
  return {
    moduleName,
    pathName
  };
}

function routeScopePairs(args: readonly Parser.SyntaxNode[]): { moduleName?: string; pathName?: string } {
  let moduleName: string | undefined;
  let pathName: string | undefined;
  for (const arg of args) {
    if (arg.type !== "pair") {
      continue;
    }
    const key = pairKey(arg);
    const valueNode = arg.childForFieldName("value");
    if (valueNode === null) {
      continue;
    }
    const value = firstSymbolOrString(valueNode) ?? stringValue(valueNode);
    if (value === undefined) {
      continue;
    }
    const normalized = trimRouteSegment(value);
    if (key === "module") {
      moduleName = normalized;
    }
    if (key === "path") {
      pathName = normalized;
    }
  }
  return {
    moduleName: moduleName && moduleName.length > 0 ? moduleName : undefined,
    pathName: pathName && pathName.length > 0 ? pathName : undefined
  };
}

function routeResourceOptionsFromArguments(args: readonly Parser.SyntaxNode[]): RubyResourceRouteOptions | null {
  const options: RubyResourceRouteOptions = {};
  const pairNodes = args.filter((arg) => arg.type === "pair");
  for (const pair of pairNodes) {
    const key = pairKey(pair);
    if (key === undefined || (key !== "module" && key !== "path" && key !== "controller")) {
      continue;
    }
    const valueNode = pair.childForFieldName("value");
    if (valueNode === null) {
      return null;
    }
    const value = firstSymbolOrString(valueNode) ?? stringValue(valueNode);
    if (value === undefined) {
      return null;
    }
    const normalizedValue = trimRouteSegment(value);
    if (normalizedValue.length === 0) {
      return null;
    }
    if (key === "module") {
      options.moduleName = normalizedValue;
    } else if (key === "path") {
      options.pathName = normalizedValue;
    } else if (key === "controller") {
      options.controllerName = normalizedValue;
    }
  }
  return options;
}

function trimRouteSegment(value: string): string {
  return value.replace(/^\/+|\/+$/gu, "").trim();
}

function firstPathComponent(value: string): string {
  return value.split("/").map((segment) => segment.trim()).filter(Boolean).at(-1) ?? value;
}

function requirementReferences(
  methodName: "require" | "require_relative",
  args: readonly Parser.SyntaxNode[],
  sourceQualifiedName: string | undefined
): RubyReference[] {
  const targetArg = args[0];
  if (targetArg === undefined) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: null,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "missing_argument"
      }
    })];
  }
  const target = stringValue(targetArg);
  if (target === undefined) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: targetArg,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "non_literal_argument"
      }
    })];
  }
  return [literalReference({
    kind: methodName === "require" ? "ruby_require" : "ruby_require_relative",
    name: target,
    sourceQualifiedName,
    node: targetArg,
    metadata: {
      declaration_source: "tree-sitter-ruby",
      kind: methodName
    }
  })];
}

function mixinReferences(
  methodName: string,
  args: readonly Parser.SyntaxNode[],
  sourceQualifiedName: string | undefined
): RubyReference[] {
  if (args.length === 0) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: null,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "missing_argument"
      }
    })];
  }

  const kind = methodName === "include"
    ? "ruby_include"
    : methodName === "extend"
      ? "ruby_extend"
      : "ruby_prepend";
  const refs: RubyReference[] = [];
  for (const arg of args) {
    const name = constantName(arg);
    if (name === undefined) {
      refs.push(dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: arg,
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "non_literal_argument",
          mixin_name: methodName
        }
      }));
      continue;
    }
    refs.push(literalReference({
      kind,
      name,
      sourceQualifiedName,
      node: arg,
      metadata: {
        static: true,
        declaration_source: "tree-sitter-ruby",
        mixin_name: methodName
      }
    }));
  }
  return refs;
}

function loadReferences(
  methodName: string,
  argsOnly: readonly Parser.SyntaxNode[],
  sourceQualifiedName: string | undefined,
  argsNode: Parser.SyntaxNode | null
): RubyReference[] {
  if (argsOnly.length === 0) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: argsNode ?? null,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "missing_argument",
        load_form: methodName
      }
    })];
  }

  if (methodName === "load") {
    const loadArg = argsOnly[0] === undefined ? undefined : stringValue(argsOnly[0]);
    if (loadArg === undefined) {
      return [dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: argsOnly[0] ?? null,
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "non_literal_load_target",
          load_form: methodName
        }
      })];
    }
    return [literalReference({
      kind: "ruby_load",
      name: loadArg,
      sourceQualifiedName,
      node: argsOnly[0],
      metadata: {
        declaration_source: "tree-sitter-ruby",
        load_form: methodName,
        load_target: loadArg
      }
    })];
  }

  if (methodName === "autoload" || methodName === "autoload_relative") {
    if (argsOnly.length < 2) {
      return [dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: argsOnly[1] ?? argsOnly[0] ?? null,
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "missing_argument",
          load_form: methodName
        }
      })];
    }
    const autoloadSymbol = argsOnly[0] === undefined ? undefined : constantName(argsOnly[0]) ?? firstSymbolOrString(argsOnly[0]);
    const loadTarget = stringValue(argsOnly[1]);
    if (autoloadSymbol === undefined || loadTarget === undefined) {
      return [dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: argsOnly[1] ?? argsOnly[0] ?? null,
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "non_literal_load_target",
          load_form: methodName
        }
      })];
    }
    return [literalReference({
      kind: "ruby_load",
      name: loadTarget,
      sourceQualifiedName,
      node: argsOnly[1],
      metadata: {
        declaration_source: "tree-sitter-ruby",
        load_form: methodName,
        load_target: loadTarget,
        load_symbol: autoloadSymbol
      }
    })];
  }

  return [dynamicReference({
    name: methodName,
    sourceQualifiedName,
    node: argsNode ?? null,
    metadata: {
      declaration_source: "tree-sitter-ruby",
      static: false,
      reason: "unsupported_load_form",
      load_form: methodName
    }
  })];
}

function visibilityReferences(
  methodName: string,
  args: Parser.SyntaxNode | null,
  sourceQualifiedName: string | undefined,
  methodNode: Parser.SyntaxNode | null
): RubyReference[] {
  const methodArgs = args === null ? [] : args.namedChildren;
  if (methodArgs.length === 0) {
    return [literalReference({
      kind: "ruby_visibility",
      name: methodName,
      sourceQualifiedName,
      node: referenceSourceNode(methodNode, args),
      metadata: {
        declaration_source: "tree-sitter-ruby",
        visibility: methodName,
        visibility_scope: "scope",
        visibility_targets: []
      }
    })];
  }

  const visibilityTargets = methodArgs
    .map((arg) => firstSymbolOrString(arg) ?? identifierName(arg))
    .filter((name): name is string => name !== undefined);
  if (visibilityTargets.length !== methodArgs.length) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: referenceSourceNode(methodNode, args),
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "non_literal_visibility_target",
        visibility: methodName,
        visibility_scope: "scope",
        visibility_targets: visibilityTargets
      }
    })];
  }
  return [literalReference({
    kind: "ruby_visibility",
    name: methodName,
    sourceQualifiedName,
    node: referenceSourceNode(methodNode, args),
    metadata: {
      declaration_source: "tree-sitter-ruby",
      visibility: methodName,
      visibility_scope: "scope",
      visibility_targets: visibilityTargets
    }
  })];
}

function isVisibilityName(methodName: string): boolean {
  return methodName === "private" || methodName === "protected" || methodName === "public";
}

function isLoadName(methodName: string): boolean {
  return STATIC_LOAD_NAMES.has(methodName);
}

function routeReferences(
  methodName: string,
  argsNode: Parser.SyntaxNode | null,
  sourceQualifiedName: string | undefined,
  routeContext: RubyRouteContext,
  sourceFilePath: string | undefined
): RubyReference[] {
  if (argsNode === null) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: null,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "missing_arguments"
      }
    })];
  }
  const args = argsNode.namedChildren;

  if (methodName === "draw") {
    const routeCandidateNode = args[0];
    if (routeCandidateNode === undefined) {
      return [dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: argsNode,
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "missing_draw_target"
        }
      })];
    }
    const routeCandidate = firstSymbolOrString(routeCandidateNode);
    if (routeCandidate === undefined) {
      return [dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: routeCandidateNode,
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "missing_draw_target"
        }
      })];
    }

    const routeFileCandidate = drawRouteFileCandidate(routeCandidate, sourceFilePath);
    if (routeFileCandidate === undefined) {
      return [dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: routeCandidateNode,
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "non_literal_draw_target"
        }
      })];
    }

    return [literalReference({
      kind: "ruby_route",
      name: routeCandidate,
      sourceQualifiedName,
      node: args[0],
      metadata: {
        static: true,
        declaration_source: "tree-sitter-ruby",
        route_form: methodName,
        route_path_prefix: routePathPrefixFromContext(routeContext),
        route_namespace: routeNamespaceFromContext(routeContext),
        route_file_candidate: routeFileCandidate
      }
    })];
  }

  if (methodName === "resources" || methodName === "resource") {
    if (args.length === 0) {
      return [dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: argsNode,
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "missing_resource_name"
        }
      })];
    }
    const resourceName = firstSymbolOrString(args[0]);
    if (resourceName === undefined) {
      return [dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: args[0],
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "non_literal_resource_name"
        }
      })];
    }
    const routeControllerResourceName = methodName === "resource"
      ? routePluralizedResourceName(resourceName)
      : resourceName;
    const resourceRouteOptions = routeResourceOptionsFromArguments(args);
    if (resourceRouteOptions === null) {
      return [dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: args[0],
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          reason: "non_literal_resource_options"
        }
      })];
    }
    const routeResourceName = resourceRouteOptions.pathName === undefined ? resourceName : resourceRouteOptions.pathName;
    const resourceControllerName = resourceRouteOptions.controllerName === undefined
      ? routeControllerResourceName
      : resourceRouteOptions.controllerName;
    const routeResourceControllerModules = resourceRouteOptions.moduleName === undefined
      ? routeContext.controllerModules
      : [...routeContext.controllerModules, resourceRouteOptions.moduleName];
    return [literalReference({
      kind: "ruby_route",
      name: routeResourceName,
      sourceQualifiedName,
      node: args[0],
      metadata: {
        static: true,
        declaration_source: "tree-sitter-ruby",
        route_form: methodName,
        route_scope: scopedRouteName(routeContext, routeResourceName),
        route_namespace: routeNamespaceFromContext({
          ...routeContext,
          controllerModules: routeResourceControllerModules
        }),
        route_path_prefix: routePathPrefixFromContext(routeContext),
        controller_candidate: railsControllerName(scopedRouteControllerPath(
          { ...routeContext, controllerModules: routeResourceControllerModules },
          resourceControllerName
        ))
      }
    })];
  }

  if (methodName === "root") {
    const routeTargetNode = routeTargetPair(args)?.valueNode ?? (args[0] ?? null);
    const rootTarget = routeTargetNode === null ? undefined : stringValue(routeTargetNode);
    const rootReference = literalReference({
      kind: "ruby_route",
      name: "/",
      sourceQualifiedName,
      node: routeTargetNode ?? argsNode,
      metadata: {
        static: true,
        declaration_source: "tree-sitter-ruby",
        route_form: methodName,
        route_path: "/",
        route_namespace: routeNamespaceFromContext(routeContext),
        route_path_prefix: routePathPrefixFromContext(routeContext)
      }
    });
    if (rootTarget === undefined) {
      return [rootReference, dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: routeTargetNode ?? argsNode,
        metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        route_form: methodName,
        route_path: "/",
        route_path_prefix: routePathPrefixFromContext(routeContext),
        reason: "non_literal_route_target"
      }
    })];
    }
    const parsedTarget = railsControllerActionCandidate(rootTarget, routeContext.controllerModules);
    if (parsedTarget === undefined) {
      return [rootReference, dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: routeTargetNode,
        metadata: {
          declaration_source: "tree-sitter-ruby",
        static: false,
        route_form: methodName,
        route_path: "/",
        route_path_prefix: routePathPrefixFromContext(routeContext),
        reason: "non_literal_route_target"
      }
    })];
    }
    return [rootReference, literalReference({
      kind: "ruby_route",
      name: parsedTarget.qualifiedName,
      sourceQualifiedName,
      node: routeTargetNode,
      metadata: {
        static: true,
        declaration_source: "tree-sitter-ruby",
        route_form: methodName,
        route_path: "/",
        route_namespace: routeNamespaceFromContext(routeContext),
        route_path_prefix: routePathPrefixFromContext(routeContext),
        route_controller: parsedTarget.controller,
        route_controller_class: railsControllerName(parsedTarget.controller),
        route_action: parsedTarget.action,
        controller_action_candidate: true
      }
    })];
  }

  if (args.length === 0) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: argsNode,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "missing_route_path"
      }
    })];
  }

  const inferredAction = routeActionMetadata(methodName, args, routeContext);
  if (inferredAction !== undefined) {
    return [literalReference({
      kind: "ruby_route",
      name: `${railsControllerName(inferredAction.controller)}#${inferredAction.action}`,
      sourceQualifiedName,
      node: inferredAction.node,
      metadata: {
        static: true,
        declaration_source: "tree-sitter-ruby",
        route_form: methodName,
        route_path: inferredAction.routePath,
        route_namespace: routeNamespaceFromContext(routeContext),
        route_path_prefix: routePathPrefixFromContext(routeContext),
        route_controller: inferredAction.controller,
        route_controller_class: railsControllerName(inferredAction.controller),
        route_action: inferredAction.action,
        route_action_scope: inferredAction.actionScope,
        controller_action_candidate: true
      }
    })];
  }

  const routePathArgument = extractRoutePathArgument(args);
  if (routePathArgument === undefined) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: args[0] ?? null,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "non_literal_route_path",
        route_path_prefix: routePathPrefixFromContext(routeContext)
      }
    })];
  }
  const routePath = routePathArgument.path;
  const routePathNode = routePathArgument.node;

  const routeReference = literalReference({
    kind: "ruby_route",
    name: routePath,
    sourceQualifiedName,
    node: routePathNode,
    metadata: {
      static: true,
      declaration_source: "tree-sitter-ruby",
      route_form: methodName,
      route_path: routePath,
      route_namespace: routeNamespaceFromContext(routeContext),
      route_path_prefix: routePathPrefixFromContext(routeContext)
    }
  });

  const targetPair = routeTargetPair(args);
  const optionTarget = routeControllerActionOptionTarget(args, routeContext);
  if (optionTarget !== undefined) {
    if (optionTarget === null) {
      return [routeReference, dynamicReference({
        name: methodName,
        sourceQualifiedName,
        node: argsNode,
        metadata: {
          declaration_source: "tree-sitter-ruby",
          static: false,
          route_form: methodName,
          route_path: routePath,
          reason: "non_literal_route_target"
        }
      })];
    }
    return [routeReference, literalReference({
      kind: "ruby_route",
      name: optionTarget.qualifiedName,
      sourceQualifiedName,
      node: argsNode,
      metadata: {
        static: true,
        declaration_source: "tree-sitter-ruby",
        route_form: methodName,
        route_path: routePath,
        route_namespace: routeNamespaceFromContext(routeContext),
        route_path_prefix: routePathPrefixFromContext(routeContext),
        route_controller: optionTarget.controller,
        route_controller_class: railsControllerName(optionTarget.controller),
        route_action: optionTarget.action,
        controller_action_candidate: true
      }
    })];
  }
  if (targetPair === undefined) {
    return [routeReference];
  }
  const targetNode = targetPair.valueNode;
  const target = targetNode === null ? undefined : stringValue(targetNode);
  const parsedTarget = target === undefined ? undefined : railsControllerActionCandidate(target, routeContext.controllerModules);
  if (targetNode === null || parsedTarget === undefined) {
    return [routeReference, dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: targetNode ?? targetPair.pairNode,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        route_form: methodName,
        route_path: routePath,
        route_path_prefix: routePathPrefixFromContext(routeContext),
        reason: "non_literal_route_target"
      }
    })];
  }
  return [routeReference, literalReference({
    kind: "ruby_route",
    name: parsedTarget.qualifiedName,
    sourceQualifiedName,
    node: targetNode,
    metadata: {
      static: true,
      declaration_source: "tree-sitter-ruby",
      route_form: methodName,
      route_path: routePath,
      route_namespace: routeNamespaceFromContext(routeContext),
      route_path_prefix: routePathPrefixFromContext(routeContext),
      route_controller: parsedTarget.controller,
      route_controller_class: railsControllerName(parsedTarget.controller),
      route_action: parsedTarget.action,
      controller_action_candidate: true
    }
  })];
}

function routeControllerActionOptionTarget(
  args: readonly Parser.SyntaxNode[],
  routeContext: RubyRouteContext
): { controller: string; action: string; qualifiedName: string } | null | undefined {
  const controllerPair = args.find((arg) => arg.type === "pair" && pairKey(arg) === "controller");
  const actionPair = args.find((arg) => arg.type === "pair" && pairKey(arg) === "action");
  if (controllerPair === undefined && actionPair === undefined) {
    return undefined;
  }
  const controllerNode = controllerPair?.childForFieldName("value");
  const actionNode = actionPair?.childForFieldName("value");
  if (controllerNode === undefined || controllerNode === null || actionNode === undefined || actionNode === null) {
    return null;
  }
  const controller = firstSymbolOrString(controllerNode) ?? stringValue(controllerNode);
  const action = firstSymbolOrString(actionNode) ?? stringValue(actionNode);
  if (controller === undefined || action === undefined) {
    return null;
  }
  return railsControllerActionCandidate(`${controller}#${action}`, routeContext.controllerModules) ?? null;
}

function routeTargetPair(args: readonly Parser.SyntaxNode[]): {
  pairNode: Parser.SyntaxNode;
  valueNode: Parser.SyntaxNode | null;
} | undefined {
  const toPair = args.find((arg): arg is Parser.SyntaxNode => arg.type === "pair" &&
    pairKey(arg) === "to");
  if (toPair !== undefined) {
    return {
      pairNode: toPair,
      valueNode: toPair.childForFieldName("value")
    };
  }

  const hashRocketPair = extractHashRocketRoutePair(args);
  if (hashRocketPair === undefined) {
    return undefined;
  }

  return {
    pairNode: hashRocketPair.pairNode,
    valueNode: hashRocketPair.valueNode
  };
}

function extractHashRocketRoutePair(args: readonly Parser.SyntaxNode[]): {
  pairNode: Parser.SyntaxNode;
  valueNode: Parser.SyntaxNode;
} | undefined {
  const pairs = args.filter((arg) => arg.type === "pair");
  for (const pair of pairs) {
    const key = pairKey(pair);
    if (key === undefined || key === "to" || key === "via" || key === "as" ||
      key === "constraints" || key === "defaults" || key === "controller" || key === "action") {
      continue;
    }
    const valueNode = pair.childForFieldName("value");
    if (valueNode !== null && stringValue(valueNode) !== undefined) {
      return { pairNode: pair, valueNode };
    }
  }
  return undefined;
}

function extractRoutePathArgument(args: readonly Parser.SyntaxNode[]): {
  path: string;
  node: Parser.SyntaxNode;
} | undefined {
  const first = args[0];
  if (first !== undefined) {
    const firstPath = stringValue(first);
    if (firstPath !== undefined) {
      return { path: firstPath, node: first };
    }
  }
  const hashRocketPair = extractHashRocketRoutePair(args);
  if (hashRocketPair === undefined) {
    return undefined;
  }
  const keyNode = hashRocketPair.pairNode.childForFieldName("key");
  if (keyNode === null) {
    return undefined;
  }
  const routePath = pairLiteralValue(keyNode);
  if (routePath === undefined) {
    return undefined;
  }
  return { path: routePath, node: keyNode };
}

function pairKey(pair: Parser.SyntaxNode): string | undefined {
  const keyNode = pair.childForFieldName("key");
  if (keyNode === null) {
    return undefined;
  }
  return pairLiteralValue(keyNode);
}

function pairLiteralValue(node: Parser.SyntaxNode): string | undefined {
  return firstSymbolOrString(node) ?? stringValue(node);
}

function scopedRouteControllerPath(routeContext: RubyRouteContext, resourceName: string): string {
  const normalizedResourceName = resourceName.replace(/::/gu, "/");
  if (normalizedResourceName.includes("/") || normalizedResourceName.includes("::")) {
    return normalizedResourceName;
  }
  if (routeContext.controllerModules.length === 0) {
    return normalizedResourceName;
  }
  return [...routeContext.controllerModules, normalizedResourceName].join("/");
}

function routeNamespaceFromContext(routeContext: RubyRouteContext): string {
  return routeContext.controllerModules.join("/");
}

function routePathPrefixFromContext(routeContext: RubyRouteContext): string {
  return routeContext.routePathPrefixSegments.join("/");
}

function routeActionMetadata(
  methodName: string,
  args: readonly Parser.SyntaxNode[],
  routeContext: RubyRouteContext
): {
  actionScope: "member" | "collection";
  action: string;
  controller: string;
  routePath: string;
  node: Parser.SyntaxNode;
} | undefined {
  if (methodName !== "get" && methodName !== "post" && methodName !== "put" &&
    methodName !== "patch" && methodName !== "delete") {
    return undefined;
  }
  if (routeContext.resourceController === undefined || routeContext.resourceName === undefined) {
    return undefined;
  }

  const firstArg = args[0];
  if (firstArg === undefined) {
    return undefined;
  }
  const routeAction = firstSymbolOrString(firstArg);
  if (routeAction === undefined || routeAction.includes("/") || routeAction.includes(".") || routeAction.length === 0) {
    return undefined;
  }

  const onScope = routeActionScopeFromArguments(args);
  const actionScope = onScope ?? routeContext.actionScope;
  if (actionScope === undefined) {
    return undefined;
  }
  return {
    actionScope,
    action: routeAction,
    controller: routeContext.resourceController,
    routePath: `/${routeAction}`,
    node: firstArg
  };
}

function routeActionScopeFromArguments(args: readonly Parser.SyntaxNode[]): "member" | "collection" | undefined {
  const onPair = args.find((arg) => arg.type === "pair" && pairKey(arg) === "on");
  if (onPair === undefined) {
    return undefined;
  }
  const onValueNode = onPair.childForFieldName("value");
  if (onValueNode === undefined || onValueNode === null) {
    return undefined;
  }
  const onValue = firstSymbolOrString(onValueNode);
  return onValue === "member" || onValue === "collection" ? onValue : undefined;
}

function drawRouteFileCandidate(routeFile: string, sourceFilePath: string | undefined): string | undefined {
  const normalized = trimRouteSegment(routeFile);
  if (normalized.length === 0) {
    return undefined;
  }
  const withExt = normalized.endsWith(".rb") ? normalized : `${normalized}.rb`;
  if (sourceFilePath === undefined || sourceFilePath.length === 0) {
    return withExt;
  }
  const routeBase = sourceFilePath.replace(/\.rb$/u, "");
  const prefix = sourceFilePath.endsWith("/routes.rb")
    ? `${routeBase}/`
    : routeBase.includes("/")
      ? `${routeBase.substring(0, routeBase.lastIndexOf("/"))}/`
      : "";
  return `${prefix}${withExt}`;
}

function routePluralizedResourceName(rawResourceName: string): string {
  const normalized = rawResourceName.replace(/^\/+|\/+$/gu, "");
  if (normalized.length === 0) {
    return rawResourceName;
  }
  return normalized
    .split("/")
    .filter(Boolean)
    .map(pluralizeResourceNameSegment)
    .join("/");
}

function toPascalCase(input: string): string {
  return input
    .split("_")
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]!.toUpperCase()}${segment.slice(1)}`)
    .join("");
}

function pluralizeResourceNameSegment(resourceName: string): string {
  const normalized = resourceName.trim();
  const lowered = normalized.toLowerCase();
  if (lowered.length === 0 || lowered.includes("::")) {
    return resourceName;
  }
  if (lowered.endsWith("s")) {
    return toPascalCase(resourceName);
  }
  if (lowered.endsWith("y") && lowered.length > 1 &&
    !"aeiou".includes(lowered.charAt(lowered.length - 2))) {
    return `${toPascalCase(resourceName.slice(0, -1))}ies`;
  }
  if (/(ch|sh|x|z)$/u.test(lowered)) {
    return `${toPascalCase(resourceName)}es`;
  }
  return `${toPascalCase(resourceName)}s`;
}

function scopedRouteName(routeContext: RubyRouteContext, routeName: string): string {
  return routeContext.routePathPrefixSegments.length === 0
    ? routeName
    : [...routeContext.routePathPrefixSegments, routeName].join("/");
}

function modelDslReferences(
  methodName: string,
  argsNode: Parser.SyntaxNode | null,
  sourceQualifiedName: string | undefined
): RubyReference[] {
  if (argsNode === null || argsNode.namedChildCount === 0) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: argsNode ?? null,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "missing_model_dsl_argument"
      }
    })];
  }
  const firstArg = argsNode.namedChildren[0];
  const firstName = firstArg === undefined ? undefined : firstSymbolOrString(firstArg);
  if (firstName === undefined) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: firstArg,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "non_literal_model_dsl_argument"
      }
    })];
  }
  const className = modelDslClassNameOption(argsNode);
  if (className === null) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: argsNode,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "non_literal_model_dsl_argument",
        model_form: methodName
      }
    })];
  }
  const metadata: Record<string, unknown> = {
    static: true,
    declaration_source: "tree-sitter-ruby",
    model_form: methodName
  };
  const throughName = modelDslThroughNameOption(argsNode);
  const sourceName = modelDslSourceNameOption(argsNode);
  const sourceTypeName = modelDslSourceTypeOption(argsNode);
  const asName = modelDslAsNameOption(argsNode);
  const polymorphic = modelDslPolymorphicOption(argsNode);
  if (throughName === null || sourceName === null || sourceTypeName === null || asName === null || polymorphic === null) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: argsNode,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "non_literal_model_dsl_argument",
        model_form: methodName
      }
    })];
  }
  if (throughName !== undefined && throughName !== null) {
    metadata.model_through = throughName;
  }
  if (sourceName !== undefined && throughName !== undefined && throughName !== null && sourceName !== null) {
    metadata.model_source = sourceName;
  }
  if (sourceTypeName !== undefined && sourceTypeName !== null) {
    metadata.model_source_type = sourceTypeName;
  }
  if (asName !== undefined && asName !== null) {
    metadata.model_as = asName;
  }
  if (polymorphic === true) {
    metadata.model_polymorphic = true;
  }
  if (className !== undefined) {
    metadata.class_name = className;
  }
  return [literalReference({
    kind: "ruby_model_dsl",
    name: firstName,
    sourceQualifiedName,
    node: firstArg,
    metadata
  })];
}

function modelDslClassNameOption(argsNode: Parser.SyntaxNode): string | null | undefined {
  return modelDslOptionValue(argsNode, "class_name", normalizeModelClassName);
}

function modelDslThroughNameOption(argsNode: Parser.SyntaxNode): string | null | undefined {
  return modelDslOptionValue(argsNode, "through");
}

function modelDslSourceNameOption(argsNode: Parser.SyntaxNode): string | null | undefined {
  return modelDslOptionValue(argsNode, "source");
}

function modelDslSourceTypeOption(argsNode: Parser.SyntaxNode): string | null | undefined {
  return modelDslOptionValue(argsNode, "source_type");
}

function modelDslAsNameOption(argsNode: Parser.SyntaxNode): string | null | undefined {
  return modelDslOptionValue(argsNode, "as");
}

function modelDslPolymorphicOption(argsNode: Parser.SyntaxNode): boolean | undefined {
  const args = argsNode === null ? [] : argsNode.namedChildren;
  const pair = args.find((candidate) => candidate.type === "pair" && pairKey(candidate) === "polymorphic");
  if (pair === undefined) {
    return undefined;
  }
  const valueNode = pair.childForFieldName("value");
  if (valueNode === null) {
    return undefined;
  }
  const value = booleanLiteralValue(valueNode);
  if (value === null) {
    return undefined;
  }
  return value;
}

function modelDslOptionValue(
  argsNode: Parser.SyntaxNode,
  key: string,
  transform?: (input: string) => string
): string | null | undefined {
  const args = argsNode === null ? [] : argsNode.namedChildren;
  const optionPair = args.find((candidate) => candidate.type === "pair" && pairKey(candidate) === key);
  if (optionPair === undefined) {
    return undefined;
  }
  const valueNode = optionPair.childForFieldName("value");
  if (valueNode === null) {
    return null;
  }
  const value = stringValue(valueNode) ?? firstSymbolOrString(valueNode) ?? constantName(valueNode);
  if (value === undefined) {
    return null;
  }
  return transform === undefined ? value : transform(value);
}

function booleanLiteralValue(node: Parser.SyntaxNode): boolean | null {
  if (node.type === "true") {
    return true;
  }
  if (node.type === "false") {
    return false;
  }
  return null;
}

function normalizeModelClassName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes("::")) {
    return trimmed;
  }
  return trimmed
    .replace(/^::+/u, "")
    .replace(/::/gu, ".");
}

function literalReference(input: {
  kind: RubyReference["kind"];
  name: string;
  sourceQualifiedName?: string;
  node: Parser.SyntaxNode;
  metadata: Record<string, unknown>;
}): RubyReference {
  return {
    kind: input.kind,
    name: input.name,
    sourceQualifiedName: input.sourceQualifiedName,
    static: true,
    startLine: input.node.startPosition.row + 1,
    startColumn: input.node.startPosition.column,
    endLine: input.node.endPosition.row + 1,
    endColumn: input.node.endPosition.column,
    metadata: {
      ...input.metadata,
      static: true
    }
  };
}

function dynamicReference(input: {
  name: string;
  sourceQualifiedName?: string;
  node: Parser.SyntaxNode | null;
  metadata: Record<string, unknown>;
}): RubyReference {
  const node = input.node ?? {
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 }
  } as Parser.SyntaxNode;
  return {
    kind: "ruby_dynamic",
    name: input.name,
    sourceQualifiedName: input.sourceQualifiedName,
    static: false,
    startLine: node.startPosition.row + 1,
    startColumn: node.startPosition.column,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column,
    metadata: {
      ...input.metadata,
      static: false
    }
  };
}

function firstSymbolOrString(node: Parser.SyntaxNode): string | undefined {
  if (node.type === "simple_symbol") {
    return node.text.startsWith(":") ? node.text.slice(1) : node.text;
  }
  const symbolValue = node.type === "symbol" ? node.text.replace(/^:/u, "") : undefined;
  if (symbolValue !== undefined) {
    return symbolValue;
  }
  if (node.type === "hash_key_symbol") {
    return node.text.endsWith(":") ? node.text.slice(0, -1) : node.text;
  }
  return stringValue(node);
}

function isVisibilityIdentifier(node: Parser.SyntaxNode): boolean {
  return node.type === "identifier" && (node.text === "private" || node.text === "protected" || node.text === "public");
}

function identifierName(node: Parser.SyntaxNode): string | undefined {
  return node.type === "identifier" ? node.text : undefined;
}

function referenceSourceNode(methodNode: Parser.SyntaxNode | null, argsNode: Parser.SyntaxNode | null): Parser.SyntaxNode {
  const firstArg = argsNode?.namedChildren[0];
  if (methodNode !== null) {
    return methodNode;
  }
  if (firstArg !== undefined && firstArg !== null) {
    return firstArg;
  }
  return {
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 }
  } as Parser.SyntaxNode;
}

function stringValue(node: Parser.SyntaxNode): string | undefined {
  if (node.type !== "string") {
    return undefined;
  }
  const text = node.text;
  if (text.length < 2) {
    return undefined;
  }
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith("\"") && text.endsWith("\""))) {
    return text.slice(1, -1);
  }
  return undefined;
}

function constantName(node: Parser.SyntaxNode): string | undefined {
  if (node.type === "constant" || node.type === "scope_resolution") {
    return declarationNameFromNode(node);
  }
  if (node.type === "identifier") {
    return /^[A-Z]/u.test(node.text) ? node.text : undefined;
  }
  return undefined;
}

function railsControllerActionCandidate(
  target: string,
  routeScope: readonly string[] = []
): {
  controller: string;
  action: string;
  qualifiedName: string;
} | undefined {
  const separator = target.lastIndexOf("#");
  if (separator <= 0 || separator === target.length - 1) {
    return undefined;
  }
  const controller = target.slice(0, separator);
  const action = target.slice(separator + 1);
  if (!/^[a-zA-Z_][a-zA-Z0-9_/]*$/u.test(controller) || !/^[a-zA-Z_][a-zA-Z0-9_!?=]*$/u.test(action)) {
    return undefined;
  }
  const controllerPath = routeScope.length === 0 || controller.includes("/") || controller.includes("::")
    ? controller
    : [...routeScope, controller].join("/");
  return {
    controller: controllerPath,
    action,
    qualifiedName: `${railsControllerName(controllerPath)}#${action}`
  };
}

function railsControllerName(controller: string): string {
  const segments = controller
    .split("/")
    .map((segment) => segment
      .split("_")
      .filter((part) => part.length > 0)
      .map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`)
      .join(""))
    .filter((segment) => segment.length > 0);
  const finalSegment = segments.pop();
  return [...segments, `${finalSegment ?? ""}Controller`].join(".");
}

function isConstantLike(node: Parser.SyntaxNode): boolean {
  return node.type === "constant" || node.type === "scope_resolution";
}

function isRequireName(methodName: string): methodName is "require" | "require_relative" {
  return methodName === "require" || methodName === "require_relative";
}

function firstNamedChildOfType(node: Parser.SyntaxNode | null | undefined, types: readonly string[]): Parser.SyntaxNode | undefined {
  if (node === null || node === undefined) {
    return undefined;
  }
  for (let index = 0; index < node.namedChildCount; index += 1) {
    const child = node.namedChild(index);
    if (child !== null && types.includes(child.type)) {
      return child;
    }
  }
  return undefined;
}

function firstLine(text: string): string | undefined {
  const value = text.split("\n", 1)[0]?.trim();
  return value && value.length > 0 ? value : undefined;
}
