package messaging

import (
	"encoding/json"
	"log"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/daniel-vergaram/flagforge/evaluator/internal/cache"
)

// NATSSubscriber listens to flag change events and invalidates the Redis cache.
type NATSSubscriber struct {
	nc    *nats.Conn
	cache *cache.RedisCache
}

// FlagChangedEvent represents the NATS message payload.
type FlagChangedEvent struct {
	SDKKey  string `json:"sdkKey"`
	FlagKey string `json:"flagKey"`
}

// NewNATSSubscriber connects to NATS and returns a subscriber instance.
func NewNATSSubscriber(addr string, c *cache.RedisCache) (*NATSSubscriber, error) {
	nc, err := nats.Connect(addr, nats.Timeout(5*time.Second), nats.ReconnectWait(2*time.Second))
	if err != nil {
		return nil, err
	}
	return &NATSSubscriber{nc: nc, cache: c}, nil
}

// Subscribe starts the flag.changed subscription. Blocks; call in a goroutine.
func (s *NATSSubscriber) Subscribe() error {
	_, err := s.nc.Subscribe("flag.changed", func(msg *nats.Msg) {
		var evt FlagChangedEvent
		if err := json.Unmarshal(msg.Data, &evt); err != nil {
			log.Printf("nats: failed to unmarshal flag.changed: %v", err)
			return
		}
		if err := s.cache.DeleteFlag(evt.SDKKey, evt.FlagKey); err != nil {
			log.Printf("nats: failed to invalidate cache for %s/%s: %v", evt.SDKKey, evt.FlagKey, err)
			return
		}
		log.Printf("nats: invalidated cache for %s/%s", evt.SDKKey, evt.FlagKey)
	})
	if err != nil {
		return err
	}
	// Keep the connection alive
	select {}
}

// Close drains the NATS connection.
func (s *NATSSubscriber) Close() {
	s.nc.Drain()
}
