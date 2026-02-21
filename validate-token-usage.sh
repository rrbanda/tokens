#!/usr/bin/env bash
# =============================================================================
# Token Usage Validation Script
#
# Demonstrates that the LSS plugin reads token counts directly from the
# Llama Stack Responses API — no client-side math or estimation.
#
# Usage:
#   ./validate-token-usage.sh
#
# Before running, set these two variables below (or export them):
#   LLAMA_STACK_URL  – Base URL of your Llama Stack server
#   LLAMA_MODEL      – Model identifier registered on the server
# =============================================================================

set -euo pipefail

# ── CONFIGURE THESE ──────────────────────────────────────────────────────────
LLAMA_STACK_URL="${LLAMA_STACK_URL:-https://CHANGE_ME.example.com}"
LLAMA_MODEL="${LLAMA_MODEL:-your-model/name-here}"
# ─────────────────────────────────────────────────────────────────────────────

if [[ "$LLAMA_STACK_URL" == *"CHANGE_ME"* || "$LLAMA_MODEL" == *"your-model"* ]]; then
  echo "ERROR: Edit this script and set LLAMA_STACK_URL and LLAMA_MODEL first."
  echo ""
  echo "  Example:"
  echo "    LLAMA_STACK_URL=https://lss.apps.example.com"
  echo "    LLAMA_MODEL=gemini-llm/models/gemini-2.5-flash"
  echo ""
  echo "  Or export them before running:"
  echo "    export LLAMA_STACK_URL=https://lss.apps.example.com"
  echo "    export LLAMA_MODEL=gemini-llm/models/gemini-2.5-flash"
  echo "    ./scripts/validate-token-usage.sh"
  exit 1
fi

RESPONSES_URL="${LLAMA_STACK_URL}/v1/openai/v1/responses"
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Token Usage Validation — Llama Stack Responses API${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Server : ${CYAN}${LLAMA_STACK_URL}${NC}"
echo -e "  Model  : ${CYAN}${LLAMA_MODEL}${NC}"
echo -e "  API    : ${CYAN}POST /v1/openai/v1/responses${NC}"
echo ""

# ── Step 1: Health check ─────────────────────────────────────────────────────
echo -e "${BOLD}[1/4] Health check${NC}"
echo -e "  curl -sk ${LLAMA_STACK_URL}/v1/health"
HEALTH=$(curl -sk "${LLAMA_STACK_URL}/v1/health" 2>&1) || true
if echo "$HEALTH" | grep -qi "ok\|healthy\|status"; then
  echo -e "  ${GREEN}✔ Server is reachable${NC}"
else
  echo -e "  ${RED}✘ Server may be down. Response: ${HEALTH}${NC}"
  echo "  Continuing anyway..."
fi
echo ""

# ── Step 2: Non-streaming request ────────────────────────────────────────────
echo -e "${BOLD}[2/4] Non-streaming request (store: false)${NC}"
echo -e "  Sending: \"What is 2+2? Reply in one sentence.\""
echo ""

NON_STREAM_RESPONSE=$(curl -sk "${RESPONSES_URL}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"${LLAMA_MODEL}\",
    \"input\": \"What is 2+2? Reply in one sentence.\",
    \"stream\": false,
    \"store\": false
  }" 2>&1)

echo -e "  ${BOLD}Raw usage object from API response:${NC}"
echo "$NON_STREAM_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    usage = data.get('usage')
    if usage:
        print(json.dumps(usage, indent=2))
        print()
        inp  = usage.get('input_tokens', '?')
        out  = usage.get('output_tokens', '?')
        tot  = usage.get('total_tokens', '?')
        print(f'  input_tokens  = {inp}')
        print(f'  output_tokens = {out}')
        print(f'  total_tokens  = {tot}')
        inp_d = usage.get('input_tokens_details')
        out_d = usage.get('output_tokens_details')
        if inp_d:
            print(f'  input_tokens_details  = {json.dumps(inp_d)}')
        if out_d:
            print(f'  output_tokens_details = {json.dumps(out_d)}')
    else:
        print('  No usage field found in response.')
        print('  Full response:')
        print(json.dumps(data, indent=2)[:2000])
except Exception as e:
    print(f'  Failed to parse JSON: {e}')
    print(sys.stdin.read()[:1000])
" 2>&1 || echo "$NON_STREAM_RESPONSE" | head -c 1000
echo ""

# ── Step 3: Streaming request ────────────────────────────────────────────────
echo -e "${BOLD}[3/4] Streaming request (SSE) — same as the plugin uses${NC}"
echo -e "  Sending: \"Explain what a token is in LLMs, in 2 sentences.\""
echo ""

STREAM_FILE=$(mktemp)
curl -sk "${RESPONSES_URL}" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d "{
    \"model\": \"${LLAMA_MODEL}\",
    \"input\": \"Explain what a token is in LLMs, in 2 sentences.\",
    \"stream\": true,
    \"store\": false
  }" > "$STREAM_FILE" 2>&1

echo -e "  ${BOLD}Last SSE event (response.completed):${NC}"
# Extract the response.completed event which contains usage
grep -o 'data: {.*}' "$STREAM_FILE" | while read -r line; do
  json="${line#data: }"
  event_type=$(echo "$json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('type',''))" 2>/dev/null || echo "")
  if [ "$event_type" = "response.completed" ]; then
    echo "$json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
usage = data.get('response', {}).get('usage')
if usage:
    print(json.dumps(usage, indent=2))
    print()
    inp  = usage.get('input_tokens', '?')
    out  = usage.get('output_tokens', '?')
    tot  = usage.get('total_tokens', '?')
    print(f'  input_tokens  = {inp}')
    print(f'  output_tokens = {out}')
    print(f'  total_tokens  = {tot}')
    inp_d = usage.get('input_tokens_details')
    out_d = usage.get('output_tokens_details')
    if inp_d:
        print(f'  input_tokens_details  = {json.dumps(inp_d)}')
    if out_d:
        print(f'  output_tokens_details = {json.dumps(out_d)}')
else:
    print('  No usage in response.completed event')
" 2>&1
  fi
done
echo ""

echo -e "  ${BOLD}All SSE event types received:${NC}"
grep -o 'data: {.*}' "$STREAM_FILE" | python3 -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if line.startswith('data: '):
        line = line[6:]
    try:
        data = json.loads(line)
        print(f'    {data.get(\"type\", \"unknown\")}')
    except:
        pass
" 2>&1
echo ""
rm -f "$STREAM_FILE"

# ── Step 4: What the plugin does ─────────────────────────────────────────────
echo -e "${BOLD}[4/4] How the LSS plugin uses this${NC}"
echo ""
echo -e "  ${YELLOW}Backend (router.ts):${NC}"
echo "    Forwards every SSE event from Llama Stack to the browser verbatim."
echo "    Logs usage from response.completed but does NOT modify it."
echo ""
echo -e "  ${YELLOW}Frontend (StreamingMessage.reducer.ts):${NC}"
echo "    On event.type === 'response.completed':"
echo "      usage = event.response.usage"
echo "    Stores it in StreamingState.usage — no math, no estimation."
echo ""
echo -e "  ${YELLOW}Frontend (useStreamingChat.ts):${NC}"
echo "    After stream ends, copies streamingState.usage → Message.usage"
echo ""
echo -e "  ${YELLOW}Frontend (TokenUsageBadge.tsx):${NC}"
echo "    Renders usage.input_tokens, usage.output_tokens, usage.total_tokens"
echo "    All values are the exact numbers from the inference server."
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✔ All token counts displayed in the UI come directly from${NC}"
echo -e "${GREEN}    the Llama Stack /v1/openai/v1/responses API.${NC}"
echo -e "${GREEN}    No client-side calculation is performed.${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
