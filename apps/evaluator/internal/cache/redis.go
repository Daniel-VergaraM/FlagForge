package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisCache struct {
	client *redis.Client
	ctx    context.Context
}

func NewRedis(addr string) *RedisCache {
	rdb := redis.NewClient(&redis.Options{
		Addr: addr,
		DB:   0,
	})
	return &RedisCache{client: rdb, ctx: context.Background()}
}

func (c *RedisCache) Close() error {
	return c.client.Close()
}

func (c *RedisCache) GetFlag(sdkKey, flagKey string) (*FlagConfig, error) {
	key := "flag:" + sdkKey + ":" + flagKey
	data, err := c.client.Get(c.ctx, key).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var cfg FlagConfig
	if err := json.Unmarshal([]byte(data), &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (c *RedisCache) SetFlag(sdkKey, flagKey string, cfg *FlagConfig, ttl time.Duration) error {
	key := "flag:" + sdkKey + ":" + flagKey
	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, ttl).Err()
}

// FlagConfig mirrors the flag structure cached by the API
type FlagConfig struct {
	Key               string          `json:"key"`
	Enabled           bool            `json:"enabled"`
	Type              string          `json:"type"`
	Rules             []Rule          `json:"rules,omitempty"`
	RolloutPercentage int             `json:"rolloutPercentage"`
	Variants          []FlagVariant   `json:"variants,omitempty"`
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
