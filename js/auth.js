// js/auth.js — Firebase Auth helpers for Phase 5
// All OAuth flows use redirect (not popup) per D-06: popups blocked in iOS standalone PWA.

import {
  auth,
  GoogleAuthProvider, OAuthProvider,
  signInWithRedirect, getRedirectResult,
  signInWithPhoneNumber, RecaptchaVerifier,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  onAuthStateChanged, firebaseSignOut
} from './firebase.js';

// ===== Bootstrap: call ONCE at app boot before any UI render =====
// Returns the redirect result if the user just returned from an OAuth redirect, else null.
export async function bootstrapAuth() {
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
  await signInWithRedirect(auth, provider);
  // Execution stops here — browser redirects away.
}

// Apple Sign-In — exported but NOT surfaced in Phase 5 UI (deferred to Phase 9).
// See .planning/seeds/phase-09-apple-signin.md for rationale.
export async function signInWithApple() {
  _stashTokensFromUrl();
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
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
    email = window.prompt('Please confirm your email address to sign in:');
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
