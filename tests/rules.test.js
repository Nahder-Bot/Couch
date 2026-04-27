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
      await assertSucceeds(
        member.doc('families/fam1/sessions/2026-04-20').set({
          actingUid: UID_MEMBER,
          votes: { 't_1': 1 },
          updatedAt: Date.now(),
        })
      );
    });

    await it('#2 authed parent writes session with managedMemberId == kid_sub → ALLOWED', async () => {
      await assertSucceeds(
        owner.doc('families/fam1/sessions/2026-04-21').set({
          actingUid: UID_OWNER,
          managedMemberId: 'm_kid_sub',
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

  await testEnv.cleanup();

  console.log(`\n${passed} passing, ${failed} failing`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(2);
});
