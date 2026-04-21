import { db, collection, doc } from './firebase.js';

export let state = { familyCode:null, me:null, members:[], titles:[], selectedMembers:[], searchResults:[], filter:'all', unsubMembers:null, unsubTitles:null, group:null, groups:[], pendingMode:null, selectedMoods:[], session:null, sessionDate:null, unsubSession:null, watchparties:[], unsubWatchparties:null, activeWatchpartyId:null, watchpartyTick:null, includePaid:false, serviceScope:'mine', librarySearchQuery:'', limitToServices:false, auth:null, actingAs:null, actingAsName:null, ownerUid:null, settings:null, unsubUserGroups:null, unsubSettings:null, unsubAuth:null };

export function membersRef() { return collection(db, 'families', state.familyCode, 'members'); }
export function titlesRef() { return collection(db, 'families', state.familyCode, 'titles'); }
export function familyDocRef() { return doc(db, 'families', state.familyCode); }
export function vetoHistoryRef() { return collection(db, 'families', state.familyCode, 'vetoHistory'); }
export function vetoHistoryDoc(id) { return doc(db, 'families', state.familyCode, 'vetoHistory', id); }
