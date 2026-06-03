package evaluator

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"strconv"
	"strings"

	"github.com/daniel-vergaram/flagforge/evaluator/internal/cache"
)

// Evaluate computes flag resolution for a given context.
func Evaluate(cfg *cache.FlagConfig, ctx map[string]interface{}) (bool, interface{}) {
	if cfg == nil {
		return false, nil
	}

	// 1. Check rules match
	if !matchRules(cfg.Rules, ctx) {
		return false, nil
	}

	// 2. Rollout percentage
	if cfg.RolloutPercentage < 100 {
		if !isInRollout(cfg.Key, ctx, cfg.RolloutPercentage) {
			return false, nil
		}
	}

	// 3. Boolean fast path
	if cfg.Type == "BOOLEAN" {
		return cfg.Enabled, nil
	}

	// 4. Multivariate: pick variant by weight
	variant := pickVariant(cfg.Key, ctx, cfg.Variants)
	return true, variant.Value
}

func matchRules(rules []cache.Rule, ctx map[string]interface{}) bool {
	if len(rules) == 0 {
		return true
	}
	for _, r := range rules {
		if !matchRule(r, ctx) {
			return false
		}
	}
	return true
}

func matchRule(r cache.Rule, ctx map[string]interface{}) bool {
	val, ok := ctx[r.Attribute]
	if !ok {
		return false
	}
	strVal := fmt.Sprintf("%v", val)
	strExpected := fmt.Sprintf("%v", r.Value)

	switch r.Operator {
	case "eq":
		return strVal == strExpected
	case "neq":
		return strVal != strExpected
	case "gt":
		return compareNumeric(strVal, strExpected) > 0
	case "lt":
		return compareNumeric(strVal, strExpected) < 0
	case "contains":
		return strings.Contains(strVal, strExpected)
	case "in":
		arr, ok := r.Value.([]interface{})
		if !ok {
			return strVal == strExpected
		}
		for _, v := range arr {
			if fmt.Sprintf("%v", v) == strVal {
				return true
			}
		}
		return false
	default:
		return false
	}
}

func compareNumeric(a, b string) int {
	fa, err1 := strconv.ParseFloat(a, 64)
	fb, err2 := strconv.ParseFloat(b, 64)
	if err1 != nil || err2 != nil {
		return strings.Compare(a, b)
	}
	if fa > fb {
		return 1
	}
	if fa < fb {
		return -1
	}
	return 0
}

// Deterministic rollout using sha256 of userId+flagKey.
func isInRollout(flagKey string, ctx map[string]interface{}, pct int) bool {
	userID, _ := ctx["user_id"].(string)
	if userID == "" {
		userID, _ = ctx["session_id"].(string)
	}
	if userID == "" {
		return false
	}
	h := sha256.Sum256([]byte(userID + ":" + flagKey))
	bucket := int(binary.BigEndian.Uint32(h[:4]) % 100)
	return bucket < pct
}

func pickVariant(flagKey string, ctx map[string]interface{}, variants []cache.FlagVariant) cache.FlagVariant {
	if len(variants) == 0 {
		return cache.FlagVariant{Value: nil}
	}
	userID, _ := ctx["user_id"].(string)
	if userID == "" {
		userID, _ = ctx["session_id"].(string)
	}
	if userID == "" {
		return variants[0]
	}
	h := sha256.Sum256([]byte("variant:" + userID + ":" + flagKey))
	bucket := int(binary.BigEndian.Uint32(h[:4]) % 100)

	cumulative := 0
	for _, v := range variants {
		cumulative += v.Weight
		if bucket < cumulative {
			return v
		}
	}
	return variants[len(variants)-1]
}
