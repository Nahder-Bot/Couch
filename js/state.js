import { db, collection, doc } from './firebase.js';

// Phase 14 / DECI-14-01 (D-01): state.couchMemberIds is the active "who's on the couch tonight"
// member-id list. Owned/written by 14-04 (couch viz cushion-claim writer). 14-01 only declares the
// slot so isWatchedByCouch() has a stable place to read; until 14-04 ships, callers fall back to
// [state.me.id] (single-member discovery) per D-01 default behavior.
export let state = { familyCode:null, me:null, members:[], titles:[], selectedMembers:[], couchMemberIds:[], searchResults:[], filter:'all', unsubMembers:null, unsubTitles:null, group:null, groups:[], pendingMode:null, selectedMoods:[], session:null, sessionDate:null, unsubSession:null, watchparties:[], unsubWatchparties:null, activeWatchpartyId:null, watchpartyTick:null, includePaid:false, serviceScope:'mine', librarySearchQuery:'', limitToServices:false, auth:null, actingAs:null, actingAsName:null, ownerUid:null, settings:null, unsubUserGroups:null, unsubSettings:null, unsubAuth:null };

export function membersRef() { return collection(db, 'families', state.familyCode, 'members'); }
export function titlesRef() { return collection(db, 'families', state.familyCode, 'titles'); }
export function familyDocRef() { return doc(db, 'families', state.familyCode); }
export function vetoHistoryRef() { return collection(db, 'families', state.familyCode, 'vetoHistory'); }
export function vetoHistoryDoc(id) { return doc(db, 'families', state.familyCode, 'vetoHistory', id); }
