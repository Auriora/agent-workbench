/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ExtractorPort, ExtractorRegistryPort } from "../../ports/index.js";

export class ExtractorRegistryAdapter implements ExtractorRegistryPort {
  private readonly extractors = new Map<string, ExtractorPort>();

  public register(input: ExtractorPort): void {
    this.extractors.set(input.language, input);
  }

  public unregister(input: { language: string }): void {
    this.extractors.delete(input.language);
  }

  public resolve(input: { language: string }): ExtractorPort | null {
    return this.extractors.get(input.language) ?? null;
  }

  public async availableLanguages(): Promise<readonly string[]> {
    return Array.from(this.extractors.keys()).sort();
  }
}
