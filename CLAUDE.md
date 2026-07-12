# radio_head — Project Documentation

## Overview
A fun interactive web app: spin a 3D globe, stop it wherever you like, and hear that country's Spotify Top 50 chart songs (30-second previews).
Built as a static site — no backend, no build tools. Requires a Spotify account (PKCE OAuth). Just open `index.html`.

**Live on GitHub Pages:** https://adityagargdev.github.io/radio-head/

## Project Structure
```
radio_head/
├── index.html     — app shell, loads globe.gl CDN + app.js
├── style.css      — dark space theme, glassmorphism player panel
├── app.js         — globe init, radio API, geocoding, audio player
└── CLAUDE.md
```

## Tech Stack
| Layer | Tool |
|---|---|
| 3D Globe | [globe.gl](https://globe.gl/) via unpkg CDN (wraps Three.js) |
| Music | [Spotify Web API](https://developer.spotify.com/documentation/web-api) — Top 50 playlists, 30s `preview_url` |
| Auth | Spotify PKCE OAuth (Authorization Code + PKCE) — no client secret needed |
| Reverse geocoding | [BigDataCloud](https://www.bigdatacloud.com/geocoding-apis/free-reverse-geocode-to-city-api) — browser-safe, no key |
| Fonts | Space Mono (Google Fonts) |
| Framework | None — vanilla HTML/CSS/JS |

## Features
- Spotify login overlay on first visit (PKCE OAuth — no password stored, token in localStorage)
- 3D interactive globe (drag to rotate, scroll to zoom), auto-rotates on load
- **SPIN** button — animates globe to a random location
- **TUNE IN** button — stops globe, reverse-geocodes center, searches Spotify for that country's Top 50 playlist, starts playing 30s previews
- Album art, track name, artist, `#N of M this week` counter
- Progress bar (fills as preview plays, resets on track change)
- Prev / Play-Pause / Next controls
- Auto-advance to next track when preview ends; auto-skip on stream error
- Country flag emoji + country name in player header
- Red dot marker placed on globe at the tuned location
- Ripple animation on center crosshair when playing
- Ocean detection — friendly message if you land on water
- Token auto-refresh via Spotify refresh token (stays logged in across sessions)

## Setup & Running
No install needed.

```bash
# Option 1: open directly
start index.html

# Option 2: local dev server (avoids some CORS edge cases)
npx serve .
# or
python -m http.server 8080
```

## Key Decisions & Notes
- **PKCE vs Client Credentials**: PKCE requires only `client_id` (no `client_secret`), making it safe to hardcode in a public GitHub repo. Users log in with their own Spotify account.
- **No client secret in repo**: PKCE flow is entirely browser-side — `crypto.subtle` SHA-256 for the code challenge, `sessionStorage` for the verifier, `localStorage` for tokens.
- **Spotify Top 50 search**: `/search?q=Top+50+{country}&type=playlist&limit=10` then find the result where `owner.id === 'spotify'` and name includes `'top 50'`. Falls back to first result if no official playlist found.
- **Preview URLs only**: Spotify `preview_url` gives 30-second clips with no additional auth beyond the user token. Full tracks would require Spotify Premium + SDK.
- **BigDataCloud geocoding**: `api.bigdatacloud.net/data/reverse-geocode-client` — browser-safe (no custom User-Agent required), returns `{countryCode, countryName}`. Replaced Nominatim which blocked all browser requests.
- **globe.gl pointOfView()**: Returns `{lat, lng, altitude}` of the camera — this IS the geographic center of what's visible, used directly as the tuned location.
- **Spin mechanic**: Uses `world.pointOfView({lat, lng, altitude}, duration)` to smoothly arc camera to random coordinates.

## Changelog
| Date | Change |
|------|--------|
| 2026-07-12 | Project initialized — globe, SPIN/TUNE IN, radio player, geocoding all working |
| 2026-07-12 | Added `is_https=true` to Radio Browser query — eliminates HTTP stream mixed-content failures |
| 2026-07-13 | Fixed geocoding: Nominatim → BigDataCloud (Nominatim blocks browser requests without custom User-Agent) |
| 2026-07-13 | Fixed Radio Browser API param: `countrycodeExact` (invalid, ignored by API) → `countrycode` |
| 2026-07-13 | Pivoted from Radio Browser API (unreliable) → Spotify Top 50 charts + PKCE OAuth |
| 2026-07-13 | Added Spotify client ID (`bd65e4f0...`) — app fully functional on GitHub Pages |
