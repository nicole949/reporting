// todos.js — "To-dos & targets": a shared list per overview page (stored in the database, table app.todos).
// A to-do can carry a KPI target (metric + number + period); its progress is computed from the same numbers as the
// tiles (assets/kpis.js), with a pace marker for how much of the period has passed.
//   R.todos({ el, scope: 'marketing', K, groups: [[label, [metric keys]], …] })
(function () {
  const R = window.R, esc = R.esc, DAY = 864e5;
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const PERIODS = [['week', 'This week'], ['month', 'This month'], ['quarter', 'This quarter'], ['rweek', 'Every week'], ['rmonth', 'Every month'], ['rquarter', 'Every quarter'], ['custom', 'Custom dates']];
  // the calendar period around a date (local time, weeks start on Monday) → { from, to } with `to` exclusive
  function around(kind, d) {
    d = d || new Date(); const y = d.getFullYear(), m = d.getMonth();
    if (kind === 'week') { const a = new Date(y, m, d.getDate() - ((d.getDay() + 6) % 7)); return { from: ymd(a), to: ymd(new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7)) }; }
    if (kind === 'month') return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 1)) };
    const q = Math.floor(m / 3) * 3; return { from: ymd(new Date(y, q, 1)), to: ymd(new Date(y, q + 3, 1)) };
  }
  const fd = s => s.slice(8, 10) + '.' + s.slice(5, 7) + '.';
  const lastDay = to => { const t = new Date(Date.parse(to) - DAY); return ymd(new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); };
  // the window a target is measured in, and how it is described
  function windowOf(k) {
    if (k.period === 'custom' || ((k.period === 'week' || k.period === 'month' || k.period === 'quarter') && k.from && k.to)) {
      const w = { from: k.from, to: k.to };
      w.label = k.period === 'custom' ? fd(k.from) + '–' + fd(lastDay(k.to)) + k.to.slice(0, 4) : ({ week: 'week', month: 'month', quarter: 'quarter' })[k.period] + ' ' + fd(k.from) + '–' + fd(lastDay(k.to));
      return w;
    }
    const kind = String(k.period || 'rweek').replace(/^r/, ''), w = around(kind);
    w.label = 'every ' + kind + ' · now ' + fd(w.from) + '–' + fd(lastDay(w.to)); w.recurring = true;
    return w;
  }
  function progress(K, k) {
    const w = windowOf(k), m = K.metric(k.metric);
    if (!m) return { w, missing: true };
    const v = K.value(k.metric, w.from, w.to, { owner: k.owner, series: k.series }) || 0, target = Number(k.target) || 0;
    const a = Date.parse(w.from), b = Date.parse(w.to), now = Date.parse(ymd(new Date())) + DAY;   // today counts as a full day
    const elapsed = Math.max(0, Math.min(1, (now - a) / (b - a))), over = now >= b;
    const pct = target ? Math.round(100 * v / target) : 0, diff = pct - Math.round(100 * elapsed);
    const stat = v >= target ? ['done', '✓ reached'] : over ? ['missed', '✗ missed'] : now <= a ? ['ontrack', 'not started'] : diff >= 5 ? ['ahead', '● ahead'] : diff <= -5 ? ['behind', '● behind'] : ['ontrack', '● on track'];
    return { w, m, v, target, pct, elapsed, stat, over };
  }

  R.todos = function (opts) {
    const el = typeof opts.el === 'string' ? document.getElementById(opts.el) : opts.el, K = opts.K, scope = opts.scope;
    let items = [], showDone = false, editing = null, msg = '', loaded = false, failed = false;
    async function op(body) {
      const r = await fetch(R.source('rpc/todo_op').url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || ('error ' + r.status));
      return j;
    }
    async function load() {
      try { items = await R.fetchAll('todos?scope=eq.' + encodeURIComponent(scope) + '&order=done.asc,sort.asc'); failed = false; }
      catch (e) { failed = true; }
      loaded = true; draw();
    }
    const metricOptions = sel => {
      const ok = new Set(K.targetable().map(m => m.key));
      return (opts.groups || []).map(([g, keys]) => { const ks = keys.filter(k => ok.has(k)); return ks.length ? '<optgroup label="' + esc(g) + '">' + ks.map(k => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(K.metric(k).label.replace(/ · now$/, '')) + '</option>').join('') + '</optgroup>' : ''; }).join('');
    };
    function row(t) {
      const k = t.kpi, today = ymd(new Date());
      const chips = [t.assignee ? '<span class="chip">' + R.icon('user') + esc(t.assignee) + '</span>' : '',
        t.due ? '<span class="chip' + (!t.done && t.due < today ? ' late' : '') + '">' + R.icon('calendar') + 'due ' + R.fmtDate(t.due) + '</span>' : '',
        t.done && t.done_at ? '<span class="chip muted">done ' + R.fmtDate(t.done_at) + (t.done_by ? ' · ' + esc(t.done_by) : '') + '</span>' : ''].join('');
      let kh = '';
      if (k) {
        const p = progress(K, k);
        if (p.missing) kh = '<div class="tdk"><span class="small muted">' + esc(k.metric) + ' is not available on this page.</span></div>';
        else {
          const what = esc(p.m.label.replace(/ · now$/, '')) + (k.series ? ' · ' + esc(k.series) : '') + (k.owner ? ' · ' + esc(k.owner) : '');
          kh = '<button type="button" class="tdk" data-id="' + t.id + '" title="Click for the records behind the number">' +
            '<span class="tdbar ' + p.stat[0] + '"><i style="width:' + Math.min(100, p.pct) + '%"></i>' + (p.over || p.pct >= 100 ? '' : '<b style="left:' + Math.round(100 * p.elapsed) + '%" title="where you should be by today"></b>') + '</span>' +
            '<span class="tdn"><strong>' + K.fmt(p.m, p.v) + '</strong> / ' + K.fmt(p.m, p.target) + ' ' + what + ' · ' + p.pct + '% <span class="gstat ' + p.stat[0] + '">' + p.stat[1] + '</span></span>' +
            '<span class="tdw">' + esc(p.w.label) + '</span></button>';
        }
      }
      return '<li class="td' + (t.done ? ' done' : '') + (k ? ' kpi' : '') + '" data-id="' + t.id + '">' +
        '<label class="tdc" title="' + (t.done ? 'Mark as open' : 'Mark as done') + '"><input type="checkbox"' + (t.done ? ' checked' : '') + '><span></span></label>' +
        '<div class="tdm"><div class="tdt">' + esc(t.title) + (k ? ' <span class="tag">' + R.icon('target') + 'target</span>' : '') + '</div>' + kh + (chips.trim() ? '<div class="tdmeta">' + chips + '</div>' : '') + '</div>' +
        '<div class="tda"><button type="button" class="ed" title="Edit">' + R.icon('edit') + '</button><button type="button" class="del" title="Delete">✕</button></div></li>';
    }
    function form() {
      const t = editing || {}, k = t.kpi || null;
      const metric = k ? k.metric : (K.targetable()[0] || {}).key, owners = K.owners(metric), series = K.series(metric);
      const per = k ? (k.period === 'custom' ? 'custom' : (k.repeat ? 'r' : '') + k.period) : 'week';
      const names = [...new Set([].concat(...['calls', 'booked', 'created'].map(K.owners)))].filter(n => n !== 'Unassigned');
      return '<form class="tdadd' + (k ? ' withkpi' : '') + '">' +
        '<div class="tdrow"><input type="text" name="title" maxlength="200" placeholder="' + (editing ? '' : 'Add a to-do, e.g. “Send the DMEXCO follow-up” or “200 calls this week”') + '" value="' + esc(t.title || '') + '" required>' +
        '<label class="tdtg" title="Track a number automatically"><input type="checkbox" name="iskpi"' + (k ? ' checked' : '') + '> KPI target</label>' +
        '<input type="text" name="assignee" list="td-people" placeholder="Who" value="' + esc(t.assignee || '') + '" class="who">' +
        '<input type="date" name="due" value="' + esc(t.due || '') + '" title="Due date (optional)">' +
        '<button class="btn primary" type="submit">' + (editing ? 'Save' : 'Add') + '</button>' + (editing ? '<button class="btn" type="button" data-a="cancel">Cancel</button>' : '') + '</div>' +
        '<div class="tdrow tdkpi">' +
        '<label>Metric <select name="metric">' + metricOptions(metric) + '</select></label>' +
        '<label>Target <input type="number" name="target" min="1" step="any" value="' + esc(k ? k.target : '') + '" placeholder="200"></label>' +
        '<label>Period <select name="period">' + PERIODS.map(p => '<option value="' + p[0] + '"' + (p[0] === per ? ' selected' : '') + '>' + p[1] + '</option>').join('') + '</select></label>' +
        '<span class="cust"' + (per === 'custom' ? '' : ' hidden') + '><input type="date" name="from" value="' + esc(k && k.period === 'custom' ? k.from : '') + '"> → <input type="date" name="to" value="' + esc(k && k.period === 'custom' ? lastDay(k.to) : '') + '"></span>' +
        '<label class="ser"' + (series.length ? '' : ' hidden') + '>Only <select name="series"><option value="">all</option>' + series.map(s => '<option' + (k && k.series === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></label>' +
        '<label class="own"' + (owners.length ? '' : ' hidden') + '>Owner <select name="owner"><option value="">everyone</option>' + owners.map(s => '<option' + (k && k.owner === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></label>' +
        '</div><datalist id="td-people">' + names.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>' +
        '<div class="tdmsg">' + esc(msg) + '</div></form>';
    }
    function draw() {
      if (!el) return;
      const open = items.filter(t => !t.done), done = items.filter(t => t.done).sort((a, b) => (b.done_at || '') < (a.done_at || '') ? -1 : 1);
      const kpis = open.filter(t => t.kpi), plain = open.filter(t => !t.kpi);
      el.className = 'kgroup todos';
      el.innerHTML = '<div class="gh"><h2>To-dos & targets</h2><span class="st">shared with everyone on this page</span>' +
        (done.length ? '<button type="button" class="tool tdshow" style="margin-left:auto">' + (showDone ? 'Hide' : 'Show') + ' done (' + done.length + ')</button>' : '') + '</div>' +
        (failed ? '<div class="state">The list cannot be loaded right now.</div>' : !loaded ? '<div class="state">Loading…</div>' :
          (open.length ? '<ul class="tdl">' + kpis.concat(plain).map(row).join('') + '</ul>' : '<div class="tdempty">Nothing open. Add a to-do below — tick “KPI target” to track a number, e.g. 200 calls every week.</div>') +
          (showDone && done.length ? '<div class="tdsec">Done</div><ul class="tdl">' + done.slice(0, 50).map(row).join('') + '</ul>' : '')) +
        form();
      wire();
    }
    function wire() {
      const f = el.querySelector('.tdadd');
      const sync = () => {
        const m = f.metric.value, owners = K.owners(m), series = K.series(m);
        f.classList.toggle('withkpi', f.iskpi.checked);
        f.querySelector('.cust').hidden = f.period.value !== 'custom';
        const o = f.querySelector('.own'); o.hidden = !owners.length; if (owners.length && !owners.includes(f.owner.value)) f.owner.innerHTML = '<option value="">everyone</option>' + owners.map(s => '<option>' + esc(s) + '</option>').join('');
        const s = f.querySelector('.ser'); s.hidden = !series.length; if (series.length && ![...f.series.options].some(x => x.value && series.includes(x.value))) f.series.innerHTML = '<option value="">all</option>' + series.map(x => '<option>' + esc(x) + '</option>').join('');
      };
      f.addEventListener('input', () => { const m = f.querySelector('.tdmsg'); if (msg && m) { msg = ''; m.textContent = ''; } });
      f.iskpi.onchange = sync; f.metric.onchange = () => { f.owner.value = ''; f.series.value = ''; sync(); }; f.period.onchange = sync;
      f.querySelectorAll('[data-a="cancel"]').forEach(b => b.onclick = () => { editing = null; msg = ''; draw(); });
      f.onsubmit = async e => {
        e.preventDefault();
        const body = { title: f.title.value.trim(), assignee: f.assignee.value.trim(), due: f.due.value || '' };
        if (f.iskpi.checked) {
          const p = f.period.value, k = { metric: f.metric.value, target: Number(f.target.value) };
          if (!(k.target > 0)) { msg = 'Enter the target number.'; draw(); return; }
          if (p === 'custom') {
            if (!f.from.value || !f.to.value || f.to.value < f.from.value) { msg = 'Pick the first and the last day of the target.'; draw(); return; }
            const d = new Date(Date.parse(f.to.value));   // stored end is exclusive: the day after the last day
            Object.assign(k, { period: 'custom', from: f.from.value, to: ymd(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)) });
          } else if (p[0] === 'r') Object.assign(k, { period: p.slice(1), repeat: true });
          else Object.assign(k, { period: p }, editing && editing.kpi && editing.kpi.period === p && !editing.kpi.repeat ? { from: editing.kpi.from, to: editing.kpi.to } : around(p));
          if (f.owner.value && !f.querySelector('.own').hidden) k.owner = f.owner.value;
          if (f.series.value && !f.querySelector('.ser').hidden) k.series = f.series.value;
          body.kpi = k;
        } else body.kpi = null;
        try {
          if (editing) await op(Object.assign({ op: 'update', id: editing.id }, body));
          else await op(Object.assign({ op: 'add', scope, by: R.userName() || '' }, body));
          editing = null; msg = '';
          await load();
          const t = el.querySelector('.tdadd input[name="title"]'); if (t && !editing) t.focus();
        } catch (err) { msg = err.message; draw(); }
      };
      el.querySelectorAll('.tdshow').forEach(b => b.onclick = () => { showDone = !showDone; draw(); });
      el.querySelectorAll('li.td').forEach(li => {
        const t = items.find(x => String(x.id) === li.dataset.id); if (!t) return;
        li.querySelector('.tdc input').onchange = async e => {
          li.classList.toggle('done', e.target.checked);
          try { await op({ op: 'done', id: t.id, done: e.target.checked, by: R.userName() || '' }); await load(); } catch (err) { msg = err.message; draw(); }
        };
        li.querySelector('.ed').onclick = () => { editing = t; msg = ''; draw(); const i = el.querySelector('.tdadd input[name="title"]'); if (i) { i.focus(); el.querySelector('.tdadd').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } };
        const del = li.querySelector('.del');
        del.onclick = async () => {
          if (!del.classList.contains('sure')) { del.classList.add('sure'); del.textContent = 'Delete?'; setTimeout(() => { if (del.isConnected) { del.classList.remove('sure'); del.textContent = '✕'; } }, 4000); return; }
          try { await op({ op: 'delete', id: t.id }); if (editing && editing.id === t.id) editing = null; await load(); } catch (err) { msg = err.message; draw(); }
        };
        const kb = li.querySelector('button.tdk');
        if (kb) kb.onclick = () => {
          const k = t.kpi, p = progress(K, k);
          K.list(k.metric, K.records(k.metric, p.w.from, p.w.to, { owner: k.owner, series: k.series }), t.title,
            esc(p.m.label) + (k.series ? ' · ' + esc(k.series) : '') + (k.owner ? ' · ' + esc(k.owner) : '') + ' · ' + esc(p.w.label) + ' · ' + K.fmt(p.m, p.v) + ' of ' + K.fmt(p.m, p.target));
        };
      });
    }
    window.addEventListener('focus', () => { if (loaded && !editing && document.activeElement === document.body) load(); });
    draw(); load();
    return { refresh: draw, reload: load };
  };
})();
