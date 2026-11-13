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
      { key: 'funnel', label: 'Full funnel', href: BASE + 'funnel/', ic: 'funnel', status: 'live' },
      { key: 'changes', label: 'Change notes', href: BASE + 'changes/', ic: 'list', status: 'live' } ] },
    { key: 'marketing', label: 'Marketing', color: '#9DDCFF', items: [
      { key: 'mkt-overview', label: 'Overview', href: BASE + 'marketing/', ic: 'grid', status: 'live' },
      { key: 'leads', label: 'Leads', href: BASE + 'marketing/leads/', ic: 'users', status: 'live' },
      { key: 'email', label: 'Email outreach', href: BASE + 'email-outreach/', ic: 'mail', status: 'live' },
      { key: 'linkedin', label: 'LinkedIn outreach', href: '#', ic: 'linkedin', status: 'planned' },
      { key: 'social', label: 'Social posts', href: '#', ic: 'chat', status: 'planned' },
      { key: 'campaigns', label: 'Campaigns & ads', href: '#', ic: 'megaphone', status: 'planned' },
      { key: 'responses', label: 'Responses', href: BASE + 'marketing/responses/', ic: 'reply', status: 'live' } ] },
    { key: 'bd', label: 'Business Development', color: '#F38C62', items: [
      { key: 'bd-overview', label: 'Overview', href: BASE + 'bd/', ic: 'grid', status: 'live' },
      { key: 'calls', label: 'Calls', href: BASE + 'bd/calls/', ic: 'phone', status: 'live' },
      { key: 'discoveries', label: 'Discoveries', href: BASE + 'bd/discoveries/', ic: 'calendar', status: 'live' },
      { key: 'journeys', label: 'Journeys', href: BASE + 'bd/journeys/', ic: 'route', status: 'live' },
      { key: 'celebrations', label: 'Celebration board', href: BASE + 'bd/celebrations/', ic: 'star', status: 'live' } ] },
    { key: 'sales', label: 'Sales pipeline', color: '#C4B5F0', items: [
      { key: 'sales-overview', label: 'Overview', href: BASE + 'sales/', ic: 'grid', status: 'live' },
      { key: 'qualification', label: 'Qualification', href: '#', ic: 'check', status: 'planned' },
      { key: 'deals', label: 'Deals', href: BASE + 'sales/deals/', ic: 'briefcase', status: 'live' },
      { key: 'forecast', label: 'Forecast', href: '#', ic: 'trend', status: 'planned' },
      { key: 'opp-meetings', label: 'Meetings', href: '#', ic: 'calendar', status: 'planned' },
      { key: 'quotes', label: 'Quote checker', href: BASE + 'sales/quote-checker/', ic: 'filecheck', status: 'live' },
      { key: 'sales-celebrations', label: 'Celebration board', href: BASE + 'sales/celebrations/', ic: 'star', status: 'live' } ] },
    { key: 'cs', label: 'Customer Success', color: '#8ED1B5', items: [
      { key: 'cs-overview', label: 'Overview', href: BASE + 'cs/', ic: 'grid', status: 'live' },
      { key: 'customers', label: 'Customers', href: BASE + 'cs/customers/', ic: 'building', status: 'live' },
      { key: 'renewals', label: 'Renewals & expansion', href: BASE + 'cs/renewals/', ic: 'refresh', status: 'live' },
      { key: 'tickets', label: 'Tickets', href: BASE + 'cs/tickets/', ic: 'ticket', status: 'live' },
      { key: 'projects', label: 'Projects', href: '#', ic: 'folder', status: 'planned' },
      { key: 'pocs', label: 'POCs & free trials', href: '#', ic: 'flask', status: 'planned' },
      { key: 'ps', label: 'Professional services', href: BASE + 'cs/professional-services/', ic: 'clock', status: 'live' },
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
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    bookmark: '<path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4-6 4v-16a1 1 0 0 1 1-1z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l2 2"/>'
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
    app.innerHTML = '<aside class="side" id="side"></aside><main class="main"><div class="topbar"><button class="burger" onclick="document.getElementById(\'side\').classList.toggle(\'open\')">☰</button><div class="ttl"><h1>' + esc(CUR.title || '') + '</h1>' + (CUR.subtitle ? '<div class="sub">' + esc(CUR.subtitle) + '</div>' : '') + '</div><div class="spacer"></div><div class="runmeta" id="runmeta"></div><div class="tools" id="tools">' + (C.ASK_WEBHOOK ? '<button class="tool askbtn" onclick="R.ask.open(null)" title="Ask a question about this page — the AI checks the data and the documentation">' + R.icon('sparkle') + ' Ask AI</button>' : '') + '<button class="tool" onclick="R.feedback.open()" title="Feedback, bug, idea…">✎ Feedback</button></div></div>' + (CUR.tabs ? '<div class="tabs" id="tabs">' + CUR.tabs.map(t => '<a href="' + BASE + t.href + '" class="' + (t.on ? 'on' : '') + '">' + esc(t.label) + '</a>').join('') + '</div>' : '') + '<div class="filters" id="filters" hidden></div><div id="page"></div></main>';
    document.getElementById('shell').replaceWith(app);
    document.body.insertAdjacentHTML('beforeend', '<div class="modal" id="fb-modal"></div>');
    renderNav();
    R.changes.load().then(renderNav);
    const page = document.getElementById('page');
    const pc = document.getElementById('page-content');          // ported v1 pages ship their own markup
    if (pc) { pc.hidden = false; page.appendChild(pc); }
    R.help.start();
    R.views.start();
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
  const TIME_OPTS = [['custom', 'Custom…'], ['week', 'This week'], ['lastweek', 'Last week'], ['month', 'This month'], ['lastmonth', 'Last month'], ['quarter', 'This quarter'], ['lastquarter', 'Last quarter'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['year', 'This year'], ['12m', 'Last 12 months']];
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
      case '7d': return r(utc(y, m, now.getUTCDate() - 7), utc(y, m, now.getUTCDate() + 1), 'Last 7 days');
      case '30d': return r(utc(y, m, now.getUTCDate() - 30), utc(y, m, now.getUTCDate() + 1), 'Last 30 days');
      case 'nextquarter': { const a = utc(y, q * 3 + 3, 1); return r(a, utc(y, q * 3 + 6, 1), 'Q' + (Math.floor(a.getUTCMonth() / 3) + 1) + ' ' + a.getUTCFullYear()); }
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
    // used by saved filters: read / replace the whole state of this bar
    R.views.native = { get: () => { const o = JSON.parse(JSON.stringify(st)); delete o.range; return o; },
      set: o => { Object.keys(o || {}).forEach(k => { if (k !== 'range' && k in st) st[k] = o[k]; }); draw(); emit(); } };
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
  // One source: the v2 database. 'v_deals?…' and 'api/v_deals?…' are the same thing.
  // Only if LEGACY_API_URL is set in config.js do names without 'api/' fall back to the old Supabase views.
  const base = u => (u || '').replace(/\/+$/, '') + '/';
  const auth = k => k ? { Authorization: 'Bearer ' + k, apikey: k } : {};
  R.source = pathQuery => /^api\//.test(pathQuery) || !C.LEGACY_API_URL
    ? { url: base(C.API_URL) + pathQuery.replace(/^api\//, ''), headers: auth(C.API_KEY) }
    : { url: base(C.LEGACY_API_URL) + pathQuery, headers: auth(C.LEGACY_API_KEY) };
  R.apiBase = base(C.LEGACY_API_URL || C.API_URL);
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

  // A customer needs attention when: cancellation period / licence ended without renewal / renewal without a deal,
  // usage over the contract, an unpaid add-on, or an open ticket. (Same rule as the "Needs attention" filter on Customers.)
  R.attention = c => {
    const why = [];
    if (['cancellation_period', 'ended_no_renewal', 'renewal_no_deal'].includes(c.status_code)) why.push(c.status_text || c.status_code.replace(/_/g, ' '));
    if (c.usage_flag === 'over') why.push('usage over contract');
    if (Number(c.unpaid_count) > 0) why.push(c.unpaid_count + ' feature' + (c.unpaid_count > 1 ? 's' : '') + ' used but not in contract');
    if (Number(c.open_tickets) > 0) why.push(c.open_tickets + ' open ticket' + (c.open_tickets > 1 ? 's' : ''));
    return why;
  };

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
    const el = document.getElementById('runmeta'); if (!el) return;
    el.innerHTML = (runLogRow ? '<span title="Last run of the lifecycle workflow: ' + esc(runLogRow.mode || '') + ', ' + esc(String(runLogRow.entries_upserted)) + ' entries, ' + esc(String(runLogRow.restatements)) + ' restated">Stages updated ' + R.fmtDate(runLogRow.run_ts) + ' ' + String(runLogRow.run_ts).slice(11, 16) + '</span>' : '') +
      '<button class="tool" id="reloadbtn" title="Load the data again">↻</button>';
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
  // ---- period picker for ported pages -------------------------------------------------------------
  // The value of a period <select> is a key of R.TIME_OPTS, 'all', or 'custom:FROM:TO'.
  // (Old v1 values still work: tq / lq / nq and a number of days.)
  const periodOf = val => {
    val = String(val == null ? '' : val);
    if (!val || val === 'all' || val === '0') return null;
    if (val === 'tq') return R.timeRange('quarter'); if (val === 'lq') return R.timeRange('lastquarter'); if (val === 'nq') return R.timeRange('nextquarter');
    if (val.indexOf('custom') === 0) { const p = val.split(':'); return p[1] && p[2] ? R.timeRange('custom', { from: p[1], to: p[2] }) : null; }
    if (/^\d+$/.test(val)) { const n = new Date(); return { from: iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - Number(val)))), to: '9999-12-31', label: 'Last ' + val + ' days' }; }
    return R.timeRange(val);
  };
  R.periodRange = periodOf;
  // opts.openEnd: keep everything after the period start (pages that also list upcoming items)
  R.rangeTest = function (val, opts) {
    const r = periodOf(val); if (!r) return () => true;
    const open = opts && opts.openEnd;
    return d => { if (!d) return false; const x = String(d).slice(0, 10); return x >= r.from && (open || x < r.to); };
  };
  R.overlapTest = function (val) {  // for rows with a start and an end (first / last send): does the span touch the period?
    const r = periodOf(val); if (!r) return () => true;
    return (st, en) => { st = String(st || en || '').slice(0, 10); en = String(en || st || '').slice(0, 10); return !!st && st < r.to && en >= r.from; };
  };
  R.rangeLabel = function (val) { const r = periodOf(val); return r ? r.label : ''; };
  R.rangeDays = function (val) { const r = periodOf(val); return r ? Math.max(1, Math.round((Math.min(Date.parse(r.to), Date.now() + DAY) - Date.parse(r.from)) / DAY)) : 0; };
  // Turns a v1 time <select> into the standard period picker (same options and look as R.filters).
  R.quarterOptions = function (sel, withNext) {
    if (!sel || sel.dataset.q) return; sel.dataset.q = '1';
    if (sel.dataset.default === undefined && !sel.closest('#filters')) sel.dataset.default = 'all';
    const key = 'period.' + (CUR.page || 'x') + '.' + sel.id;
    const opts = TIME_OPTS.slice(); if (withNext) opts.splice(7, 0, ['nextquarter', 'Next quarter']); opts.push(['all', 'All time']);
    let val = LS.get(key, null) || sel.dataset.default || 'all';
    sel.innerHTML = opts.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('');
    const cust = sel.querySelector('option[value="custom"]');
    const dates = document.createElement('span'); dates.className = 'f dates'; dates.hidden = true;
    dates.innerHTML = '<input type="date" aria-label="from"><span>→</span><input type="date" aria-label="to">';
    (sel.closest('.f') || sel).insertAdjacentElement('afterend', dates);
    const [from, to] = dates.querySelectorAll('input');
    if (String(val).indexOf('custom:') === 0) { const p = val.split(':'); from.value = p[1] || ''; to.value = p[2] || ''; cust.value = val; dates.hidden = false; }
    sel.value = val; if (sel.selectedIndex < 0) { sel.value = sel.dataset.default || 'all'; }
    // registered before the page's own listeners: a half-filled custom range does not re-render the page
    sel.addEventListener('change', e => {
      const isCustom = sel.value.indexOf('custom') === 0;
      dates.hidden = !isCustom;
      if (isCustom && !(from.value && to.value)) { e.stopImmediatePropagation(); from.focus(); return; }
      LS.set(key, sel.value);
    });
    const setCustom = () => { if (!(from.value && to.value)) return; cust.value = 'custom:' + from.value + ':' + to.value; sel.value = cust.value; sel.dispatchEvent(new Event('change')); };
    from.addEventListener('change', setCustom); to.addEventListener('change', setCustom);
    // used by saved filters
    sel._setPeriod = v => {
      v = String(v);
      if (v.indexOf('custom:') === 0) { const p = v.split(':'); from.value = p[1] || ''; to.value = p[2] || ''; cust.value = v; }
      if (![...sel.options].some(o => o.value === v)) return false;
      if (sel.value === v && LS.get(key, null) === v) return true;
      sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); return true;
    };
  };

  // ---- filter bar for ported pages -------------------------------------------------------------------
  // Moves the page's own controls into the standard bar under the page title: period first, then the other
  // filters, search last — same order, look and place on every page.
  //   cfg.period = { selectId: defaultKey }   cfg.labels = { controlId: 'Label' }   cfg.hints = { controlId: 'tooltip' }
  R.legacyFilters = function (cfg) {
    cfg = cfg || {};
    const pc = document.getElementById('page-content') || document.getElementById('page');
    const bar = document.getElementById('filters'); if (!bar || !pc) return;
    const olds = [...pc.querySelectorAll('.filters')]; if (!olds.length) return;
    bar.hidden = false; bar.classList.add('v1');
    const L = cfg.labels || {}, P = cfg.period || {}, H = cfg.hints || {};
    const wrap = (cls, label, node, tag) => {
      const w = document.createElement(tag || 'label'); w.className = 'f' + (cls ? ' ' + cls : '');
      if (label) { const sp = document.createElement('span'); sp.className = 'fl'; sp.textContent = label; w.appendChild(sp); }
      w.appendChild(node); return w;
    };
    const period = [], rest = [], search = [];
    olds.forEach(old => {
      [...old.children].forEach(el => {
        const id = el.id || '';
        el.removeAttribute('style');
        if (H[id]) el.title = H[id];
        if (el.tagName === 'SELECT') {
          const first = el.options[0];
          if (first && /:\s*(all|any|any time)\s*$/i.test(first.textContent)) first.textContent = 'All';
          if (P[id] !== undefined) { el.dataset.default = P[id]; period.push(wrap('per', L[id] || 'Period', el)); }
          else rest.push(wrap('', L[id] || '', el));
        } else if (el.matches('input[type=search]')) { if (!el.placeholder) el.placeholder = 'Search…'; search.push(wrap('search', '', el)); }
        else if (el.classList.contains('msel')) rest.push(wrap('', '', el, 'span'));
        else if (el.tagName === 'LABEL') { el.classList.add('f', 'raw'); rest.push(el); }
        else rest.push(wrap('raw', L[id] || '', el, 'span'));
      });
      old.remove();
    });
    period.concat(rest, search).forEach(n => bar.appendChild(n));
    // controls the page logic still reads but that make no sense on this page are kept out of sight
    (cfg.stash || []).forEach(id => { const el = document.getElementById(id); const w = el && (el.closest('.f') || el); if (w) w.hidden = true; });
    // every period select — in the bar or inside a chart card — becomes the standard picker
    Object.keys(P).forEach(id => { const el = document.getElementById(id); if (!el) return; if (!el.dataset.default) el.dataset.default = P[id]; R.quarterOptions(el, (cfg.next || []).includes(id)); });
  };

  // ---- filters that stay + saved filters -----------------------------------------------------------
  // 1) Whatever a user sets in the filter bar or in a chart's own drop-down stays that way on this page (per browser).
  // 2) "Saved filters" in the bar: name the current combination and get it back with one click. Own ones live in
  //    the browser; "Share with everyone" stores it in the database (api.saved_filters) so all users see it.
  R.views = (function () {
    const OFF = ['quotes', 'ps', 'me', 'changes'];
    const V = { native: null };
    const pk = () => CUR.help || CUR.page || 'x';
    const scopes = () => [document.getElementById('filters'), document.getElementById('page')].filter(Boolean);
    const all = sel => scopes().flatMap(s => [...s.querySelectorAll(sel)]).filter(el => !el.closest('.views') && !el.closest('[hidden]'));
    const inNative = el => V.native && el.closest('#filters') && !document.getElementById('filters').classList.contains('v1');
    const fire = (el, t) => el.dispatchEvent(new Event(t, { bubbles: true }));
    const mkey = el => el.id || el.dataset.key || el.dataset.k || '';
    let applying = false;

    function capture(withNative) {
      const c = {};
      all('select[id]').forEach(el => { if (!inNative(el)) c['s:' + el.id] = el.value; });
      all('#filters input[id]').forEach(el => {
        if (inNative(el) || el.type === 'date' || el.closest('.msel')) return;
        if (el.type === 'checkbox') c['b:' + el.id] = el.checked; else c['i:' + el.id] = el.value;
      });
      all('.msel').forEach(el => { const k = mkey(el); if (k && !inNative(el)) c['m:' + k] = [...el.querySelectorAll('input[type=checkbox]:checked')].map(x => x.value); });
      all('.opill.on').forEach(el => { const h = el.parentElement; if (h && h.id) c['p:' + h.id] = el.dataset.o || ''; });
      const st = { v: 1, c };
      if (withNative && V.native) st.n = V.native.get();
      return st;
    }
    // sets what can be set right now; returns how many controls are still waiting (options that arrive with the data)
    function applyOnce(st) {
      let wait = 0;
      Object.keys(st.c || {}).forEach(k => {
        const t = k[0], id = k.slice(2), val = st.c[k];
        if (t === 'm') {
          const el = all('.msel').find(x => mkey(x) === id); if (!el) { if (val.length) wait++; return; }
          const boxes = [...el.querySelectorAll('input[type=checkbox]')];
          const off = boxes.find(b => b.checked !== val.includes(b.value));
          if (off) { off.checked = !off.checked; fire(off, 'change'); wait++; return; }   // one at a time: pages redraw the list on every change
          if (val.some(v => !boxes.some(b => b.value === v))) wait++;
          return;
        }
        if (t === 'p') {
          const h = document.getElementById(id); const b = h && [...h.querySelectorAll('.opill')].find(x => (x.dataset.o || '') === val);
          if (!b) { if (val) wait++; return; }
          if (!b.classList.contains('on')) b.click();
          return;
        }
        const el = document.getElementById(id); if (!el || el.closest('[hidden]')) return;
        if (t === 's') {
          if (el._setPeriod) { if (!el._setPeriod(val)) wait++; return; }
          if (el.value === val) return;
          if (![...el.options].some(o => o.value === val)) { if (val) wait++; return; }
          el.value = val; fire(el, 'input'); fire(el, 'change');
        } else if (t === 'b') { if (el.checked !== !!val) el.click(); }
        else if (t === 'i') { if (el.value !== String(val)) { el.value = val; fire(el, 'input'); fire(el, 'change'); } }
      });
      return wait;
    }
    function apply(st, done) {
      if (!st) return;
      applying = true; let rounds = 0, timer = null, over = false;
      const stop = () => { if (over) return; over = true; applying = false; mo.disconnect(); clearTimeout(tmax); clearTimeout(timer); document.removeEventListener('pointerdown', user, true); done && done(); };
      const user = e => { if (e.isTrusted && scopes().some(s => s.contains(e.target))) stop(); };
      const step = () => { timer = null; if (over) return; rounds++; let w = 1; try { w = applyOnce(st); } catch (e) { w = 0; } if (!w || rounds > 80) stop(); };
      const mo = new MutationObserver(() => { if (!timer && !over) timer = setTimeout(step, 60); });
      scopes().forEach(s => mo.observe(s, { childList: true, subtree: true }));
      const tmax = setTimeout(stop, 15000);
      document.addEventListener('pointerdown', user, true);
      if (st.n && V.native) V.native.set(st.n);
      step();
    }

    // ---- stay as set ----
    let saveT = null;
    const remember = e => {
      if (applying || !scopes().some(s => s.contains(e.target)) || (e.target.closest && e.target.closest('.views'))) return;
      clearTimeout(saveT); saveT = setTimeout(() => { if (applying) return; const now = capture(true); if (JSON.stringify(now) !== JSON.stringify(LS.get('sticky.' + pk(), null))) { LS.set('sticky.' + pk(), now); setActive(''); } }, 250);
    };

    // ---- saved filters menu ----
    const mine = () => LS.get('views.' + pk(), []);
    let shared = null, sharedErr = false, msg = '';
    const setActive = n => { LS.set('view.' + pk(), n || ''); const b = document.querySelector('.views .vbtn span'); if (b) b.textContent = n ? 'Saved filters · ' + n : 'Saved filters'; };
    async function loadShared() {
      try { shared = await R.fetchAll('saved_filters?page=eq.' + encodeURIComponent(pk()) + '&order=name'); sharedErr = false; }
      catch (e) { shared = []; sharedErr = true; }
    }
    async function op(body) {
      // text/plain on purpose: a plain POST needs no CORS preflight (the proxy only answers GET preflights)
      const r = await fetch(R.source('rpc/filter_op').url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || ('error ' + r.status));
      return j;
    }
    function menu() {
      const pop = document.querySelector('.views .vpop'); if (!pop) return;
      const row = (v, i, sh) => '<div class="vrow"><button type="button" class="vname" data-i="' + i + '" data-sh="' + sh + '">' + esc(v.name) + (sh && v.created_by ? '<small>' + esc(v.created_by) + '</small>' : '') + '</button><button type="button" class="vdel" data-i="' + i + '" data-sh="' + sh + '" title="Delete">✕</button></div>';
      const my = mine();
      pop.innerHTML = '<div class="vsec">My filters</div>' + (my.length ? my.map((v, i) => row(v, i, 0)).join('') : '<div class="vempty">Nothing saved yet.</div>') +
        '<div class="vsec">Shared with everyone</div>' + (shared === null ? '<div class="vempty">Loading…</div>' : sharedErr ? '<div class="vempty">Shared filters cannot be loaded right now.</div>' : shared.length ? shared.map((v, i) => row(v, i, 1)).join('') : '<div class="vempty">Nothing shared yet.</div>') +
        '<form class="vsave"><div class="vsec">Save the current filters</div><input type="text" class="vnm" maxlength="60" placeholder="Name, e.g. My open deals" required>' +
        '<label class="vshare"><input type="checkbox" class="vsh"> Share with everyone</label><button class="btn primary" type="submit">Save</button></form>' +
        '<div class="vmsg">' + esc(msg) + '</div><button type="button" class="vreset">Reset this page to its default filters</button>';
      pop.querySelectorAll('.vname').forEach(b => b.onclick = () => {
        const v = (+b.dataset.sh ? shared : mine())[+b.dataset.i]; if (!v) return;
        toggle(false);
        apply(v.state, () => { LS.set('sticky.' + pk(), capture(true)); setActive(v.name); });
      });
      pop.querySelectorAll('.vdel').forEach(b => b.onclick = async () => {
        if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Delete?'; return; }
        const i = +b.dataset.i;
        try {
          if (+b.dataset.sh) { await op({ op: 'delete', id: shared[i].id }); await loadShared(); }
          else { const l = mine(); l.splice(i, 1); LS.set('views.' + pk(), l); }
          msg = 'Deleted.';
        } catch (e) { msg = 'Could not delete: ' + e.message; }
        menu();
      });
      pop.querySelector('.vsave').onsubmit = async e => {
        e.preventDefault();
        const name = pop.querySelector('.vnm').value.trim(), sh = pop.querySelector('.vsh').checked; if (!name) return;
        const state = capture(true);
        try {
          if (sh) { await op({ op: 'save', page: pk(), name, state, by: R.userName() || '' }); await loadShared(); msg = '“' + name + '” saved and shared with everyone.'; }
          else { const l = mine().filter(v => v.name.toLowerCase() !== name.toLowerCase()); l.push({ name, state }); l.sort((a, b) => a.name.localeCompare(b.name)); LS.set('views.' + pk(), l); msg = '“' + name + '” saved.'; }
          LS.set('sticky.' + pk(), state); setActive(name);
        } catch (err) { msg = 'Could not save: ' + err.message; }
        menu();
      };
      pop.querySelector('.vreset').onclick = () => {
        try { Object.keys(localStorage).forEach(k => { if (k === 'r2.sticky.' + pk() || k === 'r2.view.' + pk() || k === 'r2.filters.' + (CUR.page || 'x') || k.indexOf('r2.period.' + (CUR.page || 'x') + '.') === 0) localStorage.removeItem(k); }); } catch (e) {}
        location.reload();
      };
    }
    function toggle(open) {
      const w = document.querySelector('.views'); if (!w) return;
      const on = open === undefined ? !w.classList.contains('open') : open;
      w.classList.toggle('open', on);
      if (on) { msg = ''; menu(); if (shared === null) loadShared().then(menu); }
    }
    function button() {
      const bar = document.getElementById('filters'), tools = document.getElementById('tools'); if (!bar || !tools) return;
      let w = tools.querySelector('.views');
      if (!w) {
        w = document.createElement('span'); w.className = 'views';
        const act = LS.get('view.' + pk(), '');
        w.innerHTML = '<button type="button" class="tool vbtn" title="Save this filter combination or pick a saved one">' + R.icon('bookmark') + '<span>' + esc(act ? 'Saved filters · ' + act : 'Saved filters') + '</span></button><div class="vpop"></div>';
        tools.insertBefore(w, tools.firstChild);
        w.querySelector('.vbtn').onclick = e => { e.stopPropagation(); toggle(); };
        w.querySelector('.vpop').onclick = e => e.stopPropagation();
      }
      w.hidden = bar.hidden;
    }
    V.start = function () {
      if (OFF.includes(CUR.page)) return;
      ['change', 'input', 'click'].forEach(t => document.addEventListener(t, remember, true));
      document.addEventListener('click', () => toggle(false));
      document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
      const bar = document.getElementById('filters');
      if (bar) new MutationObserver(button).observe(bar, { attributes: true, attributeFilter: ['hidden'] });
      setTimeout(() => { button(); const st = LS.get('sticky.' + pk(), null); if (st) apply({ c: st.c }); }, 0);   // the native bar restores itself
    };
    V.capture = capture; V.apply = apply;
    return V;
  })();


  // ---- Ask AI ----------------------------------------------------------------------------------------
  // ✦ next to every explanation and "Ask AI" in the top bar. Two steps against the n8n workflow
  // "Reporting v2 — Ask AI": plan (what will be read, cost, time — the user confirms) and run (the answer).
  // Sent along: the page, the element the question is about, what is visible there, the filters and the
  // page's own explanations, so the AI knows what is meant.
  R.ask = (function () {
    let ctxEl = null, ctxI = -1, plan = null, busy = false, history = [];
    const md = t => esc(t || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n{2,}/).map(par => {
      const lines = par.split('\n');
      if (lines.every(l => /^\s*[-•]\s+/.test(l))) return '<ul>' + lines.map(l => '<li>' + l.replace(/^\s*[-•]\s+/, '') + '</li>').join('') + '</ul>';
      return '<p>' + lines.map(l => /^\s*[-•]\s+/.test(l) ? '• ' + l.replace(/^\s*[-•]\s+/, '') : l).join('<br>') + '</p>';
    }).join('');
    const cr = (n, eur) => n + ' credit' + (n === 1 ? '' : 's') + ' <span class="muted">(' + (Number(eur) || 0).toLocaleString('de-AT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ')</span>';
    function label(el) {
      if (!el) return '';
      return [...el.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && !/^(BUTTON|SELECT|INPUT)$/.test(n.tagName))).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    }
    function context() {
      const page = CUR.help || CUR.page, docs = (R.help.pages[page] || []).map(e => ({ m: e.m, calc: String(e.calc || '').replace(/<[^>]+>/g, ''), src: String((e.src && R.help.sources[e.src]) || e.src || '').replace(/<[^>]+>/g, ''), note: String(e.note || '').replace(/<[^>]+>/g, '') }));
      const filters = {};
      document.querySelectorAll('#filters .f').forEach(f => {
        if (f.closest('[hidden]') || f.classList.contains('views')) return;
        const l = (f.querySelector('.fl, span:first-child') || {}).textContent || '', sel = f.querySelector('select'), inp = f.querySelector('input[type=search], input[type=text]');
        const on = f.querySelector('.opill.on'), checks = [...f.querySelectorAll('input[type=checkbox]:checked')].map(c => (c.parentNode.textContent || c.value).trim());
        const v = sel ? (sel.options[sel.selectedIndex] || {}).text : inp ? inp.value : on ? on.textContent : checks.length ? checks.join(', ') : '';
        if (v && l) filters[l.trim()] = v.trim();
      });
      const period = Object.keys(filters).find(k => /period/i.test(k));
      let element = null;
      if (ctxEl) {
        const box = ctxEl.closest('.tile, .ccard, .card, .goal2, .metric, .kgroup, section, .mc') || ctxEl.parentNode;
        element = { label: label(ctxEl), kind: box.classList.contains('tile') ? 'number tile' : box.classList.contains('ccard') ? 'chart' : box.querySelector('table') ? 'table' : 'section',
          text: (box.innerText || '').replace(/[?✦]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 3000) };
        if (ctxI >= 0 && docs[ctxI]) element.definition = docs[ctxI];
      }
      return { page, page_title: CUR.title || '', url: location.pathname + location.search, period: period ? filters[period] : '', filters, element, docs, history: history.slice(-3) };
    }
    async function post(body) {
      const r = await fetch(C.ASK_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('The AI service did not answer (' + r.status + ').');
      const j = await r.json();
      if (!j || j.ok === false) throw new Error((j && j.error) || 'Something went wrong.');
      return j;
    }
    const el = () => document.getElementById('ask');
    function shell() {
      if (el()) return;
      document.body.insertAdjacentHTML('beforeend', '<div id="ask-bg"></div><aside id="ask" aria-label="Ask AI"></aside>');
      document.getElementById('ask-bg').onclick = close;
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && el().classList.contains('open') && !busy) close(); });
    }
    function draw(stage, extra) {
      const box = el(), lab = ctxEl ? label(ctxEl) : '';
      const thread = history.map(h => '<div class="aq">' + esc(h.q) + '</div><div class="aa">' + md(h.a) + (h.meta ? '<div class="ameta">' + h.meta + '</div>' : '') + '</div>').join('');
      box.innerHTML = '<div class="ah"><h3>' + R.icon('sparkle') + ' Ask AI</h3><button class="x" type="button" aria-label="Close">✕</button></div>' +
        '<div class="actx">About: <b>' + esc(lab || 'this page') + '</b> · ' + esc(CUR.title || '') + (lab ? ' <button type="button" class="aclr" title="Ask about the whole page instead">✕</button>' : '') + '</div>' +
        (thread ? '<div class="athread">' + thread + '</div>' : '') + (extra || '');
      box.querySelector('.ah .x').onclick = close;
      const clr = box.querySelector('.aclr'); if (clr) clr.onclick = () => { ctxEl = null; ctxI = -1; draw(stage, extra); wire(); };
    }
    function form(q) {
      return '<form class="aform"><textarea rows="3" maxlength="1500" placeholder="' + (history.length ? 'Ask a follow-up …' : 'e.g. “Why is this company in the list?” or “Which subject lines worked best with the subscription persona in the last 3 months?”') + '">' + esc(q || '') + '</textarea>' +
        '<div class="arow"><span class="small muted">The AI reads only the dashboard data. You see what it will read and what it costs before it answers.</span><button class="btn primary" type="submit">Check</button></div></form>';
    }
    function wire() {
      const f = el().querySelector('.aform'); if (!f) return;
      const ta = f.querySelector('textarea'); ta.focus();
      ta.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); f.requestSubmit(); } };
      f.onsubmit = e => { e.preventDefault(); const q = ta.value.trim(); if (q.length >= 3) doPlan(q); };
    }
    async function doPlan(q) {
      busy = true; draw('plan', '<div class="aq">' + esc(q) + '</div><div class="astate"><span class="spin">↻</span> Checking which data is needed …</div>');
      try {
        const p = await post({ step: 'plan', question: q, asked_by: R.userName() || '', context: context() });
        plan = Object.assign({ q }, p); busy = false;
        const reads = (p.reads || []).map(r => '<li>' + esc(r.what || '') + (r.error ? ' — <span class="bad">could not be read</span>' : ' — ' + R.num(r.rows) + ' row' + (r.rows === 1 ? '' : 's')) + '</li>').join('');
        let h = '<div class="aq">' + esc(q) + '</div><div class="aplan">';
        if (p.status === 'clarify') h += '<p><b>The AI needs one detail:</b> ' + esc(p.clarify || '') + '</p>';
        else if (p.status !== 'ok') h += '<p><b>This cannot be answered from the dashboard data.</b> ' + esc(p.issues || p.error || '') + '</p>';
        else {
          h += '<div class="al">Understood as</div><p>' + esc(p.understood || '') + '</p><div class="al">How</div><p>' + esc(p.plan || '') + '</p>' + (reads ? '<div class="al">Reads</div><ul>' + reads + '</ul>' : '') +
            (p.issues ? '<div class="awarn">' + R.icon('chat') + '<span><b>Limitation:</b> ' + esc(p.issues) + '</span></div>' : '') +
            (p.better_way ? '<div class="ahint2">' + R.icon('sparkle') + '<span><b>Better way:</b> ' + esc(p.better_way) + '</span></div>' : '') +
            '<div class="acost">Answering costs about <b>' + cr(p.estimate.credits, p.estimate.eur) + '</b> and takes about <b>' + p.estimate.seconds + ' s</b>.<span class="small muted"> Checking used ' + cr(p.plan_cost.credits, p.plan_cost.eur) + '. 1 credit = 1 cent.</span></div>' +
            '<div class="arow"><button class="btn" type="button" data-a="edit">Change question</button><button class="btn primary" type="button" data-a="go">Continue</button></div>';
        }
        h += '</div>';
        if (p.status !== 'ok') h += form(q);
        draw('plan', h); wire();
        const go = el().querySelector('[data-a="go"]'); if (go) { go.focus(); go.onclick = doRun; }
        const ed = el().querySelector('[data-a="edit"]'); if (ed) ed.onclick = () => { draw('ask', form(q)); wire(); };
      } catch (err) { busy = false; draw('ask', '<div class="aerr">' + esc(err.message) + '</div>' + form(q)); wire(); }
    }
    async function doRun() {
      const p = plan; if (!p) return;
      busy = true; draw('run', '<div class="aq">' + esc(p.q) + '</div><div class="astate"><span class="spin">↻</span> Reading the data and writing the answer … about ' + p.estimate.seconds + ' s</div>');
      try {
        const a = await post({ step: 'run', id: p.id }); busy = false;
        const meta = (a.basis ? '<div><b>Based on:</b> ' + esc(a.basis) + '</div>' : '') + (a.issue ? '<div class="bad"><b>Data issue:</b> ' + esc(a.issue) + '</div>' : '') + (a.suggestion ? '<div><b>Suggestion:</b> ' + esc(a.suggestion) + '</div>' : '') +
          '<div class="muted">Used ' + cr(a.cost.total_credits, a.cost.total_eur) + ' in total · ' + a.seconds + ' s</div>';
        history.push({ q: p.q, a: a.answer || '', meta });
        plan = null;
        draw('done', form('')); wire();
        const th = el().querySelector('.athread'); if (th) th.lastElementChild.scrollIntoView({ block: 'start' });
      } catch (err) { busy = false; draw('ask', '<div class="aerr">' + esc(err.message) + '</div>' + form(p.q)); wire(); }
    }
    function open(target, i) {
      shell();
      if (target !== undefined) { ctxEl = target || null; ctxI = i == null ? -1 : i; history = []; plan = null; }
      el().classList.add('open'); document.getElementById('ask-bg').classList.add('open');
      if (!busy) { draw('ask', form('')); wire(); }
    }
    function close() { if (!el()) return; el().classList.remove('open'); document.getElementById('ask-bg').classList.remove('open'); }
    return { open, close };
  })();

  // ---- "?" explanations ------------------------------------------------------------------------------
  // assets/help.js registers, per page, where each number comes from and how it is calculated:
  //   R.help.add('page-key', [{ m: 'start of the label', src: '…', calc: '…', note: '…' }, …])
  // Every heading and metric label on the page that starts with `m` gets a small "?" button.
  R.help = {
    pages: {}, sources: {},
    add(page, entries) { (this.pages[page] = this.pages[page] || []).push(...entries); },
    find(text) {
      const list = this.pages[CUR.help || CUR.page] || []; const t = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!t) return -1;
      let best = -1, len = 0;
      list.forEach((e, i) => { const m = String(e.m).toLowerCase(); if ((t.indexOf(m) === 0 || (e.any && t.indexOf(m) >= 0)) && m.length > len) { best = i; len = m.length; } });
      return best;
    },
    SEL: 'h2, h3, .sechead, .metric .label, .tile .k, .gh h2, .count .l, .goal .gl > span:first-child, .mc .mh b, [data-help]',
    decorate() {
      const root = document.getElementById('page'); if (!root) return;
      root.querySelectorAll(this.SEL).forEach(el => {
        if (el.querySelector(':scope > .q') || el.closest('.qpop')) return;
        const own = [...el.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && !/^(BUTTON|SELECT|INPUT)$/.test(n.tagName))).map(n => n.textContent).join(' ');
        const i = this.find(el.dataset.help || own); if (i < 0) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'q'; b.textContent = '?'; b.dataset.i = i;
        b.title = 'Where does this come from?'; b.setAttribute('aria-label', 'Where does this come from?');
        el.appendChild(b);
        if (C.ASK_WEBHOOK && !el.closest('#ask')) {
          const a = document.createElement('button'); a.type = 'button'; a.className = 'ai'; a.innerHTML = R.icon('sparkle'); a.dataset.i = i;
          a.title = 'Ask AI about this'; a.setAttribute('aria-label', 'Ask AI about this'); el.appendChild(a);
        }
      });
    },
    missing() {   // labels on the page without an explanation (used by the tests)
      const root = document.getElementById('page'); if (!root) return [];
      return [...root.querySelectorAll(this.SEL)].filter(el => !el.querySelector(':scope > .q') && el.offsetParent !== null).map(el => el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean);
    },
    open(btn) {
      this.close();
      const e = (this.pages[CUR.help || CUR.page] || [])[Number(btn.dataset.i)]; if (!e) return;
      const title = e.t || btn.parentNode.textContent.replace(/\?\s*$/, '').replace(/\s+/g, ' ').trim();
      const src = e.src && this.sources[e.src] ? this.sources[e.src] : e.src;
      const pop = document.createElement('div'); pop.className = 'qpop'; pop.id = 'qpop';
      pop.innerHTML = '<button class="x" aria-label="Close">✕</button><h4>' + esc(title) + '</h4>' +
        (e.calc ? '<div class="ql">How it is calculated</div><p>' + e.calc + '</p>' : '') +
        (src ? '<div class="ql">Where the data comes from</div><p>' + src + '</p>' : '') +
        (e.note ? '<div class="ql">Good to know</div><p>' + e.note + '</p>' : '');
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect(), w = Math.min(380, window.innerWidth - 24);
      pop.style.width = w + 'px';
      pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left - 20)) + window.scrollX + 'px';
      const below = r.bottom + 8 + pop.offsetHeight < window.innerHeight || r.top < pop.offsetHeight + 16;
      pop.style.top = (below ? r.bottom + 8 : r.top - pop.offsetHeight - 8) + window.scrollY + 'px';
      pop.querySelector('.x').onclick = () => this.close();
    },
    close() { const p = document.getElementById('qpop'); if (p) p.remove(); },
    start() {
      if (this._on) return; this._on = true;
      document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('button.q');
        if (b) { e.preventDefault(); e.stopPropagation(); this.open(b); return; }
        const a = e.target.closest && e.target.closest('button.ai');
        if (a && R.ask) { e.preventDefault(); e.stopPropagation(); this.close(); R.ask.open(a.parentNode, Number(a.dataset.i)); return; }
        if (!(e.target.closest && e.target.closest('#qpop'))) this.close();
      }, true);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
      let t = null; const run = () => { t = null; this.decorate(); };
      const root = document.getElementById('page');
      if (root) new MutationObserver(() => { if (!t) t = setTimeout(run, 120); }).observe(root, { childList: true, subtree: true });
      this.decorate();
    }
  };

  R.errState = function (el, err) {
    el.className = 'state err';
    el.innerHTML = 'Could not load the data (' + R.esc(err.message) + '). Please try again in a minute — if it stays like this, send a note via Feedback (build ' + R.esc(C.BUILD || '') + ').';
  };
  R.pendingState = function (el, opts) {
    el.innerHTML = '<div class="pending"><div class="pill">Data not connected yet</div><h3>' + R.esc(opts.title) + '</h3>' +
      '<p>' + opts.text + '</p><p>The page fills itself as soon as the data source <code>' + R.esc(opts.view) + '</code> exists — no change to the page needed.</p></div>';
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
    // dates written from the calendar values: toISOString() would shift local midnight into the previous day east of UTC
    const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return { label: now.getFullYear() + '-Q' + (q + 1), year: String(now.getFullYear()),
      startIso: ymd(start), endIso: ymd(end),
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

  R.C = C;
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
