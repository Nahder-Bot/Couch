import { state } from './state.js';

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Tiny haptic tap for tactile feedback. Gracefully no-ops where unsupported.
export function haptic(strength) {
  try {
    if (!navigator.vibrate) return;
    const ms = strength === 'light' ? 8 : strength === 'medium' ? 15 : strength === 'success' ? [10, 40, 10] : 10;
    navigator.vibrate(ms);
  } catch(e) {}
}

// Non-blocking toast notification. Stacks up to 3; each auto-dismisses after 3.5s.
let toastContainer = null;
export function flashToast(message, opts) {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  const kind = (opts && opts.kind) || 'info';
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + kind;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  // Cap visible toasts to 3, oldest drops first
  while (toastContainer.children.length > 3) toastContainer.removeChild(toastContainer.firstChild);
  // Trigger the in-transition on next frame
  requestAnimationFrame(() => toast.classList.add('on'));
  setTimeout(() => {
    toast.classList.remove('on');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 260);
  }, 3500);
}
// Skeleton row for discovery-style horizontal scrollers. Returns 5 shimmering cards.
export function skDiscoverRow(count) {
  const n = count || 5;
  const widths = [80, 65, 75, 60, 85, 55, 70, 80];
  let html = '<div class="sk-row-posters" aria-hidden="true">';
  for (let i = 0; i < n; i++) {
    html += `<div class="sk-discover-card"><div class="sk sk-poster"></div><div class="sk sk-line" style="width:${widths[i % widths.length]}%;"></div></div>`;
  }
  return html + '</div>';
}
// Skeleton rows for title-card lists
export function skTitleList(count) {
  const n = count || 3;
  let html = '';
  for (let i = 0; i < n; i++) {
    html += '<div class="sk-title"><div class="sk sk-poster"></div><div class="sk-title-body"><div class="sk sk-line" style="width:70%;height:14px;"></div><div class="sk sk-line" style="width:40%;"></div><div class="sk sk-line" style="width:55%;margin-top:8px;"></div></div></div>';
  }
  return html;
}
// Deterministic color from a string — same title always gets the same color.
export const POSTER_COLORS = ['#7a4a3c','#3d5a4e','#5c4a6e','#6e4a3c','#3c5a6e','#6e5c3c','#4a3c5e','#5e3c4a'];
export function colorFor(name) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return POSTER_COLORS[Math.abs(h) % POSTER_COLORS.length];
}
export function posterStyle(t) {
  if (t.poster) return `background-image:url('${t.poster}')`;
  return `background:${colorFor(t.name)}`;
}
export function posterFallbackLetter(t) {
  if (t.poster) return '';
  const letter = (t.name || '?').trim().charAt(0).toUpperCase();
  return `<span class="tc-poster-letter">${escapeHtml(letter)}</span>`;
}

/**
 * writeAttribution — canonical payload builder for every Firestore write
 * that previously carried { memberId, memberName }. Returns a fragment to
 * be spread into the write payload. During the grace window (D-15), writes
 * dual-carry legacy memberId + memberName alongside the new actingUid +
 * managedMemberId fields, so pre-auth reads and post-auth reads both work.
 *
 * Snapshot-then-clear semantics: reads state.actingAs into a local before
 * constructing the payload, then clears state.actingAs and
 * state.actingAsName. This matches the VETO-03 post-spin-veto pattern — a
 * re-render between the call and the write resolve cannot mis-attribute.
 *
 * @param {object} extraFields  — optional extra keys merged into the payload
 * @returns {object}  — { actingUid, managedMemberId?, memberId, memberName, ...extraFields }
 */
export function writeAttribution(extraFields = {}) {
  const actingUid = (state.auth && state.auth.uid) || null;
  const actingAsSubProfile = state.actingAs || null;
  const actingAsName = state.actingAsName || null;
  const payload = {
    actingUid,
    ...(actingAsSubProfile ? { managedMemberId: actingAsSubProfile } : {}),
    // Dual-write (D-20): legacy memberId + memberName remain for grace-window readers
    memberId: actingAsSubProfile || (state.me && state.me.id) || null,
    memberName: actingAsName || (state.me && state.me.name) || null,
    ...extraFields
  };
  // D-04 per-action semantics: clear acting-as so the next write is self-attributed
  if (actingAsSubProfile) { state.actingAs = null; state.actingAsName = null; }
  return payload;
}
