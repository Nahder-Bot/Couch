export const TMDB_KEY = '2ec1f3699afc80f35392f5a674eb9da3';

// VAPID public key — public-by-design (safe client-side, same posture as TMDB_KEY + Firebase config).
// Matches queuenight/functions/.env VAPID_PUBLIC. Private key lives server-side only.
// Rotating this requires a client redeploy + CF env update. Subject: mailto:nahderz@gmail.com.
export const VAPID_PUBLIC_KEY = 'BGwhEJGIKjf4MSd4vyZA6uegbKhiG5kkxoAD2o1WUfxYmcm5cUmSjc0z05d-r7meS1gmKOT0f0Sn4zXQwhriRHg';

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

// ===== Phase 11 / REFR-04 — Discovery catalog =====
// 25-row catalog feeding the Add-tab daily rotation engine (js/discovery-engine.js).
// Auto-derived TMDB rows only; curated C/G rows ship in Plan 11-03b.
//
// Bucket layout (see .planning/phases/11-feature-refresh-and-streamline/11-APPENDIX-CATEGORIES.md):
//   A — always-on (2 rows, every visit)
//   B — trending pool (4 rows, 1 picked/day; weekday/weekend-tagged)
//   C — auto discovery (4 rows from C1/C3/C7/C9; curated C2/C4/C5/C6/C8 in 11-03b)
//   D — use-case (3 rows with preferredDays hints)
//   E — day-of-week theme (7 rows, Mon-Sun, dayOfWeek 0=Sunday…6=Saturday)
//   F — seasonal (5 rows, only fire within active window)
//
// Each row:
//   id          — unique string id used as DOM id suffix and cache key
//   label       — eyebrow text (UPPERCASE rendered via CSS)
//   subtitle    — italic subtitle (rendered via CSS, Instrument Serif)
//   bucket      — 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
//   source      — { type, endpoint?, params? }
//                   type: 'tmdb-endpoint' | 'tmdb-discover' | 'tmdb-streaming-filter'
//                        | 'group-recent-yes-similar' | 'group-rewatch-candidates'
//   dayOfWeek   — E only: 0=Sun, 1=Mon … 6=Sat
//   preferredDays — D only: [dayOfWeek, …] weighting
//   weekdayOnly / weekendOnly — B only: tag for selector
//   seasonalWindow — F only: { monthStart, dayStart, monthEnd, dayEnd } (1-12 months)
//
// Copy verbatim from 11-UI-SPEC.md §Copywriting Contract REFR-04.
export const DISCOVERY_CATALOG = [
  // ---------- Bucket A — Always on ----------
  {
    id: 'a1-streaming',
    label: 'On your streaming',
    subtitle: 'What you can watch right now',
    bucket: 'A',
    source: { type: 'tmdb-streaming-filter' }
  },
  {
    id: 'a2-couch-into',
    label: 'What your couch is into',
    subtitle: 'From your recent Yes votes',
    bucket: 'A',
    source: { type: 'group-recent-yes-similar' }
  },

  // ---------- Bucket B — Trending pool ----------
  {
    id: 'b1-trending-week',
    label: 'Trending this week',
    subtitle: "What everyone's on",
    bucket: 'B',
    weekdayOnly: true,
    source: { type: 'tmdb-endpoint', endpoint: '/trending/all/week' }
  },
  {
    id: 'b2-trending-day',
    label: 'Trending today',
    subtitle: "What's hot right now",
    bucket: 'B',
    weekendOnly: true,
    source: { type: 'tmdb-endpoint', endpoint: '/trending/all/day' }
  },
  {
    id: 'b3-new-releases',
    label: 'New releases',
    subtitle: 'Fresh off the projector',
    bucket: 'B',
    source: { type: 'tmdb-endpoint', endpoint: '/movie/now_playing' }
  },
  {
    id: 'b4-coming-soon',
    label: 'Coming soon',
    subtitle: 'Pencil it in',
    bucket: 'B',
    source: { type: 'tmdb-endpoint', endpoint: '/movie/upcoming' }
  },

  // ---------- Bucket C — Auto discovery ----------
  {
    id: 'c1-hidden-gems',
    label: 'Hidden gems',
    subtitle: 'Beloved, but quieter',
    bucket: 'C',
    source: {
      type: 'tmdb-discover',
      params: {
        'sort_by': 'vote_average.desc',
        'vote_average.gte': '7.5',
        'vote_count.gte': '200',
        'vote_count.lte': '2000'
      }
    }
  },
  {
    id: 'c3-acclaimed',
    label: 'Critically acclaimed',
    subtitle: 'If the reviewers are to be trusted',
    bucket: 'C',
    source: {
      type: 'tmdb-discover',
      params: {
        'sort_by': 'vote_average.desc',
        'vote_average.gte': '7.5',
        'vote_count.gte': '1000'
      }
    }
  },
  {
    id: 'c7-foreign',
    label: 'Foreign gems',
    subtitle: 'Worth the subtitles',
    bucket: 'C',
    source: {
      type: 'tmdb-discover',
      params: {
        'sort_by': 'popularity.desc',
        'with_original_language': 'ko|ja|fr|es|de|it',
        'vote_count.gte': '200'
      }
    }
  },
  {
    id: 'c9-boutique',
    label: 'A24 & co.',
    subtitle: 'Boutique studios, sharp taste',
    bucket: 'C',
    source: {
      type: 'tmdb-discover',
      // A24 production company id = 41077 (TMDB v3)
      params: {
        'with_companies': '41077',
        'sort_by': 'popularity.desc'
      }
    }
  },

  // ---------- Bucket D — Use-case (preferredDays bias) ----------
  {
    id: 'd1-quick-watch',
    label: 'Under 90 minutes',
    subtitle: 'Short and sweet — school night approved',
    bucket: 'D',
    preferredDays: [1, 2], // Mon, Tue
    source: {
      type: 'tmdb-discover',
      params: {
        'with_runtime.lte': '90',
        'with_runtime.gte': '60',
        'sort_by': 'popularity.desc',
        'vote_count.gte': '200'
      }
    }
  },
  {
    id: 'd3-date-night',
    label: 'Date night picks',
    subtitle: 'Romance, dramedies, drama',
    bucket: 'D',
    preferredDays: [5, 6], // Fri, Sat
    source: {
      type: 'tmdb-discover',
      params: {
        // Romance (10749) | Drama (18)
        'with_genres': '10749|18',
        'sort_by': 'popularity.desc',
        'vote_count.gte': '300'
      }
    }
  },
  {
    id: 'd6-comfort-rewatch',
    label: 'Comfort rewatches',
    subtitle: 'The ones you already love',
    bucket: 'D',
    preferredDays: [0], // Sun
    source: { type: 'group-rewatch-candidates' }
  },

  // ---------- Bucket E — Day-of-week theme (one fires per day) ----------
  {
    id: 'e-mon',
    label: 'Monday motivation',
    subtitle: 'A reason to push through',
    bucket: 'E',
    dayOfWeek: 1,
    source: {
      type: 'tmdb-discover',
      // Drama + high rating — inspirational skew
      params: {
        'with_genres': '18',
        'vote_average.gte': '7.5',
        'vote_count.gte': '500',
        'sort_by': 'popularity.desc'
      }
    }
  },
  {
    id: 'e-tue',
    label: 'TV pilots worth starting',
    subtitle: 'A new crew to spend time with',
    bucket: 'E',
    dayOfWeek: 2,
    source: { type: 'tmdb-endpoint', endpoint: '/tv/popular' }
  },
  {
    id: 'e-wed',
    label: 'Wildcard Wednesday',
    subtitle: 'Random, but quality-vetted',
    bucket: 'E',
    dayOfWeek: 3,
    source: {
      type: 'tmdb-discover',
      params: {
        'sort_by': 'popularity.desc',
        'vote_average.gte': '7.0',
        'vote_count.gte': '500'
      }
    }
  },
  {
    id: 'e-thu',
    label: 'Throwback Thursday',
    subtitle: '90s nostalgia',
    bucket: 'E',
    dayOfWeek: 4,
    source: {
      type: 'tmdb-discover',
      params: {
        'primary_release_date.gte': '1990-01-01',
        'primary_release_date.lte': '1999-12-31',
        'sort_by': 'popularity.desc',
        'vote_count.gte': '500'
      }
    }
  },
  {
    id: 'e-fri',
    label: 'Foreign Film Friday',
    subtitle: 'Passport not required',
    bucket: 'E',
    dayOfWeek: 5,
    source: {
      type: 'tmdb-discover',
      params: {
        'with_original_language': 'ko|ja|fr|es|de|it',
        'sort_by': 'popularity.desc',
        'vote_count.gte': '300'
      }
    }
  },
  {
    id: 'e-sat',
    label: 'Saturday blockbusters',
    subtitle: 'Big, loud, worth it',
    bucket: 'E',
    dayOfWeek: 6,
    source: {
      type: 'tmdb-discover',
      params: {
        'with_genres': '28|12', // Action, Adventure
        'sort_by': 'popularity.desc',
        'vote_count.gte': '1000'
      }
    }
  },
  {
    id: 'e-sun',
    label: 'Cozy Sunday',
    subtitle: 'Slow, warm, easy',
    bucket: 'E',
    dayOfWeek: 0,
    source: {
      type: 'tmdb-discover',
      params: {
        // Comedy (35), Family (10751), Romance (10749)
        'with_genres': '35|10751|10749',
        'sort_by': 'popularity.desc',
        'vote_count.gte': '500'
      }
    }
  },

  // ---------- Bucket F — Seasonal injections ----------
  {
    id: 'f1-halloween',
    label: 'Halloween Crawl',
    subtitle: 'Spooky, not slashy — and slashy too',
    bucket: 'F',
    seasonalWindow: { monthStart: 10, dayStart: 1, monthEnd: 11, dayEnd: 1 },
    source: {
      type: 'tmdb-discover',
      params: {
        'with_genres': '27', // Horror
        'sort_by': 'popularity.desc',
        'vote_count.gte': '500'
      }
    }
  },
  {
    id: 'f2-holiday',
    label: 'Holiday Classics',
    subtitle: 'The ones everyone keeps re-watching',
    bucket: 'F',
    seasonalWindow: { monthStart: 12, dayStart: 1, monthEnd: 1, dayEnd: 1 },
    source: {
      type: 'tmdb-discover',
      params: {
        // Christmas keyword id 207317 on TMDB
        'with_keywords': '207317',
        'sort_by': 'popularity.desc',
        'vote_count.gte': '200'
      }
    }
  },
  {
    id: 'f3-summer',
    label: 'Summer blockbusters',
    subtitle: 'Cold drink, warm night',
    bucket: 'F',
    seasonalWindow: { monthStart: 6, dayStart: 1, monthEnd: 8, dayEnd: 31 },
    source: {
      type: 'tmdb-discover',
      params: {
        'with_genres': '28|12', // Action, Adventure
        'sort_by': 'popularity.desc',
        'vote_count.gte': '1000'
      }
    }
  },
  {
    id: 'f6-valentine',
    label: "Valentine's Date Night",
    subtitle: 'No pressure, just vibes',
    bucket: 'F',
    seasonalWindow: { monthStart: 2, dayStart: 1, monthEnd: 2, dayEnd: 14 },
    source: {
      type: 'tmdb-discover',
      params: {
        'with_genres': '10749', // Romance
        'sort_by': 'popularity.desc',
        'vote_count.gte': '300'
      }
    }
  },
  {
    id: 'f7-awards',
    label: 'Awards-season prestige',
    subtitle: "This year's contenders",
    bucket: 'F',
    seasonalWindow: { monthStart: 1, dayStart: 1, monthEnd: 3, dayEnd: 31 },
    source: {
      type: 'tmdb-discover',
      params: {
        'sort_by': 'vote_average.desc',
        'vote_average.gte': '7.5',
        'vote_count.gte': '1000'
      }
    }
  },

  // ===== Plan 11-03b additions — Curated C rows + Personalization G rows =====
  // Curated C rows use tmdb-curated-list (hand-picked TMDB IDs) or tmdb-director-rotating.
  // Personalization G rows read state.titles (group-want-list / group-similar-to-recent /
  // group-top-genre-discover) and degrade gracefully to empty on cold-start.
  // See .planning/phases/11-feature-refresh-and-streamline/11-APPENDIX-CATEGORIES.md §§Bucket C + Bucket G.

  // ---------- Bucket C — Curated discovery (planner-judged TMDB IDs) ----------
  {
    id: 'c2-cult-classics',
    label: 'Cult classics',
    subtitle: 'The midnight-screening canon',
    bucket: 'C',
    source: {
      type: 'tmdb-curated-list',
      // Hand-picked TMDB movie IDs — the canon most households know by reputation.
      // 20+ IDs; loader caps at 20 to stay within rate budget.
      tmdbIds: [
        141,     // Donnie Darko
        115,     // The Big Lebowski
        38,      // Eternal Sunshine of the Spotless Mind
        680,     // Pulp Fiction
        550,     // Fight Club
        807,     // Se7en
        629,     // The Usual Suspects
        603,     // The Matrix
        78,      // Blade Runner
        694,     // The Shining
        105,     // Back to the Future
        562,     // Die Hard
        489,     // Good Will Hunting
        745,     // The Sixth Sense
        11,      // Star Wars: A New Hope
        62,      // 2001: A Space Odyssey
        1422,    // The Departed
        10681,   // WALL·E
        27205,   // Inception
        1891,    // The Empire Strikes Back
        389,     // 12 Angry Men
        389,     // (dup — harmless filter)
        155      // The Dark Knight
      ]
    }
  },
  {
    id: 'c4-award-winners',
    label: 'Award winners',
    subtitle: 'Best Picture, Globes, BAFTA',
    bucket: 'C',
    source: {
      type: 'tmdb-discover',
      params: {
        // TMDB keyword 209714 = "oscar winner"
        'with_keywords': '209714',
        'vote_average.gte': '7.5',
        'sort_by': 'popularity.desc',
        'vote_count.gte': '500'
      }
    }
  },
  {
    id: 'c5-festival-favorites',
    label: 'Festival favorites',
    subtitle: 'Cannes, Sundance, TIFF, Venice',
    bucket: 'C',
    source: {
      type: 'tmdb-curated-list',
      // Hand-picked TMDB movie IDs — Palme d'Or / Sundance / TIFF / Venice award slate.
      tmdbIds: [
        496243,   // Parasite (Palme d'Or 2019)
        915935,   // Anatomy of a Fall (Palme d'Or 2023)
        758323,   // Drive My Car (Cannes 2021)
        426426,   // Roma (Venice 2018, Oscar Best Director)
        581734,   // Nomadland (Venice 2020, Oscar BP)
        637,      // Life Is Beautiful (Cannes Grand Prix)
        274,      // The Silence of the Lambs (Berlin Silver Bear)
        508947,   // Turning Red (festival circuit)
        76203,    // 12 Years a Slave
        120467,   // The Grand Budapest Hotel
        508442,   // Soul
        398181,   // The Florida Project
        369557,   // Call Me by Your Name
        390634,   // Your Name (animation fests)
        372058,   // Your Name.
        419430,   // Get Out (Sundance)
        449563,   // Little Miss Sunshine (Sundance)
        568332,   // Tár
        474350,   // It Chapter Two
        530385,   // Midsommar (Sundance)
        490132,   // Green Book (TIFF People's Choice)
        475557    // Joker (Venice Golden Lion)
      ]
    }
  },
  {
    id: 'c6-director-spotlight',
    label: 'Director spotlight',
    subtitle: 'A focus on one filmmaker',
    bucket: 'C',
    source: {
      type: 'tmdb-director-rotating',
      // TMDB person IDs — loader picks one deterministically per (rowId, dateKey).
      directors: [
        5655,   // Wes Anderson
        21684,  // Bong Joon-ho
        45400,  // Greta Gerwig
        137427, // Denis Villeneuve
        578,    // Christopher Nolan
        1032,   // Martin Scorsese
        1223,   // Quentin Tarantino
        138,    // Stanley Kubrick
        5281,   // Spike Lee
        1769    // Coen Brothers / Joel Coen
      ]
    }
  },
  {
    id: 'c8-docs-that-punch',
    label: 'Documentaries that punch',
    subtitle: 'Non-fiction with a heartbeat',
    bucket: 'C',
    source: {
      type: 'tmdb-discover',
      params: {
        // Genre 99 = Documentary
        'with_genres': '99',
        'vote_average.gte': '7.5',
        'vote_count.gte': '200',
        'sort_by': 'popularity.desc'
      }
    }
  },

  // ---------- Bucket G — Personalization (fire only when state has enough history) ----------
  {
    id: 'g1-want-list',
    label: 'From your Want list',
    subtitle: 'Voted Yes, never picked',
    bucket: 'G',
    source: { type: 'group-want-list' }
  },
  {
    id: 'g3-because-you-watched',
    label: 'Because you watched',
    subtitle: 'Similar films, similar night',
    bucket: 'G',
    source: { type: 'group-similar-to-recent' }
  },
  {
    id: 'g7-top-genres',
    label: 'Your top genres revisited',
    subtitle: "What your couch keeps coming back to",
    bucket: 'G',
    source: { type: 'group-top-genre-discover' }
  }
];

// ===== Phase 11 / REFR-13 — Couch Nights themed ballot packs =====
// Curated "tap-once to start a themed vote" shortcut. 8 initial packs each with
// { id (stable slug), title, description (BRAND voice italic serif), mood (maps to
// MOODS id), heroImageUrl (TMDB poster URL from one canonical film), tmdbIds: [8-12
// verified movie/TV TMDB IDs] }. Pack data is public-by-design (constant in client
// source) per CLAUDE.md Firestore-migration posture. See
// .planning/phases/11-feature-refresh-and-streamline/11-UI-SPEC.md §Copywriting
// Contract REFR-13 for copy verbatim, §Interaction States REFR-13 for tile + sheet
// visuals, and 11-07-PLAN.md for TMDB ID curation notes.
export const COUCH_NIGHTS_PACKS = [
  {
    id: 'studio-ghibli-sunday',
    title: 'Studio Ghibli Sunday',
    description: 'Slow, lush, and not a single explosion.',
    mood: 'cozy',
    heroImageUrl: 'https://image.tmdb.org/t/p/w780/dMZxEdrWIzUmUoOz2zvmFuulbeS.jpg',
    tmdbIds: [
      // Spirited Away, My Neighbor Totoro, Princess Mononoke, Kiki's Delivery Service,
      // Castle in the Sky, Howl's Moving Castle, Ponyo, Porco Rosso, The Wind Rises, Nausicaä
      129, 8392, 128, 16859, 10515, 4935, 12429, 11544, 149870, 81
    ]
  },
  {
    id: 'cozy-rainy-night',
    title: 'Cozy Rainy Night',
    description: 'Blanket fort required.',
    mood: 'cozy',
    heroImageUrl: 'https://image.tmdb.org/t/p/w780/7HxYCaA0JI5nzo4OnmYBKJQoMHB.jpg',
    tmdbIds: [
      // Amelie, The Secret Life of Walter Mitty, Chef, Julie & Julia, Little Women,
      // You've Got Mail, Paddington, Paddington 2, About Time, The Holiday, Notting Hill
      194, 116745, 194662, 31011, 331482, 11005, 228326, 346648, 122906, 6963, 509
    ]
  },
  {
    id: 'halloween-crawl',
    title: 'Halloween Crawl',
    description: 'Spooky, not slashy — and slashy too.',
    mood: 'spooky',
    heroImageUrl: 'https://image.tmdb.org/t/p/w780/aSbxbBUXQUE8dQKWvEARo1WDcTb.jpg',
    tmdbIds: [
      // Hocus Pocus, Beetlejuice, The Nightmare Before Christmas, Coraline, ParaNorman,
      // It Follows, Get Out, The Cabin in the Woods, Ready or Not, Midsommar
      9532, 4011, 9479, 14164, 82702, 270303, 419430, 22970, 536554, 530385
    ]
  },
  {
    id: 'date-night-classics',
    title: 'Date Night Classics',
    description: 'Romance, dramedies, drama.',
    mood: 'datenight',
    heroImageUrl: 'https://image.tmdb.org/t/p/w780/qom1SZSENdmHFNZBXbtJAU0WTlC.jpg',
    tmdbIds: [
      // Before Sunrise, Before Sunset, Before Midnight, When Harry Met Sally, La La Land,
      // The Big Sick, 500 Days of Summer, Crazy Stupid Love, Silver Linings Playbook, Past Lives
      76, 80, 152601, 639, 313369, 398818, 19913, 50646, 82690, 666277
    ]
  },
  {
    id: 'kids-room-classics',
    title: "Kids' Room Classics",
    description: "The films they'll ask to rewatch.",
    mood: 'cozy',
    heroImageUrl: 'https://image.tmdb.org/t/p/w780/uXDfjJbdP4ijW5hWSBrPrlKpxab.jpg',
    tmdbIds: [
      // Toy Story, Toy Story 3, Finding Nemo, The Incredibles, WALL-E, Up, Inside Out,
      // Coco, Moana, Frozen, Encanto, Zootopia
      862, 10193, 12, 9806, 10681, 14160, 150540, 354912, 277834, 109445, 568124, 269149
    ]
  },
  {
    id: 'a24-night',
    title: 'A24 Night',
    description: 'Boutique studio picks, curated loud.',
    mood: 'mindbender',
    heroImageUrl: 'https://image.tmdb.org/t/p/w780/aLaeEEhWvl1vJpd7wEb7HlsZafb.jpg',
    tmdbIds: [
      // Everything Everywhere All at Once, The Green Knight, Moonlight, Lady Bird, Hereditary,
      // Uncut Gems, The Lighthouse, Ex Machina, The Whale, Past Lives, Minari, Talk to Me
      545611, 550988, 376867, 391713, 493922, 473033, 503919, 264660, 785084, 666277, 615643, 1008042
    ]
  },
  {
    id: 'oscars-short-list',
    title: 'Oscars Short List',
    description: 'If the Academy got it right.',
    mood: 'tearjerker',
    heroImageUrl: 'https://image.tmdb.org/t/p/w780/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    tmdbIds: [
      // Parasite, Nomadland, CODA, Everything Everywhere All at Once, Oppenheimer, Moonlight,
      // 12 Years a Slave, Birdman, The Shape of Water, Anatomy of a Fall
      496243, 581734, 776503, 545611, 872585, 376867, 76203, 194662, 399055, 915935
    ]
  },
  {
    id: 'dads-action-pantheon',
    title: "Dad's Action Pantheon",
    description: 'Loud, proud, and repeatable.',
    mood: 'action',
    heroImageUrl: 'https://image.tmdb.org/t/p/w780/6DrHO1jr3qVrViUO6s6kFiAGM7.jpg',
    tmdbIds: [
      // Die Hard, Mad Max: Fury Road, The Dark Knight, John Wick, Raiders of the Lost Ark,
      // Terminator 2, Heat, The Matrix, Casino Royale, Mission Impossible: Fallout, Top Gun: Maverick
      562, 76341, 155, 245891, 85, 280, 949, 603, 36557, 353081, 361743
    ]
  }
];

