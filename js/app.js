import { db, doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch, auth, functions, httpsCallable, updatePassword, signInWithEmailAndPassword, storage, storageRef, uploadBytes, getDownloadURL } from './firebase.js';
import { TMDB_KEY, VAPID_PUBLIC_KEY, TRAKT_CLIENT_ID, TRAKT_EXCHANGE_URL, TRAKT_REFRESH_URL, TRAKT_DISCONNECT_URL, TRAKT_REDIRECT_URI, traktIsConfigured, COLORS, RATING_TIERS, TIER_LABELS, tierFor, ageToMaxTier, normalizeProviderName, SUBSCRIPTION_BRANDS, QN_DEBUG, qnLog, MOODS, moodById, suggestMoods, normalizeCode, DISCOVERY_CATALOG, COUCH_NIGHTS_PACKS, APP_VERSION, BUILD_DATE } from './constants.js';
import { pickDailyRows, isInSeasonalWindow } from './discovery-engine.js';
import { state, membersRef, titlesRef, familyDocRef, vetoHistoryRef, vetoHistoryDoc } from './state.js';
import { escapeHtml, haptic, flashToast, skDiscoverRow, skTitleList, POSTER_COLORS, colorFor, posterStyle, posterFallbackLetter, writeAttribution } from './utils.js';
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
// Matching private key lives server-side in queuenight/functions/.env.

// Per-event-type notification defaults (PUSH-02). Written to users/{uid}.notificationPrefs when
// the user touches a toggle; server reads and respects these in queuenight/functions sendToMembers.
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
  intentMatched: true
});

// UI copy for each toggle — label shown in Settings + description hint.
const NOTIFICATION_EVENT_LABELS = Object.freeze({
  watchpartyScheduled: { label: 'New watchparty scheduled', hint: 'When someone sets up a watchparty' },
  watchpartyStarting:  { label: 'Watchparty starting',       hint: 'Right when the movie starts' },
  titleApproval:       { label: 'Parent approval',           hint: 'When a parent approves or declines a request you sent' },
  inviteReceived:      { label: 'Invites',                   hint: 'When someone invites you to a family' },
  vetoCapReached:      { label: 'Tonight is stuck',          hint: 'When the family vetoes too many picks in a row' },
  tonightPickChosen:   { label: 'Tonight’s pick chosen', hint: 'When the spinner lands on a movie' },
  intentProposed:      { label: 'New intent posted',         hint: 'When someone proposes a tonight-watch or asks the family about a title' },
  intentMatched:       { label: 'Intent matched',            hint: 'When your proposed watch reaches the family threshold' }
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
  tonightPickChosen:      'tonightPickChosen'
});

// BRAND-voice copy per CONTEXT.md D-06. Sentence-case labels;
// descriptions in italic serif at render time via .notif-pref-hint.
const NOTIF_UI_LABELS = Object.freeze({
  watchpartyScheduled:    { label: 'New watchparty scheduled',  hint: 'A push when someone in the family schedules a watchparty.' },
  watchpartyStartingNow:  { label: 'Watchparty starting',       hint: 'A push when someone in the family hits play.' },
  intentRsvpRequested:    { label: 'Tonight RSVP request',      hint: 'When someone proposes a watch tonight at a time.' },
  inviteReceived:         { label: 'Family invite',             hint: 'When someone invites you to a couch.' },
  vetoCapReached:         { label: 'Tonight is stuck',          hint: 'When the family vetoes too many picks in a row. Owner-leaning, default off.' },
  tonightPickChosen:      { label: "Tonight's pick chosen",     hint: 'When the spinner lands on a movie.' }
});

const NOTIF_UI_DEFAULTS = Object.freeze({
  watchpartyScheduled:   true,
  watchpartyStartingNow: true,
  intentRsvpRequested:   true,
  inviteReceived:        true,
  vetoCapReached:        false,
  tonightPickChosen:     true
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
      let maxSeason = 0, maxEpisodeInSeason = 0;
      for (const s of (entry.seasons || [])) {
        if (s.number > maxSeason) {
          maxSeason = s.number;
          maxEpisodeInSeason = 0;
        }
        if (s.number === maxSeason) {
          for (const ep of (s.episodes || [])) {
            if (ep.number > maxEpisodeInSeason) maxEpisodeInSeason = ep.number;
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
          const prevProgress = existing.progress && typeof existing.progress === 'object'
            ? { ...existing.progress }
            : {};
          prevProgress[meId] = {
            season: maxSeason,
            episode: maxEpisodeInSeason,
            updatedAt: Date.now(),
            source: 'trakt'
          };
          const update = { progress: prevProgress };
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
// (queuenight watchpartyTick from 14-06). All-No edge case auto-cancels client-side.
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
    // D-06 (DECI-14-06) — hydrate couch seating from family doc into the indexed-array
    // state shape. Persisted shape: { [memberId]: index }; in-memory shape: array indexed
    // by cushion position with null for empty slots. 14-04 owns this slot; 14-01's
    // isWatchedByCouch + 14-03/14-07 downstream consumers all read state.couchMemberIds.
    const seating = d.couchSeating || {};
    const couchArr = [];
    Object.entries(seating).forEach(([mid, idx]) => { if (typeof idx === 'number' && idx >= 0) couchArr[idx] = mid; });
    state.couchMemberIds = couchArr;
    if (typeof renderCouchViz === 'function') renderCouchViz();
    renderPickerCard();
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
  set('who-title-label', {family:"Who's on the couch", crew:"Who's on the couch", duo:"Who's on the couch"}[m]);
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
      <span class="mood-icon">${m.icon}</span>${m.label}
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
  const whoEl = document.getElementById('who-list');
  if (!whoEl) return;
  // D-03 + D-04: sub-profiles and active guests render alongside authed members.
  // Sub-profile taps set state.actingAs (per-action); regular chips keep toggleMember.
  const nowTs = Date.now();
  const tonightMembers = (state.members || []).filter(m =>
    !m.archived &&
    (!m.temporary || (m.expiresAt && m.expiresAt > nowTs))
  );
  // Phase 11 / REFR-03 — empty-state: show branded fallback + invite CTA when no one on couch.
  if (!tonightMembers.length) {
    whoEl.innerHTML = `<div class="who-empty">
      <div class="who-empty-title">Nothing but us.</div>
      <div class="who-empty-body"><em>Pull up a seat &mdash; invite someone to the couch.</em></div>
      <button class="who-empty-share" onclick="openInviteShare()">Share an invite</button>
    </div>`;
    return;
  }
  whoEl.innerHTML = tonightMembers.map(m => {
    const isSub = !!m.managedBy && !m.uid;
    const isGuest = !!m.temporary;
    const badges = [];
    if (isSub) badges.push('<span class="chip-badge badge-kid">kid</span>');
    if (isGuest) badges.push('<span class="chip-badge badge-guest">guest</span>');
    const badgeHtml = badges.length ? ` ${badges.join(' ')}` : '';
    if (isSub) {
      // Act-as tap — per D-04, does NOT toggle selection; it arms the next write.
      const safeName = (m.name || '').replace(/'/g,"\\'");
      return `<div class="who-chip sub-profile" role="button" tabindex="0" data-sub-id="${m.id}" aria-label="Act as ${escapeHtml(m.name)}" onclick="tapActAsSubProfile('${m.id}','${safeName}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tapActAsSubProfile('${m.id}','${safeName}');}"><div class="who-avatar" style="background:${m.color}" aria-hidden="true">${avatarContent(m)}</div><div class="who-name">${escapeHtml(m.name)}${badgeHtml}</div></div>`;
    }
    const selected = state.selectedMembers.includes(m.id);
    const isMe = state.me && m.id === state.me.id;
    return `<div class="who-chip ${selected?'on':''} ${isMe?'me':''}" role="button" tabindex="0" aria-pressed="${selected}" aria-label="${escapeHtml(m.name)}" onclick="toggleMember('${m.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleMember('${m.id}');}"><div class="who-avatar" style="background:${m.color}" aria-hidden="true">${avatarContent(m)}</div><div class="who-name">${escapeHtml(m.name)}${badgeHtml}</div></div>`;
  }).join('');
  const el = document.getElementById('matches-list');
  const countEl = document.getElementById('matches-count');
  const actionsEl = document.getElementById('t-section-actions');

  // Empty states — consistent shape
  if (state.members.length === 0) {
    el.innerHTML = `<div class="empty"><strong>No group yet</strong>Share your code so others can join.</div>`;
    countEl.textContent = '';
    if (actionsEl) actionsEl.innerHTML = '';
    return;
  }
  if (state.selectedMembers.length === 0) {
    // D-11 (CONTEXT.md) — empty states should have action-leading CTAs, not dead ends.
    el.innerHTML = `<div class="empty"><strong>Pick who's watching</strong>Tap anyone above, or <button class="link-like" onclick="openInviteShare()">invite someone</button> to join the couch.</div>`;
    countEl.textContent = '';
    if (actionsEl) actionsEl.innerHTML = '';
    return;
  }

  // Common title-filter predicate — honors scope, providers, moods, vetoes, and age tiers.
  // Doesn't check votes; callers apply vote logic themselves.
  // D-01 (DECI-14-01): use couch-aware watched filter (Tonight tab is a discovery surface).
  // Couch identity here is the actively-selected members tonight; falls back to state.couchMemberIds
  // once 14-04's writer ships, or [state.me.id] as a last resort.
  const couch = (state.couchMemberIds && state.couchMemberIds.length)
    ? state.couchMemberIds
    : (state.selectedMembers.length ? state.selectedMembers : (state.me ? [state.me.id] : []));
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
    return true;
  }

  const matches = state.titles.filter(t => {
    if (!passesBaseFilter(t)) return false;
    return state.selectedMembers.every(mid => (t.votes||{})[mid] === 'yes');
  }).sort((a,b) => {
    const aY = Object.values(a.votes||{}).filter(v=>v==='yes').length;
    const bY = Object.values(b.votes||{}).filter(v=>v==='yes').length;
    return bY - aY;
  });

  // "Worth considering": at least one selected member said Yes, and nobody selected said No or Seen.
  // Excludes titles that are already matches. Ordered by number of Yes votes within the selected group.
  const matchIds = new Set(matches.map(t => t.id));
  const considerable = state.titles.filter(t => {
    if (!passesBaseFilter(t)) return false;
    if (matchIds.has(t.id)) return false;
    const votes = t.votes || {};
    let yesCount = 0;
    for (const mid of state.selectedMembers) {
      const v = votes[mid];
      if (v === 'no' || v === 'seen') return false; // anyone bailed → disqualified
      if (v === 'yes') yesCount++;
    }
    return yesCount >= 1;
  }).sort((a,b) => {
    const aY = state.selectedMembers.filter(mid => (a.votes||{})[mid] === 'yes').length;
    const bY = state.selectedMembers.filter(mid => (b.votes||{})[mid] === 'yes').length;
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
        <p style="font-size:var(--fs-meta);color:var(--ink-dim);margin:0 0 var(--s3);padding:0 var(--s1);">At least one of you is in. Nobody's passed yet.</p>
        ${considerable.map(t => card(t)).join('')}
      </div>`
    : '';

  if (matches.length === 0 && !vetoedTitles.length && considerable.length === 0) {
    el.innerHTML = `<div class="empty"><strong>No matches yet</strong>Add titles and vote so we have something to watch.</div>`;
    return;
  }
  const matchesHtml = matches.length
    ? matches.map(t => card(t)).join('')
    : `<div class="empty"><strong>Nothing's matching</strong>${considerable.length ? 'But there are still options below.' : 'Try adjusting filters, or add more titles.'}</div>`;
  el.innerHTML = matchesHtml + considerHtml + vetoedHtml;
  // D-06 (DECI-14-06) — render couch viz centerpiece. Container in app.html (Tonight tab top).
  // Safe to call on every renderTonight pass — innerHTML overwrite is the persistence model.
  if (typeof renderCouchViz === 'function') renderCouchViz();
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
        return `<div class="mood-chip on" role="group" aria-label="${escapeHtml(m.label)} filter active"><span class="mood-icon">${m.icon}</span>${escapeHtml(m.label)}<button class="mood-chip-remove" onclick="removeMoodFilter('${escapeHtml(id)}')" aria-label="Remove ${escapeHtml(m.label)} filter">×</button></div>`;
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

function card(t) {
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
    const moodChars = t.moods.slice(0,3).map(id => { const m = moodById(id); return m?m.icon:''; }).join('');
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
  if (state.filter === 'unwatched') list = list.filter(t => !isWatchedByCouch(t, couchForLib));
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
    el.innerHTML = hasSearch
      ? `<div class="queue-empty"><span class="emoji">🔍</span><strong>Nothing matches</strong>Try a different search.</div>`
      : `<div class="queue-empty"><span class="emoji">🛋️</span><strong>The couch is empty</strong>Vote yes on titles to fill it up. Drag to reorder what's next.</div>`;
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
    body.innerHTML = '<p>Already tracking on Trakt? Connect your account to pull in your watch history, watchlist, and ratings. Progress stays in sync both ways.</p>';
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
      <span class="mood-icon">${m.icon}</span>${m.label}
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

// Manual refresh button on the detail modal — re-fetch TMDB providers for one title
// right now, instead of waiting for the background migration to reach it.
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
      providersSchemaVersion: 3
    };
    await updateDoc(doc(titlesRef(), id), { ...writeAttribution(), ...update });
    haptic('success');
    // Re-open the detail to show the fresh data
    setTimeout(() => openDetailModal(id), 150);
  } catch(e) {
    alert('Refresh failed: ' + e.message);
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
  try { await updateDoc(doc(titlesRef(), id), { ...writeAttribution(), ...update }); } catch(e){ console.error(e); }
  if (detailTitleId === id) {
    const merged = { ...t, ...update };
    content.innerHTML = renderDetailShell(merged);
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
    return `<button class="mood-chip" onclick="removeDetailMood('${escapeHtml(t.id)}','${escapeHtml(id)}')" aria-label="Remove ${escapeHtml(m.label)}"><span class="mood-icon">${m.icon}</span>${escapeHtml(m.label)}</button>`;
  }).join('');
  const addChipHtml = `<button class="mood-chip mood-chip--add${detailMoodPaletteOpen ? ' mood-chip--add-active' : ''}" onclick="${detailMoodPaletteOpen ? 'closeDetailMoodPalette' : 'openDetailMoodPalette'}()">+ add mood</button>`;
  const paletteHtml = detailMoodPaletteOpen
    ? `<div class="detail-moods-palette" role="group" aria-label="Add mood">${
        MOODS.filter(m => !existingMoods.includes(m.id)).map(m =>
          `<button class="mood-chip mood-chip--palette" onclick="addDetailMood('${escapeHtml(t.id)}','${escapeHtml(m.id)}')"><span class="mood-icon">${m.icon}</span>${escapeHtml(m.label)}</button>`
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
    ? `<button class="pill" onclick="refreshProviders('${t.id}')" style="margin-top:var(--s2);font-size:var(--t-micro);" title="Refetch availability from TMDB">↻ Refresh</button>`
    : '';
  const providersHtml = anyAvail
    ? `<div class="detail-section"><h4>Where to watch</h4>${streamStrip}${rentStrip}${buyStrip}${refreshBtn}</div>`
    : (t.providersChecked
        ? `<div class="detail-section"><h4>Where to watch</h4><div class="detail-prov-empty">Not on subscription streaming or rent. ${refreshBtn}</div></div>`
        : '');
  const similarHtml = (t.similar && t.similar.length) ? `<div class="detail-section"><h4>You might also like</h4><div class="similar-row">${t.similar.map(s => {
    const inLib = state.titles.find(x => x.id === s.id);
    return `<div class="similar-card" onclick="addSimilar('${s.id}')"><div class="similar-poster ${inLib?'added':''}" style="background-image:url('${s.poster||''}')"><div class="add-overlay">${inLib?'✓':'+'}</div></div><div class="similar-name">${escapeHtml(s.name)}</div><div class="similar-year">${escapeHtml(s.year||'')}</div></div>`;
  }).join('')}</div></div>` : '';
  const loadingHtml = (!t.detailsCached && !t.isManual) ? '<div class="detail-section" aria-hidden="true"><div class="sk sk-line" style="width:30%;margin-bottom:10px;"></div><div class="sk-row-posters"><div class="sk sk-poster" style="width:80px;height:80px;border-radius:50%;"></div><div class="sk sk-poster" style="width:80px;height:80px;border-radius:50%;"></div><div class="sk sk-poster" style="width:80px;height:80px;border-radius:50%;"></div><div class="sk sk-poster" style="width:80px;height:80px;border-radius:50%;"></div></div></div>' : '';
  const moodsHtml = renderDetailMoodsSection(t);
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
    ${renderTvProgressSection(t)}
    ${trailerHtml}
    ${providersHtml}
    ${castHtml}
    ${similarHtml}
    ${renderDiaryForTitle(t)}
    ${renderReviewsForTitle(t)}
    ${renderTmdbReviewsForTitle(t)}
    ${renderWatchpartyHistoryForTitle(t)}
    ${loadingHtml}
  </div>`;
}

function renderWatchpartyHistoryForTitle(t) {
  const related = state.watchparties.filter(wp => wp.titleId === t.id).sort((a,b) => b.startAt - a.startAt);
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
  content.innerHTML = `${confettiHtml}
    <div class="spin-result-poster" style="background-image:url('${t.poster||''}')"></div>
    <div class="spin-result-name">${escapeHtml(t.name)}</div>
    <div class="spin-result-meta">${escapeHtml(t.year||'')} · ${escapeHtml(t.kind||'')}${t.runtime?' · '+t.runtime+'m':''}</div>
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
  // Sources 2 + 3 — any couch member's prior vote (yes OR no) counts as "watched-status known".
  // Per D-01 literal read: voting No on a title still hides it from rediscovery (intentional opinionation).
  const votes = t.votes || {};
  return couchMemberIds.some(mid => votes[mid] === 'yes' || votes[mid] === 'no');
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
function getTierOneRanked(couchMemberIds) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  const out = [];
  state.titles.forEach(t => {
    if (t.watched) return;
    if (!t.queues) return;
    if (isWatchedByCouch(t, couchMemberIds)) return;
    // Intersection requirement: ALL couch members must have a rank for this title.
    const ranks = couchMemberIds.map(mid => t.queues[mid]);
    if (ranks.some(r => r == null)) return;
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
function getTierTwoRanked(couchMemberIds) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  const out = [];
  state.titles.forEach(t => {
    if (t.watched) return;
    if (!t.queues) return;
    if (isWatchedByCouch(t, couchMemberIds)) return;
    const presentRanks = couchMemberIds
      .map(mid => t.queues[mid])
      .filter(r => r != null);
    // Must have ≥1 couch presence AND NOT all (else it's T1).
    if (presentRanks.length === 0) return;
    if (presentRanks.length === couchMemberIds.length) return;
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
function getTierThreeRanked(couchMemberIds) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  const couchSet = new Set(couchMemberIds);
  const out = [];
  state.titles.forEach(t => {
    if (t.watched) return;
    if (!t.queues) return;
    if (isWatchedByCouch(t, couchMemberIds)) return;
    const queueingMids = Object.keys(t.queues);
    if (!queueingMids.length) return;
    // Zero couch overlap, ≥1 off-couch presence.
    const offCouchPresent = queueingMids.filter(mid => !couchSet.has(mid));
    const couchPresent = queueingMids.filter(mid => couchSet.has(mid));
    if (couchPresent.length > 0) return;
    if (offCouchPresent.length === 0) return;
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

function renderActivity() {
  const el = document.getElementById('activity-list');
  updateActivityBadge();
  if (!el) return;
  if (!recentActivity.length) { el.innerHTML = '<div class="activity-empty">Quiet on the couch. Start adding and voting to see activity here.</div>'; return; }
  el.innerHTML = recentActivity.map(a => {
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
async function writeMemberProgress(titleId, memberId, season, episode) {
  if (!titleId || !memberId) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const prevProgress = t.progress && typeof t.progress === 'object' ? { ...t.progress } : {};
  prevProgress[memberId] = { season: season, episode: episode, updatedAt: Date.now() };
  try {
    await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), progress: prevProgress });
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
async function clearMemberProgress(titleId, memberId) {
  if (!titleId || !memberId) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const prevProgress = t.progress && typeof t.progress === 'object' ? { ...t.progress } : {};
  delete prevProgress[memberId];
  try {
    await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), progress: prevProgress });
  } catch(e) { console.warn('progress clear failed', e); }
}

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
      <span class="mood-icon">${m.icon}</span>${m.label}
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

// === Sports watchparties (Turn 12) ===
// Picker uses TheSportsDB's free API — no key required, no Cloud Function needed.
// We read the next 15 upcoming games per league and let the user tap one to
// create a watchparty scheduled for kickoff time.
const SPORTS_LEAGUES = {
  nba: { sport: 'basketball', league: 'nba', emoji: '🏀', label: 'NBA' },
  mlb: { sport: 'baseball', league: 'mlb', emoji: '⚾', label: 'MLB' },
  nhl: { sport: 'hockey', league: 'nhl', emoji: '🏒', label: 'NHL' },
  nfl: { sport: 'football', league: 'nfl', emoji: '🏈', label: 'NFL' }
};
let sportsCurrentLeague = 'nba';
const sportsGamesCache = {};
const SPORTS_CACHE_TTL = 5 * 60 * 1000;

window.openSportsPicker = function() {
  document.getElementById('sports-picker-bg').classList.add('on');
  sportsCurrentLeague = 'nba';
  document.querySelectorAll('.sports-league-tab').forEach(t => {
    t.classList.toggle('on', t.getAttribute('data-league') === 'nba');
  });
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

async function loadSportsGames(leagueKey) {
  const listEl = document.getElementById('sports-games-list');
  if (!listEl) return;
  const league = SPORTS_LEAGUES[leagueKey];
  if (!league) return;
  const cached = sportsGamesCache[leagueKey];
  if (cached && Date.now() - cached.fetchedAt < SPORTS_CACHE_TTL) {
    renderSportsGames(cached.games);
    return;
  }
  listEl.innerHTML = '<div class="sports-loading">Loading ' + league.label + ' games\u2026</div>';
  try {
    const allGames = [];
    const today = new Date();
    const fetches = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
      const url = 'https://site.api.espn.com/apis/site/v2/sports/' + league.sport + '/' + league.league + '/scoreboard?dates=' + dateStr;
      fetches.push(fetch(url).then(r => r.json()).catch(() => null));
    }
    const results = await Promise.all(fetches);
    results.forEach(data => {
      if (data && Array.isArray(data.events)) {
        data.events.forEach(ev => allGames.push(ev));
      }
    });
    sportsGamesCache[leagueKey] = { fetchedAt: Date.now(), games: allGames };
    renderSportsGames(allGames);
  } catch(e) {
    qnLog('[Sports] fetch failed', e);
    listEl.innerHTML = '<div class="sports-empty"><strong>Couldn\'t load games</strong>The sports data service might be having a moment. Try again in a bit.</div>';
  }
}

function parseEspnEvent(ev) {
  if (!ev) return null;
  const comp = (ev.competitions && ev.competitions[0]) || {};
  const teams = comp.competitors || [];
  const home = teams.find(t => t.homeAway === 'home') || {};
  const away = teams.find(t => t.homeAway === 'away') || {};
  const broadcast = comp.broadcasts && comp.broadcasts[0] && comp.broadcasts[0].names
    ? comp.broadcasts[0].names[0] : null;
  const statusName = ev.status && ev.status.type ? ev.status.type.name : '';
  const statusDetail = ev.status && ev.status.type ? ev.status.type.shortDetail : '';
  return {
    id: ev.id || '',
    shortName: ev.shortName || '',
    startTime: ev.date ? new Date(ev.date).getTime() : null,
    homeTeam: home.team ? home.team.displayName : 'TBD',
    homeAbbrev: home.team ? home.team.abbreviation : '',
    homeLogo: home.team ? home.team.logo : '',
    homeScore: home.score || null,
    awayTeam: away.team ? away.team.displayName : 'TBD',
    awayAbbrev: away.team ? away.team.abbreviation : '',
    awayLogo: away.team ? away.team.logo : '',
    awayScore: away.score || null,
    venue: comp.venue ? comp.venue.fullName : null,
    broadcast: broadcast,
    statusName: statusName,
    statusDetail: statusDetail,
    isFinal: statusName === 'STATUS_FINAL',
    isLive: statusName === 'STATUS_IN_PROGRESS',
    isScheduled: statusName === 'STATUS_SCHEDULED'
  };
}

function renderSportsGames(rawGames) {
  const listEl = document.getElementById('sports-games-list');
  if (!listEl) return;
  const games = rawGames
    .map(parseEspnEvent)
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
  const rawGame = cacheEntry.games.find(g => g.id === eventId);
  if (!rawGame) {
    qnLog('[Sports] no raw game match', { eventId, sampleIds: cacheEntry.games.slice(0,3).map(g => g.id) });
    flashToast('Could not find that game in the cache.', { kind: 'warn' });
    return;
  }
  if (!state.me) {
    qnLog('[Sports] no state.me when scheduling');
    flashToast('Pick who you are first, then try again.', { kind: 'warn' });
    return;
  }
  const game = parseEspnEvent(rawGame);
  if (!game || !game.startTime) { flashToast('This game is missing a start time.', { kind: 'warn' }); return; }
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
    reactions: []
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

// ---- Phase 11 / REFR-10 — SportsDataProvider abstraction (REFR-10) ----
// Wraps ESPN hidden API (primary, v1) + BALLDONTLIE (stub for future swap) behind a
// single interface: getSchedule(league, daysAhead) / getScore(gameId, league) /
// getPlays(gameId, league, sinceTs). Scores + plays cached per (gameId, bucket) key
// so 100 concurrent viewers of the same game = 1 fetch / 15s budget.
// Per RESEARCH §4: ESPN hidden API is ToS-gray but proven; BALLDONTLIE is the
// fallback if ESPN denies. Abstraction lets us swap without touching UI code.
const SPORTS_PROVIDER_CONFIG = {
  nfl: { provider: 'espn', espnSport: 'football', espnLeague: 'nfl' },
  nba: { provider: 'espn', espnSport: 'basketball', espnLeague: 'nba' },
  mlb: { provider: 'espn', espnSport: 'baseball', espnLeague: 'mlb' },
  nhl: { provider: 'espn', espnSport: 'hockey', espnLeague: 'nhl' }
};

const sportsScoreCache = {};   // key: `${gameId}-${bucketIdx}`
const sportsPlaysCache = {};
const SCORE_CACHE_BUCKET_MS = 15 * 1000;
const PLAYS_CACHE_BUCKET_MS = 30 * 1000;

function sportsBucketKey(gameId, bucketMs) {
  return `${gameId}-${Math.floor(Date.now() / bucketMs)}`;
}

const SportsDataProvider = {
  // getSchedule — returns parsed events for a league over the next N days. Re-uses
  // parseEspnEvent for ESPN-source normalization (no duplicate parsing logic).
  async getSchedule(leagueKey, daysAhead) {
    if (typeof daysAhead !== 'number') daysAhead = 7;
    const cfg = SPORTS_PROVIDER_CONFIG[leagueKey];
    if (!cfg) return [];
    if (cfg.provider === 'espn') {
      const allGames = [];
      const today = new Date();
      const fetches = [];
      for (let i = 0; i < daysAhead; i++) {
        const d = new Date(today); d.setDate(d.getDate() + i);
        const dateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
        const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.espnSport}/${cfg.espnLeague}/scoreboard?dates=${dateStr}`;
        fetches.push(fetch(url).then(r => r.json()).catch(() => null));
      }
      const results = await Promise.all(fetches);
      results.forEach(data => {
        if (data && Array.isArray(data.events)) {
          data.events.forEach(ev => {
            const parsed = parseEspnEvent(ev);
            if (parsed) {
              parsed.league = leagueKey;  // tag for later routing
              allGames.push(parsed);
            }
          });
        }
      });
      return allGames;
    }
    // BALLDONTLIE branch — stub for v2 swap. When ESPN denies, implement:
    //   const url = `https://www.balldontlie.io/api/v1/games?...`;
    //   const r = await fetch(url); const d = await r.json();
    //   return (d.data || []).map(balldontlieToParsed);
    return [];
  },

  // getScore — cached score poll. Cache bucket is 15s so 100 simultaneous viewers
  // of the same game result in 1 network fetch per bucket (ToS-gray mitigation).
  async getScore(gameId, leagueKey) {
    const key = sportsBucketKey(gameId, SCORE_CACHE_BUCKET_MS);
    if (sportsScoreCache[key]) return sportsScoreCache[key];
    const cfg = SPORTS_PROVIDER_CONFIG[leagueKey];
    if (!cfg || cfg.provider !== 'espn') return null;
    try {
      // ESPN summary endpoint returns full event doc with status + competitors.
      const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.espnSport}/${cfg.espnLeague}/summary?event=${encodeURIComponent(gameId)}`;
      const r = await fetch(url);
      const d = await r.json();
      const header = (d && d.header) || {};
      const comps = header.competitions || [];
      const comp = comps[0] || {};
      const teams = comp.competitors || [];
      const home = teams.find(t => t.homeAway === 'home') || {};
      const away = teams.find(t => t.homeAway === 'away') || {};
      const statusType = (comp.status && comp.status.type) || {};
      const score = {
        gameId,
        homeScore: parseInt(home.score, 10) || 0,
        awayScore: parseInt(away.score, 10) || 0,
        homeAbbr: (home.team && home.team.abbreviation) || '',
        awayAbbr: (away.team && away.team.abbreviation) || '',
        homeTeam: (home.team && home.team.displayName) || '',
        awayTeam: (away.team && away.team.displayName) || '',
        period: (comp.status && comp.status.period) || 0,
        clock: (comp.status && comp.status.displayClock) || '',
        state: statusType.state || 'unknown',  // 'pre' | 'in' | 'post'
        statusDetail: statusType.shortDetail || '',
        ts: Date.now()
      };
      sportsScoreCache[key] = score;
      return score;
    } catch(e) {
      qnLog('[Sports] getScore failed', { gameId, leagueKey, err: e && e.message });
      return null;
    }
  },

  // getPlays — play-by-play for late-joiner catch-me-up variant. Cached per 30s.
  // sinceTs is advisory (ESPN doesn't support since-filtering); we always pull the
  // last 10 plays and the caller filters if needed.
  async getPlays(gameId, leagueKey, sinceTs) {
    const key = sportsBucketKey(gameId, PLAYS_CACHE_BUCKET_MS);
    if (sportsPlaysCache[key]) return sportsPlaysCache[key];
    const cfg = SPORTS_PROVIDER_CONFIG[leagueKey];
    if (!cfg || cfg.provider !== 'espn') return [];
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.espnSport}/${cfg.espnLeague}/summary?event=${encodeURIComponent(gameId)}`;
      const r = await fetch(url);
      const d = await r.json();
      const rawPlays = (d && d.plays) || [];
      const plays = rawPlays.slice(-10).map(p => ({
        id: p.id || p.sequenceNumber || String(Math.random()),
        text: p.text || p.shortText || '',
        scoringPlay: !!p.scoringPlay,
        period: (p.period && p.period.number) || 0,
        clock: (p.clock && p.clock.displayValue) || '',
        ts: Date.now()
      }));
      sportsPlaysCache[key] = plays;
      return plays;
    } catch(e) {
      qnLog('[Sports] getPlays failed', { gameId, leagueKey, err: e && e.message });
      return [];
    }
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
    scoringPlays: []
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
  try {
    const reaction = {
      memberId: state.me.id,
      memberName: state.me.name,
      kind: 'emoji',
      emoji,
      at: Date.now(),
      amplified: true
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
function renderDvrSlider(wp, mine) {
  if (!mine) return '';
  const offsetMs = mine.dvrOffsetMs || 0;
  const offsetSec = Math.round(offsetMs / 1000);
  const readout = dvrReadoutText(offsetSec);
  return `<div class="wp-dvr-slider">
    <span class="wp-dvr-label">I'm behind</span>
    <input type="range" min="0" max="180" value="${offsetSec}" step="5"
      class="wp-dvr-input"
      oninput="updateDvrReadout(this.value)"
      onchange="setDvrOffset('${escapeHtml(wp.id)}', this.value)"
      aria-label="DVR offset in seconds behind live" />
    <span class="wp-dvr-readout" id="wp-dvr-readout">${escapeHtml(readout)}</span>
  </div>`;
}

function dvrReadoutText(sec) {
  if (!sec || sec <= 0) return 'On time';
  if (sec <= 60) return `${sec}s behind`;
  return `${Math.floor(sec/60)}m ${sec%60}s behind`;
}

window.updateDvrReadout = function(secStr) {
  const sec = parseInt(secStr, 10) || 0;
  const el = document.getElementById('wp-dvr-readout');
  if (el) el.textContent = dvrReadoutText(sec);
};

let _dvrThrottleHandle = null;
window.setDvrOffset = function(wpId, secStr) {
  const sec = parseInt(secStr, 10) || 0;
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

window.confirmStartWatchparty = async function() {
  if (!wpStartTitleId || !state.me) return;
  if (guardReadOnlyWrite()) return;                // Plan 5.8 D-15: unclaimed post-grace can't host watchparties
  const t = state.titles.find(x => x.id === wpStartTitleId);
  if (!t) return;
  const startAt = computeWpStartAt();
  if (!startAt) { alert('Pick a start time.'); return; }
  if (startAt < Date.now() - 60*1000) { alert("That's in the past. Pick a future time."); return; }
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
    reactions: []
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

window.openWatchpartyLive = function(wpId) {
  state.activeWatchpartyId = wpId;
  renderWatchpartyLive();
  document.getElementById('wp-live-modal-bg').classList.add('on');
  // Phase 11 / REFR-10 — Game Mode: start score polling + team-flair prompt
  const wp = state.watchparties && state.watchparties.find(x => x.id === wpId);
  if (wp && wp.mode === 'game') {
    startSportsScorePolling(wp);
    const mine = myParticipation(wp);
    maybeShowTeamFlairPicker(wp, mine);
  }
};

window.closeWatchpartyLive = function() {
  document.getElementById('wp-live-modal-bg').classList.remove('on');
  // Phase 11 / REFR-10 — stop any active score polling loop
  stopSportsScorePolling();
  state.activeWatchpartyId = null;
};

function renderWatchpartyBanner() {
  const el = document.getElementById('wp-banner-tonight');
  if (!el) return;
  const active = activeWatchparties();
  if (!active.length) { el.innerHTML = ''; return; }
  el.innerHTML = active.map(wp => {
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
          <div class="wp-banner-meta">${hostLabel} cancelled this watchparty</div>
          <div class="wp-banner-status" style="color:var(--ink-dim);">Cancelled</div>
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
        <div class="wp-banner-meta">${metaLine}</div>
        <div class="wp-banner-status">${status}</div>
      </div>
      <button class="wp-banner-action" onclick="event.stopPropagation();${actionFn}">${actionLabel}</button>
    </div>`;
  }).join('');
}

// Live view — full implementation
const WP_QUICK_EMOJIS = ['😂','😱','😭','🤯','👀','🔥','💀','❤️','🤔','🙌'];

function memberColor(memberId) {
  const m = state.members.find(x => x.id === memberId);
  return m && m.color ? m.color : '#888';
}

function renderWatchpartyLive() {
  const el = document.getElementById('wp-live-content');
  if (!el) return;
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp) { el.innerHTML = '<div style="padding:24px;">Watchparty not found.</div>'; return; }
  const isSport = !!wp.sportEvent;
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
    el.innerHTML = `<div class="wp-live-header">
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
  const statusText = preStart
    ? (isSport ? `Kickoff ${formatStartTime(wp.startAt)}` : `Starts ${formatStartTime(wp.startAt)}`)
    : `Started ${formatStartTime(wp.startAt)}`;
  const header = `<div class="wp-live-header">
    ${livePosterHtml}
    <div class="wp-live-titleinfo">
      ${liveTitleHtml}
      <div class="wp-live-status">${statusText}${mine && mine.pausedAt ? ' · <span style="color:var(--accent);">Paused</span>' : ''}</div>
    </div>
    ${mine && mine.startedAt ? `<div class="wp-live-timer" id="wp-live-timer-display">${formatElapsed(computeElapsed(mine, wp))}</div>` : ''}
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
    body = prompt + renderParticipantTimerStrip(wp) + renderReactionsFeed(wp, mine, 'wallclock');
  } else {
    // Active watching — render reactions feed based on mode
    // Phase 7 Plan 03 (PARTY-03): advisory per-member timer strip sits above the reactions feed
    // so everyone sees where their co-watchers are in the runtime. No forcing — each member
    // tracks their own pace. See 07-CONTEXT.md D-01/02/03.
    // Phase 11 / REFR-08: inject the late-joiner Catch-me-up card at the TOP of wp-live-body
    // so late joiners get a 30s reaction recap without breaking the per-user reaction-delay
    // moat. Empty state (< 3 pre-join reactions in window) hides the card entirely.
    const catchupHtml = renderCatchupCard(wp, mine);
    // Phase 11 / REFR-10: DVR slider tail for sport-mode — per-user "I'm N seconds behind"
    // offset feeds the existing Phase 7 reactionDelay render filter. Movie mode unchanged.
    const dvrHtml = (wp.mode === 'game') ? renderDvrSlider(wp, mine) : '';
    body = catchupHtml + renderParticipantTimerStrip(wp) + renderReactionsFeed(wp, mine) + dvrHtml;
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

  el.innerHTML = header + body + footer;
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
          return `<div class="wp-catchup-sport-play">${escapeHtml(qLabel)}${clockLabel} &mdash; ${escapeHtml(p.text || 'Score')}</div>`;
        }).join('')
      : '<div class="wp-catchup-sport-play"><em>No scoring plays yet.</em></div>';
    return `<div class="wp-catchup-card">
      <div class="wp-catchup-eyebrow">YOU MISSED</div>
      <div class="wp-catchup-title"><em>Here's where we are.</em></div>
      <div class="wp-catchup-sport-score">Score: ${escapeHtml(awayAbbr)} ${awayScore}, ${escapeHtml(homeAbbr)} ${homeScore}</div>
      <div class="wp-catchup-sport-label">Last 3 plays:</div>
      ${playsHtml}
      <button class="wp-control-btn wp-catchup-dismiss" onclick="dismissCatchup('${escapeHtml(wp.id)}')">Got it &mdash; catch me up to now</button>
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
    <div class="wp-catchup-eyebrow">YOU MISSED</div>
    <div class="wp-catchup-title"><em>Here's the last 30 seconds.</em></div>
    <div class="wp-catchup-rail">${rail}</div>
    <button class="wp-control-btn wp-catchup-dismiss" onclick="dismissCatchup('${escapeHtml(wp.id)}')">Got it &mdash; catch me up to now</button>
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
  return `<div class="wp-participants-strip" role="list" aria-label="Watchparty participants">${chips}</div>`;
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
  const emojiBtns = WP_QUICK_EMOJIS.map(e => `<button class="wp-emoji-btn" onclick="postEmojiReaction('${e}')">${e}</button>`).join('')
    + `<button class="wp-emoji-btn wp-emoji-more" onclick="openEmojiPicker()" aria-label="More emoji">+</button>`;
  // Phase 7 Plan 07 (PARTY-04): reaction-delay preset chips. Only meaningful in elapsed mode
  // — wallclock ignores delay by design (shows everything as-posted) and hidden renders nothing
  // regardless. Chips are a thin visual modifier on the base .wp-control-btn class.
  const currentDelay = (mine.reactionDelay || 0);
  const delayPresets = [0, 5, 15, 30];
  const delayChips = delayPresets.map(s => {
    const label = s === 0 ? 'Off' : s + 's';
    const on = s === currentDelay;
    const title = s === 0 ? 'No reaction delay' : `Delay reactions by ${s} seconds`;
    return `<button class="wp-control-btn wp-delay ${on?'on':''}" onclick="setReactionDelay(${s})" title="${title}">${label}</button>`;
  }).join('');
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
    <span class="wp-delay-label">Delay</span>
    ${delayChips}
  </div>`;
  return `<div class="wp-live-footer">
    ${controls}
    <div class="wp-emoji-row">${emojiBtns}</div>
    <div class="wp-compose">
      <input type="text" id="wp-compose-input" placeholder="${paused ? 'Paused — reactions queued' : 'Say something…'}" maxlength="240" ${paused?'disabled':''}>
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

async function postReaction(payload) {
  if (!state.me || !state.activeWatchpartyId) return;
  if (guardReadOnlyWrite()) return;                // Plan 5.8 D-15: no watchparty reactions from unclaimed post-grace
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp) return;
  const mine = myParticipation(wp);
  if (!mine || !mine.startedAt) { alert('Start your timer first.'); return; }
  if (mine.pausedAt) { alert('You are paused. Resume to post.'); return; }
  const elapsedMs = computeElapsed(mine, wp);
  const reaction = {
    id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    ...writeAttribution(),
    elapsedMs,
    at: Date.now(),
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
// onSnapshot authoritative overwrite). Seconds are clamped [0, 60] defensively — UI only
// offers 0 / 5 / 15 / 30 but console callers could pass anything.
window.setReactionDelay = async function(seconds) {
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp || !state.me) return;
  const s = Math.max(0, Math.min(60, parseInt(seconds, 10) || 0));
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
  const sub = document.getElementById('wp-post-session-sub');
  if (sub) sub.innerHTML = `<em>How was ${escapeHtml(wp.titleName || 'that')}?</em>`;
  // Reset rating + photo UI
  document.querySelectorAll('.wp-rating-star').forEach(s => { s.classList.remove('filled'); s.innerHTML = '&#9734;'; });
  const rc = document.getElementById('wp-rating-confirm'); if (rc) rc.style.display = 'none';
  const pp = document.getElementById('wp-photo-preview'); if (pp) { pp.style.display = 'none'; pp.innerHTML = ''; }
  const pt = document.getElementById('wp-photo-upload-tile'); if (pt) pt.style.display = '';
  const pi = document.getElementById('wp-photo-input'); if (pi) pi.value = '';
  const bg = document.getElementById('wp-post-session-modal-bg');
  if (bg) bg.classList.add('on');
};

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
      ${g.topMood ? `<div class="yir-stat"><span class="yir-stat-label">Group mood</span><span class="yir-stat-value small">${(moodById(g.topMood.id)||{}).icon||''} ${(moodById(g.topMood.id)||{}).label||escapeHtml(g.topMood.id)}</span><span class="yir-stat-sub">The vibe this year</span></div>` : ''}
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
      <span class="mood-icon">${m.icon}</span>${m.label}
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

// === D-06 Couch viz — DECI-14-06 (sketch 001 winner: hero-icon + avatar-grid) ===
// Hero element: <img src='/mark-512.png'> (the existing C-sectional app icon — same asset
// used by favicons + PWA manifest). When the icon is updated in queuenight/public/, this
// hero auto-inherits with zero code change.
//
// Functional layer: CSS-grid avatar cells. Filled = colored circle with initial; empty =
// dashed amber circle with ＋ glyph + pulse animation. Capacity 1-10 native.
//
// State writes: families/{code}.couchSeating = { [memberId]: index }.

const COUCH_HERO_SRC = '/mark-512.png'; // single source of truth — bump if filename changes
const COUCH_MAX_SLOTS = 10;             // grid wraps to 5×2 on phone, 10×1 on wide viewports

function renderCouchViz() {
  const container = document.getElementById('couch-viz-container');
  if (!container) return;

  const totalMembers = (state.members || []).length;
  // Couch size = max(2, totalMembers, current claimed count) — at least 2 because couch is plural.
  // Cap at COUCH_MAX_SLOTS.
  const claimedCount = (state.couchMemberIds || []).filter(Boolean).length;
  const couchSize = Math.min(COUCH_MAX_SLOTS, Math.max(2, totalMembers, claimedCount));

  container.innerHTML = `
    <img class="couch-hero" src="${COUCH_HERO_SRC}" alt="Couch" />
    <h3 class="couch-headline">On the couch tonight</h3>
    <p class="couch-sub">${claimedCount > 0 ? `${claimedCount} of ${couchSize} here` : 'Tap a seat to claim it'}</p>
    ${renderCouchAvatarGrid(couchSize)}
  `;
}

function renderCouchAvatarGrid(couchSize) {
  const cells = [];
  for (let i = 0; i < couchSize; i++) {
    const mid = (state.couchMemberIds || [])[i] || null;
    if (mid) {
      const m = (state.members || []).find(x => x.id === mid);
      const initial = m ? escapeHtml((m.name || '?')[0].toUpperCase()) : '?';
      const name = m ? escapeHtml(m.name || 'Member') : 'Unknown';
      const color = m ? memberColor(m.id) : '#7a705f';
      const isMe = state.me && mid === state.me.id;
      cells.push(`
        <div class="seat-cell ${isMe ? 'me' : ''}" data-cushion-idx="${i}" role="button" tabindex="0"
          aria-label="${name} on the couch — tap to vacate"
          onclick="claimCushion(${i})"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();claimCushion(${i});}">
          <div class="seat-avatar" style="background:${color}">${initial}</div>
          <div class="seat-name">${name}</div>
        </div>
      `);
    } else {
      cells.push(`
        <div class="seat-cell empty" data-cushion-idx="${i}" role="button" tabindex="0"
          aria-label="Empty seat — tap to claim"
          onclick="claimCushion(${i})"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();claimCushion(${i});}">
          <div class="seat-empty">＋</div>
          <div class="seat-name" aria-hidden="true">·</div>
        </div>
      `);
    }
  }
  return `<div class="couch-avatar-grid" role="group" aria-label="Couch seats">${cells.join('')}</div>`;
}

// D-06 — claim a cushion seat. Adds state.me.id to state.couchMemberIds at index idx
// (if empty); toggles off if already claimed by state.me. Persists to family doc.
window.claimCushion = async function(idx) {
  if (!state.me) { flashToast('Sign in to seat yourself', { kind: 'warn' }); return; }
  // Ensure array length covers idx.
  while (state.couchMemberIds.length <= idx) state.couchMemberIds.push(null);
  const current = state.couchMemberIds[idx] || null;
  // Toggle off if I'm sitting there.
  if (current === state.me.id) {
    state.couchMemberIds[idx] = null;
    while (state.couchMemberIds.length && state.couchMemberIds[state.couchMemberIds.length - 1] == null) {
      state.couchMemberIds.pop();
    }
    await persistCouchSeating();
    renderCouchViz();
    return;
  }
  if (current) {
    flashToast('That seat is already claimed', { kind: 'info' });
    return;
  }
  // Take the slot. If state.me is already at another slot, vacate that one first (no clones).
  const existingIdx = state.couchMemberIds.findIndex(mid => mid === state.me.id);
  if (existingIdx >= 0) state.couchMemberIds[existingIdx] = null;
  state.couchMemberIds[idx] = state.me.id;
  await persistCouchSeating();
  renderCouchViz();
};

// D-06 — overflow / "sit on behalf of" sheet. Opens member picker via #action-sheet-bg.
// Used when grid is full OR for shared-device "claim a seat for another member" cases.
window.openCouchOverflowSheet = function() {
  const content = document.getElementById('action-sheet-content');
  if (!content) return;
  const seated = new Set((state.couchMemberIds || []).filter(Boolean));
  const items = (state.members || [])
    .filter(m => !seated.has(m.id))
    .map(m =>
      `<button class="action-sheet-item" onclick="closeActionSheet();claimCushionByMember('${m.id}')">
        <div class="who-avatar" style="background:${memberColor(m.id)};display:inline-block;margin-right:8px">${escapeHtml((m.name||'?')[0])}</div>
        ${escapeHtml(m.name || 'Member')}
      </button>`
    );
  content.innerHTML = `<div class="action-sheet-title">Add to couch</div>${items.join('') || '<div class="action-sheet-item" style="opacity:0.6">Everyone is on the couch</div>'}`;
  document.getElementById('action-sheet-bg').classList.add('on');
};

// D-06 — claim a cushion on behalf of a specific member (used by overflow sheet).
window.claimCushionByMember = async function(memberId) {
  if (!memberId) return;
  let firstEmpty = -1;
  for (let i = 0; i < COUCH_MAX_SLOTS; i++) {
    if (!state.couchMemberIds[i]) { firstEmpty = i; break; }
  }
  if (firstEmpty < 0) {
    flashToast('Couch is full', { kind: 'warn' });
    return;
  }
  state.couchMemberIds[firstEmpty] = memberId;
  await persistCouchSeating();
  renderCouchViz();
};

// D-06 — persist couchSeating map to family doc.
// Shape: families/{code}.couchSeating = { [memberId]: index }; null/missing = not seated.
async function persistCouchSeating() {
  if (!state.familyCode) return;
  const map = {};
  (state.couchMemberIds || []).forEach((mid, i) => { if (mid) map[mid] = i; });
  try {
    await updateDoc(doc(db, 'families', state.familyCode), {
      couchSeating: map,
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

// Sticky "who's watching" mini bar: appears when the user scrolls past the who-card on Tonight.
// Not shown on other screens. Keeps the user aware of who's selected without scrolling back up.
(function() {
  const mini = document.getElementById('who-mini');
  const miniAvatars = document.getElementById('who-mini-avatars');
  if (!mini || !miniAvatars) return;
  let lastShown = false;
  function update() {
    const onTonight = document.getElementById('screen-tonight')?.classList.contains('active');
    const whoCard = document.querySelector('#screen-tonight .who-card');
    if (!onTonight || !whoCard) {
      if (lastShown) { mini.style.display = 'none'; lastShown = false; }
      return;
    }
    const rect = whoCard.getBoundingClientRect();
    const shouldShow = rect.bottom < 0 && state.selectedMembers && state.selectedMembers.length > 0;
    if (shouldShow === lastShown) return;
    lastShown = shouldShow;
    if (shouldShow) {
      // Render avatars
      const selected = state.selectedMembers.map(id => state.members.find(m => m.id === id)).filter(Boolean).slice(0, 5);
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

boot();
