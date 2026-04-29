#!/usr/bin/env bash
# scripts/deploy.sh -- Phase 13 / OPS-13-02
# One-stop pre-deploy automation. Replaces the manual checklist in RUNBOOK.md.
#
# Usage:
#   ./scripts/deploy.sh                       # stamp + mirror + deploy (no CACHE bump)
#   ./scripts/deploy.sh <tag>                 # stamp + bump sw.js CACHE to couch-v<tag> + mirror + deploy
#   ./scripts/deploy.sh --allow-dirty <tag>   # skip dirty-tree abort (Pitfall 7 escape hatch)
#
# Environment variables (review fix HIGH-4):
#   COUCH_DEPLOY_PATH  Path to the deploy-mirror sibling repo. Default: ../../couch-deploy
#                      Set this in your shell profile if your deploy mirror lives elsewhere.
#                      Example (git-bash):  export COUCH_DEPLOY_PATH="/c/path/to/couch-deploy"
#                      (Legacy QUEUENIGHT_PATH is still accepted with a deprecation warning.)
#
# Review fixes applied:
#   HIGH-4   No hardcoded user-specific path literal -- resolved via $COUCH_DEPLOY_PATH env var.
#   MEDIUM-5 Production deploys abort if app.html/landing.html still contain a literal
#            Sentry DSN placeholder (catches Plan 13-02 placeholder-leak at deploy boundary).
#   MEDIUM-8 BUILD_DATE auto-stamp targets the deploy mirror (couch-deploy/public/js/constants.js)
#            ONLY -- source tree js/constants.js is never mutated by deploy.sh, eliminating
#            the dirty-tree-after-deploy failure mode.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Review fix HIGH-4: env-var-with-default. Set COUCH_DEPLOY_PATH in your shell profile
# if your deploy-mirror clone is not at ../../couch-deploy relative to this repo.
# Legacy QUEUENIGHT_PATH still accepted with a deprecation warning (rename happened 2026-04-26).
if [ -n "${QUEUENIGHT_PATH:-}" ] && [ -z "${COUCH_DEPLOY_PATH:-}" ]; then
  echo "WARN: QUEUENIGHT_PATH is deprecated -- rename to COUCH_DEPLOY_PATH in your shell profile." >&2
  COUCH_DEPLOY_PATH="${QUEUENIGHT_PATH}"
fi
COUCH_DEPLOY_ROOT_RAW="${COUCH_DEPLOY_PATH:-${REPO_ROOT}/../../couch-deploy}"
# If env-var unset and the new-name path doesn't exist, fall back to the legacy queuenight/
# path so deploy.sh keeps working before the user renames the directory.
if [ -z "${COUCH_DEPLOY_PATH:-}" ] && [ ! -d "${COUCH_DEPLOY_ROOT_RAW}" ]; then
  LEGACY_PATH="${REPO_ROOT}/../../queuenight"
  if [ -d "${LEGACY_PATH}" ]; then
    echo "WARN: ${COUCH_DEPLOY_ROOT_RAW} not found; falling back to legacy ${LEGACY_PATH}." >&2
    echo "      Rename it to couch-deploy when convenient (the rename is purely cosmetic)." >&2
    COUCH_DEPLOY_ROOT_RAW="${LEGACY_PATH}"
  fi
fi
# Resolve to absolute path; fail loudly if the resolved directory does not exist.
if [ ! -d "${COUCH_DEPLOY_ROOT_RAW}" ]; then
  echo "ERROR: deploy-mirror repo not found at: ${COUCH_DEPLOY_ROOT_RAW}" >&2
  echo "       Either set COUCH_DEPLOY_PATH in your shell or clone the deploy mirror at ../../couch-deploy" >&2
  echo "       relative to the couch repo root. (Review fix HIGH-4.)" >&2
  exit 1
fi
COUCH_DEPLOY_ROOT="$(cd "${COUCH_DEPLOY_ROOT_RAW}" && pwd)"

cd "$REPO_ROOT"

# 0. Pitfall 7 -- abort on dirty tree unless --allow-dirty
ALLOW_DIRTY=0
if [ "${1:-}" = "--allow-dirty" ]; then
  ALLOW_DIRTY=1
  shift
fi
if [ "$ALLOW_DIRTY" -eq 0 ]; then
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "ERROR: working tree is dirty. Commit or stash before deploy.sh." >&2
    echo "       (Or pass --allow-dirty as the first argument to skip this check.)" >&2
    exit 1
  fi
fi

TAG="${1:-}"

# 1. Tests must pass (if a tests/ directory exists)
if [ -d tests ]; then
  ( cd tests && npm test ) || { echo "ERROR: tests failed; aborting deploy." >&2; exit 1; }
fi

# 2. node --check on every shipping JS file
for f in js/*.js sw.js scripts/stamp-build-date.cjs; do
  [ -f "$f" ] || continue
  node --check "$f" || { echo "ERROR: node --check failed on $f" >&2; exit 1; }
done

# 2.5. Pure-function smoke gate -- contract tests for matches/considerable filters
# (Phase 15.5.5+) and positionToSeconds transform (Phase 15.5-02). Fast (~50ms)
# and runs without Firestore/auth/browser. Catches regressions in core matching
# logic before they reach production -- introduced after the v35.5.1->v35.5.5
# deploy ping-pong on the same surface.
if [ -f scripts/smoke-position-transform.cjs ]; then
  node scripts/smoke-position-transform.cjs > /dev/null \
    || { echo "ERROR: smoke-position-transform failed -- aborting deploy." >&2; exit 1; }
fi
if [ -f scripts/smoke-tonight-matches.cjs ]; then
  node scripts/smoke-tonight-matches.cjs > /dev/null \
    || { echo "ERROR: smoke-tonight-matches failed -- aborting deploy." >&2; exit 1; }
fi
echo "Smoke contracts pass (positionToSeconds + matches/considerable)."

# 3. Verify couch-deploy mirror exists (deploy target)
if [ ! -d "${COUCH_DEPLOY_ROOT}/public" ]; then
  echo "ERROR: ${COUCH_DEPLOY_ROOT}/public missing -- is the sibling repo at the right path?" >&2
  echo "       COUCH_DEPLOY_PATH=${COUCH_DEPLOY_PATH:-(unset; using default)}" >&2
  exit 1
fi

# 4. Optional sw.js CACHE bump (caller passes a short-tag like "33.5-fix")
#    Bump in source so node --check coverage stays consistent + commit captures it.
if [ -n "$TAG" ]; then
  CACHE_NEW="couch-v${TAG}"
  if grep -q "const CACHE = '${CACHE_NEW}';" sw.js; then
    echo "sw.js CACHE already at ${CACHE_NEW}; skipping bump."
  else
    sed -i.bak -E "s|const CACHE = '[^']+';|const CACHE = '${CACHE_NEW}';|" sw.js
    rm -f sw.js.bak
    echo "Bumped sw.js CACHE -> ${CACHE_NEW}"
  fi
fi

# 5. Mirror to couch-deploy/public/ (file set per CLAUDE.md + PATTERNS.md)
for f in app.html landing.html changelog.html rsvp.html 404.html sw.js sitemap.xml robots.txt; do
  if [ -f "$f" ]; then
    cp -v "$f" "${COUCH_DEPLOY_ROOT}/public/"
  else
    echo "WARN: $f missing in repo root; skipping" >&2
  fi
done
mkdir -p "${COUCH_DEPLOY_ROOT}/public/css" "${COUCH_DEPLOY_ROOT}/public/js"
cp -v css/*.css "${COUCH_DEPLOY_ROOT}/public/css/"
cp -v js/*.js "${COUCH_DEPLOY_ROOT}/public/js/"

# 6. Auto-stamp BUILD_DATE -- review fix MEDIUM-8: target the MIRROR copy of
#    js/constants.js, NOT the source. stamp-build-date.cjs resolves its target
#    path using __dirname (hardcoded to REPO_ROOT/js/constants.js). To stamp
#    the mirror instead without modifying the existing script, we apply an
#    equivalent in-place sed directly on the mirror's constants.js.
#    This is functionally identical to what stamp-build-date.cjs does internally:
#    it finds the BUILD_DATE export line and replaces the date string with today.
MIRROR_CONSTANTS="${COUCH_DEPLOY_ROOT}/public/js/constants.js"
TODAY="$(date -u +%Y-%m-%d)"
if [ ! -f "${MIRROR_CONSTANTS}" ]; then
  echo "ERROR: Mirror constants.js not found at: ${MIRROR_CONSTANTS}" >&2
  exit 1
fi
if grep -q "export const BUILD_DATE = '${TODAY}';" "${MIRROR_CONSTANTS}"; then
  echo "BUILD_DATE already current (${TODAY}) in deploy mirror -- no change."
else
  sed -i.bak -E "s|export const BUILD_DATE = '[0-9]{4}-[0-9]{2}-[0-9]{2}';|export const BUILD_DATE = '${TODAY}';|" "${MIRROR_CONSTANTS}"
  rm -f "${MIRROR_CONSTANTS}.bak"
  echo "Stamped BUILD_DATE -> ${TODAY} in deploy mirror only (source tree untouched -- review fix MEDIUM-8)."
fi

# 7. Sentry DSN placeholder guard -- review fix MEDIUM-5.
#    If the shipping HTML still contains a literal Sentry placeholder, abort.
#    This catches the case where Plan 13-02 lands placeholders in version control
#    but the operator forgot to substitute the real DSN before deploy.
SENTRY_PLACEHOLDERS_REGEX='<SENTRY_PUBLIC_KEY>|<SENTRY_ORGID>|<SENTRY_PROJECTID>'
SENTRY_VIOLATIONS=0
for f in "${COUCH_DEPLOY_ROOT}/public/app.html" "${COUCH_DEPLOY_ROOT}/public/landing.html"; do
  if [ -f "$f" ]; then
    if grep -qE "${SENTRY_PLACEHOLDERS_REGEX}" "$f"; then
      echo "ERROR: ${f} still contains a Sentry DSN placeholder." >&2
      echo "       Substitute the real DSN before deploying to production. (Review fix MEDIUM-5.)" >&2
      SENTRY_VIOLATIONS=$((SENTRY_VIOLATIONS + 1))
    fi
  fi
done
if [ "$SENTRY_VIOLATIONS" -gt 0 ]; then
  echo "ABORT: ${SENTRY_VIOLATIONS} file(s) contain unresolved Sentry DSN placeholders." >&2
  exit 1
fi

# 8. Deploy hosting
cd "${COUCH_DEPLOY_ROOT}"
firebase deploy --only hosting --project queuenight-84044

# 9. Smoke tests
echo ""
echo "=== Post-deploy smoke tests ==="
curl -sI https://couchtonight.app/ | head -3
echo ""
curl -s https://couchtonight.app/sw.js | grep "const CACHE" || echo "WARN: could not read CACHE line from prod sw.js"
echo ""
echo "=== deploy.sh complete ==="
