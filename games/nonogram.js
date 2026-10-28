// Pixels: picture-logic puzzles. Grids are generated and kept only when line logic alone solves them,
// which guarantees a unique answer that never needs guessing.

const PURPLE = '#ae3ec9';
const MODES = [
  { id: 'daily', label: 'Daily', n: 10 },
  { id: 's5', label: '5×5', n: 5 },
  { id: 's10', label: '10×10', n: 10 },
  { id: 's15', label: '15×15', n: 15 },
];

// Clues ----
export function runs(line) {
  const out = []; let c = 0;
  for (const v of line) { if (v === 1) c++; else if (c) { out.push(c); c = 0; } }
  if (c) out.push(c);
  return out;
}
function cluesOf(g, n) {
  const rows = [], cols = [];
  for (let r = 0; r < n; r++) rows.push(runs(g.slice(r * n, r * n + n)));
  for (let c = 0; c < n; c++) { const col = []; for (let r = 0; r < n; r++) col.push(g[r * n + c]); cols.push(runs(col)); }
  return { rows, cols };
}

// Line solver ----
// cells: -1 unknown, 0 empty, 1 filled. Returns the line with every cell that all valid placements agree on,
// or null when no placement fits.
export function solveLine(cells, clues) {
  const n = cells.length, k = clues.length;
  const memo = new Int8Array((n + 2) * (k + 1)).fill(-1);
  const canFill = new Uint8Array(n), canEmpty = new Uint8Array(n);
  function can(i, j) {
    const key = i * (k + 1) + j;
    if (memo[key] !== -1) return memo[key] === 1;
    let res = false;
    if (j === k) {
      res = true;
      for (let x = i; x < n; x++) if (cells[x] === 1) { res = false; break; }
      if (res) for (let x = i; x < n; x++) canEmpty[x] = 1;
    } else {
      const L = clues[j];
      // cell i stays empty
      if (i < n && cells[i] !== 1 && can(i + 1, j)) { canEmpty[i] = 1; res = true; }
      // a block of length L starts at i
      if (i + L <= n) {
        let fits = true;
        for (let x = i; x < i + L; x++) if (cells[x] === 0) { fits = false; break; }
        if (fits) {
          if (i + L === n) {
            if (j + 1 === k) { for (let x = i; x < n; x++) canFill[x] = 1; res = true; }
          } else if (cells[i + L] !== 1 && can(i + L + 1, j + 1)) {
            for (let x = i; x < i + L; x++) canFill[x] = 1;
            canEmpty[i + L] = 1;
            res = true;
          }
        }
      }
    }
    memo[key] = res ? 1 : 0;
    return res;
  }
  if (!can(0, 0)) return null;
  const out = Int8Array.from(cells);
  for (let x = 0; x < n; x++) {
    if (canFill[x] && !canEmpty[x]) out[x] = 1;
    else if (canEmpty[x] && !canFill[x]) out[x] = 0;
  }
  return out;
}

// Applies line logic to rows and columns until nothing changes. Returns the grid (may hold -1s) or null.
export function solveGrid(rowClues, colClues) {
  const R = rowClues.length, C = colClues.length;
  const g = new Int8Array(R * C).fill(-1);
  const dirtyR = new Set([...Array(R).keys()]), dirtyC = new Set([...Array(C).keys()]);
  while (dirtyR.size || dirtyC.size) {
    for (const r of dirtyR) {
      const line = g.slice(r * C, r * C + C);
      const res = solveLine(line, rowClues[r]);
      if (!res) return null;
      for (let c = 0; c < C; c++) if (line[c] === -1 && res[c] !== -1) { g[r * C + c] = res[c]; dirtyC.add(c); }
    }
    dirtyR.clear();
    for (const c of dirtyC) {
      const line = new Int8Array(R);
      for (let r = 0; r < R; r++) line[r] = g[r * C + c];
      const res = solveLine(line, colClues[c]);
      if (!res) return null;
      for (let r = 0; r < R; r++) if (line[r] === -1 && res[r] !== -1) { g[r * C + c] = res[r]; dirtyR.add(r); }
    }
    dirtyC.clear();
  }
  return g;
}

// Generator ----
// Majority smoothing turns random noise into blobs that read more like pictures.
function smooth(g, n) {
  const out = g.slice();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    let on = 0, tot = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      tot++; on += g[rr * n + cc];
    }
    const f = on / tot;
    if (f > 0.6) out[r * n + c] = 1; else if (f < 0.4) out[r * n + c] = 0;
  }
  return out;
}
export function generate(n, rand) {
  for (let attempt = 0; attempt < 400; attempt++) {
    // density creeps up if attempts keep failing, since denser grids are easier to solve by logic
    const p = Math.min(0.8, 0.53 + Math.floor(attempt / 50) * 0.03);
    let g = Array.from({ length: n * n }, () => (rand() < p ? 1 : 0));
    if (n > 5) g = smooth(g, n);
    const fill = g.reduce((a, b) => a + b, 0) / (n * n);
    if (fill < 0.42 || fill > 0.78) continue;
    const { rows, cols } = cluesOf(g, n);
    const s = solveGrid(rows, cols);
    if (s && s.every((v) => v !== -1)) return { n, solution: g, rows, cols };
  }
  const g = new Array(n * n).fill(1);
  return { n, solution: g, ...cluesOf(g, n) };
}

// Styles ----
const CSS = `
.game-nonogram .nn-board { display: grid; touch-action: none; }
.game-nonogram .nn-cols { display: grid; }
.game-nonogram .nn-col { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 4px; line-height: 1.12; font-weight: 700; font-variant-numeric: tabular-nums; border-radius: 6px 6px 0 0; }
.game-nonogram .nn-rows { display: grid; }
.game-nonogram .nn-row { display: flex; justify-content: flex-end; align-items: center; gap: 0.35em; padding-right: 5px; font-weight: 700; font-variant-numeric: tabular-nums; border-radius: 6px 0 0 6px; }
.game-nonogram .nn-col.done, .game-nonogram .nn-row.done { color: var(--muted); opacity: 0.45; }
.game-nonogram .hl { background: var(--accent-soft); }
.game-nonogram .nn-cells { display: grid; position: relative; background: var(--cell); box-shadow: 0 0 0 2px var(--line-strong); touch-action: none; }
.game-nonogram .c { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); position: relative; transition: background 0.08s; }
.game-nonogram .c.lc { border-right: none; }
.game-nonogram .c.lr { border-bottom: none; }
.game-nonogram .c.br5 { border-right: 2px solid var(--line-strong); }
.game-nonogram .c.bb5 { border-bottom: 2px solid var(--line-strong); }
.game-nonogram .c.f { background: var(--text); }
.game-nonogram .c.x::after { content: '✕'; position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 0.55em; }
.game-nonogram .nn-hl { position: absolute; pointer-events: none; background: var(--accent); opacity: 0.14; display: none; }
.game-nonogram .won .c { border-color: transparent !important; transition: background 0.5s, border-color 0.5s; }
.game-nonogram .won .c.f { background: ${PURPLE}; }
.game-nonogram .won .c.x::after { content: none; }
.game-nonogram .won .nn-cells { box-shadow: 0 0 0 2px ${PURPLE}; }
.game-nonogram .nn-info { max-width: 360px; margin: 0 auto; }
.game-nonogram .nn-note { text-align: center; color: var(--muted); font-size: 14px; min-height: 1.2em; margin: 10px 0 0; }
`;
function injectStyle() {
  if (document.getElementById('nonogram-style')) return;
  const s = document.createElement('style');
  s.id = 'nonogram-style'; s.textContent = CSS;
  document.head.appendChild(s);
}

// Game ----
function mount(el, ctx) {
  injectStyle();
  let mode = ctx.get('mode', 'daily');
  if (!MODES.find((m) => m.id === mode)) mode = 'daily';
  let state = null, undo = [], tool = 'fill', t0 = null, stroke = null, cell = 30;

  el.innerHTML = `
    <div class="row"><div class="seg nn-modes">${MODES.map((m) => `<button data-m="${m.id}">${m.label}</button>`).join('')}</div></div>
    <div class="gap-m"></div>
    <div class="spread nn-info"><span class="stat nn-label"></span><span class="stat nn-time">0:00</span></div>
    <div class="gap-s"></div>
    <div class="board-wrap"><div class="nn-board"></div></div>
    <div class="gap-l"></div>
    <div class="row">
      <button class="btn nn-fill">■ Fill</button>
      <button class="btn nn-mark">✕ Mark</button>
      <button class="btn nn-undo">Undo</button>
      <button class="btn nn-new">New</button>
    </div>
    <p class="nn-note"></p>`;
  const q = (s) => el.querySelector(s);
  const boardEl = q('.nn-board'), timeEl = q('.nn-time'), labelEl = q('.nn-label'), noteEl = q('.nn-note');
  const fillBtn = q('.nn-fill'), markBtn = q('.nn-mark'), undoBtn = q('.nn-undo'), newBtn = q('.nn-new');
  let cellsEl, cellEls = [], rowEls = [], colEls = [], hlRow, hlCol;

  const key = () => 'cur:' + mode;
  const modeInfo = () => MODES.find((m) => m.id === mode);

  function fresh() {
    const n = modeInfo().n;
    const rand = mode === 'daily' ? ctx.rng(ctx.dailySeed()) : ctx.rng((Math.random() * 4294967296) >>> 0);
    const p = generate(n, rand);
    const s = { mode, n, rows: p.rows, cols: p.cols, grid: new Array(n * n).fill(0), elapsed: 0, started: false, done: false, date: ctx.today() };
    // daily already solved today but saved board was lost: show it solved
    if (mode === 'daily' && ctx.stats().dailyDone?.[ctx.today()]) { s.grid = p.solution.slice(); s.done = true; }
    return s;
  }
  function loadState() {
    let s = ctx.get(key());
    if (s && mode === 'daily' && s.date !== ctx.today()) s = null;
    return s || fresh();
  }

  // Timer ----
  const elapsedNow = () => state.elapsed + (t0 ? (Date.now() - t0) / 1000 : 0);
  function fold() { if (t0) { state.elapsed += (Date.now() - t0) / 1000; t0 = Date.now(); } }
  function pause() { fold(); t0 = null; }
  function showTime() { timeEl.textContent = ctx.formatTime(elapsedNow()); }
  const tick = setInterval(showTime, 500);
  function save() { if (!state) return; fold(); ctx.set(key(), state); }

  // Layout and rendering ----
  const disp = (clue) => (clue.length ? clue : [0]);
  function layout() {
    const n = state.n;
    const avail = Math.min(el.clientWidth || window.innerWidth - 32, 528) - 4;
    const maxCol = Math.max(...state.cols.map((c) => disp(c).length));
    let fs = 14, leftW = 40;
    cell = Math.floor(avail / (n + 3));
    for (let i = 0; i < 3; i++) {
      fs = Math.max(8, Math.min(16, Math.round(cell * 0.55)));
      const cw = fs * 0.62;
      leftW = Math.ceil(Math.max(...state.rows.map((r) => {
        const d = disp(r);
        return d.reduce((a, v) => a + String(v).length * cw, 0) + (d.length - 1) * fs * 0.35;
      })) + 10);
      cell = Math.min(n === 5 ? 56 : 40, Math.floor((avail - leftW) / n));
    }
    const topH = Math.ceil(maxCol * fs * 1.12 + 8);
    return { fs, leftW, topH };
  }

  function render() {
    const n = state.n;
    const { fs, leftW, topH } = layout();
    boardEl.classList.toggle('won', state.done);
    boardEl.style.gridTemplateColumns = `${leftW}px ${n * cell}px`;
    boardEl.style.gridTemplateRows = `${topH}px ${n * cell}px`;
    boardEl.style.fontSize = fs + 'px';
    boardEl.innerHTML = `<div></div><div class="nn-cols"></div><div class="nn-rows"></div><div class="nn-cells"><div class="nn-hl nn-hlr"></div><div class="nn-hl nn-hlc"></div></div>`;
    const colsEl = boardEl.querySelector('.nn-cols'), rowsEl = boardEl.querySelector('.nn-rows');
    cellsEl = boardEl.querySelector('.nn-cells');
    hlRow = boardEl.querySelector('.nn-hlr'); hlCol = boardEl.querySelector('.nn-hlc');
    colsEl.style.gridTemplateColumns = `repeat(${n}, ${cell}px)`;
    rowsEl.style.gridTemplateRows = `repeat(${n}, ${cell}px)`;
    cellsEl.style.gridTemplateColumns = `repeat(${n}, ${cell}px)`;
    cellsEl.style.gridTemplateRows = `repeat(${n}, ${cell}px)`;
    cellsEl.style.fontSize = cell + 'px';
    colEls = state.cols.map((c) => {
      const d = document.createElement('div'); d.className = 'nn-col';
      d.innerHTML = disp(c).map((v) => `<span>${v}</span>`).join('');
      colsEl.appendChild(d); return d;
    });
    rowEls = state.rows.map((r) => {
      const d = document.createElement('div'); d.className = 'nn-row';
      d.innerHTML = disp(r).map((v) => `<span>${v}</span>`).join('');
      rowsEl.appendChild(d); return d;
    });
    cellEls = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const d = document.createElement('div');
      d.dataset.base = 'c' + (c === n - 1 ? ' lc' : (c % 5 === 4 ? ' br5' : '')) + (r === n - 1 ? ' lr' : (r % 5 === 4 ? ' bb5' : ''));
      cellsEl.appendChild(d); cellEls.push(d);
    }
    hlRow.style.cssText = `left:0;width:${n * cell}px;height:${cell}px`;
    hlCol.style.cssText = `top:0;height:${n * cell}px;width:${cell}px`;
    for (let i = 0; i < n * n; i++) drawCell(i);
    for (let r = 0; r < n; r++) drawRowClue(r);
    for (let c = 0; c < n; c++) drawColClue(c);
    bindPointer();

    labelEl.textContent = mode === 'daily' ? `Daily · ${n}×${n}` : `${n}×${n}`;
    newBtn.hidden = mode === 'daily';
    for (const b of el.querySelectorAll('.nn-modes button')) b.classList.toggle('on', b.dataset.m === mode);
    fillBtn.disabled = markBtn.disabled = state.done;
    undoBtn.disabled = state.done || !undo.length;
    noteEl.textContent = state.done ? (mode === 'daily' ? 'Solved. A new daily picture arrives tomorrow.' : 'Solved. Tap New for another.') : '';
    showTime();
  }

  function drawCell(i) {
    const v = state.grid[i];
    cellEls[i].className = cellEls[i].dataset.base + (v === 1 ? ' f' : v === 2 ? ' x' : '');
  }
  const lineRow = (r) => state.grid.slice(r * state.n, r * state.n + state.n);
  const lineCol = (c) => { const out = []; for (let r = 0; r < state.n; r++) out.push(state.grid[r * state.n + c]); return out; };
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  function drawRowClue(r) { rowEls[r].classList.toggle('done', same(runs(lineRow(r)), state.rows[r])); }
  function drawColClue(c) { colEls[c].classList.toggle('done', same(runs(lineCol(c)), state.cols[c])); }

  function showHl(r, c) {
    hlRow.style.display = hlCol.style.display = 'block';
    hlRow.style.top = r * cell + 'px'; hlCol.style.left = c * cell + 'px';
    rowEls.forEach((e, i) => e.classList.toggle('hl', i === r));
    colEls.forEach((e, i) => e.classList.toggle('hl', i === c));
  }
  function hideHl() {
    if (!hlRow) return;
    hlRow.style.display = hlCol.style.display = 'none';
    rowEls.forEach((e) => e.classList.remove('hl'));
    colEls.forEach((e) => e.classList.remove('hl'));
  }

  // Painting ----
  function cellAt(e) {
    const rect = cellsEl.getBoundingClientRect(), n = state.n;
    const c = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - rect.left) / cell)));
    const r = Math.max(0, Math.min(n - 1, Math.floor((e.clientY - rect.top) / cell)));
    return { r, c };
  }
  function paint(r, c) {
    const i = r * state.n + c, v = state.grid[i];
    if (v !== stroke.from || v === stroke.to) return;
    stroke.changes.push([i, v]);
    state.grid[i] = stroke.to;
    drawCell(i); drawRowClue(r); drawColClue(c);
    ctx.buzz();
    if (!state.started) { state.started = true; ctx.started(); t0 = Date.now(); }
  }
  function paintTo(r, c) {
    const last = stroke.last;
    if (!last) { paint(r, c); stroke.last = { r, c }; return; }
    const dr = Math.sign(r - last.r), dc = Math.sign(c - last.c);
    let rr = last.r, cc = last.c;
    while (rr !== r || cc !== c) { rr += dr; cc += dc; paint(rr, cc); }
    stroke.last = { r, c };
  }
  function bindPointer() {
    cellsEl.addEventListener('pointerdown', (e) => {
      if (state.done) return;
      e.preventDefault();
      try { cellsEl.setPointerCapture(e.pointerId); } catch {}
      const { r, c } = cellAt(e);
      const v = state.grid[r * state.n + c];
      const want = tool === 'fill' ? 1 : 2;
      stroke = { r0: r, c0: c, from: v, to: v === want ? 0 : want, axis: null, changes: [], last: null };
      paintTo(r, c); showHl(r, c);
    });
    cellsEl.addEventListener('pointermove', (e) => {
      if (!stroke) return;
      let { r, c } = cellAt(e);
      if (!stroke.axis && (r !== stroke.r0 || c !== stroke.c0)) {
        stroke.axis = Math.abs(r - stroke.r0) >= Math.abs(c - stroke.c0) ? 'col' : 'row';
      }
      if (stroke.axis === 'row') r = stroke.r0;
      if (stroke.axis === 'col') c = stroke.c0;
      paintTo(r, c); showHl(r, c);
    });
    const end = () => {
      if (!stroke) return;
      if (stroke.changes.length) undo.push(stroke.changes);
      stroke = null; hideHl();
      undoBtn.disabled = !undo.length;
      save(); checkWin();
    };
    cellsEl.addEventListener('pointerup', end);
    cellsEl.addEventListener('pointercancel', end);
  }

  function checkWin() {
    const n = state.n;
    for (let r = 0; r < n; r++) if (!same(runs(lineRow(r)), state.rows[r])) return;
    for (let c = 0; c < n; c++) if (!same(runs(lineCol(c)), state.cols[c])) return;
    pause();
    state.done = true;
    ctx.set(key(), state);
    render();
    const daily = mode === 'daily';
    ctx.win({
      mode, time: Math.round(state.elapsed), daily, delay: 1300,
      title: 'Picture complete!',
      onAgain: daily ? () => switchMode('s10') : newPuzzle,
      againLabel: daily ? 'Play 10×10' : 'New puzzle',
    });
  }

  // Controls ----
  function setTool(t) { tool = t; fillBtn.classList.toggle('on', t === 'fill'); markBtn.classList.toggle('on', t === 'mark'); }
  fillBtn.onclick = () => setTool('fill');
  markBtn.onclick = () => setTool('mark');
  undoBtn.onclick = () => {
    const ch = undo.pop(); if (!ch || state.done) return;
    for (let k = ch.length - 1; k >= 0; k--) {
      const [i, v] = ch[k]; state.grid[i] = v; drawCell(i);
      drawRowClue(Math.floor(i / state.n)); drawColClue(i % state.n);
    }
    undoBtn.disabled = !undo.length;
    save();
  };
  function newPuzzle() {
    pause();
    state = fresh(); undo = [];
    ctx.set(key(), state);
    render();
  }
  newBtn.onclick = () => {
    if (state.started && !state.done) {
      ctx.modal('<h2>Start a new puzzle?</h2><p class="sub">This board will be lost.</p>', [
        { label: 'Cancel' }, { label: 'New puzzle', primary: true, onClick: newPuzzle },
      ]);
    } else newPuzzle();
  };
  function switchMode(m) {
    if (state) { save(); pause(); }
    mode = m; ctx.set('mode', m);
    state = loadState(); undo = [];
    if (state.started && !state.done) t0 = Date.now();
    render();
  }
  for (const b of el.querySelectorAll('.nn-modes button')) b.onclick = () => { if (b.dataset.m !== mode) switchMode(b.dataset.m); };

  const onVis = () => {
    if (document.hidden) { save(); pause(); }
    else if (state.started && !state.done) t0 = Date.now();
  };
  document.addEventListener('visibilitychange', onVis);
  let rz = null;
  const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { if (!stroke) render(); }, 150); };
  window.addEventListener('resize', onResize);

  setTool('fill');
  switchMode(mode);

  return () => {
    save(); pause();
    clearInterval(tick);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', onResize);
  };
}

export default {
  id: 'nonogram',
  name: 'Pixels',
  tagline: 'Fill squares from number clues to reveal a picture.',
  color: PURPLE,
  glyph: '▦',
  help: `<p>Fill squares to reveal a hidden picture. The numbers beside each row and above each column give the lengths of its filled runs, in order, with at least one empty square between runs.</p>
<ul>
<li>Tap or drag to fill. Switch to Mark to put an X on squares you know are empty.</li>
<li>A clue fades once its line matches.</li>
<li>Every puzzle can be solved by logic alone, with no guessing.</li>
</ul>`,
  mount,
};
