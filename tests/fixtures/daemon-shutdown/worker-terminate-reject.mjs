/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// This preload is intentionally test-only. It exercises the real daemon's
// unconfirmed-worker branch without adding a production mode or alternate
// termination path. NODE_OPTIONS applies to the daemon child launched by the
// entrypoint helper; normal refresh execution remains unchanged.
import { Worker } from "node:worker_threads";

const originalTerminate = Worker.prototype.terminate;
if (typeof originalTerminate === "function") {
  Worker.prototype.terminate = function terminateForShutdownFixture() {
    return Promise.reject(new Error("fixture refused worker termination"));
  };
}
