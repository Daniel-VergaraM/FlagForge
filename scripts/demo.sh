#!/usr/bin/env bash
set -e

echo "=== FlagForge Demo ==="

# 1. Create flag via API
echo "Creating flag..."
curl -s -X POST http://localhost:3001/flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "dark-mode",
    "name": "Dark Mode",
    "type": "BOOLEAN",
    "enabled": true,
    "environmentId": "ENV_ID_HERE",
    "tags": ["ui", "theme"]
  }' | jq .

# 2. Evaluate flag via Evaluator
echo ""
echo "Evaluating flag..."
curl -s -X POST http://localhost:3002/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "sdkKey": "sdk-dev-001",
    "flagKey": "dark-mode",
    "context": {"user_id": "user-42", "country": "CO"}
  }' | jq .

# 3. Search flags
echo ""
echo "Searching flags..."
curl -s "http://localhost:3001/flags?q=dark" | jq .
