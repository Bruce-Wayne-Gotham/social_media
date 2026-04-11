#!/usr/bin/env bash
# test-post-state-machine.sh
# Walks the full post state machine via curl.
#
# Prerequisites:
#   1. Backend running:  cd backend && node src/server.js
#   2. Migration applied: psql $DATABASE_URL -f infra/sql/migrations/001_agency_schema.sql
#   3. Set env vars below or export them before running this script.
#
# Usage:
#   CLIENT_ID=<uuid> TOKEN=<jwt> SP_ID=<social_profile_uuid> bash scripts/test-post-state-machine.sh

set -euo pipefail

BASE="${API_BASE:-http://localhost:3001}"
TOKEN="${TOKEN:-<paste-jwt-here>}"
CLIENT_ID="${CLIENT_ID:-<paste-client-uuid-here>}"
# A social_profile row that belongs to CLIENT_ID, with adapted_content already set.
# For submit to succeed, the target must have non-null adapted_content.
# Use the PATCH /api/posts/:postId/targets/:targetId endpoint (B3) after creation,
# OR seed adapted_content directly in the DB for this test:
#   UPDATE post_targets SET adapted_content = 'test content' WHERE post_id = '<id>';
SP_ID="${SP_ID:-<paste-social-profile-uuid-here>}"

HDR=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

sep() { echo; echo "────────────────────────────────────────────────────"; echo "$1"; echo; }

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO 1: draft → submit → approve → verify published-ready
# ─────────────────────────────────────────────────────────────────────────────

sep "[1/3] Create post (status should be 'draft')"
POST=$(curl -sf -X POST "$BASE/api/clients/$CLIENT_ID/posts" \
  "${HDR[@]}" \
  -d "{
    \"originalContent\": \"State machine test post — $(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"publishImmediately\": false,
    \"targetProfileIds\": [\"$SP_ID\"]
  }")
echo "$POST" | python3 -m json.tool 2>/dev/null || echo "$POST"
POST_ID=$(echo "$POST" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "→ POST_ID: $POST_ID"

sep "[1/3] Seed adapted_content directly (bypass B3 for this test)"
echo "Run in psql:"
echo "  UPDATE post_targets SET adapted_content = 'Adapted test content' WHERE post_id = '$POST_ID';"
echo "Then press ENTER to continue."
read -r

sep "[1/3] Submit (draft → needs_approval)"
SUBMIT=$(curl -sf -X POST "$BASE/api/posts/$POST_ID/submit" \
  "${HDR[@]}" \
  -d '{"comment": "Ready for review"}')
echo "$SUBMIT" | python3 -m json.tool 2>/dev/null || echo "$SUBMIT"
STATUS=$(echo "$SUBMIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
[ "$STATUS" = "needs_approval" ] && echo "✓ status=needs_approval" || echo "✗ EXPECTED needs_approval, got $STATUS"

sep "[1/3] Approve (needs_approval → approved)"
APPROVE=$(curl -sf -X POST "$BASE/api/posts/$POST_ID/approve" \
  "${HDR[@]}" \
  -d '{"comment": "Looks good"}')
echo "$APPROVE" | python3 -m json.tool 2>/dev/null || echo "$APPROVE"
STATUS=$(echo "$APPROVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
[ "$STATUS" = "approved" ] && echo "✓ status=approved" || echo "✗ EXPECTED approved, got $STATUS"

sep "[1/3] Verify final state via GET"
GET=$(curl -sf "$BASE/api/posts/$POST_ID" "${HDR[@]}")
echo "$GET" | python3 -m json.tool 2>/dev/null || echo "$GET"
STATUS=$(echo "$GET" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
LOG_LEN=$(echo "$GET" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['approvalLog']))")
[ "$STATUS" = "approved" ]  && echo "✓ status=approved"          || echo "✗ EXPECTED approved, got $STATUS"
[ "$LOG_LEN" -ge 2 ]        && echo "✓ approvalLog has $LOG_LEN entries" || echo "✗ EXPECTED >=2 log entries, got $LOG_LEN"

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO 2: draft → submit → reject → verify back to draft
# ─────────────────────────────────────────────────────────────────────────────

sep "[2/3] Create second post for reject scenario"
POST2=$(curl -sf -X POST "$BASE/api/clients/$CLIENT_ID/posts" \
  "${HDR[@]}" \
  -d "{
    \"originalContent\": \"Reject scenario — $(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"publishImmediately\": false,
    \"targetProfileIds\": [\"$SP_ID\"]
  }")
POST2_ID=$(echo "$POST2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "→ POST2_ID: $POST2_ID"

echo "Seeding adapted_content for reject test post..."
echo "Run: UPDATE post_targets SET adapted_content = 'test' WHERE post_id = '$POST2_ID';"
echo "Press ENTER to continue."
read -r

sep "[2/3] Submit post 2"
curl -sf -X POST "$BASE/api/posts/$POST2_ID/submit" "${HDR[@]}" -d '{}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('status:', d['status'])"

sep "[2/3] Reject (needs_approval → draft)"
REJECT=$(curl -sf -X POST "$BASE/api/posts/$POST2_ID/reject" \
  "${HDR[@]}" \
  -d '{"comment": "Needs more work"}')
echo "$REJECT" | python3 -m json.tool 2>/dev/null || echo "$REJECT"
STATUS=$(echo "$REJECT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
[ "$STATUS" = "draft" ] && echo "✓ status=draft (rejected back)" || echo "✗ EXPECTED draft, got $STATUS"

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO 3: attempt to approve a draft directly → expect 409 INVALID_TRANSITION
# ─────────────────────────────────────────────────────────────────────────────

sep "[3/3] Create third post (stays in draft)"
POST3=$(curl -sf -X POST "$BASE/api/clients/$CLIENT_ID/posts" \
  "${HDR[@]}" \
  -d "{
    \"originalContent\": \"Direct approve attempt — $(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"publishImmediately\": false,
    \"targetProfileIds\": [\"$SP_ID\"]
  }")
POST3_ID=$(echo "$POST3" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "→ POST3_ID: $POST3_ID"

sep "[3/3] Attempt direct approve on draft → expect 409 INVALID_TRANSITION"
HTTP_CODE=$(curl -s -o /tmp/direct_approve_resp.json -w "%{http_code}" \
  -X POST "$BASE/api/posts/$POST3_ID/approve" \
  "${HDR[@]}" -d '{}')
echo "HTTP status: $HTTP_CODE"
cat /tmp/direct_approve_resp.json | python3 -m json.tool 2>/dev/null || cat /tmp/direct_approve_resp.json
[ "$HTTP_CODE" = "409" ] && echo "✓ Correctly rejected with 409" || echo "✗ EXPECTED 409, got $HTTP_CODE"
ERROR_CODE=$(cat /tmp/direct_approve_resp.json | python3 -c "import sys,json; print(json.load(sys.stdin)['error']['code'])" 2>/dev/null || echo "parse_failed")
[ "$ERROR_CODE" = "INVALID_TRANSITION" ] && echo "✓ error.code=INVALID_TRANSITION" || echo "✗ EXPECTED INVALID_TRANSITION, got $ERROR_CODE"

echo
echo "═══════════════════════════════════════════════════"
echo "All scenarios complete."
