// Suns & Moons: a binary-grid puzzle (takuzu genre).
// Cells: 0 empty, 1 sun, 2 moon. Puzzles are generated so plain logic always solves them (no guessing).

const SUN = 1, MOON = 2;

// Puzzle engine ----

// Row and column index lists for an n x n grid stored flat.
function makeLines(n) {
  const rows = [], cols = [];
  for (let r = 0; r < n; r++) rows.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) cols.push(Array.from({ length: n }, (_, r) => r * n + c));
  return { rows, cols };
}

// Apply forced moves in place until nothing changes. Returns false on a contradiction.
// Rules: no three in a row, half suns and half moons per line, no two identical complete lines.
function propagate(g, n, lines) {
  const h = n / 2;
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of [lines.rows, lines.cols]) {
      for (const L of group) {
        let ones = 0, twos = 0;
        for (const i of L) { if (g[i] === 1) ones++; else if (g[i] === 2) twos++; }
        if (ones > h || twos > h) return false;
        for (let k = 0; k + 2 < n; k++) {
          const a = g[L[k]], b = g[L[k + 1]], c = g[L[k + 2]];
          if (a && a === b && b === c) return false;
          if (a && a === b && !c) { g[L[k + 2]] = 3 - a; changed = true; }
          else if (b && b === c && !a) { g[L[k]] = 3 - b; changed = true; }
          else if (a && a === c && !b) { g[L[k + 1]] = 3 - a; changed = true; }
        }
        if (changed) continue;
        if (ones === h && twos < h) { for (const i of L) if (!g[i]) g[i] = 2; changed = true; }
        else if (twos === h && ones < h) { for (const i of L) if (!g[i]) g[i] = 1; changed = true; }
      }
      // Identical-line rule: duplicates fail; a line with two blanks that matches a complete line must differ there.
      for (let x = 0; x < group.length; x++) {
        const A = group[x];
        let blanks = 0;
        for (const i of A) if (!g[i]) blanks++;
        if (blanks > 2) continue;
        for (let y = 0; y < group.length; y++) {
          if (y === x) continue;
          const B = group[y];
          let full = true, match = true;
          for (let k = 0; k < n; k++) {
            const bv = g[B[k]];
            if (!bv) { full = false; break; }
            const av = g[A[k]];
            if (av && av !== bv) { match = false; break; }
          }
          if (!full || !match) continue;
          if (blanks === 0) return false;
          if (blanks === 2) {
            for (let k = 0; k < n; k++) if (!g[A[k]]) g[A[k]] = 3 - g[B[k]];
            changed = true;
            break;
          }
        }
      }
    }
  }
  return true;
}

// Count solutions up to `limit`. If `pick` is given, values are tried in random order and the first solution is stored in out.
// `budget` ({ left }) caps the number of search nodes; when it runs out the search gives up and returns 0.
function solve(g, n, lines, limit, rand, out, budget) {
  if (budget && --budget.left < 0) return 0;
  g = g.slice();
  if (!propagate(g, n, lines)) return 0;
  const empties = [];
  for (let i = 0; i < g.length; i++) if (!g[i]) empties.push(i);
  if (!empties.length) { if (out) out.push(g); return 1; }
  const i = rand ? empties[Math.floor(rand() * empties.length)] : empties[0];
  const order = rand && rand() < 0.5 ? [2, 1] : [1, 2];
  let count = 0;
  for (const v of order) {
    const g2 = g.slice(); g2[i] = v;
    count += solve(g2, n, lines, limit - count, rand, out, budget);
    if (count >= limit) break;
  }
  return count;
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generator recipe:
// 1. Fill an empty grid with a randomized solver run (propagation keeps it fast; capped attempts restart).
// 2. Visit cells in random order and blank each one.
// 3. Keep the blank only if forced-move logic alone still fills the whole grid (which also proves the answer is unique).
export function generate(n, rand = Math.random) {
  const lines = makeLines(n);
  const out = [];
  // Restart the fill with fresh random choices if one attempt wanders into a long dead end.
  while (!out.length) solve(new Array(n * n).fill(0), n, lines, 1, rand, out, { left: 400 });
  const solution = out[0];
  const puzzle = solution.slice();
  for (const i of shuffle([...puzzle.keys()], rand)) {
    const v = puzzle[i];
    puzzle[i] = 0;
    const test = puzzle.slice();
    if (!propagate(test, n, lines) || test.includes(0)) puzzle[i] = v;
  }
  return { puzzle, solution };
}

export { propagate, solve, makeLines };

// Live rule check for the player's grid: cells in three-in-a-row runs, and lines that are over-full or duplicated.
function analyze(g, n, lines) {
  const trip = new Set(), badLines = new Set();
  const h = n / 2;
  const check = (group, tag) => {
    const complete = [];
    group.forEach((L, x) => {
      let ones = 0, twos = 0;
      for (const i of L) { if (g[i] === 1) ones++; else if (g[i] === 2) twos++; }
      if (ones > h || twos > h) badLines.add(tag + x);
      for (let k = 0; k + 2 < n; k++) {
        const a = g[L[k]];
        if (a && a === g[L[k + 1]] && a === g[L[k + 2]]) { trip.add(L[k]); trip.add(L[k + 1]); trip.add(L[k + 2]); }
      }
      if (ones + twos === n) complete.push([x, L.map((i) => g[i]).join('')]);
    });
    for (let a = 0; a < complete.length; a++)
      for (let b = a + 1; b < complete.length; b++)
        if (complete[a][1] === complete[b][1]) { badLines.add(tag + complete[a][0]); badLines.add(tag + complete[b][0]); }
  };
  check(lines.rows, 'r');
  check(lines.cols, 'c');
  return { trip, badLines };
}

// Drawing ----
const SUN_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#f08c00" stroke-width="2.2" stroke-linecap="round"><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"/></g><circle cx="12" cy="12" r="5.2" fill="#fcc419" stroke="#f08c00" stroke-width="1.4"/></svg>`;
const MOON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.6 8.6 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" fill="#7d8fb8" stroke="#55658c" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

const STYLE = `
.game-binary .bn-top { margin-bottom: 10px; }
.game-binary .bn-board {
  width: min(100%, 460px); aspect-ratio: 1; display: grid; gap: 3px; margin: 0 auto;
  touch-action: manipulation;
}
.game-binary .bn-cell {
  border: none; padding: 0; border-radius: 6px; background: var(--cell);
  box-shadow: inset 0 0 0 1px var(--line);
  display: grid; place-items: center; cursor: pointer; position: relative;
  transition: background 0.12s;
}
.game-binary .bn-board.n10 .bn-cell { border-radius: 4px; }
.game-binary .bn-cell svg { width: 72%; height: 72%; display: block; }
.game-binary .bn-cell.given { background: var(--surface-2); box-shadow: none; cursor: default; }
.game-binary .bn-cell.given::after {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 4px; height: 4px; border-radius: 50%;
  background: var(--muted); opacity: 0.6;
}
.game-binary .bn-cell.line-bad { background: var(--bad-soft); }
.game-binary .bn-cell.trip { background: var(--bad-soft); box-shadow: inset 0 0 0 2px var(--bad); }
.game-binary .bn-cell.flash { animation: bn-flash 0.9s ease; }
.game-binary .bn-board.solved .bn-cell { background: var(--good-soft); box-shadow: none; }
.game-binary .bn-cell:active:not(.given) { transform: scale(0.94); }
.game-binary .bn-tools { margin-top: 16px; }
.game-binary .bn-note { text-align: center; color: var(--muted); font-size: 14px; margin: 12px 0 0; min-height: 18px; }
@keyframes bn-flash { 0%, 60% { box-shadow: inset 0 0 0 3px var(--accent); } }
`;

const MODES = [
  { id: 'daily', label: 'Daily', n: 8 },
  { id: '6', label: '6×6', n: 6 },
  { id: '8', label: '8×8', n: 8 },
  { id: '10', label: '10×10', n: 10 },
];

export default {
  id: 'binary',
  name: 'Suns & Moons',
  tagline: 'Balance every row and column',
  color: '#0c8599',
  glyph: '☀',
  help: `
    <p>Fill the grid so every square holds a sun or a moon.</p>
    <ul>
      <li>No more than two of the same symbol next to each other in a row or column.</li>
      <li>Each row and column has the same number of suns and moons.</li>
      <li>No two rows are identical, and no two columns are identical.</li>
    </ul>
    <p>Tap a square to cycle: sun, moon, empty. Shaded squares are fixed. Every puzzle can be solved by logic alone.</p>`,

  mount(el, ctx) {
    if (!document.getElementById('binary-style')) {
      const s = document.createElement('style');
      s.id = 'binary-style'; s.textContent = STYLE;
      document.head.appendChild(s);
    }

    let mode = ctx.get('mode', 'daily');
    if (!MODES.some((m) => m.id === mode)) mode = 'daily';
    let st = null;          // current puzzle state
    let lines = null;
    let undo = [];
    let cells = [];

    el.innerHTML = `
      <div class="row bn-top"><div class="seg" id="bn-seg">${MODES.map((m) => `<button data-m="${m.id}">${m.label}</button>`).join('')}</div></div>
      <div class="spread"><span class="stat" id="bn-time">0:00</span><span class="stat" id="bn-hints"></span></div>
      <div class="gap-s"></div>
      <div class="bn-board" id="bn-board"></div>
      <p class="bn-note" id="bn-note"></p>
      <div class="row bn-tools">
        <button class="btn" id="bn-undo">Undo</button>
        <button class="btn" id="bn-clear">Clear</button>
        <button class="btn" id="bn-hint">Hint</button>
        <button class="btn" id="bn-new">New</button>
      </div>`;
    const q = (id) => el.querySelector('#' + id);
    const board = q('bn-board'), timeEl = q('bn-time'), hintsEl = q('bn-hints'), noteEl = q('bn-note');
    // A tap in the thin gap between squares goes to the nearest square.
    board.addEventListener('click', (e) => {
      if (e.target !== board) return;
      const i = nearestIndex(cells, e.clientX, e.clientY);
      if (i >= 0) tap(i);
    });

    const save = () => { if (st) ctx.set('state:' + mode, st); };

    function freshState(m) {
      const def = MODES.find((x) => x.id === m);
      const rand = m === 'daily' ? ctx.rng(ctx.dailySeed()) : Math.random;
      const { puzzle, solution } = generate(def.n, rand);
      return { n: def.n, date: m === 'daily' ? ctx.today() : null, puzzle, solution, grid: puzzle.slice(), time: 0, hints: 0, started: false, solved: false };
    }

    function load(m) {
      mode = m;
      ctx.set('mode', m);
      let s = ctx.get('state:' + m, null);
      if (!s || (m === 'daily' && s.date !== ctx.today())) { s = freshState(m); ctx.set('state:' + m, s); }
      st = s;
      undo = [];
      lines = makeLines(st.n);
      el.querySelectorAll('#bn-seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
      build();
      draw();
    }

    function newPuzzle() {
      if (mode === 'daily') { load('8'); }
      st = freshState(mode);
      undo = [];
      save();
      build();
      draw();
    }

    function build() {
      board.innerHTML = '';
      board.className = 'bn-board n' + st.n;
      board.style.gridTemplateColumns = `repeat(${st.n}, 1fr)`;
      board.style.gridTemplateRows = `repeat(${st.n}, 1fr)`;
      cells = [];
      for (let i = 0; i < st.n * st.n; i++) {
        const b = document.createElement('button');
        b.className = 'bn-cell';
        b.addEventListener('click', () => tap(i));
        board.appendChild(b);
        cells.push(b);
      }
    }

    function draw() {
      const { trip, badLines } = analyze(st.grid, st.n, lines);
      const n = st.n;
      for (let i = 0; i < n * n; i++) {
        const b = cells[i], v = st.grid[i];
        const want = v === SUN ? 'sun' : v === MOON ? 'moon' : '';
        if (b.dataset.v !== want) { b.innerHTML = v === SUN ? SUN_SVG : v === MOON ? MOON_SVG : ''; b.dataset.v = want; }
        const r = Math.floor(i / n), c = i % n;
        b.classList.toggle('given', !!st.puzzle[i]);
        b.classList.toggle('trip', trip.has(i));
        b.classList.toggle('line-bad', badLines.has('r' + r) || badLines.has('c' + c));
        b.setAttribute('aria-label', `Row ${r + 1} column ${c + 1}: ${want || 'empty'}`);
      }
      board.classList.toggle('solved', st.solved);
      timeEl.textContent = ctx.formatTime(st.time);
      hintsEl.textContent = st.hints ? `${st.hints} hint${st.hints > 1 ? 's' : ''}` : '';
      if (st.solved) noteEl.textContent = mode === 'daily' ? 'Solved today. A new daily arrives tomorrow.' : 'Solved. Tap New for another.';
      else if (trip.size || badLines.size) noteEl.textContent = trip.size ? 'Three in a row' : 'A row or column breaks a rule';
      else noteEl.textContent = '';
      q('bn-undo').disabled = st.solved || !undo.length;
      q('bn-clear').disabled = st.solved;
      q('bn-hint').disabled = st.solved;
    }

    function begin() {
      if (!st.started) { st.started = true; ctx.started(); }
    }

    function tap(i) {
      if (st.solved || st.puzzle[i]) return;
      begin();
      const prev = st.grid[i];
      const next = prev === 0 ? SUN : prev === SUN ? MOON : 0;
      undo.push({ i, prev });
      st.grid[i] = next;
      ctx.buzz();
      after();
    }

    function after() {
      draw();
      save();
      checkWin();
    }

    function checkWin() {
      if (st.grid.includes(0)) return;
      const { trip, badLines } = analyze(st.grid, st.n, lines);
      if (trip.size || badLines.size) return;
      st.solved = true;
      save();
      draw();
      const daily = mode === 'daily';
      ctx.win({
        mode: daily ? 'daily' : 'size' + st.n,
        time: st.time,
        daily,
        noBest: st.hints > 0,
        detail: st.hints ? `${st.hints} hint${st.hints > 1 ? 's' : ''} used` : 'No hints used',
        againLabel: daily ? 'Play 8×8' : 'New puzzle',
        onAgain: () => { if (daily) load('8'); newPuzzle(); },
      });
    }

    function flash(i) {
      const b = cells[i];
      b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
    }

    // Hint: first fix a wrong square if there is one, else fill a square that follows by logic.
    function hint() {
      if (st.solved) return;
      begin();
      const n = st.n;
      const wrong = st.grid.findIndex((v, i) => v && v !== st.solution[i]);
      st.hints++;
      if (wrong >= 0) {
        undo.push({ i: wrong, prev: st.grid[wrong] });
        st.grid[wrong] = 0;
        ctx.toast('That square was wrong, so it is cleared');
        flash(wrong);
        after();
        return;
      }
      const test = st.grid.slice();
      propagate(test, n, lines);
      let options = [];
      for (let i = 0; i < test.length; i++) if (!st.grid[i] && test[i]) options.push(i);
      if (!options.length) for (let i = 0; i < test.length; i++) if (!st.grid[i]) options.push(i);
      if (!options.length) { after(); return; }
      // Prefer a cell forced by its immediate neighbours: one-step propagation picks the first forced change.
      const one = st.grid.slice();
      const firstStep = firstForced(one, n);
      const i = firstStep >= 0 ? firstStep : options[Math.floor(Math.random() * options.length)];
      undo.push({ i, prev: 0 });
      st.grid[i] = st.solution[i];
      flash(i);
      after();
    }

    // The first empty cell forced by a single simple rule (pairs, gaps, full counts), or -1.
    function firstForced(g, n) {
      const h = n / 2;
      for (const group of [lines.rows, lines.cols]) {
        for (const L of group) {
          for (let k = 0; k + 2 < n; k++) {
            const a = g[L[k]], b = g[L[k + 1]], c = g[L[k + 2]];
            if (a && a === b && !c) return L[k + 2];
            if (b && b === c && !a) return L[k];
            if (a && a === c && !b) return L[k + 1];
          }
          let ones = 0, twos = 0;
          for (const i of L) { if (g[i] === 1) ones++; else if (g[i] === 2) twos++; }
          if ((ones === h || twos === h) && ones + twos < n) return L.find((i) => !g[i]);
        }
      }
      return -1;
    }

    q('bn-seg').addEventListener('click', (e) => {
      const m = e.target.dataset && e.target.dataset.m;
      if (m && m !== mode) { save(); load(m); }
    });
    q('bn-undo').onclick = () => {
      const u = undo.pop();
      if (!u || st.solved) return;
      if (u.clear) st.grid = u.clear; else st.grid[u.i] = u.prev;
      after();
    };
    q('bn-clear').onclick = () => {
      if (st.solved) return;
      if (st.grid.every((v, i) => v === st.puzzle[i])) return;
      undo.push({ clear: st.grid.slice() });
      st.grid = st.puzzle.slice();
      after();
    };
    q('bn-hint').onclick = hint;
    q('bn-new').onclick = newPuzzle;

    // Timer runs only while the puzzle is started, unsolved and visible.
    let tickCount = 0;
    const timer = setInterval(() => {
      if (!st || !st.started || st.solved || document.hidden) return;
      st.time++;
      timeEl.textContent = ctx.formatTime(st.time);
      if (++tickCount % 5 === 0) save();
    }, 1000);
    const onHide = () => { if (document.hidden) save(); };
    document.addEventListener('visibilitychange', onHide);

    load(mode);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      save();
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
