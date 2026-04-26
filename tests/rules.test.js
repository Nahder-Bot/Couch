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

  await testEnv.cleanup();

  console.log(`\n${passed} passing, ${failed} failing`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(2);
});
