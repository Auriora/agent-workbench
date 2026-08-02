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
  kind: "ruby_require" | "ruby_require_relative" | "ruby_inheritance" | "ruby_constant" | "ruby_call" | "ruby_include" | "ruby_extend" | "ruby_prepend" | "ruby_route" | "ruby_model_dsl" | "ruby_dynamic";
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
const STATIC_MIXIN_NAMES = new Set(["include", "extend", "prepend"]);
const STATIC_ROUTE_NAMES = new Set(["get", "post", "put", "patch", "delete", "resource", "resources", "match"]);
const STATIC_ROUTE_SCOPE_NAMES = new Set(["namespace", "scope"]);
const STATIC_MODEL_DSL_NAMES = new Set([
  "belongs_to",
  "has_many",
  "has_one",
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

  public extractRuby(source: string): RubyExtraction {
    const tree = this.parser.parse(source);
    const declarations: RubyDeclaration[] = [];
    const references: RubyReference[] = [];
    const scopes: RubyScope[] = [];
    const routeScopeStack: string[] = [];
    const classSeen = new Map<string, number>();
    const moduleSeen = new Map<string, number>();

    const visit = (node: Parser.SyntaxNode): void => {
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
        references.push(...referencesFromCall(node, sourceQualifiedName, routeScopeStack, methodName));
        const routeScope = methodName === undefined
          ? undefined
          : staticRouteScope(methodName, args);
        if (routeScope !== undefined) {
          const block = routeCallBlock(node);
          if (block !== null) {
            if (args !== null) {
              visit(args);
            }
            routeScopeStack.push(routeScope);
            visit(block);
            routeScopeStack.pop();
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

export function extractRuby(source: string): RubyExtraction {
  return new RubyParserAdapter().extractRuby(source);
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
  const qualifiedName = parentScope === undefined
    ? "<<self>>"
    : `${parentScope}.<<self>>`;
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
  const scopeQualifiedName = scope?.qualifiedName;
  const separator = scope?.kind === "singleton_class" ? "." : "#";
  const qualifiedName = scopeQualifiedName === undefined ? name : `${scopeQualifiedName}${separator}${name}`;
  const kind = node.type === "singleton_method" ? "singleton_method" : "method";
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
  const block = node.childForFieldName("block") ?? node.childForFieldName("body");
  if (block === null) {
    return null;
  }
  return block.childForFieldName("body") ?? block.childForFieldName("value") ?? block;
}

function staticRouteScope(methodName: string, argsNode: Parser.SyntaxNode | null): string | undefined {
  if (!STATIC_ROUTE_SCOPE_NAMES.has(methodName)) {
    return undefined;
  }
  const args = argsNode === null ? [] : argsNode.namedChildren;
  const scopeArg = args[0];
  if (scopeArg === undefined) {
    return undefined;
  }
  const scope = firstSymbolOrString(scopeArg);
  if (scope === undefined) {
    return undefined;
  }
  const normalized = scope.replace(/^\/+|\/+$/gu, "");
  return normalized.length === 0 ? undefined : normalized;
}

function referencesFromCall(
  node: Parser.SyntaxNode,
  sourceQualifiedName: string | undefined,
  routeScope: readonly string[] = [],
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
  if (STATIC_MIXIN_NAMES.has(methodName)) {
    return mixinReferences(methodName, argsOnly, sourceQualifiedName);
  }
  if (STATIC_ROUTE_NAMES.has(methodName)) {
    return routeReferences(methodName, args, sourceQualifiedName, routeScope);
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

function routeReferences(
  methodName: string,
  argsNode: Parser.SyntaxNode | null,
  sourceQualifiedName: string | undefined,
  routeScope: readonly string[] = []
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
    return [literalReference({
      kind: "ruby_route",
      name: resourceName,
      sourceQualifiedName,
      node: args[0],
      metadata: {
        static: true,
        declaration_source: "tree-sitter-ruby",
        route_form: methodName,
        route_scope: scopedRouteName(routeScope, resourceName),
        route_namespace: routeScope.join("/"),
        controller_candidate: railsControllerName(scopedRouteControllerPath(routeScope, routeControllerResourceName))
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

  const routePathArgument = extractRoutePathArgument(args);
  if (routePathArgument === undefined) {
    return [dynamicReference({
      name: methodName,
      sourceQualifiedName,
      node: args[0] ?? null,
      metadata: {
        declaration_source: "tree-sitter-ruby",
        static: false,
        reason: "non_literal_route_path"
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
      route_namespace: routeScope.join("/")
    }
  });

  const targetPair = routeTargetPair(args);
  if (targetPair === undefined) {
    return [routeReference];
  }
  const targetNode = targetPair.valueNode;
  const target = targetNode === null ? undefined : stringValue(targetNode);
  const parsedTarget = target === undefined ? undefined : railsControllerActionCandidate(target, routeScope);
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
      route_namespace: routeScope.join("/"),
      route_controller: parsedTarget.controller,
      route_controller_class: railsControllerName(parsedTarget.controller),
      route_action: parsedTarget.action,
      controller_action_candidate: true
    }
  })];
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

function scopedRouteControllerPath(routeScope: readonly string[], resourceName: string): string {
  const normalizedResourceName = resourceName.replace(/::/gu, "/");
  if (routeScope.length === 0 || normalizedResourceName.includes("/") || normalizedResourceName.includes("::")) {
    return normalizedResourceName;
  }
  return [...routeScope, normalizedResourceName].join("/");
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

function scopedRouteName(routeScope: readonly string[], routeName: string): string {
  return routeScope.length === 0 ? routeName : [...routeScope, routeName].join("/");
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
  const args = argsNode === null ? [] : argsNode.namedChildren;
  const classNamePair = args.find((candidate) => candidate.type === "pair" && pairKey(candidate) === "class_name");
  if (classNamePair === undefined) {
    return undefined;
  }
  const valueNode = classNamePair.childForFieldName("value");
  if (valueNode === null) {
    return null;
  }
  const value = stringValue(valueNode) ?? constantName(valueNode);
  if (value === undefined) {
    return null;
  }
  return normalizeModelClassName(value);
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
