export type ConfigResource = {
  path: string;
  kind: "package" | "python_project" | "generic";
};

export function classifyConfigPath(path: string): ConfigResource["kind"] {
  if (path.endsWith("package.json")) {
    return "package";
  }
  if (path.endsWith("pyproject.toml")) {
    return "python_project";
  }
  return "generic";
}
