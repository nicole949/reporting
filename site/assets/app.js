/* JENTIS Reporting v2 — shared shell. Pages call R.shell({ page, title, subtitle }) then use R.fetchAll / R.ai / R.fmt*.
   Navigation, change notes, theme and the API client live here; nothing page-specific. */
(function () {
  const C = window.RCONFIG || {};
  const R = (window.R = { C });

  // ---------- navigation (sections follow the commercial journey) ----------
  // status: 'live' = v2 page in this repo · 'v1' = still served by the v1 dashboard (opens there) · 'planned' = not built yet
  const V1 = C.V1_URL || 'https://vibe-reports.jentis.info';
  R.NAV = [
    { key: 'overview', label: 'Overview', items: [
      { key: 'overview', label: 'Overview', href: '/', ic: '◎', status: 'live' } ] },
    { key: 'marketing', label: 'Marketing', items: [
      { key: 'leads', label: 'Leads & cohorts', href: V1 + '/leads/', ic: '◔', status: 'v1' },
      { key: 'sequences', label: 'Sequences', href: V1 + '/sequences/', ic: '✉', status: 'v1' },
      { key: 'subjects', label: 'Subject lines', href: V1 + '/subjects/', ic: '✎', status: 'v1' },
      { key: 'linkedin', label: 'LinkedIn outreach', href: '#', ic: '⌂', status: 'planned' },
      { key: 'campaigns', label: 'Campaigns & ads', href: '#', ic: '◈', status: 'planned' } ] },
    { key: 'bd', label: 'Business Development', items: [
      { key: 'responses', label: 'Responses', href: V1 + '/responded/', ic: '↩', status: 'v1' },
      { key: 'calls', label: 'Calls', href: V1 + '/calls/', ic: '☏', status: 'v1' },
      { key: 'discoveries', label: 'Discoveries', href: V1 + '/discoveries/', ic: '◷', status: 'v1' },
      { key: 'journeys', label: 'Journeys & funnel', href: V1 + '/journeys/', ic: '⇅', status: 'v1' } ] },
    { key: 'sales', label: 'Sales pipeline', items: [
      { key: 'deals', label: 'Deals', href: V1 + '/deals/', ic: '▤', status: 'v1' },
      { key: 'stages', label: 'Stage report', href: '#', ic: '▥', status: 'planned' },
      { key: 'quotes', label: 'Quote checker', href: V1 + '/cs-quote-checker/', ic: '✓', status: 'v1' },
      { key: 'forecast', label: 'Forecast', href: '#', ic: '◭', status: 'planned' } ] },
    { key: 'cs', label: 'Customer Success', items: [
      { key: 'customers', label: 'Customers', href: V1 + '/cs-customers/', ic: '☺', status: 'v1' },
      { key: 'renewals', label: 'Renewals & expansion', href: V1 + '/cs-renewals/', ic: '↻', status: 'v1' },
      { key: 'tickets', label: 'Tickets', href: V1 + '/cs-tickets/', ic: '⚑', status: 'v1' },
      { key: 'meetings', label: 'Meetings', href: V1 + '/cs-meetings/', ic: '◷', status: 'v1' },
      { key: 'capacity', label: 'Capacity', href: V1 + '/cs-capacity/', ic: '▦', status: 'v1' } ] },
    { key: 'partners', label: 'Partners', items: [
      { key: 'partner-overview', label: 'Partner overview', href: '#', ic: '◉', status: 'planned' },
      { key: 'partner-ps', label: 'Services at partners', href: '#', ic: '▦', status: 'planned' },
      { key: 'partner-pipeline', label: 'Partner-sourced pipeline', href: '#', ic: '▤', status: 'planned' } ] },
    { key: 'knowledge', label: 'Knowledge', items: [
      { key: 'library', label: 'Library', href: '#', ic: '▣', status: 'planned' },
      { key: 'assistant', label: 'Ask the docs', href: '#', ic: '✦', status: 'planned' } ] },
    { key: 'data', label: 'Data & AI', items: [
      { key: 'ai-spend', label: 'AI spend', href: '#', ic: '✦', status: 'planned' },
      { key: 'sync', label: 'Sync status', href: '#', ic: '⟳', status: 'planned' },
      { key: 'changes', label: 'Change notes', href: '#whatsnew', ic: '★', status: 'live' } ] },
  ];

  // ---------- per-user state (localStorage until SSO + app.settings) ----------
  const LS = { get: (k, d) => { try { const v = localStorage.getItem('r2.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
               set: (k, v) => { try { localStorage.setItem('r2.' + k, JSON.stringify(v)); } catch (e) {} } };
  R.pref = (k, v) => v === undefined ? LS.get(k) : LS.set(k, v);

  // theme
  const applyTheme = t => { if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme'); };
  applyTheme(LS.get('theme', window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  R.toggleTheme = () => { const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; LS.set('theme', t); applyTheme(t); };

  // ---------- change notes ----------
  // docs/changelog.json: [{ version, date, title, items: [{ section, page, text }] }], newest first. Copied to assets/ by the deploy.
  let CHANGES = [];
  R.changes = { seen: () => LS.get('seenVersion', ''), markSeen: () => { if (CHANGES[0]) LS.set('seenVersion', CHANGES[0].version); render(); } };
  const unread = () => { const s = R.changes.seen(); return CHANGES.filter(r => !s || r.version > s); };
  const unreadFor = (section, page) => unread().flatMap(r => r.items.filter(i => i.section === section && (!page || i.page === page)).map(i => i.text));

  // ---------- shell ----------
  let CUR = {};
  R.shell = function (opts) {
    CUR = opts || {};
    document.title = (CUR.title ? CUR.title + ' · ' : '') + 'JENTIS Reporting';
    const app = document.createElement('div'); app.className = 'app';
    app.innerHTML = '<aside class="side" id="side"></aside><main class="main"><div class="topbar"><button class="burger" onclick="document.getElementById(\'side\').classList.toggle(\'open\')">☰</button><div class="ttl"><h1>' + esc(CUR.title || '') + '</h1>' + (CUR.subtitle ? '<div class="sub">' + esc(CUR.subtitle) + '</div>' : '') + '</div><div class="spacer"></div><div id="topbar-right"></div></div><div id="page"></div></main><aside class="wn" id="wn"></aside>';
    const host = document.getElementById('shell'); host.replaceWith(app);
    fetch((C.ASSET_BASE || 'assets/') + 'changelog.json?b=' + encodeURIComponent(C.BUILD || '')).then(r => r.ok ? r.json() : []).then(j => { CHANGES = Array.isArray(j) ? j : []; render(); }).catch(() => render());
    render();
    const page = document.getElementById('page');
    const pc = document.getElementById('page-content');          // ported v1 pages ship their own markup
    if (pc) { pc.hidden = false; page.appendChild(pc); }
    return page;
  };

  function render() {
    const side = document.getElementById('side'); if (!side) return;
    const closed = LS.get('closedSections', []);
    const n = unread().length;
    side.innerHTML = '<div class="brand"><img src="' + (C.ASSET_BASE || 'assets/') + 'logo.svg" alt=""><span class="name">Reporting</span><span class="env ' + (C.ENV || '') + '">' + esc(C.ENV || '') + '</span></div><nav class="nav">' +
      R.NAV.map(s => {
        const secNew = unreadFor(s.key).length;
        return '<div class="sec' + (closed.includes(s.key) ? ' closed' : '') + (secNew ? ' has-new' : '') + '" data-sec="' + s.key + '"><button class="hd" onclick="R._toggleSec(\'' + s.key + '\')">' + esc(s.label) + '<span class="dot"></span><span class="car">▾</span></button><div class="items">' +
          s.items.map(it => {
            const hints = unreadFor(s.key, it.key);
            const active = CUR.page === it.key;
            const chip = hints.length ? '<span class="chip new">new</span>' : it.status === 'v1' ? '<span class="chip v1">v1</span>' : it.status === 'planned' ? '<span class="chip soon">soon</span>' : '';
            const href = it.href === '#whatsnew' ? 'javascript:R._openWn()' : it.href;
            return '<a href="' + href + '" class="' + (active ? 'active ' : '') + (it.status === 'planned' ? 'planned ' : '') + (hints.length ? 'hint-new' : '') + '"' + (hints.length ? ' data-hint="' + esc(hints.join(' · ')) + '"' : '') + (it.status === 'v1' ? ' target="_blank" rel="noopener"' : '') + '><span class="ic">' + it.ic + '</span>' + esc(it.label) + chip + '</a>';
          }).join('') + '</div></div>';
      }).join('') + '</nav><div class="foot"><span>' + esc(C.BUILD || 'dev') + '</span><button onclick="R.toggleTheme()" title="light / dark">◐</button><button onclick="R._openWn()" title="change notes">★' + (n ? ' ' + n : '') + '</button></div>';
    renderWn();
  }
  R._toggleSec = key => { const c = LS.get('closedSections', []); LS.set('closedSections', c.includes(key) ? c.filter(k => k !== key) : [...c, key]); render(); };
  R._openWn = () => { document.getElementById('wn').classList.add('open'); };
  R._closeWn = () => { document.getElementById('wn').classList.remove('open'); R.changes.markSeen(); };
  function renderWn() {
    const el = document.getElementById('wn'); if (!el) return;
    const seen = R.changes.seen();
    el.innerHTML = '<h3>What\'s new <button onclick="R._closeWn()" title="close (marks everything as read)">✕</button></h3>' +
      (CHANGES.length ? CHANGES.map(r => '<div class="rel' + (!seen || r.version > seen ? ' unread' : '') + '"><div class="d">' + esc(r.date) + ' · ' + esc(r.version) + '</div><div class="t">' + esc(r.title) + '</div><ul>' +
        r.items.map(i => '<li><span class="where">' + esc(secLabel(i.section)) + (i.page ? ' › ' + esc(pageLabel(i.section, i.page)) : '') + '</span>' + esc(i.text) + '</li>').join('') + '</ul></div>').join('') : '<div class="state">No change notes yet.</div>');
  }
  const secLabel = k => (R.NAV.find(s => s.key === k) || {}).label || k;
  const pageLabel = (s, p) => ((R.NAV.find(x => x.key === s) || { items: [] }).items.find(i => i.key === p) || {}).label || p;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const w = document.getElementById('wn'); if (w && w.classList.contains('open')) R._closeWn(); } });

  // ---------- data (PostgREST) ----------
  R.apiBase = (C.API_URL || '').replace(/\/+$/, '') + '/';
  R.apiHeaders = () => C.API_KEY ? { Authorization: 'Bearer ' + C.API_KEY, apikey: C.API_KEY } : {};   // apikey only matters for Supabase
  R.fetchAll = async function (pathQuery) {
    const out = []; const page = 1000; let from = 0;
    for (;;) {
      const r = await fetch(R.apiBase + pathQuery, { headers: { ...R.apiHeaders(), Range: from + '-' + (from + page - 1), Prefer: 'count=none' } });
      if (!r.ok) { const e = new Error(r.status + ' on ' + pathQuery.split('?')[0]); e.status = r.status; throw e; }
      const rows = await r.json(); out.push(...rows);
      if (rows.length < page) return out;
      from += page;
    }
  };

  // ---------- AI marker ----------
  // R.ai({ model, input_tokens, output_tokens, cost_eur, label }) -> '<span class="ai">✦ AI</span>' with cost on hover.
  R.ai = function (u) {
    u = u || {};
    const tok = (u.input_tokens || 0) + (u.output_tokens || 0);
    const cost = u.cost_eur != null ? ' · ≈ € ' + (u.cost_eur < 0.01 ? '<0.01' : u.cost_eur.toFixed(2)) : '';
    const tip = (u.model ? u.model : 'AI') + (tok ? ' · ≈ ' + R.fmtK(tok) + ' tokens' : '') + cost + (u.at ? ' · ' + R.fmtDate(u.at) : '');
    return '<span class="ai" data-cost="' + esc(tip) + '"><span class="spark">✦</span>' + esc(u.label || 'AI') + '</span>';
  };

  // ---------- formatting ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  R.esc = esc;
  R.fmtDate = d => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? String(d) : String(x.getDate()).padStart(2, '0') + '.' + String(x.getMonth() + 1).padStart(2, '0') + '.' + x.getFullYear(); };
  R.fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(n);
  R.fmtNum = (n, d) => Number(n || 0).toLocaleString('de-AT', { maximumFractionDigits: d == null ? 0 : d });
  R.hs = (type, id) => 'https://app.hubspot.com/contacts/' + (C.HUBSPOT_PORTAL || '') + '/record/' + type + '/' + id;

  // ---------- helpers carried over from v1 (time, metrics, tables, quarter filters, tiny charts) ----------
  // ---- time ----
  const DAY = 86400000;
  R.isoWeek = function (dateStr) {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = (dt.getUTCDay() + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - day + 3);
    const ft = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
    const fd = (ft.getUTCDay() + 6) % 7;
    ft.setUTCDate(ft.getUTCDate() - fd + 3);
    return dt.getUTCFullYear() + '-W' + String(1 + Math.round((dt - ft) / (7 * DAY))).padStart(2, '0');
  };
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  R.periodOf = function (dateStr, gran) {
    const ds = dateStr.slice(0, 10);
    const [y, m, d] = ds.split('-').map(Number);
    if (gran === 'monthly') return { key: ds.slice(0, 7), label: MON[m - 1] + ' ' + y };
    if (gran === 'quarterly') { const q = Math.floor((m - 1) / 3) + 1; return { key: y + '-Q' + q, label: 'Q' + q + ' ' + y }; }
    if (gran === 'yearly') return { key: String(y), label: String(y) };
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
    const lb = String(dt.getUTCDate()).padStart(2, '0') + '.' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '.' + dt.getUTCFullYear();
    return { key: R.isoWeek(ds), label: lb };
  };
  R.fmtDate = ds => { if (!ds) return ''; const [y, m, d] = ds.slice(0, 10).split('-'); return d + '.' + m + '.' + y; };
  R.daysAgoIso = n => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
  R.pct = (a, b) => b ? Math.round(1000 * a / b) / 10 + '%' : '—';
  R.num = n => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('de-AT');
  R.eur = n => (n === null || n === undefined || n === '') ? '—' : '€ ' + Math.round(Number(n)).toLocaleString('de-AT');
  R.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  R.hs = (type, id) => 'https://app.hubspot.com/contacts/' + C.HUBSPOT_PORTAL + '/record/' + type + '/' + id;
  R.runMeta = function (runLogRow, onReload) {
    const el = document.getElementById('runmeta');
    if (!el) return;
    const btn = '<button class="btn" id="reloadbtn" title="Re-fetch everything from the database">↻ Refresh data</button>';
    el.innerHTML = (runLogRow
      ? '<div>Last run <strong>' + runLogRow.run_ts.slice(0, 16).replace('T', ' ') + '</strong> · ' +
        runLogRow.mode + ' · ' + runLogRow.entries_upserted + ' entries · ' + runLogRow.restatements + ' restated</div>'
      : '<div>No runs logged yet</div>') + btn;
    document.getElementById('reloadbtn').onclick = onReload;
  };

  // ---- ui bits ----
  R.metrics = function (el, items) {
    el.innerHTML = items.map(m =>
      '<div class="metric"><div class="label">' + R.esc(m.label) + '</div><div class="val' +
      (m.warn ? ' warn' : '') + (m.good ? ' good' : '') + '">' + m.val + '</div></div>').join('');
  };
  R.badge = (txt, cls) => '<span class="badge ' + cls + '">' + R.esc(txt) + '</span>';
  // Owner quick-filter pills (Customer Success pages). owners: array of names; current: '' = all.
  R.ownerPills = function (el, owners, current, cb) {
    el.innerHTML = ['', ...owners].map(o =>
      '<button class="opill' + (o === current ? ' on' : '') + '" data-o="' + R.esc(o) + '">' +
      (o ? R.esc(o) : 'All owners') + '</button>').join('');
    el.querySelectorAll('.opill').forEach(b => b.onclick = () => cb(b.dataset.o));
  };
  R.initials = n => String(n || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
  // ---- quarter range filters (v27) ----
  R.quarterBounds = function (offset) {
    const now = new Date();
    const qi = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3) + (offset || 0);
    const y = Math.floor(qi / 4), q = qi - y * 4;
    const p = n => String(n + 1).padStart(2, '0');
    return { from: y + '-' + p(q * 3) + '-01',
             to: (q === 3 ? (y + 1) + '-01' : y + '-' + p(q * 3 + 3)) + '-01',
             label: y + '-Q' + (q + 1) };
  };
  R.rangeTest = function (val) {
    if (!val || val === '0') return () => true;
    if (val === 'tq' || val === 'lq' || val === 'nq') {
      const b = R.quarterBounds(val === 'tq' ? 0 : val === 'lq' ? -1 : 1);
      return d => { if (!d) return false; const x = String(d).slice(0, 10); return x >= b.from && x < b.to; };
    }
    const cut = Date.now() - Number(val) * 86400000;
    return d => !!d && Date.parse(d) >= cut;
  };
  R.overlapTest = function (val) {  // for span rows (first/last send): does the span touch the range?
    if (val === 'tq' || val === 'lq' || val === 'nq') {
      const b = R.quarterBounds(val === 'tq' ? 0 : val === 'lq' ? -1 : 1);
      return (s, e) => { s = String(s || e || '').slice(0, 10); e = String(e || s || '').slice(0, 10);
        return !!s && s < b.to && e >= b.from; };
    }
    const t = R.rangeTest(val);
    return (s, e) => t(e || s);
  };
  R.rangeLabel = function (val) {
    if (!val || val === '0') return '';
    if (val === 'tq') return R.quarterBounds(0).label;
    if (val === 'lq') return R.quarterBounds(-1).label;
    if (val === 'nq') return R.quarterBounds(1).label;
    return 'last ' + val + 'd';
  };
  R.quarterOptions = function (sel, withNext) {
    if (!sel || sel.dataset.q) return; sel.dataset.q = '1';
    const keep = sel.value;
    const defs = [['tq', 'This quarter (' + R.quarterBounds(0).label + ')'],
                  ['lq', 'Last quarter (' + R.quarterBounds(-1).label + ')']];
    if (withNext) defs.push(['nq', 'Next quarter (' + R.quarterBounds(1).label + ')']);
    defs.reverse().forEach(([v, t]) => { const o = document.createElement('option');
      o.value = v; o.textContent = t; sel.insertBefore(o, sel.firstChild); });
    sel.value = keep;
  };
  R.errState = function (el, err) {
    el.className = 'state err';
    el.innerHTML = 'Build ' + C.BUILD + ': could not load data (' + R.esc(err.message) + '). ' +
      (err.status === 401 || err.status === 403 || err.status === 404
        ? 'If this table/view is new, run the SQL from <code>sql/reporting-views.sql</code> in Supabase (it also sets the read policies).' : '');
  };
  R.pendingState = function (el, opts) {
    el.innerHTML = '<div class="pending"><div class="pill">Data pipeline pending</div><h3>' + R.esc(opts.title) + '</h3>' +
      '<p>' + opts.text + '</p><p>This page reads <code>' + R.esc(opts.view) + '</code> and lights up automatically once the n8n workflow fills it — no page changes needed.</p></div>';
  };
  // A view exists but is empty vs missing: 404/42P01 -> pending, [] -> empty
  R.loadViewOrPending = async function (query, container, pendingOpts) {
    try { return await R.fetchAll(query); }
    catch (err) {
      if (err.status === 404) { R.pendingState(container, pendingOpts); return null; }
      R.errState(container, err); return null;
    }
  };

  // ---- sortable table ----
  R.table = function (el, cols, rows, opts) {
    opts = opts || {};
    let sort = opts.sort || { key: cols[0].key, dir: -1 };
    function render() {
      const sc = cols.find(c => c.key === sort.key) || cols[0];
      const sorted = [...rows].sort((a, b) => {
        const va = sc.sortVal ? sc.sortVal(a) : a[sc.key], vb = sc.sortVal ? sc.sortVal(b) : b[sc.key];
        if (va == null) return 1; if (vb == null) return -1;
        return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))) * sort.dir;
      });
      let h = '<table class="data"><tr>' + cols.map(c =>
        '<th class="' + (c.num ? 'num' : '') + '" data-k="' + c.key + '">' + c.label +
        (sort.key === c.key ? '<span class="dir">' + (sort.dir === 1 ? '↑' : '↓') + '</span>' : '') + '</th>').join('') + '</tr>';
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        h += '<tr' + (opts.rowClick ? ' class="clickable" data-i="' + i + '"' : '') + '>' +
          cols.map(c => '<td class="' + (c.num ? 'num' : '') + '">' + c.cell(r) + '</td>').join('') + '</tr>';
      }
      el.innerHTML = h + '</table>' + (rows.length === 0 ? '<div class="empty">Nothing matches the current filters.</div>' : '');
      el.querySelectorAll('th').forEach(th => th.onclick = () => {
        const k = th.dataset.k;
        sort = { key: k, dir: sort.key === k ? -sort.dir : -1 };
        render();
      });
      if (opts.rowClick) el.querySelectorAll('tr.clickable').forEach(tr =>
        tr.onclick = () => opts.rowClick(sorted[Number(tr.dataset.i)], tr));
      if (opts.decorate) try { opts.decorate(el, sorted); } catch (e) { console.error('decorate', e); }
      return sorted;
    }
    return render();
  };

  // ---- goals & time ----
  R.quarter = function () {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 1);
    const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
    const pctGone = Math.min(100, Math.round(100 * (now - start) / (end - start)));
    return { label: now.getFullYear() + '-Q' + (q + 1), year: String(now.getFullYear()),
      startIso: start.toISOString().slice(0, 10), endIso: end.toISOString().slice(0, 10),
      daysLeft, pctGone };
  };
  R.goalBar = function (g) {
    const pct = g.target ? Math.min(100, Math.round(100 * g.actual / g.target)) : 0;
    return '<div class="goal"><div class="gl"><span>' + R.esc(g.label) + '</span><strong>' +
      R.num(g.actual) + ' / ' + R.num(g.target) + '</strong></div>' +
      '<div class="track"><div class="fill' + (pct >= 100 ? ' done' : '') + '" style="width:' + pct + '%"></div></div>' +
      '<div class="pctl">' + pct + '% of goal · ' + R.esc(g.period) + '</div></div>';
  };

  // ---- tiny charts ----
  R.barChart = function (values, labels, opts) {
    opts = opts || {};
    const W = opts.w || 560, H = opts.h || 150, pad = 18, lh = 14;
    const max = Math.max(1, ...values);
    const bw = Math.max(4, (W - pad) / values.length - 3);
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + lh) + '" preserveAspectRatio="none" style="max-height:' + (H + lh + 20) + 'px">';
    values.forEach((v, i) => {
      const h = Math.round((H - pad) * v / max);
      const x = Math.round(pad / 2 + i * ((W - pad) / values.length));
      s += '<rect class="bar' + (opts.alt ? ' alt' : '') + '" x="' + x + '" y="' + (H - h) + '" width="' + bw + '" height="' + h + '"><title>' +
        R.esc((labels && labels[i]) || '') + ': ' + v + '</title></rect>';
      if (labels && (values.length <= 14 || i % Math.ceil(values.length / 14) === 0))
        s += '<text x="' + (x + bw / 2) + '" y="' + (H + 11) + '" text-anchor="middle">' + R.esc(String(labels[i])) + '</text>';
    });
    return s + '</svg>';
  };

  R.J_ICON = { call: ['📞','Cold call'], email: ['✉️','Outreach email'], reply: ['↩️','Replied'],
    download: ['📄','Website download'], form: ['📝','Contact form'], event: ['🎪','Event'],
    web: ['🌐','Website'], ads: ['💰','Paid ads'], social: ['📱','Social'], referral: ['🔗','Referral'] };
  R.srcKind = t => ({ ORGANIC_SEARCH:'web', DIRECT_TRAFFIC:'web', REFERRALS:'referral', SOCIAL_MEDIA:'social',
    ORGANIC_SOCIAL:'social', PAID_SEARCH:'ads', PAID_SOCIAL:'ads', EMAIL_MARKETING:'email' }[t] || null);
  R.journeyHTML = function(touches){
    const t = (touches || []).filter(x => x && x.kind && R.J_ICON[x.kind])
      .sort((a, b) => (a.ts || '') < (b.ts || '') ? -1 : 1);
    const seen = new Set();
    const uniq = t.filter(x => !seen.has(x.kind) && seen.add(x.kind)).slice(0, 5);
    if (!uniq.length) return '<span class="mini">—</span>';
    return '<span class="journey">' + uniq.map((x, i) => {
      const p = R.J_ICON[x.kind];
      return '<span class="' + (i === 0 ? 'j0' : 'jn') + '" title="' + p[1] +
        (x.ts ? ' · ' + R.fmtDate(x.ts) : '') + (x.note ? ' · ' + R.esc(String(x.note)) : '') + '">' + p[0] + '</span>';
    }).join('<span class="jarr">→</span>') + '</span>';
  };
})();
