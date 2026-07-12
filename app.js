// ── Config ───────────────────────────────────────────────────────────────────
const CLIENT_ID   = 'YOUR_SPOTIFY_CLIENT_ID'; // <-- fill this in
const REDIRECT_URI = window.location.origin
  + window.location.pathname.replace(/([^/])$/, '$1/'); // ensures trailing slash

// ── DOM ──────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const audio        = $('audio');
const tuneBtn      = $('tune-btn');
const spinBtn      = $('spin-btn');
const player       = $('player');
const playpause    = $('playpause');
const prevBtn      = $('prev');
const nextBtn      = $('next');
const closeBtn     = $('close-btn');
const trackNameEl  = $('track-name');
const artistEl     = $('artist-name');
const albumArtEl   = $('album-art');
const countryEl    = $('country');
const flagEl       = $('flag');
const countEl      = $('count');
const progressBar  = $('progress-bar');
const loginOverlay = $('login-overlay');
const spotifyBtn   = $('spotify-btn');
const ci           = $('ci');

// ── State ────────────────────────────────────────────────────────────────────
let tracks = [], currentIdx = 0, isBusy = false;

// ── PKCE helpers ─────────────────────────────────────────────────────────────
function makeVerifier(len = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return [...crypto.getRandomValues(new Uint8Array(len))]
    .map(b => chars[b % chars.length]).join('');
}

async function makeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// ── Auth ─────────────────────────────────────────────────────────────────────
async function startLogin() {
  const verifier  = makeVerifier();
  const challenge = await makeChallenge(verifier);
  sessionStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCode(code) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: sessionStorage.getItem('pkce_verifier'),
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('Token exchange failed');
  storeToken(data);
  sessionStorage.removeItem('pkce_verifier');
}

function storeToken(data) {
  localStorage.setItem('spotify_token', JSON.stringify({
    ...data,
    expires_at: Date.now() + data.expires_in * 1000,
  }));
}

async function getToken() {
  const raw = localStorage.getItem('spotify_token');
  if (!raw) return null;
  const token = JSON.parse(raw);

  // Still valid
  if (Date.now() < token.expires_at - 60_000) return token.access_token;

  // Refresh
  if (!token.refresh_token) { localStorage.removeItem('spotify_token'); return null; }

  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    }),
  });
  const data = await r.json();
  if (!data.access_token) { localStorage.removeItem('spotify_token'); return null; }
  storeToken({ ...token, ...data });
  return data.access_token;
}

// ── Spotify API ───────────────────────────────────────────────────────────────
async function spotifyFetch(path) {
  const token = await getToken();
  const r = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Spotify API ${r.status}`);
  return r.json();
}

async function getTopTracks(countryName) {
  // Find Spotify's official "Top 50 – <Country>" playlist
  const q      = encodeURIComponent(`Top 50 ${countryName}`);
  const search = await spotifyFetch(`/search?q=${q}&type=playlist&limit=10`);

  const playlist = search.playlists?.items?.find(p =>
    p?.owner?.id === 'spotify' && p?.name?.toLowerCase().includes('top 50')
  ) ?? search.playlists?.items?.[0];

  if (!playlist) throw new Error(`No Top 50 playlist found for ${countryName}`);

  const result = await spotifyFetch(
    `/playlists/${playlist.id}/tracks?limit=30` +
    `&fields=items(track(name,artists(name),album(images),preview_url,external_urls))`
  );

  return result.items
    .map(i => i.track)
    .filter(t => t?.name && t?.preview_url); // only tracks with a 30s preview
}

// ── Geocoding ────────────────────────────────────────────────────────────────
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

// ── Globe ────────────────────────────────────────────────────────────────────
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

world.controls().autoRotate    = true;
world.controls().autoRotateSpeed = 0.6;
world.controls().enableDamping = true;

window.addEventListener('resize', () =>
  world.width(window.innerWidth).height(window.innerHeight)
);

// ── Playback ─────────────────────────────────────────────────────────────────
function setPlaying(on) { playpause.textContent = on ? '⏸' : '▶'; }

function playTrack(i) {
  if (!tracks.length) return;
  currentIdx = ((i % tracks.length) + tracks.length) % tracks.length;
  const t = tracks[currentIdx];

  audio.src = t.preview_url;
  audio.play().catch(() => { if (tracks.length > 1) playTrack(currentIdx + 1); });

  trackNameEl.textContent = t.name;
  artistEl.textContent    = t.artists?.map(a => a.name).join(', ') ?? '';
  albumArtEl.src          = t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? '';
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
  void player.offsetWidth; // force reflow so animation replays
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

// auto-advance to next track when preview ends
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
    tracks = await getTopTracks(country);

    if (!tracks.length) {
      trackNameEl.textContent = `No song previews available for ${country}`;
      countEl.textContent = 'Spotify may not have a Top 50 here';
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
spotifyBtn.addEventListener('click', startLogin);

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Handle OAuth callback
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');

  if (code) {
    history.replaceState({}, '', window.location.pathname);
    try { await exchangeCode(code); } catch { /* show login */ }
  }

  // Show globe or login
  if (await getToken()) {
    loginOverlay.classList.add('hidden');
  }
  // login overlay is visible by default (not hidden) so nothing else needed
}

init();
