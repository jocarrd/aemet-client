export interface CacheAdapter {
  get(key: string): Promise<unknown | undefined> | unknown | undefined;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void> | void;
  delete?(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}

export interface CacheConfig {
  adapter: CacheAdapter;
  ttl?: number;
  keyPrefix?: string;
}
