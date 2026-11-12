/* JENTIS Reporting v2 — shared shell. Pages call R.shell({ page, title, subtitle }) then use R.filters / R.fetchAll / R.ai / R.fmt*.
   Navigation, filters, change notes, feedback, theme and the API client live here; nothing page-specific. */
(function () {
  const C = window.RCONFIG || {};
  const R = (window.R = { C });
  const BASE = C.SITE_BASE || '/';                       // '/v2/' or '/v2-staging/' or '/'
  const V1 = C.V1_URL || 'https://vibe-reports.jentis.info';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  R.esc = esc;

  // ---------- navigation: one section per owner of the commercial journey ----------
  // status: 'live' = v2 page in this repo · 'v1' = still served by v1 (opens there) · 'planned' = not built yet · 'embed' = v2 page wrapping v1 pages
  R.NAV = [
    { key: 'me', label: 'My page', color: '#FFFFFF', items: [
      { key: 'me', label: 'Hello', href: BASE + 'me/', ic: 'user', status: 'live', dynamic: 'hello' } ] },
    { key: 'overview', label: 'Overview', color: '#D5DEE6', items: [
      { key: 'overview', label: 'Commercial overview', href: BASE, ic: 'grid', status: 'live' },
      { key: 'funnel', label: 'Full funnel', href: BASE + 'funnel/', ic: 'funnel', status: 'embed' },
      { key: 'changes', label: 'Change notes', href: BASE + 'changes/', ic: 'list', status: 'live' } ] },
    { key: 'marketing', label: 'Marketing', color: '#9DDCFF', items: [
      { key: 'mkt-overview', label: 'Overview', href: BASE + 'marketing/', ic: 'grid', status: 'live' },
      { key: 'leads', label: 'Leads', href: V1 + '/leads/', ic: 'users', status: 'v1' },
      { key: 'email', label: 'Email outreach', href: BASE + 'email-outreach/', ic: 'mail', status: 'embed' },
      { key: 'linkedin', label: 'LinkedIn outreach', href: '#', ic: 'linkedin', status: 'planned' },
      { key: 'social', label: 'Social posts', href: '#', ic: 'chat', status: 'planned' },
      { key: 'campaigns', label: 'Campaigns & ads', href: '#', ic: 'megaphone', status: 'planned' },
      { key: 'responses', label: 'Responses', href: V1 + '/responded/', ic: 'reply', status: 'v1' } ] },
    { key: 'bd', label: 'Business Development', color: '#F38C62', items: [
      { key: 'bd-overview', label: 'Overview', href: BASE + 'bd/', ic: 'grid', status: 'live' },
      { key: 'calls', label: 'Calls', href: V1 + '/calls/', ic: 'phone', status: 'v1' },
      { key: 'discoveries', label: 'Discoveries', href: V1 + '/discoveries/', ic: 'calendar', status: 'v1' },
      { key: 'journeys', label: 'Journeys', href: V1 + '/journeys/', ic: 'route', status: 'v1' },
      { key: 'celebrations', label: 'Celebration board', href: BASE + 'bd/celebrations/', ic: 'star', status: 'live' } ] },
    { key: 'sales', label: 'Sales pipeline', color: '#C4B5F0', items: [
      { key: 'sales-overview', label: 'Overview', href: BASE + 'sales/', ic: 'grid', status: 'live' },
      { key: 'qualification', label: 'Qualification', href: '#', ic: 'check', status: 'planned' },
      { key: 'deals', label: 'Deals', href: V1 + '/deals/', ic: 'briefcase', status: 'v1' },
      { key: 'forecast', label: 'Forecast', href: '#', ic: 'trend', status: 'planned' },
      { key: 'opp-meetings', label: 'Meetings', href: '#', ic: 'calendar', status: 'planned' },
      { key: 'quotes', label: 'Quote checker', href: V1 + '/cs-quote-checker/', ic: 'filecheck', status: 'v1' },
      { key: 'sales-celebrations', label: 'Celebration board', href: BASE + 'sales/celebrations/', ic: 'star', status: 'live' } ] },
    { key: 'cs', label: 'Customer Success', color: '#8ED1B5', items: [
      { key: 'cs-overview', label: 'Overview', href: BASE + 'cs/', ic: 'grid', status: 'live' },
      { key: 'customers', label: 'Customers', href: V1 + '/cs-customers/', ic: 'building', status: 'v1' },
      { key: 'renewals', label: 'Renewals & expansion', href: V1 + '/cs-renewals/', ic: 'refresh', status: 'v1' },
      { key: 'tickets', label: 'Tickets', href: V1 + '/cs-tickets/', ic: 'ticket', status: 'v1' },
      { key: 'projects', label: 'Projects', href: '#', ic: 'folder', status: 'planned' },
      { key: 'pocs', label: 'POCs & free trials', href: '#', ic: 'flask', status: 'planned' },
      { key: 'ps', label: 'Professional services', href: BASE + 'cs/professional-services/', ic: 'clock', status: 'embed' },
      { key: 'cs-celebrations', label: 'Celebration board', href: BASE + 'cs/celebrations/', ic: 'star', status: 'live' } ] },
    { key: 'partners', label: 'Partners', color: '#E8C9A0', items: [
      { key: 'partner-overview', label: 'Overview', href: '#', ic: 'grid', status: 'planned' },
      { key: 'partner-ps', label: 'Services at partners', href: '#', ic: 'clock', status: 'planned' },
      { key: 'partner-pipeline', label: 'Partner-sourced pipeline', href: '#', ic: 'layers', status: 'planned' } ] },
    { key: 'knowledge', label: 'Knowledge', color: '#C9CFE8', items: [
      { key: 'library', label: 'Library', href: '#', ic: 'book', status: 'planned' },
      { key: 'assistant', label: 'Ask the docs', href: '#', ic: 'sparkle', status: 'planned' } ] },
    { key: 'data', label: 'Data & AI', color: '#A9B6C2', items: [
      { key: 'ai-spend', label: 'AI spend', href: '#', ic: 'coin', status: 'planned' },
      { key: 'sync', label: 'Sync status', href: '#', ic: 'sync', status: 'planned' } ] },
  ];

  // ---------- icons (one line set, 24×24, stroke = currentColor) ----------
  const ICONS = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    funnel: '<path d="M3.5 5h17l-6.5 7.5V18l-4 2v-7.5z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.6a3.3 3.3 0 0 1 0 6.6M21.5 20c-.5-2.6-1.9-4.4-4-5.2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V17M8 7.2v.01M12 17v-6.5M12 13.5a2.5 2.5 0 0 1 5 0V17"/>',
    chat: '<path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z"/>',
    megaphone: '<path d="M3.5 10v4l11 5V5zM14.5 8.5a3.5 3.5 0 0 1 0 7M7 15.5V20h3v-3.2"/>',
    reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5V20"/>',
    phone: '<path d="M5 3.5h3.5l2 5-2.5 1.6a11 11 0 0 0 5.9 5.9l1.6-2.5 5 2V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.3 4.6-4.8"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7M3 12.5h18"/>',
    trend: '<path d="m3.5 17 6-6 4 4 7-7.5"/><path d="M15 7.5h5.5V13"/>',
    filecheck: '<path d="M14 3H6.5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5z"/><path d="M14 3v5.5h5.5M9 15l2 2 4-4"/>',
    building: '<rect x="4.5" y="3" width="15" height="18" rx="1.5"/><path d="M9 7.5h.01M15 7.5h.01M9 11.5h.01M15 11.5h.01M9 15.5h.01M15 15.5h.01M10.5 21v-2.5h3V21"/>',
    refresh: '<path d="M19.5 10.5A7.8 7.8 0 0 0 5.3 7.5M4.5 3.5v4h4M4.5 13.5a7.8 7.8 0 0 0 14.2 3M19.5 20.5v-4h-4"/>',
    ticket: '<path d="M3.5 7.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V10a2 2 0 0 0 0 4v2.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V14a2 2 0 0 0 0-4z"/><path d="M14 5.5v13" stroke-dasharray="2 2.2"/>',
    folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    flask: '<path d="M9.5 3h5M10.5 3v6L5 18.3A1.8 1.8 0 0 0 6.6 21h10.8a1.8 1.8 0 0 0 1.6-2.7L13.5 9V3M7.5 15h9"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    layers: '<path d="m12 3.5-8.5 4.8 8.5 4.8 8.5-4.8z"/><path d="m3.5 12.6 8.5 4.8 8.5-4.8"/>',
    book: '<path d="M4.5 5.5a2.5 2.5 0 0 1 2.5-2.5h12.5v15H7a2.5 2.5 0 0 0-2.5 2.5zM4.5 20.5A2.5 2.5 0 0 1 7 18h12.5v3H7"/>',
    sparkle: '<path d="m12 3.5 1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16v4M16.5 18h4"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M15 9.2a3.5 3.5 0 1 0 0 5.6M7.8 11h5M7.8 13h5"/>',
    sync: '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6l2.5 2.5"/><path d="M20.5 3.5v5h-5"/>',
    out: '<path d="M8 16 16 8M9.5 8H16v6.5"/>',
    chev: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'
  };
  R.icon = (name, cls) => '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';

  R.DEPT_COLOR = Object.fromEntries(R.NAV.map(s => [s.key, s.color]));
  R.userName = v => v === undefined ? LS.get('user.name', '') : LS.set('user.name', v);
  R.navItem = key => { for (const s of R.NAV) { const it = s.items.find(i => i.key === key); if (it) return { ...it, section: s }; } return null; };

  // ---------- per-user state (localStorage until SSO + app.settings) ----------
  const LS = { get: (k, d) => { try { const v = localStorage.getItem('r2.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
               set: (k, v) => { try { localStorage.setItem('r2.' + k, JSON.stringify(v)); } catch (e) {} } };
  R.pref = (k, v) => v === undefined ? LS.get(k) : LS.set(k, v);
  const applyTheme = t => { if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme'); };
  applyTheme(LS.get('theme', window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  R.toggleTheme = () => { const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; LS.set('theme', t); applyTheme(t); renderNav(); };

  // ---------- change notes ----------
  // docs/changelog.json: [{ version, date, title, items: [{ section, page, summary, details, departments: [...] }] }], newest first.
  let CHANGES = [];
  R.changes = {
    list: () => CHANGES,
    seen: () => LS.get('seenVersion', ''),
    isUnread: r => { const s = R.changes.seen(); return !s || r.version > s; },
    unread: () => CHANGES.filter(r => R.changes.isUnread(r)),
    markSeen: () => { if (CHANGES[0]) LS.set('seenVersion', CHANGES[0].version); renderNav(); },
    load: () => fetch(C.ASSET_BASE + 'changelog.json?b=' + encodeURIComponent(C.BUILD || '')).then(r => r.ok ? r.json() : []).then(j => { CHANGES = Array.isArray(j) ? j : []; return CHANGES; }).catch(() => CHANGES)
  };
  const unreadFor = (section, page) => R.changes.unread().flatMap(r => r.items.filter(i => i.section === section && (!page || i.page === page)).map(i => i.summary || i.text));

  // ---------- shell ----------
  let CUR = {};
  R.shell = function (opts) {
    CUR = opts || {};
    document.title = (CUR.title ? CUR.title + ' · ' : '') + 'JENTIS Reporting';
    const app = document.createElement('div'); app.className = 'app';
    app.innerHTML = '<aside class="side" id="side"></aside><main class="main"><div class="topbar"><button class="burger" onclick="document.getElementById(\'side\').classList.toggle(\'open\')">☰</button><div class="ttl"><h1>' + esc(CUR.title || '') + '</h1>' + (CUR.subtitle ? '<div class="sub">' + esc(CUR.subtitle) + '</div>' : '') + '</div><div class="spacer"></div><div class="tools" id="tools"><button class="tool" onclick="R.feedback.open()" title="Feedback, bug, idea…">✎ Feedback</button></div></div><div class="filters" id="filters" hidden></div><div id="page"></div></main>';
    document.getElementById('shell').replaceWith(app);
    document.body.insertAdjacentHTML('beforeend', '<div class="modal" id="fb-modal"></div>');
    renderNav();
    R.changes.load().then(renderNav);
    const page = document.getElementById('page');
    const pc = document.getElementById('page-content');          // ported v1 pages ship their own markup
    if (pc) { pc.hidden = false; page.appendChild(pc); }
    return page;
  };

  function renderNav() {
    const side = document.getElementById('side'); if (!side) return;
    const closed = LS.get('closedSections', []);
    const n = R.changes.unread().length;
    const nm = R.userName(), first = nm ? nm.split(' ')[0] : '';
    const initials = nm ? nm.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() : '';
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const me = R.NAV.find(s => s.key === 'me').items[0];
    side.innerHTML =
      '<div class="brand"><img src="' + C.ASSET_BASE + 'jentis-logo-white.png" alt="JENTIS"><span class="name">Reporting</span></div>' +
      '<a class="me' + (CUR.page === 'me' ? ' active' : '') + '" href="' + me.href + '"><span class="av">' + (initials ? esc(initials) : R.icon('user')) + '</span><span class="who"><b>' + (first ? 'Hello ' + esc(first) : 'Hello') + '</b><small>My page</small></span></a>' +
      '<nav class="nav">' +
      R.NAV.filter(s => s.key !== 'me').map(s => {
        const secNew = unreadFor(s.key).length;
        return '<div class="sec' + (closed.includes(s.key) ? ' closed' : '') + '"><button class="hd" onclick="R._toggleSec(\'' + s.key + '\')">' + esc(s.label) + (secNew ? '<span class="dot" title="new"></span>' : '') + R.icon('chev', 'car') + '</button><div class="items">' +
          s.items.map(it => {
            const hints = unreadFor(s.key, it.key);
            const active = CUR.page === it.key;
            const planned = it.status === 'planned';
            const tail = it.key === 'changes' && n ? '<span class="count">' + n + '</span>'
              : hints.length ? '<span class="dot" title="new"></span>'
              : it.status === 'v1' ? '<span class="tail" title="Opens the current dashboard (v1) in a new tab">v1' + R.icon('out') + '</span>'
              : planned ? '<span class="tail">soon</span>' : '';
            const title = planned ? ' title="Coming soon"' : hints.length ? ' data-hint="' + esc(hints.join(' · ')) + '"' : '';
            return '<a href="' + (planned ? 'javascript:void 0' : it.href) + '" class="' + (active ? 'active ' : '') + (planned ? 'planned ' : '') + (hints.length ? 'hint-new' : '') + '"' + title + (it.status === 'v1' ? ' target="_blank" rel="noopener"' : '') + '>' + R.icon(it.ic) + '<span class="lb">' + esc(it.label) + '</span>' + tail + '</a>';
          }).join('') + '</div></div>';
      }).join('') + '</nav><div class="foot"><span>' + esc(C.BUILD || 'dev') + (C.ENV && C.ENV !== 'live' ? ' <span class="env">' + esc(C.ENV) + '</span>' : '') + '</span><button onclick="R.toggleTheme()" title="Light / dark">' + R.icon(dark ? 'sun' : 'moon') + '</button></div>';
  }
  R._toggleSec = key => { const c = LS.get('closedSections', []); LS.set('closedSections', c.includes(key) ? c.filter(k => k !== key) : [...c, key]); renderNav(); };

  // ---------- filters (same bar on every page: time range first, then page-specific controls) ----------
  // R.filters({ time: true, controls: [{ key, label, type: 'select'|'multi', options: [[value,label]…], value }], onChange(state) })
  const TIME_OPTS = [['custom', 'Custom…'], ['week', 'This week'], ['lastweek', 'Last week'], ['month', 'This month'], ['lastmonth', 'Last month'], ['quarter', 'This quarter'], ['lastquarter', 'Last quarter'], ['90d', 'Last 90 days'], ['year', 'This year'], ['12m', 'Last 12 months']];
  const iso = d => d.toISOString().slice(0, 10);
  const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
  R.TIME_OPTS = TIME_OPTS;
  R.timeRange = function (key, custom) {
    const now = new Date(), y = now.getUTCFullYear(), m = now.getUTCMonth(), q = Math.floor(m / 3);
    const dow = (now.getUTCDay() + 6) % 7, mon = utc(y, m, now.getUTCDate() - dow);
    const r = (a, b, label) => ({ from: iso(a), to: iso(b), label });                     // to = exclusive
    switch (key) {
      case 'week': return r(mon, utc(y, m, mon.getUTCDate() + 7), 'This week');
      case 'lastweek': return r(utc(y, m, mon.getUTCDate() - 7), mon, 'Last week');
      case 'month': return r(utc(y, m, 1), utc(y, m + 1, 1), 'This month');
      case 'lastmonth': return r(utc(y, m - 1, 1), utc(y, m, 1), 'Last month');
      case 'quarter': return r(utc(y, q * 3, 1), utc(y, q * 3 + 3, 1), 'Q' + (q + 1) + ' ' + y);
      case 'lastquarter': { const a = utc(y, q * 3 - 3, 1); return r(a, utc(y, q * 3, 1), 'Q' + (Math.floor(a.getUTCMonth() / 3) + 1) + ' ' + a.getUTCFullYear()); }
      case '90d': return r(utc(y, m, now.getUTCDate() - 90), utc(y, m, now.getUTCDate() + 1), 'Last 90 days');
      case 'year': return r(utc(y, 0, 1), utc(y + 1, 0, 1), String(y));
      case '12m': return r(utc(y, m - 12, now.getUTCDate()), utc(y, m, now.getUTCDate() + 1), 'Last 12 months');
      case 'next7': return r(utc(y, m, now.getUTCDate()), utc(y, m, now.getUTCDate() + 7), 'Next 7 days');
      case 'next30': return r(utc(y, m, now.getUTCDate()), utc(y, m, now.getUTCDate() + 30), 'Next 30 days');
      case 'next90': return r(utc(y, m, now.getUTCDate()), utc(y, m, now.getUTCDate() + 90), 'Next 90 days');
      case 'today': return r(utc(y, m, now.getUTCDate()), utc(y, m, now.getUTCDate() + 1), 'Today');
      default: { const a = custom && custom.from ? custom.from : iso(utc(y, m, 1)), b = custom && custom.to ? custom.to : iso(now); return { from: a, to: iso(utc(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10) + 1)), label: R.fmtDate(a) + ' – ' + R.fmtDate(b), custom: true }; }
    }
  };
  R.filters = function (spec) {
    const bar = document.getElementById('filters'); if (!bar) return {};
    const key = 'filters.' + (CUR.page || 'x');
    const st = Object.assign({ time: spec.defaultTime || 'quarter', custom: { from: '', to: '' } }, LS.get(key, {}));
    (spec.controls || []).forEach(c => { if (st[c.key] === undefined) st[c.key] = c.value !== undefined ? c.value : (c.type === 'multi' ? [] : ''); });
    const emit = () => { LS.set(key, st); st.range = R.timeRange(st.time, st.custom); spec.onChange && spec.onChange(st); };
    const draw = () => {
      bar.hidden = false;
      bar.innerHTML = (spec.time === false ? '' : '<label class="f"><span>Period</span><select id="f-time">' + TIME_OPTS.map(o => '<option value="' + o[0] + '"' + (st.time === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
        '<span class="f dates" id="f-dates"' + (st.time === 'custom' ? '' : ' hidden') + '><input type="date" id="f-from" value="' + esc(st.custom.from) + '"><span>→</span><input type="date" id="f-to" value="' + esc(st.custom.to) + '"></span>') +
        (spec.controls || []).map(c => c.type === 'multi'
          ? '<span class="f"><span>' + esc(c.label) + '</span><span class="msel" data-k="' + c.key + '"><button type="button" class="msel-btn">' + mselLabel(c, st[c.key]) + '</button><div class="msel-dd">' + c.options.map(o => '<label><input type="checkbox" value="' + esc(o[0]) + '"' + (st[c.key].includes(o[0]) ? ' checked' : '') + '> ' + esc(o[1]) + '</label>').join('') + '</div></span></span>'
          : '<label class="f"><span>' + esc(c.label) + '</span><select data-k="' + c.key + '">' + c.options.map(o => '<option value="' + esc(o[0]) + '"' + (st[c.key] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>').join('') +
        (spec.extraHtml || '');
      const t = bar.querySelector('#f-time');
      if (t) t.onchange = () => { st.time = t.value; bar.querySelector('#f-dates').hidden = st.time !== 'custom'; if (st.time !== 'custom' || (st.custom.from && st.custom.to)) emit(); };
      bar.querySelectorAll('#f-from,#f-to').forEach(i => i.onchange = () => { st.custom = { from: bar.querySelector('#f-from').value, to: bar.querySelector('#f-to').value }; if (st.custom.from && st.custom.to) emit(); });
      bar.querySelectorAll('select[data-k]').forEach(s => s.onchange = () => { st[s.dataset.k] = s.value; emit(); });
      bar.querySelectorAll('.msel').forEach(m => {
        const k = m.dataset.k, c = spec.controls.find(x => x.key === k);
        m.querySelector('.msel-btn').onclick = e => { e.stopPropagation(); bar.querySelectorAll('.msel.open').forEach(x => x !== m && x.classList.remove('open')); m.classList.toggle('open'); };
        m.querySelectorAll('input').forEach(cb => cb.onchange = () => { st[k] = [...m.querySelectorAll('input:checked')].map(x => x.value); m.querySelector('.msel-btn').textContent = mselLabel(c, st[k]); emit(); });
      });
    };
    document.addEventListener('click', () => bar.querySelectorAll('.msel.open').forEach(x => x.classList.remove('open')));
    draw(); st.range = R.timeRange(st.time, st.custom);
    return st;
  };
  const mselLabel = (c, v) => c.label + ': ' + (!v.length ? 'all' : v.length === 1 ? (c.options.find(o => o[0] === v[0]) || [v[0], v[0]])[1] : v.length + ' selected');

  // ---------- feedback (→ n8n webhook → Slack) ----------
  const TOPICS = [['bug', '🐞 Bug / wrong number'], ['data', '🧮 Data question'], ['idea', '💡 Idea / suggestion'], ['request', '➕ Feature request'], ['praise', '🎉 Praise'], ['other', '… Other']];
  R.feedback = {
    open() {
      const m = document.getElementById('fb-modal');
      const who = LS.get('user.name', '');
      m.innerHTML = '<div class="box"><h3>Feedback <button class="x" onclick="R.feedback.close()">✕</button></h3><p class="small muted">Goes to the reporting Slack channel with the page name. Problems, questions, ideas — all welcome.</p>' +
        '<label>Topic<select id="fb-topic">' + TOPICS.map(t => '<option value="' + t[0] + '">' + t[1] + '</option>').join('') + '</select></label>' +
        '<label>Your name<input id="fb-name" value="' + esc(who) + '" placeholder="so we know whom to ask back"></label>' +
        '<label>Message<textarea id="fb-text" rows="5" placeholder="What happened, what would you expect, what would help?"></textarea></label>' +
        '<div class="row"><span class="small muted">Page: ' + esc(CUR.title || CUR.page || '') + '</span><button class="btn primary" id="fb-send" onclick="R.feedback.send()">Send</button></div><div id="fb-msg" class="small"></div></div>';
      m.classList.add('open'); setTimeout(() => document.getElementById('fb-text').focus(), 50);
    },
    close() { document.getElementById('fb-modal').classList.remove('open'); },
    async send() {
      const g = id => document.getElementById(id);
      const payload = { topic: g('fb-topic').value, name: g('fb-name').value.trim(), text: g('fb-text').value.trim(), page: CUR.title || '', page_key: CUR.page || '', url: location.href, env: C.ENV || '', build: C.BUILD || '', theme: document.documentElement.getAttribute('data-theme') || 'light', ua: navigator.userAgent };
      if (!payload.text) { g('fb-msg').textContent = 'Please write a message.'; return; }
      if (!payload.name) { g('fb-msg').textContent = 'Please add your name.'; return; }
      LS.set('user.name', payload.name);
      g('fb-send').disabled = true; g('fb-msg').textContent = 'Sending…';
      try {
        if (!C.FEEDBACK_WEBHOOK) throw new Error('no FEEDBACK_WEBHOOK configured');
        const r = await fetch(C.FEEDBACK_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        g('fb-msg').textContent = 'Thanks — posted to Slack.'; setTimeout(R.feedback.close, 1200);
      } catch (e) { g('fb-msg').textContent = 'Could not send (' + e.message + ').'; g('fb-send').disabled = false; }
    }
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') R.feedback.close(); });

  // ---------- data (PostgREST / Supabase) ----------
  // Two sources while pages move over: 'api/<view>' → v2 database (self-hosted PostgREST), anything else → v1 views on Supabase.
  const base = u => (u || '').replace(/\/+$/, '') + '/';
  const auth = k => k ? { Authorization: 'Bearer ' + k, apikey: k } : {};
  R.source = pathQuery => /^api\//.test(pathQuery)
    ? { url: base(C.API_URL) + pathQuery.slice(4), headers: auth(C.API_KEY) }
    : { url: base(C.LEGACY_API_URL || C.API_URL) + pathQuery, headers: auth(C.LEGACY_API_KEY || C.API_KEY) };
  R.apiBase = base(C.LEGACY_API_URL || C.API_URL);           // kept for older page code
  R.apiHeaders = () => auth(C.LEGACY_API_KEY || C.API_KEY);
  R.fetchAll = async function (pathQuery) {
    const out = []; const page = 1000; let from = 0;
    const src = R.source(pathQuery);
    for (;;) {
      const r = await fetch(src.url, { headers: { ...src.headers, Range: from + '-' + (from + page - 1), Prefer: 'count=none' } });
      if (!r.ok) { const e = new Error(r.status + ' on ' + pathQuery.split('?')[0]); e.status = r.status; throw e; }
      const rows = await r.json(); out.push(...rows);
      if (rows.length < page) return out;
      from += page;
    }
  };

  // ---------- AI marker ----------
  R.ai = function (u) {
    u = u || {};
    const tok = (u.input_tokens || 0) + (u.output_tokens || 0);
    const cost = u.cost_eur != null ? ' · ≈ € ' + (u.cost_eur < 0.01 ? '<0.01' : Number(u.cost_eur).toFixed(2)) : '';
    const tip = (u.model || 'AI') + (tok ? ' · ≈ ' + R.fmtK(tok) + ' tokens' : '') + cost + (u.at ? ' · ' + R.fmtDate(u.at) : '');
    return '<span class="ai" data-cost="' + esc(tip) + '"><span class="spark">✦</span>' + esc(u.label || 'AI') + '</span>';
  };

  // ---------- small ui bits ----------
  R.kpi = (k, v, s, cls) => '<div class="tile"><div class="k">' + esc(k) + '</div><div class="v ' + (cls || '') + '">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
  R.delta = (now, prev) => prev ? '<span class="' + (now >= prev ? 'up' : 'down') + '">' + (now >= prev ? '▲' : '▼') + ' ' + Math.round(100 * (now - prev) / prev) + '%</span>' : '<span class="muted">·</span>';
  R.inRange = (d, range) => d && d.slice(0, 10) >= range.from && d.slice(0, 10) < range.to;
  R.prevRange = range => { const a = Date.parse(range.from), b = Date.parse(range.to); return { from: iso(new Date(a - (b - a))), to: range.from }; };
  R.fmtDate = d => { if (!d) return ''; const s = String(d); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4); const x = new Date(d); return isNaN(x) ? s : String(x.getDate()).padStart(2, '0') + '.' + String(x.getMonth() + 1).padStart(2, '0') + '.' + x.getFullYear(); };
  R.fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(n);

  // ---------- celebration boards (shared) ----------
  // cards: [{ em, title, what, when (YYYY-MM-DD or YYYY-Qn), cls: 'record'|'goal'|'win' }]; scope filter 'all' | 'quarter'
  R.celebBoard = function (el, cards) {
    const F = R.filters({ time: false, controls: [{ key: 'scope', label: 'Show', type: 'select', options: [['quarter', 'This quarter'], ['all', 'Everything']] }], onChange: s => draw(s) });
    const q = R.quarter ? R.quarter() : null;
    function draw(s) {
      const list = cards.filter(c => s.scope !== 'quarter' || !q || String(c.when).startsWith(q.label) || (q.startIso && /^\d{4}-\d{2}-\d{2}$/.test(c.when) && c.when >= q.startIso)).sort((a, b) => String(b.when).localeCompare(String(a.when)));
      el.innerHTML = list.length ? list.map(c => '<div class="celeb ' + (c.cls || 'win') + '"><div class="em">' + c.em + '</div><div class="t">' + esc(c.title) + '</div><div class="w">' + esc(c.what) + '</div><div class="d">' + esc(/^\d{4}-\d{2}-\d{2}$/.test(c.when) ? R.fmtDate(c.when) : c.when) + '</div></div>').join('') : '<div class="state">Nothing in this scope yet.</div>';
    }
    draw(F);
  };
  R.record = function (rows, keyF, valF, who) {   // best (max value) group of rows -> { key, who, value } or null
    const m = {}; for (const r of rows) { const k = keyF(r) + '|' + (who ? (who(r) || '?') : 'team'); m[k] = (m[k] || 0) + (valF ? valF(r) : 1); }
    let best = null; for (const [k, v] of Object.entries(m)) if (!best || v > best.v) best = { k, v };
    if (!best) return null; const [key, person] = best.k.split('|'); return { key, who: person, value: best.v };
  };

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
  R.daysAgoIso = n => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
  R.pct = (a, b) => b ? Math.round(1000 * a / b) / 10 + '%' : '—';
  R.num = n => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('de-AT');
  R.eur = n => (n === null || n === undefined || n === '') ? '—' : '€ ' + Math.round(Number(n)).toLocaleString('de-AT');
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
