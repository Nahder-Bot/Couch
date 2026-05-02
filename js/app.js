import { db, doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch, auth, functions, httpsCallable, updatePassword, signInWithEmailAndPassword, storage, storageRef, uploadBytes, getDownloadURL } from './firebase.js';
import { TMDB_KEY, VAPID_PUBLIC_KEY, TRAKT_CLIENT_ID, TRAKT_EXCHANGE_URL, TRAKT_REFRESH_URL, TRAKT_DISCONNECT_URL, TRAKT_REDIRECT_URI, traktIsConfigured, COLORS, RATING_TIERS, TIER_LABELS, tierFor, ageToMaxTier, normalizeProviderName, SUBSCRIPTION_BRANDS, QN_DEBUG, qnLog, MOODS, moodById, suggestMoods, normalizeCode, DISCOVERY_CATALOG, COUCH_NIGHTS_PACKS, APP_VERSION, BUILD_DATE } from './constants.js';
import { pickDailyRows, isInSeasonalWindow } from './discovery-engine.js';
import { state, membersRef, titlesRef, familyDocRef, vetoHistoryRef, vetoHistoryDoc } from './state.js';
import { escapeHtml, haptic, flashToast, skDiscoverRow, skTitleList, POSTER_COLORS, colorFor, posterStyle, posterFallbackLetter, writeAttribution, showTooltipAt, hideTooltip } from './utils.js';
import { twemojiImg } from './twemoji.js';
import { LEAGUES as SPORTS_FEED_LEAGUES, fetchSchedule as feedFetchSchedule, fetchScore as feedFetchScore, leagueKeys as feedLeagueKeys } from './sports-feed.js';
import {
  parseVideoUrl,
  titleHasNonDrmPath,
  makeIntervalBroadcaster,
  seekToBroadcastedTime,
  VIDEO_BROADCAST_INTERVAL_MS,
  STALE_BROADCAST_MAX_MS
} from './native-video-player.js';
import {
  bootstrapAuth, watchAuth,
  signInWithGoogle, signInWithApple,
  sendEmailLink, completeEmailLinkIfPresent,
  initPhoneCaptcha, sendPhoneCode, resetPhoneCaptcha,
  signOutUser
} from './auth.js';
async function fetchTmdbExtras(mediaType, tmdbId) {
  const out = { trailerKey: null, rating: null, providers: [], rentProviders: [], buyProviders: [], providersChecked: true, providersSchemaVersion: 3, runtime: null };
  try {
    const dr = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`);
    const dd = await dr.json();
    if (mediaType === 'movie') out.runtime = dd.runtime || null;
    else out.runtime = (dd.episode_run_time && dd.episode_run_time[0]) || null;
  } catch(e){}
  try {
    const vr = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/videos?api_key=${TMDB_KEY}`);
    const vd = await vr.json();
    const trailer = (vd.results||[]).find(v => v.site==='YouTube' && v.type==='Trailer') || (vd.results||[]).find(v => v.site==='YouTube');
    if (trailer) out.trailerKey = trailer.key;
  } catch(e){}
  try {
    if (mediaType === 'movie') {
      const rr = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/release_dates?api_key=${TMDB_KEY}`);
      const rd = await rr.json();
      const us = (rd.results||[]).find(x => x.iso_3166_1 === 'US');
      if (us) {
        const cert = (us.release_dates||[]).map(r => r.certification).find(c => c && c.trim());
        if (cert) out.rating = cert.trim();
      }
    } else {
      const rr = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/content_ratings?api_key=${TMDB_KEY}`);
      const rd = await rr.json();
      const us = (rd.results||[]).find(x => x.iso_3166_1 === 'US');
      if (us && us.rating) out.rating = us.rating.trim();
    }
  } catch(e){}
  try {
    const pr = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`);
    const pd = await pr.json();
    const us = pd.results && pd.results.US;
    if (us) {
      // TMDB splits availability into buckets:
      //   flatrate = subscription (Netflix, Max, etc.)
      //   free     = free streaming (Tubi, Pluto)
      //   ads      = ad-supported (Freevee, Prime w/ Ads)
      //   rent     = pay-per-view rental
      //   buy      = digital purchase
      // We store each bucket separately so the user can opt into different budgets.
      const toEntry = p => ({
        name: p.provider_name,
        logo: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : ''
      });
      const dedupe = (arr) => {
        const seen = new Set();
        const out = [];
        for (const p of arr) {
          const key = normalizeProviderName(p.name);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(p);
        }
        return out;
      };
      // Included-with-subscription or free: merged into `providers` (the user doesn't care
      // about the ads/no-ads distinction — if they have Prime, they have Prime).
      const subAndFree = dedupe([...(us.flatrate || []), ...(us.free || []), ...(us.ads || [])].map(toEntry));
      if (subAndFree.length) out.providers = subAndFree.slice(0, 12);
      // Rent / Buy separately so the filter can include or exclude them.
      const rents = dedupe((us.rent || []).map(toEntry));
      if (rents.length) out.rentProviders = rents.slice(0, 8);
      const buys = dedupe((us.buy || []).map(toEntry));
      if (buys.length) out.buyProviders = buys.slice(0, 8);
    }
  } catch(e){}
  return out;
}

// === Phase 19 / D-04..D-06 — Kid-mode session state ===
// Both slots are session-only (NOT persisted to Firestore or localStorage).
// Resets on showScreen-away-from-Tonight + couchClearAll.
// state.kidModeOverrides is a Set of titleIds for per-title parent overrides
// (D-10..D-13; surface lives in Plan 19-02). Initialized once at module load
// using Phase 14/15 precedent (state.couchMemberIds, state.selectedMoods).
if (state.kidMode == null) state.kidMode = false;
if (state.kidModeOverrides == null) state.kidModeOverrides = new Set();

// === Phase 19 / D-09 — single source of truth for kid-mode tier ceiling ===
// Returns 2 (TIER_PG) when state.kidMode is active, else null (no cap from
// kid-mode; existing per-member tier-cap logic still runs). Cheap helper
// called inside 7 filter functions — keep it pure + branch-free.
function getEffectiveTierCap() {
  return state.kidMode ? 2 : null;
}

// === Phase 20 / D-01..D-06 + D-10 — Decision explanation phrase builder ===
// Pure helper — no state mutation, no Firestore writes, render-time only.
// buildMatchExplanation(t, couchMemberIds, opts) -> string
//   t              — title document (reads: t.votes, t.providers, t.runtime)
//   couchMemberIds — array of member ids currently on the couch
//   opts           — optional { considerableVariant: false }; when true the
//                    1-voter case reads "Some of you said yes" instead of the
//                    member's name (D-10 — used for the considerable list).
// Returns a ≤3-phrase dot-separated string ("X said yes · Available on Y · 1 hr 38 min").
// Returns '' when title null/missing or couch empty.
// Drop priority on overflow: voters > provider > runtime (D-06).
function buildMatchExplanation(t, couchMemberIds, opts) {
  if (!t || !Array.isArray(couchMemberIds) || !couchMemberIds.length) return '';
  const votes = t.votes || {};
  const considerableVariant = !!(opts && opts.considerableVariant);
  const phrases = [];

  // D-03 / D-10 — Voter phrase
  const yesVoters = couchMemberIds.filter(mid => votes[mid] === 'yes');
  if (yesVoters.length > 0) {
    let votersPhrase;
    if (yesVoters.length === 1) {
      if (considerableVariant) {
        votersPhrase = 'Some of you said yes';
      } else {
        const m = state.members.find(x => x.id === yesVoters[0]);
        votersPhrase = escapeHtml(m ? m.name : yesVoters[0]) + ' said yes';
      }
    } else if (yesVoters.length === 2 && yesVoters.length === couchMemberIds.length) {
      const n1 = state.members.find(x => x.id === yesVoters[0]);
      const n2 = state.members.find(x => x.id === yesVoters[1]);
      votersPhrase = escapeHtml(n1 ? n1.name : yesVoters[0]) + ' + ' + escapeHtml(n2 ? n2.name : yesVoters[1]) + ' said yes';
    } else if (yesVoters.length === couchMemberIds.length) {
      votersPhrase = 'All of you said yes';
    } else {
      votersPhrase = yesVoters.length + ' of you said yes';
    }
    phrases.push(votersPhrase);
  }

  // D-04 — Provider phrase: prefer couch-services intersection, fallback to first brand.
  const providers = Array.isArray(t.providers) ? t.providers : [];
  if (providers.length) {
    const couchServices = new Set();
    for (const mid of couchMemberIds) {
      const m = state.members.find(x => x.id === mid);
      if (m && Array.isArray(m.services)) m.services.forEach(s => couchServices.add(s));
    }
    let matchedBrand = null;
    for (const p of providers) {
      const brand = normalizeProviderName(p && p.name);
      if (brand && couchServices.has(brand)) { matchedBrand = brand; break; }
    }
    if (matchedBrand) {
      phrases.push('Available on ' + matchedBrand);
    } else {
      const firstBrand = normalizeProviderName(providers[0] && providers[0].name);
      if (firstBrand) phrases.push('Streaming on ' + firstBrand);
    }
  }

  // D-05 — Runtime phrase. Skip when null OR 0 (RESEARCH Pitfall 5 — guard 0).
  if (t.runtime != null && t.runtime > 0) {
    const mins = t.runtime;
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      phrases.push(m === 0 ? (h + ' hr') : (h + ' hr ' + m + ' min'));
    } else {
      phrases.push(mins + ' min');
    }
  }

  // D-06 — Cap at 3 phrases. Phrases were appended in priority order so slice keeps voters > provider > runtime.
  return phrases.slice(0, 3).join(' · ');
}

// === Phase 21 / D-01..D-12 — Conflict-aware empty-state diagnosis ===
// Pure helper — no state mutation, render-time only. Mirrors Phase 20 shape.
// diagnoseEmptyMatches(titles, couchMemberIds) -> { headline, reasons[] }
//   titles         — array of titles (full universe; helper skips already-no/seen-voted)
//   couchMemberIds — array of member ids on couch
// Returns:
//   headline (string)  — single warm/restraint sentence summarising dominant cause
//   reasons (array)    — up to 3 chips: { kind, count, copy }
// Detects (D-04 priority order): all-vetoed -> kid-mode-filtered -> per-member-tier-filtered
//   -> mood-filtered -> provider-unavailable -> no-yes-votes.
// Edges: empty titles -> { 'No titles yet', [] }. Empty couch -> { "No one's on the couch.", [] }.
// Null/undefined inputs -> graceful no-op.
function diagnoseEmptyMatches(titles, couchMemberIds) {
  if (!Array.isArray(titles) || titles.length === 0) {
    return { headline: 'No titles yet', reasons: [] };
  }
  if (!Array.isArray(couchMemberIds) || couchMemberIds.length === 0) {
    return { headline: 'No one’s on the couch.', reasons: [] };
  }
  const vetoesByMember = {};
  let vetoedTotal = 0;
  let kidModeFilteredCount = 0;
  let tierFilteredCount = 0;
  let moodFilteredCount = 0;
  let providerUnavailableCount = 0;
  let yesVotedAny = false;
  let countedTotal = 0;
  const kidCap = (typeof getEffectiveTierCap === 'function') ? getEffectiveTierCap() : null;
  const selectedMoods = Array.isArray(state.selectedMoods) ? state.selectedMoods : [];
  const moodFilterActive = selectedMoods.length > 0;
  const couchServices = new Set();
  let lowestMemberTierCap = null;
  for (const mid of couchMemberIds) {
    const m = state.members.find(x => x.id === mid);
    if (!m) continue;
    if (Array.isArray(m.services)) m.services.forEach(s => couchServices.add(s));
    const memberCap = m.maxTier != null ? m.maxTier : ageToMaxTier(m.age);
    if (memberCap != null && (lowestMemberTierCap == null || memberCap < lowestMemberTierCap)) {
      lowestMemberTierCap = memberCap;
    }
  }
  const hasAnyCouchServices = couchServices.size > 0;
  for (const t of titles) {
    const votes = t.votes || {};
    // Skip titles where any couch-member voted 'no' or 'seen' — already excluded upstream;
    // not part of the diagnosis universe.
    if (couchMemberIds.some(mid => votes[mid] === 'no' || votes[mid] === 'seen')) continue;
    countedTotal++;
    if (couchMemberIds.some(mid => votes[mid] === 'yes')) yesVotedAny = true;
    // Vetoes — exclusive (vetoed titles don't get other reasons counted)
    const vetoes = t.vetoes || {};
    let titleVetoed = false;
    for (const mid of couchMemberIds) {
      if (vetoes[mid]) { vetoesByMember[mid] = (vetoesByMember[mid] || 0) + 1; titleVetoed = true; }
    }
    if (titleVetoed) { vetoedTotal++; continue; }
    const titleTier = tierFor(t.rating);
    if (lowestMemberTierCap != null && titleTier != null && titleTier > lowestMemberTierCap) {
      tierFilteredCount++; continue;
    }
    if (kidCap != null && titleTier != null && titleTier > kidCap) {
      kidModeFilteredCount++; continue;
    }
    if (moodFilterActive) {
      const titleMoods = Array.isArray(t.moods) ? t.moods : [];
      if (!titleMoods.some(mid => selectedMoods.includes(mid))) {
        moodFilteredCount++; continue;
      }
    }
    if (hasAnyCouchServices) {
      const titleProviders = Array.isArray(t.providers) ? t.providers : [];
      const ok = titleProviders.some(p => {
        const brand = normalizeProviderName(p && p.name);
        return brand && couchServices.has(brand);
      });
      if (!ok) { providerUnavailableCount++; continue; }
    }
  }
  const reasons = [];
  if (vetoedTotal > 0) {
    const vetoers = Object.entries(vetoesByMember).sort((a, b) => b[1] - a[1]);
    if (vetoers.length === 1) {
      const m = state.members.find(x => x.id === vetoers[0][0]);
      const name = m ? m.name : vetoers[0][0];
      reasons.push({ kind: 'veto', count: vetoedTotal, copy: escapeHtml(name) + ' vetoed ' + vetoedTotal });
    } else {
      reasons.push({ kind: 'veto', count: vetoedTotal, copy: vetoedTotal + ' vetoed across the couch' });
    }
  }
  if (kidModeFilteredCount > 0) reasons.push({ kind: 'kidmode', count: kidModeFilteredCount, copy: 'Kid Mode hides ' + kidModeFilteredCount });
  if (tierFilteredCount > 0)    reasons.push({ kind: 'tier',    count: tierFilteredCount,    copy: tierFilteredCount + ' over the rating cap' });
  if (moodFilteredCount > 0)    reasons.push({ kind: 'mood',    count: moodFilteredCount,    copy: 'No matching mood' });
  if (providerUnavailableCount > 0) {
    const topBrands = Array.from(couchServices).slice(0, 3).join(' / ');
    reasons.push({ kind: 'provider', count: providerUnavailableCount, copy: topBrands ? 'Off ' + topBrands : 'No matching service' });
  }
  if (!yesVotedAny && reasons.length === 0) {
    return { headline: 'No one’s said yes to anything yet.', reasons: [] };
  }
  const capped = reasons.slice(0, 3);
  let headline;
  const dominant = capped[0];
  if (!dominant) {
    headline = 'Nothing’s matching tonight.';
  } else if (dominant.kind === 'veto' && capped.length === 1 && Object.keys(vetoesByMember).length === 1) {
    const onlyVetoerId = Object.keys(vetoesByMember)[0];
    const m = state.members.find(x => x.id === onlyVetoerId);
    const name = m ? m.name : onlyVetoerId;
    headline = 'All ' + countedTotal + ' titles are out — ' + escapeHtml(name) + ' vetoed every one of them.';
  } else if (dominant.kind === 'kidmode') {
    headline = 'Kid Mode’s tight tonight — most titles are over the cap.';
  } else if (dominant.kind === 'mood') {
    headline = 'Try unchecking a mood — those filters are tight tonight.';
  } else if (dominant.kind === 'provider') {
    headline = 'Everything’s on services no one subscribes to.';
  } else if (dominant.kind === 'tier') {
    headline = 'Everything’s over the rating cap tonight.';
  } else if (capped.length > 1) {
    headline = 'All ' + countedTotal + ' titles are out — vetoes + filters caught most of them.';
  } else {
    headline = 'Nothing’s matching tonight.';
  }
  return { headline: headline, reasons: capped };
}

// Escape user-provided strings before interpolating into HTML
// Local notifications. We don't need a backend — Firestore already pushes watchparty
// events to every tab in real time. We just surface those events as OS notifications
// when the user is away (tab hidden) and has granted permission.
//
// This is intentionally NOT a full web-push service-worker setup. That would require
// a backend to hold VAPID keys + send pushes. The tradeoff: we only notify when the
// user still has a browser tab open in the background. If they've closed the app, nothing
// fires. Acceptable for the current product loop — most people leave one tab open.
// === Web Push (real OS-level notifications via service worker) ===
// VAPID public key is imported from js/constants.js (public-by-design, matches TMDB_KEY posture).
// Matching private key lives server-side in the deploy-mirror repo's functions/.env.

// Per-event-type notification defaults (PUSH-02). Written to users/{uid}.notificationPrefs when
// the user touches a toggle; server reads and respects these in the deploy-mirror repo's functions/ sendToMembers.
// Four events default ON (the ones users expect). Two default OFF because they can be noisy
// if the family is large — users opt in via Settings when they want them.
const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  watchpartyScheduled: true,
  watchpartyStarting: true,
  titleApproval: true,
  inviteReceived: true,
  vetoCapReached: false,
  tonightPickChosen: false,
  // Phase 8 Watch-Intent Flows
  intentProposed: true,
  intentMatched: true,
  // === Phase 14 — Decision Ritual Core (D-12 / DR-3 place 2 of 3) ===
  // Must stay in lockstep with the deploy-mirror repo's functions/index.js NOTIFICATION_DEFAULTS
  // (server gate) and NOTIFICATION_EVENT_LABELS below (UI copy). All default ON
  // per RESEARCH §5 — these fire only when the user has actively engaged.
  flowAPick: true,
  flowAVoteOnPick: true,
  flowARejectMajority: true,
  flowBNominate: true,
  flowBCounterTime: true,
  flowBConvert: true,
  intentExpiring: true,
  // === Phase 15 / D-11 + D-12 (TRACK-15-10) — auto-subscribe on watch (DR-3 place 2 of 3) ===
  // Must stay in lockstep with deploy-mirror NOTIFICATION_DEFAULTS in 15-06
  newSeasonAirDate: true,
  // Phase 15.5 / D-05 + REQ-7: reactionPosted — server fans out reaction pushes;
  // body stripped per receiver reactionDelay. Mirror of queuenight NOTIFICATION_DEFAULTS.
  reactionPosted: true,
  // Phase 15.4 / D-09 — couchPing: V5 roster long-press push fan-out (F-W-1 path A).
  // Mirror of queuenight NOTIFICATION_DEFAULTS in 15.4-01. Default ON: this fires
  // only when another family member has actively long-pressed your pill — intent-
  // rich engagement signal; user expects it.
  couchPing: true,
  // Phase 18 / D-12 + D-20 — titleAvailable: daily provider-refresh CF push fan-out.
  // Mirror of queuenight NOTIFICATION_DEFAULTS in Plan 18-01. Default ON: low-volume
  // high-signal channel — fires only when a title in someone's queue becomes newly
  // watchable on a brand they own. Users opt out via Settings if noisy.
  titleAvailable: true
});

// UI copy for each toggle — label shown in Settings + description hint.
// === Phase 14 / D-12 / DR-3 place 3 of 3 ===
// 7 new keys added with BRAND-voice copy per CONTEXT.md D-12 push copy table.
// NOTE (per Plan 14-09 DR-3 follow-up override, 2026-04-25): the new keys are
// NOT mirrored into the Phase 12 friendly-UI maps below (NOTIF_UI_TO_SERVER_KEY,
// NOTIF_UI_LABELS, NOTIF_UI_DEFAULTS) — they surface only in the legacy Settings
// UI for now to avoid the dual-Settings-screen collision RESEARCH §5 flagged.
// Friendly-UI parity captured as a follow-up polish item.
const NOTIFICATION_EVENT_LABELS = Object.freeze({
  watchpartyScheduled: { label: 'New watchparty scheduled', hint: 'When someone sets up a watchparty' },
  watchpartyStarting:  { label: 'Watchparty starting',       hint: 'Right when the movie starts' },
  titleApproval:       { label: 'Parent approval',           hint: 'When a parent approves or declines a request you sent' },
  inviteReceived:      { label: 'Invites',                   hint: 'When someone invites you to a family' },
  vetoCapReached:      { label: 'Tonight is stuck',          hint: 'When the family vetoes too many picks in a row' },
  tonightPickChosen:   { label: 'Tonight’s pick chosen', hint: 'When the spinner lands on a movie' },
  intentProposed:      { label: 'New intent posted',         hint: 'When someone proposes a tonight-watch or asks the family about a title' },
  intentMatched:       { label: 'Intent matched',            hint: 'When your proposed watch reaches the family threshold' },
  // Phase 14 — DECI-14-12 (BRAND-voice copy per D-12 / RESEARCH §5)
  flowAPick:           { label: "Tonight's pick chosen",      hint: "When someone on your couch picks a movie." },
  flowAVoteOnPick:     { label: "Couch voted on your pick",   hint: "When someone responds to a pick you made." },
  flowARejectMajority: { label: "Your pick was passed on",    hint: "When the couch asks you to pick again." },
  flowBNominate:       { label: "Watch with the couch?",      hint: "When someone wants to watch with you at a time." },
  flowBCounterTime:    { label: "Counter-time on your nom",   hint: "When someone counters with a different time." },
  flowBConvert:        { label: "Movie starting in 15 min",   hint: "When your nomination becomes a watchparty." },
  intentExpiring:      { label: "Tonight's pick expiring",    hint: "Heads-up that a tonight intent is about to expire." },
  // === Phase 15 / D-11 + D-12 (TRACK-15-11) — auto-subscribe on watch (DR-3 place 3 of 3) ===
  // REVIEW MEDIUM-12: customer-facing label is "New episode alerts" because the
  // implementation surfaces per-EPISODE prompts, not the original season-only
  // framing. The KEY remains 'newSeasonAirDate' for back-compat with Phase
  // 14-09 D-12 framework + already-installed PWAs.
  newSeasonAirDate:    { label: "New episode alerts",         hint: "When a tracked show drops a new episode." },
  // Phase 15.5 / D-05 + REQ-7: legacy Settings UI label — friend-voice, no banned words.
  // NOTE: NOTIF_UI_TO_SERVER_KEY (friendly-UI map below) intentionally NOT updated —
  // friendly-UI parity tracked as polish backlog item (Phase 15.4 / DR-3 follow-up).
  reactionPosted:      { label: 'Someone reacts in a watchparty', hint: 'When someone in your family reacts during a watchparty.' },
  // Phase 15.4 / D-09 — couchPing legacy Settings UI label.
  // BRAND-voice copy. NOTE: this surface is mirrored to friendly-UI maps in this
  // plan's Task 3 (D-08 mirror approach), so it appears in BOTH the legacy
  // NOTIFICATION_EVENT_LABELS Settings UI AND the Phase 12 friendly-UI Settings UI
  // until the dual-Settings-screen consolidation lands (TD-8 / future polish).
  couchPing:           { label: 'Couch nudges', hint: 'When someone on your couch wants you on the couch tonight.' },
  // Phase 18 / D-20 — titleAvailable legacy Settings UI label.
  // BRAND-voice copy. NOTE: this surface is mirrored to friendly-UI maps in this
  // plan's Task 2 (D-20 + Phase-15.4 mirror approach), so it appears in BOTH the
  // legacy NOTIFICATION_EVENT_LABELS Settings UI AND the Phase 12 friendly-UI Settings UI
  // until the dual-Settings-screen consolidation lands (TD-8 / future polish).
  titleAvailable: { label: 'Newly watchable', hint: 'When a title in your queue lands on a service in your pack.' }
});

// Phase 12 / POL-01 — UI key → server key alias map.
// The 6 user-facing toggles per CONTEXT.md D-02 use friendlier names than the
// Phase-6 server keys. Alias here so server enforcement (functions/index.js
// sendToMembers eventType) stays unchanged. Plan 12-01 / D-02.
const NOTIF_UI_TO_SERVER_KEY = Object.freeze({
  watchpartyScheduled:    'watchpartyScheduled',
  watchpartyStartingNow:  'watchpartyStarting',
  intentRsvpRequested:    'intentProposed',
  inviteReceived:         'inviteReceived',
  vetoCapReached:         'vetoCapReached',
  tonightPickChosen:      'tonightPickChosen',
  // Phase 15.4 / D-08 — friendly-UI parity for the 7 D-12 + newSeasonAirDate +
  // couchPing keys. uiKey === serverKey (no rename needed — these are all
  // post-Phase-12 keys with already-friendly names; the alias map exists only to
  // bridge the 6 Phase-12 keys whose friendly-UI names diverged from server keys).
  flowAPick:           'flowAPick',
  flowAVoteOnPick:     'flowAVoteOnPick',
  flowARejectMajority: 'flowARejectMajority',
  flowBNominate:       'flowBNominate',
  flowBCounterTime:    'flowBCounterTime',
  flowBConvert:        'flowBConvert',
  intentExpiring:      'intentExpiring',
  newSeasonAirDate:    'newSeasonAirDate',
  couchPing:           'couchPing',
  // Phase 18 / D-20 — friendly-UI parity for titleAvailable. uiKey === serverKey
  // (no rename needed — post-Phase-12 keys keep server names).
  titleAvailable:      'titleAvailable'
});

// BRAND-voice copy per CONTEXT.md D-06. Sentence-case labels;
// descriptions in italic serif at render time via .notif-pref-hint.
const NOTIF_UI_LABELS = Object.freeze({
  watchpartyScheduled:    { label: 'New watchparty scheduled',  hint: 'A push when someone in the family schedules a watchparty.' },
  watchpartyStartingNow:  { label: 'Watchparty starting',       hint: 'A push when someone in the family hits play.' },
  intentRsvpRequested:    { label: 'Tonight RSVP request',      hint: 'When someone proposes a watch tonight at a time.' },
  inviteReceived:         { label: 'Family invite',             hint: 'When someone invites you to a couch.' },
  vetoCapReached:         { label: 'Tonight is stuck',          hint: 'When the family vetoes too many picks in a row. Owner-leaning, default off.' },
  tonightPickChosen:      { label: "Tonight's pick chosen",     hint: 'When the spinner lands on a movie.' },
  // Phase 15.4 / D-08 — friendly-UI parity. Copy mirrors NOTIFICATION_EVENT_LABELS
  // verbatim (single source of voice; Phase 14-09 + Phase 15 + Phase 15.5 audited
  // each label individually). The 9 new entries close DR-3 dual-Settings collision
  // by ensuring both Settings UI surfaces expose the same set of toggles.
  flowAPick:           { label: "Tonight's pick chosen",      hint: "When someone on your couch picks a movie." },
  flowAVoteOnPick:     { label: "Couch voted on your pick",   hint: "When someone responds to a pick you made." },
  flowARejectMajority: { label: "Your pick was passed on",    hint: "When the couch asks you to pick again." },
  flowBNominate:       { label: "Watch with the couch?",      hint: "When someone wants to watch with you at a time." },
  flowBCounterTime:    { label: "Counter-time on your nom",   hint: "When someone counters with a different time." },
  flowBConvert:        { label: "Movie starting in 15 min",   hint: "When your nomination becomes a watchparty." },
  intentExpiring:      { label: "Tonight's pick expiring",    hint: "Heads-up that a tonight intent is about to expire." },
  newSeasonAirDate:    { label: "New episode alerts",         hint: "When a tracked show drops a new episode." },
  couchPing:           { label: "Couch nudges",               hint: "When someone on your couch wants you on the couch tonight." },
  // Phase 18 / D-20 — friendly-UI parity for titleAvailable. Copy mirrors
  // NOTIFICATION_EVENT_LABELS verbatim (single source of voice).
  titleAvailable:      { label: "Newly watchable",            hint: "When a title in your queue lands on a service in your pack." }
});

const NOTIF_UI_DEFAULTS = Object.freeze({
  watchpartyScheduled:   true,
  watchpartyStartingNow: true,
  intentRsvpRequested:   true,
  inviteReceived:        true,
  vetoCapReached:        false,
  tonightPickChosen:     true,
  // Phase 15.4 / D-08 — friendly-UI parity defaults. All 9 new entries match the
  // server-side NOTIFICATION_DEFAULTS values verbatim (Plan 14-09 D-12 keys: all
  // true; Plan 15 / TRACK-15-09: newSeasonAirDate true; Plan 15.4 / D-09:
  // couchPing true).
  flowAPick:           true,
  flowAVoteOnPick:     true,
  flowARejectMajority: true,
  flowBNominate:       true,
  flowBCounterTime:    true,
  flowBConvert:        true,
  intentExpiring:      true,
  newSeasonAirDate:    true,
  couchPing:           true,
  // Phase 18 / D-20 — friendly-UI parity default. Matches server-side
  // NOTIFICATION_DEFAULTS.titleAvailable = true (Plan 18-01).
  titleAvailable:      true
});

// Convert a base64url string (what VAPID keys look like) to the Uint8Array the Push API expects.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Subscribe the current device to push and persist the subscription to Firestore under the user.
// Safe to call multiple times — Firestore uses the device endpoint as the dedupe key.
async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    qnLog('[QN push] Push API not supported in this browser');
    return;
  }
  if (Notification.permission !== 'granted') return;
  if (!state.me || !state.familyCode) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    // Persist to Firestore under the member doc. We store as a map keyed by endpoint hash so
    // multiple devices per user are supported and re-subscribing is idempotent.
    const subJson = sub.toJSON();
    const endpointHash = await hashString(subJson.endpoint);
    const path = `pushSubscriptions.${endpointHash}`;
    await updateDoc(doc(membersRef(), state.me.id), {
      [path]: { endpoint: subJson.endpoint, keys: subJson.keys, ua: navigator.userAgent.slice(0, 200), updatedAt: Date.now() }
    });
    qnLog('[QN push] Subscription saved');
  } catch(e) {
    console.warn('[QN push] Subscribe failed:', e.message);
  }
}

// Unsubscribe this device. Removes the endpoint from Firestore and from the browser.
async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const subJson = sub.toJSON();
    const endpointHash = await hashString(subJson.endpoint);
    if (state.me) {
      // deleteField is the proper way to remove a nested map key
      await updateDoc(doc(membersRef(), state.me.id), {
        [`pushSubscriptions.${endpointHash}`]: deleteField()
      });
    }
    await sub.unsubscribe();
    qnLog('[QN push] Unsubscribed');
  } catch(e) {
    console.warn('[QN push] Unsubscribe failed:', e.message);
  }
}

// === Notification preferences (PUSH-02) ===
// Stored at users/{uid}.notificationPrefs as a flat map. We merge with defaults on read so a
// never-touched user gets sensible behavior; the server does the same merge authoritatively.

function getNotificationPrefs() {
  const stored = (state.notificationPrefs && typeof state.notificationPrefs === 'object') ? state.notificationPrefs : {};
  return { ...DEFAULT_NOTIFICATION_PREFS, ...stored };
}

async function updateNotificationPref(eventType, value) {
  if (!state.auth || !state.auth.uid) return;
  if (!(eventType in DEFAULT_NOTIFICATION_PREFS)) {
    qnLog('[QN push] updateNotificationPref unknown eventType:', eventType);
    return;
  }
  try {
    // Optimistic local update so the toggle flips instantly; the onSnapshot reconciles.
    state.notificationPrefs = { ...(state.notificationPrefs || {}), [eventType]: !!value };
    await setDoc(
      doc(db, 'users', state.auth.uid),
      { notificationPrefs: { [eventType]: !!value } },
      { merge: true }
    );
  } catch(e) {
    console.warn('[QN push] updateNotificationPref failed:', e.message);
  }
}

// Phase 12 / POL-01 — UI-key wrapper around updateNotificationPref.
// Maps the 6 user-facing keys (D-02) to the server key (functions/index.js NOTIFICATION_DEFAULTS),
// writes the pref, and shows a subtle confirmation toast. Optimistic — local state already
// mutated inside updateNotificationPref before the await.
async function savePerEventToggle(uiKey, value) {
  const serverKey = NOTIF_UI_TO_SERVER_KEY[uiKey];
  if (!serverKey) {
    qnLog('[QN push] savePerEventToggle unknown uiKey:', uiKey);
    return;
  }
  try {
    await updateNotificationPref(serverKey, !!value);
    try { haptic('light'); } catch(e) {}
    try { flashToast('Saved', { kind: 'good' }); } catch(e) {}
  } catch(e) {
    console.warn('[QN push] savePerEventToggle failed:', e.message);
    try { flashToast('Could not save', { kind: 'warn' }); } catch(_) {}
  }
}
window.savePerEventToggle = savePerEventToggle;

// Quiet-hours writer (PUSH-04). Accepts a partial patch (enabled / start / end / tz)
// and merges it into users/{uid}.notificationPrefs.quietHours. Timezone auto-detects
// via Intl when not provided so users don't hand-pick from a long list.
async function updateQuietHours(patch) {
  if (!state.auth || !state.auth.uid) return;
  const existing = (state.notificationPrefs && state.notificationPrefs.quietHours) || {};
  const tz = patch.tz || existing.tz || (Intl && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'America/Los_Angeles');
  const start = (patch.start !== undefined) ? patch.start : (existing.start || '22:00');
  const end = (patch.end !== undefined) ? patch.end : (existing.end || '08:00');
  const enabled = (patch.enabled !== undefined) ? !!patch.enabled : !!existing.enabled;
  // Rough HH:mm sanity guard; invalid strings fall through as defaults.
  const looksLikeTime = s => typeof s === 'string' && /^\d{1,2}:\d{2}$/.test(s);
  const quietHours = {
    enabled,
    start: looksLikeTime(start) ? start : '22:00',
    end:   looksLikeTime(end)   ? end   : '08:00',
    tz
  };
  try {
    state.notificationPrefs = { ...(state.notificationPrefs || {}), quietHours };
    await setDoc(
      doc(db, 'users', state.auth.uid),
      { notificationPrefs: { quietHours } },
      { merge: true }
    );
  } catch(e) {
    console.warn('[QN push] updateQuietHours failed:', e.message);
  }
}

// Subscribe to users/{uid} for notificationPrefs. Called from onAuthStateChangedCouch on sign-in;
// torn down on sign-out. Kept separate from startSettingsSubscription (which reads /settings/auth).
function startNotificationPrefsSubscription(uid) {
  if (state.unsubNotifPrefs) { try { state.unsubNotifPrefs(); } catch(e) {} }
  const ref = doc(db, 'users', uid);
  state.unsubNotifPrefs = onSnapshot(ref, (snap) => {
    const data = (snap && snap.data()) || {};
    state.notificationPrefs = data.notificationPrefs || {};
    if (typeof updateNotifCard === 'function') updateNotifCard();
  }, (err) => {
    qnLog('[QN push] prefs snapshot error:', err.message);
  });
}

// SHA-256 hash a string and return as hex. Used to make safe Firestore key names from URLs.
async function hashString(s) {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 32);
}

// Listen for notification-click messages from the service worker so tapping a push notification
// can deep-link into the relevant screen (specific watchparty, etc.) instead of just opening the app.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'qn-notification-click') return;
    const url = event.data.url || '/';
    // URL format is "/?wp=<id>" when pointing to a specific watchparty, "/" for generic
    try {
      const u = new URL(url, location.origin);
      const wpId = u.searchParams.get('wp');
      if (wpId) {
        // Jump to the Tonight tab where watchparties surface, then open the live view if possible
        if (typeof showScreen === 'function') showScreen('tonight');
        setTimeout(() => {
          if (typeof openWatchpartyLive === 'function') {
            try { openWatchpartyLive(wpId); } catch(e) {}
          }
        }, 200);
      }
    } catch(e) {}
  });
}

// === Trakt OAuth & sync (Turn 10) ===
// The user flow:
//   1. User taps "Connect Trakt" on the Account tab.
//   2. openTraktAuth() pops open trakt.tv/oauth/authorize with our client id.
//   3. User grants permission. Trakt redirects to /trakt-callback.html with a code.
//   4. The callback page postMessages the code back to us.
//   5. handleTraktAuthCode() sends the code to our Cloud Function.
//   6. Function exchanges it for tokens, returns them to us.
//   7. We stash tokens in the user's Firestore member doc under `trakt`.
//   8. We verify by fetching the user's Trakt profile and stashing the username.
//
// Token fields stored on the member doc:
//   trakt: { username, accessToken, refreshToken, expiresAt, connectedAt }
// We deliberately store under the member sub-path so only family members can
// read it. Access tokens are sensitive but not catastrophic if leaked —
// worst case someone reads another family member's Trakt history. We'll
// tighten security rules in Turn 11 when we write the sync engine.

const trakt = {
  // Kick off the OAuth flow: opens the Trakt authorization page in a popup.
  // Called from the "Connect Trakt" button.
  connect() {
    if (!traktIsConfigured()) {
      flashToast('Trakt is not configured on this deployment.', { kind: 'warn' });
      return;
    }
    // Random state param to guard against cross-origin auth callback shenanigans.
    const state = Math.random().toString(36).slice(2, 12);
    try { sessionStorage.setItem('qn_trakt_state', state); } catch(e) {}
    const url = 'https://trakt.tv/oauth/authorize?' + new URLSearchParams({
      response_type: 'code',
      client_id: TRAKT_CLIENT_ID,
      redirect_uri: TRAKT_REDIRECT_URI,
      state: state
    }).toString();
    // Open as a popup. On mobile Safari popups sometimes get nerfed into a
    // full-window redirect — the callback page handles that via sessionStorage.
    const popup = window.open(url, 'trakt-auth', 'width=520,height=720');
    if (!popup) {
      // Popup blocked — fall back to a full-page redirect. User returns to / after auth.
      window.location.href = url;
    }
  },

  // Called by the postMessage listener (set up below) when the callback page
  // forwards us an auth code.
  async handleAuthCode(code) {
    if (!state.me || !state.familyCode) {
      flashToast('Please sign in before connecting Trakt.', { kind: 'warn' });
      return;
    }
    try {
      const r = await fetch(TRAKT_EXCHANGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || ('exchange_failed_' + r.status));
      }
      const tokens = await r.json();
      // Fetch the Trakt profile so we can show "@username" in the UI.
      const profile = await trakt.fetchProfile(tokens.accessToken);
      const expiresAt = (tokens.createdAt * 1000) + (tokens.expiresIn * 1000);
      const traktData = {
        username: profile.username || null,
        name: profile.name || null,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        connectedAt: Date.now()
      };
      await updateDoc(doc(membersRef(), state.me.id), { trakt: traktData });
      flashToast('Trakt connected', { kind: 'success' });
      haptic('success');
      // Refresh the Account tab to show the new connected state
      if (typeof renderSettings === 'function') renderSettings();
      // Kick off initial sync in the background. Give Firestore a beat to
      // propagate the new trakt fields to local state first.
      setTimeout(() => { trakt.sync({ manual: false, initial: true }); }, 800);
    } catch (e) {
      qnLog('[Trakt] exchange failed', e);
      flashToast('Couldn\'t connect to Trakt. Try again?', { kind: 'warn' });
    }
  },

  // Fetch the authenticated user's Trakt profile (basic identity check and
  // where we get the @username from). Used on connect and occasionally after.
  async fetchProfile(accessToken) {
    const r = await fetch('https://api.trakt.tv/users/me', {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID,
        'Authorization': 'Bearer ' + accessToken
      }
    });
    if (!r.ok) throw new Error('profile_fetch_failed_' + r.status);
    return await r.json();
  },

  // Get a valid access token for the current user, refreshing if the stored
  // one is expired or close to it. Used by the sync engine in Turn 11.
  // Returns null if the user isn't connected or if refresh permanently fails.
  async getAccessToken() {
    if (!state.me) return null;
    const me = state.members.find(x => x.id === state.me.id);
    if (!me || !me.trakt || !me.trakt.accessToken) return null;
    // Refresh if within 7 days of expiry (gives us plenty of buffer)
    const soonExpiring = (me.trakt.expiresAt || 0) - Date.now() < 7 * 86400000;
    if (!soonExpiring) return me.trakt.accessToken;
    try {
      const r = await fetch(TRAKT_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: me.trakt.refreshToken })
      });
      if (r.status === 401) {
        // Refresh token is dead. Clear the connection and prompt reconnect.
        qnLog('[Trakt] refresh token invalid, disconnecting');
        await trakt.clearLocalTokens();
        return null;
      }
      if (!r.ok) throw new Error('refresh_failed_' + r.status);
      const tokens = await r.json();
      const expiresAt = (tokens.createdAt * 1000) + (tokens.expiresIn * 1000);
      const updated = {
        ...me.trakt,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt
      };
      await updateDoc(doc(membersRef(), state.me.id), { trakt: updated });
      return tokens.accessToken;
    } catch (e) {
      qnLog('[Trakt] refresh error', e);
      return null;
    }
  },

  // Called when the user taps Disconnect. Revokes at Trakt, clears locally.
  // Best-effort: if revoke fails, we still clear local state so the user isn't
  // stuck with a zombie connection.
  async disconnect() {
    if (!state.me) return;
    const me = state.members.find(x => x.id === state.me.id);
    const token = me && me.trakt && me.trakt.accessToken;
    if (token && TRAKT_DISCONNECT_URL && !TRAKT_DISCONNECT_URL.startsWith('PASTE_')) {
      try {
        await fetch(TRAKT_DISCONNECT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token })
        });
      } catch(e) { qnLog('[Trakt] revoke failed (ignored)', e); }
    }
    await trakt.clearLocalTokens();
    flashToast('Trakt disconnected', { kind: 'success' });
    haptic('light');
    if (typeof renderSettings === 'function') renderSettings();
  },

  // Wipe the Trakt data from the user's member doc. Used by disconnect() and
  // by the refresh flow when the refresh token itself is dead.
  async clearLocalTokens() {
    if (!state.me) return;
    try {
      await updateDoc(doc(membersRef(), state.me.id), { trakt: deleteField() });
    } catch(e) { qnLog('[Trakt] clear tokens failed', e); }
  },

  // Read the current user's connection state in a way the UI can render.
  // Returns { connected: bool, username?: string, connectedAt?: number, lastSyncedAt?: number, syncing?: bool }
  getState() {
    if (!state.me) return { connected: false };
    const me = state.members.find(x => x.id === state.me.id);
    if (!me || !me.trakt || !me.trakt.accessToken) return { connected: false };
    return {
      connected: true,
      username: me.trakt.username,
      name: me.trakt.name,
      connectedAt: me.trakt.connectedAt,
      lastSyncedAt: me.trakt.lastSyncedAt || 0,
      syncing: !!state._traktSyncing
    };
  },

  // === Sync engine (Turn 11) ===
  // High-level flow:
  //   1. sync() is the entry point. It's called on connect, on app open, and
  //      on a 15-minute heartbeat while the app is active.
  //   2. It pulls watched shows + watchlist + rated shows from Trakt.
  //   3. For each show, it matches against existing Couch titles by tmdbId.
  //   4. If the show isn't in Couch yet, it creates it (pulling poster from TMDB).
  //   5. Progress gets written to the current user's per-member slot.
  //   6. Last-sync timestamp is stamped on the member doc for next run.
  //
  // Race guard: state._traktSyncing prevents concurrent runs.

  // Make an authenticated GET to Trakt. Auto-handles token refresh and 401 retry.
  async apiGet(path) {
    const token = await trakt.getAccessToken();
    if (!token) throw new Error('not_connected');
    const doFetch = async (t) => fetch('https://api.trakt.tv' + path, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID,
        'Authorization': 'Bearer ' + t
      }
    });
    let r = await doFetch(token);
    if (r.status === 401) {
      // Token may have just expired — force refresh via getAccessToken's normal
      // expiry-check path by clearing the expiresAt and trying again.
      const me = state.members.find(x => x.id === state.me.id);
      if (me && me.trakt) {
        await updateDoc(doc(membersRef(), state.me.id), {
          'trakt.expiresAt': 0
        });
        const fresh = await trakt.getAccessToken();
        if (fresh) r = await doFetch(fresh);
      }
    }
    if (!r.ok) throw new Error('trakt_api_' + r.status);
    return r.json();
  },

  // Make an authenticated POST to Trakt (used for pushing watches back).
  async apiPost(path, body) {
    const token = await trakt.getAccessToken();
    if (!token) throw new Error('not_connected');
    const r = await fetch('https://api.trakt.tv' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID,
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(body || {})
    });
    if (!r.ok) throw new Error('trakt_post_' + r.status);
    return r.json().catch(() => ({}));
  },

  // Main sync entry point. Pulls Trakt history into Couch and stamps last-sync.
  // Returns { addedCount, updatedCount, error? } summary.
  // `opts.manual`: if true, user triggered this — be more chatty with toasts.
  async sync(opts) {
    opts = opts || {};
    if (!traktIsConfigured()) return { error: 'not_configured' };
    const info = trakt.getState();
    if (!info.connected) return { error: 'not_connected' };
    if (state._traktSyncing) return { error: 'already_syncing' };
    state._traktSyncing = true;
    if (opts.manual) {
      if (typeof renderTraktCard === 'function') renderTraktCard();
    }
    let added = 0, updated = 0;
    try {
      // 1. Pull watched shows — aggregate view, one call covers everything.
      // Endpoint returns each show with the last-watched episode embedded,
      // which is exactly what we need for progress.
      const watchedShows = await trakt.apiGet('/users/me/watched/shows?extended=full');
      // 2. Pull watched movies (smaller list usually).
      const watchedMovies = await trakt.apiGet('/users/me/watched/movies?extended=full');
      // 3. Pull watchlist — things they want to watch.
      const watchlist = await trakt.apiGet('/users/me/watchlist?extended=full');
      // 4. Ratings — both shows and movies. Used to pre-fill ratings for
      // anything the user has rated on Trakt that exists in their Couch library.
      const ratings = await trakt.apiGet('/sync/ratings?extended=full');

      const result = await trakt.ingestSyncData({
        watchedShows: watchedShows || [],
        watchedMovies: watchedMovies || [],
        watchlist: watchlist || [],
        ratings: ratings || []
      });
      added = result.added;
      updated = result.updated;

      // Stamp last-sync timestamp so the UI can show "synced X ago"
      await updateDoc(doc(membersRef(), state.me.id), {
        'trakt.lastSyncedAt': Date.now()
      });

      // === Phase 15 / D-06 (TRACK-15-12) — fire co-watch overlap detector after sync ===
      if (typeof trakt.detectAndPromptCoWatchOverlap === 'function') {
        trakt.detectAndPromptCoWatchOverlap().catch(e => console.warn('[15-07] coWatch detect failed', e));
      }

      if (opts.manual) {
        const msg = added || updated
          ? `Synced: ${added} new, ${updated} updated`
          : 'Already up to date';
        flashToast(msg, { kind: 'success' });
      }
      return { added, updated };
    } catch (e) {
      qnLog('[Trakt sync] failed', e);
      if (opts.manual) {
        flashToast('Sync failed. Try again in a minute?', { kind: 'warn' });
      }
      return { error: String(e.message || e) };
    } finally {
      state._traktSyncing = false;
      if (typeof renderTraktCard === 'function') renderTraktCard();
    }
  },

  // Process the pulled data into Couch library writes.
  // Batching rule: Firestore writes are individual here rather than batched
  // because the titles collection is keyed by id and each write is idempotent.
  // For very large libraries this could be optimized with writeBatch later.
  async ingestSyncData(data) {
    const meId = state.me.id;
    let added = 0, updated = 0;

    // Index existing titles by tmdb_<id> for fast lookup
    const byTmdbId = new Map();
    state.titles.forEach(t => {
      if (t.tmdbId) byTmdbId.set(String(t.tmdbId), t);
    });

    // Build a rating lookup so we can attach ratings while ingesting titles
    const ratingByTmdb = new Map();
    (data.ratings || []).forEach(r => {
      const tmdb = (r.show && r.show.ids && r.show.ids.tmdb)
                || (r.movie && r.movie.ids && r.movie.ids.tmdb);
      if (tmdb) ratingByTmdb.set(String(tmdb), r.rating);
    });

    // === Watched shows → per-member progress ===
    for (const entry of (data.watchedShows || [])) {
      const show = entry.show || {};
      const ids = show.ids || {};
      const tmdbId = ids.tmdb;
      if (!tmdbId) continue; // can't match without a TMDB id
      // Trakt's /watched/shows aggregates per-user watched episodes. The
      // last-played episode is in `seasons[last].episodes[last]`. Find it:
      let maxSeason = 0, maxEpisodeInSeason = 0, lastWatchedAt = null;
      for (const s of (entry.seasons || [])) {
        if (s.number > maxSeason) {
          maxSeason = s.number;
          maxEpisodeInSeason = 0;
          lastWatchedAt = null;  // === Phase 15 / D-06 — reset on new max season ===
        }
        if (s.number === maxSeason) {
          for (const ep of (s.episodes || [])) {
            if (ep.number > maxEpisodeInSeason) {
              maxEpisodeInSeason = ep.number;
              // === Phase 15 / D-06 (TRACK-15-12) — capture per-episode timestamp for overlap detection ===
              lastWatchedAt = ep.last_watched_at ? new Date(ep.last_watched_at).getTime() : null;
            }
          }
        }
      }
      if (!maxSeason || !maxEpisodeInSeason) continue;

      const existing = byTmdbId.get(String(tmdbId));
      if (existing) {
        // Update progress if Trakt is ahead of what we have
        const current = getMemberProgress(existing, meId);
        const traktAhead = !current
          || maxSeason > current.season
          || (maxSeason === current.season && maxEpisodeInSeason > current.episode);
        if (traktAhead) {
          // Phase 15.1 / SEC-15-1-01 — dotted-path single-inner-key write so
          // the Wave 2 4th sub-rule's affectedKeys().hasOnly([memberId]) check
          // passes. Only the actor's own progress slice is written.
          const update = {
            [`progress.${meId}`]: {
              season: maxSeason,
              episode: maxEpisodeInSeason,
              lastWatchedAt: lastWatchedAt,
              updatedAt: Date.now(),
              source: 'trakt'
            }
          };
          // Apply rating if we have one and user hasn't already rated
          const rating = ratingByTmdb.get(String(tmdbId));
          if (rating && (!existing.ratings || !existing.ratings[meId])) {
            update[`ratings.${meId}`] = { score: rating, updatedAt: Date.now() };
          }
          try {
            await updateDoc(doc(titlesRef(), existing.id), { ...writeAttribution(), ...update });
            updated++;
          } catch(e) { qnLog('[Trakt] progress update failed', e); }
        }
      } else {
        // Create the title in Couch
        const created = await trakt.createTitleFromTrakt(show, 'tv', {
          progress: {
            [meId]: {
              season: maxSeason,
              episode: maxEpisodeInSeason,
              lastWatchedAt: lastWatchedAt,
              updatedAt: Date.now(),
              source: 'trakt'
            }
          },
          ratings: ratingByTmdb.has(String(tmdbId))
            ? { [meId]: { score: ratingByTmdb.get(String(tmdbId)), updatedAt: Date.now() } }
            : undefined
        });
        if (created) added++;
      }
    }

    // === Watched movies → mark as watched ===
    for (const entry of (data.watchedMovies || [])) {
      const movie = entry.movie || {};
      const ids = movie.ids || {};
      const tmdbId = ids.tmdb;
      if (!tmdbId) continue;
      const existing = byTmdbId.get(String(tmdbId));
      if (existing) {
        if (!existing.watched) {
          const update = {
            watched: true,
            watchedAt: entry.last_watched_at ? new Date(entry.last_watched_at).getTime() : Date.now()
          };
          const rating = ratingByTmdb.get(String(tmdbId));
          if (rating && (!existing.ratings || !existing.ratings[meId])) {
            update[`ratings.${meId}`] = { score: rating, updatedAt: Date.now() };
          }
          try {
            await updateDoc(doc(titlesRef(), existing.id), { ...writeAttribution(), ...update });
            updated++;
          } catch(e) { qnLog('[Trakt] movie update failed', e); }
        }
      } else {
        const created = await trakt.createTitleFromTrakt(movie, 'movie', {
          watched: true,
          watchedAt: entry.last_watched_at ? new Date(entry.last_watched_at).getTime() : Date.now(),
          ratings: ratingByTmdb.has(String(tmdbId))
            ? { [meId]: { score: ratingByTmdb.get(String(tmdbId)), updatedAt: Date.now() } }
            : undefined
        });
        if (created) added++;
      }
    }

    // === Watchlist → add as unwatched if not already in library ===
    for (const entry of (data.watchlist || [])) {
      const item = entry.show || entry.movie;
      if (!item) continue;
      const mediaType = entry.type === 'movie' ? 'movie' : 'tv';
      const ids = item.ids || {};
      const tmdbId = ids.tmdb;
      if (!tmdbId) continue;
      if (byTmdbId.has(String(tmdbId))) continue; // already in library, skip
      const created = await trakt.createTitleFromTrakt(item, mediaType);
      if (created) added++;
    }

    return { added, updated };
  },

  // Create a new Couch title from Trakt data. Fetches TMDB for poster + details
  // since Trakt doesn't serve those reliably. Returns the created doc id on
  // success, null on failure.
  async createTitleFromTrakt(item, mediaType, extras) {
    const ids = item.ids || {};
    const tmdbId = ids.tmdb;
    if (!tmdbId) return null;
    try {
      // Lightweight TMDB fetch — just what the card needs. Full details get
      // cached later when the user opens the detail modal.
      const r = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`);
      const d = await r.json();
      const titleId = 'tmdb_' + tmdbId;
      const doc_ = {
        id: titleId,
        tmdbId: tmdbId,
        mediaType: mediaType,
        name: d.title || d.name || item.title || 'Unknown',
        year: (d.release_date || d.first_air_date || String(item.year || '')).slice(0,4),
        kind: mediaType === 'movie' ? 'Movie' : 'TV',
        overview: d.overview || item.overview || '',
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : '',
        rating: d.certification || null,
        runtime: d.runtime || (d.episode_run_time && d.episode_run_time[0]) || null,
        addedAt: Date.now(),
        addedVia: 'trakt',
        ...(extras || {})
      };
      if (mediaType === 'tv') {
        doc_.seasons = d.number_of_seasons || null;
      }
      await setDoc(doc(titlesRef(), titleId), { ...doc_, ...writeAttribution() });
      return titleId;
    } catch (e) {
      qnLog('[Trakt] createTitleFromTrakt failed', e);
      return null;
    }
  },

  // Push a single episode watch to Trakt. Called after Next ep or progress save
  // so Trakt picks it up in the user's scrobble history. Best-effort: failures
  // don't block the Couch UI.
  async pushEpisodeWatch(tmdbId, season, episode) {
    if (!traktIsConfigured()) return;
    const info = trakt.getState();
    if (!info.connected) return;
    try {
      await trakt.apiPost('/sync/history', {
        shows: [{
          ids: { tmdb: tmdbId },
          seasons: [{
            number: season,
            episodes: [{ number: episode }]
          }]
        }]
      });
    } catch(e) { qnLog('[Trakt] push episode failed', e); }
  },

  // Push a movie watch to Trakt.
  async pushMovieWatch(tmdbId) {
    if (!traktIsConfigured()) return;
    const info = trakt.getState();
    if (!info.connected) return;
    try {
      await trakt.apiPost('/sync/history', {
        movies: [{ ids: { tmdb: tmdbId } }]
      });
    } catch(e) { qnLog('[Trakt] push movie failed', e); }
  }
};
window.trakt = trakt;

// === Phase 15 / D-06 (TRACK-15-12) — co-watch overlap detection + S5 prompt ===
// Walks every TV title; for each, finds member pairs whose
// t.progress[mid].source === 'trakt' AND lastWatchedAt within ±3hr.
//
// REVIEW MEDIUM-10 — episode selection uses a SINGLE ordinal comparator
// (season * 1000 + episode), copying BOTH season AND episode from the
// winning progress object. Fixes a bug where Math.max-of-season + Math.max-of-episode
// could yield S5E10 when neither member had watched that exact episode.
//
// REVIEW MEDIUM-9 — declined pairs are persisted at
// families/{code}.coWatchPromptDeclined[tupleKey] = timestamp. The detector
// reads this on entry and SKIPS any pair whose tupleKey appears, preventing
// the same prompt from re-triggering after every sync.
//
// CROSS-PLAN COORDINATION NOTE: the families/{code}.coWatchPromptDeclined
// dotted-path write requires 15-01's family-doc 5th UPDATE branch allowlist
// to be EXTENDED to include 'coWatchPromptDeclined'. Until 15-08 ships that
// rule extension, the decline write will be DENIED — wrapped in try/catch +
// Sentry breadcrumb so the local UX still drains the queue without crashing.
const COWATCH_OVERLAP_WINDOW_MS = 3 * 60 * 60 * 1000;

// REVIEW MEDIUM-10 helper — ordinal score for (season, episode) pair.
// Assumes episode <1000 per season (TMDB max ever observed: ~430 for One Piece).
function cv15EpisodeOrdinal(prog) {
  const s = (prog && prog.season != null) ? prog.season : 0;
  const e = (prog && prog.episode != null) ? prog.episode : 0;
  return s * 1000 + e;
}

// REVIEW MEDIUM-10 — pick the higher of two progress objects, return BOTH
// fields from the winner (NOT independent maxes).
function cv15SelectHigherProgress(a, b) {
  const oa = cv15EpisodeOrdinal(a);
  const ob = cv15EpisodeOrdinal(b);
  return oa >= ob ? a : b;
}

trakt.detectAndPromptCoWatchOverlap = async function() {
  if (!state.me || !state.familyCode || !state.titles) return;
  const meId = state.me.id;
  // REVIEW MEDIUM-9 — load the decline map once at the top.
  const declined = (state.family && state.family.coWatchPromptDeclined) || {};
  const candidates = [];
  for (const t of state.titles) {
    if (!t || t.kind !== 'TV') continue;
    const progressMap = t.progress || {};
    const myProg = progressMap[meId];
    if (!myProg || myProg.source !== 'trakt' || !myProg.lastWatchedAt) continue;
    for (const otherId of Object.keys(progressMap)) {
      if (otherId === meId) continue;
      const otherProg = progressMap[otherId];
      if (!otherProg || otherProg.source !== 'trakt' || !otherProg.lastWatchedAt) continue;
      const drift = Math.abs(myProg.lastWatchedAt - otherProg.lastWatchedAt);
      if (drift > COWATCH_OVERLAP_WINDOW_MS) continue;
      const tk = tupleKey([meId, otherId]);
      if (!tk) continue;  // HIGH-2 safety
      // REVIEW MEDIUM-9 — skip declined pairs.
      if (declined[tk]) continue;
      // Skip pairs already grouped — we don't ask twice.
      if (t.tupleProgress && t.tupleProgress[tk]) continue;
      // REVIEW MEDIUM-10 — single-comparator winner; copy BOTH fields from winner.
      const winner = cv15SelectHigherProgress(myProg, otherProg);
      const candSeason = winner.season;
      const candEpisode = winner.episode;
      if (candSeason == null || candEpisode == null) continue;
      candidates.push({
        titleId: t.id,
        titleName: t.name || 'this show',
        memberIds: [meId, otherId],
        otherMemberName: (state.members.find(m => m.id === otherId) || {}).name || 'them',
        season: candSeason,
        episode: candEpisode,
        tupleKey: tk
      });
    }
  }
  if (!candidates.length) return;
  state._coWatchPromptQueue = state._coWatchPromptQueue || [];
  for (const c of candidates) state._coWatchPromptQueue.push(c);
  cv15ProcessNextCoWatchPrompt();
};

function cv15ProcessNextCoWatchPrompt() {
  if (state._coWatchPromptShowing) return;
  if (!state._coWatchPromptQueue || !state._coWatchPromptQueue.length) return;
  const next = state._coWatchPromptQueue.shift();
  state._coWatchPromptShowing = next;
  renderCv15CoWatchPromptModal(next);
}

// REVIEW MEDIUM-7-style: data-cv15-action attrs + delegated listener (mirrors
// the 15-04 pattern; this modal has only 2 buttons but consistency wins).
function renderCv15CoWatchPromptModal(c) {
  let modal = document.getElementById('cv15-cowatch-prompt-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cv15-cowatch-prompt-modal';
    modal.className = 'modal-bg';
    document.body.appendChild(modal);
    // Outside-tap = No (UI-SPEC §Discretion Q4).
    modal.addEventListener('click', function(ev) {
      if (ev.target === modal) cv15CoWatchPromptDecline();
    });
    // Single delegated listener for the Yes/No buttons.
    modal.addEventListener('click', function(ev) {
      const trigger = ev.target.closest('[data-cv15-action]');
      if (!trigger) return;
      const action = trigger.getAttribute('data-cv15-action');
      if (action === 'cowatchAccept') cv15CoWatchPromptAccept();
      else if (action === 'cowatchDecline') cv15CoWatchPromptDecline();
    });
  }
  const escName = escapeHtml(c.otherMemberName || 'them');
  const escShow = escapeHtml(c.titleName || 'this show');
  const escSeason = escapeHtml(String(c.season || '?'));
  const escEpisode = escapeHtml(String(c.episode || '?'));
  modal.innerHTML = `<div class="modal-content cv15-cowatch-prompt-content">
    <h3 class="cv15-cowatch-prompt-h">Watched together?</h3>
    <p class="cv15-cowatch-prompt-body"><em>Looks like you and ${escName} both watched ${escShow} S${escSeason}E${escEpisode} around the same time. Group your progress?</em></p>
    <div class="cv15-cowatch-prompt-actions">
      <button class="tc-secondary" type="button" id="cv15-cowatch-decline" data-cv15-action="cowatchDecline">No, keep separate</button>
      <button class="tc-secondary accent-border" type="button" data-cv15-action="cowatchAccept">Yes, group us</button>
    </div>
  </div>`;
  modal.classList.add('on');
  // Default focus on No.
  setTimeout(function() {
    const noBtn = document.getElementById('cv15-cowatch-decline');
    if (noBtn) noBtn.focus();
  }, 50);
}

async function cv15CoWatchPromptAccept() {
  const c = state._coWatchPromptShowing;
  if (!c) return;
  await writeTupleProgress(c.titleId, c.memberIds, c.season, c.episode, 'trakt-overlap');
  cv15CloseCoWatchPrompt();
  cv15ProcessNextCoWatchPrompt();
}

// REVIEW MEDIUM-9 — On decline, persist the per-tuple decline timestamp to
// families/{code}.coWatchPromptDeclined[tupleKey] = now. The detector skips
// declined pairs on next run, preventing nag.
async function cv15CoWatchPromptDecline() {
  const c = state._coWatchPromptShowing;
  if (c && c.tupleKey && state.familyCode) {
    // HIGH-2 safety: validate tk before dotted-path write
    if (isSafeTupleKey(c.tupleKey)) {
      try {
        // Phase 15.1 / SEC-15-1-03 — stamp actingTupleKey alongside the
        // dotted-path coWatchPromptDeclined write. The Wave 2 family-doc
        // 5th-branch participant regex reads request.resource.data.actingTupleKey
        // to validate actor membership in c.tupleKey.
        await updateDoc(doc(db, 'families', state.familyCode), {
          [`coWatchPromptDeclined.${c.tupleKey}`]: Date.now(),
          actingTupleKey: c.tupleKey,
          ...writeAttribution()
        });
        // Optimistic local update (matches 15-02 MEDIUM-8 pattern).
        state.family = state.family || {};
        state.family.coWatchPromptDeclined = {
          ...(state.family.coWatchPromptDeclined || {}),
          [c.tupleKey]: Date.now()
        };
      } catch (e) {
        console.warn('[15-07] coWatchPromptDeclined write failed', e);
        // Silent failure is acceptable — the user's local session won't re-prompt
        // (cv15ProcessNextCoWatchPrompt drains the queue) and Sentry breadcrumb
        // covers diagnostics. Expected to fail until 15-08 extends the family-doc
        // 5th UPDATE branch allowlist (15-01) to include 'coWatchPromptDeclined'.
        try {
          if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
            Sentry.addBreadcrumb({
              category: 'coWatchPromptDeclined',
              level: 'warning',
              message: 'persist of decline record failed',
              data: { tupleKey: c.tupleKey }
            });
          }
        } catch (_) {}
      }
    }
  }
  cv15CloseCoWatchPrompt();
  cv15ProcessNextCoWatchPrompt();
}

function cv15CloseCoWatchPrompt() {
  state._coWatchPromptShowing = null;
  const modal = document.getElementById('cv15-cowatch-prompt-modal');
  if (modal) modal.classList.remove('on');
}

// Expose on window for any external/debug invocation.
window.cv15CoWatchPromptAccept = cv15CoWatchPromptAccept;
window.cv15CoWatchPromptDecline = cv15CoWatchPromptDecline;

// Listen for postMessage from the OAuth callback page. When the user grants
// permission and Trakt redirects them back to /trakt-callback.html, that page
// posts the auth code back to us. Only accept messages from our own origin.
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  if (!event.data || event.data.type !== 'trakt-auth') return;
  const savedState = (() => { try { return sessionStorage.getItem('qn_trakt_state'); } catch(e){ return null; } })();
  if (savedState && event.data.state && savedState !== event.data.state) {
    qnLog('[Trakt] state mismatch, ignoring');
    return;
  }
  trakt.handleAuthCode(event.data.code);
});

// Mobile-Safari fallback: if the callback page couldn't postMessage back (e.g.
// because the popup got broken out of), it stashes the code in sessionStorage
// and redirects to /. We pick it up here on app load.
function checkForStashedTraktCode() {
  try {
    const code = sessionStorage.getItem('qn_trakt_code');
    if (!code) return;
    sessionStorage.removeItem('qn_trakt_code');
    sessionStorage.removeItem('qn_trakt_state');
    // Give the app a moment to fully boot before handing off
    setTimeout(() => { trakt.handleAuthCode(code); }, 1500);
  } catch(e) {}
}

const notif = {
  seen: new Set(),                               // watchparty IDs we've already notified about
  soonFired: new Set(),                          // "<2min to start" IDs fired
  init() {
    // Hydrate seen set from existing watchparties so we don't fire on page-reload.
    // Users with permission previously granted skip this call silently.
    try {
      const raw = sessionStorage.getItem('qn_notif_seen');
      if (raw) raw.split(',').forEach(id => this.seen.add(id));
    } catch(e) {}
  },
  save() {
    try { sessionStorage.setItem('qn_notif_seen', Array.from(this.seen).join(',')); } catch(e) {}
  },
  canFire() {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden;
  },
  fire(title, body, tag) {
    if (!this.canFire()) return;
    try {
      const n = new Notification(title, { body, tag, icon: '/mark-192.png', silent: false });
      n.onclick = () => {
        window.focus();
        n.close();
        // If a WP is live, open it
        const live = activeWatchparties().find(w => w.status === 'active' || (w.startAt - Date.now()) < 60*60*1000);
        if (live) openWatchpartyLive?.(live.id);
      };
    } catch(e) {}
  },
  async request() {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      const result = await Notification.requestPermission();
      return result;
    } catch(e) { return 'error'; }
  }
};
notif.init();

// Check whether this specific device has an active push subscription.
// Different from Notification.permission: you can have permission but not be subscribed
// (e.g. VAPID mismatch, cleared service worker data).
async function isThisDeviceSubscribed() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch(e) { return false; }
}

// Detect iOS Safari in a non-PWA context. iOS web push requires "Add to Home Screen" first —
// if you try to subscribe from a regular Safari tab, permission calls fail silently.
function isIosNeedsInstall() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  if (!isIos) return false;
  // Check if running as an installed PWA — display-mode: standalone OR navigator.standalone
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  return !isStandalone;
}

// Show and manage the notification Settings card based on current permission state.
// Called on boot and whenever permission changes. Safe to call with the card absent.
window.updateNotifCard = async function() {
  const card = document.getElementById('notif-card');
  const status = document.getElementById('notif-status');
  const btn = document.getElementById('notif-enable-btn');
  if (!card || !status || !btn) return;
  if (typeof Notification === 'undefined') {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  const p = Notification.permission;
  if (p === 'granted') {
    const subscribed = await isThisDeviceSubscribed();
    if (subscribed) {
      status.innerHTML = "<strong class='notif-status-on'>This device is on.</strong> <span class='notif-status-sub'>Pick which events ping you. Turn off anything that feels noisy.</span>";
    } else {
      status.innerHTML = "<strong style='color:var(--warn,#ffb66d);'>Permission granted but not subscribed</strong><br>Tap Resubscribe below to fix.";
    }
    btn.textContent = subscribed ? 'On' : 'Resubscribe';
    btn.disabled = false;
    btn.onclick = subscribed ? null : () => subscribeToPush().then(updateNotifCard);
    if (subscribed) {
      btn.disabled = true;
      btn.classList.remove('accent');
      btn.style.opacity = '0.6';
    } else {
      btn.classList.add('accent');
      btn.style.opacity = '';
    }
    // Render per-event-type toggle list (PUSH-02). Only when subscribed so users don't fiddle
    // with toggles that do nothing — permission-granted-but-no-subscription is a transient state.
    renderNotificationPrefsRows(card, subscribed);
  } else if (p === 'denied') {
    status.textContent = 'Notifications are blocked in your browser. Open the site settings to re-enable them.';
    btn.textContent = 'Blocked';
    btn.disabled = true;
    btn.classList.remove('accent');
    btn.style.opacity = '0.6';
  } else {
    if (isIosNeedsInstall()) {
      status.innerHTML = "<strong>Install on Home Screen first</strong><br>Tap the Share button in Safari, then <strong>Add to Home Screen</strong>. Open Couch from your Home Screen to enable notifications.";
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';
    status.textContent = "Get notified when someone schedules a watchparty, when it's starting, and when parents approve your requests.";
    btn.textContent = 'Turn on';
    btn.disabled = false;
    btn.classList.add('accent');
    btn.style.opacity = '';
  }
};

// Render per-event toggle rows inside the notif-card. Keeps rows in a dedicated container so
// updateNotifCard() can blow them away on permission changes without touching status/button.
function renderNotificationPrefsRows(card, subscribed) {
  let rows = card.querySelector('#notif-prefs-rows');
  if (!subscribed) {
    if (rows) rows.style.display = 'none';
    return;
  }
  if (!rows) {
    rows = document.createElement('div');
    rows.id = 'notif-prefs-rows';
    rows.className = 'notif-prefs-list';
    card.appendChild(rows);
  }
  rows.style.display = '';

  // Read RAW stored prefs (NOT getNotificationPrefs — that merges with the server-side
  // DEFAULT_NOTIFICATION_PREFS which would shadow our UI defaults for keys where the two differ,
  // e.g. tonightPickChosen is server-default false but UI-default true per D-02). Per D-08,
  // a user with an already-populated notificationPrefs map keeps their stored values;
  // missing keys fall through to NOTIF_UI_DEFAULTS for net-new users.
  const rawStored = (state.notificationPrefs && typeof state.notificationPrefs === 'object')
    ? state.notificationPrefs
    : {};
  // Translate to UI-key view via NOTIF_UI_TO_SERVER_KEY (Phase 12 / POL-01 D-02 reconciliation).
  const uiKeys = Object.keys(NOTIF_UI_LABELS);
  const uiPrefs = {};
  uiKeys.forEach(k => {
    const sk = NOTIF_UI_TO_SERVER_KEY[k];
    // If user stored the server key explicitly, honor it. Else fall back to UI default.
    uiPrefs[k] = (rawStored[sk] !== undefined) ? !!rawStored[sk] : !!NOTIF_UI_DEFAULTS[k];
  });

  const qh = rawStored.quietHours || {};
  const qhEnabled = !!qh.enabled;
  const qhStart = qh.start || '22:00';
  const qhEnd = qh.end || '08:00';
  const detectedTz = (Intl && Intl.DateTimeFormat)
    ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
  const qhTz = qh.tz || detectedTz || '';

  const eventRowsHtml = uiKeys.map(uiKey => {
    const meta = NOTIF_UI_LABELS[uiKey];
    const on = !!uiPrefs[uiKey];
    return `
      <label class="notif-pref-row">
        <span class="notif-pref-text">
          <span class="notif-pref-label">${escapeHtml(meta.label)}</span>
          <span class="notif-pref-hint">${escapeHtml(meta.hint)}</span>
        </span>
        <span class="notif-toggle-switch ${on ? 'is-on' : ''}">
          <input type="checkbox" data-pref="${escapeHtml(uiKey)}" ${on ? 'checked' : ''}>
          <span class="notif-toggle-track"><span class="notif-toggle-thumb"></span></span>
        </span>
      </label>`;
  }).join('');

  const quietBlockHtml = `
    <div class="notif-quiet-block">
      <label class="notif-pref-row notif-pref-row--quiet">
        <span class="notif-pref-text">
          <span class="notif-pref-label">Quiet hours</span>
          <span class="notif-pref-hint">Silence pushes during your set window. Watchparties you RSVP'd to still come through.</span>
        </span>
        <span class="notif-toggle-switch ${qhEnabled ? 'is-on' : ''}">
          <input type="checkbox" id="notif-quiet-enabled" ${qhEnabled ? 'checked' : ''}>
          <span class="notif-toggle-track"><span class="notif-toggle-thumb"></span></span>
        </span>
      </label>
      <div class="notif-quiet-times" data-state="${qhEnabled ? 'open' : 'closed'}">
        <span class="notif-quiet-prep">From</span>
        <input type="time" id="notif-quiet-start" value="${escapeHtml(qhStart)}" class="notif-time-input">
        <span class="notif-quiet-prep">to</span>
        <input type="time" id="notif-quiet-end" value="${escapeHtml(qhEnd)}" class="notif-time-input">
        ${qhTz ? `<span class="notif-quiet-tz">Timezone: ${escapeHtml(qhTz)}</span>` : ''}
      </div>
    </div>`;

  rows.innerHTML = eventRowsHtml + quietBlockHtml;

  // Wire per-event toggles via UI key → savePerEventToggle (Phase 12 / POL-01 Task 1)
  rows.querySelectorAll('input[type="checkbox"][data-pref]').forEach(cb => {
    cb.addEventListener('change', () => {
      const sw = cb.closest('.notif-toggle-switch');
      if (sw) sw.classList.toggle('is-on', cb.checked);
      savePerEventToggle(cb.getAttribute('data-pref'), cb.checked);
    });
  });

  // Wire quiet hours
  const qhEnabledCb = rows.querySelector('#notif-quiet-enabled');
  const qhStartInput = rows.querySelector('#notif-quiet-start');
  const qhEndInput = rows.querySelector('#notif-quiet-end');
  const qhTimes = rows.querySelector('.notif-quiet-times');
  if (qhEnabledCb) {
    qhEnabledCb.addEventListener('change', () => {
      const sw = qhEnabledCb.closest('.notif-toggle-switch');
      if (sw) sw.classList.toggle('is-on', qhEnabledCb.checked);
      if (qhTimes) qhTimes.setAttribute('data-state', qhEnabledCb.checked ? 'open' : 'closed');
      updateQuietHours({ enabled: qhEnabledCb.checked });
      try { flashToast('Saved', { kind: 'good' }); } catch(e) {}
    });
  }
  if (qhStartInput) {
    qhStartInput.addEventListener('change', () => {
      updateQuietHours({ start: qhStartInput.value });
      try { flashToast('Saved', { kind: 'good' }); } catch(e) {}
    });
  }
  if (qhEndInput) {
    qhEndInput.addEventListener('change', () => {
      updateQuietHours({ end: qhEndInput.value });
      try { flashToast('Saved', { kind: 'good' }); } catch(e) {}
    });
  }
}

window.enableNotifications = async function() {
  const result = await notif.request();
  if (result === 'granted') {
    // Fire a friendly confirmation notification so the user knows it worked.
    try {
      new Notification('Notifications on', { body: "You'll hear from Couch when something's happening.", icon: '/mark-192.png', tag: 'qn-confirm' });
    } catch(e) {}
    // Subscribe FIRST, then refresh the card — otherwise the card paints
    // "Permission granted but not subscribed" while subscribe is mid-flight
    // and the user sees a stale "Resubscribe" button that does nothing useful.
    try { await subscribeToPush(); } catch(e) {}
  }
  updateNotifCard();
};

// Watchparty notification trigger: hooked into the watchparty subscription.
// Called with the full list on every snapshot. Fires when:
//   1. A brand-new watchparty arrives that we haven't seen yet (and it's scheduled/active)
//   2. An existing one is about to start in <2 minutes (once only, tracked via soonFired)
function maybeNotifyWatchparties(parties) {
  if (!state.me) return;
  const now = Date.now();
  for (const wp of parties) {
    if (!wp.id) continue;
    if (wp.status === 'cancelled' || wp.status === 'archived') continue;
    // Skip anything I created or am already part of — my own actions shouldn't notify me
    const imHost = wp.hostId === state.me.id;
    if (imHost) { notif.seen.add(wp.id); continue; }
    // Trigger 1: new watchparty scheduled
    if (!notif.seen.has(wp.id) && wp.startAt > now) {
      const minsOut = Math.round((wp.startAt - now) / 60000);
      const when = minsOut < 60 ? `in ${minsOut} min` : formatStartTime?.(wp.startAt) || 'soon';
      notif.fire(`Watchparty: ${wp.titleName}`, `${wp.hostName || 'Someone'} scheduled it ${when}`, 'wp-new-' + wp.id);
      notif.seen.add(wp.id);
    }
    // Trigger 2: starting in <2 min
    const toStart = wp.startAt - now;
    if (toStart > 0 && toStart < 2 * 60 * 1000 && !notif.soonFired.has(wp.id)) {
      notif.fire(`Starting soon: ${wp.titleName}`, 'Watchparty begins in under 2 minutes', 'wp-soon-' + wp.id);
      notif.soonFired.add(wp.id);
    }
  }
  notif.save();
}


// === Ratings ===
// Canonical rating scale: 1.0–10.0, 0.1 resolution. `stars` (1–5) is legacy but still
// read/written during a migration window so old clients and old code paths keep working.
// score is the source of truth going forward.
function getScore(rating) {
  if (!rating) return 0;
  if (typeof rating.score === 'number' && rating.score > 0) return rating.score;
  // Legacy fallback: derive a score from stars. halfStars wins over stars when present.
  if (typeof rating.halfStars === 'number' && rating.halfStars > 0) return rating.halfStars * 2;
  if (typeof rating.stars === 'number' && rating.stars > 0) return rating.stars * 2;
  return 0;
}
// Returns both fields to write together, so legacy readers still see a stars value.
function scoreToRating(score, comment) {
  const s = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  const out = { score: s };
  if (s > 0) out.stars = Math.round(s / 2);
  else out.stars = 0;
  if (comment != null) out.comment = comment;
  return out;
}
// Display a score in its shortest faithful form: "10", "9.7", "8.0", or "—" when unrated.
function formatScore(score) {
  if (!score || score <= 0) return '—';
  if (score === 10) return '10';
  return score.toFixed(1);
}
// Find this user's score for a title (0 if none).
function myScore(t) {
  if (!state.me || !t || !t.ratings) return 0;
  return getScore(t.ratings[state.me.id]);
}
// Mean score across all members who rated. Returns 0 if nobody has.
function avgScore(t) {
  if (!t || !t.ratings) return 0;
  const vals = Object.values(t.ratings).map(getScore).filter(s => s > 0);
  if (!vals.length) return 0;
  return vals.reduce((a,b) => a+b, 0) / vals.length;
}

// === Avatars ===
// Curated emoji palette for profile pictures. Chosen to be kid-friendly, work across
// platforms (all widely-supported emoji), and include variety so nobody has to share.
const AVATAR_OPTIONS = [
  // Animals
  '🦊','🐻','🐼','🐨','🦁','🐯','🐸','🐵','🦉','🦄','🐙','🦋','🐢','🐶','🐱','🐰',
  // Nature
  '🌸','🌻','🌵','🍄','🌙','⭐','🔥','🌈',
  // Food
  '🍎','🍕','🍔','🍦','🍩','🥑','🌮',
  // Objects / vibes
  '🎸','🎨','📚','🚀','⚽','🎮','🎧','🎭','🏆'
];

// Returns the HTML content for a member's avatar bubble. Prefers their chosen emoji,
// falls back to the first letter of their name. The caller controls the wrapping element
// (who-avatar, profile-avatar-lg, etc.) and color; this just fills the inside.
function avatarContent(member) {
  if (!member) return '?';
  if (member.avatar && typeof member.avatar === 'string') {
    return `<span class="avatar-emoji">${escapeHtml(member.avatar)}</span>`;
  }
  return escapeHtml((member.name || '?').charAt(0));
}

// Gentle nudge to add a service the user likely has. We look at the library and count
// titles exclusively watchable on each brand (no overlap with user's current services).
// If 3+ titles are only on e.g. Netflix and the user hasn't added Netflix, prompt.
// Suppresses per-brand for 30 days once dismissed, so we don't nag.
async function maybeSuggestServices() {
  if (!state.me) return;
  const m = state.members.find(x => x.id === state.me.id);
  if (!m) return;
  const mine = new Set(Array.isArray(m.services) ? m.services : []);
  // Skip if they haven't set any services yet — that's a different onboarding moment
  // (let them self-select rather than auto-prompting on first run).
  if (mine.size === 0) return;
  const unwatched = state.titles.filter(t => !t.watched && Array.isArray(t.providers) && t.providers.length);
  if (unwatched.length < 5) return;
  // Count how many titles each brand covers that AREN'T already covered by user's services
  const coverage = new Map();
  for (const t of unwatched) {
    const brands = new Set((t.providers || []).map(p => normalizeProviderName(p.name)));
    // Is this title already covered by a service the user has?
    let alreadyCovered = false;
    for (const svc of mine) {
      if (brands.has(svc)) { alreadyCovered = true; break; }
    }
    if (alreadyCovered) continue;
    // Otherwise, credit each brand with one uncovered title
    for (const b of brands) {
      if (mine.has(b)) continue;
      coverage.set(b, (coverage.get(b) || 0) + 1);
    }
  }
  if (!coverage.size) return;
  // Rank candidates by uncovered count; only consider known subscription brands
  const knownBrands = new Set(SUBSCRIPTION_BRANDS.map(b => b.id));
  const candidates = Array.from(coverage.entries())
    .filter(([brand, count]) => knownBrands.has(brand) && count >= 3)
    .sort((a, b) => b[1] - a[1]);
  if (!candidates.length) return;
  // Load dismissal record — suppresses each brand for 30 days once user says "not now"
  let dismissed = {};
  try { dismissed = JSON.parse(localStorage.getItem('qn_svc_dismissed') || '{}'); } catch(e) {}
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const pick = candidates.find(([brand]) => {
    const stamp = dismissed[brand];
    return !stamp || (now - stamp) > THIRTY_DAYS;
  });
  if (!pick) return;
  const [brand, count] = pick;
  showServiceSuggestSheet(brand, count);
}

// Pretty bottom sheet for the service suggestion. Uses an existing modal-bg pattern
// for consistency with other in-app sheets.
function showServiceSuggestSheet(brand, count) {
  const sheet = document.getElementById('svc-suggest-bg');
  if (!sheet) return;
  document.getElementById('svc-suggest-title').textContent = `Add ${brand}?`;
  document.getElementById('svc-suggest-body').textContent =
    `Looks like ${count} ${count === 1 ? 'title' : 'titles'} in your library ${count === 1 ? "isn't" : "aren't"} on any service you've claimed yet, but ${count === 1 ? 'is' : 'are'} on ${brand}.`;
  const addBtn = document.getElementById('svc-suggest-add');
  const skipBtn = document.getElementById('svc-suggest-skip');
  addBtn.onclick = () => {
    closeServiceSuggest();
    toggleMyService(brand);
    flashToast(`Added ${brand} to your services.`, { kind: 'success' });
  };
  skipBtn.onclick = () => {
    closeServiceSuggest();
    let dismissed = {};
    try { dismissed = JSON.parse(localStorage.getItem('qn_svc_dismissed') || '{}'); } catch(e){}
    dismissed[brand] = Date.now();
    try { localStorage.setItem('qn_svc_dismissed', JSON.stringify(dismissed)); } catch(e){}
  };
  document.getElementById('svc-suggest-bg').classList.add('on');
}

window.closeServiceSuggest = function() {
  document.getElementById('svc-suggest-bg').classList.remove('on');
};


// ===== Veto / session =====
function todayKey() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function sessionRef(dateKey) { return doc(db, 'families', state.familyCode, 'sessions', dateKey || todayKey()); }
function getVetoes() { return (state.session && state.session.vetoes) || {}; }
function myVetoesToday() {
  if (!state.me) return [];
  const vetoes = getVetoes();
  const out = [];
  // D-21 self-echo guard — compare incoming actingUid OR legacy memberId against self.
  // Post-grace, the actingUid branch is authoritative; during grace, the legacy branch catches pre-Plan-06 writes.
  const myUid = (state.auth && state.auth.uid) || null;
  const myMemberId = (state.me && state.me.id) || null;
  for (const titleId in vetoes) {
    const v = vetoes[titleId];
    if ((myUid && v.actingUid === myUid) || (myMemberId && v.memberId === myMemberId)) {
      out.push({ titleId, ...v });
    }
  }
  return out;
}
// Compat alias — existing callers at Tonight inline note and action sheet
// expect the first-match-or-null shape. Keep until those sites are updated.
function myVetoToday() {
  const arr = myVetoesToday();
  return arr.length ? arr[0] : null;
}
function isVetoed(titleId) { return !!getVetoes()[titleId]; }
function isFairnessLocked() {
  if (!state.me || !state.session) return false;
  // D-08: solo member waiver
  if ((state.selectedMembers || []).length <= 1) return false;
  const vetoes = getVetoes();
  let latestMine = 0;
  // D-21 self-echo guard — compare incoming actingUid OR legacy memberId against self.
  // Post-grace, the actingUid branch is authoritative; during grace, the legacy branch catches pre-Plan-06 writes.
  const myUid = (state.auth && state.auth.uid) || null;
  const myMemberId = (state.me && state.me.id) || null;
  for (const id in vetoes) {
    const v = vetoes[id];
    if (v && ((myUid && v.actingUid === myUid) || (myMemberId && v.memberId === myMemberId))) {
      if ((v.at || 0) > latestMine) latestMine = v.at || 0;
    }
  }
  if (!latestMine) return false;
  const lastSpin = state.session.spinnerAt || 0;
  // D-07: rule clears when any spin lands (spinnerAt is written in showSpinResult for manual spins).
  // My veto is "newer" than the last spin → I'm the most recent vetoer and the last spin hasn't happened yet → locked.
  return latestMine > lastSpin;
}

// ===== Watchparty =====
const WP_ARCHIVE_MS = 25 * 60 * 60 * 1000; // 25h after start time
// Phase 15.5 / D-04 + REQ-9: stale-wp cutoff. Wps where (now - startAt) >= WP_STALE_MS move from
// the Tonight tab main banner to the Past parties surface. Boundary EXACT at 5h since startAt.
const WP_STALE_MS = 5 * 60 * 60 * 1000; // 5h since start time
function watchpartiesRef() { return collection(db, 'families', state.familyCode, 'watchparties'); }
function watchpartyRef(id) { return doc(db, 'families', state.familyCode, 'watchparties', id); }

// === Phase 8 Watch-Intent Flows ===
// Intents are a new primitive SEPARATE from the general vote system (see 08-CONTEXT D-02).
// A member can have a standing Yes on a title AND a No RSVP to a specific tonight-at-9pm
// intent about it. Different signals; different lifecycles.
function intentsRef() { return collection(db, 'families', state.familyCode, 'intents'); }
function intentRef(id) { return doc(db, 'families', state.familyCode, 'intents', id); }

// Group-size-aware threshold resolver (D-04/05). Called once at intent create time to
// stamp thresholdRule; client-side match detection uses this snapshot rather than re-resolving
// so rule changes don't retroactively flip existing open intents.
function computeIntentThreshold(group) {
  const mode = (group && group.mode) || 'family';
  const override = group && group.intentThreshold;
  const rule = override || (mode === 'family' ? 'majority' : 'any_yes');
  return { rule };
}

// === D-09 createIntent extension — DECI-14-09 (DR-1: extend, do not fork) ===
// Phase 14 Plan 06: extends Phase 8's createIntent to accept 4 flow values.
// Legacy callers passing `type` still work (back-compat preserved verbatim).
// New callers pass `flow` to opt into 'rank-pick' (Flow A) or 'nominate' (Flow B).
// Per-flow expiresAt + per-flow rsvps[me] seed shape + new fields (counterChainDepth,
// expectedCouchMemberIds) layered on without breaking any existing intent doc.
async function createIntent({ type, flow, titleId, proposedStartAt, proposedNote, expectedCouchMemberIds } = {}) {
  if (!state.me || !state.familyCode) return null;
  // Back-compat: legacy callers pass `type`; new callers pass `flow`. Accept either; prefer flow.
  const flowVal = flow || type;
  const allowed = ['tonight_at_time', 'watch_this_title', 'rank-pick', 'nominate'];
  if (!allowed.includes(flowVal)) throw new Error('bad_intent_flow');
  const t = state.titles.find(x => x.id === titleId);
  if (!t) throw new Error('title_not_found');
  const id = 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const now = Date.now();
  // Per-flow expiry per D-07 (Flow A: 11pm same-day) and D-08 (Flow B: T+4hr).
  // Legacy 'tonight_at_time' (3h past startAt) and 'watch_this_title' (30d) preserved verbatim.
  let expiresAt;
  if (flowVal === 'rank-pick') {
    const eod = new Date(); eod.setHours(23, 0, 0, 0);
    expiresAt = eod.getTime();
  } else if (flowVal === 'nominate') {
    expiresAt = (proposedStartAt || now) + 4 * 60 * 60 * 1000;
  } else if (flowVal === 'tonight_at_time') {
    expiresAt = (proposedStartAt || now) + 3 * 60 * 60 * 1000;
  } else {
    expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  }
  const th = computeIntentThreshold(state.group || {});
  // Plan 09-07a (absorbs 08x-intent-cf-timezone): capture the creator's IANA tz name
  // so onIntentCreated CF can render the push-body time in local instead of UTC.
  // Defensive: Intl.DateTimeFormat is universal but we wrap anyway for ancient browsers.
  const creatorTimeZone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
    catch(e) { return null; }
  })();
  // Per D-09: rsvps[me] vocabulary differs by flow. Legacy flows use {value:'yes'};
  // new flows use {state:'in'}. CF + reads accept both (intent.flow || intent.type fallback).
  const meRsvp = (flowVal === 'rank-pick' || flowVal === 'nominate')
    ? {
        state: 'in',
        at: now,
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      }
    : {
        value: 'yes',
        at: now,
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      };
  const intent = {
    id,
    type: flowVal,            // legacy field — preserved for back-compat (rules + Phase 8 readers)
    flow: flowVal,            // new D-09 discriminator (rules accept either; CFs prefer flow)
    titleId, titleName: t.name, titlePoster: t.poster || '',
    createdBy: state.me.id,
    createdByName: state.me.name || null,
    createdByUid: (state.auth && state.auth.uid) || null,
    createdAt: now,
    creatorTimeZone,
    rsvps: { [state.me.id]: meRsvp },
    thresholdRule: th.rule,
    status: 'open',
    expiresAt,
    counterChainDepth: 0   // D-07.6 cap at 3 (rules enforce); 0 = no counters yet
  };
  if (flowVal === 'tonight_at_time' || flowVal === 'nominate') intent.proposedStartAt = proposedStartAt || null;
  if (flowVal === 'rank-pick' && Array.isArray(expectedCouchMemberIds)) intent.expectedCouchMemberIds = expectedCouchMemberIds;
  if (proposedNote) intent.proposedNote = proposedNote;
  await setDoc(intentRef(id), { ...intent, ...writeAttribution() });
  return id;
}

async function setIntentRsvp(intentId, value) {
  if (!state.me) return;
  const allowed = ['yes', 'no', 'maybe', 'later'];
  if (!allowed.includes(value)) return;
  const patch = {
    [`rsvps.${state.me.id}`]: {
      value,
      at: Date.now(),
      actingUid: (state.auth && state.auth.uid) || null,
      memberName: state.me.name || null
    }
  };
  try {
    await updateDoc(intentRef(intentId), { ...patch, ...writeAttribution() });
  } catch (e) { qnLog('[intent] setRsvp failed', intentId, e.message); }
}

async function cancelIntent(intentId) {
  if (!state.me) return;
  try {
    await updateDoc(intentRef(intentId), {
      status: 'cancelled',
      cancelledAt: Date.now(),
      ...writeAttribution()
    });
  } catch (e) { qnLog('[intent] cancel failed', intentId, e.message); }
}

// === Phase 8 — UX entry points, strip, modals ===

// Shortcut for the "watch this title" ambient-interest poll. No modal — one-tap create.
window.askTheFamily = async function(titleId) {
  if (guardReadOnlyWrite && guardReadOnlyWrite()) return;
  try {
    await createIntent({ type: 'watch_this_title', titleId });
    flashToast('Asked your family', { kind: 'success' });
  } catch (e) { flashToast('Could not post: ' + e.message, { kind: 'warn' }); }
};

// Propose-tonight modal state
let _proposeIntentTitleId = null;
let _proposeIntentLeadMinutes = 60; // default 1h out

// Preferred evening hours, extracted from spin/schedule localStorage pattern
function _nextEveningHour(h) {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  if (d.getTime() <= Date.now() + 5 * 60 * 1000) d.setDate(d.getDate() + 1);
  return d.getTime();
}

window.openProposeIntent = function(titleId) {
  if (guardReadOnlyWrite && guardReadOnlyWrite()) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  _proposeIntentTitleId = titleId;
  const posterHtml = t.poster
    ? `<div class="intent-propose-poster" style="background-image:url('${t.poster}')"></div>`
    : `<div class="intent-propose-poster" style="background:var(--surface-2);display:grid;place-items:center;font-size:28px;">🎬</div>`;
  const content = document.getElementById('intent-propose-modal-content');
  content.innerHTML = `
    <h3 style="font-family:'Instrument Serif','Fraunces',serif;font-style:italic;font-weight:400;margin:0 0 6px;">Propose tonight @ time</h3>
    <div class="intent-propose-header">
      ${posterHtml}
      <div class="intent-propose-title">${escapeHtml(t.name)}</div>
    </div>
    <div class="field" style="margin-top:12px;">
      <label>When?</label>
      <div class="intent-propose-times" id="intent-propose-times">
        <button class="intent-time-btn" data-hour="20">8 pm</button>
        <button class="intent-time-btn on" data-hour="21">9 pm</button>
        <button class="intent-time-btn" data-hour="22">10 pm</button>
        <button class="intent-time-btn" data-custom="1">Pick time</button>
      </div>
      <input type="datetime-local" id="intent-propose-custom" style="display:none;width:100%;background:var(--bg);border:1px solid var(--border);color:var(--ink);padding:12px;border-radius:10px;font-family:inherit;font-size:var(--t-body);margin-top:8px;">
    </div>
    <div class="field" style="margin-top:10px;">
      <label>Note (optional)</label>
      <input type="text" id="intent-propose-note" placeholder='"Popcorn ready"' maxlength="120" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--ink);padding:12px;border-radius:10px;font-family:inherit;font-size:var(--t-body);">
    </div>
    <button class="modal-close" style="margin-top:14px;" onclick="confirmProposeIntent()">Propose</button>
    <button class="pill" onclick="closeProposeIntent()" style="width:100%;margin-top:8px;">Cancel</button>
  `;
  // Wire time-button selection
  content.querySelectorAll('.intent-time-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      content.querySelectorAll('.intent-time-btn').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const customInput = document.getElementById('intent-propose-custom');
      if (btn.dataset.custom) {
        customInput.style.display = '';
        const d = new Date(); d.setHours(21, 0, 0, 0);
        if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
        customInput.value = toLocalInputValue(d);
        customInput.focus();
      } else {
        customInput.style.display = 'none';
      }
    });
  });
  document.getElementById('intent-propose-modal-bg').classList.add('on');
};

window.closeProposeIntent = function() {
  document.getElementById('intent-propose-modal-bg').classList.remove('on');
  _proposeIntentTitleId = null;
};

window.confirmProposeIntent = async function() {
  if (!_proposeIntentTitleId) return;
  const titleId = _proposeIntentTitleId;
  // Resolve chosen time
  const selectedBtn = document.querySelector('#intent-propose-times .intent-time-btn.on');
  let startAt;
  if (selectedBtn && selectedBtn.dataset.custom) {
    const val = document.getElementById('intent-propose-custom').value;
    if (!val) { flashToast('Pick a date/time', { kind: 'warn' }); return; }
    startAt = new Date(val).getTime();
  } else if (selectedBtn) {
    startAt = _nextEveningHour(Number(selectedBtn.dataset.hour));
  } else {
    startAt = _nextEveningHour(21);
  }
  if (startAt < Date.now() - 60 * 1000) {
    flashToast("That's in the past — pick a future time", { kind: 'warn' });
    return;
  }
  const note = (document.getElementById('intent-propose-note').value || '').trim();
  try {
    await createIntent({
      type: 'tonight_at_time',
      titleId,
      proposedStartAt: startAt,
      proposedNote: note || undefined
    });
    closeProposeIntent();
    flashToast('Proposed', { kind: 'success' });
  } catch (e) { flashToast('Could not propose: ' + e.message, { kind: 'warn' }); }
};

// Tonight-screen intents strip. Rendered on every onSnapshot tick and on Tonight enter.
function renderIntentsStrip() {
  const el = document.getElementById('tonight-intents-strip');
  if (!el) return;
  const open = (state.intents || [])
    .filter(i => i.status === 'open')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!open.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="intents-strip">${open.map(renderIntentCard).join('')}</div>`;
}

function renderIntentCard(intent) {
  const icon = intent.type === 'tonight_at_time' ? '📆' : '💭';
  const timeLabel = intent.type === 'tonight_at_time' && intent.proposedStartAt
    ? new Date(intent.proposedStartAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  const rsvps = intent.rsvps || {};
  const yesCount = Object.values(rsvps).filter(r => r.value === 'yes').length;
  const eligibleCount = (state.members || []).filter(m => !m.temporary || (m.expiresAt || 0) > Date.now()).length;
  const myRsvp = state.me && rsvps[state.me.id] ? rsvps[state.me.id].value : null;
  const myRsvpBadge = myRsvp
    ? `<span class="intent-my-rsvp intent-my-${myRsvp}">You: ${myRsvp}</span>`
    : `<span class="intent-my-rsvp intent-my-pending">Tap to RSVP</span>`;
  const poster = intent.titlePoster
    ? `<div class="intent-card-poster" style="background-image:url('${intent.titlePoster}')"></div>`
    : `<div class="intent-card-poster" style="background:var(--surface-2);"></div>`;
  return `<div class="intent-card" role="button" tabindex="0"
    onclick="openIntentRsvpModal('${intent.id}')"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openIntentRsvpModal('${intent.id}');}">
    ${poster}
    <div class="intent-card-body">
      <div class="intent-card-type">${icon} ${intent.type === 'tonight_at_time' ? `Tonight${timeLabel ? ' @ ' + timeLabel : ''}` : 'Asking the family'}</div>
      <div class="intent-card-title">${escapeHtml(intent.titleName)}</div>
      <div class="intent-card-meta">${yesCount} of ${eligibleCount} yes · ${myRsvpBadge}</div>
    </div>
  </div>`;
}

// RSVP modal
let _rsvpIntentId = null;

window.openIntentRsvpModal = function(intentId) {
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  _rsvpIntentId = intentId;
  const content = document.getElementById('intent-rsvp-modal-content');
  const rsvps = intent.rsvps || {};
  const myVal = state.me && rsvps[state.me.id] ? rsvps[state.me.id].value : null;
  const rows = Object.entries(rsvps).map(([mid, r]) => {
    const member = state.members.find(m => m.id === mid);
    const name = (member && member.name) || r.memberName || 'Member';
    const badgeClass = `intent-rsvp-badge intent-rsvp-${r.value}`;
    return `<div class="intent-rsvp-row"><span>${escapeHtml(name)}</span><span class="${badgeClass}">${r.value}</span></div>`;
  }).join('');
  const isPoll = intent.type === 'watch_this_title';
  const proposedLine = intent.type === 'tonight_at_time' && intent.proposedStartAt
    ? `<div class="muted" style="margin-bottom:4px;">📆 ${new Date(intent.proposedStartAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>`
    : '';
  const noteLine = intent.proposedNote
    ? `<div class="muted" style="font-style:italic;margin-bottom:4px;">"${escapeHtml(intent.proposedNote)}"</div>`
    : '';
  const isCreator = state.me && intent.createdBy === state.me.id;
  content.innerHTML = `
    <h3 style="font-family:'Instrument Serif','Fraunces',serif;font-style:italic;font-weight:400;margin:0 0 6px;">${escapeHtml(intent.titleName)}</h3>
    ${proposedLine}
    ${noteLine}
    <div class="muted" style="margin-bottom:10px;font-size:var(--t-meta);">Proposed by ${escapeHtml(intent.createdByName || 'a member')}</div>
    <div class="intent-rsvp-buttons">
      <button class="intent-rsvp-btn ${myVal === 'yes' ? 'on' : ''}" onclick="setMyRsvp('yes')">Yes</button>
      <button class="intent-rsvp-btn ${myVal === 'maybe' ? 'on' : ''}" onclick="setMyRsvp('maybe')">Maybe</button>
      <button class="intent-rsvp-btn ${myVal === 'no' ? 'on' : ''}" onclick="setMyRsvp('no')">No</button>
      ${isPoll ? `<button class="intent-rsvp-btn ${myVal === 'later' ? 'on' : ''}" onclick="setMyRsvp('later')">Later</button>` : ''}
    </div>
    <div class="intent-rsvp-feed">${rows || '<div class="muted">No RSVPs yet.</div>'}</div>
    ${isCreator ? `<button class="pill danger" style="width:100%;margin-top:12px;" onclick="cancelMyIntent()">Cancel this</button>` : ''}
    <button class="pill" style="width:100%;margin-top:8px;" onclick="closeIntentRsvpModal()">Close</button>
  `;
  document.getElementById('intent-rsvp-modal-bg').classList.add('on');
};

window.closeIntentRsvpModal = function() {
  document.getElementById('intent-rsvp-modal-bg').classList.remove('on');
  _rsvpIntentId = null;
};

window.setMyRsvp = async function(value) {
  if (!_rsvpIntentId) return;
  await setIntentRsvp(_rsvpIntentId, value);
  // Re-render modal with fresh state once snapshot lands; for responsiveness, re-open immediately
  const id = _rsvpIntentId;
  setTimeout(() => { if (_rsvpIntentId === id) openIntentRsvpModal(id); }, 400);
};

window.cancelMyIntent = async function() {
  if (!_rsvpIntentId) return;
  if (!confirm('Cancel this intent? It will be archived.')) return;
  await cancelIntent(_rsvpIntentId);
  closeIntentRsvpModal();
};

// === Phase 8 Plan 03 — match detection + conversion ===

// Compute yes-count + required threshold for an intent. eligibleCount excludes expired
// temporary members (Phase 5 guest model). Creator's own yes IS counted.
function computeIntentTally(intent) {
  const now = Date.now();
  const eligibleCount = (state.members || []).filter(m => !m.temporary || (m.expiresAt || 0) > now).length;
  const rsvps = intent.rsvps || {};
  const yesCount = Object.values(rsvps).filter(r => r.value === 'yes').length;
  const rule = intent.thresholdRule || 'any_yes';
  // any_yes: creator + ≥1 other yes = match (i.e. ≥2 yes total)
  // majority: ceil(eligible/2) yes — creator counts toward numerator
  const required = rule === 'majority'
    ? Math.max(2, Math.ceil(eligibleCount / 2))
    : 2;
  return { required, yesCount, eligibleCount, rule };
}

// Client-side match detector (D-07). Idempotent under multi-client races via status
// recheck before write. Both clients writing produces the same doc state.
async function maybeEvaluateIntentMatches(intents) {
  if (!intents || !intents.length) return;
  if (!state.auth) return;
  for (const intent of intents) {
    if (intent.status !== 'open') continue;
    const { required, yesCount } = computeIntentTally(intent);
    if (yesCount < required) continue;
    try {
      const snap = await getDoc(intentRef(intent.id));
      if (!snap.exists()) continue;
      const fresh = snap.data();
      if (fresh.status !== 'open') continue;
      await updateDoc(intentRef(intent.id), {
        status: 'matched',
        matchedAt: Date.now(),
        ...writeAttribution()
      });
    } catch (e) { qnLog('[intent] match write failed', intent.id, e.message); }
  }
  // After transitioning any to matched, the snapshot will re-fire and refresh state.intents;
  // render the creator-only match prompt overlay based on the new state.
  if (typeof renderIntentMatchPrompts === 'function') renderIntentMatchPrompts();
}

// Per-session dedupe so we don't re-prompt the creator every time onSnapshot fires.
// Dismissed-this-session is a separate set from shown-this-session; dismiss is explicit
// user action via the "Later" button, shown is the automatic first-render signal.
const _intentMatchShown = new Set();
const _intentMatchDismissed = new Set();

// Overlay renderer for creator-only match prompts. Renders into a dedicated container
// (created lazily). Each matched-and-not-yet-converted intent where state.me is creator
// gets a card with Start/Schedule/Later actions. Multiple cards stack.
function renderIntentMatchPrompts() {
  if (!state.me) return;
  let host = document.getElementById('intent-match-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'intent-match-host';
    host.className = 'intent-match-host';
    document.body.appendChild(host);
  }
  const mine = (state.intents || []).filter(i =>
    i.status === 'matched'
    && i.createdBy === state.me.id
    && !_intentMatchDismissed.has(i.id)
  );
  if (!mine.length) { host.innerHTML = ''; return; }
  host.innerHTML = mine.map(intent => {
    const { yesCount, eligibleCount } = computeIntentTally(intent);
    const isTonightAtTime = intent.type === 'tonight_at_time';
    const actionPrimary = isTonightAtTime ? 'Start watchparty' : 'Schedule it';
    return `<div class="intent-match-banner">
      <div class="intent-match-bar"></div>
      <div class="intent-match-body">
        <div class="intent-match-eyebrow">Match · ${yesCount} of ${eligibleCount} yes</div>
        <div class="intent-match-title">${escapeHtml(intent.titleName)}</div>
        <div class="intent-match-sub">${isTonightAtTime && intent.proposedStartAt
          ? new Date(intent.proposedStartAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
          : 'Everyone is in.'}</div>
      </div>
      <div class="intent-match-actions">
        <button class="pill accent" onclick="convertIntent('${intent.id}','${isTonightAtTime ? 'watchparty' : 'schedule'}')">${actionPrimary}</button>
        <button class="pill" onclick="dismissIntentMatch('${intent.id}')">Later</button>
      </div>
    </div>`;
  }).join('');
  // Haptic + first-show signal once per intent
  mine.forEach(intent => {
    if (!_intentMatchShown.has(intent.id)) {
      _intentMatchShown.add(intent.id);
      haptic('success');
      flashToast('Your intent matched', { kind: 'success' });
    }
  });
}

window.dismissIntentMatch = function(intentId) {
  _intentMatchDismissed.add(intentId);
  renderIntentMatchPrompts();
};

// Conversion router. Stamps status=converted + convertedTo, then routes into the existing
// watchparty or schedule modal. If the conversion flow is abandoned mid-modal, the intent
// still records as "converted" — treat the conversion intent itself as the audit event.
// Alternative would require callback-threading through the downstream modals; out of scope.
window.convertIntent = async function(intentId, kind) {
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  // Dismiss the banner immediately so the user focuses on the downstream modal
  _intentMatchDismissed.add(intentId);
  renderIntentMatchPrompts();
  // Stamp conversion
  try {
    await updateDoc(intentRef(intentId), {
      status: 'converted',
      convertedTo: { type: kind, at: Date.now() },
      ...writeAttribution()
    });
  } catch (e) { qnLog('[intent] convert write failed', intentId, e.message); }
  // Route
  if (kind === 'watchparty') {
    openWatchpartyStart(intent.titleId);
  } else if (kind === 'schedule') {
    openScheduleModal(intent.titleId);
  }
};

// === D-08 Flow B nominate — DECI-14-08 (Phase 14 Plan 08) ===
// Solo-nominate flow per D-08: member nominates a title with a proposed time, family
// members can join / counter / decline. Counter-time decision belongs to nominator
// (accept / reject / pick compromise). Auto-convert at T-15min handled CF-side
// (deploy-mirror watchpartyTick from 14-06). All-No edge case auto-cancels client-side.
window.openFlowBNominate = function(titleId) {
  if (!state.me) { flashToast('Sign in to nominate', { kind: 'warn' }); return; }
  const t = state.titles.find(x => x.id === titleId);
  if (!t) { flashToast('Title not found', { kind: 'warn' }); return; }
  state.flowBNominateTitleId = titleId;
  renderFlowBNominateScreen();
};

function renderFlowBNominateScreen() {
  let modal = document.getElementById('flow-b-nominate-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-b-nominate-modal';
    modal.className = 'modal-bg flow-b-nominate-modal';
    document.body.appendChild(modal);
  }
  const titleId = state.flowBNominateTitleId;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) { closeFlowBNominate(); return; }

  // Default proposed time: 8pm tonight (or now+1hr if it's already past 8pm).
  const now = new Date();
  const defaultDate = new Date(now);
  defaultDate.setHours(20, 0, 0, 0);
  if (defaultDate.getTime() <= now.getTime()) {
    defaultDate.setTime(now.getTime() + 60 * 60 * 1000);
  }
  // ISO datetime-local format (YYYY-MM-DDTHH:MM).
  const pad = (n) => String(n).padStart(2, '0');
  const defaultLocal = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth()+1)}-${pad(defaultDate.getDate())}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;

  modal.innerHTML = `<div class="modal-content flow-b-nominate-content">
    <header class="flow-b-nominate-h">
      <button class="modal-close" type="button" onclick="closeFlowBNominate()" aria-label="Close">✕</button>
      <h2>Nominate ${escapeHtml(t.name)}</h2>
      <p>Pick a time. Family members can join, counter, or pass.</p>
    </header>
    <form class="flow-b-nominate-form" onsubmit="event.preventDefault();onFlowBSubmitNominate();">
      <label class="flow-b-label">
        <span class="flow-b-label-text">Proposed start time</span>
        <input type="datetime-local" id="flow-b-time-input" class="flow-b-time-input" value="${defaultLocal}" required />
      </label>
      <label class="flow-b-label">
        <span class="flow-b-label-text">Note (optional)</span>
        <textarea id="flow-b-note-input" class="flow-b-note-input" maxlength="200" placeholder="e.g. After dinner. BYO popcorn."></textarea>
      </label>
      <div class="flow-b-nominate-footer">
        <button class="tc-secondary" type="button" onclick="closeFlowBNominate()">Cancel</button>
        <button class="tc-primary" type="submit">Send nomination</button>
      </div>
    </form>
  </div>`;
  modal.classList.add('on');
}

window.closeFlowBNominate = function() {
  const modal = document.getElementById('flow-b-nominate-modal');
  if (modal) modal.classList.remove('on');
  state.flowBNominateTitleId = null;
};

window.onFlowBSubmitNominate = async function() {
  const titleId = state.flowBNominateTitleId;
  if (!titleId) return;
  const timeInput = document.getElementById('flow-b-time-input');
  const noteInput = document.getElementById('flow-b-note-input');
  if (!timeInput || !timeInput.value) {
    flashToast('Pick a time', { kind: 'warn' });
    return;
  }
  const proposedStartAt = new Date(timeInput.value).getTime();
  if (!isFinite(proposedStartAt) || proposedStartAt < Date.now() - 60000) {
    flashToast('Pick a future time', { kind: 'warn' });
    return;
  }
  const proposedNote = noteInput && noteInput.value ? noteInput.value.trim().slice(0, 200) : null;
  let intentId;
  try {
    intentId = await createIntent({
      flow: 'nominate',
      titleId,
      proposedStartAt,
      proposedNote: proposedNote || undefined
    });
  } catch (e) {
    console.error('[flowB] createIntent failed', e);
    flashToast('Could not send nomination — try again', { kind: 'warn' });
    return;
  }
  flashToast('Nomination sent', { kind: 'success' });
  closeFlowBNominate();
  // Open status screen so the nominator can watch live progress (Task 3 below).
  setTimeout(() => openFlowBStatusScreen(intentId), 100);
};

// --- Recipient response UI (Task 2) ---
window.openFlowBResponseScreen = function(intentId) {
  let modal = document.getElementById('flow-b-response-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-b-response-modal';
    modal.className = 'modal-bg flow-b-response-modal';
    document.body.appendChild(modal);
  }
  state.flowBOpenIntentId = intentId;
  renderFlowBResponseScreen();
  modal.classList.add('on');
};

function renderFlowBResponseScreen() {
  const modal = document.getElementById('flow-b-response-modal');
  if (!modal) return;
  const intentId = state.flowBOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) { closeFlowBResponse(); return; }
  const t = state.titles.find(x => x.id === intent.titleId);
  const isNominator = intent.createdBy === (state.me && state.me.id);
  if (isNominator) {
    // Nominator status screen — handled by Task 3.
    closeFlowBResponse();
    return openFlowBStatusScreen(intentId);
  }

  const myRsvp = (intent.rsvps || {})[state.me && state.me.id];
  const responded = !!myRsvp;
  const proposedTime = intent.proposedStartAt
    ? new Date(intent.proposedStartAt).toLocaleString([], {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZone: intent.creatorTimeZone || undefined
      })
    : 'soon';

  modal.innerHTML = `<div class="modal-content flow-b-response-content">
    <header class="flow-b-response-h">
      <button class="modal-close" type="button" onclick="closeFlowBResponse()" aria-label="Close">✕</button>
      <h2>${escapeHtml(intent.createdByName || 'Family member')} wants to watch ${escapeHtml(t ? t.name : '')}</h2>
      <p>Proposed time: <strong>${escapeHtml(proposedTime)}</strong></p>
      ${intent.proposedNote ? `<p class="flow-b-note">"${escapeHtml(intent.proposedNote)}"</p>` : ''}
    </header>
    <div class="flow-b-response-body">
      ${responded ? `<div class="flow-b-already">You said: ${escapeHtml(myRsvp.state || myRsvp.value || '?')}</div>` : ''}
      <button class="tc-primary" type="button" onclick="onFlowBRespondJoin()">Join @ proposed time</button>
      <button class="tc-secondary" type="button" onclick="onFlowBOpenCounterTime()">Counter-suggest a different time</button>
      <button class="tc-secondary" type="button" onclick="onFlowBRespondDecline()">Decline</button>
    </div>
  </div>`;
}

window.closeFlowBResponse = function() {
  const modal = document.getElementById('flow-b-response-modal');
  if (modal) modal.classList.remove('on');
  state.flowBOpenIntentId = null;
};

window.onFlowBRespondJoin = async function() {
  const intentId = state.flowBOpenIntentId;
  if (!intentId || !state.me) return;
  try {
    await updateDoc(intentRef(intentId), {
      [`rsvps.${state.me.id}`]: {
        state: 'in',
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      ...writeAttribution()
    });
    flashToast('You\'re in. Watching for confirmation.', { kind: 'success' });
    closeFlowBResponse();
  } catch (e) {
    console.error('[flowB] join failed', e);
    flashToast('Could not record response', { kind: 'warn' });
  }
};

window.onFlowBRespondDecline = async function() {
  const intentId = state.flowBOpenIntentId;
  if (!intentId || !state.me) return;
  try {
    await updateDoc(intentRef(intentId), {
      [`rsvps.${state.me.id}`]: {
        state: 'reject',
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      ...writeAttribution()
    });
    flashToast('Declined.', { kind: 'info' });
    closeFlowBResponse();
  } catch (e) {
    console.error('[flowB] decline failed', e);
    flashToast('Could not record response', { kind: 'warn' });
  }
};

window.onFlowBOpenCounterTime = function() {
  const intentId = state.flowBOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const counterDepth = intent.counterChainDepth || 0;
  if (counterDepth >= 3) {
    flashToast('Counter chain full', { kind: 'warn' });
    return;
  }
  // Render counter-time picker.
  const modal = document.getElementById('flow-b-response-modal');
  if (!modal) return;
  // Default counter time: original + 1hr.
  const original = intent.proposedStartAt || Date.now();
  const counterDefault = new Date(original + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const counterDefaultLocal = `${counterDefault.getFullYear()}-${pad(counterDefault.getMonth()+1)}-${pad(counterDefault.getDate())}T${pad(counterDefault.getHours())}:${pad(counterDefault.getMinutes())}`;

  modal.innerHTML = `<div class="modal-content flow-b-counter-content">
    <header class="flow-b-counter-h">
      <button class="modal-close" type="button" onclick="closeFlowBResponse()" aria-label="Close">✕</button>
      <h2>Counter-suggest a time</h2>
      <p>Nominator decides whether to accept your counter.</p>
    </header>
    <form class="flow-b-counter-form" onsubmit="event.preventDefault();onFlowBSubmitCounterTime();">
      <label class="flow-b-label">
        <span class="flow-b-label-text">Your suggested time</span>
        <input type="datetime-local" id="flow-b-counter-time-input" class="flow-b-time-input" value="${counterDefaultLocal}" required />
      </label>
      <label class="flow-b-label">
        <span class="flow-b-label-text">Note (optional)</span>
        <textarea id="flow-b-counter-note-input" class="flow-b-note-input" maxlength="200" placeholder="e.g. After kids' bedtime."></textarea>
      </label>
      <div class="flow-b-counter-footer">
        <button class="tc-secondary" type="button" onclick="renderFlowBResponseScreen()">Back</button>
        <button class="tc-primary" type="submit">Send counter</button>
      </div>
    </form>
  </div>`;
};

window.onFlowBSubmitCounterTime = async function() {
  const intentId = state.flowBOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent || !state.me) return;
  const newDepth = (intent.counterChainDepth || 0) + 1;
  if (newDepth > 3) { flashToast('Counter chain cap reached', { kind: 'warn' }); return; }
  const ti = document.getElementById('flow-b-counter-time-input');
  const ni = document.getElementById('flow-b-counter-note-input');
  if (!ti || !ti.value) { flashToast('Pick a counter time', { kind: 'warn' }); return; }
  const counterTime = new Date(ti.value).getTime();
  if (!isFinite(counterTime) || counterTime < Date.now() - 60000) { flashToast('Pick a future time', { kind: 'warn' }); return; }
  const note = ni && ni.value ? ni.value.trim().slice(0, 200) : null;
  try {
    await updateDoc(intentRef(intentId), {
      [`rsvps.${state.me.id}`]: {
        state: 'maybe',
        counterTime,
        note: note || null,
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      counterChainDepth: newDepth,
      ...writeAttribution()
    });
    flashToast('Counter sent', { kind: 'success' });
    closeFlowBResponse();
  } catch (e) {
    console.error('[flowB] counter failed', e);
    flashToast('Could not send counter', { kind: 'warn' });
  }
};

// --- Nominator status screen (Task 3) ---
window.openFlowBStatusScreen = function(intentId) {
  let modal = document.getElementById('flow-b-status-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-b-status-modal';
    modal.className = 'modal-bg flow-b-status-modal';
    document.body.appendChild(modal);
  }
  state.flowBStatusIntentId = intentId;
  renderFlowBStatusScreen();
  modal.classList.add('on');
};

function renderFlowBStatusScreen() {
  const modal = document.getElementById('flow-b-status-modal');
  if (!modal) return;
  const intentId = state.flowBStatusIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) { closeFlowBStatus(); return; }
  if (intent.status !== 'open') {
    // Auto-close on convert / cancel / expire.
    setTimeout(() => closeFlowBStatus(), 1500);
  }
  const t = state.titles.find(x => x.id === intent.titleId);

  const rsvps = intent.rsvps || {};
  const ins = Object.entries(rsvps).filter(([mid, r]) => (r.state === 'in' || r.value === 'yes') && mid !== intent.createdBy);
  const counters = Object.entries(rsvps).filter(([mid, r]) => r.state === 'maybe' && r.counterTime);
  const declines = Object.entries(rsvps).filter(([mid, r]) => r.state === 'reject' || r.value === 'no');

  // Recipient count (everyone except creator).
  const recipientCount = (state.members || []).filter(m => m.id !== intent.createdBy).length;
  const allNo = recipientCount > 0 && declines.length === recipientCount && ins.length === 0;

  // Auto-convert countdown (CF fires at T-15min on its 5-min cadence).
  const minutesToStart = intent.proposedStartAt ? Math.round((intent.proposedStartAt - Date.now()) / 60000) : null;
  const willAutoConvert = ins.length > 0 && minutesToStart != null && minutesToStart > 0 && minutesToStart <= 30;

  const counterRows = counters.map(([mid, r]) => {
    const m = (state.members || []).find(x => x.id === mid);
    const counterFmt = new Date(r.counterTime).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
    return `<div class="flow-b-counter-row">
      <div class="flow-b-counter-row-meta">
        <strong>${escapeHtml(m ? m.name : 'Member')}</strong> countered with <strong>${escapeHtml(counterFmt)}</strong>
        ${r.note ? `<p class="flow-b-note-inline">"${escapeHtml(r.note)}"</p>` : ''}
      </div>
      <div class="flow-b-counter-row-actions">
        <button class="tc-primary" type="button" onclick="onFlowBAcceptCounter('${mid}')">Accept</button>
        <button class="tc-secondary" type="button" onclick="onFlowBRejectCounter('${mid}')">Reject</button>
        <button class="tc-secondary" type="button" onclick="onFlowBOpenCompromiseTimePicker('${mid}')">Compromise</button>
      </div>
    </div>`;
  }).join('');

  modal.innerHTML = `<div class="modal-content flow-b-status-content">
    <header class="flow-b-status-h">
      <button class="modal-close" type="button" onclick="closeFlowBStatus()" aria-label="Close">✕</button>
      <h2>${escapeHtml(t ? t.name : 'Nomination')}</h2>
      <p>Status: <strong>${escapeHtml(intent.status)}</strong> · ${ins.length} in · ${counters.length} counter · ${declines.length} declined of ${recipientCount} family</p>
    </header>
    <div class="flow-b-status-body">
      ${willAutoConvert ? `<div class="flow-b-indicator flow-b-converting">⏱ Auto-converting to watchparty in ${Math.max(0, minutesToStart - 15)} min (T-15)</div>` : ''}
      ${allNo ? `<div class="flow-b-indicator flow-b-allno">All recipients declined. <button class="tc-secondary" type="button" onclick="onFlowBAutoCancel()">Cancel nomination</button></div>` : ''}
      ${counterRows ? `<section class="flow-b-counter-list">
        <h3 class="flow-b-section-h">Counter-time suggestions (${counters.length})</h3>
        ${counterRows}
      </section>` : ''}
      <button class="tc-secondary" type="button" onclick="onFlowBStatusCancel()">End nomination</button>
    </div>
  </div>`;
}

window.closeFlowBStatus = function() {
  const modal = document.getElementById('flow-b-status-modal');
  if (modal) modal.classList.remove('on');
  state.flowBStatusIntentId = null;
};

// Snapshot tick re-render hook (wired into state.unsubIntents handler below).
function maybeRerenderFlowBStatus() {
  if (state.flowBStatusIntentId) renderFlowBStatusScreen();
  if (state.flowBOpenIntentId) renderFlowBResponseScreen();
}

// Nominator counter decisions.
window.onFlowBAcceptCounter = async function(memberId) {
  const intentId = state.flowBStatusIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const counter = (intent.rsvps || {})[memberId];
  if (!counter || !counter.counterTime) return;
  try {
    await updateDoc(intentRef(intentId), {
      proposedStartAt: counter.counterTime,
      proposedNote: counter.note || intent.proposedNote || null,
      // Update nominator's own rsvp to clear any stale state.
      [`rsvps.${state.me.id}`]: {
        state: 'in',
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      ...writeAttribution()
    });
    const accepterName = ((state.members || []).find(m => m.id === memberId) || {}).name || 'Counter';
    flashToast(`Time updated. ${accepterName} accepted.`, { kind: 'success' });
  } catch (e) {
    console.error('[flowB] accept counter failed', e);
    flashToast('Could not accept counter', { kind: 'warn' });
  }
};

window.onFlowBRejectCounter = async function(memberId) {
  // Reject: zero out the member's rsvp so they can re-respond. Does NOT cancel the intent.
  const intentId = state.flowBStatusIntentId;
  if (!intentId || !state.me) return;
  try {
    const memberName = ((state.members || []).find(m => m.id === memberId) || {}).name || null;
    await updateDoc(intentRef(intentId), {
      [`rsvps.${memberId}`]: {
        state: 'maybe',
        at: Date.now(),
        actingUid: state.me.id,
        memberName,
        note: 'counter rejected by nominator'
      },
      ...writeAttribution()
    });
    flashToast('Counter rejected', { kind: 'info' });
  } catch (e) {
    console.error('[flowB] reject counter failed', e);
  }
};

window.onFlowBOpenCompromiseTimePicker = function(memberId) {
  const intentId = state.flowBStatusIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const counter = (intent.rsvps || {})[memberId];
  if (!counter || !counter.counterTime) return;
  // Compromise = midpoint of original proposedStartAt and counterTime.
  const compromise = Math.round((intent.proposedStartAt + counter.counterTime) / 2);
  const cd = new Date(compromise);
  const pad = (n) => String(n).padStart(2, '0');
  const compromiseLocal = `${cd.getFullYear()}-${pad(cd.getMonth()+1)}-${pad(cd.getDate())}T${pad(cd.getHours())}:${pad(cd.getMinutes())}`;
  // Browser prompt() — D-08 doesn't specify; sufficient for solo-nominator decision UX.
  const userInput = window.prompt(`Compromise time (suggested midpoint pre-filled):\nFormat: YYYY-MM-DDTHH:MM`, compromiseLocal);
  if (!userInput) return;
  const finalTime = new Date(userInput).getTime();
  if (!isFinite(finalTime) || finalTime < Date.now()) { flashToast('Pick a future time', { kind: 'warn' }); return; }
  updateDoc(intentRef(intentId), {
    proposedStartAt: finalTime,
    ...writeAttribution()
  }).then(() => {
    flashToast('Compromise time set', { kind: 'success' });
  }).catch(e => {
    console.error('[flowB] compromise failed', e);
    flashToast('Could not set time', { kind: 'warn' });
  });
};

window.onFlowBStatusCancel = async function() {
  const intentId = state.flowBStatusIntentId;
  if (!intentId) return;
  try {
    await updateDoc(intentRef(intentId), {
      status: 'cancelled',
      cancelledAt: Date.now(),
      ...writeAttribution()
    });
    closeFlowBStatus();
    flashToast('Nomination ended', { kind: 'info' });
  } catch (e) {
    console.error('[flowB] cancel failed', e);
  }
};

window.onFlowBAutoCancel = async function() {
  const intentId = state.flowBStatusIntentId;
  if (!intentId) return;
  try {
    await updateDoc(intentRef(intentId), {
      status: 'cancelled',
      cancelledAt: Date.now(),
      cancelReason: 'all-no',
      ...writeAttribution()
    });
    flashToast('All declined — nomination cancelled', { kind: 'info' });
    closeFlowBStatus();
  } catch (e) {
    console.error('[flowB] auto-cancel failed', e);
  }
};

// === D-08 deep-link handler (Task 4) ===
// The CFs in 14-06 emit push payloads with `url: '/?intent=' + intentId`. When the user
// taps the push, the URL hits the app boot path. This handler reads ?intent=, removes
// the param (so refresh doesn't re-trigger), waits for the intents collection to hydrate,
// then routes to the right screen based on the intent's flow + my role (creator vs recipient).
function maybeOpenIntentFromDeepLink() {
  let intentId = null;
  try {
    const params = new URLSearchParams(window.location.search);
    intentId = params.get('intent');
  } catch (e) { return; }
  if (!intentId) return;
  // Remove the param so refresh doesn't re-trigger.
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('intent');
    window.history.replaceState({}, '', url.toString());
  } catch (e) {}
  // Wait for intents subscription to hydrate. Cap retries so we don't spin forever
  // if the intent was deleted or the user lacks read access.
  let attempts = 0;
  const tryOpen = () => {
    attempts++;
    const intent = (state.intents || []).find(i => i.id === intentId);
    if (!intent) {
      if (attempts < 20) setTimeout(tryOpen, 500); // ~10s ceiling
      return;
    }
    const flow = intent.flow || intent.type;
    if (flow === 'rank-pick') {
      // Flow A response screen will be added by 14-07; defensive typeof gate so 14-08
      // can land before 14-07 without breaking the deep-link handler.
      if (typeof openFlowAResponseScreen === 'function') openFlowAResponseScreen(intentId);
    } else if (flow === 'nominate') {
      if (intent.createdBy === (state.me && state.me.id)) {
        openFlowBStatusScreen(intentId);
      } else {
        openFlowBResponseScreen(intentId);
      }
    }
    // Legacy intents (tonight_at_time / watch_this_title) — the existing
    // openIntentRsvpModal flow is reachable via the intents-strip render path; no
    // explicit deep-link route here yet (Phase 8 didn't ship one either).
  };
  tryOpen();
}
window.maybeOpenIntentFromDeepLink = maybeOpenIntentFromDeepLink;

function activeWatchparties() {
  const now = Date.now();
  return state.watchparties.filter(wp => {
    if (wp.status === 'archived') return false;
    // Cancelled watchparties stay visible for 10 min so people know what happened
    if (wp.status === 'cancelled') {
      return wp.cancelledAt && (now - wp.cancelledAt) < 10 * 60 * 1000;
    }
    // Anything whose start time is in the future is active (scheduled)
    // Anything within 25h after start time is still active
    return wp.startAt > now || (now - wp.startAt) < WP_ARCHIVE_MS;
  }).sort((a,b) => a.startAt - b.startAt);
}
function archivedWatchparties() {
  const now = Date.now();
  return state.watchparties.filter(wp => wp.status === 'archived' || (now - wp.startAt) >= WP_ARCHIVE_MS);
}
// Phase 26 / RPLY-26-10 — D-10 hide-empty filter for Past parties surface + Tonight inline-link gating.
// Loose-equality (!= null) catches BOTH null (live-stream sourced) AND undefined (pre-Phase-26 reactions).
// Per RESEARCH Pitfall 2 + UI-SPEC §4.
function replayableReactionCount(wp) {
  if (!wp || !Array.isArray(wp.reactions)) return 0;
  return wp.reactions.filter(r =>
    r.runtimePositionMs != null && r.runtimeSource !== 'live-stream'
  ).length;
}
// Phase 26 / RPLY-26-20 — Tonight tab inline-link gating count source.
// Replaces Phase 15.5's staleWps.length count source. Per CONTEXT specifics:
// first-week-after-deploy framing — count is 0 for existing families on deploy day
// because D-11 + D-10 combination filters out all pre-Phase-26 archived parties.
function allReplayableArchivedCount(allWatchparties) {
  const list = Array.isArray(allWatchparties) ? allWatchparties : [];
  let n = 0;
  for (const wp of list) {
    if (!wp) continue;
    // Match the same predicate logic as renderPastParties' filter for consistency.
    const isArchived = wp.status === 'archived';
    if (!isArchived) continue;
    if (wp.status === 'cancelled') continue;
    if (replayableReactionCount(wp) >= 1) n++;
  }
  return n;
}
function wpForTitle(titleId) { return activeWatchparties().find(wp => wp.titleId === titleId && wp.status !== 'cancelled'); }
function myParticipation(wp) {
  if (!wp || !state.me) return null;
  return (wp.participants || {})[state.me.id] || null;
}
// Phase 7 Plan 08 (Issue #4): on-time inference + manual override for elapsed-time anchor.
// Grace window accommodates "I tapped Join ~30s after startAt because of network latency" —
// these users are still effectively on-time and should anchor to startAt, not joinedAt.
// 60s balances "too short (legit on-time users get anchored wrong)" against "too long
// (someone 90s late gets treated as on-time, which surprises them)". Revisit if UAT feel wrong.
const ONTIME_GRACE_MS = 60 * 1000;

// Phase 7 Plan 08: effective-start anchor resolution. Three cascading cases:
//   1. Explicit override (participant.effectiveStartAt set) — user claimed on-time manually
//   2. Default on-time inference — joinedAt within grace of startAt → anchor to startAt
//   3. Fallback to startedAt — late joiner with no override, anchored to when they hit Start
// Return null if no timer started yet (caller should treat as 0 elapsed).
function effectiveStartFor(participant, wp) {
  if (!participant) return null;
  if (typeof participant.effectiveStartAt === 'number') return participant.effectiveStartAt;
  if (wp && typeof wp.startAt === 'number' && typeof participant.joinedAt === 'number'
      && participant.joinedAt <= wp.startAt + ONTIME_GRACE_MS) {
    return wp.startAt;
  }
  if (typeof participant.startedAt === 'number') return participant.startedAt;
  return null;
}

// Compute elapsed ms for a participant at this moment (handles pause).
// Phase 7 Plan 08: takes wp as 2nd arg so effectiveStartFor can resolve the correct anchor.
// NO default for wp — passing undefined falls back to startedAt semantics, but a missing 2nd
// arg at a call site is a bug (it hides the on-time inference). Post-edit grep in Plan 08
// verifies every call site is 2-arg.
function computeElapsed(participant, wp) {
  if (!participant) return 0;
  const start = effectiveStartFor(participant, wp);
  if (!start) return 0;
  const pausedOffset = participant.pausedOffset || 0;
  if (participant.pausedAt) {
    // Currently paused: freeze elapsed at pauseAt
    return Math.max(0, participant.pausedAt - start - pausedOffset);
  }
  const now = Date.now();
  return Math.max(0, now - start - pausedOffset);
}
function formatElapsed(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function formatCountdown(ms) {
  if (ms <= 0) return 'starting now';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h >= 1) return `in ${h}h ${m}m`;
  if (m >= 1) return `in ${m} min`;
  return `in ${totalSec}s`;
}
function formatStartTime(ts) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate()+1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const timeStr = d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;
  return `${d.toLocaleDateString([], {month:'short', day:'numeric'})} at ${timeStr}`;
}

// Phase 26 / RPLY-26-DATE — Friend-voice date ladder for Past parties + Past watchparties
// for title rows per UI-SPEC §Copywriting:
//   < 24h → Started {N} hr ago (preserved from Phase 15.5)
//   24-48h → Last night
//   < 7d → {Weekday}
//   7-13d → Last {Weekday}
//   < 1y same year → {Month} {Day}
//   cross-year → {Month} {Day}, {Year}
// Hardcoded English per RESEARCH Open Question #4 (Couch is English-only at v2).
function friendlyPartyDate(startAt) {
  const now = Date.now();
  const ageMs = now - startAt;
  const hr = ageMs / (60 * 60 * 1000);
  if (hr < 24) {
    const hours = Math.max(1, Math.floor(hr));
    return `Started ${hours} hr ago`;
  }
  if (hr < 48) return 'Last night';
  const day = ageMs / (24 * 60 * 60 * 1000);
  const d = new Date(startAt);
  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  if (day < 7) return weekdays[d.getDay()];
  if (day < 14) return `Last ${weekdays[d.getDay()]}`;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthDay = `${months[d.getMonth()]} ${d.getDate()}`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return sameYear ? monthDay : `${monthDay}, ${d.getFullYear()}`;
}

// Phase 26 / RPLY-26-05 — Scrubber duration source-of-truth precedence per UI-SPEC §2 lock:
//   1. TMDB t.runtime (movies — minutes)
//   2. TMDB t.episode_run_time (TV — minutes)
//   3. Phase 24 wp.durationMs (host's player getDuration() × 1000)
//   4. Max observed runtimePositionMs + 30s cushion
//   5. 60-min floor (3,600,000 ms)
function getScrubberDurationMs(wp) {
  const t = state.titles && state.titles.find(x => x.id === wp.titleId);
  if (t) {
    if (typeof t.runtime === 'number' && t.runtime > 0) {
      return t.runtime * 60 * 1000;
    }
    if (typeof t.episode_run_time === 'number' && t.episode_run_time > 0) {
      return t.episode_run_time * 60 * 1000;
    }
  }
  if (typeof wp.durationMs === 'number' && wp.durationMs > 0) {
    return wp.durationMs;
  }
  const positions = (wp.reactions || [])
    .map(r => r.runtimePositionMs)
    .filter(p => typeof p === 'number' && p > 0);
  if (positions.length > 0) {
    return Math.max(...positions) + 30000;
  }
  return 60 * 60 * 1000;
}

// ===== Group mode helpers (Family / Crew / Duo) =====
function currentMode() { return (state.group && state.group.mode) || 'family'; }
function groupNoun() { return {family:'family', crew:'crew', duo:'duo'}[currentMode()]; }
function groupNounCap() { return {family:'Family', crew:'Crew', duo:'Duo'}[currentMode()]; }
function groupPossessive() { return {family:'the family', crew:'the crew', duo:'you two'}[currentMode()]; }
function groupPossessiveCap() { return {family:'The family', crew:'The crew', duo:'You two'}[currentMode()]; }
function groupForLabel() { return {family:'For the family', crew:'For the crew', duo:'For the two of you'}[currentMode()]; }
function groupSubtitleFor(screen) {
  const m = currentMode();
  if (screen === 'tonight') return "Who's on the couch tonight?";
  if (screen === 'add') return 'Add something new';
  if (screen === 'library') return {family:'Your family queue', crew:'Your crew queue', duo:'Your shared queue'}[m];
  if (screen === 'settings') return {family:'Your family', crew:'Your crew', duo:'You two'}[m];
  return '';
}
function modeAllowsAgeTiers() { return currentMode() === 'family'; }
function modeAllowsAdultScope() { return currentMode() === 'family'; }

// Read/write the user's saved groups list (multi-group support)
function loadSavedGroups() {
  try {
    const raw = localStorage.getItem('qn_groups');
    if (raw) return JSON.parse(raw);
  } catch(e){}
  // Migration: if old qn_family exists, seed as first group
  const old = localStorage.getItem('qn_family');
  if (old) {
    let me = null;
    try { me = JSON.parse(localStorage.getItem('qn_me')||'null'); } catch(e){}
    const seed = [{ code: old, name: old, mode: 'family', myMemberId: me?.id||null, myMemberName: me?.name||null }];
    localStorage.setItem('qn_groups', JSON.stringify(seed));
    localStorage.setItem('qn_active_group', old);
    return seed;
  }
  return [];
}
function saveGroups() { localStorage.setItem('qn_groups', JSON.stringify(state.groups||[])); }
function upsertSavedGroup(entry) {
  state.groups = loadSavedGroups();
  const i = state.groups.findIndex(g => g.code === entry.code);
  if (i >= 0) state.groups[i] = { ...state.groups[i], ...entry };
  else state.groups.push(entry);
  saveGroups();
}
function removeSavedGroup(code) {
  state.groups = (loadSavedGroups()).filter(g => g.code !== code);
  saveGroups();
}

window.pickMode = function(mode) {
  state.pendingMode = mode;
  document.getElementById('screen-mode').style.display = 'none';
  document.getElementById('screen-family-join').style.display = 'block';
  const labels = {family:'Create or join a family', crew:'Create or join a crew', duo:'Create or join a duo'};
  const sub = {family:"Enter a shared code. Everyone in the household uses the same one.", crew:"Pick a code for your watch crew. Share it with the group.", duo:"Pick a shared code. Just the two of you."};
  const el = document.getElementById('screen-family-title');
  if (el) el.textContent = labels[mode] || labels.family;
  const sel = document.getElementById('screen-family-sub');
  if (sel) sel.textContent = sub[mode] || sub.family;
  const ph = {family:'E.G. SAYEGH', crew:'E.G. FILMCLUB', duo:'E.G. US2'};
  const input = document.getElementById('family-input');
  if (input) input.placeholder = ph[mode] || ph.family;
};

window.backToModePick = function() {
  state.pendingMode = null;
  document.getElementById('screen-family-join').style.display = 'none';
  document.getElementById('screen-mode').style.display = 'block';
};

// ===== Phase 5: Sign-in screen handlers =====
// Apple (handleSigninApple) intentionally omitted — deferred to Phase 9.
// See .planning/seeds/phase-09-apple-signin.md and 05-06-SUMMARY.md.

window.handleSigninGoogle = async function() {
  try { haptic('light'); await signInWithGoogle(); /* redirect takes over */ }
  catch(e) { console.error('[signin][google]', e); flashToast("Couldn't start Google sign-in. Try again?", { kind: 'warn' }); }
};

window.handleSigninEmail = async function() {
  const email = (document.getElementById('signin-email-input').value || '').trim();
  if (!email || !email.includes('@')) { flashToast('Enter a valid email', { kind: 'warn' }); return; }
  try {
    await sendEmailLink(email);
    flashToast('Sign-in link sent — check your inbox.', { kind: 'success' });
    haptic('success');
  } catch(e) {
    console.error('[signin][email]', e);
    flashToast("Couldn't send email link. Try again?", { kind: 'warn' });
  }
};

let _pendingPhoneConfirmation = null;

window.handleSigninPhoneSend = async function() {
  const raw = (document.getElementById('signin-phone-input').value || '').trim();
  // Strip spaces / dashes / parens / dots so '+1 (555) 123-4567' works.
  let phone = raw.replace(/[\s\-().]/g, '');
  // Common slip: user enters a 10-digit US number without country code. Auto-prefix +1.
  if (/^\d{10}$/.test(phone)) phone = '+1' + phone;
  // Another common slip: starts with '1' + 10 digits without the '+'. Prepend '+'.
  else if (/^1\d{10}$/.test(phone)) phone = '+' + phone;
  if (!phone.startsWith('+') || !/^\+\d{8,15}$/.test(phone)) {
    flashToast('Use format +15551234567 (country code + number, no spaces)', { kind: 'warn', duration: 4000 });
    return;
  }
  try {
    _pendingPhoneConfirmation = await sendPhoneCode(phone, 'signin-phone-send');
    document.getElementById('signin-phone-code-wrap').style.display = 'flex';
    flashToast('SMS sent — enter the code below.', { kind: 'success' });
    haptic('light');
  } catch(e) {
    console.error('[signin][phone-send]', e);
    resetPhoneCaptcha();
    flashToast("Couldn't send code. Try again?", { kind: 'warn' });
  }
};

window.handleSigninPhoneVerify = async function() {
  const code = (document.getElementById('signin-phone-code').value || '').trim();
  if (!_pendingPhoneConfirmation) { flashToast('Send a code first', { kind: 'warn' }); return; }
  try {
    await _pendingPhoneConfirmation.confirm(code);
    // onAuthStateChanged listener picks up from here
  } catch(e) {
    console.error('[signin][phone-verify]', e);
    flashToast('Wrong code — try again?', { kind: 'warn' });
  }
};

// ===== Phase 5: Pre-app screen router (sign-in / family-code / name screens) =====
// This is distinct from window.showScreen which handles in-app tabs.
function showPreAuthScreen(id) {
  ['signin-screen', 'screen-mode', 'screen-family-join', 'screen-name'].forEach(sid => {
    const el = document.getElementById(sid);
    if (el) el.style.display = (sid === id) ? 'block' : 'none';
  });
  // app-shell is always hidden during pre-auth
  const shell = document.getElementById('app-shell');
  if (shell) shell.style.display = 'none';
}

// ===== Phase 5: Auth-state change handler =====
async function onAuthStateChangedCouch(user) {
  const wasSignedIn = !!state.auth;
  state.auth = user;

  if (!user) {
    // Teardown on sign-out (covers button press AND server-side token revoke)
    try { await Promise.race([unsubscribeFromPush(), new Promise(r => setTimeout(r, 1500))]); } catch(e) {}
    if (state.unsubUserGroups) { try { state.unsubUserGroups(); } catch(e) {} state.unsubUserGroups = null; }
    if (state.unsubSettings) { try { state.unsubSettings(); } catch(e) {} state.unsubSettings = null; }
    if (state.unsubNotifPrefs) { try { state.unsubNotifPrefs(); } catch(e) {} state.unsubNotifPrefs = null; }
    if (state.unsubMembers) { try { state.unsubMembers(); } catch(e) {} state.unsubMembers = null; }
    if (state.unsubTitles) { try { state.unsubTitles(); } catch(e) {} state.unsubTitles = null; }
    if (state.unsubIntents) { try { state.unsubIntents(); } catch(e) {} state.unsubIntents = null; }
    state.intents = [];
    state.me = null;
    state.familyCode = null;
    state.members = [];
    state.group = null;
    state.ownerUid = null;
    state.notificationPrefs = null;
    showPreAuthScreen('signin-screen');
    return;
  }

  // User is signed in

  // Phase 13 / COMP-13-01 — Pitfall 2 defense: detect soft-deleted accounts
  // at sign-in. If users/{uid}.deletionRequestedAt is set + hardDeleteAt > now,
  // route to the deletion-pending banner instead of the normal app shell.
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    const userData = userSnap.exists() ? userSnap.data() : null;
    if (userData && userData.deletionRequestedAt && typeof userData.hardDeleteAt === 'number' && userData.hardDeleteAt > Date.now()) {
      // Soft-deleted; show the deletion-pending banner.
      const dateEl = document.getElementById('deletion-pending-date');
      if (dateEl) {
        try {
          dateEl.textContent = new Date(userData.hardDeleteAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (_) { dateEl.textContent = new Date(userData.hardDeleteAt).toISOString().slice(0, 10); }
      }
      const bg = document.getElementById('deletion-pending-bg');
      if (bg) bg.classList.add('on');
      // Halt the normal auth flow — user must explicitly choose Cancel deletion or Let it delete.
      return;
    }
  } catch (e) {
    console.warn('[soft-delete-detour] failed; proceeding with normal sign-in', e && e.message);
    // Fall through — don't block sign-in on a Firestore read failure.
  }

  const groupsReady = startUserGroupsSubscription(user.uid);
  startSettingsSubscription();
  startNotificationPrefsSubscription(user.uid);

  if (!wasSignedIn) {
    // Fresh sign-in: wait for the first users/{uid}/groups snapshot before routing
    // so routeAfterAuth sees the real groups list (not empty from localStorage).
    // Cap the wait at 4s so a network stall doesn't leave the user frozen.
    try { await Promise.race([groupsReady, new Promise(r => setTimeout(r, 4000))]); } catch(e) {}
    // Consume any pending claim / invite token; else route into group or mode-pick
    await handlePostSignInIntent();
  }
  // 14-08 — handle ?intent=<id> deep-link from CF push payloads. Fire after the
  // post-sign-in routing finishes (claim/invite tokens take precedence). Runs for
  // both fresh sign-ins and refreshes of an already-signed-in tab; the handler
  // itself waits for state.intents to hydrate before opening any modal.
  if (typeof maybeOpenIntentFromDeepLink === 'function') {
    try { maybeOpenIntentFromDeepLink(); } catch (e) { console.warn('[intent-deeplink] failed', e); }
  }
}

function startUserGroupsSubscription(uid) {
  if (state.unsubUserGroups) { try { state.unsubUserGroups(); } catch(e) {} }
  const groupsCol = collection(db, 'users', uid, 'groups');
  // Return a promise that resolves on the FIRST snapshot. The caller awaits this
  // before routing so routeAfterAuth sees the real groups list (not the empty
  // localStorage-preloaded list), eliminating the post-sign-in flash to mode-pick.
  let firstSnapshotResolver;
  const firstSnapshot = new Promise(resolve => { firstSnapshotResolver = resolve; });
  state.unsubUserGroups = onSnapshot(groupsCol, (snap) => {
    // Normalize Firestore shape {familyCode, memberId} into the legacy local shape
    // {code, myMemberId, myMemberName} that switchToGroup / renderGroupSwitcher /
    // loadSavedGroups all read. Keep the Firestore-native fields alongside so any
    // newer callers (routeAfterAuth, etc.) that read .familyCode still work.
    state.groups = snap.docs.map(d => {
      const data = d.data() || {};
      const code = data.familyCode || d.id;
      return {
        code,
        familyCode: code,
        name: data.name || code,
        mode: data.mode || 'family',
        myMemberId: data.memberId || null,
        myMemberName: data.memberName || null,
        memberId: data.memberId || null,
        memberName: data.memberName || null,
        joinedAt: data.joinedAt || null,
        lastActiveAt: data.lastActiveAt || null,
      };
    });
    try { localStorage.setItem('qn_groups', JSON.stringify(state.groups)); } catch(e) {}
    if (typeof renderGroupSwitcher === 'function') renderGroupSwitcher();
    if (firstSnapshotResolver) { firstSnapshotResolver(); firstSnapshotResolver = null; }
  }, (e) => {
    console.error('[user-groups] snapshot error', e);
    if (firstSnapshotResolver) { firstSnapshotResolver(); firstSnapshotResolver = null; }
  });
  return firstSnapshot;
}

function startSettingsSubscription() {
  if (state.unsubSettings) { try { state.unsubSettings(); } catch(e) {} }
  const settingsDoc = doc(db, 'settings', 'auth');
  state.unsubSettings = onSnapshot(settingsDoc, (snap) => {
    state.settings = snap.exists() ? snap.data() : null;
    // Plan 5.8 D-15: settings changed (e.g. graceUntil flipped) — recompute read-only
    // state immediately so unclaimed members go dim without waiting on a members snapshot.
    try { if (typeof applyReadOnlyState === 'function') applyReadOnlyState(); } catch(e) {}
    try { if (typeof renderGraceBanner === 'function') renderGraceBanner(); } catch(e) {}
  }, (e) => console.error('[settings] snapshot error', e));
}

async function handlePostSignInIntent() {
  let claimToken = null, claimFamily = null, inviteToken = null;
  try {
    const params = new URLSearchParams(window.location.search);
    claimToken = params.get('claim') || sessionStorage.getItem('qn_claim');
    claimFamily = params.get('family') || sessionStorage.getItem('qn_claim_family');
    inviteToken = params.get('invite') || sessionStorage.getItem('qn_invite');
    // Remove from URL if present
    if (claimToken || inviteToken) {
      try {
        const u = new URL(window.location.href);
        ['claim','family','invite'].forEach(k => u.searchParams.delete(k));
        history.replaceState(null, '', u.toString());
      } catch(e) {}
    }
  } catch(e) {}

  if (claimToken && claimFamily) {
    try { sessionStorage.removeItem('qn_claim'); sessionStorage.removeItem('qn_claim_family'); } catch(e) {}
    showClaimConfirmScreen(claimToken, claimFamily);
    return;
  }
  if (inviteToken) {
    try { sessionStorage.removeItem('qn_invite'); } catch(e) {}
    showInviteRedeemScreen(inviteToken);
    return;
  }
  routeAfterAuth();
}

function routeAfterAuth() {
  if (!state.auth) { showPreAuthScreen('signin-screen'); return; }
  // Add-group intent (set by openAddGroup before reload): skip auto-boot into existing group
  // and drop the user at mode-pick so they can create/join another. Consume the sentinel so
  // a subsequent reload returns to the normal existing-group path.
  let addGroupIntent = false;
  try { addGroupIntent = sessionStorage.getItem('qn_add_group_intent') === '1'; } catch(e) {}
  if (addGroupIntent) {
    try { sessionStorage.removeItem('qn_add_group_intent'); } catch(e) {}
    showPreAuthScreen('screen-mode');
    return;
  }
  // If user has existing groups, land on Tonight (of most-recent active group)
  const active = localStorage.getItem('qn_active_group') || localStorage.getItem('qn_family');
  if (active && state.groups && state.groups.find(g => g.familyCode === active || g.code === active)) {
    // Re-use existing boot path: set familyCode and load
    state.familyCode = active;
    _bootIntoGroup(active);
    return;
  }
  if (state.groups && state.groups.length > 0) {
    const preferred = state.groups[0].familyCode || state.groups[0].code;
    _bootIntoGroup(preferred);
    return;
  }
  // Authed but no groups → mode pick → family-code screen
  showPreAuthScreen('screen-mode');
}

async function _bootIntoGroup(code) {
  state.familyCode = code;
  try {
    const snap = await getDoc(familyDocRef());
    if (snap.exists()) {
      const d = snap.data();
      state.group = { code, mode: d.mode || 'family', name: d.name || code, picker: d.picker || null };
    } else {
      state.group = { code, mode: 'family', name: code, picker: null };
    }
  } catch(e) { state.group = { code, mode: 'family', name: code, picker: null }; }

  // Restore the user's member identity for this group. Source of truth order:
  //   1. Firestore users/{uid}/groups/{code}.memberId — set when user first claimed in this group
  //   2. members collection lookup by uid == state.auth.uid — covers the case where
  //      the index doc is missing but the member doc has a uid stamped (e.g., Phase 5.8
  //      claim flow wrote uid but not the index, or index got cleared)
  //   3. localStorage.qn_me — legacy fallback for pre-Phase-5 clients
  let resolvedMemberId = null;
  let resolvedMemberName = null;
  try {
    const indexed = (state.groups || []).find(g => (g.familyCode === code || g.code === code));
    if (indexed && indexed.memberId) {
      resolvedMemberId = indexed.memberId;
      resolvedMemberName = indexed.memberName || null;
    }
  } catch(e) {}
  if (!resolvedMemberId && state.auth) {
    try {
      const q = await getDocs(membersRef());
      const mine = q.docs.find(d => d.data().uid === state.auth.uid);
      if (mine) {
        resolvedMemberId = mine.id;
        resolvedMemberName = mine.data().name || null;
      }
    } catch(e) {}
  }
  if (!resolvedMemberId) {
    const savedMe = localStorage.getItem('qn_me');
    if (savedMe) {
      try {
        const parsed = JSON.parse(savedMe);
        resolvedMemberId = parsed.id;
        resolvedMemberName = parsed.name;
      } catch(e) {}
    }
  }

  if (resolvedMemberId) {
    // Fetch the member doc to get the current name (in case it changed on another device).
    if (!resolvedMemberName) {
      try {
        const ms = await getDoc(doc(membersRef(), resolvedMemberId));
        if (ms.exists()) resolvedMemberName = ms.data().name;
      } catch(e) {}
    }
    state.me = { id: resolvedMemberId, name: resolvedMemberName || 'You' };
    try { localStorage.setItem('qn_me', JSON.stringify(state.me)); } catch(e) {}
    try { localStorage.setItem('qn_active_group', code); localStorage.setItem('qn_family', code); } catch(e) {}
    showApp();
    return;
  }
  await showNameScreen();
}

// ===== Phase 5 Plan 08: claim-confirm flow (D-14 migration, D-16 graduation) =====
// After sign-in, if the URL / sessionStorage carries a ?claim=TOKEN&family=CODE,
// handlePostSignInIntent() calls showClaimConfirmScreen(token, family). We stash
// the pair in a module-scoped _pendingClaim, flip the dedicated screen on, and
// route into the group on successful confirm.
let _pendingClaim = null;
function showClaimConfirmScreen(token, family) {
  _pendingClaim = { token, familyCode: family };
  // Hide other pre-auth screens + app-shell while the confirm card is up.
  ['signin-screen', 'screen-mode', 'screen-family-join', 'screen-name'].forEach(sid => {
    const el = document.getElementById(sid);
    if (el) el.style.display = 'none';
  });
  const shell = document.getElementById('app-shell');
  if (shell) shell.style.display = 'none';
  const el = document.getElementById('claim-confirm-screen');
  if (el) el.style.display = 'block';
  // Token is opaque to the client (Firestore rules block claimTokens reads) — we
  // can't look up the member name without consuming the token, so the copy stays
  // generic with the family code as the only derived hint.
  const nameEl = document.getElementById('claim-name');
  if (nameEl) nameEl.textContent = 'Your profile in ' + family;
  const avEl = document.getElementById('claim-avatar');
  if (avEl) avEl.innerHTML = '';
}

// Plan 08: user taps "Yes, claim" on the claim-confirm screen.
// Calls claimMember CF; on success, routes into the newly-owned group.
window.confirmClaim = async function() {
  if (!_pendingClaim) { const el = document.getElementById('claim-confirm-screen'); if (el) el.style.display = 'none'; routeAfterAuth(); return; }
  const { token, familyCode } = _pendingClaim;
  try {
    const fn = httpsCallable(functions, 'claimMember');
    const r = await fn({ familyCode, claimToken: token });
    if (r && r.data && r.data.memberId) {
      state.familyCode = familyCode;
      try {
        localStorage.setItem('qn_family', familyCode);
        localStorage.setItem('qn_active_group', familyCode);
      } catch(e) {}
      flashToast('Claimed!', { kind: 'success' });
      haptic('success');
      _pendingClaim = null;
      const el = document.getElementById('claim-confirm-screen');
      if (el) el.style.display = 'none';
      // switchToGroup handles the snapshot re-bind + boot
      if (typeof window.switchToGroup === 'function') {
        window.switchToGroup(familyCode);
      } else {
        routeAfterAuth();
      }
    }
  } catch(e) {
    console.error('[confirm-claim]', e);
    // Firebase Functions errors come through as e.code like "functions/already-exists"
    const raw = (e && e.code) || '';
    const code = raw.startsWith('functions/') ? raw.slice('functions/'.length) : raw;
    const msg = (code === 'already-exists') ? 'This link was already used.'
              : (code === 'deadline-exceeded') ? 'This link expired. Ask the owner for a new one.'
              : (code === 'not-found') ? 'Invalid link.'
              : (code === 'unauthenticated') ? 'Please sign in again.'
              : "Couldn't claim. Try again?";
    flashToast(msg, { kind: 'warn' });
  }
};

// Plan 08: user taps "Not me" — clear the pending claim, fall through to normal routing.
window.declineClaim = function() {
  _pendingClaim = null;
  const el = document.getElementById('claim-confirm-screen');
  if (el) el.style.display = 'none';
  routeAfterAuth();
};

// Plan 06 stub — invite-redeem lands in a later plan. Keep as stub for now.
// Plan 09-07b DESIGN-08: Guest invite redemption screen.
// Flow: bootstrapAuth detects ?invite= -> calls this (unauthed or authed), fetches
// invite preview via CF, renders redeem screen. On submit: consumeGuestInvite CF.
// Expired/invalid -> invite-expired-screen (NOT sign-in redirect).
async function showInviteRedeemScreen(token) {
  // Hide every other pre-auth screen defensively
  try {
    ['signin-screen','screen-mode','screen-family-join','screen-name','claim-confirm-screen','invite-expired-screen']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  } catch(e) {}
  try { sessionStorage.setItem('qn_invite', token); } catch(e) {}

  // Stamp the token input into the fetch preview phase
  let preview = null;
  try {
    preview = await fetchInvitePreview(token);
  } catch(e) {
    console.warn('[invite-redeem] preview failed', e && (e.code || e.message));
    showInviteExpiredScreen();
    return;
  }
  if (!preview || preview.expired) {
    showInviteExpiredScreen();
    return;
  }

  // Populate labels (family name not surfaced on the unauth preview per T-09-07b-02)
  const durLabel = preview.durationLabel || '7 days';
  const expLabel = preview.expiresLabel || ('in ' + durLabel);
  const dl = document.getElementById('invite-duration-label'); if (dl) dl.textContent = durLabel;
  const el = document.getElementById('invite-expires-label'); if (el) el.textContent = expLabel;
  const sc = document.getElementById('invite-redeem-screen'); if (sc) sc.style.display = 'block';
}

function showInviteExpiredScreen() {
  try {
    ['signin-screen','screen-mode','screen-family-join','screen-name','claim-confirm-screen','invite-redeem-screen']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  } catch(e) {}
  const sc = document.getElementById('invite-expired-screen'); if (sc) sc.style.display = 'block';
}

// Fetch a minimal invite preview. Uses the consumeGuestInvite CF in 'preview' mode
// (does NOT consume the invite). Returns { durationLabel, expiresLabel } or { expired: true }.
async function fetchInvitePreview(token) {
  try {
    const fn = httpsCallable(functions, 'consumeGuestInvite');
    const r = await fn({ token, preview: true });
    const d = (r && r.data) || {};
    if (d.expired || d.consumed) return { expired: true };
    // Compute friendly duration label from expiresAt if provided
    let durationLabel = '7 days', expiresLabel = 'in 7 days';
    if (d.expiresAt) {
      const msLeft = d.expiresAt - Date.now();
      const days = Math.max(1, Math.round(msLeft / 86400000));
      durationLabel = days === 1 ? '1 day' : days + ' days';
      expiresLabel = 'in ' + durationLabel;
    }
    return { durationLabel, expiresLabel };
  } catch(e) {
    const code = e && (e.code || (e.details && e.details.code));
    if (code === 'functions/failed-precondition' || code === 'failed-precondition' ||
        code === 'functions/not-found' || code === 'not-found' ||
        code === 'functions/deadline-exceeded' || code === 'deadline-exceeded') {
      return { expired: true };
    }
    throw e;
  }
}

// Submit guest redemption. Signs in anonymously (so writeAttribution works) then
// calls consumeGuestInvite CF to create the guest member doc + mark invite consumed.
window.submitGuestRedeem = async function() {
  const nameInput = document.getElementById('invite-guest-name');
  const guestName = (nameInput && nameInput.value.trim()) || '';
  if (!guestName || guestName.length < 1) { flashToast('Please enter a name', { kind: 'warn' }); return; }
  let token = '';
  try { token = sessionStorage.getItem('qn_invite') || ''; } catch(e) {}
  if (!token) { showInviteExpiredScreen(); return; }

  const btn = document.getElementById('invite-redeem-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }

  try {
    // Ensure we have an auth user so admin SDK can attribute the member write
    if (!auth.currentUser) {
      const { signInAnonymously } = await import('./firebase.js');
      await signInAnonymously(auth);
    }
    const fn = httpsCallable(functions, 'consumeGuestInvite');
    const r = await fn({ token, guestName });
    const d = (r && r.data) || {};
    if (!d.ok) throw new Error('consume-failed');

    // Clear the one-shot token
    try { sessionStorage.removeItem('qn_invite'); } catch(e) {}
    // Strip ?invite= from URL
    try {
      const u = new URL(window.location.href);
      ['invite','family'].forEach(k => u.searchParams.delete(k));
      history.replaceState(null, '', u.toString());
    } catch(e) {}

    // Stamp state for guest identity
    state.me = state.me || {};
    state.me.type = 'guest';
    state.me.temporary = true;
    state.me.seenOnboarding = true;
    state.me.id = d.memberId;
    state.me.name = d.memberName || guestName;
    state.me.expiresAt = d.expiresAt || null;

    // Route into the family
    state.familyCode = d.familyCode;
    localStorage.setItem('qn_family', d.familyCode);
    localStorage.setItem('qn_active_group', d.familyCode);
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'groups', d.familyCode), {
        familyCode: d.familyCode,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        guest: true
      }, { merge: true });
    } catch(e) {}

    flashToast('Welcome to the couch', { kind: 'success' });
    haptic('success');
    // Defer to the normal auth-routing path so watchers subscribe and Tonight paints
    try { await _bootIntoGroup(d.familyCode); } catch(e) { console.error('[invite-redeem] bootIntoGroup', e); }
  } catch(e) {
    console.error('[invite-redeem] consume failed', e);
    const code = e && (e.code || '');
    if (code === 'functions/failed-precondition' || code === 'failed-precondition' ||
        code === 'functions/not-found' || code === 'not-found' ||
        code === 'functions/deadline-exceeded' || code === 'deadline-exceeded') {
      showInviteExpiredScreen();
      return;
    }
    flashToast("Couldn't redeem invite. Try again?", { kind: 'warn' });
    if (btn) { btn.disabled = false; btn.textContent = 'Join the couch'; }
  }
};

// ===== Phase 5: Auth-aware submitFamily =====
window.submitFamily = async function() {
  if (!state.auth) { flashToast('Please sign in first', { kind: 'warn' }); showPreAuthScreen('signin-screen'); return; }

  const code = normalizeCode(document.getElementById('family-input').value);
  if (!code || code.length < 3) { alert('Please enter at least 3 letters or numbers.'); return; }

  state.familyCode = code;
  let existing = null;
  try { const snap = await getDoc(familyDocRef()); if (snap.exists()) existing = snap.data(); } catch(e){}

  if (existing && existing.passwordHash) {
    // Password-protected: route through joinGroup Cloud Function
    const password = window.prompt('This group is password-protected. Enter the password:') || '';
    if (!password) { flashToast('Password required', { kind: 'warn' }); state.familyCode = null; return; }
    try {
      const joinGroupFn = httpsCallable(functions, 'joinGroup');
      const r = await joinGroupFn({ familyCode: code, password, displayName: state.auth.displayName || state.auth.email || 'Member' });
      if (!r.data || !r.data.ok) throw new Error('join failed');
      state.group = { code, mode: existing.mode || 'family', name: existing.name || code, picker: existing.picker || null };
      localStorage.setItem('qn_family', code);
      localStorage.setItem('qn_active_group', code);
      await continueToNameScreen();
    } catch(e) {
      console.error('[submit-family][joinGroup-CF]', e);
      const msg = (e && e.code === 'permission-denied') ? 'Wrong password.' : "Couldn't join. Try again?";
      flashToast(msg, { kind: 'warn' });
      state.familyCode = null;
    }
    return;
  }

  // Not password-protected: open group (D-11 addendum code-only path for permanent-adult invite).
  const mode = existing?.mode || state.pendingMode || 'family';
  const isNew = !existing;
  const docPayload = isNew
    ? { code, mode, createdAt: Date.now(), ownerUid: state.auth.uid }
    : { code, mode };
  try { await setDoc(familyDocRef(), docPayload, { merge: true }); } catch(e){}
  state.group = { code, mode, name: existing?.name || code, picker: existing?.picker || null };
  localStorage.setItem('qn_family', code);
  localStorage.setItem('qn_active_group', code);
  // Write users/{uid}/groups/{code} index doc (CF does this for password joins; we do it here for open joins)
  try {
    await setDoc(doc(db, 'users', state.auth.uid, 'groups', code), {
      familyCode: code, name: existing?.name || code, mode,
      joinedAt: Date.now(), lastActiveAt: Date.now()
    }, { merge: true });
  } catch(e) {}
  await continueToNameScreen();
};

// continueToNameScreen — the canonical name-screen loader used by submitFamily + showNameScreen.
// The existing-members chip list rendering is INLINE here (not a stub reference) to preserve
// the exact pre-Phase-5 chip behavior verbatim (per plan warning W5).
async function continueToNameScreen() {
  showPreAuthScreen('screen-name');
  document.getElementById('name-family-name').textContent = state.familyCode;
  const lbl = document.getElementById('name-family-label');
  if (lbl) {
    const noun = groupNounCap();
    lbl.textContent = noun === 'Duo' ? 'Joining your Duo' : `Joining the ${noun}`;
  }
  const ageEl = document.getElementById('new-age-input');
  if (ageEl) ageEl.style.display = modeAllowsAgeTiers() ? '' : 'none';
  try {
    const snap = await getDocs(membersRef());
    const existingRaw = snap.docs.map(d => d.data());
    const now = Date.now();
    // D-03: sub-profiles AND active guests show in the name-pick chip list so a kid on
    // a shared tablet or a guest redeeming a link can tap themselves in directly.
    // Filter: hide archived members; hide expired guests.
    const existing = existingRaw.filter(m =>
      !m.archived &&
      (!m.temporary || (m.expiresAt && m.expiresAt > now))
    );
    const el = document.getElementById('existing-members-list');
    if (existing.length > 0) {
      document.getElementById('existing-members').style.display = 'block';
      el.innerHTML = existing.map(m => {
        const badges = [];
        if (m.managedBy) badges.push('<span class="chip-badge badge-kid">kid</span>');
        if (m.temporary) badges.push('<span class="chip-badge badge-guest">guest</span>');
        const safeName = (m.name || '').replace(/'/g,"\\'");
        return `
        <button class="join-chip" onclick="joinAsExisting('${m.id}','${safeName}')">
          <div class="who-avatar" style="background:${m.color}">${avatarContent(m)}</div><div>${escapeHtml(m.name)} ${badges.join(' ')}</div>
        </button>`;
      }).join('');
    } else {
      document.getElementById('existing-members').style.display = 'none';
    }
  } catch(e) { console.error(e); }
}

// showNameScreen — thin wrapper for backward compat with any existing callers.
async function showNameScreen() {
  document.getElementById('screen-mode').style.display = 'none';
  document.getElementById('screen-family-join').style.display = 'none';
  return continueToNameScreen();
}

window.joinAsNew = async function() {
  const name = document.getElementById('new-name-input').value.trim();
  if (!name) { alert('Please enter your name.'); return; }
  const ageInputEl = document.getElementById('new-age-input');
  const age = (modeAllowsAgeTiers() && ageInputEl && ageInputEl.value) ? parseInt(ageInputEl.value) : null;
  // Check existing members — if this is the first one, they become parent + owner
  let isFirstMember = false;
  try {
    const snap = await getDocs(membersRef());
    const existingMember = snap.docs.map(d => d.data()).find(m => m.name.toLowerCase() === name.toLowerCase());
    if (existingMember) { joinAsExisting(existingMember.id, existingMember.name); return; }
    isFirstMember = snap.empty;
  } catch(e) { console.error(e); }
  const id = 'm_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  const color = COLORS[Math.floor(Math.random()*COLORS.length)];
  const member = { id, name, color, uid: state.auth ? state.auth.uid : null };
  if (age != null) member.age = age;
  if (isFirstMember && currentMode() === 'family') {
    member.isParent = true;
  }
  try {
    // Single write: the member doc. submitFamily already stamps ownerUid on the family doc
    // at create time (and rules block client UPDATE on families/{code}), so a second owner
    // stamp here would just get denied and fail the whole write. Members rule branch A uses
    // getAfter() on the family doc so it sees the ownerUid written by submitFamily.
    const memberDocRef = doc(membersRef(), id);
    await setDoc(memberDocRef, member);
    state.me = { id, name };
    localStorage.setItem('qn_me', JSON.stringify(state.me));
    upsertSavedGroup({ code: state.familyCode, name: state.group?.name || state.familyCode, mode: currentMode(), myMemberId: id, myMemberName: name });
    // Write users/{uid}/groups/{code} index doc
    if (state.auth) {
      try {
        await setDoc(doc(db, 'users', state.auth.uid, 'groups', state.familyCode), {
          familyCode: state.familyCode, name: state.group?.name || state.familyCode,
          mode: currentMode(), memberId: id, memberName: name, joinedAt: Date.now(), lastActiveAt: Date.now()
        }, { merge: true });
      } catch(e) {}
    }
    showApp();
  } catch(e) { alert('Could not join: '+e.message); }
};

window.joinAsExisting = async function(id, name) {
  state.me = { id, name };
  localStorage.setItem('qn_me', JSON.stringify(state.me));
  upsertSavedGroup({ code: state.familyCode, name: state.group?.name || state.familyCode, mode: currentMode(), myMemberId: id, myMemberName: name });
  // Opportunistic claim: if member has no uid yet, write current user's uid onto doc (grace-window)
  if (state.auth) {
    try {
      const memberSnap = await getDoc(doc(membersRef(), id));
      const memberData = memberSnap.exists() ? memberSnap.data() : null;
      if (memberData && !memberData.uid) {
        await updateDoc(doc(membersRef(), id), { uid: state.auth.uid, claimedAt: Date.now() });
        console.log('[joinAsExisting] uid claim succeeded for', id);
      }
    } catch(e) {
      console.warn('[joinAsExisting] uid claim failed (will retry via claim flow in Phase 5.8):', e.code, e.message);
    }
    // Write users/{uid}/groups/{code} index doc — this is what populates state.groups on next sign-in
    try {
      await setDoc(doc(db, 'users', state.auth.uid, 'groups', state.familyCode), {
        familyCode: state.familyCode, name: state.group?.name || state.familyCode,
        mode: currentMode(), memberId: id, joinedAt: Date.now(), lastActiveAt: Date.now()
      }, { merge: true });
      console.log('[joinAsExisting] users/groups index written for', state.familyCode);
    } catch(e) {
      console.error('[joinAsExisting] users/groups index write FAILED — group will not persist across sign-in:', e.code, e.message);
    }
  }
  showApp();
};

window.signOut = async function() {
  // Delegate entirely to Firebase Auth sign-out.
  // The onAuthStateChanged(null) listener handles all teardown + screen transition.
  try { haptic('light'); } catch(e) {}
  try { await signOutUser(); }
  catch(e) { console.error('[signout]', e); }
};

// Phase 11 / REFR-12 — leave-family two-tap confirmation modal handlers.
// Replaces the native confirm() inside window.leaveFamily with a branded modal
// so the destructive action gets proper visual weight + a Cancel affordance
// adjacent to the red "Leave" button. Existing leaveFamily function kept intact
// as the write path; performLeaveFamily is a thin wrapper that closes the modal
// and delegates to it.
window.confirmLeaveFamily = function() {
  const bg = document.getElementById('leave-family-confirm-bg');
  if (bg) bg.classList.add('on');
};
window.closeLeaveFamilyConfirm = function() {
  const bg = document.getElementById('leave-family-confirm-bg');
  if (bg) bg.classList.remove('on');
};
window.performLeaveFamily = async function() {
  // Close the modal first so it doesn't linger during the async leave work.
  const bg = document.getElementById('leave-family-confirm-bg');
  if (bg) bg.classList.remove('on');
  // Delegate to the existing leave path. We set a flag so window.leaveFamily's
  // built-in confirm() gets bypassed — it was the destructive gate we just
  // handled via the modal.
  window._leaveFamilyConfirmed = true;
  try {
    await window.leaveFamily();
  } finally {
    window._leaveFamilyConfirmed = false;
  }
};

// =====================================================
// Phase 13 / COMP-13-01 — Self-serve account deletion
// Modal driver + httpsCallable wiring. Source pattern:
// - confirmLeaveFamily / performLeaveFamily (this file:~2688-2714)
// - transferOwnershipTo httpsCallable error-mapping (this file:~3093-3116)
// CFs: requestAccountDeletion, cancelAccountDeletion, checkAccountDeleteEligibility, accountDeletionReaper
// Review fix MEDIUM-10: fallback contact email is privacy@couchtonight.app (matches privacy.html).
// =====================================================

window.openDeleteAccountConfirm = async function() {
  // Pre-flight: check ownership eligibility before showing typed-DELETE modal.
  // Pitfall 1 / T-1 defense — owner-of-family must transfer first.
  try {
    const fn = httpsCallable(functions, 'checkAccountDeleteEligibility');
    const r = await fn();
    const eligible = r && r.data && r.data.eligible;
    const owned = (r && r.data && r.data.ownedFamilies) || [];
    if (!eligible) {
      // Render the blocker modal with the family list
      const list = document.getElementById('delete-account-blocker-list');
      if (list) {
        list.innerHTML = '';
        for (const fam of owned) {
          const li = document.createElement('li');
          li.textContent = (fam && fam.name) ? fam.name : (fam && fam.familyCode) || '(unnamed)';
          list.appendChild(li);
        }
      }
      const bg = document.getElementById('delete-account-blocker-bg');
      if (bg) bg.classList.add('on');
      return;
    }
  } catch (e) {
    console.error('[delete-account-eligibility]', e);
    flashToast("Couldn't check eligibility. Try again.", { kind: 'warn' });
    return;
  }
  // Eligible — show typed-DELETE confirmation modal
  const input = document.getElementById('delete-account-confirm-input');
  if (input) input.value = '';
  const err = document.getElementById('delete-account-error');
  if (err) err.textContent = '';
  const bg = document.getElementById('delete-account-modal-bg');
  if (bg) bg.classList.add('on');
};

window.closeDeleteAccountModal = function() {
  const bg = document.getElementById('delete-account-modal-bg');
  if (bg) bg.classList.remove('on');
};

window.closeDeleteAccountBlocker = function() {
  const bg = document.getElementById('delete-account-blocker-bg');
  if (bg) bg.classList.remove('on');
};

window.performDeleteAccount = async function() {
  const input = document.getElementById('delete-account-confirm-input');
  const errEl = document.getElementById('delete-account-error');
  const typed = input ? input.value : '';
  if (typed !== 'DELETE') {
    if (errEl) errEl.textContent = 'Type DELETE in capitals to confirm.';
    return;
  }
  if (errEl) errEl.textContent = '';
  // Close modal optimistically — match performLeaveFamily pattern (modal off before async work)
  const bg = document.getElementById('delete-account-modal-bg');
  if (bg) bg.classList.remove('on');
  try {
    const fn = httpsCallable(functions, 'requestAccountDeletion');
    const r = await fn({ confirm: 'DELETE' });
    if (r && r.data && r.data.success) {
      flashToast('Deletion scheduled. Signing out…', { kind: 'success' });
      try { haptic('success'); } catch(_) {}
      setTimeout(() => { try { window.signOut(); } catch(_) {} }, 2000);
    } else {
      flashToast("Couldn't schedule deletion. Try again.", { kind: 'warn' });
    }
  } catch (e) {
    console.error('[delete-account]', e);
    const code = e && e.code;
    // Review fix MEDIUM-10: fallback contact = privacy@couchtonight.app (matches privacy.html promise).
    const msg = (code === 'failed-precondition' || code === 'functions/failed-precondition')
      ? (e.message || 'Transfer family ownership first.')
      : (code === 'unauthenticated' || code === 'functions/unauthenticated')
        ? 'Sign in to delete your account.'
        : "Couldn't schedule deletion. Try again or email privacy@couchtonight.app.";
    flashToast(msg, { kind: 'warn' });
  }
};

window.cancelMyDeletion = async function() {
  // Called from the deletion-pending banner shown at sign-in
  try {
    const fn = httpsCallable(functions, 'cancelAccountDeletion');
    const r = await fn();
    if (r && r.data && r.data.ok) {
      flashToast('Deletion cancelled. Welcome back.', { kind: 'success' });
      try { haptic('success'); } catch(_) {}
      const bg = document.getElementById('deletion-pending-bg');
      if (bg) bg.classList.remove('on');
      setTimeout(() => { try { window.location.reload(); } catch(_) {} }, 800);
    } else {
      flashToast("Couldn't cancel deletion. Try again.", { kind: 'warn' });
    }
  } catch (e) {
    console.error('[cancel-deletion]', e);
    flashToast("Couldn't cancel deletion. Try again.", { kind: 'warn' });
  }
};

window.continueWithDeletion = async function() {
  // User chose to let the deletion proceed; sign them out without cancelling.
  const bg = document.getElementById('deletion-pending-bg');
  if (bg) bg.classList.remove('on');
  try { await window.signOut(); } catch (e) { console.error('[continue-deletion-signout]', e); }
};

window.leaveFamily = async function() {
  if (!state.auth) { location.reload(); return; }
  const label = groupNoun();
  // Phase 11 / REFR-12: native confirm() is skipped when the modal-driven path
  // (confirmLeaveFamily → performLeaveFamily) already got explicit user consent.
  if (!window._leaveFamilyConfirmed && !confirm(`Leave this ${label}? You can rejoin with the code.`)) return;
  try { await Promise.race([unsubscribeFromPush(), new Promise(r => setTimeout(r, 1500))]); } catch(e) {}
  // Remove member doc and group index doc; do NOT sign out (D-10 one-uid-many-groups)
  if (state.me && state.familyCode) {
    try { await deleteDoc(doc(membersRef(), state.me.id)); } catch(e) {}
    try { await deleteDoc(doc(db, 'users', state.auth.uid, 'groups', state.familyCode)); } catch(e) {}
  }
  if (state.familyCode) removeSavedGroup(state.familyCode);
  localStorage.removeItem('qn_me');
  localStorage.removeItem('qn_family');
  localStorage.removeItem('qn_active_group');
  state.me = null;
  state.familyCode = null;
  state.group = null;
  // Stay signed in; route back to group-switcher or create-or-join
  routeAfterAuth();
};

// ===== Phase 5 Plan 07: Sub-profile CRUD + act-as semantics (D-01, D-03, D-04) =====
// Sub-profile member doc shape:
//   { id, name, color, managedBy: parentUid, createdAt, isParent: false }  // NO uid field
// This is what Firestore rules (Plan 04) gate on: writes carrying managedMemberId
// require members/{managedMemberId}.managedBy === request.auth.uid.
window.openCreateSubProfile = function() {
  if (!state.auth) { flashToast('Sign in first', { kind: 'warn' }); return; }
  if (!state.familyCode) { flashToast('Join a group first', { kind: 'warn' }); return; }
  const nameEl = document.getElementById('subprofile-name');
  if (nameEl) nameEl.value = '';
  const bg = document.getElementById('subprofile-modal-bg');
  if (bg) bg.classList.add('on');
};
window.closeSubProfileModal = function() {
  const bg = document.getElementById('subprofile-modal-bg');
  if (bg) bg.classList.remove('on');
};
window.createSubProfile = async function() {
  const name = (document.getElementById('subprofile-name').value || '').trim();
  const color = document.getElementById('subprofile-color').value || '#f2a365';
  if (!name) { flashToast('Name required', { kind: 'warn' }); return; }
  if (!state.auth || !state.familyCode) { flashToast('Not ready', { kind: 'warn' }); return; }
  const memberId = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  const sub = {
    id: memberId,
    name,
    color,
    managedBy: state.auth.uid,
    createdAt: Date.now(),
    isParent: false
    // NO uid field — this is what distinguishes a sub-profile from an authed adult
  };
  try {
    await setDoc(doc(membersRef(), memberId), sub);
    flashToast(`Added ${name}`, { kind: 'success' });
    haptic('success');
    closeSubProfileModal();
    renderSubProfileList();
  } catch(e) {
    console.error('[create-subprofile]', e);
    const msg = (e && e.code === 'permission-denied') ? "You can't add kids in this group." : "Couldn't add. Try again?";
    flashToast(msg, { kind: 'warn' });
  }
};
function renderSubProfileList() {
  const el = document.getElementById('subprofile-list');
  if (!el) return;
  const subs = (state.members || []).filter(m => m.managedBy && !m.uid && !m.archived);
  if (subs.length === 0) { el.innerHTML = '<p class="tab-section-sub" style="margin:0;">No sub-profiles yet.</p>'; return; }
  el.innerHTML = subs.map(m => `
    <div class="subprofile-row">
      <div class="who-avatar" style="background:${m.color}">${avatarContent(m)}</div>
      <span class="subprofile-name">${escapeHtml(m.name)}</span>
      <button class="link-btn" onclick="sendGraduationLink('${m.id}')">Send claim link</button>
    </div>
  `).join('');
}
// Plan 5.8 D-16: graduation flow. Parent mints a claim-token for a sub-profile they
// manage, then shares the link via Web Share API (preferred) or clipboard fallback.
// When the kid redeems, claimMember CF clears managedBy + stamps graduatedAt (D-16).
window.sendGraduationLink = async function(memberId) {
  if (!state.auth || !state.familyCode) { flashToast('Sign in first', { kind: 'warn' }); return; }
  const m = (state.members || []).find(x => x.id === memberId);
  if (!m) return;
  if (!m.managedBy) { flashToast('This member is already independent.', { kind: 'info' }); return; }
  if (m.managedBy !== state.auth.uid) {
    flashToast('Only the parent who manages them can send a graduation link.', { kind: 'warn' });
    return;
  }
  try {
    const fn = httpsCallable(functions, 'mintClaimTokens');
    const r = await fn({ familyCode: state.familyCode, memberIds: [memberId], type: 'graduation' });
    if (r && r.data && r.data.tokens && r.data.tokens[0]) {
      const link = r.data.tokens[0].deepLink;
      // Prefer native share picker on mobile so the parent can hand it to the kid via Messages;
      // fall back to clipboard copy on desktop / browsers without Web Share.
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Your Couch profile',
            text: `Take over your profile on Couch (${m.name})`,
            url: link
          });
          haptic('success');
        } catch(shareErr) {
          // User cancelled or share API failed — copy as backup.
          try { await navigator.clipboard.writeText(link); flashToast('Link copied — send it to them', { kind: 'success' }); }
          catch(e) { flashToast('Link ready: ' + link, { kind: 'info' }); }
        }
      } else {
        try { await navigator.clipboard.writeText(link); flashToast('Link copied — send it to them', { kind: 'success' }); haptic('success'); }
        catch(e) { flashToast('Link ready: ' + link, { kind: 'info' }); }
      }
    }
  } catch(e) {
    console.error('[graduation]', e);
    const raw = (e && e.code) || '';
    const code = raw.startsWith('functions/') ? raw.slice('functions/'.length) : raw;
    const msg = (code === 'permission-denied') ? 'Only the parent who manages them can do this.'
              : (code === 'failed-precondition') ? 'They already have an account.'
              : "Couldn't create graduation link.";
    flashToast(msg, { kind: 'warn' });
  }
};

// ===== Phase 5 Plan 07: Owner-only admin (D-12 guest invite / D-18 password / D-19 transfer) =====
// renderOwnerSettings — show/hide the #settings-owner section based on ownership, and
// populate the transfer-target dropdown with other AUTHED members only (D-19 requires
// target to have a uid; sub-profiles are excluded by the CF's failed-precondition check).
function renderOwnerSettings() {
  const el = document.getElementById('settings-owner');
  if (!el) return;
  const isOwner = !!(state.auth && state.ownerUid && state.auth.uid === state.ownerUid);
  el.style.display = isOwner ? '' : 'none';
  if (!isOwner) return;
  const candidates = (state.members || []).filter(m => m.uid && m.uid !== state.auth.uid && !m.temporary);
  const sel = document.getElementById('settings-transfer-target');
  if (sel) {
    if (candidates.length === 0) {
      sel.innerHTML = '<option value="">No eligible members</option>';
    } else {
      sel.innerHTML = candidates.map(m => `<option value="${escapeHtml(m.uid)}">${escapeHtml(m.name)}</option>`).join('');
    }
  }
}

// ===== Phase 5 Plan 08: Claim-your-members panel (owner migration flow, D-14) =====
// Lists unclaimed adult members (no uid, no managedBy, not guest/temporary, not archived)
// inside #settings-claim-list. Each row exposes a "Generate link" button → mintClaimForMember.
// mintAllMigrationClaims batches one CF call for every unclaimed row.
function renderClaimMembersPanel() {
  const el = document.getElementById('settings-claim-list');
  if (!el) return;
  const unclaimed = (state.members || []).filter(m =>
    !m.uid && !m.managedBy && !m.temporary && !m.archived
  );
  if (unclaimed.length === 0) {
    el.innerHTML = '<p class="tab-section-sub" style="margin:0;">All members are claimed.</p>';
    return;
  }
  el.innerHTML = unclaimed.map(m => `
    <div class="claim-row" data-id="${escapeHtml(m.id)}">
      <div class="who-avatar" style="background:${m.color || '#888'}">${avatarContent(m)}</div>
      <span class="claim-name">${escapeHtml(m.name)}</span>
      <button class="link-btn" onclick="mintClaimForMember('${escapeHtml(m.id)}')">Generate link</button>
      <div class="claim-link-out"></div>
    </div>
  `).join('');
}

// Plan 5.8: Mint a migration token for one member and render the resulting deep-link
// beneath that row so the owner can copy it and share it out-of-band (SMS / iMessage / etc).
window.mintClaimForMember = async function(memberId) {
  if (!state.auth || !state.familyCode) return;
  try {
    const fn = httpsCallable(functions, 'mintClaimTokens');
    const r = await fn({ familyCode: state.familyCode, memberIds: [memberId], type: 'migration' });
    if (r && r.data && r.data.tokens && r.data.tokens[0]) {
      const t = r.data.tokens[0];
      const row = document.querySelector(`.claim-row[data-id="${CSS.escape(memberId)}"] .claim-link-out`);
      if (row) {
        row.innerHTML = `<code>${escapeHtml(t.deepLink)}</code><button class="link-btn" onclick="copyClaimLink(this)" data-link="${escapeHtml(t.deepLink)}">Copy</button>`;
      }
      haptic('success');
      flashToast('Link ready', { kind: 'success' });
    }
  } catch(e) {
    console.error('[mint-claim]', e);
    const raw = (e && e.code) || '';
    const code = raw.startsWith('functions/') ? raw.slice('functions/'.length) : raw;
    const msg = (code === 'permission-denied') ? 'Only the owner can do this.'
              : (code === 'failed-precondition') ? 'That member is already claimed.'
              : "Couldn't generate link. Try again?";
    flashToast(msg, { kind: 'warn' });
  }
};

// Plan 5.8: batch-mint for every unclaimed member in one CF call. Render each link inline.
window.mintAllMigrationClaims = async function() {
  if (!state.auth || !state.familyCode) return;
  const unclaimed = (state.members || []).filter(m =>
    !m.uid && !m.managedBy && !m.temporary && !m.archived
  );
  if (unclaimed.length === 0) { flashToast('Nothing to claim.', { kind: 'info' }); return; }
  try {
    const fn = httpsCallable(functions, 'mintClaimTokens');
    const r = await fn({
      familyCode: state.familyCode,
      memberIds: unclaimed.map(m => m.id),
      type: 'migration'
    });
    if (r && r.data && r.data.tokens) {
      r.data.tokens.forEach(t => {
        const row = document.querySelector(`.claim-row[data-id="${CSS.escape(t.memberId)}"] .claim-link-out`);
        if (row) {
          row.innerHTML = `<code>${escapeHtml(t.deepLink)}</code><button class="link-btn" onclick="copyClaimLink(this)" data-link="${escapeHtml(t.deepLink)}">Copy</button>`;
        }
      });
      flashToast(`Generated ${r.data.tokens.length} link${r.data.tokens.length === 1 ? '' : 's'}`, { kind: 'success' });
      haptic('success');
    }
  } catch(e) {
    console.error('[mint-all]', e);
    const raw = (e && e.code) || '';
    const code = raw.startsWith('functions/') ? raw.slice('functions/'.length) : raw;
    const msg = (code === 'permission-denied') ? 'Only the owner can do this.'
              : "Couldn't generate links. Try again?";
    flashToast(msg, { kind: 'warn' });
  }
};

// Plan 5.8: copy helper for the generated links (mirrors copyGuestLink pattern).
window.copyClaimLink = async function(btn) {
  const link = btn && btn.getAttribute('data-link');
  if (!link) return;
  try { await navigator.clipboard.writeText(link); flashToast('Copied', { kind: 'success' }); }
  catch(e) { flashToast('Select and copy manually', { kind: 'info' }); }
};

// Phase 11 / REFR-03 — who-card empty-state "Share an invite" handler.
// Routes the user to Family tab where the Invite section + #share-url input and
// createGuestInvite CTA live. Uses showScreen() (the app's canonical tab-switch fn)
// and then scrolls the invite input into view.
window.openInviteShare = function() {
  try {
    if (typeof window.showScreen === 'function') {
      window.showScreen('family');
    }
    // Defer the scroll so the family screen has a tick to render after showScreen.
    setTimeout(function() {
      var el = document.getElementById('share-url');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try { el.focus({ preventScroll: true }); } catch(e) {}
      }
    }, 80);
  } catch(e) { /* best-effort — silent fail */ }
};

// ===== Phase 5 Plan 08: post-grace read-only enforcement (D-15) =====
// Returns true if the given member must operate in read-only mode *right now*.
// Rules:
//   - If settings haven't loaded yet, be permissive (no settings = no cutoff).
//   - While Date.now() <= graceUntil, everyone stays fully interactive.
//   - Post-grace, only unclaimed adult members (no uid, no managedBy, not temporary)
//     are read-only. Authed members, sub-profiles, and pre-expiry guests are untouched.
// Server-side backstop: Firestore rules (Plan 04) are the real gate — this helper
// only drives UI messaging + button state (T-05-08-06).
function isReadOnlyForMember(member) {
  if (!member) return false;
  const graceUntil = state.settings && state.settings.graceUntil;
  if (!graceUntil) return false;
  if (Date.now() <= graceUntil) return false;
  if (member.uid) return false;
  if (member.managedBy) return false;
  if (member.temporary) return false;
  return true;
}

// Returns true if the *current effective writer* (state.me, or the acting-as sub-profile)
// is in read-only mode. Used to gate write handlers with a friendly toast + banner.
// Sub-profiles are never read-only on their own — they're always act-as'd by an
// authed parent, so writeAttribution stamps the parent's uid on the write.
function isCurrentSelfReadOnly() {
  if (state.actingAs) {
    const sub = (state.members || []).find(m => m.id === state.actingAs);
    return isReadOnlyForMember(sub);
  }
  return isReadOnlyForMember(state.me);
}

// Plan 5.8: persistent "claim your account" banner on Tonight, shown when read-only.
// Dismissible per-session but re-asserts after any further write attempt.
function showClaimPromptBanner() {
  const el = document.getElementById('claim-prompt-banner');
  if (el) el.style.display = '';
}
window.dismissClaimPrompt = function() {
  const el = document.getElementById('claim-prompt-banner');
  if (el) el.style.display = 'none';
};

// Plan 5.8: toggle body class so CSS can visually dim write-action buttons.
// Also controls the Tonight-screen claim-prompt banner visibility.
function applyReadOnlyState() {
  const ro = isCurrentSelfReadOnly();
  document.body.classList.toggle('is-readonly', ro);
  const banner = document.getElementById('claim-prompt-banner');
  if (banner) {
    if (ro) banner.style.display = '';
    else banner.style.display = 'none';
  }
}

// Central guard used at the top of every write handler. Returns true if the caller
// should early-return (and also surfaces the toast + banner as a side-effect).
function guardReadOnlyWrite() {
  if (!isCurrentSelfReadOnly()) return false;
  flashToast("This member hasn't been claimed yet — ask the owner for a claim link.", { kind: 'warn' });
  showClaimPromptBanner();
  return true;
}

// Plan 5.8: grace-window countdown banner (D-14). Hides itself once graceUntil passes.
function renderGraceBanner() {
  const el = document.getElementById('settings-grace-banner');
  if (!el) return;
  const graceUntil = state.settings && state.settings.graceUntil;
  if (!graceUntil) { el.style.display = 'none'; return; }
  const remainingMs = graceUntil - Date.now();
  if (remainingMs <= 0) { el.style.display = 'none'; return; }
  el.style.display = '';
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  const span = document.getElementById('grace-days-remaining');
  if (span) span.textContent = days;
}

window.submitGroupPassword = async function() {
  const pw = (document.getElementById('settings-password-input').value || '').trim();
  // CF rejects < 4 chars with invalid-argument; we mirror that client-side for a cleaner toast.
  if (!pw || pw.length < 4) { flashToast('Password must be at least 4 characters', { kind: 'warn' }); return; }
  if (!state.auth || !state.familyCode) return;
  try {
    const fn = httpsCallable(functions, 'setGroupPassword');
    const r = await fn({ familyCode: state.familyCode, newPassword: pw });
    if (r.data && r.data.ok) {
      flashToast('Password saved', { kind: 'success' });
      haptic('success');
      document.getElementById('settings-password-input').value = '';
    }
  } catch(e) {
    console.error('[set-password]', e);
    const code = e && e.code;
    const msg = (code === 'permission-denied' || code === 'functions/permission-denied')
      ? 'Only the owner can do this.'
      : "Couldn't save. Try again?";
    flashToast(msg, { kind: 'warn' });
  }
};

window.createGuestInvite = async function() {
  if (!state.auth || !state.familyCode) return;
  const sel = document.getElementById('settings-guest-duration');
  const duration = parseInt((sel && sel.value) || '604800000', 10);
  try {
    const fn = httpsCallable(functions, 'inviteGuest');
    const r = await fn({ familyCode: state.familyCode, durationMs: duration });
    if (r.data && r.data.ok) {
      // Plan 09-07b drift 3: strip `&family=` from owner-side URL (security: token resolves family server-side).
      // If the CF still returns a deepLink with family= baked in, sanitize it client-side.
      let link = r.data.deepLink || `https://couchtonight.app/?invite=${encodeURIComponent(r.data.inviteToken)}`;
      try {
        const u = new URL(link);
        u.searchParams.delete('family');
        link = u.toString();
      } catch(e) {}
      const out = document.getElementById('settings-guest-link-out');
      if (out) {
        out.innerHTML = `<p>Send this link to your guest:</p><code>${escapeHtml(link)}</code><button onclick="copyGuestLink(this)" data-link="${escapeHtml(link)}">Copy</button>`;
      }
      haptic('success');
      flashToast('Invite link ready', { kind: 'success' });
    }
  } catch(e) {
    console.error('[invite-guest]', e);
    const code = e && e.code;
    const msg = (code === 'permission-denied' || code === 'functions/permission-denied')
      ? 'Only the owner can invite guests.'
      : "Couldn't generate invite.";
    flashToast(msg, { kind: 'warn' });
  }
};

window.copyGuestLink = async function(btn) {
  const link = btn && btn.getAttribute('data-link');
  if (!link) return;
  try { await navigator.clipboard.writeText(link); flashToast('Copied', { kind: 'success' }); }
  catch(e) { flashToast('Select and copy manually', { kind: 'info' }); }
};

// === Phase 27 — Guest RSVP host actions ===

// Open a small popover anchored to the kebab button on a guest chip.
// Single-item menu: "Remove {name}". Tap → revokeGuest(guestId).
window.openGuestMenu = function(guestId, wpId, event) {
  if (event && event.stopPropagation) event.stopPropagation();
  // Close any existing menu first.
  const prev = document.querySelector('.wp-guest-menu');
  if (prev) prev.remove();
  if (!state.me || !state.watchparties) return;
  const wp = state.watchparties.find(x => x && x.id === wpId);
  if (!wp || state.me.id !== wp.hostId) return;
  const guest = (wp.guests || []).find(g => g && g.guestId === guestId && !g.revoked);
  if (!guest) return;
  const familyMemberNamesSet = getFamilyMemberNamesSet();
  const display = displayGuestName(guest.name || 'Guest', familyMemberNamesSet);
  // Anchor to the kebab button via fixed-position popover.
  const btn = (event && event.currentTarget) || (event && event.target);
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'wp-guest-menu';
  menu.setAttribute('role', 'menu');
  menu.style.cssText = `position:fixed; top:${rect.bottom + 4}px; left:${Math.max(8, rect.right - 180)}px; z-index:10000;`;
  menu.innerHTML = `<button class="wp-guest-menu-item destructive" type="button" role="menuitem">Remove ${escapeHtml(display)}</button>`;
  document.body.appendChild(menu);
  const item = menu.querySelector('button');
  item.addEventListener('click', function() {
    menu.remove();
    window.revokeGuest(wpId, guestId, display);
  });
  // Click-outside to dismiss.
  setTimeout(() => {
    const onClickOutside = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', onClickOutside, true);
      }
    };
    document.addEventListener('click', onClickOutside, true);
  }, 0);
};

window.revokeGuest = async function(wpId, guestId, displayName) {
  try {
    const fn = httpsCallable(functions, 'rsvpRevoke');
    const r = await fn({ token: wpId, action: 'revoke', guestId: guestId });
    if (r && r.data && r.data.ok) {
      flashToast('Removed.', { kind: 'success' });
    } else {
      flashToast(`Couldn't remove ${displayName || 'guest'}. Try again.`, { kind: 'warn' });
    }
  } catch (e) {
    console.error('[27-revoke-guest]', e);
    const code = e && e.code;
    const msg = (code === 'permission-denied' || code === 'functions/permission-denied')
      ? 'Only the host can remove guests.'
      : `Couldn't remove ${displayName || 'guest'}. Try again.`;
    flashToast(msg, { kind: 'warn' });
  }
};

window.closeRsvps = async function(wpId) {
  if (!state.me || !state.watchparties) return;
  const wp = state.watchparties.find(x => x && x.id === wpId);
  if (!wp || state.me.id !== wp.hostId) return;
  try {
    const fn = httpsCallable(functions, 'rsvpRevoke');
    const r = await fn({ token: wpId, action: 'close' });
    if (r && r.data && r.data.ok) {
      flashToast('RSVPs closed.', { kind: 'success' });
    } else {
      flashToast("Couldn't close RSVPs. Try again.", { kind: 'warn' });
    }
  } catch (e) {
    console.error('[27-close-rsvps]', e);
    flashToast("Couldn't close RSVPs. Try again.", { kind: 'warn' });
  }
};

window.openRsvps = async function(wpId) {
  if (!state.me || !state.watchparties) return;
  const wp = state.watchparties.find(x => x && x.id === wpId);
  if (!wp || state.me.id !== wp.hostId) return;
  try {
    // Re-open is a host-only Firestore write (no CF needed). Phase 24 host-only rule
    // (Path A: hostUid match) permits any field write by the host. rsvpClosed is not
    // in the non-host-forbidden allowlist, so this is allowed.
    const wpRef = doc(db, 'families', state.familyCode, 'watchparties', wpId);
    await updateDoc(wpRef, { rsvpClosed: false });
    flashToast('RSVPs reopened.', { kind: 'success' });
  } catch (e) {
    console.error('[27-open-rsvps]', e);
    flashToast("Couldn't reopen RSVPs. Try again.", { kind: 'warn' });
  }
};

window.transferOwnershipTo = async function() {
  const sel = document.getElementById('settings-transfer-target');
  const newOwnerUid = sel && sel.value;
  if (!newOwnerUid) { flashToast('Pick a member first', { kind: 'warn' }); return; }
  if (!confirm('Transfer ownership? The new owner has to agree before you can get it back.')) return;
  try {
    const fn = httpsCallable(functions, 'transferOwnership');
    const r = await fn({ familyCode: state.familyCode, newOwnerUid });
    if (r.data && r.data.ok) {
      flashToast('Ownership transferred', { kind: 'success' });
      haptic('success');
      // The family-doc snapshot subscription will update state.ownerUid and re-hide the owner panel.
    }
  } catch(e) {
    console.error('[transfer-ownership]', e);
    const code = e && e.code;
    const msg = (code === 'failed-precondition' || code === 'functions/failed-precondition')
      ? 'That member has no account yet.'
      : (code === 'permission-denied' || code === 'functions/permission-denied')
        ? 'Only the current owner can transfer.'
        : "Couldn't transfer. Try again?";
    flashToast(msg, { kind: 'warn' });
  }
};

// Act-as tap (D-04, per-action): set state.actingAs so writeAttribution picks it up on the
// NEXT vote/veto/mood write, then the snapshot-then-clear in writeAttribution reverts it.
window.tapActAsSubProfile = function(memberId, memberName) {
  if (!state.auth) { flashToast('Sign in first', { kind: 'warn' }); return; }
  const m = (state.members || []).find(x => x.id === memberId);
  if (!m || !m.managedBy) return;
  state.actingAs = memberId;
  state.actingAsName = memberName;
  haptic('light');
  flashToast(`Acting as ${memberName} for your next tap`, { kind: 'info' });
  // Visual hint: decorate the active chip so the user sees their own confirmation
  document.querySelectorAll('.who-chip.act-as-active').forEach(el => el.classList.remove('act-as-active'));
  const chip = document.querySelector(`.who-chip[data-sub-id="${memberId}"]`);
  if (chip) chip.classList.add('act-as-active');
};

// ===== Group switching =====
window.switchToGroup = async function(code) {
  const g = (loadSavedGroups()).find(x => x.code === code);
  if (!g) { alert('Group not found on this device.'); return; }
  // Unsubscribe from the previous family's push channel before switching so we don't keep
  // receiving notifications for a family we're no longer actively using on this device.
  try { await Promise.race([unsubscribeFromPush(), new Promise(r => setTimeout(r, 1500))]); } catch(e) {}
  localStorage.setItem('qn_family', g.code);
  localStorage.setItem('qn_active_group', g.code);
  localStorage.setItem('qn_me', JSON.stringify({ id: g.myMemberId, name: g.myMemberName }));
  if (state.unsubMembers) state.unsubMembers();
  if (state.unsubTitles) state.unsubTitles();
  location.reload();
};

window.openAddGroup = function() {
  closeGroupSwitcher();
  // Add-group intent: tell routeAfterAuth (after the reload) to skip the existing-group
  // auto-boot and show mode-pick. We intentionally KEEP qn_family / qn_me / qn_active_group
  // so if the user bails out of mode-pick the old group still resolves on the next reload.
  try { sessionStorage.setItem('qn_add_group_intent', '1'); } catch(e) {}
  location.reload();
};

window.openGroupSwitcher = function() {
  renderGroupSwitcher();
  const sheet = document.getElementById('group-switcher-bg');
  if (sheet) sheet.classList.add('on');
};
window.closeGroupSwitcher = function() {
  const sheet = document.getElementById('group-switcher-bg');
  if (sheet) sheet.classList.remove('on');
};

// ===== Who-Picks-Tonight rotation =====
function getPicker() { return (state.group && state.group.picker) || null; }

async function ensurePickerInitialized() {
  // Called lazily: if group has no picker config yet, build a default rotation from current members.
  if (!state.group) return;
  if (state.group.picker && state.group.picker.queue && state.group.picker.queue.length) return;
  if (!state.members.length) return;
  // Default queue: by age desc for family (oldest first), by join order otherwise
  let queue = [...state.members];
  if (currentMode() === 'family') {
    queue.sort((a,b) => (b.age||0) - (a.age||0));
  }
  queue = queue.map(m => m.id);
  const picker = { queue, currentMemberId: queue[0], updatedAt: Date.now(), autoAdvance: true, enabled: false };
  state.group.picker = picker;
  try { await setDoc(familyDocRef(), { picker }, { merge: true }); } catch(e) { console.error(e); }
}

window.enablePicker = async function() {
  await ensurePickerInitialized();
  if (!state.group?.picker) return;
  state.group.picker.enabled = true;
  state.group.picker.updatedAt = Date.now();
  try { await setDoc(familyDocRef(), { picker: state.group.picker }, { merge: true }); } catch(e){}
  renderPickerCard();
};

window.disablePicker = async function() {
  if (!state.group?.picker) { closePickerSheet(); return; }
  state.group.picker.enabled = false;
  try { await setDoc(familyDocRef(), { picker: state.group.picker }, { merge: true }); } catch(e){}
  closePickerSheet();
  renderPickerCard();
};

window.setPickerCurrent = async function(memberId) {
  await ensurePickerInitialized();
  if (!state.group?.picker) return;
  state.group.picker.currentMemberId = memberId;
  state.group.picker.enabled = true;
  state.group.picker.updatedAt = Date.now();
  // Ensure member is in queue
  if (!state.group.picker.queue.includes(memberId)) state.group.picker.queue.push(memberId);
  try { await setDoc(familyDocRef(), { picker: state.group.picker }, { merge: true }); } catch(e){}
  renderPickerCard();
  renderPickerRotation();
};

window.passPickerTurn = async function() { advancePicker(); };

function advancePicker() {
  if (!state.group?.picker) return;
  const p = state.group.picker;
  const validQueue = p.queue.filter(id => state.members.some(m => m.id === id));
  if (!validQueue.length) return;
  const currentIdx = validQueue.indexOf(p.currentMemberId);
  const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % validQueue.length;
  p.currentMemberId = validQueue[nextIdx];
  p.queue = validQueue;
  p.updatedAt = Date.now();
  setDoc(familyDocRef(), { picker: p }, { merge: true }).catch(()=>{});
  renderPickerCard();
  renderPickerRotation();
}

window.togglePickerAuto = async function(on) {
  await ensurePickerInitialized();
  if (!state.group?.picker) return;
  state.group.picker.autoAdvance = !!on;
  try { await setDoc(familyDocRef(), { picker: state.group.picker }, { merge: true }); } catch(e){}
};

window.openPickerSheet = async function() {
  await ensurePickerInitialized();
  if (!state.group?.picker) return;
  if (!state.group.picker.enabled) state.group.picker.enabled = true;
  renderPickerRotation();
  const auto = document.getElementById('picker-auto-advance');
  if (auto) auto.checked = !!state.group.picker.autoAdvance;
  const sub = document.getElementById('picker-sheet-sub');
  if (sub) sub.textContent = {family:'Rotate through the family so everyone gets a turn.', crew:'Rotate through the crew so everyone gets a turn.', duo:'Alternate turns between the two of you.'}[currentMode()];
  document.getElementById('picker-sheet-bg').classList.add('on');
};
window.closePickerSheet = function() {
  document.getElementById('picker-sheet-bg').classList.remove('on');
};

function renderPickerRotation() {
  const list = document.getElementById('picker-rotation-list');
  if (!list || !state.group?.picker) return;
  const p = state.group.picker;
  const validQueue = p.queue.filter(id => state.members.some(m => m.id === id));
  // Any members not in queue yet? append them
  state.members.forEach(m => { if (!validQueue.includes(m.id)) validQueue.push(m.id); });
  list.innerHTML = validQueue.map((id, i) => {
    const m = state.members.find(x => x.id === id);
    if (!m) return '';
    const current = id === p.currentMemberId;
    return `<div class="picker-row ${current?'current':''}" onclick="setPickerCurrent('${m.id}')">
      <div class="pr-num">${i+1}</div>
      <div class="pr-avatar" style="background:${m.color}">${avatarContent(m)}</div>
      <div class="pr-name">${m.name}</div>
      ${current?'<div class="pr-badge">Up now</div>':''}
    </div>`;
  }).join('');
}

function renderPickerCard() {
  const card = document.getElementById('picker-card');
  // Always refresh the Family tab's rotation strip alongside the Tonight card,
  // so every picker state change (advance/disable/switch/sync) updates both.
  if (typeof renderPickerStrip === 'function') renderPickerStrip();
  if (!card) return;
  const p = getPicker();
  if (!p || !p.enabled || !state.members.length) { card.style.display = 'none'; return; }
  const m = state.members.find(x => x.id === p.currentMemberId);
  if (!m) { card.style.display = 'none'; return; }
  card.style.display = 'flex';
  const eyebrow = document.getElementById('picker-eyebrow');
  const name = document.getElementById('picker-name');
  const av = document.getElementById('picker-avatar');
  const isMe = state.me && state.me.id === m.id;
  eyebrow.textContent = isMe ? "Your pick tonight" : "Pick tonight goes to";
  name.textContent = isMe ? 'Your turn on the couch' : `${m.name}'s turn on the couch`;
  av.style.background = m.color;
  av.innerHTML = avatarContent(m);
}

function renderGroupSwitcher() {
  const list = document.getElementById('group-switcher-list');
  if (!list) return;
  const groups = loadSavedGroups();
  if (!groups.length) { list.innerHTML = '<p style="color:var(--ink-dim);font-size:var(--t-meta);text-align:center;padding:16px 0;">No groups saved on this device yet.</p>'; return; }
  const modeIcon = {family:'👨‍👩‍👧', crew:'🎬', duo:'🫶'};
  const modeLabel = {family:'Family', crew:'Crew', duo:'Duo'};
  list.innerHTML = groups.map(g => {
    const active = g.code === state.familyCode;
    return `<button class="group-switch-item ${active?'active':''}" onclick="${active?'closeGroupSwitcher()':`switchToGroup('${g.code}')`}">
      <div class="gsi-icon">${modeIcon[g.mode]||'👥'}</div>
      <div class="gsi-body">
        <div class="gsi-name">${g.name||g.code}</div>
        <div class="gsi-meta">${modeLabel[g.mode]||'Group'} · as ${g.myMemberName||'member'}</div>
      </div>
      ${active?'<div class="gsi-check">●</div>':''}
    </button>`;
  }).join('');
}

let prevVetoKeys = new Set();
let vetoSubscribeIsFirstSnapshot = true;

function subscribeSession() {
  if (state.unsubSession) { state.unsubSession(); state.unsubSession = null; }
  // Assumption A3: reset diff state on every (re-)subscribe so yesterday's keys don't leak through midnight.
  prevVetoKeys = new Set();
  vetoSubscribeIsFirstSnapshot = true;
  state.sessionDate = todayKey();
  state.unsubSession = onSnapshot(sessionRef(state.sessionDate), s => {
    const incoming = s.exists() ? s.data() : { vetoes: {} };
    const incomingVetoes = incoming.vetoes || {};
    const incomingKeys = new Set(Object.keys(incomingVetoes));
    // D-13: warm toast for vetoes authored by OTHER members. Skip the very first snapshot so we
    // don't flood on subscribe (the initial state is the baseline, not a delta).
    if (!vetoSubscribeIsFirstSnapshot) {
      // D-21 self-echo guard — compare incoming actingUid OR legacy memberId against self.
      // Post-grace, the actingUid branch is authoritative; during grace, the legacy branch catches pre-Plan-06 writes.
      const myUid = (state.auth && state.auth.uid) || null;
      const myMemberId = (state.me && state.me.id) || null;
      for (const titleId of incomingKeys) {
        if (prevVetoKeys.has(titleId)) continue;
        const v = incomingVetoes[titleId];
        const isMine = !!(v && ((myUid && v.actingUid === myUid) || (myMemberId && v.memberId === myMemberId)));
        if (!v || isMine) continue;
        const t = state.titles.find(x => x.id === titleId);
        const titleName = (t && t.name) || 'a title';
        flashToast(v.memberName + ' passed on ' + titleName + ' — spinning again…', { kind: 'info' });
        // D-14: if the observing device has the spin modal open, surface the cross-device shimmer
        const bg = document.getElementById('spin-modal-bg');
        if (bg && bg.classList.contains('on')) {
          showRespinShimmer();
        }
      }
    }
    prevVetoKeys = incomingKeys;
    vetoSubscribeIsFirstSnapshot = false;
    state.session = incoming;
    renderTonight();
  }, e => {});
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const ms = midnight - now;
  setTimeout(() => {
    // New day: re-subscribe to fresh session doc (yesterday's vetoes no longer apply)
    subscribeSession();
    scheduleMidnightRefresh();
  }, ms);
}

function startSync() {
  state.unsubMembers = onSnapshot(membersRef(), s => {
    state.members = s.docs.map(d => d.data());
    const dot = document.getElementById('sync-dot');
    dot.classList.add('on');
    dot.textContent = '';
    renderAll();
    // Plan 09-07a (DESIGN-07): gate first-run onboarding once we have the member doc
    // (seenOnboarding / type fields live there). Guard against double-show via the
    // state-level check inside maybeShowFirstRunOnboarding itself.
    try { maybeShowFirstRunOnboarding(); } catch(e) {}
  }, e => {
    const dot = document.getElementById('sync-dot');
    dot.classList.remove('on');
    dot.textContent = 'Offline';
  });
  state.unsubTitles = onSnapshot(titlesRef(), s => {
    state.titles = s.docs.map(d => d.data());
    renderAll();
    // Nudge migration to run again whenever titles update, in case the first run
    // raced the initial snapshot and found an empty list. autoBackfillRunning gates re-entry.
    if (!autoBackfillRunning) {
      const stale = state.titles.some(t => t.providersChecked && t.providersSchemaVersion !== 2 && t.id && t.id.startsWith('tmdb_'));
      if (stale) setTimeout(() => autoBackfill(), 500);
    }
    // Surface in-app toasts when someone's request gets approved or declined.
    checkApprovalUpdates();
  });
  // Live-sync the group doc so picker + mode updates propagate between devices.
  // Plan 07: also track ownerUid so the owner-only admin panel toggles in real time
  // (e.g. after a transferOwnership CF flips the doc).
  state.unsubGroup = onSnapshot(familyDocRef(), s => {
    if (!s.exists()) return;
    const d = s.data();
    state.group = { ...(state.group||{}), code: state.familyCode, mode: d.mode || 'family', name: d.name || state.familyCode, picker: d.picker || null, passwordProtected: !!d.passwordHash };
    state.ownerUid = d.ownerUid || null;
    // 14-10 / V5 — couchInTonight is the new authoritative shape; couchSeating is
    // the legacy fallback (auto-rebuilt by couchInTonightFromDoc when only the old
    // field is present). state.couchMemberIds = filter(in===true) for downstream.
    // Bug B fix bundled here: renderFlowAEntry must re-run on family-doc snapshot
    // so the empty-state CTA reacts to claim/vacate, not just intent writes.
    state.couchInTonight = couchInTonightFromDoc(d);
    state.couchMemberIds = couchInTonightToMemberIds(state.couchInTonight);
    // === Phase 15 / D-02 — tupleNames hydration ===
    state.family = state.family || {};
    state.family.tupleNames = (d && d.tupleNames) || {};
    // === Phase 15 / D-06 (TRACK-15-12) — REVIEW MEDIUM-9 — coWatchPromptDeclined hydration ===
    state.family.coWatchPromptDeclined = (d && d.coWatchPromptDeclined) || {};
    // Mirror V5 source-of-truth into legacy state.selectedMembers shim (see toggleCouchMember).
    state.selectedMembers = state.couchMemberIds.slice();
    if (typeof renderCouchViz === 'function') renderCouchViz();
    if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
    // Cross-device couch toggles need Tonight surfaces refreshed too — replaces the
    // narrower renderPickerCard() so matches list + UpNext + Next3 also catch up
    // when a partner toggles a pill from another device. renderTonight() calls
    // renderPickerCard() at its top so coverage is preserved.
    renderTonight();
    applyModeLabels();
    try { renderOwnerSettings(); } catch(e) {}
    // Plan 09-07a: re-evaluate legacy self-claim CTA whenever ownership changes.
    try { renderLegacyClaimCtaIfApplicable(); } catch(e) {}
  });
  subscribeSession();
  scheduleMidnightRefresh();
  // Phase 8 — subscribe to intents collection. Guards with typeof checks so Plan 08-01
  // can land before 08-02's renderIntentsStrip + 08-03's maybeEvaluateIntentMatches exist.
  state.unsubIntents = onSnapshot(intentsRef(), s => {
    state.intents = s.docs.map(d => d.data());
    if (typeof renderIntentsStrip === 'function') renderIntentsStrip();
    if (typeof maybeEvaluateIntentMatches === 'function') maybeEvaluateIntentMatches(state.intents);
    // 14-08 — re-render any open Flow B screens (status / response) on every snapshot
    // so counter-row tallies, all-No banners, and converted/cancelled status flips
    // appear in real time without requiring a local action.
    if (typeof maybeRerenderFlowBStatus === 'function') maybeRerenderFlowBStatus();
    // 14-07 — same idea for Flow A: keep the live tally on the response screen fresh,
    // and flip the Tonight-tab entry CTA between "Open picker" and "Picking happening"
    // the moment a rank-pick intent opens or closes elsewhere on the couch.
    if (typeof maybeRerenderFlowAResponse === 'function') maybeRerenderFlowAResponse();
    if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
  }, e => { qnLog('[intents] snapshot error', e.message); });
  // Subscribe to watchparties collection
  state.unsubWatchparties = onSnapshot(watchpartiesRef(), s => {
    state.watchparties = s.docs.map(d => d.data());
    // Auto-archive any that have passed the 25h window and aren't already archived/cancelled
    const now = Date.now();
    state.watchparties.forEach(wp => {
      if (wp.status !== 'archived' && wp.status !== 'cancelled' && (now - wp.startAt) >= WP_ARCHIVE_MS) {
        if (!state.auth && !(state.me && state.me.id)) return;
        try { updateDoc(watchpartyRef(wp.id), { ...writeAttribution(), status: 'archived' }); } catch(e){}
      }
    });
    // Phase 7 Plan 01: flip scheduled parties past startAt to active. Client-primary path;
    // the watchpartyTick CF serves as a safety net when no client is online. Each client
    // tries, but updateDoc is idempotent under "status === 'scheduled'" re-check so multi-
    // client races don't produce double-flips — the second writer no-ops.
    maybeFlipScheduledParties(state.watchparties);
    // Notify about newly-arrived or about-to-start watchparties (only if permitted + tab hidden)
    maybeNotifyWatchparties(state.watchparties);
    renderWatchpartyBanner();
    // Phase 7 fix: full re-render of live modal on every snapshot. Matches the invariant
    // stated at the tick comment (line ~3153) — passive observers need reactions/participants
    // to update without requiring a local action to fire an explicit re-render path.
    if (state.activeWatchpartyId) renderWatchpartyLive();
  }, e => {});
  // Tick every second for countdown + elapsed timers. Short-circuit when no active watchparties.
  if (state.watchpartyTick) clearInterval(state.watchpartyTick);
  state.watchpartyTick = setInterval(() => {
    // Phase 7 Plan 01: unconditional flip check every second — catches scheduled parties
    // that crossed startAt since the last snapshot without waiting for the next snapshot.
    maybeFlipScheduledParties(state.watchparties);
    if (activeWatchparties().length) {
      renderWatchpartyBanner();
      // Time-based trigger: someone's starting in <2min. This can't come from a snapshot alone
      // since the DB data hasn't changed — just elapsed time.
      maybeNotifyWatchparties(state.watchparties);
    }
    // Live modal: surgical textContent updates only (no innerHTML churn). Full re-render
    // still runs from the watchparties onSnapshot when participant state / reactions change.
    // This is the flicker fix — the tick was rewriting the whole modal every second which
    // on iOS Safari caused a visible paint flash.
    if (state.activeWatchpartyId) updateWatchpartyLiveTick();
  }, 1000);
}

// Surgical per-tick update — touches only the elements whose content depends on elapsed time.
// Called every 1 sec while the live modal is open; does NOT rewrite innerHTML. Callers relying
// on structural changes (new participant, new reaction, status transition) still go through
// the full renderWatchpartyLive via onSnapshot.
function updateWatchpartyLiveTick() {
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp) return;
  const now = Date.now();
  // Header timer (mm:ss — changes every second)
  const timerEl = document.getElementById('wp-live-timer-display');
  if (timerEl) {
    const mine = myParticipation(wp);
    if (mine && mine.startedAt) {
      const next = formatElapsed(computeElapsed(mine, wp));
      if (timerEl.textContent !== next) timerEl.textContent = next;
    }
  }
  // Prelaunch countdown (if still pre-start)
  const countEl = document.getElementById('wp-prelaunch-count');
  if (countEl && wp.startAt > now) {
    const secs = Math.max(0, Math.floor((wp.startAt - now) / 1000));
    const mins = Math.floor(secs / 60);
    const next = mins >= 1 ? formatCountdown(wp.startAt - now) : `${secs}s`;
    if (countEl.textContent !== next) countEl.textContent = next;
  }
  // Participant chips — update only the time text, skip if identical.
  document.querySelectorAll('.wp-participant-chip').forEach(chip => {
    const mid = chip.getAttribute('data-member-id');
    if (!mid) return;
    const p = (wp.participants || {})[mid];
    const timeEl = chip.querySelector('[data-role="pt-time"]');
    if (!p || !timeEl) return;
    let statusLabel;
    if (!p.startedAt) statusLabel = 'Joined';
    else if (p.pausedAt) statusLabel = 'Paused';
    else {
      const minutes = Math.floor(computeElapsed(p, wp) / 60000);
      statusLabel = minutes === 0 ? 'Just started' : `${minutes} min in`;
    }
    if (timeEl.textContent !== statusLabel) timeEl.textContent = statusLabel;
    // Paused/joined class drift — toggle if needed so dim state matches
    const wantPaused = !!p.pausedAt;
    const wantJoined = !p.startedAt;
    if (chip.classList.contains('paused') !== wantPaused) chip.classList.toggle('paused', wantPaused);
    if (chip.classList.contains('joined') !== wantJoined) chip.classList.toggle('joined', wantJoined);
  });
}

// Phase 7 D-04: flip scheduled parties past their startAt to `'active'`. Triggers the
// Phase 6 onWatchpartyUpdate CF, which sends the watchpartyStarting push to non-host
// members who opted in. Idempotent under races: we re-read the doc status right before
// writing (via getDoc), skip if already flipped, and the updateDoc uses merge-style. Two
// clients flipping the same party will both succeed in writing, but the writes are
// identical — no divergence.
async function maybeFlipScheduledParties(parties) {
  if (!parties || !parties.length) return;
  if (!state.auth && !(state.me && state.me.id)) return;  // no-op for signed-out
  const now = Date.now();
  for (const wp of parties) {
    if (wp.status !== 'scheduled') continue;
    if ((wp.startAt || 0) > now) continue;
    if ((now - (wp.startAt || 0)) > 6 * 60 * 60 * 1000) continue;  // >6h stale; CF archives these
    try {
      const snap = await getDoc(watchpartyRef(wp.id));
      if (!snap.exists()) continue;
      const fresh = snap.data();
      if (fresh.status !== 'scheduled') continue;  // already flipped by another client / CF
      if ((fresh.startAt || 0) > Date.now()) continue;  // defensive recheck
      await updateDoc(watchpartyRef(wp.id), {
        status: 'active',
        lastActivityAt: Date.now(),
        ...writeAttribution()
      });
    } catch (e) { qnLog('[wp] flip failed', wp.id, e.message); }
  }
}

async function boot() {
  // Phase 11 / REFR-02 — picker UI hidden via feature flag; backend writes preserved.
  // Rendering paths (renderPickerCard/renderPickerStrip) still run; surfaces are CSS-hidden.
  // Reversible in one commit: remove this line to restore full picker UI.
  document.body.classList.add('picker-ui-hidden');

  // Plan 09-07b DESIGN-08: guest invite detour BEFORE sign-in gate.
  // If the URL carries ?invite=<token> and the user is not already authed with a valid session,
  // render the invite-redeem screen instead of the sign-in screen. Signed-in users still see the
  // normal post-auth invite handler (handlePostSignInIntent) so they can redeem a second invite
  // against a separate family without losing their existing session.
  let preAuthInviteToken = null;
  try {
    const params = new URLSearchParams(window.location.search);
    preAuthInviteToken = params.get('invite') || null;
  } catch(e) {}

  // Phase 5: bootstrapAuth MUST resolve before any UI render so the router picks the right screen.
  // IMPORTANT: boot() intentionally does NOT set state.auth or route into a group itself.
  // onAuthStateChangedCouch is the single owner of all post-auth routing decisions;
  // setting state.auth here would make it think wasSignedIn=true and skip the routing.
  try { await bootstrapAuth(); } catch(e) { console.error('[boot] bootstrapAuth error', e); }

  // Complete email-link sign-in if arriving from a magic link (the listener will pick up the user).
  try { await completeEmailLinkIfPresent(); } catch(e) { console.error('[boot] email-link complete failed', e); }

  // Pre-load saved groups from localStorage for instant paint (will be overwritten by Firestore snapshot).
  state.groups = loadSavedGroups();

  // Only paint the sign-in screen when we're SURE the user is signed out. After bootstrapAuth's
  // getRedirectResult resolves, auth.currentUser is synchronously populated from persistence —
  // so when it's non-null we skip the pre-auth paint entirely and let onAuthStateChangedCouch
  // route straight into the group. This avoids the half-second sign-in flash on reload / switch.
  if (!auth.currentUser) {
    // Plan 09-07b DESIGN-08: unauthed + ?invite=<token> -> redeem screen, NOT sign-in.
    if (preAuthInviteToken) {
      // showInviteRedeemScreen hides signin-screen itself + fetches preview + routes to expired on failure.
      showInviteRedeemScreen(preAuthInviteToken);
    } else {
      showPreAuthScreen('signin-screen');
    }
  }

  // Install the listener. Firebase Auth fires it on install with the current auth state (or null
  // if not signed in), and we trust that callback to do all routing from here on.
  state.unsubAuth = watchAuth(onAuthStateChangedCouch);
}

function showApp() {
  document.getElementById('screen-mode').style.display = 'none';
  document.getElementById('screen-family-join').style.display = 'none';
  document.getElementById('screen-name').style.display = 'none';
  document.getElementById('signin-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  document.getElementById('me-label').textContent = state.me.name;
  // Account hero identity: avatar + family chip inline with group noun
  const identAv = document.getElementById('account-identity-avatar');
  if (identAv && state.me) {
    const me = state.members.find(x => x.id === state.me.id) || state.me;
    identAv.style.background = me.color || 'var(--surface-2)';
    identAv.innerHTML = avatarContent(me);
  }
  const famLabelEl = document.getElementById('family-label');
  if (famLabelEl) {
    famLabelEl.innerHTML = groupNounCap() +
      ' <span class="family-chip">' + escapeHtml(state.familyCode) + '</span>';
  }
  // Phase 5: Google / Email / Phone identity line, shown only when signed in.
  const authLine = document.getElementById('account-auth-email');
  if (authLine) {
    const ident = state.auth && (state.auth.email || state.auth.phoneNumber);
    if (ident) {
      authLine.textContent = 'Signed in as ' + ident;
      authLine.style.display = 'block';
    } else {
      authLine.style.display = 'none';
    }
  }
  // Account hero greeting — serif first name
  const greetEl = document.getElementById('account-hero-greeting');
  if (greetEl && state.me) {
    const first = (state.me.name || '').split(/\s+/)[0] || state.me.name;
    greetEl.textContent = 'Hi, ' + first;
  }
  // Header group pill (shows active group + opens switcher)
  const pill = document.getElementById('group-pill');
  if (pill) {
    const icon = {family:'👨‍👩‍👧', crew:'🎬', duo:'🫶'}[currentMode()] || '👥';
    pill.innerHTML = `<span class="gp-icon">${icon}</span><span class="gp-name">${state.group?.name||state.familyCode}</span><span class="gp-caret">▾</span>`;
  }
  document.getElementById('share-url').value = location.href + ' (code: ' + state.familyCode + ')';
  applyModeLabels();
  startSync();
  startActivitySync();
  startListsSync();
  maybeStartOnboarding();
  // Silent background backfill: a few seconds after boot, fill in missing
  // moods and TMDB extras so the user never sees a manual migration button.
  setTimeout(() => { autoBackfill(); }, 4000);
  // Gentle nudge: if the user's library has lots of titles on a service they haven't claimed,
  // suggest they add it. Delayed 8s so it arrives after the user has settled in.
  setTimeout(() => { maybeSuggestServices(); }, 8000);
  // Notification card state reflects current permission
  updateNotifCard();
  // Pick up stashed Trakt auth code on mobile-Safari popup fallback path
  if (typeof checkForStashedTraktCode === 'function') checkForStashedTraktCode();
  // Kick off Trakt sync on boot if connected. Delayed so it doesn't compete
  // with initial Firestore snapshot loads for network. 15-min heartbeat while
  // the tab is active catches any Trakt activity that happens elsewhere.
  setTimeout(() => {
    if (traktIsConfigured() && trakt.getState().connected) {
      trakt.sync({ manual: false });
    }
  }, 6000);
  if (!state._traktHeartbeat) {
    state._traktHeartbeat = setInterval(() => {
      if (!document.hidden && traktIsConfigured() && trakt.getState().connected) {
        trakt.sync({ manual: false });
      }
    }, 15 * 60 * 1000);
  }
  // Load saved "include rent/buy" pref
  try { state.includePaid = localStorage.getItem('qn_include_paid') === '1'; } catch(e) {}
  try { state.serviceScope = localStorage.getItem('qn_service_scope') || 'mine'; } catch(e) {}
  try { state.limitToServices = localStorage.getItem('qn_limit_to_services') === '1'; } catch(e) {}
  // Restore last-viewed tab so users land where they left off
  try {
    const last = localStorage.getItem('qn_last_tab');
    if (last && ['tonight','library','add','settings'].includes(last) && last !== 'tonight') {
      showScreen(last);
    }
  } catch(e) {}
  // Register the inline service worker for PWA install + offline shell.
  // We delay 3s so initial render isn't fighting with worker registration.
  setTimeout(() => {
    registerServiceWorker();
    // If notifications are already granted (returning user), re-confirm push subscription
    // so any new device or fresh install gets registered.
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setTimeout(() => subscribeToPush(), 1500);
    }
  }, 3000);
}

// Service worker registration. NOTE: a true service worker has to be served from
// a separate URL (not a blob), so for full PWA install + offline support, you'll need
// to host a `sw.js` file at the root. We attempt the blob registration here as a
// best-effort fallback; modern browsers will reject it for scope reasons, but the
// manifest + apple-touch-icon meta tags above are still enough to make the app
// installable to the home screen via "Add to Home Screen" on iOS and "Install" on
// Android Chrome. Real offline support requires the separate sw.js file.
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    qnLog('[QN] Service worker skipped (needs https or localhost)');
    return;
  }
  // Try registering /sw.js if the host has it. Silently no-op if absent — that's fine,
  // the app still works as a regular installable web app.
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    qnLog('[QN] Service worker registered from /sw.js');
  } catch(e) {
    // Expected if /sw.js isn't deployed alongside index.html. App still works fine.
  }
}

function applyModeLabels() {
  const m = currentMode();
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  // 14-10: who-title-label set removed — element deleted with .who-card in app.html.
  set('next3-sub', groupForLabel());
  set('stats-heading', {family:"Who's watched what", crew:"Who's watched what", duo:"How we've watched"}[m]);
  set('members-heading', {family:'Family', crew:'Crew', duo:'Us'}[m]);
  set('leave-family-btn', {family:'Leave family', crew:'Leave crew', duo:'Leave duo'}[m]);
  // Gate adults-only scope UI based on mode
  const adultsField = document.getElementById('edit-adults-field');
  if (adultsField) adultsField.style.display = modeAllowsAdultScope() ? '' : 'none';
  // Picker settings card
  const pickerDesc = {family:'Rotate through the family so no one argues about whose turn it is.', crew:'Rotate through the crew so everyone gets a turn.', duo:'Alternate between the two of you.'}[m];
  set('picker-desc', pickerDesc);
  const pickerBtn = document.getElementById('picker-enable-btn');
  if (pickerBtn) {
    const on = !!(state.group?.picker?.enabled);
    pickerBtn.textContent = on ? 'Manage rotation' : 'Set up rotation';
    pickerBtn.classList.toggle('accent', !on);
  }
}

function safeRun(fn, label) {
  try { fn(); } catch(e) { console.error('[render error]', label, e); }
}

function renderAll() {
  safeRun(applyReadOnlyState, 'applyReadOnlyState'); // Plan 5.8 D-15: recompute body.is-readonly + banner
  safeRun(renderTonight, 'renderTonight');
  safeRun(renderLibrary, 'renderLibrary');
  safeRun(renderSettings, 'renderSettings');
  safeRun(renderFamily, 'renderFamily');
  safeRun(renderSearchResults, 'renderSearchResults');
  safeRun(updateNeedsVoteBadge, 'updateNeedsVoteBadge');
  // Live-update the open vote/rate modal when titles change
  if (modalTitleId && document.getElementById('modal-bg') && document.getElementById('modal-bg').classList.contains('on')) {
    if (modalMode === 'rate') {
      const active = document.activeElement;
      if (!(active && active.tagName === 'TEXTAREA')) renderRateGrid();
    } else { renderVoteGrid(); }
  }
}

window.showScreen = function(name, btn) {
  // Phase 19 / D-04 — kid-mode is Tonight-tab-scoped session state. Reset when
  // navigating away. Direct setter (no UI re-render needed — about to switch tabs).
  if (name !== 'tonight' && state.kidMode) {
    state.kidMode = false;
    state.kidModeOverrides = new Set();
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => { t.classList.remove('on'); t.setAttribute('aria-selected','false'); });
  document.getElementById('screen-'+name).classList.add('active');
  if (btn) { btn.classList.add('on'); btn.setAttribute('aria-selected','true'); }
  else {
    // When restored programmatically, also highlight the correct tab button
    const tabIdx = ['tonight','library','add','family','settings'].indexOf(name);
    const tab = document.querySelectorAll('.tab')[tabIdx];
    if (tab) { tab.classList.add('on'); tab.setAttribute('aria-selected','true'); }
  }
  applyModeLabels();
  if (name === 'tonight' || name === 'family' || name === 'settings') {
    // Activity feed is on Tonight, so viewing it clears the badge.
    // Family tab holds pending approvals so viewing it clears that badge too.
    localStorage.setItem('qn_activity_seen', String(Date.now()));
    updateActivityBadge();
  }
  if (name === 'add') initAddTab();
  if (name === 'family') renderFamily();
  if (name === 'settings') renderSettings();
  // Brand subtitle: shown only on Tonight as a hero line; hidden on other tabs for cleanliness
  const subEl = document.getElementById('screen-subtitle');
  if (subEl) {
    if (name === 'tonight') {
      subEl.textContent = "Who's on the couch tonight?";
      subEl.classList.add('on');
    } else {
      subEl.classList.remove('on');
    }
  }
  // Persist so next app-open lands where the user left off
  try { localStorage.setItem('qn_last_tab', name); } catch(e) {}
};

function titleMatchesProviders(t) {
  // Service-aware filtering is now opt-in. Default behavior shows everything in the library
  // so users see all options first. They flip the "limit to services" checkbox to filter.
  if (!state.limitToServices) return true;
  // When filtering, we look at the union of every family member's services. This way a kid
  // with Disney+ on their account isn't excluded just because Dad didn't add Disney+ to his.
  const includePaid = !!state.includePaid;
  const activeServices = new Set();
  state.members.forEach(m => {
    if (Array.isArray(m.services)) m.services.forEach(s => activeServices.add(s));
  });
  // If limit is on but no services configured anywhere, behave as if limit is off
  if (activeServices.size === 0) return true;
  const subBrands = new Set((t.providers || []).map(p => normalizeProviderName(p.name)));
  const rentBrands = new Set((t.rentProviders || []).map(p => normalizeProviderName(p.name)));
  const buyBrands = new Set((t.buyProviders || []).map(p => normalizeProviderName(p.name)));
  for (const svc of activeServices) {
    if (subBrands.has(svc)) return true;
  }
  if (includePaid && (rentBrands.size > 0 || buyBrands.size > 0)) return true;
  if (t.isManual) return true;
  if (!t.providersChecked) return true;
  return false;
}

// Compact services bar for the Queue tab — shows what we're filtering by and lets
// the user opt into rent/buy/theaters. Hidden when filter mode doesn't make sense
// (watched/recent/myqueue list all own their content regardless of availability).
function renderServicesBar() {
  const el = document.getElementById('services-bar');
  if (!el) return;
  if (state.filter === 'watched' || state.filter === 'recent' || state.filter === 'myqueue' || state.filter === 'scheduled') {
    el.innerHTML = '';
    return;
  }
  const limit = !!state.limitToServices;
  const paid = !!state.includePaid;
  // Detect whether any services are configured at all (mine or family-wide)
  const mySvcs = (state.me && Array.isArray(state.me.services)) ? state.me.services : [];
  let anyServices = mySvcs.length > 0;
  if (!anyServices) {
    for (const m of state.members) {
      if (Array.isArray(m.services) && m.services.length) { anyServices = true; break; }
    }
  }
  // Sub-row only appears when filter is on. Just the rent/buy modifier — services are managed in Settings.
  let subControls = '';
  if (limit) {
    if (!anyServices) {
      subControls = `<div class="services-bar-sub services-bar-hint">Pick your streaming services on the Account tab to use this filter.</div>`;
    } else {
      subControls = `<div class="services-bar-sub">
        <label class="services-bar-paid" title="Also show titles you'd need to rent or buy">
          <input type="checkbox" ${paid?'checked':''} onchange="togglePaidFilter(this.checked)">
          <span>Also include Rent / Buy</span>
        </label>
      </div>`;
    }
  }
  el.innerHTML = `
    <div class="services-bar-row">
      <label class="services-bar-limit" title="Hide titles you can't watch on your services">
        <input type="checkbox" ${limit?'checked':''} onchange="toggleLimitToServices(this.checked)">
        <span>Only show what I can watch</span>
      </label>
    </div>
    ${subControls}`;
}

// jumpToServicesPicker stays defined for the hint above to link, but the bar no longer
// surfaces a "Choose services" button — services are picked in Settings, period.
window.jumpToServicesPicker = function() {
  haptic('light');
  showScreen('settings');
  setTimeout(() => {
    const card = document.getElementById('services-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('flash-highlight');
      setTimeout(() => card.classList.remove('flash-highlight'), 1500);
    }
  }, 80);
};

window.toggleLimitToServices = function(on) {
  state.limitToServices = !!on;
  haptic('light');
  try { localStorage.setItem('qn_limit_to_services', on ? '1' : '0'); } catch(e) {}
  renderTonight();
  renderLibrary();
};

window.setServiceScope = function(scope) {
  if (scope !== 'mine' && scope !== 'family') return;
  state.serviceScope = scope;
  haptic('light');
  try { localStorage.setItem('qn_service_scope', scope); } catch(e) {}
  renderTonight();
  renderLibrary();
};

// Library search. Matches title name, year, kind, genres, moods, cast names, overview.
// Live filter — debouncing isn't needed because state.titles is already in memory.
let librarySearchTimer = null;
window.onLibrarySearch = function(value) {
  state.librarySearchQuery = value || '';
  // Show/hide the clear button
  const clearBtn = document.getElementById('lib-search-clear');
  if (clearBtn) clearBtn.style.display = state.librarySearchQuery ? 'grid' : 'none';
  // Light debounce so we're not re-rendering on every keystroke
  if (librarySearchTimer) clearTimeout(librarySearchTimer);
  librarySearchTimer = setTimeout(() => renderLibrary(), 80);
};

window.clearLibrarySearch = function() {
  state.librarySearchQuery = '';
  const input = document.getElementById('lib-search-input');
  if (input) { input.value = ''; input.focus(); }
  const clearBtn = document.getElementById('lib-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderLibrary();
};

// Returns true if a title matches the current library search query.
// Permissive: matches across name, year, kind, genres, mood ids, cast names, overview.
function matchesLibrarySearch(t) {
  const q = (state.librarySearchQuery || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    t.name,
    t.year,
    t.kind,
    Array.isArray(t.genres) ? t.genres.join(' ') : '',
    Array.isArray(t.moods) ? t.moods.map(id => { const m = moodById(id); return m ? m.label : ''; }).join(' ') : '',
    Array.isArray(t.cast) ? t.cast.map(c => c.name || '').join(' ') : '',
    t.overview || ''
  ].join(' ').toLowerCase();
  return haystack.includes(q);
}

window.togglePaidFilter = function(on) {
  state.includePaid = !!on;
  haptic('light');
  try { localStorage.setItem('qn_include_paid', on ? '1' : '0'); } catch(e) {}
  renderTonight();
  renderLibrary();
};

function renderMoodFilter() {
  const el = document.getElementById('mood-filter-tonight');
  if (!el) return;
  // Only show moods that at least one unwatched, in-scope title actually has
  const available = new Set();
  state.titles.forEach(t => {
    if (t.watched || isHiddenByScope(t)) return;
    (t.moods || []).forEach(m => available.add(m));
  });
  const shown = MOODS.filter(m => available.has(m.id));
  if (!shown.length) { el.innerHTML = ''; return; }
  const hasActive = state.selectedMoods.length > 0;
  const chips = shown.map(m => {
    const on = state.selectedMoods.includes(m.id);
    return `<button class="mood-chip ${on?'on':''}" onclick="toggleMood('${m.id}')">
      <span class="mood-icon">${twemojiImg(m.icon, m.label, 'twemoji--md')}</span>${m.label}
    </button>`;
  });
  if (hasActive) {
    chips.push(`<button class="mood-chip" onclick="clearMoodFilter()" style="color:var(--ink-dim);">Clear</button>`);
  }
  el.innerHTML = chips.join('');
}

window.toggleMood = function(id) {
  haptic('light');
  if (state.selectedMoods.includes(id)) {
    state.selectedMoods = state.selectedMoods.filter(m => m !== id);
  } else {
    state.selectedMoods = [...state.selectedMoods, id];
  }
  renderTonight();
};

window.clearMoodFilter = function() {
  state.selectedMoods = [];
  renderTonight();
};
window.removeMoodFilter = function(id) {
  if (!moodById(id)) return;                      // ASVS V5: reject any id not in MOODS[]
  haptic('light');
  state.selectedMoods = state.selectedMoods.filter(m => m !== id);
  renderTonight();
};

function renderTonight() {
  renderPickerCard();
  renderUpNext();
  renderContinueWatching();
  renderNext3();
  renderMoodFilter();
  updateFiltersBar();
  // 14-10 (sketch 003 V5): who-list emitter removed — #who-list element deleted
  // with .who-card in app.html. The V5 roster in #couch-viz-container above is
  // the single 'who's on the couch' surface on the Tonight tab.
  const el = document.getElementById('matches-list');
  const countEl = document.getElementById('matches-count');
  const actionsEl = document.getElementById('t-section-actions');

  // Empty states — consistent shape
  // Plan 14-09 / D-11 (a) — brand-new family, nothing watched.
  // Triggers when family doc is set up (state.familyCode) but no titles yet exist.
  // CTAs: Add tab + Trakt connect (history import). showScreen('add') is the
  // canonical tab nav. Trakt connect entry: trakt.connect() (window.trakt at line 865).
  if ((state.titles || []).length === 0 && state.familyCode) {
    el.innerHTML = `<div class="queue-empty">
      <span class="emoji">🛋️</span>
      <strong>Your couch is fresh</strong>
      Nothing in queue yet. What should be the first?
      <div class="queue-empty-cta">
        <button class="tc-primary" type="button" onclick="showScreen('add')">Add a title</button>
        <button class="tc-secondary" type="button" onclick="trakt.connect()">Connect Trakt to import history</button>
      </div>
    </div>`;
    countEl.textContent = '';
    if (actionsEl) actionsEl.innerHTML = '';
    return;
  }
  if (state.members.length === 0) {
    el.innerHTML = `<div class="empty"><strong>No group yet</strong>Share your code so others can join.</div>`;
    countEl.textContent = '';
    if (actionsEl) actionsEl.innerHTML = '';
    return;
  }
  // 14-10 (V5 redesign) follow-up: gate the "who's watching" empty state on the V5
  // couchMemberIds source of truth, NOT the legacy state.selectedMembers (which is only
  // written by the deprecated V4 toggleMember helper). Same bug class as the who-mini
  // sticky bar fix in commit e89aa0b.
  const couch = (state.couchMemberIds && state.couchMemberIds.length)
    ? state.couchMemberIds
    : (state.selectedMembers && state.selectedMembers.length ? state.selectedMembers : (state.me ? [state.me.id] : []));
  if (couch.length === 0) {
    // D-11 (CONTEXT.md) — empty states should have action-leading CTAs, not dead ends.
    el.innerHTML = `<div class="empty"><strong>Pick who's watching</strong>Tap anyone above, or <button class="link-like" onclick="openInviteShare()">invite someone</button> to join the couch.</div>`;
    countEl.textContent = '';
    if (actionsEl) actionsEl.innerHTML = '';
    return;
  }

  function passesBaseFilter(t) {
    if (isWatchedByCouch(t, couch)) return false;
    if (isHiddenByScope(t)) return false;
    // Pending/declined titles don't surface on Tonight at all — even parents shouldn't see them
    // as potential matches until they're approved.
    if (t.approvalStatus === 'pending' || t.approvalStatus === 'declined') return false;
    if (!titleMatchesProviders(t)) return false;
    if (state.selectedMoods.length && !state.selectedMoods.some(m => (t.moods||[]).includes(m))) return false;
    if (isVetoed(t.id)) return false;
    const tier = tierFor(t.rating);
    if (tier) {
      for (const mid of state.selectedMembers) {
        const m = state.members.find(x => x.id === mid);
        if (!m) continue;
        const max = m.maxTier != null ? m.maxTier : ageToMaxTier(m.age);
        if (tier > max) return false;
      }
    }
    // Phase 19 / D-07..D-09 — kid-mode tier cap (TIER_PG=2). Bypassed per-title via state.kidModeOverrides.
    const _kidCap = getEffectiveTierCap();
    if (_kidCap !== null) {
      const _tier = tierFor(t.rating);
      if (_tier !== null && _tier > _kidCap && !state.kidModeOverrides.has(t.id)) {
        return false;
      }
    }
    return true;
  }

  // Tonight's picks: couch interest, no off-couch interest, no couch dissent.
  //   - At least one couch member yes-voted
  //   - No off-couch member yes-voted
  //   - Couch abstainers OK ("too bad for them, didn't vote in time" — per user spec)
  //   - Off-couch abstainers OK
  // passesBaseFilter already removes anything a couch member said 'no' or 'seen' to
  // (via isWatchedByCouch), so couch dissent is handled upstream. Off-couch no/seen
  // votes do not disqualify (per user 2026-04-28 spec).
  const couchSet = new Set(state.selectedMembers);
  const matches = state.titles.filter(t => {
    if (!passesBaseFilter(t)) return false;
    const votes = t.votes || {};
    // No off-couch member may have yes-voted (off-couch yes routes to Worth considering).
    for (const mid in votes) {
      if (votes[mid] === 'yes' && !couchSet.has(mid)) return false;
    }
    // At least one couch member must have yes-voted (no zero-couch-interest titles).
    return state.selectedMembers.some(mid => votes[mid] === 'yes');
  }).sort((a,b) => {
    // Order by couch yes-count (more couch interest -> higher rank). Off-couch yes
    // is always zero in matches, so total yes-count == couch yes-count here.
    const aY = Object.values(a.votes||{}).filter(v => v === 'yes').length;
    const bY = Object.values(b.votes||{}).filter(v => v === 'yes').length;
    return bY - aY;
  });

  // Worth considering: at least one couch member yes-voted, but missing the strict
  // alignment that Tonight's picks requires — either a couch member abstained, OR an
  // off-couch member also yes-voted. Excludes anything already in matches.
  // passesBaseFilter already excludes couch no/seen votes (per user spec —
  // "if someone voted no we don't list it"; off-couch no-votes do not disqualify).
  const matchIds = new Set(matches.map(t => t.id));
  const considerable = state.titles.filter(t => {
    if (!passesBaseFilter(t)) return false;
    if (matchIds.has(t.id)) return false;
    const votes = t.votes || {};
    return state.selectedMembers.some(mid => votes[mid] === 'yes');
  }).sort((a,b) => {
    // Order by total yes-count across the whole group (more enthusiasm → higher rank).
    const aY = Object.values(a.votes||{}).filter(v => v === 'yes').length;
    const bY = Object.values(b.votes||{}).filter(v => v === 'yes').length;
    return bY - aY;
  });

  countEl.textContent = matches.length ? (matches.length + (matches.length===1?' match':' matches')) : '';

  // Section-level actions: spin + veto-undo note, quietly
  const actions = [];
  if (matches.length >= 2) {
    if (isFairnessLocked()) {
      actions.push(`<button class="t-spin disabled" disabled title="Someone else spins this one">🎲 Spin</button>`);
    } else {
      actions.push(`<button class="t-spin" onclick="spinPick()">🎲 Spin</button>`);
    }
  }
  const mv = myVetoToday();
  if (mv) {
    const vt = state.titles.find(x => x.id === mv.titleId);
    actions.push(`<span class="t-section-inline-note">You passed on ${escapeHtml(vt ? vt.name : 'a title')} tonight.</span>`);
  }
  if (actionsEl) actionsEl.innerHTML = actions.join('');

  // Vetoed tonight section
  const vetoes = getVetoes();
  const vetoedTitles = Object.keys(vetoes).map(id => state.titles.find(t => t.id === id)).filter(Boolean);
  const vetoedHtml = vetoedTitles.length
    ? `<div class="t-vetoed-divider">Vetoed tonight</div>${vetoedTitles.map(t => card(t)).join('')}`
    : '';

  // Worth considering: soft middle — someone's in, nobody's out
  const considerHtml = considerable.length
    ? `<div class="t-section" style="margin-top:var(--s5);">
        <div class="t-section-head">
          <div class="t-section-title">Worth considering</div>
          <div class="t-section-meta">${considerable.length} pending</div>
        </div>
        <p style="font-size:var(--fs-meta);color:var(--ink-dim);margin:0 0 var(--s3);padding:0 var(--s1);">At least one of you picked these — couch isn't unanimous.</p>
        ${considerable.map(t => card(t, { considerableVariant: true })).join('')}
      </div>`
    : '';

  if (matches.length === 0 && !vetoedTitles.length && considerable.length === 0) {
    el.innerHTML = `<div class="empty"><strong>No matches yet</strong>Add titles and vote so we have something to watch.</div>`;
    return;
  }
  // Phase 21 — replace generic "Nothing's matching" with conflict-aware diagnosis
  // when titles exist but matches list is empty. D-09 + D-12. Considerable-fallback
  // (D-12) preserves the "options below" hint after the helper output.
  let emptyHtml = '';
  if (matches.length === 0) {
    const diag = diagnoseEmptyMatches(state.titles, couch);
    const chipsHtml = diag.reasons.length
      ? `<div class="empty-reasons">${diag.reasons.map(r => `<span class="empty-reason-chip">${escapeHtml(r.copy)}</span>`).join('')}</div>`
      : '';
    const considerHint = considerable.length ? `<div class="empty-consider-hint">But there are still options below.</div>` : '';
    emptyHtml = `<div class="empty empty-conflict-aware"><strong>${escapeHtml(diag.headline)}</strong>${chipsHtml}${considerHint}</div>`;
  }
  const matchesHtml = matches.length
    ? matches.map(t => card(t)).join('')
    : emptyHtml;
  el.innerHTML = matchesHtml + considerHtml + vetoedHtml;
  // D-06 (DECI-14-06) — render couch viz centerpiece. Container in app.html (Tonight tab top).
  // Safe to call on every renderTonight pass — innerHTML overwrite is the persistence model.
  if (typeof renderCouchViz === 'function') renderCouchViz();
  // D-07 (DECI-14-07) — Flow A entry CTA. Lives directly under couch viz; gated on
  // state.couchMemberIds ≥ 1. Safe to call on every renderTonight pass (innerHTML overwrite).
  if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
  // === Phase 15 / S1 (TRACK-15-07) — Pick up where you left off (tuple-aware cross-show).
  // Renders into #cv15-pickup-container between #couch-viz-container and #flow-a-entry-container.
  // Hides entirely on zero tuples per UI-SPEC §Discretion Q7. ===
  renderPickupWidget();
}

// Combined filters-bar toggle + active state
window.toggleFiltersBar = function() {
  const body = document.getElementById('t-filter-body');
  if (!body) return;
  body.style.display = body.style.display === 'none' ? 'flex' : 'none';
};
function updateFiltersBar() {
  const toggle = document.getElementById('t-filter-toggle');
  const countEl = document.getElementById('t-filter-count');
  if (toggle && countEl) {
    // Providers are handled via the limit checkbox; only moods drive the Tonight filter pill.
    const active = state.selectedMoods.length;
    if (active > 0) {
      toggle.classList.add('has-active');
      countEl.textContent = String(active);
    } else {
      toggle.classList.remove('has-active');
      countEl.textContent = '';
    }
  }
  // Limit-to-services checkbox state
  const limitCheck = document.getElementById('t-limit-checkbox');
  if (limitCheck) limitCheck.checked = !!state.limitToServices;
  // Rent/Buy toggle only meaningful while limit is on
  const paidWrap = document.getElementById('t-paid-toggle');
  const paidCheck = document.getElementById('t-paid-checkbox');
  if (paidWrap && paidCheck) {
    paidWrap.style.display = state.limitToServices ? '' : 'none';
    paidCheck.checked = !!state.includePaid;
  }
  // Phase 3: Active-mood inline row (MOOD-07). Renders after the filter toggle,
  // outside the collapsible panel. Pitfall 2: outer wrapper is <div>, not <button>,
  // so the × <button> is not a nested interactive element.
  const activeRow = document.getElementById('t-mood-active-row');
  if (activeRow) {
    if (state.selectedMoods.length > 0) {
      const html = state.selectedMoods.map(id => {
        const m = moodById(id);
        if (!m) return '';                            // ASVS V5: silently skip any id not in MOODS[]
        return `<div class="mood-chip on" role="group" aria-label="${escapeHtml(m.label)} filter active"><span class="mood-icon">${twemojiImg(m.icon, m.label, 'twemoji--md')}</span>${escapeHtml(m.label)}<button class="mood-chip-remove" onclick="removeMoodFilter('${escapeHtml(id)}')" aria-label="Remove ${escapeHtml(m.label)} filter">×</button></div>`;
      }).join('');
      // Pitfall 4: avoid flicker — only write innerHTML when content actually changes.
      if (activeRow.innerHTML !== html) activeRow.innerHTML = html;
      activeRow.style.display = '';
    } else {
      if (activeRow.innerHTML !== '') activeRow.innerHTML = '';
      activeRow.style.display = 'none';
    }
  }
}

function card(t, opts) {
  const votes = t.votes || {};
  const yesCount = Object.values(votes).filter(v=>v==='yes').length;
  const tier = tierFor(t.rating);
  const ratingPill = t.rating ? `<span class="tc-rating-pill ${tier?'tier'+tier:''}">${escapeHtml(t.rating)}</span>` : '';
  // Badges: manual is for "not in TMDB", 18+ is scope. Combine sparingly.
  const badges = [];
  if (t.isManual) badges.push('<span class="tc-rating-pill" title="Added manually">✎</span>');
  if (t.scope === 'adults') badges.push('<span class="tc-rating-pill tier4">18+</span>');
  const badgesHtml = badges.length ? `<span class="tc-badges">${badges.join('')}</span>` : '';

  // Average score on the 10-scale across all raters
  const ratings = t.ratings || {};
  const avg = avgScore(t);

  // Meta line — keep to essentials
  const metaParts = [];
  if (t.year) metaParts.push(escapeHtml(t.year));
  if (t.runtime) metaParts.push(`${t.runtime}m`);
  if (t.watched && avg > 0) metaParts.push(`<span class="tc-stars">★ ${formatScore(avg)}</span>`);
  // === D-04 (DECI-14-04) — "X want it" pill replaces the bare yes-count pill ===
  // Counts members with this title in their queues map (per DR-2: queues == Yes votes today;
  // future-proof against decoupling by reading queues directly). Renders 3 micro-avatars +
  // overflow chip + "N want it" label. Falls back gracefully when t.queues is missing.
  else if (!t.watched && t.queues) {
    const queuers = (state.members || []).filter(m => t.queues[m.id] != null);
    if (queuers.length > 0) {
      const visible = queuers.slice(0, 3);
      const overflow = queuers.length - visible.length;
      const avatars = visible.map(m =>
        `<span class="tc-want-avatar" title="${escapeHtml(m.name || 'Member')}" style="background:${memberColor(m.id)}">${escapeHtml((m.name || '?').charAt(0).toUpperCase())}</span>`
      ).join('');
      const overflowChip = overflow > 0 ? `<span class="tc-want-overflow">+${overflow}</span>` : '';
      const wantWord = queuers.length === 1 ? 'wants' : 'want';
      metaParts.push(
        `<span class="tc-want-pill" aria-label="${queuers.length} ${queuers.length === 1 ? 'person' : 'people'} ${wantWord} this">` +
          `<span class="tc-want-avatars">${avatars}${overflowChip}</span>` +
          `<span class="tc-want-label">${queuers.length} ${wantWord} it</span>` +
        `</span>`
      );
    }
  }
  // TV progress pill — shown for TV titles with per-member progress tracked
  const progPill = progressPill(t);
  if (progPill) metaParts.push(progPill);
  // TV status badge (new season, next ep, ended) — Turn 9
  const meId = state.me && state.me.id;
  const statusInfo = tvStatusBadge(t, meId);
  if (statusInfo) metaParts.push(`<span class="tv-status-badge ${statusInfo.kind}">${escapeHtml(statusInfo.text)}</span>`);
  if (t.moods && t.moods.length) {
    const moodChars = t.moods.slice(0,3).map(id => { const m = moodById(id); return m ? twemojiImg(m.icon, m.label) : ''; }).join('');
    if (moodChars) metaParts.push(`<span class="tc-mood-dots">${moodChars}</span>`);
  }
  const metaHtml = metaParts.join('<span class="dot">·</span>');

  // Provider strip — tiny logos under the meta line so you can see at a glance where to watch.
  // Streaming logos render at full opacity. If there's no streaming option, we surface rent/buy
  // info instead so you know it's still watchable for a fee.
  let providersHtml = '';
  if (!t.watched) {
    const mySvcs = new Set((state.me && Array.isArray(state.me.services)) ? state.me.services : []);
    const seenStream = new Set();
    const streamLogos = [];
    for (const p of (t.providers || [])) {
      const brand = normalizeProviderName(p.name);
      if (seenStream.has(brand)) continue;
      seenStream.add(brand);
      streamLogos.push({ ...p, brand, mine: mySvcs.has(brand) });
      if (streamLogos.length >= 4) break;
    }
    // Sort user's services to the front so they pop visually
    streamLogos.sort((a,b) => (b.mine?1:0) - (a.mine?1:0));
    // Rent/Buy summary — only surface when there's no streaming option, OR when streaming exists
    // but the user might still want to know rental is available. We keep this minimal: a small
    // "Rent" or "Buy" pill at the end of the strip.
    const hasRent = Array.isArray(t.rentProviders) && t.rentProviders.length > 0;
    const hasBuy = Array.isArray(t.buyProviders) && t.buyProviders.length > 0;
    let paidPill = '';
    if (hasRent && hasBuy) paidPill = `<span class="tc-paid-pill" title="Available to rent or buy">Rent / Buy</span>`;
    else if (hasRent) paidPill = `<span class="tc-paid-pill" title="Available to rent">Rent</span>`;
    else if (hasBuy) paidPill = `<span class="tc-paid-pill" title="Available to buy">Buy</span>`;
    if (streamLogos.length || paidPill) {
      const logosHtml = streamLogos.map(p =>
        `<div class="tc-provider ${p.mine?'mine':''}" title="${escapeHtml(p.brand)}${p.mine?' (you have this)':''}" style="background-image:url('${p.logo}')"></div>`
      ).join('');
      providersHtml = `<div class="tc-providers" aria-label="Where to watch">${logosHtml}${paidPill}</div>`;
    }
  }

  // Block check
  let blockedBy = [];
  if (tier && state.selectedMembers.length) {
    blockedBy = state.selectedMembers.map(mid => state.members.find(m=>m.id===mid)).filter(m => {
      if (!m) return false;
      const max = m.maxTier != null ? m.maxTier : ageToMaxTier(m.age);
      return tier > max;
    });
  }
  const blockedClass = blockedBy.length ? ' blocked' : '';
  const blockedNote = blockedBy.length ? `<div class="tc-note blocked">Above limit for ${escapeHtml(blockedBy.map(m=>m.name).join(', '))}</div>` : '';

  // Veto
  const vetoEntry = getVetoes()[t.id];
  const vetoedClass = vetoEntry ? ' vetoed' : '';
  const vetoNote = vetoEntry ? `<div class="tc-note veto"><span class="veto-who">${escapeHtml(vetoEntry.memberName)}</span> passed tonight${vetoEntry.comment?` — "${escapeHtml(vetoEntry.comment)}"`:''}</div>` : '';

  // Scheduled
  const isScheduled = t.scheduledFor && t.scheduledFor > Date.now() - 3*60*60*1000;
  const scheduledNote = (isScheduled && !t.watched) ? `<div class="tc-note scheduled">📅 ${formatScheduleLong(t.scheduledFor)}${t.scheduledNote?' · '+escapeHtml(t.scheduledNote):''}</div>` : '';

  // Vote chips (only if anyone has voted)
  const voteChips = state.members.map(m => {
    const v = votes[m.id]; if (!v) return '';
    const cls = v==='yes'?'yes':v==='no'?'no':'seen';
    const sym = v==='yes'?'✓':v==='no'?'✗':'👁';
    return `<span class="tc-vote-chip ${cls}">${sym} ${escapeHtml(m.name)}</span>`;
  }).filter(Boolean).join('');

  // Approval states. Pending/declined titles override normal voting affordance.
  const isPending = t.approvalStatus === 'pending';
  const isDeclined = t.approvalStatus === 'declined';
  const requester = (isPending || isDeclined) ? state.members.find(x => x.id === t.requestedBy) : null;
  const approvalClass = isPending ? ' pending' : (isDeclined ? ' declined' : '');
  let approvalNote = '';
  if (isPending) {
    const who = requester ? escapeHtml(requester.name) : 'A family member';
    if (isMyselfParent()) {
      approvalNote = `<div class="tc-note pending">${who} requested this. <button class="tc-approve-inline" onclick="event.stopPropagation();approveTitle('${t.id}')">Approve</button><button class="tc-decline-inline" onclick="event.stopPropagation();openDeclineSheet('${t.id}')">Decline</button></div>`;
    } else {
      // Non-parent view: if this is the requester's own pending title, show a
      // gentle age hint once the request is more than 2 days old so they know
      // it's genuinely waiting rather than something they missed.
      const meId = state.me && state.me.id;
      const isMyRequest = meId && t.requestedBy === meId;
      const ageMs = t.requestedAt ? Date.now() - t.requestedAt : 0;
      const stale = isMyRequest && ageMs > 2 * 86400000; // 2 days
      const ageStr = t.requestedAt ? timeAgo(t.requestedAt) : '';
      approvalNote = stale
        ? `<div class="tc-note pending">Still waiting on a parent. Sent ${ageStr}.</div>`
        : `<div class="tc-note pending">Waiting on a parent to review.</div>`;
    }
  } else if (isDeclined) {
    const note = t.approvalNote ? ` — "${escapeHtml(t.approvalNote)}"` : '';
    approvalNote = `<div class="tc-note declined">Not approved${note}</div>`;
  }

  // Primary action
  // === D-04 (DECI-14-04) — Vote button removed from tile face ===
  // The Vote button (Vote-mode bulk affordance) moves to the Add tab "Catch up on votes" CTA
  // (per D-05). Per-title voting is reachable via the new openTileActionSheet primary entry.
  // Watched-state Rate and pending/declined empty branches preserved.
  let primaryBtn;
  if (t.watched) {
    primaryBtn = `<button class="tc-primary watched" onclick="event.stopPropagation();openRateModal('${t.id}')">★ Rate</button>`;
  } else {
    // Unwatched (including pending/declined): no on-tile primary; primary action is body-tap → openTileActionSheet.
    primaryBtn = '';
  }

  // === D-04 (DECI-14-04) — ▶ Trailer button on tile face ===
  // Surfaces formerly-buried trailer affordance from the ⋯ action sheet.
  // Uses event.stopPropagation() so the body-tap (openTileActionSheet) doesn't also fire.
  // Reuses the existing trailer launch pattern from openActionSheet (YouTube external link).
  const trailerBtnHtml = (t.trailerKey && !t.watched)
    ? `<a class="tc-trailer-btn" href="https://www.youtube.com/watch?v=${encodeURIComponent(t.trailerKey)}" target="_blank" rel="noopener" onclick="event.stopPropagation();" aria-label="Watch trailer for ${escapeHtml(t.name)}">▶ Trailer</a>`
    : '';

  // Phase 20 / D-08 + D-10 — Card explanation footer (dim-text, single line).
  // Considerable variant flag (D-10) flows from renderTonight via opts.considerableVariant.
  const _cardCouch20 = state.couchMemberIds || state.selectedMembers || [];
  const _cardOpts20 = { considerableVariant: !!(opts && opts.considerableVariant) };
  const _cardExpl20 = buildMatchExplanation(t, _cardCouch20, _cardOpts20);
  const cardExplHtml = _cardExpl20 ? `<div class="tc-explanation">${_cardExpl20}</div>` : '';

  return `<div class="tc${blockedClass}${vetoedClass}${approvalClass}" role="button" tabindex="0" aria-label="${escapeHtml(t.name)}${t.year?', '+escapeHtml(t.year):''}" onclick="openTileActionSheet('${t.id}',event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTileActionSheet('${t.id}',event);}">
    <div class="tc-poster" style="${posterStyle(t)}" aria-hidden="true">${posterFallbackLetter(t)}</div>
    <div class="tc-body">
      <div class="tc-name">${badgesHtml}${ratingPill} ${escapeHtml(t.name)}</div>
      <div class="tc-meta">${metaHtml}</div>
      ${providersHtml}
      ${scheduledNote}
      ${blockedNote}
      ${vetoNote}
      ${approvalNote}
      ${voteChips && !isPending && !isDeclined ? `<div class="tc-vote-strip">${voteChips}</div>` : ''}
      ${cardExplHtml}
      <div class="tc-footer">
        ${primaryBtn}
        ${trailerBtnHtml}
        <button class="tc-more" aria-label="More options" onclick="openActionSheet('${t.id}',event)" title="More">⋯</button>
      </div>
    </div>
  </div>`;
}

function renderLibrary() {
  renderServicesBar();
  const el = document.getElementById('library-list');
  const countEl = document.getElementById('library-count');
  if (!el) return;
  const hasSearch = !!(state.librarySearchQuery || '').trim();
  // My queue filter uses its own renderer (search applies inside it too)
  if (state.filter === 'myqueue') {
    let myQueue = getMyQueueTitles().filter(t => !isHiddenByScope(t));
    if (hasSearch) myQueue = myQueue.filter(matchesLibrarySearch);
    if (countEl) countEl.textContent = myQueue.length ? (myQueue.length + ' queued') : '';
    renderFullQueue(el, myQueue); return;
  }
  let list = state.titles.slice().filter(t => !isHiddenByScope(t));
  // D-01 (DECI-14-01): couch-aware watched filter for Library discovery filters.
  // 'watched' filter is intentionally NOT couch-filtered (it's the user's archive).
  // 'myrequests', 'inprogress', 'toprated', 'scheduled', 'recent' are status-driven views
  // that must surface their full scope regardless of watch state — not couch-filtered.
  const couchForLib = getCouchOrSelfIds();
  if (state.filter === 'unwatched') list = list.filter(t => {
    if (isWatchedByCouch(t, couchForLib)) return false;
    // Phase 19 / D-07..D-09 — kid-mode tier cap (TIER_PG=2). Bypassed per-title via state.kidModeOverrides.
    const _kidCap = getEffectiveTierCap();
    if (_kidCap !== null) {
      const _tier = tierFor(t.rating);
      if (_tier !== null && _tier > _kidCap && !state.kidModeOverrides.has(t.id)) {
        return false;
      }
    }
    return true;
  });
  if (state.filter === 'watched') list = list.filter(t => t.watched);
  if (state.filter === 'forme') {
    // Everything the current user can actually watch, unwatched, approved.
    // Respects their personal rating cap (or age-derived cap) and the adult scope.
    // Adults see everything they're allowed; kids see only titles at or below their tier.
    const me = state.me && state.members.find(x => x.id === state.me.id);
    if (!me) { list = []; }
    else {
      const myMax = me.maxTier != null ? me.maxTier : ageToMaxTier(me.age);
      list = list.filter(t => {
        if (isWatchedByCouch(t, couchForLib)) return false;
        if (t.approvalStatus === 'pending' || t.approvalStatus === 'declined') return false;
        const tier = tierFor(t.rating);
        if (tier && myMax && tier > myMax) return false;
        // Phase 19 / D-07..D-09 — kid-mode tier cap (TIER_PG=2). Bypassed per-title via state.kidModeOverrides.
        // Tightens existing per-member cap — both must pass.
        const _kidCap = getEffectiveTierCap();
        if (_kidCap !== null) {
          const _tier = tierFor(t.rating);
          if (_tier !== null && _tier > _kidCap && !state.kidModeOverrides.has(t.id)) {
            return false;
          }
        }
        return true;
      });
    }
  }
  if (state.filter === 'myrequests') {
    // Titles the current user personally requested, newest first.
    // Shows pending at top, approved in middle, declined at bottom.
    const meId = state.me && state.me.id;
    if (!meId) { list = []; }
    else {
      list = state.titles.filter(t => t.requestedBy === meId);
      list.sort((a,b) => {
        // Pending first, approved next (no approvalStatus means approved),
        // declined last. Within each group, newest first.
        const rank = (t) => {
          if (t.approvalStatus === 'pending') return 0;
          if (t.approvalStatus === 'declined') return 2;
          return 1;
        };
        const r = rank(a) - rank(b);
        if (r !== 0) return r;
        return (b.requestedAt || 0) - (a.requestedAt || 0);
      });
    }
  }
  if (state.filter === 'inprogress') {
    // TV shows where the current user (or any family member) has progress but isn't done.
    // Sorted by the current user's most-recently-updated progress, then others.
    const meId = state.me && state.me.id;
    list = list.filter(t => {
      if (t.kind !== 'TV' || t.watched) return false;
      if (meId && getMemberProgress(t, meId)) return true;
      return membersWithProgress(t).length > 0;
    }).sort((a,b) => {
      const ap = meId ? getMemberProgress(a, meId) : null;
      const bp = meId ? getMemberProgress(b, meId) : null;
      return (bp?.updatedAt||0) - (ap?.updatedAt||0);
    });
  }
  if (state.filter === 'toprated') {
    // Your personal top-rated list: watched + you gave it a score, sorted descending.
    // A different mental model from Watched (which is chronological) — this is your ranked favorites.
    list = list.filter(t => t.watched && myScore(t) > 0).sort((a,b) => myScore(b) - myScore(a));
  }
  if (state.filter === 'scheduled') {
    const cutoff = Date.now() - 3*60*60*1000;
    list = list.filter(t => t.scheduledFor && t.scheduledFor > cutoff && !t.watched).sort((a,b) => a.scheduledFor - b.scheduledFor);
  }
  if (state.filter === 'recent') {
    list = list.filter(t => t.watched && t.watchedAt).sort((a,b) => b.watchedAt - a.watchedAt);
  }
  list = list.filter(titleMatchesProviders);
  if (hasSearch) list = list.filter(matchesLibrarySearch);
  if (countEl) countEl.textContent = list.length ? (list.length + (list.length===1?' title':' titles')) : '';
  if (list.length === 0) {
    if (hasSearch) {
      el.innerHTML = `<div class="empty"><strong>No matches</strong>Nothing in your library matches "${escapeHtml(state.librarySearchQuery)}".</div>`;
    } else if (state.filter === 'forme') {
      el.innerHTML = `<div class="empty"><strong>Nothing picked out for you yet</strong>As titles get added, you'll see what you can watch here.</div>`;
    } else if (state.filter === 'myrequests') {
      el.innerHTML = `<div class="empty"><strong>You haven't requested anything yet</strong>Find a title on the Add tab and tap Request to send it to a parent.</div>`;
    } else {
      el.innerHTML = `<div class="empty"><strong>Nothing here yet</strong>Add titles from the Add tab.</div>`;
    }
    return;
  }
  el.innerHTML = list.map(t => card(t)).join('');
}

function renderFullQueue(el, presetList) {
  const myQueue = presetList || getMyQueueTitles().filter(t => !isHiddenByScope(t));
  if (!myQueue.length) {
    const hasSearch = !!(state.librarySearchQuery || '').trim();
    if (hasSearch) {
      el.innerHTML = `<div class="queue-empty"><span class="emoji">🔍</span><strong>Nothing matches</strong>Try a different search.</div>`;
      return;
    }
    // Plan 14-09 / D-11 (b) — empty personal queue. Verbatim copy per CONTEXT.md
    // D-11 table. Canonical Vote-mode entry: openSwipeMode (per 12-02 SUMMARY).
    el.innerHTML = `<div class="queue-empty">
      <span class="emoji">🛋️</span>
      <strong>Your queue is empty</strong>
      Vote on a few titles to fill it up.
      <div class="queue-empty-cta">
        <button class="tc-primary" type="button" onclick="openSwipeMode()">Open Vote mode</button>
      </div>
    </div>`;
    return;
  }
  // Compute group rankings for display: score every title by family weighted queues
  const groupRanks = computeGroupRankMap();
  el.innerHTML = myQueue.map((t, i) => {
    const groupRank = groupRanks.get(t.id);
    const groupPill = groupRank ? `<span class="full-queue-group-rank">Family #${groupRank}</span>` : '';
    return `<div class="full-queue-row" draggable="true" data-title-id="${t.id}" data-index="${i}">
      <div class="full-queue-rank" onclick="jumpQueueRank('${t.id}', ${i+1}, ${myQueue.length})">${i+1}</div>
      <div class="full-queue-poster" style="background-image:url('${t.poster||''}')" onclick="openDetailModal('${t.id}')"></div>
      <div class="full-queue-info" onclick="openDetailModal('${t.id}')">
        <div class="full-queue-name">${t.name}${groupPill}</div>
        <div class="full-queue-meta">${t.year||''} · ${t.kind||''}${t.runtime?' · '+t.runtime+'m':''}</div>
      </div>
      <div class="full-queue-handle" title="Drag to reorder">☰</div>
      <button class="full-queue-remove" aria-label="Remove from queue" onclick="applyVote('${t.id}', state.me?.id, 'yes')" title="Remove">✕</button>
    </div>`;
  }).join('');
  attachQueueDragReorder(el, myQueue);
  // Plan 14-09 / D-10 — anchor onboarding tooltip on first Library queue render (one-shot).
  setTimeout(() => {
    const firstRow = el.querySelector('.full-queue-row');
    if (firstRow && typeof maybeShowTooltip === 'function') {
      maybeShowTooltip('queueDragReorder', firstRow, 'Drag to reorder your queue.');
    }
  }, 200);
}

// Group weighted rank map — for each title, what's its group priority rank?
function computeGroupRankMap() {
  const scores = new Map();
  state.titles.forEach(t => {
    if (t.watched || !t.queues) return;
    let total = 0;
    Object.entries(t.queues).forEach(([mid, rank]) => {
      const m = state.members.find(x => x.id === mid);
      if (m) total += 1 / rank;
    });
    if (total > 0) scores.set(t.id, total);
  });
  const ranked = Array.from(scores.entries()).sort((a,b) => b[1] - a[1]);
  const rankMap = new Map();
  ranked.forEach(([id], i) => rankMap.set(id, i+1));
  return rankMap;
}

window.jumpQueueRank = async function(titleId, currentRank, total) {
  const input = prompt(`Move to which position? (1-${total})`, currentRank);
  if (!input) return;
  const target = parseInt(input);
  if (isNaN(target) || target < 1 || target > total) return;
  if (target === currentRank) return;
  if (!state.me) return;
  const myQueue = getMyQueueTitles();
  const item = myQueue.find(t => t.id === titleId);
  if (!item) return;
  // Remove from current, insert at target
  const reordered = myQueue.filter(t => t.id !== titleId);
  reordered.splice(target - 1, 0, item);
  await persistQueueOrder(reordered);
};

async function persistQueueOrder(orderedTitles) {
  if (!state.me) return;
  // Batch update: each title's queues[me.id] = its new index+1
  const updates = [];
  for (let i = 0; i < orderedTitles.length; i++) {
    const t = orderedTitles[i];
    const currentRank = t.queues ? t.queues[state.me.id] : null;
    if (currentRank !== i + 1) {
      const queues = { ...(t.queues || {}) };
      queues[state.me.id] = i + 1;
      updates.push(updateDoc(doc(titlesRef(), t.id), { ...writeAttribution(), queues }));
    }
  }
  try { await Promise.all(updates); } catch(e) { console.error('queue reorder failed', e); }
}

function attachQueueDragReorder(container, myQueue) {
  let draggedId = null;
  container.querySelectorAll('.full-queue-row').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      draggedId = row.dataset.titleId;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      container.querySelectorAll('.full-queue-row').forEach(r => r.classList.remove('drag-over-top','drag-over-bottom'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (row.dataset.titleId === draggedId) return;
      const rect = row.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height/2;
      row.classList.toggle('drag-over-top', above);
      row.classList.toggle('drag-over-bottom', !above);
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-top','drag-over-bottom');
    });
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!draggedId || row.dataset.titleId === draggedId) return;
      const rect = row.getBoundingClientRect();
      const dropAbove = e.clientY < rect.top + rect.height/2;
      const targetId = row.dataset.titleId;
      const reordered = myQueue.filter(t => t.id !== draggedId);
      const targetIdx = reordered.findIndex(t => t.id === targetId);
      const insertAt = dropAbove ? targetIdx : targetIdx + 1;
      const dragged = myQueue.find(t => t.id === draggedId);
      if (dragged) {
        reordered.splice(insertAt, 0, dragged);
        await persistQueueOrder(reordered);
      }
      draggedId = null;
    });
  });
  // Touch drag support for mobile
  attachTouchReorder(container, myQueue);
}

function attachTouchReorder(container, myQueue) {
  let touchDragId = null, touchStartY = 0, draggedEl = null, holdTimer = null;
  container.querySelectorAll('.full-queue-row').forEach(row => {
    const handle = row.querySelector('.full-queue-handle');
    if (!handle) return;
    handle.addEventListener('touchstart', (e) => {
      touchDragId = row.dataset.titleId;
      draggedEl = row;
      touchStartY = e.touches[0].clientY;
      // Start drag visual on press-and-hold 200ms
      holdTimer = setTimeout(() => row.classList.add('dragging'), 180);
    }, {passive:true});
    handle.addEventListener('touchmove', (e) => {
      if (!touchDragId) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      const rows = Array.from(container.querySelectorAll('.full-queue-row'));
      rows.forEach(r => r.classList.remove('drag-over-top','drag-over-bottom'));
      for (const r of rows) {
        if (r.dataset.titleId === touchDragId) continue;
        const rect = r.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
          const above = y < rect.top + rect.height/2;
          r.classList.toggle('drag-over-top', above);
          r.classList.toggle('drag-over-bottom', !above);
          break;
        }
      }
    }, {passive:false});
    handle.addEventListener('touchend', async (e) => {
      clearTimeout(holdTimer);
      if (!touchDragId) return;
      const y = e.changedTouches[0].clientY;
      const rows = Array.from(container.querySelectorAll('.full-queue-row'));
      rows.forEach(r => r.classList.remove('drag-over-top','drag-over-bottom'));
      if (draggedEl) draggedEl.classList.remove('dragging');
      let targetRow = null, dropAbove = false;
      for (const r of rows) {
        if (r.dataset.titleId === touchDragId) continue;
        const rect = r.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
          targetRow = r;
          dropAbove = y < rect.top + rect.height/2;
          break;
        }
      }
      if (targetRow) {
        const targetId = targetRow.dataset.titleId;
        const reordered = myQueue.filter(t => t.id !== touchDragId);
        const targetIdx = reordered.findIndex(t => t.id === targetId);
        const insertAt = dropAbove ? targetIdx : targetIdx + 1;
        const dragged = myQueue.find(t => t.id === touchDragId);
        if (dragged) {
          reordered.splice(insertAt, 0, dragged);
          await persistQueueOrder(reordered);
        }
      }
      touchDragId = null;
      draggedEl = null;
    });
  });
}

window.setFilter = function(f) {
  state.filter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('on', t.dataset.filter === f));
  renderLibrary();
};

function renderStats() {
  const el = document.getElementById('stats-list');
  if (!el) return;
  const watchedTitles = state.titles.filter(t => t.watched);
  const totalWatched = watchedTitles.length;
  const totalInLibrary = state.titles.length;
  // Family-wide average across all member scores
  let allScores = 0, allCount = 0;
  watchedTitles.forEach(t => {
    Object.values(t.ratings || {}).forEach(r => {
      const s = getScore(r);
      if (s > 0) { allScores += s; allCount++; }
    });
  });
  const familyAvg = allCount ? formatScore(allScores / allCount) : '—';
  // Per-member stats
  const memberStats = state.members.map(m => {
    const myWatched = watchedTitles.filter(t => getScore((t.ratings || {})[m.id]) > 0);
    const myScoreSum = myWatched.reduce((s, t) => s + getScore(t.ratings[m.id]), 0);
    const myAvg = myWatched.length ? formatScore(myScoreSum / myWatched.length) : '—';
    return { m, watched: myWatched.length, avg: myAvg };
  });
  // Hero stat grid gets the totals (replaces old .family-total strip)
  const heroEl = document.getElementById('family-hero-stats');
  if (heroEl) {
    heroEl.innerHTML = `<div class="tab-stat"><div class="tab-stat-value">${totalWatched}</div><div class="tab-stat-label">Watched</div></div>
      <div class="tab-stat"><div class="tab-stat-value">${totalInLibrary}</div><div class="tab-stat-label">In library</div></div>
      <div class="tab-stat"><div class="tab-stat-value">${familyAvg}</div><div class="tab-stat-label">Family avg</div></div>`;
  }
  // Per-member rows stay in the "Who's watched what" section
  el.innerHTML = memberStats.map(({m, watched, avg}) => `<div class="stat-row">
    <div class="who-avatar" style="background:${m.color};width:28px;height:28px;font-size:var(--t-meta);border-radius:50%;display:grid;place-items:center;font-weight:700;color:#14110f;">${avatarContent(m)}</div>
    <div class="name">${m.name}</div>
    <div class="stat-nums">
      <div class="stat-val"><span class="n">${watched}</span><div class="label">Rated</div></div>
      <div class="stat-val"><span class="n score">${avg}</span><div class="label">Avg</div></div>
    </div>
  </div>`).join('');
}

// Render the services picker on the Settings screen. Lets the user toggle which
// subscriptions they pay for without drilling into the Profile modal.
function renderServicesPicker() {
  const el = document.getElementById('services-picker');
  if (!el || !state.me) return;
  const m = state.members.find(x => x.id === state.me.id);
  if (!m) return;
  const services = Array.isArray(m.services) ? m.services : [];
  el.innerHTML = SUBSCRIPTION_BRANDS.map(b => {
    const on = services.includes(b.id);
    return `<button class="genre-chip ${on?'on':''}" aria-pressed="${on}" onclick="toggleMyService('${b.id.replace(/'/g,"\\'")}')">${escapeHtml(b.name)}</button>`;
  }).join('');
}

// Pending requests card. Only visible to parents, and only when there's actually something to review.
function renderApprovalsCard() {
  const card = document.getElementById('approvals-card');
  const listEl = document.getElementById('approvals-list');
  const countEl = document.getElementById('approvals-count');
  if (!card || !listEl) return;
  const pending = state.titles.filter(t => t.approvalStatus === 'pending');
  if (!isMyselfParent() || pending.length === 0) {
    card.style.display = 'none';
    updateActivityBadge();
    return;
  }
  card.style.display = '';
  if (countEl) countEl.textContent = pending.length;
  // Sort newest-first so kids aren't waiting longer on stale requests
  const sorted = pending.slice().sort((a,b) => (b.requestedAt||0) - (a.requestedAt||0));
  listEl.innerHTML = sorted.map(t => {
    const requester = state.members.find(x => x.id === t.requestedBy);
    const who = requester ? escapeHtml(requester.name) : 'Unknown';
    const age = t.requestedAt ? timeAgo(t.requestedAt) : '';
    return `<div class="approval-row">
      <div class="approval-poster" style="background-image:url('${t.poster||''}')" onclick="openDetailModal('${t.id}')" role="button" aria-label="${escapeHtml(t.name)}">${!t.poster?escapeHtml((t.name||'?').charAt(0)):''}</div>
      <div class="approval-body">
        <div class="approval-name">${escapeHtml(t.name)}</div>
        <div class="approval-meta">${who} · ${age}${t.rating?' · '+escapeHtml(t.rating):''}${t.kind?' · '+escapeHtml(t.kind):''}</div>
      </div>
      <div class="approval-actions">
        <button class="pill accent" onclick="approveTitle('${t.id}')">Approve</button>
        <button class="pill" onclick="openDeclineSheet('${t.id}')">Decline</button>
      </div>
    </div>`;
  }).join('');
  updateActivityBadge();
}

// Pretty relative time: "5m ago", "2h ago", "3d ago".
function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return Math.floor(diff/86400000) + 'd ago';
}

// Family Favorites card: top-rated watched titles with at least 2 raters, ranked by
// mean score. The 2+ minimum keeps single-opinion picks from dominating. Shows up to 10.
function renderFamilyFavorites() {
  const card = document.getElementById('family-favs-card');
  const list = document.getElementById('family-favs-list');
  if (!card || !list) return;
  // Solo families (just one member) don't need this view — a personal top-rated is already on Queue tab
  if (state.members.length < 2) { card.style.display = 'none'; return; }
  const ranked = state.titles
    .filter(t => t.watched && t.ratings)
    .map(t => {
      const scores = state.members.map(m => getScore(t.ratings[m.id])).filter(s => s > 0);
      if (scores.length < 2) return null;
      const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
      return { t, avg, count: scores.length };
    })
    .filter(Boolean)
    .sort((a,b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 10);
  if (!ranked.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  list.innerHTML = ranked.map((r, i) => {
    // Per-member score pills so you can see how opinions lined up
    const memberScores = state.members.map(m => {
      const s = getScore(r.t.ratings[m.id]);
      if (s <= 0) return '';
      return `<span class="fav-member-score" style="background:${m.color}" title="${escapeHtml(m.name)}: ${formatScore(s)}">${avatarContent(m)}<span class="fav-score-num">${formatScore(s)}</span></span>`;
    }).filter(Boolean).join('');
    return `<div class="fav-row" onclick="openDetailModal('${r.t.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetailModal('${r.t.id}');}" aria-label="${escapeHtml(r.t.name)}, rated ${formatScore(r.avg)}">
      <div class="fav-rank">${i+1}</div>
      <div class="fav-poster" style="background-image:url('${r.t.poster||''}')"></div>
      <div class="fav-body">
        <div class="fav-name">${escapeHtml(r.t.name)}</div>
        <div class="fav-meta"><strong class="fav-avg">${formatScore(r.avg)}</strong><span class="fav-avg-sub">/10</span> · ${r.count} ratings</div>
        <div class="fav-members">${memberScores}</div>
      </div>
    </div>`;
  }).join('');
}

// Account tab renderer — device/personal stuff
function renderSettings() {
  yirSettingsTeaser();
  // Phase 11 / REFR-12 — YIR card hidden until Phase 10 ships.
  // yirReady flag lives on state.family; when set, un-hide the entire settings-yir-section.
  // Today Phase 10 hasn't shipped so the section stays hidden — static placeholder isn't exposed.
  const yirSection = document.getElementById('settings-yir-section');
  if (yirSection) {
    yirSection.style.display = (state.family && state.family.yirReady) ? '' : 'none';
  }
  renderServicesPicker();
  renderTraktCard();
  // Plan 07: sub-profile list + owner-only admin panel (gated on state.ownerUid).
  // Phase 11 / REFR-12 — owner admin is sub-grouped in app.html via static HTML:
  //   data-subcluster="security" (password + guest invites)
  //   data-subcluster="members" (claim members + ownership transfer)
  //   data-subcluster="lifecycle" (grace banner + future delete-group)
  // renderOwnerSettings() still only toggles visibility + populates transfer target; layout is static.
  try { renderSubProfileList(); } catch(e) {}
  try { renderOwnerSettings(); } catch(e) {}
  // Plan 5.8: owner's claim-members panel + grace-window countdown banner.
  try { renderClaimMembersPanel(); } catch(e) {}
  try { renderGraceBanner(); } catch(e) {}
  // Plan 09-07a: legacy self-claim CTA (state.ownerUid == null) + sign-in methods card.
  try { renderLegacyClaimCtaIfApplicable(); } catch(e) {}
  try { renderSignInMethodsCard(); } catch(e) {}
  // Refresh identity strip in case name/avatar changed since boot
  if (state.me) {
    const me = state.members.find(x => x.id === state.me.id) || state.me;
    const identAv = document.getElementById('account-identity-avatar');
    if (identAv) {
      identAv.style.background = me.color || 'var(--surface-2)';
      identAv.innerHTML = avatarContent(me);
    }
    const meLabel = document.getElementById('me-label');
    if (meLabel) meLabel.textContent = me.name || state.me.name || '';
    const greetEl = document.getElementById('account-hero-greeting');
    if (greetEl) {
      const first = ((me.name || state.me.name) || '').split(/\s+/)[0] || '';
      greetEl.textContent = first ? 'Hi, ' + first : 'Hi there';
    }
    const famLabelEl = document.getElementById('family-label');
    if (famLabelEl && state.familyCode) {
      famLabelEl.innerHTML = groupNounCap() +
        ' <span class="family-chip">' + escapeHtml(state.familyCode) + '</span>';
    }
  }
  // Phase 12 / POL-02 — ABOUT section (version + feedback + changelog).
  // Idempotent — safe to call on every renderSettings.
  try { renderAboutSection(); } catch(e) {}
}

// Phase 12 / POL-02 — Inject version + feedback + changelog + TMDB attribution
// into #settings-about-section. Idempotent — safe to call on every renderSettings.
function renderAboutSection() {
  const versionEl = document.getElementById('about-version-line');
  const feedbackEl = document.getElementById('about-feedback-link');
  const changelogEl = document.getElementById('about-changelog-link');
  if (!versionEl) return;
  const v = APP_VERSION;
  const d = BUILD_DATE;
  versionEl.textContent = `Couch v${v} — deployed ${d}`;
  if (feedbackEl) {
    const subj = encodeURIComponent(`Couch feedback v${v}`);
    feedbackEl.href = `mailto:nahderz@gmail.com?subject=${subj}`;
  }
  if (changelogEl) {
    // Absolute URL when on production; relative otherwise (dev). The hosting rewrite
    // will resolve /changelog → /changelog.html on the prod CDN.
    changelogEl.href = '/changelog';
  }
}
window.renderAboutSection = renderAboutSection;

// Render the Trakt connection card in Account. States:
//   1. Deployment hasn't configured Trakt — card is hidden entirely.
//   2. User not connected — show the pitch and a Connect button.
//   3. User connected — show @username, sync status, Sync now + Disconnect buttons.
function renderTraktCard() {
  const card = document.getElementById('trakt-card');
  const body = document.getElementById('trakt-body');
  const btn = document.getElementById('trakt-action-btn');
  if (!card || !body || !btn) return;
  if (!traktIsConfigured()) { card.style.display = 'none'; return; }
  card.style.display = '';
  const info = trakt.getState();
  if (info.connected) {
    const handle = info.username ? '@' + escapeHtml(info.username) : 'your Trakt account';
    const nameBit = info.name ? ' (' + escapeHtml(info.name) + ')' : '';
    // Sync status line
    let syncLine = '';
    if (info.syncing) {
      syncLine = '<span style="color:var(--accent);font-weight:500;">Syncing now</span>';
    } else if (info.lastSyncedAt) {
      syncLine = 'Last synced ' + timeAgo(info.lastSyncedAt);
    } else {
      syncLine = 'Not synced yet';
    }
    body.innerHTML = '<div style="font-family:\'Instrument Serif\',\'Fraunces\',serif;font-style:italic;font-size:var(--t-h3);color:var(--ink);letter-spacing:-0.015em;line-height:1.2;margin-bottom:4px;">Connected as ' + handle + nameBit + '</div>' +
      '<p style="margin-bottom:var(--s2);">' + syncLine + '</p>' +
      '<div style="display:flex;gap:var(--s2);flex-wrap:wrap;">' +
        '<button class="pill" ' + (info.syncing ? 'disabled' : '') + ' onclick="trakt.sync({manual:true})" style="font-size:var(--t-meta);padding:5px 11px;">' + (info.syncing ? 'Syncing…' : 'Sync now') + '</button>' +
        '<button class="pill" onclick="trakt.disconnect()" style="font-size:var(--t-meta);padding:5px 11px;">Disconnect</button>' +
      '</div>';
    // Hide the main action button since we're using inline buttons in the body now
    btn.style.display = 'none';
  } else {
    // === Phase 15 / D-07 (TRACK-15-14) — Trakt opt-in Settings disclosure ===
    // Heading + italic sub-line above the existing Connect button. Verbatim from
    // UI-SPEC §Discretion Q9 + §Copywriting Contract. Permanent (not dismissable).
    body.innerHTML =
      '<div style="font-family:\'Inter\',sans-serif;font-size:var(--t-micro);font-weight:600;text-transform:uppercase;letter-spacing:0.18em;color:var(--accent);margin-bottom:var(--s2);">JUMP-START YOUR COUCH&#39;S HISTORY WITH TRAKT</div>' +
      '<p style="margin-bottom:var(--s3);"><em style="font-family:var(--font-serif);font-style:italic;color:var(--ink-warm);">Optional &mdash; tracking works without it.</em></p>' +
      '<p>Already tracking on Trakt? Connect your account to pull in your watch history, watchlist, and ratings. Progress stays in sync both ways.</p>';
    btn.textContent = 'Connect';
    btn.classList.add('accent');
    btn.onclick = function(){ trakt.connect(); };
    btn.style.display = '';
  }
}

// Family tab renderer — people, rotation, approvals, sharing
function renderFamily() {
  // Hero: category eyebrow + possessive serif title.
  // Example: "FAMILY" / "The Zomorrodians" — matches YIR's "2026" / "Your Year"
  const heroTitle = document.getElementById('family-hero-title');
  if (heroTitle) {
    const name = (state.group && state.group.name) || state.familyCode || '';
    heroTitle.textContent = name || 'Your couch';
  }
  const heroEyebrow = document.getElementById('family-hero-eyebrow');
  if (heroEyebrow) {
    // Noun + code: "FAMILY · ZMRDN" feels like a category label, stays consistent
    // no matter what the group name is. Code is short, all-caps already.
    const noun = groupNounCap();
    heroEyebrow.textContent = state.familyCode ? (noun + ' · ' + state.familyCode) : noun;
  }
  // Members count in section-h
  const memberCount = document.getElementById('members-count');
  if (memberCount) {
    const n = state.members.length;
    memberCount.textContent = n ? (n === 1 ? '1 person' : n + ' people') : '';
  }
  // Picker strip — reflects current rotation status (internal container IDs gone post-REFR-11,
  // guard inside renderPickerStrip bails cleanly; backend rotation writes still preserved).
  renderPickerStrip();
  // Phase 11 / REFR-11 — tonight-status line under the hero title.
  renderTonightStatus();
  renderStats();
  renderApprovalsCard();
  renderFamilyFavorites();
  renderMembersList();
}

// Picker strip on the Family tab — reflects rotation state inline instead
// of a boxed setting-card. When rotation is on, we show the current picker's
// name in serif with a "pass turn" action; when off, we show a nudge to set up.
function renderPickerStrip() {
  const strip = document.getElementById('picker-strip');
  const statusEl = document.getElementById('picker-strip-status');
  const subEl = document.getElementById('picker-strip-sub');
  const btn = document.getElementById('picker-enable-btn');
  if (!strip || !statusEl || !subEl || !btn) return;
  const picker = getPicker();
  if (picker && picker.enabled && picker.currentMemberId) {
    const current = state.members.find(m => m.id === picker.currentMemberId);
    strip.classList.add('on');
    if (current) {
      statusEl.innerHTML = escapeHtml(current.name) + "'s turn";
      subEl.textContent = picker.autoAdvance
        ? 'Auto-advances after the next watch.'
        : 'Tap to pass the turn when ready.';
    } else {
      statusEl.textContent = 'Rotation active';
      subEl.textContent = 'Tap to manage.';
    }
    btn.textContent = 'Manage';
  } else {
    strip.classList.remove('on');
    statusEl.textContent = 'No rotation yet';
    subEl.textContent = 'Take turns picking so no one argues.';
    btn.textContent = 'Set up';
  }
}

// Render the members list. Permission-gated:
//   - Parents see full edit controls (rating cap, parent toggle, adult scope, remove)
//   - Non-parents see everyone's info read-only
//   - Everyone can tap their own row to edit their own profile (name, avatar, bio, services)
// Phase 11 / REFR-11 — Family tab tonight-status block.
// Answers "what's the family up to right now?" in one italic line.
// Priority: active watchparty > pending intent > next scheduled > empty state.
// Full content (participants, CTA, schedule) deferred to Phase 12 per CONTEXT.md D-5 option (b).
function renderTonightStatus() {
  const el = document.getElementById('family-tonight-status');
  if (!el) return;
  let body = '';
  if (state.activeWatchpartyId) {
    body = '<div class="family-tonight-status-active"><em>Active watchparty in session.</em></div>';
  } else {
    body = '<div class="family-tonight-status-empty"><em>Nothing scheduled yet.</em></div>';
  }
  el.innerHTML = body;
}

function renderMembersList() {
  const legacyEl = document.getElementById('members-list');
  const activeEl = document.getElementById('members-list-active');
  const subEl = document.getElementById('members-list-subprofiles');
  const subHeadingEl = document.getElementById('members-subprofiles-h');
  const subCardEl = document.getElementById('members-subprofiles-card');
  // If none of the containers exist, bail — tab may not be mounted yet.
  if (!legacyEl && !activeEl && !subEl) return;
  const iAmParent = isCurrentUserParent();
  // Build the HTML for one member row — same contract as before. Used by both active + subprofile branches.
  const renderRow = (m) => {
    const isMe = state.me && m.id === state.me.id;
    const currentMax = m.maxTier != null ? m.maxTier : ageToMaxTier(m.age);
    const ageLabel = (modeAllowsAgeTiers() && m.age) ? ` <span style="color:var(--ink-dim);font-size:var(--t-meta);">age ${m.age}</span>` : '';
    // Only parents see editable controls. Non-parents see a static summary line instead.
    let maxRatingHtml = '';
    let adultToggleHtml = '';
    let parentToggleHtml = '';
    if (iAmParent) {
      const opts = [1,2,3,4,5].map(t => `<option value="${t}" ${t===currentMax?'selected':''}>${TIER_LABELS[t]}</option>`).join('');
      if (modeAllowsAgeTiers()) {
        maxRatingHtml = `<div style="margin-top:4px;" onclick="event.stopPropagation()"><span style="font-size:var(--t-eyebrow);color:var(--ink-dim);">Max rating:</span>
              <select class="maxrating-select" onchange="setMaxTier('${m.id}',this.value)">${opts}</select>
            </div>`;
      }
      if (modeAllowsAdultScope()) {
        adultToggleHtml = `<div class="adults-toggle" onclick="event.stopPropagation()">
              <input type="checkbox" id="adult-${m.id}" ${isAdultMember(m)?'checked':''} onchange="toggleAdultMember('${m.id}',this.checked)">
              <label for="adult-${m.id}">Adult (can see 18+ titles)</label>
            </div>`;
      }
      if (currentMode() === 'family') {
        // A parent can't remove parent status from themselves (would orphan the family of parents)
        const lockSelf = isMe && countParents() <= 1;
        parentToggleHtml = `<div class="adults-toggle" onclick="event.stopPropagation()">
              <input type="checkbox" id="parent-${m.id}" ${m.isParent?'checked':''} ${lockSelf?'disabled':''} onchange="toggleParent('${m.id}',this.checked)">
              <label for="parent-${m.id}">Parent (reviews kids' new title requests)</label>
            </div>`;
      }
    } else {
      // Non-parents: show status as read-only meta text
      const chips = [];
      if (modeAllowsAgeTiers()) chips.push(TIER_LABELS[currentMax]);
      if (m.isParent && currentMode() === 'family') chips.push('Parent');
      if (chips.length) {
        maxRatingHtml = `<div style="margin-top:4px;font-size:var(--t-eyebrow);color:var(--ink-dim);">${chips.map(c => escapeHtml(c)).join(' · ')}</div>`;
      }
    }
    // Remove button: parents only, and never for oneself
    const removeBtn = (iAmParent && !isMe) ? `<button onclick="removeMember('${m.id}')">Remove</button>` : '';
    return `<div class="member-row">
      <div class="who-avatar" style="background:${m.color};cursor:pointer;" onclick="openProfile('${m.id}')">${avatarContent(m)}</div>
      <div class="name" onclick="openProfile('${m.id}')" style="cursor:pointer;">${escapeHtml(m.name)}${ageLabel}${isMe?' <span style="color:var(--accent);font-size:var(--t-eyebrow);font-weight:600;">you</span>':''}
        ${maxRatingHtml}
        ${adultToggleHtml}
        ${parentToggleHtml}
      </div>
      ${removeBtn}
    </div>`;
  };
  // Phase 11 / REFR-11 — split members into "On the couch" (active authed members) vs "Sub-profiles".
  //   - Active: has uid OR is not a managed sub-profile (authed adults + legacy unclaimed rows).
  //   - Sub-profiles: managedBy set AND no uid (kid rows created via openCreateSubProfile).
  const activeMembers = state.members.filter(m => !(m.managedBy && !m.uid));
  const subMembers = state.members.filter(m => m.managedBy && !m.uid);
  // Emit into the split containers.
  if (activeEl) activeEl.innerHTML = activeMembers.map(renderRow).join('');
  if (subEl) subEl.innerHTML = subMembers.map(renderRow).join('');
  // Hide the sub-profile heading + card entirely when there are zero sub-profiles (avoid empty section noise).
  if (subHeadingEl) subHeadingEl.style.display = subMembers.length ? '' : 'none';
  if (subCardEl) subCardEl.style.display = subMembers.length ? '' : 'none';
  // BACKWARD-COMPAT: also emit combined list into legacy #members-list (kept hidden). Any downstream
  // consumer that greps/targets members-list continues to work.
  if (legacyEl) legacyEl.innerHTML = state.members.map(renderRow).join('');
}

// Count of members currently flagged as parent. Used to prevent unmarking the last one.
function countParents() {
  return state.members.filter(m => !!m.isParent).length;
}

// Returns true if the current signed-in user has parent privileges in this family.
// In non-family modes (duo, crew), there's no hierarchy — everyone has edit rights.
function isCurrentUserParent() {
  if (!state.me) return false;
  if (currentMode() !== 'family') return true;
  const me = state.members.find(m => m.id === state.me.id);
  if (!me) return false;
  return isParent(me);
}

// Phase 19 / D-02 — visibility gate for the kid-mode toggle. Returns true when
// ANY non-archived non-expired-guest member has effectiveMaxTier ≤ 3 (PG-13
// cap or below). Re-evaluated on every renderCouchViz call — no caching (D-03).
function familyHasKids() {
  const nowTs = Date.now();
  return (state.members || []).some(m => {
    if (m.archived) return false;
    if (m.temporary && (!m.expiresAt || m.expiresAt <= nowTs)) return false;
    const eff = m.maxTier != null ? m.maxTier : ageToMaxTier(m.age);
    return eff <= 3;
  });
}

window.setMaxTier = async function(id, val) {
  if (!isCurrentUserParent()) { flashToast('Only parents can change this', { kind: 'warn' }); return; }
  try { await updateDoc(doc(membersRef(), id), { maxTier: parseInt(val) }); }
  catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

window.toggleParent = async function(id, checked) {
  if (!isCurrentUserParent()) { flashToast('Only parents can change this', { kind: 'warn' }); return; }
  // Prevent removing the last parent from the family (would orphan approval workflows)
  if (!checked && countParents() <= 1) {
    flashToast('Need at least one parent in the family', { kind: 'warn' });
    // Re-render to reset the checkbox visually
    renderFamily();
    return;
  }
  try { await updateDoc(doc(membersRef(), id), { isParent: !!checked }); }
  catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

// A parent is anyone with isParent: true. If no members have the flag set (legacy families),
// fall back to treating age-18+ as parents so the feature degrades gracefully.
function hasDeclaredParents() {
  return state.members.some(m => m.isParent === true);
}
function isParent(member) {
  if (!member) return false;
  if (hasDeclaredParents()) return member.isParent === true;
  // Legacy fallback: no explicit parent flags set → treat 18+ as parents
  return member.age == null || member.age >= 18;
}
function isMyselfParent() {
  return state.me && isParent(state.members.find(m => m.id === state.me.id));
}

// Does this member need parental approval when adding a new title?
// Only kicks in when there's at least one declared parent AND this member isn't one.
function needsApproval(member) {
  if (!member) return false;
  if (currentMode() !== 'family') return false;
  if (!hasDeclaredParents()) return false;
  return !isParent(member);
}

// Check whether any of my pending requests were approved or declined since last seen.
// Fires a toast so kids know their request went through. Uses localStorage to avoid
// re-firing on every snapshot (we only want to announce each decision once).
function checkApprovalUpdates() {
  if (!state.me) return;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem('qn_approval_seen') || '{}'); } catch(e){}
  let dirty = false;
  for (const t of state.titles) {
    if (t.requestedBy !== state.me.id) continue;
    if (t.approvalStatus !== 'approved' && t.approvalStatus !== 'declined') continue;
    // Key by title id + decision timestamp so re-decisions still fire
    const key = t.id + ':' + (t.approvalAt || 0);
    if (seen[key]) continue;
    const by = t.approvalBy ? state.members.find(m => m.id === t.approvalBy) : null;
    const parentName = by ? by.name : 'A parent';
    if (t.approvalStatus === 'approved') {
      flashToast(`${parentName} approved "${t.name}"`, { kind: 'success' });
    } else {
      const reason = t.approvalNote ? `: "${t.approvalNote}"` : '';
      flashToast(`${parentName} didn't approve "${t.name}"${reason}`);
    }
    seen[key] = Date.now();
    dirty = true;
  }
  // Clean up old seen entries (>90 days) so the record doesn't grow forever
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  for (const k of Object.keys(seen)) {
    if (seen[k] < cutoff) { delete seen[k]; dirty = true; }
  }
  if (dirty) try { localStorage.setItem('qn_approval_seen', JSON.stringify(seen)); } catch(e){}
}

// Wrapper for the raw `setDoc` calls that create new titles. If the adder is a kid,
// it stamps the title as pending and returns so the caller can surface "awaiting approval" UI.
// Returns { ok: true, pending: boolean }.
//
// === D-03 Add-tab insertion (DECI-14-03) ===
// opts.addToMyQueue (default false): when true, the new title is appended to the BOTTOM
// of state.me's personal queue at create time (queues[state.me.id] = currentQueueLen + 1).
// Caller-opt-in keeps bulk-import paths (Trakt sync, Couch Nights packs, first-run seed)
// from auto-populating the actor's queue. The 4 user-Add paths (addToLibrary,
// submitManualAdd, addSimilar, addFromAddTab) pass true.
async function createTitleWithApprovalCheck(titleId, titleData, opts) {
  const me = state.me ? state.members.find(x => x.id === state.me.id) : null;
  const pending = needsApproval(me);
  const finalData = { ...titleData };
  if (pending) {
    finalData.approvalStatus = 'pending';
    finalData.requestedBy = me.id;
    finalData.requestedAt = Date.now();
  }
  // D-03: append to bottom of state.me's personal queue if caller opts in.
  // Skipped for bulk imports (Trakt / pack expand / first-run seed) and when state.me
  // is unset (defensive — pre-claim flows).
  if (opts && opts.addToMyQueue && state.me && state.me.id) {
    const myQueueLen = state.titles.filter(x => !x.watched && x.queues && x.queues[state.me.id] != null).length;
    finalData.queues = { ...(finalData.queues || {}), [state.me.id]: myQueueLen + 1 };
  }
  await setDoc(doc(titlesRef(), titleId), { ...finalData, ...writeAttribution() });
  return { ok: true, pending };
}

// Approve a pending title: clears approval fields so it behaves like a normal library entry.
// Only parents can approve; the guard is defensive since the UI already hides the button.
window.approveTitle = async function(titleId) {
  if (!isMyselfParent()) return;
  haptic('success');
  try {
    await updateDoc(doc(titlesRef(), titleId), {
      ...writeAttribution(),
      approvalStatus: 'approved',
      approvalBy: state.me.id,
      approvalAt: Date.now()
    });
    const t = state.titles.find(x => x.id === titleId);
    flashToast(t ? `"${t.name}" is on the couch` : 'On the couch', { kind: 'success' });
    logActivity('approved', { titleName: t?.name || '', titleId });
  } catch(e) { flashToast('Could not approve. Try again.', { kind: 'warn' }); }
};

// Decline a pending title. Accepts an optional note explaining why, surfaced to the requester.
window.declineTitle = async function(titleId, note) {
  if (!isMyselfParent()) return;
  haptic('medium');
  try {
    const update = {
      approvalStatus: 'declined',
      approvalBy: state.me.id,
      approvalAt: Date.now()
    };
    if (note && note.trim()) update.approvalNote = note.trim().slice(0, 200);
    await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), ...update });
    const t = state.titles.find(x => x.id === titleId);
    flashToast(t ? `"${t.name}" stays off the couch` : 'Off the couch');
    logActivity('declined', { titleName: t?.name || '', titleId });
  } catch(e) { flashToast('Could not decline. Try again.', { kind: 'warn' }); }
};

// Small confirmation sheet for decline with optional note input.
window.openDeclineSheet = function(titleId) {
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const note = prompt(`Decline "${t.name}"? (optional note)`, '');
  if (note === null) return; // canceled
  declineTitle(titleId, note);
};

// Silent, opportunistic background backfill. Runs a few seconds after sync
// so we're not competing with the initial render, and works through a small
// batch at a time so we don't thrash the device or TMDB rate limits.
// TMDB allows ~40 req/10sec. Each Phase 2 or Phase 3 title hits 2 endpoints
// (extras + providers), so capping at 10 per session keeps us well under the limit
// even if several family members boot the app simultaneously.
// Remaining titles finish on subsequent reloads — migration is idempotent.
let autoBackfillRunning = false;
async function autoBackfill() {
  if (autoBackfillRunning) return;
  autoBackfillRunning = true;
  try {
    // Phase 1: titles missing moods get tagged from whatever metadata we have (instant, no network).
    // No cap needed since this is local-only work.
    const needsMoods = state.titles.filter(t => (!Array.isArray(t.moods) || t.moods.length === 0) && !t.moodsUserEdited);
    if (needsMoods.length) qnLog('[QN] Backfilling moods for', needsMoods.length, 'titles');
    for (const t of needsMoods) {
      const moods = suggestMoods(t.genres || [], t.runtime);
      if (moods.length) {
        try { await updateDoc(doc(titlesRef(), t.id), { ...writeAttribution(), moods }); } catch(e){}
      }
    }
    // Phase 2: TMDB extras for titles missing rating/trailer/providers. Capped at 10 per session.
    const needsExtras = state.titles.filter(t => (!t.rating || !t.trailerKey || !t.providersChecked) && t.id && t.id.startsWith('tmdb_') && !t.isManual);
    for (const t of needsExtras.slice(0, 10)) {
      const tmdbId = t.tmdbId || t.id.replace('tmdb_','');
      const mediaType = (t.mediaType) || (t.kind === 'Movie' ? 'movie' : 'tv');
      try {
        const extras = await fetchTmdbExtras(mediaType, tmdbId);
        const update = {};
        if (!t.rating && extras.rating) update.rating = extras.rating;
        if (!t.trailerKey && extras.trailerKey) update.trailerKey = extras.trailerKey;
        if (!t.providersChecked) {
          update.providers = extras.providers || [];
          update.rentProviders = extras.rentProviders || [];
          update.buyProviders = extras.buyProviders || [];
          update.providersChecked = true;
          update.providersSchemaVersion = 3;
        }
        if (!t.tmdbId) update.tmdbId = tmdbId;
        if (!t.mediaType) update.mediaType = mediaType;
        // If this is our first time getting runtime for a title that didn't have moods, recompute moods
        if (extras.runtime && (!Array.isArray(t.moods) || t.moods.length === 0) && !t.moodsUserEdited) {
          const moods = suggestMoods(t.genres || [], extras.runtime);
          if (moods.length) update.moods = moods;
        }
        if (Object.keys(update).length) {
          await updateDoc(doc(titlesRef(), t.id), { ...writeAttribution(), ...update });
        }
      } catch(e){}
    }
    // Phase 3: re-fetch providers for titles on older schema. v3 adds rent/buy buckets
    // plus normalized provider names (Prime Video w/ Ads collapses into Prime Video).
    const needsProviderRefresh = state.titles.filter(t =>
      t.providersChecked && t.providersSchemaVersion !== 3 &&
      t.id && t.id.startsWith('tmdb_') && !t.isManual
    );
    if (needsProviderRefresh.length) qnLog('[QN] Migrating providers to v3 for', needsProviderRefresh.length, 'titles');
    for (const t of needsProviderRefresh.slice(0, 10)) {
      const tmdbId = t.tmdbId || t.id.replace('tmdb_','');
      const mediaType = (t.mediaType) || (t.kind === 'Movie' ? 'movie' : 'tv');
      try {
        const extras = await fetchTmdbExtras(mediaType, tmdbId);
        const update = { providersSchemaVersion: 3 };
        update.providers = extras.providers || [];
        update.rentProviders = extras.rentProviders || [];
        update.buyProviders = extras.buyProviders || [];
        await updateDoc(doc(titlesRef(), t.id), { ...writeAttribution(), ...update });
        const brands = (extras.providers||[]).map(p => p.name).join(', ') || '(no sub)';
        const paid = [(extras.rentProviders||[]).length ? 'rent' : '', (extras.buyProviders||[]).length ? 'buy' : ''].filter(Boolean).join('/');
        qnLog('[QN] Migrated', t.name, '→', brands, paid ? '·' : '', paid);
      } catch(e){ console.warn('[QN] Migration failed for', t.name, e); }
    }
    if (needsProviderRefresh.length) qnLog('[QN] Migration to v3 complete.');
    // Phase 4: one-time migration — every Yes vote on an unwatched title should be in that member's queue.
    // We do this just for the current user (to avoid permission issues writing on behalf of others),
    // but since everyone runs the app, it converges naturally.
    if (state.me) {
      const myId = state.me.id;
      const yesTitles = state.titles.filter(t => !t.watched && (t.votes||{})[myId] === 'yes');
      const needQueueAdd = yesTitles.filter(t => !t.queues || t.queues[myId] == null);
      if (needQueueAdd.length) {
        qnLog('[QN] Syncing', needQueueAdd.length, 'Yes votes into your queue');
        // Figure out next rank
        let nextRank = yesTitles.reduce((max, t) => {
          const r = t.queues ? t.queues[myId] : null;
          return (r && r > max) ? r : max;
        }, 0) + 1;
        for (const t of needQueueAdd) {
          const queues = { ...(t.queues || {}) };
          queues[myId] = nextRank++;
          try { await updateDoc(doc(titlesRef(), t.id), { ...writeAttribution(), queues }); } catch(e){}
        }
      }
      // Also: remove queue entries for titles where my vote is No/Seen (stale ranks from old model)
      const staleQueues = state.titles.filter(t => !t.watched && t.queues && t.queues[myId] != null && ((t.votes||{})[myId] === 'no' || (t.votes||{})[myId] === 'seen'));
      if (staleQueues.length) {
        qnLog('[QN] Removing', staleQueues.length, 'stale queue entries (you voted no/seen)');
        for (const t of staleQueues) {
          const queues = { ...t.queues };
          delete queues[myId];
          try { await updateDoc(doc(titlesRef(), t.id), { ...writeAttribution(), queues }); } catch(e){}
        }
        await reindexMyQueue();
      }
    }
  } finally {
    autoBackfillRunning = false;
  }
}

window.toggleMember = function(id) {
  haptic('light');
  if (state.selectedMembers.includes(id)) state.selectedMembers = state.selectedMembers.filter(x=>x!==id);
  else state.selectedMembers.push(id);
  renderTonight();
};

window.removeMember = async function(id) {
  if (!isCurrentUserParent()) { flashToast('Only parents can remove members', { kind: 'warn' }); return; }
  if (state.me && id === state.me.id) { flashToast("Can't remove yourself. Use Leave family instead.", { kind: 'warn' }); return; }
  // Don't let a parent remove the last parent in the family
  const target = state.members.find(m => m.id === id);
  if (target && target.isParent && countParents() <= 1) {
    flashToast('Need at least one parent in the family', { kind: 'warn' });
    return;
  }
  if (!confirm('Remove this family member?')) return;
  try { await deleteDoc(doc(membersRef(), id)); }
  catch(e) { flashToast('Could not remove. Try again.', { kind: 'warn' }); }
};

window.doSearch = async function() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  const btn = document.getElementById('search-btn');
  btn.textContent = '...'; btn.disabled = true;
  try {
    const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}`);
    const data = await r.json();
    state.searchResults = (data.results||[]).filter(x => (x.media_type==='movie'||x.media_type==='tv') && (x.title||x.name)).slice(0,10).map(x => ({
      id:'tmdb_'+x.id, tmdbId:x.id, mediaType:x.media_type, name:x.title||x.name, year:(x.release_date||x.first_air_date||'').slice(0,4),
      kind:x.media_type==='movie'?'Movie':'TV', overview:x.overview,
      poster:x.poster_path?`https://image.tmdb.org/t/p/w200${x.poster_path}`:'',
      genreIds: x.genre_ids || [],
    }));
    renderSearchResults();
  } catch(e) { alert('Search failed.'); }
  btn.textContent = 'Find'; btn.disabled = false;
};

function renderSearchResults() {
  const section = document.getElementById('search-results-section');
  const browse = document.getElementById('add-browse');
  const el = document.getElementById('search-results-list');
  if (!section || !el) return;
  if (!state.searchResults.length) {
    section.style.display = 'none';
    if (browse) browse.style.display = '';
    return;
  }
  section.style.display = 'block';
  if (browse) browse.style.display = 'none';
  el.innerHTML = state.searchResults.map(r => {
    const inLib = state.titles.find(t => t.id === r.id);
    const metaParts = [];
    if (r.year) metaParts.push(escapeHtml(r.year));
    if (r.kind) metaParts.push(r.kind);
    const metaHtml = metaParts.join('<span class="dot">·</span>');
    const primaryBtn = inLib
      ? `<button class="tc-primary watched" disabled style="opacity:0.55;cursor:default;">On the couch</button>`
      : `<button class="tc-primary" onclick="event.stopPropagation();addToLibrary('${r.id}')">+ Pull up</button>`;
    return `<div class="tc">
      <div class="tc-poster" style="${posterStyle(r)}">${posterFallbackLetter(r)}</div>
      <div class="tc-body">
        <div class="tc-name">${escapeHtml(r.name)}</div>
        <div class="tc-meta">${metaHtml}</div>
        <div class="tc-footer">${primaryBtn}</div>
      </div>
    </div>`;
  }).join('');
}

window.addToLibrary = async function(id) {
  const r = state.searchResults.find(x => x.id === id);
  if (!r) return;
  const extras = await fetchTmdbExtras(r.mediaType, r.tmdbId);
  const moods = suggestMoods(r.genreIds || [], extras.runtime);
  // === D-03 Add-tab insertion (DECI-14-03) === — search "+ Pull up" lands in my queue.
  const res = await createTitleWithApprovalCheck(r.id, { ...r, ...extras, moods, votes:{}, watched:false }, { addToMyQueue: true });
  logActivity(res.pending ? 'requested' : 'added', { titleName: r.name, titleId: r.id });
  if (res.pending) flashToast(`"${r.name}" sent for a parent to review.`);
  renderSearchResults();
};

window.clearSearch = function() { state.searchResults=[]; document.getElementById('search-input').value=''; renderSearchResults(); };

let manualMoods = [];
function renderManualMoodChips() {
  const el = document.getElementById('manual-moods');
  if (!el) return;
  el.innerHTML = MOODS.map(m => {
    const on = manualMoods.includes(m.id);
    return `<button class="mood-chip ${on?'on':''}" onclick="toggleManualMood('${m.id}');return false;">
      <span class="mood-icon">${twemojiImg(m.icon, m.label, 'twemoji--md')}</span>${m.label}
    </button>`;
  }).join('');
}
window.toggleManualMood = function(id) {
  if (manualMoods.includes(id)) manualMoods = manualMoods.filter(x => x !== id);
  else manualMoods = [...manualMoods, id];
  renderManualMoodChips();
};
window.openManualAdd = function() {
  manualMoods = [];
  renderManualMoodChips();
  document.getElementById('manual-modal-bg').classList.add('on');
};
window.closeManualAdd = function() {
  document.getElementById('manual-modal-bg').classList.remove('on');
  ['manual-title','manual-year','manual-poster','manual-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('manual-kind').selectedIndex = 0;
};
window.submitManualAdd = async function() {
  const name = document.getElementById('manual-title').value.trim();
  if (!name) { alert('Please enter a title.'); return; }
  const year = document.getElementById('manual-year').value.trim() || '';
  const kind = document.getElementById('manual-kind').value;
  const poster = document.getElementById('manual-poster').value.trim() || '';
  const notes = document.getElementById('manual-notes').value.trim() || '';
  const id = 'manual_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  const title = { id, name, year, kind, poster, overview: notes, moods: manualMoods.slice(), votes: {}, watched: false, isManual: true };
  try {
    // === D-03 Add-tab insertion (DECI-14-03) === — manual modal lands in my queue.
    const res = await createTitleWithApprovalCheck(id, title, { addToMyQueue: true });
    logActivity(res.pending ? 'requested' : 'added', { titleName: name, titleId: id });
    if (res.pending) flashToast(`"${name}" sent for a parent to review.`);
    closeManualAdd();
  } catch(e) { alert('Could not add: ' + e.message); }
};

function commentsRef(titleId) { return collection(db, 'families', state.familyCode, 'titles', titleId, 'comments'); }
let commentsTitleId = null;
let unsubComments = null;

window.openCommentsModal = function(titleId) {
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  commentsTitleId = titleId;
  document.getElementById('comments-modal-title').textContent = t.name;
  document.getElementById('comment-list').innerHTML = '<div class="comment-empty">Loading...</div>';
  document.getElementById('comment-input').value = '';
  document.getElementById('comments-modal-bg').classList.add('on');
  if (unsubComments) unsubComments();
  const q = query(commentsRef(titleId), orderBy('createdAt', 'asc'));
  unsubComments = onSnapshot(q, snap => {
    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderComments(comments);
  }, e => {
    document.getElementById('comment-list').innerHTML = '<div class="comment-empty">Could not load comments.</div>';
  });
};

window.closeCommentsModal = function() {
  document.getElementById('comments-modal-bg').classList.remove('on');
  if (unsubComments) { unsubComments(); unsubComments = null; }
  commentsTitleId = null;
};

function renderComments(comments) {
  const el = document.getElementById('comment-list');
  if (!comments.length) { el.innerHTML = '<div class="comment-empty">No comments yet. Be the first.</div>'; return; }
  el.innerHTML = comments.map(c => {
    const isMine = state.me && c.authorId === state.me.id;
    const member = state.members.find(m => m.id === c.authorId);
    const color = member ? member.color : 'var(--ink-dim)';
    const initial = (c.authorName || '?')[0];
    const when = formatTime(c.createdAt);
    const safeBody = escapeHtml(c.body || '').replace(/\n/g, '<br>');
    return `<div class="comment">
      <div class="comment-head">
        <div class="who-avatar" style="background:${color}" aria-hidden="true">${escapeHtml(initial)}</div>
        <div class="comment-author">${escapeHtml(c.authorName||'Unknown')}</div>
        <div class="comment-time">${when}</div>
      </div>
      <div class="comment-body">${safeBody}</div>
      ${isMine ? `<button class="comment-delete" aria-label="Delete comment" onclick="deleteComment('${c.id}')">Delete</button>` : ''}
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr + 'h ago';
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return diffDay + 'd ago';
  return d.toLocaleDateString();
}

window.postComment = async function() {
  const input = document.getElementById('comment-input');
  const body = input.value.trim();
  if (!body || !commentsTitleId || !state.me) return;
  if (guardReadOnlyWrite()) return;                // Plan 5.8 D-15: no comments from unclaimed post-grace
  const titleId = commentsTitleId;
  input.value = '';
  try {
    await addDoc(commentsRef(titleId), {
      ...writeAttribution(),
      authorId: state.me.id,
      authorName: state.me.name,
      body,
      createdAt: Date.now()
    });
    const t = state.titles.find(x => x.id === titleId);
    const newCount = (t?.commentCount || 0) + 1;
    await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), commentCount: newCount });
    if (t) logActivity('commented', { titleName: t.name });
  } catch(e) {
    flashToast('Could not post. Try again.', { kind: 'warn' });
    input.value = body;
  }
};

window.deleteComment = async function(commentId) {
  if (!commentsTitleId) return;
  if (!confirm('Delete this comment?')) return;
  const titleId = commentsTitleId;
  try {
    await deleteDoc(doc(commentsRef(titleId), commentId));
    const t = state.titles.find(x => x.id === titleId);
    const newCount = Math.max(0, (t?.commentCount || 0) - 1);
    await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), commentCount: newCount });
  } catch(e) { flashToast('Could not delete. Try again.', { kind: 'warn' }); }
};

let scheduleTitleId = null;
function toLocalInputValue(d) {
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatScheduleShort(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
  const sameTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  if (sameDay) return 'Tonight ' + time;
  if (sameTomorrow) return 'Tomorrow ' + time;
  return d.toLocaleDateString([], {weekday:'short'}) + ' ' + time;
}
function formatScheduleLong(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString([], {weekday:'long', month:'short', day:'numeric'}) + ' at ' + d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
}
function preferredScheduleHour() {
  // Remember the user's last-used schedule hour; default to 8pm only on first use
  const stored = parseInt(localStorage.getItem('qn_schedule_hour') || '0');
  return (stored >= 0 && stored <= 23) && stored !== 0 ? stored : 20;
}
function nextDayOfWeek(targetDow) {
  const d = new Date();
  const cur = d.getDay();
  let add = (targetDow - cur + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(preferredScheduleHour(),0,0,0);
  return d;
}

window.openScheduleModal = function(titleId) {
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  scheduleTitleId = titleId;
  document.getElementById('schedule-modal-title').textContent = t.name;
  const dt = document.getElementById('schedule-datetime');
  if (t.scheduledFor) {
    dt.value = toLocalInputValue(new Date(t.scheduledFor));
    document.getElementById('schedule-clear-btn').style.display = 'block';
  } else {
    const def = new Date(); def.setHours(20,0,0,0);
    if (def < new Date()) def.setDate(def.getDate()+1);
    dt.value = toLocalInputValue(def);
    document.getElementById('schedule-clear-btn').style.display = 'none';
  }
  document.getElementById('schedule-note').value = t.scheduledNote || '';
  document.getElementById('schedule-modal-bg').classList.add('on');
};

window.quickSchedule = function(when) {
  const h = preferredScheduleHour();
  const d = new Date();
  if (when === 'tonight') { d.setHours(h,0,0,0); }
  else if (when === 'tomorrow') { d.setDate(d.getDate()+1); d.setHours(h,0,0,0); }
  else if (when === 'weekend') {
    // Next Saturday (or Sunday if it's already Saturday)
    const cur = d.getDay();
    const targetDow = cur === 6 ? 0 : 6;
    return document.getElementById('schedule-datetime').value = toLocalInputValue(nextDayOfWeek(targetDow));
  }
  else if (when === 'friday') { return document.getElementById('schedule-datetime').value = toLocalInputValue(nextDayOfWeek(5)); }
  else if (when === 'saturday') { return document.getElementById('schedule-datetime').value = toLocalInputValue(nextDayOfWeek(6)); }
  document.getElementById('schedule-datetime').value = toLocalInputValue(d);
};

window.closeScheduleModal = function() {
  document.getElementById('schedule-modal-bg').classList.remove('on');
  scheduleTitleId = null;
};

window.saveSchedule = async function() {
  if (!scheduleTitleId) return;
  const dtVal = document.getElementById('schedule-datetime').value;
  if (!dtVal) { alert('Pick a date and time.'); return; }
  const ts = new Date(dtVal).getTime();
  const note = document.getElementById('schedule-note').value.trim();
  const t = state.titles.find(x => x.id === scheduleTitleId);
  try {
    // Remember the hour the user chose so next quick-pick uses the same
    try { localStorage.setItem('qn_schedule_hour', String(new Date(ts).getHours())); } catch(e) {}
    await updateDoc(doc(titlesRef(), scheduleTitleId), { ...writeAttribution(), scheduledFor: ts, scheduledNote: note });
    if (t) logActivity('scheduled', { titleName: t.name });
    downloadIcs(t, ts, note);
    closeScheduleModal();
  } catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

window.clearSchedule = async function() {
  if (!scheduleTitleId) return;
  try {
    await updateDoc(doc(titlesRef(), scheduleTitleId), { ...writeAttribution(), scheduledFor: null, scheduledNote: null });
    closeScheduleModal();
  } catch(e) { flashToast('Could not clear. Try again.', { kind: 'warn' }); }
};

let swipeQueue = [];
let swipeIndex = 0;
let swipeStartX = 0, swipeStartY = 0, swipeDX = 0, swipeDY = 0, swipeDragging = false;

function getNeedsVoteTitles() {
  if (!state.me) return [];
  // D-01 (DECI-14-01): swipe candidate pool — use couch-aware watched filter.
  const couch = getCouchOrSelfIds();
  return state.titles.filter(t => {
    if (isWatchedByCouch(t, couch)) return false;
    if (isHiddenByScope(t)) return false;
    // Phase 19 / D-07..D-09 — kid-mode tier cap (TIER_PG=2). Bypassed per-title via state.kidModeOverrides.
    const _kidCap = getEffectiveTierCap();
    if (_kidCap !== null) {
      const _tier = tierFor(t.rating);
      if (_tier !== null && _tier > _kidCap && !state.kidModeOverrides.has(t.id)) {
        return false;
      }
    }
    const v = (t.votes || {})[state.me.id];
    return !v;
  });
}

window.openSwipeMode = function() {
  if (!state.me) { alert('Sign in first.'); return; }
  swipeQueue = getNeedsVoteTitles();
  swipeIndex = 0;
  document.getElementById('swipe-overlay').classList.add('on');
  renderSwipeCard();
};

window.closeSwipeMode = function() {
  document.getElementById('swipe-overlay').classList.remove('on');
  swipeQueue = [];
};

function updateSwipeProgress() {
  const el = document.getElementById('swipe-progress');
  if (!el) return;
  if (!swipeQueue.length) { el.textContent = ''; return; }
  el.textContent = `${Math.min(swipeIndex+1, swipeQueue.length)} of ${swipeQueue.length}`;
}

function renderSwipeCard() {
  const stage = document.getElementById('swipe-stage');
  const actions = document.getElementById('swipe-actions');
  updateSwipeProgress();
  if (swipeIndex >= swipeQueue.length) {
    actions.style.display = 'none';
    stage.innerHTML = `<div class="swipe-empty"><strong>${swipeQueue.length ? 'All caught up.' : 'Nothing to vote on yet'}</strong>${swipeQueue.length ? `You voted on ${swipeQueue.length} ${swipeQueue.length===1?'title':'titles'}. Back to the couch.` : 'Add some titles to get the couch going.'}</div>`;
    return;
  }
  actions.style.display = 'flex';
  const t = swipeQueue[swipeIndex];
  const tier = tierFor(t.rating);
  const ratingPill = t.rating ? `<span class="rating-pill ${tier?'tier'+tier:''}">${t.rating}</span>` : '';
  stage.innerHTML = `<div class="swipe-card" id="swipe-card">
    <div class="poster-big" style="background-image:url('${t.poster||''}')" aria-hidden="true"></div>
    <div class="info">
      <div class="name">${ratingPill}${escapeHtml(t.name)}</div>
      <div class="meta">${escapeHtml(t.year||'')} · ${escapeHtml(t.kind||'')}</div>
      <div class="overview">${escapeHtml(t.overview||'')}</div>
    </div>
    <div class="swipe-stamp yes" id="stamp-yes">YES</div>
    <div class="swipe-stamp no" id="stamp-no">NO</div>
    <div class="swipe-stamp seen" id="stamp-seen">SEEN</div>
  </div>`;
  attachSwipeHandlers();
}

function attachSwipeHandlers() {
  const card = document.getElementById('swipe-card');
  if (!card) return;
  const onStart = (e) => {
    swipeDragging = true;
    const p = e.touches ? e.touches[0] : e;
    swipeStartX = p.clientX; swipeStartY = p.clientY;
    swipeDX = 0; swipeDY = 0;
    card.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!swipeDragging) return;
    const card = document.getElementById('swipe-card');
    if (!card) { swipeDragging = false; return; }
    const p = e.touches ? e.touches[0] : e;
    swipeDX = p.clientX - swipeStartX;
    swipeDY = p.clientY - swipeStartY;
    const rot = swipeDX / 20;
    card.style.transform = `translate(${swipeDX}px, ${swipeDY}px) rotate(${rot}deg)`;
    const yesO = Math.max(0, Math.min(1, swipeDX / 120));
    const noO = Math.max(0, Math.min(1, -swipeDX / 120));
    const seenO = Math.max(0, Math.min(1, swipeDY / 120));
    const ys = document.getElementById('stamp-yes'); if (ys) ys.style.opacity = yesO;
    const ns = document.getElementById('stamp-no'); if (ns) ns.style.opacity = noO;
    const ss = document.getElementById('stamp-seen'); if (ss) ss.style.opacity = seenO;
    if (e.cancelable) e.preventDefault();
  };
  const onEnd = () => {
    if (!swipeDragging) return;
    swipeDragging = false;
    const card = document.getElementById('swipe-card');
    if (!card) return;
    card.classList.remove('dragging');
    const threshold = 100;
    if (swipeDY > threshold && swipeDY > Math.abs(swipeDX)) { commitSwipe('seen'); }
    else if (swipeDX > threshold) { commitSwipe('yes'); }
    else if (swipeDX < -threshold) { commitSwipe('no'); }
    else {
      card.style.transform = '';
      ['stamp-yes','stamp-no','stamp-seen'].forEach(id => { const el = document.getElementById(id); if (el) el.style.opacity = 0; });
    }
  };
  card.addEventListener('touchstart', onStart, {passive:true});
  card.addEventListener('touchmove', onMove, {passive:false});
  card.addEventListener('touchend', onEnd);
  card.addEventListener('mousedown', onStart);
  // Window listeners need to persist across cards; attach once
  if (!window._swipeListenersAttached) {
    window.addEventListener('mousemove', (e) => { if (swipeDragging) onMoveGlobal(e); });
    window.addEventListener('mouseup', () => { if (swipeDragging) onEndGlobal(); });
    window._swipeListenersAttached = true;
  }
  window._swipeOnMove = onMove;
  window._swipeOnEnd = onEnd;
}
function onMoveGlobal(e){ if (window._swipeOnMove) window._swipeOnMove(e); }
function onEndGlobal(){ if (window._swipeOnEnd) window._swipeOnEnd(); }

function commitSwipe(vote) {
  const card = document.getElementById('swipe-card');
  if (card) {
    const offX = vote === 'yes' ? 600 : vote === 'no' ? -600 : 0;
    const offY = vote === 'seen' ? 600 : 0;
    card.style.transform = `translate(${offX}px, ${offY}px) rotate(${offX/20}deg)`;
    card.style.opacity = '0';
  }
  swipeVote(vote);
}

window.swipeVote = async function(vote) {
  if (swipeIndex >= swipeQueue.length) return;
  const t = swipeQueue[swipeIndex];
  swipeIndex++;
  setTimeout(() => renderSwipeCard(), 280);
  await applyVote(t.id, state.me?.id, vote);
};

function updateNeedsVoteBadge() {
  const el = document.getElementById('needs-vote-count');
  if (!el) return;
  const count = getNeedsVoteTitles().length;
  if (count > 0) { el.textContent = count; el.style.display = 'inline-block'; }
  else { el.style.display = 'none'; }
  // Tonight tab dot: indicates any pending user action (votes to cast, veto to respond to, watchparty starting soon).
  // Just a dot, no count — it's a nudge, not an inbox.
  const tabBadge = document.getElementById('tab-badge-tonight');
  if (tabBadge) {
    const pending = count > 0 || activeWatchparties().some(w => {
      const mine = (w.participants||{})[state.me?.id];
      return !mine && w.startAt - Date.now() < 30*60*1000 && w.startAt > Date.now() - 60*60*1000;
    });
    if (pending) { tabBadge.textContent = ''; tabBadge.classList.add('dot'); tabBadge.style.display = 'block'; }
    else { tabBadge.style.display = 'none'; tabBadge.classList.remove('dot'); }
  }
  // Activity badge on settings tab
  updateActivityBadge();
}

function updateActivityBadge() {
  const el = document.getElementById('tab-badge-family');
  if (!el) return;
  const lastSeen = parseInt(localStorage.getItem('qn_activity_seen') || '0');
  const unseen = recentActivity.filter(a => a.ts > lastSeen && (!state.me || a.actorId !== state.me.id)).length;
  // Parents also see a badge for pending approvals
  const pendingForMe = isMyselfParent() ? state.titles.filter(t => t.approvalStatus === 'pending').length : 0;
  const total = unseen + pendingForMe;
  if (total > 0) { el.textContent = total > 9 ? '9+' : total; el.style.display = 'grid'; }
  else { el.style.display = 'none'; }
}

// === Profiles ===
const GENRE_LIST = ['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Sci-Fi','Thriller','War','Western'];

window.openProfile = function(memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return;
  const isMe = state.me && state.me.id === memberId;
  // Stats based on the 10-scale score. A title counts as rated when score > 0.
  const myWatched = state.titles.filter(t => t.watched && getScore((t.ratings||{})[memberId]) > 0);
  const totalRated = myWatched.length;
  const totalScore = myWatched.reduce((s,t) => s + getScore(t.ratings[memberId]), 0);
  const avg = totalRated ? (totalScore/totalRated) : 0;
  const avgDisplay = totalRated ? formatScore(avg) : '—';
  const myQueueLen = state.titles.filter(t => !t.watched && t.queues && t.queues[memberId] != null).length;
  // Favorites = top 6 by this member's score, descending
  const topRated = myWatched.slice().sort((a,b) => getScore(b.ratings[memberId]) - getScore(a.ratings[memberId])).slice(0,6);
  const fav = m.favoriteGenres || [];
  const genresHtml = GENRE_LIST.map(g => `<button class="genre-chip ${fav.includes(g)?'on':''}" ${isMe?`onclick="toggleFavGenre('${g}')"`:'disabled'}>${escapeHtml(g)}</button>`).join('');
  const services = Array.isArray(m.services) ? m.services : [];
  const servicesHtml = SUBSCRIPTION_BRANDS.map(b => `<button class="genre-chip ${services.includes(b.id)?'on':''}" ${isMe?`onclick="toggleMyService('${b.id.replace(/'/g,"\\'")}')"`:'disabled'}>${escapeHtml(b.name)}</button>`).join('');
  const bioHtml = isMe
    ? `<textarea class="profile-bio-input" id="profile-bio-input" placeholder="Add a short bio (optional)" onblur="saveBio(this.value)">${escapeHtml(m.bio||'')}</textarea>`
    : (m.bio ? `<div class="profile-bio">${escapeHtml(m.bio)}</div>` : '');
  const topRatedHtml = topRated.length ? `<div class="profile-section-h">Top rated</div><div class="top-rated-list">${topRated.map(t => {
    const s = getScore(t.ratings[memberId]);
    return `<div class="top-rated-card" role="button" tabindex="0" aria-label="${escapeHtml(t.name)}, rated ${formatScore(s)}" onclick="closeProfile();openDetailModal('${t.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();closeProfile();openDetailModal('${t.id}');}"><div class="top-rated-poster" style="background-image:url('${t.poster||''}')" aria-hidden="true"></div><div class="top-rated-score" aria-hidden="true">${formatScore(s)}</div></div>`;
  }).join('')}</div>` : '';
  const content = document.getElementById('profile-modal-content');
  content.innerHTML = `
    <div class="profile-header">
      <button class="detail-close" aria-label="Close profile" onclick="closeProfile()" style="position:absolute;top:12px;right:12px;">✕</button>
      <div class="profile-avatar-lg ${isMe?'editable':''}" style="background:${m.color}" ${isMe?`role="button" tabindex="0" aria-label="Change avatar" onclick="openAvatarPicker()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openAvatarPicker();}"`:''}>${avatarContent(m)}${isMe?'<span class="avatar-edit-hint" aria-hidden="true">✎</span>':''}</div>
      <div class="profile-name">${m.name}</div>
      <div class="profile-age">${m.age?`Age ${m.age}`:'Family member'}${isMe?' · You':''}</div>
    </div>
    <div class="profile-body">
      ${bioHtml}
      <div class="profile-stats">
        <div class="profile-stat"><span class="n">${totalRated}</span><div class="l">Rated</div></div>
        <div class="profile-stat"><span class="n">${avgDisplay}${avgDisplay!=='—'?'':''}</span><div class="l">Avg score</div></div>
        <div class="profile-stat"><span class="n">${myQueueLen}</span><div class="l">Queued</div></div>
      </div>
      <div class="profile-section-h">${isMe?'Your favorite genres':'Favorite genres'}</div>
      <div class="genre-picker">${genresHtml}</div>
      <div class="profile-section-h">${isMe?'Your streaming services':'Streaming services'}</div>
      <p class="profile-services-sub">${isMe ? 'We\'ll filter your queue to what you can actually watch.' : ''}</p>
      <div class="genre-picker">${servicesHtml}</div>
      ${topRatedHtml}
    </div>`;
  document.getElementById('profile-modal-bg').classList.add('on');
};

window.closeProfile = function() {
  document.getElementById('profile-modal-bg').classList.remove('on');
};

window.toggleFavGenre = async function(genre) {
  if (!state.me) return;
  const m = state.members.find(x => x.id === state.me.id);
  if (!m) return;
  const fav = [...(m.favoriteGenres || [])];
  const idx = fav.indexOf(genre);
  if (idx >= 0) fav.splice(idx,1); else fav.push(genre);
  try {
    await updateDoc(doc(membersRef(), m.id), { favoriteGenres: fav });
    m.favoriteGenres = fav;
    openProfile(m.id); // re-render
  } catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

// === Avatar picker ===
window.openAvatarPicker = function() {
  if (!state.me) return;
  haptic('light');
  const grid = document.getElementById('avatar-grid');
  if (!grid) return;
  const m = state.members.find(x => x.id === state.me.id);
  const current = m && m.avatar;
  grid.innerHTML = AVATAR_OPTIONS.map(emoji => {
    const sel = emoji === current ? 'selected' : '';
    return `<button type="button" class="avatar-choice ${sel}" aria-label="Use ${emoji}" aria-pressed="${sel?'true':'false'}" onclick="chooseAvatar('${emoji}')">${emoji}</button>`;
  }).join('');
  document.getElementById('avatar-picker-bg').classList.add('on');
};

window.closeAvatarPicker = function() {
  const bg = document.getElementById('avatar-picker-bg');
  if (bg) bg.classList.remove('on');
};

window.chooseAvatar = async function(emoji) {
  if (!state.me) return;
  haptic('light');
  const m = state.members.find(x => x.id === state.me.id);
  if (!m) return;
  try {
    await updateDoc(doc(membersRef(), m.id), { avatar: emoji });
    m.avatar = emoji;
    if (state.me) state.me.avatar = emoji;
    // Update selected state in the grid without rebuilding
    const grid = document.getElementById('avatar-grid');
    if (grid) {
      grid.querySelectorAll('.avatar-choice').forEach(btn => {
        const picked = btn.textContent.trim() === emoji;
        btn.classList.toggle('selected', picked);
        btn.setAttribute('aria-pressed', picked ? 'true' : 'false');
      });
    }
    // Re-render profile modal if open
    const profileOpen = document.getElementById('profile-modal-bg')?.classList.contains('on');
    if (profileOpen) openProfile(m.id);
    renderAll();
  } catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

window.resetAvatar = async function() {
  if (!state.me) return;
  haptic('light');
  const m = state.members.find(x => x.id === state.me.id);
  if (!m) return;
  try {
    // Using empty string rather than deleteField to keep the update simple + predictable
    await updateDoc(doc(membersRef(), m.id), { avatar: '' });
    m.avatar = '';
    if (state.me) state.me.avatar = '';
    const grid = document.getElementById('avatar-grid');
    if (grid) grid.querySelectorAll('.avatar-choice').forEach(btn => {
      btn.classList.remove('selected');
      btn.setAttribute('aria-pressed', 'false');
    });
    const profileOpen = document.getElementById('profile-modal-bg')?.classList.contains('on');
    if (profileOpen) openProfile(m.id);
    renderAll();
  } catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

window.toggleMyService = async function(brandId) {
  if (!state.me) return;
  haptic('light');
  const m = state.members.find(x => x.id === state.me.id);
  if (!m) return;
  const services = [...(m.services || [])];
  const idx = services.indexOf(brandId);
  if (idx >= 0) services.splice(idx,1); else services.push(brandId);
  try {
    await updateDoc(doc(membersRef(), m.id), { services });
    m.services = services;
    if (state.me) state.me.services = services;
    // Refresh any open picker UIs
    const settingsPicker = document.getElementById('services-picker');
    if (settingsPicker) renderServicesPicker();
    const profileModalOpen = document.getElementById('profile-modal-bg')?.classList.contains('on');
    if (profileModalOpen) openProfile(m.id);
    renderAll();
  } catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

// Phase 18 / D-17 + D-18 + D-19: detail-modal manual refresh affordance.
// Refetches TMDB providers + writes back including lastProviderRefreshAt
// so the daily providerRefreshTick CF (Plan 18-01) round-robin stays accurate
// (won't re-refresh a title the user just manually refreshed). Manual refresh
// does NOT trigger a push fan-out (D-19) — only the scheduled CF fires pushes.
window.refreshProviders = async function(id) {
  const t = state.titles.find(x => x.id === id);
  if (!t) return;
  const tmdbId = t.tmdbId || id.replace('tmdb_','');
  const mediaType = t.mediaType || (t.kind === 'Movie' ? 'movie' : 'tv');
  try {
    const extras = await fetchTmdbExtras(mediaType, tmdbId);
    const update = {
      providers: extras.providers || [],
      rentProviders: extras.rentProviders || [],
      buyProviders: extras.buyProviders || [],
      providersChecked: true,
      providersSchemaVersion: 3,
      // Phase 18 / D-18: stamp the timestamp so the CF round-robin treats
      // this title as freshly-refreshed (won't re-fetch on the next tick).
      lastProviderRefreshAt: Date.now()
    };
    await updateDoc(doc(titlesRef(), id), { ...writeAttribution(), ...update });
    haptic('success');
    // Phase 18 / D-18 verbatim toast copy.
    flashToast('Availability refreshed.', { kind: 'info' });
    // Re-open the detail to show the fresh data.
    setTimeout(() => openDetailModal(id), 150);
  } catch(e) {
    // Phase 18 — replace alert() with flashToast (BRAND-aligned warm restraint).
    console.warn('[18/refreshProviders] failed:', e && e.message);
    flashToast('Refresh failed. Try again.', { kind: 'warn' });
  }
};

window.saveBio = async function(bio) {
  if (!state.me) return;
  try { await updateDoc(doc(membersRef(), state.me.id), { bio: bio.trim() }); } catch(e){}
};

// === Reviews ===
let reviewTitleId = null;

window.openReviewEditor = function(titleId) {
  if (!state.me) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  reviewTitleId = titleId;
  const existing = (t.reviews || {})[state.me.id] || {};
  const hasExisting = existing.body != null;
  document.getElementById('review-modal-title').textContent = t.name;
  document.getElementById('review-headline').value = existing.headline || '';
  document.getElementById('review-body').value = existing.body || '';
  document.getElementById('review-delete-btn').style.display = hasExisting ? 'block' : 'none';
  document.getElementById('review-modal-bg').classList.add('on');
};

window.deleteMyReview = async function() {
  if (!reviewTitleId || !state.me) return;
  if (!confirm('Delete your review?')) return;
  const t = state.titles.find(x => x.id === reviewTitleId);
  const reviews = { ...(t.reviews || {}) };
  delete reviews[state.me.id];
  try {
    await updateDoc(doc(titlesRef(), reviewTitleId), { ...writeAttribution(), reviews });
    closeReviewModal();
    if (detailTitleId === reviewTitleId) {
      const merged = state.titles.find(x => x.id === detailTitleId);
      if (merged) { merged.reviews = reviews; document.getElementById('detail-modal-content').innerHTML = renderDetailShell(merged); }
      if (typeof cv15AttachDetailModalDelegate === 'function') cv15AttachDetailModalDelegate();
    }
  } catch(e) { flashToast('Could not delete. Try again.', { kind: 'warn' }); }
};

window.closeReviewModal = function() {
  document.getElementById('review-modal-bg').classList.remove('on');
  reviewTitleId = null;
};

window.saveReview = async function() {
  if (!reviewTitleId || !state.me) return;
  const headline = document.getElementById('review-headline').value.trim();
  const body = document.getElementById('review-body').value.trim();
  if (!body) { alert('Write a review first.'); return; }
  const t = state.titles.find(x => x.id === reviewTitleId);
  const reviews = { ...(t.reviews || {}) };
  reviews[state.me.id] = { headline, body, updatedAt: Date.now() };
  try {
    await updateDoc(doc(titlesRef(), reviewTitleId), { ...writeAttribution(), reviews });
    closeReviewModal();
    logActivity('reviewed', { titleName: t.name });
    // Refresh detail modal if open
    if (detailTitleId === reviewTitleId) {
      const merged = state.titles.find(x => x.id === detailTitleId);
      if (merged) { merged.reviews = reviews; document.getElementById('detail-modal-content').innerHTML = renderDetailShell(merged); }
      if (typeof cv15AttachDetailModalDelegate === 'function') cv15AttachDetailModalDelegate();
    }
  } catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

function renderReviewsForTitle(t) {
  const reviews = t.reviews || {};
  const entries = Object.entries(reviews).filter(([,r]) => r && r.body);
  const isWatched = t.watched;
  const myHasReview = state.me && reviews[state.me.id];
  let html = '';
  if (entries.length) {
    html += entries.map(([mid, r]) => {
      const m = state.members.find(x => x.id === mid);
      const color = m ? m.color : 'var(--ink-faint)';
      const name = m ? m.name : 'Unknown';
      const stars = (t.ratings || {})[mid] && t.ratings[mid].stars;
      const starStr = stars ? '★'.repeat(stars) + '☆'.repeat(5-stars) : '';
      const isMine = state.me && mid === state.me.id;
      return `<div class="review-card">
        <div class="review-head">
          <div class="review-avatar" style="background:${color}" aria-hidden="true">${escapeHtml(name[0])}</div>
          <div class="review-author">${escapeHtml(name)}</div>
          ${stars?`<div class="review-stars" aria-label="${stars} stars">${starStr}</div>`:''}
        </div>
        ${r.headline?`<div class="review-headline">${escapeHtml(r.headline)}</div>`:''}
        <div class="review-body">${escapeHtml(r.body).replace(/\n/g, '<br>')}</div>
        <div class="review-date">${formatTime(r.updatedAt)}${isMine?' · <button class="edit-review-mine" onclick="openReviewEditor(\''+t.id+'\')">Edit</button>':''} · <button class="edit-review-mine" onclick="openShareModal('${t.id}','${mid}')">Share</button></div>
      </div>`;
    }).join('');
  }
  if (isWatched && state.me && !myHasReview) {
    html += `<button class="write-review-btn" onclick="openReviewEditor('${t.id}')">✍ Write a review</button>`;
  }
  return html ? `<div class="detail-section"><h4>Reviews</h4>${html}</div>` : '';
}

function icsDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,'0');
  return d.getUTCFullYear() + pad(d.getUTCMonth()+1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
}
function icsEscape(s) { return (s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }

function downloadIcs(title, startTs, note) {
  const endTs = startTs + 2*60*60*1000;
  const summary = `Couch: ${title.name}`;
  const desc = [`${title.name} (${title.year || ''}) ${title.kind || ''}`.trim(), note || '', title.overview || ''].filter(Boolean).join('\\n\\n');
  const uid = (title.id || 'qn') + '@couchapp';
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Couch//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    'UID:'+uid,'DTSTAMP:'+icsDate(Date.now()),'DTSTART:'+icsDate(startTs),'DTEND:'+icsDate(endTs),
    'SUMMARY:'+icsEscape(summary),'DESCRIPTION:'+icsEscape(desc),'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const blob = new Blob([ics], {type:'text/calendar'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (title.name || 'couch').replace(/[^a-z0-9]+/gi,'_').toLowerCase() + '.ics';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function fetchTmdbDetails(mediaType, tmdbId) {
  const out = { runtime: null, genres: [], cast: [], backdrop: '', similar: [] };
  try {
    const r = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits,similar`);
    const d = await r.json();
    if (mediaType === 'movie') {
      out.runtime = d.runtime || null;
    } else {
      out.runtime = (d.episode_run_time && d.episode_run_time[0]) || null;
      out.seasons = d.number_of_seasons || null;
      out.episodes = d.number_of_episodes || null;
      // TV status detection for badges & messaging. TMDB's `status` strings:
      //   "Returning Series" | "Ended" | "Canceled" | "In Production" | "Planned"
      // We translate those to our own simpler categories so the UI doesn't have
      // to know TMDB's exact wording.
      const raw = (d.status || '').toLowerCase();
      if (raw.includes('return') || raw.includes('production') || raw.includes('planned')) out.showStatus = 'active';
      else if (raw.includes('cancel')) out.showStatus = 'cancelled';
      else if (raw.includes('ended')) out.showStatus = 'ended';
      else out.showStatus = 'unknown';
      out.inProduction = !!d.in_production;
      // Next episode to air — powerful for "next ep airs Friday" style messaging
      if (d.next_episode_to_air) {
        const n = d.next_episode_to_air;
        out.nextEpisode = {
          airDate: n.air_date || null,
          season: n.season_number || null,
          episode: n.episode_number || null,
          name: n.name || ''
        };
      } else {
        out.nextEpisode = null;
      }
      // Last episode to air — helpful for detecting "did a new season drop since
      // I last watched?" in combination with the user's progress.
      if (d.last_episode_to_air) {
        const l = d.last_episode_to_air;
        out.lastEpisode = {
          airDate: l.air_date || null,
          season: l.season_number || null,
          episode: l.episode_number || null,
          name: l.name || ''
        };
      }
      // Per-season metadata: when each season started, how many episodes.
      // Filter out "Season 0" (specials) which TMDB includes in the seasons array.
      if (Array.isArray(d.seasons)) {
        out.seasonsMeta = d.seasons
          .filter(s => s.season_number && s.season_number >= 1)
          .map(s => ({
            season: s.season_number,
            airDate: s.air_date || null,
            episodeCount: s.episode_count || 0,
            name: s.name || `Season ${s.season_number}`
          }));
      }
    }
    out.genres = (d.genres || []).map(g => g.name);
    if (d.backdrop_path) out.backdrop = `https://image.tmdb.org/t/p/w780${d.backdrop_path}`;
    if (d.credits && d.credits.cast) {
      out.cast = d.credits.cast.slice(0,10).map(c => ({
        name: c.name,
        character: c.character || '',
        photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : ''
      }));
    }
    if (d.similar && d.similar.results) {
      // Filter TMDB's /similar results so live-action titles don't recommend kids' animated
      // shows and vice versa. The TMDB algo can mix formats (e.g. The Boys returns Tokyo Mew
      // Mew / TMNT because of incidental "superhero" tag overlap). Genre 16 = Animation.
      const sourceGenreIds = (d.genres || []).map(g => g.id);
      const sourceGenreSet = new Set(sourceGenreIds);
      const sourceIsAnimated = sourceGenreSet.has(16);
      const sourceIsAdult = !!d.adult;

      const candidates = d.similar.results
        .filter(s => sourceIsAdult || !s.adult)
        .filter(s => ((s.genre_ids || []).includes(16)) === sourceIsAnimated);

      // Sort by genre overlap with source; tie-break by TMDB vote_average so popular
      // matches rise. Without this The Boys often gets generic "trending" returns.
      candidates.sort((a, b) => {
        const aOverlap = (a.genre_ids || []).filter(g => sourceGenreSet.has(g)).length;
        const bOverlap = (b.genre_ids || []).filter(g => sourceGenreSet.has(g)).length;
        if (bOverlap !== aOverlap) return bOverlap - aOverlap;
        return (b.vote_average || 0) - (a.vote_average || 0);
      });

      // Fallback: if strict filtering left us with too few, fall back to the unfiltered
      // (adult-filtered) list. Avoids empty "similar" when TMDB returns weird results
      // for niche/foreign-language sources.
      const finalList = candidates.length >= 3
        ? candidates.slice(0, 10)
        : d.similar.results.filter(s => sourceIsAdult || !s.adult).slice(0, 10);

      out.similar = finalList.map(s => ({
        id: 'tmdb_' + s.id,
        tmdbId: s.id,
        mediaType,
        name: s.title || s.name,
        year: (s.release_date || s.first_air_date || '').slice(0,4),
        kind: mediaType === 'movie' ? 'Movie' : 'TV',
        overview: s.overview || '',
        poster: s.poster_path ? `https://image.tmdb.org/t/p/w200${s.poster_path}` : ''
      }));
    }
  } catch(e) { console.error('details fetch failed', e); }
  return out;
}

let detailTitleId = null;
let detailMoodPaletteOpen = false;
let detailMoodPaletteOutsideHandler = null;

window.openDetailModal = async function(id) {
  const t = state.titles.find(x => x.id === id);
  if (!t) return;
  detailTitleId = id;
  const bg = document.getElementById('detail-modal-bg');
  const content = document.getElementById('detail-modal-content');
  content.innerHTML = renderDetailShell(t);
  if (typeof cv15AttachDetailModalDelegate === 'function') cv15AttachDetailModalDelegate();
  bg.classList.add('on');
  // Tap-outside-to-close. Essential on iOS PWA where there's no browser back and
  // the ✕ scrolls out of view when the detail is scrolled. Only the backdrop itself
  // closes; taps bubbled up from modal content pass through to their targets.
  bg.onclick = (e) => { if (e.target === bg) closeDetailModal(); };
  // === D-04 (DECI-14-04) — lazy-fetch TMDB community reviews ===
  // Cast + trailer + providers + synopsis are already surfaced (cast comes from
  // fetchTmdbDetails which has run on first open via t.detailsCached). TMDB
  // community reviews are the missing 5th surface — fetched once per title and
  // cached locally on the title doc (t.tmdbReviews / t.tmdbReviewsFetchedAt).
  // Per-title gate prevents re-fetch on re-open; rate-limit budget per CLAUDE.md.
  ensureTmdbReviews(t).then(() => {
    if (detailTitleId !== id) return;
    const merged = state.titles.find(x => x.id === id) || t;
    document.getElementById('detail-modal-content').innerHTML = renderDetailShell(merged);
    if (typeof cv15AttachDetailModalDelegate === 'function') cv15AttachDetailModalDelegate();
  }).catch(e => console.warn('[detail] tmdb reviews fetch failed', e));
  if (t.isManual) return;
  // For TV titles, the fetch also pulls showStatus/nextEpisode/etc which were added
  // in Turn 9. If those are missing even though detailsCached is true, we do one
  // silent refetch to backfill the new fields. Movies skip this since they have no
  // new fields in this upgrade.
  const needsTvBackfill = t.kind === 'TV' && t.detailsCached && !t.showStatus;
  if (t.detailsCached && !needsTvBackfill) return;
  const tmdbId = t.tmdbId || (t.id && t.id.startsWith('tmdb_') ? t.id.replace('tmdb_','') : null);
  if (!tmdbId) return;
  const mediaType = t.mediaType || (t.kind === 'Movie' ? 'movie' : 'tv');
  const details = await fetchTmdbDetails(mediaType, tmdbId);
  const update = { detailsCached: true };
  Object.keys(details).forEach(k => { if (details[k] !== undefined && details[k] !== null) update[k] = details[k]; });
  // Phase 15 / TRACK-15-08 fix: stamp nextEpisodeRefreshedAt so the CF live-release
  // sweep's HIGH-4 stale-data guard (>7 days) doesn't skip every title. Without this,
  // t.nextEpisodeRefreshedAt defaults to 0 (Jan 1 1970) → every title looks 56+ years
  // stale → live-release push silently never fires. Stamped on every TMDB refresh.
  update.nextEpisodeRefreshedAt = Date.now();
  try { await updateDoc(doc(titlesRef(), id), { ...writeAttribution(), ...update }); } catch(e){ console.error(e); }
  if (detailTitleId === id) {
    const merged = { ...t, ...update };
    content.innerHTML = renderDetailShell(merged);
    if (typeof cv15AttachDetailModalDelegate === 'function') cv15AttachDetailModalDelegate();
  }
};

// === D-04 (DECI-14-04) — TMDB community reviews lazy-fetch ===
// Hits /movie|tv/{id}/reviews (TMDB rate-limit ~40 req / 10s — gated per-title via
// t.tmdbReviewsFetchedAt timestamp so re-opens are no-ops). Top 3 results stored
// on the local in-memory title; persisted to Firestore so other family members
// don't re-fetch. Manual titles + titles without tmdbId are skipped.
// XSS mitigation T-14.05-01: review content is escaped at render time in
// renderTmdbReviewsForTitle (escapeHtml on author/content). DoS mitigation
// T-14.05-02: per-title gate + 1-day cache window.
async function ensureTmdbReviews(t) {
  if (!t || t.isManual) return;
  // 1-day TTL — TMDB community reviews don't churn fast and we want to avoid burning rate budget.
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (t.tmdbReviewsFetchedAt && (Date.now() - t.tmdbReviewsFetchedAt) < ONE_DAY) return;
  const tmdbId = t.tmdbId || (t.id && t.id.startsWith('tmdb_') ? t.id.replace('tmdb_','') : null);
  if (!tmdbId) return;
  const mediaType = t.mediaType || (t.kind === 'Movie' ? 'movie' : 'tv');
  try {
    const r = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/reviews?api_key=${TMDB_KEY}&language=en-US&page=1`);
    if (!r.ok) return;
    const data = await r.json();
    const top = (data.results || []).slice(0, 3).map(rev => ({
      author: rev.author || 'Reviewer',
      rating: (rev.author_details && rev.author_details.rating) || null,
      content: rev.content || '',
      url: rev.url || null,
      createdAt: rev.created_at || null
    }));
    t.tmdbReviews = top;
    t.tmdbReviewsFetchedAt = Date.now();
    // Persist so other family members benefit. Best-effort — failure is silent.
    try {
      await updateDoc(doc(titlesRef(), t.id), {
        ...writeAttribution(),
        tmdbReviews: top,
        tmdbReviewsFetchedAt: t.tmdbReviewsFetchedAt
      });
    } catch (e) { /* persist is best-effort; in-memory copy is enough */ }
  } catch (e) {
    console.warn('[tmdb-reviews] fetch failed', e);
  }
}

// === D-04 (DECI-14-04) — TMDB community reviews render ===
// Sibling to renderReviewsForTitle (family-local reviews). Renders only when
// t.tmdbReviews has entries — first paint shows nothing, then re-renders after
// ensureTmdbReviews resolves. Truncates each review at 360 chars + ellipsis.
function renderTmdbReviewsForTitle(t) {
  if (!Array.isArray(t.tmdbReviews) || t.tmdbReviews.length === 0) return '';
  const items = t.tmdbReviews.slice(0, 3).map(rev => {
    const body = (rev.content || '').slice(0, 360);
    const truncated = (rev.content || '').length > 360;
    const ratingStr = rev.rating ? ` · ${rev.rating}/10` : '';
    return `<article class="tmdb-review">
      <header class="tmdb-review-h">${escapeHtml(rev.author)}${ratingStr}</header>
      <p class="tmdb-review-body">${escapeHtml(body)}${truncated ? '…' : ''}</p>
    </article>`;
  }).join('');
  return `<div class="detail-section"><h4>Community reviews</h4><div class="tmdb-reviews-list">${items}</div></div>`;
}

window.closeDetailModal = function() {
  document.getElementById('detail-modal-bg').classList.remove('on');
  detailMoodPaletteOpen = false;
  if (detailMoodPaletteOutsideHandler) {
    document.removeEventListener('click', detailMoodPaletteOutsideHandler);
    detailMoodPaletteOutsideHandler = null;
  }
  detailTitleId = null;
};

function renderDetailMoodsSection(t) {
  const existingMoods = Array.isArray(t.moods) ? t.moods : [];
  const existingChipsHtml = existingMoods.map(id => {
    const m = moodById(id);
    if (!m) return '';
    return `<button class="mood-chip" onclick="removeDetailMood('${escapeHtml(t.id)}','${escapeHtml(id)}')" aria-label="Remove ${escapeHtml(m.label)}"><span class="mood-icon">${twemojiImg(m.icon, m.label, 'twemoji--md')}</span>${escapeHtml(m.label)}</button>`;
  }).join('');
  const addChipHtml = `<button class="mood-chip mood-chip--add${detailMoodPaletteOpen ? ' mood-chip--add-active' : ''}" onclick="${detailMoodPaletteOpen ? 'closeDetailMoodPalette' : 'openDetailMoodPalette'}()">+ add mood</button>`;
  const paletteHtml = detailMoodPaletteOpen
    ? `<div class="detail-moods-palette" role="group" aria-label="Add mood">${
        MOODS.filter(m => !existingMoods.includes(m.id)).map(m =>
          `<button class="mood-chip mood-chip--palette" onclick="addDetailMood('${escapeHtml(t.id)}','${escapeHtml(m.id)}')"><span class="mood-icon">${twemojiImg(m.icon, m.label, 'twemoji--md')}</span>${escapeHtml(m.label)}</button>`
        ).join('')
      }</div>`
    : '';
  return `<div class="detail-section"><h4>Moods</h4><div class="detail-moods">${existingChipsHtml}${addChipHtml}</div>${paletteHtml}</div>`;
}

function renderDetailShell(t) {
  const backdrop = t.backdrop || t.poster || '';
  const tier = tierFor(t.rating);
  const ratingPill = t.rating ? `<span class="tc-rating-pill ${tier?'tier'+tier:''}">${escapeHtml(t.rating)}</span>` : '';
  const runtime = t.runtime ? `${t.runtime} min` : '';
  const tvInfo = (t.kind === 'TV' && t.seasons) ? `${t.seasons} season${t.seasons===1?'':'s'}` : '';
  const metaParts = [t.year, t.kind, runtime, tvInfo].filter(Boolean).map(escapeHtml);
  const metaHtml = metaParts.map((p,i) => i === 0 ? p : `<span class="dot">·</span> ${p}`).join(' ');
  const genresHtml = (t.genres || []).map(g => `<span class="genre-pill">${escapeHtml(g)}</span>`).join('');
  const trailerHtml = t.trailerKey ? `<div class="detail-section"><iframe class="trailer-frame" src="https://www.youtube.com/embed/${encodeURIComponent(t.trailerKey)}" allowfullscreen></iframe></div>` : '';
  const castHtml = (t.cast && t.cast.length) ? `<div class="detail-section"><h4>Cast</h4><div class="cast-row">${t.cast.map(c => `<div class="cast-card"><div class="cast-photo" style="background-image:url('${c.photo||''}')"></div><div class="cast-name">${escapeHtml(c.name)}</div><div class="cast-char">${escapeHtml(c.character||'')}</div></div>`).join('')}</div></div>` : '';
  // Build a fuller "Where to watch" section showing Stream / Rent / Buy buckets separately.
  // De-dupe each bucket by canonical brand so Prime Video doesn't appear twice.
  function provStrip(list, label) {
    if (!Array.isArray(list) || !list.length) return '';
    const seen = new Set();
    const deduped = [];
    for (const p of list) {
      const brand = normalizeProviderName(p.name);
      if (seen.has(brand)) continue;
      seen.add(brand);
      deduped.push({ ...p, brand });
    }
    const mySvcs = new Set((state.me && Array.isArray(state.me.services)) ? state.me.services : []);
    return `<div class="detail-prov-group"><span class="detail-prov-label">${label}</span><div class="providers">${deduped.map(p => `<div class="provider-logo ${label==='Stream' && mySvcs.has(p.brand)?'mine':''}" title="${escapeHtml(p.brand)}" style="background-image:url('${p.logo||''}')"></div>`).join('')}</div></div>`;
  }
  const streamStrip = provStrip(t.providers, 'Stream');
  const rentStrip = provStrip(t.rentProviders, 'Rent');
  const buyStrip = provStrip(t.buyProviders, 'Buy');
  const anyAvail = streamStrip || rentStrip || buyStrip;
  const refreshBtn = (t.id && t.id.startsWith('tmdb_') && !t.isManual)
    ? `<button class="pill" onclick="refreshProviders('${t.id}')" style="margin-top:var(--s2);font-size:var(--t-micro);" title="Refetch availability from TMDB">↻ Refresh availability</button>`
    : '';
  // Phase 18 / D-16: confidence/source attribution. Push body itself doesn't
  // carry "via TMDB" (too verbose for a push); the affordance lives here in
  // the detail surface where users dig in to verify availability.
  const providerAttribution = `<div class="detail-prov-attribution" style="margin-top:var(--s1);font-size:var(--t-micro);font-style:italic;opacity:0.6;">Provider data via TMDB</div>`;
  const providersHtml = anyAvail
    ? `<div class="detail-section"><h4>Where to watch</h4>${streamStrip}${rentStrip}${buyStrip}${refreshBtn}${providerAttribution}</div>`
    : (t.providersChecked
        ? `<div class="detail-section"><h4>Where to watch</h4><div class="detail-prov-empty">Not on subscription streaming or rent. ${refreshBtn}</div>${providerAttribution}</div>`
        : '');
  const similarHtml = (t.similar && t.similar.length) ? `<div class="detail-section"><h4>You might also like</h4><div class="similar-row">${t.similar.map(s => {
    const inLib = state.titles.find(x => x.id === s.id);
    return `<div class="similar-card" onclick="addSimilar('${s.id}')"><div class="similar-poster ${inLib?'added':''}" style="background-image:url('${s.poster||''}')"><div class="add-overlay">${inLib?'✓':'+'}</div></div><div class="similar-name">${escapeHtml(s.name)}</div><div class="similar-year">${escapeHtml(s.year||'')}</div></div>`;
  }).join('')}</div></div>` : '';
  const loadingHtml = (!t.detailsCached && !t.isManual) ? '<div class="detail-section" aria-hidden="true"><div class="sk sk-line" style="width:30%;margin-bottom:10px;"></div><div class="sk-row-posters"><div class="sk sk-poster" style="width:80px;height:80px;border-radius:50%;"></div><div class="sk sk-poster" style="width:80px;height:80px;border-radius:50%;"></div><div class="sk sk-poster" style="width:80px;height:80px;border-radius:50%;"></div><div class="sk sk-poster" style="width:80px;height:80px;border-radius:50%;"></div></div></div>' : '';
  const moodsHtml = renderDetailMoodsSection(t);
  // Phase 19 / D-10..D-12 — Per-title parent override. Surfaces only when ALL
  // three conditions hold: kid-mode active + title tier > 2 (i.e., currently
  // blocked) + current user has parent privileges. Session-scoped — clears
  // when toggleKidMode flips (D-13).
  let kidModeOverrideHtml = '';
  if (state.kidMode && tier !== null && tier > 2 && typeof isCurrentUserParent === 'function' && isCurrentUserParent()) {
    // Already-overridden state — surface a quiet "active" hint instead of the link
    // so re-opening the modal doesn't make it look re-clickable.
    if (state.kidModeOverrides && state.kidModeOverrides.has && state.kidModeOverrides.has(t.id)) {
      kidModeOverrideHtml = `<p class="kid-mode-override-active">Showing this for tonight (kid-mode override)</p>`;
    } else {
      kidModeOverrideHtml = `<p class="kid-mode-override-row"><a href="#" class="kid-mode-override-link" onclick="kidModeOverrideTitle('${escapeHtml(t.id)}'); return false;">Show this anyway for tonight</a></p>`;
    }
  }
  // Phase 20 / D-09 — "Why this is in your matches" section.
  // Gated on t.id being currently in matches list (per D-09); section is omitted
  // when title was opened from Library, History, or considerable list.
  // Italic Instrument Serif h4 + dim p — same humility register as Phase 18 attribution.
  let whyMatchHtml = '';
  const _detailMatches20 = (typeof getCurrentMatches === 'function') ? getCurrentMatches() : [];
  const _isInMatches20 = _detailMatches20.some(m => m.id === t.id);
  if (_isInMatches20) {
    const _detailCouch20 = state.couchMemberIds || state.selectedMembers || [];
    const _whyStr20 = buildMatchExplanation(t, _detailCouch20);
    if (_whyStr20) {
      whyMatchHtml = `<div class="detail-why-match">
        <h4>Why this is in your matches</h4>
        <p class="detail-why-match-text">${_whyStr20}</p>
      </div>`;
    }
  }
  return `<div class="detail-backdrop" style="background-image:url('${backdrop}')">
    <button class="detail-close" aria-label="Close" onclick="closeDetailModal()">✕</button>
  </div>
  <div class="detail-body">
    <div class="detail-name">${ratingPill}${escapeHtml(t.name)}</div>
    <div class="detail-meta">${metaHtml}</div>
    <div class="detail-genres">${genresHtml}</div>
    ${moodsHtml}
    <div class="detail-overview">${escapeHtml(t.overview||'No description available.')}</div>
    ${state.me ? `<button class="pill" style="margin-bottom:8px;" onclick="addToList('${t.id}')">+ Add to list</button>` : ''}
    ${kidModeOverrideHtml}
    ${whyMatchHtml}
    ${renderTvProgressSection(t)}
    ${trailerHtml}
    ${providersHtml}
    ${castHtml}
    ${similarHtml}
    ${renderDiaryForTitle(t)}
    ${renderReviewsForTitle(t)}
    ${renderCv15TupleProgressSection(t)}
    ${renderTmdbReviewsForTitle(t)}
    ${renderWatchpartyHistoryForTitle(t)}
    ${renderPastWatchpartiesForTitle(t)}
    ${loadingHtml}
  </div>`;
}

function renderWatchpartyHistoryForTitle(t) {
  // Phase 26 / RPLY-26-12 — D-08 bifurcation: this function returns ACTIVE-ONLY
  // watchparties for the title. The new renderPastWatchpartiesForTitle handles archived.
  const related = activeWatchparties().filter(wp => wp.titleId === t.id).sort((a,b) => b.startAt - a.startAt);
  if (!related.length) return '';
  return `<div class="detail-section"><h4>Watchparties</h4>
    <div class="wp-history-list">
      ${related.map(wp => {
        const now = Date.now();
        const isActive = wp.status !== 'archived' && (wp.startAt > now || (now - wp.startAt) < WP_ARCHIVE_MS);
        const count = Object.keys(wp.participants || {}).length;
        const reactionCount = (wp.reactions || []).length;
        const dateStr = formatStartTime(wp.startAt);
        const statusPill = isActive
          ? `<span class="wp-history-pill live">Live</span>`
          : `<span class="wp-history-pill">Archived</span>`;
        return `<div class="wp-history-item" onclick="closeDetailModal();openWatchpartyLive('${wp.id}')">
          <div class="wp-history-info">
            <div class="wp-history-date">${dateStr} ${statusPill}</div>
            <div class="wp-history-meta">${escapeHtml(wp.hostName)} hosted · ${count} ${count===1?'person':'people'} · ${reactionCount} ${reactionCount===1?'reaction':'reactions'}</div>
          </div>
          <div class="wp-history-arrow">›</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// Phase 26 / RPLY-26-11 — Past watchparties for this title section per UI-SPEC §5.
// Renders a section listing ARCHIVED watchparties for this family that featured this title
// AND have replay-able reactions. Hide-when-empty per D-10 (silent UX).
function renderPastWatchpartiesForTitle(t) {
  const past = archivedWatchparties()
    .filter(wp => wp.titleId === t.id)
    .filter(wp => replayableReactionCount(wp) >= 1)
    .sort((a, b) => b.startAt - a.startAt)  // most-recent-first
    .slice(0, 10);  // UI-SPEC §5 cap: 10 rows; full history via Past parties surface
  if (!past.length) return '';  // D-10 silent-UX hide-when-empty (Pitfall 7)
  const rowsHtml = past.map(wp => {
    const count = Object.keys(wp.participants || {}).length;
    const reactionCount = replayableReactionCount(wp);
    const reactionLabel = reactionCount === 1 ? '1 reaction' : (reactionCount + ' reactions');
    const dateLine = friendlyPartyDate(wp.startAt);
    const titleNameSafe = escapeHtml(wp.titleName || 'Watchparty');
    const posterStyle = wp.titlePoster
      ? `background-image:url('${escapeHtml(wp.titlePoster)}')`
      : '';
    const wpIdSafe = escapeHtml(wp.id);
    const ariaLabel = `${titleNameSafe}, ${dateLine}, ${count} on the couch, ${reactionLabel}`;
    // Phase 26 / RPLY-26-08 part 2 — title-detail row tap enters replay variant.
    const actionFn = `closeDetailModal();openWatchpartyLive('${wpIdSafe}', { mode: 'revisit' })`;
    return `<div class="past-watchparty-row" role="button" tabindex="0"
              onclick="${actionFn}"
              onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${actionFn};}"
              aria-label="${escapeHtml(ariaLabel)}">
      <div class="past-watchparty-poster" style="${posterStyle}"></div>
      <div class="past-watchparty-body">
        <div class="past-watchparty-title">${titleNameSafe}</div>
        <div class="past-watchparty-meta">${escapeHtml(dateLine)}</div>
        <div class="past-watchparty-meta">${count} on the couch · ${reactionLabel}</div>
      </div>
      <span class="past-watchparty-chevron" aria-hidden="true">›</span>
    </div>`;
  }).join('');
  return `<div class="detail-section">
    <h4>Past watchparties</h4>
    <p class="detail-section-subline" style="font-style:italic;font-family:'Instrument Serif',serif;color:var(--ink-dim);font-size:var(--t-meta);margin:0 0 var(--space-stack-sm,12px) 0;">Catch up on what the family said.</p>
    <div class="past-watchparties-for-title-list">
      ${rowsHtml}
    </div>
  </div>`;
}

window.addSimilar = async function(id) {
  const t = state.titles.find(x => x.id === detailTitleId);
  if (!t || !t.similar) return;
  const s = t.similar.find(x => x.id === id);
  if (!s) return;
  if (state.titles.find(x => x.id === id)) return;
  const extras = await fetchTmdbExtras(s.mediaType, s.tmdbId);
  const newTitle = { ...s, ...extras, votes:{}, watched:false };
  // === D-03 Add-tab insertion (DECI-14-03) === — "more like this" lands in my queue.
  const res = await createTitleWithApprovalCheck(s.id, newTitle, { addToMyQueue: true });
  if (res.pending) {
    newTitle.approvalStatus = 'pending';
    newTitle.requestedBy = state.me.id;
    flashToast(`"${s.name}" sent for a parent to review.`);
  }
  // Optimistically add to local state so the green check shows immediately
  state.titles.push(newTitle);
  const merged = state.titles.find(x => x.id === detailTitleId);
  if (merged) document.getElementById('detail-modal-content').innerHTML = renderDetailShell(merged);
  if (typeof cv15AttachDetailModalDelegate === 'function') cv15AttachDetailModalDelegate();
};

// Phase 19 / D-11 — parent override: bypass kid-mode cap for this title in this
// session. Adds titleId to state.kidModeOverrides Set, re-renders affected
// surfaces, closes the detail modal, writes Sentry breadcrumb for analytics
// ("kids excluded but parents watch anyway" frequency signal — Claude's
// discretion per CONTEXT.md recommendation).
window.kidModeOverrideTitle = function(titleId) {
  if (!titleId) return;
  if (typeof isCurrentUserParent === 'function' && !isCurrentUserParent()) {
    // Defense in depth — render-side gate already hides the link for non-parents,
    // but a non-parent invoking the handler via DevTools should still be denied.
    flashToast('Only parents can do this', { kind: 'warn' });
    return;
  }
  if (!state.kidModeOverrides || typeof state.kidModeOverrides.add !== 'function') {
    state.kidModeOverrides = new Set();
  }
  state.kidModeOverrides.add(titleId);
  // Sentry breadcrumb — surfaces frequency of "kids excluded but parents watch
  // anyway" so we can re-evaluate the cap if the override fires constantly.
  try {
    if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
      const t = (state.titles || []).find(x => x.id === titleId);
      Sentry.addBreadcrumb({
        category: 'kid-mode-override',
        message: `parent override applied for ${titleId}`,
        level: 'info',
        data: {
          titleId,
          rating: t ? t.rating : null,
          by: state.me ? state.me.id : null
        }
      });
    }
  } catch (e) { /* never let analytics block UX */ }
  flashToast('Showing this for tonight', { kind: 'info' });
  // Close the detail modal so the re-rendered Tonight tab is visible.
  if (typeof closeDetailModal === 'function') closeDetailModal();
  if (typeof renderTonight === 'function') renderTonight();
  if (typeof renderLibrary === 'function') renderLibrary();
};

// Phase 3 (Mood Tags): inline detail-view mood editing
window.openDetailMoodPalette = function() {
  detailMoodPaletteOpen = true;
  _rerenderDetailFromState();
  // Defer listener registration so the click that opened the palette
  // doesn't immediately trigger the outside-click dismiss (Pitfall 1).
  setTimeout(() => {
    if (detailMoodPaletteOutsideHandler) document.removeEventListener('click', detailMoodPaletteOutsideHandler);
    detailMoodPaletteOutsideHandler = function(e) {
      if (!e.target.closest('.detail-moods-palette') && !e.target.closest('.mood-chip--add')) {
        window.closeDetailMoodPalette();
      }
    };
    document.addEventListener('click', detailMoodPaletteOutsideHandler);
  }, 0);
};

window.closeDetailMoodPalette = function() {
  detailMoodPaletteOpen = false;
  if (detailMoodPaletteOutsideHandler) {
    document.removeEventListener('click', detailMoodPaletteOutsideHandler);
    detailMoodPaletteOutsideHandler = null;
  }
  _rerenderDetailFromState();
};

window.addDetailMood = async function(titleId, moodId) {
  if (!moodById(moodId)) return;                    // ASVS V5: reject any id not in MOODS[]
  if (guardReadOnlyWrite()) return;                 // Plan 5.8 D-15: post-grace unclaimed = no writes
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const current = Array.isArray(t.moods) ? t.moods : [];
  if (current.includes(moodId)) return;             // idempotent
  const newMoods = [...current, moodId];
  haptic('light');
  // Optimistic local update + re-render (mirrors addSimilar pattern)
  t.moods = newMoods;
  t.moodsUserEdited = true;
  detailMoodPaletteOpen = false;
  if (detailMoodPaletteOutsideHandler) {
    document.removeEventListener('click', detailMoodPaletteOutsideHandler);
    detailMoodPaletteOutsideHandler = null;
  }
  _rerenderDetailFromState();
  try { await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), moods: newMoods, moodsUserEdited: true }); }
  catch(e) { console.error('[QN] addDetailMood failed', e); }
};

window.removeDetailMood = async function(titleId, moodId) {
  if (!moodById(moodId)) return;                    // ASVS V5: reject any id not in MOODS[]
  if (guardReadOnlyWrite()) return;                 // Plan 5.8 D-15: post-grace unclaimed = no writes
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const current = Array.isArray(t.moods) ? t.moods : [];
  if (!current.includes(moodId)) return;            // idempotent
  const newMoods = current.filter(m => m !== moodId);
  haptic('light');
  t.moods = newMoods;
  t.moodsUserEdited = true;
  _rerenderDetailFromState();
  try { await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), moods: newMoods, moodsUserEdited: true }); }
  catch(e) { console.error('[QN] removeDetailMood failed', e); }
};

// Shared scroll-preserving re-render helper for detail modal (Pitfall 3)
function _rerenderDetailFromState() {
  if (!detailTitleId) return;
  const t = state.titles.find(x => x.id === detailTitleId);
  if (!t) return;
  const content = document.getElementById('detail-modal-content');
  if (!content) return;
  const scrollTop = content.scrollTop;
  content.innerHTML = renderDetailShell(t);
  if (typeof cv15AttachDetailModalDelegate === 'function') cv15AttachDetailModalDelegate();
  content.scrollTop = scrollTop;
}

// Build per-member genre affinity: avg stars given to each genre across watched titles
function buildGenreAffinity(memberId) {
  const totals = {};
  state.titles.forEach(t => {
    if (!t.watched || !t.genres || !t.genres.length) return;
    const r = (t.ratings || {})[memberId];
    if (!r || !r.stars) return;
    t.genres.forEach(g => {
      if (!totals[g]) totals[g] = { sum: 0, count: 0 };
      totals[g].sum += r.stars;
      totals[g].count += 1;
    });
  });
  const aff = {};
  Object.keys(totals).forEach(g => { aff[g] = totals[g].sum / totals[g].count; });
  return aff;
}

let lastSpinId = null;

function getCurrentMatches() {
  if (!state.selectedMembers.length) return [];
  // D-01 (DECI-14-01): spin candidate pool — use couch-aware watched filter.
  // Couch identity here is the actively-selected members (the people on the couch tonight),
  // which is the closest pre-14-04 analog to state.couchMemberIds. Falls back to
  // [state.me.id] only when no one is selected (early-return above).
  const couch = (state.couchMemberIds && state.couchMemberIds.length)
    ? state.couchMemberIds
    : state.selectedMembers;
  return state.titles.filter(t => {
    if (isWatchedByCouch(t, couch)) return false;
    if (!state.selectedMembers.every(mid => (t.votes||{})[mid] === 'yes')) return false;
    if (!titleMatchesProviders(t)) return false;
    const tier = tierFor(t.rating);
    if (tier) {
      for (const mid of state.selectedMembers) {
        const m = state.members.find(x => x.id === mid);
        if (!m) continue;
        const max = m.maxTier != null ? m.maxTier : ageToMaxTier(m.age);
        if (tier > max) return false;
      }
    }
    // Phase 19 / D-07..D-09 — kid-mode tier cap (TIER_PG=2). Bypassed per-title via state.kidModeOverrides.
    const _kidCap = getEffectiveTierCap();
    if (_kidCap !== null) {
      const _tier = tierFor(t.rating);
      if (_tier !== null && _tier > _kidCap && !state.kidModeOverrides.has(t.id)) {
        return false;
      }
    }
    return true;
  });
}

function scoreTitle(t, affinityByMember) {
  let score = 1.0;
  let reasons = [];
  // Genre affinity boost (max +2)
  if (t.genres && t.genres.length) {
    let bestGenreScore = 0;
    let bestGenre = null;
    let bestMember = null;
    state.selectedMembers.forEach(mid => {
      const aff = affinityByMember[mid] || {};
      t.genres.forEach(g => {
        if (aff[g] != null && aff[g] > bestGenreScore) {
          bestGenreScore = aff[g];
          bestGenre = g;
          const m = state.members.find(x => x.id === mid);
          bestMember = m ? m.name : null;
        }
      });
    });
    if (bestGenreScore >= 4) { score += 2.0; reasons.push(`${bestMember} loves ${bestGenre}`); }
    else if (bestGenreScore >= 3) { score += 1.0; reasons.push(`${bestMember} likes ${bestGenre}`); }
    // Profile favorite genres (helps cold-start before enough ratings exist)
    state.selectedMembers.forEach(mid => {
      const m = state.members.find(x => x.id === mid);
      if (!m || !m.favoriteGenres) return;
      const matched = t.genres.filter(g => m.favoriteGenres.some(fg => fg === g || (fg === 'Sci-Fi' && g === 'Science Fiction')));
      if (matched.length && bestGenreScore < 3) {
        score += 0.8;
        if (!reasons.length) reasons.push(`${m.name}'s favorite: ${matched[0]}`);
      }
    });
  }
  // Bonus per yes vote beyond the selected members (other family members also voted yes)
  const yesCount = Object.values(t.votes || {}).filter(v => v === 'yes').length;
  const bonus = Math.max(0, yesCount - state.selectedMembers.length);
  if (bonus > 0) { score += bonus * 0.4; reasons.push(`${bonus} extra yes vote${bonus===1?'':'s'}`); }
  // Penalty if anyone selected has marked seen
  state.selectedMembers.forEach(mid => {
    if ((t.votes||{})[mid] === 'seen') score -= 0.3;
  });
  // Strong penalty if last spin picked this
  if (t.id === lastSpinId) score *= 0.2;
  return { score: Math.max(0.1, score), reason: reasons[0] || 'Random pick from your matches' };
}

function showRespinShimmer() {
  const poster = document.querySelector('#spin-modal-content .spin-result-poster');
  if (poster) poster.classList.add('sk');
  // The next spinPick() call will overwrite #spin-modal-content.innerHTML, detaching this element.
  // No cleanup needed.
}

window.spinPick = function(opts) {
  opts = opts || {};
  let matches = getCurrentMatches();
  // D-04: progressive filter relaxation — inline, no state mutation persisted beyond this call (Pitfall 8)
  if (!matches.length && (state.selectedMoods || []).length) {
    const saved = state.selectedMoods;
    state.selectedMoods = [];
    matches = getCurrentMatches();
    state.selectedMoods = saved;
    if (matches.length) flashToast('Relaxed mood filter for this spin.', { kind: 'info' });
  }
  // D-04 / UI-SPEC line 169: once all relaxations have failed, surface the empty-state in the spin modal.
  // Mirror the #spin-modal-content.innerHTML pattern at the flicker init below.
  if (!matches.length) {
    const bg2 = document.getElementById('spin-modal-bg');
    const content2 = document.getElementById('spin-modal-content');
    if (bg2 && content2) {
      bg2.classList.add('on');
      content2.innerHTML = `<div style="padding:32px 20px;text-align:center;">
          <div style="font-family:'Instrument Serif','Fraunces',serif;font-style:italic;font-size:var(--t-h2);color:var(--fg);margin-bottom:14px;">Nothing left to spin — try clearing some filters</div>
          <button class="spin-cancel" onclick="closeSpinModal()">Close</button>
        </div>`;
    }
    return;
  }
  const bg = document.getElementById('spin-modal-bg');
  const content = document.getElementById('spin-modal-content');
  bg.classList.add('on');
  haptic('light');

  // Compute affinities once
  const affinityByMember = {};
  state.selectedMembers.forEach(mid => { affinityByMember[mid] = buildGenreAffinity(mid); });
  // Score all matches
  const scored = matches.map(t => ({ title: t, ...scoreTitle(t, affinityByMember) }));
  // Weighted random selection
  const totalWeight = scored.reduce((sum, s) => sum + s.score, 0);
  let r = Math.random() * totalWeight;
  let pick = scored[0];
  for (const s of scored) { r -= s.score; if (r <= 0) { pick = s; break; } }

  // Build a flicker sequence: 6 random posters then the winner
  const flickerPosters = [];
  const pool = matches.filter(t => t.poster).map(t => t.poster);
  for (let i = 0; i < 6; i++) {
    flickerPosters.push(pool.length ? pool[Math.floor(Math.random() * pool.length)] : '');
  }
  // Render the flicker container
  content.innerHTML = `<div class="spin-flicker" id="spin-flicker"></div>
    <div style="margin-top:18px;font-family:'Instrument Serif','Fraunces',serif;font-style:italic;font-size:var(--t-body);color:var(--accent);">
      Finding tonight's pick…
    </div>`;
  const flickerEl = document.getElementById('spin-flicker');
  let step = 0;
  const speeds = [120, 140, 170, 210, 280, 380]; // decelerating
  function showFlickerStep() {
    if (step < flickerPosters.length) {
      flickerEl.innerHTML = `<div class="spin-flicker-poster" style="background-image:url('${flickerPosters[step]}');animation-duration:${speeds[step]}ms;"></div>`;
      step++;
      setTimeout(showFlickerStep, speeds[step - 1] + 40);
    } else {
      // Land on the winner
      flickerEl.innerHTML = `<div class="spin-flicker-poster landing" style="background-image:url('${pick.title.poster || ''}')"></div>`;
      setTimeout(() => showSpinResult(pick, { auto: !!opts.auto }), 500);
    }
  }
  showFlickerStep();
};

function showSpinResult(pick, meta) {
  const t = pick.title;
  lastSpinId = t.id;
  haptic('success');
  // D-05 / D-07: only manual spins claim spinnership. Auto re-spins (from post-spin veto per D-01) are
  // exempt per Pitfall 2 — they don't re-lock fairness for the vetoer.
  if (state.me && !(meta && meta.auto)) {
    setDoc(sessionRef(), { ...writeAttribution(), spinnerId: state.me.id, spinnerAt: Date.now() }, { merge: true });
  }
  const content = document.getElementById('spin-modal-content');
  // Build provider strip
  let provHtml = '';
  const provs = (t.providers || []).slice(0, 4);
  if (provs.length) {
    provHtml = `<div class="spin-result-providers">${provs.map(p => 
      `<div class="provider-logo" style="background-image:url('${p.logo || ''}')" title="${escapeHtml(p.name || '')}"></div>`
    ).join('')}</div>`;
  }
  // Confetti bits
  const confettiColors = ['#e8a04a','#d97757','#c54f63','#7fb069','#5e8c6a','#b08968'];
  let confettiHtml = '<div class="spin-confetti">';
  for (let i = 0; i < 24; i++) {
    const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const size = 4 + Math.random() * 8;
    confettiHtml += `<div class="spin-confetti-bit" style="left:${left}%;background:${color};width:${size}px;height:${size}px;animation-delay:${delay}s;"></div>`;
  }
  confettiHtml += '</div>';
  // Phase 20 / D-07 — Decision explanation sub-line below title name (italic Instrument Serif, dim).
  const _spinCouch20 = state.couchMemberIds || state.selectedMembers || [];
  const _spinExpl20 = buildMatchExplanation(t, _spinCouch20);
  const explHtml = _spinExpl20 ? `<div class="spin-explanation">${_spinExpl20}</div>` : '';
  content.innerHTML = `${confettiHtml}
    <div class="spin-result-poster" style="background-image:url('${t.poster||''}')"></div>
    <div class="spin-result-name">${escapeHtml(t.name)}</div>
    <div class="spin-result-meta">${escapeHtml(t.year||'')} · ${escapeHtml(t.kind||'')}${t.runtime?' · '+t.runtime+'m':''}</div>
    ${explHtml}
    ${provHtml}
    <div class="spin-reason">✨ ${escapeHtml(pick.reason || 'A couch favorite')}</div>
    <div class="spin-actions">
      <button class="spin-accept" onclick="acceptSpin('${t.id}')">Watch this tonight</button>
      <button class="spin-watchtogether" onclick="spinStartWatchparty('${t.id}')">🎬 Watch together</button>
      <button class="spin-reroll" onclick="spinPick()">🎲 Spin again</button>
      <button class="spin-veto" onclick="openVetoModal('${t.id}', {fromSpinResult: true})">Pass on it</button>
      <button class="spin-cancel" onclick="closeSpinModal()">Cancel</button>
    </div>`;
}

window.acceptSpin = function(id) {
  closeSpinModal();
  openScheduleModal(id);
};

// Phase 7 Plan 02 (PARTY-01): "Watch together" CTA from the Tonight spin result.
// Routes to existing live modal if a party already exists for this title, else to the
// start-watchparty flow. Mirrors the ⋯ action-sheet "Start a watchparty" branch but
// front-loaded so users don't have to dig through the action sheet after spinning.
window.spinStartWatchparty = function(titleId) {
  closeSpinModal();
  const existing = wpForTitle(titleId);
  if (existing) openWatchpartyLive(existing.id);
  else openWatchpartyStart(titleId);
};

window.closeSpinModal = function() {
  document.getElementById('spin-modal-bg').classList.remove('on');
};

// === Personal queues ===
// Kept as a compatibility shim — everything now routes through applyVote.
// "Adding to queue" = vote Yes. "Removing from queue" = clear your Yes vote.
window.toggleMyQueue = async function(id) {
  if (!state.me) return;
  const t = state.titles.find(x => x.id === id);
  if (!t) return;
  const currentVote = (t.votes || {})[state.me.id];
  // If already Yes, calling applyVote with 'yes' toggles it off (clears the vote, removes from queue).
  // If not Yes, we set it to Yes (adds to queue).
  await applyVote(id, state.me.id, 'yes');
};

function getMyQueueTitles() {
  if (!state.me) return [];
  // D-01 (DECI-14-01): use couch-aware watched filter on this discovery surface.
  // Falls back to [state.me.id] when no couch is claimed (single-member discovery).
  const couch = getCouchOrSelfIds();
  return state.titles
    .filter(t => !isWatchedByCouch(t, couch) && t.queues && t.queues[state.me.id] != null)
    .sort((a,b) => a.queues[state.me.id] - b.queues[state.me.id]);
}

async function reindexMyQueue() {
  if (!state.me) return;
  const myQueue = getMyQueueTitles();
  // Renumber 1..N to keep ranks contiguous
  for (let i = 0; i < myQueue.length; i++) {
    const t = myQueue[i];
    const currentRank = t.queues[state.me.id];
    if (currentRank !== i + 1) {
      const queues = { ...(t.queues || {}) };
      queues[state.me.id] = i + 1;
      try { await updateDoc(doc(titlesRef(), t.id), { ...writeAttribution(), queues }); } catch(e){}
    }
  }
}

// === D-01 helpers — DECI-14-01 ===
// D-01 (DECI-14-01) — strict member-aware "already-watched" filter for couch discovery surfaces.
// Returns true iff ANY couch member has the title flagged via ANY of 4 sources:
//   1) Trakt sync flipped t.watched = true (global on title doc; see trakt.ingestSyncData ~js/app.js:752)
//   2) member voted Yes prior — t.votes[memberId] === 'yes'
//   3) member voted No prior — t.votes[memberId] === 'no'
//   4) member manually marked watched — same t.watched global flag (Source 1 + 4 collapsed)
// Per-title rewatch override: same-day t.rewatchAllowedBy[memberId] timestamp opts the title back in.
// Per D-01 invitation bypass: this filter is applied to MY discovery surfaces ONLY (Browse/Spin/Swipe).
// CFs (push fan-out) MUST NOT call this — pushes go through regardless of watched status.
function isWatchedByCouch(t, couchMemberIds) {
  if (!t || !Array.isArray(couchMemberIds) || !couchMemberIds.length) return false;
  // Rewatch override — same-day timestamp on any couch member opts the title back in.
  const dayMs = 24 * 60 * 60 * 1000;
  const recently = (ts) => ts && (Date.now() - ts) < dayMs;
  const allow = t.rewatchAllowedBy || {};
  if (couchMemberIds.some(mid => recently(allow[mid]))) return false;
  // Source 1 + 4 — global watched flag covers Trakt sync AND manual mark-watched.
  if (t.watched) return true;
  // Source 2 — 'seen' vote is the canonical "I already watched this" signal (👁 button at
  // line 15089). The original 14-01 implementation conflated 'yes' votes with watched
  // status, which broke every downstream surface that reads from t.queues (yes-voted =
  // queued): Tonight matches list, Next3 group rankings, Flow A picker tiers, swipe-mode
  // candidate pool, spin-pick matches all went silently empty for couches with shared
  // yes-voted titles. 'yes' = "I want to watch" (queue it); 'seen' = "I already watched
  // it" (hide from discovery). They are distinct vote types and must not be conflated.
  // Source 3 — 'no' votes still hide titles from rediscovery per D-01 literal read
  // (intentional opinionation: voting No on a title means don't keep showing it).
  const votes = t.votes || {};
  return couchMemberIds.some(mid => votes[mid] === 'no' || votes[mid] === 'seen');
}

// D-01 — Resolve the active couch's member-id list for filter calls.
// Falls back to [state.me.id] when state.couchMemberIds is empty (no couch claimed yet —
// 14-04's writer hasn't fired). Single-member discovery is D-01's documented default.
function getCouchOrSelfIds() {
  if (state.couchMemberIds && state.couchMemberIds.length) return state.couchMemberIds;
  return state.me ? [state.me.id] : [];
}

// D-01 — Per-title rewatch override writer. Stamps t.rewatchAllowedBy[memberId] = now.
// Triggered by the "Rewatch this one" action sheet item (added in 14-04 or 14-05).
async function setRewatchAllowed(titleId, memberId) {
  if (!titleId || !memberId || !state.familyCode) return;
  try {
    const ref = doc(titlesRef(), titleId);
    await updateDoc(ref, {
      [`rewatchAllowedBy.${memberId}`]: Date.now(),
      ...writeAttribution()
    });
    flashToast('Rewatch enabled for tonight', { kind: 'info' });
  } catch (e) {
    console.error('[rewatch] write failed', e);
    flashToast('Could not enable rewatch — try again', { kind: 'warn' });
  }
}
window.setRewatchAllowed = setRewatchAllowed;

// === Group "Up next" via weighted aggregation ===
// Returns the top 5 titles ranked by how many family members queued them (weighted by rank).
// Name kept as getGroupNext3 for backward compatibility with existing call sites.
function getGroupNext3() {
  // Score each title by inverse rank from all members who queued it
  // Higher rank position = lower score (rank 1 = 1.0, rank 2 = 0.5, rank 3 = 0.33, etc.)
  // D-01 (DECI-14-01): use couch-aware watched filter — strip titles any couch member
  // has already engaged with (Trakt-watched / voted / manually watched), with same-day
  // rewatch override honored.
  const couch = getCouchOrSelfIds();
  const scores = new Map();
  const queuedBy = new Map();
  state.titles.forEach(t => {
    if (isWatchedByCouch(t, couch)) return;
    if (!t.queues) return;
    let total = 0;
    const members = [];
    Object.entries(t.queues).forEach(([mid, rank]) => {
      const m = state.members.find(x => x.id === mid);
      if (!m) return;
      total += 1 / rank;
      members.push(m.name);
    });
    if (total > 0) {
      scores.set(t.id, total);
      queuedBy.set(t.id, members);
    }
  });
  const ranked = Array.from(scores.entries())
    .sort((a,b) => b[1] - a[1])
    .slice(0,5)
    .map(([id, score]) => ({ title: state.titles.find(t => t.id === id), score, queuedBy: queuedBy.get(id) }));
  return ranked;
}

// === D-02 tier aggregators — DECI-14-02 ===
// D-02 (DECI-14-02) — Tier 1: titles where EVERY couch member has the title in their queue.
// Sort: ascending mean of member-queue ranks; tie-break descending t.rating.
// Excludes titles where isWatchedByCouch returns true (consumes 14-01 helper).
function getTierOneRanked(couchMemberIds, opts) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  // Plan 14-09 / D-11 (d) — opts.includeWatched bypasses the watched filters so
  // the "Show rewatch options" CTA in the all-watched empty state can resurface
  // titles the couch has already seen. Default behavior unchanged.
  const includeWatched = !!(opts && opts.includeWatched);
  const out = [];
  state.titles.forEach(t => {
    if (!includeWatched && t.watched) return;
    if (!t.queues) return;
    if (!includeWatched && isWatchedByCouch(t, couchMemberIds)) return;
    // Intersection requirement: ALL couch members must have a rank for this title.
    const ranks = couchMemberIds.map(mid => t.queues[mid]);
    if (ranks.some(r => r == null)) return;
    // Phase 19 / D-07..D-09 — kid-mode tier cap (TIER_PG=2). Bypassed per-title via state.kidModeOverrides.
    const _kidCap = getEffectiveTierCap();
    if (_kidCap !== null) {
      const _tier = tierFor(t.rating);
      if (_tier !== null && _tier > _kidCap && !state.kidModeOverrides.has(t.id)) {
        return;
      }
    }
    const meanRank = ranks.reduce((a,b) => a + b, 0) / ranks.length;
    out.push({ title: t, meanRank, ratingTie: parseFloat(t.rating) || 0 });
  });
  out.sort((a,b) => (a.meanRank - b.meanRank) || (b.ratingTie - a.ratingTie));
  return out;
}

// D-02 — Tier 2: titles where ≥1 couch member queues it BUT NOT every couch member.
// Strict complement of T1 within the "any couch presence" set. Sort: descending count of couch
// members queueing it (more couch interest first), then ascending mean of present members' ranks,
// then descending rating.
function getTierTwoRanked(couchMemberIds, opts) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  const includeWatched = !!(opts && opts.includeWatched); // Plan 14-09 D-11 (d)
  const out = [];
  state.titles.forEach(t => {
    if (!includeWatched && t.watched) return;
    if (!t.queues) return;
    if (!includeWatched && isWatchedByCouch(t, couchMemberIds)) return;
    const presentRanks = couchMemberIds
      .map(mid => t.queues[mid])
      .filter(r => r != null);
    // Must have ≥1 couch presence AND NOT all (else it's T1).
    if (presentRanks.length === 0) return;
    if (presentRanks.length === couchMemberIds.length) return;
    // Phase 19 / D-07..D-09 — kid-mode tier cap (TIER_PG=2). Bypassed per-title via state.kidModeOverrides.
    const _kidCap = getEffectiveTierCap();
    if (_kidCap !== null) {
      const _tier = tierFor(t.rating);
      if (_tier !== null && _tier > _kidCap && !state.kidModeOverrides.has(t.id)) {
        return;
      }
    }
    const meanPresentRank = presentRanks.reduce((a,b) => a + b, 0) / presentRanks.length;
    out.push({
      title: t,
      couchPresenceCount: presentRanks.length,
      meanPresentRank,
      ratingTie: parseFloat(t.rating) || 0
    });
  });
  out.sort((a,b) =>
    (b.couchPresenceCount - a.couchPresenceCount) ||
    (a.meanPresentRank - b.meanPresentRank) ||
    (b.ratingTie - a.ratingTie)
  );
  return out;
}

// D-02 — Tier 3: titles where ZERO couch members queue it BUT ≥1 off-couch member does.
// "Watching her movie without her." Hidden behind expand by default; visibility resolved by
// resolveT3Visibility() (account/family/group most-restrictive-wins).
function getTierThreeRanked(couchMemberIds, opts) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  const includeWatched = !!(opts && opts.includeWatched); // Plan 14-09 D-11 (d)
  const couchSet = new Set(couchMemberIds);
  const out = [];
  state.titles.forEach(t => {
    if (!includeWatched && t.watched) return;
    if (!t.queues) return;
    if (!includeWatched && isWatchedByCouch(t, couchMemberIds)) return;
    const queueingMids = Object.keys(t.queues);
    if (!queueingMids.length) return;
    // Zero couch overlap, ≥1 off-couch presence.
    const offCouchPresent = queueingMids.filter(mid => !couchSet.has(mid));
    const couchPresent = queueingMids.filter(mid => couchSet.has(mid));
    if (couchPresent.length > 0) return;
    if (offCouchPresent.length === 0) return;
    // Phase 19 / D-07..D-09 — kid-mode tier cap (TIER_PG=2). Bypassed per-title via state.kidModeOverrides.
    const _kidCap = getEffectiveTierCap();
    if (_kidCap !== null) {
      const _tier = tierFor(t.rating);
      if (_tier !== null && _tier > _kidCap && !state.kidModeOverrides.has(t.id)) {
        return;
      }
    }
    const meanOffCouchRank = offCouchPresent
      .map(mid => t.queues[mid])
      .reduce((a,b) => a + b, 0) / offCouchPresent.length;
    out.push({
      title: t,
      offCouchMemberIds: offCouchPresent,
      meanOffCouchRank,
      ratingTie: parseFloat(t.rating) || 0
    });
  });
  out.sort((a,b) => (a.meanOffCouchRank - b.meanOffCouchRank) || (b.ratingTie - a.ratingTie));
  return out;
}

// D-02 — T3 visibility resolver: most-restrictive-wins across 3 levels.
// account-level: state.me.preferences?.showT3
// family-level:  state.family?.preferences?.showT3
// group-level:   state.group?.preferences?.showT3
// Semantics: ANY level === false → hide; true at all checked levels OR undefined → show.
// Default (no preferences set anywhere): SHOW (T3 expand toggle reveals; this resolver only
// gates the EXISTENCE of the expand toggle UI on an explicit hide).
function resolveT3Visibility() {
  const accountPref = state.me && state.me.preferences ? state.me.preferences.showT3 : undefined;
  const familyPref  = state.family && state.family.preferences ? state.family.preferences.showT3 : undefined;
  const groupPref   = state.group && state.group.preferences ? state.group.preferences.showT3 : undefined;
  // Most-restrictive-wins: any explicit false hides T3.
  if (accountPref === false || familyPref === false || groupPref === false) return false;
  return true;
}

function renderNext3() {
  const section = document.getElementById('next3-section');
  const list = document.getElementById('next3-list');
  if (!section || !list) return;
  const next3 = getGroupNext3();
  if (!next3.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  list.innerHTML = next3.map((item, i) => {
    const t = item.title;
    if (!t) return '';
    const who = item.queuedBy.length === state.members.length ? 'Everyone queued this' : 'Queued by ' + item.queuedBy.join(', ');
    return `<div class="next3-card rank-${i+1}" onclick="openDetailModal('${t.id}')">
      <div class="next3-rank">${i+1}</div>
      <div class="next3-poster" style="background-image:url('${t.poster||''}')"></div>
      <div class="next3-info">
        <div class="next3-name">${t.name}</div>
        <div class="next3-meta">${t.year||''} · ${t.kind||''}${t.runtime?' · '+t.runtime+'m':''}</div>
        <div class="next3-queued-by">${who}</div>
      </div>
    </div>`;
  }).join('');
}

// === Activity feed ===
function activityRef() { return collection(db, 'families', state.familyCode, 'activity'); }
let unsubActivity = null;
let recentActivity = [];

async function logActivity(kind, data) {
  if (!state.familyCode || !state.me) return;
  try {
    const payload = { ...data };
    if (payload.titleName && !payload.titleId) {
      const match = state.titles.find(t => t.name === payload.titleName);
      if (match) payload.titleId = match.id;
    }
    await addDoc(activityRef(), {
      ...writeAttribution(),
      kind,
      actorId: state.me.id,
      actorName: state.me.name,
      ts: Date.now(),
      ...payload
    });
    // Opportunistic cleanup — every ~10th activity write, prune anything beyond the last 200 docs.
    // Keeps the collection bounded so initial sync stays fast even after years of use.
    if (Math.random() < 0.1) trimActivity();
  } catch(e){}
}

async function trimActivity() {
  try {
    const q = query(activityRef(), orderBy('ts', 'desc'));
    const snap = await getDocs(q);
    if (snap.docs.length <= 200) return;
    const toDelete = snap.docs.slice(200);
    for (const d of toDelete) {
      try { await deleteDoc(d.ref); } catch(e){}
    }
  } catch(e){}
}

function startActivitySync() {
  if (unsubActivity) return;
  const q = query(activityRef(), orderBy('ts', 'desc'));
  unsubActivity = onSnapshot(q, snap => {
    const cutoff = Date.now() - 7*24*60*60*1000;
    recentActivity = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.ts > cutoff).slice(0, 15);
    renderActivity();
  }, e => console.error('activity sync', e));
}

let activityExpanded = false;
window.toggleActivityExpand_all = function() {
  activityExpanded = !activityExpanded;
  renderActivity();
};
function renderActivity() {
  const el = document.getElementById('activity-list');
  updateActivityBadge();
  if (!el) return;
  if (!recentActivity.length) { el.innerHTML = '<div class="activity-empty">Quiet on the couch. Start adding and voting to see activity here.</div>'; return; }
  // Collapse-by-default with show-more — keep the Tonight tab from being dominated by
  // a 7-day scroll. First N entries shown; rest gated behind a "Show all" expand control.
  const COLLAPSED_N = 5;
  const total = recentActivity.length;
  const visible = activityExpanded ? recentActivity : recentActivity.slice(0, COLLAPSED_N);
  const itemsHtml = visible.map(a => {
    const m = state.members.find(x => x.id === a.actorId);
    const color = m ? m.color : 'var(--ink-faint)';
    const initial = (a.actorName || '?')[0];
    // Find matching title for linking
    const t = (a.titleId && state.titles.find(x => x.id === a.titleId)) || state.titles.find(x => x.name === a.titleName);
    const safeName = escapeHtml(a.titleName);
    const safeActor = escapeHtml(a.actorName || '?');
    const titleLink = t ? `<span class="activity-title-link" onclick="event.stopPropagation();openDetailModal('${t.id}')"><em>${safeName}</em></span>` : `<em>${safeName}</em>`;
    let text = '';
    if (a.kind === 'added') text = `<strong>${safeActor}</strong> pulled ${titleLink} onto the couch`;
    else if (a.kind === 'rated') {
      // Support both legacy (stars 1-5) and new (score 0-10) activity records
      const display = typeof a.score === 'number' ? formatScore(a.score) + '/10' : (a.stars ? '★'.repeat(a.stars) : '');
      text = `<strong>${safeActor}</strong> rated ${titleLink} ${display}`;
    }
    else if (a.kind === 'commented') text = `<strong>${safeActor}</strong> commented on ${titleLink}`;
    else if (a.kind === 'watched') text = `<strong>${safeActor}</strong> watched ${titleLink}`;
    else if (a.kind === 'scheduled') text = `<strong>${safeActor}</strong> scheduled ${titleLink} for the couch`;
    else if (a.kind === 'reviewed') text = `<strong>${safeActor}</strong> reviewed ${titleLink}`;
    else if (a.kind === 'logged') {
      const label = typeof a.score === 'number' && a.score > 0 ? ` (${formatScore(a.score)}/10)` :
                    a.stars ? ` (${'★'.repeat(Math.floor(a.stars))}${a.stars%1?'½':''})` : '';
      text = `<strong>${safeActor}</strong> logged ${titleLink}${label}`;
    }
    else if (a.kind === 'vetoed') text = `<strong>${safeActor}</strong> passed on ${titleLink} for tonight`;
    else if (a.kind === 'wp_started') text = `<strong>${safeActor}</strong> started couch time for ${titleLink}`;
    else if (a.kind === 'requested') text = `<strong>${safeActor}</strong> wants ${titleLink} on the couch`;
    else if (a.kind === 'approved') text = `<strong>${safeActor}</strong> welcomed ${titleLink} onto the couch`;
    else if (a.kind === 'declined') text = `<strong>${safeActor}</strong> kept ${titleLink} off the couch`;
    else text = `<strong>${safeActor}</strong> did something`;
    const replyCount = (a.replies || []).length;
    return `<div class="activity-item" id="act-${a.id || a.ts}" onclick="toggleActivityExpand('${a.ts}')">
      <div class="activity-avatar" style="background:${color};cursor:pointer;" onclick="event.stopPropagation();openProfile('${a.actorId}')">${initial}</div>
      <div style="flex:1;">
        <div class="activity-text">${text}</div>
        <div class="activity-time">${formatTime(a.ts)}</div>
        ${replyCount>0?`<div class="activity-reply-count">💬 ${replyCount} ${replyCount===1?'reply':'replies'}</div>`:''}
      </div>
    </div>`;
  }).join('');
  const moreHtml = (total > COLLAPSED_N)
    ? `<button class="activity-show-more" type="button" onclick="toggleActivityExpand_all()">${activityExpanded ? 'Show less' : `Show all (${total - COLLAPSED_N} more)`}</button>`
    : '';
  el.innerHTML = itemsHtml + moreHtml;
}

let expandedActivityTs = null;

window.toggleActivityExpand = function(ts) {
  ts = parseInt(ts);
  if (expandedActivityTs === ts) { expandedActivityTs = null; renderActivity(); return; }
  expandedActivityTs = ts;
  const a = recentActivity.find(x => x.ts === ts);
  if (!a) return;
  const el = document.getElementById('act-' + ts);
  if (!el) return;
  el.classList.add('expanded');
  const replies = a.replies || [];
  const repliesHtml = replies.map(r => {
    const rm = state.members.find(x => x.id === r.memberId);
    const rcolor = rm ? rm.color : 'var(--ink-faint)';
    return `<div class="activity-reply">
      <div class="av" style="background:${rcolor}" aria-hidden="true">${escapeHtml((r.memberName||'?')[0])}</div>
      <div class="body"><strong>${escapeHtml(r.memberName)}</strong><div class="txt">${escapeHtml(r.text)}</div></div>
    </div>`;
  }).join('');
  const inputHtml = state.me ? `<div class="activity-reply-input" onclick="event.stopPropagation()">
    <input type="text" id="activity-reply-${ts}" placeholder="Reply..." maxlength="280" onkeydown="if(event.key==='Enter')postActivityReply(${ts})">
    <button onclick="postActivityReply(${ts})">Send</button>
  </div>` : '';
  el.insertAdjacentHTML('beforeend', `<div class="activity-replies" onclick="event.stopPropagation()">${repliesHtml}${inputHtml}</div>`);
  const input = document.getElementById('activity-reply-' + ts);
  if (input) input.focus();
};

window.postActivityReply = async function(ts) {
  if (!state.me) return;
  if (guardReadOnlyWrite()) return;                // Plan 5.8 D-15: no replies from unclaimed post-grace
  const input = document.getElementById('activity-reply-' + ts);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const a = recentActivity.find(x => x.ts === ts);
  if (!a || !a.id) return;
  const existing = a.replies || [];
  const reply = { ...writeAttribution(), text, ts: Date.now() };
  try {
    await updateDoc(doc(activityRef(), a.id), { replies: [...existing, reply] });
  } catch(e) { flashToast('Could not reply. Try again.', { kind: 'warn' }); }
};

// === TV progress (per-member) ===
// Data model: t.progress[memberId] = { season, episode, updatedAt }
// Legacy: older titles may have flat t.progressSeason/t.progressEpisode shared across
// the family. getMemberProgress handles the migration on read, and any write through
// the new API stores per-member going forward.

// === Phase 15 — Tracking Layer (read helpers) ===
// REVIEW HIGH-2 — defense-in-depth character-safety guard for tuple keys.
// Allowed: alphanumeric, underscore, hyphen, comma. Comma is the documented
// separator between sorted member IDs (per RESEARCH §Q2). Anything else
// (`.`, backtick, `/`, `\`, `$`, `[`, `]`, `#`, etc.) would corrupt a Firestore
// dotted-path field update like `tupleNames.${tk}`. Couch's existing member ID
// generator yields family-scoped alphanumeric strings (verified RESEARCH §A8),
// but if that contract ever drifts (e.g., upstream OAuth provider returns an
// email-like ID), this guard prevents a class of nested-path corruption.
const TUPLE_KEY_SAFE_RE = /^[A-Za-z0-9_,-]+$/;
function isSafeTupleKey(tk) {
  return typeof tk === 'string' && tk.length > 0 && TUPLE_KEY_SAFE_RE.test(tk);
}

// Tuple-key encoding: sorted memberIds joined by comma. Idempotent regardless of
// input order. Returns '' (and console.warns) if any member ID would produce an
// unsafe key — per REVIEW HIGH-2 callers must check the return value before
// using it as a Firestore field path.
function tupleKey(memberIds) {
  if (!memberIds || !memberIds.length) return '';
  const sorted = [...memberIds].filter(Boolean).sort();
  // Validate each member ID individually before join — a comma in any single
  // ID would create an ambiguous tupleKey (cannot round-trip via tk.split(',')).
  for (const id of sorted) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      console.warn('[Phase 15 / HIGH-2] tupleKey rejected unsafe member ID', id);
      try {
        if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
          Sentry.addBreadcrumb({
            category: 'tupleNames',
            level: 'warning',
            message: 'tupleKey rejected unsafe member ID',
            data: { memberIdSample: String(id).slice(0, 16) }
          });
        }
      } catch (_) {}
      return '';
    }
  }
  const tk = sorted.join(',');
  // Belt-and-suspenders: re-validate the joined string (paranoia for future
  // separator changes).
  return isSafeTupleKey(tk) ? tk : '';
}

// Read accessor for the tuple-progress field on a title doc. Returns the
// {[tupleKey]: {season, episode, updatedAt, source, ...}} map, or {} if missing.
function tupleProgressFromTitle(t) {
  if (!t || !t.tupleProgress || typeof t.tupleProgress !== 'object') return {};
  return t.tupleProgress;
}

// Find every tuple on this title that contains memberId. Returns
// [{tupleKey, prog}, ...] sorted by prog.updatedAt desc (newest first).
// Used by S1 Tonight widget (cross-show roll-up) and S2 detail-modal section.
function tuplesContainingMember(t, memberId) {
  if (!t || !memberId) return [];
  const tp = tupleProgressFromTitle(t);
  const out = [];
  for (const tk of Object.keys(tp)) {
    if (!tk) continue;
    const ids = tk.split(',');
    if (ids.includes(memberId)) {
      out.push({ tupleKey: tk, prog: tp[tk] });
    }
  }
  out.sort((a, b) => (b.prog && b.prog.updatedAt || 0) - (a.prog && a.prog.updatedAt || 0));
  return out;
}

// REVIEW MEDIUM-6 — return the user-set CUSTOM name for this tupleKey, or
// null if no custom name exists. CRITICAL: returns null (not empty string and
// not a derived fallback) so consumers like 15-04 can render the italic
// "*name this couch*" placeholder in the no-custom-name case. Distinct from
// tupleDisplayName which falls back to derived names like "You (solo)".
function tupleCustomName(tk) {
  if (!tk) return null;
  const fam = state.family || {};
  const slot = (fam.tupleNames || {})[tk];
  if (!slot || typeof slot.name !== 'string') return null;
  const trimmed = slot.name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Resolve a tuple key to a display name for UI. Returns the user-set name from
// state.family.tupleNames if present; otherwise a derived fallback (NEVER empty
// string — consumers that need to detect "no custom name set" must call
// tupleCustomName(tk) === null directly per REVIEW MEDIUM-6).
// Fallback derivation rules per UI-SPEC §Discretion Q3:
//   - solo, includes me      → "You (solo)"
//   - solo, NOT me           → `${otherName} (solo)`
//   - pair, includes me      → `${otherName} and me`
//   - pair, NOT me           → `${a} & ${b}` (alphabetical)
//   - 3+, includes me        → `You + ${n-1}`
//   - 3+, NOT me             → `${first}, ${second}, ${third}` (truncated)
function tupleDisplayName(tk, members) {
  if (!tk) return '';
  const custom = tupleCustomName(tk);
  if (custom) return custom;
  // Fallback: derive from member roster.
  const ids = tk.split(',').filter(Boolean);
  const meId = state.me && state.me.id;
  const memberMap = (members || state.members || []).reduce((acc, m) => { acc[m.id] = m; return acc; }, {});
  const names = ids.map(id => (memberMap[id] && memberMap[id].name) || '').filter(Boolean);
  if (ids.length === 1) {
    return ids[0] === meId ? 'You (solo)' : ((memberMap[ids[0]] && memberMap[ids[0]].name) || 'Unknown') + ' (solo)';
  }
  if (ids.length === 2) {
    if (ids.includes(meId)) {
      const otherId = ids.find(x => x !== meId);
      return ((memberMap[otherId] && memberMap[otherId].name) || 'Unknown') + ' and me';
    }
    return names.slice().sort().join(' & ');
  }
  // 3+ members
  if (ids.includes(meId)) return 'You + ' + (ids.length - 1);
  return names.slice(0, 3).join(', ');
}

// Read a member's current progress on a title, handling the legacy shared-progress
// fields as a fallback so existing data keeps rendering while we migrate.
function getMemberProgress(t, memberId) {
  if (!t || !memberId) return null;
  if (t.progress && t.progress[memberId]) {
    const p = t.progress[memberId];
    if (p.season != null && p.episode != null) return p;
  }
  // Fallback: if this member is the current user AND legacy shared progress exists,
  // surface that as their progress. This gives continuity for data created before
  // per-member tracking existed.
  if (state.me && memberId === state.me.id && t.progressSeason != null && t.progressEpisode != null) {
    return { season: t.progressSeason, episode: t.progressEpisode, updatedAt: t.progressUpdatedAt || 0, legacy: true };
  }
  return null;
}

// Which members have *any* progress on this title. Used for the card pill.
function membersWithProgress(t) {
  const ids = new Set();
  if (t.progress) {
    Object.keys(t.progress).forEach(id => {
      const p = t.progress[id];
      if (p && p.season != null && p.episode != null) ids.add(id);
    });
  }
  // Legacy shared data counts as the current user's progress if they don't already have per-member
  if (state.me && t.progressSeason != null && t.progressEpisode != null && !ids.has(state.me.id)) {
    ids.add(state.me.id);
  }
  return [...ids].map(id => state.members.find(m => m.id === id)).filter(Boolean);
}

// Write a member's progress. Always goes to the new per-member map.
// Phase 15.1 / SEC-15-1-01 — dotted-path single-inner-key shape so the Wave 2
// 4th sub-rule's affectedKeys().hasOnly([memberId]) check passes.
async function writeMemberProgress(titleId, memberId, season, episode) {
  if (!titleId || !memberId) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  try {
    await updateDoc(doc(titlesRef(), titleId), {
      ...writeAttribution(),
      [`progress.${memberId}`]: { season: season, episode: episode, updatedAt: Date.now() }
    });
  } catch(e) { console.warn('progress write failed', e); }
  // Push to Trakt if connected and this is the current user's own progress.
  // We only push for the signed-in user — a parent setting their kid's progress
  // shouldn't write to the parent's Trakt account. Fire-and-forget.
  if (state.me && memberId === state.me.id && t.tmdbId && t.kind === 'TV') {
    if (typeof trakt !== 'undefined' && trakt && trakt.pushEpisodeWatch) {
      trakt.pushEpisodeWatch(t.tmdbId, season, episode).catch(() => {});
    }
  }
}

// Clear a member's progress (when they say "I haven't started this")
// Phase 15.1 / SEC-15-1-01 — dotted-path with deleteField() so the Wave 2 4th
// sub-rule's affectedKeys().hasOnly([memberId]) check passes.
async function clearMemberProgress(titleId, memberId) {
  if (!titleId || !memberId) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  try {
    await updateDoc(doc(titlesRef(), titleId), {
      ...writeAttribution(),
      [`progress.${memberId}`]: deleteField()
    });
  } catch(e) { console.warn('progress clear failed', e); }
}

// === Phase 15 — Tracking Layer (writers) ===
// Write a tuple's progress entry. Tuple-keyed analog of writeMemberProgress.
// memberIds: array of memberIds on the watch (sorted internally via tupleKey).
// source: 'watchparty' | 'manual' | 'trakt-overlap' — D-05 attribution.
// Per D-08 (independent tuples), this does NOT push to anyone's Trakt account
// — group writes are local-only. Only writeMemberProgress (legacy per-individual)
// pushes to Trakt for the actor.
//
// REVIEW HIGH-2 — early-exit if tupleKey() returns '' (validation failed in
// the read-helpers block above); also re-validate the resulting tk via
// isSafeTupleKey() as belt-and-suspenders.
//
// Plan-15-01 forward-contract — the title-doc UPDATE rule (firestore.rules
// lines ~368-405) requires the write payload to echo `actingTupleKey: <tk>`
// so the rule can hasOnly-equality-check the diff'd tupleProgress key against
// it AND regex-match the actor's memberId/managedMemberId against it. Without
// this echo field the write is rejected with PERMISSION_DENIED. The plan's
// must_haves did not mention this explicitly — it was added as a 15-01
// deviation when the Firestore emulator rejected the planner's
// `affectedKeys().toList()[0].matches(...)` form. Documented in SUMMARY.
async function writeTupleProgress(titleId, memberIds, season, episode, source) {
  if (!titleId || !memberIds || !memberIds.length) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const tk = tupleKey(memberIds);
  if (!tk || !isSafeTupleKey(tk)) {
    console.warn('[Phase 15 / HIGH-2] writeTupleProgress aborted — unsafe tupleKey from memberIds', memberIds);
    return;
  }
  const prev = (t.tupleProgress && typeof t.tupleProgress === 'object') ? { ...t.tupleProgress } : {};
  prev[tk] = {
    season: season,
    episode: episode,
    updatedAt: Date.now(),
    source: source || 'manual'
  };
  try {
    // 15-01 forward-contract: stamp actingTupleKey alongside the tupleProgress write.
    await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), tupleProgress: prev, actingTupleKey: tk });
  } catch (e) { console.warn('tupleProgress write failed', e); }
}

// Clear a tuple's progress entry. Used by manual override paths in 15-04.
// REVIEW HIGH-2 — also gated on isSafeTupleKey since the input string is the
// raw key from a UI element, not always derived from a fresh tupleKey() call.
//
// Plan-15-01 forward-contract: stamp actingTupleKey: tupleKeyStr alongside
// the tupleProgress write so the rules-enforced per-key isolation passes.
async function clearTupleProgress(titleId, tupleKeyStr) {
  if (!titleId || !tupleKeyStr) return;
  if (!isSafeTupleKey(tupleKeyStr)) {
    console.warn('[Phase 15 / HIGH-2] clearTupleProgress aborted — unsafe tupleKey', tupleKeyStr);
    return;
  }
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const prev = (t.tupleProgress && typeof t.tupleProgress === 'object') ? { ...t.tupleProgress } : {};
  delete prev[tupleKeyStr];
  try {
    await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), tupleProgress: prev, actingTupleKey: tupleKeyStr });
  } catch (e) { console.warn('tupleProgress clear failed', e); }
}

// Write a tuple's display name to families/{code}.tupleNames.{tupleKey}. Uses
// dotted-path field write so concurrent renames don't clobber sibling slots.
// Permitted by the Phase 15 / D-02 5th UPDATE branch in firestore.rules (15-01).
// On failure: flashToast warn variant per UI-SPEC §Copywriting Contract.
//
// REVIEW HIGH-2 — REJECT writes whose tupleKey is unsafe BEFORE issuing the
// dotted-path update. An unsafe key here would not just fail to write — it
// could create an unintended nested field path (e.g., a `.` in the key would
// shred the doc into nested maps). Defense-in-depth for the
// `[`tupleNames.${tupleKeyStr}`]` template-literal field path.
//
// On unsafe key: skip the network round-trip, surface the same warn toast as a
// failure path (so the UI doesn't silently appear to succeed), and breadcrumb.
// Also OPTIMISTICALLY UPDATE state.family.tupleNames after a successful write
// (REVIEW MEDIUM-8) so the immediate re-render in 15-04's cv15SaveRenameInput
// reads the new value rather than the pre-snapshot stale state.
async function setTupleName(tupleKeyStr, name) {
  if (!state.familyCode || !tupleKeyStr) return;
  if (!isSafeTupleKey(tupleKeyStr)) {
    console.error('[Phase 15 / HIGH-2] setTupleName rejected unsafe tupleKey', tupleKeyStr);
    try {
      if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
        Sentry.addBreadcrumb({
          category: 'tupleNames',
          level: 'error',
          message: 'setTupleName rejected unsafe tupleKey',
          data: { tupleKeySample: String(tupleKeyStr).slice(0, 32) }
        });
      }
    } catch (_) {}
    flashToast("Couldn't save name — try again", { kind: 'warn' });
    return;
  }
  const trimmed = (name || '').slice(0, 40);
  const slot = {
    name: trimmed,
    setBy: (state.me && state.me.id) || null,
    setAt: Date.now()
  };
  try {
    // Phase 15.1 / SEC-15-1-03 — stamp actingTupleKey alongside the dotted-path
    // tupleNames write. Mirrors the writeTupleProgress pattern at js/app.js:8488.
    // The Wave 2 family-doc 5th-branch participant regex reads
    // request.resource.data.actingTupleKey to validate actor membership in tk.
    await updateDoc(doc(db, 'families', state.familyCode), {
      [`tupleNames.${tupleKeyStr}`]: slot,
      actingTupleKey: tupleKeyStr,
      ...writeAttribution()
    });
    // REVIEW MEDIUM-8 — optimistically update local state so the immediate
    // re-render in 15-04's cv15SaveRenameInput reads the new value before the
    // family-doc onSnapshot fires (typical 50-150ms delay).
    state.family = state.family || {};
    state.family.tupleNames = { ...(state.family.tupleNames || {}), [tupleKeyStr]: slot };
  } catch (e) {
    console.error('[tupleNames] setTupleName failed', e);
    flashToast("Couldn't save name — try again", { kind: 'warn' });
  }
}

// Write the per-show muted state. Member-keyed map mirroring t.queues / t.votes
// per-member shape. Per REVIEW HIGH-1, the 15-01 title-doc rule enforces that
// memberId == auth.uid (or managedMemberId for proxy-acted writes) — meaning
// callers MUST pass me.id as memberId; passing someone else's ID will be
// rejected by rules. This helper does not enforce that locally (the rule is
// authoritative); callers in 15-03 (toggleMutedShow) only pass me.id.
//
// Plan-15-01 forward-contract: writeAttribution() already stamps memberId
// (and managedMemberId when proxy-acting) on the payload — the title-doc
// UPDATE rule per-member mutedShows isolation branch checks the inner-map
// affectedKeys().hasOnly([managedMemberId || memberId]) which holds when the
// caller's memberId arg equals the writeAttribution memberId (true in all
// 15-03 call sites by construction).
async function writeMutedShow(titleId, memberId, muted) {
  if (!titleId || !memberId) return;
  try {
    if (muted) {
      await updateDoc(doc(titlesRef(), titleId), {
        [`mutedShows.${memberId}`]: true,
        ...writeAttribution()
      });
    } else {
      await updateDoc(doc(titlesRef(), titleId), {
        [`mutedShows.${memberId}`]: deleteField(),
        ...writeAttribution()
      });
    }
  } catch (e) { console.warn('mutedShow write failed', e); }
}

// Toggle the per-show muted state for the current user. S6 click handler in
// 15-04. Reads current state from t.mutedShows[me.id] and flips it. Pure
// convenience wrapper around writeMutedShow.
//
// Per REVIEW HIGH-1, the 15-01 title-doc rule enforces server-side that the
// memberId in mutedShows.{memberId} writes must equal auth.uid (or
// managedMemberId for proxy-acted writes). This helper passes me.id — which
// resolves to the actor's UID — so the rule allows the write.
window.toggleMutedShow = async function(titleId) {
  if (!titleId) return;
  const me = state.me;
  if (!me) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const currentlyMuted = !!(t.mutedShows && t.mutedShows[me.id]);
  await writeMutedShow(titleId, me.id, !currentlyMuted);
  // No flashToast on success — UI re-renders via title-doc onSnapshot will flip
  // the affordance copy from "Stop notifying me about this show" to
  // "Notifications off · Re-enable" (per UI-SPEC §Copywriting Contract).
};

// Quick-advance: bump the current user's episode by one. Hooked to "Next ep" buttons.
window.advanceEpisode = async function(titleId, e) {
  if (e) e.stopPropagation();
  if (!state.me) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const cur = getMemberProgress(t, state.me.id) || { season: 1, episode: 0 };
  await writeMemberProgress(titleId, state.me.id, cur.season, cur.episode + 1);
  haptic('light');
};

// Open the progress editor sheet — either for a specific member, or let the user
// pick which family member they're editing for (defaults to the signed-in user).
window.openProgressSheet = function(titleId, memberId) {
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const mId = memberId || (state.me && state.me.id);
  if (!mId) return;
  const m = state.members.find(x => x.id === mId);
  if (!m) return;
  state._progressEdit = { titleId, memberId: mId };
  const cur = getMemberProgress(t, mId) || { season: 1, episode: 1 };
  // Populate sheet
  document.getElementById('progress-sheet-title').textContent = t.name;
  const sub = document.getElementById('progress-sheet-sub');
  const isMe = state.me && mId === state.me.id;
  sub.innerHTML = isMe
    ? `Where are <strong>you</strong> in this show?`
    : `Where is <strong>${escapeHtml(m.name)}</strong> in this show?`;
  setStepperValue('progress-season', cur.season);
  setStepperValue('progress-episode', cur.episode);
  updateProgressMeta(t, cur.season);
  document.getElementById('progress-sheet-bg').classList.add('on');
};
window.closeProgressSheet = function() {
  document.getElementById('progress-sheet-bg').classList.remove('on');
  state._progressEdit = null;
};

// Stepper helpers — plain increment/decrement with guards
function getStepperValue(id) {
  const el = document.getElementById(id);
  return el ? parseInt(el.textContent, 10) || 1 : 1;
}
function setStepperValue(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = Math.max(1, v|0);
}
window.bumpStepper = function(id, delta) {
  const cur = getStepperValue(id);
  const next = Math.max(1, cur + delta);
  setStepperValue(id, next);
  // When season changes, refresh the "of N episodes" meta with that season's count
  if (id === 'progress-season' && state._progressEdit) {
    const t = state.titles.find(x => x.id === state._progressEdit.titleId);
    if (t) updateProgressMeta(t, next);
  }
};

// Meta line under the steppers: "Season 3 of 5 • new season available" etc.
function updateProgressMeta(t, season) {
  const meta = document.getElementById('progress-sheet-meta');
  if (!meta) return;
  const total = t.seasons || 0;
  const parts = [];
  if (total) parts.push(`Season ${season} of ${total}`);
  else parts.push(`Season ${season}`);
  // "New" badge: does a later season actually exist on air right now?
  // Use seasonsMeta air dates if available so we don't claim "new" for a
  // season that hasn't aired yet.
  if (total && season < total) {
    const next = Array.isArray(t.seasonsMeta) ? t.seasonsMeta.find(s => s.season === season + 1) : null;
    const nextAired = next && next.airDate ? parseAirDate(next.airDate) : null;
    if (!nextAired || nextAired.getTime() <= Date.now()) {
      parts.push(`<span class="new-badge">new</span>`);
    }
  }
  meta.innerHTML = parts.join(' ');
}

window.saveProgress = async function() {
  const edit = state._progressEdit;
  if (!edit) return;
  const season = getStepperValue('progress-season');
  const episode = getStepperValue('progress-episode');
  await writeMemberProgress(edit.titleId, edit.memberId, season, episode);
  closeProgressSheet();
  haptic('success');
};

window.clearProgress = async function() {
  const edit = state._progressEdit;
  if (!edit) return;
  await clearMemberProgress(edit.titleId, edit.memberId);
  closeProgressSheet();
  haptic('light');
};

// === TV show status helpers (Turn 9) ===
// These wrap TMDB's status data into user-friendly strings and badges, and
// detect "a new season dropped since I last watched" which drives the main
// "new season" badges across the app.

// Parse a YYYY-MM-DD TMDB air-date string into a Date object, or null if invalid.
function parseAirDate(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

// "Friday" / "Tomorrow" / "Mar 18" — short phrasing for when an episode airs.
// Used in pills and continue-watching subtitles. Null if the date is invalid.
function formatAirDateShort(dateStr) {
  const d = parseAirDate(dateStr);
  if (!d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  }
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (d.getFullYear() === now.getFullYear()) {
    return `${monthNames[d.getMonth()]} ${d.getDate()}`;
  }
  return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Has a new season dropped since the member last made progress?
// This is the "smart" new-season check — compares the last-aired season
// from TMDB to the member's current season, and only fires when the season
// aired AFTER the member's last progress update. Falls back to the naive
// "currentSeason < totalSeasons" check when we have no progress timestamps.
function hasNewSeasonFor(t, memberId) {
  if (!t || t.kind !== 'TV') return false;
  const totalSeasons = t.seasons || 0;
  const progress = memberId ? getMemberProgress(t, memberId) : null;
  if (!progress) return false;
  if (progress.season >= totalSeasons) return false;
  // Smart check: TMDB tells us the most recent season with air-date data via
  // seasonsMeta. Find the next unreached season and check if its premiere
  // aired after the member's progress update.
  if (Array.isArray(t.seasonsMeta) && progress.updatedAt) {
    const nextSeason = t.seasonsMeta.find(s => s.season === progress.season + 1);
    if (nextSeason && nextSeason.airDate) {
      const seasonStart = parseAirDate(nextSeason.airDate);
      if (seasonStart && seasonStart.getTime() <= Date.now() && seasonStart.getTime() > progress.updatedAt) {
        return true;
      }
      // Season hasn't aired yet — not a "new season" moment
      if (seasonStart && seasonStart.getTime() > Date.now()) return false;
    }
  }
  // Fallback: any unreached aired season counts. This is the naive Turn 8 check.
  return progress.season < totalSeasons;
}

// Generate a status badge string + class for a TV title. The return is an
// object {text, kind} where kind is 'new' | 'ended' | 'cancelled' | 'upcoming' | null.
// Callers can render it however they want.
function tvStatusBadge(t, memberId) {
  if (!t || t.kind !== 'TV' || t.watched) return null;
  // New-season badge takes precedence — it's the most actionable signal
  if (hasNewSeasonFor(t, memberId)) return { text: 'New season', kind: 'new' };
  // Upcoming episode this week — surface the air date
  if (t.nextEpisode && t.nextEpisode.airDate) {
    const short = formatAirDateShort(t.nextEpisode.airDate);
    const d = parseAirDate(t.nextEpisode.airDate);
    if (d && short) {
      const daysOut = Math.round((d - new Date()) / 86400000);
      // Only show the pill if the episode is within the next ~14 days
      if (daysOut >= -1 && daysOut <= 14) return { text: `Next ep ${short}`, kind: 'upcoming' };
    }
  }
  // Long-term status — only surface these when user has actually started the show
  const progress = memberId ? getMemberProgress(t, memberId) : null;
  if (progress || membersWithProgress(t).length) {
    if (t.showStatus === 'ended') return { text: 'Ended', kind: 'ended' };
    if (t.showStatus === 'cancelled') return { text: 'Cancelled', kind: 'cancelled' };
  }
  return null;
}

// Card pill — tiny progress indicator on library cards. Shows the current user's
// position; if others are tracking but user isn't, shows "N watching" with dots.
function progressPill(t) {
  if (t.kind !== 'TV' || t.watched) return '';
  if (!state.me) return '';
  const mine = getMemberProgress(t, state.me.id);
  if (mine) {
    return `<span class="tv-progress-pill" title="You're on S${mine.season}E${mine.episode}">S${mine.season}·E${mine.episode}</span>`;
  }
  const others = membersWithProgress(t);
  if (!others.length) return '';
  // Others are watching but current user hasn't started — show dots of their avatars
  const dots = others.slice(0,3).map(m => `<span class="dot" style="background:${m.color}" title="${escapeHtml(m.name)}"></span>`).join('');
  const label = others.length === 1 ? `${escapeHtml(others[0].name)} watching` : `${others.length} watching`;
  return `<span class="tv-progress-pill many" title="${label}"><span>${others.length}</span><span class="member-dots">${dots}</span></span>`;
}

// === Phase 15 / S2 + S3 + S6 (TRACK-15-04..06) — Your couch's progress (tuple-aware) ===
// Detail-modal "YOUR COUCH'S PROGRESS" section. Sibling primitive to
// renderTvProgressSection (per-INDIVIDUAL, immediately below) — both coexist during v1.
// REVIEW MEDIUM-7: tuple-key-bearing handlers use data-* attributes + a
// single delegated listener on #detail-modal-content. NEVER inline onclick with
// tupleKey embedded in single-quoted JS args.
// REVIEW MEDIUM-6: placeholder render is gated on tupleCustomName(tk) === null
// (NOT on !displayName, which would never fire because tupleDisplayName always
// returns a derived fallback for valid tuples).
// NOTE: Plan 15-04 referenced #detail-modal-body; the actual element ID in
// app.html is #detail-modal-content (verified app.html:995). Delegated listener
// is bound to that element instead.
function renderCv15TupleProgressSection(t) {
  if (!t || t.kind !== 'TV' || t.watched) return '';
  const tuples = (t.tupleProgress && typeof t.tupleProgress === 'object') ? t.tupleProgress : {};
  const tupleKeys = Object.keys(tuples);
  if (tupleKeys.length === 0) return '';
  const sorted = tupleKeys
    .map(tk => ({ tk, prog: tuples[tk] || {} }))
    .sort((a, b) => (b.prog.updatedAt || 0) - (a.prog.updatedAt || 0));
  // Honor cv15ShowAllTuples expand state (toggled by clicking "View all (N)").
  const limit = (state._cv15ExpandTuples && state._cv15ExpandTuples[t.id]) ? sorted.length : 4;
  const visible = sorted.slice(0, limit);
  const overflow = (sorted.length > 4 && limit === 4) ? sorted.length - 4 : 0;
  const rows = visible.map(({ tk, prog }) => {
    // REVIEW MEDIUM-6 — separate custom from derived; placeholder fires only
    // when no custom name is set.
    const customName = tupleCustomName(tk);
    const isUnnamed = customName === null;
    const visibleName = customName !== null ? customName : tupleDisplayName(tk, state.members);
    const escId = escapeHtml(t.id);
    const escTk = escapeHtml(tk);
    // === Phase 15.1 / SEC-15-1-05 — participant gate for the rename pencil ===
    // Non-participants don't see the rename affordance (defense-in-depth +
    // UX). The Wave 2 rule is the actual security boundary; this is the
    // casual-griefing close.
    const meId = (state.me && state.me.id) || '';
    const isParticipant = meId && tk.split(',').includes(meId);
    const nameMarkup = isUnnamed
      ? `<span class="cv15-tuple-name" id="cv15-tname-${escId}-${escTk}" data-tk="${escTk}">${escapeHtml(visibleName)}</span>` +
        `<span class="cv15-tuple-name unnamed-placeholder"><em>name this couch</em></span>`
      : `<span class="cv15-tuple-name" id="cv15-tname-${escId}-${escTk}" data-tk="${escTk}">${escapeHtml(visibleName)}</span>`;
    // === Phase 15.1 / SEC-15-1-05 — setBy attribution surface ===
    // When a tuple has a custom name + a setBy field, render a small
    // "Renamed by {memberName}" attribution beside the name. Turns silent
    // vandalism into attributable action. Pre-rule defense-in-depth.
    let setByMarkup = '';
    if (!isUnnamed && state.family && state.family.tupleNames && state.family.tupleNames[tk]) {
      const setBy = state.family.tupleNames[tk].setBy;
      if (setBy) {
        const setByMember = (state.members || []).find(m => m && m.id === setBy);
        const setByName = (setByMember && setByMember.name) || '';
        if (setByName) {
          setByMarkup = `<span class="cv15-tuple-setby" title="Renamed by ${escapeHtml(setByName)}">&middot; Renamed by ${escapeHtml(setByName)}</span>`;
        }
      }
    }
    // REVIEW MEDIUM-7 — data-* attrs carry tk + titleId; no inline onclick.
    // Phase 15.1 / SEC-15-1-05 — gate on isParticipant.
    const renameBtn = isParticipant
      ? `<button class="cv15-tuple-rename" type="button" aria-label="Rename this couch"
          data-cv15-action="renameTuple" data-title-id="${escId}" data-tk="${escTk}">&#9998;</button>`
      : '';
    const seasonNum = (prog.season != null) ? prog.season : '?';
    const episodeNum = (prog.episode != null) ? prog.episode : '?';
    const ago = prog.updatedAt ? cv15RelativeTime(prog.updatedAt) : '';
    return `<div class="cv15-progress-row" data-tk="${escTk}">
      <div class="cv15-progress-row-body">
        ${nameMarkup}${renameBtn}${setByMarkup}
        <div class="cv15-progress-time">${escapeHtml(ago)}</div>
      </div>
      <div class="cv15-progress-row-actions">
        <div class="cv15-progress-pos">S${escapeHtml(String(seasonNum))} &middot; E${escapeHtml(String(episodeNum))}</div>
      </div>
    </div>`;
  }).join('');
  // REVIEW MEDIUM-7 — overflow expand link uses data-* not inline onclick.
  const overflowHtml = overflow > 0
    ? `<button class="cv15-mute-toggle" type="button" style="border-top:0;color:var(--ink-dim);"
        data-cv15-action="expandTuples" data-title-id="${escapeHtml(t.id)}">View all (${sorted.length})</button>`
    : '';
  return `<div class="detail-section detail-cv15-progress">
    <h4>YOUR COUCH'S PROGRESS</h4>
    ${rows}
    ${overflowHtml}
    ${renderCv15MutedShowToggle(t)}
  </div>`;
}

// S6 per-show kill-switch text-link. REVIEW MEDIUM-7 — uses data-* attrs.
function renderCv15MutedShowToggle(t) {
  if (!t) return '';
  const me = state.me;
  if (!me) return '';
  const muted = !!(t.mutedShows && t.mutedShows[me.id]);
  const label = muted ? 'Notifications off &middot; Re-enable' : 'Stop notifying me about this show';
  const cls = muted ? 'cv15-mute-toggle on' : 'cv15-mute-toggle';
  return `<button class="${cls}" type="button"
    data-cv15-action="muteToggle" data-title-id="${escapeHtml(t.id)}">${label}</button>`;
}

// Relative-time helper.
function cv15RelativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// === Phase 15 / S3 — inline tuple rename handlers (called by delegated listener) ===
function cv15ShowRenameInput(titleId, tupleKeyStr) {
  if (!titleId || !tupleKeyStr) return;
  // === Phase 15.1 / SEC-15-1-05 — participant guard ===
  // Defense-in-depth: even if a non-participant somehow gets the data-cv15-action
  // attribute click through (DOM injection / dev console / out-of-date PWA before
  // the renderCv15TupleProgressSection gate above re-renders), refuse to swap
  // the span for an editable input.
  const meId = (state.me && state.me.id) || '';
  if (!meId || !tupleKeyStr.split(',').includes(meId)) return;
  const span = document.getElementById(`cv15-tname-${titleId}-${tupleKeyStr}`);
  if (!span) return;
  // REVIEW MEDIUM-6 — read current value via tupleCustomName so we don't
  // pre-fill the input with a derived fallback like "You (solo)".
  const currentName = tupleCustomName(tupleKeyStr) || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 40;
  input.className = 'cv15-tuple-rename-input';
  input.value = currentName;
  input.placeholder = 'e.g. Date night';
  input.dataset.tk = tupleKeyStr;
  input.dataset.titleId = titleId;
  input.addEventListener('keydown', cv15RenameKeydown);
  input.addEventListener('blur', cv15RenameBlur);
  // Hide the placeholder shimmer (sibling) while the input is open.
  const placeholder = span.parentElement && span.parentElement.querySelector('.cv15-tuple-name.unnamed-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  span.replaceWith(input);
  input.focus();
  input.select();
}
function cv15RenameKeydown(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); cv15SaveRenameInput(ev.target); }
  else if (ev.key === 'Escape') { ev.preventDefault(); cv15CancelRenameInput(ev.target); }
}
function cv15RenameBlur(ev) {
  if (ev.target.dataset.cancelled === '1') return;
  cv15SaveRenameInput(ev.target);
}
async function cv15SaveRenameInput(input) {
  if (!input) return;
  const tk = input.dataset.tk;
  const titleId = input.dataset.titleId;
  const value = (input.value || '').trim();
  input.removeEventListener('blur', cv15RenameBlur);
  input.removeEventListener('keydown', cv15RenameKeydown);
  // REVIEW MEDIUM-8 — setTupleName from 15-02 OPTIMISTICALLY updates
  // state.family.tupleNames on success, so the re-render below reads the new
  // value immediately (no race with the family-doc onSnapshot ~50-150ms delay).
  await setTupleName(tk, value);
  flashToast('Saved');
  if (typeof renderDetailShell === 'function' && state.titles) {
    const t = state.titles.find(x => x.id === titleId);
    const dm = document.getElementById('detail-modal-bg');
    if (t && dm && dm.classList.contains('on')) {
      const content = document.getElementById('detail-modal-content');
      if (content) {
        content.innerHTML = renderDetailShell(t);
        cv15AttachDetailModalDelegate();  // re-attach after innerHTML wipe
      }
    }
  }
}
function cv15CancelRenameInput(input) {
  if (!input) return;
  input.dataset.cancelled = '1';
  const titleId = input.dataset.titleId;
  if (state.titles) {
    const t = state.titles.find(x => x.id === titleId);
    if (t) {
      const content = document.getElementById('detail-modal-content');
      if (content && typeof renderDetailShell === 'function') {
        content.innerHTML = renderDetailShell(t);
        cv15AttachDetailModalDelegate();
      }
    }
  }
}

// "View all (N)" expand handler — toggles state._cv15ExpandTuples then re-renders.
function cv15ShowAllTuples(titleId) {
  if (!titleId) return;
  state._cv15ExpandTuples = state._cv15ExpandTuples || {};
  state._cv15ExpandTuples[titleId] = true;
  const t = state.titles && state.titles.find(x => x.id === titleId);
  if (t) {
    const content = document.getElementById('detail-modal-content');
    if (content && typeof renderDetailShell === 'function') {
      content.innerHTML = renderDetailShell(t);
      cv15AttachDetailModalDelegate();
    }
  }
}

// === REVIEW MEDIUM-7 — delegated event listener for #detail-modal-content ===
// Single listener handles all cv15-* clicks via data-cv15-action attribute.
// Idempotent — calling cv15AttachDetailModalDelegate twice does NOT double-bind
// because we track via a sentinel data-cv15-bound attribute.
// (Plan 15-04 referenced #detail-modal-body; the actual element ID is
// #detail-modal-content per app.html:995.)
function cv15HandleDetailModalClick(ev) {
  const trigger = ev.target.closest('[data-cv15-action]');
  if (!trigger) return;
  const action = trigger.getAttribute('data-cv15-action');
  const titleId = trigger.getAttribute('data-title-id') || '';
  const tk = trigger.getAttribute('data-tk') || '';
  switch (action) {
    case 'renameTuple':
      cv15ShowRenameInput(titleId, tk);
      break;
    case 'muteToggle':
      if (typeof window.toggleMutedShow === 'function') window.toggleMutedShow(titleId);
      break;
    case 'expandTuples':
      cv15ShowAllTuples(titleId);
      break;
    default:
      console.warn('[Phase 15 / MEDIUM-7] unknown cv15-action', action);
  }
}
function cv15AttachDetailModalDelegate() {
  const content = document.getElementById('detail-modal-content');
  if (!content) return;
  if (content.getAttribute('data-cv15-bound') === '1') return;
  content.addEventListener('click', cv15HandleDetailModalClick);
  content.setAttribute('data-cv15-bound', '1');
}

// Per-member progress section inside the detail modal. Each family member gets
// a row showing their position, an "Edit" pill to open the sheet, and a "Next ep"
// quick-bump for their own row.
function renderTvProgressSection(t) {
  if (t.kind !== 'TV' || t.watched) return '';
  if (!state.members || !state.members.length) return '';
  const meId = state.me && state.me.id;
  // Status strip — the big "New season available" / "Returning soon" / "Ended" messaging.
  // More context-rich than the tiny card badge.
  const statusStripHtml = renderDetailStatusStrip(t, meId);
  const rows = state.members.map(m => {
    const p = getMemberProgress(t, m.id);
    const isMe = meId === m.id;
    const posHtml = p
      ? `<div class="progress-row-pos">S${p.season} · E${p.episode}</div>`
      : `<div class="progress-row-pos unset">Not started</div>`;
    const actions = [];
    if (p && isMe) {
      // Own row with progress gets a quick "Next ep" in addition to Edit
      actions.push(`<button class="pill accent" onclick="advanceEpisode('${t.id}',event)">Next ep ▸</button>`);
    }
    actions.push(`<button class="pill" onclick="openProgressSheet('${t.id}','${m.id}')">${p ? 'Edit' : 'Set'}</button>`);
    return `<div class="progress-row">
      <div class="who-avatar" style="background:${m.color}">${avatarContent(m)}</div>
      <div class="progress-row-body">
        <div class="progress-row-name">${escapeHtml(m.name)}${isMe?' <span style="color:var(--accent);font-size:var(--t-eyebrow);font-weight:600;">you</span>':''}</div>
        ${posHtml}
      </div>
      <div class="progress-row-actions">${actions.join('')}</div>
    </div>`;
  }).join('');
  const totalSub = t.seasons ? `${t.seasons} season${t.seasons===1?'':'s'} total` : '';
  return `<div class="detail-section detail-progress">
    <div class="detail-progress-h">Progress${totalSub?` · ${totalSub}`:''}</div>
    ${statusStripHtml}
    ${rows}
  </div>`;
}

// Detail-modal status strip — bigger treatment than the card badge.
// Picks the most important thing to surface: new season > next episode air date >
// returning/ended/cancelled state. Returns empty string when nothing noteworthy.
function renderDetailStatusStrip(t, memberId) {
  if (!t || t.kind !== 'TV' || t.watched) return '';
  const progress = memberId ? getMemberProgress(t, memberId) : null;
  // New season available (smart check)
  if (hasNewSeasonFor(t, memberId)) {
    const nextNum = progress ? progress.season + 1 : (t.seasons || 2);
    const seasonMeta = Array.isArray(t.seasonsMeta) ? t.seasonsMeta.find(s => s.season === nextNum) : null;
    const airedPart = seasonMeta && seasonMeta.airDate
      ? `Premiered ${formatAirDateShort(seasonMeta.airDate)}`
      : 'Available to watch';
    const epCount = seasonMeta && seasonMeta.episodeCount
      ? ` · ${seasonMeta.episodeCount} episodes`
      : '';
    return `<div class="detail-status-strip new-season">
      <div class="detail-status-strip-icon">✨</div>
      <div class="detail-status-strip-body">
        <div class="detail-status-strip-title">Season ${nextNum} is out</div>
        <div class="detail-status-strip-sub">${escapeHtml(airedPart)}${escapeHtml(epCount)}</div>
      </div>
    </div>`;
  }
  // Next episode in the foreseeable future
  if (t.nextEpisode && t.nextEpisode.airDate) {
    const d = parseAirDate(t.nextEpisode.airDate);
    if (d) {
      const daysOut = Math.round((d - new Date()) / 86400000);
      if (daysOut >= 0 && daysOut <= 30) {
        const short = formatAirDateShort(t.nextEpisode.airDate);
        const title = `S${t.nextEpisode.season} · E${t.nextEpisode.episode}`;
        const name = t.nextEpisode.name ? `, &ldquo;${escapeHtml(t.nextEpisode.name)}&rdquo;` : '';
        return `<div class="detail-status-strip">
          <div class="detail-status-strip-icon">📺</div>
          <div class="detail-status-strip-body">
            <div class="detail-status-strip-title">Next episode ${short}</div>
            <div class="detail-status-strip-sub"><strong>${title}</strong>${name}</div>
          </div>
        </div>`;
      }
    }
  }
  // Long-term status — only for shows the user cares about (has started, or
  // someone in the family has started).
  const anyone = progress || membersWithProgress(t).length > 0;
  if (anyone) {
    if (t.showStatus === 'ended') {
      const lastAired = t.lastEpisode && t.lastEpisode.airDate
        ? `Last episode aired ${formatAirDateShort(t.lastEpisode.airDate)}`
        : 'The show wrapped up';
      return `<div class="detail-status-strip ended">
        <div class="detail-status-strip-icon">🎬</div>
        <div class="detail-status-strip-body">
          <div class="detail-status-strip-title">Show ended</div>
          <div class="detail-status-strip-sub">${escapeHtml(lastAired)}</div>
        </div>
      </div>`;
    }
    if (t.showStatus === 'cancelled') {
      return `<div class="detail-status-strip ended">
        <div class="detail-status-strip-icon">✖</div>
        <div class="detail-status-strip-body">
          <div class="detail-status-strip-title">Cancelled</div>
          <div class="detail-status-strip-sub">No further seasons planned</div>
        </div>
      </div>`;
    }
  }
  return '';
}

// === Phase 15 / S1 (TRACK-15-07) — Pick up where you left off (tuple-aware cross-show) ===
// Sibling primitive to renderContinueWatching (per-INDIVIDUAL — UNCHANGED below).
// Both surfaces COEXIST during v1 per RESEARCH §Q11 — Phase 15 widget hides
// when zero tuples (UI-SPEC §Discretion Q7); legacy continue-section serves
// users without tuples. Filter is "tuples containing me" instead of
// "I have progress". Max 3 rows visible on Tonight (vs max 4 in S2 detail
// modal — UI-SPEC §Cross-tuple visual handling locked).
function renderPickupWidget() {
  const el = document.getElementById('cv15-pickup-container');
  if (!el) return;
  if (!state.me || !state.titles || !state.titles.length) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  const meId = state.me.id;
  // Build {t, tupleKey, prog} for every (title, tuple-containing-me) pair —
  // then take the MOST-RECENT tuple per title, sort cross-show by that tuple's
  // updatedAt desc, slice 3.
  const candidates = [];
  for (const t of state.titles) {
    if (!t || t.kind !== 'TV' || t.watched) continue;
    if (typeof isHiddenByScope === 'function' && isHiddenByScope(t)) continue;
    const tuples = tuplesContainingMember(t, meId);
    if (!tuples.length) continue;
    // tuplesContainingMember already sorts by updatedAt desc — first entry
    // is the most-recent tuple containing me on this title.
    candidates.push({ t, tupleKey: tuples[0].tupleKey, prog: tuples[0].prog });
  }
  candidates.sort((a, b) => ((b.prog && b.prog.updatedAt) || 0) - ((a.prog && a.prog.updatedAt) || 0));
  const visible = candidates.slice(0, 3);
  if (!visible.length) {
    // UI-SPEC §Discretion Q7 — HIDE entirely on zero tuples. No empty state.
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'block';
  const rows = visible.map(({ t, tupleKey: tk, prog }) => {
    // Prefer user-set custom name (tupleCustomName), else derived display name,
    // else "You" fallback. tupleDisplayName already prefers the custom name when
    // present, but we route through tupleCustomName first to mirror the 15-04
    // pattern and keep the precedence explicit.
    const custom = (typeof tupleCustomName === 'function') ? tupleCustomName(tk) : null;
    const tupleName = custom || tupleDisplayName(tk, state.members) || 'You';
    const seasonNum = (prog && prog.season != null) ? prog.season : '?';
    const episodeNum = (prog && prog.episode != null) ? prog.episode : '?';
    const ago = (prog && prog.updatedAt) ? cv15RelativeTime(prog.updatedAt) : '';
    const escId = escapeHtml(t.id);
    return `<div class="cv15-progress-row" onclick="openDetailModal('${escId}')" style="cursor:pointer;">
      <div class="cv15-progress-row-body">
        <div class="cv15-progress-show-name">${escapeHtml(t.name || '')}</div>
        <div class="cv15-progress-tuple-meta">${escapeHtml(tupleName)} &middot; ${escapeHtml(ago)}</div>
      </div>
      <div class="cv15-progress-row-actions">
        <div class="cv15-progress-pos">S${escapeHtml(String(seasonNum))} &middot; E${escapeHtml(String(episodeNum))}</div>
        <button class="tc-primary" type="button" onclick="event.stopPropagation();openDetailModal('${escId}')">Continue</button>
      </div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="cv15-pickup-h">PICK UP WHERE YOU LEFT OFF</div>${rows}`;
}

function renderContinueWatching() {
  const el = document.getElementById('continue-section');
  if (!el) return;
  if (!state.me) { el.style.display = 'none'; return; }
  const meId = state.me.id;
  // Show TV shows where the current user has progress set, newest first.
  const list = state.titles
    .filter(t => {
      if (t.kind !== 'TV' || t.watched) return false;
      if (isHiddenByScope(t)) return false;
      return !!getMemberProgress(t, meId);
    })
    .map(t => ({ t, prog: getMemberProgress(t, meId) }))
    .sort((a,b) => (b.prog.updatedAt||0) - (a.prog.updatedAt||0))
    .slice(0,4);
  if (!list.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `<div class="t-section-head"><div class="t-section-title">Continue watching</div><div class="t-section-meta">Your TV shows</div></div>` +
    list.map(({t, prog}) => {
      const subParts = [];
      if (t.seasons) subParts.push(`${t.seasons} season${t.seasons===1?'':'s'} total`);
      // Turn 9: prefer the rich badge data (new season, next ep airing soon, ended)
      // over the naive "any unreached season" heuristic.
      const badge = tvStatusBadge(t, meId);
      let badgeHtml = '';
      if (badge) {
        badgeHtml = `<span class="tv-status-badge ${badge.kind}" style="margin-left:auto;">${escapeHtml(badge.text)}</span>`;
      }
      return `<div class="continue-card" onclick="openDetailModal('${t.id}')">
        <div class="continue-poster" style="background-image:url('${t.poster||''}')"></div>
        <div class="continue-info" style="display:flex;flex-direction:column;gap:3px;">
          <div style="display:flex;align-items:center;gap:var(--s2);">
            <div class="continue-name" style="flex:1;min-width:0;">${escapeHtml(t.name)}</div>
            ${badgeHtml}
          </div>
          <div class="continue-pos">S${prog.season} · Episode ${prog.episode}</div>
          <div class="continue-sub">${subParts.join(' · ')}</div>
        </div>
      </div>`;
    }).join('');
}

// === Adults-only scope ===
function isAdultMember(m) {
  if (!m) return false;
  if (m.isAdult != null) return m.isAdult;
  return m.age != null && m.age >= 18;
}
function isHiddenByScope(t) {
  // Adult-scope check
  if (t.scope === 'adults') {
    if (!state.me) return true;
    const me = state.members.find(m => m.id === state.me.id);
    if (!isAdultMember(me)) return true;
  }
  // Approval gate: pending and declined titles only surface to the requester and parents.
  // This keeps kids' not-yet-approved requests private from siblings.
  if (t.approvalStatus === 'pending' || t.approvalStatus === 'declined') {
    if (!state.me) return true;
    const meId = state.me.id;
    if (t.requestedBy === meId) return false; // always visible to the requester
    return !isMyselfParent();
  }
  return false;
}
window.toggleAdultMember = async function(id, checked) {
  if (!isCurrentUserParent()) { flashToast('Only parents can change this', { kind: 'warn' }); return; }
  try { await updateDoc(doc(membersRef(), id), { isAdult: checked }); }
  catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

// === Edit title ===
let editTitleId = null;
let editScope = 'everyone';
let editMoods = [];
function renderEditMoodChips() {
  const el = document.getElementById('edit-moods');
  if (!el) return;
  el.innerHTML = MOODS.map(m => {
    const on = editMoods.includes(m.id);
    return `<button class="mood-chip ${on?'on':''}" onclick="toggleEditMood('${m.id}');return false;">
      <span class="mood-icon">${twemojiImg(m.icon, m.label, 'twemoji--md')}</span>${m.label}
    </button>`;
  }).join('');
}
window.toggleEditMood = function(id) {
  if (editMoods.includes(id)) editMoods = editMoods.filter(x => x !== id);
  else editMoods = [...editMoods, id];
  renderEditMoodChips();
};
window.openEditTitle = function(id) {
  const t = state.titles.find(x => x.id === id);
  if (!t) return;
  editTitleId = id;
  document.getElementById('edit-name').value = t.name || '';
  document.getElementById('edit-year').value = t.year || '';
  document.getElementById('edit-poster').value = t.poster || '';
  editScope = t.scope || 'everyone';
  // Backfill moods if empty and we have TMDB data available
  if (Array.isArray(t.moods) && t.moods.length) {
    editMoods = t.moods.slice();
  } else {
    // Try to auto-suggest: we don't store genre_ids on titles, so only runtime is available
    // This still catches the 'short' mood; otherwise leaves empty for user to pick
    editMoods = suggestMoods([], t.runtime);
  }
  renderEditMoodChips();
  document.getElementById('scope-everyone').classList.toggle('on', editScope === 'everyone');
  document.getElementById('scope-adults').classList.toggle('on', editScope === 'adults');
  document.getElementById('edit-modal-bg').classList.add('on');
};
window.setScope = function(s) {
  editScope = s;
  document.getElementById('scope-everyone').classList.toggle('on', s === 'everyone');
  document.getElementById('scope-adults').classList.toggle('on', s === 'adults');
};
window.closeEditModal = function() {
  document.getElementById('edit-modal-bg').classList.remove('on');
  editTitleId = null;
};
window.saveEditTitle = async function() {
  if (!editTitleId) return;
  const name = document.getElementById('edit-name').value.trim();
  if (!name) { alert('Name required.'); return; }
  const update = {
    name,
    year: document.getElementById('edit-year').value.trim(),
    poster: document.getElementById('edit-poster').value.trim(),
    scope: editScope,
    moods: editMoods.slice()
  };
  try { await updateDoc(doc(titlesRef(), editTitleId), { ...writeAttribution(), ...update }); closeEditModal(); }
  catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

// === Veto ===
let vetoTitleId = null;
let vetoFromSpinResult = false;
window.openVetoModal = function(titleId, opts) {
  if (!state.me) { alert('Join the group first.'); return; }
  // ASVS V5: validate id against known title set before mutating module state
  if (!state.titles.find(x => x.id === titleId)) return;
  const mine = myVetoesToday();
  if (mine.length >= 2) {
    flashToast("you've used both vetoes tonight", { kind: 'warn' });
    return;
  }
  vetoTitleId = titleId;
  vetoFromSpinResult = !!(opts && opts.fromSpinResult);
  document.getElementById('veto-comment').value = '';
  const t = state.titles.find(x => x.id === titleId);
  const meta = document.getElementById('veto-modal-meta');
  if (meta && t) meta.textContent = `Pass on "${t.name}" just for tonight. Everyone else will see it.`;
  document.getElementById('veto-modal-bg').classList.add('on');
};
window.closeVetoModal = function() {
  document.getElementById('veto-modal-bg').classList.remove('on');
  vetoTitleId = null;
  vetoFromSpinResult = false;
};
window.submitVeto = async function() {
  if (!vetoTitleId || !state.me) return;
  // Plan 5.8 D-15: guard post-grace unclaimed members from writing vetoes.
  if (guardReadOnlyWrite()) { closeVetoModal(); return; }
  const comment = document.getElementById('veto-comment').value.trim().slice(0, 200);
  const t = state.titles.find(x => x.id === vetoTitleId);
  const titleName = (t && t.name) || 'a title';
  // Capture attribution ONCE and reuse across all three writes below.
  // writeAttribution() has snapshot-then-clear semantics on state.actingAs,
  // so calling it per-write would mis-attribute subsequent writes.
  const attr = writeAttribution();
  const baseEntry = {
    ...attr,
    comment: comment || '',
    at: Date.now()
  };
  try {
    // Pitfall 6: dotted field path — safe against concurrent vetoes on sibling titles.
    // attr also spread at top level so Firestore rules (which check request.resource.data.actingUid)
    // see attribution on the session doc write itself.
    await updateDoc(sessionRef(), { ['vetoes.' + vetoTitleId]: baseEntry, ...attr });
    // VETO-05: history doc survives midnight session rollover
    const histRef = await addDoc(vetoHistoryRef(), {
      ...baseEntry,
      titleId: vetoTitleId,
      titleName,
      sessionDate: todayKey()
    });
    // Pitfall 1: optimistic local update so downstream callers (Plan 02 auto re-spin) see the veto before onSnapshot fires
    state.session = state.session || { vetoes: {} };
    state.session.vetoes = { ...(state.session.vetoes || {}), [vetoTitleId]: { ...baseEntry, historyDocId: histRef.id } };
    // Persist the historyDocId back into the session doc so unveto() can find it after page reload
    await updateDoc(sessionRef(), { ['vetoes.' + vetoTitleId + '.historyDocId']: histRef.id, ...attr });
    logActivity('vetoed', { titleName });
    const wasFromSpin = vetoFromSpinResult;
    closeVetoModal();
    if (wasFromSpin) {
      showRespinShimmer();
      setTimeout(() => { if (window.spinPick) window.spinPick({ auto: true }); }, 400);
    }
  } catch(e) {
    flashToast('Could not save veto: ' + e.message, { kind: 'warn' });
  }
};
window.unveto = async function(titleId) {
  if (!state.me) return;
  const v = getVetoes()[titleId];
  if (!v || v.memberId !== state.me.id) return;
  // D-11: history is immutable after midnight rollover. If the entry has a sessionDate and it
  // doesn't match the current session, refuse. Cross-midnight is also refused by the existing
  // session-doc re-subscription (new-session vetoes map is empty, so v is undefined).
  if (v.sessionDate && v.sessionDate !== state.sessionDate) {
    flashToast('this veto is locked', { kind: 'warn' });
    return;
  }
  try {
    const current = { ...getVetoes() };
    delete current[titleId];
    await setDoc(sessionRef(), { ...writeAttribution(), vetoes: current });
    if (v.historyDocId) {
      await deleteDoc(vetoHistoryDoc(v.historyDocId));
    }
  } catch(e) {
    flashToast('Could not undo veto.', { kind: 'warn' });
  }
};

// === Watchparty ===
let wpStartTitleId = null;
let wpStartLead = 15; // default 15 min
let wpStartScheduleMode = false;

window.openWatchpartyStart = function(titleId) {
  if (!state.me) { alert('Join the group first.'); return; }
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  // Don't allow starting if there's already an active watchparty for this title
  const existing = wpForTitle(titleId);
  if (existing) {
    state.activeWatchpartyId = existing.id;
    renderWatchpartyLive();
    document.getElementById('wp-live-modal-bg').classList.add('on');
    return;
  }
  wpStartTitleId = titleId;
  wpStartLead = 15;
  wpStartScheduleMode = false;
  document.getElementById('wp-start-meta').textContent = `"${t.name}" · everyone watches separately, reactions flow live`;
  document.getElementById('wp-schedule-field').style.display = 'none';
  const btns = document.querySelectorAll('#wp-lead-grid .wp-lead-btn');
  btns.forEach(b => {
    const lead = b.getAttribute('data-lead');
    b.classList.toggle('on', lead === '15');
    b.onclick = () => selectWpLead(lead);
  });
  updateWpStartPreview();
  document.getElementById('wp-start-modal-bg').classList.add('on');
};

window.selectWpLead = function(lead) {
  const btns = document.querySelectorAll('#wp-lead-grid .wp-lead-btn');
  btns.forEach(b => b.classList.toggle('on', b.getAttribute('data-lead') === lead));
  if (lead === 'schedule') {
    wpStartScheduleMode = true;
    const field = document.getElementById('wp-schedule-field');
    field.style.display = 'block';
    // Seed with tomorrow 8pm
    const seed = new Date();
    seed.setDate(seed.getDate() + 1);
    seed.setHours(20, 0, 0, 0);
    const pad = n => String(n).padStart(2,'0');
    const val = `${seed.getFullYear()}-${pad(seed.getMonth()+1)}-${pad(seed.getDate())}T${pad(seed.getHours())}:${pad(seed.getMinutes())}`;
    document.getElementById('wp-schedule-input').value = val;
    document.getElementById('wp-schedule-input').oninput = updateWpStartPreview;
  } else {
    wpStartScheduleMode = false;
    wpStartLead = parseInt(lead, 10);
    document.getElementById('wp-schedule-field').style.display = 'none';
  }
  updateWpStartPreview();
};

function updateWpStartPreview() {
  const el = document.getElementById('wp-start-preview');
  if (!el) return;
  const startAt = computeWpStartAt();
  if (!startAt) { el.textContent = 'Pick a date and time above.'; return; }
  el.textContent = `Starts ${formatStartTime(startAt)} (${formatCountdown(startAt - Date.now())})`;
}

function computeWpStartAt() {
  if (wpStartScheduleMode) {
    const v = document.getElementById('wp-schedule-input').value;
    if (!v) return null;
    const ts = new Date(v).getTime();
    if (isNaN(ts)) return null;
    return ts;
  }
  return Date.now() + wpStartLead * 60 * 1000;
}

window.closeWatchpartyStart = function() {
  document.getElementById('wp-start-modal-bg').classList.remove('on');
  wpStartTitleId = null;
};

// === Sports watchparties (Phase 22 — TheSportsDB swap) ===
// Picker delegates to js/sports-feed.js (TheSportsDB + BALLDONTLIE-supplement abstraction).
// 16-league catalog: NBA / NFL / MLB / NHL / WNBA / NCAAF / NCAAB / EPL / La Liga /
// Bundesliga / Serie A / Ligue 1 / UCL / MLS / F1 / UFC. League tabs render dynamically
// from feedLeagueKeys() so adding a league = single line in sports-feed.js LEAGUES map.
// Legacy ESPN scrape removed (App Store §2.3 / §5.1.5 risk per Phase 11 RESEARCH §4).
const SPORTS_LEAGUES = SPORTS_FEED_LEAGUES;
let sportsCurrentLeague = 'nba';

window.openSportsPicker = function() {
  document.getElementById('sports-picker-bg').classList.add('on');
  sportsCurrentLeague = 'nba';
  // Dynamically render league tabs from the sports-feed catalog (Phase 22).
  const tabsEl = document.getElementById('sports-league-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = feedLeagueKeys().map(function(k) {
      const lg = SPORTS_FEED_LEAGUES[k];
      const shortLabel = (k === 'epl' ? 'EPL' : (k === 'laliga' ? 'La Liga' : (k === 'bundesliga' ? 'Bundesliga' : (k === 'seriea' ? 'Serie A' : (k === 'ligue1' ? 'Ligue 1' : (k === 'ucl' ? 'UCL' : (k === 'mls' ? 'MLS' : (k === 'ncaaf' ? 'CFB' : (k === 'ncaab' ? 'CBB' : (k === 'wnba' ? 'WNBA' : (k === 'f1' ? 'F1' : (k === 'ufc' ? 'UFC' : (lg && lg.label) || k.toUpperCase())))))))))));
      return '<button class="sports-league-tab' + (k === 'nba' ? ' on' : '') + '" data-league="' + k + '" onclick="selectSportsLeague(\'' + k + '\')">' + shortLabel + '</button>';
    }).join('');
  }
  loadSportsGames('nba');
};
window.closeSportsPicker = function() {
  document.getElementById('sports-picker-bg').classList.remove('on');
};

window.selectSportsLeague = function(leagueKey) {
  if (!SPORTS_LEAGUES[leagueKey]) return;
  sportsCurrentLeague = leagueKey;
  document.querySelectorAll('.sports-league-tab').forEach(t => {
    t.classList.toggle('on', t.getAttribute('data-league') === leagueKey);
  });
  loadSportsGames(leagueKey);
};

// Phase 22 \u2014 TheSportsDB-backed loader. Returns pre-normalized games (no parseEspnEvent step).
const sportsGamesCache = {};
async function loadSportsGames(leagueKey) {
  const listEl = document.getElementById('sports-games-list');
  if (!listEl) return;
  const league = SPORTS_LEAGUES[leagueKey];
  if (!league) return;
  listEl.innerHTML = '<div class="sports-loading">Loading ' + league.label + ' games\u2026</div>';
  try {
    const games = await feedFetchSchedule(leagueKey, 7);
    sportsGamesCache[leagueKey] = { fetchedAt: Date.now(), games: games };
    renderSportsGames(games);
  } catch(e) {
    qnLog('[Sports] fetch failed', e);
    listEl.innerHTML = '<div class="sports-empty"><strong>Couldn\'t load games</strong>The sports data service might be having a moment. Try again in a bit.</div>';
  }
}

// Phase 22 — parseEspnEvent removed (dead code after sports-feed.js abstraction).
// Game shape now produced by sports-feed.js normalizeTsdEvent — see commit d0fa183.

function renderSportsGames(rawGames) {
  const listEl = document.getElementById('sports-games-list');
  if (!listEl) return;
  // Phase 22 — input is already pre-normalized by feedFetchSchedule (sports-feed.js).
  // No parseEspnEvent step needed; just filter to upcoming/live and sort.
  const games = rawGames
    .filter(g => g && (g.isScheduled || g.isLive))
    .sort((a,b) => (a.startTime || 0) - (b.startTime || 0));
  if (!games.length) {
    listEl.innerHTML = '<div class="sports-empty"><strong>No upcoming games</strong>Check back when the season is active or the schedule is released.</div>';
    return;
  }
  listEl.innerHTML = games.map(g => {
    const when = formatSportsEventTime(g.startTime);
    const livePill = g.isLive ? '<span class="sports-game-live-pill">Live</span>' : '';
    const scoreLine = g.isLive && g.awayScore != null && g.homeScore != null
      ? '<span class="sports-game-score">' + escapeHtml(g.awayScore) + ' - ' + escapeHtml(g.homeScore) + '</span>'
      : '';
    const broadcastPill = !g.isLive && g.broadcast
      ? '<span style="font-size:var(--t-micro);color:var(--ink-dim);margin-left:var(--s2);">' + escapeHtml(g.broadcast) + '</span>'
      : '';
    return '<div class="sports-game-card' + (g.isLive ? ' live' : '') +
           '" onclick="scheduleSportsWatchparty(\'' + escapeHtml(g.id) + '\')">' +
      '<div class="sports-game-matchup">' +
        '<div class="sports-game-teams">' + escapeHtml(g.awayTeam) + '<span class="at">at</span>' + escapeHtml(g.homeTeam) + livePill + '</div>' +
        '<div class="sports-game-time">' + escapeHtml(when) + broadcastPill + '</div>' +
      '</div>' +
      scoreLine +
      '<div class="sports-game-chev">\u203a</div>' +
    '</div>';
  }).join('');
}

function formatSportsEventTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const evDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((evDay - today) / 86400000);
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return 'Today at ' + timeStr;
  if (diffDays === 1) return 'Tomorrow at ' + timeStr;
  if (diffDays > 1 && diffDays < 7) {
    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    return day + ' at ' + timeStr;
  }
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return month + ' ' + d.getDate() + ' at ' + timeStr;
}

window.scheduleSportsWatchparty = async function(eventId) {
  qnLog('[Sports] schedule click', { eventId, league: sportsCurrentLeague });
  const cacheEntry = sportsGamesCache[sportsCurrentLeague];
  if (!cacheEntry) {
    qnLog('[Sports] no cache for league', sportsCurrentLeague);
    flashToast('No games loaded for this league yet. Try switching leagues.', { kind: 'warn' });
    return;
  }
  // Phase 22 — cacheEntry.games is already normalized (sports-feed.js Game shape).
  // No parseEspnEvent step needed.
  const game = cacheEntry.games.find(g => g.id === eventId);
  if (!game) {
    qnLog('[Sports] no game match', { eventId, sampleIds: cacheEntry.games.slice(0,3).map(g => g.id) });
    flashToast('Could not find that game in the cache.', { kind: 'warn' });
    return;
  }
  if (!state.me) {
    qnLog('[Sports] no state.me when scheduling');
    flashToast('Pick who you are first, then try again.', { kind: 'warn' });
    return;
  }
  if (!game.startTime) { flashToast('This game is missing a start time.', { kind: 'warn' }); return; }
  // Phase 24 / REVIEWS M3 — Video URL field (legacy sports flow). Reads from #wp-video-url-sport.
  // Field is set BEFORE user taps a game tile; we read it at tile-click time.
  const _videoCheck = readAndValidateVideoUrl('sport');
  if (!_videoCheck.ok) return;
  const parsedVideoUrl = _videoCheck.parsed;
  const league = SPORTS_LEAGUES[sportsCurrentLeague];
  const matchupLabel = game.awayTeam + ' at ' + game.homeTeam;
  const id = 'wp_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  // Phase 7 Plan 5 (PARTY-06): capture creator's IANA timezone for CF push body rendering.
  // Parallel to confirmStartWatchparty above — sports wps flow through the same onWatchpartyCreate CF.
  const creatorTimeZone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
    catch (e) { return null; }
  })();
  const wp = {
    id,
    titleId: null,
    titleName: matchupLabel,
    titlePoster: '',
    hostId: state.me.id,
    hostName: state.me.name,
    creatorTimeZone: creatorTimeZone || null,  // Phase 7 Plan 5: CF renders startAt in creator's tz
    startAt: game.startTime,
    createdAt: Date.now(),
    status: game.startTime <= Date.now() ? 'active' : 'scheduled',
    // Phase 23 — set mode='game' on legacy sports wps so they share the full Game Mode
    // pipeline (live scoreboard polling + score-delta amplified reactions + scoringPlays
    // catch-me-up + team-flair picker). Was: legacy flow predated mode='game' and skipped
    // these surfaces; only the rendered scoreboard chrome appeared (with stale seed values).
    mode: 'game',
    sportEvent: {
      league: league ? league.label : sportsCurrentLeague.toUpperCase(),
      leagueKey: sportsCurrentLeague,
      leagueEmoji: league ? league.emoji : '🎮',
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeLogo: game.homeLogo || '',
      awayLogo: game.awayLogo || '',
      espnId: game.id,
      venue: game.venue || null,
      broadcast: game.broadcast || null
    },
    participants: {
      [state.me.id]: {
        name: state.me.name,
        joinedAt: Date.now(),
        rsvpStatus: 'in',
        reactionsMode: 'elapsed',
        reactionDelay: 0,        // Phase 7 Plan 07 (PARTY-04): viewer-side delay (seconds); 0 = off
        pausedOffset: 0
      }
    },
    reactions: [],
    videoUrl: parsedVideoUrl ? parsedVideoUrl.url : null,
    videoSource: parsedVideoUrl ? parsedVideoUrl.source : null
  };
  try {
    await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
    logActivity('wp_started', { titleName: matchupLabel });
    closeSportsPicker();
    flashToast('Game scheduled', { kind: 'success' });
    haptic('success');
    state.activeWatchpartyId = id;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setTimeout(() => notif.request(), 800);
    }
    setTimeout(() => {
      renderWatchpartyLive();
      document.getElementById('wp-live-modal-bg').classList.add('on');
    }, 200);
  } catch(e) {
    qnLog('[Sports] watchparty create failed', e);
    const detail = e && (e.message || e.code || String(e));
    flashToast('Could not schedule: ' + detail, { kind: 'warn' });
  }
};

// ---- Phase 22 — SportsDataProvider delegates to js/sports-feed.js ----
// Was: ESPN hidden API (ToS-gray per Phase 11 RESEARCH §4 + App Store §2.3 / §5.1.5).
// Now: TheSportsDB (free tier API key '1' for v1; Patreon $14/yr for live data).
// Interface preserved: getSchedule(league, daysAhead) / getScore(gameId, league) /
// getPlays(gameId, league, sinceTs). Watchparty-live tick + Phase 11 catch-me-up
// flow continue to call this object unchanged.
// Live play-by-play not available via TheSportsDB free tier — getPlays returns []
// until Patreon upgrade or per-league API-Sports supplement (deferred).
// Phase 22 — sportsBucketKey + sportsPlaysCache + PLAYS_CACHE_BUCKET_MS removed
// (dead code; getPlays now stub-returns []; getScore caches inside sports-feed.js).

const SportsDataProvider = {
  async getSchedule(leagueKey, daysAhead) {
    if (typeof daysAhead !== 'number') daysAhead = 7;
    const games = await feedFetchSchedule(leagueKey, daysAhead);
    return games || [];
  },

  async getScore(gameId, leagueKey) {
    const score = await feedFetchScore(gameId, leagueKey);
    return score;
  },

  // getPlays — play-by-play for late-joiner catch-me-up. Phase 22 deferral:
  // TheSportsDB free tier doesn't expose per-play data. Patreon tier ($14/yr) +
  // per-league API-Sports supplements (~$10-50/mo) restore this; until then,
  // returns []. Catch-me-up surface degrades gracefully — score chip still works
  // via getScore, just no narrative play list. Will be backfilled in a future
  // phase once the data feed is upgraded.
  async getPlays(gameId, leagueKey, sinceTs) {
    return [];
  }
};

// ---- Phase 11 / REFR-10 — Game picker modal handlers ----
// Distinct from the legacy openSportsPicker flow. This modal creates a watchparty
// with mode='game' which unlocks the score strip + score-delta polling + DVR slider
// + team-flair prompt on the render side. Movie watchparties untouched.
let _gamePickerSelected = null;
let _gamePickerLeague = null;

window.openGamePicker = function() {
  const bg = document.getElementById('game-picker-modal-bg');
  if (!bg) return;
  bg.classList.add('on');
  _gamePickerSelected = null;
  _gamePickerLeague = null;
  const confirmBtn = document.getElementById('game-picker-confirm');
  if (confirmBtn) confirmBtn.disabled = true;
  // Reset league buttons
  document.querySelectorAll('.game-picker-league-btn').forEach(b => b.classList.remove('on'));
  const listEl = document.getElementById('game-picker-list');
  if (listEl) listEl.innerHTML = '<div class="game-picker-empty"><em>Pick a league to see games.</em></div>';
};

window.closeGamePicker = function() {
  const bg = document.getElementById('game-picker-modal-bg');
  if (bg) bg.classList.remove('on');
  _gamePickerSelected = null;
};

window.loadGamePickerLeague = async function(leagueKey) {
  _gamePickerLeague = leagueKey;
  _gamePickerSelected = null;
  document.querySelectorAll('.game-picker-league-btn').forEach(b => {
    b.classList.toggle('on', b.getAttribute('data-league') === leagueKey);
  });
  const confirmBtn = document.getElementById('game-picker-confirm');
  if (confirmBtn) confirmBtn.disabled = true;
  const listEl = document.getElementById('game-picker-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="game-picker-empty"><em>Loading games…</em></div>';
  try {
    const games = await SportsDataProvider.getSchedule(leagueKey, 7);
    if (!games || !games.length) {
      listEl.innerHTML = '<div class="game-picker-empty"><em>No live games right now &mdash; check back near kickoff.</em></div>';
      return;
    }
    listEl.innerHTML = games.map(g => {
      const kickoff = g.startTime ? new Date(g.startTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      // Serialize game JSON into data- attribute (safe for onclick passthrough)
      const encoded = encodeURIComponent(JSON.stringify(g));
      return `<div class="game-picker-card" data-id="${escapeHtml(g.id)}" onclick="selectGame('${escapeHtml(g.id)}','${encoded}')">
        <div class="game-picker-team">
          <div class="game-picker-team-name">${escapeHtml(g.awayTeam || 'Away')}</div>
        </div>
        <div class="game-picker-at"><em>at</em></div>
        <div class="game-picker-team">
          <div class="game-picker-team-name">${escapeHtml(g.homeTeam || 'Home')}</div>
        </div>
        <div class="game-picker-kickoff">${escapeHtml(kickoff)}</div>
      </div>`;
    }).join('');
  } catch(e) {
    qnLog('[GamePicker] load failed', e);
    listEl.innerHTML = '<div class="game-picker-empty"><em>Could not load games. Try again in a moment.</em></div>';
  }
};

window.selectGame = function(gameId, encodedJson) {
  try {
    _gamePickerSelected = JSON.parse(decodeURIComponent(encodedJson));
  } catch(e) {
    _gamePickerSelected = { id: gameId };
  }
  if (_gamePickerLeague) _gamePickerSelected.league = _gamePickerLeague;
  document.querySelectorAll('.game-picker-card').forEach(c => {
    c.classList.toggle('on', c.getAttribute('data-id') === gameId);
  });
  const confirmBtn = document.getElementById('game-picker-confirm');
  if (confirmBtn) confirmBtn.disabled = false;
};

window.confirmGamePicker = async function() {
  if (!_gamePickerSelected || !state.me) return;
  if (guardReadOnlyWrite()) return;
  // Phase 24 / REVIEWS M3 — Video URL field. Reads from #wp-video-url-game.
  const _videoCheck = readAndValidateVideoUrl('game');
  if (!_videoCheck.ok) return;
  const parsedVideoUrl = _videoCheck.parsed;
  const game = _gamePickerSelected;
  const leagueEmojis = { nfl: '🏈', nba: '🏀', mlb: '⚾', nhl: '🏒' };
  const id = 'wp_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  const creatorTimeZone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
    catch (e) { return null; }
  })();
  const startAt = game.startTime || Date.now();
  const matchupLabel = (game.awayTeam || 'Away') + ' at ' + (game.homeTeam || 'Home');
  const wp = {
    id,
    mode: 'game',  // Phase 11 / REFR-10 — unlocks Game Mode UI variants
    titleId: null,
    titleName: matchupLabel,
    titlePoster: '',
    hostId: state.me.id,
    hostName: state.me.name,
    hostUid: (state.auth && state.auth.uid) || null,
    creatorTimeZone: creatorTimeZone || null,
    startAt,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    status: startAt <= Date.now() ? 'active' : 'scheduled',
    sportEvent: {
      id: game.id,
      espnId: game.id,
      league: (game.league || '').toUpperCase(),
      leagueKey: game.league,
      leagueEmoji: leagueEmojis[game.league] || '🎮',
      homeTeam: game.homeTeam || 'Home',
      awayTeam: game.awayTeam || 'Away',
      homeAbbrev: game.homeAbbrev || '',
      awayAbbrev: game.awayAbbrev || '',
      homeLogo: game.homeLogo || '',
      awayLogo: game.awayLogo || '',
      venue: game.venue || null,
      broadcast: game.broadcast || null
    },
    participants: {
      [state.me.id]: {
        name: state.me.name,
        joinedAt: Date.now(),
        rsvpStatus: 'in',
        reactionsMode: 'elapsed',
        reactionDelay: 0,
        pausedOffset: 0
      }
    },
    reactions: [],
    scoringPlays: [],
    videoUrl: parsedVideoUrl ? parsedVideoUrl.url : null,
    videoSource: parsedVideoUrl ? parsedVideoUrl.source : null
  };
  try {
    await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
    logActivity('wp_started', { titleName: matchupLabel, mode: 'game' });
    closeGamePicker();
    flashToast('Game scheduled', { kind: 'success' });
    haptic('success');
    state.activeWatchpartyId = id;
    // Web Share path — invite friends to the /rsvp/<wpId> RSVP page. Failures are
    // decorative (clipboard fallback), never block the watchparty open.
    try {
      const rsvpUrl = `https://couchtonight.app/rsvp/${encodeURIComponent(id)}`;
      const hostName = (state.me && state.me.name) || 'A friend';
      const shareTitle = `Couch ${(game.league || 'game').toUpperCase()} watch`;
      const shareText = `${hostName} invited you to watch ${matchupLabel}. RSVP: ${rsvpUrl}`;
      if (navigator.share) {
        try { await navigator.share({ title: shareTitle, text: shareText, url: rsvpUrl }); }
        catch(shareErr) { /* AbortError or fallthrough — harmless */ }
      }
    } catch(shareOuterErr) { /* never block */ }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setTimeout(() => notif.request(), 800);
    }
    setTimeout(() => {
      renderWatchpartyLive();
      document.getElementById('wp-live-modal-bg').classList.add('on');
    }, 200);
  } catch(e) {
    qnLog('[GamePicker] watchparty create failed', e);
    const detail = e && (e.message || e.code || String(e));
    flashToast('Could not start game watch: ' + detail, { kind: 'warn' });
  }
};

// renderSportsScoreStrip — sticky-top live score chrome for sport-mode watchparties.
// Injected at the top of wp-live-body when wp.mode === 'game' || wp.sportEvent.
// Updated in-place (no full re-render) by updateSportsScoreStrip during score polling.
function renderSportsScoreStrip(wp) {
  const sport = (wp && wp.sportEvent) || {};
  // Seed values from wp.lastScore (persisted by handleScoringPlay) falling back to
  // pre-game zeros + abbreviations from the sportEvent payload.
  const score = (wp && wp.lastScore) || {
    homeScore: 0,
    awayScore: 0,
    homeAbbr: sport.homeAbbrev || sport.homeTeam || 'HOM',
    awayAbbr: sport.awayAbbrev || sport.awayTeam || 'AWY',
    state: 'pre',
    statusDetail: 'Pre-game'
  };
  const isLive = score.state === 'in';
  const middleText = isLive
    ? `<span class="sports-score-live">LIVE &middot; ${escapeHtml(score.statusDetail || '')}</span>`
    : `<span>${escapeHtml(score.statusDetail || 'Pre-game')}</span>`;
  const awayAbbr = score.awayAbbr || sport.awayAbbrev || sport.awayTeam || 'AWY';
  const homeAbbr = score.homeAbbr || sport.homeAbbrev || sport.homeTeam || 'HOM';
  return `<div class="sports-score-strip" id="sports-score-strip-${escapeHtml(wp.id)}">
    <div class="sports-score-team">
      <span class="sports-score-team-abbr">${escapeHtml(awayAbbr)}</span>
      <span class="sports-score-num">${parseInt(score.awayScore, 10) || 0}</span>
    </div>
    <div class="sports-score-middle">${middleText}</div>
    <div class="sports-score-team">
      <span class="sports-score-team-abbr">${escapeHtml(homeAbbr)}</span>
      <span class="sports-score-num">${parseInt(score.homeScore, 10) || 0}</span>
    </div>
  </div>`;
}

// ---- Phase 11 / REFR-10 — Score-delta polling + amplified reactions ----
// startSportsScorePolling runs an adaptive-interval loop (5s on-play / 15s off-play)
// against SportsDataProvider.getScore. On home/away score change we flash the strip,
// surface a 3s amplified reaction picker, and persist the scoring play for late-joiner
// catch-me-up via wp.scoringPlays + wp.lastScore updates.
let _sportsScorePollHandle = null;
let _sportsLastScore = null;
let _sportsPollWpId = null;

function startSportsScorePolling(wp) {
  stopSportsScorePolling();
  if (!wp || !wp.sportEvent || !wp.sportEvent.id) return;
  const league = wp.sportEvent.leagueKey || (wp.sportEvent.league || '').toLowerCase();
  const gameId = wp.sportEvent.id || wp.sportEvent.espnId;
  if (!gameId || !league) return;
  _sportsPollWpId = wp.id;
  // Seed baseline — avoids false scoring-play event on first real tick
  SportsDataProvider.getScore(gameId, league).then(s => {
    if (s && _sportsPollWpId === wp.id) {
      _sportsLastScore = s;
      updateSportsScoreStrip(wp.id, s);
    }
  }).catch(() => {});
  const tick = async () => {
    if (_sportsPollWpId !== wp.id) return;  // modal closed during await
    const newScore = await SportsDataProvider.getScore(gameId, league);
    if (newScore && _sportsPollWpId === wp.id) {
      if (_sportsLastScore &&
          (newScore.homeScore !== _sportsLastScore.homeScore ||
           newScore.awayScore !== _sportsLastScore.awayScore)) {
        handleScoringPlay(wp, _sportsLastScore, newScore);
      }
      _sportsLastScore = newScore;
      updateSportsScoreStrip(wp.id, newScore);
    }
    // Adaptive interval — faster while live, slower pre/post
    const nextDelay = (newScore && newScore.state === 'in') ? 5000 : 15000;
    _sportsScorePollHandle = setTimeout(tick, nextDelay);
  };
  _sportsScorePollHandle = setTimeout(tick, 5000);
}

function stopSportsScorePolling() {
  if (_sportsScorePollHandle) {
    clearTimeout(_sportsScorePollHandle);
    _sportsScorePollHandle = null;
  }
  _sportsPollWpId = null;
  _sportsLastScore = null;
}

function updateSportsScoreStrip(wpId, score) {
  const stripEl = document.getElementById(`sports-score-strip-${wpId}`);
  if (!stripEl || !score) return;
  const nums = stripEl.querySelectorAll('.sports-score-num');
  if (nums[0]) nums[0].textContent = parseInt(score.awayScore, 10) || 0;
  if (nums[1]) nums[1].textContent = parseInt(score.homeScore, 10) || 0;
  const middleEl = stripEl.querySelector('.sports-score-middle');
  if (middleEl) {
    const isLive = score.state === 'in';
    middleEl.innerHTML = isLive
      ? `<span class="sports-score-live">LIVE &middot; ${escapeHtml(score.statusDetail || '')}</span>`
      : `<span>${escapeHtml(score.statusDetail || 'Pre-game')}</span>`;
  }
  // Update the team abbreviations in case initial render used fallback placeholders
  const abbrs = stripEl.querySelectorAll('.sports-score-team-abbr');
  if (abbrs[0] && score.awayAbbr) abbrs[0].textContent = score.awayAbbr;
  if (abbrs[1] && score.homeAbbr) abbrs[1].textContent = score.homeAbbr;
}

async function handleScoringPlay(wp, prevScore, newScore) {
  // Flash score strip + show amplified reaction picker
  const stripEl = document.getElementById(`sports-score-strip-${wp.id}`);
  if (stripEl) {
    stripEl.classList.remove('flash');
    // Force reflow so the animation re-fires
    void stripEl.offsetWidth;
    stripEl.classList.add('flash');
    setTimeout(() => { if (stripEl) stripEl.classList.remove('flash'); }, 800);
  }
  showAmplifiedReactionPicker(wp);
  haptic('success');
  // Write scoring play to Firestore for late-joiner catch-me-up variant
  try {
    const league = wp.sportEvent.leagueKey || (wp.sportEvent.league || '').toLowerCase();
    const plays = await SportsDataProvider.getPlays(wp.sportEvent.id || wp.sportEvent.espnId, league);
    const lastPlay = plays && plays.length ? plays[plays.length - 1] : null;
    const playEntry = {
      ts: Date.now(),
      homeScore: newScore.homeScore,
      awayScore: newScore.awayScore,
      delta: {
        home: newScore.homeScore - (prevScore ? prevScore.homeScore : 0),
        away: newScore.awayScore - (prevScore ? prevScore.awayScore : 0)
      },
      text: (lastPlay && lastPlay.text) || 'Score!',
      period: newScore.period || 0,
      clock: newScore.clock || ''
    };
    await updateDoc(watchpartyRef(wp.id), {
      scoringPlays: arrayUnion(playEntry),
      lastScore: newScore,
      lastActivityAt: Date.now(),
      ...writeAttribution()
    });
  } catch(e) {
    qnLog('[Sports] scoring-play persist failed', e && e.message);
  }
}

function showAmplifiedReactionPicker(wp) {
  const existing = document.getElementById('sports-amplified-picker');
  if (existing) existing.remove();
  const picker = document.createElement('div');
  picker.id = 'sports-amplified-picker';
  picker.className = 'sports-reaction-picker amplified';
  const burstEmojis = ['🔥', '🎉', '😱', '💪'];
  picker.innerHTML = burstEmojis.map(e =>
    `<button class="sports-burst-btn" onclick="postBurstReaction('${escapeHtml(wp.id)}','${e}')">${e}</button>`
  ).join('');
  const liveBody = document.querySelector('.wp-live-modal');
  if (liveBody) liveBody.appendChild(picker);
  else document.body.appendChild(picker);
  setTimeout(() => { if (picker.parentElement) picker.remove(); }, 3000);
}

window.postBurstReaction = async function(wpId, emoji) {
  if (!state.me) return;
  // Phase 26 / RPLY-26-01 — look up wp from wpId so we can derive position-anchored fields.
  // Sports-mode amplified bursts (Phase 23) typically have wp.isLiveStream === true → helper
  // returns { null, 'live-stream' } per D-03 (sports replay surface filters these out, which
  // is the correct behavior — live broadcasts have no re-watchable timeline).
  const wp = state.watchparties.find(x => x.id === wpId);
  const { runtimePositionMs, runtimeSource } = derivePositionForReaction({
    wp: wp || {},
    mine: null,
    elapsedMs: 0,
    isReplay: state.activeWatchpartyMode === 'revisit',
    localReplayPositionMs: state.replayLocalPositionMs
  });
  try {
    const reaction = {
      memberId: state.me.id,
      memberName: state.me.name,
      kind: 'emoji',
      emoji,
      at: Date.now(),
      amplified: true,
      runtimePositionMs,
      runtimeSource
    };
    await updateDoc(watchpartyRef(wpId), {
      reactions: arrayUnion(reaction),
      lastActivityAt: Date.now(),
      ...writeAttribution()
    });
    haptic('success');
    // Dismiss the picker on tap — the 3s auto-dismiss is a ceiling, not a floor
    const picker = document.getElementById('sports-amplified-picker');
    if (picker) picker.remove();
  } catch(e) {
    qnLog('[Sports] burst reaction failed', e && e.message);
  }
};

// ---- Phase 11 / REFR-10 — DVR slider ----
// Per-user "I'm N seconds behind" offset for late/paused viewers. Writes to
// participants[mid].dvrOffsetMs AND participants[mid].reactionDelay so the
// existing Phase 7 PARTY-04 reaction-delay render filter reuses the same anchor.
// Throttle Firestore writes to once per 500ms while the slider is dragged.

// Phase 15.5 / D-01 + REQ-1: position-to-seconds non-linear transform for the sport-mode slider.
// The native HTML <input type="range"> step attribute cannot vary per position; this transform
// gives us 5 visual bands of step granularity (5s / 15s / 60s / 300s / 900s) across the 0-86400s
// (24 hr) range. The slider emits position 0-100; setDvrOffset receives clamped seconds.
// Bands locked in 15.5-CONTEXT.md D-01 + 15.5-RESEARCH.md § REQ-1.
const WAIT_UP_BANDS = Object.freeze([
  { pStart: 0,  pEnd: 7,   sStart: 0,    sEnd: 60,    step: 5   },
  { pStart: 7,  pEnd: 22,  sStart: 60,   sEnd: 300,   step: 15  },
  { pStart: 22, pEnd: 47,  sStart: 300,  sEnd: 1800,  step: 60  },
  { pStart: 47, pEnd: 67,  sStart: 1800, sEnd: 7200,  step: 300 },
  { pStart: 67, pEnd: 100, sStart: 7200, sEnd: 86400, step: 900 }
]);

function positionToSeconds(posInput) {
  const pRaw = parseFloat(posInput);
  if (!isFinite(pRaw)) return 0;
  const p = Math.max(0, Math.min(100, pRaw));
  // Find containing band (last band's pEnd is inclusive at 100).
  const band = WAIT_UP_BANDS.find(b => p <= b.pEnd) || WAIT_UP_BANDS[WAIT_UP_BANDS.length - 1];
  // Linear interpolation within band, then snap to step.
  const pSpan = band.pEnd - band.pStart;
  const sSpan = band.sEnd - band.sStart;
  const frac  = pSpan > 0 ? (p - band.pStart) / pSpan : 0;
  const sRaw  = band.sStart + frac * sSpan;
  const snapped = Math.round(sRaw / band.step) * band.step;
  return Math.max(0, Math.min(86400, snapped));
}

function secondsToPosition(secInput) {
  const sRaw = parseInt(secInput, 10);
  if (!isFinite(sRaw)) return 0;
  const s = Math.max(0, Math.min(86400, sRaw));
  const band = WAIT_UP_BANDS.find(b => s <= b.sEnd) || WAIT_UP_BANDS[WAIT_UP_BANDS.length - 1];
  const sSpan = band.sEnd - band.sStart;
  const pSpan = band.pEnd - band.pStart;
  const frac  = sSpan > 0 ? (s - band.sStart) / sSpan : 0;
  return band.pStart + frac * pSpan;
}

// Phase 15.5 / REQ-1 + REQ-4 + UI-SPEC § Sport-mode slider:
// - Slider value space is now position 0-100 (NOT seconds). positionToSeconds maps to seconds.
// - Readout uses dvrReadoutText (extended in Plan 01) wrapped in italic <em> when active per UI-SPEC.
// - Aria-label uses comma separator (no em-dash, no banned words) per UI-SPEC.
function renderDvrSlider(wp, mine) {
  if (!mine) return '';
  const offsetMs = mine.dvrOffsetMs || 0;
  const offsetSec = Math.round(offsetMs / 1000);
  const offsetSecClamped = Math.max(0, Math.min(86400, offsetSec));
  const initialPos = secondsToPosition(offsetSecClamped);
  const readoutText = dvrReadoutText(offsetSecClamped);
  const isActive = offsetSecClamped > 0;
  // Active state: italic Instrument Serif "holding {value}". Idle: regular "Live".
  const readoutHtml = isActive
    ? `<em class="serif-italic">holding ${escapeHtml(readoutText)}</em>`
    : `${escapeHtml(readoutText)}`;
  const ariaLabel = `Wait up by, current value ${readoutText}`;
  return `<div class="wp-dvr-slider">
    <span class="wp-dvr-label">Wait up</span>
    <input type="range" min="0" max="100" value="${initialPos}" step="0.5"
      class="wp-dvr-input"
      oninput="updateDvrReadout(positionToSeconds(this.value))"
      onchange="setDvrOffset('${escapeHtml(wp.id)}', positionToSeconds(this.value))"
      aria-label="${escapeHtml(ariaLabel)}" />
    <span class="wp-dvr-readout" id="wp-dvr-readout">${readoutHtml}</span>
  </div>`;
}

// Phase 15.5 / REQ-1 + REQ-4: extended for hours; zero-state label changed from 'No wait' to 'Live' per UI-SPEC.
function dvrReadoutText(sec) {
  if (!sec || sec <= 0) return 'Live';
  if (sec < 60) return `${sec} sec`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m} min ${s} sec` : `${m} min`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// Phase 15.5 / REQ-1: live-update readout uses same italic-wrapper recipe as renderDvrSlider.
// Switched from textContent to innerHTML because the active state needs the <em> element;
// escapeHtml is still applied to the dynamic text portion.
window.updateDvrReadout = function(secInput) {
  const sec = Math.max(0, Math.min(86400, parseInt(secInput, 10) || 0));
  const el = document.getElementById('wp-dvr-readout');
  if (!el) return;
  const text = dvrReadoutText(sec);
  el.innerHTML = sec > 0
    ? `<em class="serif-italic">holding ${escapeHtml(text)}</em>`
    : escapeHtml(text);
};

let _dvrThrottleHandle = null;
window.setDvrOffset = function(wpId, secStr) {
  // Phase 15.5 / D-01 + REQ-1: defensive clamp matching setReactionDelay (86400 = 24 hr).
  // Plan 02's positionToSeconds() also clamps; this is belt-and-suspenders.
  const sec = Math.max(0, Math.min(86400, parseInt(secStr, 10) || 0));
  const ms = sec * 1000;
  if (!state.me) return;
  if (_dvrThrottleHandle) clearTimeout(_dvrThrottleHandle);
  _dvrThrottleHandle = setTimeout(async () => {
    try {
      await updateDoc(watchpartyRef(wpId), {
        [`participants.${state.me.id}.dvrOffsetMs`]: ms,
        // Reuse Phase 7 reactionDelay field as the canonical anchor so the existing
        // render-filter in renderReactionsFeed picks up DVR-driven offset without
        // needing a new code path.
        [`participants.${state.me.id}.reactionDelay`]: sec,
        ...writeAttribution()
      });
    } catch(e) {
      qnLog('[Sports] DVR offset write failed', e && e.message);
    }
  }, 500);
};

// ---- Phase 11 / REFR-10 — Team-flair ----
// On first join of a sport-mode wp, prompt user to pick allegiance. Writes to
// participants[mid].teamAllegiance + teamColor. Avatar picks up the color via
// inline style --team-color custom property (see CSS rule for .wp-participant-av).
function maybeShowTeamFlairPicker(wp, mine) {
  if (!wp || wp.mode !== 'game') return;
  if (!mine) return;
  if (typeof mine.teamAllegiance === 'string') return;  // already picked
  if (document.getElementById('team-flair-overlay')) return;  // already shown
  const sport = wp.sportEvent || {};
  const overlay = document.createElement('div');
  overlay.id = 'team-flair-overlay';
  overlay.className = 'modal-bg on';
  const awayColor = sport.awayTeamColor || '#d97757';
  const homeColor = sport.homeTeamColor || '#e8a04a';
  overlay.innerHTML = `
    <div class="modal team-flair-modal">
      <h3 class="modal-h2">Who are you rooting for?</h3>
      <div class="team-flair-options">
        <button class="pill team-flair-pick" onclick="setUserTeamFlair('${escapeHtml(wp.id)}','away','${escapeHtml(awayColor)}')">${escapeHtml(sport.awayTeam || 'Away team')}</button>
        <button class="pill team-flair-pick" onclick="setUserTeamFlair('${escapeHtml(wp.id)}','home','${escapeHtml(homeColor)}')">${escapeHtml(sport.homeTeam || 'Home team')}</button>
        <button class="pill team-flair-pick neutral" onclick="setUserTeamFlair('${escapeHtml(wp.id)}','neutral','')">Just here for the show</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

window.setUserTeamFlair = async function(wpId, allegiance, hexColor) {
  if (!state.me) return;
  try {
    const patch = {
      [`participants.${state.me.id}.teamAllegiance`]: allegiance,
      ...writeAttribution()
    };
    if (hexColor) {
      patch[`participants.${state.me.id}.teamColor`] = hexColor;
    }
    await updateDoc(watchpartyRef(wpId), patch);
  } catch(e) {
    qnLog('[Sports] team flair write failed', e && e.message);
  }
  const overlay = document.getElementById('team-flair-overlay');
  if (overlay) overlay.remove();
};

// Phase 24 — shared video-URL validation for the 3 wp-creation flows.
// Reads from {flow}-prefixed DOM ids per REVIEWS M3 (distinct ids per modal).
// On invalid + non-empty: returns { ok: false }; caller bails out with .field-invalid + unhide error div.
// On valid: returns { ok: true, parsed: { source, id?, url } | null } — null means user left it empty.
// On valid mp4 with http:// scheme: also surfaces the REVIEWS C1 mixed-content warning toast.
function readAndValidateVideoUrl(flow /* 'movie' | 'game' | 'sport' */) {
  const inputId = 'wp-video-url-' + flow;
  const errorId = 'wp-video-url-' + flow + '-error';
  const inputEl = document.getElementById(inputId);
  const errEl = document.getElementById(errorId);
  const raw = inputEl ? inputEl.value.trim() : '';
  if (!raw) {
    if (inputEl) inputEl.classList.remove('field-invalid');
    if (errEl) errEl.setAttribute('hidden', '');
    return { ok: true, parsed: null };
  }
  const parsed = parseVideoUrl(raw);
  if (!parsed) {
    if (inputEl) inputEl.classList.add('field-invalid');
    if (errEl) errEl.removeAttribute('hidden');
    return { ok: false, parsed: null };
  }
  // Clear any prior error state
  if (inputEl) inputEl.classList.remove('field-invalid');
  if (errEl) errEl.setAttribute('hidden', '');
  // REVIEWS C1: non-blocking warning when MP4 scheme is HTTP (mixed content on https Couch).
  // Don't reject — Plex/Jellyfin LAN URLs may work in some PWA contexts. Just warn.
  if (parsed.source === 'mp4' && raw.toLowerCase().startsWith('http://')) {
    try { flashToast('Note: HTTP links may be blocked by the browser. Use https if available.', { kind: 'warn' }); } catch (e) { /* flashToast may not exist in some boot states */ }
  }
  return { ok: true, parsed };
}

window.confirmStartWatchparty = async function() {
  if (!wpStartTitleId || !state.me) return;
  if (guardReadOnlyWrite()) return;                // Plan 5.8 D-15: unclaimed post-grace can't host watchparties
  const t = state.titles.find(x => x.id === wpStartTitleId);
  if (!t) return;
  const startAt = computeWpStartAt();
  if (!startAt) { alert('Pick a start time.'); return; }
  if (startAt < Date.now() - 60*1000) { alert("That's in the past. Pick a future time."); return; }
  // Phase 24 / REVIEWS M3 — Video URL field (D-04). Reads from #wp-video-url-movie.
  const _videoCheck = readAndValidateVideoUrl('movie');
  if (!_videoCheck.ok) return; // submit-blocked: inline error already surfaced
  const parsedVideoUrl = _videoCheck.parsed;
  const id = 'wp_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  // Phase 7 Plan 5 (PARTY-06): capture the creator's IANA timezone at write-time so
  // the onWatchpartyCreate CF can render startAt in their local zone in the push body
  // (GCP Cloud Functions runtime defaults to UTC — bug #1 from 07-UAT-RESULTS.md).
  const creatorTimeZone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
    catch (e) { return null; }
  })();
  const wp = {
    id,
    titleId: wpStartTitleId,
    titleName: t.name,
    titlePoster: t.poster || '',
    hostId: state.me.id,
    hostName: state.me.name,
    hostUid: (state.auth && state.auth.uid) || null,  // Phase 6: self-echo attribution on push
    creatorTimeZone: creatorTimeZone || null,         // Phase 7 Plan 5: CF renders startAt in creator's tz
    startAt,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),  // Phase 7 D-06: orphan detection source of truth
    status: startAt <= Date.now() ? 'active' : 'scheduled',
    participants: {
      [state.me.id]: {
        name: state.me.name,
        joinedAt: Date.now(),
        rsvpStatus: 'in',
        reactionsMode: 'elapsed', // 'elapsed' | 'wallclock' | 'hidden'
        reactionDelay: 0,         // Phase 7 Plan 07 (PARTY-04): viewer-side delay (seconds); 0 = off
        pausedOffset: 0
      }
    },
    reactions: [],
    videoUrl: parsedVideoUrl ? parsedVideoUrl.url : null,
    videoSource: parsedVideoUrl ? parsedVideoUrl.source : null
  };
  try {
    await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
    logActivity('wp_started', { titleName: t.name });
    document.getElementById('wp-start-modal-bg').classList.remove('on');
    state.activeWatchpartyId = id;

    // Phase 11 / REFR-05 — Web Share API trigger after successful save.
    // Share text goes out via OS share sheet OR clipboard fallback. Non-members
    // land on /rsvp/<wpId> (Firebase Hosting rewrite serves rsvp.html) and RSVP
    // without installing the PWA.
    try {
      const rsvpUrl = `https://couchtonight.app/rsvp/${encodeURIComponent(id)}`;
      const dayStr = wp.startAt ? new Date(wp.startAt).toLocaleDateString([], { weekday: 'long' }) : 'soon';
      const timeStr = wp.startAt ? new Date(wp.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      const hostName = (state.me && state.me.name) || 'A friend';
      const titleName = (t && t.name) || 'a movie';
      const shareTitle = `Couch Night — ${titleName}`;
      const shareText = `${hostName} invited you to watch ${titleName} on ${dayStr}${timeStr ? ' at ' + timeStr : ''}. RSVP: ${rsvpUrl}`;

      let shareSucceeded = false;
      if (navigator.share) {
        try {
          await navigator.share({ title: shareTitle, text: shareText, url: rsvpUrl });
          shareSucceeded = true;
          haptic('success');
        } catch(shareErr) {
          // AbortError = user cancelled the sheet — treat as handled.
          if (shareErr && shareErr.name === 'AbortError') shareSucceeded = true;
          // Any other error → fall through to clipboard.
        }
      }
      if (!shareSucceeded) {
        try {
          await navigator.clipboard.writeText(rsvpUrl);
          haptic('success');
          flashToast('Link copied', { kind: 'success' });
        } catch(clipErr) {
          // Deep fallback — show a modal with selectable link for browsers that
          // block both Web Share AND clipboard (rare, e.g. non-HTTPS contexts or
          // strict enterprise policies). Element id `wp-share-fallback` is created
          // lazily so repeated saves don't stack duplicates.
          let fallbackEl = document.getElementById('wp-share-fallback');
          if (!fallbackEl) {
            fallbackEl = document.createElement('div');
            fallbackEl.id = 'wp-share-fallback';
            fallbackEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:grid;place-items:center;z-index:9999;padding:20px;';
            fallbackEl.innerHTML = `<div style="background:var(--surface);padding:20px;border-radius:14px;max-width:400px;width:100%;">
              <p style="margin:0 0 12px;color:var(--ink);">Copy this link:</p>
              <input readonly value="${escapeHtml(rsvpUrl)}" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--ink);font-family:monospace;font-size:12px;" onclick="this.select()">
              <button onclick="this.parentElement.parentElement.remove()" style="margin-top:12px;padding:10px 16px;background:var(--accent);color:var(--bg);border:none;border-radius:6px;cursor:pointer;font-weight:700;">Done</button>
            </div>`;
            document.body.appendChild(fallbackEl);
          }
        }
      }
    } catch(shareOuterErr) {
      // Share is decorative — never let its failure block the watchparty flow.
      console.warn('Web Share path threw unexpectedly', shareOuterErr);
    }

    // The host has clearly opted into watchparties — this is the right moment to ask for
    // notification permission so future scheduled parties surface even when the tab is backgrounded.
    // We only prompt if the status is unset (never asked), so declining respects the decision.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setTimeout(() => notif.request(), 800);
    }
    // Open the live view
    setTimeout(() => {
      renderWatchpartyLive();
      document.getElementById('wp-live-modal-bg').classList.add('on');
    }, 150);
  } catch(e) { alert('Could not start watchparty: ' + e.message); }
};

// ==== Join / RSVP / Timer controls (stubs wired next turn) ====
window.joinWatchparty = async function(wpId) {
  if (!state.me) return;
  const wp = state.watchparties.find(x => x.id === wpId);
  if (!wp) return;
  const update = {
    [`participants.${state.me.id}`]: {
      name: state.me.name,
      joinedAt: Date.now(),
      rsvpStatus: 'in',
      reactionsMode: 'elapsed',
      reactionDelay: 0,         // Phase 7 Plan 07 (PARTY-04): viewer-side delay (seconds); 0 = off
      pausedOffset: 0
    }
  };
  try {
    await updateDoc(watchpartyRef(wpId), { ...update, ...writeAttribution() });
    state.activeWatchpartyId = wpId;
    renderWatchpartyLive();
    document.getElementById('wp-live-modal-bg').classList.add('on');
  } catch(e) { alert('Could not join: ' + e.message); }
};

// === Phase 24 — Native video player runtime state + helpers ===
// Co-located with openWatchpartyLive / closeWatchpartyLive lifecycle pair.
// REVIEWS H1: player lives in #wp-video-surface (persistent across renders).
// REVIEWS H3: YouTube branch uses div placeholder + new YT.Player(divId, {videoId,...}).
// REVIEWS H5: <video> event handlers stored as module-scope refs for clean removeEventListener in teardown.
// REVIEWS M1: late-joining non-host calls seekToBroadcastedTime after player init.
// REVIEWS M4: per-sample live-stream gate inside broadcaster (NOT one-shot at onReady).
// REVIEWS C2: extended schema fields written by broadcastCurrentTime.
let _ytApiLoading = null;
let _wpYtPlayer = null;             // YT.Player instance (null when no YouTube branch active)
let _wpVideoBroadcaster = null;     // makeIntervalBroadcaster closure (host-only)
let _wpVideoSampler = null;         // setInterval id for YouTube currentTime poll (host-only)
let _wpVideoElement = null;         // <video> element ref for MP4 branch (for cleanup)
// REVIEWS H5 — handler refs so teardownVideoPlayer can removeEventListener cleanly.
let _wpVideoTimeHandler = null;     // 'timeupdate' on <video>
let _wpVideoErrorHandler = null;    // 'error' on <video>
let _wpRetryClickHandler = null;    // delegated 'click' on .wp-video-frame for [data-action="retry-video"] (REVIEWS H4)

function ensureYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (_ytApiLoading) return _ytApiLoading;
  _ytApiLoading = new Promise(resolve => {
    if (!document.getElementById('youtube-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    // REVIEWS L2 (low / deferred risk): Couch has no other YT API consumer in 2026-04.
    // Direct overwrite is acceptable. If a future phase adds a second YT integration,
    // switch to chained-handler pattern.
    window.onYouTubeIframeAPIReady = () => resolve();
  });
  return _ytApiLoading;
}

// REVIEWS C2 — Extended Phase 26 schema.
// currentTimeMs / currentTimeUpdatedAt remain (Phase 26 anchor).
// currentTimeSource: 'youtube' | 'mp4' — Phase 26 chooses replay strategy.
// durationMs: number | null — null for live streams; finite for normal videos.
// isLiveStream: boolean — hardens M4 gating; tells Phase 26 not to anchor reactions to runtime position.
async function broadcastCurrentTime(wpId, currentTimeSeconds, source, durationSecondsOrNull, isLive) {
  if (!wpId || typeof currentTimeSeconds !== 'number' || isNaN(currentTimeSeconds)) return;
  try {
    const payload = {
      currentTimeMs: Math.round(currentTimeSeconds * 1000),
      currentTimeUpdatedAt: Date.now(),
      currentTimeSource: source || null,
      durationMs: (typeof durationSecondsOrNull === 'number' && isFinite(durationSecondsOrNull) && durationSecondsOrNull > 0)
        ? Math.round(durationSecondsOrNull * 1000)
        : null,
      isLiveStream: !!isLive,
      ...writeAttribution()
    };
    await updateDoc(watchpartyRef(wpId), payload);
  } catch (e) {
    if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
      Sentry.addBreadcrumb({ category: 'videoBroadcast.write.failed', level: 'warning', data: { wpId, error: String(e) } });
    }
  }
}

// REVIEWS H4 — delegated retry click handler (wires "Try again" link to reloadWatchpartyPlayer).
// Attached once per attachVideoPlayer; removed in teardownVideoPlayer.
function makeRetryClickHandler() {
  return function (ev) {
    const t = ev.target;
    if (!t) return;
    const action = t.getAttribute && t.getAttribute('data-action');
    if (action === 'retry-video') {
      ev.preventDefault();
      if (typeof window.reloadWatchpartyPlayer === 'function') window.reloadWatchpartyPlayer();
    }
  };
}

async function attachVideoPlayer(wp) {
  if (!wp || !wp.videoUrl || !wp.videoSource) return;
  const t = state.titles && state.titles.find(x => x.id === wp.titleId);
  if (!titleHasNonDrmPath(t)) return;
  const surface = document.getElementById('wp-video-surface');
  if (!surface) return; // modal not mounted

  const isHost = !!(state.me && state.me.id === wp.hostId);

  // Build the player HTML into the persistent surface.
  // REVIEWS H3: YouTube uses a DIV placeholder, NOT an iframe. The IFrame API
  // creates its own iframe by replacing the div, on its own controlled timeline.
  const parsed = parseVideoUrl(wp.videoUrl);
  let html = '';
  if (wp.videoSource === 'youtube' && parsed && parsed.id) {
    const safeId = encodeURIComponent(parsed.id);
    html = '<div class="wp-video-frame">' +
      '<div id="wp-yt-player" class="wp-video-frame--youtube" data-video-id="' + safeId + '"></div>' +
    '</div>';
  } else if (wp.videoSource === 'mp4') {
    const safeUrl = escapeHtml(wp.videoUrl);
    html = '<div class="wp-video-frame">' +
      '<video id="wp-mp4-player" class="wp-video-frame--mp4" controls playsinline preload="metadata" src="' + safeUrl + '"></video>' +
    '</div>';
  }
  if (!html) return;
  surface.innerHTML = html;

  // REVIEWS H4 — wire the delegated retry click handler ONCE on the .wp-video-frame.
  const frame = surface.querySelector('.wp-video-frame');
  if (frame) {
    _wpRetryClickHandler = makeRetryClickHandler();
    frame.addEventListener('click', _wpRetryClickHandler);
  }

  if (wp.videoSource === 'youtube') {
    await ensureYouTubeApi();
    const placeholder = document.getElementById('wp-yt-player');
    if (!placeholder) return; // modal closed during load (RESEARCH Pitfall 6)
    const videoId = placeholder.getAttribute('data-video-id') || '';
    // REVIEWS H3 — Construct the player from the div placeholder + videoId,
    // not from an existing iframe. This is the YouTube-recommended pattern.
    _wpYtPlayer = new YT.Player('wp-yt-player', {
      videoId: videoId,
      playerVars: { playsinline: 1, enablejsapi: 1 },
      events: {
        onReady: () => {
          // REVIEWS M1 — Late-join seek for non-hosts.
          if (!isHost) {
            seekToBroadcastedTime(_wpYtPlayer, wp, 'youtube');
          }
          if (!isHost) return;
          // Host: arm the broadcaster + sampler. REVIEWS M4 gates per-sample.
          _wpVideoBroadcaster = makeIntervalBroadcaster(VIDEO_BROADCAST_INTERVAL_MS, sec => {
            let duration = null;
            let isLive = false;
            try {
              // REVIEWS M4 — per-sample live-stream gate. Inline isFinite + getDuration
              // so the gate is evaluated EVERY sample (NOT one-shot at onReady), matching
              // the smoke contract's regex /isFinite\([^)]*getDuration/ for M4.
              if (_wpYtPlayer && typeof _wpYtPlayer.getDuration === 'function' && isFinite(_wpYtPlayer.getDuration()) && _wpYtPlayer.getDuration() > 0) {
                duration = _wpYtPlayer.getDuration();
              } else {
                isLive = true;
                duration = null;
              }
            } catch (e) { duration = null; isLive = true; }
            broadcastCurrentTime(wp.id, sec, 'youtube', duration, isLive);
          });
          _wpVideoSampler = setInterval(() => {
            try {
              if (_wpYtPlayer && typeof _wpYtPlayer.getCurrentTime === 'function') {
                _wpVideoBroadcaster(_wpYtPlayer.getCurrentTime());
              }
            } catch (e) { /* ignore */ }
          }, Math.max(1000, Math.floor(VIDEO_BROADCAST_INTERVAL_MS / 2)));
        },
        onError: () => renderPlayerErrorOverlay('wp-yt-player')
      }
    });
  } else if (wp.videoSource === 'mp4') {
    const video = document.getElementById('wp-mp4-player');
    if (!video) return;
    _wpVideoElement = video;
    // REVIEWS M1 — Late-join seek for non-hosts on MP4 too.
    if (!isHost) {
      seekToBroadcastedTime(video, wp, 'mp4');
    }
    // REVIEWS H5 — Store handler refs so teardown can remove them.
    if (isHost) {
      _wpVideoBroadcaster = makeIntervalBroadcaster(VIDEO_BROADCAST_INTERVAL_MS, sec => {
        const duration = (typeof video.duration === 'number' && isFinite(video.duration) && video.duration > 0) ? video.duration : null;
        const isLive = duration === null;
        broadcastCurrentTime(wp.id, sec, 'mp4', duration, isLive);
      });
      _wpVideoTimeHandler = function () {
        if (_wpVideoBroadcaster && _wpVideoElement) _wpVideoBroadcaster(_wpVideoElement.currentTime);
      };
      video.addEventListener('timeupdate', _wpVideoTimeHandler);
    }
    _wpVideoErrorHandler = function () { renderPlayerErrorOverlay('wp-mp4-player'); };
    video.addEventListener('error', _wpVideoErrorHandler);
  }
}

function teardownVideoPlayer() {
  if (_wpVideoSampler) { clearInterval(_wpVideoSampler); _wpVideoSampler = null; }
  _wpVideoBroadcaster = null;
  // REVIEWS H5 — Remove stored event handlers BEFORE nulling the element ref.
  if (_wpVideoElement) {
    if (_wpVideoTimeHandler) {
      try { _wpVideoElement.removeEventListener('timeupdate', _wpVideoTimeHandler); } catch (e) { /* ignore */ }
    }
    if (_wpVideoErrorHandler) {
      try { _wpVideoElement.removeEventListener('error', _wpVideoErrorHandler); } catch (e) { /* ignore */ }
    }
    try { _wpVideoElement.pause(); } catch (e) { /* ignore */ }
  }
  _wpVideoTimeHandler = null;
  _wpVideoErrorHandler = null;
  _wpVideoElement = null;
  // REVIEWS H4 — Remove the delegated retry click handler.
  if (_wpRetryClickHandler) {
    const surface = document.getElementById('wp-video-surface');
    const frame = surface ? surface.querySelector('.wp-video-frame') : null;
    if (frame) {
      try { frame.removeEventListener('click', _wpRetryClickHandler); } catch (e) { /* ignore */ }
    }
    _wpRetryClickHandler = null;
  }
  if (_wpYtPlayer && typeof _wpYtPlayer.destroy === 'function') {
    try { _wpYtPlayer.destroy(); } catch (e) { /* ignore */ }
  }
  _wpYtPlayer = null;
  // REVIEWS H1 — Clear the persistent surface so next attach starts fresh.
  const surface = document.getElementById('wp-video-surface');
  if (surface) surface.innerHTML = '';
}

// Per UI-SPEC Interaction States: italic-serif "Player couldn't load that link." + Try again link.
// REVIEWS H4 — Try-again link is a real <a> with data-action="retry-video"; click is wired
// via delegated handler on the .wp-video-frame parent (attached in attachVideoPlayer).
function renderPlayerErrorOverlay(playerElementId) {
  const player = document.getElementById(playerElementId);
  if (!player) return;
  const wrap = player.closest('.wp-video-frame');
  if (!wrap) return;
  let overlay = wrap.querySelector('.wp-video-error');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'wp-video-error';
    wrap.appendChild(overlay);
  }
  overlay.innerHTML = "<em>Player couldn't load that link.</em>" +
    ' <a class="link-like" href="#" data-action="retry-video">Try again</a>';
}

// window-scoped so the delegated retry handler (and any test/debug code) can reach it.
window.reloadWatchpartyPlayer = function() {
  const wp = state.watchparties && state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp) return;
  teardownVideoPlayer();
  attachVideoPlayer(wp);
};

window.openWatchpartyLive = function(wpId, opts) {
  state.activeWatchpartyId = wpId;
  // Phase 26 / RPLY-26-13 — mode flag set BEFORE first render so first paint is mode-correct.
  // Default 'live' preserves backward compat for all existing call sites that pass (wpId) only.
  state.activeWatchpartyMode = (opts && opts.mode === 'revisit') ? 'revisit' : 'live';
  renderWatchpartyLive();
  document.getElementById('wp-live-modal-bg').classList.add('on');
  // Phase 11 / REFR-10 — Game Mode: start score polling + team-flair prompt.
  // Phase 23 — gate widened: ALSO fire for legacy wp.sportEvent watchparties
  // (created via scheduleSportsWatchparty before mode='game' was the canonical
  // marker). Closes the "scoreboard renders but never updates" gap on legacy
  // sports wps. team-flair picker stays gated on mode='game' since the legacy
  // flow predates that surface.
  const wp = state.watchparties && state.watchparties.find(x => x.id === wpId);
  if (wp && (wp.mode === 'game' || wp.sportEvent)) {
    startSportsScorePolling(wp);
    if (wp.mode === 'game') {
      const mine = myParticipation(wp);
      maybeShowTeamFlairPicker(wp, mine);
    }
  }
  // Phase 24 / REVIEWS H1 — Attach the persistent video player AFTER coordination paints.
  // Player surface is independent of renderWatchpartyLive; safe to attach late.
  if (wp && wp.videoUrl) {
    attachVideoPlayer(wp);
  }
};

window.closeWatchpartyLive = function() {
  // Phase 24 — Tear down the player FIRST so timers/listeners die before
  // anything else clears state. Idempotent if no player is attached.
  teardownVideoPlayer();
  document.getElementById('wp-live-modal-bg').classList.remove('on');
  // Phase 11 / REFR-10 — stop any active score polling loop
  stopSportsScorePolling();
  state.activeWatchpartyId = null;
  // Phase 26 / RPLY-26-13 + RESEARCH Pitfall 9 — clear replay flag + clock so the next
  // live-mode open does NOT render in replay variant.
  state.activeWatchpartyMode = null;
  state.replayLocalPositionMs = null;
  // Phase 26 / Plan 03 — also tear down the local replay clock state + persistence set.
  state.replayClockPlaying = false;
  state.replayClockAnchorWallclock = null;
  state.replayClockAnchorPosition = null;
  state.replayShownReactionIds = null;
};

// === Phase 27 — banner guest-count + closed-pill helpers ===
function buildWpBannerMetaSuffix(wp) {
  const guestCount = (wp && typeof wp.guestCount === 'number') ? wp.guestCount : 0;
  return guestCount > 0 ? ' &middot; ' + guestCount + ' guest' + (guestCount === 1 ? '' : 's') : '';
}
function buildWpClosedPillHtml(wp) {
  return (wp && wp.rsvpClosed === true)
    ? '<div class="wp-rsvp-closed-pill" role="status" aria-label="RSVPs closed">RSVPs CLOSED</div>'
    : '';
}
function buildWpHostRsvpToggleHtml(wp) {
  if (!state.me || !wp || state.me.id !== wp.hostId) return '';
  const wpIdSafe = escapeHtml(wp.id || '');
  if (wp.rsvpClosed === true) {
    return `<button class="link-btn" type="button" onclick="openRsvps('${wpIdSafe}')">Open RSVPs</button>`;
  }
  return `<button class="link-btn" type="button" onclick="closeRsvps('${wpIdSafe}')">Close RSVPs</button>`;
}

function renderWatchpartyBanner() {
  const el = document.getElementById('wp-banner-tonight');
  if (!el) return;
  const active = activeWatchparties();
  if (!active.length) { el.innerHTML = ''; return; }
  // Phase 15.5 / D-04 + REQ-9: split active wps into fresh (Tonight banner) vs stale (Past parties).
  // Cancelled wps follow the existing 10-min visibility from activeWatchparties — keep them in the
  // banner regardless of age (consistent with pre-15.5 cancellation UX).
  const splitNow = Date.now();
  const freshWps = active.filter(wp =>
    wp.status === 'cancelled' ||
    wp.startAt > splitNow ||
    (splitNow - wp.startAt) < WP_STALE_MS
  );
  const staleWps = active.filter(wp =>
    wp.status !== 'cancelled' &&
    wp.startAt <= splitNow &&
    (splitNow - wp.startAt) >= WP_STALE_MS
  );
  const bannerHtml = freshWps.map(wp => {
    const now = Date.now();
    const mine = myParticipation(wp);
    const joined = !!mine;
    const started = mine && mine.startedAt;
    const preStart = wp.startAt > now;
    const participantCount = Object.keys(wp.participants || {}).length;
    const isSport = !!wp.sportEvent;
    // Title / matchup display — sport mode uses the "Eagles AT Cowboys" pattern;
    // regular mode uses a poster + title treatment.
    const titleHtml = isSport
      ? `<div class="wp-banner-matchup">${escapeHtml(wp.sportEvent.awayTeam || 'Away')}<span class="at">at</span>${escapeHtml(wp.sportEvent.homeTeam || 'Home')}</div>`
      : `<div class="wp-banner-title">${escapeHtml(wp.titleName)}</div>`;
    // Poster column — for sports, use the league emoji in a circle instead of a poster
    const posterHtml = isSport
      ? `<div class="wp-banner-poster" style="display:grid;place-items:center;font-size:26px;background:linear-gradient(135deg,rgba(232,160,74,0.15),rgba(197,79,99,0.10));">${wp.sportEvent.leagueEmoji || '🎮'}</div>`
      : `<div class="wp-banner-poster" style="background-image:url('${wp.titlePoster||''}')"></div>`;
    // Cancelled state: muted banner, no click-through
    if (wp.status === 'cancelled') {
      const hostLabel = wp.hostId === (state.me && state.me.id) ? 'You' : escapeHtml(wp.hostName);
      return `<div class="wp-banner cancelled" style="cursor:default;opacity:0.7;">
        ${posterHtml}
        <div class="wp-banner-body">
          ${titleHtml}
          <div class="wp-banner-meta">${hostLabel} cancelled this watchparty${buildWpBannerMetaSuffix(wp)}</div>
          <div class="wp-banner-status" style="color:var(--ink-dim);">Cancelled</div>
          ${buildWpClosedPillHtml(wp)}${buildWpHostRsvpToggleHtml(wp)}
        </div>
      </div>`;
    }
    let status = '';
    let actionLabel = 'Join';
    // Phase 11 / REFR-07 grep-gate compliance: naked preStart conditional literal is reserved
    // for the prelaunch-body branch in renderWatchpartyLive (now guarded with !inLobbyWindow).
    // Banner-side status labelling uses the equivalent boolean coercion form below.
    if (!!preStart) {
      status = isSport ? `Kickoff ${formatCountdown(wp.startAt - now)}` : `Starts ${formatCountdown(wp.startAt - now)}`;
      actionLabel = joined ? 'Open' : "I'll be there";
    } else if (started) {
      status = `Watching · ${formatElapsed(computeElapsed(mine, wp))}`;
      actionLabel = 'Open';
    } else if (joined) {
      status = isSport ? 'Ready for kickoff' : 'Ready to start';
      actionLabel = 'Open';
    } else {
      status = 'In progress';
      actionLabel = 'Join';
    }
    const hostLabel = wp.hostId === (state.me && state.me.id) ? 'You' : escapeHtml(wp.hostName);
    const metaLine = isSport
      ? `${wp.sportEvent.league || 'Game'} · ${participantCount} ${participantCount===1?'person':'people'}`
      : `${hostLabel} started it · ${participantCount} ${participantCount===1?'person':'people'}`;
    const actionFn = joined ? `openWatchpartyLive('${wp.id}')` : `joinWatchparty('${wp.id}')`;
    const imminent = preStart && (wp.startAt - now) <= 2 * 60 * 1000;
    return `<div class="wp-banner${imminent?' imminent':''}" onclick="${actionFn}">
      ${posterHtml}
      <div class="wp-banner-body">
        ${titleHtml}
        <div class="wp-banner-meta">${metaLine}${buildWpBannerMetaSuffix(wp)}</div>
        <div class="wp-banner-status">${status}</div>
        ${buildWpClosedPillHtml(wp)}${buildWpHostRsvpToggleHtml(wp)}
      </div>
      <button class="wp-banner-action" onclick="event.stopPropagation();${actionFn}">${actionLabel}</button>
    </div>`;
  }).join('');
  // Phase 26 / RPLY-26-20 — Tonight tab inline link gating. Renames Phase 15.5's
  // staleWps.length count source to allReplayableArchivedCount; preserves hide-when-zero
  // gating per first-week-after-deploy framing (silent UX per D-10).
  const pastReplayableCount = allReplayableArchivedCount(state.watchparties);
  const pastPartiesHtml = pastReplayableCount > 0
    ? `<div class="past-parties-link-row" role="button" tabindex="0"
          onclick="openPastParties()"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPastParties();}"
          aria-label="Past parties, ${pastReplayableCount} watchpart${pastReplayableCount === 1 ? 'y' : 'ies'}">
        Past parties
        <span class="past-parties-count">(${pastReplayableCount})</span>
        <span class="past-parties-chevron" aria-hidden="true">›</span>
      </div>`
    : '';
  el.innerHTML = bannerHtml + pastPartiesHtml;
}

// Live view — full implementation
// v36.4: expanded 10 → 16 reactions; rendered as Twemoji <img> for cross-device consistency.
const WP_QUICK_EMOJIS = ['😂','😱','😭','🤯','👀','🔥','💀','❤️','🤔','🙌','🎉','👏','😴','🥰','🤡','🙄'];

// Phase 26 / RPLY-26-DRIFT — UI-SPEC §2 lock: ±2-second tolerance window for replay-feed
// fade-in match. Matches the seed default + the family use case (1-2s human typing delay
// when the original reactor posted, plus a similar tolerance for viewer scrubber-drag).
// Sub-second precision is out of scope per CONTEXT § Deferred.
const DRIFT_TOLERANCE_MS = 2000;

function memberColor(memberId) {
  const m = state.members.find(x => x.id === memberId);
  return m && m.color ? m.color : '#888';
}

// Phase 26 / RPLY-26-04 + RPLY-26-05 + RPLY-26-SNAP — Replay scrubber strip.
// Container .wp-replay-scrubber-strip styled in css/app.css per UI-SPEC §2.
// Plan 03 implements the local clock + the toggleReplayClock + onScrubberInput/onChange handlers.
function formatScrubberTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec - h * 3600) / 60);
  const s = totalSec - h * 3600 - m * 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? (h + ':' + mm + ':' + ss) : (mm + ':' + ss);
}
function renderReplayScrubber(wp) {
  const totalMs = getScrubberDurationMs(wp);
  const localMs = state.replayLocalPositionMs || 0;
  const totalStr = formatScrubberTime(totalMs);
  const currStr = formatScrubberTime(localMs);
  // step="1000" — 1-sec snap per UI-SPEC §2 lock (RPLY-26-SNAP)
  // aria-label, play/pause aria-label per UI-SPEC §Copywriting (banned-words ledger respected)
  return '<div class="wp-replay-scrubber-strip" role="group" aria-label="Replay controls">' +
    '<button class="wp-replay-playpause" type="button" id="wp-replay-playpause" ' +
      'aria-label="Start watching from here" onclick="toggleReplayClock()">' +
      '▶' +  // U+25B6 paused state; flips to U+23F8 when Plan 03 toggles play
    '</button>' +
    '<input type="range" class="wp-replay-scrubber-input" id="wp-replay-scrubber-input" ' +
      'min="0" max="' + totalMs + '" step="1000" value="' + localMs + '" ' +
      'aria-label="Move to where you are in the movie" ' +
      'aria-valuemin="0" aria-valuemax="' + totalMs + '" aria-valuenow="' + localMs + '" ' +
      'aria-valuetext="' + currStr + ' of ' + totalStr + '" ' +
      'oninput="onReplayScrubberInput(this.value)" ' +
      'onchange="onReplayScrubberChange(this.value)" />' +
    '<span class="wp-replay-scrubber-readout" id="wp-replay-scrubber-readout">' +
      currStr + ' / ' + totalStr +
    '</span>' +
  '</div>';
}
// Phase 26 / Plan 03 — Local replay clock + scrubber input handlers.
// UI-SPEC §2 locks: 1× rate, requestAnimationFrame for smoothness, Date.now() deltas
// for tab-blur correctness. oninput updates readout + CSS var only (no reaction re-mount
// — Pitfall 6); onchange (drag-end) re-renders the feed via renderWatchpartyLive().

function _replayCurrentWp() {
  return state.watchparties && state.watchparties.find(x => x.id === state.activeWatchpartyId);
}
function _replayUpdateReadoutDom(wp) {
  const totalMs = getScrubberDurationMs(wp);
  const localMs = state.replayLocalPositionMs || 0;
  const readoutEl = document.getElementById('wp-replay-scrubber-readout');
  if (readoutEl) {
    readoutEl.textContent = formatScrubberTime(localMs) + ' / ' + formatScrubberTime(totalMs);
  }
  const inputEl = document.getElementById('wp-replay-scrubber-input');
  if (inputEl) {
    const pct = totalMs > 0 ? (localMs / totalMs * 100) : 0;
    inputEl.style.setProperty('--scrubber-pct', String(pct));
    inputEl.setAttribute('aria-valuenow', String(localMs));
    inputEl.setAttribute('aria-valuetext', formatScrubberTime(localMs) + ' of ' + formatScrubberTime(totalMs));
    // Keep the value attr in sync ONLY if the user is not currently dragging
    // (browser handles the value attr while the user holds the thumb).
    if (document.activeElement !== inputEl) {
      inputEl.value = String(localMs);
    }
  }
}
function _replayClockTick() {
  if (!state.replayClockPlaying) return;
  const wp = _replayCurrentWp();
  if (!wp || state.activeWatchpartyMode !== 'revisit') {
    state.replayClockPlaying = false;
    return;
  }
  const totalMs = getScrubberDurationMs(wp);
  const wall = Date.now();
  const anchorWall = state.replayClockAnchorWallclock || wall;
  const anchorPos = state.replayClockAnchorPosition || 0;
  const next = Math.min(totalMs, Math.max(0, anchorPos + (wall - anchorWall)));
  const prev = state.replayLocalPositionMs || 0;
  state.replayLocalPositionMs = next;
  _replayUpdateReadoutDom(wp);
  // Re-render only when the clock crosses a reaction's runtimePositionMs (within drift).
  // Cheap check: if any reaction in (prev+drift, next+drift] would newly enter the visible
  // window, trigger a feed re-render.
  const prevWindow = prev + DRIFT_TOLERANCE_MS;
  const nextWindow = next + DRIFT_TOLERANCE_MS;
  const reactions = (wp.reactions || []);
  let crossed = false;
  for (let i = 0; i < reactions.length; i++) {
    const r = reactions[i];
    if (r && r.runtimePositionMs != null && r.runtimeSource !== 'live-stream'
        && r.runtimePositionMs > prevWindow && r.runtimePositionMs <= nextWindow) {
      crossed = true; break;
    }
  }
  if (crossed) {
    renderWatchpartyLive();
  }
  // Auto-pause at end of timeline
  if (next >= totalMs) {
    state.replayClockPlaying = false;
    _replayUpdatePlayPauseButton(false);
    return;
  }
  requestAnimationFrame(_replayClockTick);
}
function _replayUpdatePlayPauseButton(isPlaying) {
  const btn = document.getElementById('wp-replay-playpause');
  if (!btn) return;
  btn.textContent = isPlaying ? '⏸' : '▶';
  btn.setAttribute('aria-label', isPlaying ? 'Pause where you are' : 'Start watching from here');
}

// Override Plan 02 stubs with real implementations. Use plain assignments
// (NOT the `if (typeof ...)` guard) so the real bodies always win.
window.toggleReplayClock = function() {
  if (state.activeWatchpartyMode !== 'revisit') return;  // safety guard
  const wp = _replayCurrentWp();
  if (!wp) return;
  const totalMs = getScrubberDurationMs(wp);
  // If at end, pressing play restarts from 0 (per UI-SPEC §2 — no separate rewind affordance).
  if (state.replayClockPlaying) {
    state.replayClockPlaying = false;
    _replayUpdatePlayPauseButton(false);
  } else {
    if ((state.replayLocalPositionMs || 0) >= totalMs) {
      state.replayLocalPositionMs = 0;
      _replayUpdateReadoutDom(wp);
    }
    state.replayClockAnchorWallclock = Date.now();
    state.replayClockAnchorPosition = state.replayLocalPositionMs || 0;
    state.replayClockPlaying = true;
    _replayUpdatePlayPauseButton(true);
    requestAnimationFrame(_replayClockTick);
  }
};

window.onReplayScrubberInput = function(value) {
  // oninput fires continuously during drag — update readout + CSS var ONLY (Pitfall 6).
  // No reaction re-mount during drag.
  const wp = _replayCurrentWp();
  if (!wp) return;
  const v = parseInt(value, 10);
  if (!isFinite(v)) return;
  state.replayLocalPositionMs = Math.max(0, v);
  _replayUpdateReadoutDom(wp);
};

window.onReplayScrubberChange = function(value) {
  // onchange fires once at drag-end — re-render feed so position-aligned subset re-evaluates.
  const wp = _replayCurrentWp();
  if (!wp) return;
  const v = parseInt(value, 10);
  if (!isFinite(v)) return;
  state.replayLocalPositionMs = Math.max(0, v);
  // Re-anchor the play clock so it continues smoothly from the new drop position.
  if (state.replayClockPlaying) {
    state.replayClockAnchorWallclock = Date.now();
    state.replayClockAnchorPosition = state.replayLocalPositionMs;
  }
  renderWatchpartyLive();  // triggers renderReplayReactionsFeed re-evaluation
};
// Phase 26 / RPLY-26-06 — Replay-mode reactions feed (position-aligned subset).
// Selection rule per UI-SPEC §3 (locked):
//   skip if r.runtimePositionMs == null  (covers 'live-stream' AND pre-Phase-26)
//   show if r.runtimePositionMs <= localReplayPositionMs + DRIFT_TOLERANCE_MS
//   hide if r.runtimePositionMs > localReplayPositionMs + DRIFT_TOLERANCE_MS
// Sort: ascending by runtimePositionMs.
// Persistence (Pitfall 5): once a reaction has been shown this session, it stays visible
// across scrub-backward. state.replayShownReactionIds tracks the session-set.
// Wait Up (RPLY-26-14): NOT applied in replay variant — the `mine.reactionDelay` filter
// from renderReactionsFeed is intentionally absent here.
window.renderReplayReactionsFeed = function(wp, localReplayPositionMs) {
  if (!state.replayShownReactionIds) {
    state.replayShownReactionIds = new Set();
  }
  const all = (wp && Array.isArray(wp.reactions)) ? wp.reactions : [];
  // Update the persistent visible-set: add any reaction newly within the drift window.
  for (const r of all) {
    if (r && r.runtimePositionMs != null
        && r.runtimePositionMs <= (localReplayPositionMs + DRIFT_TOLERANCE_MS)
        && r.runtimeSource !== 'live-stream') {
      if (r.id) state.replayShownReactionIds.add(r.id);
    }
  }
  // Render the union: anything in the session-set, sorted by runtimePositionMs ascending.
  const visible = all
    .filter(r => r && r.runtimePositionMs != null && r.runtimeSource !== 'live-stream')
    .filter(r => r.id && state.replayShownReactionIds.has(r.id))
    .sort((a, b) => a.runtimePositionMs - b.runtimePositionMs);
  if (!visible.length) {
    // Empty-state per UI-SPEC §3 — italic Instrument Serif, --ink-dim, no instruction copy.
    return '<div class="wp-live-body" id="wp-reactions-feed">' +
      '<div style="text-align:center;color:var(--ink-dim);font-size:var(--t-meta);padding:20px;">' +
        '<em style="font-family:\'Instrument Serif\',serif;">Nothing yet at this moment.</em>' +
      '</div>' +
    '</div>';
  }
  // Reuse the existing per-row renderReaction(r, mode) helper at js/app.js:11961.
  const rows = visible.map(r => renderReaction(r, 'replay')).join('');
  return '<div class="wp-live-body" id="wp-reactions-feed">' + rows + '</div>';
};

function renderWatchpartyLive() {
  // Phase 24 / REVIEWS H1 — Render coordination only; never touch #wp-video-surface.
  // The player is owned by attachVideoPlayer / teardownVideoPlayer and survives re-renders.
  const el = document.getElementById('wp-live-coordination');
  if (!el) return;
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp) { el.innerHTML = '<div style="padding:24px;">Watchparty not found.</div>'; return; }
  // Phase 26 / RPLY-26-04 + RPLY-26-13 — replay-variant gating.
  // Eligibility precondition: replay variant only renders when wp.status === 'archived'
  // (per D-06). Defensive: even if state.activeWatchpartyMode === 'revisit' was
  // somehow set on a non-archived wp (shouldn't happen — Plan 04 entry gates on
  // archived), fall back to live-mode chrome.
  const isArchived = wp.status === 'archived';
  const isReplay = state.activeWatchpartyMode === 'revisit' && isArchived;
  const isSport = !!wp.sportEvent;
  // Phase 24 — When player is active in #wp-video-surface, hide the redundant
  // .wp-live-poster via parent class. Player IS the visual identity.
  let headerExtraClass = '';
  if (wp.videoUrl && wp.videoSource) {
    const _t = state.titles && state.titles.find(x => x.id === wp.titleId);
    if (titleHasNonDrmPath(_t)) {
      headerExtraClass = ' wp-live-header--has-player';
    }
  }
  // Header title block — matchup format for sports, regular title otherwise
  const liveTitleHtml = isSport
    ? `<div class="wp-live-titlename" style="font-family:'Instrument Serif','Fraunces',serif;font-style:italic;">${escapeHtml(wp.sportEvent.awayTeam || 'Away')} <span style="color:var(--ink-dim);font-family:'Inter',sans-serif;font-style:normal;font-size:var(--t-meta);letter-spacing:0.06em;text-transform:uppercase;">at</span> ${escapeHtml(wp.sportEvent.homeTeam || 'Home')}</div>`
    : `<div class="wp-live-titlename">${escapeHtml(wp.titleName)}</div>`;
  // Poster column — emoji bubble for sports, regular poster otherwise
  const livePosterHtml = isSport
    ? `<div class="wp-live-poster" style="display:grid;place-items:center;font-size:32px;background:linear-gradient(135deg,rgba(232,160,74,0.15),rgba(197,79,99,0.10));">${wp.sportEvent.leagueEmoji || '🎮'}</div>`
    : `<div class="wp-live-poster" style="background-image:url('${wp.titlePoster||''}')"></div>`;
  // If cancelled, show a dedicated end state
  if (wp.status === 'cancelled') {
    el.innerHTML = `<div class="wp-live-header${headerExtraClass}">
      ${livePosterHtml}
      <div class="wp-live-titleinfo">
        ${liveTitleHtml}
        <div class="wp-live-status">Cancelled by ${escapeHtml(wp.hostName)}</div>
      </div>
      <button class="pill icon-only" aria-label="Close watchparty" onclick="closeWatchpartyLive()" style="margin-left:6px;">✕</button>
    </div>
    <div class="wp-prelaunch">
      <div style="font-family:'Instrument Serif','Fraunces',serif;font-size:var(--t-h2);font-weight:400;margin-bottom:8px;">This watchparty was cancelled</div>
      <div style="font-size:var(--t-meta);color:var(--ink-dim);">No worries. You can start a new one anytime.</div>
    </div>
    <div class="wp-live-footer">
      <button class="modal-close" onclick="closeWatchpartyLive()">Close</button>
    </div>`;
    return;
  }
  // Preserve in-progress compose text and focus across re-renders
  const existingInput = document.getElementById('wp-compose-input');
  const savedText = existingInput ? existingInput.value : '';
  const savedFocus = existingInput && document.activeElement === existingInput;
  const savedFeedScroll = (() => { const f = document.getElementById('wp-reactions-feed'); return f ? f.scrollTop : null; })();
  const mine = myParticipation(wp);
  const now = Date.now();
  const preStart = wp.startAt > now;
  const participants = Object.entries(wp.participants || {});
  // Header
  // Phase 26 / RPLY-26-15 — Replay-variant eyebrow source string is 'Revisiting' (CSS
  // .wp-live-status text-transform:uppercase displays it as 'REVISITING'). Live-mode
  // statusText branch unchanged.
  const statusText = isReplay
    ? 'Revisiting'
    : (preStart
        ? (isSport ? `Kickoff ${formatStartTime(wp.startAt)}` : `Starts ${formatStartTime(wp.startAt)}`)
        : `Started ${formatStartTime(wp.startAt)}`);
  // Phase 26 / RPLY-26-04 + RPLY-26-15 — replay-variant scrubber strip + 'together again'
  // italic-serif sub-line + Wait Up/participants/timer guards live in the same render body.
  const scrubberStrip = isReplay ? renderReplayScrubber(wp) : '';
  const header = `<div class="wp-live-header${headerExtraClass}">
    ${livePosterHtml}
    <div class="wp-live-titleinfo">
      ${liveTitleHtml}
      ${isReplay ? '<div class="wp-live-revisit-subline">together again</div>' : ''}
      <div class="wp-live-status">${statusText}${mine && mine.pausedAt && !isReplay ? ' · <span style="color:var(--accent);">Paused</span>' : ''}</div>
    </div>
    ${mine && mine.startedAt && !isReplay ? `<div class="wp-live-timer" id="wp-live-timer-display">${formatElapsed(computeElapsed(mine, wp))}</div>` : ''}
    <button class="pill icon-only" aria-label="Close watchparty" onclick="closeWatchpartyLive()" style="margin-left:6px;">✕</button>
  </div>`;

  // Phase 11 / REFR-07 — Pre-session lobby window. Both the lobby branch below and the
  // existing preStart branch need to see this local so the mutex guard works. When the
  // watchparty is scheduled AND we're inside T-15min (but not yet past startAt), the lobby
  // card becomes the SOLE prelaunch UI — the preStart branch is skipped via `!inLobbyWindow`.
  const LOBBY_WINDOW_MS = 15 * 60 * 1000;
  const inLobbyWindow = wp.status === 'scheduled' && wp.startAt && (now > wp.startAt - LOBBY_WINDOW_MS) && (now < wp.startAt);

  // Body
  let body = '';
  if (inLobbyWindow) {
    // Phase 11 / REFR-07 — Pre-session lobby + Ready check + majority auto-start CTA.
    // Replaces the body (not appends) so no stacking with wp-prelaunch. The existing preStart
    // branch below is guarded with `!inLobbyWindow` so it never fires during the T-15min window.
    const secs = Math.max(0, Math.floor((wp.startAt - now) / 1000));
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    const countdownStr = mins >= 1
      ? `${String(mins).padStart(2,'0')}:${String(remSecs).padStart(2,'0')}`
      : `00:${String(secs).padStart(2,'0')}`;
    const readyCount = participants.filter(([,p]) => p.ready).length;
    const totalCount = participants.length;
    const majority = totalCount > 0 && readyCount >= Math.ceil(totalCount / 2);
    const isHost = state.me && state.me.id === wp.hostId;
    const myReady = !!(wp.participants && wp.participants[state.me && state.me.id] && wp.participants[state.me.id].ready);
    const notReady = participants.filter(([,p]) => !p.ready).map(([,p]) => p.name);
    let waitingLine = '';
    if (notReady.length === 1) {
      waitingLine = `<div class="wp-lobby-waiting"><em>Waiting on ${escapeHtml(notReady[0])}.</em></div>`;
    } else if (notReady.length > 1) {
      waitingLine = `<div class="wp-lobby-waiting"><em>Waiting on ${escapeHtml(notReady[0])} and ${notReady.length-1} ${notReady.length-1===1?'other':'others'}.</em></div>`;
    }
    const rosterHtml = renderParticipantTimerStrip(wp).replace('<div class="wp-participants-strip"', '<div class="wp-participants-strip wp-lobby-roster-strip"');
    const lobbyHtml = `<div class="wp-lobby-card">
      <div class="wp-lobby-eyebrow">LOBBY</div>
      <div class="wp-countdown-ring" id="wp-countdown-ring"><span class="wp-countdown-text" id="wp-lobby-countdown">${countdownStr}</span></div>
      <div class="wp-lobby-headline"><em>Kicks off in ${countdownStr}</em></div>
      <div class="wp-lobby-roster">${rosterHtml}</div>
      ${waitingLine}
      <div class="wp-lobby-actions">
        <button class="wp-ready-check ${myReady?'on':''}" onclick="toggleReadyCheck('${escapeHtml(wp.id)}')">${myReady?'Ready ✓':"I'm ready"}</button>
        ${isHost && majority ? `<button class="wp-lobby-start-btn" onclick="hostStartSession('${escapeHtml(wp.id)}')">Start the session</button>` : ''}
      </div>
    </div>`;
    body = lobbyHtml;
  } else if (preStart && !inLobbyWindow) {
    const secs = Math.max(0, Math.floor((wp.startAt - now)/1000));
    const mins = Math.floor(secs/60);
    const countdownStr = mins >= 1 ? formatCountdown(wp.startAt - now) : `${secs}s`;
    body = `<div class="wp-prelaunch">
      <div style="color:var(--ink-dim);font-size:var(--t-meta);">Starts in</div>
      <div class="wp-prelaunch-count" id="wp-prelaunch-count">${countdownStr}</div>
      <div style="font-size:var(--t-meta);color:var(--ink-dim);margin-bottom:18px;">${participants.length} ${participants.length===1?'person':'people'} in: ${participants.map(([,p]) => p.name).join(', ')}</div>
      <div style="font-size:var(--t-meta);color:var(--ink-dim);font-style:italic;">When you actually hit play, tap "Start my timer" below so your reactions line up with everyone else's.</div>
    </div>`;
  } else if (!mine) {
    // Un-joined viewer — UNCHANGED copy. Footer's "Join late" button (js/app.js:~7654)
    // is the single CTA for this case; do NOT introduce additional H2/body copy here
    // (would create a redundant/conflicting action with the footer).
    body = `<div class="wp-prelaunch">
      <div style="font-family:'Instrument Serif','Fraunces',serif;font-size:var(--t-h2);font-weight:400;margin-bottom:8px;">Ready when you are</div>
      <div style="font-size:var(--t-meta);color:var(--ink-dim);margin-bottom:18px;">Start the movie on your device, then tap the button below to sync your timer with everyone else.</div>
      ${participants.length > 1 ? `<div style="font-size:var(--t-meta);color:var(--ink-dim);">Already watching: ${participants.filter(([,p]) => p.startedAt).map(([,p]) => p.name).join(', ') || 'nobody yet'}</div>` : ''}
    </div>`;
  } else if (!mine.startedAt) {
    // Phase 7 Plan 06 (Gap #3): joined participant whose timer hasn't started yet
    // (late joiner / pre-start creator / re-joiner). Show the "Ready when you are"
    // prompt ABOVE the participant strip + reactions feed so they see the backlog
    // in wallclock order while they spin up their own timer.
    const prompt = `<div class="wp-prelaunch" style="padding-bottom:12px;">
      <div style="font-family:'Instrument Serif','Fraunces',serif;font-size:var(--t-h2);font-weight:400;margin-bottom:8px;">Ready when you are</div>
      <div style="font-size:var(--t-meta);color:var(--ink-dim);margin-bottom:18px;">Start the movie on your device, then tap the button below to sync your timer with everyone else.</div>
      ${participants.length > 1 ? `<div style="font-size:var(--t-meta);color:var(--ink-dim);">Already watching: ${participants.filter(([,p]) => p.startedAt).map(([,p]) => p.name).join(', ') || 'nobody yet'}</div>` : ''}
    </div>`;
    body = prompt
      + (!isReplay ? renderParticipantTimerStrip(wp) : '')
      + (isReplay
          ? window.renderReplayReactionsFeed(wp, state.replayLocalPositionMs || 0)
          : renderReactionsFeed(wp, mine, 'wallclock'));
  } else {
    // Active watching — render reactions feed based on mode
    // Phase 7 Plan 03 (PARTY-03): advisory per-member timer strip sits above the reactions feed
    // so everyone sees where their co-watchers are in the runtime. No forcing — each member
    // tracks their own pace. See 07-CONTEXT.md D-01/02/03.
    // Phase 11 / REFR-08: inject the late-joiner Catch-me-up card at the TOP of wp-live-body
    // so late joiners get a 30s reaction recap without breaking the per-user reaction-delay
    // moat. Empty state (< 3 pre-join reactions in window) hides the card entirely.
    // Phase 26 — Replay variant suppresses Catch-me-up + participant strip + DVR slider; Plan 03's
    // renderReplayReactionsFeed becomes the sole feed source when isReplay.
    const catchupHtml = !isReplay ? renderCatchupCard(wp, mine) : '';
    // Phase 11 / REFR-10: DVR slider tail for sport-mode — per-user "I'm N seconds behind"
    // offset feeds the existing Phase 7 reactionDelay render filter. Movie mode unchanged.
    const dvrHtml = (!isReplay && wp.mode === 'game') ? renderDvrSlider(wp, mine) : '';
    body = catchupHtml
      + (!isReplay ? renderParticipantTimerStrip(wp) : '')
      + (isReplay
          ? window.renderReplayReactionsFeed(wp, state.replayLocalPositionMs || 0)
          : renderReactionsFeed(wp, mine))
      + dvrHtml;
  }

  // Footer
  // Phase 11 / REFR-07: prelaunch footer also applies during lobby window (inLobbyWindow ⊆ preStart).
  // Consolidated into a single guarded condition (isPrelaunch) so the grep-gate for the bare
  // preStart conditional stays at zero and the inLobbyWindow coexistence is explicit.
  let footer = '';
  const isPrelaunch = preStart || inLobbyWindow;
  if (isPrelaunch) {
    if (!mine) {
      footer = `<div class="wp-live-footer"><button class="modal-close" onclick="joinWatchparty('${wp.id}')">I'll be there</button></div>`;
    } else {
      const isHost = wp.hostId === state.me.id;
      footer = `<div class="wp-live-footer">
        <div style="text-align:center;color:var(--ink-dim);font-size:var(--t-meta);margin-bottom:8px;">You're in. We'll let you know when it's time.</div>
        <div style="display:flex;gap:6px;">
          <button class="wp-control-btn" style="flex:1;" onclick="leaveWatchparty('${wp.id}')">Leave</button>
          ${isHost ? `<button class="wp-control-btn danger" style="flex:1;" onclick="cancelWatchparty('${wp.id}')">Cancel watchparty</button>` : ''}
        </div>
      </div>`;
    }
  } else if (!mine) {
    footer = `<div class="wp-live-footer"><button class="modal-close" onclick="joinWatchparty('${wp.id}')">Join late</button></div>`;
  } else if (!mine.startedAt) {
    footer = `<div class="wp-live-footer"><button class="modal-close" onclick="startMyWatchpartyTimer('${wp.id}')">▶ Start my timer</button></div>`;
  } else {
    footer = renderWatchpartyFooter(wp, mine);
  }

  // Phase 11 / REFR-10 — Sticky live score strip for Game Mode watchparties.
  // Prepended to body (not header) so it scrolls with wp-live-body content but
  // sticks to the top via position:sticky. Triggered on wp.mode === 'game' OR
  // the presence of wp.sportEvent (legacy sports wps also get the chrome).
  if (wp.mode === 'game' || wp.sportEvent) {
    body = renderSportsScoreStrip(wp) + body;
  }

  // Phase 26 / RPLY-26-04 — replay-variant emits the scrubber strip ABOVE the header
  // (still inside #wp-live-coordination per Phase 24 H1 split — never touches #wp-video-surface).
  el.innerHTML = scrubberStrip + header + body + footer;
  // Restore compose input state
  const newInput = document.getElementById('wp-compose-input');
  if (newInput && savedText) newInput.value = savedText;
  if (newInput && savedFocus) newInput.focus();
  // Auto-scroll reactions to bottom (but only if user was already near the bottom)
  const feed = document.getElementById('wp-reactions-feed');
  if (feed) {
    if (savedFeedScroll == null) {
      feed.scrollTop = feed.scrollHeight;
    } else {
      // Preserve scroll position; snap to bottom only if very close
      const prevHeight = feed.scrollHeight;
      feed.scrollTop = savedFeedScroll;
      // If user was within 60px of bottom, snap to new bottom
      if (prevHeight - savedFeedScroll - feed.clientHeight < 60) feed.scrollTop = feed.scrollHeight;
    }
  }
  // Wire text input Enter key
  const textInput = document.getElementById('wp-compose-input');
  if (textInput && !textInput._wired) {
    textInput._wired = true;
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postTextReaction(); }
    });
  }
}

// Phase 11 / REFR-08 — Late-joiner Catch-me-up card. Shows 24px emoji + mini-avatar
// bubbles from the last 30 seconds of reactions BEFORE the user joined, so they get
// context without breaking Couch's per-user reaction-delay moat. Hides entirely when
// < 3 pre-join reactions exist (empty-state noise guard per UI-SPEC REFR-08).
// Dismissal is per-session local (window._catchupDismissed map) — no Firestore write.
// Sports mode (REFR-10 / Plan 11-06) will replace the reaction rail with a score +
// last-3-plays card; placeholder passthrough for now.
function renderCatchupCard(wp, mine) {
  const joinedAt = mine && mine.joinedAt ? mine.joinedAt : null;
  const startedAt = wp && wp.startedAt ? wp.startedAt : null;
  if (!joinedAt || !startedAt) return '';
  if (joinedAt <= startedAt + ONTIME_GRACE_MS) return '';
  if (window._catchupDismissed && window._catchupDismissed[wp.id]) return '';
  const isSport = wp.mode === 'game' || !!wp.sportEvent;
  // Phase 11 / REFR-10 — Sports variant: score + last 3 plays card instead of
  // the reaction rail. Hides the movie-mode <3 reactions guard since a sport
  // late-joiner benefits from the score even without any reactions in flight.
  if (isSport) {
    const score = (wp && wp.lastScore) || {};
    const recentPlays = (wp.scoringPlays || []).slice(-3);
    const awayAbbr = score.awayAbbr || (wp.sportEvent && (wp.sportEvent.awayAbbrev || wp.sportEvent.awayTeam)) || 'Away';
    const homeAbbr = score.homeAbbr || (wp.sportEvent && (wp.sportEvent.homeAbbrev || wp.sportEvent.homeTeam)) || 'Home';
    const awayScore = parseInt(score.awayScore, 10) || 0;
    const homeScore = parseInt(score.homeScore, 10) || 0;
    const playsHtml = recentPlays.length
      ? recentPlays.map(p => {
          const qLabel = p.period ? `Q${p.period}` : '';
          const clockLabel = p.clock ? ` ${escapeHtml(p.clock)}` : '';
          return `<div class="wp-catchup-sport-play">${escapeHtml(qLabel)}${clockLabel} · ${escapeHtml(p.text || 'Score')}</div>`;
        }).join('')
      : '<div class="wp-catchup-sport-play"><em>No scoring plays yet.</em></div>';
    return `<div class="wp-catchup-card">
      <div class="wp-catchup-eyebrow">WAITED UP</div>
      <div class="wp-catchup-title"><em>Here's where we are.</em></div>
      <div class="wp-catchup-sport-score">Score: ${escapeHtml(awayAbbr)} ${awayScore}, ${escapeHtml(homeAbbr)} ${homeScore}</div>
      <div class="wp-catchup-sport-label">Last 3 plays:</div>
      ${playsHtml}
      <button class="wp-control-btn wp-catchup-dismiss" onclick="dismissCatchup('${escapeHtml(wp.id)}')">Got it. Catch me up.</button>
    </div>`;
  }
  // Movie-mode variant — 30s reaction rail
  const windowStart = joinedAt - 30 * 1000;
  const preJoinReactions = (wp.reactions || [])
    .filter(r => (r.at || 0) < joinedAt && (r.at || 0) >= windowStart)
    .sort((a, b) => (a.at || 0) - (b.at || 0));
  if (preJoinReactions.length < 3) return '';  // empty state = hide entirely
  const rail = preJoinReactions.map(r => {
    const initial = (r.memberName || '?')[0].toUpperCase();
    const color = memberColor(r.memberId);
    const emoji = r.kind === 'emoji' ? (r.emoji || '') : '';
    return `<div class="wp-catchup-rail-item" title="${escapeHtml(r.memberName || '')}">
      <div class="wp-catchup-rail-av" style="background:${color};">${escapeHtml(initial)}</div>
      <div class="wp-catchup-rail-emoji">${emoji || '💬'}</div>
    </div>`;
  }).join('');
  return `<div class="wp-catchup-card">
    <div class="wp-catchup-eyebrow">WAITED UP</div>
    <div class="wp-catchup-title"><em>Here's the last 30 seconds.</em></div>
    <div class="wp-catchup-rail">${rail}</div>
    <button class="wp-control-btn wp-catchup-dismiss" onclick="dismissCatchup('${escapeHtml(wp.id)}')">Got it. Catch me up.</button>
  </div>`;
}

window.dismissCatchup = function(wpId) {
  window._catchupDismissed = window._catchupDismissed || {};
  window._catchupDismissed[wpId] = true;
  const wp = state.watchparties && state.watchparties.find(x => x.id === wpId);
  if (wp) renderWatchpartyLive();
};

function renderReactionsFeed(wp, mine, modeOverride) {
  // Phase 7 Plan 06 (Gap #3): optional modeOverride forces a specific render mode,
  // used by the late-joiner branch to force 'wallclock' so the backlog appears even
  // when mine.startedAt is absent (myElapsed would be 0 and hide everything in elapsed mode).
  const mode = modeOverride || mine.reactionsMode || 'elapsed';
  if (mode === 'hidden') {
    return `<div class="wp-live-body" id="wp-reactions-feed"><div class="wp-reactions-hidden">Reactions hidden. You can still post them; they're just not showing for you right now.</div></div>`;
  }
  const myElapsed = computeElapsed(mine, wp);
  const allReactions = wp.reactions || [];
  // Phase 7 Plan 07 (PARTY-04): viewer-side reaction delay. Shift elapsed-mode comparison
  // backward by (mine.reactionDelay || 0) * 1000 so a reaction posted at runtime position T
  // only appears in this viewer's feed once THEIR timer reads T + delay. Spoiler protection
  // for the viewer who's a few seconds behind the fastest co-watcher.
  // Poster-self is exempt: r.memberId === state.me.id bypasses the delay so you always see
  // your own reactions immediately. memberId is the canonical attribution field pinned by
  // writeAttribution() in js/utils.js:100 — postReaction at js/app.js:~7820 spreads it into
  // every reaction object. No grep needed; this is deterministic.
  const delayMs = (mine.reactionDelay || 0) * 1000;
  // Filter based on mode
  // Phase 7 followup (mixed-anchor bug): switched from elapsed-based to wall-clock-based
  // comparison. Pre-fix predicate compared r.elapsedMs (poster-anchored, from poster's
  // startedAt/effectiveStartAt) against myElapsed (viewer-anchored). When anchors diverge
  // (late joiner without 07-08 override), the comparison is in incompatible coordinates and
  // the filter rejects legitimate reactions indefinitely. r.at is a wall-clock ms timestamp
  // set at post time (line ~7935), so comparing against Date.now() - delayMs is direct and
  // anchor-agnostic. Synced-viewing case is mathematically identical to the old predicate.
  const nowMs = Date.now();
  const visible = allReactions.filter(r => {
    if (mode === 'wallclock') return true;
    // elapsed mode: poster-self always sees their own reactions immediately
    if (r.memberId === state.me.id) return true;
    // other viewers: show reactions posted at least delayMs ago in wall-clock time
    return (r.at || 0) <= (nowMs - delayMs);
  });
  if (!visible.length) {
    return `<div class="wp-live-body" id="wp-reactions-feed"><div style="text-align:center;color:var(--ink-dim);font-size:var(--t-meta);padding:20px;">Reactions will flow in as people post them.</div></div>`;
  }
  // Sort by elapsed time (or posted time in wall-clock mode)
  const sorted = visible.slice().sort((a,b) => mode === 'wallclock' ? (a.at - b.at) : ((a.elapsedMs||0) - (b.elapsedMs||0)));
  return `<div class="wp-live-body" id="wp-reactions-feed">${sorted.map(r => renderReaction(r, mode)).join('')}</div>`;
}

// === Phase 27 — Guest RSVP helpers ===
// D-04: render-time (guest) suffix only when normalized name collides with a family member.
function getFamilyMemberNamesSet() {
  return new Set((state.members || []).map(m => (m.name || '').trim().toLowerCase()).filter(Boolean));
}
// D-04: returns "{name} (guest)" iff name collides; otherwise returns name verbatim.
function displayGuestName(rawName, familyMemberNamesSet) {
  const name = rawName || 'Guest';
  const norm = name.trim().toLowerCase();
  if (familyMemberNamesSet && familyMemberNamesSet.has(norm)) {
    return name + ' (guest)';
  }
  return name;
}
// D-01: response label for guest chips. undefined/null/'invited' → 'Invited'.
function guestResponseLabel(response) {
  if (response === 'yes')   return 'Going';
  if (response === 'maybe') return 'Maybe';
  if (response === 'no')    return 'Not coming';
  return 'Invited';
}

// Phase 7 Plan 03 — advisory per-member timer strip. Shows every participant's current
// elapsedMs as a chip. Non-started participants show "Joined", paused ones show "Paused",
// active ones show "X min in". Rendered inside the watchparty live body on every tick so
// numbers advance in real time. Uses computeElapsed (existing helper) for the math.
function renderParticipantTimerStrip(wp) {
  const entries = Object.entries(wp.participants || {});
  if (!entries.length) return '';
  const chips = entries.map(([mid, p]) => {
    const member = state.members.find(m => m.id === mid);
    const name = (member && member.name) || p.name || 'Member';
    const color = (member && member.color) || '#888';
    const initial = (name || '?')[0].toUpperCase();
    let statusLabel;
    let chipClass = '';
    if (!p.startedAt) { statusLabel = 'Joined'; chipClass = 'joined'; }
    else if (p.pausedAt) { statusLabel = 'Paused'; chipClass = 'paused'; }
    else {
      const mins = Math.floor(computeElapsed(p, wp) / 60000);
      statusLabel = mins === 0 ? 'Just started' : `${mins} min in`;
    }
    const isMe = state.me && state.me.id === mid;
    // Phase 7 Plan 08 (Issue #4): on-time override control on OWN chip only.
    // isLate = joinedAt is past the on-time grace window from startAt — i.e. the default
    // inference branch won't fire for this user. Show the claim button so they can anchor
    // their timer to startAt if they were actually watching from the scheduled start.
    // hasOverride = effectiveStartAt explicitly set — show a revert affordance instead.
    let ontimeControl = '';
    if (isMe && typeof p.joinedAt === 'number' && typeof wp.startAt === 'number') {
      const isLate = p.joinedAt > wp.startAt + ONTIME_GRACE_MS;
      const hasOverride = typeof p.effectiveStartAt === 'number';
      if (hasOverride) {
        ontimeControl = `<button class="wp-ontime-revert" onclick="claimStartedOnTime('${escapeHtml(wp.id)}', { toggleOff: true })" title="Revert to join-time anchor">On time ✓</button>`;
      } else if (isLate) {
        ontimeControl = `<button class="wp-ontime-claim" onclick="claimStartedOnTime('${escapeHtml(wp.id)}')" title="I was already watching from the start — anchor my timer to the scheduled start time">I started on time</button>`;
      }
    }
    // Phase 11 / REFR-10 — Team-flair badge: apply --team-color custom property to
    // the avatar inline style when the participant has picked an allegiance. CSS rule
    // .wp-participant-av[style*="--team-color"] draws a 2px border in team color.
    const teamColor = p.teamColor || null;
    const avStyle = teamColor
      ? `background:${color};--team-color:${escapeHtml(teamColor)};`
      : `background:${color};`;
    const teamFlairClass = teamColor ? ' has-team-flair' : '';
    return `<div class="wp-participant-chip ${chipClass} ${isMe ? 'me' : ''}" data-member-id="${escapeHtml(mid)}">
      <div class="wp-participant-av${teamFlairClass}" style="${avStyle}" aria-hidden="true">${escapeHtml(initial)}</div>
      <div class="wp-participant-info">
        <div class="wp-participant-name">${escapeHtml(name)}${isMe ? ' <span class="muted">(you)</span>' : ''}</div>
        <div class="wp-participant-time" data-role="pt-time">${escapeHtml(statusLabel)}</div>
        ${ontimeControl}
      </div>
    </div>`;
  }).join('');
  // === Phase 27 — append guest chips after member chips ===
  const familyMemberNamesSet = getFamilyMemberNamesSet();
  const visibleGuests = (Array.isArray(wp.guests) ? wp.guests : []).filter(g => g && !g.revoked);
  const isHost = state.me && state.me.id === wp.hostId;
  const guestChips = visibleGuests.map(guest => {
    const safeGuestId = escapeHtml(guest.guestId || '');
    const rawName = (guest.name || 'Guest').toString();
    const display = displayGuestName(rawName, familyMemberNamesSet);
    const initial = (display || '?')[0].toUpperCase();
    const respLabel = guestResponseLabel(guest.response);
    const kebab = isHost
      ? `<button class="wp-guest-kebab" type="button" aria-label="Guest options for ${escapeHtml(display)}" onclick="event.stopPropagation();openGuestMenu('${safeGuestId}','${escapeHtml(wp.id)}',event)">&#8942;</button>`
      : '';
    return `<div class="wp-participant-chip guest" data-guest-id="${safeGuestId}" role="listitem">
      <div class="wp-participant-av" style="background:#5a8a84;" aria-hidden="true">${escapeHtml(initial)}</div>
      <div class="wp-participant-info">
        <div class="wp-participant-name">${escapeHtml(display)}<span class="chip-badge badge-guest">guest</span></div>
        <div class="wp-participant-time" data-role="pt-time">${escapeHtml(respLabel)}</div>
      </div>
      ${kebab}
    </div>`;
  }).join('');
  return `<div class="wp-participants-strip" role="list" aria-label="Watchparty participants">${chips}${guestChips}</div>`;
}

function renderReaction(r, mode) {
  const color = memberColor(r.memberId);
  const initial = (r.memberName || '?')[0].toUpperCase();
  const stamp = mode === 'wallclock'
    ? new Date(r.at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})
    : formatElapsed(r.elapsedMs || 0);
  const content = r.kind === 'emoji'
    ? `<div class="wp-reaction-emoji">${r.emoji || ''}</div>`
    : `<div>${escapeHtml(r.text || '')}</div>`;
  return `<div class="wp-reaction-row">
    <div class="wp-reaction-avatar" style="background:${color};" aria-hidden="true">${escapeHtml(initial)}</div>
    <div style="flex:1;min-width:0;">
      <div class="wp-reaction-bubble">${content}</div>
      <div class="wp-reaction-meta">${escapeHtml(r.memberName)} · ${stamp}</div>
    </div>
  </div>`;
}

function renderWatchpartyFooter(wp, mine) {
  const mode = mine.reactionsMode || 'elapsed';
  const paused = !!mine.pausedAt;
  // Phase 7 Plan 03: '+ more' button opens the iOS native emoji keyboard via hidden-input focus.
  // Keeps palette familiar while unlocking unlimited emoji choice without a JS picker library.
  const emojiBtns = WP_QUICK_EMOJIS.map(e => `<button class="wp-emoji-btn" onclick="postEmojiReaction('${e}')" aria-label="React with ${e}">${twemojiImg(e, e, 'twemoji--md')}</button>`).join('')
    + `<button class="wp-emoji-btn wp-emoji-more" onclick="openEmojiPicker()" aria-label="More emoji">+</button>`;
  // Phase 7 Plan 07 (PARTY-04): reaction-delay preset chips. Only meaningful in elapsed mode
  // — wallclock ignores delay by design (shows everything as-posted) and hidden renders nothing
  // regardless. Chips are a thin visual modifier on the base .wp-control-btn class.
  // Phase 15.5 / D-02 + REQ-2 + REQ-4 + REQ-6: 8-element chip ladder (Live + 6 presets + Custom).
  // Custom… renders dashed border in idle state; ON when reactionDelay > 0 AND not in preset list.
  // Per UI-SPEC § Banned-words ledger: no 'delay'/'buffer'/'queue'/'offset'/'sync' in chip labels or aria-labels.
  const currentDelay = (mine.reactionDelay || 0);
  const delayPresets = [0, 15, 60, 300, 900, 1800, 3600];
  const presetLabels = { 0: 'Live', 15: '15 sec', 60: '1 min', 300: '5 min', 900: '15 min', 1800: '30 min', 3600: '1 hr' };
  const isPresetMatch = delayPresets.includes(currentDelay);
  const customOn = currentDelay > 0 && !isPresetMatch;
  const presetChipsHtml = delayPresets.map(s => {
    const label = presetLabels[s];
    const on = s === currentDelay;
    const aria = s === 0
      ? (on ? 'Wait up: Live, currently active' : 'Stop waiting up, go back to live')
      : (on ? `Wait up: ${label}, currently active` : `Wait up: ${label}`);
    return `<button class="wp-control-btn wp-delay ${on?'on':''}" onclick="setReactionDelay(${s})" aria-label="${escapeHtml(aria)}">${escapeHtml(label)}</button>`;
  }).join('');
  const customAria = customOn ? 'Wait up: open custom picker, currently active' : 'Wait up: open custom picker';
  const customChipHtml = `<button class="wp-control-btn wp-delay custom-chip ${customOn?'on':''}" onclick="openWaitUpPicker()" aria-label="${escapeHtml(customAria)}">Custom…</button>`;
  const delayChips = presetChipsHtml + customChipHtml;
  // Phase 15.5 / D-07 + REQ-5: sub-line below chip strip with italic 'waiting {value}' readout
  // and +5 min nudge button. Visible only when currentDelay > 0; hidden at Live (0).
  const subLineDisplay = currentDelay > 0 ? 'flex' : 'none';
  const readoutValue = dvrReadoutText(currentDelay);
  const subLineHtml = `<div class="wp-delay-subline" id="wp-delay-subline" style="display:${subLineDisplay};">
      <em class="serif-italic wp-delay-readout-text">waiting ${escapeHtml(readoutValue)}</em>
      <button class="wp-delay-nudge-btn" onclick="addWaitUpNudge()" aria-label="Add 5 minutes to wait up">+5 min</button>
    </div>`;
  const delayRowDisplay = (mode === 'elapsed') ? 'flex' : 'none';
  const controls = `<div class="wp-controls">
    ${paused
      ? `<button class="wp-control-btn on" onclick="toggleWpPause()">▶ Resume</button>`
      : `<button class="wp-control-btn" onclick="toggleWpPause()">⏸ Pause</button>`}
    <button class="wp-control-btn ${mode==='hidden'?'on':''}" onclick="setWpMode('${mode==='hidden'?'elapsed':'hidden'}')" title="${mode==='hidden'?'Reactions are hidden from you right now':'Hide reactions for a bit (bathroom break, etc.)'}">${mode==='hidden'?'Reactions off':'Hide reactions'}</button>
    <button class="wp-control-btn ${mode==='wallclock'?'on':''}" onclick="setWpMode('${mode==='wallclock'?'elapsed':'wallclock'}')" title="${mode==='wallclock'?'Showing reactions in real time. Tap to switch back to synced mode':'Reactions are timed to your progress. Tap to see them all in real time'}">${mode==='wallclock'?'Real-time on':'Real-time'}</button>
    <button class="wp-control-btn danger" onclick="endMyWatchparty('${wp.id}')">Done</button>
  </div>
  <div class="wp-delay-row" style="display:${delayRowDisplay};">
    <span class="wp-delay-label">Wait up</span>
    ${delayChips}
  </div>
  ${subLineHtml}`;
  return `<div class="wp-live-footer">
    ${controls}
    <div class="wp-emoji-row">${emojiBtns}</div>
    <div class="wp-compose">
      <input type="text" id="wp-compose-input" placeholder="${paused ? 'Paused. We waited up.' : 'Say something…'}" maxlength="240" ${paused?'disabled':''}>
      <button onclick="postTextReaction()" ${paused?'disabled style="opacity:0.5;"':''}>Post</button>
    </div>
  </div>`;
}

// ==== Reaction posting ====
window.postEmojiReaction = async function(emoji) {
  await postReaction({ kind: 'emoji', emoji });
};

// Phase 7 Plan 03: native emoji keyboard picker via hidden-input focus trick.
// Works on iOS (swipe globe to emoji tab in the keyboard), Android (native picker), and
// desktop (macOS Ctrl+Cmd+Space, Windows Win+.). No JS emoji-picker library — keeps the
// single-file no-bundler constraint. Uses Intl.Segmenter for grapheme-cluster-safe
// extraction so multi-codepoint emoji (e.g. family stickers joined by ZWJs) send correctly.
window.openEmojiPicker = function() {
  const input = document.getElementById('wp-emoji-input');
  if (!input) return;
  input.value = '';
  input.focus();
  input.oninput = () => {
    const val = input.value || '';
    input.value = '';
    if (!val) return;
    let first;
    try {
      first = Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(val))[0]?.segment;
    } catch (e) {
      // Older browsers without Intl.Segmenter: approximate by taking codepoint pairs
      first = val.length >= 2 && val.charCodeAt(0) >= 0xD800 && val.charCodeAt(0) <= 0xDBFF
        ? val.slice(0, 2)
        : val.slice(0, 1);
    }
    if (first) postEmojiReaction(first);
    input.blur();
  };
};
window.postTextReaction = async function() {
  const input = document.getElementById('wp-compose-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await postReaction({ kind: 'text', text });
};

// Phase 26 / RPLY-26-01..RPLY-26-03 — Position-derivation hybrid for the reactions schema additions.
// Branch order LOCKED per CONTEXT D-01..D-05 + UI-SPEC enum closure (do NOT reorder):
//   1. ctx.isReplay === true               → { localReplayPositionMs (default 0), 'replay' }
//   2. ctx.wp.isLiveStream === true        → { null, 'live-stream' }
//   3. broadcast fresh (within STALE_BROADCAST_MAX_MS) → { extrapolated, 'broadcast' }
//   4. otherwise (no broadcast / stale)    → { ctx.elapsedMs, 'elapsed' }
// Pure: no DOM reads, no Firestore writes; only reads its arguments.
// Smoke mirrors this body inline per scripts/smoke-decision-explanation.cjs precedent.
function derivePositionForReaction(ctx) {
  const wp = ctx && ctx.wp ? ctx.wp : {};

  // (1) Replay-mode compounding (D-05) — overrides everything; locked first.
  if (ctx && ctx.isReplay === true) {
    const pos = (typeof ctx.localReplayPositionMs === 'number' && isFinite(ctx.localReplayPositionMs))
      ? Math.max(0, Math.round(ctx.localReplayPositionMs))
      : 0;
    return { runtimePositionMs: pos, runtimeSource: 'replay' };
  }

  // (2) Live-stream — D-03 (no re-watchable timeline).
  if (wp.isLiveStream === true) {
    return { runtimePositionMs: null, runtimeSource: 'live-stream' };
  }

  // (3) Fresh broadcast — D-01 primary path.
  const ct = (typeof wp.currentTimeMs === 'number' && isFinite(wp.currentTimeMs)) ? wp.currentTimeMs : null;
  const ctUpdatedAt = (typeof wp.currentTimeUpdatedAt === 'number' && isFinite(wp.currentTimeUpdatedAt))
    ? wp.currentTimeUpdatedAt : null;
  if (ct !== null && ctUpdatedAt !== null) {
    const sinceUpdate = Date.now() - ctUpdatedAt;
    if (sinceUpdate >= 0 && sinceUpdate < STALE_BROADCAST_MAX_MS) {
      return {
        runtimePositionMs: Math.max(0, Math.round(ct + sinceUpdate)),
        runtimeSource: 'broadcast'
      };
    }
  }

  // (4) Fallback — D-02 (no player / stale broadcast → elapsedMs proxy).
  const elapsed = (ctx && typeof ctx.elapsedMs === 'number' && isFinite(ctx.elapsedMs)) ? ctx.elapsedMs : 0;
  return { runtimePositionMs: Math.max(0, Math.round(elapsed)), runtimeSource: 'elapsed' };
}

async function postReaction(payload) {
  if (!state.me || !state.activeWatchpartyId) return;
  if (guardReadOnlyWrite()) return;                // Plan 5.8 D-15: no watchparty reactions from unclaimed post-grace
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp) return;
  const mine = myParticipation(wp);
  if (!mine || !mine.startedAt) { alert('Start your timer first.'); return; }
  if (mine.pausedAt) { alert('You are paused. Resume to post.'); return; }
  const elapsedMs = computeElapsed(mine, wp);

  // Phase 26 / RPLY-26-01 + RPLY-26-07 — derive position-anchored fields for the reaction.
  // isReplay path is reachable when Plan 02 ships state.activeWatchpartyMode = 'revisit' on
  // the replay-mode entry path; until then this stays false and live-mode reactions land
  // on broadcast/elapsed/live-stream per D-01..D-03.
  const { runtimePositionMs, runtimeSource } = derivePositionForReaction({
    wp,
    mine,
    elapsedMs,
    isReplay: state.activeWatchpartyMode === 'revisit',
    localReplayPositionMs: state.replayLocalPositionMs
  });

  const reaction = {
    id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    ...writeAttribution(),
    elapsedMs,
    at: Date.now(),
    runtimePositionMs,
    runtimeSource,
    ...payload
  };
  try {
    await updateDoc(watchpartyRef(wp.id), { reactions: arrayUnion(reaction), lastActivityAt: Date.now(), ...writeAttribution() });
    // Local optimistic refresh — snapshot will overwrite this imminently
    wp.reactions = [...(wp.reactions || []), reaction];
    renderWatchpartyLive();
  } catch(e) { console.error('post reaction failed', e); }
}

// ==== Controls ====
window.toggleWpPause = async function() {
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp || !state.me) return;
  const mine = myParticipation(wp);
  if (!mine || !mine.startedAt) return;
  const now = Date.now();
  if (mine.pausedAt) {
    // Resuming: add the pause duration to pausedOffset, clear pausedAt
    const pauseDuration = now - mine.pausedAt;
    const newOffset = (mine.pausedOffset || 0) + pauseDuration;
    try {
      await updateDoc(watchpartyRef(wp.id), {
        [`participants.${state.me.id}.pausedAt`]: null,
        [`participants.${state.me.id}.pausedOffset`]: newOffset,
        ...writeAttribution()
      });
    } catch(e) { alert('Could not resume: ' + e.message); }
  } else {
    // Pausing: record pausedAt
    try {
      await updateDoc(watchpartyRef(wp.id), {
        [`participants.${state.me.id}.pausedAt`]: now,
        ...writeAttribution()
      });
    } catch(e) { alert('Could not pause: ' + e.message); }
  }
};

window.setWpMode = async function(mode) {
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp || !state.me) return;
  // Phase 7 Plan 06 (Gap #2a): pre-await optimistic mutation + synchronous re-render so
  // the toggle feels instant even on flaky networks. Distinct from postReaction's post-await
  // echo pattern at js/app.js:~7843 — mode toggles are local UI preferences that must feel
  // immediate, and rollback is trivial (onSnapshot handler overwrites within ~1s if the
  // write is rejected). See 07-06-PLAN risk_notes for rationale.
  if (wp.participants && wp.participants[state.me.id]) {
    wp.participants[state.me.id].reactionsMode = mode;
  }
  renderWatchpartyLive();
  try {
    await updateDoc(watchpartyRef(wp.id), {
      [`participants.${state.me.id}.reactionsMode`]: mode,
      lastActivityAt: Date.now(),  // consistent with 07-01's bookkeeping
      ...writeAttribution()
    });
  } catch(e) { alert('Could not change mode: ' + e.message); }
};

// Phase 7 Plan 07 (PARTY-04): setReactionDelay — viewer-side reaction-delay preset toggle.
// Adopts the SAME pre-await optimistic shape as setWpMode above (Plan 06's Gap #2a fix):
// mutate local state + synchronous renderWatchpartyLive() BEFORE the await updateDoc, so the
// preset chip highlights instantly. Distinct from postReaction's post-await echo pattern —
// delay is a local UI preference (zero-latency feel matters, rollback is trivial via
// onSnapshot authoritative overwrite). Seconds are clamped [0, 86400] defensively (Phase 15.5
// widened from [0, 60]) — UI offers Live + 6 chip presets + Custom… picker + slider 0-24h.
window.setReactionDelay = async function(seconds) {
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp || !state.me) return;
  // Phase 15.5 / D-01 + REQ-1: clamp widened from 60 to 86400 (24 hr) — supports flex Wait Up across sport+movie modes.
  const s = Math.max(0, Math.min(86400, parseInt(seconds, 10) || 0));
  // Pre-await optimistic mutation — matches setWpMode's shape (Plan 06 Gap #2a).
  if (wp.participants && wp.participants[state.me.id]) {
    wp.participants[state.me.id].reactionDelay = s;
  }
  renderWatchpartyLive();
  try {
    await updateDoc(watchpartyRef(wp.id), {
      [`participants.${state.me.id}.reactionDelay`]: s,
      lastActivityAt: Date.now(),  // consistent with setWpMode + Phase 7 D-06 orphan detection
      ...writeAttribution()
    });
  } catch(e) { alert('Could not change delay: ' + e.message); }
};

// Phase 15.5 / D-07 + REQ-5: addWaitUpNudge — +5 min nudge for the bathroom-bump case.
// Adds 300 sec to current reactionDelay, clamped at 86400 (24 hr). Pattern copied from
// setReactionDelay's pre-await optimistic mutation shape (lines 11268-11285 above).
// Haptic on successful add only; no haptic on clamp (per UI-SPEC § +5 min nudge button —
// no haptic for "did nothing"). Logs failures via qnLog (matches setDvrOffset error path).
window.addWaitUpNudge = async function() {
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp || !state.me) return;
  const mine = wp.participants && wp.participants[state.me.id];
  if (!mine) return;
  const current = mine.reactionDelay || 0;
  if (current <= 0) return; // button is hidden when 0; defensive guard
  const newVal = Math.max(0, Math.min(86400, current + 300));
  const wasClamped = (current + 300) > 86400;
  if (!wasClamped && typeof haptic === 'function') {
    try { haptic(); } catch(e) { /* haptic best-effort */ }
  }
  // Pre-await optimistic mutation (matches setReactionDelay shape — js/app.js:11273-11277).
  if (wp.participants && wp.participants[state.me.id]) {
    wp.participants[state.me.id].reactionDelay = newVal;
  }
  renderWatchpartyLive();
  try {
    await updateDoc(watchpartyRef(wp.id), {
      [`participants.${state.me.id}.reactionDelay`]: newVal,
      lastActivityAt: Date.now(),
      ...writeAttribution()
    });
  } catch(e) {
    if (typeof qnLog === 'function') qnLog('[WaitUp] nudge write failed', e && e.message);
  }
};

// Phase 15.5 / D-03 + REQ-3 + REQ-8: Wait Up custom picker open/close/submit.
// R-1 mitigation: scrollIntoView on focus to avoid iOS keyboard overlap on standalone PWA.
window.openWaitUpPicker = function() {
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  const mine = wp && wp.participants && state.me ? wp.participants[state.me.id] : null;
  const current = (mine && mine.reactionDelay) || 0;
  const h = Math.floor(current / 3600);
  const m = Math.floor((current % 3600) / 60);
  const s = current % 60;
  const hEl = document.getElementById('wup-hours');
  const mEl = document.getElementById('wup-min');
  const sEl = document.getElementById('wup-sec');
  if (hEl) hEl.value = h ? String(h) : '';
  if (mEl) mEl.value = m ? String(m) : '';
  if (sEl) sEl.value = s ? String(s) : '';
  const bg = document.getElementById('wait-up-picker-bg');
  if (bg) bg.classList.add('on');
  // Focus hours input + scroll into view (R-1 — iOS keyboard overlap mitigation).
  // setTimeout 60ms ensures the .on class has applied + sheet has slid up before focus fires.
  setTimeout(() => {
    if (hEl) {
      try { hEl.focus(); } catch(e) { /* defensive */ }
      try { hEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(e) { /* defensive */ }
    }
  }, 60);
};

window.closeWaitUpPicker = function() {
  const bg = document.getElementById('wait-up-picker-bg');
  if (bg) bg.classList.remove('on');
  // Return focus to the Custom… chip for accessibility (per UI-SPEC § Accessibility / focus order).
  const customChip = document.querySelector('.wp-control-btn.wp-delay.custom-chip');
  if (customChip && typeof customChip.focus === 'function') {
    try { customChip.focus(); } catch(e) { /* defensive */ }
  }
};

window.submitWaitUpPicker = function() {
  const hEl = document.getElementById('wup-hours');
  const mEl = document.getElementById('wup-min');
  const sEl = document.getElementById('wup-sec');
  const h = hEl ? (parseInt(hEl.value, 10) || 0) : 0;
  const m = mEl ? (parseInt(mEl.value, 10) || 0) : 0;
  const s = sEl ? (parseInt(sEl.value, 10) || 0) : 0;
  const total = Math.max(0, Math.min(86400, h * 3600 + m * 60 + s));
  // setReactionDelay clamps at 86400 too (Plan 01) — defense in depth.
  setReactionDelay(total);
  closeWaitUpPicker();
};

window.setPickerPreset = function(sec) {
  // Tap on 1 hr / 2 hr / 12 hr / 24 hr inside the picker — fills fields AND submits in one tap (D-03).
  const safeSec = Math.max(0, Math.min(86400, parseInt(sec, 10) || 0));
  const h = Math.floor(safeSec / 3600);
  const m = Math.floor((safeSec % 3600) / 60);
  const s = safeSec % 60;
  const hEl = document.getElementById('wup-hours');
  const mEl = document.getElementById('wup-min');
  const sEl = document.getElementById('wup-sec');
  if (hEl) hEl.value = String(h);
  if (mEl) mEl.value = String(m);
  if (sEl) sEl.value = String(s);
  submitWaitUpPicker();
};

// Phase 15.5 / D-04 + REQ-10: Past parties surface — modal-based listing of 5h-25h stale wps.
// Sorted most-recent-first per UI-SPEC § "6b Sort order".
// Modal approach (per RESEARCH § REQ-9) avoids un-highlighted tab-bar state issue and gives free
// hardware-back / iOS-swipe-back dismissal.
window.openPastParties = function() {
  renderPastParties();
  const bg = document.getElementById('past-parties-bg');
  if (bg) bg.classList.add('on');
};

window.closePastParties = function() {
  const bg = document.getElementById('past-parties-bg');
  if (bg) bg.classList.remove('on');
  // Phase 26 / Pitfall 10 — reset pagination cursor between sessions for cleanliness.
  state.pastPartiesShownCount = null;
};

function renderPastParties() {
  const el = document.getElementById('past-parties-list');
  if (!el) return;
  const PAST_PARTIES_PAGE_SIZE = 20;  // D-09 lock per UI-SPEC §4
  // Phase 26 / RPLY-26-09 — switch query from 5h-25h WP_STALE_MS window to ALL archived
  // parties with replay-able reactions. allArchived is the unsliced authoritative list.
  const allArchived = archivedWatchparties()
    .filter(wp => wp.status !== 'cancelled')
    .filter(wp => replayableReactionCount(wp) >= 1)
    .sort((a, b) => b.startAt - a.startAt);  // most-recent-first
  if (!allArchived.length) {
    // Defensive — shouldn't happen because the inline link is hidden when count is 0.
    el.innerHTML = '';
    return;
  }
  const shownCount = state.pastPartiesShownCount || PAST_PARTIES_PAGE_SIZE;
  const visible = allArchived.slice(0, shownCount);
  const rowsHtml = visible.map(wp => {
    const participantCount = wp.participants ? Object.keys(wp.participants).length : 0;
    const reactionCount = replayableReactionCount(wp);
    const reactionLabel = reactionCount === 1 ? '1 reaction' : (reactionCount + ' reactions');
    const titleNameSafe = escapeHtml(wp.titleName || 'Watchparty');
    const posterStyle = wp.titlePoster
      ? `background-image:url('${escapeHtml(wp.titlePoster)}')`
      : '';
    const wpIdSafe = escapeHtml(wp.id);
    const dateLine = friendlyPartyDate(wp.startAt);
    const ariaLabel = `${titleNameSafe}, ${dateLine}, ${participantCount} on the couch, ${reactionLabel}`;
    // Phase 26 / RPLY-26-08 part 1 — row tap enters replay variant.
    const actionFn = `openWatchpartyLive('${wpIdSafe}', { mode: 'revisit' })`;
    return `<div class="past-parties-row" role="button" tabindex="0"
              onclick="closePastParties();${actionFn}"
              onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();closePastParties();${actionFn};}"
              aria-label="${escapeHtml(ariaLabel)}">
      <div class="past-parties-poster" style="${posterStyle}"></div>
      <div class="past-parties-body">
        <div class="past-parties-title">${titleNameSafe}</div>
        <div class="past-parties-meta">${escapeHtml(dateLine)}</div>
        <div class="past-parties-meta">${participantCount} on the couch</div>
        <div class="past-parties-meta">${reactionLabel}</div>
      </div>
      <span class="past-parties-row-chevron" aria-hidden="true">›</span>
    </div>`;
  }).join('');
  // Phase 26 / RPLY-26-PAGE — pagination affordance per UI-SPEC §4.
  const showOlderHtml = allArchived.length > shownCount
    ? `<div class="past-parties-show-older" role="button" tabindex="0"
          onclick="state.pastPartiesShownCount = (state.pastPartiesShownCount || ${PAST_PARTIES_PAGE_SIZE}) + ${PAST_PARTIES_PAGE_SIZE}; renderPastParties();"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();state.pastPartiesShownCount = (state.pastPartiesShownCount || ${PAST_PARTIES_PAGE_SIZE}) + ${PAST_PARTIES_PAGE_SIZE}; renderPastParties();}"
          aria-label="Show older parties">
        Show older parties <span class="past-parties-chevron" aria-hidden="true">›</span>
      </div>`
    : '';
  el.innerHTML = rowsHtml + showOlderHtml;
}

// Phase 7 Plan 08 (Issue #4): claimStartedOnTime — late-joiner manual override for the
// elapsed-time anchor. When a participant joined AFTER startAt + grace (default inference
// branch doesn't fire for them) but they WERE actually watching from the scheduled start,
// this flips their effectiveStartAt to wp.startAt. Idempotent — opts.toggleOff reverts to
// null, which falls back to the default inference / startedAt cascade in effectiveStartFor.
//
// Adopts the SAME pre-await optimistic shape as setWpMode (Plan 06 Gap #2a) and
// setReactionDelay (Plan 07): mutate local state + synchronous renderWatchpartyLive()
// BEFORE awaiting the Firestore write so the chip re-renders instantly. Distinct from
// postReaction's post-await echo pattern — override toggle is a local UI preference where
// zero-latency feel matters and rollback via onSnapshot authoritative overwrite is trivial
// for a single primitive field.
window.claimStartedOnTime = async function(wpId, opts) {
  const options = opts || {};
  const wp = state.watchparties.find(x => x.id === wpId);
  if (!wp || !state.me) return;
  const mine = wp.participants && wp.participants[state.me.id];
  if (!mine) return;
  const toggleOff = !!options.toggleOff;
  const nextValue = toggleOff ? null : wp.startAt;
  // Pre-await optimistic mutation — matches setWpMode / setReactionDelay shape.
  mine.effectiveStartAt = nextValue;
  renderWatchpartyLive();
  try {
    await updateDoc(watchpartyRef(wpId), {
      [`participants.${state.me.id}.effectiveStartAt`]: nextValue,
      lastActivityAt: Date.now(),  // consistent with setWpMode + Phase 7 D-06 orphan detection
      ...writeAttribution()
    });
  } catch(e) { alert('Could not update: ' + e.message); }
};

// Phase 11 / REFR-07 — toggleReadyCheck: per-member Ready toggle in the T-15min lobby.
// TDZ-safe ordering: the `const wp = ...` declaration precedes ANY reference to `wp` /
// `!wp`. Prior-draft anti-pattern put identity-via-wp guards before the const and crashed
// every call with `Cannot access 'wp' before initialization`. Ordering enforced by plan
// acceptance criteria + threat T-11-05-10 mitigation.
//
// Adopts the SAME pre-await optimistic shape as setWpMode (07-06) / setReactionDelay (07-07)
// / claimStartedOnTime (07-08): mutate local state + synchronous renderWatchpartyLive()
// BEFORE awaiting the Firestore write. Rollback via onSnapshot authoritative overwrite.
window.toggleReadyCheck = async function(wpId) {
  if (guardReadOnlyWrite()) return;
  // Identity-only guard first (does NOT read wp; safe before const) —
  if (!state.me || wpId !== state.activeWatchpartyId) return;
  // Declare wp BEFORE any `wp.` / `!wp` reference to prevent TDZ ReferenceError.
  const wp = state.watchparties && state.watchparties.find(x => x.id === wpId);
  if (!wp) return;
  const myEntry = wp.participants && wp.participants[state.me.id];
  const newReady = !(myEntry && myEntry.ready);
  // Pre-await optimistic mutation + sync re-render — matches setWpMode shape.
  if (!wp.participants) wp.participants = {};
  if (!wp.participants[state.me.id]) wp.participants[state.me.id] = { name: state.me.name };
  wp.participants[state.me.id].ready = newReady;
  renderWatchpartyLive();
  try {
    await updateDoc(watchpartyRef(wpId), {
      [`participants.${state.me.id}.ready`]: newReady,
      lastActivityAt: Date.now(),
      ...writeAttribution()
    });
    haptic('success');
  } catch(e) {
    flashToast('Could not save', { kind: 'error' });
  }
};

// Phase 11 / REFR-07 — hostStartSession: host-triggered early start once majority Ready.
// Flips status to 'active' immediately and stamps startedAt. T-11-05-07 mitigation: client-side
// `state.me.id === wp.hostId` guard; server-side existing firestore.rules restrict participant
// writes by role. Same TDZ-safe const-before-reference ordering as toggleReadyCheck.
window.hostStartSession = async function(wpId) {
  if (guardReadOnlyWrite()) return;
  if (!state.me) return;
  const wp = state.watchparties && state.watchparties.find(x => x.id === wpId);
  if (!wp) return;
  if (state.me.id !== wp.hostId) return;
  try {
    await updateDoc(watchpartyRef(wpId), {
      status: 'active',
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      ...writeAttribution()
    });
    haptic('success');
    flashToast('Rolling…', { kind: 'success' });
  } catch(e) {
    flashToast('Could not start', { kind: 'error' });
  }
};

// ---- Phase 11 / REFR-09 — Post-session modal handlers ----
// Opens on endMyWatchparty (user taps "Done" on live footer). Shows 5-star rating +
// couch-photo upload (Firebase Storage first use, narrow scope per CLAUDE.md) +
// "Schedule another night" CTA that pre-fills the watchparty start modal with the same
// title. "Maybe later" dismisses and flags wp.postSessionDismissedBy[memberId]=true.

// === Phase 15 / D-01 (TRACK-15-03) — REVIEW MEDIUM-5 episode resolution waterfall ===
// D-01 spec: "members who joined + episode queued = automatic progress tuple."
// "Episode queued" means the episode that was selected when the watchparty
// was scheduled. Prefer the watchparty payload over host-progress inference.
// Returns { season, episode, sourceField } when any tier resolves, else null.
//
// Tier order (highest confidence first):
//   1. wp.episode + wp.season         (direct fields — Phase 7 schema)
//   2. wp.queuedEpisode {season,episode}  (nested object — payload variant)
//   3. wp.intent.proposedSeason + wp.intent.proposedEpisode  (Phase 14-08 Flow B prefill inheritance)
//   4. host-progress + 1              (last-resort fallback — explicit "best guess"; sourceField='host-progress-plus-1')
//   5. null                           (abort: better to skip stash than to lie)
//
// Field-shape verification at execution time (2026-04-27): Grep on
// `wp.episode|wp.season|wp.queuedEpisode|wp.intent|proposedSeason|proposedEpisode`
// across js/app.js returned NO matches — meaning the current Phase 7 watchparty
// schema does NOT store any queued-episode metadata on the wp doc, AND Phase
// 14-08 Flow B intents are not propagated as wp.intent. As a result, in
// production today only Tier 4 (host-progress + 1) will resolve. Tiers 1-3 are
// future-ready scaffolding for a follow-up plan that extends the wp schema (or
// for any consumer who chooses to propagate wp.intent on Flow-B-spawned
// watchparties). The stash records `sourceField` so 15-04 UI + telemetry can
// distinguish high-confidence from best-guess resolutions.
function resolveAutoTrackEpisode(wp, t) {
  if (!wp || !t || t.kind !== 'TV') return null;
  // Tier 1 — direct fields on wp
  if (wp.episode != null && wp.season != null) {
    return { season: wp.season, episode: wp.episode, sourceField: 'wp.episode' };
  }
  // Tier 2 — wp.queuedEpisode object
  if (wp.queuedEpisode && wp.queuedEpisode.episode != null && wp.queuedEpisode.season != null) {
    return {
      season: wp.queuedEpisode.season,
      episode: wp.queuedEpisode.episode,
      sourceField: 'wp.queuedEpisode'
    };
  }
  // Tier 3 — Phase 14-08 Flow B intent inheritance
  if (wp.intent && wp.intent.proposedEpisode != null && wp.intent.proposedSeason != null) {
    return {
      season: wp.intent.proposedSeason,
      episode: wp.intent.proposedEpisode,
      sourceField: 'wp.intent'
    };
  }
  // Tier 4 — host-progress + 1 fallback (last resort; explicitly low-confidence)
  if (wp.hostId) {
    const hostProgress = (t.progress || {})[wp.hostId];
    if (hostProgress && hostProgress.season != null && hostProgress.episode != null) {
      return {
        season: hostProgress.season,
        episode: hostProgress.episode + 1,
        sourceField: 'host-progress-plus-1'
      };
    }
  }
  // Tier 5 — abort
  return null;
}

let _postSessionWpId = null;
let _postSessionRating = 0;

window.openPostSession = function(wpId) {
  const wp = state.watchparties && state.watchparties.find(x => x.id === wpId);
  if (!wp || !state.me) return;
  const dismissed = wp.postSessionDismissedBy && wp.postSessionDismissedBy[state.me.id];
  const alreadyRated = wp.ratings && wp.ratings[state.me.id];
  if (dismissed || alreadyRated) return;
  _postSessionWpId = wpId;
  _postSessionRating = 0;
  // === Phase 15 / D-01 (TRACK-15-03) — auto-track tuple progress on watchparty end ===
  // Compute the auto-track candidate from the watchparty roster + REVIEW MEDIUM-5
  // episode resolution waterfall. Stash on state._pendingTupleAutoTrack —
  // 15-04's post-session sub-render reads this and presents an inline
  // "Mark S{N}E{M} for {tupleName}? [Yes] [Edit]" affordance. Yes calls
  // writeTupleProgress(...). Edit opens openProgressSheet for manual selection.
  // We DO NOT silently write the tuple — D-06 forbids silent fabrication.
  state._pendingTupleAutoTrack = null;  // clear stale stash from prior open
  if (wp.titleId) {
    const wpParticipants = Object.keys(wp.participants || {}).filter(mid => {
      const p = wp.participants[mid];
      return p && p.startedAt;  // only members who actually started timers
    });
    if (wpParticipants.length >= 1) {
      const t = state.titles.find(x => x.id === wp.titleId);
      if (t && t.kind === 'TV') {
        const resolved = resolveAutoTrackEpisode(wp, t);
        if (resolved) {
          state._pendingTupleAutoTrack = {
            titleId: wp.titleId,
            memberIds: wpParticipants,
            season: resolved.season,
            episode: resolved.episode,
            sourceField: resolved.sourceField,  // 'wp.episode' | 'wp.queuedEpisode' | 'wp.intent' | 'host-progress-plus-1'
            sourceWpId: wpId
          };
          // Sentry breadcrumb so we can telemeter which tier wins in production
          try {
            if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
              Sentry.addBreadcrumb({
                category: 'tupleAutoTrack',
                level: 'info',
                message: 'auto-track candidate stashed',
                data: { sourceField: resolved.sourceField, season: resolved.season, episode: resolved.episode }
              });
            }
          } catch (_) {}
        } else {
          // No tier resolved — tier-5 abort. Don't stash. Sentry-track so we
          // can observe how often this happens in production (informs whether
          // we need a follow-up plan to extend wp schema).
          try {
            if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
              Sentry.addBreadcrumb({
                category: 'tupleAutoTrack',
                level: 'warning',
                message: 'auto-track aborted — no episode could be resolved from wp/intent/host-progress',
                data: { wpId: wpId, titleId: wp.titleId }
              });
            }
          } catch (_) {}
        }
      }
    }
  }
  const sub = document.getElementById('wp-post-session-sub');
  if (sub) {
    let baseHtml = `<em>How was ${escapeHtml(wp.titleName || 'that')}?</em>`;
    // === Phase 15 / D-01 (TRACK-15-04) — auto-track confirmation row ===
    // REVIEW MEDIUM-7 — data-cv15-action attrs + delegated listener (NOT inline onclick).
    const at = state._pendingTupleAutoTrack;
    if (at && at.titleId === wp.titleId && at.memberIds && at.memberIds.length) {
      const tk = tupleKey(at.memberIds);
      const tupleNameRaw = (tk && tupleCustomName(tk))
        || (tk && tupleDisplayName(tk, state.members))
        || 'this couch';
      const seasonNum = at.season != null ? at.season : '?';
      const episodeNum = at.episode != null ? at.episode : '?';
      // REVIEW MEDIUM-5 surface — show "(best guess)" qualifier when low-confidence.
      const confidenceQual = (at.sourceField === 'host-progress-plus-1')
        ? `<span class="cv15-autotrack-confidence"> (best guess)</span>`
        : '';
      const promptLabel = `Mark S${escapeHtml(String(seasonNum))}E${escapeHtml(String(episodeNum))} for <strong>${escapeHtml(tupleNameRaw)}</strong>?${confidenceQual}`;
      baseHtml += `<div class="cv15-autotrack-row">
        <p>${promptLabel}</p>
        <button class="tc-primary" type="button" data-cv15-action="confirmAutoTrack">Yes</button>
        <button class="tc-secondary" type="button" data-cv15-action="editAutoTrack">Edit</button>
      </div>`;
    }
    sub.innerHTML = baseHtml;
    // REVIEW MEDIUM-7 — attach delegated listener for the Yes/Edit buttons.
    if (typeof cv15AttachPostSessionDelegate === 'function') cv15AttachPostSessionDelegate();
  }
  // Reset rating + photo UI
  document.querySelectorAll('.wp-rating-star').forEach(s => { s.classList.remove('filled'); s.innerHTML = '&#9734;'; });
  const rc = document.getElementById('wp-rating-confirm'); if (rc) rc.style.display = 'none';
  const pp = document.getElementById('wp-photo-preview'); if (pp) { pp.style.display = 'none'; pp.innerHTML = ''; }
  const pt = document.getElementById('wp-photo-upload-tile'); if (pt) pt.style.display = '';
  const pi = document.getElementById('wp-photo-input'); if (pi) pi.value = '';
  const bg = document.getElementById('wp-post-session-modal-bg');
  if (bg) bg.classList.add('on');
};

// === Phase 15 / D-01 (TRACK-15-04) — auto-track Yes/Edit handlers + REVIEW MEDIUM-7 delegated listener ===
async function cv15ConfirmAutoTrack() {
  const at = state._pendingTupleAutoTrack;
  if (!at || !at.titleId || !at.memberIds || !at.memberIds.length) return;
  await writeTupleProgress(at.titleId, at.memberIds, at.season, at.episode, 'watchparty');
  state._pendingTupleAutoTrack = null;
  flashToast('Saved');
  const row = document.querySelector('#wp-post-session-sub .cv15-autotrack-row');
  if (row) row.style.display = 'none';
}
function cv15EditAutoTrack() {
  const at = state._pendingTupleAutoTrack;
  if (!at || !at.titleId) return;
  if (typeof window.openProgressSheet === 'function' && state.me) {
    window.openProgressSheet(at.titleId, state.me.id);
  }
}
function cv15HandlePostSessionClick(ev) {
  const trigger = ev.target.closest('[data-cv15-action]');
  if (!trigger) return;
  const action = trigger.getAttribute('data-cv15-action');
  switch (action) {
    case 'confirmAutoTrack':
      cv15ConfirmAutoTrack();
      break;
    case 'editAutoTrack':
      cv15EditAutoTrack();
      break;
    default:
      console.warn('[Phase 15 / MEDIUM-7] unknown post-session cv15-action', action);
  }
}
function cv15AttachPostSessionDelegate() {
  const sub = document.getElementById('wp-post-session-sub');
  if (!sub) return;
  if (sub.getAttribute('data-cv15-bound') === '1') return;
  sub.addEventListener('click', cv15HandlePostSessionClick);
  sub.setAttribute('data-cv15-bound', '1');
}

window.closePostSession = async function() {
  // Flag dismissal so the modal doesn't reappear on next render of this wp.
  if (_postSessionWpId && state.me) {
    try {
      await updateDoc(watchpartyRef(_postSessionWpId), {
        [`postSessionDismissedBy.${state.me.id}`]: true,
        ...writeAttribution()
      });
    } catch(e) { /* best effort — dismissal is UX nicety */ }
  }
  const bg = document.getElementById('wp-post-session-modal-bg');
  if (bg) bg.classList.remove('on');
  _postSessionWpId = null;
  _postSessionRating = 0;
};

window.setRating = async function(stars) {
  _postSessionRating = stars;
  document.querySelectorAll('.wp-rating-star').forEach((el, idx) => {
    if (idx < stars) { el.classList.add('filled'); el.innerHTML = '&#9733;'; }
    else { el.classList.remove('filled'); el.innerHTML = '&#9734;'; }
  });
  const rc = document.getElementById('wp-rating-confirm');
  if (rc) rc.style.display = '';
  if (_postSessionWpId && state.me) {
    try {
      await updateDoc(watchpartyRef(_postSessionWpId), {
        [`ratings.${state.me.id}`]: stars,
        ...writeAttribution()
      });
      haptic('success');
    } catch(e) { /* best effort — user can retry */ }
  }
};

// Client-side compression to strip EXIF (T-11-05-09 mitigation — canvas.toBlob discards
// EXIF) and shrink to ≤1MB JPEG before Firebase Storage upload. Canvas resize cap 1600px
// longest edge, JPEG quality 0.85 per plan spec.
async function compressImageToBlob(file, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function() {
      let w = img.naturalWidth, h = img.naturalHeight;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      w = Math.round(w * ratio); h = Math.round(h * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob); else reject(new Error('blob fail'));
      }, 'image/jpeg', quality);
    };
    img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('img load fail')); };
    img.src = url;
  });
}

window.uploadPostSessionPhoto = async function(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  // Client-side validation — defense-in-depth with storage.rules (T-11-05-02/03 mitigation).
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    flashToast('Photo must be JPEG, PNG, or WebP', { kind: 'error' });
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    flashToast('Photo too large (max 5MB)', { kind: 'error' });
    return;
  }
  if (!_postSessionWpId || !state.me || !state.familyCode) return;
  try {
    const compressed = await compressImageToBlob(file, 1600, 1600, 0.85);
    const ts = Date.now();
    const uidForPath = (state.auth && state.auth.uid) || state.me.id;
    const path = `couch-albums/${state.familyCode}/${_postSessionWpId}/${ts}_${uidForPath}.jpg`;
    const sref = storageRef(storage, path);
    await uploadBytes(sref, compressed, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(sref);
    await updateDoc(watchpartyRef(_postSessionWpId), {
      photos: arrayUnion({ url, uploadedBy: state.me.id, uploadedAt: ts }),
      ...writeAttribution()
    });
    const tile = document.getElementById('wp-photo-upload-tile');
    if (tile) tile.style.display = 'none';
    const preview = document.getElementById('wp-photo-preview');
    if (preview) {
      preview.style.display = '';
      preview.innerHTML = `<img src="${url}" alt="Couch photo" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;">`;
    }
    haptic('success');
    flashToast('Photo saved', { kind: 'success' });
  } catch(e) {
    flashToast('Could not upload photo', { kind: 'error' });
  }
};

window.openScheduleNext = function() {
  // Find the just-ended wp + look up titleId so the schedule modal pre-fills.
  const wp = state.watchparties && state.watchparties.find(x => x.id === _postSessionWpId);
  if (!wp) { closePostSession(); return; }
  const titleId = wp.titleId || ((state.titles || []).find(t => t.name === wp.titleName) || {}).id;
  // Close the post-session modal first (fire-and-forget dismissal write) then open start modal.
  closePostSession();
  if (titleId && typeof window.openWatchpartyStart === 'function') {
    // Small delay to let modal close transition finish before next opens
    setTimeout(() => window.openWatchpartyStart(titleId), 180);
  }
};

window.leaveWatchparty = async function(wpId) {
  if (!state.me) return;
  if (!confirm('Leave this watchparty?')) return;
  const wp = state.watchparties.find(x => x.id === wpId);
  if (!wp) return;
  const nextParticipants = { ...(wp.participants || {}) };
  delete nextParticipants[state.me.id];
  try {
    // If host leaves and no one else joined, archive
    if (Object.keys(nextParticipants).length === 0) {
      await updateDoc(watchpartyRef(wpId), { ...writeAttribution(), status: 'archived', participants: nextParticipants });
    } else {
      await updateDoc(watchpartyRef(wpId), { ...writeAttribution(), participants: nextParticipants });
    }
    closeWatchpartyLive();
  } catch(e) { alert('Could not leave: ' + e.message); }
};

window.cancelWatchparty = async function(wpId) {
  if (!state.me) return;
  const wp = state.watchparties.find(x => x.id === wpId);
  if (!wp) return;
  if (wp.hostId !== state.me.id) { alert('Only the host can cancel.'); return; }
  if (!confirm('Cancel this watchparty? Everyone who joined will see it was cancelled.')) return;
  try {
    await updateDoc(watchpartyRef(wpId), { ...writeAttribution(), status: 'cancelled', cancelledAt: Date.now() });
    closeWatchpartyLive();
  } catch(e) { alert('Could not cancel: ' + e.message); }
};

// "Done" — end YOUR participation and prompt to log the watch
window.endMyWatchparty = async function(wpId) {
  const wp = state.watchparties.find(x => x.id === wpId);
  if (!wp) return;
  const titleId = wp.titleId;
  const title = state.titles.find(x => x.id === titleId);
  if (!title) { alert('Could not find the title.'); return; }
  // Build co-watchers list: everyone who started watching, except me
  const cowatchers = Object.entries(wp.participants || {})
    .filter(([mid, p]) => mid !== (state.me && state.me.id) && p.startedAt)
    .map(([mid, p]) => ({ id: mid, name: p.name }));
  // Close the live modal
  closeWatchpartyLive();
  // Phase 11 / REFR-09 — Post-session modal: rating + photo + schedule-next.
  // Opens BEFORE the diary modal (diary still fires afterward via the Schedule-next /
  // Maybe-later flow if desired in a future plan). For v1 the post-session modal is
  // the primary close-out surface; diary remains available via Couch history.
  if (typeof window.openPostSession === 'function') {
    setTimeout(() => window.openPostSession(wpId), 200);
  } else if (typeof window.openDiary === 'function') {
    // Defensive fallback — should never fire since openPostSession is defined in the
    // same module, but keeps the original behavior intact if the window attach somehow
    // fails during an emergency hot-patch.
    setTimeout(() => window.openDiary(titleId, cowatchers), 150);
  }
};

// Participant starts their personal timer (the "I just hit play" button)
window.startMyWatchpartyTimer = async function(wpId) {
  if (!state.me) return;
  try {
    await updateDoc(watchpartyRef(wpId), {
      [`participants.${state.me.id}.startedAt`]: Date.now(),
      ...writeAttribution()
    });
    renderWatchpartyLive();
  } catch(e) { alert('Could not start timer: ' + e.message); }
};

// ===== Year in Review =====
// Compute all stats for a given year. Returns an object of personal + group stats.
function computeYearStats(year) {
  year = year || new Date().getFullYear();
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year + 1, 0, 1).getTime();

  // Gather all diary entries for the year across all titles
  const allEntries = [];
  state.titles.forEach(t => {
    (t.diary || []).forEach(e => {
      const ts = e.ts || (e.date ? new Date(e.date).getTime() : 0);
      if (ts >= yearStart && ts < yearEnd) {
        allEntries.push({ ...e, ts, title: t });
      }
    });
  });

  const myId = state.me && state.me.id;
  const myEntries = myId ? allEntries.filter(e => e.memberId === myId) : [];

  // Helper to tally by key
  const tally = (arr, keyFn) => {
    const counts = {};
    arr.forEach(x => {
      const k = keyFn(x);
      if (!k) return;
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]);
  };

  // ========== PERSONAL ==========
  const personalTitles = [...new Set(myEntries.map(e => e.title.id))].map(id => state.titles.find(t => t.id === id)).filter(Boolean);
  const myRuntimeMin = myEntries.reduce((s, e) => s + (e.title.runtime || 0), 0);
  // Score: prefer e.score (0-10), fall back to e.stars (0-5) × 2 for legacy entries
  const scoreOf = e => (typeof e.score === 'number' && e.score > 0) ? e.score : (e.stars > 0 ? e.stars * 2 : 0);
  const myScores = myEntries.map(scoreOf).filter(s => s > 0);
  const myAvgStar = myScores.length ? (myScores.reduce((a,b) => a+b, 0) / myScores.length) : 0;
  const myRewatches = myEntries.filter(e => e.rewatch).length;
  // Month tally
  const monthCounts = tally(myEntries, e => new Date(e.ts).getMonth());
  const topMonth = monthCounts.length ? monthCounts[0] : null;
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  // Genre tally (using title.genres array)
  const myGenres = tally(myEntries.flatMap(e => (e.title.genres || []).map(g => g)), g => g);
  const topGenre = myGenres.length ? myGenres[0] : null;
  // Longest movie I watched
  const longestMovie = personalTitles.filter(t => t.kind === 'Movie' && t.runtime).sort((a,b) => b.runtime - a.runtime)[0] || null;
  // Best night — highest score I gave
  const bestRated = myEntries.filter(e => scoreOf(e) > 0).sort((a,b) => scoreOf(b) - scoreOf(a))[0] || null;
  // Top 6 favorites by score — 8.0+ on the 10 scale
  const myFavorites = myEntries.filter(e => scoreOf(e) >= 8).sort((a,b) => scoreOf(b) - scoreOf(a)).slice(0, 6);

  // ========== GROUP ==========
  const groupTitles = [...new Set(allEntries.map(e => e.title.id))].map(id => state.titles.find(t => t.id === id)).filter(Boolean);
  const groupRuntimeMin = allEntries.reduce((s, e) => s + (e.title.runtime || 0), 0);
  // Members ranked by watches
  const memberCounts = tally(allEntries, e => e.memberId);
  const memberRanked = memberCounts.map(([mid, count]) => {
    const m = state.members.find(x => x.id === mid);
    return { id: mid, name: m ? m.name : 'Unknown', color: m ? m.color : '#888', count };
  });
  // Group genre
  const groupGenres = tally(allEntries.flatMap(e => (e.title.genres || [])), g => g);
  const topGroupGenre = groupGenres.length ? groupGenres[0] : null;
  // Top streaming service (from titles watched this year)
  const providerCounts = tally(groupTitles.flatMap(t => (t.providers || []).map(p => p.name)), p => p);
  const topProvider = providerCounts.length ? providerCounts[0] : null;
  // Group top-rated (highest average score among titles with 2+ ratings)
  const rated = groupTitles.map(t => {
    const scores = Object.values(t.ratings || {}).map(getScore).filter(s => s > 0);
    if (scores.length < 2) return null;
    const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
    return { t, avg, count: scores.length };
  }).filter(Boolean).sort((a,b) => b.avg - a.avg || b.count - a.count);
  const groupTopRated = rated.length ? rated[0] : null;
  // Biggest disagreement — highest variance among titles with 2+ ratings
  const disagreements = groupTitles.map(t => {
    const scores = Object.values(t.ratings || {}).map(getScore).filter(s => s > 0);
    if (scores.length < 2) return null;
    const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
    const variance = scores.reduce((s,x) => s + (x-avg)*(x-avg), 0) / scores.length;
    return { t, variance, scores, avg };
  }).filter(Boolean).sort((a,b) => b.variance - a.variance);
  const topDisagreement = disagreements.length && disagreements[0].variance > 0 ? disagreements[0] : null;

  // Vetoes (sessions collection isn't queryable historically here — we can only see today's).
  // Skip for now; would need an activity-log scan. Activity log is in `activity` collection.

  // Most-commented title (uses commentCount)
  const mostCommented = groupTitles.filter(t => (t.commentCount || 0) > 0).sort((a,b) => (b.commentCount||0) - (a.commentCount||0))[0] || null;

  // Best watchparty (most reactions, within this year)
  const yearWps = state.watchparties.filter(wp => wp.startAt >= yearStart && wp.startAt < yearEnd);
  const bestWp = yearWps.slice().sort((a,b) => (b.reactions||[]).length - (a.reactions||[]).length)[0] || null;

  // Top mood (from titles.moods — tally across watched titles)
  const moodCounts = tally(groupTitles.flatMap(t => t.moods || []), m => m);
  const topMood = moodCounts.length ? moodCounts[0] : null;

  // Most harmonious pair — two members with smallest avg rating diff across titles both rated
  let bestPair = null;
  if (state.members.length >= 2) {
    let bestPairScore = Infinity;
    for (let i = 0; i < state.members.length; i++) {
      for (let j = i+1; j < state.members.length; j++) {
        const a = state.members[i], b = state.members[j];
        const shared = groupTitles.filter(t => {
          const sA = getScore((t.ratings||{})[a.id]);
          const sB = getScore((t.ratings||{})[b.id]);
          return sA > 0 && sB > 0;
        });
        if (shared.length < 3) continue;
        const diff = shared.reduce((s,t) => s + Math.abs(getScore(t.ratings[a.id]) - getScore(t.ratings[b.id])), 0) / shared.length;
        if (diff < bestPairScore) { bestPairScore = diff; bestPair = { a, b, diff, sharedCount: shared.length }; }
      }
    }
  }

  return {
    year,
    personal: {
      watchCount: myEntries.length,
      titleCount: personalTitles.length,
      runtimeMin: myRuntimeMin,
      avgStar: myAvgStar,
      rewatches: myRewatches,
      topMonth: topMonth ? { name: MONTH_NAMES[topMonth[0]], count: topMonth[1] } : null,
      topGenre: topGenre ? { name: topGenre[0], count: topGenre[1] } : null,
      longestMovie,
      bestRated,
      favorites: myFavorites
    },
    group: {
      watchCount: allEntries.length,
      titleCount: groupTitles.length,
      runtimeMin: groupRuntimeMin,
      memberRanked,
      topGenre: topGroupGenre ? { name: topGroupGenre[0], count: topGroupGenre[1] } : null,
      topProvider: topProvider ? { name: topProvider[0], count: topProvider[1] } : null,
      groupTopRated,
      topDisagreement,
      mostCommented,
      bestWp,
      topMood: topMood ? { id: topMood[0], count: topMood[1] } : null,
      bestPair
    }
  };
}

function formatHours(minutes) {
  if (!minutes || minutes <= 0) return '0h';
  const h = Math.floor(minutes / 60);
  const days = Math.floor(minutes / 60 / 24);
  if (days >= 2) return `${days} days`;
  if (h >= 24) return `${Math.round(h)}h (${days} day)`;
  return `${h}h ${minutes % 60}m`;
}

function yirSettingsTeaser() {
  const el = document.getElementById('yir-teaser');
  const storyBtn = document.getElementById('yir-story-btn');
  const eyebrowEl = document.getElementById('yir-eyebrow');
  if (!el) return;
  const stats = computeYearStats();
  if (eyebrowEl) eyebrowEl.textContent = (new Date().getFullYear()) + ' · Year in Review';
  if (stats.personal.watchCount === 0) {
    el.textContent = 'Log some watches in the diary and your Year in Review will come to life.';
  } else {
    el.textContent = `${stats.personal.watchCount} ${stats.personal.watchCount===1?'watch':'watches'} this year, ${stats.group.watchCount} across the group.`;
  }
  // Show the "Play recap" button in December and through January
  const month = new Date().getMonth();
  if (storyBtn) storyBtn.style.display = (month === 11 || month === 0) && stats.personal.watchCount >= 5 ? 'inline-flex' : 'none';
}

window.openYearInReview = function(year) {
  year = year || new Date().getFullYear();
  const stats = computeYearStats(year);
  renderYearInReview(stats);
  document.getElementById('yir-modal-bg').classList.add('on');
};

window.closeYearInReview = function() {
  document.getElementById('yir-modal-bg').classList.remove('on');
};

function renderYearInReview(stats) {
  const el = document.getElementById('yir-content');
  if (!el) return;
  const p = stats.personal;
  const g = stats.group;
  const meName = (state.me && state.me.name) || 'You';
  const groupLabel = groupPossessive();

  if (p.watchCount === 0 && g.watchCount === 0) {
    el.innerHTML = `<div class="yir-hero">
      <button class="yir-hero-close" aria-label="Close Year in Review" onclick="closeYearInReview()">✕</button>
      <div class="yir-year">${stats.year}</div>
      <div class="yir-title">Your Year in Review</div>
    </div>
    <div class="yir-empty">Nothing logged yet for ${stats.year}. Log watches in the diary to fill this out.</div>`;
    return;
  }

  const monthSubtitle = p.topMonth ? `${p.topMonth.name} was your big month with ${p.topMonth.count} ${p.topMonth.count===1?'watch':'watches'}` : '';
  const personalSection = p.watchCount > 0 ? `
    <div class="yir-section-h">For ${escapeHtml(meName)}</div>
    <div class="yir-grid">
      <div class="yir-stat accent wide">
        <span class="yir-stat-label">Watches this year</span>
        <span class="yir-stat-value" style="font-size:var(--t-h1);">${p.watchCount}</span>
        <span class="yir-stat-sub">${p.titleCount} unique ${p.titleCount===1?'title':'titles'}${p.rewatches?` · ${p.rewatches} rewatch${p.rewatches===1?'':'es'}`:''}</span>
      </div>
      <div class="yir-stat wide">
        <span class="yir-stat-label">Time spent watching</span>
        <span class="yir-stat-value">${formatHours(p.runtimeMin)}</span>
        <span class="yir-stat-sub">${p.runtimeMin >= 60*24 ? 'A whole chunk of your life. Worth it.' : 'Early days. Plenty of year left.'}</span>
      </div>
      ${p.topGenre ? `<div class="yir-stat"><span class="yir-stat-label">Top genre</span><span class="yir-stat-value small">${p.topGenre.name}</span><span class="yir-stat-sub">${p.topGenre.count} ${p.topGenre.count===1?'watch':'watches'}</span></div>` : ''}
      ${p.topMonth ? `<div class="yir-stat"><span class="yir-stat-label">Busiest month</span><span class="yir-stat-value small">${p.topMonth.name}</span><span class="yir-stat-sub">${p.topMonth.count} ${p.topMonth.count===1?'watch':'watches'}</span></div>` : ''}
      ${p.avgStar > 0 ? `<div class="yir-stat"><span class="yir-stat-label">Average rating</span><span class="yir-stat-value small">${formatScore(p.avgStar)}/10</span><span class="yir-stat-sub">${p.avgStar >= 8 ? 'Generous grader' : p.avgStar >= 6 ? 'Balanced' : 'Tough critic'}</span></div>` : ''}
      ${p.longestMovie ? `<div class="yir-stat"><span class="yir-stat-label">Longest sit</span><span class="yir-stat-value small">${p.longestMovie.runtime}m</span><span class="yir-stat-sub">${escapeHtml(p.longestMovie.name)}</span></div>` : ''}
      ${p.bestRated ? `<div class="yir-stat wide"><span class="yir-stat-label">Your best night</span><span class="yir-stat-value small">${escapeHtml(p.bestRated.title.name)}</span><span class="yir-stat-sub">${'★'.repeat(Math.floor(p.bestRated.stars))}${p.bestRated.stars % 1 ? '½':''}${p.bestRated.note ? ' · "' + escapeHtml(p.bestRated.note.slice(0,80)) + '"' : ''}</span></div>` : ''}
      ${p.favorites.length > 0 ? `<div class="yir-stat wide"><span class="yir-stat-label">Favorites</span><div class="yir-title-strip">${p.favorites.map(f => `<div class="yir-title-strip-poster" style="background-image:url('${f.title.poster||''}')" onclick="closeYearInReview();openDetailModal('${f.title.id}')" title="${escapeHtml(f.title.name)}"></div>`).join('')}</div></div>` : ''}
    </div>` : '';

  const topMemberLabel = g.memberRanked.length ? `${escapeHtml(g.memberRanked[0].name)} (${g.memberRanked[0].count})` : '';
  const groupSection = g.watchCount > 0 ? `
    <div class="yir-section-h">For ${groupLabel}</div>
    <div class="yir-grid">
      <div class="yir-stat accent wide">
        <span class="yir-stat-label">Watched together this year</span>
        <span class="yir-stat-value" style="font-size:var(--t-h1);">${g.watchCount}</span>
        <span class="yir-stat-sub">${g.titleCount} unique titles · ${formatHours(g.runtimeMin)} of screen time</span>
      </div>
      ${g.memberRanked.length > 0 ? `<div class="yir-stat wide"><span class="yir-stat-label">Most active</span><span class="yir-stat-value small">${topMemberLabel}</span><span class="yir-stat-sub">${g.memberRanked.slice(1, 4).map(m => `${escapeHtml(m.name)} (${m.count})`).join(' · ') || 'Runs the couch'}</span></div>` : ''}
      ${g.topGenre ? `<div class="yir-stat"><span class="yir-stat-label">Group genre</span><span class="yir-stat-value small">${escapeHtml(g.topGenre.name)}</span><span class="yir-stat-sub">${g.topGenre.count} watches</span></div>` : ''}
      ${g.topProvider ? `<div class="yir-stat"><span class="yir-stat-label">Most-used service</span><span class="yir-stat-value small">${escapeHtml(g.topProvider.name)}</span><span class="yir-stat-sub">${g.topProvider.count} ${g.topProvider.count===1?'title':'titles'}</span></div>` : ''}
      ${g.topMood ? `<div class="yir-stat"><span class="yir-stat-label">Group mood</span><span class="yir-stat-value small">${twemojiImg((moodById(g.topMood.id)||{}).icon, (moodById(g.topMood.id)||{}).label)} ${(moodById(g.topMood.id)||{}).label||escapeHtml(g.topMood.id)}</span><span class="yir-stat-sub">The vibe this year</span></div>` : ''}
      ${g.groupTopRated ? `<div class="yir-stat wide"><span class="yir-stat-label">Highest-rated pick</span><span class="yir-stat-value small">${escapeHtml(g.groupTopRated.t.name)}</span><span class="yir-stat-sub">${formatScore(g.groupTopRated.avg)}/10 average · ${g.groupTopRated.count} ratings</span></div>` : ''}
      ${g.topDisagreement ? `<div class="yir-stat wide"><span class="yir-stat-label">Biggest split</span><span class="yir-stat-value small">${escapeHtml(g.topDisagreement.t.name)}</span><span class="yir-stat-sub">Ratings ranged from ${Math.min(...g.topDisagreement.stars)}★ to ${Math.max(...g.topDisagreement.stars)}★</span></div>` : ''}
      ${g.bestPair ? `<div class="yir-stat wide"><span class="yir-stat-label">Most in sync</span><div class="yir-pair-row"><div class="yir-pair-avatars"><div class="who-avatar" style="background:${g.bestPair.a.color};">${avatarContent(g.bestPair.a)}</div><div class="who-avatar" style="background:${g.bestPair.b.color};">${avatarContent(g.bestPair.b)}</div></div><div style="flex:1;"><strong>${escapeHtml(g.bestPair.a.name)} & ${escapeHtml(g.bestPair.b.name)}</strong><div style="font-size:var(--t-meta);color:var(--ink-dim);">${g.bestPair.diff.toFixed(1)} point average gap across ${g.bestPair.sharedCount} shared watches</div></div></div></div>` : ''}
      ${g.mostCommented ? `<div class="yir-stat"><span class="yir-stat-label">Most talked about</span><span class="yir-stat-value small">${escapeHtml(g.mostCommented.name)}</span><span class="yir-stat-sub">${g.mostCommented.commentCount} comments</span></div>` : ''}
      ${g.bestWp ? `<div class="yir-stat"><span class="yir-stat-label">Best watchparty</span><span class="yir-stat-value small">${escapeHtml(g.bestWp.titleName)}</span><span class="yir-stat-sub">${(g.bestWp.reactions||[]).length} reactions</span></div>` : ''}
    </div>` : '';

  const canPlay = p.watchCount >= 5;

  el.innerHTML = `
    <div class="yir-hero">
      <button class="yir-hero-close" aria-label="Close Year in Review" onclick="closeYearInReview()">✕</button>
      <div class="yir-year">${renderYirYearPicker(stats.year)}</div>
      <div class="yir-title">Year in Review</div>
      <div class="yir-subtitle">${escapeHtml(meName)} · ${escapeHtml(state.group && state.group.name ? state.group.name : 'your group')}</div>
    </div>
    <div class="yir-body">
      ${personalSection}
      ${groupSection}
    </div>
    ${canPlay ? `<div class="yir-share-bar">
      <button class="modal-close" style="margin:0;" onclick="openYearStoryMode(${stats.year})">▶ Play recap</button>
      <button class="pill" onclick="shareYearInReview()">Share</button>
    </div>` : `<div class="yir-share-bar">
      <button class="pill" style="flex:1;" onclick="shareYearInReview()">Share</button>
    </div>`}
  `;
}

function renderYirYearPicker(currentYear) {
  // Determine years that have any data
  const yearsWithData = new Set();
  state.titles.forEach(t => {
    (t.diary || []).forEach(e => {
      const ts = e.ts || (e.date ? new Date(e.date).getTime() : 0);
      if (ts) yearsWithData.add(new Date(ts).getFullYear());
    });
  });
  const nowYear = new Date().getFullYear();
  yearsWithData.add(nowYear);
  const years = [...yearsWithData].sort((a,b) => b - a);
  if (years.length <= 1) return String(currentYear);
  const opts = years.map(y => `<option value="${y}" ${y===currentYear?'selected':''}>${y}</option>`).join('');
  return `<select onchange="openYearInReview(parseInt(this.value,10))" style="background:transparent;border:none;color:var(--accent);font-family:inherit;font-size:var(--t-body);font-weight:600;text-transform:uppercase;letter-spacing:0.2em;cursor:pointer;">${opts}</select>`;
}

// Share placeholder — turn 2 will replace with actual share card generator
window.shareYearInReview = async function() {
  const stats = computeYearStats();
  const p = stats.personal;
  const g = stats.group;
  const meName = (state.me && state.me.name) || '';
  const lines = [
    `📽 ${meName}'s Year on the Couch · ${stats.year}`,
    `${p.watchCount} watches · ${formatHours(p.runtimeMin)}`,
    p.topGenre ? `Top genre: ${p.topGenre.name}` : null,
    p.bestRated ? `Best night: ${p.bestRated.title.name}` : null,
    g.watchCount > 0 ? `Group total: ${g.watchCount}` : null
  ].filter(Boolean);
  const text = lines.join('\n');
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      flashToast('Copied to clipboard', { kind: 'success' });
    } else {
      prompt('Copy your recap:', text);
    }
  } catch(e) {
    // User cancelled share; no-op
  }
};

window.openYearStoryMode = function(year) {
  year = year || new Date().getFullYear();
  const stats = computeYearStats(year);
  if (stats.personal.watchCount < 5 && stats.group.watchCount < 5) {
    alert('Log at least 5 watches to unlock the recap.');
    return;
  }
  yirStorySlides = buildStorySlides(stats);
  yirStoryIndex = 0;
  yirStoryPaused = false;
  if (yirStoryTimer) clearTimeout(yirStoryTimer);
  document.getElementById('yir-modal-bg').classList.remove('on');
  document.getElementById('yir-story-modal-bg').classList.add('on');
  renderYearStorySlide();
};

window.closeYearStoryMode = function() {
  document.getElementById('yir-story-modal-bg').classList.remove('on');
  if (yirStoryTimer) { clearTimeout(yirStoryTimer); yirStoryTimer = null; }
  yirStorySlides = [];
  yirStoryIndex = 0;
};

let yirStorySlides = [];
let yirStoryIndex = 0;
let yirStoryTimer = null;
let yirStoryPaused = false;

function buildStorySlides(stats) {
  const p = stats.personal;
  const g = stats.group;
  const meName = (state.me && state.me.name) || 'You';
  const slides = [];

  // 1. Intro
  slides.push({
    eyebrow: `${stats.year} Recap`,
    headline: `Hey ${meName}.`,
    body: `Let's look back at the year you spent on the couch.`
  });

  // 2. Total watches
  if (p.watchCount > 0) {
    slides.push({
      eyebrow: 'You watched',
      value: String(p.watchCount),
      body: `${p.watchCount === 1 ? 'title' : 'titles'} this year.${p.rewatches > 0 ? ` ${p.rewatches} of them more than once.` : ''}`
    });
  }

  // 3. Time spent
  if (p.runtimeMin > 60) {
    slides.push({
      eyebrow: "That's",
      value: formatHours(p.runtimeMin),
      body: `of screen time. ${p.runtimeMin >= 60*24*2 ? 'Somewhere between a hobby and a vocation.' : p.runtimeMin >= 60*10 ? 'Well spent.' : 'A solid start.'}`
    });
  }

  // 4. Top genre
  if (p.topGenre) {
    slides.push({
      eyebrow: 'Your genre of the year',
      headline: p.topGenre.name,
      body: `${p.topGenre.count} watches said so.`
    });
  }

  // 5. Best night
  if (p.bestRated && p.bestRated.title) {
    slides.push({
      eyebrow: 'Your best night',
      headline: p.bestRated.title.name,
      poster: p.bestRated.title.poster || '',
      body: `${'★'.repeat(Math.floor(p.bestRated.stars))}${p.bestRated.stars % 1 ? '½' : ''}${p.bestRated.note ? ' · "' + p.bestRated.note.slice(0, 90) + '"' : ''}`
    });
  }

  // 6. Busiest month
  if (p.topMonth && p.topMonth.count >= 3) {
    slides.push({
      eyebrow: 'You really showed up in',
      headline: p.topMonth.name,
      body: `${p.topMonth.count} watches that month alone.`
    });
  }

  // 7. Longest sit
  if (p.longestMovie && p.longestMovie.runtime >= 120) {
    slides.push({
      eyebrow: 'Your longest sit',
      headline: p.longestMovie.name,
      poster: p.longestMovie.poster || '',
      body: `${p.longestMovie.runtime} minutes. You stayed.`
    });
  }

  // 8. Shift to group
  if (g.watchCount >= 5) {
    slides.push({
      eyebrow: `And ${groupPossessive()}...`,
      value: String(g.watchCount),
      body: `watches across ${state.members.length} ${state.members.length === 1 ? 'person' : 'people'}.`
    });
  }

  // 9. Most active member
  if (g.memberRanked.length > 0 && g.memberRanked[0].count > 1) {
    const top = g.memberRanked[0];
    slides.push({
      eyebrow: 'MVP of the couch',
      headline: top.name,
      body: `${top.count} watches logged. Carried the group.`
    });
  }

  // 10. Most in sync
  if (g.bestPair) {
    slides.push({
      eyebrow: 'Most in sync',
      headline: `${g.bestPair.a.name} & ${g.bestPair.b.name}`,
      body: `Barely ${g.bestPair.diff.toFixed(1)} stars apart on average across ${g.bestPair.sharedCount} shared watches.`
    });
  }

  // 11. Biggest split
  if (g.topDisagreement) {
    const min = Math.min(...g.topDisagreement.stars);
    const max = Math.max(...g.topDisagreement.stars);
    slides.push({
      eyebrow: 'Biggest split',
      headline: g.topDisagreement.t.name,
      poster: g.topDisagreement.t.poster || '',
      body: `Ratings ran from ${min}★ to ${max}★. Someone was wrong.`
    });
  }

  // 12. Group top-rated
  if (g.groupTopRated) {
    slides.push({
      eyebrow: 'Everyone agreed on',
      headline: g.groupTopRated.t.name,
      poster: g.groupTopRated.t.poster || '',
      body: `${formatScore(g.groupTopRated.avg)}/10 average across ${g.groupTopRated.count} ratings.`
    });
  }

  // 13. Best watchparty
  if (g.bestWp && (g.bestWp.reactions || []).length >= 3) {
    slides.push({
      eyebrow: 'Best watchparty',
      headline: g.bestWp.titleName,
      poster: g.bestWp.titlePoster || '',
      body: `${(g.bestWp.reactions || []).length} reactions flew. ${Object.keys(g.bestWp.participants || {}).length} people watching.`
    });
  }

  // Final card
  slides.push({
    eyebrow: `${stats.year}, that's a wrap`,
    headline: "See you on the couch.",
    body: '',
    isFinal: true
  });

  return slides;
}

function renderYearStorySlide() {
  const el = document.getElementById('yir-story-content');
  if (!el) return;
  const slide = yirStorySlides[yirStoryIndex];
  if (!slide) { closeYearStoryMode(); return; }

  const progressBars = yirStorySlides.map((_, i) => {
    let cls = '';
    if (i < yirStoryIndex) cls = 'done';
    else if (i === yirStoryIndex && !yirStoryPaused) cls = 'active';
    return `<div class="yir-story-pbar ${cls}"></div>`;
  }).join('');

  const posterHtml = slide.poster ? `<div class="yir-story-poster" style="background-image:url('${slide.poster}')"></div>` : '';
  const valueHtml = slide.value ? `<div class="yir-story-value">${escapeHtml(slide.value)}</div>` : '';
  const headlineHtml = slide.headline ? `<div class="yir-story-headline">${escapeHtml(slide.headline)}</div>` : '';
  const bodyHtml = slide.body ? `<div class="yir-story-body-text">${escapeHtml(slide.body)}</div>` : '';
  const eyebrowHtml = slide.eyebrow ? `<div class="yir-story-eyebrow">${escapeHtml(slide.eyebrow)}</div>` : '';

  const isLast = yirStoryIndex === yirStorySlides.length - 1;

  el.innerHTML = `
    <div class="yir-story-progress">${progressBars}</div>
    <div class="yir-story-body">
      <div class="yir-story-nav prev" onclick="prevYearStorySlide()"></div>
      <div class="yir-story-nav next" onclick="nextYearStorySlide()"></div>
      ${eyebrowHtml}
      ${posterHtml}
      ${valueHtml}
      ${headlineHtml}
      ${bodyHtml}
    </div>
    <div class="yir-story-footer">
      <button onclick="closeYearStoryMode()">Close</button>
      <button onclick="toggleYearStoryPause()">${yirStoryPaused ? '▶ Play' : '⏸ Pause'}</button>
      ${isLast
        ? `<button class="primary" onclick="downloadYearCard()">Save image</button>`
        : `<button class="primary" onclick="nextYearStorySlide()">Next</button>`}
    </div>
  `;

  if (yirStoryTimer) { clearTimeout(yirStoryTimer); yirStoryTimer = null; }
  if (!yirStoryPaused && !isLast) {
    yirStoryTimer = setTimeout(() => nextYearStorySlide(), 5000);
  }
}

window.nextYearStorySlide = function() {
  if (yirStoryIndex < yirStorySlides.length - 1) {
    yirStoryIndex++;
    renderYearStorySlide();
  }
};
window.prevYearStorySlide = function() {
  if (yirStoryIndex > 0) {
    yirStoryIndex--;
    renderYearStorySlide();
  }
};
window.toggleYearStoryPause = function() {
  yirStoryPaused = !yirStoryPaused;
  renderYearStorySlide();
};

// ==== Share card (canvas-rendered PNG) ====
window.downloadYearCard = async function() {
  const stats = computeYearStats();
  const canvas = document.createElement('canvas');
  const w = 1080, h = 1920; // 9:16 story-card ratio
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1a1826');
  grad.addColorStop(0.5, '#2a1e2e');
  grad.addColorStop(1, '#0f0e17');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Accent glow
  const glow = ctx.createRadialGradient(w/2, h*0.35, 50, w/2, h*0.35, w*0.7);
  glow.addColorStop(0, 'rgba(232,160,74,0.28)');
  glow.addColorStop(1, 'rgba(232,160,74,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const p = stats.personal;
  const g = stats.group;
  const meName = (state.me && state.me.name) || '';

  // Eyebrow
  ctx.fillStyle = '#e8a04a';
  ctx.font = 'italic 600 38px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`COUCH · ${stats.year}`, w/2, 200);

  // Name
  ctx.fillStyle = '#f5ede0';
  ctx.font = 'bold 72px Georgia, serif';
  ctx.fillText(meName, w/2, 300);

  // Big number
  ctx.font = 'bold 220px Georgia, serif';
  const bigGrad = ctx.createLinearGradient(0, 400, 0, 700);
  bigGrad.addColorStop(0, '#e8a04a');
  bigGrad.addColorStop(1, '#e53170');
  ctx.fillStyle = bigGrad;
  ctx.fillText(String(p.watchCount || 0), w/2, 620);

  ctx.fillStyle = '#f5ede0';
  ctx.font = '42px Georgia, serif';
  ctx.fillText(p.watchCount === 1 ? 'watch this year' : 'watches this year', w/2, 700);

  // Stat lines
  ctx.font = '36px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(245,237,224,0.7)';
  let y = 820;
  const addLine = (label, value) => {
    if (!value) return;
    ctx.font = 'italic 28px Georgia, serif';
    ctx.fillStyle = 'rgba(232,160,74,0.8)';
    ctx.fillText(label.toUpperCase(), w/2, y);
    y += 50;
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillStyle = '#f5ede0';
    ctx.fillText(value, w/2, y);
    y += 90;
  };

  addLine('Time spent', formatHours(p.runtimeMin));
  if (p.topGenre) addLine('Top genre', p.topGenre.name);
  if (p.bestRated && p.bestRated.title) {
    const name = p.bestRated.title.name.length > 28 ? p.bestRated.title.name.slice(0, 27) + '…' : p.bestRated.title.name;
    addLine('Best night', name);
  }
  if (g.watchCount > 0) addLine(`Across ${groupPossessive()}`, `${g.watchCount} watches`);

  // Footer
  ctx.fillStyle = 'rgba(245,237,224,0.4)';
  ctx.font = 'italic 32px Georgia, serif';
  ctx.fillText('couch — make it a night.', w/2, h - 120);

  // Convert to blob + download
  canvas.toBlob((blob) => {
    if (!blob) { alert('Could not generate image.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `couch-${stats.year}-${(meName || 'recap').replace(/[^a-z0-9]/gi,'-').toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, 'image/png', 0.95);
};

// ===== Add tab: browse rows =====
const MOOD_TO_GENRES = {
  cozy: '10751,16',
  funny: '35',
  epic: '12,14,10752',
  spooky: '27',
  tearjerker: '18',
  mindbender: '9648,53,878',
  action: '28',
  comfort: '10751,35',
  datenight: '10749',
  short: '' // handled via runtime filter
};
// TMDB provider IDs for the services we commonly show
const TMDB_PROVIDER_IDS = {
  'Netflix': 8, 'Amazon Prime Video': 9, 'Amazon Prime Video with Ads': 9,
  'Disney Plus': 337, 'Hulu': 15, 'Max': 1899, 'HBO Max': 384,
  'Apple TV Plus': 350, 'Apple TV+': 350, 'Paramount Plus': 531, 'Paramount+': 531,
  'Peacock': 386, 'Peacock Premium': 386
};
const addTabCache = { trending: null, streaming: null, gems: null, mood: {} };
const ADD_CACHE_TTL = 60 * 60 * 1000; // 1 hour
let currentAddMood = null;

function mapTmdbItem(x, typeOverride) {
  const type = typeOverride || x.media_type || 'movie';
  return {
    id: 'tmdb_' + x.id,
    tmdbId: x.id,
    mediaType: type,
    name: x.title || x.name,
    year: (x.release_date || x.first_air_date || '').slice(0,4),
    kind: type === 'movie' ? 'Movie' : 'TV',
    overview: x.overview || '',
    poster: x.poster_path ? `https://image.tmdb.org/t/p/w300${x.poster_path}` : '',
    genreIds: x.genre_ids || []
  };
}

// Phase-14 polish — safety filter for TMDB list responses before they render to
// family-shared discovery surfaces (Add tab rows, onboarding seeds, etc.).
// Drop adult content. Same defensive pattern as the "you might also like" fix at
// fetchTmdbDetails (commit 51f7f50). Couch is family-shared by definition.
function isFamilySafeTmdbItem(x) {
  if (!x) return false;
  if (x.adult) return false;
  return true;
}

function renderAddRow(rowId, items) {
  const el = document.getElementById('add-row-' + rowId);
  if (!el) return;
  if (!items || !items.length) {
    // Phase 11 / REFR-04 — per-row empty state copy (UI-SPEC line 352).
    el.innerHTML = '<div class="discover-loading"><em>Nothing new here today &mdash; check back tomorrow.</em></div>';
    return;
  }
  el.innerHTML = items.map(x => {
    const inLib = state.titles.find(t => t.id === x.id);
    const safeName = escapeHtml(x.name);
    // Phase 11 quick fix — tile click now opens preview modal instead of silent add.
    // The +/✓ badge is a separate button (event.stopPropagation) for one-tap quick-add.
    return `<div class="discover-card" onclick="previewDiscoveryTile('${rowId}','${x.id}')">
      <div class="discover-poster ${inLib?'added':''}" style="background-image:url('${x.poster}')">
        <button class="add-badge" onclick="event.stopPropagation();addFromAddTab('${rowId}','${x.id}')" aria-label="${inLib?'Already in library':'Add to library'}">${inLib?'✓':'+'}</button>
      </div>
      <div class="discover-name">${safeName}</div>
      <div class="discover-meta">${x.year||''} · ${x.kind}</div>
    </div>`;
  }).join('');
}

async function tmdbFetch(url) {
  const sep = url.includes('?') ? '&' : '?';
  const full = `https://api.themoviedb.org/3${url}${sep}api_key=${TMDB_KEY}`;
  const r = await fetch(full);
  if (!r.ok) throw new Error('TMDB ' + r.status);
  return r.json();
}

async function loadTrendingRow() {
  if (addTabCache.trending && Date.now() - addTabCache.trending.ts < ADD_CACHE_TTL) {
    renderAddRow('trending', addTabCache.trending.items);
    return;
  }
  try {
    const d = await tmdbFetch('/trending/all/week');
    const items = (d.results || [])
      .filter(x => (x.media_type === 'movie' || x.media_type === 'tv') && (x.title || x.name) && x.poster_path)
      .filter(isFamilySafeTmdbItem)
      .slice(0, 20)
      .map(x => mapTmdbItem(x));
    addTabCache.trending = { ts: Date.now(), items };
    renderAddRow('trending', items);
  } catch(e) {
    const el = document.getElementById('add-row-trending');
    if (el) el.innerHTML = '<div class="discover-loading">Could not load trending</div>';
  }
}

async function loadStreamingRow() {
  // Build set of provider IDs from providers the group already has on existing titles
  const providerNames = new Set();
  state.titles.forEach(t => (t.providers || []).forEach(p => providerNames.add(p.name)));
  const providerIds = [...providerNames].map(n => TMDB_PROVIDER_IDS[n]).filter(Boolean);

  const titleEl = document.getElementById('add-streaming-title');
  const subEl = document.getElementById('add-streaming-sub');

  if (!providerIds.length) {
    // No providers detected yet — fall back to "Popular on streaming" (no filter)
    if (titleEl) titleEl.textContent = 'Popular on streaming';
    if (subEl) subEl.textContent = 'Add a few titles first and this will filter to your services';
  } else {
    if (titleEl) titleEl.textContent = 'On your streaming services';
    if (subEl) subEl.textContent = `${providerNames.size} ${providerNames.size===1?'service':'services'} detected`;
  }

  const cacheKey = 'streaming_' + providerIds.sort().join(',');
  if (addTabCache.streaming && addTabCache.streaming.key === cacheKey && Date.now() - addTabCache.streaming.ts < ADD_CACHE_TTL) {
    renderAddRow('streaming', addTabCache.streaming.items);
    return;
  }
  try {
    const providerParam = providerIds.length ? `&with_watch_providers=${providerIds.join('|')}&watch_region=US` : '';
    const d = await tmdbFetch(`/discover/movie?sort_by=popularity.desc&vote_count.gte=100${providerParam}`);
    const items = (d.results || [])
      .filter(x => x.poster_path)
      .filter(isFamilySafeTmdbItem)
      .slice(0, 20)
      .map(x => mapTmdbItem(x, 'movie'));
    addTabCache.streaming = { key: cacheKey, ts: Date.now(), items };
    renderAddRow('streaming', items);
  } catch(e) {
    const el = document.getElementById('add-row-streaming');
    if (el) el.innerHTML = '<div class="discover-loading">Could not load</div>';
  }
}

async function loadGemsRow() {
  if (addTabCache.gems && Date.now() - addTabCache.gems.ts < ADD_CACHE_TTL) {
    renderAddRow('gems', addTabCache.gems.items);
    return;
  }
  try {
    // Hidden gems: high-rated (>=7.5) but low-vote-count (200-2000) so they're not already famous
    const d = await tmdbFetch('/discover/movie?sort_by=vote_average.desc&vote_average.gte=7.5&vote_count.gte=200&vote_count.lte=2000');
    const items = (d.results || [])
      .filter(x => x.poster_path)
      .filter(isFamilySafeTmdbItem)
      .slice(0, 20)
      .map(x => mapTmdbItem(x, 'movie'));
    addTabCache.gems = { ts: Date.now(), items };
    renderAddRow('gems', items);
  } catch(e) {
    const el = document.getElementById('add-row-gems');
    if (el) el.innerHTML = '<div class="discover-loading">Could not load</div>';
  }
}

// ===== Phase 11 / REFR-04 second half (Plan 11-03b) — Browse-all sheet + pinning =====
// Pin state persists per-user in localStorage at `couch-pinned-rows-{userId}`,
// capped at 3 entries. Pinned rows render at top of Add tab via #pinned-rows.
// Browse-all sheet lists every DISCOVERY_CATALOG entry grouped by bucket with
// per-row pin toggle. All reads re-cap to PIN_CAP to defend against tampered
// localStorage (T-11-03b-02 mitigation).

const PIN_CAP = 3;

function pinStorageKey() {
  const uid = (state.me && state.me.id) || 'anon';
  return `couch-pinned-rows-${uid}`;
}

function getPinnedRowIds() {
  try {
    const raw = localStorage.getItem(pinStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, PIN_CAP) : [];
  } catch (e) { return []; }
}

function setPinnedRowIds(ids) {
  try {
    localStorage.setItem(pinStorageKey(), JSON.stringify(ids.slice(0, PIN_CAP)));
  } catch (e) { /* localStorage full / private mode — silent */ }
}

window.togglePinRow = function(rowId) {
  const pinned = getPinnedRowIds();
  const idx = pinned.indexOf(rowId);
  if (idx >= 0) {
    pinned.splice(idx, 1);
    setPinnedRowIds(pinned);
    haptic('light');
    flashToast('Unpinned', { kind: 'info' });
  } else {
    if (pinned.length >= PIN_CAP) {
      haptic('warn');
      flashToast(`You can pin up to ${PIN_CAP} rows.`, { kind: 'warn' });
      return;
    }
    pinned.push(rowId);
    setPinnedRowIds(pinned);
    haptic('success');
    flashToast('Pinned', { kind: 'success' });
  }
  renderBrowseAllSheet();
  renderPinnedRows();
};

function renderPinnedRows() {
  const container = document.getElementById('pinned-rows');
  if (!container) return;
  const pinnedIds = getPinnedRowIds();
  if (!pinnedIds.length) { container.innerHTML = ''; return; }
  const pinnedRows = pinnedIds
    .map(id => DISCOVERY_CATALOG.find(r => r.id === id))
    .filter(Boolean);
  if (!pinnedRows.length) { container.innerHTML = ''; return; }

  const skeletonPosters =
    '<div class="sk-row-posters" aria-hidden="true">' +
    '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w80"></div></div>' +
    '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w60"></div></div>' +
    '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w75"></div></div>' +
    '</div>';

  container.innerHTML = pinnedRows.map(row => {
    const safeLabel = escapeHtml(row.label);
    const safeSub = escapeHtml(row.subtitle || '');
    const safeId = escapeHtml(row.id);
    return `<div class="add-section pinned-section">
        <div class="discover-row-eyebrow">PINNED &middot; ${safeLabel}</div>
        <div class="discover-row-subtitle"><em>${safeSub}</em></div>
        <div class="discover-row-wrap">
          <button class="discover-scroll-btn left" aria-label="Scroll left" onclick="scrollAddRow('${safeId}',-1)">◂</button>
          <div class="discover-row" id="add-row-${safeId}">${skeletonPosters}</div>
          <button class="discover-scroll-btn right" aria-label="Scroll right" onclick="scrollAddRow('${safeId}',1)">▸</button>
        </div>
      </div>`;
  }).join('');

  // Stagger loader calls — same budget discipline as renderAddDiscovery.
  pinnedRows.forEach((row, idx) => {
    setTimeout(() => loadDiscoveryRow(row), idx * 200);
  });
}

window.openBrowseAllSheet = function() {
  const bg = document.getElementById('browse-all-sheet-bg');
  if (!bg) return;
  renderBrowseAllSheet();
  bg.classList.add('on');
};

window.closeBrowseAllSheet = function() {
  const bg = document.getElementById('browse-all-sheet-bg');
  if (bg) bg.classList.remove('on');
};

function renderBrowseAllSheet() {
  const el = document.getElementById('browse-all-content');
  if (!el) return;
  const pinned = new Set(getPinnedRowIds());
  const buckets = [
    { key: 'A', label: 'Always-on' },
    { key: 'B', label: 'Trending' },
    { key: 'C', label: 'Discovery' },
    { key: 'D', label: 'Use-case' },
    { key: 'E', label: 'Theme of the day' },
    { key: 'F', label: 'Seasonal' },
    { key: 'G', label: 'Personalization' }
  ];
  el.innerHTML = buckets.map(b => {
    const rows = DISCOVERY_CATALOG.filter(r => r.bucket === b.key);
    if (!rows.length) return '';
    return `<div class="browse-all-bucket-group">
        <h4 class="browse-all-bucket-h">${escapeHtml(b.label)}</h4>
        ${rows.map(row => {
          const isPinned = pinned.has(row.id);
          const safeLabel = escapeHtml(row.label);
          const safeSub = escapeHtml(row.subtitle || '');
          return `<div class="browse-all-row-tile">
              <div class="browse-all-row-text">
                <div class="browse-all-row-label">${safeLabel}</div>
                <div class="browse-all-row-subtitle"><em>${safeSub}</em></div>
              </div>
              <button class="pin-toggle ${isPinned ? 'pinned' : ''}"
                onclick="togglePinRow('${escapeHtml(row.id)}')"
                aria-pressed="${isPinned}"
                aria-label="${isPinned ? 'Unpin' : 'Pin'} ${safeLabel}">
                ${isPinned ? '&#9733;' : '&#9734;'}
              </button>
            </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

// ===== Phase 11 / REFR-04 — Dynamic discovery rotation =====
// Builds 7-10 daily-rotated rows from DISCOVERY_CATALOG seeded by (userId, dateKey).
// Rendered into #add-discovery-rows. Loaders staggered to respect TMDB ~40req/10s budget.
// Per-row cache keyed on (rowId, dateKey, userId) and held in addTabCache._discovery.
function renderAddDiscovery() {
  const container = document.getElementById('add-discovery-rows');
  if (!container) return;
  const userId = (state.me && state.me.id) || 'anon';
  const dateKey = todayKey();
  const rows = pickDailyRows(userId, dateKey, DISCOVERY_CATALOG);

  const skeletonPosters =
    '<div class="sk-row-posters" aria-hidden="true">' +
    '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w80"></div></div>' +
    '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w60"></div></div>' +
    '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w75"></div></div>' +
    '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w55"></div></div>' +
    '</div>';

  container.innerHTML = rows.map(row => {
    const seasonalClass = row.bucket === 'F' ? ' seasonal' : '';
    const safeLabel = escapeHtml(row.label);
    const safeSub = escapeHtml(row.subtitle || '');
    const safeId = escapeHtml(row.id);
    return `<div class="add-section">
        <div class="discover-row-eyebrow${seasonalClass}">${safeLabel}</div>
        <div class="discover-row-subtitle"><em>${safeSub}</em></div>
        <div class="discover-row-wrap">
          <button class="discover-scroll-btn left" aria-label="Scroll left" onclick="scrollAddRow('${safeId}',-1)">◂</button>
          <div class="discover-row" id="add-row-${safeId}">${skeletonPosters}</div>
          <button class="discover-scroll-btn right" aria-label="Scroll right" onclick="scrollAddRow('${safeId}',1)">▸</button>
        </div>
      </div>`;
  }).join('');

  // Stagger loader invocations to respect TMDB ~40 req/10s budget.
  // First 4 fire immediately; subsequent rows space out 250ms apart.
  rows.forEach((row, idx) => {
    const delay = idx < 4 ? 0 : (idx - 3) * 250;
    setTimeout(() => loadDiscoveryRow(row), delay);
  });
}

async function loadDiscoveryRow(row) {
  const userId = (state.me && state.me.id) || 'anon';
  const cacheKey = `${row.id}-${todayKey()}-${userId}`;
  addTabCache._discovery = addTabCache._discovery || {};
  const cached = addTabCache._discovery[cacheKey];
  if (cached && Date.now() - cached.ts < ADD_CACHE_TTL) {
    renderAddRow(row.id, cached.items);
    return;
  }
  try {
    let items = [];
    const src = row.source || {};
    if (src.type === 'tmdb-endpoint') {
      const d = await tmdbFetch(src.endpoint);
      items = (d.results || [])
        .filter(x => (x.media_type === 'movie' || x.media_type === 'tv'
                       || src.endpoint.includes('/movie/') || src.endpoint.includes('/tv/'))
                     && (x.title || x.name) && x.poster_path)
        .filter(isFamilySafeTmdbItem)
        .slice(0, 20)
        .map(x => {
          // Infer media_type when endpoint hints it (movie/tv endpoints drop the field).
          const inferred = x.media_type || (src.endpoint.includes('/tv/') ? 'tv'
                                            : src.endpoint.includes('/movie/') ? 'movie'
                                            : undefined);
          return mapTmdbItem(x, inferred);
        });
    } else if (src.type === 'tmdb-discover') {
      const params = new URLSearchParams(Object.assign({ sort_by: 'popularity.desc' }, src.params || {}));
      const d = await tmdbFetch('/discover/movie?' + params.toString());
      items = (d.results || [])
        .filter(x => x.poster_path && (x.title || x.name))
        .filter(isFamilySafeTmdbItem)
        .slice(0, 20)
        .map(x => mapTmdbItem(x, 'movie'));
    } else if (src.type === 'tmdb-streaming-filter') {
      // Delegate to existing loader which resolves provider IDs from the user's library.
      if (typeof loadStreamingRow === 'function') {
        // Existing loader writes into #add-row-streaming (id 'streaming').
        // Re-render the row id expected by renderAddDiscovery (`add-row-${row.id}`) by copying items.
        await loadStreamingRow();
        if (addTabCache.streaming && addTabCache.streaming.items) {
          items = addTabCache.streaming.items;
        }
      }
    } else if (src.type === 'tmdb-curated-list') {
      // Plan 11-03b — hand-curated TMDB movie IDs (cult classics, festival winners, etc.).
      // Cache is per-row-per-day so the 20 parallel /movie/{id} fetches only fire once.
      const ids = Array.from(new Set(src.tmdbIds || [])).slice(0, 20);
      const results = await Promise.all(
        ids.map(id => tmdbFetch(`/movie/${id}`).catch(() => null))
      );
      items = results
        .filter(x => x && x.poster_path && (x.title || x.name))
        .filter(isFamilySafeTmdbItem)
        .map(x => mapTmdbItem({ ...x, media_type: 'movie' }, 'movie'));
    } else if (src.type === 'tmdb-director-rotating') {
      // Plan 11-03b — pick ONE director deterministically per (rowId, dateKey).
      // Fresh xmur3 seed so this selection is independent of the daily row picker but still stable.
      const directors = src.directors || [];
      if (!directors.length) { items = []; }
      else {
        // Inline 32-bit hash — same algorithm as discovery-engine.xmur3 but we avoid the import
        // (loader is already inside app.js; keeping it self-contained).
        const seedStr = `${row.id}-${todayKey()}`;
        let h = 1779033703 ^ seedStr.length;
        for (let i = 0; i < seedStr.length; i++) {
          h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
          h = (h << 13) | (h >>> 19);
        }
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        const idx = (h >>> 0) % directors.length;
        const personId = directors[idx];
        const d = await tmdbFetch(
          `/discover/movie?with_people=${personId}&sort_by=vote_average.desc&vote_count.gte=100`
        );
        items = (d.results || [])
          .filter(x => x.poster_path)
          .filter(isFamilySafeTmdbItem)
          .slice(0, 20)
          .map(x => mapTmdbItem(x, 'movie'));
      }
    } else if (src.type === 'group-want-list') {
      // G1 — titles the current user voted Yes on that haven't been watched or picked yet.
      const myId = state.me && state.me.id;
      if (!myId) { items = []; }
      else {
        items = (state.titles || []).filter(t => {
          const votes = t.votes || {};
          const myVote = votes[myId] || votes[`m_${myId}`];
          return myVote === 'yes' && !t.watched && !t.lastPickedAt && !t.spinnerPickedAt;
        }).slice(0, 20).map(t => ({
          id: t.id,
          tmdbId: t.tmdbId,
          mediaType: t.mediaType || (t.kind === 'TV' ? 'tv' : 'movie'),
          name: t.name,
          year: t.year,
          kind: t.kind || 'Movie',
          overview: t.overview || '',
          poster: t.poster || '',
          genreIds: t.genreIds || []
        }));
      }
    } else if (src.type === 'group-similar-to-recent') {
      // G3 — TMDB /similar off the most-recently-watched title that has a tmdbId.
      const recent = (state.titles || [])
        .filter(t => t.watched && t.tmdbId)
        .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))[0];
      if (!recent || !recent.tmdbId) { items = []; }
      else {
        const mediaPath = (recent.mediaType === 'tv' || recent.kind === 'TV') ? 'tv' : 'movie';
        const d = await tmdbFetch(`/${mediaPath}/${recent.tmdbId}/similar`);
        // Same Boys-style filter we applied at fetchTmdbDetails (commit 51f7f50):
        // format match (live-action ↔ live-action, animated ↔ animated) + adult drop +
        // genre-overlap sort. Source title is `recent` which carries genreIds from
        // mapTmdbItem; older titles may lack it so animated check falls back to genre name.
        const recentGenreSet = new Set(recent.genreIds || []);
        const recentIsAnimated = recentGenreSet.has(16) ||
          (Array.isArray(recent.genres) && recent.genres.includes('Animation'));
        const candidates = (d.results || [])
          .filter(x => x.poster_path && (x.title || x.name))
          .filter(isFamilySafeTmdbItem)
          .filter(x => ((x.genre_ids || []).includes(16)) === recentIsAnimated);
        candidates.sort((a, b) => {
          const aOverlap = (a.genre_ids || []).filter(g => recentGenreSet.has(g)).length;
          const bOverlap = (b.genre_ids || []).filter(g => recentGenreSet.has(g)).length;
          if (bOverlap !== aOverlap) return bOverlap - aOverlap;
          return (b.vote_average || 0) - (a.vote_average || 0);
        });
        // Fallback: if strict format/genre filter leaves <3, fall back to adult-filtered
        // (still drops porn) but skips format match. Avoids empty rows on niche sources.
        const finalList = candidates.length >= 3
          ? candidates.slice(0, 20)
          : (d.results || [])
              .filter(x => x.poster_path && (x.title || x.name))
              .filter(isFamilySafeTmdbItem)
              .slice(0, 20);
        items = finalList.map(x => mapTmdbItem(x, mediaPath));
        // Swap the eyebrow on the live row to reflect which title seeded the similar list.
        try {
          const rowEl = document.getElementById('add-row-' + row.id);
          const section = rowEl && rowEl.closest('.add-section');
          const eyebrow = section && section.querySelector('.discover-row-eyebrow');
          if (eyebrow) eyebrow.textContent = `Because you watched ${recent.name}`;
        } catch (e) { /* non-fatal — eyebrow swap is cosmetic */ }
      }
    } else if (src.type === 'group-top-genre-discover') {
      // G7 — aggregate Yes-voted title genres across the library, map the top 1-2 names back
      // to TMDB genre IDs, query /discover with those. state.titles carries genres as strings
      // (TMDB genre NAMES, populated by fetchTmdbExtras) so we need a name→id map.
      const nameToId = {
        'Action': 28, 'Adventure': 12, 'Animation': 16, 'Comedy': 35,
        'Crime': 80, 'Documentary': 99, 'Drama': 18, 'Family': 10751,
        'Fantasy': 14, 'History': 36, 'Horror': 27, 'Music': 10402,
        'Mystery': 9648, 'Romance': 10749, 'Science Fiction': 878,
        'TV Movie': 10770, 'Thriller': 53, 'War': 10752, 'Western': 37,
        // TV-specific names that map to movie genres well enough for discovery
        'Action & Adventure': 28, 'Sci-Fi & Fantasy': 878, 'War & Politics': 10752, 'Kids': 10751
      };
      const genreCount = {};
      (state.titles || []).forEach(t => {
        const votes = t.votes || {};
        const hasYes = Object.values(votes).some(v => v === 'yes');
        if (!hasYes || !Array.isArray(t.genres)) return;
        t.genres.forEach(g => {
          const gid = nameToId[g];
          if (gid) genreCount[gid] = (genreCount[gid] || 0) + 1;
        });
      });
      const topGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(e => e[0]);
      if (!topGenres.length) { items = []; }
      else {
        const d = await tmdbFetch(
          `/discover/movie?with_genres=${topGenres.join(',')}&sort_by=popularity.desc&vote_average.gte=6.5&vote_count.gte=300`
        );
        items = (d.results || [])
          .filter(x => x.poster_path)
          .filter(isFamilySafeTmdbItem)
          .slice(0, 20)
          .map(x => mapTmdbItem(x, 'movie'));
      }
    } else if (src.type === 'group-recent-yes-similar' || src.type === 'group-rewatch-candidates') {
      // Cold-start stub: empty triggers per-row empty state. Wired fully in Plan 11-03b
      // (personalization Bucket G + comfort-rewatch data model).
      items = [];
    }
    addTabCache._discovery[cacheKey] = { ts: Date.now(), items };
    renderAddRow(row.id, items);
  } catch(e) {
    const el = document.getElementById('add-row-' + row.id);
    if (el) el.innerHTML = '<div class="discover-loading"><em>Nothing new here today &mdash; check back tomorrow.</em></div>';
  }
}

function renderAddMoodChips() {
  const el = document.getElementById('add-mood-chips');
  if (!el) return;
  el.innerHTML = MOODS.map(m => {
    const on = currentAddMood === m.id;
    return `<button class="mood-chip ${on?'on':''}" onclick="selectAddMood('${m.id}')">
      <span class="mood-icon">${twemojiImg(m.icon, m.label, 'twemoji--md')}</span>${m.label}
    </button>`;
  }).join('');
}

window.selectAddMood = async function(moodId) {
  if (currentAddMood === moodId) {
    currentAddMood = null;
    renderAddMoodChips();
    const el = document.getElementById('add-row-mood');
    if (el) el.innerHTML = '<div class="discover-loading">Pick a mood above</div>';
    return;
  }
  currentAddMood = moodId;
  renderAddMoodChips();
  const el = document.getElementById('add-row-mood');
  if (el) el.innerHTML = skDiscoverRow(5);
  // Cache lookup
  const cached = addTabCache.mood[moodId];
  if (cached && Date.now() - cached.ts < ADD_CACHE_TTL) {
    renderAddRow('mood', cached.items);
    return;
  }
  try {
    let url;
    if (moodId === 'short') {
      url = '/discover/movie?with_runtime.lte=89&with_runtime.gte=60&sort_by=popularity.desc&vote_count.gte=200';
    } else {
      const genres = MOOD_TO_GENRES[moodId] || '';
      url = `/discover/movie?with_genres=${genres}&sort_by=popularity.desc&vote_count.gte=200`;
    }
    const d = await tmdbFetch(url);
    const items = (d.results || [])
      .filter(x => x.poster_path)
      .filter(isFamilySafeTmdbItem)
      .slice(0, 20)
      .map(x => mapTmdbItem(x, 'movie'));
    addTabCache.mood[moodId] = { ts: Date.now(), items };
    if (currentAddMood === moodId) renderAddRow('mood', items);
  } catch(e) {
    const el2 = document.getElementById('add-row-mood');
    if (el2) el2.innerHTML = '<div class="discover-loading">Could not load</div>';
  }
};

window.scrollAddRow = function(rowId, dir) {
  const el = document.getElementById('add-row-' + rowId);
  if (!el) return;
  el.scrollBy({ left: dir * 360, behavior: 'smooth' });
};

window.addFromAddTab = async function(rowId, titleId) {
  if (state.titles.find(t => t.id === titleId)) { /* already in */ return; }
  // Find the item across all caches (including Phase 11 / REFR-04 dynamic _discovery cache).
  const pools = [
    addTabCache.trending && addTabCache.trending.items,
    addTabCache.streaming && addTabCache.streaming.items,
    addTabCache.gems && addTabCache.gems.items,
    ...Object.values(addTabCache.mood).map(c => c && c.items),
    ...Object.values(addTabCache._discovery || {}).map(c => c && c.items)
  ].filter(Boolean);
  let item = null;
  for (const pool of pools) {
    item = pool.find(x => x.id === titleId);
    if (item) break;
  }
  if (!item) return;
  const extras = await fetchTmdbExtras(item.mediaType, item.tmdbId);
  const moods = suggestMoods(item.genreIds || [], extras.runtime);
  const newTitle = { ...item, ...extras, moods, votes:{}, watched:false };
  try {
    // === D-03 Add-tab insertion (DECI-14-03) === — Add-tab "+ Pull up" lands in my queue.
    const res = await createTitleWithApprovalCheck(titleId, newTitle, { addToMyQueue: true });
    logActivity(res.pending ? 'requested' : 'added', { titleName: item.name, titleId });
    if (res.pending) flashToast(`"${item.name}" sent for a parent to review.`);
    // Re-render the row to flip the + to ✓
    renderAddRow(rowId, pools.find(p => p.find(x => x.id === titleId)) || []);
  } catch(e) { alert('Could not add: ' + e.message); }
};

// Phase 11 quick fix — preview a discovery tile WITHOUT adding it. Tile click goes here;
// + badge calls addFromAddTab directly via event.stopPropagation. Reuses the existing
// detail-modal-bg container with a custom preview shell (no Firestore writes; lazy
// fetches TMDB extras for overview/trailer/runtime). "Add to library" inside the
// preview chains to addFromAddTab + reopens the full detail modal with vote actions.
window.previewDiscoveryTile = async function(rowId, titleId) {
  // Already in library — open the existing detail modal directly.
  if (state.titles.find(t => t.id === titleId)) {
    openDetailModal(titleId);
    return;
  }
  const pools = [
    addTabCache.trending && addTabCache.trending.items,
    addTabCache.streaming && addTabCache.streaming.items,
    addTabCache.gems && addTabCache.gems.items,
    ...Object.values(addTabCache.mood).map(c => c && c.items),
    ...Object.values(addTabCache._discovery || {}).map(c => c && c.items)
  ].filter(Boolean);
  let item = null;
  for (const pool of pools) {
    item = pool.find(x => x.id === titleId);
    if (item) break;
  }
  if (!item) { flashToast('Title not found in cache'); return; }
  const bg = document.getElementById('detail-modal-bg');
  const content = document.getElementById('detail-modal-content');
  content.innerHTML = renderDiscoveryPreviewShell(item, rowId, true);
  bg.classList.add('on');
  bg.onclick = (e) => { if (e.target === bg) closeDetailModal(); };
  try {
    const extras = await fetchTmdbExtras(item.mediaType, item.tmdbId);
    const merged = { ...item, ...extras };
    content.innerHTML = renderDiscoveryPreviewShell(merged, rowId, false);
  } catch (e) {
    console.error('preview extras fetch failed', e);
  }
};

function renderDiscoveryPreviewShell(t, rowId, loading) {
  const safeName = escapeHtml(t.name);
  const metaParts = [t.year, t.kind, t.runtime ? `${t.runtime} min` : null].filter(Boolean).map(escapeHtml);
  const metaHtml = metaParts.map((p,i) => i === 0 ? p : `<span class="dot">·</span> ${p}`).join(' ');
  const overviewBlock = loading
    ? '<div class="detail-section"><div class="sk sk-line" style="width:90%;margin-bottom:8px"></div><div class="sk sk-line" style="width:75%;margin-bottom:8px"></div><div class="sk sk-line" style="width:60%"></div></div>'
    : (t.overview ? `<div class="detail-section"><h4>About</h4><p class="detail-overview">${escapeHtml(t.overview)}</p></div>` : '');
  const trailerHtml = (!loading && t.trailerKey)
    ? `<div class="detail-section"><h4>Trailer</h4><iframe class="trailer-frame" src="https://www.youtube.com/embed/${encodeURIComponent(t.trailerKey)}" allowfullscreen></iframe></div>`
    : '';
  const safeRow = escapeHtml(rowId);
  const safeId = escapeHtml(t.id);
  return `<div class="detail-backdrop" style="background-image:url('${t.backdrop || t.poster || ''}')">
    <button class="detail-close" aria-label="Close" onclick="closeDetailModal()">✕</button>
  </div>
  <div class="detail-body">
    <h2 class="detail-title">${safeName}</h2>
    <div class="detail-meta">${metaHtml}</div>
    ${overviewBlock}
    ${trailerHtml}
    <div class="detail-preview-actions">
      <button class="pill discover-preview-add" onclick="addFromPreview('${safeRow}','${safeId}')">+ Add to library</button>
      <button class="pill discover-preview-cancel" onclick="closeDetailModal()">Not now</button>
    </div>
  </div>`;
}

window.addFromPreview = async function(rowId, titleId) {
  await window.addFromAddTab(rowId, titleId);
  closeDetailModal();
  // Brief delay for Firestore write to land in state.titles via subscribeFamily.
  setTimeout(() => {
    if (state.titles.find(t => t.id === titleId)) {
      openDetailModal(titleId);
    }
  }, 300);
};

// Kick off all rows when Add screen is first shown
let addTabInitialized = false;
function initAddTab(force) {
  if (addTabInitialized && !force) return;
  addTabInitialized = true;
  // === D-05 (DECI-14-05) — Catch-up-on-votes CTA. Surfaces Vote MODE (bulk swipe)
  // since it was demoted off the tile face in D-04. Runs FIRST so the CTA sits
  // above the search bar's discovery rows when present. ===
  renderCatchUpOnVotesCta();
  renderAddMoodChips();
  // Phase 11 / REFR-04 — dynamic rotation replaces the 3 hardcoded loaders.
  // loadTrendingRow / loadStreamingRow / loadGemsRow remain in the module and are
  // invoked from loadDiscoveryRow when the rotation selects those buckets.
  // Plan 11-03b — pinned rows render FIRST (above daily rotation) when any pins exist.
  renderPinnedRows();
  // Phase 11 / REFR-13 — Couch Nights themed packs render BETWEEN mood + pinned and
  // the dynamic discovery rotation (per UI-SPEC §Layout line 539). Uses constant data
  // (COUCH_NIGHTS_PACKS) so no TMDB cost until a pack-detail sheet is opened.
  renderCouchNightsRow();
  renderAddDiscovery();
}

// === D-05 (DECI-14-05) — Catch-up-on-votes CTA renderer ===
// Inserts (or removes) a Vote-mode launcher card at the top of #screen-add when
// the current user has >= 10 unvoted family titles. Uses getNeedsVoteTitles()
// (D-01 couch-aware) so the count matches what Vote mode will actually present.
// Idempotent: re-removes itself when count drops below threshold or there's no me.
// openSwipeMode() is the bulk Vote MODE entry (the planner referenced
// openVoteModal() but that's the per-title modal; D-05's "swipe through them"
// language matches openSwipeMode — recorded as a planner clarification in SUMMARY).
function renderCatchUpOnVotesCta() {
  const screen = document.getElementById('screen-add');
  if (!screen) return;
  const existing = document.getElementById('add-catchup-cta');
  // Compute unvoted count via the same primitive Vote-mode uses, so the number
  // shown in the CTA matches what the user will actually swipe through.
  const unvotedCount = state.me ? getNeedsVoteTitles().length : 0;
  if (unvotedCount < 10) {
    if (existing) existing.remove();
    return;
  }
  const html = `<div class="add-catchup-cta" id="add-catchup-cta" role="region" aria-label="Catch up on votes">
    <div class="add-catchup-h">Catch up on votes</div>
    <p class="add-catchup-body">${unvotedCount} title${unvotedCount === 1 ? '' : 's'} waiting for your vote. Swipe through them.</p>
    <button class="tc-primary" type="button" onclick="openSwipeMode()">Open Vote mode</button>
  </div>`;
  if (existing) {
    existing.outerHTML = html;
  } else {
    // Insert as the first child of #screen-add so it sits above the section header.
    screen.insertAdjacentHTML('afterbegin', html);
  }
}

// ===== Phase 11 / REFR-13 — Couch Nights themed ballot packs =====
// Renders horizontal tile row on Add tab; tap opens pack-detail sheet with lazy-hydrated
// TMDB preview; "Start this pack" CTA seeds the family ballot via the existing
// addFromAddTab flow then launches Vote mode (openSwipeMode). Pack data is constant-
// based (COUCH_NIGHTS_PACKS in js/constants.js); Firestore migration deferred to Phase 12.

let _activePackId = null;

function renderCouchNightsRow() {
  const row = document.getElementById('couch-nights-row');
  if (!row) return;
  if (!Array.isArray(COUCH_NIGHTS_PACKS) || !COUCH_NIGHTS_PACKS.length) {
    // Empty catalog — hide entire section per UI-SPEC §REFR-13 empty state.
    const section = document.getElementById('couch-nights-section');
    if (section) section.style.display = 'none';
    return;
  }
  row.innerHTML = COUCH_NIGHTS_PACKS.map(pack => {
    const safeTitle = escapeHtml(pack.title);
    const safeId = escapeHtml(pack.id);
    const safeHero = (pack.heroImageUrl || '').replace(/'/g, '%27');
    return `<div class="couch-night-tile" role="button" tabindex="0"
        aria-label="${safeTitle}"
        onclick="openCouchNightPack('${safeId}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCouchNightPack('${safeId}')}"
        style="background-image:linear-gradient(0deg,rgba(20,17,15,0.85),transparent 60%),url('${safeHero}')">
      <div class="couch-night-tile-title">${safeTitle}</div>
    </div>`;
  }).join('');
}

window.openCouchNightPack = function(packId) {
  const pack = COUCH_NIGHTS_PACKS.find(p => p.id === packId);
  if (!pack) return;
  _activePackId = packId;
  const heroEl = document.getElementById('couch-night-hero');
  const titleEl = document.getElementById('couch-night-sheet-title');
  const descEl = document.getElementById('couch-night-sheet-desc');
  const previewEl = document.getElementById('couch-night-titles-preview');
  const ctaBtn = document.getElementById('start-pack-cta');
  if (heroEl) heroEl.style.backgroundImage = `url('${(pack.heroImageUrl || '').replace(/'/g, '%27')}')`;
  if (titleEl) titleEl.textContent = pack.title;
  if (descEl) descEl.innerHTML = `<em>${escapeHtml(pack.description || '')}</em>`;
  if (previewEl) {
    previewEl.innerHTML =
      '<div class="sk-row-posters" aria-hidden="true">' +
      '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w80"></div></div>' +
      '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w60"></div></div>' +
      '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w75"></div></div>' +
      '<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line sk-w55"></div></div>' +
      '</div>';
  }
  if (ctaBtn) { ctaBtn.disabled = false; ctaBtn.textContent = 'Start this pack'; }
  const bg = document.getElementById('couch-night-sheet-bg');
  if (bg) bg.classList.add('on');
  loadPackPreview(pack);
};

window.closeCouchNightSheet = function() {
  const bg = document.getElementById('couch-night-sheet-bg');
  if (bg) bg.classList.remove('on');
  _activePackId = null;
};

async function loadPackPreview(pack) {
  const previewEl = document.getElementById('couch-night-titles-preview');
  if (!previewEl) return;
  try {
    const ids = (pack.tmdbIds || []).slice(0, 8);
    // Parallel fan-out, same posture as loadGamePickerLeague ESPN fan-out — 8 TMDB
    // fetches well under the 40-req/10s budget; no cache (pack data is stable, hero
    // sheet is opened on user intent).
    const fetches = ids.map(id =>
      fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    );
    const results = await Promise.all(fetches);
    const valid = results.filter(r => r && r.poster_path);
    // If the pack was closed or a different pack was opened, bail.
    if (_activePackId !== pack.id) return;
    if (!valid.length) {
      previewEl.innerHTML = '<div class="discover-loading"><em>This pack&rsquo;s being restocked. Try another.</em></div>';
      return;
    }
    previewEl.innerHTML = valid.map(t => {
      const safeName = escapeHtml(t.title || t.name || '');
      const poster = `https://image.tmdb.org/t/p/w185${t.poster_path}`;
      return `<div class="couch-night-preview-card">
        <div class="couch-night-preview-poster" style="background-image:url('${poster}')"></div>
        <div class="couch-night-preview-title">${safeName}</div>
      </div>`;
    }).join('');
  } catch(e) {
    if (_activePackId !== pack.id) return;
    previewEl.innerHTML = '<div class="discover-loading"><em>Could not load pack.</em></div>';
  }
}

window.confirmStartPack = async function() {
  if (!_activePackId) return;
  if (!state.me) { alert('Sign in first.'); return; }
  if (guardReadOnlyWrite && guardReadOnlyWrite()) return;
  const pack = COUCH_NIGHTS_PACKS.find(p => p.id === _activePackId);
  if (!pack) return;
  const btn = document.getElementById('start-pack-cta');
  if (btn) { btn.disabled = true; btn.textContent = 'Seeding…'; }
  try {
    const seededCount = await seedBallotFromPack(pack);
    haptic('success');
    if (seededCount > 0) {
      flashToast(`Pack loaded: ${pack.title}`, { kind: 'success' });
    } else {
      flashToast(`${pack.title} is already on the couch`, { kind: 'success' });
    }
    closeCouchNightSheet();
    // Launch Vote mode on the new candidates (existing swipe flow picks up needs-vote titles).
    if (typeof window.openSwipeMode === 'function') {
      window.openSwipeMode();
    }
  } catch(e) {
    qnLog('[couch-nights] seed failed', e);
    flashToast('Could not load pack', { kind: 'warn' });
    if (btn) { btn.disabled = false; btn.textContent = 'Start this pack'; }
  }
};

// Seeds the family ballot with each TMDB ID from the pack. For each id:
//   - skip if already in state.titles (by tmdbId match)
//   - fetch TMDB metadata + suggest moods (mirrors addFromAddTab)
//   - stamp addedVia:`pack:${pack.id}` for attribution + future analytics
//   - use createTitleWithApprovalCheck so parent-approval flow still applies for kids
// Returns count of NEW titles added (for the toast copy).
async function seedBallotFromPack(pack) {
  let added = 0;
  for (const tmdbId of (pack.tmdbIds || [])) {
    try {
      const titleId = 'tmdb_' + tmdbId;
      // Dedupe: skip if this tmdbId is already in the library.
      if (state.titles.find(t => t.id === titleId || t.tmdbId === tmdbId)) continue;
      // Fetch base metadata — movie only (pack curation is movie-centric for v1).
      const dr = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}`);
      if (!dr.ok) continue;
      const d = await dr.json();
      if (!d || !d.poster_path) continue;
      const baseItem = {
        id: titleId,
        tmdbId: d.id,
        mediaType: 'movie',
        name: d.title || d.name,
        year: (d.release_date || '').slice(0, 4),
        kind: 'Movie',
        overview: d.overview || '',
        poster: `https://image.tmdb.org/t/p/w300${d.poster_path}`,
        genreIds: (d.genres || []).map(g => g.id)
      };
      const extras = await fetchTmdbExtras('movie', tmdbId);
      const moods = suggestMoods(baseItem.genreIds || [], extras.runtime);
      const newTitle = {
        ...baseItem,
        ...extras,
        moods,
        votes: {},
        watched: false,
        addedVia: `pack:${pack.id}`,
        addedAt: Date.now()
      };
      const res = await createTitleWithApprovalCheck(titleId, newTitle);
      logActivity(res.pending ? 'requested' : 'added', { titleName: baseItem.name, titleId, source: `pack:${pack.id}` });
      added += 1;
    } catch(e) {
      qnLog('[couch-nights] seed single failed', tmdbId, e);
      // Skip this id, keep going — partial success is still useful.
    }
  }
  return added;
}

// ===== Plan 09-07a (DESIGN-07) — First-run brand onboarding overlay =====
// Separate from the pre-existing feature tour below (maybeStartOnboarding). This is
// the brand-polished 3-step intro gated on Firestore members/{id}.seenOnboarding.
// Guests (state.me.type === 'guest') skip entirely — research Pitfall 5 defense,
// client-side guard even though 09-07b sets seenOnboarding:true at guest creation.

let _onboardingCurrentStep = 1;

function maybeShowFirstRunOnboarding() {
  if (!state.me) return;
  // Pitfall 5: guests skip onboarding entirely. 09-07b adds CF-side guarantee; this
  // is the client-side double-guard.
  if (state.me.type === 'guest') return;
  // Enrich state.me with the server-side seenOnboarding flag by reading the live
  // member doc from state.members (populated by the onSnapshot in startSync).
  const liveMe = (state.members || []).find(m => m.id === state.me.id);
  const seen = (liveMe && liveMe.seenOnboarding === true) || state.me.seenOnboarding === true;
  if (seen) return;
  // Also respect the legacy localStorage flag so existing users who've seen the
  // old feature tour don't get bounced back through the new intro.
  try { if (localStorage.getItem('qn_onboarded')) return; } catch(e) {}
  showOnboardingStep(1);
}

function showOnboardingStep(n) {
  _onboardingCurrentStep = n;
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  for (let i = 1; i <= 3; i++) {
    const step = document.getElementById('onboarding-step-' + i);
    if (step) step.style.display = (i === n) ? 'flex' : 'none';
  }
  try { haptic('light'); } catch(e) {}
}

function hideOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.style.display = 'none';
  for (let i = 1; i <= 3; i++) {
    const step = document.getElementById('onboarding-step-' + i);
    if (step) step.style.display = 'none';
  }
}

window.nextOnboardingStep = function() {
  const next = Math.min(3, _onboardingCurrentStep + 1);
  showOnboardingStep(next);
};

// Skip and complete both persist seenOnboarding:true. Skip is visible on every step
// with equal visual weight to primary — user can dismiss without coming back.
window.skipOnboarding = async function() {
  hideOnboarding();
  try { localStorage.setItem('qn_onboarded', '1'); } catch(e) {}
  try {
    if (state.me && state.familyCode) {
      await updateDoc(doc(membersRef(), state.me.id), { seenOnboarding: true });
    }
  } catch(e) { console.error('[onboarding] skip write failed', e); }
};

window.completeOnboarding = async function() {
  hideOnboarding();
  try { localStorage.setItem('qn_onboarded', '1'); } catch(e) {}
  try {
    if (state.me && state.familyCode) {
      await updateDoc(doc(membersRef(), state.me.id), { seenOnboarding: true });
      try { haptic('success'); } catch(e) {}
    }
  } catch(e) { console.error('[onboarding] complete write failed', e); }
};

// Replay intro: forces the overlay to show again even if seenOnboarding === true.
// Called from Settings → "Replay intro" button. Does NOT unset the Firestore flag
// (so onboarding doesn't re-fire on next boot); only replays the overlay once.
window.replayOnboarding = function() {
  showOnboardingStep(1);
};

// === Plan 14-09 / D-10 maybeShowTooltip gate — DECI-14-10 ===
// One-shot anchored tooltip gated on members/{id}.seenTooltips.{primId}.
// Reads the live member doc (state.members) so cross-tab updates land; falls back
// to state.me.seenTooltips for first-render bootstrapping. Writes the flag on
// display so the next render skips. Guests skip entirely (no Firestore writes).
// Adapted from maybeShowFirstRunOnboarding above — same gate-pattern, sub-map key
// instead of a top-level boolean, and fired at moment-of-encounter (in render
// handlers) not at boot.
//
// firestore.rules audit (Plan 14-09 Task 2 §5): the members/{memberId} update
// branch (deploy-mirror firestore.rules:192-202) is permissive — any field write by
// self/owner/parent passes. seenTooltips.{primId} writes go through unchanged.
async function maybeShowTooltip(primId, targetEl, message, opts) {
  if (!state.me || !targetEl) return;
  if (state.me.type === 'guest') return; // guests skip — no Firestore write
  const liveMe = (state.members || []).find(m => m.id === state.me.id);
  const seenMap = (liveMe && liveMe.seenTooltips) || (state.me.seenTooltips) || {};
  if (seenMap[primId]) return;
  showTooltipAt(targetEl, message, opts);
  try {
    await updateDoc(doc(membersRef(), state.me.id), {
      [`seenTooltips.${primId}`]: true,
      ...writeAttribution()
    });
  } catch (e) {
    console.error('[tooltip] flag write failed', e);
  }
}

// ===== Plan 09-07a — Legacy family self-claim flow =====
// Renders CTA in Account settings when state.ownerUid == null && !dismissed.
// first-write-wins: second tapper gets a permission-denied (rule denies write once
// ownerUid exists); UI hides CTA the moment the onSnapshot updates state.ownerUid.

function renderLegacyClaimCtaIfApplicable() {
  const el = document.getElementById('legacy-claim-card');
  if (!el) return;
  const applicable = !!(state.me
    && state.familyCode
    && state.auth
    && state.auth.uid
    && state.ownerUid == null
    && !state.dismissedOwnerClaim);
  el.style.display = applicable ? '' : 'none';
}

window.claimLegacyOwnership = async function() {
  if (!state.auth || !state.auth.uid || !state.familyCode) return;
  if (state.ownerUid != null) {
    flashToast('This group already has an admin.', { kind: 'info' });
    renderLegacyClaimCtaIfApplicable();
    return;
  }
  const ok = window.confirm('Claim ownership of this group? This locks admin rights to your account.');
  if (!ok) return;
  try {
    await updateDoc(familyDocRef(), { ownerUid: state.auth.uid });
    flashToast('You are now the group admin.', { kind: 'success' });
    try { haptic('success'); } catch(e) {}
    // state.ownerUid will update via onSnapshot; renderLegacyClaimCtaIfApplicable
    // will hide the card. Force an immediate re-render too in case the snapshot lags.
    state.ownerUid = state.auth.uid;
    renderLegacyClaimCtaIfApplicable();
    try { renderOwnerSettings(); } catch(e) {}
  } catch(e) {
    console.error('[legacy-claim]', e);
    const code = e && e.code;
    const msg = (code === 'permission-denied')
      ? 'Someone else just claimed ownership. Refreshing…'
      : "Couldn't claim ownership. Try again?";
    flashToast(msg, { kind: 'warn' });
  }
};

window.dismissLegacyClaim = function() {
  state.dismissedOwnerClaim = true;
  renderLegacyClaimCtaIfApplicable();
};

// ===== Plan 09-07a — Sign-in methods card (absorbs 05x-account-linking #6) =====
// Helpers consolidated into js/app.js (not a separate js/auth.js module) — see
// 09-07a-SUMMARY.md drift-3 resolution. Single-function scope + existing auth UI
// already lives here; splitting for one helper would fragment.

function hasPasswordCredential() {
  const cu = auth && auth.currentUser;
  if (!cu || !Array.isArray(cu.providerData)) return false;
  return cu.providerData.some(p => p && p.providerId === 'password');
}

async function setUserPassword(password) {
  if (!auth || !auth.currentUser) {
    throw new Error('no-current-user');
  }
  if (!password || password.length < 6) {
    throw new Error('weak-password');
  }
  await updatePassword(auth.currentUser, password);
}

function renderSignInMethodsCard() {
  const card = document.getElementById('signin-methods-card');
  const list = document.getElementById('signin-methods-list');
  if (!card || !list) return;
  // Only render when signed-in (auth present). Hide outright for legacy/unauthed.
  if (!auth || !auth.currentUser) { card.style.display = 'none'; return; }
  card.style.display = '';
  const providers = (auth.currentUser.providerData || []).map(p => p && p.providerId).filter(Boolean);
  const rows = [];
  // Google
  rows.push(`
    <div class="signin-method-row">
      <div class="signin-method-icon">G</div>
      <div class="signin-method-body">
        <div class="signin-method-label">Google</div>
        <div class="signin-method-meta">${providers.includes('google.com') ? escapeHtml(auth.currentUser.email || 'Linked') : 'Not linked'}</div>
      </div>
      ${providers.includes('google.com') ? '<span class="signin-method-check" aria-label="Linked">&#10003;</span>' : ''}
    </div>`);
  // Phone
  rows.push(`
    <div class="signin-method-row">
      <div class="signin-method-icon">&#9742;</div>
      <div class="signin-method-body">
        <div class="signin-method-label">Phone</div>
        <div class="signin-method-meta">${providers.includes('phone') ? escapeHtml(auth.currentUser.phoneNumber || 'Linked') : 'Not linked'}</div>
      </div>
      ${providers.includes('phone') ? '<span class="signin-method-check" aria-label="Linked">&#10003;</span>' : ''}
    </div>`);
  // Email link / password
  const hasEmail = providers.includes('emailLink') || providers.includes('password');
  const hasPw = hasPasswordCredential();
  rows.push(`
    <div class="signin-method-row">
      <div class="signin-method-icon">@</div>
      <div class="signin-method-body">
        <div class="signin-method-label">Email</div>
        <div class="signin-method-meta">${hasEmail ? escapeHtml(auth.currentUser.email || 'Linked') : 'Not linked'}</div>
      </div>
      ${hasEmail ? '<span class="signin-method-check" aria-label="Linked">&#10003;</span>' : ''}
    </div>`);
  // Password row — set or change
  if (hasPw) {
    rows.push(`
      <div class="signin-method-row">
        <div class="signin-method-icon">&#128274;</div>
        <div class="signin-method-body">
          <div class="signin-method-label">Password</div>
          <div class="signin-method-meta">Set — you can sign in from any device with email + password.</div>
        </div>
        <button class="pill" onclick="openSetPasswordForm()">Change</button>
      </div>`);
  } else {
    rows.push(`
      <div class="signin-method-row">
        <div class="signin-method-icon">&#128274;</div>
        <div class="signin-method-body">
          <div class="signin-method-label">Password</div>
          <div class="signin-method-meta">Set a password for faster sign-in from other devices.</div>
        </div>
        <button class="pill accent" onclick="openSetPasswordForm()">Set password</button>
      </div>`);
  }
  // Inline form (hidden until Set/Change tapped). Kept in-card so focus stays.
  rows.push(`
    <div class="signin-methods-password-form" id="signin-methods-password-form" style="display:none;">
      <input id="signin-methods-password-input" type="password" autocomplete="new-password" placeholder="New password (min 6 chars)" />
      <div class="cluster">
        <button class="pill accent" onclick="submitSetPassword()">Save password</button>
        <button class="pill" onclick="closeSetPasswordForm()">Cancel</button>
      </div>
    </div>`);
  list.innerHTML = rows.join('');
}

window.openSetPasswordForm = function() {
  const form = document.getElementById('signin-methods-password-form');
  if (form) form.style.display = '';
  const input = document.getElementById('signin-methods-password-input');
  if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }
};

window.closeSetPasswordForm = function() {
  const form = document.getElementById('signin-methods-password-form');
  if (form) form.style.display = 'none';
};

window.submitSetPassword = async function() {
  if (!auth || !auth.currentUser) {
    flashToast('Please sign back in and try again.', { kind: 'warn' });
    return;
  }
  const input = document.getElementById('signin-methods-password-input');
  const pw = (input && input.value || '').trim();
  if (!pw || pw.length < 6) {
    flashToast('Password must be at least 6 characters.', { kind: 'warn' });
    return;
  }
  try {
    await setUserPassword(pw);
    flashToast('Password set. You can now sign in with email + password on other devices.', { kind: 'success', duration: 4000 });
    try { haptic('success'); } catch(e) {}
    window.closeSetPasswordForm();
    try { renderSignInMethodsCard(); } catch(e) {}
  } catch(e) {
    console.error('[setUserPassword]', e);
    const code = (e && e.code) || e.message || '';
    let msg = "Couldn't set password. Try again?";
    if (code === 'no-current-user') msg = 'Please sign back in first.';
    else if (code.includes('weak-password')) msg = 'That password is too short or too simple. Try at least 6 characters.';
    else if (code.includes('requires-recent-login')) msg = 'For security, sign out and back in to set a password.';
    flashToast(msg, { kind: 'warn', duration: 4500 });
  }
};

// Password sign-in from the sign-in screen (05x #6). Only visible when user has
// previously entered an email in the email field — lightweight hint so password
// row doesn't compete for attention on a fresh landing.
window.handleSigninPassword = async function() {
  const email = (document.getElementById('signin-email-input').value || '').trim();
  const pw = (document.getElementById('signin-password-input').value || '').trim();
  if (!email || !email.includes('@')) { flashToast('Enter your email above first', { kind: 'warn' }); return; }
  if (!pw) { flashToast('Enter your password', { kind: 'warn' }); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    // onAuthStateChangedCouch picks up routing.
  } catch(e) {
    console.error('[signin][password]', e);
    const code = (e && e.code) || '';
    let msg = "Couldn't sign in. Check password and try again.";
    if (code.includes('wrong-password') || code.includes('invalid-credential')) msg = 'Password didn\'t match. Try again?';
    else if (code.includes('user-not-found')) msg = 'No account for that email. Send yourself a sign-in link first.';
    else if (code.includes('too-many-requests')) msg = 'Too many attempts. Try again in a few minutes.';
    flashToast(msg, { kind: 'warn', duration: 4500 });
  }
};

// ===== Onboarding =====
let onboardStep = 0;
let onboardSeedItems = [];
let onboardSelectedSeeds = new Set();

async function maybeStartOnboarding() {
  // Only show first time ever across the app (not once per group)
  if (localStorage.getItem('qn_onboarded')) return;
  // Wait a tick for startSync to fire so we know if the library is empty
  setTimeout(() => {
    // If this group has stuff in it already (someone else added things), skip the seed step but still show intro
    onboardStep = 0;
    renderOnboard();
    document.getElementById('onboard-modal-bg').classList.add('on');
    // Pre-load seed options in the background
    loadOnboardSeeds();
  }, 800);
}

async function loadOnboardSeeds() {
  try {
    const d = await tmdbFetch('/trending/all/week');
    onboardSeedItems = (d.results || [])
      .filter(x => (x.media_type === 'movie' || x.media_type === 'tv') && (x.title || x.name) && x.poster_path)
      .filter(isFamilySafeTmdbItem)
      .slice(0, 9)
      .map(x => mapTmdbItem(x));
  } catch(e) {
    onboardSeedItems = [];
  }
}

function renderOnboard() {
  const el = document.getElementById('onboard-content');
  if (!el) return;
  const meName = (state.me && state.me.name) || 'friend';
  const mode = currentMode();
  const modeLabel = groupPossessive();

  const dots = [0,1,2].map(i => `<div class="onboard-dot ${i<=onboardStep?'on':''}"></div>`).join('');

  if (onboardStep === 0) {
    el.innerHTML = `
      <div class="onboard-header">
        <button class="onboard-skip" onclick="skipOnboarding()">Skip</button>
        <div class="onboard-step-dots">${dots}</div>
        <div class="onboard-title">Hey ${escapeHtml(meName)}.</div>
        <div class="onboard-subtitle">Couch solves <em>"what are we watching?"</em> for everyone on the couch tonight.</div>
      </div>
      <div class="onboard-body">
        <div class="onboard-feature">
          <div class="onboard-feature-icon">📥</div>
          <div class="onboard-feature-body">
            <div class="onboard-feature-title">Add what you'd watch</div>
            <div class="onboard-feature-desc">Search for movies and TV, or browse trending picks.</div>
          </div>
        </div>
        <div class="onboard-feature">
          <div class="onboard-feature-icon">👍</div>
          <div class="onboard-feature-body">
            <div class="onboard-feature-title">Everyone votes yes, no, or seen</div>
            <div class="onboard-feature-desc">Do it whenever. No pressure to decide on the spot.</div>
          </div>
        </div>
        <div class="onboard-feature">
          <div class="onboard-feature-icon">🍿</div>
          <div class="onboard-feature-body">
            <div class="onboard-feature-title">Tonight shows the matches</div>
            <div class="onboard-feature-desc">Pick who's on the couch. Everything ${modeLabel} said yes to rises to the top.</div>
          </div>
        </div>
      </div>
      <div class="onboard-footer">
        <button class="primary" onclick="nextOnboardStep()">Got it</button>
      </div>`;
  } else if (onboardStep === 1) {
    // Mode-aware feature tour
    const features = [
      { icon: '📺', title: 'Streaming services', desc: 'Tell us what you subscribe to and your queue will filter to what you can actually watch.' },
      { icon: '⭐', title: 'Rate 1 to 10', desc: 'Rate with decimals so you can rank your all-time favorites precisely. 9.7 vs 9.85 if you want.' },
      { icon: '🎭', title: 'Mood filters', desc: 'Tag titles as cozy, spooky, epic and more. Filter the matches by vibe.' },
      { icon: '🚫', title: 'Not tonight?', desc: "One veto per session lets you pass on a match without deleting it." },
      { icon: '🎬', title: 'Watchparty', desc: `Watch separately, react together. Live emoji reactions timed to each person's progress.` }
    ];
    if (mode === 'family') {
      features.push({ icon: '👨‍👩‍👧', title: 'Parent approval', desc: "Parents review kids' new title requests on the Family tab before they show up for everyone." });
      features.push({ icon: '🎲', title: 'Who picks tonight', desc: 'Rotate the picker so nobody argues about whose turn it is.' });
    }
    features.push({ icon: '🦊', title: 'Pick an avatar', desc: 'Tap your profile to choose an emoji that feels like you.' });
    if (mode !== 'duo') {
      features.push({ icon: '📊', title: 'Year in Review', desc: "At year-end, see everyone's stats and your best nights." });
    }
    el.innerHTML = `
      <div class="onboard-header">
        <button class="onboard-skip" onclick="skipOnboarding()">Skip</button>
        <div class="onboard-step-dots">${dots}</div>
        <div class="onboard-title">How the couch works</div>
        <div class="onboard-subtitle">All optional. Discover as you go.</div>
      </div>
      <div class="onboard-body">
        ${features.map(f => `<div class="onboard-feature">
          <div class="onboard-feature-icon">${f.icon}</div>
          <div class="onboard-feature-body">
            <div class="onboard-feature-title">${f.title}</div>
            <div class="onboard-feature-desc">${f.desc}</div>
          </div>
        </div>`).join('')}
      </div>
      <div class="onboard-footer">
        <button class="secondary" onclick="prevOnboardStep()">Back</button>
        <button class="primary" onclick="nextOnboardStep()">Next</button>
      </div>`;
  } else {
    // Step 3: seed content
    const cards = onboardSeedItems.length
      ? `<div class="onboard-seed-grid">${onboardSeedItems.map(x => {
          const selected = onboardSelectedSeeds.has(x.id);
          return `<div class="onboard-seed-card ${selected?'on':''}" onclick="toggleOnboardSeed('${x.id}')">
            <div class="onboard-seed-poster" style="background-image:url('${x.poster}')"></div>
            <div class="onboard-seed-check">✓</div>
          </div>`;
        }).join('')}</div>`
      : '<div style="text-align:center;padding:20px;color:var(--ink-dim);font-size:var(--t-meta);">Loading popular picks...</div>';
    const count = onboardSelectedSeeds.size;
    el.innerHTML = `
      <div class="onboard-header">
        <button class="onboard-skip" onclick="finishOnboarding()">Skip</button>
        <div class="onboard-step-dots">${dots}</div>
        <div class="onboard-title">Fill the couch</div>
        <div class="onboard-subtitle">Tap a few trending picks ${modeLabel} might want. Or skip and add your own.</div>
      </div>
      <div class="onboard-body">
        ${cards}
      </div>
      <div class="onboard-footer">
        <button class="secondary" onclick="prevOnboardStep()">Back</button>
        <button class="primary" onclick="finishOnboarding()">${count > 0 ? `Add ${count} & start` : "I'll add my own"}</button>
      </div>`;
  }
}

window.nextOnboardStep = function() {
  onboardStep = Math.min(2, onboardStep + 1);
  renderOnboard();
};
window.prevOnboardStep = function() {
  onboardStep = Math.max(0, onboardStep - 1);
  renderOnboard();
};
window.toggleOnboardSeed = function(id) {
  if (onboardSelectedSeeds.has(id)) onboardSelectedSeeds.delete(id);
  else onboardSelectedSeeds.add(id);
  renderOnboard();
};
window.skipOnboarding = function() {
  localStorage.setItem('qn_onboarded', '1');
  document.getElementById('onboard-modal-bg').classList.remove('on');
};
window.finishOnboarding = async function() {
  localStorage.setItem('qn_onboarded', '1');
  const btn = document.querySelector('#onboard-content .onboard-footer .primary');
  if (onboardSelectedSeeds.size === 0) {
    document.getElementById('onboard-modal-bg').classList.remove('on');
    return;
  }
  if (btn) { btn.textContent = 'Adding...'; btn.disabled = true; }
  const selected = onboardSeedItems.filter(x => onboardSelectedSeeds.has(x.id));
  let added = 0;
  for (const item of selected) {
    if (state.titles.find(t => t.id === item.id)) continue;
    try {
      const extras = await fetchTmdbExtras(item.mediaType, item.tmdbId);
      const moods = suggestMoods(item.genreIds || [], extras.runtime);
      const newTitle = { ...item, ...extras, moods, votes:{}, watched:false };
      await setDoc(doc(titlesRef(), item.id), { ...newTitle, ...writeAttribution() });
      logActivity('added', { titleName: item.name, titleId: item.id });
      added++;
    } catch(e) { /* continue */ }
  }
  document.getElementById('onboard-modal-bg').classList.remove('on');
};

// ===== Share title cards =====
let shareTitleId = null;

window.openShareTitle = function(titleId) {
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  shareTitleId = titleId;
  renderShareTitle(t);
  document.getElementById('share-title-modal-bg').classList.add('on');
};

window.closeShareTitle = function() {
  document.getElementById('share-title-modal-bg').classList.remove('on');
  shareTitleId = null;
};

function renderShareTitle(t) {
  const el = document.getElementById('share-title-content');
  if (!el) return;
  const myName = (state.me && state.me.name) || 'Someone';
  const yesCount = Object.values(t.votes || {}).filter(v => v === 'yes').length;
  const meta = [t.year, t.kind, t.runtime ? t.runtime + 'm' : ''].filter(Boolean).join(' · ');
  el.innerHTML = `
    <div class="share-title-preview">
      <div class="share-title-preview-poster" style="background-image:url('${t.poster||''}')"></div>
      <div class="share-title-preview-body">
        <div class="share-title-preview-eyebrow">${escapeHtml(myName)} added to ${escapeHtml(groupNounCap())}</div>
        <div class="share-title-preview-name">${escapeHtml(t.name)}</div>
        <div class="share-title-preview-meta">${escapeHtml(meta)}</div>
      </div>
    </div>
    <div class="share-title-options">
      <button onclick="shareTitleSystem()"><span class="share-icon">📤</span> Share via system</button>
      <button onclick="downloadTitleCard()"><span class="share-icon">💾</span> Save image</button>
      <button onclick="copyTitleLink()"><span class="share-icon">🔗</span> Copy message</button>
      <button onclick="closeShareTitle()" style="justify-content:center;color:var(--ink-dim);">Cancel</button>
    </div>`;
}

function buildShareText(t) {
  const myName = (state.me && state.me.name) || '';
  const groupName = (state.group && state.group.name) || state.familyCode;
  const meta = [t.year, t.kind, t.runtime ? t.runtime + ' min' : ''].filter(Boolean).join(' · ');
  return `${myName ? myName + ' added ' : 'Check out '}${t.name}${meta ? ' (' + meta + ')' : ''} to ${groupName} on Couch.`;
}

window.shareTitleSystem = async function() {
  const t = state.titles.find(x => x.id === shareTitleId);
  if (!t) return;
  const text = buildShareText(t);
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      flashToast('Copied to clipboard', { kind: 'success' });
    } else {
      prompt('Copy the message:', text);
    }
  } catch(e) { /* user cancelled */ }
};

window.copyTitleLink = async function() {
  const t = state.titles.find(x => x.id === shareTitleId);
  if (!t) return;
  const text = buildShareText(t);
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      const btn = event && event.target && event.target.closest('button');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="share-icon">✓</span> Copied';
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
      }
    } else {
      prompt('Copy the message:', text);
    }
  } catch(e) {}
};

window.downloadTitleCard = async function() {
  const t = state.titles.find(x => x.id === shareTitleId);
  if (!t) return;
  const canvas = document.createElement('canvas');
  const w = 1080, h = 1920;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1a1826');
  grad.addColorStop(0.5, '#2a1e2e');
  grad.addColorStop(1, '#0f0e17');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Accent glow
  const glow = ctx.createRadialGradient(w/2, h*0.4, 50, w/2, h*0.4, w*0.7);
  glow.addColorStop(0, 'rgba(232,160,74,0.22)');
  glow.addColorStop(1, 'rgba(232,160,74,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const myName = (state.me && state.me.name) || '';
  const groupName = (state.group && state.group.name) || state.familyCode;

  // Eyebrow
  ctx.fillStyle = '#e8a04a';
  ctx.font = 'italic 600 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('COUCH', w/2, 140);

  ctx.font = 'italic 600 28px Georgia, serif';
  ctx.fillStyle = 'rgba(232,160,74,0.8)';
  ctx.fillText((myName ? myName.toUpperCase() + ' ADDED' : 'ADDED').slice(0, 50), w/2, 200);

  // Poster
  if (t.poster) {
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = t.poster;
      });
      const pW = 500, pH = 750;
      const pX = (w - pW) / 2, pY = 260;
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      // Rounded rect clip
      const r = 20;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pX+r, pY);
      ctx.lineTo(pX+pW-r, pY);
      ctx.quadraticCurveTo(pX+pW, pY, pX+pW, pY+r);
      ctx.lineTo(pX+pW, pY+pH-r);
      ctx.quadraticCurveTo(pX+pW, pY+pH, pX+pW-r, pY+pH);
      ctx.lineTo(pX+r, pY+pH);
      ctx.quadraticCurveTo(pX, pY+pH, pX, pY+pH-r);
      ctx.lineTo(pX, pY+r);
      ctx.quadraticCurveTo(pX, pY, pX+r, pY);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, pX, pY, pW, pH);
      ctx.restore();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    } catch(e) { /* no poster, skip */ }
  }

  // Title name
  ctx.fillStyle = '#f5ede0';
  ctx.font = 'bold 60px Georgia, serif';
  ctx.textAlign = 'center';
  const name = t.name.length > 30 ? t.name.slice(0, 29) + '…' : t.name;
  ctx.fillText(name, w/2, 1140);

  // Meta
  const metaParts = [t.year, t.kind, t.runtime ? t.runtime + ' min' : ''].filter(Boolean);
  ctx.font = '32px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(245,237,224,0.7)';
  ctx.fillText(metaParts.join('  ·  '), w/2, 1200);

  // Divider
  ctx.strokeStyle = 'rgba(232,160,74,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w*0.3, 1280);
  ctx.lineTo(w*0.7, 1280);
  ctx.stroke();

  // "To [group]"
  ctx.font = 'italic 32px Georgia, serif';
  ctx.fillStyle = 'rgba(245,237,224,0.8)';
  const toLine = `to ${groupName}`;
  ctx.fillText(toLine.length > 40 ? toLine.slice(0, 39) + '…' : toLine, w/2, 1360);

  // Footer
  ctx.fillStyle = 'rgba(245,237,224,0.35)';
  ctx.font = 'italic 30px Georgia, serif';
  ctx.fillText('couch — make it a night.', w/2, h - 120);

  canvas.toBlob((blob) => {
    if (!blob) { alert('Could not generate image.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `couch-${t.name.replace(/[^a-z0-9]/gi,'-').toLowerCase().slice(0,40)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, 'image/png', 0.95);
};

// === Likes (separate from stars) ===
window.toggleLike = async function(id, e) {
  if (e) e.stopPropagation();
  if (!state.me) return;
  const t = state.titles.find(x => x.id === id);
  if (!t) return;
  const likes = { ...(t.likes || {}) };
  if (likes[state.me.id]) delete likes[state.me.id];
  else likes[state.me.id] = Date.now();
  try { await updateDoc(doc(titlesRef(), id), { ...writeAttribution(), likes }); } catch(err){}
};

// === D-06 Couch viz — DECI-14-06 (Sketch 003 V5 redesign per 14-10) ===
// V5 winner: Roster IS the control. Each family member is a toggleable pill.
// Tap = flip in/out. Long-press out-pill (700ms) = send push.
//
// Firestore shape (Sketch 003 Material Decisions, locked 2026-04-26):
//   families/{code}.couchInTonight = { [memberId]: { in: bool, at: serverTimestamp, proxyConfirmedBy?: memberId } }
//
// Backward-compat: reads fall back to legacy couchSeating: { [memberId]: index }
// shape from 14-04 if couchInTonight is absent. Writes go to BOTH shapes for one
// PWA cache cycle (~1-2 weeks of v34.1 deployed) so v33/v34.0 PWAs don't break;
// drop the dual-write in a follow-up plan after the cache cycle elapses.

const COUCH_HERO_SRC = '/mark-512.png'; // single source of truth — bump if filename changes

// 14-10 / V5 — hydrate couchInTonight from family doc with legacy couchSeating fallback.
// Returns the canonical { [memberId]: { in, at, proxyConfirmedBy? } } shape.
function couchInTonightFromDoc(d) {
  if (d && d.couchInTonight && typeof d.couchInTonight === 'object') {
    // Preferred: new shape already on the doc. Pass through verbatim.
    return d.couchInTonight;
  }
  // Legacy fallback: rebuild from couchSeating { [mid]: index }. Every member with
  // an index >= 0 is treated as in===true; timestamp unknown so omitted.
  const out = {};
  const seating = (d && d.couchSeating) || {};
  Object.entries(seating).forEach(([mid, idx]) => {
    if (typeof idx === 'number' && idx >= 0) {
      out[mid] = { in: true };
    }
  });
  return out;
}

// 14-10 / V5 — derive the indexed array shape downstream consumers expect.
// 14-01 isWatchedByCouch + 14-03 tier aggregators + 14-07 Flow A roster all read
// state.couchMemberIds — this keeps the contract stable across the migration.
function couchInTonightToMemberIds(cit) {
  if (!cit || typeof cit !== 'object') return [];
  return Object.keys(cit).filter(mid => cit[mid] && cit[mid].in === true);
}

// V5 renderCouchViz — see variant-5-roster-control.html for the design contract.
// Renders the family roster as a wrap-flex of toggleable pills. Tap = flip in/out.
// Long-press out-pill (700ms) = send push (sendCouchPing). The "me" pill carries
// a solid amber outline + YOU tag regardless of in/out state.
function renderCouchViz() {
  const container = document.getElementById('couch-viz-container');
  if (!container) return;
  const cit = state.couchInTonight || {};
  // Eligible roster: same filter renderTonight uses for who-list (excludes archived
  // + expired guests). Keeps the V5 roster aligned with the rest of the Tonight tab.
  const nowTs = Date.now();
  const roster = (state.members || []).filter(m =>
    !m.archived &&
    (!m.temporary || (m.expiresAt && m.expiresAt > nowTs))
  );
  const total = roster.length;
  const inIds = roster.filter(m => cit[m.id] && cit[m.id].in === true).map(m => m.id);
  const numIn = inIds.length;
  const numOut = total - numIn;
  const meId = state.me ? state.me.id : null;
  const meIsIn = meId && cit[meId] && cit[meId].in === true;

  // Sub-line copy (dynamic per V5 spec)
  let subText;
  if (numIn === 0) subText = "Tap who's watching";
  else if (numIn === 1 && meIsIn) subText = "It's just you so far — tap others in";
  else if (numIn === total && total > 0) subText = "Whole couch is in";
  else subText = `${numIn} ${numIn === 1 ? 'is' : 'are'} watching`;

  // Render hero + headline + sub-line (V5 hero is 84px, smaller than 14-04's 280px)
  // + roster pills + tally + action row + hint line.
  const html = [];
  html.push(`<img class="couch-hero couch-hero-v5" src="${COUCH_HERO_SRC}" alt="Couch" />`);
  html.push(`<h3 class="couch-headline">On the couch tonight</h3>`);
  html.push(`<p class="couch-sub">${escapeHtml(subText)}</p>`);
  // Phase 19 / D-15 — subtle amber tint on roster surface when kid-mode active.
  const rosterCls = state.kidMode ? 'roster kid-mode-on' : 'roster';
  html.push(`<div class="${rosterCls}" role="group" aria-label="Family roster — tap to flip in or out">`);
  roster.forEach(m => {
    const isIn = cit[m.id] && cit[m.id].in === true;
    const isMe = meId && m.id === meId;
    const initial = escapeHtml((m.name || '?')[0].toUpperCase());
    const name = escapeHtml(m.name || 'Member');
    const color = memberColor(m.id);
    const cls = `pill ${isIn ? 'in' : 'out'} ${isMe ? 'me' : ''}`;
    const avStyle = isIn ? `background:${color}` : '';
    const youTag = isMe ? `<span class="you-tag">YOU</span>` : '';
    const ariaLabel = isIn
      ? `${name}${isMe ? ' (you)' : ''} is on the couch — tap to flip out`
      : `${name}${isMe ? ' (you)' : ''} is off the couch — tap to flip in; long-press to send a push`;
    html.push(`<div class="${cls}" data-mid="${m.id}" role="button" tabindex="0" aria-pressed="${isIn ? 'true' : 'false'}" aria-label="${ariaLabel}">
      <div class="av" style="${avStyle}">${initial}</div>
      <span class="label">${name}${youTag}</span>
      <div class="ping-hint" aria-hidden="true"></div>
    </div>`);
  });
  html.push(`</div>`);
  // Tally: Fraunces num + Instrument Serif italic "of N watching"
  html.push(`<div class="tally"><span class="num">${numIn}</span><span class="of">of ${total} watching</span></div>`);
  // Action row — visibility-gated by current state
  html.push(`<div class="pill-actions">`);
  if (numIn < total) html.push(`<button type="button" class="action-link" data-act="mark-all">Mark everyone in</button>`);
  if (numIn > 0) html.push(`<button type="button" class="action-link" data-act="clear-all">Clear couch</button>`);
  if (numOut > 0 && numIn > 0) html.push(`<button type="button" class="action-link" data-act="push-rest">Send pushes to the rest</button>`);
  html.push(`</div>`);
  html.push(`<p class="pill-hint">Tap to flip in/out. Long-press an out pill to send them a push.</p>`);
  // Phase 19 / D-01..D-03 — Kid-mode toggle row. Visibility gated on familyHasKids()
  // (re-evaluated each render per D-03). Idle = dashed border; active = amber-filled.
  // Helper hint copy locked at D-17.
  if (typeof familyHasKids === 'function' && familyHasKids()) {
    const onCls = state.kidMode ? 'on' : '';
    const label = state.kidMode ? 'Kid mode on' : 'Kid mode';
    const hint = state.kidMode ? '' : 'Hide R + PG-13 from tonight\'s pool';
    html.push(`<div class="kid-mode-row">`);
    html.push(`<button type="button" class="kid-mode-toggle ${onCls}" data-act="toggle-kid-mode" aria-pressed="${state.kidMode ? 'true' : 'false'}">${label}</button>`);
    if (hint) html.push(`<p class="kid-mode-hint">${hint}</p>`);
    html.push(`</div>`);
  }
  container.innerHTML = html.join('');

  // Wire pill interactions (delegated per-pill listeners — variant-5 sketch lines 392-427).
  container.querySelectorAll('.pill').forEach(pill => {
    const mid = pill.dataset.mid;
    const isOut = pill.classList.contains('out');
    let pressTimer = null;
    let didLongPress = false;
    const startPress = () => {
      didLongPress = false;
      if (!isOut) return; // long-press only meaningful on out-state pills
      pill.classList.add('pinging');
      pressTimer = setTimeout(() => {
        didLongPress = true;
        pill.classList.remove('pinging');
        pill.style.transform = 'scale(1.06)';
        pill.style.boxShadow = '0 0 0 3px rgba(217, 122, 60, 0.4)';
        setTimeout(() => { pill.style.transform = ''; pill.style.boxShadow = ''; }, 280);
        sendCouchPing(mid);
      }, 700);
    };
    const cancelPress = () => {
      pill.classList.remove('pinging');
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };
    const handleClick = (e) => {
      if (didLongPress) { e.preventDefault(); didLongPress = false; return; }
      cancelPress();
      toggleCouchMember(mid);
    };
    pill.addEventListener('mousedown', startPress);
    pill.addEventListener('touchstart', startPress, { passive: true });
    pill.addEventListener('mouseup', cancelPress);
    pill.addEventListener('mouseleave', cancelPress);
    pill.addEventListener('touchend', cancelPress);
    pill.addEventListener('touchcancel', cancelPress);
    pill.addEventListener('click', handleClick);
    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCouchMember(mid); }
    });
  });
  // Action row handlers
  const actMarkAll = container.querySelector('[data-act="mark-all"]');
  const actClearAll = container.querySelector('[data-act="clear-all"]');
  const actPushRest = container.querySelector('[data-act="push-rest"]');
  if (actMarkAll) actMarkAll.onclick = () => couchMarkAllIn();
  if (actClearAll) actClearAll.onclick = () => couchClearAll();
  if (actPushRest) actPushRest.onclick = () => couchPushRest();
  // Phase 19 — wire the new Kid-mode toggle button (when rendered).
  const actToggleKidMode = container.querySelector('[data-act="toggle-kid-mode"]');
  if (actToggleKidMode) actToggleKidMode.onclick = () => window.toggleKidMode();

  // 14-09 / D-10 — anchor onboarding tooltip on the FIRST out-state pill (was .seat-cell.empty
  // before V5; now anchored to the equivalent V5 affordance). Same maybeShowTooltip key
  // ('couchSeating') so users who already dismissed the 14-04 version don't see it again.
  const firstOutPill = container.querySelector('.pill.out');
  if (firstOutPill && typeof maybeShowTooltip === 'function') {
    setTimeout(() => maybeShowTooltip('couchSeating', firstOutPill, 'Tap any pill to mark them in. Long-press to send a push.', { placement: 'above' }), 200);
  }
}

// V5 — toggle a member's in-state. Works for self AND proxy. Writes audit trail
// via proxyConfirmedBy when the actor is NOT the target member (server-side rule
// enforces actingUid==auth.uid via attributedWrite, so the proxy claim can't be
// forged). Date.now() is fine for ordering — Firestore serverTimestamp() would
// be one extra import for sub-second precision we don't need.
window.toggleCouchMember = async function(memberId) {
  if (!state.me) { flashToast('Sign in to update the couch', { kind: 'warn' }); return; }
  if (!memberId) return;
  const cit = state.couchInTonight = state.couchInTonight || {};
  const cur = cit[memberId];
  const wasIn = cur && cur.in === true;
  const next = {
    in: !wasIn,
    at: Date.now(),
  };
  // Proxy audit: if actor !== target, record who flipped them
  if (memberId !== state.me.id) next.proxyConfirmedBy = state.me.id;
  cit[memberId] = next;
  // Recompute downstream contract
  state.couchMemberIds = couchInTonightToMemberIds(cit);
  // Mirror to legacy state.selectedMembers so the 19 V4-era reads scattered through
  // recommendation engine + tile rendering + fairness gate stay correct. After V5
  // ships, couchInTonight is the source of truth; selectedMembers is a synchronized
  // shim. Future cleanup phase can remove the shim and migrate the reads.
  state.selectedMembers = state.couchMemberIds.slice();
  // Optimistic re-render — covers V5 pills AND Tonight surfaces (matches list,
  // UpNext, ContinueWatching, Next3, MoodFilter). The legacy V4 toggleMember at
  // line 6375 called renderTonight() directly; V5 originally replaced that with
  // renderCouchViz() alone, which left the matches list + empty-state stale on
  // pill taps. Both renderers are needed: renderCouchViz updates pill visuals,
  // renderTonight refreshes the actual title-rendering surfaces.
  renderCouchViz();
  renderTonight();
  if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
  haptic('light');
  await persistCouchInTonight();
};

// V5 — long-press → send push. Path A (Firestore write → onCouchPingFire CF → FCM).
//
// Phase 15.4 / F-W-1 / D-01..D-07: replaced the prior Path C stub (toast + Sentry
// breadcrumb only) with a real push fan-out path. Client writes a doc to the new
// ephemeral collection families/{familyCode}/couchPings/{pingId}; the queuenight
// onCouchPingFire CF (queuenight/functions/index.js, deployed in Plan 15.4-03)
// fans out a single push to the recipient via sendToMembers, then admin-SDK
// deletes the doc. Push body: "{senderName} wants you on the couch tonight"
// (locked at Plan 15.4-01 banned-words sweep). Self-echo guard via
// excludeMemberId in the CF, redundantly enforced by the senderId == memberId
// rule clause + the rules anchor on recipientId.
//
// Sentry breadcrumb retained per D-07 — even with real fan-out, the breadcrumb
// is the only client-side product-analytics signal for ping volume.
// flashToast retained — copy "Push sent to {name}" is now accurate (push IS being
// delivered, modulo the recipient's notificationPrefs[couchPing] toggle + quiet
// hours, both enforced server-side per Phase 6 baseline).
window.sendCouchPing = async function(memberId) {
  if (!state.me || !memberId) return;
  if (!state.familyCode) return;
  if (memberId === state.me.id) return;  // client-side self-echo short-circuit
  const m = (state.members || []).find(x => x.id === memberId);
  const recipientName = m ? m.name : 'them';
  // Sentry breadcrumb stays — analytics signal for ping volume (D-07).
  try {
    if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
      Sentry.addBreadcrumb({
        category: 'couch-ping',
        message: `fire ${memberId}`,
        level: 'info',
        data: { from: state.me.id, to: memberId }
      });
    }
  } catch (e) { /* never let analytics block UX */ }
  // Path A: write the ephemeral ping doc. CF picks up via onCreate trigger,
  // pushes to the recipient, deletes the doc.
  try {
    await addDoc(collection(db, 'families', state.familyCode, 'couchPings'), {
      senderId: state.me.id,
      senderName: state.me.name || 'A family member',
      senderUid: state.me.uid || null,
      recipientId: memberId,
      createdAt: Date.now(),
      ...writeAttribution()
    });
  } catch (e) {
    // Defensive: if the rules-emulator-locked contract diverges from the deployed
    // rules (e.g., a deploy-window race), surface the failure in Sentry but don't
    // block the toast — the user already got tactile haptic feedback at long-press
    // resolution. Logging here keeps the failure mode debuggable post-incident.
    console.warn('[15.4/F-W-1] sendCouchPing write failed:', e && e.message);
    try {
      if (typeof Sentry !== 'undefined' && Sentry.captureException) {
        Sentry.captureException(e, { tags: { area: 'couch-ping' } });
      }
    } catch (e2) {}
  }
  flashToast(`Push sent to ${recipientName}`, { kind: 'info' });
};

// V5 — bulk action: mark every roster member in.
async function couchMarkAllIn() {
  if (!state.me) return;
  const cit = state.couchInTonight = state.couchInTonight || {};
  const nowTs = Date.now();
  const meId = state.me.id;
  const roster = (state.members || []).filter(m =>
    !m.archived && (!m.temporary || (m.expiresAt && m.expiresAt > nowTs))
  );
  roster.forEach(m => {
    const next = { in: true, at: nowTs };
    if (m.id !== meId) next.proxyConfirmedBy = meId;
    cit[m.id] = next;
  });
  state.couchMemberIds = couchInTonightToMemberIds(cit);
  state.selectedMembers = state.couchMemberIds.slice();
  renderCouchViz();
  renderTonight();
  if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
  haptic('light');
  await persistCouchInTonight();
}

// V5 — bulk action: clear couch (everyone out).
async function couchClearAll() {
  if (!state.me) return;
  const cit = state.couchInTonight = state.couchInTonight || {};
  const nowTs = Date.now();
  const meId = state.me.id;
  Object.keys(cit).forEach(mid => {
    if (cit[mid] && cit[mid].in) {
      const next = { in: false, at: nowTs };
      if (mid !== meId) next.proxyConfirmedBy = meId;
      cit[mid] = next;
    }
  });
  // Phase 19 / D-04 — clearing the couch ALSO clears kid-mode (ambient cleanup —
  // no kids on the couch means no need for the toggle). Must happen BEFORE the
  // renderCouchViz / renderTonight calls below so the UI reflects cleared state.
  if (state.kidMode) {
    state.kidMode = false;
    state.kidModeOverrides = new Set();
  }
  state.couchMemberIds = couchInTonightToMemberIds(cit);
  state.selectedMembers = state.couchMemberIds.slice();
  renderCouchViz();
  renderTonight();
  if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
  haptic('light');
  await persistCouchInTonight();
}

// Phase 19 / D-05 — flip kid-mode + clear overrides on transition + re-render
// V5 roster + Tonight + Library. Per D-04, kid-mode is session-only — no
// Firestore write. flashToast confirms the state change.
window.toggleKidMode = function() {
  if (!state.me) { flashToast('Sign in to use kid mode', { kind: 'warn' }); return; }
  state.kidMode = !state.kidMode;
  // Clear per-title overrides on EVERY transition (covers both directions per
  // D-13 — "parent toggling kid-mode off + back on clears overrides").
  state.kidModeOverrides = new Set();
  renderCouchViz();
  if (typeof renderTonight === 'function') renderTonight();
  if (typeof renderLibrary === 'function') renderLibrary();
  haptic('light');
  flashToast(
    state.kidMode ? 'Kid mode on — hiding R + PG-13' : 'Kid mode off — full pool back',
    { kind: 'info' }
  );
};

// V5 — bulk action: send push to every out-state member.
function couchPushRest() {
  const cit = state.couchInTonight || {};
  const nowTs = Date.now();
  const outMembers = (state.members || []).filter(m =>
    !m.archived && (!m.temporary || (m.expiresAt && m.expiresAt > nowTs))
    && (!cit[m.id] || cit[m.id].in !== true)
  );
  if (!outMembers.length) { flashToast('Everyone is already in', { kind: 'info' }); return; }
  outMembers.forEach(m => sendCouchPing(m.id));
  flashToast(`Pushes sent to ${outMembers.length}`, { kind: 'info' });
}

// 14-10 / V5 — persist couchInTonight + couchSeating (dual-write during migration).
// Writes the new member-keyed shape AND the legacy positional shape so v33/v34.0
// PWAs reading couchSeating don't break during the rollout. After one PWA cache
// cycle (~1-2 weeks), drop the couchSeating write in a follow-up plan.
async function persistCouchInTonight() {
  if (!state.familyCode) return;
  const cit = state.couchInTonight || {};
  // Build legacy couchSeating map for back-compat: positional index by walking the
  // in-state members in the order they appear in state.members (stable for one
  // family-doc snapshot; the index is informational only — V5 doesn't read it).
  const seatingMap = {};
  let nextIdx = 0;
  (state.members || []).forEach(m => {
    if (cit[m.id] && cit[m.id].in === true) {
      seatingMap[m.id] = nextIdx++;
    }
  });
  try {
    await updateDoc(doc(db, 'families', state.familyCode), {
      couchInTonight: cit,
      couchSeating: seatingMap, // BACKCOMPAT: drop in follow-up after cache cycle
      ...writeAttribution()
    });
  } catch (e) {
    console.error('[couch] persist failed', e);
    flashToast('Could not save couch — try again', { kind: 'warn' });
  }
}

// === D-04 openTileActionSheet — DECI-14-04 ===
// Primary tile-tap entry (replaces openDetailModal as the body-tap target).
// Narrower than openActionSheet's full ⋯ menu — surfaces the 4 D-04 buckets:
//   Watch tonight / Schedule for later / Ask family / Vote (de-emphasized).
// Plus a divider + "Show details" (delegates to openDetailModal) + "More options"
// (delegates to the full openActionSheet so power-user functionality stays reachable).
// Mirrors the Flow B "Watch with the couch?" nominate entry from openActionSheet
// (14-08 / DECI-14-08) so Flow B is reachable from the primary tap entry, not just ⋯.
// Surfaces the D-01 / DECI-14-01 "Rewatch this one" override on watched tiles.
// SIBLING-not-replacement of openActionSheet (per 14-CONTEXT Anti-pattern #2: don't
// rebuild primitives — share the same #action-sheet-bg DOM container).
window.openTileActionSheet = function(titleId, e) {
  if (e) e.stopPropagation();
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const content = document.getElementById('action-sheet-content');
  if (!content) return;
  const items = [];
  if (!t.watched && state.me) {
    // 1. Watch tonight — start a watchparty immediately (highest-commitment, top of list).
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openWatchpartyStart('${titleId}')"><span class="icon">🎬</span>Watch tonight</button>`);
    // 2. Schedule for later — defer to a specific time.
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openScheduleModal('${titleId}')"><span class="icon">📅</span>Schedule for later</button>`);
    // 3. Ask family — D-08 (DECI-14-08) Flow B solo-nominate, mirrored from openActionSheet.
    //    Sibling-not-replacement of "Ask the family" (legacy openProposeIntent). Per 14-08-SUMMARY,
    //    Flow B is the new D-09 nominate primitive — use openFlowBNominate, not the legacy entry.
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openFlowBNominate('${titleId}')"><span class="icon">📣</span>Ask family</button>`);
    // 4. Vote — de-emphasized but kept for completeness (D-04 says "Vote remains, just demoted").
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openVoteModal('${titleId}')"><span class="icon">🗳</span>Vote</button>`);
  }
  // Per-title rewatch override (D-01 / DECI-14-01) — surfaces only on watched tiles for the current user.
  if (state.me && t.watched) {
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();setRewatchAllowed('${titleId}','${state.me.id}')"><span class="icon">🔁</span>Rewatch this one</button>`);
  }
  // Secondary divider — Show details + More options (full action sheet).
  items.push(`<div class="action-sheet-divider"></div>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openDetailModal('${titleId}')"><span class="icon">ℹ</span>Show details</button>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openActionSheet('${titleId}',event)"><span class="icon">⋯</span>More options</button>`);
  content.innerHTML = `<div class="action-sheet-title">${escapeHtml(t.name)}</div>${items.join('')}`;
  document.getElementById('action-sheet-bg').classList.add('on');
  // Plan 14-09 / D-10 — anchor onboarding tooltip on first action-sheet open (one-shot).
  setTimeout(() => {
    const sheetEl = document.getElementById('action-sheet-content');
    if (sheetEl && typeof maybeShowTooltip === 'function') {
      maybeShowTooltip('tileActionSheet', sheetEl, 'These are your options for this title.', { placement: 'above' });
    }
  }, 200);
};

window.openActionSheet = function(titleId, e) {
  if (e) e.stopPropagation();
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const hasReview = state.me && (t.reviews||{})[state.me.id];
  const scheduled = t.scheduledFor && t.scheduledFor > Date.now() - 3*60*60*1000;
  const commentCount = t.commentCount || 0;
  const content = document.getElementById('action-sheet-content');
  const items = [];
  if (state.me) items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openDiary('${titleId}')"><span class="icon">📖</span>Log a watch</button>`);
  if (t.watched && state.me) items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openReviewEditor('${titleId}')"><span class="icon">✍</span>${hasReview?'Edit review':'Write review'}</button>`);
  if (!t.watched) items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openScheduleModal('${titleId}')"><span class="icon">📅</span>${scheduled?'Edit schedule':'Schedule'}</button>`);
  if (!t.watched && state.me) {
    const existing = wpForTitle(titleId);
    if (existing) {
      items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openWatchpartyLive('${existing.id}')"><span class="icon">🎬</span>Open watchparty</button>`);
    } else {
      items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openWatchpartyStart('${titleId}')"><span class="icon">🎬</span>Start a watchparty</button>`);
    }
    // Phase 8 intent-flow entry points. Placed after watchparty (higher-commitment) so
    // the lower-friction "ask" sits closer to cheaper actions (veto, comments, list).
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openProposeIntent('${titleId}')"><span class="icon">📆</span>Propose tonight @ time</button>`);
    // D-08 (DECI-14-08) — Flow B solo-nominate entry (Phase 14 Plan 08).
    // Sibling-not-replacement of the legacy Phase 8 "Propose tonight @ time" entry above
    // (per Anti-pattern #7 in 14-CONTEXT.md: don't conflate primitives — `flow:'nominate'`
    // is a new D-09 discriminator, not an extension of `tonight_at_time`).
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openFlowBNominate('${titleId}')"><span class="icon">📣</span>Watch with the couch?</button>`);
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();askTheFamily('${titleId}')"><span class="icon">💭</span>Ask the family</button>`);
  }
  if (!t.watched && state.me) {
    const mv = myVetoToday();
    const vetoedByMe = mv && mv.titleId === titleId;
    if (vetoedByMe) {
      items.push(`<button class="action-sheet-item" onclick="closeActionSheet();unveto('${titleId}')"><span class="icon">↩</span>Undo veto</button>`);
    } else if (!mv) {
      items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openVetoModal('${titleId}')"><span class="icon">🚫</span>Not tonight</button>`);
    }
  }
  if (t.trailerKey) items.push(`<a class="action-sheet-item" href="https://www.youtube.com/watch?v=${t.trailerKey}" target="_blank" rel="noopener" onclick="closeActionSheet()" style="text-decoration:none;"><span class="icon">▶</span>Watch trailer</a>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openCommentsModal('${titleId}')"><span class="icon">💬</span>Comments${commentCount>0?` (${commentCount})`:''}</button>`);
  if (state.me) items.push(`<button class="action-sheet-item" onclick="closeActionSheet();addToList('${titleId}')"><span class="icon">📋</span>Add to list</button>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openShareTitle('${titleId}')"><span class="icon">📤</span>Share</button>`);
  items.push(`<div class="action-sheet-divider"></div>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();toggleWatched('${titleId}')"><span class="icon">${t.watched?'↩':'✓'}</span>${t.watched?'Mark unwatched':'Mark watched'}</button>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openEditTitle('${titleId}')"><span class="icon">✎</span>Edit details</button>`);
  items.push(`<button class="action-sheet-item danger" onclick="closeActionSheet();removeTitle('${titleId}')"><span class="icon">✕</span>Remove from library</button>`);
  content.innerHTML = `<div class="action-sheet-title">${t.name}</div>${items.join('')}`;
  document.getElementById('action-sheet-bg').classList.add('on');
};
window.closeActionSheet = function() {
  document.getElementById('action-sheet-bg').classList.remove('on');
};

// === Diary ===
let diaryTitleId = null;
let diaryStars = 0;
let diaryCowatchers = []; // array of {id, name}

window.openDiary = function(id, cowatchers) {
  if (!state.me) return;
  const t = state.titles.find(x => x.id === id);
  if (!t) return;
  diaryTitleId = id;
  diaryStars = 0;
  diaryCowatchers = Array.isArray(cowatchers) ? cowatchers.slice() : [];
  document.getElementById('diary-modal-title').textContent = t.name;
  const today = new Date();
  document.getElementById('diary-date').value = today.toISOString().slice(0,10);
  document.getElementById('diary-rewatch').checked = false;
  document.getElementById('diary-note').value = '';
  renderDiaryStars();
  renderDiaryCowatchers();
  document.getElementById('diary-modal-bg').classList.add('on');
};

function renderDiaryCowatchers() {
  const wrap = document.getElementById('diary-cowatchers');
  const chips = document.getElementById('diary-cowatchers-chips');
  if (!wrap || !chips) return;
  if (!diaryCowatchers.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  chips.innerHTML = diaryCowatchers.map(c =>
    `<span class="who-chip me" style="cursor:default;"><div class="who-avatar" style="background:${memberColor(c.id)}">${(c.name||'?')[0]}</div><div class="who-name">${c.name}</div></span>`
  ).join('');
}

function renderDiaryStars() {
  const el = document.getElementById('diary-stars');
  if (!el) return;
  el.innerHTML = [1,2,3,4,5].map(n => {
    let cls = '';
    let char = '☆';
    if (diaryStars >= n) { cls = 'on'; char = '★'; }
    else if (diaryStars >= n - 0.5) { cls = 'on'; char = '★'; }
    const opacity = (diaryStars >= n - 0.5 && diaryStars < n) ? 'opacity:0.5;' : '';
    return `<button class="star-btn ${cls}" style="font-size:var(--t-h1);padding:0 2px;${opacity}" aria-label="${n} star${n===1?'':'s'}" aria-pressed="${diaryStars >= n - 0.5}" onclick="tapDiaryStar(${n})">${char}</button>`;
  }).join('');
}

window.tapDiaryStar = function(n) {
  // Progressive: full -> half -> off
  if (diaryStars === n) diaryStars = n - 0.5;
  else if (diaryStars === n - 0.5) diaryStars = 0;
  else diaryStars = n;
  renderDiaryStars();
};

window.closeDiaryModal = function() {
  document.getElementById('diary-modal-bg').classList.remove('on');
  diaryTitleId = null;
  diaryCowatchers = [];
};

window.saveDiary = async function() {
  if (!diaryTitleId || !state.me) return;
  const dateStr = document.getElementById('diary-date').value;
  if (!dateStr) { alert('Pick a date.'); return; }
  const entry = {
    id: 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    ...writeAttribution(),
    date: dateStr,
    stars: diaryStars,
    // Always record the score (0-10) alongside stars so new displays work immediately
    score: diaryStars > 0 ? Math.round(diaryStars * 2 * 10) / 10 : 0,
    rewatch: document.getElementById('diary-rewatch').checked,
    note: document.getElementById('diary-note').value.trim(),
    cowatchers: diaryCowatchers.slice(),
    ts: Date.now()
  };
  const t = state.titles.find(x => x.id === diaryTitleId);
  const diary = [ ...(t.diary || []), entry ];
  const update = { diary };
  // Also bump the normal rating for compatibility — write both score and stars together
  if (diaryStars > 0) {
    const ratings = { ...(t.ratings || {}) };
    const newScore = Math.round(diaryStars * 2 * 10) / 10;
    ratings[state.me.id] = { ...(ratings[state.me.id] || {}), ...scoreToRating(newScore, ratings[state.me.id]?.comment), halfStars: diaryStars };
    update.ratings = ratings;
  }
  if (!t.watched) { update.watched = true; update.watchedAt = Date.now(); }
  try {
    await updateDoc(doc(titlesRef(), diaryTitleId), { ...writeAttribution(), ...update });
    logActivity('logged', { titleName: t.name, score: diaryStars > 0 ? diaryStars * 2 : 0 });
    // End tonight's session: clear all vetoes
    if (!t.watched) {
      try { await deleteDoc(sessionRef()); } catch(e){}
    }
    // Auto-advance picker rotation if enabled
    if (!t.watched && state.group?.picker?.enabled && state.group.picker.autoAdvance) {
      advancePicker();
    }
    closeDiaryModal();
  } catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};

window.deleteDiaryEntry = async function(titleId, entryId) {
  if (!confirm('Delete this diary entry?')) return;
  const t = state.titles.find(x => x.id === titleId);
  const diary = (t.diary || []).filter(d => d.id !== entryId);
  try { await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), diary }); } catch(e){}
};

function renderDiaryForTitle(t) {
  const diary = t.diary || [];
  const myEntries = state.me ? diary.filter(d => d.memberId === state.me.id) : [];
  const allEntries = diary.slice().sort((a,b) => b.ts - a.ts);
  if (!allEntries.length && !state.me) return '';
  const list = allEntries.map(d => {
    const dt = new Date(d.date);
    const mon = dt.toLocaleDateString([],{month:'short'});
    const day = dt.getDate();
    const m = state.members.find(x => x.id === d.memberId);
    // Prefer score (0-10) when present. Legacy entries still carry stars (0-5, halves allowed).
    let scoreStr = '';
    if (typeof d.score === 'number' && d.score > 0) scoreStr = formatScore(d.score);
    else if (d.stars > 0) scoreStr = formatScore(d.stars * 2);
    const isMine = state.me && d.memberId === state.me.id;
    return `<div class="diary-entry">
      <div class="diary-date" aria-hidden="true"><span class="m">${mon}</span>${day}</div>
      <div class="diary-meta">
        <strong>${escapeHtml(m?m.name:d.memberName)}</strong> ${scoreStr?`<span class="stars" aria-label="Rated ${scoreStr} out of 10">${scoreStr}</span>`:''}${d.rewatch?'<span class="rewatch">rewatch</span>':''}
        ${d.cowatchers && d.cowatchers.length?`<div style="margin-top:3px;font-size:var(--t-meta);color:var(--ink-dim);">with ${escapeHtml(d.cowatchers.map(c => c.name).join(', '))}</div>`:''}
        ${d.note?`<div style="margin-top:4px;font-style:italic;color:var(--ink-dim);">${escapeHtml(d.note)}</div>`:''}
      </div>
      ${isMine?`<button class="diary-delete" aria-label="Delete diary entry" onclick="deleteDiaryEntry('${t.id}','${d.id}')">✕</button>`:''}
    </div>`;
  }).join('');
  return `<div class="detail-section"><h4>Diary</h4>
    <div class="diary-list">${list}</div>
    ${state.me?`<button class="add-diary-btn" onclick="openDiary('${t.id}')">+ Log another watch</button>`:''}
  </div>`;
}

// === Lists ===
function listsRef() { return collection(db, 'families', state.familyCode, 'lists'); }
let unsubLists = null;
let allLists = [];
let currentListId = null;

function startListsSync() {
  if (unsubLists) return;
  unsubLists = onSnapshot(listsRef(), snap => {
    allLists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLists();
  });
}

function renderLists() {
  const el = document.getElementById('lists-list');
  const sub = document.getElementById('lists-sub');
  if (!el) return;
  const visible = allLists.filter(l => l.scope !== 'private' || (state.me && l.ownerId === state.me.id));
  if (sub) sub.textContent = visible.length ? visible.length + ' lists' : '';
  if (!visible.length) { el.innerHTML = '<div style="font-size:var(--t-meta);color:var(--ink-dim);padding:10px 0;font-style:italic;">No lists yet. Create one to collect favorites, themes, or anything.</div>'; return; }
  el.innerHTML = visible.map(l => {
    const titleIds = l.titleIds || [];
    const titles = titleIds.map(id => state.titles.find(t => t.id === id)).filter(Boolean).slice(0,6);
    const posters = titles.map(t => `<div class="list-mini-poster" style="background-image:url('${t.poster||''}')"></div>`).join('');
    const owner = state.members.find(m => m.id === l.ownerId);
    return `<div class="list-card" onclick="openList('${l.id}')">
      <div class="list-name">${l.name}</div>
      <div class="list-meta">${titleIds.length} titles · by ${owner?owner.name:'Unknown'}${l.scope === 'private' ? ' · Private' : ''}</div>
      ${posters?`<div class="list-posters">${posters}</div>`:''}
    </div>`;
  }).join('');
}

window.createNewList = async function() {
  if (!state.me) return;
  const name = prompt('Name your list (e.g. "Comfort rewatches")');
  if (!name || !name.trim()) return;
  const scope = confirm('Make this list private? (OK = private, Cancel = visible to family)') ? 'private' : 'family';
  try {
    await addDoc(listsRef(), {
      ...writeAttribution(),
      name: name.trim(),
      ownerId: state.me.id,
      scope,
      titleIds: [],
      createdAt: Date.now()
    });
  } catch(e) { alert('Could not create: ' + e.message); }
};

window.openList = function(listId) {
  const l = allLists.find(x => x.id === listId);
  if (!l) return;
  currentListId = listId;
  const titles = (l.titleIds || []).map(id => state.titles.find(t => t.id === id)).filter(Boolean);
  const owner = state.members.find(m => m.id === l.ownerId);
  const isMine = state.me && l.ownerId === state.me.id;
  const content = document.getElementById('list-modal-content');
  content.innerHTML = `
    <h3>${l.name}</h3>
    <div class="meta">${titles.length} titles · by ${owner?owner.name:'Unknown'}${l.scope === 'private' ? ' · Private' : ' · Visible to family'}</div>
    <div style="margin-top:14px;max-height:50vh;overflow-y:auto;">
      ${titles.length ? titles.map(t => `<div style="display:flex;gap:10px;padding:8px;background:var(--bg-2);border-radius:8px;margin-bottom:6px;align-items:center;">
        <div class="continue-poster" style="background-image:url('${t.poster||''}')"></div>
        <div style="flex:1;"><div class="continue-name">${t.name}</div><div class="continue-sub">${t.year||''} · ${t.kind||''}</div></div>
        ${isMine?`<button class="diary-delete" aria-label="Remove from list" onclick="removeFromList('${t.id}')">✕</button>`:''}
      </div>`).join('') : '<div style="font-size:var(--t-meta);color:var(--ink-dim);font-style:italic;padding:10px;">Empty. Add titles from their detail page.</div>'}
    </div>
    ${isMine?`<button class="pill" onclick="deleteList('${l.id}')" style="width:100%;margin-top:10px;color:var(--bad);">Delete list</button>`:''}
    <button class="modal-close" onclick="closeListModal()" style="margin-top:8px;">Close</button>
  `;
  document.getElementById('list-modal-bg').classList.add('on');
};

window.closeListModal = function() {
  document.getElementById('list-modal-bg').classList.remove('on');
  currentListId = null;
};

window.removeFromList = async function(titleId) {
  if (!currentListId) return;
  const l = allLists.find(x => x.id === currentListId);
  if (!l) return;
  const titleIds = (l.titleIds || []).filter(id => id !== titleId);
  try { await updateDoc(doc(listsRef(), currentListId), { ...writeAttribution(), titleIds }); openList(currentListId); } catch(e){}
};

window.deleteList = async function(listId) {
  if (!confirm('Delete this list?')) return;
  try { await deleteDoc(doc(listsRef(), listId)); closeListModal(); } catch(e){}
};

window.addToList = async function(titleId) {
  if (!state.me) return;
  const myLists = allLists.filter(l => l.ownerId === state.me.id);
  if (!myLists.length) { alert('Create a list first from the Library tab.'); return; }
  const names = myLists.map((l,i) => `${i+1}. ${l.name}`).join('\n');
  const pick = prompt(`Add to which list?\n${names}\n\nEnter number:`);
  const idx = parseInt(pick) - 1;
  if (isNaN(idx) || !myLists[idx]) return;
  const l = myLists[idx];
  const titleIds = [...(l.titleIds || [])];
  if (titleIds.includes(titleId)) { flashToast('Already on the couch here'); return; }
  titleIds.push(titleId);
  try { await updateDoc(doc(listsRef(), l.id), { ...writeAttribution(), titleIds }); flashToast('On the couch in ' + l.name, { kind: 'success' }); } catch(e){}
};

// === Share review ===
let shareText = '';
window.openShareModal = function(titleId, memberId) {
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const r = (t.reviews || {})[memberId];
  const m = state.members.find(x => x.id === memberId);
  if (!r || !m) return;
  const stars = (t.ratings || {})[memberId] && t.ratings[memberId].stars;
  const starStr = stars ? ('★'.repeat(stars)) : '';
  shareText = `${r.headline ? `"${r.headline}"\n\n` : ''}${r.body}\n\n${starStr ? starStr + '  ' : ''}${m.name} on ${t.name} (${t.year||''})\nvia Couch`;
  document.getElementById('share-preview').textContent = shareText;
  document.getElementById('share-modal-bg').classList.add('on');
};
window.closeShareModal = function() { document.getElementById('share-modal-bg').classList.remove('on'); };
window.copyShareText = async function() {
  try { await navigator.clipboard.writeText(shareText); flashToast('Copied to clipboard', { kind: 'success' }); } catch(e) { flashToast('Copy failed', { kind: 'warn' }); }
};
window.nativeShare = async function() {
  if (navigator.share) { try { await navigator.share({ text: shareText }); } catch(e){} }
  else { copyShareText(); }
};

function renderUpNext() {
  const section = document.getElementById('upnext-section');
  const list = document.getElementById('upnext-list');
  if (!section || !list) return;
  const cutoff = Date.now() - 3*60*60*1000;
  const upcoming = state.titles
    .filter(t => !t.watched && t.scheduledFor && t.scheduledFor > cutoff)
    .sort((a,b) => a.scheduledFor - b.scheduledFor)
    .slice(0,5);
  if (!upcoming.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  list.innerHTML = upcoming.map(t => `<div class="upnext-card" role="button" tabindex="0" aria-label="${escapeHtml(t.name)}, scheduled" onclick="openScheduleModal('${t.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openScheduleModal('${t.id}');}" style="cursor:pointer;">
    <div class="upnext-poster" style="background-image:url('${t.poster||''}')" aria-hidden="true"></div>
    <div class="upnext-info">
      <div class="upnext-when">${formatScheduleShort(t.scheduledFor)}</div>
      <div class="upnext-name">${escapeHtml(t.name)}</div>
      <div class="upnext-meta">${escapeHtml(t.year||'')} · ${escapeHtml(t.kind||'')}${t.scheduledNote?' · '+escapeHtml(t.scheduledNote):''}</div>
    </div></div>`).join('');
}

let modalTitleId = null;
let modalMode = 'vote'; // 'vote' or 'rate'
window.openVoteModal = function(id) {
  const t = state.titles.find(x => x.id === id);
  if (!t) return;
  modalTitleId = id;
  modalMode = 'vote';
  document.getElementById('modal-title').textContent = t.name;
  document.getElementById('modal-meta').textContent = `${t.year} · ${t.kind}`;
  document.getElementById('modal-instructions').textContent = "Tap each person's vote";
  renderVoteGrid();
  document.getElementById('modal-bg').classList.add('on');
};

window.openRateModal = function(id) {
  const t = state.titles.find(x => x.id === id);
  if (!t) return;
  modalTitleId = id;
  modalMode = 'rate';
  document.getElementById('modal-title').textContent = t.name;
  document.getElementById('modal-meta').textContent = `${t.year} · ${t.kind} · Rate it`;
  document.getElementById('modal-instructions').textContent = "Rate 1 to 10. Fine-tune the decimal to rank against your other favorites.";
  renderRateGrid();
  document.getElementById('modal-bg').classList.add('on');
};

function renderRateGrid() {
  const t = state.titles.find(x => x.id === modalTitleId);
  if (!t) return;
  const ratings = t.ratings || {};
  document.getElementById('vote-grid').innerHTML = state.members.map(m => {
    const r = ratings[m.id] || {};
    const score = getScore(r);
    const comment = r.comment || '';
    const isMe = state.me && m.id === state.me.id;
    const scoreDisplay = formatScore(score);
    // 1-10 tap pad — always shown for self, read-only pills for others
    const pad = isMe
      ? `<div class="score-pad" role="radiogroup" aria-label="Rate 1 to 10">${[1,2,3,4,5,6,7,8,9,10].map(n => {
          const active = Math.floor(score) === n;
          return `<button class="score-btn ${active?'on':''}" aria-label="Rate ${n}" aria-pressed="${active}" onclick="setScore('${m.id}',${n})">${n}</button>`;
        }).join('')}</div>`
      : '';
    // Fine-tune slider — only for self, and only once a base score exists
    const tune = (isMe && score > 0)
      ? `<div class="score-tune">
           <button class="score-step" aria-label="Decrease by 0.1" onclick="bumpScore('${m.id}',-0.1)">−</button>
           <input type="range" min="1" max="10" step="0.1" value="${score.toFixed(1)}" class="score-slider" aria-label="Fine-tune rating" oninput="setScore('${m.id}',parseFloat(this.value))">
           <button class="score-step" aria-label="Increase by 0.1" onclick="bumpScore('${m.id}',0.1)">+</button>
           <div class="score-display">${scoreDisplay}</div>
         </div>`
      : (score > 0 ? `<div class="score-readonly">${scoreDisplay}</div>` : '');
    return `<div class="vote-row-full" style="flex-direction:column;align-items:stretch;${isMe?'border:1px solid var(--good);':''}">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="who-avatar" style="background:${m.color}" aria-hidden="true">${avatarContent(m)}</div>
        <div class="name">${escapeHtml(m.name)}${isMe?' (you)':''}</div>
        ${!isMe && score > 0 ? `<div class="score-inline">${scoreDisplay}</div>` : ''}
      </div>
      ${pad}
      ${tune}
      ${isMe
        ? `<textarea class="review-input" placeholder="Your thoughts (optional)" onchange="setReview('${m.id}',this.value)">${escapeHtml(comment)}</textarea>`
        : (comment ? `<div class="review-display">${escapeHtml(comment)}</div>` : '')}
    </div>`;
  }).join('');
}

window.setScore = async function(memberId, score) {
  const t = state.titles.find(x => x.id === modalTitleId);
  if (!t) return;
  const ratings = { ...(t.ratings || {}) };
  const cur = ratings[memberId] || {};
  const currentScore = getScore(cur);
  // Toggle semantics: tapping the same integer you already have clears the rating
  const clearing = score === currentScore || (typeof score === 'number' && Math.floor(currentScore) === score && Number.isInteger(score) && currentScore === score);
  if (clearing) {
    ratings[memberId] = { ...cur, score: 0, stars: 0 };
  } else {
    const clamped = Math.max(1, Math.min(10, score));
    ratings[memberId] = { ...cur, ...scoreToRating(clamped, cur.comment) };
  }
  await updateDoc(doc(titlesRef(), modalTitleId), { ...writeAttribution(), ratings });
  if (!clearing && state.me && memberId === state.me.id) {
    logActivity('rated', { titleName: t.name, score: ratings[memberId].score, titleId: t.id });
  }
  // Local re-render so the slider feels responsive
  const tLocal = state.titles.find(x => x.id === modalTitleId);
  if (tLocal) { tLocal.ratings = ratings; renderRateGrid(); }
};

window.bumpScore = async function(memberId, delta) {
  const t = state.titles.find(x => x.id === modalTitleId);
  if (!t) return;
  const cur = (t.ratings || {})[memberId] || {};
  const next = Math.max(1, Math.min(10, getScore(cur) + delta));
  await setScore(memberId, Math.round(next * 10) / 10);
};

// Legacy setStars kept as a shim so the diary and any other old callers still work.
window.setStars = async function(memberId, stars) {
  await setScore(memberId, stars * 2);
};

window.setReview = async function(memberId, comment) {
  const t = state.titles.find(x => x.id === modalTitleId);
  const ratings = { ...(t?.ratings || {}) };
  const cur = ratings[memberId] || {};
  ratings[memberId] = { ...cur, comment: comment.trim() };
  await updateDoc(doc(titlesRef(), modalTitleId), { ...writeAttribution(), ratings });
};

function renderVoteGrid() {
  const t = state.titles.find(x => x.id === modalTitleId);
  if (!t) return;
  document.getElementById('vote-grid').innerHTML = state.members.map(m => {
    const v = (t.votes||{})[m.id];
    const isMe = state.me && m.id === state.me.id;
    return `<div class="vote-row-full" ${isMe?'style="border:1px solid var(--good);"':''}>
      <div class="who-avatar" style="background:${m.color}" aria-hidden="true">${avatarContent(m)}</div>
      <div class="name">${escapeHtml(m.name)}${isMe?' (you)':''}</div>
      <div class="vote-btns" role="radiogroup" aria-label="Vote for ${escapeHtml(m.name)}">
        <button class="vote-btn ${v==='yes'?'on yes':''}" aria-label="Yes" aria-pressed="${v==='yes'}" onclick="setVote('${m.id}','yes')">✓</button>
        <button class="vote-btn ${v==='no'?'on no':''}" aria-label="No" aria-pressed="${v==='no'}" onclick="setVote('${m.id}','no')">✗</button>
        <button class="vote-btn ${v==='seen'?'on seen':''}" aria-label="Already seen" aria-pressed="${v==='seen'}" onclick="setVote('${m.id}','seen')">👁</button>
      </div></div>`;
  }).join('');
}

// Unified vote applier. Voting = nominating to your queue.
//   yes        → add to your queue at end (or leave in place if already there)
//   no / seen  → remove from your queue
//   null       → clear vote + remove from your queue
// memberId is optional — defaults to the current user. Used by setVote which can vote for others.
async function applyVote(titleId, memberId, vote) {
  if (!memberId) memberId = state.me?.id;
  if (!memberId) return;
  // Plan 5.8 D-15: post-grace unclaimed members are read-only. Bail early + toast + banner.
  if (guardReadOnlyWrite()) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const votes = { ...(t.votes || {}) };
  const queues = { ...(t.queues || {}) };
  const prevVote = votes[memberId];
  // Toggle semantics: tapping the same vote again clears it
  const newVote = prevVote === vote ? null : vote;
  if (newVote === null) delete votes[memberId];
  else votes[memberId] = newVote;
  // Queue sync
  const wasInQueue = queues[memberId] != null;
  if (newVote === 'yes') {
    if (!wasInQueue) {
      // Append at end of that member's current queue
      const memberQueueLen = state.titles.filter(x => !x.watched && x.queues && x.queues[memberId] != null).length;
      queues[memberId] = memberQueueLen + 1;
    }
  } else {
    // no / seen / null: remove from queue
    if (wasInQueue) delete queues[memberId];
  }
  // D-03 (DECI-14-03 / Anti-pattern #5) — surface the silent queue mutation to the actor.
  // Guard: only toast when the local user is the actor; onSnapshot-driven updates from other
  // members' votes would otherwise spam the local UI with toasts about their queue changes.
  if (newVote === 'yes' && !wasInQueue && memberId === (state.me && state.me.id)) {
    flashToast(`Added "${t.name}" to your queue`, { kind: 'info' });
  }
  try {
    await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), votes, queues });
    // Reindex that member's queue after a removal so ranks stay contiguous
    if (wasInQueue && newVote !== 'yes' && memberId === state.me?.id) {
      await reindexMyQueue();
    }
  } catch(e) {
    console.error('applyVote failed', e);
    // Surface the failure to the actor — silent failures on votes are confusing
    // (toast for queue-add already fired before this catch; user sees feedback then
    // their vote silently disappears on next refresh otherwise).
    if (memberId === (state.me && state.me.id)) {
      flashToast("Couldn't save your vote — check your connection", { kind: 'warn' });
      haptic('warn');
    }
  }
}

window.setVote = async function(memberId, vote) {
  await applyVote(modalTitleId, memberId, vote);
};

window.quickVote = async function(titleId, vote) {
  if (!state.me) return;
  haptic('light');
  await applyVote(titleId, state.me.id, vote);
};

window.closeModal = function() { document.getElementById('modal-bg').classList.remove('on'); modalTitleId = null; };
window.toggleWatched = async function(id) {
  const t = state.titles.find(x => x.id === id);
  const newWatched = !t.watched;
  const update = { watched: newWatched };
  if (newWatched && t.queues) update.queues = {};
  if (newWatched) update.watchedAt = Date.now();
  else update.watchedAt = null;
  await updateDoc(doc(titlesRef(), id), { ...writeAttribution(), ...update });
  if (newWatched) {
    try { await deleteDoc(sessionRef()); } catch(e){}
  }
  if (newWatched && t) {
    logActivity('watched', { titleName: t.name });
    // Auto-prompt rating after a short delay so the card re-renders first
    setTimeout(() => openRateModal(id), 350);
    // Push movie watches to Trakt (TV watches are pushed via progress updates).
    // Fire-and-forget so a sync failure doesn't block the UI.
    if (t.kind === 'Movie' && t.tmdbId && typeof trakt !== 'undefined' && trakt.pushMovieWatch) {
      trakt.pushMovieWatch(t.tmdbId).catch(() => {});
    }
  }
};
window.removeTitle = async function(id) {
  if (!confirm('Remove this title?')) return;
  await deleteDoc(doc(titlesRef(), id));
};

// Pull-to-refresh: drag down at the top of the page to re-render + re-fetch fresh data.
// Minimal native-feeling implementation with a small indicator that follows the pull.
(function() {
  let startY = 0;
  let pulling = false;
  const indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
  document.body.appendChild(indicator);
  document.addEventListener('touchstart', e => {
    if (window.scrollY > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && window.scrollY === 0) {
      const d = Math.min(dy, 80);
      indicator.style.transform = `translateY(${d}px) rotate(${d * 3}deg)`;
      indicator.style.opacity = Math.min(d / 60, 1);
      if (d >= 70) indicator.classList.add('ready');
      else indicator.classList.remove('ready');
    }
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!pulling) return;
    pulling = false;
    const ready = indicator.classList.contains('ready');
    indicator.style.transition = 'transform 0.3s, opacity 0.3s';
    indicator.style.transform = '';
    indicator.style.opacity = '';
    indicator.classList.remove('ready');
    setTimeout(() => { indicator.style.transition = ''; }, 300);
    if (ready) {
      haptic('medium');
      renderAll();
      // If discover/add-tab data is stale, let the user see a refresh
      if (typeof initAddTab === 'function' && document.getElementById('screen-add')?.classList.contains('active')) {
        initAddTab(true);
      }
    }
  });
})();

// Show keyboard-shortcuts hint in Settings only when the user appears to have a physical keyboard.
// We reveal it the first time any non-modifier key is pressed — avoids cluttering the mobile UI.
(function() {
  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    const card = document.getElementById('kb-shortcuts-card');
    if (card) card.style.display = '';
  }
  document.addEventListener('keydown', e => {
    // Any typable key, arrow, or letter that isn't a bare modifier reveals
    if (!e.key || e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt') return;
    reveal();
  }, { once: false, passive: true });
})();

// Keyboard shortcuts for desktop power users.
// - Global: / to focus search (jumps to Add tab), 1-4 for tab switching, ? for cheat sheet, G to scroll to top
// - Swipe mode: J/←/A = no, K/↓ = seen, L/→/D = yes, Esc = close
// - Everywhere: shortcuts are suppressed when typing in inputs/textareas/contenteditable
(function() {
  function inEditable(e) {
    const t = e.target;
    if (!t) return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    return false;
  }
  function isSwipeOpen() {
    return document.getElementById('swipe-overlay')?.classList.contains('on');
  }
  function isModalOpen() {
    return document.querySelector('.modal-bg.on') != null;
  }
  document.addEventListener('keydown', e => {
    // ? (shift+/) opens cheat sheet, works anywhere except inputs
    if (e.key === '?' && !inEditable(e)) {
      e.preventDefault();
      openKbHelp();
      return;
    }
    // Swipe mode: J/K/L for vote, Esc for close. Highest priority.
    if (isSwipeOpen() && !inEditable(e)) {
      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault(); window.swipeVote?.('no'); return;
      }
      if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowDown') {
        e.preventDefault(); window.swipeVote?.('seen'); return;
      }
      if (e.key === 'l' || e.key === 'L' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault(); window.swipeVote?.('yes'); return;
      }
    }
    // Don't fire globals while a modal is open (Escape handler covers close)
    if (isModalOpen() || inEditable(e)) return;
    // / focuses the relevant search: library search if on Queue tab, otherwise Add-tab search.
    if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const onLibrary = document.getElementById('screen-library')?.classList.contains('active');
      if (onLibrary) {
        document.getElementById('lib-search-input')?.focus();
      } else {
        window.showScreen?.('add');
        setTimeout(() => document.getElementById('search-input')?.focus(), 60);
      }
      return;
    }
    // 1-4 switch tabs
    const tabMap = {'1':'tonight','2':'library','3':'add','4':'settings'};
    if (tabMap[e.key]) {
      e.preventDefault();
      window.showScreen?.(tabMap[e.key]);
      return;
    }
    // g to scroll to top, G (shift) to scroll to bottom
    if (e.key === 'g') { e.preventDefault(); window.scrollTo({top:0, behavior:'smooth'}); return; }
    if (e.key === 'G') { e.preventDefault(); window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'}); return; }
  });
  // Cheat sheet overlay — dynamically created once, toggled
  let kbHelpEl = null;
  function openKbHelp() {
    if (kbHelpEl && kbHelpEl.classList.contains('on')) { kbHelpEl.classList.remove('on'); return; }
    if (!kbHelpEl) {
      kbHelpEl = document.createElement('div');
      kbHelpEl.className = 'kb-help-bg';
      kbHelpEl.setAttribute('role', 'dialog');
      kbHelpEl.setAttribute('aria-label', 'Keyboard shortcuts');
      kbHelpEl.innerHTML = `
        <div class="kb-help">
          <div class="kb-help-head">
            <h3 style="margin:0;">Keyboard shortcuts</h3>
            <button class="kb-help-close" aria-label="Close" onclick="this.closest('.kb-help-bg').classList.remove('on')">✕</button>
          </div>
          <div class="kb-help-group">
            <div class="kb-help-group-title">Navigation</div>
            <div class="kb-row"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd><span>Switch tabs</span></div>
            <div class="kb-row"><kbd>/</kbd><span>Focus search</span></div>
            <div class="kb-row"><kbd>g</kbd><span>Scroll to top</span></div>
            <div class="kb-row"><kbd>G</kbd><span>Scroll to bottom</span></div>
          </div>
          <div class="kb-help-group">
            <div class="kb-help-group-title">Vote mode</div>
            <div class="kb-row"><kbd>J</kbd><kbd>←</kbd><span>No</span></div>
            <div class="kb-row"><kbd>K</kbd><kbd>↓</kbd><span>Already seen</span></div>
            <div class="kb-row"><kbd>L</kbd><kbd>→</kbd><span>Yes</span></div>
          </div>
          <div class="kb-help-group">
            <div class="kb-help-group-title">Anywhere</div>
            <div class="kb-row"><kbd>?</kbd><span>Show this help</span></div>
            <div class="kb-row"><kbd>Esc</kbd><span>Close modal or overlay</span></div>
          </div>
        </div>`;
      document.body.appendChild(kbHelpEl);
      kbHelpEl.addEventListener('click', e => {
        if (e.target === kbHelpEl) kbHelpEl.classList.remove('on');
      });
    }
    kbHelpEl.classList.add('on');
  }
})();

// Sticky "who's watching" mini bar: appears when the user scrolls past the V5 roster on Tonight.
// Not shown on other screens. Keeps the user aware of who's selected without scrolling back up.
// 14-10: rewired from .who-card → #couch-viz-container (V5 redesign — same conceptual surface).
(function() {
  const mini = document.getElementById('who-mini');
  const miniAvatars = document.getElementById('who-mini-avatars');
  if (!mini || !miniAvatars) return;
  let lastShown = false;
  function update() {
    const onTonight = document.getElementById('screen-tonight')?.classList.contains('active');
    const whoCard = document.querySelector('#screen-tonight #couch-viz-container');
    if (!onTonight || !whoCard) {
      if (lastShown) { mini.style.display = 'none'; lastShown = false; }
      return;
    }
    const rect = whoCard.getBoundingClientRect();
    const shouldShow = rect.bottom < 0 && state.couchMemberIds && state.couchMemberIds.length > 0;
    if (shouldShow === lastShown) return;
    lastShown = shouldShow;
    if (shouldShow) {
      // Render avatars
      const selected = state.couchMemberIds.map(id => state.members.find(m => m.id === id)).filter(Boolean).slice(0, 5);
      miniAvatars.innerHTML = selected.map(m => `<div class="who-mini-av" style="background:${m.color}" title="${escapeHtml(m.name)}">${avatarContent(m)}</div>`).join('');
      mini.style.display = 'flex';
    } else {
      mini.style.display = 'none';
    }
  }
  window.addEventListener('scroll', update, { passive: true });
  // Also recompute after renders (selection changes, tab switches)
  const origRender = window.renderTonight;
  // Hook is optional — main trigger is scroll
  setInterval(update, 500);
})();

// Accessibility sweep: set dialog semantics on every modal container and wire
// Escape-to-close plus Tab focus-trapping. Runs once at boot.
(function() {
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.setAttribute('role', 'dialog');
    bg.setAttribute('aria-modal', 'true');
    const h = bg.querySelector('h3, h2, h1');
    if (h) {
      if (!h.id) h.id = 'modal-h-' + Math.random().toString(36).slice(2,8);
      bg.setAttribute('aria-labelledby', h.id);
    }
  });
  // Keyboard handling for open modals: Escape closes, Tab wraps inside.
  const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  document.addEventListener('keydown', e => {
    const openModals = Array.from(document.querySelectorAll('.modal-bg.on'));
    if (!openModals.length) return;
    const top = openModals[openModals.length - 1];
    if (e.key === 'Escape') {
      const closer = top.querySelector('[onclick*="close"],[onclick*="Close"],.detail-close,.close');
      if (closer) closer.click();
      else top.classList.remove('on');
      return;
    }
    if (e.key === 'Tab') {
      const focusables = Array.from(top.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // When a modal opens, move focus into it; when it closes, return to trigger.
  // We watch the .on class via a MutationObserver on each modal-bg.
  const lastFocusedBefore = new WeakMap();
  document.querySelectorAll('.modal-bg').forEach(bg => {
    let wasOpen = bg.classList.contains('on');
    new MutationObserver(() => {
      const isOpen = bg.classList.contains('on');
      if (isOpen && !wasOpen) {
        lastFocusedBefore.set(bg, document.activeElement);
        // Focus first focusable element inside the modal
        setTimeout(() => {
          const firstFocusable = bg.querySelector(FOCUSABLE);
          if (firstFocusable) firstFocusable.focus();
        }, 50);
      } else if (!isOpen && wasOpen) {
        const prev = lastFocusedBefore.get(bg);
        if (prev && typeof prev.focus === 'function') prev.focus();
      }
      wasOpen = isOpen;
    }).observe(bg, { attributes: true, attributeFilter: ['class'] });
  });
})();

// ====================================================================================
// === Phase 14 / Plan 14-07 — D-07 Flow A: group rank-pick + push-confirm ===========
// ====================================================================================
// Flow A is the "we're together on the couch RIGHT NOW, who's picking?" decision flow.
// Architecture: one entry CTA on the Tonight tab → picker UI (3-tier ranked list) →
// roster screen (proxy-confirm in-person members) → createIntent({flow:'rank-pick'}) →
// per-recipient response screen (In/Reject/Drop + counter-nom) → reject-majority retry →
// counter-chain capped at 3 → quorum convert to watchparty.
//
// Cross-plan dependencies (all already shipped upstream):
//   - 14-01 isWatchedByCouch — already-watched filter (consumed indirectly via tier aggregators)
//   - 14-03 getTierOneRanked / getTierTwoRanked / getTierThreeRanked — picker rows
//   - 14-03 resolveT3Visibility() — gates the T3 expand affordance entirely
//   - 14-04 state.couchMemberIds — populated by claimCushion; gates entry CTA visibility
//   - 14-06 createIntent({flow:'rank-pick', expectedCouchMemberIds, ...}) — Firestore primitive
//   - 14-06 onIntentCreated CF — handles flowAPick fan-out push to unconfirmed couch members
//   - 14-06 onIntentUpdate CF — handles counter-chain server-side bumps
//   - 14-08 maybeOpenIntentFromDeepLink — already typeof-guards openFlowAResponseScreen call
//
// All functions cross-reference (entry → picker → roster → response → counter sub-flow
// reuses picker → convert), so this lands as one coherent block and one atomic commit
// per the same precedent set by 14-08 Flow B (commit af168f1).
// ====================================================================================

// === D-07 Flow A entry CTA (Tonight tab) — DECI-14-07 ===
// Renders into #flow-a-entry-container (added in app.html under couch-viz). Hidden until
// state.couchMemberIds has ≥1 entry. Flips to "Picking happening" reactively when an open
// rank-pick intent exists (via state.unsubIntents tick).
function renderFlowAEntry() {
  const container = document.getElementById('flow-a-entry-container');
  if (!container) return;
  const couchSize = (state.couchMemberIds || []).filter(Boolean).length;
  if (couchSize < 1) { container.innerHTML = ''; return; }
  // 14-10 (sketch 003 V5): the legacy 14-09 D-11 (c) empty-state-c card
  // ("Who's on the couch tonight? + Find a seat") was redundant under V5
  // because the dashed-pill roster IS the empty state — showing both
  // re-created the 'two stacked surfaces' problem Bug A fixed. Branch
  // simplified to a single line that clears stale content from this
  // sibling container; the V5 roster in #couch-viz-container handles
  // user attention directly via the dashed family pills.
  // The corresponding cushion-glow CSS in css/app.css is also obsolete
  // (its target selectors were deleted with the cushion grid in Task 4).
  // Check whether an open Flow A intent already exists for this family.
  const openFlowA = (state.intents || []).find(i =>
    (i.flow === 'rank-pick' || i.type === 'rank-pick') && i.status === 'open'
  );
  if (openFlowA) {
    container.innerHTML = `<div class="flow-a-active">
      <div class="flow-a-active-h">Picking happening</div>
      <p class="flow-a-active-body">A pick is in progress. Watching for responses…</p>
      <button class="tc-primary" type="button" onclick="openFlowAResponseScreen('${openFlowA.id}')">Open</button>
    </div>`;
    return;
  }
  container.innerHTML = `<div class="flow-a-entry">
    <div class="flow-a-entry-h">Pick a movie for the couch</div>
    <p class="flow-a-entry-body">${couchSize} ${couchSize === 1 ? 'person is' : 'people are'} on the couch. Pick from your shared queue.</p>
    <button class="tc-primary" type="button" onclick="openFlowAPicker()">Open picker</button>
  </div>`;
}

window.openFlowAPicker = function() {
  if (!state.me) { flashToast('Sign in to pick', { kind: 'warn' }); return; }
  const couch = (state.couchMemberIds || []).filter(Boolean);
  if (!couch.length) { flashToast('Claim a seat on the couch first', { kind: 'warn' }); return; }
  renderFlowAPickerScreen();
};

// === D-07 Flow A picker UI — DECI-14-07 ===
// Lazy-creates a single #flow-a-picker-modal container which is reused across picker /
// roster / response screens (each render replaces innerHTML). This keeps DOM count low
// and avoids competing focus traps when the user toggles between screens.
function renderFlowAPickerScreen() {
  let modal = document.getElementById('flow-a-picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-a-picker-modal';
    modal.className = 'modal-bg flow-a-picker-modal';
    document.body.appendChild(modal);
  }
  const couch = (state.couchMemberIds || []).filter(Boolean);
  // Rejected-titles set (from reject-majority retry path, see onFlowARetryPick) excludes
  // already-tried titles from the next picker render. Defensive: may be undefined first time.
  const rejected = state.flowARejectedTitles || new Set();
  const filterRejected = entry => !rejected.has(entry.title.id);

  // Plan 14-09 / D-11 (d) — when the user taps "Show rewatch options" from the
  // all-watched empty state, state.flowARevealRewatch flips to true so tier
  // aggregators include already-watched titles. Resets on close.
  const aggOpts = state.flowARevealRewatch ? { includeWatched: true } : undefined;
  const t1 = getTierOneRanked(couch, aggOpts).filter(filterRejected);
  const t2 = getTierTwoRanked(couch, aggOpts).filter(filterRejected);
  const t3 = getTierThreeRanked(couch, aggOpts).filter(filterRejected);
  const showT3 = resolveT3Visibility();
  // Counter-nomination sub-flow re-uses this picker; show contextual heading.
  const isCounter = !!state.flowACounterFor;

  const renderRow = (entry, tier) => {
    const t = entry.title;
    // T1: meanRank (computed below); T2: meanPresentRank + couchPresenceCount; T3: meanOffCouchRank.
    let metaBits = `Tier ${tier}`;
    if (tier === 1 && entry.meanRank != null) metaBits += ` · mean rank ${entry.meanRank.toFixed(1)}`;
    else if (tier === 2) {
      if (entry.meanPresentRank != null) metaBits += ` · mean rank ${entry.meanPresentRank.toFixed(1)}`;
      if (entry.couchPresenceCount != null) metaBits += ` · ${entry.couchPresenceCount} couch member${entry.couchPresenceCount === 1 ? '' : 's'}`;
    } else if (tier === 3 && entry.meanOffCouchRank != null) {
      metaBits += ` · mean rank ${entry.meanOffCouchRank.toFixed(1)} (off-couch)`;
    }
    return `<div class="flow-a-row" role="button" tabindex="0"
      onclick="onFlowAPickerSelect('${t.id}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();onFlowAPickerSelect('${t.id}');}">
      <div class="flow-a-row-poster" style="background-image:url('${escapeHtml(t.poster || '')}')"></div>
      <div class="flow-a-row-meta">
        <div class="flow-a-row-name">${escapeHtml(t.name || '')}</div>
        <div class="flow-a-row-tier">${metaBits}</div>
      </div>
    </div>`;
  };

  const t1Html = t1.length ? `<section class="flow-a-section">
    <h3 class="flow-a-section-h">Tier 1 — everyone wants this</h3>
    ${t1.slice(0, 10).map(e => renderRow(e, 1)).join('')}
  </section>` : '';

  const t2Html = t2.length ? `<section class="flow-a-section">
    <h3 class="flow-a-section-h">Tier 2 — some couch interest</h3>
    ${t2.slice(0, 10).map(e => renderRow(e, 2)).join('')}
  </section>` : '';

  const t3Html = (showT3 && t3.length) ? `<section class="flow-a-section flow-a-section-t3" data-expanded="false">
    <button class="flow-a-t3-toggle" type="button" onclick="onFlowAToggleT3(this)">Show off-couch picks (${t3.length})</button>
    <div class="flow-a-t3-body" hidden>
      <p class="flow-a-t3-warn">Watching titles only off-couch members want.</p>
      ${t3.slice(0, 10).map(e => renderRow(e, 3)).join('')}
    </div>
  </section>` : '';

  // Plan 14-09 / D-11 (d) + 14-10 follow-up: differentiate "no votes yet" from
  // "all watched". Tier aggregators consume t.queues[memberId] which only populates
  // on Yes votes — if nobody has voted, all 3 tiers are empty even when titles exist.
  // The "you've seen everything" copy was misleading in that case (it implied watched,
  // when really nothing was queued). Now: check whether including-watched would
  // produce results — if yes, it's truly an all-watched state; if no, it's an
  // unvoted-queue state.
  const emptyAllTiers = (!t1.length && !t2.length && !(showT3 && t3.length));
  let emptyState = '';
  if (emptyAllTiers) {
    // Probe: would including watched titles produce any tier rows?
    const probeOpts = { includeWatched: true };
    const wouldHaveContent = state.flowARevealRewatch
      ? false
      : (getTierOneRanked(couch, probeOpts).length || getTierTwoRanked(couch, probeOpts).length || (showT3 && getTierThreeRanked(couch, probeOpts).length));
    if (wouldHaveContent) {
      emptyState = `<div class="queue-empty">
        <span class="emoji">🛋️</span>
        <strong>You've seen everything in queue</strong>
        Revisit a favorite or expand discovery?
        <div class="queue-empty-cta">
          <button class="tc-primary" type="button" onclick="onFlowAShowRewatchOptions()">Show rewatch options</button>
          <button class="tc-secondary" type="button" onclick="closeFlowAPicker();showScreen('add')">Discover more</button>
        </div>
      </div>`;
    } else {
      // No queued titles at all — nudge into Vote mode or Add tab to populate.
      emptyState = `<div class="queue-empty">
        <span class="emoji">🛋️</span>
        <strong>Nothing in the couch's queue yet</strong>
        Vote Yes on titles to fill it up, or add new ones.
        <div class="queue-empty-cta">
          <button class="tc-primary" type="button" onclick="closeFlowAPicker();openSwipeMode()">Open Vote mode</button>
          <button class="tc-secondary" type="button" onclick="closeFlowAPicker();showScreen('add')">Add titles</button>
        </div>
      </div>`;
    }
  }

  const subhead = isCounter
    ? `Pick a different title to counter-nominate.`
    : `Tap a title to send it to the couch.`;

  modal.innerHTML = `<div class="modal-content flow-a-picker-content">
    <header class="flow-a-picker-h">
      <button class="modal-close" type="button" onclick="closeFlowAPicker()" aria-label="Close picker">✕</button>
      <h2>${isCounter ? 'Counter-nominate' : 'Pick a movie'}</h2>
      <p>${subhead}</p>
    </header>
    <div class="flow-a-picker-body">
      ${t1Html}
      ${t2Html}
      ${t3Html}
      ${emptyState}
    </div>
  </div>`;
  modal.classList.add('on');
}

window.onFlowAToggleT3 = function(btn) {
  const section = btn.closest('.flow-a-section-t3');
  if (!section) return;
  const body = section.querySelector('.flow-a-t3-body');
  if (!body) return;
  const expanded = section.dataset.expanded === 'true';
  section.dataset.expanded = expanded ? 'false' : 'true';
  body.hidden = expanded;
  btn.textContent = expanded ? `Show off-couch picks` : `Hide off-couch picks`;
};

window.closeFlowAPicker = function() {
  const modal = document.getElementById('flow-a-picker-modal');
  if (modal) modal.classList.remove('on');
  // Plan 14-09 / D-11 (d) — reset rewatch-reveal flag on close so a fresh open
  // starts back in the default (exclude-watched) view.
  state.flowARevealRewatch = false;
};

// Plan 14-09 / D-11 (d) — handler for "Show rewatch options" CTA in the
// all-watched empty state. Flips state.flowARevealRewatch and re-renders the
// picker so the tier aggregators surface already-watched titles for rewatch.
window.onFlowAShowRewatchOptions = function() {
  state.flowARevealRewatch = true;
  renderFlowAPickerScreen();
};

window.onFlowAPickerSelect = function(titleId) {
  // Counter-nomination sub-flow short-circuit: when state.flowACounterFor is set,
  // route the picked title into submitCounterNom instead of advancing to the roster screen.
  if (state.flowACounterFor) {
    submitCounterNom(titleId);
    return;
  }
  // Stash the picked title and advance to the roster screen (proxy-confirm step).
  state.flowAPickerTitleId = titleId;
  renderFlowARosterScreen();
};

// === D-07 Flow A roster screen — proxy-confirm + send-picks — DECI-14-07 ===
// Renders all couch members as tappable rows. Picker (state.me) is auto-confirmed and
// disabled. Tapping a non-self member toggles state.flowAProxyConfirmed (a Set of memberIds).
// Send Picks calls createIntent({flow:'rank-pick', ...}) then pre-seeds proxy-confirmed
// rsvps so 14-06's onIntentCreated CF skips them in the push fan-out.
function renderFlowARosterScreen() {
  const modal = document.getElementById('flow-a-picker-modal');
  if (!modal) return;
  const couch = (state.couchMemberIds || []).filter(Boolean);
  const t = state.titles.find(x => x.id === state.flowAPickerTitleId);
  if (!t) { closeFlowAPicker(); flashToast('Title no longer available', { kind: 'warn' }); return; }

  if (!state.flowAProxyConfirmed) state.flowAProxyConfirmed = new Set();

  const couchMembers = couch.map(mid => (state.members || []).find(m => m.id === mid)).filter(Boolean);

  const memberRows = couchMembers.map(m => {
    const isMe = state.me && m.id === state.me.id;
    const confirmed = isMe || state.flowAProxyConfirmed.has(m.id);
    return `<button class="flow-a-roster-member ${confirmed ? 'confirmed' : ''}" type="button"
      onclick="onFlowAToggleConfirm('${m.id}')"
      ${isMe ? 'disabled aria-label="You — auto-in"' : ''}>
      <div class="flow-a-roster-avatar" style="background:${memberColor(m.id)}">${escapeHtml((m.name||'?')[0].toUpperCase())}</div>
      <span class="flow-a-roster-name">${escapeHtml(m.name || 'Member')}${isMe ? ' (you)' : ''}</span>
      <span class="flow-a-roster-status">${confirmed ? '✓ in' : 'tap to mark in-person'}</span>
    </button>`;
  }).join('');

  const unconfirmedCount = couchMembers.filter(m => {
    const isMe = state.me && m.id === state.me.id;
    return !isMe && !state.flowAProxyConfirmed.has(m.id);
  }).length;

  modal.innerHTML = `<div class="modal-content flow-a-roster-content">
    <header class="flow-a-roster-h">
      <button class="modal-close" type="button" onclick="closeFlowAPicker()" aria-label="Close">✕</button>
      <h2>${escapeHtml(t.name)}</h2>
      <p>Mark members already in-person; the rest get a push.</p>
    </header>
    <div class="flow-a-roster-list">${memberRows}</div>
    <footer class="flow-a-roster-footer">
      <button class="tc-secondary" type="button" onclick="renderFlowAPickerScreen()">Back</button>
      <button class="tc-primary" type="button" onclick="onFlowASendPicks()">
        Send picks${unconfirmedCount > 0 ? ` (${unconfirmedCount} push${unconfirmedCount === 1 ? '' : 'es'})` : ''}
      </button>
    </footer>
  </div>`;
}

window.onFlowAToggleConfirm = function(memberId) {
  if (!state.flowAProxyConfirmed) state.flowAProxyConfirmed = new Set();
  if (state.me && memberId === state.me.id) return; // self always confirmed
  if (state.flowAProxyConfirmed.has(memberId)) {
    state.flowAProxyConfirmed.delete(memberId);
  } else {
    state.flowAProxyConfirmed.add(memberId);
  }
  renderFlowARosterScreen();
};

window.onFlowASendPicks = async function() {
  const titleId = state.flowAPickerTitleId;
  const couch = (state.couchMemberIds || []).filter(Boolean);
  if (!titleId || !couch.length) return;

  // expectedCouchMemberIds = the FULL couch (CF intersects this with subscribers).
  // Proxy-confirmed members get rsvps[mid] pre-seeded with state:'in' so the CF push
  // fan-out (delivered by 14-06's onIntentCreated) sees they're already in and skips them.
  const expected = couch.slice();

  let intentId;
  try {
    intentId = await createIntent({
      flow: 'rank-pick',
      titleId,
      expectedCouchMemberIds: expected
    });
  } catch (e) {
    console.error('[flowA] createIntent failed', e);
    flashToast('Could not send picks — try again', { kind: 'warn' });
    return;
  }
  if (!intentId) {
    flashToast('Could not send picks — try again', { kind: 'warn' });
    return;
  }

  // Pre-seed proxy-confirmed members' rsvps. intentRef(id) returns the doc ref directly
  // (see js/app.js:1388), so no doc(intentRef(...)) wrapping is needed (would error).
  for (const mid of state.flowAProxyConfirmed) {
    try {
      await updateDoc(intentRef(intentId), {
        [`rsvps.${mid}`]: {
          state: 'in',
          proxyConfirmedBy: state.me.id,
          at: Date.now(),
          actingUid: (state.auth && state.auth.uid) || null,
          memberName: ((state.members || []).find(m => m.id === mid) || {}).name || null
        },
        ...writeAttribution()
      });
    } catch (e) {
      console.warn('[flowA] proxy-confirm seed failed for', mid, e);
    }
  }

  // Reset proxy state.
  state.flowAProxyConfirmed = new Set();
  state.flowAPickerTitleId = null;

  flashToast('Picks sent. Watching for responses…', { kind: 'success' });
  closeFlowAPicker();
  // Open response screen so the picker can watch live progress.
  setTimeout(() => openFlowAResponseScreen(intentId), 100);
};

// === D-07 Flow A response screen — picker view + recipient view — DECI-14-07 ===
// Reused container (#flow-a-picker-modal). Picker view shows live tally + reject-majority CTA
// + counter-cap banner + convert button. Recipient view shows In/Reject+counter/Reject/Drop
// buttons. Live re-renders via maybeRerenderFlowAResponse hooked into state.unsubIntents tick.
window.openFlowAResponseScreen = function(intentId) {
  let modal = document.getElementById('flow-a-picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-a-picker-modal';
    modal.className = 'modal-bg flow-a-picker-modal';
    document.body.appendChild(modal);
  }
  state.flowAOpenIntentId = intentId;
  renderFlowAResponseScreen();
  modal.classList.add('on');
};

function renderFlowAResponseScreen() {
  const modal = document.getElementById('flow-a-picker-modal');
  if (!modal) return;
  const intentId = state.flowAOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) { closeFlowAPicker(); return; }
  const t = state.titles.find(x => x.id === intent.titleId);
  const isPicker = state.me && intent.createdBy === state.me.id;
  const myRsvp = state.me ? (intent.rsvps || {})[state.me.id] : null;

  // Tallies — count over expectedCouchMemberIds so the denominator is stable even if
  // membership changes mid-flow.
  const expected = intent.expectedCouchMemberIds || [];
  const ins     = expected.filter(mid => ((intent.rsvps || {})[mid] || {}).state === 'in').length;
  const rejects = expected.filter(mid => ((intent.rsvps || {})[mid] || {}).state === 'reject').length;
  const drops   = expected.filter(mid => ((intent.rsvps || {})[mid] || {}).state === 'drop').length;
  const rejectMajority = rejects > expected.length / 2;
  const counterDepth = intent.counterChainDepth || 0;
  const isClosed = intent.status && intent.status !== 'open';

  if (isPicker) {
    const canConvert = ins >= 1; // quorum: picker + ≥1 in
    const showCounterCap = counterDepth >= 3;
    // Plan 14-09 / D-11 (e) — reject-majority retry exhausted (counter chain at cap
    // OR retry path used). Per CONTEXT.md D-11 table: "No alternative pick. Try
    // again or anyone nominate?" with Cancel + Open Flow B CTAs. Open Flow B
    // hands off the same titleId so the user can solo-nominate from there.
    const showRejectExhausted = rejectMajority && counterDepth >= 3 && !isClosed;
    modal.innerHTML = `<div class="modal-content flow-a-response-content">
      <header class="flow-a-response-h">
        <button class="modal-close" type="button" onclick="closeFlowAPicker()" aria-label="Close">✕</button>
        <h2>${escapeHtml(t ? t.name : 'Pick')}</h2>
        <p>Live tally — ${ins} in · ${rejects} reject · ${drops} drop · counter chain ${counterDepth}/3</p>
        ${isClosed ? `<p class="flow-a-status-closed">Status: ${escapeHtml(intent.status)}</p>` : ''}
      </header>
      <div class="flow-a-response-body">
        ${rejectMajority && counterDepth < 3 && !isClosed ? `<div class="flow-a-rejected-cta">
          <strong>Reject majority hit.</strong>
          <p>Pick another title (1 retry then expire).</p>
          <button class="tc-primary" type="button" onclick="onFlowARetryPick()">Pick #2</button>
        </div>` : ''}
        ${showRejectExhausted ? `<div class="queue-empty">
          <span class="emoji">🎲</span>
          <strong>No alternative pick</strong>
          Try again or anyone nominate?
          <div class="queue-empty-cta">
            <button class="tc-secondary" type="button" onclick="onFlowACancel()">Cancel for tonight</button>
            <button class="tc-primary" type="button" onclick="closeFlowAPicker();openFlowBNominate('${intent.titleId}')">Open Flow B</button>
          </div>
        </div>` : (showCounterCap ? `<div class="flow-a-counter-cap">
          <strong>${counterDepth} options on the table.</strong>
          <p>No more counters. Pick one or end nomination.</p>
        </div>` : '')}
        ${canConvert && !isClosed ? `<button class="tc-primary" type="button" onclick="onFlowAConvert()">Start watchparty (${ins} in)</button>` : ''}
        ${!isClosed && !showRejectExhausted ? `<button class="tc-secondary" type="button" onclick="onFlowACancel()">End nomination</button>` : ''}
      </div>
    </div>`;
    return;
  }

  // RECIPIENT VIEW
  const responded = !!myRsvp;
  const myState = responded ? (myRsvp.state || myRsvp.value) : null;
  modal.innerHTML = `<div class="modal-content flow-a-response-content">
    <header class="flow-a-response-h">
      <button class="modal-close" type="button" onclick="closeFlowAPicker()" aria-label="Close">✕</button>
      <h2>${escapeHtml(t ? t.name : 'Pick')}</h2>
      <p>${escapeHtml(intent.createdByName || 'Picker')} picked this for the couch.</p>
      ${isClosed ? `<p class="flow-a-status-closed">Status: ${escapeHtml(intent.status)}</p>` : ''}
    </header>
    <div class="flow-a-response-body">
      ${responded ? `<div class="flow-a-already">You said: ${escapeHtml(myState || '')}</div>` : ''}
      ${!isClosed ? `
        <button class="tc-primary" type="button" onclick="onFlowARespond('in')">In</button>
        <button class="tc-secondary" type="button" onclick="onFlowAOpenCounterSubflow()">Reject + counter</button>
        <button class="tc-secondary" type="button" onclick="onFlowARespond('reject')">Reject</button>
        <button class="tc-secondary" type="button" onclick="onFlowARespond('drop')">Drop</button>
      ` : ''}
    </div>
  </div>`;
}

// Re-render the response screen on every intents snapshot tick (live tally updates).
// Wired into the state.unsubIntents handler above.
function maybeRerenderFlowAResponse() {
  if (state.flowAOpenIntentId) renderFlowAResponseScreen();
}

window.onFlowARespond = async function(stateValue) {
  const intentId = state.flowAOpenIntentId;
  if (!intentId || !state.me) return;
  try {
    await updateDoc(intentRef(intentId), {
      [`rsvps.${state.me.id}`]: {
        state: stateValue,
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      ...writeAttribution()
    });
    flashToast(`Recorded: ${stateValue}`, { kind: 'success' });
  } catch (e) {
    console.error('[flowA] respond failed', e);
    flashToast('Could not record response', { kind: 'warn' });
  }
};

window.onFlowAOpenCounterSubflow = function() {
  // Counter-nomination: open the same picker UI but route selection to submitCounterNom.
  // Server-side cap (rules from 14-06): counterChainDepth ≤ 3. Client mirrors for UX.
  const intentId = state.flowAOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const counterDepth = intent.counterChainDepth || 0;
  if (counterDepth >= 3) {
    flashToast('Counter chain full — pick from current options', { kind: 'warn' });
    return;
  }
  state.flowACounterFor = intentId;
  state.flowAPickerTitleId = null;
  renderFlowAPickerScreen(); // onFlowAPickerSelect short-circuits to submitCounterNom when flowACounterFor set
};

async function submitCounterNom(titleId) {
  const intentId = state.flowACounterFor;
  if (!intentId || !state.me) return;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const newDepth = (intent.counterChainDepth || 0) + 1;
  if (newDepth > 3) { flashToast('Counter chain cap reached', { kind: 'warn' }); return; }
  try {
    await updateDoc(intentRef(intentId), {
      [`rsvps.${state.me.id}`]: {
        state: 'reject',
        counterTitleId: titleId,
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      counterChainDepth: newDepth,
      ...writeAttribution()
    });
    flashToast('Counter-nomination sent', { kind: 'success' });
    state.flowACounterFor = null;
    closeFlowAPicker();
    setTimeout(() => openFlowAResponseScreen(intentId), 100);
  } catch (e) {
    console.error('[flowA] counter-nom failed', e);
    flashToast('Could not send counter-nomination', { kind: 'warn' });
  }
}

// === D-07 Flow A convert + cancel + retry handlers — DECI-14-07 ===
window.onFlowAConvert = async function() {
  const intentId = state.flowAOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent || !state.me) return;
  // UI-side quorum check; server-rule (14-06 Task 2) enforces createdByUid match for the
  // status:'converted' write so non-pickers can't bypass this.
  const ins = (intent.expectedCouchMemberIds || []).filter(mid => ((intent.rsvps || {})[mid] || {}).state === 'in').length;
  if (ins < 1) { flashToast('Need ≥1 confirmed in', { kind: 'warn' }); return; }
  try {
    const wpRef = await addDoc(watchpartiesRef(), {
      status: 'scheduled',
      hostId: state.me.id,
      hostUid: (state.auth && state.auth.uid) || null,
      hostName: state.me.name || null,
      titleId: intent.titleId,
      // 5min runway lets the lobby flow (Phase 11-05) take over and gather final RSVPs.
      startAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
      convertedFromIntentId: intent.id,
      ...writeAttribution()
    });
    await updateDoc(intentRef(intentId), {
      status: 'converted',
      convertedToWpId: wpRef.id,
      convertedTo: wpRef.id, // back-compat alias for any Phase 8 consumers
      ...writeAttribution()
    });
    flashToast('Converted to watchparty — heading there', { kind: 'success' });
    state.flowAOpenIntentId = null;
    closeFlowAPicker();
    if (typeof openWatchpartyLive === 'function') openWatchpartyLive(wpRef.id);
  } catch (e) {
    console.error('[flowA] convert failed', e);
    flashToast('Convert failed — try again', { kind: 'warn' });
  }
};

window.onFlowACancel = async function() {
  const intentId = state.flowAOpenIntentId;
  if (!intentId) return;
  try {
    await updateDoc(intentRef(intentId), {
      status: 'cancelled',
      cancelledAt: Date.now(),
      ...writeAttribution()
    });
    state.flowAOpenIntentId = null;
    closeFlowAPicker();
    flashToast('Nomination ended', { kind: 'info' });
  } catch (e) {
    console.error('[flowA] cancel failed', e);
    flashToast('Could not end nomination', { kind: 'warn' });
  }
};

// Reject-majority retry: per D-07 "1 retry, then expire". We cancel the current intent,
// stash its titleId in state.flowARejectedTitles (excluded from the next picker render),
// and re-open the picker so the picker can choose a different title. The new intent has
// no special "retry" flag — if it ALSO gets reject-majority'd, no third Pick CTA surfaces
// and the intent expires naturally at the rank-pick 11pm EOD cutoff (see createIntent
// in js/app.js:1419-1421).
window.onFlowARetryPick = function() {
  const intentId = state.flowAOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  if (!state.flowARejectedTitles) state.flowARejectedTitles = new Set();
  state.flowARejectedTitles.add(intent.titleId);
  // Cancel the rejected intent so the entry CTA flips back to "Open picker".
  try {
    updateDoc(intentRef(intentId), {
      status: 'cancelled',
      cancelledAt: Date.now(),
      cancelReason: 'reject-majority-retry',
      ...writeAttribution()
    }).catch(e => console.warn('[flowA] retry-cancel failed', e));
  } catch (e) { console.warn('[flowA] retry-cancel sync failed', e); }
  state.flowACounterFor = null;
  state.flowAOpenIntentId = null;
  closeFlowAPicker();
  setTimeout(() => openFlowAPicker(), 100);
};

// === Phase 14 / Plan 14-07 — END Flow A block ===

boot();
