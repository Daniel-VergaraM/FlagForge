package cache

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type localCacheEntry struct {
	cfg       *FlagConfig
	expiresAt time.Time
}

type localCache struct {
	mu      sync.RWMutex
	entries map[string]*localCacheEntry
}

func newLocalCache() *localCache {
	return &localCache{
		entries: make(map[string]*localCacheEntry),
	}
}

func (lc *localCache) get(key string) *FlagConfig {
	lc.mu.RLock()
	defer lc.mu.RUnlock()
	entry, ok := lc.entries[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil
	}
	return entry.cfg
}

func (lc *localCache) set(key string, cfg *FlagConfig) {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	lc.entries[key] = &localCacheEntry{
		cfg:       cfg,
		expiresAt: time.Now().Add(60 * time.Second),
	}
}

func (lc *localCache) delete(key string) {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	delete(lc.entries, key)
}

func (lc *localCache) cleanup() {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	now := time.Now()
	for k, v := range lc.entries {
		if now.After(v.expiresAt) {
			delete(lc.entries, k)
		}
	}
}

type RedisCache struct {
	client      *redis.Client
	ctx         context.Context
	local       *localCache
	stopCleanup chan struct{}
}

func NewRedis(addr string) *RedisCache {
	rdb := redis.NewClient(&redis.Options{
		Addr: addr,
		DB:   0,
	})
	rc := &RedisCache{
		client:      rdb,
		ctx:         context.Background(),
		local:       newLocalCache(),
		stopCleanup: make(chan struct{}),
	}
	rc.startCleanup()
	return rc
}

func (c *RedisCache) Close() error {
	close(c.stopCleanup)
	return c.client.Close()
}

func (c *RedisCache) startCleanup() {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				c.local.cleanup()
			case <-c.stopCleanup:
				return
			}
		}
	}()
}

func (c *RedisCache) GetFlag(sdkKey, flagKey string) (*FlagConfig, error) {
	key := "flag:" + sdkKey + ":" + flagKey
	data, err := c.client.Get(c.ctx, key).Result()
	if err == redis.Nil {
		if cfg := c.local.get(key); cfg != nil {
			return cfg, nil
		}
		return nil, nil
	}
	if err != nil {
		if cfg := c.local.get(key); cfg != nil {
			return cfg, nil
		}
		return nil, err
	}
	var cfg FlagConfig
	if err := json.Unmarshal([]byte(data), &cfg); err != nil {
		return nil, err
	}
	c.local.set(key, &cfg)
	return &cfg, nil
}

func (c *RedisCache) SetFlag(sdkKey, flagKey string, cfg *FlagConfig, ttl time.Duration) error {
	key := "flag:" + sdkKey + ":" + flagKey
	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	c.local.set(key, cfg)
	return c.client.Set(c.ctx, key, data, ttl).Err()
}

func (c *RedisCache) DeleteFlag(sdkKey, flagKey string) error {
	key := "flag:" + sdkKey + ":" + flagKey
	c.local.delete(key)
	return c.client.Del(c.ctx, key).Err()
}

// FlagConfig mirrors the flag structure cached by the API
type FlagConfig struct {
	Key               string        `json:"key"`
	Enabled           bool          `json:"enabled"`
	Type              string        `json:"type"`
	Rules             []Rule        `json:"rules,omitempty"`
	RolloutPercentage int           `json:"rolloutPercentage"`
	Variants          []FlagVariant `json:"variants,omitempty"`
}

type Rule struct {
	Attribute string      `json:"attribute"`
	Operator  string      `json:"operator"` // eq, neq, gt, lt, in, contains
	Value     interface{} `json:"value"`
}

type FlagVariant struct {
	Value  interface{} `json:"value"`
	Weight int         `json:"weight"`
}
