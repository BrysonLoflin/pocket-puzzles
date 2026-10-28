// Target: combine six numbers with + − × ÷ to hit an exact target.
// Puzzles are built by random combination, then checked by a solver (minimum steps, no trivial targets).

const OPS = ['+', '−', '×', '÷'];
const LARGE = [15, 20, 25, 50, 75];

// Difficulty settings: how many large numbers, how many build steps, the fewest steps a solution may take, target range
const DIFFS = {
  easy:   { label: 'Easy',   large: 1, ops: [3, 3], min: 2, lo: 30,  hi: 150, notRound: false },
  medium: { label: 'Medium', large: 2, ops: [3, 4], min: 3, lo: 60,  hi: 400, notRound: false },
  hard:   { label: 'Hard',   large: 1, ops: [4, 5], min: 3, lo: 120, hi: 500, notRound: true },
};

// Puzzle logic ----
export function apply(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b > 0 ? a - b : null;
    case '×': return a * b;
    case '÷': return b > 0 && a % b === 0 ? a / b : null;
  }
  return null;
}

// Iterative deepening search: returns the shortest list of steps [a, op, b, result], or null.
export function solve(nums, target, maxDepth = 5) {
  if (nums.includes(target)) return [];
  for (let d = 1; d <= maxDepth; d++) {
    const path = dfs(nums, target, d, []);
    if (path) return path;
  }
  return null;
}
function dfs(arr, target, depth, path) {
  const seen = new Set();
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const hi = Math.max(arr[i], arr[j]), lo = Math.min(arr[i], arr[j]);
      const k = hi + ',' + lo;
      if (seen.has(k)) continue;
      seen.add(k);
      const rest = depth > 1 ? arr.filter((_, x) => x !== i && x !== j) : null;
      for (const op of OPS) {
        if ((op === '×' || op === '÷') && lo === 1) continue;
        const r = apply(hi, op, lo);
        if (r == null) continue;
        const step = [hi, op, lo, r];
        if (r === target) return [...path, step];
        if (depth > 1) {
          rest.push(r);
          const p = dfs(rest, target, depth - 1, [...path, step]);
          rest.pop();
          if (p) return p;
        }
      }
    }
  }
  return null;
}

// 1. Draw large numbers and small numbers (no more than two of any small number).
// 2. Combine numbers at random for 3 to 5 steps, usually chaining off the last result.
// 3. Keep the final result as the target if it is in range.
// 4. Ask the solver for the shortest route and reject targets that are too easy.
export function generate(rand, diffKey) {
  const D = DIFFS[diffKey] || DIFFS.medium;
  const ri = (n) => Math.floor(rand() * n);
  let fallback = null;
  for (let attempt = 0; attempt < 3000; attempt++) {
    const nums = [];
    const large = [...LARGE];
    for (let i = 0; i < D.large; i++) nums.push(large.splice(ri(large.length), 1)[0]);
    while (nums.length < 6) {
      const n = 1 + ri(10);
      if (nums.filter((x) => x === n).length < 2) nums.push(n);
    }
    nums.sort((a, b) => a - b);

    let pool = [...nums], last = null, ok = true;
    const nOps = D.ops[0] + ri(D.ops[1] - D.ops[0] + 1);
    for (let s = 0; s < nOps; s++) {
      let i = last != null && rand() < 0.7 ? pool.length - 1 : ri(pool.length);
      let j = ri(pool.length - 1);
      if (j >= i) j++;
      const hi = Math.max(pool[i], pool[j]), lo = Math.min(pool[i], pool[j]);
      const cands = [];
      for (const op of OPS) {
        if ((op === '×' || op === '÷') && lo === 1) continue;
        const r = apply(hi, op, lo);
        if (r != null && r <= 999) cands.push(r);
      }
      if (!cands.length) { ok = false; break; }
      const r = cands[ri(cands.length)];
      pool = pool.filter((_, x) => x !== i && x !== j);
      pool.push(r);
      last = r;
    }
    if (!ok) continue;
    const target = last;
    if (target < D.lo || target > D.hi) continue;
    if (D.notRound && target % 5 === 0) continue;
    const sol = solve(nums, target, nOps);
    if (!sol || sol.length < 2) continue;
    if (!fallback) fallback = { nums, target, solution: sol };
    if (sol.length < D.min) continue;
    return { nums, target, solution: sol };
  }
  if (fallback) return fallback;
  const nums = [2, 3, 5, 7, 25, 50];
  return { nums, target: 337, solution: solve(nums, 337, 5) };
}

// Styles ----
const CSS = `
.game-target .tg-head { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.game-target .tg-tbox { text-align: center; margin: 14px 0 10px; }
.game-target .tg-label { font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
.game-target .tg-target { font-size: 60px; font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums; }
.game-target .tg-target.hit { color: var(--good); }
.game-target .tg-timeline { display: flex; justify-content: center; gap: 14px; }
.game-target .tg-nums { display: grid; grid-template-columns: repeat(3, 80px); gap: 16px 20px; justify-content: center; margin: 18px 0 20px; }
.game-target .tg-num {
  width: 80px; height: 80px; border-radius: 50%;
  border: 2px solid var(--line); background: var(--surface);
  font-size: 27px; font-weight: 800; font-variant-numeric: tabular-nums; cursor: pointer;
  transition: transform 0.12s, background 0.12s;
}
.game-target .tg-num:active { transform: scale(0.94); }
.game-target .tg-num.sel { background: var(--accent); border-color: var(--accent); color: #fff; }
.game-target .tg-num.hit { background: var(--good); border-color: var(--good); color: #fff; }
.game-target .tg-num.empty { visibility: hidden; }
.game-target .tg-num.new { animation: tg-pop 0.28s cubic-bezier(.2,1.5,.4,1); }
.game-target .tg-num.long { font-size: 23px; }
.game-target .tg-ops { display: grid; grid-template-columns: repeat(4, 64px); gap: 12px; justify-content: center; }
.game-target .tg-op {
  width: 64px; height: 64px; border-radius: 50%; border: none;
  background: var(--surface-2); font-size: 30px; font-weight: 700; cursor: pointer;
}
.game-target .tg-op.on { background: var(--text); color: var(--bg); }
.game-target .tg-op:disabled, .game-target .tg-num:disabled { cursor: default; }
.game-target .tg-steps { min-height: 44px; margin: 16px 0 10px; text-align: center; color: var(--muted); font-size: 15px; line-height: 1.6; font-variant-numeric: tabular-nums; }
.game-target .tg-steps b { color: var(--text); }
.game-target .tg-card { background: var(--surface); border-radius: var(--radius); padding: 16px; margin-top: 16px; text-align: center; }
.game-target .tg-card h3 { margin: 0 0 6px; font-size: 18px; }
.game-target .tg-card p { margin: 4px 0 12px; color: var(--muted); }
.game-target .tg-card ol { text-align: left; display: inline-block; margin: 4px 0 12px; padding-left: 22px; line-height: 1.7; font-size: 17px; font-variant-numeric: tabular-nums; }
@keyframes tg-pop { from { transform: scale(0.6); } }
`;
function injectStyle() {
  if (document.getElementById('tg-style')) return;
  const s = document.createElement('style');
  s.id = 'tg-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const stepText = ([a, op, b, r]) => `${a} ${op} ${b} = ${r}`;

export default {
  id: 'target',
  name: 'Target',
  tagline: 'Hit the number with + − × ÷',
  color: '#e8590c',
  glyph: '=',
  help: `<p>Reach the target number by combining the six numbers you are given.</p>
<ul>
<li>Tap a number, then an operation, then another number. The two numbers are replaced by the result.</li>
<li>Every result must be a positive whole number, so division has to come out even.</li>
<li>You do not need to use every number.</li>
<li>Daily is one puzzle for everyone all day. Practice gives unlimited puzzles at three levels.</li>
</ul>`,

  mount(el, ctx) {
    injectStyle();
    let mode = ctx.get('mode', 'daily');
    let diff = ctx.get('diff', 'medium');
    let st = null;          // saved puzzle state
    let sel = null, op = null, flash = null;

    const key = () => (mode === 'daily' ? 'daily:' + ctx.today() : 'practice:' + diff);
    const save = () => { if (st) ctx.set(key(), st); };

    function fresh() {
      const daily = mode === 'daily';
      const rand = daily ? ctx.rng(ctx.dailySeed()) : ctx.rng(Date.now());
      const d = daily ? 'medium' : diff;
      const p = generate(rand, d);
      st = { daily, diff: d, start: p.nums, target: p.target, solution: p.solution,
             nums: [...p.nums], hist: [], elapsed: 0, solved: false, gaveUp: false };
      ctx.started();
      save();
    }
    function load() {
      if (mode === 'daily') {
        // drop the previous day's saved puzzle
        const prev = ctx.get('dailyKey', null);
        if (prev && prev !== key()) ctx.del(prev);
        ctx.set('dailyKey', key());
      }
      st = ctx.get(key(), null);
      if (!st) fresh();
      sel = op = flash = null;
    }

    function render() {
      const over = st.solved || st.gaveUp;
      const best = ctx.stats().best[st.daily ? 'daily' : st.diff];
      const nums = st.nums.map((n, i) => {
        if (n == null) return `<button class="tg-num empty" disabled></button>`;
        const cls = ['tg-num'];
        if (i === sel && !over) cls.push('sel');
        if (st.solved && n === st.target) cls.push('hit');
        if (i === flash) cls.push('new');
        if (n >= 1000) cls.push('long');
        return `<button class="${cls.join(' ')}" data-i="${i}" ${over ? 'disabled' : ''}>${n}</button>`;
      }).join('');
      const ops = OPS.map((o) => `<button class="tg-op${o === op ? ' on' : ''}" data-op="${o}" ${over ? 'disabled' : ''}>${o}</button>`).join('');
      const steps = st.hist.length
        ? st.hist.map((h, k) => (k === st.hist.length - 1 ? `<b>${h.text}</b>` : h.text)).join('<br>')
        : 'Combine two numbers to make a new one.';

      let card = '';
      if (st.solved && st.daily) {
        card = `<div class="tg-card"><h3>Today's Target is done</h3><p>A new one arrives tomorrow.</p><button class="btn primary" data-act="practice">Play Practice</button></div>`;
      } else if (st.solved) {
        card = `<div class="tg-card"><h3>Solved in ${st.hist.length} steps</h3><p>The shortest route takes ${st.solution.length}.</p><button class="btn primary" data-act="new">New puzzle</button></div>`;
      } else if (st.gaveUp) {
        card = `<div class="tg-card"><h3>One way to get there</h3><ol>${st.solution.map((s) => `<li>${stepText(s)}</li>`).join('')}</ol><br>
          <button class="btn primary" data-act="${st.daily ? 'practice' : 'new'}">${st.daily ? 'Play Practice' : 'New puzzle'}</button></div>`;
      }

      el.innerHTML = `
        <div class="tg-head">
          <div class="seg">
            <button data-mode="daily" class="${mode === 'daily' ? 'on' : ''}">Daily</button>
            <button data-mode="practice" class="${mode === 'practice' ? 'on' : ''}">Practice</button>
          </div>
          ${mode === 'practice' ? `<div class="seg">${Object.entries(DIFFS).map(([k, v]) => `<button data-diff="${k}" class="${k === diff ? 'on' : ''}">${v.label}</button>`).join('')}</div>` : ''}
        </div>
        <div class="tg-tbox">
          <div class="tg-label">Target</div>
          <div class="tg-target${st.solved ? ' hit' : ''}">${st.solved ? '✓ ' : ''}${st.target}</div>
          <div class="tg-timeline"><span class="stat tg-time">${ctx.formatTime(st.elapsed)}</span>${best != null ? `<span class="stat">Best ${ctx.formatTime(best)}</span>` : ''}</div>
        </div>
        <div class="tg-nums">${nums}</div>
        <div class="tg-ops">${ops}</div>
        <div class="tg-steps">${steps}</div>
        ${over ? '' : `<div class="row">
          <button class="btn" data-act="undo" ${st.hist.length ? '' : 'disabled'}>Undo</button>
          <button class="btn" data-act="reset" ${st.hist.length ? '' : 'disabled'}>Reset</button>
          <button class="btn" data-act="solution">Show a solution</button>
        </div>`}
        ${card}`;
      flash = null;
    }

    function tapNumber(i) {
      if (st.nums[i] == null) return;
      if (sel == null || op == null) { sel = sel === i ? null : i; op = null; return; }
      if (sel === i) { sel = null; op = null; return; }
      const a = st.nums[sel], b = st.nums[i];
      const r = apply(a, op, b);
      if (r == null) {
        ctx.toast(op === '÷' ? `${a} ÷ ${b} does not divide evenly` : `${a} − ${b} would not be positive`);
        ctx.buzz(30);
        return;
      }
      st.hist.push({ nums: [...st.nums], text: `${a} ${op} ${b} = ${r}` });
      st.nums[sel] = null;
      st.nums[i] = r;
      flash = i; sel = i; op = null;
      ctx.buzz();
      if (r === st.target) {
        st.solved = true;
        sel = null;
        save();
        ctx.win({
          mode: st.daily ? 'daily' : st.diff,
          time: st.elapsed,
          daily: st.daily,
          detail: `${st.hist.length} steps`,
          againLabel: st.daily ? 'Play Practice' : 'New puzzle',
          onAgain: st.daily ? () => switchMode('practice') : () => { fresh(); sel = op = null; render(); },
        });
      }
      save();
    }

    function switchMode(m) {
      save();
      mode = m;
      ctx.set('mode', mode);
      load();
      render();
    }

    function onClick(e) {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.mode) { if (d.mode !== mode) switchMode(d.mode); return; }
      if (d.diff) { if (d.diff !== diff) { save(); diff = d.diff; ctx.set('diff', diff); load(); render(); } return; }
      if (st.solved || st.gaveUp) {
        if (d.act === 'practice') switchMode('practice');
        if (d.act === 'new') { fresh(); sel = op = null; render(); }
        return;
      }
      if (d.i != null) tapNumber(+d.i);
      else if (d.op) {
        if (sel == null) { ctx.toast('Tap a number first'); return; }
        op = op === d.op ? null : d.op;
      } else if (d.act === 'undo' && st.hist.length) {
        st.nums = st.hist.pop().nums; sel = op = null; save();
      } else if (d.act === 'reset') {
        st.nums = [...st.start]; st.hist = []; sel = op = null; save();
      } else if (d.act === 'solution') {
        ctx.modal('<h2>Show a solution?</h2><p class="sub">This ends the puzzle without a win.</p>', [
          { label: 'Keep trying' },
          { label: 'Show it', primary: true, onClick: () => { st.gaveUp = true; sel = op = null; save(); render(); } },
        ]);
        return;
      }
      render();
    }

    // Timer: counts only while the app is visible and the puzzle is open
    const tick = setInterval(() => {
      if (document.hidden || !st || st.solved || st.gaveUp) return;
      st.elapsed++;
      const t = el.querySelector('.tg-time');
      if (t) t.textContent = ctx.formatTime(st.elapsed);
      if (st.elapsed % 5 === 0) save();
    }, 1000);
    const onVis = () => { if (document.hidden) save(); };
    document.addEventListener('visibilitychange', onVis);
    el.addEventListener('click', onClick);

    load();
    render();

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
      el.removeEventListener('click', onClick);
      save();
    };
  },
};
