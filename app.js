// Radio Browser API servers (tried in order as fallback)
const RADIO_SERVERS = [
  'https://all.api.radio-browser.info',  // official round-robin DNS — always routes to a live server
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const audio      = $('audio');
const tuneBtn    = $('tune-btn');
const spinBtn    = $('spin-btn');
const player     = $('player');
const playpause  = $('playpause');
const prevBtn    = $('prev');
const nextBtn    = $('next');
const closeBtn   = $('close-btn');
const stationEl  = $('station-name');
const tagsEl     = $('tags');
const countryEl  = $('country');
const flagEl     = $('flag');
const countEl    = $('count');
const visualizer = $('visualizer');
const ci         = $('ci');

// ── State ────────────────────────────────────────────────────────────────────
let stations = [], currentIdx = 0, isBusy = false;

// ── Build visualizer bars ────────────────────────────────────────────────────
for (let i = 0; i < 20; i++) {
  const bar = document.createElement('span');
  bar.className = 'bar';
  // Stagger animation so it looks like a real equalizer
  bar.style.animationDelay = `${-(i * 0.045).toFixed(3)}s`;
  visualizer.appendChild(bar);
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

world.controls().autoRotate = true;
world.controls().autoRotateSpeed = 0.6;
world.controls().enableDamping = true;

window.addEventListener('resize', () =>
  world.width(window.innerWidth).height(window.innerHeight)
);

// ── Radio Browser API ────────────────────────────────────────────────────────
async function radioFetch(path) {
  for (const host of RADIO_SERVERS) {
    try {
      const r = await fetch(`${host}/json${path}`);
      if (r.ok) return r.json();
    } catch { /* try next server */ }
  }
  throw new Error('All radio API servers unreachable');
}

async function getStations(countryCode) {
  return radioFetch(
    `/stations/search?countrycode=${countryCode}&limit=30&order=clickcount&reverse=true&hidebroken=true&is_https=true`
  );
}

// ── Geocoding ────────────────────────────────────────────────────────────────
// Using BigDataCloud — free, no API key, built for browser use (no User-Agent restrictions like Nominatim)
async function reverseGeocode(lat, lng) {
  const r = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&localityLanguage=en`
  );
  return r.json();
}

// ISO 3166-1 alpha-2 → flag emoji
function ccToFlag(cc) {
  if (!cc || cc.length !== 2) return '🌍';
  return [...cc.toUpperCase()]
    .map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// ── Audio / playback ─────────────────────────────────────────────────────────
function setPlaying(on) {
  playpause.textContent = on ? '⏸' : '▶';
  player.classList.toggle('playing', on);
}

function playStation(i) {
  if (!stations.length) return;
  currentIdx = ((i % stations.length) + stations.length) % stations.length;
  const s = stations[currentIdx];

  audio.src = s.url_resolved || s.url;
  audio.play().catch(() => {
    // Stream dead — skip to the next one automatically
    if (stations.length > 1) playStation(currentIdx + 1);
  });

  stationEl.textContent = s.name;
  tagsEl.textContent = s.tags
    ? s.tags.split(',').slice(0, 3).filter(Boolean).join(' · ')
    : '';
  countEl.textContent = `${currentIdx + 1} / ${stations.length} stations`;
  setPlaying(true);
}

// ── Player UI ────────────────────────────────────────────────────────────────
function openPlayer(country, flag) {
  flagEl.textContent = flag;
  countryEl.textContent = country;
  stationEl.textContent = 'Scanning frequencies...';
  tagsEl.textContent = '';
  countEl.textContent = '';

  player.classList.remove('hidden', 'open');
  void player.offsetWidth; // force reflow so animation replays
  player.classList.add('open');
  ci.classList.add('tuned');
}

function closePlayer() {
  player.classList.add('hidden');
  player.classList.remove('playing');
  ci.classList.remove('tuned');
  audio.pause();
  audio.src = '';
  stations = [];
  world.pointsData([]);
  world.controls().autoRotate = true;
}

// ── Tune In ──────────────────────────────────────────────────────────────────
tuneBtn.addEventListener('click', async () => {
  if (isBusy) return;
  isBusy = true;
  tuneBtn.disabled = true;
  spinBtn.disabled = true;
  tuneBtn.textContent = '⟳ SCANNING...';
  tuneBtn.classList.add('scanning');

  world.controls().autoRotate = false;
  const { lat, lng } = world.pointOfView();

  try {
    const geo = await reverseGeocode(lat, lng);
    const cc      = geo.countryCode?.toUpperCase();
    const country = geo.countryName;

    if (!cc) {
      openPlayer("You're over the ocean! 🌊", '🌊');
      stationEl.textContent = 'No signal here — spin and try again!';
      return;
    }

    openPlayer(country, ccToFlag(cc));
    stations = await getStations(cc);

    if (!stations.length) {
      stationEl.textContent = `No stations found for ${country}`;
      countEl.textContent = 'Try another location';
      return;
    }

    world.pointsData([{ lat, lng }]);
    playStation(0);

  } catch (err) {
    openPlayer('Signal lost', '📡');
    stationEl.textContent = 'Could not reach radio servers. Try again!';
  } finally {
    tuneBtn.textContent = '📻 TUNE IN';
    tuneBtn.classList.remove('scanning');
    tuneBtn.disabled = false;
    spinBtn.disabled = false;
    isBusy = false;
  }
});

// ── Spin ─────────────────────────────────────────────────────────────────────
spinBtn.addEventListener('click', () => {
  if (isBusy) return;
  closePlayer();
  // Animate camera to a random lat/lng — feels like spinning a globe
  const lat = Math.random() * 130 - 65;
  const lng = Math.random() * 360 - 180;
  world.pointOfView({ lat, lng, altitude: 2.5 }, 1600);
  world.controls().autoRotate = true;
});

// ── Player controls ───────────────────────────────────────────────────────────
playpause.addEventListener('click', () => {
  if (audio.paused) { audio.play(); }
  else              { audio.pause(); }
});

prevBtn.addEventListener('click', () => playStation(currentIdx - 1));
nextBtn.addEventListener('click', () => playStation(currentIdx + 1));
closeBtn.addEventListener('click', closePlayer);

audio.addEventListener('error',  () => { if (stations.length > 1) playStation(currentIdx + 1); });
audio.addEventListener('play',   () => setPlaying(true));
audio.addEventListener('pause',  () => setPlaying(false));
