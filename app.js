// ── DOM ──────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const audio       = $('audio');
const tuneBtn     = $('tune-btn');
const spinBtn     = $('spin-btn');
const player      = $('player');
const playpause   = $('playpause');
const prevBtn     = $('prev');
const nextBtn     = $('next');
const closeBtn    = $('close-btn');
const trackNameEl = $('track-name');
const artistEl    = $('artist-name');
const albumArtEl  = $('album-art');
const countryEl   = $('country');
const flagEl      = $('flag');
const countEl     = $('count');
const progressBar = $('progress-bar');
const ci          = $('ci');

// ── State ─────────────────────────────────────────────────────────────────────
let tracks = [], currentIdx = 0, isBusy = false;

// ── Charts — iTunes RSS ───────────────────────────────────────────────────────
async function getTopTracks(countryName, cc) {
  const c = cc.toLowerCase();

  // Step 1: top songs RSS for this country (free, no auth)
  const rssRes = await fetch(
    `https://itunes.apple.com/${c}/rss/topsongs/limit=50/json`
  );
  if (!rssRes.ok) throw new Error(`No chart data available for ${countryName}`);
  const rssData = await rssRes.json();

  const entries = rssData.feed?.entry;
  if (!entries?.length) throw new Error(`No chart data available for ${countryName}`);

  // Extract track IDs
  const ids = entries.map(e => e.id?.attributes?.['im:id']).filter(Boolean);
  if (!ids.length) throw new Error(`No tracks found for ${countryName}`);

  // Step 2: batch lookup to get preview URLs (one request for all 50 tracks)
  const lookupRes = await fetch(
    `https://itunes.apple.com/lookup?id=${ids.join(',')}&country=${c}&limit=200`
  );
  if (!lookupRes.ok) throw new Error(`Could not load track details for ${countryName}`);
  const lookupData = await lookupRes.json();

  // Map trackId → metadata
  const byId = {};
  lookupData.results?.forEach(r => { if (r.trackId) byId[r.trackId] = r; });

  // Merge RSS chart order with lookup metadata, keep only tracks with previews
  return entries.map(e => {
    const id   = e.id?.attributes?.['im:id'];
    const info = byId[id];
    if (!info?.previewUrl) return null;
    return {
      name:        e['im:name']?.label  ?? info.trackName,
      artists:     [{ name: e['im:artist']?.label ?? info.artistName }],
      album:       { images: [{ url: e['im:image']?.[2]?.label ?? info.artworkUrl100 }] },
      preview_url: info.previewUrl,
    };
  }).filter(Boolean);
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
async function reverseGeocode(lat, lng) {
  const r = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&localityLanguage=en`
  );
  return r.json();
}

function ccToFlag(cc) {
  if (!cc || cc.length !== 2) return '🌍';
  return [...cc.toUpperCase()]
    .map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');
}

// ── Globe ─────────────────────────────────────────────────────────────────────
const world = Globe()
  .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
  .showAtmosphere(true)
  .atmosphereColor('lightskyblue')
  .atmosphereAltitude(0.15)
  .pointsData([])
  .pointColor(() => '#ff4757')
  .pointAltitude(0.04)
  .pointRadius(0.4)
  ($('globe-container'));

world.controls().autoRotate     = true;
world.controls().autoRotateSpeed = 0.6;
world.controls().enableDamping  = true;

window.addEventListener('resize', () =>
  world.width(window.innerWidth).height(window.innerHeight)
);

// ── Playback ──────────────────────────────────────────────────────────────────
function setPlaying(on) { playpause.textContent = on ? '⏸' : '▶'; }

function playTrack(i) {
  if (!tracks.length) return;
  currentIdx = ((i % tracks.length) + tracks.length) % tracks.length;
  const t = tracks[currentIdx];

  audio.src = t.preview_url;
  audio.play().catch(() => { if (tracks.length > 1) playTrack(currentIdx + 1); });

  trackNameEl.textContent = t.name;
  artistEl.textContent    = t.artists?.map(a => a.name).join(', ') ?? '';
  albumArtEl.src          = t.album?.images?.[0]?.url ?? '';
  countEl.textContent     = `#${currentIdx + 1} of ${tracks.length} this week`;
  progressBar.style.width = '0%';
  setPlaying(true);
}

// ── Player UI ─────────────────────────────────────────────────────────────────
function openPlayer(country, flag) {
  flagEl.textContent      = flag;
  countryEl.textContent   = country;
  trackNameEl.textContent = 'Loading charts...';
  artistEl.textContent    = '';
  albumArtEl.src          = '';
  countEl.textContent     = '';
  progressBar.style.width = '0%';

  player.classList.remove('hidden', 'open');
  void player.offsetWidth;
  player.classList.add('open');
  ci.classList.add('tuned');
}

function closePlayer() {
  player.classList.add('hidden');
  ci.classList.remove('tuned');
  audio.pause();
  audio.src           = '';
  tracks              = [];
  progressBar.style.width = '0%';
  world.pointsData([]);
  world.controls().autoRotate = true;
}

// ── Audio events ──────────────────────────────────────────────────────────────
audio.addEventListener('timeupdate', () => {
  if (audio.duration)
    progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
});

audio.addEventListener('ended', () => {
  if (currentIdx < tracks.length - 1) playTrack(currentIdx + 1);
});

audio.addEventListener('play',  () => setPlaying(true));
audio.addEventListener('pause', () => setPlaying(false));
audio.addEventListener('error', () => { if (tracks.length > 1) playTrack(currentIdx + 1); });

// ── Tune In ───────────────────────────────────────────────────────────────────
tuneBtn.addEventListener('click', async () => {
  if (isBusy) return;
  isBusy = true;
  tuneBtn.disabled = true;
  spinBtn.disabled = true;
  tuneBtn.textContent = '⟳ LOADING...';
  tuneBtn.classList.add('scanning');

  world.controls().autoRotate = false;
  const { lat, lng } = world.pointOfView();

  try {
    const geo     = await reverseGeocode(lat, lng);
    const cc      = geo.countryCode?.toUpperCase();
    const country = geo.countryName;

    if (!cc) {
      openPlayer("You're over the ocean! 🌊", '🌊');
      trackNameEl.textContent = 'No charts here — spin and try again!';
      return;
    }

    openPlayer(country, ccToFlag(cc));
    tracks = await getTopTracks(country, cc);

    if (!tracks.length) {
      trackNameEl.textContent = `No song previews available for ${country}`;
      countEl.textContent     = 'iTunes may not have a Top 50 here yet';
      return;
    }

    world.pointsData([{ lat, lng }]);
    playTrack(0);

  } catch (err) {
    openPlayer('Error', '📡');
    trackNameEl.textContent = err.message ?? 'Something went wrong. Try again!';
  } finally {
    tuneBtn.textContent = '🎵 TUNE IN';
    tuneBtn.classList.remove('scanning');
    tuneBtn.disabled = false;
    spinBtn.disabled = false;
    isBusy = false;
  }
});

// ── Spin ──────────────────────────────────────────────────────────────────────
spinBtn.addEventListener('click', () => {
  if (isBusy) return;
  closePlayer();
  world.pointOfView(
    { lat: Math.random() * 130 - 65, lng: Math.random() * 360 - 180, altitude: 2.5 },
    1600
  );
  world.controls().autoRotate = true;
});

// ── Player controls ───────────────────────────────────────────────────────────
playpause.addEventListener('click', () => { if (audio.paused) audio.play(); else audio.pause(); });
prevBtn.addEventListener('click',   () => playTrack(currentIdx - 1));
nextBtn.addEventListener('click',   () => playTrack(currentIdx + 1));
closeBtn.addEventListener('click',  closePlayer);
