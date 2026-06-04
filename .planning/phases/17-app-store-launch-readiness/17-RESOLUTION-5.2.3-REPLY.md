# Resolution Center reply — Guideline 5.2.3 rejection (Build 104 / v1.0)

**Submission ID:** 0bfb6e8b-ef7b-40d8-9361-b20548d08b46
**Rejected:** 2026-06-03 (reviewed on iPad Air 11" M3)
**Guideline:** 5.2.3 Legal — Intellectual Property (audio/video streaming, catalogs, discovery)
**Reviewer's ask:** documentary evidence of rights/permissions to the third-party
streaming/catalog/discovery services in the app.
**Flagged screen (per reviewer screenshot):** "The Office (US)" title detail —
inline trailer player + "Where to Watch" (Netflix stream / Apple TV + Google Play buy)
+ cast/metadata, with "Provider data via TMDB" attribution visible.

**Strategy:** documentation reply, no code change. Establish TMDB API license +
attribution; clarify video = YouTube-embedded official trailers + user's own personal
media (DRM streams blocked); frame Where-to-Watch as deep-linking users TO rights holders.

**Evidence to attach in App Review Information:** TMDB API Terms of Use
(https://www.themoviedb.org/api-terms-of-use) — optionally + screenshot of approved
API key registration at themoviedb.org/settings/api.

---

## DRAFT REPLY (paste into Resolution Center → "Reply to App Review")

```text
Hello, and thank you for the detailed review.

Couch is a coordination/discovery tool that helps a household decide what to watch together. It is not a streaming service and does not host, download, rip, rebroadcast, or provide access to any copyrighted audio or video. All third-party data and media surfaces are either properly licensed or deep-link users to the official rights holders. Details below, organized by the elements visible on the screen you flagged (the "The Office" title page).

1) CATALOG, DISCOVERY, AND ARTWORK — licensed via TMDB
Titles, posters, ratings, cast, and season data come from The Movie Database (TMDB) REST API, which we access under a registered API key and TMDB's API Terms of Use. These terms grant the right to use the API and its content (including images) at no cost, provided attribution is displayed. We display the required attribution ("Powered by The Movie Database (TMDB). Couch is not endorsed or certified by TMDB.") on our marketing page, privacy and support pages, in the app's About section, and as "Provider data via TMDB" on the title detail screen visible in your screenshot. We are attaching the TMDB API Terms of Use as documentary evidence in the App Review Information section.

2) "WHERE TO WATCH" PROVIDERS — informational, deep-links to the rights holders
The streaming/buy availability (e.g., Netflix, Apple TV, Google Play) is sourced from TMDB's watch-providers data. These are informational availability indicators that link the user OUT to the official service to watch, rent, or buy. Couch never plays or unlocks content from these services itself — it directs users to the rights holders, which drives traffic to them rather than circumventing them.

3) IN-APP VIDEO — YouTube-embedded official trailers + the user's own personal media
The video element on the title page is an official trailer played through YouTube's own embedded player (the trailer key is provided by TMDB; playback occurs inside YouTube's player under YouTube's terms). Couch does not host or download trailer media. Our separate watchparty feature only plays (a) the same YouTube-embedded trailers and (b) media the user supplies from their own personal media server (e.g., Plex/Jellyfin .mp4 URLs they own). The player explicitly excludes DRM-protected flat-rate streaming services (Netflix, Disney+, Max, Hulu, Apple TV+, Paramount+, Peacock, Amazon Prime Video) from playback by design — it will not attempt to play protected content from those services.

In short: catalog/discovery data is licensed and attributed (TMDB), provider availability deep-links users to the official services, and video playback is limited to YouTube-hosted official trailers and the user's own personal media — never copyrighted streams.

We're happy to provide any additional documentation that would help. Thank you again for your time and guidance.
```

---

## Notes
- Resolution Center reply field limit is ~4,000 chars; the draft above is well under.
- After sending the reply, ALSO attach the TMDB API Terms PDF/screenshot in the
  "App Review Information → Attachment" field, then "Resubmit to App Review."
- Likely NO new build required — this can be resolved as a reply + evidence + resubmit
  of the same Build 104. Confirm the resubmit path in ASC before uploading anything.
