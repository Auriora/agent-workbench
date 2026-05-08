export type CacheDecision = {
  hit: boolean;
  value?: unknown;
};

export interface CacheAdapter {
  get(key: string): CacheDecision;
  set(key: string, value: unknown): void;
  invalidate(key: string): void;
  clear(): void;
}

export class NoopCacheAdapter implements CacheAdapter {
  public get(_key: string): CacheDecision {
    return { hit: false };
  }

  public set(_key: string, _value: unknown): void {}

  public invalidate(_key: string): void {}

  public clear(): void {}
}

export function createNoopCacheAdapter(): CacheAdapter {
  return new NoopCacheAdapter();
}
