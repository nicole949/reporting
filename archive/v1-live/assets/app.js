/* JENTIS Reporting — shared plumbing. Pages call R.* helpers. (v28: Customers page with usage, features, timeline + AI briefing · v28.1: logo + title link to the Overview · v30: Quote Checker tab in the CS sub-nav) */
(function () {
  const C = window.RCONFIG;
  const R = (window.R = {});
  R.C = C;

  // ---- data ----
  R.fetchAll = async function (pathQuery) {
    const out = []; const page = 1000; let from = 0;
    for (;;) {
      const r = await fetch(C.SUPABASE_URL + '/rest/v1/' + pathQuery, { headers: {
        apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + C.SUPABASE_ANON_KEY,
        Range: from + '-' + (from + page - 1), Prefer: 'count=none' } });
      if (!r.ok) { const e = new Error(r.status + ' on ' + pathQuery.split('?')[0]); e.status = r.status; throw e; }
      const rows = await r.json(); out.push(...rows);
      if (rows.length < page) return out;
      from += page;
    }
  };

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
  R.hs = (type, id) => 'https://app-eu1.hubspot.com/contacts/' + C.HUBSPOT_PORTAL + '/record/' + type + '/' + id;

  // ---- shell ----
  const NAV = [
    ['index', 'Overview', '../index.html'],
    ['leads', 'Leads', '../leads/index.html'],
    ['discoveries', 'Discoveries', '../discoveries/index.html'],
    ['deals', 'Deals', '../deals/index.html'],
    ['journeys', 'Journeys', '../journeys/index.html'],
    ['|', '', ''],
    ['responded', 'Responses', '../responded/index.html'],
    ['calls', 'Calls', '../calls/index.html'],
    ['sequences', 'Sequences', '../sequences/index.html'],
    ['subjects', 'Subject Lines', '../subjects/index.html'],
    ['|', '', ''],
    ['cs', 'Customer Success', '../cs-customers/index.html']   // CS overview page retired — Customers is the landing page
  ];
  // Customer Success sub-navigation (all folders sit one level deep, like every other report)
  R.CS_NAV = [
    ['cs-customers', 'Customers', '../cs-customers/index.html'],
    ['cs-meetings', 'Meetings', '../cs-meetings/index.html'],
    ['cs-renewals', 'Renewals', '../cs-renewals/index.html'],
    ['cs-tickets', 'Tickets', '../cs-tickets/index.html'],
    ['cs-capacity', 'Capacity', '../cs-capacity/index.html'],
    ['cs-quote-checker', 'Quote Checker', '../cs-quote-checker/index.html']
  ];
  R.shell = function (active, opts) {
    opts = opts || {};
    const mainActive = active.startsWith('cs') ? 'cs' : active;
    const nav = NAV.map(([id, label, href]) => id === '|'
      ? '<span class="navdiv"></span>'
      : '<a class="' + (id === mainActive ? 'active' : '') + '" href="' + (active === 'index' ? href.replace('../', '') : href) + '">' + label + '</a>').join('');
    const pre = active === 'index' ? '' : '../';
    let sub = '';
    if (opts.subnav) {
      sub = '<div class="subnav">' + opts.subnav.map(([id, label, href]) =>
        '<a class="' + (id === (opts.subActive || active) ? 'active' : '') + '" href="' + href + '">' + label + '</a>').join('') + '</div>';
    }
    document.getElementById('shell').innerHTML =
      '<div class="topbar"><a class="brand" href="' + pre + 'index.html" title="Back to the Overview" style="text-decoration:none;color:inherit"><img src="' + pre + 'assets/jentis-logo.svg" alt="JENTIS"><span class="app">JENTIS Reporting</span></a>' +
      '<nav class="reports">' + nav + '</nav><div class="topmeta">Build ' + C.BUILD + '</div></div>' + sub +
      '<div class="pagehead"><div><h1>' + R.esc(opts.title || '') + '</h1><div class="sub">' + R.esc(opts.subtitle || '') + '</div></div>' +
      '<div class="runmeta" id="runmeta"></div></div>';
    if (!active.startsWith('cs')) {
      const rm = document.getElementById('runmeta');
      rm.innerHTML = '<button class="btn" id="reloadbtn" title="Re-fetch everything from the database">↻ Refresh data</button>';
      document.getElementById('reloadbtn').onclick = () => { const u = new URL(location.href); u.searchParams.set('r', Date.now()); location.replace(u.toString()); };
    }
  };
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
