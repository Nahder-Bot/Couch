// js/auth.js — Firebase Auth helpers for Phase 5
// OAuth provider sign-in: popup for Safari (non-PWA), redirect everywhere else.
// iOS standalone PWA keeps redirect per D-06 (popups blocked in standalone). Safari (non-PWA)
// must use popup because signInWithRedirect leaves couchtonight.app/__/auth/handler in the
// session history; Safari ITP / storage partitioning wipes the auth nonce sessionStorage,
// then bfcache restores the handler page on back/forward and Firebase's hosted handler
// renders "Unable to process request due to missing initial state". Popup keeps the OAuth
// dance off the back/forward stack entirely.

import {
  auth,
  GoogleAuthProvider, OAuthProvider,
  signInWithRedirect, signInWithPopup, getRedirectResult,
  signInWithPhoneNumber, RecaptchaVerifier,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  onAuthStateChanged, firebaseSignOut
} from './firebase.js';
import { promptInDom, flashToast } from './utils.js';

// Decide whether to use signInWithPopup (Safari non-PWA) vs signInWithRedirect (everywhere else).
function _shouldUsePopup() {
  try {
    // iOS standalone PWA (Add to Home Screen): popups are blocked. Must use redirect.
    if (typeof navigator !== 'undefined' && navigator.standalone === true) return false;
    // Android / desktop standalone PWA: same constraint.
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return false;
    // Safari = Apple WebKit on iOS/macOS, excluding the in-iOS variants of Chrome/Firefox/Edge/Opera.
    const ua = navigator.userAgent || '';
    return /Safari\//.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua);
  } catch(e) { return false; }
}

// ===== Bootstrap: call ONCE at app boot before any UI render =====
// Returns the redirect result if the user just returned from an OAuth redirect, else null.
export async function bootstrapAuth() {
  // bfcache guard: if this navigation is back_forward, the page is being restored from
  // bfcache. The redirect result (if any) was already consumed on the original navigation;
  // re-calling getRedirectResult would attempt to read sessionStorage state that Safari
  // ITP / storage partitioning may have wiped, surfacing "missing initial state".
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    if (nav?.type === 'back_forward') {
      return { freshFromRedirect: false, user: null };
    }
  } catch(e) { /* performance API unavailable — fall through */ }

  let redirectResult = null;
  try {
    redirectResult = await getRedirectResult(auth);
  } catch(e) {
    // Redirect failed (e.g. popup blocked fallback, network issue).
    // Log but don't throw — the app continues to the sign-in screen.
    console.error('[auth] getRedirectResult error', e);
  }
  return { freshFromRedirect: !!(redirectResult && redirectResult.user), user: redirectResult?.user || null };
}

// ===== Persistent auth-state watcher =====
// Returns an unsubscribe function. Pass a callback (user) => void.
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// ===== Provider sign-in =====

export async function signInWithGoogle() {
  // Stash any pending claim/invite tokens from the URL before the redirect wipes them
  _stashTokensFromUrl();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (_shouldUsePopup()) {
    // Safari (non-PWA): popup avoids the redirect-handler bfcache trap. Direct user gesture
    // from the button tap makes popup allowed on iOS Safari + macOS Safari.
    await signInWithPopup(auth, provider);
    return;
  }
  await signInWithRedirect(auth, provider);
  // Execution stops here — browser redirects away (non-Safari path).
}

// Apple Sign-In — exported but NOT surfaced in Phase 5 UI (deferred to Phase 9).
// See .planning/seeds/phase-09-apple-signin.md for rationale.
export async function signInWithApple() {
  _stashTokensFromUrl();
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  if (_shouldUsePopup()) {
    await signInWithPopup(auth, provider);
    return;
  }
  await signInWithRedirect(auth, provider);
}

// ===== Email link (passwordless magic link) =====

export async function sendEmailLink(email) {
  const actionCodeSettings = {
    url: window.location.origin + window.location.pathname,
    handleCodeInApp: true
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  // Stash the email so completeEmailLinkIfPresent can retrieve it
  try { localStorage.setItem('qn_email_for_link', email); } catch(e) {}
}

// Call this at boot — if the current URL is a magic link, complete sign-in.
export async function completeEmailLinkIfPresent() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  let email = null;
  try { email = localStorage.getItem('qn_email_for_link'); } catch(e) {}
  if (!email) {
    // window.prompt() returns null instantly inside iOS WKWebView (PWABuilder
    // wrapper installs no UIAlertController bridge) — the email-link flow
    // appeared to silently fail on cross-device sign-in. Replaced with an
    // in-DOM modal (Tier 3 / WKWebView fallback fix).
    email = await promptInDom({
      title: 'Confirm your email',
      body: "We sent the sign-in link to a different device. Enter the email you used so we can finish signing you in.",
      inputType: 'email',
      inputAutocomplete: 'email',
      inputPlaceholder: 'you@example.com',
      confirmLabel: 'Sign in'
    });
  }
  if (!email) return null;
  try {
    const result = await signInWithEmailLink(auth, email, window.location.href);
    try { localStorage.removeItem('qn_email_for_link'); } catch(e) {}
    // Clean the magic-link token from the URL
    try { history.replaceState(null, '', window.location.pathname + window.location.search.replace(/[?&]?apiKey=[^&]*/g,'').replace(/[?&]?oobCode=[^&]*/g,'').replace(/[?&]?mode=[^&]*/g,'').replace(/^&/,'?') || window.location.pathname); } catch(e) {}
    return result.user;
  } catch(e) {
    console.error('[auth] email link sign-in failed', e);
    try { flashToast('Sign-in link is invalid or expired. Try sending yourself a new one.', { kind: 'warn' }); } catch(e2) {}
    return null;
  }
}

// ===== Phone (SMS) auth =====

let _recaptchaVerifier = null;

export function initPhoneCaptcha(btnId) {
  if (_recaptchaVerifier) return;
  try {
    _recaptchaVerifier = new RecaptchaVerifier(auth, btnId, {
      size: 'invisible',
      callback: () => {}
    });
  } catch(e) {
    console.error('[auth] RecaptchaVerifier init failed', e);
  }
}

export function resetPhoneCaptcha() {
  if (_recaptchaVerifier) {
    try { _recaptchaVerifier.clear(); } catch(e) {}
    _recaptchaVerifier = null;
  }
}

export async function sendPhoneCode(phoneE164, btnId) {
  initPhoneCaptcha(btnId);
  if (!_recaptchaVerifier) throw new Error('reCAPTCHA not initialized');
  const confirmation = await signInWithPhoneNumber(auth, phoneE164, _recaptchaVerifier);
  return confirmation; // caller calls confirmation.confirm(code)
}

// ===== Sign out =====

export async function signOutUser() {
  await firebaseSignOut(auth);
}

// ===== Internal helpers =====

// Stash claim/invite tokens from the URL into sessionStorage BEFORE a redirect
// wipes them. Called by signInWithGoogle / signInWithApple before redirect.
function _stashTokensFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const claim = params.get('claim');
    const claimFamily = params.get('family');
    const invite = params.get('invite');
    if (claim) sessionStorage.setItem('qn_claim', claim);
    if (claimFamily) sessionStorage.setItem('qn_claim_family', claimFamily);
    if (invite) sessionStorage.setItem('qn_invite', invite);
    // Also remove from URL now so it doesn't sit in history
    if (claim || invite) {
      try {
        const u = new URL(window.location.href);
        ['claim','family','invite'].forEach(k => u.searchParams.delete(k));
        history.replaceState(null, '', u.toString());
      } catch(e) {}
    }
  } catch(e) {}
}
