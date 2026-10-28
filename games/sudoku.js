// Sudoku: generated puzzles with a unique solution. Easy and Medium are solvable with singles only.

const MODES = [
  { id: 'daily', label: 'Daily' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];
// Givens to aim for; Daily plays at Medium.
const TARGET_GIVENS = { easy: 38, medium: 30, hard: 24, daily: 30 };
const SINGLES_ONLY = { easy: true, medium: true, hard: false, daily: true };

// Peers and units ----
const ROW = (i) => Math.floor(i / 9), COL = (i) => i % 9, BOX = (i) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push([...Array(9)].map((_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push([...Array(9)].map((_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
  const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3, u = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) u.push((r0 + r) * 9 + c0 + c);
  UNITS.push(u);
}
const PEERS = [...Array(81)].map((_, i) => {
  const s = new Set();
  for (const u of UNITS) if (u.includes(i)) u.forEach((j) => j !== i && s.add(j));
  return [...s];
});

// Solver: counts solutions up to `limit` using bitmasks and most-constrained-cell first ----
function countSolutions(grid, limit = 2, out = null) {
  const g = grid.slice();
  let count = 0;
  function candidates(i) {
    let used = 0;
    for (const p of PEERS[i]) if (g[p]) used |= 1 << g[p];
    return ~used & 0x3fe;
  }
  function rec() {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = candidates(i);
      const n = popcount(m);
      if (n === 0) return;
      if (n < bestN) { best = i; bestMask = m; bestN = n; if (n === 1) break; }
    }
    if (best < 0) { count++; if (out && !out.length) out.push(...g); return; }
    for (let d = 1; d <= 9 && count < limit; d++) {
      if (bestMask & (1 << d)) { g[best] = d; rec(); g[best] = 0; }
    }
  }
  rec();
  return count;
}
function popcount(m) { let n = 0; while (m) { m &= m - 1; n++; } return n; }

// True if naked and hidden singles alone fill the grid.
function solvableBySingles(grid) {
  const g = grid.slice();
  let progress = true;
  while (progress) {
    progress = false;
    const cand = g.map((v, i) => {
      if (v) return 0;
      let used = 0;
      for (const p of PEERS[i]) if (g[p]) used |= 1 << g[p];
      return ~used & 0x3fe;
    });
    for (let i = 0; i < 81; i++) {
      if (!g[i] && popcount(cand[i]) === 1) { g[i] = Math.log2(cand[i]); progress = true; }
    }
    if (progress) continue;
    for (const u of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const spots = u.filter((i) => !g[i] && cand[i] & (1 << d));
        if (spots.length === 1 && !u.some((i) => g[i] === d)) { g[spots[0]] = d; progress = true; }
      }
    }
  }
  return g.every((v) => v);
}

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Generator recipe:
// 1. Fill an empty grid by backtracking with shuffled digits.
// 2. Visit cells in random order and blank each one if the puzzle stays unique (and singles-solvable when required).
// 3. Stop at the target number of givens.
// 4. Hard retries (up to 20 times) until singles alone can no longer finish it.
function generate(level, rand) {
  let g = generateOnce(level, rand);
  for (let k = 0; level === 'hard' && k < 20 && solvableBySingles(g.puzzle); k++) g = generateOnce(level, rand);
  return g;
}
function generateOnce(level, rand) {
  const full = Array(81).fill(0);
  (function fill(i) {
    if (i === 81) return true;
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand)) {
      if (PEERS[i].every((p) => full[p] !== d)) { full[i] = d; if (fill(i + 1)) return true; full[i] = 0; }
    }
    return false;
  })(0);
  const puzzle = full.slice();
  let givens = 81;
  for (const i of shuffle([...Array(81).keys()], rand)) {
    if (givens <= TARGET_GIVENS[level]) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    const ok = countSolutions(puzzle, 2) === 1 && (!SINGLES_ONLY[level] || solvableBySingles(puzzle));
    if (ok) givens--; else puzzle[i] = keep;
  }
  return { puzzle, solution: full };
}

function newState(mode, ctx) {
  const rand = mode === 'daily' ? ctx.rng(ctx.dailySeed()) : ctx.rng(Date.now() ^ Math.floor(Math.random() * 1e9));
  const { puzzle, solution } = generate(mode, rand);
  return {
    mode, day: mode === 'daily' ? ctx.today() : null,
    puzzle, solution,
    values: puzzle.slice(),
    notes: Array(81).fill(0),
    time: 0, hints: 0, done: false, history: [],
  };
}

const CSS = `
.game-sudoku .top { margin: 2px 0 12px; }
.game-sudoku #sd-board { width: 100%; display: flex; justify-content: center; }
.game-sudoku .grid {
  display: grid; grid-template-columns: repeat(9, 1fr);
  width: min(100%, 440px); aspect-ratio: 1;
  border: 2.5px solid var(--line-strong); border-radius: 6px; overflow: hidden;
  background: var(--line-strong); gap: 0;
}
.game-sudoku .cell {
  background: var(--cell); position: relative;
  display: grid; place-items: center;
  font-size: clamp(20px, 6.4vw, 28px); font-weight: 500;
  border-right: 1px solid var(--line); border-bottom: 1px solid var(--line);
  color: var(--accent); cursor: pointer; font-variant-numeric: tabular-nums;
}
.game-sudoku .cell.given { color: var(--text); font-weight: 650; }
.game-sudoku .cell.br { border-right: 2.5px solid var(--line-strong); }
.game-sudoku .cell.bb { border-bottom: 2.5px solid var(--line-strong); }
.game-sudoku .cell.peer { background: var(--peer); }
.game-sudoku .cell.same { background: var(--accent-soft); }
.game-sudoku .cell.sel { background: var(--sel); }
.game-sudoku .cell.bad { color: var(--bad); }
.game-sudoku .cell.bad.given { color: var(--text); background: var(--bad-soft); }
.game-sudoku .notes {
  position: absolute; inset: 1px; display: grid; grid-template-columns: repeat(3, 1fr);
  font-size: clamp(8px, 2.4vw, 11px); color: var(--muted); font-weight: 600; line-height: 1;
}
.game-sudoku .notes span { display: grid; place-items: center; }
.game-sudoku .notes span.hl { color: var(--accent); }
.game-sudoku .tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 14px auto 10px; width: min(100%, 440px); }
.game-sudoku .tool {
  border: none; background: transparent; display: flex; flex-direction: column; align-items: center; gap: 2px;
  font-size: 12px; font-weight: 600; color: var(--muted); padding: 4px 0; cursor: pointer;
}
.game-sudoku .tool .ic { font-size: 22px; height: 28px; color: var(--text); display: grid; place-items: center; }
.game-sudoku .tool.on .ic { color: var(--accent); }
.game-sudoku .tool .pill { font-size: 10px; background: var(--accent); color: #fff; border-radius: 999px; padding: 1px 6px; }
.game-sudoku .tool .pill.off { background: var(--surface-2); color: var(--muted); }
.game-sudoku .pad { display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; width: min(100%, 440px); margin: 0 auto; }
.game-sudoku .pad button {
  border: none; background: var(--surface); border-radius: 10px;
  height: 58px; font-size: 26px; font-weight: 500; color: var(--accent); cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1;
}
.game-sudoku .pad button small { font-size: 10px; color: var(--muted); margin-top: 3px; }
.game-sudoku .pad button:active { background: var(--surface-2); }
.game-sudoku .pad button.used { visibility: hidden; }
.game-sudoku.notes-on .pad button { color: var(--muted); }
.game-sudoku .busy { text-align: center; color: var(--muted); padding: 60px 0; }
`;

export default {
  id: 'sudoku',
  name: 'Sudoku',
  tagline: 'Fill the grid so every row, column and box has 1 to 9.',
  color: '#3b5bdb',
  glyph: '9',
  help: `<p>Fill every empty square with a digit from 1 to 9.</p>
<ul>
<li>Each row, column and 3 by 3 box must contain 1 to 9 exactly once.</li>
<li>Tap a square, then tap a number. Clashing numbers turn red.</li>
<li>Turn on <b>Notes</b> to pencil in small candidates.</li>
<li><b>Hint</b> fills in the selected square. Daily is a new medium puzzle each day.</li>
</ul>`,

  mount(el, ctx) {
    if (!document.getElementById('css-sudoku')) {
      const s = document.createElement('style'); s.id = 'css-sudoku'; s.textContent = CSS; document.head.appendChild(s);
    }
    let mode = ctx.get('mode', 'daily');
    let st = null, sel = -1, notesOn = false, tick = null;

    el.innerHTML = `
      <div class="spread top">
        <div class="seg" id="sd-modes">${MODES.map((m) => `<button data-m="${m.id}">${m.label}</button>`).join('')}</div>
        <span class="stat" id="sd-time">0:00</span>
      </div>
      <div class="board-wrap"><div id="sd-board"></div></div>
      <div class="tools">
        <button class="tool" id="sd-undo"><span class="ic">↶</span>Undo</button>
        <button class="tool" id="sd-erase"><span class="ic">⌫</span>Erase</button>
        <button class="tool" id="sd-notes"><span class="ic">✎</span><span>Notes <span class="pill off" id="sd-np">off</span></span></button>
        <button class="tool" id="sd-hint"><span class="ic">💡</span>Hint</button>
      </div>
      <div class="pad" id="sd-pad"></div>`;
    const board = el.querySelector('#sd-board'), pad = el.querySelector('#sd-pad'), timeEl = el.querySelector('#sd-time');

    // Mode switching ----
    function setMode(m) {
      mode = m; ctx.set('mode', m);
      el.querySelectorAll('#sd-modes button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
      load();
    }
    el.querySelectorAll('#sd-modes button').forEach((b) => (b.onclick = () => setMode(b.dataset.m)));

    function load() {
      stopTimer();
      let saved = ctx.get('state:' + mode);
      if (mode === 'daily' && saved && saved.day !== ctx.today()) saved = null;
      if (saved && !saved.done) { st = saved; sel = -1; render(); startTimer(); return; }
      if (saved && saved.done && mode === 'daily') { st = saved; sel = -1; render(); ctx.toast("Today's puzzle is solved. New one tomorrow."); return; }
      board.innerHTML = '<div class="busy">Making a puzzle…</div>';
      setTimeout(() => {
        st = newState(mode, ctx);
        ctx.started();
        save(); sel = -1; render(); startTimer();
      }, 30);
    }
    function save() { ctx.set('state:' + mode, { ...st, history: st.history.slice(-200) }); }

    // Timer: counts only while visible ----
    function startTimer() {
      stopTimer();
      tick = setInterval(() => {
        if (document.hidden || !st || st.done) return;
        st.time++; timeEl.textContent = ctx.formatTime(st.time);
        if (st.time % 5 === 0) save();
      }, 1000);
    }
    function stopTimer() { if (tick) clearInterval(tick); tick = null; }

    // Rendering ----
    function conflicts() {
      const bad = new Set();
      for (let i = 0; i < 81; i++) {
        const v = st.values[i];
        if (v) for (const p of PEERS[i]) if (st.values[p] === v) { bad.add(i); bad.add(p); }
      }
      return bad;
    }
    function render() {
      timeEl.textContent = ctx.formatTime(st.time);
      const bad = conflicts();
      const selVal = sel >= 0 ? st.values[sel] : 0;
      const peers = sel >= 0 ? new Set(PEERS[sel]) : new Set();
      let html = '<div class="grid">';
      for (let i = 0; i < 81; i++) {
        const v = st.values[i], c = COL(i), r = ROW(i);
        const cls = ['cell'];
        if (st.puzzle[i]) cls.push('given');
        if (c === 2 || c === 5) cls.push('br');
        if (r === 2 || r === 5) cls.push('bb');
        if (i === sel) cls.push('sel');
        else if (selVal && v === selVal) cls.push('same');
        else if (peers.has(i)) cls.push('peer');
        if (bad.has(i)) cls.push('bad');
        let inner = v ? v : '';
        if (!v && st.notes[i]) {
          inner = '<div class="notes">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) =>
            `<span class="${selVal === d ? 'hl' : ''}">${st.notes[i] & (1 << d) ? d : ''}</span>`).join('') + '</div>';
        }
        html += `<div class="${cls.join(' ')}" data-i="${i}">${inner}</div>`;
      }
      board.innerHTML = html + '</div>';
      const counts = Array(10).fill(0);
      st.values.forEach((v) => counts[v]++);
      pad.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) =>
        `<button data-d="${d}" class="${counts[d] >= 9 && !bad.size ? 'used' : ''}">${d}<small>${9 - counts[d] > 0 ? 9 - counts[d] : ''}</small></button>`).join('');
      el.classList.toggle('notes-on', notesOn);
      el.querySelector('#sd-notes').classList.toggle('on', notesOn);
      const np = el.querySelector('#sd-np'); np.textContent = notesOn ? 'on' : 'off'; np.classList.toggle('off', !notesOn);
    }

    // Input ----
    board.addEventListener('click', (e) => {
      const c = e.target.closest('.cell'); if (!c || !st) return;
      sel = +c.dataset.i; render();
    });
    pad.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      enter(+b.dataset.d);
    });
    function editable() { return st && !st.done && sel >= 0 && !st.puzzle[sel]; }
    function push() { st.history.push({ i: sel, v: st.values[sel], n: st.notes[sel], peers: PEERS[sel].map((p) => st.notes[p]) }); }
    function enter(d) {
      if (!editable()) { if (st && sel < 0) ctx.toast('Tap a square first'); return; }
      push(); ctx.buzz();
      if (notesOn) {
        if (st.values[sel]) return render();
        st.notes[sel] ^= 1 << d;
      } else {
        st.values[sel] = st.values[sel] === d ? 0 : d;
        if (st.values[sel]) for (const p of PEERS[sel]) st.notes[p] &= ~(1 << d);
      }
      save(); render(); checkWin();
    }
    el.querySelector('#sd-erase').onclick = () => {
      if (!editable()) return;
      push(); st.values[sel] = 0; st.notes[sel] = 0; save(); render();
    };
    el.querySelector('#sd-undo').onclick = () => {
      if (!st || st.done || !st.history.length) return;
      const h = st.history.pop();
      st.values[h.i] = h.v; st.notes[h.i] = h.n;
      PEERS[h.i].forEach((p, k) => (st.notes[p] = h.peers[k]));
      sel = h.i; save(); render();
    };
    el.querySelector('#sd-notes').onclick = () => { notesOn = !notesOn; render(); };
    el.querySelector('#sd-hint').onclick = () => {
      if (!st || st.done) return;
      if (!editable() || st.values[sel] === st.solution[sel]) {
        // No useful selection: pick an empty or wrong square for them.
        const opts = [...Array(81).keys()].filter((i) => st.values[i] !== st.solution[i]);
        if (!opts.length) return;
        sel = opts[Math.floor(Math.random() * opts.length)];
      }
      push();
      st.values[sel] = st.solution[sel]; st.notes[sel] = 0;
      for (const p of PEERS[sel]) st.notes[p] &= ~(1 << st.solution[sel]);
      st.hints++; save(); render(); checkWin();
    };
    const onKey = (e) => {
      if (/^[1-9]$/.test(e.key)) enter(+e.key);
      else if (e.key === 'Backspace' || e.key === 'Delete') el.querySelector('#sd-erase').click();
      else if (e.key.startsWith('Arrow') && sel >= 0) {
        const dr = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
        sel = (sel + dr + 81) % 81; render();
      }
    };
    document.addEventListener('keydown', onKey);

    function checkWin() {
      if (st.values.some((v, i) => v !== st.solution[i])) return;
      st.done = true; stopTimer(); save();
      sel = -1; render();
      ctx.win({
        mode, time: st.time, daily: mode === 'daily', noBest: st.hints > 0,
        detail: st.hints ? `${st.hints} hint${st.hints > 1 ? 's' : ''} used` : 'No hints',
        againLabel: mode === 'daily' ? 'Play Medium' : 'New puzzle',
        onAgain: () => { if (mode === 'daily') setMode('medium'); else { ctx.del('state:' + mode); load(); } },
      });
    }

    setMode(mode);
    return () => { stopTimer(); document.removeEventListener('keydown', onKey); if (st) save(); };
  },
};

export { generate, countSolutions, solvableBySingles };
