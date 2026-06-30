import { register } from "tsx/esm/api";

register({ parentURL: import.meta.url });

// The MCP server depends on native modules (tree-sitter, better-sqlite3) that
// npm compiles from source on install. When that build is missing or was built
// against a different Node ABI, the import below throws a low-level loader error
// that reads like a server bug. It is not: it is a local toolchain/build issue,
// and per spec 033 it is the user's to resolve. Surface an actionable hint at
// the one place the user actually hits it — server launch — then rethrow.
try {
  await import("./stdio.ts");
} catch (error) {
  const message = String(error?.message ?? error);
  const isNativeLoadError =
    /\.node\b|ERR_DLOPEN|node-gyp|node_gyp_build|tree-sitter|better-sqlite3|was compiled against|NODE_MODULE_VERSION|invalid ELF|Module did not self-register/i.test(
      message
    );
  if (isNativeLoadError) {
    process.stderr.write(
      [
        "agent-workbench: failed to load a native module — this is a local build/toolchain issue, not a server bug.",
        "Fix it by ensuring Python 3 and a C/C++ build toolchain are installed, then rebuild the native modules:",
        "  npm rebuild tree-sitter better-sqlite3        # or, from a source checkout: pnpm rebuild:native",
        "On Node 24 the tree-sitter core needs C++20: use Node 22, or rebuild with CXXFLAGS=-std=c++20 (CL=/std:c++20 on Windows).",
        "",
        `Original error: ${message}`,
        ""
      ].join("\n")
    );
  }
  throw error;
}
