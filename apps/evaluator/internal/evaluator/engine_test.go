package evaluator

import (
	"testing"

	"github.com/flagforge/evaluator/internal/cache"
)

func TestEvaluate_BooleanWithoutRules(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:     "dark-mode",
		Type:    "BOOLEAN",
		Enabled: true,
		Rules:   nil,
		RolloutPercentage: 100,
	}
	ctx := map[string]interface{}{}

	enabled, value := Evaluate(cfg, ctx)
	if !enabled {
		t.Fatalf("expected enabled=true, got %v", enabled)
	}
	if value != nil {
		t.Fatalf("expected value=nil for boolean, got %v", value)
	}
}

func TestEvaluate_BooleanDisabled(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:     "feature-a",
		Type:    "BOOLEAN",
		Enabled: false,
		RolloutPercentage: 100,
	}
	ctx := map[string]interface{}{}

	enabled, _ := Evaluate(cfg, ctx)
	if enabled {
		t.Fatal("expected enabled=false for disabled flag")
	}
}

func TestEvaluate_RuleEqMatch(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:     "beta-feature",
		Type:    "BOOLEAN",
		Enabled: true,
		Rules: []cache.Rule{
			{Attribute: "country", Operator: "eq", Value: "US"},
		},
		RolloutPercentage: 100,
	}

	// Matching context
	enabled, _ := Evaluate(cfg, map[string]interface{}{"country": "US"})
	if !enabled {
		t.Fatal("expected enabled=true when rule matches")
	}

	// Non-matching context
	enabled, _ = Evaluate(cfg, map[string]interface{}{"country": "MX"})
	if enabled {
		t.Fatal("expected enabled=false when rule does not match")
	}
}

func TestEvaluate_RuleInMatch(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:     "vip-feature",
		Type:    "BOOLEAN",
		Enabled: true,
		Rules: []cache.Rule{
			{Attribute: "role", Operator: "in", Value: []interface{}{"admin", "vip"}},
		},
		RolloutPercentage: 100,
	}

	enabled, _ := Evaluate(cfg, map[string]interface{}{"role": "vip"})
	if !enabled {
		t.Fatal("expected enabled=true for role in [admin, vip]")
	}

	enabled, _ = Evaluate(cfg, map[string]interface{}{"role": "user"})
	if enabled {
		t.Fatal("expected enabled=false for role=user")
	}
}

func TestEvaluate_RuleGtMatch(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:     "age-gated",
		Type:    "BOOLEAN",
		Enabled: true,
		Rules: []cache.Rule{
			{Attribute: "age", Operator: "gt", Value: "17"},
		},
		RolloutPercentage: 100,
	}

	enabled, _ := Evaluate(cfg, map[string]interface{}{"age": 21})
	if !enabled {
		t.Fatal("expected enabled=true for age > 17")
	}

	enabled, _ = Evaluate(cfg, map[string]interface{}{"age": 16})
	if enabled {
		t.Fatal("expected enabled=false for age <= 17")
	}
}

func TestEvaluate_MultipleRulesAllMustMatch(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:     "targeted",
		Type:    "BOOLEAN",
		Enabled: true,
		Rules: []cache.Rule{
			{Attribute: "country", Operator: "eq", Value: "US"},
			{Attribute: "role", Operator: "eq", Value: "beta"},
		},
		RolloutPercentage: 100,
	}

	enabled, _ := Evaluate(cfg, map[string]interface{}{"country": "US", "role": "beta"})
	if !enabled {
		t.Fatal("expected true when all rules match")
	}

	enabled, _ = Evaluate(cfg, map[string]interface{}{"country": "US", "role": "user"})
	if enabled {
		t.Fatal("expected false when one rule fails")
	}
}

func TestEvaluate_RolloutDeterminism(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:               "rollout-10",
		Type:              "BOOLEAN",
		Enabled:           true,
		RolloutPercentage: 10,
		Rules:             nil,
	}
	ctx := map[string]interface{}{"user_id": "user-123"}

	// Same user, same result, every time
	results := make(map[bool]int)
	for i := 0; i < 100; i++ {
		enabled, _ := Evaluate(cfg, ctx)
		results[enabled]++
	}

	if len(results) != 1 {
		t.Fatalf("expected deterministic rollout for same user, got mixed results: %v", results)
	}
}

func TestEvaluate_RolloutDistribution(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:               "rollout-50",
		Type:              "BOOLEAN",
		Enabled:           true,
		RolloutPercentage: 50,
		Rules:             nil,
	}

	var enabledCount int
	users := 10_000
	for i := 0; i < users; i++ {
		ctx := map[string]interface{}{"user_id": string(rune(i))}
		enabled, _ := Evaluate(cfg, ctx)
		if enabled {
			enabledCount++
		}
	}

	pct := float64(enabledCount) / float64(users) * 100
	// Should be roughly 50%, allow generous tolerance for small sample
	if pct < 45 || pct > 55 {
		t.Fatalf("expected ~50%% rollout, got %.2f%%", pct)
	}
}

func TestEvaluate_MultivariantePickVariant(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:               "experiment",
		Type:              "MULTIVARIATE",
		Enabled:           true,
		RolloutPercentage: 100,
		Variants: []cache.FlagVariant{
			{Value: "control", Weight: 50},
			{Value: "treatment", Weight: 50},
		},
	}
	ctx := map[string]interface{}{"user_id": "user-abc"}

	enabled, value := Evaluate(cfg, ctx)
	if !enabled {
		t.Fatal("expected enabled=true")
	}
	if value != "control" && value != "treatment" {
		t.Fatalf("expected control or treatment, got %v", value)
	}
}

func TestEvaluate_MultivarianteDeterminism(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:               "experiment",
		Type:              "MULTIVARIATE",
		Enabled:           true,
		RolloutPercentage: 100,
		Variants: []cache.FlagVariant{
			{Value: "a", Weight: 33},
			{Value: "b", Weight: 33},
			{Value: "c", Weight: 34},
		},
	}
	ctx := map[string]interface{}{"user_id": "sticky-user"}

	// Same user must always get same variant
	_, first := Evaluate(cfg, ctx)
	for i := 0; i < 50; i++ {
		_, v := Evaluate(cfg, ctx)
		if v != first {
			t.Fatalf("expected deterministic variant assignment, got %v then %v", first, v)
		}
	}
}

func TestEvaluate_RolloutBlocksBeforeRules(t *testing.T) {
	cfg := &cache.FlagConfig{
		Key:               "rollout-with-rules",
		Type:              "BOOLEAN",
		Enabled:           true,
		RolloutPercentage: 0, // nobody
		Rules: []cache.Rule{
			{Attribute: "country", Operator: "eq", Value: "US"},
		},
	}
	ctx := map[string]interface{}{"country": "US", "user_id": "u1"}

	enabled, _ := Evaluate(cfg, ctx)
	if enabled {
		t.Fatal("expected false because rollout is 0")
	}
}
