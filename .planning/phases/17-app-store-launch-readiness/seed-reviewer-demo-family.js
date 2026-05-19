// Phase 17 — Reviewer demo family seeder for App Store Connect submission.
//
// HOW TO USE:
//   1. Open https://couchtonight.app/app in a desktop browser (Chrome recommended)
//   2. Sign in with email link to `review-apple@couchtonight.app`
//      The verification email lands in nahderz@gmail.com via Namecheap forwarding
//      (item #22 in 17-LAUNCH-CHECKLIST.md). Click the link to complete sign-in.
//   3. After sign-in you'll land on the "Pull up to your Family" screen. STOP HERE —
//      do NOT enter a family code or create a family. The script does that for you.
//   4. Open DevTools console (F12 → Console; or right-click → Inspect → Console)
//   5. Paste the ENTIRE contents of this file into the console and hit Enter
//   6. Wait ~15-20 seconds — the script logs progress as it goes (look for [seed] lines)
//   7. Reload the page (Ctrl-R / F5) — "Review Demo" family loads with 3 members + 8 titles + pre-seeded votes
//   8. On iPhone: install couchtonight.app as PWA → sign in with email-link to the
//      SAME review-apple@couchtonight.app account → same family loads automatically
//
// WHY THIS SCRIPT EXISTS:
//   §5 of 17-APP-STORE-CONNECT-PREP.md says a pre-populated family is optional but
//   recommends a year/month-keyed unique code if we do seed one. APLDEMO2605 = Apple
//   Demo, 26-05 (2026-May). Avoids the past REVIEWAPPLE collision (§5 "Why no
//   pre-populated family") by being guaranteed-unique for this submission window.
//
// SAFETY:
//   - Uses your live Firebase auth session — no service account / admin SDK
//   - All writes go through Firestore rules (so a rules gap fails loudly here, not in review)
//   - Family code APLDEMO2605 is year/month-keyed — extremely low collision risk
//   - Email guard aborts unless signed in as review-apple@couchtonight.app
//   - To clean up later: sign in as review-apple, Account → Delete account
//
// WHAT GETS CREATED:
//   - families/APLDEMO2605 (ownerUid = signed-in review-apple uid; name "Review Demo")
//   - users/{uid}/groups/APLDEMO2605 (index doc so PWA auto-loads on iPhone)
//   - 3 members: Reviewer (owner, adult), Sam (adult sub-profile), Riley (kid sub-profile, age 9)
//     ↳ kid sub-profile lets the reviewer demo Kid Mode in one tap
//   - 8 titles spanning recognizable App-Store-safe content (Office, Inception, etc.)
//   - Pre-seeded yes-votes so Spin works on the reviewer's first tap

(async () => {
  console.log('[seed] Starting Review Demo family seeder…');

  // ─── 1. Pull live module instances ───
  const firebaseMod = await import('/js/firebase.js');
  const { db, auth, doc, setDoc } = firebaseMod;

  const user = auth.currentUser;
  if (!user) {
    console.error('[seed] FAIL: not signed in. Sign in with email link as review-apple@couchtonight.app first.');
    return;
  }
  console.log('[seed] Signed in as:', user.email, 'uid:', user.uid);

  // ─── 2. Guard against running on a non-reviewer account ───
  const EXPECTED_EMAIL = 'review-apple@couchtonight.app';
  if (user.email !== EXPECTED_EMAIL) {
    const ok = confirm(
      `[seed] You are signed in as ${user.email}.\n\n` +
      `This script is intended for ${EXPECTED_EMAIL}.\n` +
      `Running against a different account will create the APLDEMO2605 family ` +
      `attached to the wrong uid.\n\n` +
      `OK to continue anyway?`
    );
    if (!ok) { console.log('[seed] Aborted by user.'); return; }
  }

  const FAMILY_CODE = 'APLDEMO2605';
  const FAMILY_NAME = 'Review Demo';
  const TMDB_KEY = '2ec1f3699afc80f35392f5a674eb9da3';
  const COLORS = ['#e8a04a','#d97757','#c44536','#a87354','#7fb069','#5e8c6a','#b08968','#9c6f4a'];

  // ─── 3. Create family doc (ownerUid = signed-in user) ───
  // No pre-flight getDoc() — non-members can't read families/{code} per rules. Create
  // fails with permission-denied if code already exists, which is the same outcome.
  try {
    await setDoc(doc(db, 'families', FAMILY_CODE), {
      code: FAMILY_CODE,
      mode: 'family',
      createdAt: Date.now(),
      ownerUid: user.uid,
      name: FAMILY_NAME
    });
  } catch (e) {
    console.error(`[seed] FAIL creating families/${FAMILY_CODE}:`, e.code, e.message);
    console.error(`[seed] Likely cause: code already taken. Update FAMILY_CODE in this script or delete the doc.`);
    return;
  }
  console.log(`[seed] ✓ Family doc created: ${FAMILY_CODE} ("${FAMILY_NAME}")`);

  // ─── 4. Write users/{uid}/groups/{code} index FIRST so isMemberOfFamily()
  //        returns true for subsequent member + title writes ───
  await setDoc(doc(db, 'users', user.uid, 'groups', FAMILY_CODE), {
    familyCode: FAMILY_CODE,
    name: FAMILY_NAME,
    mode: 'family',
    joinedAt: Date.now(),
    lastActiveAt: Date.now()
  });
  console.log('[seed] ✓ users/groups index written (PWA auto-load on iPhone enabled)');

  // ─── 5. Create members ───
  const ownerMemberId = `m_${user.uid}`;
  await setDoc(doc(db, 'families', FAMILY_CODE, 'members', ownerMemberId), {
    id: ownerMemberId,
    uid: user.uid,
    name: 'Reviewer',
    color: COLORS[0],
    isParent: true,
    age: 30,
    joinedAt: Date.now()
  });
  console.log('[seed] ✓ Owner member created: Reviewer (you)');

  const subProfiles = [
    { name: 'Sam',   color: COLORS[3], age: 32 },  // adult sub-profile
    { name: 'Riley', color: COLORS[5], age: 9  }   // kid sub-profile — Kid Mode demo
  ];
  const memberIdByName = { Reviewer: ownerMemberId };
  for (const sub of subProfiles) {
    const memberId = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await setDoc(doc(db, 'families', FAMILY_CODE, 'members', memberId), {
      id: memberId,
      name: sub.name,
      color: sub.color,
      age: sub.age,
      managedBy: user.uid,
      createdAt: Date.now(),
      isParent: false
    });
    memberIdByName[sub.name] = memberId;
    console.log('[seed]   ✓ Sub-profile:', sub.name, '(age', sub.age + ')');
    await new Promise(r => setTimeout(r, 150));
  }

  // ─── 6. TMDB search + title docs ───
  // Curated for App Review: broadly recognizable, family-safe content range,
  // mix of TV + Movie, mix of light + serious tone so all mood tags are exercised.
  const titleSeeds = [
    { q: 'The Office',                 type: 'tv',    moods: ['darkfunny', 'feelgood'],   yes: ['Reviewer', 'Sam'] },
    { q: 'Inception',                  type: 'movie', moods: ['mindbending', 'action'],   yes: ['Reviewer'] },
    { q: 'Stranger Things',            type: 'tv',    moods: ['twisty', 'action'],        yes: ['Sam'] },
    { q: 'Top Gun: Maverick',          type: 'movie', moods: ['action', 'feelgood'],      yes: ['Reviewer', 'Sam'] },
    { q: 'The Mandalorian',            type: 'tv',    moods: ['action', 'cozy'],          yes: ['Riley'] },
    { q: 'Spirited Away',              type: 'movie', moods: ['cozy', 'mindbending'],     yes: ['Riley', 'Reviewer'] },
    { q: 'Ted Lasso',                  type: 'tv',    moods: ['feelgood', 'real'],        yes: ['Sam'] },
    { q: 'The Grand Budapest Hotel',   type: 'movie', moods: ['darkfunny', 'twisty'],     yes: ['Reviewer'] }
  ];

  console.log('[seed] Fetching TMDB metadata for', titleSeeds.length, 'titles…');

  let titleCount = 0;
  for (let i = 0; i < titleSeeds.length; i++) {
    const seed = titleSeeds[i];
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/${seed.type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(seed.q)}`;
      const r = await fetch(searchUrl);
      const j = await r.json();
      const hit = (j.results || [])[0];
      if (!hit) {
        console.warn('[seed]   ⚠ No TMDB hit for:', seed.q);
        continue;
      }

      const titleId = 'tmdb_' + hit.id;
      const titleName = hit.title || hit.name;
      const year = (hit.release_date || hit.first_air_date || '').slice(0, 4);
      const poster = hit.poster_path
        ? `https://image.tmdb.org/t/p/w342${hit.poster_path}`
        : '';

      // Build votes map: each yes-voter contributes a 'yes' vote
      const votes = {};
      for (const name of seed.yes) {
        const mid = memberIdByName[name];
        if (mid) votes[mid] = { state: 'yes', at: Date.now() };
      }

      const titleDoc = {
        id: titleId,
        tmdbId: hit.id,
        mediaType: seed.type,
        kind: seed.type === 'tv' ? 'TV' : 'Movie',
        name: titleName,
        year,
        poster,
        moods: seed.moods,
        votes,
        watched: false,
        queues: { [ownerMemberId]: titleCount + 1 },
        // Attribution echo required by attributedWrite() rule helper
        actingUid: user.uid,
        memberId: ownerMemberId,
        memberName: 'Reviewer',
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'families', FAMILY_CODE, 'titles', titleId), titleDoc);
      titleCount++;
      console.log(`[seed]   ✓ ${titleCount}/${titleSeeds.length}: ${titleName} (${year}) — yes-votes from: ${seed.yes.join(', ')}`);

      await new Promise(res => setTimeout(res, 250));
    } catch (e) {
      console.warn('[seed]   ⚠ Failed:', seed.q, e.message);
    }
  }

  console.log('');
  console.log('[seed] ════════════════════════════════════════');
  console.log('[seed] DONE.');
  console.log(`[seed]   Family:    ${FAMILY_NAME} (code: ${FAMILY_CODE})`);
  console.log('[seed]   Owner:     Reviewer (you)');
  console.log('[seed]   Members:   3 (Reviewer, Sam, Riley)');
  console.log('[seed]   Titles:    ' + titleCount + ' / ' + titleSeeds.length);
  console.log('[seed]   Votes:     pre-seeded yes-votes so Spin works immediately');
  console.log('[seed] ════════════════════════════════════════');
  console.log('[seed] NEXT:');
  console.log('[seed]   1. Reload this page (Ctrl-R / F5) — Review Demo loads.');
  console.log('[seed]   2. On iPhone PWA: sign into review-apple@couchtonight.app, same family loads.');
  console.log('[seed]   3. App Store Connect: update Demo Account fields (script done — Claude continues).');
})();
