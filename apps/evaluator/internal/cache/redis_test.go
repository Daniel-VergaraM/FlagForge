package cache

import (
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
)

func newTestCache(t *testing.T) (*RedisCache, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	c := NewRedis(mr.Addr())
	t.Cleanup(func() { c.Close() })
	return c, mr
}

func TestAllowRequest_UnderLimit(t *testing.T) {
	c, _ := newTestCache(t)

	for i := 0; i < 5; i++ {
		allowed, err := c.AllowRequest("1.2.3.4", 5, time.Minute)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !allowed {
			t.Fatalf("request %d should be allowed under a limit of 5", i+1)
		}
	}
}

func TestAllowRequest_BlocksOverLimit(t *testing.T) {
	c, _ := newTestCache(t)

	for i := 0; i < 5; i++ {
		if _, err := c.AllowRequest("1.2.3.4", 5, time.Minute); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	allowed, err := c.AllowRequest("1.2.3.4", 5, time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if allowed {
		t.Fatal("6th request should be blocked when limit is 5")
	}
}

func TestAllowRequest_IsPerIP(t *testing.T) {
	c, _ := newTestCache(t)

	for i := 0; i < 5; i++ {
		if _, err := c.AllowRequest("1.1.1.1", 5, time.Minute); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	// A different IP has its own independent budget.
	allowed, err := c.AllowRequest("2.2.2.2", 5, time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !allowed {
		t.Fatal("a different IP should not be affected by another IP's rate limit")
	}
}

func TestAllowRequest_ResetsAfterWindow(t *testing.T) {
	c, mr := newTestCache(t)

	for i := 0; i < 5; i++ {
		if _, err := c.AllowRequest("1.2.3.4", 5, time.Minute); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if allowed, _ := c.AllowRequest("1.2.3.4", 5, time.Minute); allowed {
		t.Fatal("expected the window to be exhausted before fast-forwarding")
	}

	// Simulate the fixed window expiring.
	mr.FastForward(time.Minute + time.Second)

	allowed, err := c.AllowRequest("1.2.3.4", 5, time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !allowed {
		t.Fatal("expected a fresh window to allow requests again")
	}
}

func TestAllowRequest_SharedAcrossInstances(t *testing.T) {
	// Two RedisCache instances pointed at the same Redis server model two
	// evaluator pods behind the same Service - the whole point of moving the
	// limiter off in-memory state.
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer mr.Close()

	podA := NewRedis(mr.Addr())
	defer podA.Close()
	podB := NewRedis(mr.Addr())
	defer podB.Close()

	for i := 0; i < 5; i++ {
		if _, err := podA.AllowRequest("shared-ip", 5, time.Minute); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	allowed, err := podB.AllowRequest("shared-ip", 5, time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if allowed {
		t.Fatal("a second pod sharing Redis should see the same exhausted budget")
	}
}

func TestGetSetDeleteFlag(t *testing.T) {
	c, _ := newTestCache(t)

	cfg := &FlagConfig{Key: "my-flag", Enabled: true, Type: "BOOLEAN", RolloutPercentage: 100}
	if err := c.SetFlag("sdk-key", "my-flag", cfg, time.Minute); err != nil {
		t.Fatalf("SetFlag failed: %v", err)
	}

	got, err := c.GetFlag("sdk-key", "my-flag")
	if err != nil {
		t.Fatalf("GetFlag failed: %v", err)
	}
	if got == nil || got.Key != "my-flag" || !got.Enabled {
		t.Fatalf("expected cached flag config, got %+v", got)
	}

	if err := c.DeleteFlag("sdk-key", "my-flag"); err != nil {
		t.Fatalf("DeleteFlag failed: %v", err)
	}
}

func TestGetFlag_MissingReturnsNilNotError(t *testing.T) {
	c, _ := newTestCache(t)

	got, err := c.GetFlag("sdk-key", "does-not-exist")
	if err != nil {
		t.Fatalf("expected no error for a cache miss, got %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for a cache miss, got %+v", got)
	}
}
