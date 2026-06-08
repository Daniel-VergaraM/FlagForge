package stream

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Event represents an SSE event payload.
type Event struct {
	Type    string `json:"type"`
	SDKKey  string `json:"sdkKey"`
	FlagKey string `json:"flagKey"`
	Enabled *bool  `json:"enabled,omitempty"`
}

// Subscriber is an active SSE connection.
type Subscriber struct {
	sdkKey string
	send   chan []byte
	done   chan struct{}
}

// Manager keeps track of SSE subscribers grouped by SDK key.
type Manager struct {
	mu          sync.RWMutex
	subscribers map[string][]*Subscriber
}

// NewManager creates a new stream manager.
func NewManager() *Manager {
	return &Manager{
		subscribers: make(map[string][]*Subscriber),
	}
}

// Subscribe registers a new subscriber for a given SDK key.
func (m *Manager) Subscribe(sdkKey string) *Subscriber {
	m.mu.Lock()
	defer m.mu.Unlock()

	sub := &Subscriber{
		sdkKey: sdkKey,
		send:   make(chan []byte, 10),
		done:   make(chan struct{}),
	}
	m.subscribers[sdkKey] = append(m.subscribers[sdkKey], sub)
	return sub
}

// Unsubscribe removes a subscriber.
func (m *Manager) Unsubscribe(sub *Subscriber) {
	m.mu.Lock()
	defer m.mu.Unlock()

	close(sub.done)
	subs := m.subscribers[sub.sdkKey]
	for i, s := range subs {
		if s == sub {
			m.subscribers[sub.sdkKey] = append(subs[:i], subs[i+1:]...)
			break
		}
	}
}

// Broadcast sends an event to all subscribers of the given SDK key.
func (m *Manager) Broadcast(sdkKey string, evt Event) {
	m.mu.RLock()
	subs := m.subscribers[sdkKey]
	m.mu.RUnlock()

	data, err := json.Marshal(evt)
	if err != nil {
		log.Printf("stream: failed to marshal event: %v", err)
		return
	}

	for _, sub := range subs {
		select {
		case sub.send <- data:
		default:
			// Slow consumer; drop event to avoid blocking
		}
	}
}

// Handler returns a Fiber handler for the /stream endpoint.
func (m *Manager) Handler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		sdkKey := c.Query("sdkKey")
		if sdkKey == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "sdkKey required"})
		}

		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")
		c.Set("X-Accel-Buffering", "no")

		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			sub := m.Subscribe(sdkKey)
			defer m.Unsubscribe(sub)

			// Send initial comment to keep connection alive
			fmt.Fprintf(w, ":ok\n\n")
			w.Flush()

			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case data := <-sub.send:
					fmt.Fprintf(w, "data: %s\n\n", data)
					w.Flush()
				case <-ticker.C:
					fmt.Fprintf(w, ":heartbeat\n\n")
					w.Flush()
				case <-sub.done:
					return
				}
			}
		})

		return nil
	}
}
