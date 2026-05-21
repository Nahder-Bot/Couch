// Phase 31-02 — Demo family seeder for marketing screenshots.
//
// HOW TO USE:
//   1. Open https://couchtonight.app in a desktop browser
//   2. Sign in with email link to `nahderz+demo@gmail.com` (NEW account — Gmail
//      plus-addressing routes to your normal inbox, but Firebase Auth treats it
//      as a distinct UID)
//   3. After signin, you'll land on the "Pull up to your Family" screen. STOP HERE —
//      DO NOT enter a family code or create a family. The script does it for you.
//   4. Open browser DevTools console (F12 → Console)
//   5. Paste the ENTIRE contents of this file into the console and hit Enter
//   6. Wait ~15 seconds for the seed to complete (TMDB rate-limited, sequential)
//   7. Reload the page (Cmd-R / F5) — "Movie Night" family loads with 4 members + 12 titles
//   8. On iPhone: sign into the same `nahderz+demo@gmail.com` account → same family loads
//   9. Capture screenshots per .planning/phases/31-marketing-refresh/31-02-PLAN.md
//
// SAFETY:
//   - Uses your live Firebase auth session — no service account needed
//   - All writes go through Firestore rules (no admin SDK bypass)
//   - Family code is `movienightdemo` — if it already exists, the script aborts
//   - Sub-profile members are gitignored from your real family (different family doc)
//   - To clean up later: sign in as the demo account, leave the group from Account tab
//
// WHAT GETS CREATED:
//   - families/movienightdemo (ownerUid = you)
//   - 4 members: Liam (you, parent), Maya (kid), Ava (kid), Noah (kid)
//     ↳ 3 sub-profile kids satisfies V5 couch-viz "≥1 kid avatar" (D-06)
//   - 12 titles spanning genres referenced in landing copy (Severance, Lupin, etc.)
//   - users/{uid}/groups/movienightdemo (index doc so PWA auto-loads on iPhone)

(async () => {
  console.log('[seed] Starting Movie Night demo family seeder…');

  // ─── 1. Pull live module instances (dynamic import of same URL returns the
  // ─── singleton already loaded by the page, so we get the same Firestore + Auth)
  const firebaseMod = await import('/js/firebase.js');
  const { db, auth, doc, setDoc } = firebaseMod;

  const user = auth.currentUser;
  if (!user) {
    console.error('[seed] FAIL: not signed in. Sign in with email link first.');
    return;
  }
  console.log('[seed] Signed in as:', user.email, 'uid:', user.uid);

  if (!user.email || !user.email.includes('+demo')) {
    const ok = confirm(
      `[seed] You are signed in as ${user.email}.\n\n` +
      `Expected a demo account like nahderz+demo@gmail.com (with +demo).\n` +
      `Running this against your REAL account will pollute your real-family Firestore.\n\n` +
      `OK to continue anyway?`
    );
    if (!ok) { console.log('[seed] Aborted by user.'); return; }
  }

  const FAMILY_CODE = 'movienightdemo';
  const TMDB_KEY = '2ec1f3699afc80f35392f5a674eb9da3';
  const COLORS = ['#e8a04a','#d97757','#c44536','#a87354','#7fb069','#5e8c6a','#b08968','#9c6f4a'];

  // No pre-flight getDoc() — non-members can't read families/{code} per rules.
  // Family create will fail with permission-denied if it already exists (rule
  // `!exists(...)` blocks it server-side), which is the same outcome we want.

  // ─── 2. Create family doc (ownerUid = signed-in user) ───
  try {
    await setDoc(doc(db, 'families', FAMILY_CODE), {
      code: FAMILY_CODE,
      mode: 'family',
      createdAt: Date.now(),
      ownerUid: user.uid,
      name: 'Movie Night'
    });
  } catch (e) {
    console.error(`[seed] FAIL creating families/${FAMILY_CODE}:`, e.code, e.message);
    console.error(`[seed] Likely cause: code already taken. Delete the doc in Firebase console or pick a new FAMILY_CODE.`);
    return;
  }
  console.log('[seed] ✓ Family doc created:', FAMILY_CODE);

  // ─── 4. Write users/{uid}/groups/{code} index FIRST so isMemberOfFamily()
  // ─── returns true for subsequent member + title writes (rules dep) ───
  await setDoc(doc(db, 'users', user.uid, 'groups', FAMILY_CODE), {
    familyCode: FAMILY_CODE,
    name: 'Movie Night',
    mode: 'family',
    joinedAt: Date.now(),
    lastActiveAt: Date.now()
  });
  console.log('[seed] ✓ users/groups index written');

  // ─── 5. Create members ───
  // Owner: Liam (you — uid attached, parent flag, age 38)
  const ownerMemberId = `m_${user.uid}`;
  await setDoc(doc(db, 'families', FAMILY_CODE, 'members', ownerMemberId), {
    id: ownerMemberId,
    uid: user.uid,
    name: 'Liam',
    color: COLORS[0],
    isParent: true,
    age: 38,
    joinedAt: Date.now()
  });
  console.log('[seed] ✓ Owner member created: Liam');

  // 3 sub-profiles (NO uid → satisfies sub-profile rule Branch B; managedBy=self)
  const subProfiles = [
    { name: 'Maya', color: COLORS[3], age: 36 },     // adult-coded sub-profile (no uid yet)
    { name: 'Ava',  color: COLORS[5], age: 9 },      // kid
    { name: 'Noah', color: COLORS[6], age: 6 }       // kid
  ];
  const memberIds = [ownerMemberId];
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
    memberIds.push(memberId);
    console.log('[seed]   ✓ Sub-profile:', sub.name);
    await new Promise(r => setTimeout(r, 150)); // small gap to keep timestamps distinct
  }

  // ─── 6. TMDB search + title docs ───
  // Curated to match landing copy voice (Severance / Lupin / The Bear ↔ adult drama,
  // Bluey / Spy Family / Paddington ↔ kid+family). Mood IDs match constants.js MOODS.
  const titleSeeds = [
    { q: 'Severance',          type: 'tv',    moods: ['darkfunny', 'mindbending']        },
    { q: 'Lupin',              type: 'tv',    moods: ['action', 'twisty']                },
    { q: 'The Bear',           type: 'tv',    moods: ['darkfunny', 'real']               },
    { q: 'Andor',              type: 'tv',    moods: ['action', 'serious']               },
    { q: 'Bluey',              type: 'tv',    moods: ['cozy', 'feelgood']                },
    { q: 'Spy x Family',       type: 'tv',    moods: ['feelgood', 'action']              },
    { q: 'Knives Out',         type: 'movie', moods: ['twisty', 'darkfunny']             },
    { q: 'Paddington 2',       type: 'movie', moods: ['cozy', 'feelgood']                },
    { q: 'Past Lives',         type: 'movie', moods: ['real', 'serious']                 },
    { q: 'Mickey 17',          type: 'movie', moods: ['mindbending', 'darkfunny']        },
    { q: 'Encanto',            type: 'movie', moods: ['feelgood', 'cozy']                },
    { q: 'The Super Mario Bros. Movie', type: 'movie', moods: ['feelgood', 'action']     }
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

      const titleDoc = {
        id: titleId,
        tmdbId: hit.id,
        mediaType: seed.type,
        kind: seed.type === 'tv' ? 'TV' : 'Movie',
        name: titleName,
        year,
        poster,
        moods: seed.moods,
        votes: {},
        watched: false,
        queues: { [ownerMemberId]: titleCount + 1 },
        // attribution echo — required by attributedWrite() rule helper
        actingUid: user.uid,
        memberId: ownerMemberId,
        memberName: 'Liam',
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'families', FAMILY_CODE, 'titles', titleId), titleDoc);
      titleCount++;
      console.log(`[seed]   ✓ ${titleCount}/${titleSeeds.length}: ${titleName} (${year})`);

      // Rate-limit: TMDB allows ~40/10s, we do ~6/s so well under
      await new Promise(res => setTimeout(res, 250));
    } catch (e) {
      console.warn('[seed]   ⚠ Failed:', seed.q, e.message);
    }
  }

  console.log('');
  console.log('[seed] ════════════════════════════════════════');
  console.log('[seed] DONE.');
  console.log('[seed]   Family:    Movie Night (code: ' + FAMILY_CODE + ')');
  console.log('[seed]   Owner:     Liam (you)');
  console.log('[seed]   Members:   4 (Liam, Maya, Ava, Noah)');
  console.log('[seed]   Titles:    ' + titleCount + ' / ' + titleSeeds.length);
  console.log('[seed] ════════════════════════════════════════');
  console.log('[seed] NEXT: Reload this page (Cmd-R / F5) — Movie Night loads.');
  console.log('[seed]       Then sign into the SAME account on iPhone PWA.');
  console.log('[seed]       Capture screenshots per 31-02-PLAN.md.');
})();
