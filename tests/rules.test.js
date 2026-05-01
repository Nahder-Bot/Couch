/**
 * Firestore Rules Unit Tests — Phase 5 Auth + Groups
 *
 * Runs against the Firestore emulator (started by `firebase emulators:exec`).
 * Covers all 14 critical scenarios from 05-04-PLAN.md Task 2.
 *
 * Usage:
 *   cd tests && npm install && npm test
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'queuenight-84044';
const RULES_FILE = path.resolve(__dirname, '..', 'firestore.rules');

const UID_OWNER = 'UID_OWNER';
const UID_MEMBER = 'UID_MEMBER';
const UID_STRANGER = 'UID_STRANGER';

let testEnv;
let failed = 0;
let passed = 0;

// ---------- tiny test harness (so we don't need mocha/jest) ----------
async function it(name, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}`);
    console.error(`      ${err.message}`);
    failed++;
  }
}
async function describe(name, fn) {
  console.log(`\n${name}`);
  await fn();
}


async function seed() {
  // Use the "security-rules-bypass" context to seed data without triggering rules.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Date.now();

    await db.doc('settings/auth').set({
      graceUntil: now + 1e9,
      mode: 'grace',
      bootstrappedAt: now,
    });

    await db.doc('families/fam1').set({
      ownerUid: UID_OWNER,
      createdAt: now,
    });

    await db.doc('families/fam1/members/m_UID_OWNER').set({
      uid: UID_OWNER,
      name: 'Owner',
      isParent: true,
    });
    await db.doc('families/fam1/members/m_UID_MEMBER').set({
      uid: UID_MEMBER,
      name: 'Member',
    });
    await db.doc('families/fam1/members/m_kid_sub').set({
      managedBy: UID_OWNER,
      name: 'Kid',
    });

    await db.doc(`users/${UID_OWNER}/groups/fam1`).set({
      familyCode: 'fam1',
      memberId: 'm_UID_OWNER',
      joinedAt: now,
    });
    await db.doc(`users/${UID_MEMBER}/groups/fam1`).set({
      familyCode: 'fam1',
      memberId: 'm_UID_MEMBER',
      joinedAt: now,
    });

    // Pre-seed a vetoHistory doc that a member later tries to delete.
    await db.doc('families/fam1/vetoHistory/v_legacy').set({
      memberId: 'm_UID_MEMBER',
      memberName: 'Member',
      titleId: 't_1',
      createdAt: now,
    });

    // Phase 24 — seed a watchparty doc owned by UID_OWNER (host).
    // Used by the Phase 24 wp rules-tests to assert host-can / non-host-cannot.
    // Per REVIEWS M2: the watchparties rule allows attributedWrite() for any
    // family member — we verify whether this lets non-hosts spoof currentTimeMs.
    await db.doc('families/fam1/watchparties/wp_phase24_test').set({
      id: 'wp_phase24_test',
      titleId: 't_1',
      titleName: 'Test Title',
      titlePoster: '',
      hostId: 'm_UID_OWNER',
      hostName: 'Owner',
      hostUid: UID_OWNER,
      startAt: now,
      createdAt: now,
      status: 'active',
      participants: { 'm_UID_OWNER': { name: 'Owner', joinedAt: now, rsvpStatus: 'in' } },
      reactions: [],
      videoUrl: null,
      videoSource: null,
    });
  });
}

async function flipGraceOff() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('settings/auth').set({
      graceUntil: Date.now() - 1000,
      mode: 'post-grace',
    }, { merge: true });
  });
}

async function flipGraceOn() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('settings/auth').set({
      graceUntil: Date.now() + 1e9,
      mode: 'grace',
    }, { merge: true });
  });
}


async function run() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_FILE, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });

  await seed();

  const owner = testEnv.authenticatedContext(UID_OWNER).firestore();
  const member = testEnv.authenticatedContext(UID_MEMBER).firestore();
  const stranger = testEnv.authenticatedContext(UID_STRANGER).firestore();
  const anon = testEnv.unauthenticatedContext().firestore();

  await describe('Session writes', async () => {
    await it('#1 authed member writes session with actingUid == self → ALLOWED', async () => {
      // Phase 15.1 / SEC-15-1-02: validAttribution() now requires memberId is
      // string + matches '^m_[A-Za-z0-9_-]+$'. Production writeAttribution()
      // always stamps memberId — see js/utils.js:92. The earlier minimal
      // payload omitted it; backfill to match the live writer contract.
      await assertSucceeds(
        member.doc('families/fam1/sessions/2026-04-20').set({
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
          votes: { 't_1': 1 },
          updatedAt: Date.now(),
        })
      );
    });

    await it('#2 authed parent writes session with managedMemberId == kid_sub → ALLOWED', async () => {
      // Phase 15.1 / SEC-15-1-02: managedMemberId now also requires the
      // anchored regex; memberId is still required as the actor surface.
      await assertSucceeds(
        owner.doc('families/fam1/sessions/2026-04-21').set({
          actingUid: UID_OWNER,
          managedMemberId: 'm_kid_sub',
          memberId: 'm_UID_OWNER',
          memberName: 'Owner',
          votes: { 't_1': 1 },
          updatedAt: Date.now(),
        })
      );
    });

    await it('#3 non-member authed uid writes session → DENIED', async () => {
      await assertFails(
        stranger.doc('families/fam1/sessions/2026-04-22').set({
          actingUid: UID_STRANGER,
          votes: { 't_1': 1 },
        })
      );
    });

    await it('#4 legacy {memberId} write during grace → ALLOWED', async () => {
      await assertSucceeds(
        member.doc('families/fam1/sessions/2026-04-23').set({
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
          votes: { 't_1': 1 },
        })
      );
    });

    await it('#5 same legacy write after grace expires → DENIED', async () => {
      await flipGraceOff();
      try {
        await assertFails(
          member.doc('families/fam1/sessions/2026-04-24').set({
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
            votes: { 't_1': 1 },
          })
        );
      } finally {
        await flipGraceOn();
      }
    });
  });

  await describe('Anonymous + CF-only collections', async () => {
    await it('#6 unauthenticated write to family subcollection → DENIED', async () => {
      await assertFails(
        anon.doc('families/fam1/sessions/anon_attempt').set({
          actingUid: 'nope',
          votes: {},
        })
      );
    });

    await it('#7 client read of claimTokens → DENIED', async () => {
      await assertFails(
        owner.doc('families/fam1/claimTokens/xyz').get()
      );
    });

    await it('#8 client UPDATE on /families/fam1 (attempt passwordHash write) → DENIED', async () => {
      await assertFails(
        owner.doc('families/fam1').update({ passwordHash: 'cannot-set-from-client' })
      );
    });
  });

  await describe('Family-doc client CREATE', async () => {
    await it('#9 authed user creates new /families/fam2 with ownerUid == self → ALLOWED', async () => {
      await assertSucceeds(
        member.doc('families/fam2').set({
          ownerUid: UID_MEMBER,
          createdAt: Date.now(),
        })
      );
    });

    await it('#10 authed user creates /families/fam3 with DIFFERENT ownerUid → DENIED', async () => {
      await assertFails(
        stranger.doc('families/fam3').set({
          ownerUid: UID_OWNER,
          createdAt: Date.now(),
        })
      );
    });
  });

  await describe('Member-doc client CREATE branches', async () => {
    await it('#11 Branch B — UID_OWNER creates sub-profile (managedBy: self, no uid) → ALLOWED', async () => {
      await assertSucceeds(
        owner.doc('families/fam1/members/m_new_sub').set({
          managedBy: UID_OWNER,
          name: 'Ella',
        })
      );
    });

    await it('#12 Branch B negative — UID_MEMBER creates sub with managedBy: UID_OWNER → DENIED', async () => {
      await assertFails(
        member.doc('families/fam1/members/m_forged_sub').set({
          managedBy: UID_OWNER,
          name: 'Forged',
        })
      );
    });

    await it('#13 Branch C — UID_MEMBER creates /fam1/members/m_self_extra with uid: self (existing member) → ALLOWED', async () => {
      await assertSucceeds(
        member.doc('families/fam1/members/m_self_extra').set({
          uid: UID_MEMBER,
          name: 'Member Second Device',
        })
      );
    });

    await it('#14 Branch C negative — UID_STRANGER (not a member) creates member in fam1 → DENIED', async () => {
      await assertFails(
        stranger.doc('families/fam1/members/m_stranger').set({
          uid: UID_STRANGER,
          name: 'Stranger',
        })
      );
    });
  });

  await describe('Family doc — picker-only update', async () => {
    await it('#15 authed member updates ONLY picker field → ALLOWED', async () => {
      await assertSucceeds(
        member.doc('families/fam1').set(
          { picker: { queue: ['m_UID_OWNER', 'm_UID_MEMBER'], currentMemberId: 'm_UID_OWNER', enabled: true, updatedAt: Date.now() } },
          { merge: true }
        )
      );
    });

    await it('#16 authed member updates picker + another field → DENIED', async () => {
      await assertFails(
        member.doc('families/fam1').set(
          { picker: { enabled: false }, mode: 'crew' },
          { merge: true }
        )
      );
    });

    await it('#17 authed member tries to change ownerUid → DENIED', async () => {
      await assertFails(
        member.doc('families/fam1').set(
          { ownerUid: UID_MEMBER },
          { merge: true }
        )
      );
    });

    await it('#18 non-member stranger updates picker → DENIED', async () => {
      await assertFails(
        stranger.doc('families/fam1').set(
          { picker: { enabled: true } },
          { merge: true }
        )
      );
    });
  });

  // Phase 14 / DECI-14-06 (D-06) — couchSeating write branch.
  // Three tests cover: (a) happy path with attribution, (b) missing actingUid blocked,
  // (c) extra fields outside the allowlist blocked.
  await describe('Family doc — couchSeating update (D-06)', async () => {
    await it('#19 authed member writes couchSeating + attribution → ALLOWED', async () => {
      await assertSucceeds(
        member.doc('families/fam1').set(
          {
            couchSeating: { 'm_UID_MEMBER': 0, 'm_UID_OWNER': 1 },
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });

    await it('#20 couchSeating write with NEITHER actingUid NOR memberId → DENIED', async () => {
      // Both attribution paths must fail:
      //   - validAttribution() needs actingUid == request.auth.uid (absent here).
      //   - legacyGraceWrite() needs memberId is string (also absent here).
      // Note: a memberId-only legacy write WOULD succeed during grace by design
      // (firestore.rules:70-74 legacyGraceWrite()) — that's the documented dual-write
      // ramp covering pre-auth clients. Here we omit both to verify the floor.
      //
      // Test isolation: test #19 above stamped attribution fields on fam1, so
      // request.resource.data.memberId would be inherited unless we explicitly
      // clear them. We do that via withSecurityRulesDisabled before the assertion.
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('families/fam1').set({
          ownerUid: UID_OWNER,
          createdAt: Date.now(),
          // No actingUid / memberId / memberName / couchSeating — fresh slate for #20.
        });
      });
      await assertFails(
        member.doc('families/fam1').set(
          { couchSeating: { 'm_UID_MEMBER': 0 } },
          { merge: true }
        )
      );
    });

    await it('#21 couchSeating + a non-allowlisted field (mode) → DENIED', async () => {
      await assertFails(
        member.doc('families/fam1').set(
          {
            couchSeating: { 'm_UID_MEMBER': 0 },
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
            mode: 'crew',  // ← NOT in allowlist; should fail
          },
          { merge: true }
        )
      );
    });

    await it('#22 stranger writes couchSeating with their actingUid → DENIED', async () => {
      await assertFails(
        stranger.doc('families/fam1').set(
          {
            couchSeating: { 'm_UID_STRANGER': 0 },
            actingUid: UID_STRANGER,
            memberId: 'm_UID_STRANGER',
            memberName: 'Stranger',
          },
          { merge: true }
        )
      );
    });
  });

  // Phase 15 / D-02 (TRACK-15-01) — tupleNames family-doc write branch.
  // Mirrors the couchSeating block above: 4 tests covering happy path,
  // stranger denial, missing attribution, and non-allowlisted-field smuggling.
  await describe('Family doc — tupleNames update (Phase 15 / D-02 / TRACK-15-01)', async () => {
    await it('#23 authed member writes tupleNames + attribution → ALLOWED', async () => {
      // Phase 15.1 / SEC-15-1-03: actingTupleKey is now required by the
      // 5th-branch participant check. Production setTupleName stamps it
      // alongside the dotted-path tupleNames write (see js/app.js:8552).
      await assertSucceeds(
        member.doc('families/fam1').set(
          {
            tupleNames: {
              'm_UID_MEMBER,m_UID_OWNER': {
                name: 'Date night',
                setBy: 'm_UID_MEMBER',
                setAt: 1234567890,
              },
            },
            actingTupleKey: 'm_UID_MEMBER,m_UID_OWNER',
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#24 stranger writes tupleNames → DENIED', async () => {
      await assertFails(
        stranger.doc('families/fam1').set(
          {
            tupleNames: {
              'm_X,m_Y': { name: 'Pwned', setBy: 'm_X', setAt: 0 },
            },
            actingUid: UID_STRANGER,
            memberId: 'm_X',
            memberName: 'Stranger',
          },
          { merge: true }
        )
      );
    });
    await it('#25 authed member writes tupleNames WITHOUT attribution (missing actingUid) post-grace → DENIED', async () => {
      // Reset fam1 so the actingUid stamped by test #19/#23 isn't preserved
      // by `merge: true` (same hygiene as test #20). Then flip grace OFF so
      // the 5th branch's validAttribution() check is what denies (not just
      // legacyGraceWrite accepting a memberId-only legacy write).
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('families/fam1').set({
          ownerUid: UID_OWNER,
          createdAt: Date.now(),
        });
      });
      await flipGraceOff();
      try {
        await assertFails(
          member.doc('families/fam1').set(
            {
              tupleNames: {
                'm_UID_MEMBER,m_UID_OWNER': {
                  name: 'Sneaky',
                  setBy: 'm_UID_MEMBER',
                  setAt: 0,
                },
              },
              memberId: 'm_UID_MEMBER',
              memberName: 'Member',
              // actingUid intentionally omitted
            },
            { merge: true }
          )
        );
      } finally {
        await flipGraceOn();
      }
    });
    await it('#26 authed member writes tupleNames AND a non-allowlisted field (foo) → DENIED', async () => {
      await assertFails(
        member.doc('families/fam1').set(
          {
            tupleNames: {
              'm_UID_MEMBER,m_UID_OWNER': {
                name: 'OK',
                setBy: 'm_UID_MEMBER',
                setAt: 0,
              },
            },
            foo: 'bar',
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
  });

  // Phase 15 / REVIEW HIGH-1 — title-doc isolation matrix for the 3 new sensitive
  // fields (tupleProgress, mutedShows, liveReleaseFiredFor). Verifies the Task 1.5
  // tightening ships per-member field-level isolation: actor's memberId must
  // appear in each touched tupleKey; mutedShows inner key must equal actor's
  // memberId; liveReleaseFiredFor is CF-only (admin SDK bypass) and DENIED for
  // any client write. Test #32 anchors no-regression on Phase 1-14 paths.
  await describe('Title doc — Phase 15 sensitive fields (REVIEW HIGH-1 isolation matrix)', async () => {
    await it('#27 authed member writes titles/{id}.tupleProgress[tk] WHERE tk INCLUDES them → ALLOWED', async () => {
      // Per the Plan 15-01 deviation note in firestore.rules: writeTupleProgress
      // MUST stamp `actingTupleKey: <the tupleKey being written>` so the rule can
      // validate (a) the diff hasOnly that key AND (b) the key contains the actor.
      await assertSucceeds(
        member.doc('families/fam1/titles/t1').set(
          {
            tupleProgress: {
              'm_UID_MEMBER,m_UID_OWNER': {
                season: 2,
                episode: 3,
                updatedAt: 1234567890,
                source: 'watchparty',
              },
            },
            actingTupleKey: 'm_UID_MEMBER,m_UID_OWNER',
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#28 authed member writes titles/{id}.mutedShows[memberId=self] → ALLOWED', async () => {
      await assertSucceeds(
        member.doc('families/fam1/titles/t1').set(
          {
            mutedShows: { 'm_UID_MEMBER': true },
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#29 authed member writes titles/{id}.tupleProgress[tk] WHERE tk does NOT include them → DENIED (HIGH-1)', async () => {
      // Member echoes actingTupleKey honestly but the key excludes their memberId
      // — the regex check `(^|.*,)m_UID_MEMBER(,.*|$)` fails on 'm_UID_OWNER,m_UID_OTHER'.
      await assertFails(
        member.doc('families/fam1/titles/t1').set(
          {
            tupleProgress: {
              'm_UID_OWNER,m_UID_OTHER': {
                season: 9,
                episode: 9,
                updatedAt: 1234567890,
                source: 'manual',
              },
            },
            actingTupleKey: 'm_UID_OWNER,m_UID_OTHER',
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#30 authed member writes titles/{id}.mutedShows[someone-else] → DENIED (HIGH-1)', async () => {
      await assertFails(
        member.doc('families/fam1/titles/t1').set(
          {
            mutedShows: { 'm_UID_OWNER': true },
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#31 authed member writes titles/{id}.liveReleaseFiredFor (CLIENT) → DENIED (HIGH-1; CF-only field)', async () => {
      await assertFails(
        member.doc('families/fam1/titles/t1').set(
          {
            liveReleaseFiredFor: { 's2e3': 1234567890 },
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#32 authed member writes titles/{id} non-Phase-15 fields (queues / ratings) → ALLOWED (no regression)', async () => {
      await assertSucceeds(
        member.doc('families/fam1/titles/t1').set(
          {
            queues: { 'm_UID_MEMBER': { tier: 1, addedAt: 0 } },
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
  });

  // === Phase 15.1 — Security Hardening tests #33-#38 ===
  // #33-#34: coWatchPromptDeclined participant check (SEC-15-1-03)
  // #35:     memberId regex injection defang (SEC-15-1-02)
  // #36-#38: per-member progress isolation (SEC-15-1-01)
  await describe('Phase 15.1 — Security Hardening (SEC-15-1-* isolation)', async () => {
    await it('#33 authed member writes own coWatchPromptDeclined tuple → ALLOWED', async () => {
      // SEC-15-1-03: actingTupleKey echo passes — actor is in the tuple.
      await assertSucceeds(
        member.doc('families/fam1').set(
          {
            coWatchPromptDeclined: { 'm_UID_MEMBER,m_UID_OWNER': 1234567890 },
            actingTupleKey: 'm_UID_MEMBER,m_UID_OWNER',
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#34 authed member writes coWatchPromptDeclined for tuple they are NOT in → DENIED (SEC-15-1-03)', async () => {
      // Member echoes actingTupleKey honestly but the key excludes their memberId
      // — the regex check '(^|.*,)m_UID_MEMBER(,.*|$)' fails on 'm_UID_OUTSIDER,m_UID_OTHER'.
      await assertFails(
        member.doc('families/fam1').set(
          {
            coWatchPromptDeclined: { 'm_UID_OUTSIDER,m_UID_OTHER': 1234567890 },
            actingTupleKey: 'm_UID_OUTSIDER,m_UID_OTHER',
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it("#35 forged memberId='.*' writing tupleProgress → DENIED (SEC-15-1-02 anchor)", async () => {
      // The validAttribution() anchor rejects '.*' because '.' and '*' are not
      // in the allowed character class [A-Za-z0-9_-].
      await assertFails(
        member.doc('families/fam1/titles/t1').set(
          {
            tupleProgress: {
              'm_UID_MEMBER,m_UID_OWNER': {
                season: 2,
                episode: 3,
                updatedAt: 1234567890,
                source: 'manual',
              },
            },
            actingTupleKey: 'm_UID_MEMBER,m_UID_OWNER',
            actingUid: UID_MEMBER,
            memberId: '.*',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#36 authed member writes own progress dotted-path → ALLOWED (SEC-15-1-01)', async () => {
      // Reset titles/t1 so progress writes start clean (mutedShows test
      // #28 may have stamped progress merges via merge: true).
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('families/fam1/titles/t1').set({
          createdAt: Date.now(),
        });
      });
      await assertSucceeds(
        member.doc('families/fam1/titles/t1').set(
          {
            progress: { 'm_UID_MEMBER': { season: 1, episode: 1, updatedAt: 1234567890 } },
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#37 authed member writes someone-else progress → DENIED (SEC-15-1-01)', async () => {
      // The 4th sub-rule's hasOnly([memberId]) check rejects writes
      // touching a progress inner key that is not the actor's memberId.
      await assertFails(
        member.doc('families/fam1/titles/t1').set(
          {
            progress: { 'm_UID_OWNER': { season: 9, episode: 9, updatedAt: 1234567890 } },
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it('#38 authed member writes non-progress field → ALLOWED (SEC-15-1-01 no regression)', async () => {
      // Confirm the 4th sub-rule short-circuits when progress is not in the
      // diff. Tests baseline writes still work (queues field is permissive).
      await assertSucceeds(
        member.doc('families/fam1/titles/t1').set(
          {
            queues: { 'm_UID_MEMBER': { tier: 1, addedAt: 0 } },
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
    await it("#39 forged managedMemberId='.*' on proxy-acted write → DENIED (SEC-15-1-02 anchor)", async () => {
      // The validAttribution() anchor applies to managedMemberId too. Attempts
      // to forge a regex meta in the proxy path must be rejected before the
      // managedBy get() lookup runs. Mirrors test #35 but for the proxy path.
      // Reset titles/t1 so any progress carryover from #36/#37 doesn't change
      // which sub-rule fires first (mirrors the pattern at test #36).
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('families/fam1/titles/t1').set({
          createdAt: Date.now(),
        });
      });
      const owner = testEnv.authenticatedContext(UID_OWNER).firestore();
      await assertFails(
        owner.doc('families/fam1/titles/t1').set(
          {
            progress: { 'm_UID_OWNER': { season: 1, episode: 1, updatedAt: 1234567890 } },
            actingUid: UID_OWNER,
            memberId: 'm_UID_OWNER',
            managedMemberId: '.*',
            memberName: 'Owner',
          },
          { merge: true }
        )
      );
    });
    await it('#40 authed member writes tupleNames for tuple they are NOT in → DENIED (SEC-15-1-03)', async () => {
      // Member echoes actingTupleKey honestly but the key excludes their memberId
      // — the regex check '(^|.*,)m_UID_MEMBER(,.*|$)' fails on 'm_UID_OUTSIDER,m_UID_OTHER'.
      // Mirrors test #34 but for tupleNames instead of coWatchPromptDeclined.
      await assertFails(
        member.doc('families/fam1').set(
          {
            tupleNames: {
              'm_UID_OUTSIDER,m_UID_OTHER': {
                name: 'Pwned',
                setBy: 'm_UID_MEMBER',
                setAt: 1234567890,
              },
            },
            actingTupleKey: 'm_UID_OUTSIDER,m_UID_OTHER',
            actingUid: UID_MEMBER,
            memberId: 'm_UID_MEMBER',
            memberName: 'Member',
          },
          { merge: true }
        )
      );
    });
  });

  // === Phase 15.4 — Integration polish — couch-ping ephemeral collection ===
  // F-W-1 path A: families/{code}/couchPings/{pingId} is an ephemeral mailbox.
  // Tests #41 (happy-path create), #42 (senderId-spoof DENIED), #43 (regex injection DENIED).
  await describe('Phase 15.4 — couchPings ephemeral collection', async () => {
    await it('#41 authed member writes own couchPing → ALLOWED (F-W-1 / D-04)', async () => {
      // senderId == memberId == auth.uid (validAttribution passes).
      // recipientId is a valid m_-anchored memberId.
      await assertSucceeds(
        member.doc('families/fam1/couchPings/p_test_41').set({
          senderId: 'm_UID_MEMBER',
          senderName: 'Member',
          recipientId: 'm_UID_OWNER',
          createdAt: 1234567890,
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });
    await it('#42 authed member spoofs senderId != memberId → DENIED (F-W-1 / senderId == memberId clause)', async () => {
      // The senderId == memberId rule clause blocks Member A from writing a ping
      // claiming to be from Member B (which would surface as a fake "B wants you"
      // push to the recipient). Without this clause, attribution alone would only
      // verify memberId == auth.uid — it would not prevent senderId forgery.
      await assertFails(
        member.doc('families/fam1/couchPings/p_test_42').set({
          senderId: 'm_UID_OWNER',
          senderName: 'Owner',
          recipientId: 'm_UID_MEMBER',
          createdAt: 1234567890,
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });
    await it("#43 forged recipientId='.*' regex injection → DENIED (SEC-15-1-02 anchor extended)", async () => {
      // recipientId.matches('^m_[A-Za-z0-9_-]+$') rejects '.' and '*' because
      // they're not in the allowed character class. Mirrors test #35 which
      // covers the same anchor on memberId.
      await assertFails(
        member.doc('families/fam1/couchPings/p_test_43').set({
          senderId: 'm_UID_MEMBER',
          senderName: 'Member',
          recipientId: '.*',
          createdAt: 1234567890,
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });
  });

  // === Phase 24 — watchparty video fields (REVIEWS M2) ===
  // Verifies host-can / non-host-cannot for the new wp video fields:
  //   videoUrl, videoSource, currentTimeMs, currentTimeUpdatedAt,
  //   currentTimeSource, durationMs, isLiveStream
  // Per REVIEWS M2, the existing watchparties rule (firestore.rules:561-565)
  // allows attributedWrite() for any family member, which means non-hosts
  // technically CAN write currentTimeMs at the rules layer today. The client
  // gate `state.me.id === wp.hostId` (Plan 03 Task 3.4) is the only barrier.
  // These tests verify that gap and trigger the firestore.rules tightening
  // if test #wp3 fails.
  await describe('Phase 24 — watchparty video fields (REVIEWS M2)', async () => {
    const wpRef = (db) => db.doc('families/fam1/watchparties/wp_phase24_test');
    const att = (uid, mid) => ({
      actingUid: uid,
      memberId: mid,
      memberName: 'name',
      actingAt: Date.now(),
    });

    await it('#wp1 host updates wp.videoUrl + wp.videoSource → ALLOWED', async () => {
      await assertSucceeds(
        wpRef(owner).update({
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoSource: 'youtube',
          ...att(UID_OWNER, 'm_UID_OWNER'),
        })
      );
    });

    await it('#wp2 host updates wp.currentTimeMs + extended schema → ALLOWED', async () => {
      await assertSucceeds(
        wpRef(owner).update({
          currentTimeMs: 12345,
          currentTimeUpdatedAt: Date.now(),
          currentTimeSource: 'youtube',
          durationMs: 240000,
          isLiveStream: false,
          ...att(UID_OWNER, 'm_UID_OWNER'),
        })
      );
    });

    await it('#wp3 non-host member updates wp.currentTimeMs → REJECTED (REVIEWS M2)', async () => {
      // This is the threat — non-host trying to spoof position.
      // If the watchparties rule is too permissive (allow update: attributedWrite())
      // this assertion will FAIL today. That signal triggers the firestore.rules
      // tightening with a host-only branch for the host-only fields.
      await assertFails(
        wpRef(member).update({
          currentTimeMs: 999999,
          currentTimeUpdatedAt: Date.now(),
          ...att(UID_MEMBER, 'm_UID_MEMBER'),
        })
      );
    });

    await it('#wp4 non-host member updates wp.reactions → ALLOWED (member-write field)', async () => {
      // Confirms the tightening doesn't over-restrict. Reactions remain a
      // member-write — anyone in the family can post reactions to the wp.
      await assertSucceeds(
        wpRef(member).update({
          reactions: [{ emoji: 'tada', actingUid: UID_MEMBER, memberId: 'm_UID_MEMBER', actingAt: Date.now() }],
          ...att(UID_MEMBER, 'm_UID_MEMBER'),
        })
      );
    });

    await it('#wp5 stranger (not in family) updates wp.videoUrl → REJECTED', async () => {
      await assertFails(
        wpRef(stranger).update({
          videoUrl: 'https://malicious.example.com/video.mp4',
          videoSource: 'mp4',
          ...att(UID_STRANGER, 'm_UID_STRANGER'),
        })
      );
    });
  });

  await testEnv.cleanup();

  console.log(`\n${passed} passing, ${failed} failing`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(2);
});
