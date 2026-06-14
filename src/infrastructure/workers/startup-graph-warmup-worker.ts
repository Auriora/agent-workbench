import { parentPort, workerData } from "node:worker_threads";
import { indexRepositoryGraph } from "../../application/use-cases/index-repository-graph.js";
import { SCHEMA_VERSION, openGraphStore } from "../sqlite/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../filesystem/index.js";
import {
  ExtractorRegistryAdapter,
  ResourceExtractorAdapter
} from "../extraction/index.js";
import {
  CppDeclarationExtractorAdapter,
  GoDeclarationExtractorAdapter,
  JavaScriptTypeScriptTreeSitterExtractorAdapter,
  PythonTreeSitterExtractorAdapter
} from "../tree-sitter/index.js";
import { SystemClockAdapter } from "../time/index.js";

type StartupGraphWarmupWorkerData = {
  repoRoot: string;
  databasePath: string;
  snapshotId: string;
  configIdentity: string;
  maxFiles: number;
  retainLatestSnapshots: number;
  retainLatestFreshSnapshots: number;
  vacuum: boolean;
};

const input = workerData as StartupGraphWarmupWorkerData;
const scanner = new FileCatalogScannerAdapter();
const workspace = new WorkspaceFileAdapter({ repoRoot: input.repoRoot });
const graphStore = openGraphStore(input.databasePath);
const extractors = new ExtractorRegistryAdapter();
extractors.register(new CppDeclarationExtractorAdapter({ language: "c" }));
extractors.register(new CppDeclarationExtractorAdapter({ language: "cpp" }));
extractors.register(new GoDeclarationExtractorAdapter());
extractors.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "javascript" }));
extractors.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "typescript" }));
extractors.register(new PythonTreeSitterExtractorAdapter());

try {
  const result = await indexRepositoryGraph({
    repo_root: input.repoRoot,
    scanner,
    workspace,
    extractors,
    resource_extractor: new ResourceExtractorAdapter(),
    graph: graphStore,
    catalog: graphStore,
    docs_index: graphStore,
    snapshots: graphStore,
    clock: new SystemClockAdapter(),
    schema_version: SCHEMA_VERSION,
    snapshot_id: input.snapshotId,
    config_identity: input.configIdentity,
    max_files: input.maxFiles
  });
  await graphStore.pruneRepositorySnapshots({
    repo_root: input.repoRoot,
    retain_latest_snapshots: input.retainLatestSnapshots,
    retain_latest_fresh_snapshots: input.retainLatestFreshSnapshots,
    vacuum: input.vacuum
  });
  parentPort?.postMessage({ type: "complete", result });
} finally {
  graphStore.close();
}
