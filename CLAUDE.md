# radio_head — Project Documentation

## Overview
A fun interactive web app: spin a 3D globe, stop it wherever you like, and hear live radio from that location.
Built as a static site — no backend, no API keys, no build tools. Just open `index.html`.

**GitHub Pages ready.** Push to a repo and enable Pages to deploy instantly.

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
| Radio stations | [Radio Browser API](https://www.radio-browser.info/) — free, no key |
| Reverse geocoding | [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) — free, no key |
| Fonts | Space Mono (Google Fonts) |
| Framework | None — vanilla HTML/CSS/JS |

## Features
- 3D interactive globe (drag to rotate, scroll to zoom)
- Auto-rotation on load
- **SPIN** button — animates globe to a random location
- **TUNE IN** button — stops globe, reverse-geocodes center point, fetches radio stations from that country, starts playing
- Equalizer visualizer (CSS animation) when playing
- Prev / Play-Pause / Next station controls
- Station count display (`3 / 18 stations`)
- Genre tags shown per station
- Country flag emoji derived from ISO 3166-1 country code
- Red dot marker placed on globe at the tuned location
- Ripple animation on center crosshair when playing
- Ocean detection — friendly message if you land on water
- Auto-skips dead streams (tries next station on error)
- Prefers HTTPS streams to avoid mixed-content issues on GitHub Pages
- Fallback across 3 Radio Browser API servers

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
- **HTTPS streams only**: `is_https=true` is sent to the Radio Browser API so only streams with HTTPS URLs are returned. This prevents mixed-content blocks on GitHub Pages. Means fewer stations for some countries, but zero silent playback failures.
- **Nominatim User-Agent**: Browsers block setting `User-Agent` in JS fetch (forbidden header). Nominatim sees the browser's UA — acceptable for low-volume use.
- **globe.gl pointOfView()**: Returns `{lat, lng, altitude}` of the camera — this IS the geographic center of what's visible, so it's used directly as the "tuned" location.
- **Spin mechanic**: Uses `world.pointOfView({lat, lng}, duration)` which smoothly animates the camera arc to a random location — no manual physics needed.

## Changelog
| Date | Change |
|------|--------|
| 2026-07-12 | Project initialized — globe, SPIN/TUNE IN, radio player, geocoding all working |
| 2026-07-12 | Added `is_https=true` to Radio Browser query — eliminates HTTP stream mixed-content failures |
