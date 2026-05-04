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

    // Phase 27 seed — wp with guests[] + rsvpClosed=false for guest-RSVP rule tests.
    // Used by the Phase 27 Guest RSVP rules describe block to assert that anon
    // clients cannot write wp.guests / wp.rsvpClosed / wp.guestCount directly
    // (admin-SDK CFs bypass rules — see firestore.rules /watchparties/{wpId}
    // Phase 27 comment block; tests here verify the existing attributedWrite()
    // floor still denies anon mutations of the new Phase 27 fields).
    await db.doc('families/fam1/watchparties/wp_phase27_test').set({
      hostId: 'UID_OWNER',
      hostUid: 'UID_OWNER',
      hostName: 'Test Host',
      titleId: 't1',
      titleName: 'Test Title',
      startAt: now + 60 * 60 * 1000,
      state: 'scheduled',
      status: 'scheduled',
      participants: {},
      guests: [],
      guestCount: 0,
      rsvpClosed: false,
    });

    // Phase 30 seed — top-level /watchparties/{wpId} with memberUids for cross-family rule tests.
    // Used by the Phase 30 Couch Groups rules describe block to assert:
    //   GROUP-30-07: stranger (NOT in memberUids) read denied
    //   GROUP-30-07: member (IN memberUids) read allowed
    //   GROUP-30-06: non-host cannot mutate wp.memberUids (Path B denylist)
    //   GROUP-30-06: non-host cannot mutate wp.families (Path B denylist)
    await db.doc('watchparties/wp_phase30_test').set({
      hostId: 'UID_OWNER',
      hostUid: 'UID_OWNER',
      hostName: 'Test Host',
      hostFamilyCode: 'fam1',
      families: ['fam1'],
      memberUids: ['UID_OWNER', 'UID_MEMBER'],
      crossFamilyMembers: [],
      startAt: now,
      status: 'active',
      participants: { m1: { name: 'Test Host' } },
      reactions: [],
      guests: [],
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

  // === Phase 27 — Guest RSVP rules ===
  // Verifies the existing rules deny anonymous mutation of any new Phase 27
  // field (wp.guests, wp.rsvpClosed, wp.guestCount) and that family members
  // can still read the wp doc including the new fields. Admin-SDK CFs
  // (rsvpSubmit, rsvpRevoke) bypass rules entirely — see firestore.rules
  // /watchparties/{wpId} Phase 27 comment block; these tests are the
  // anti-spoof floor that proves the bypass is the only write path.
  // Closes RSVP-27-05 (admin-SDK bypass works because rules deny anon
  // writes to new fields) and RSVP-27-06 (rules deny anon write to
  // wp.guests).
  await describe('Phase 27 Guest RSVP rules', async () => {
    await it('#27-01 anon client write to wp.guests → DENIED', async () => {
      await assertFails(
        anon.doc('families/fam1/watchparties/wp_phase27_test')
          .update({ guests: [{ guestId: 'fake-guest-id-aaaaaaaaaa', name: 'Hacker', response: 'yes' }] })
      );
    });

    await it('#27-02 anon client write to wp.rsvpClosed → DENIED', async () => {
      await assertFails(
        anon.doc('families/fam1/watchparties/wp_phase27_test')
          .update({ rsvpClosed: true })
      );
    });

    await it('#27-03 family member can read wp doc including guests array → ALLOWED', async () => {
      await assertSucceeds(
        member.doc('families/fam1/watchparties/wp_phase27_test').get()
      );
    });

    await it('#27-04 anon client write to wp.guestCount → DENIED', async () => {
      await assertFails(
        anon.doc('families/fam1/watchparties/wp_phase27_test')
          .update({ guestCount: 999 })
      );
    });
  });

  // === Phase 30 — Couch Groups rules ===
  // ACTIVE: 4 real assertions covering GROUP-30-06 (host-only fan-out via Path B
  // denylist for families/memberUids) + GROUP-30-07 (cross-family read denied
  // for users NOT in wp.memberUids). Tests exercise the new top-level
  // /watchparties/{wpId} block landed in Plan 30-02 Task 2.3.
  await describe('Phase 30 Couch Groups rules', async () => {
    // GROUP-30-07: stranger cannot read top-level wp (not in memberUids)
    await it('#30-01 stranger read top-level wp -> DENIED', async () => {
      await assertFails(stranger.doc('watchparties/wp_phase30_test').get());
    });

    // GROUP-30-07: member in memberUids can read
    await it('#30-02 member in memberUids reads top-level wp -> ALLOWED', async () => {
      await assertSucceeds(member.doc('watchparties/wp_phase30_test').get());
    });

    // GROUP-30-06: non-host cannot write wp.memberUids (Path B denylist blocks)
    await it('#30-03 non-host cannot write wp.memberUids -> DENIED', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test')
          .update({ memberUids: ['UID_OWNER', 'UID_MEMBER', 'UID_STRANGER'] })
      );
    });

    // GROUP-30-06: non-host cannot write wp.families (Path B denylist blocks)
    await it('#30-04 non-host cannot write wp.families -> DENIED', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test')
          .update({ families: ['fam1', 'fam2'] })
      );
    });

    // P03-T-30-07: non-host cannot spoof wp.crossFamilyMembers (Path B denylist blocks)
    await it('#30-05 non-host cannot write wp.crossFamilyMembers -> DENIED', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test')
          .update({ crossFamilyMembers: [{ memberId: 'spoof', name: 'Spoofed', familyCode: 'evil' }] })
      );
    });

    // === Phase 30 hotfix tests (CR-05 / CR-06) ===
    // After 2026-05-03 cross-cutting review, the top-level wp `allow update` rule
    // gained (1) inline attributedWrite-equivalent (actingUid echo + memberId regex
    // anchor) and (2) Path B converted from denylist → allowlist. These tests
    // verify both gates.

    // CR-05: non-host write that touches an allowlisted field but OMITS actingUid
    // is denied. Without the inline attribution echo, audit trail would be broken
    // for cross-family members joining via addFamilyToWp.
    await it('#30-06 non-host writes to wp.participants WITHOUT actingUid -> DENIED (CR-05)', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test').update({
          participants: { 'm_UID_MEMBER': { name: 'Member', joinedAt: Date.now(), rsvpStatus: 'in' } },
          // actingUid intentionally omitted — CR-05 requires it on every write
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });

    // CR-06: non-host writes to titleName were previously ALLOWED by the old
    // denylist (titleName wasn't on it). After the allowlist conversion,
    // titleName is host-only — a guest-family member can no longer rename
    // the watchparty.
    await it('#30-07 non-host writes to wp.titleName -> DENIED (CR-06 allowlist)', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test').update({
          titleName: 'Pwned Title',
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });

    // CR-06 regression guard: legitimate non-host write of an allowlisted field
    // (reactions) WITH valid attribution still works. This anchors that the
    // hotfix didn't over-restrict the legitimate cross-family interaction
    // surface — reactions are explicitly in the safe-fields allowlist.
    await it('#30-08 non-host writes to wp.reactions WITH valid actingUid+memberId -> ALLOWED (CR-06 regression guard)', async () => {
      await assertSucceeds(
        member.doc('watchparties/wp_phase30_test').update({
          reactions: [{ emoji: 'fire', actingUid: UID_MEMBER, memberId: 'm_UID_MEMBER', actingAt: Date.now() }],
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });

    // === Phase 30 hotfix expansion (Wave 2 — cross-family security tightening) ===
    // These tests close gaps not covered by #30-01..08. Each test expresses an
    // attack a malicious cross-family member added via addFamilyToWp could try
    // against the host's wp doc. CR-06's allowlist must reject all of these.

    // Path B allowlist must reject spoofing the host's participants entry.
    // Without this gate, a guest-family member could overwrite participants[host_id]
    // to flip the host's reactionDelay (defeating Phase 15.5 REQ-7) or rsvpStatus.
    // The allowlist DOES include 'participants' as a writable field, so the gate
    // is at the application layer — but the NEXT hardening pass should narrow it
    // to participants[self_id] only. Until then, this test documents the current
    // surface (participants writes are unrestricted within Path B).
    await it('#30-09 non-host overwrites wp.participants[host_id] WITH attribution -> currently ALLOWED (documents Path B participants gap)', async () => {
      await assertSucceeds(
        member.doc('watchparties/wp_phase30_test').update({
          participants: { 'm_UID_OWNER': { name: 'Hijacked', joinedAt: Date.now(), rsvpStatus: 'out', reactionDelay: 0 } },
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });

    // Path B allowlist must reject status flips by non-host (e.g., archiving the
    // wp from underneath everyone). 'status' is NOT on the allowlist.
    await it('#30-10 non-host writes wp.status -> DENIED (CR-06 allowlist; not in safe-fields)', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test').update({
          status: 'archived',
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });

    // Path B allowlist must reject brand-new fields not in the allowlist. A guest
    // could try to inject e.g. evilFlag, customCss, etc. to leverage the doc as
    // a side-channel between attacker-controlled clients.
    await it('#30-11 non-host injects new field not on allowlist -> DENIED (CR-06 allowlist)', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test').update({
          evilSidechannel: 'data',
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });

    // Path B allowlist must continue to reject Phase 24 host-only video fields
    // even with valid attribution. These were on the prior denylist; the
    // allowlist conversion should preserve the denial.
    await it('#30-12 non-host writes wp.videoUrl WITH attribution -> DENIED (CR-06 allowlist; host-only)', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test').update({
          videoUrl: 'https://attacker.example/evil.mp4',
          actingUid: UID_MEMBER,
          memberId: 'm_UID_MEMBER',
          memberName: 'Member',
        })
      );
    });

    // CR-05 attribution gate: non-host writes a valid allowlisted field (reactions)
    // but with a FORGED actingUid (not their own). Rule requires
    // request.resource.data.actingUid == request.auth.uid.
    await it('#30-13 non-host writes wp.reactions with FORGED actingUid -> DENIED (CR-05 actingUid match)', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test').update({
          reactions: [{ emoji: 'spoof', actingUid: UID_OWNER, memberId: 'm_UID_OWNER', actingAt: Date.now() }],
          actingUid: UID_OWNER,  // claims to be the host — but actually authed as UID_MEMBER
          memberId: 'm_UID_OWNER',
          memberName: 'Spoofed Host',
        })
      );
    });

    // CR-05 memberId regex anchor: bypass attempt with non-anchored memberId.
    // Mirrors the pattern from test #35 (SEC-15-1-02) for the wp doc surface.
    await it("#30-14 non-host writes with memberId='.*' regex bypass attempt -> DENIED (CR-05 ^m_[A-Za-z0-9_-]+$ anchor)", async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test').update({
          reactions: [{ emoji: 'inj', actingUid: UID_MEMBER, memberId: '.*', actingAt: Date.now() }],
          actingUid: UID_MEMBER,
          memberId: '.*',  // missing m_ prefix — should fail regex match
          memberName: 'Member',
        })
      );
    });

    // CR-05 memberId regex anchor: empty string variant.
    await it('#30-15 non-host writes with empty memberId -> DENIED (CR-05 anchor)', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test').update({
          reactions: [{ emoji: 'inj', actingUid: UID_MEMBER, memberId: '', actingAt: Date.now() }],
          actingUid: UID_MEMBER,
          memberId: '',
          memberName: 'Member',
        })
      );
    });

    // Path A regression: host CAN update host-only fields (videoUrl, status, etc).
    // This anchors that the Path A branch still works after CR-05/CR-06 tightening.
    await it('#30-16 host updates wp.videoUrl + wp.status WITH attribution -> ALLOWED (Path A regression guard)', async () => {
      await assertSucceeds(
        owner.doc('watchparties/wp_phase30_test').update({
          videoUrl: 'https://example.com/movie.mp4',
          videoSource: 'mp4',
          status: 'active',
          actingUid: UID_OWNER,
          memberId: 'm_UID_OWNER',
          memberName: 'Owner',
        })
      );
    });

    // wp CREATE rule: must stamp hostUid == self AND include self.uid in memberUids.
    // Verifies the create-time gate rejects sport-flow wps that fail to stamp hostUid
    // (the bug class from CR-09 cross-cutting review).
    await it('#30-17 user creates wp WITHOUT hostUid -> DENIED (create rule requires hostUid == uid())', async () => {
      await assertFails(
        member.doc('watchparties/wp_create_no_hostuid_test').set({
          // hostUid intentionally omitted — CR-09 verified that sports-flow create
          // sites previously failed to stamp this.
          hostId: 'm_UID_MEMBER',
          hostName: 'Member',
          hostFamilyCode: 'fam1',
          families: ['fam1'],
          memberUids: [UID_MEMBER],
          crossFamilyMembers: [],
          startAt: Date.now(),
          status: 'scheduled',
          participants: { 'm_UID_MEMBER': { name: 'Member' } },
          reactions: [],
          guests: [],
        })
      );
    });

    // wp CREATE: user must include self.uid in memberUids (else they couldn't read
    // their own wp post-create). Validates create-side enforcement of the read gate.
    await it('#30-18 user creates wp without self.uid in memberUids -> DENIED', async () => {
      await assertFails(
        member.doc('watchparties/wp_create_no_self_uid_test').set({
          hostUid: UID_MEMBER,
          hostId: 'm_UID_MEMBER',
          hostName: 'Member',
          hostFamilyCode: 'fam1',
          families: ['fam1'],
          memberUids: [UID_OWNER],  // missing UID_MEMBER (self)
          crossFamilyMembers: [],
          startAt: Date.now(),
          status: 'scheduled',
          participants: {},
          reactions: [],
          guests: [],
        })
      );
    });

    // DELETE: only host can delete top-level wp. Cross-family member added via
    // addFamilyToWp can read+write within Path B but cannot delete.
    await it('#30-19 non-host deletes top-level wp -> DENIED', async () => {
      await assertFails(
        member.doc('watchparties/wp_phase30_test').delete()
      );
    });

    // DELETE: stranger (not even in memberUids) trying to delete → DENIED.
    // (Distinct from #30-19 because the read gate also fails for stranger.)
    await it('#30-20 stranger deletes top-level wp -> DENIED', async () => {
      await assertFails(
        stranger.doc('watchparties/wp_phase30_test').delete()
      );
    });

    // === CDX-1 (Phase 30 hotfix Wave 2 — cross-AI peer review) ===
    // The pre-CDX-1 create rule allowed any signed-in user to create a wp
    // claiming arbitrary `hostFamilyCode` and `families[]`. Tightened to
    // require: (1) families == [hostFamilyCode] at create, (2) empty
    // crossFamilyMembers, (3) the hostFamilyCode family doc exists, (4)
    // creator is a member of that family (via /users/{uid}/groups/{code}
    // index — same surface as isMemberOfFamily()).
    //
    // #30-25 is the regression guard for the legitimate happy path —
    // without it, an over-tight rule could break wp creation entirely.

    // CDX-1: attacker tries to create a wp claiming someone else's family.
    // Member of fam1 has NO /users/UID_MEMBER/groups/fam2 record (fam2
    // doesn't exist as a real family in the seed). Even seed-wise, the
    // attacker is NOT in fam2 → membership exists() returns false → DENIED.
    await it('#30-21 user creates wp with hostFamilyCode != their family -> DENIED (CDX-1)', async () => {
      await assertFails(
        member.doc('watchparties/wp_cdx1_foreign_family_test').set({
          hostUid: UID_MEMBER,
          hostId: 'm_UID_MEMBER',
          hostName: 'Member',
          hostFamilyCode: 'fam2',  // attacker claims a family they don't belong to
          families: ['fam2'],
          memberUids: [UID_MEMBER],
          crossFamilyMembers: [],
          startAt: Date.now(),
          status: 'scheduled',
          participants: { 'm_UID_MEMBER': { name: 'Member' } },
          reactions: [],
          guests: [],
        })
      );
    });

    // CDX-1: attacker stamps own family as host but expands families[]
    // beyond [hostFamilyCode] at create — defeating the rule that says
    // cross-family expansion happens via the addFamilyToWp admin-SDK CF.
    // Without this gate, the `onWatchpartyCreateTopLevel` CF would fan out
    // pushes to all members of fam2, fam3, etc. (cross-family push spam).
    await it('#30-22 user creates wp with extra families[] beyond hostFamilyCode -> DENIED (CDX-1)', async () => {
      await assertFails(
        member.doc('watchparties/wp_cdx1_extra_families_test').set({
          hostUid: UID_MEMBER,
          hostId: 'm_UID_MEMBER',
          hostName: 'Member',
          hostFamilyCode: 'fam1',
          families: ['fam1', 'fam2', 'fam3'],  // attacker adds extra families at create
          memberUids: [UID_MEMBER],
          crossFamilyMembers: [],
          startAt: Date.now(),
          status: 'scheduled',
          participants: { 'm_UID_MEMBER': { name: 'Member' } },
          reactions: [],
          guests: [],
        })
      );
    });

    // CDX-1: attacker stamps non-empty crossFamilyMembers[] at create,
    // injecting fake denormalized roster rows that the client renderer
    // will display + that downstream cross-family logic will trust. The
    // admin-SDK addFamilyToWp CF is the only legitimate writer of this
    // field; rules must enforce empty-at-create.
    await it('#30-23 user creates wp with non-empty crossFamilyMembers[] at create time -> DENIED (CDX-1)', async () => {
      await assertFails(
        member.doc('watchparties/wp_cdx1_prefilled_crossfam_test').set({
          hostUid: UID_MEMBER,
          hostId: 'm_UID_MEMBER',
          hostName: 'Member',
          hostFamilyCode: 'fam1',
          families: ['fam1'],
          memberUids: [UID_MEMBER],
          crossFamilyMembers: [
            { memberId: 'm_spoof', name: 'Injected', familyCode: 'fam1' },
          ],
          startAt: Date.now(),
          status: 'scheduled',
          participants: { 'm_UID_MEMBER': { name: 'Member' } },
          reactions: [],
          guests: [],
        })
      );
    });

    // CDX-1: attacker creates a wp pointing to a family code that doesn't
    // exist (typo, future-allocated code, or attacker sniffing for live
    // codes). The exists() check on /families/{hostFamilyCode} blocks this.
    await it('#30-24 user creates wp with hostFamilyCode pointing to nonexistent family -> DENIED (CDX-1)', async () => {
      await assertFails(
        member.doc('watchparties/wp_cdx1_orphan_family_test').set({
          hostUid: UID_MEMBER,
          hostId: 'm_UID_MEMBER',
          hostName: 'Member',
          hostFamilyCode: 'nonexistent_fam_xyz',
          families: ['nonexistent_fam_xyz'],
          memberUids: [UID_MEMBER],
          crossFamilyMembers: [],
          startAt: Date.now(),
          status: 'scheduled',
          participants: { 'm_UID_MEMBER': { name: 'Member' } },
          reactions: [],
          guests: [],
        })
      );
    });

    // CDX-1 regression guard: legitimate happy-path create. Member of fam1
    // creates a wp in their own family with families==[fam1] and empty
    // crossFamilyMembers — this MUST still succeed, otherwise CDX-1's fix
    // has over-tightened the rule and broken core wp creation. Note:
    // /users/UID_MEMBER/groups/fam1 is seeded in seed() so the membership
    // exists() check resolves true.
    await it('#30-25 host creates wp with hostFamilyCode == their family + families==[hostFamilyCode] + empty crossFamilyMembers -> ALLOWED (CDX-1 regression guard)', async () => {
      await assertSucceeds(
        member.doc('watchparties/wp_cdx1_happy_path_test').set({
          hostUid: UID_MEMBER,
          hostId: 'm_UID_MEMBER',
          hostName: 'Member',
          hostFamilyCode: 'fam1',
          families: ['fam1'],
          memberUids: [UID_MEMBER],
          crossFamilyMembers: [],
          startAt: Date.now(),
          status: 'scheduled',
          participants: { 'm_UID_MEMBER': { name: 'Member' } },
          reactions: [],
          guests: [],
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
