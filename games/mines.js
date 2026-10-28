// Mines: classic mine-sweeping. First dig is always safe and opens an area.
// Modes: daily (medium board, same for everyone that day, one attempt), easy, medium, hard.

const MODES = {
  daily: { label: 'Daily', w: 10, h: 12, m: 20 },
  easy: { label: 'Easy', w: 8, h: 8, m: 10 },
  medium: { label: 'Medium', w: 10, h: 12, m: 20 },
  hard: { label: 'Hard', w: 12, h: 16, m: 38 },
};
const MODE_KEYS = ['daily', 'easy', 'medium', 'hard'];
const GAP = 2;
const LONG_PRESS_MS = 350;

// Board logic (pure, no DOM) ----
function neighbors(i, w, h) {
  const x = i % w, y = (i / w) | 0, out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) out.push(ny * w + nx);
    }
  }
  return out;
}
function shuffled(n, rand) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Mines are the first m cells of a fixed random order, skipping the 3x3 around the first dig.
// The same order + same first dig always gives the same board, so the daily stays deterministic.
function placeMines(w, h, m, order, safe) {
  const excl = new Set([safe, ...neighbors(safe, w, h)]);
  const mines = new Array(w * h).fill(0);
  let n = 0;
  for (const i of order) {
    if (n >= m) break;
    if (!excl.has(i)) { mines[i] = 1; n++; }
  }
  return mines;
}
function computeCounts(mines, w, h) {
  return mines.map((_, i) => neighbors(i, w, h).reduce((s, j) => s + mines[j], 0));
}
function newState(mode, rand, date = null) {
  const { w, h, m } = MODES[mode];
  return {
    mode, w, h, m, date,
    order: shuffled(w * h, rand),
    mines: null, counts: null,
    open: new Array(w * h).fill(0),
    flag: new Array(w * h).fill(0),
    status: 'ready', // ready | play | won | lost
    elapsed: 0, hit: -1,
  };
}
function reveal(st, i) {
  if (st.open[i] || st.flag[i]) return;
  if (st.mines[i]) { st.hit = i; st.status = 'lost'; return; }
  const stack = [i];
  while (stack.length) {
    const c = stack.pop();
    if (st.open[c] || st.flag[c]) continue;
    st.open[c] = 1;
    if (st.counts[c] === 0) {
      for (const n of neighbors(c, st.w, st.h)) if (!st.open[n] && !st.flag[n]) stack.push(n);
    }
  }
}
function dig(st, i) {
  if (st.status === 'ready') {
    st.mines = placeMines(st.w, st.h, st.m, st.order, i);
    st.counts = computeCounts(st.mines, st.w, st.h);
    st.status = 'play';
  }
  if (st.status !== 'play') return;
  reveal(st, i);
  checkWin(st);
}
// Tapping an open number whose flag count matches opens all its other neighbours.
function chord(st, i) {
  if (st.status !== 'play' || !st.open[i] || !st.counts[i]) return false;
  const ns = neighbors(i, st.w, st.h);
  const flags = ns.reduce((s, j) => s + st.flag[j], 0);
  if (flags !== st.counts[i]) return false;
  let did = false;
  for (const j of ns) {
    if (!st.open[j] && !st.flag[j]) { did = true; reveal(st, j); if (st.status === 'lost') return true; }
  }
  checkWin(st);
  return did;
}
function checkWin(st) {
  if (st.status !== 'play') return;
  const opened = st.open.reduce((s, v) => s + v, 0);
  if (opened === st.w * st.h - st.m) {
    st.status = 'won';
    st.mines.forEach((v, i) => { if (v) st.flag[i] = 1; });
  }
}

export const _test = { neighbors, shuffled, placeMines, computeCounts, newState, reveal, dig, chord, checkWin, MODES };

// Styles ----
const CSS = `
.game-mines .mn-top { margin: 4px 0 12px; }
.game-mines .mn-stats { margin: 0 4px 10px; }
.game-mines .mn-board {
  display: grid; gap: ${GAP}px; touch-action: manipulation;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
.game-mines .mn-cell {
  width: var(--mn-size); height: var(--mn-size);
  border-radius: 5px; display: grid; place-items: center;
  font-weight: 800; font-size: calc(var(--mn-size) * 0.55); line-height: 1;
  background: var(--line);
  box-shadow: inset 0 -2px 0 rgba(0,0,0,0.18);
  font-variant-numeric: tabular-nums;
  -webkit-touch-callout: none;
}
.game-mines .mn-cell.open { background: transparent; box-shadow: inset 0 0 0 1px var(--line); }
.game-mines .mn-cell.press { filter: brightness(0.9); }
.game-mines .mn-cell.flag::after { content: '⚑'; color: var(--bad); font-size: calc(var(--mn-size) * 0.6); }
.game-mines .mn-cell.mine::after { content: '✹'; color: var(--text); font-size: calc(var(--mn-size) * 0.62); }
.game-mines .mn-cell.hit { background: var(--bad); }
.game-mines .mn-cell.hit::after { color: #fff; }
.game-mines .mn-cell.wrong { background: var(--bad-soft); }
.game-mines .mn-cell.wrong::after { content: '✕'; color: var(--bad); }
.game-mines .mn-board.done .mn-cell { cursor: default; }
.game-mines .n1 { color: #1c7ed6; } .game-mines .n2 { color: #2b8a3e; } .game-mines .n3 { color: #e03131; }
.game-mines .n4 { color: #5f3dc4; } .game-mines .n5 { color: #a61e4d; } .game-mines .n6 { color: #0c8599; }
.game-mines .n7 { color: var(--text); } .game-mines .n8 { color: var(--muted); }
.game-mines .mn-note { text-align: center; color: var(--muted); font-size: 14px; margin: 12px 0 0; min-height: 18px; }
.game-mines .mn-tools { margin-top: 16px; }
`;
// Lighter number colours for dark mode, applied under the same two dark-mode selectors style.css uses.
const DARK_NUMS = { n1: '#74c0fc', n2: '#69db7c', n3: '#ff8787', n4: '#b197fc', n5: '#f783ac', n6: '#66d9e8' };
function darkRules(prefix) {
  return Object.entries(DARK_NUMS).map(([k, v]) => `${prefix} .game-mines .${k} { color: ${v}; }`).join('\n');
}
function injectStyle() {
  if (document.getElementById('mines-style')) return;
  const s = document.createElement('style');
  s.id = 'mines-style';
  s.textContent = CSS +
    `@media (prefers-color-scheme: dark) {\n${darkRules(':root:not([data-theme="light"])')}\n}\n` +
    darkRules(':root[data-theme="dark"]');
  document.head.appendChild(s);
}

// Game module ----
export default {
  id: 'mines',
  name: 'Mines',
  tagline: 'Clear the field without setting one off.',
  color: '#2b8a3e',
  glyph: '✹',
  help: `<p>Open every square that is not a mine.</p>
<ul>
<li>A number tells how many mines touch that square, including diagonals.</li>
<li>Your first tap is always safe.</li>
<li>Switch to Flag, or press and hold, to mark a mine.</li>
<li>Tap a number whose mines are all flagged to open the rest of its neighbours.</li>
<li>Daily: one board for the day, one try.</li>
</ul>`,

  mount(el, ctx) {
    injectStyle();
    let mode = ctx.get('mode', 'daily');
    if (!MODES[mode]) mode = 'daily';
    let st = null;
    let tool = 'dig';
    let runningSince = null;
    let cells = [];
    let tick = null;

    el.innerHTML = `
      <div class="row mn-top"><div class="seg" id="mn-seg">${MODE_KEYS.map((k) => `<button data-m="${k}">${MODES[k].label}</button>`).join('')}</div></div>
      <div class="spread mn-stats"><span class="stat" id="mn-left"></span><span class="stat" id="mn-time"></span></div>
      <div class="board-wrap"><div class="mn-board" id="mn-board"></div></div>
      <p class="mn-note" id="mn-note"></p>
      <div class="row mn-tools">
        <button class="btn" id="mn-dig">⛏ Dig</button>
        <button class="btn" id="mn-flag">⚑ Flag</button>
        <button class="btn" id="mn-new">New</button>
      </div>`;
    const q = (id) => el.querySelector('#' + id);
    const board = q('mn-board'), seg = q('mn-seg'), leftEl = q('mn-left'), timeEl = q('mn-time'), noteEl = q('mn-note');
    const digBtn = q('mn-dig'), flagBtn = q('mn-flag'), newBtn = q('mn-new');

    const stateKey = (m) => 'game:' + m;
    const elapsed = () => st.elapsed + (runningSince ? (Date.now() - runningSince) / 1000 : 0);
    function pause() { if (runningSince) { st.elapsed = elapsed(); runningSince = null; } }
    function resume() { if (st && st.status === 'play' && !runningSince && !document.hidden) runningSince = Date.now(); }
    function save() { if (!st) return; pause(); ctx.set(stateKey(st.mode), st); resume(); }

    function freshState(m) {
      if (m === 'daily') return newState('daily', ctx.rng(ctx.dailySeed()), ctx.today());
      return newState(m, Math.random);
    }
    function loadMode(m) {
      pause();
      if (st) ctx.set(stateKey(st.mode), st);
      mode = m;
      ctx.set('mode', m);
      let saved = ctx.get(stateKey(m), null);
      if (saved && m === 'daily' && saved.date !== ctx.today()) saved = null;
      if (saved && (saved.w !== MODES[m].w || saved.h !== MODES[m].h)) saved = null;
      st = saved || freshState(m);
      buildBoard();
      resume();
      render();
    }
    function newGame(m = mode) {
      pause();
      if (m !== 'daily') ctx.del(stateKey(m));
      st = null;
      loadMode(m);
    }

    function sizeCell() {
      const avail = Math.min(el.clientWidth || window.innerWidth - 32, 528);
      const size = Math.max(24, Math.min(40, Math.floor((avail - (st.w - 1) * GAP) / st.w)));
      board.style.setProperty('--mn-size', size + 'px');
      board.style.gridTemplateColumns = `repeat(${st.w}, ${size}px)`;
    }
    function buildBoard() {
      board.innerHTML = '';
      cells = [];
      for (let i = 0; i < st.w * st.h; i++) {
        const c = document.createElement('div');
        c.className = 'mn-cell';
        c.dataset.i = i;
        board.appendChild(c);
        cells.push(c);
      }
      sizeCell();
    }

    function render() {
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      digBtn.classList.toggle('on', tool === 'dig');
      flagBtn.classList.toggle('on', tool === 'flag');
      newBtn.hidden = mode === 'daily';
      const over = st.status === 'won' || st.status === 'lost';
      board.classList.toggle('done', over);
      const flags = st.flag.reduce((s, v) => s + v, 0);
      leftEl.textContent = `✹ ${st.m - flags}`;
      timeEl.textContent = '⏱ ' + ctx.formatTime(elapsed());
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        let cls = 'mn-cell', txt = '';
        if (st.open[i]) {
          cls += ' open';
          const n = st.counts[i];
          if (n) { cls += ' n' + n; txt = String(n); }
        } else if (st.status === 'lost' && st.mines[i] && !st.flag[i]) {
          cls += ' open mine' + (i === st.hit ? ' hit' : '');
        } else if (st.status === 'lost' && st.flag[i] && !st.mines[i]) {
          cls += ' wrong';
        } else if (st.flag[i]) {
          cls += ' flag';
        }
        if (c.className !== cls) c.className = cls;
        if (c.textContent !== txt) c.textContent = txt;
      }
      if (mode === 'daily' && st.status === 'won') noteEl.textContent = 'Daily cleared. A new board arrives tomorrow.';
      else if (mode === 'daily' && st.status === 'lost') noteEl.textContent = 'That was today\'s one try. A new board arrives tomorrow.';
      else if (st.status === 'ready') noteEl.textContent = mode === 'daily' ? 'Today\'s board. One try.' : 'Tap any square to start.';
      else noteEl.textContent = '';
    }

    function finish() {
      pause();
      save();
      render();
      const time = Math.round(st.elapsed);
      if (st.status === 'won') {
        ctx.win({
          mode, time, daily: mode === 'daily',
          detail: mode === 'daily' ? 'Daily board cleared.' : `${MODES[mode].label} board cleared.`,
          onAgain: mode === 'daily' ? () => loadMode('medium') : () => newGame(),
          againLabel: mode === 'daily' ? 'Play Medium' : 'New board',
        });
      } else {
        ctx.buzz(60);
        board.classList.add('shake');
        setTimeout(() => board.classList.remove('shake'), 320);
        ctx.lose({
          title: 'Boom',
          detail: mode === 'daily' ? 'That was today\'s daily. Come back tomorrow for a new one.' : 'You hit a mine.',
          onAgain: mode === 'daily' ? () => loadMode('medium') : () => newGame(),
          againLabel: mode === 'daily' ? 'Play Medium' : 'New board',
          delay: 700,
        });
      }
    }

    function toggleFlag(i) {
      if (st.status !== 'play' || st.open[i]) return;
      st.flag[i] = st.flag[i] ? 0 : 1;
      ctx.buzz();
      save();
      render();
    }
    function tap(i) {
      if (st.status === 'won' || st.status === 'lost') return;
      if (st.status === 'play' && st.open[i]) {
        if (chord(st, i)) { if (st.status !== 'play') finish(); else { save(); render(); } }
        return;
      }
      if (tool === 'flag' && st.status === 'play') { toggleFlag(i); return; }
      if (st.flag[i]) return;
      const first = st.status === 'ready';
      dig(st, i);
      if (first) { ctx.started(); resume(); }
      if (st.status !== 'play') finish();
      else { save(); render(); }
    }

    // Touch input: tap acts with the current tool, hold flags. A hold never also digs.
    let press = null;
    function cancelPress() {
      if (!press) return;
      clearTimeout(press.timer);
      cells[press.i] && cells[press.i].classList.remove('press');
      press = null;
    }
    board.addEventListener('pointerdown', (e) => {
      let c = e.target.closest('.mn-cell');
      if (!c) { const k = nearestIndex(cells, e.clientX, e.clientY); c = k >= 0 ? cells[k] : null; }
      if (!c || press) return;
      e.preventDefault();
      const i = +c.dataset.i;
      press = { id: e.pointerId, i, x: e.clientX, y: e.clientY, fired: false };
      c.classList.add('press');
      press.timer = setTimeout(() => {
        if (!press) return;
        press.fired = true;
        cells[press.i].classList.remove('press');
        if (st.status === 'play' && !st.open[press.i]) toggleFlag(press.i);
      }, LONG_PRESS_MS);
    });
    board.addEventListener('pointermove', (e) => {
      if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancelPress();
    });
    const onUp = (e) => {
      if (!press || e.pointerId !== press.id) return;
      const { i, fired } = press;
      cancelPress();
      if (!fired) tap(i);
    };
    board.addEventListener('pointerup', onUp);
    board.addEventListener('pointercancel', cancelPress);
    board.addEventListener('pointerleave', cancelPress);
    board.addEventListener('contextmenu', (e) => e.preventDefault());
    board.addEventListener('touchstart', (e) => { if (e.touches.length === 1) e.preventDefault(); }, { passive: false });

    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && b.dataset.m !== mode) loadMode(b.dataset.m);
    });
    digBtn.onclick = () => { tool = 'dig'; render(); };
    flagBtn.onclick = () => { tool = 'flag'; render(); };
    newBtn.onclick = () => {
      if (st.status === 'play') {
        ctx.modal('<h2>Start a new board?</h2><p class="sub">This game will be lost.</p>', [
          { label: 'Cancel' },
          { label: 'New board', primary: true, onClick: () => newGame() },
        ]);
      } else newGame();
    };

    const onVis = () => { if (document.hidden) save(); else resume(); };
    const onResize = () => sizeCell();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);
    tick = setInterval(() => { if (runningSince) timeEl.textContent = '⏱ ' + ctx.formatTime(elapsed()); }, 500);

    loadMode(mode);

    return () => {
      save();
      clearInterval(tick);
      cancelPress();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
    };
  },
};

// Index of the element whose box is closest to (x, y), within 8px; -1 if none.
function nearestIndex(els, x, y) {
  let best = -1, bd = 64;
  els.forEach((c, k) => {
    const r = c.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
    if (dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = k; }
  });
  return best;
}
