import { LruCache } from '../src/cache/lru-cache';

describe('LruCache', () => {
  let cache: LruCache;

  beforeEach(() => {
    cache = new LruCache(3, 1000);
  });

  afterEach(() => {
    cache.clear();
  });

  it('stores and retrieves a value', () => {
    cache.set('flag-a', { enabled: true });
    const entry = cache.get('flag-a');
    expect(entry).toBeDefined();
    expect(entry?.result.enabled).toBe(true);
  });

  it('returns undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('evicts oldest entry when max size is exceeded', () => {
    cache.set('a', { enabled: true });
    cache.set('b', { enabled: true });
    cache.set('c', { enabled: true });
    cache.set('d', { enabled: true }); // exceeds maxSize 3

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
    expect(cache.get('d')).toBeDefined();
  });

  it('refreshes LRU order on get', () => {
    cache.set('a', { enabled: true });
    cache.set('b', { enabled: true });
    cache.set('c', { enabled: true });

    // Access 'a' to refresh it
    cache.get('a');

    // Add 'd' — should evict 'b' (oldest untouched)
    cache.set('d', { enabled: true });
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    const shortCache = new LruCache(10, 50);
    shortCache.set('flag', { enabled: true });

    expect(shortCache.get('flag')).toBeDefined();

    // Wait for TTL to expire
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(shortCache.get('flag')).toBeUndefined();
        shortCache.clear();
        resolve(undefined);
      }, 60);
    });
  });

  it('deletes a specific key', () => {
    cache.set('flag', { enabled: true });
    expect(cache.delete('flag')).toBe(true);
    expect(cache.get('flag')).toBeUndefined();
  });

  it('returns correct size', () => {
    expect(cache.size()).toBe(0);
    cache.set('a', { enabled: true });
    expect(cache.size()).toBe(1);
  });
});
