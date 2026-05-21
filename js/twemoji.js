// Couch — Twemoji rendering helper.
// Brand-consistency win for curated emoji surfaces (mood picker, reaction picker)
// where a Couch family on mixed iOS/Android/desktop sees identical glyphs instead
// of three different OS emoji fonts. Free-text emoji elsewhere stays native.
//
// CDN: jdecked/twemoji is the active maintained fork post-Twitter abandonment.
// Pinned to v15.1.0 for stability — bump deliberately when adopting new glyphs.
//
// Usage:
//   import { twemojiImg } from './twemoji.js';
//   ${twemojiImg(mood.icon, mood.label)}             // default size (1.25em)
//   ${twemojiImg(emoji, label, 'twemoji--md')}       // medium (1.5em — pickers)
//   ${twemojiImg(emoji, label, 'twemoji--lg')}       // large (2em — hero)

export const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';

// Convert an emoji string to its Twemoji codepoint filename.
// Strips U+FE0F variation selector except where Twemoji's filenames require it,
// and joins compound codepoints (e.g. flags, ZWJ sequences) with '-'.
export function twemojiCodepoint(emoji) {
  if (!emoji) return '';
  const codepoints = [];
  for (const ch of emoji) {
    const code = ch.codePointAt(0);
    // Twemoji's convention: drop FE0F variation selector for single-codepoint
    // emojis where the base alone resolves uniquely. Keep it inside ZWJ chains.
    if (code === 0xFE0F && codepoints.length === 0) continue;
    codepoints.push(code.toString(16));
  }
  // Twemoji file naming: drop trailing FE0F if present after the base codepoint
  // (handles single-glyph cases like ⚔️ U+2694 U+FE0F → '2694.svg').
  while (codepoints.length > 1 && codepoints[codepoints.length - 1] === 'fe0f') {
    codepoints.pop();
  }
  return codepoints.join('-');
}

export function twemojiUrl(emoji) {
  const cp = twemojiCodepoint(emoji);
  return cp ? TWEMOJI_BASE + cp + '.svg' : '';
}

// Render an emoji as a Twemoji <img> tag. Returns '' for falsy input so callers
// can use it as a drop-in replacement for ${emoji} interpolations without guards.
// alt defaults to the raw emoji glyph (screen readers + copy-paste fidelity).
// sizeClass is appended to the base .twemoji class for size variants.
export function twemojiImg(emoji, alt, sizeClass) {
  if (!emoji) return '';
  const url = twemojiUrl(emoji);
  if (!url) return '';
  const cls = sizeClass ? `twemoji ${sizeClass}` : 'twemoji';
  const altText = alt || emoji;
  // alt is HTML-attribute-escaped via String() coercion + the constrained set
  // of mood labels / emoji characters that flow through this function. Callers
  // should pass already-trusted strings (mood.label is constants.js authored).
  return `<img class="${cls}" src="${url}" alt="${String(altText).replace(/"/g, '&quot;')}" loading="lazy" decoding="async" draggable="false">`;
}
