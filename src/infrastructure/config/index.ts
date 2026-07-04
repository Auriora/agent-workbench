/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ConfigResource = {
  path: string;
  kind: "package" | "python_project" | "generic";
};

export class ConfigPathClassifier {
  classify(path: string): ConfigResource["kind"] {
    return classifyConfigPath(path);
  }
}

export function classifyConfigPath(path: string): ConfigResource["kind"] {
  if (path.endsWith("package.json")) {
    return "package";
  }
  if (path.endsWith("pyproject.toml")) {
    return "python_project";
  }
  return "generic";
}
