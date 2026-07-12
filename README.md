# RadioGlobe

Spin a 3D globe, drop it on any country, and hear what's topping the charts there this week.

**Live demo → [adityagargdev.github.io/radio-head](https://adityagargdev.github.io/radio-head/)**

---

## What it does

- Drag and rotate a 3D Earth
- Hit **SPIN** to fly to a random country
- Hit **TUNE IN** to load that country's current Top 50 chart
- 30-second previews play in order — skip, pause, or go back
- Hover over any country to see its name highlighted

## How it works

| Layer | Tool |
|---|---|
| 3D Globe | [globe.gl](https://globe.gl/) — Three.js wrapper |
| Chart data | [iTunes RSS API](https://rss.itunes.apple.com/) — free, no key needed |
| Reverse geocoding | [BigDataCloud](https://www.bigdatacloud.com/) — free, no key needed |
| Political borders | [Natural Earth GeoJSON](https://github.com/holtzy/D3-graph-gallery) |
| Frontend | Vanilla HTML / CSS / JS — no build step |

No backend. No API keys. Just open `index.html`.

## Run locally

```bash
# Option 1 — open directly
start index.html

# Option 2 — local dev server (avoids CORS edge cases)
npx serve .
# or
python -m http.server 8080
```

## Notes

- Chart data comes from Apple Music, so rankings may differ slightly from Spotify or other platforms
- Some smaller countries don't have an iTunes Top 50 — you'll get a message if that's the case
- Audio previews are 30 seconds each (standard iTunes preview length)
