/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Worker } from "node:worker_threads";

export type HeldSqliteLock = {
  done: Promise<void>;
  release: () => void;
  released: boolean;
};

export async function holdExclusiveSqliteLockUntilReleased(
  databasePath: string
): Promise<HeldSqliteLock> {
  const worker = new Worker(
    `
      const { parentPort, workerData } = require("node:worker_threads");
      const Database = require("better-sqlite3");
      const db = new Database(workerData.databasePath, { timeout: 5000 });
      db.exec("CREATE TABLE IF NOT EXISTS lock_probe(id INTEGER); BEGIN EXCLUSIVE; INSERT INTO lock_probe(id) VALUES (1);");
      parentPort.postMessage({ state: "locked" });
      parentPort.once("message", (message) => {
        if (message !== "release") {
          return;
        }
        db.exec("COMMIT");
        db.close();
        parentPort.postMessage({ state: "released" });
      });
    `,
    {
      eval: true,
      workerData: {
        databasePath
      }
    }
  );
  let released = false;
  const done = new Promise<void>((resolve, reject) => {
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`SQLite lock worker exited with code ${code}.`));
    });
  });

  await new Promise<void>((resolve, reject) => {
    worker.on("message", (message: { state?: string }) => {
      if (message.state === "locked") {
        resolve();
      }
      if (message.state === "released") {
        released = true;
      }
    });
    worker.once("error", reject);
  });

  return {
    done,
    release() {
      if (released) {
        return;
      }
      released = true;
      worker.postMessage("release");
    },
    get released() {
      return released;
    }
  };
}
