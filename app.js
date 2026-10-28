// Pocket Puzzles shell: hub, routing, storage, stats, and the ctx object each game receives.
// Game modules live in games/<id>.js and export default { id, name, tagline, color, glyph, help, mount(el, ctx) }.
// mount returns an optional cleanup function.

const GAMES = ['sudoku', 'target', 'mines', 'nonogram', 'binary'];

const $ = (id) => document.getElementById(id);
const view = $('view'), titleEl = $('title'), backBtn = $('back'), helpBtn = $('help');
const modal = $('modal'), modalCard = $('modal-card'), toastEl = $('toast');

// Storage (wrapped: private mode can throw) ----
const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem('pp:' + key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem('pp:' + key, JSON.stringify(val)); } catch {}
  },
  del(key) { try { localStorage.removeItem('pp:' + key); } catch {} },
};

// Dates and seeded randomness ----
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// mulberry32: returns a function giving floats in [0, 1)
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// Stats ----
// stats:<id> = { played, won, streak, maxStreak, lastDailyWin, dailyDone: {date: true}, best: {mode: seconds} }
function getStats(id) {
  return store.get('stats:' + id, { played: 0, won: 0, streak: 0, maxStreak: 0, lastDailyWin: null, dailyDone: {}, best: {} });
}
function recordWin(id, { mode = 'default', time = null, daily = false, noBest = false } = {}) {
  const s = getStats(id);
  s.won++;
  let newBest = false;
  if (time != null && !noBest && (s.best[mode] == null || time < s.best[mode])) { s.best[mode] = time; newBest = true; }
  if (daily) {
    const t = today();
    if (!s.dailyDone[t]) {
      s.streak = s.lastDailyWin === yesterday() ? s.streak + 1 : 1;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
      s.lastDailyWin = t;
      s.dailyDone[t] = true;
    }
  }
  store.set('stats:' + id, s);
  return { stats: s, newBest };
}
function recordStart(id) {
  const s = getStats(id); s.played++; store.set('stats:' + id, s);
}

// Modal and toast ----
let toastTimer = null;
function toast(msg, ms = 1800) {
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}
function openModal(html, buttons = []) {
  modalCard.innerHTML = html;
  if (buttons.length) {
    const row = document.createElement('div'); row.className = 'row';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : '');
      el.textContent = b.label;
      el.onclick = () => { closeModal(); b.onClick && b.onClick(); };
      row.appendChild(el);
    }
    modalCard.appendChild(row);
  }
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; modalCard.innerHTML = ''; }
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// Hub ----
const loaded = {};
async function loadGame(id) {
  if (!loaded[id]) loaded[id] = (await import(`./games/${id}.js`)).default;
  return loaded[id];
}

async function renderHub() {
  titleEl.textContent = 'Pocket Puzzles';
  backBtn.hidden = true; helpBtn.hidden = true;
  const d = new Date();
  view.innerHTML = `<p class="hub-date">${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><div class="tiles" id="tiles"></div><p class="hub-foot">Works offline. Progress is saved on this phone.</p>`;
  const tiles = $('tiles');
  const games = await Promise.all(GAMES.map((g) => loadGame(g).catch(() => null)));
  for (const g of games) {
    if (!g) continue;
    const s = getStats(g.id);
    const btn = document.createElement('button');
    btn.className = 'tile';
    const doneToday = s.dailyDone && s.dailyDone[today()];
    btn.innerHTML = `
      ${doneToday ? '<span class="done-dot">✓ today</span>' : ''}
      <div class="glyph" style="background:${g.color}">${g.glyph}</div>
      <div class="name">${g.name}</div>
      <div class="tag">${g.tagline}</div>
      <div class="meta"><span>${s.won} solved</span>${s.streak ? `<span>🔥 ${s.streak}</span>` : ''}</div>`;
    btn.onclick = () => { location.hash = '#/' + g.id; };
    tiles.appendChild(btn);
  }
}

// Game view ----
let cleanup = null;
async function renderGame(id) {
  const game = await loadGame(id).catch(() => null);
  if (!game) { location.hash = ''; return; }
  titleEl.textContent = game.name;
  backBtn.hidden = false;
  helpBtn.hidden = !game.help;
  helpBtn.onclick = () => openModal(`<h2>How to play</h2>${game.help}`, [{ label: 'Got it', primary: true }]);
  view.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'game game-' + id;
  view.appendChild(el);
  const ctx = makeCtx(game, el);
  cleanup = game.mount(el, ctx) || null;
  if (!store.get('seenHelp:' + id) && game.help) {
    store.set('seenHelp:' + id, true);
    helpBtn.click();
  }
}

function makeCtx(game, el) {
  const id = game.id;
  const ctx = {
    // per-game storage
    get: (key, fallback) => store.get(`${id}:${key}`, fallback),
    set: (key, val) => store.set(`${id}:${key}`, val),
    del: (key) => store.del(`${id}:${key}`),
    today, rng, hashStr, formatTime, toast,
    dailySeed: (extra = '') => hashStr(`${id}|${today()}|${extra}`),
    stats: () => getStats(id),
    started: () => recordStart(id),
    // Call when the player solves a puzzle. opts: { mode, time (sec), daily (bool), noBest (bool), title, detail, onAgain }
    win(opts = {}) {
      const { newBest, stats } = recordWin(id, opts);
      const timeLine = opts.time != null ? `<div class="big">${formatTime(opts.time)}</div>` : '';
      const bestLine = newBest && opts.time != null ? '<p class="sub">New best time!</p>' : '';
      const streakLine = opts.daily && stats.streak > 1 ? `<p class="sub">🔥 ${stats.streak} day streak</p>` : '';
      setTimeout(() => openModal(
        `<h2>${opts.title || 'Solved!'}</h2>${timeLine}${opts.detail ? `<p class="sub">${opts.detail}</p>` : ''}${bestLine}${streakLine}`,
        [
          { label: 'Home', onClick: () => { location.hash = ''; } },
          ...(opts.onAgain ? [{ label: opts.againLabel || 'New puzzle', primary: true, onClick: opts.onAgain }] : []),
        ]
      ), opts.delay ?? 450);
    },
    lose(opts = {}) {
      setTimeout(() => openModal(
        `<h2>${opts.title || 'Not this time'}</h2>${opts.detail ? `<p class="sub">${opts.detail}</p>` : ''}`,
        [
          { label: 'Home', onClick: () => { location.hash = ''; } },
          ...(opts.onAgain ? [{ label: opts.againLabel || 'Try again', primary: true, onClick: opts.onAgain }] : []),
        ]
      ), opts.delay ?? 450);
    },
    modal: openModal,
    closeModal,
    buzz: (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} },
  };
  return ctx;
}

// Router ----
async function route() {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  closeModal();
  const m = location.hash.match(/^#\/(\w+)/);
  if (m && GAMES.includes(m[1])) await renderGame(m[1]);
  else await renderHub();
  view.scrollTop = 0;
}
backBtn.onclick = () => {
  if (history.length > 1 && location.hash) history.back(); else location.hash = '';
};
window.addEventListener('hashchange', route);
route();

// Offline support ----
// Skipped on "localhost" so edits show up immediately while developing (test offline on 127.0.0.1).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  if (location.hostname === 'localhost') navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  else navigator.serviceWorker.register('sw.js').catch(() => {});
}
