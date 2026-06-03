package evaluator

import (
	"fmt"
	"testing"

	"github.com/flagforge/evaluator/internal/cache"
)

func TestEvaluate_BooleanEnabled(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:               "feat-a",
		Enabled:           true,
		Type:              "BOOLEAN",
		RolloutPercentage: 100,
	}
	ctx := map[string]interface{}{"user_id": "u1"}
	enabled, val := Evaluate(cfg, ctx)
	if !enabled || val != nil {
		t.Fatalf("expected enabled=true, got enabled=%v val=%v", enabled, val)
	}
}

func TestEvaluate_BooleanDisabled(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:               "feat-b",
		Enabled:           false,
		Type:              "BOOLEAN",
		RolloutPercentage: 100,
	}
	ctx := map[string]interface{}{"user_id": "u1"}
	enabled, _ := Evaluate(cfg, ctx)
	if enabled {
		t.Fatal("expected enabled=false")
	}
}

func TestEvaluate_Rollout(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:               "feat-c",
		Enabled:           true,
		Type:              "BOOLEAN",
		RolloutPercentage: 50,
	}
	// Deterministic: same user always same bucket
	ctx := map[string]interface{}{"user_id": "alice"}
	enabled1, _ := Evaluate(cfg, ctx)
	enabled2, _ := Evaluate(cfg, ctx)
	if enabled1 != enabled2 {
		t.Fatal("rollout must be deterministic for same user")
	}
}

func TestEvaluate_RuleEq(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:     "feat-d",
		Enabled: true,
		Type:    "BOOLEAN",
		Rules: []cache.Rule{
			{Attribute: "country", Operator: "eq", Value: "CO"},
		},
		RolloutPercentage: 100,
	}
	ctxOK := map[string]interface{}{"user_id": "u1", "country": "CO"}
	ctxNO := map[string]interface{}{"user_id": "u2", "country": "US"}
	if enabled, _ := Evaluate(cfg, ctxOK); !enabled {
		t.Fatal("expected match for CO")
	}
	if enabled, _ := Evaluate(cfg, ctxNO); enabled {
		t.Fatal("expected no match for US")
	}
}

func TestEvaluate_RuleIn(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:     "feat-e",
		Enabled: true,
		Type:    "BOOLEAN",
		Rules: []cache.Rule{
			{Attribute: "role", Operator: "in", Value: []interface{}{"admin", "editor"}},
		},
		RolloutPercentage: 100,
	}
	if enabled, _ := Evaluate(cfg, map[string]interface{}{"role": "admin"}); !enabled {
		t.Fatal("expected admin to match")
	}
	if enabled, _ := Evaluate(cfg, map[string]interface{}{"role": "viewer"}); enabled {
		t.Fatal("expected viewer to not match")
	}
}

func BenchmarkEvaluate(b *testing.B) {
	cfg := &cache.FlagConfig{
		Key:     "bench-flag",
		Enabled: true,
		Type:    "BOOLEAN",
		Rules: []cache.Rule{
			{Attribute: "country", Operator: "eq", Value: "CO"},
			{Attribute: "age", Operator: "gt", Value: "18"},
		},
		RolloutPercentage: 75,
	}
	ctx := map[string]interface{}{
		"user_id": "u123",
		"country": "CO",
		"age":     25,
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Evaluate(cfg, ctx)
	}
}

func ExampleEvaluate() {
	cfg := &cache.FlagConfig{
		Key:               "new-ui",
		Enabled:           true,
		Type:              "BOOLEAN",
		RolloutPercentage: 100,
	}
	ctx := map[string]interface{}{"user_id": "user-42"}
	enabled, _ := Evaluate(cfg, ctx)
	fmt.Println(enabled)
	// Output: true
}
