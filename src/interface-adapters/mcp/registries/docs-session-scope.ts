export type DocsSessionScopeState = {
  scope_path?: string;
};

export function normalizeDocsSessionScopePath(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/u, "");
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    return undefined;
  }
  return normalized;
}

export function requestWithSessionDocsScope<T extends { scope_path?: string }>(
  request: T,
  sessionScope?: DocsSessionScopeState
): T {
  if (request.scope_path !== undefined || sessionScope?.scope_path === undefined) {
    return request;
  }
  return {
    ...request,
    scope_path: sessionScope.scope_path
  };
}
