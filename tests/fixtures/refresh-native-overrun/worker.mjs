/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { parentPort, workerData } from "node:worker_threads";

const state = new Int32Array(workerData.testState);
const enter = () => {
  Atomics.store(state, 0, 1);
  parentPort.postMessage({
    type: "progress",
    progress: {
      execution_id: workerData.executionId,
      target_snapshot_id: workerData.snapshotId,
      phase: "extraction",
      completed_units: 0
    }
  });
};

if (workerData.testMode === "native-wait") {
  // Deterministic surrogate for a synchronous native call which cannot consult
  // the worker's cooperative extraction budget while it is on the stack.
  enter();
  Atomics.wait(state, 1, 0);
  Atomics.store(state, 0, 2);
} else if (workerData.testMode === "python-parse") {
  const { register } = await import("tsx/esm/api");
  register({ parentURL: import.meta.url });
  const { default: Parser } = await import("tree-sitter");
  const originalParse = Parser.prototype.parse;
  // Instrument the actual canonical binding, not a substitute parser. A state
  // of 1 means the wrapped synchronous native invocation has not returned.
  Parser.prototype.parse = function (...args) {
    enter();
    const result = Reflect.apply(originalParse, this, args);
    Atomics.store(state, 0, 2);
    return result;
  };
  const { PythonTreeSitterExtractorAdapter } = await import(workerData.testExtractorUrl);
  const statement = "def work():\n    return target()\n";
  const content = statement.repeat(Math.floor(1_900_000 / statement.length));
  Atomics.store(state, 2, Buffer.byteLength(content, "utf8"));
  await new PythonTreeSitterExtractorAdapter().extract({
    snapshot_id: workerData.snapshotId,
    path: "long-native-parse.py",
    language: "python",
    content
  });
} else {
  throw new Error("Unknown native-overrun test mode.");
}

// The parent must terminate the non-yielding operation before it can produce a
// success result. This branch deliberately uses the real worker result shape.
parentPort.postMessage({
  type: "complete",
  result: {
    outcome: "complete",
    execution_id: workerData.executionId,
    target_snapshot_id: workerData.snapshotId,
    completed_generation: workerData.invalidationGeneration
  }
});
