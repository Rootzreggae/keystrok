#!/usr/bin/env bash
# Keystrok security battery, fast, repeatable checks that the core guarantees hold.
# Usage:  bash scripts/security-check.sh   (dev server must be running on :3001)
#
# Checks:
#   1. Encryption-at-rest proof (creates+reads+deletes a throwaway row)
#   2. Auth gate: protected API routes reject unauthenticated requests (401/redirect)
#   3. Secret scanning: gitleaks over the repo (if installed)
#   4. Dependency audit: npm audit (high+)
# Exits non-zero if any hard check fails.
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${BASE_URL:-http://localhost:3001}"
fail=0
pass() { echo "  ✓ $1"; }
bad()  { echo "  ✗ $1"; fail=1; }

echo "== 1. Encryption at rest =="
if node --env-file=.env.local scripts/verify-encryption.ts 2>/dev/null | grep -q "ENCRYPTION-AT-REST: PASS"; then
  pass "platform apiKey is encrypted at rest (enc:v1:, round-trips)"
else
  bad "encryption-at-rest proof failed (run: node --env-file=.env.local scripts/verify-encryption.ts)"
fi

echo "== 1b. SSRF guard =="
if node --env-file=.env.local scripts/verify-ssrf.ts 2>/dev/null | grep -q "SSRF GUARD: PASS"; then
  pass "internal/metadata/private/non-http targets are blocked"
else
  bad "SSRF guard proof failed (run: node --env-file=.env.local scripts/verify-ssrf.ts)"
fi

echo "== 1c. Invite-only access control =="
if node --env-file=.env.local --import ./scripts/register-alias.mjs scripts/verify-allowlist.ts 2>/dev/null | grep -q "ALLOWLIST: PASS"; then
  pass "invite-only allowlist (explicit/domain/waitlist) + open-registration opt-out"
else
  bad "allowlist proof failed (run: node --env-file=.env.local scripts/verify-allowlist.ts)"
fi

echo "== 1d. Rate limiting =="
if node --env-file=.env.local --import ./scripts/register-alias.mjs scripts/verify-rate-limit.ts 2>/dev/null | grep -q "RATE LIMIT: PASS"; then
  pass "fixed-window limiter allows up to limit, blocks excess, rolls over"
else
  bad "rate-limit proof failed (run: node --env-file=.env.local --import ./scripts/register-alias.mjs scripts/verify-rate-limit.ts)"
fi

echo "== 2. Auth gate (unauthenticated must NOT get 200) =="
# /api/test-email sends real mail, must be authenticated-only.
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/test-email" -H 'Content-Type: application/json' -d '{"email":"x@y.com","testType":"send"}')
if [ "$code" = "401" ]; then pass "/api/test-email (POST) -> 401"; else bad "/api/test-email returned $code (expected 401)"; fi
# Keep in sync with app/api/ — a 404 here means the route was removed, not protected.
PROTECTED=(
  /api/platforms /api/keys /api/dashboard/stats
  /api/dashboard/summary /api/discovery/results /api/workflows
  /api/workflows/stats /api/activity/recent
  /api/platforms/risk-distribution
)
for route in "${PROTECTED[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$route")
  if [ "$code" = "401" ] || [ "$code" = "307" ] || [ "$code" = "302" ]; then
    pass "$route -> $code"
  else
    bad "$route returned $code (expected 401/redirect)"
  fi
done

echo "== 3. Secret scan (gitleaks) =="
if command -v gitleaks >/dev/null 2>&1; then
  # test-scanner/ holds intentional detector fixtures, scope them out.
  if gitleaks detect --no-banner --redact \
      --report-path /tmp/keystrok-gitleaks.json 2>/dev/null; then
    pass "gitleaks found no secrets"
  else
    bad "gitleaks flagged potential secrets (see /tmp/keystrok-gitleaks.json; confirm they are test-scanner fixtures)"
  fi
else
  echo "  - gitleaks not installed; skipping (brew install gitleaks)"
fi

echo "== 4. Dependency audit =="
if npm audit --audit-level=high >/tmp/keystrok-audit.txt 2>&1; then
  pass "npm audit: no high/critical advisories"
else
  bad "npm audit found high/critical advisories (see /tmp/keystrok-audit.txt)"
fi

echo
if [ "$fail" -eq 0 ]; then echo "SECURITY BATTERY: PASS"; else echo "SECURITY BATTERY: FAIL"; fi
exit "$fail"
