/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type WorkerTask<T = void> = () => Promise<T> | T;

export type WorkerResult<T = void> = {
  value: T;
};

export class NoopWorkerAdapter {
  public async run<T>(task: WorkerTask<T>): Promise<WorkerResult<T>> {
    const value = await Promise.resolve(task());
    return { value };
  }
}

export function createNoopWorkerAdapter(): NoopWorkerAdapter {
  return new NoopWorkerAdapter();
}
