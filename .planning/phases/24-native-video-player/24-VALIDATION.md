---
phase: 24
slug: native-video-player
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-30
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `24-RESEARCH.md` §Validation Architecture (lines 778-839).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js scripts (no jest / mocha — Couch convention is plain `.cjs` scripts that exit 0/1 with `console.log` `OK` / `FAIL` lines, mirroring `scripts/smoke-position-transform.cjs`) |
| **Config file** | `package.json` `scripts.smoke` chain (and per-phase `smoke:*` aliases); per-phase smoke contract: `scripts/smoke-native-video-player.cjs` |
| **Quick run command** | `npm run smoke:native-video-player` (NEW alias added in Plan 01 Task 1.2) |
| **Full suite command** | `npm run smoke` (existing chain — appends new contract; 8 contracts total post-Plan-01) |
| **Estimated runtime** | ~200ms per-phase contract; ~1s full chain |

---

## Sampling Rate

- **After every task commit:** Run `npm run smoke:native-video-player` (~25 assertions, < 200ms)
- **After every plan wave:** Run `npm run smoke` (full chain — 8 contracts, ~170 assertions, < 1s total)
- **Before `/gsd-verify-work`:** Full suite must be green AND `24-HUMAN-UAT.md` device scripts must pass
- **Max feedback latency:** 1 second (well under the 24s Nyquist target)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | VID-24-12 | T-24-01-01 / T-24-01-03 | Smoke contract scaffolds parser/DRM/throttle assertions; rejects javascript:/data: URLs at parser layer | unit (smoke) | `node scripts/smoke-native-video-player.cjs` | ❌ W0 (this task creates it) | ⬜ pending |
| 24-01-02 | 01 | 1 | VID-24-12 | — | Smoke wired into deploy gate + npm chain — no bad code reaches production | infra (syntax) | `npm run smoke:native-video-player && bash -n scripts/deploy.sh` | ❌ W0 (this task wires it) | ⬜ pending |
| 24-02-01 | 02 | 1 | VID-24-02, VID-24-04, VID-24-05, VID-24-10 | T-24-02-01 / T-24-02-02 / T-24-02-04 | Pure helpers: protocol allowlist, YouTube ID regex `/^[A-Za-z0-9_-]{6,}$/`, bounded regex (no catastrophic backtracking) | unit | `node --check js/native-video-player.js && node -e "import('./js/native-video-player.js').then(m => { /* shape check */ })"` | ❌ W0 (this task creates it) | ⬜ pending |
| 24-03-01 | 03 | 2 | VID-24-06, VID-24-07 | — | HTML field with verbatim UI-SPEC copy; CSS uses existing tokens only | unit (html+css string asserts) | `node -e "/* html+css string-includes asserts per Plan 03 Task 3.1 */"` | ✅ existing | ⬜ pending |
| 24-03-02 | 03 | 2 | VID-24-06, VID-24-07, VID-24-08 | T-24-03-01 / T-24-03-02 | parseVideoUrl rejects bad URLs at validation layer; submit-blocked branch surfaces inline error | unit (syntax + grep) | `node --check js/app.js` | ✅ existing | ⬜ pending |
| 24-03-03 | 03 | 2 | VID-24-01, VID-24-03, VID-24-11 | T-24-03-01 / T-24-03-02 | encodeURIComponent on YouTube ID; escapeHtml on MP4 src; DRM-hide silent zero-DOM branch | unit (syntax + grep) | `node --check js/app.js` | ✅ existing | ⬜ pending |
| 24-03-04 | 03 | 2 | VID-24-09, VID-24-14 | T-24-03-04 / T-24-03-06 / T-24-03-09 | Host-only broadcast gate (state.me.id === wp.hostId); throttle 5s; live-stream gate via getDuration; modal-close race avoided via DOM existence check | unit (syntax + smoke) | `node --check js/app.js && node scripts/smoke-native-video-player.cjs` | ✅ existing (post-24-01-01) | ⬜ pending |
| 24-04-01 | 04 | 3 | (gate) | T-24-04-02 | All 8 smoke contracts pass before deploy fires | infra | `npm run smoke && node --check js/app.js && node --check js/native-video-player.js && bash -n scripts/deploy.sh` | ✅ existing | ⬜ pending |
| 24-04-03 | 04 | 3 | VID-24-13 | T-24-04-01 / T-24-04-02 | sw.js CACHE bumped to invalidate stale PWA installs; deploy.sh aborts on smoke failure | infra (grep + curl) | `grep "couch-v37-native-video-player" sw.js && curl -fsSL https://couchtonight.app/sw.js \| grep -q "couch-v37-native-video-player"` | ✅ existing | ⬜ pending |
| 24-04-04 | 04 | 3 | (uat scaffold) | — | UAT scripts cover both branches + DRM-hide silent dead-end + Phase 26 schema anchor | doc-as-test (grep) | `test -f .planning/phases/24-native-video-player/24-HUMAN-UAT.md && grep -c "⬜ pending" .planning/phases/24-native-video-player/24-HUMAN-UAT.md` | ❌ W0 (this task creates it) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase Requirements → Test Map (from RESEARCH §Validation Architecture)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VID-24-02 | `parseVideoUrl('https://youtube.com/watch?v=ABC123def')` → `{source:'youtube', id:'ABC123def', url:...}` | unit | `npm run smoke:native-video-player` | ❌ Wave 0 — NEW file |
| VID-24-02 | `parseVideoUrl('https://youtu.be/ABC123def')` → `{source:'youtube',...}` | unit | (same) | ❌ Wave 0 |
| VID-24-02 | `parseVideoUrl('https://youtube.com/shorts/ABC123def')` → `{source:'youtube',...}` | unit | (same) | ❌ Wave 0 |
| VID-24-02 | `parseVideoUrl('https://m.youtube.com/watch?v=ABC123def')` → `{source:'youtube',...}` | unit | (same) | ❌ Wave 0 |
| VID-24-02 | `parseVideoUrl('https://youtube.com/embed/ABC123def')` → `{source:'youtube',...}` | unit | (same) | ❌ Wave 0 |
| VID-24-04 | `parseVideoUrl('https://example.com/movie.mp4')` → `{source:'mp4', url:...}` | unit | (same) | ❌ Wave 0 |
| VID-24-04 | `parseVideoUrl('https://192.168.1.1:32400/file.mp4?token=abc')` → `{source:'mp4', url:...}` (Plex case) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('https://example.com/page.html')` → `null` (rejection) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('garbage')` → `null` (invalid URL) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('')` → `null` | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl(null)` → `null` (defensive) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('file:///etc/passwd')` → `null` (security) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('javascript:alert(1)')` → `null` (XSS guard) | unit | (same) | ❌ Wave 0 |
| VID-24-05 | `titleHasNonDrmPath(t)` returns `false` when `t.providers === [Netflix]` and rent/buy empty | unit | (same) | ❌ Wave 0 |
| VID-24-05 | `titleHasNonDrmPath(t)` returns `true` when `t.providers === [Netflix]` AND `t.buyProviders === [Apple TV]` | unit | (same) | ❌ Wave 0 |
| VID-24-05 | `titleHasNonDrmPath(t)` returns `true` when no providers known (defensive) | unit | (same) | ❌ Wave 0 |
| VID-24-05 | `titleHasNonDrmPath(null)` returns `true` (defensive) | unit | (same) | ❌ Wave 0 |
| VID-24-10 | `makeIntervalBroadcaster(100, fn)` calls fn at most once per 100ms over 5 rapid invocations (leading edge fires) | unit | (same) | ❌ Wave 0 |
| VID-24-10 | `makeIntervalBroadcaster(100, fn)` trailing-edge fires last value after interval | unit | (same) | ❌ Wave 0 |
| VID-24-08 | wp record schema fields documented (string assertion in smoke) | doc-as-test | (same) | ❌ Wave 0 |
| VID-24-01 | YouTube iframe URL constructed correctly: `enablejsapi=1` AND `playsinline=1` present | unit (string assert against helper output) | (same) | ❌ Wave 0 |
| VID-24-03 | HTML5 video tag string contains `playsinline` attribute | unit (string assert) | (same) | ❌ Wave 0 |
| VID-24-11 | Constructed iframe `src` is XSS-safe (encodeURIComponent applied to videoId) | unit | (same) | ❌ Wave 0 |
| VID-24-13 | sw.js CACHE constant bumped to `couch-v37-native-video-player` | manual smoke (existing pattern) | `grep "couch-v37-native-video-player" sw.js` | ✅ existing pattern |

---

## Wave 0 Requirements

- [x] `scripts/smoke-native-video-player.cjs` — NEW; covers parseVideoUrl + titleHasNonDrmPath + makeIntervalBroadcaster + iframe URL construction (Plan 01 Task 1.1)
- [x] `package.json` `scripts.smoke` chain extended with `&& node scripts/smoke-native-video-player.cjs` (Plan 01 Task 1.2)
- [x] `package.json` `scripts.smoke:native-video-player` alias added (Plan 01 Task 1.2)
- [x] `scripts/deploy.sh` §2.5 if-block extended to gate on the new contract (Plan 01 Task 1.2 — existing pattern from Phase 22)

*(No framework install needed; existing pattern uses plain `node`.)*

---

## Manual-Only Verifications

Per RESEARCH §Validation Architecture — Manual UAT (deferred to `24-HUMAN-UAT.md`):

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS Safari + iOS PWA: paste valid YouTube link → player renders inline | VID-24-01, VID-24-11 | iOS WebKit playsinline behavior is device-only | 24-HUMAN-UAT Script 2 + 3 |
| iOS Safari + iOS PWA: paste valid MP4 link → player renders inline | VID-24-03, VID-24-11 | iOS WebKit playsinline behavior is device-only | 24-HUMAN-UAT Script 4 + 5 |
| DRM-only title (e.g., a Netflix-exclusive) → schedule modal still allows URL field, but live modal hides player surface | VID-24-05 | Requires real TMDB title with provider data + visual byte-for-byte comparison | 24-HUMAN-UAT Script 6 |
| Multi-device: host plays, second device sees `currentTimeMs` updating in DevTools Firestore tab at 5s cadence | VID-24-09 | Requires two real devices on the same family + Firestore Console access | 24-HUMAN-UAT Script 9 |
| Modal close during YT API load → no console errors | T-24-03-09 (modal-close race) | Requires real YouTube IFrame API + browser timing | 24-HUMAN-UAT polish UAT |
| `<video>` 404 → inline error overlay renders, "Try again" reloads | VID-24-14 | Requires real network failure + visual overlay confirmation | 24-HUMAN-UAT polish UAT |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has `node --check` or `node scripts/smoke-*.cjs` or grep-based assertion)
- [x] Wave 0 covers all MISSING references (Plan 01 Task 1.1 creates `scripts/smoke-native-video-player.cjs` BEFORE Plan 02 + Plan 03 reference it)
- [x] No watch-mode flags
- [x] Feedback latency < 24s (full chain runs in ~1s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-30
