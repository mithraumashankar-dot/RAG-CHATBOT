#!/usr/bin/env bash
# Test RegBot's generic OpenAI-compatible LLM fetch path (used with Groq/OpenAI
# keys in Antigravity / Vercel / self-hosted setups).
#
# Starts a mock OpenAI-compatible server on :9372, then the production app on
# :3100 with LLM_API_KEY / LLM_BASE_URL / LLM_MODEL set, sends one chat request
# and prints both the API response and what the mock server received.
#
# Usage: bash scripts/test_llm_paths.sh
set -u
cd "$(dirname "$0")/.."

# --- cleanup any previous test servers (by PID, never by name pattern) ---
for port in 3100 9372; do
  pid=$(ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p"$" {print $NF}' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1)
  [ -n "$pid" ] && kill "$pid" 2>/dev/null && echo "killed old pid $pid on :$port"
done
sleep 1

# --- start mock LLM server ---
nohup python3 -I scripts/mock_llm_server.py 9372 > /tmp/mock_llm.log 2>&1 &
MOCK_PID=$!
sleep 2

# --- start production app with generic LLM env (Groq-style gsk_ key -> mock endpoint) ---
PORT=3100 NODE_ENV=production \
  LLM_API_KEY=gsk_test_key_123 \
  LLM_MODEL=mock-model \
  LLM_BASE_URL=http://127.0.0.1:9372/v1 \
  nohup node .next/standalone/server.js > /tmp/prod2.log 2>&1 &
APP_PID=$!
sleep 4

echo "=== API response ==="
curl -s -X POST http://localhost:3100/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"75% attendance rule enna?"}],"profile":{"role":"ug","doc":"ug","year":2,"batch":"2024-2028","regulation":"B.Tech R-2024"}}'
echo
echo "=== mock server saw ==="
cat /tmp/mock_llm.log

# --- cleanup ---
kill "$MOCK_PID" "$APP_PID" 2>/dev/null
echo "=== done (servers stopped) ==="
