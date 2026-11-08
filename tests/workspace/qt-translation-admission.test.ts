/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyTypeScriptPrefix,
  FileIdentityAdapter,
  FileCatalogScannerAdapter
} from "../../src/infrastructure/filesystem/index.js";

const qt = `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE TS>\n<TS version="2.1"><context/></TS>\n`;

describe("bounded Qt translation admission", () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it.each([
    '<?xml version="1.0"?><TS nonsense>',
    '<?xml version="1.0"?><TS/garbage>',
    '<?xml version="1.0"?><TS a="a"b="b">',
    '<?xml version="1.0"?><TS a="a" a="b">',
    '<?xml version="1.0"?><TS a="<">',
    '<?xml version="1.0"?><TS a="\u0000">',
    '<?xml version="1.0"?><!--x---><TS/>',
    '<?xml version="1.0"?><!--\u0000--><TS/>',
    '<?xml version="1.0"?><?qt \u0001?><TS/>',
    '<?xml version="1.0"?><TS language="a&b">',
    '<?xml version="1.0"?><TS language="&unknown;">',
    '<?xml version="1.0"?><TS language="&#0;">',
    '<?xml version="1.0" encoding="US-ASCII"?><TS language="é">',
    '\uFEFF\uFEFF<?xml version="1.0"?><TS/>',
    '\uFEFF\uFEFF\uFEFF<!DOCTYPE TS><TS/>',
    '<?xml version="1.0" encoding="UTF-16"?><TS/>',
    '<?xml version="1.0" encoding="ISO-8859-1"?><TS/>',
    '<?xml version="1.0"?><?xml version="1.0"?><TS/>',
    '<!DOCTYPE TS><?xml version="1.0"?><TS/>',
    '<!DOCTYPE TS><!DOCTYPE TS><TS/>',
    '<!DOCTYPE TS SYSTEM "https://example.invalid/qt.dtd"><TS/>',
    '<!DOCTYPE\u00a0TS><TS/>',
    '<?xml\u00a0version="1.0"?><TS/>',
    '<?xml version="1.0"?><ts/>',
    '<?xml version="1.0"?><TSource/>',
    '<?xml version="1.0"?><!-- incomplete <TS/>',
    '<?xml version="1.0"?><?XML reserved?><TS/>'
  ])("retains extension admission for unsupported or malformed prefix %s", prefix => {
    expect(classifyTypeScriptPrefix(prefix)).toBe("typescript");
  });

  it.each(["uTf-8", "Us-AsCiI", "AsCiI"])("accepts supported encoding spelling %s", encoding => {
    expect(classifyTypeScriptPrefix(`<?xml version="1.0" encoding="${encoding}"?><TS/>`)).toBe("qt-translation");
  });

  it("preserves quoted entity spellings without expanding them", () => {
    expect(classifyTypeScriptPrefix('<?xml version="1.0"?><TS language="a&amp;b&#65;&#x41;&quot;&apos;&lt;&gt;">'))
      .toBe("qt-translation");
    expect(classifyTypeScriptPrefix('<?xml version="1.0" encoding="UTF-8"?><TS language="é">'))
      .toBe("qt-translation");
    expect(classifyTypeScriptPrefix('\uFEFF<?xml version="1.0" encoding="US-ASCII" standalone="yes"?><TS/>'))
      .toBe("qt-translation");
    expect(classifyTypeScriptPrefix("<?xml version='1.1' standalone='no'?><TS/>"))
      .toBe("qt-translation");
    expect(classifyTypeScriptPrefix(qt + '\uFFFD\u0000')).toBe("qt-translation");
  });

  it("accepts the supported bounded prolog and preserves strict XML boundaries", () => {
    expect(classifyTypeScriptPrefix(`\ufeff  <?xml version='1.0' encoding='UTF-8'?>\n<!-- comment -->\n<?qt data?>\n<TS version="2.1">`)).toBe("qt-translation");
    expect(classifyTypeScriptPrefix("<?xml version=\"1.0\"?><?qt a?b?><TS/>" )).toBe("qt-translation");
    expect(classifyTypeScriptPrefix("<!DOCTYPE TS>\n<TS/>" )).toBe("qt-translation");
    expect(classifyTypeScriptPrefix("<?xml version=\"1.0\"?><TS attr=\"x>y\">" )).toBe("qt-translation");
    expect(classifyTypeScriptPrefix("<TS>" )).toBe("typescript");
    expect(classifyTypeScriptPrefix("<?xml version=\"1.0\"?><TS / >" )).toBe("typescript");
    expect(classifyTypeScriptPrefix("<!DOCTYPE TS [<!ENTITY x 'y'>]><TS>" )).toBe("typescript");
    expect(classifyTypeScriptPrefix("<?xml version=\"1.0\"?><TS attr=\"unterminated>" )).toBe("typescript");
    expect(classifyTypeScriptPrefix("const xml = '<TS>';") ).toBe("typescript");
  });

  it("classifies only complete UTF-8 prefixes inside the 16 KiB boundary", () => {
    const rootPrefix = "<?xml version=\"1.0\"?><TS version=\"";
    const exact = `${rootPrefix}${"2".repeat(16_384 - Buffer.byteLength(rootPrefix) - 2)}\">`;
    expect(Buffer.byteLength(exact)).toBe(16_384);
    expect(classifyTypeScriptPrefix(exact)).toBe("qt-translation");
    const beyond = `${rootPrefix}${"2".repeat(16_384 - Buffer.byteLength(rootPrefix) - 1)}\">`;
    expect(Buffer.byteLength(beyond)).toBe(16_385);
    expect(classifyTypeScriptPrefix(beyond)).toBe("typescript");
    expect(classifyTypeScriptPrefix(`${qt}${"x".repeat(20_000)}`)).toBe("qt-translation");
    expect(classifyTypeScriptPrefix(`${exact}\ufffd`)).toBe("qt-translation");
    const invalid = '<?xml version="1.0"?><TS language="\ufffd">';
    expect(classifyTypeScriptPrefix(invalid)).toBe("typescript");
  });

  it("routes positive Qt files to xml while preserving extension-only inference", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-qt-"));
    roots.push(root);
    fs.writeFileSync(path.join(root, "qt.ts"), qt);
    fs.writeFileSync(path.join(root, "real.ts"), "export const value = 1;\n");
    fs.writeFileSync(path.join(root, "comment.ts"), "// <TS> in a comment\nexport const value = 2;\n");
    fs.writeFileSync(path.join(root, "long.ts"), `${"/".repeat(16_500)}\n<TS>`);
    fs.writeFileSync(path.join(root, "invalid.ts"), Buffer.from("<?xml version=\"1.0\"?><TS version=\"x\x80\">\n", "binary"));

    const identity = new FileIdentityAdapter();
    expect(await identity.inferLanguage({ path: path.join(root, "qt.ts"), content: qt })).toBe("xml");
    expect(await identity.inferLanguage({ path: path.join(root, "real.ts"), content: "export const value = 1;" })).toBe("typescript");
    expect(await identity.inferLanguage({ path: path.join(root, "qt.ts") })).toBe("typescript");
    expect(await identity.compute({ path: path.join(root, "qt.ts"), content: qt })).toMatchObject({ language: "xml" });

    const result = await new FileCatalogScannerAdapter().scan({
      repo_root: root,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });
    expect(result.files.find((file) => file.path === "qt.ts")?.file_identity.language).toBe("xml");
    expect(result.files.find((file) => file.path === "real.ts")?.file_identity.language).toBe("typescript");
    expect(result.files.find((file) => file.path === "comment.ts")?.file_identity.language).toBe("typescript");
    expect(result.files.find((file) => file.path === "long.ts")?.file_identity.language).toBe("typescript");
    expect(result.files.find((file) => file.path === "invalid.ts")?.file_identity.language).toBe("typescript");
  });

  it("reads at most one 16 KiB prefix at offset zero for .ts and leaves .tsx unprobed", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-qt-read-bound-"));
    roots.push(root);
    fs.writeFileSync(path.join(root, "large.ts"), qt + " ".repeat(32_000));
    fs.writeFileSync(path.join(root, "component.tsx"), "export const value = 1;");
    const read = vi.spyOn(fs, "readSync");
    const result = await new FileCatalogScannerAdapter().scan({
      repo_root: root, indexed_roots: ["."], skipped_roots: [], max_files: 10
    });
    expect(result.files.find(file => file.path === "large.ts")?.file_identity.language).toBe("xml");
    expect(read).toHaveBeenCalledExactlyOnceWith(expect.any(Number), expect.any(Buffer), 0, 16_384, 0);
  });

  it("rejects unsupported encoding in the signature and ignores a split body character after it", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-qt-encoding-"));
    roots.push(root);
    fs.writeFileSync(path.join(root, "utf16.ts"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(qt, "utf16le")]));
    fs.writeFileSync(path.join(root, "double-bom.ts"), '\uFEFF\uFEFF' + qt);
    const split = Buffer.concat([Buffer.from(qt + " ".repeat(16_383 - Buffer.byteLength(qt))), Buffer.from("é")]);
    fs.writeFileSync(path.join(root, "split.ts"), split);
    const result = await new FileCatalogScannerAdapter().scan({
      repo_root: root, indexed_roots: ["."], skipped_roots: [], max_files: 10
    });
    expect(result.files).toHaveLength(3);
    expect(result.files.find(file => file.path === "utf16.ts")?.file_identity.language).toBe("typescript");
    expect(result.files.find(file => file.path === "double-bom.ts")?.file_identity.language).toBe("typescript");
    expect(result.files.find(file => file.path === "split.ts")?.file_identity.language).toBe("xml");
  });

  it("propagates unexpected prefix I/O failures and closes the descriptor", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-qt-io-"));
    roots.push(root);
    fs.writeFileSync(path.join(root, "broken.ts"), qt);
    const failure = Object.assign(new Error("I/O failure"), { code: "EIO" });
    vi.spyOn(fs, "readSync").mockImplementation(() => { throw failure; });
    const close = vi.spyOn(fs, "closeSync");
    await expect(new FileCatalogScannerAdapter().scan({
      repo_root: root, indexed_roots: ["."], skipped_roots: [], max_files: 10
    })).rejects.toBe(failure);
    expect(close).toHaveBeenCalledExactlyOnceWith(expect.any(Number));
  });

  it("rejects a priority symlink that resolves outside the repository", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-qt-"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-qt-outside-"));
    roots.push(root, outside);
    fs.writeFileSync(path.join(outside, "outside.ts"), qt);
    fs.symlinkSync(path.join(outside, "outside.ts"), path.join(root, "escape.ts"));
    const result = await new FileCatalogScannerAdapter().scan({
      repo_root: root,
      indexed_roots: ["."],
      skipped_roots: [],
      priority_paths: ["escape.ts"],
      max_files: 100
    });
    expect(result.files).toEqual([]);
    expect(result.skipped_paths).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "escape.ts", reason: "workspace_escape" })
    ]));
  });

  it("keeps containment valid when the repository itself is opened through a symlink", async () => {
    const actual = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-qt-owned-"));
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-qt-alias-"));
    const alias = path.join(parent, "checkout");
    roots.push(actual, parent);
    fs.writeFileSync(path.join(actual, "translations.ts"), qt);
    fs.symlinkSync(actual, alias, "dir");
    const result = await new FileCatalogScannerAdapter().scan({
      repo_root: alias,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });
    expect(result.files.find((file) => file.path === "translations.ts")?.file_identity.language).toBe("xml");
    expect(result.skipped_paths?.some((entry) => entry.reason === "workspace_escape")).toBe(false);
  });

  it("opens the canonical checked target for a contained .ts symlink", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-qt-canonical-read-"));
    roots.push(root);
    const target = path.join(root, "actual.ts"), alias = path.join(root, "alias.ts");
    fs.writeFileSync(target, qt);
    fs.symlinkSync(target, alias);
    const open = vi.spyOn(fs, "openSync");
    const result = await new FileCatalogScannerAdapter().scan({
      repo_root: root, indexed_roots: ["alias.ts"], skipped_roots: [], max_files: 10
    });
    expect(result.files[0]).toMatchObject({ path: "alias.ts", file_identity: { language: "xml" } });
    expect(open).toHaveBeenCalledWith(fs.realpathSync(target), "r");
    expect(open.mock.calls.some(([file]) => String(file) === alias)).toBe(false);
  });

  it("retains a structured permission outcome when bounded evidence is unreadable", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-qt-read-"));
    roots.push(root);
    const target = path.join(root, "blocked.ts");
    fs.writeFileSync(target, qt);
    const originalOpen = fs.openSync;
    const openSpy = vi.spyOn(fs, "openSync").mockImplementation(((filePath: fs.PathLike, ...args: unknown[]) => {
      if (String(filePath) === target) {
        const error = new Error("permission denied") as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      return (originalOpen as (...callArgs: unknown[]) => number)(filePath, ...args);
    }) as typeof fs.openSync);
    try {
      const result = await new FileCatalogScannerAdapter().scan({
        repo_root: root,
        indexed_roots: ["."],
        skipped_roots: [],
        max_files: 100
      });
      expect(result.files).toEqual([]);
      expect(result.skipped_paths).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "blocked.ts", reason: "permission_denied" })
      ]));
    } finally {
      openSpy.mockRestore();
    }
  });
});
