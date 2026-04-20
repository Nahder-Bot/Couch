export const TMDB_KEY = '2ec1f3699afc80f35392f5a674eb9da3';

// ====== TRAKT OAUTH CONFIGURATION ======
export const TRAKT_CLIENT_ID = 'b3b8e6ab789594644426687cd4ec1016dba576489b0ea5907b435d4a2e347ec5';
export const TRAKT_EXCHANGE_URL = 'https://us-central1-queuenight-84044.cloudfunctions.net/traktExchange';
export const TRAKT_REFRESH_URL = 'https://us-central1-queuenight-84044.cloudfunctions.net/traktRefresh';
export const TRAKT_DISCONNECT_URL = 'https://us-central1-queuenight-84044.cloudfunctions.net/traktDisconnect';
export const TRAKT_REDIRECT_URI = 'https://queuenight-84044.web.app/trakt-callback.html';

export function traktIsConfigured() {
  return TRAKT_CLIENT_ID !== 'PASTE_TRAKT_CLIENT_ID_HERE'
    && TRAKT_EXCHANGE_URL !== 'PASTE_TRAKT_EXCHANGE_FUNCTION_URL_HERE'
    && TRAKT_REDIRECT_URI !== 'PASTE_TRAKT_REDIRECT_URI_HERE';
}

export const COLORS = ['#e8a04a','#d97757','#c44536','#a87354','#7fb069','#5e8c6a','#b08968','#9c6f4a'];

// Rating tiers: 1=all ages, 5=adults only. Used for per-member age filtering.
export const RATING_TIERS = {
  // Movies (US)
  'G':1,'PG':2,'PG-13':3,'R':4,'NC-17':5,'NR':3,'UR':3,
  // TV (US)
  'TV-Y':1,'TV-Y7':1,'TV-G':1,'TV-PG':2,'TV-14':3,'TV-MA':5
};
export const TIER_LABELS = {1:'G / TV-Y',2:'PG / TV-PG',3:'PG-13 / TV-14',4:'R',5:'NC-17 / TV-MA'};
export function tierFor(rating) { return RATING_TIERS[rating] || null; }
export function ageToMaxTier(age) {
  if (age == null) return 5;
  if (age < 7) return 1;
  if (age < 10) return 2;
  if (age < 13) return 3;
  if (age < 17) return 4;
  return 5;
}

export function normalizeProviderName(raw) {
  if (!raw) return raw;
  const n = raw.trim();
  const map = {
    'Amazon Prime Video': 'Prime Video',
    'Amazon Prime Video with Ads': 'Prime Video',
    'Amazon Prime Video Free with Ads': 'Prime Video',
    'Amazon Video': 'Prime Video',
    'Prime Video': 'Prime Video',
    'Netflix': 'Netflix',
    'Netflix Standard with Ads': 'Netflix',
    'Netflix basic with Ads': 'Netflix',
    'Netflix Kids': 'Netflix',
    'Disney Plus': 'Disney+',
    'Disney+': 'Disney+',
    'Hulu': 'Hulu',
    'Peacock': 'Peacock',
    'Peacock Premium': 'Peacock',
    'Peacock Premium Plus': 'Peacock',
    'Max': 'Max',
    'HBO Max': 'Max',
    'Max Amazon Channel': 'Max',
    'Apple TV': 'Apple TV+',
    'Apple TV Plus': 'Apple TV+',
    'Apple TV+': 'Apple TV+',
    'Paramount Plus': 'Paramount+',
    'Paramount+': 'Paramount+',
    'Paramount Plus with Showtime': 'Paramount+',
    'Paramount+ with Showtime': 'Paramount+',
    'Paramount+ Amazon Channel': 'Paramount+',
    'Starz': 'Starz',
    'Starz Amazon Channel': 'Starz',
    'Showtime': 'Showtime',
    'Showtime Amazon Channel': 'Showtime',
    'YouTube': 'YouTube',
    'YouTube Premium': 'YouTube',
    'Tubi TV': 'Tubi',
    'Tubi': 'Tubi',
    'Freevee': 'Freevee',
    'Amazon Freevee': 'Freevee',
    'Pluto TV': 'Pluto TV',
    'The Roku Channel': 'Roku Channel',
    'Google Play Movies': 'Google Play',
    'Amazon': 'Amazon',
    'Vudu': 'Vudu',
    'Fandango At Home': 'Vudu',
    'Microsoft Store': 'Microsoft Store'
  };
  return map[n] || n;
}

export const SUBSCRIPTION_BRANDS = [
  { id: 'Netflix',      name: 'Netflix' },
  { id: 'Prime Video',  name: 'Prime Video' },
  { id: 'Disney+',      name: 'Disney+' },
  { id: 'Hulu',         name: 'Hulu' },
  { id: 'Max',          name: 'Max' },
  { id: 'Apple TV+',    name: 'Apple TV+' },
  { id: 'Paramount+',   name: 'Paramount+' },
  { id: 'Peacock',      name: 'Peacock' },
  { id: 'Starz',        name: 'Starz' },
  { id: 'Showtime',     name: 'Showtime' },
  { id: 'YouTube',      name: 'YouTube Premium' },
  { id: 'Tubi',         name: 'Tubi' },
  { id: 'Freevee',      name: 'Freevee' },
  { id: 'Pluto TV',     name: 'Pluto TV' },
  { id: 'Roku Channel', name: 'Roku Channel' }
];

export const QN_DEBUG = (() => {
  try {
    if (location.search.includes('debug')) return true;
    if (localStorage.getItem('qn_debug') === '1') return true;
  } catch(e) {}
  return false;
})();
export function qnLog(...args) { if (QN_DEBUG) console.log(...args); }

// ===== Mood tags =====
export const MOODS = [
  { id:'cozy',      label:'Cozy',      icon:'\u{1F9F8}' },
  { id:'funny',     label:'Funny',     icon:'\u{1F602}' },
  { id:'epic',      label:'Epic',      icon:'\u2694\uFE0F' },
  { id:'spooky',    label:'Spooky',    icon:'\u{1F47B}' },
  { id:'tearjerker',label:'Tearjerker',icon:'\u{1F62D}' },
  { id:'mindbender',label:'Mindbender',icon:'\u{1F9E0}' },
  { id:'action',    label:'Action',    icon:'\u{1F4A5}' },
  { id:'comfort',   label:'Comfort',   icon:'\u2615' },
  { id:'short',     label:'Short',     icon:'\u23F1' },
  { id:'datenight', label:'Date night',icon:'\u{1F56F}' }
];
export function moodById(id) { return MOODS.find(m => m.id === id); }
export function suggestMoods(tmdbGenreIds, runtimeMins) {
  const out = new Set();
  const g = new Set(tmdbGenreIds || []);
  const has = (id, name) => g.has(id) || g.has(name);
  if (has(35, 'Comedy')) out.add('funny');
  if (has(27, 'Horror')) out.add('spooky');
  if (has(9648, 'Mystery') || has(53, 'Thriller') || has(878, 'Science Fiction') || has(878, 'Sci-Fi & Fantasy')) out.add('mindbender');
  if (has(28, 'Action') || has(12, 'Adventure') || has(10759, 'Action & Adventure')) out.add('action');
  if (has(10749, 'Romance')) out.add('datenight');
  if (has(10751, 'Family') || has(16, 'Animation') || has(10762, 'Kids')) out.add('cozy');
  if (has(12, 'Adventure') || has(10752, 'War') || has(14, 'Fantasy') || has(37, 'Western')) out.add('epic');
  if (has(18, 'Drama')) out.add('tearjerker');
  if (runtimeMins && runtimeMins > 0 && runtimeMins < 90) out.add('short');
  return Array.from(out);
}

export function normalizeCode(code) { return (code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,''); }
