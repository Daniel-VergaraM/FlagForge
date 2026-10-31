package messaging

import (
	"encoding/json"
	"log"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/daniel-vergaram/flagforge/evaluator/internal/cache"
	"github.com/daniel-vergaram/flagforge/evaluator/internal/stream"
)

// NATSSubscriber listens to flag change events and invalidates the Redis cache.
type NATSSubscriber struct {
	nc     *nats.Conn
	cache  *cache.RedisCache
	stream *stream.Manager
}

// FlagChangedEvent represents the NATS message payload.
type FlagChangedEvent struct {
	SDKKey  string `json:"sdkKey"`
	FlagKey string `json:"flagKey"`
}

// NewNATSSubscriber connects to NATS and returns a subscriber instance.
// Reconnection is handled natively by nats.go: RetryOnFailedConnect lets the
// initial connect succeed (and keep retrying in the background) even if NATS
// isn't reachable yet, and MaxReconnects(-1) means a connection drop after
// startup is retried forever (every ReconnectWait, 2s) instead of giving up
// after the default 60 attempts and requiring a pod restart.
func NewNATSSubscriber(addr string, c *cache.RedisCache, mgr *stream.Manager) (*NATSSubscriber, error) {
	nc, err := nats.Connect(addr,
		nats.Timeout(5*time.Second),
		nats.ReconnectWait(2*time.Second),
		nats.MaxReconnects(-1),
		nats.RetryOnFailedConnect(true),
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			log.Printf("nats: disconnected, will keep retrying: %v", err)
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			log.Printf("nats: reconnected to %s", nc.ConnectedUrl())
		}),
		nats.ClosedHandler(func(_ *nats.Conn) {
			log.Printf("nats: connection closed, no further reconnect attempts")
		}),
	)
	if err != nil {
		return nil, err
	}
	return &NATSSubscriber{nc: nc, cache: c, stream: mgr}, nil
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

		// Broadcast SSE event to all connected clients for this SDK key
		if s.stream != nil {
			s.stream.Broadcast(evt.SDKKey, stream.Event{
				Type:    "flag.changed",
				SDKKey:  evt.SDKKey,
				FlagKey: evt.FlagKey,
			})
		}
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
