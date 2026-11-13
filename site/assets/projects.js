// projects.js — "Projects": a shared project list per overview page (tables app.projects + app.project_tasks).
// A project has a name, status, owner, timeframe, a description and subtasks; description and subtasks open as drop-downs.
//   R.projects({ el, scope: 'marketing', people: ['Name', …] })
(function () {
  const R = window.R, esc = R.esc;
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const STATUS = [['active', 'In progress'], ['blocked', 'Blocked'], ['planned', 'Planned'], ['on_hold', 'On hold'], ['idea', 'Idea'], ['done', 'Done']];
  const SL = Object.fromEntries(STATUS), ORDER = Object.fromEntries(STATUS.map((s, i) => [s[0], i]));
  const fd = s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' : '';
  const linkify = t => esc(t).replace(/https?:\/\/[^\s<>"']+/g, u => '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>');

  R.projects = function (opts) {
    const el = typeof opts.el === 'string' ? document.getElementById(opts.el) : opts.el, scope = opts.scope;
    let items = [], loaded = false, failed = false, showDone = false, editing = null, msg = '';
    const open = { sub: new Set(), desc: new Set() };            // which drop-downs are open (per project id)
    async function op(body) {
      const r = await fetch(R.source('rpc/project_op').url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || ('error ' + r.status));
      return j;
    }
    async function load() {
      try { items = await R.fetchAll('projects?scope=eq.' + encodeURIComponent(scope) + '&order=sort.asc'); failed = false; }
      catch (e) { failed = true; }
      loaded = true; draw();
    }
    const replace = p => { if (!p || !p.id) return; const i = items.findIndex(x => x.id === p.id); if (i >= 0) items[i] = p; else items.push(p); };

    function timeframe(p) {
      if (!p.start_date && !p.end_date) return '';
      const today = ymd(new Date()), late = p.status !== 'done' && p.end_date && p.end_date < today;
      const year = (p.end_date || p.start_date).slice(0, 4);
      const txt = (p.start_date ? fd(p.start_date) : 'until ') + (p.start_date && p.end_date ? ' – ' : '') + (p.end_date ? fd(p.end_date) : ' onwards') + year;
      let left = '';
      if (p.status !== 'done' && p.end_date && !late) { const d = Math.round((Date.parse(p.end_date) - Date.parse(today)) / 864e5); left = d === 0 ? ' · ends today' : ' · ' + d + ' day' + (d === 1 ? '' : 's') + ' left'; }
      return '<span class="chip' + (late ? ' late' : '') + '" title="Timeframe">' + R.icon('calendar') + txt + (late ? ' · overdue' : left) + '</span>';
    }
    function row(p) {
      const subs = p.subtasks || [], nd = subs.filter(s => s.done).length, so = open.sub.has(p.id), dop = open.desc.has(p.id);
      const pct = subs.length ? Math.round(100 * nd / subs.length) : 0;
      return '<li class="pj st-' + esc(p.status) + '" data-id="' + p.id + '">' +
        '<div class="pjtop">' +
          '<select class="pjst st-' + esc(p.status) + '" title="Change the status">' + STATUS.map(s => '<option value="' + s[0] + '"' + (s[0] === p.status ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select>' +
          '<span class="pjname">' + esc(p.name) + '</span>' +
          '<span class="tda"><button type="button" class="ed" title="Edit">' + R.icon('edit') + '</button><button type="button" class="del" title="Delete">✕</button></span>' +
        '</div>' +
        '<div class="tdmeta">' + (p.owner ? '<span class="chip" title="Owner">' + R.icon('user') + esc(p.owner) + '</span>' : '') + timeframe(p) +
          (subs.length ? '<span class="pjprog" title="' + nd + ' of ' + subs.length + ' subtasks done"><span class="tdbar' + (nd === subs.length ? ' done' : '') + '"><i style="width:' + pct + '%"></i></span>' + nd + '/' + subs.length + '</span>' : '') + '</div>' +
        '<div class="pjdd">' +
          '<button type="button" class="pjtg' + (so ? ' on' : '') + '" data-dd="sub">' + R.icon('chev', 'car') + 'Subtasks' + (subs.length ? ' <b>' + nd + '/' + subs.length + '</b>' : '') + '</button>' +
          '<button type="button" class="pjtg' + (dop ? ' on' : '') + '" data-dd="desc"' + (p.description ? '' : ' title="No description yet — open to add one"') + '>' + R.icon('chev', 'car') + 'Description' + (p.description ? '' : ' <span class="muted">· empty</span>') + '</button>' +
        '</div>' +
        (so ? '<div class="pjpanel pjsubs"><ul>' + subs.map(s => '<li data-t="' + s.id + '"' + (s.done ? ' class="done"' : '') + '>' +
            '<label class="tdc" title="' + (s.done ? 'Mark as open' : 'Mark as done') + '"><input type="checkbox"' + (s.done ? ' checked' : '') + '><span></span></label>' +
            '<span class="pjtt" title="' + (s.done && s.done_at ? 'done ' + esc(R.fmtDate(s.done_at)) + (s.done_by ? ' · ' + esc(s.done_by) : '') : 'Double-click to edit') + '">' + esc(s.title) + '</span>' +
            '<button type="button" class="tdel" title="Delete subtask">✕</button></li>').join('') + '</ul>' +
            '<form class="pjsadd"><input type="text" name="t" maxlength="300" placeholder="Add a subtask and press Enter"><button class="btn" type="submit">Add</button></form></div>' : '') +
        (dop ? '<div class="pjpanel pjdesc">' + (p.description ? '<div class="pjtext">' + linkify(p.description) + '</div>' : '<div class="small muted">No description yet.</div>') +
            '<button type="button" class="tool pjdesced">' + (p.description ? 'Edit description' : 'Add a description') + '</button></div>' : '') +
        '</li>';
    }
    function form() {
      const p = editing || {};
      return '<form class="pjform">' +
        '<div class="tdrow"><input type="text" name="name" maxlength="160" placeholder="Project name, e.g. “Find new calling tool”" value="' + esc(p.name || '') + '" required>' +
          '<select name="status">' + STATUS.map(s => '<option value="' + s[0] + '"' + (s[0] === (p.status || 'planned') ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select>' +
          '<input type="text" name="owner" list="pj-people" placeholder="Owner" value="' + esc(p.owner || '') + '" class="who"></div>' +
        '<div class="tdrow"><label>Start <input type="date" name="start_date" value="' + esc(p.start_date || '') + '"></label>' +
          '<label>End <input type="date" name="end_date" value="' + esc(p.end_date || '') + '"></label></div>' +
        '<textarea name="description" rows="3" maxlength="6000" placeholder="Description (optional): goal, scope, links…">' + esc(p.description || '') + '</textarea>' +
        '<div class="tdrow"><button class="btn primary" type="submit">' + (p.id ? 'Save' : 'Create project') + '</button><button class="btn" type="button" data-a="cancel">Cancel</button><span class="tdmsg">' + esc(msg) + '</span></div>' +
        '<datalist id="pj-people">' + (opts.people || []).map(n => '<option value="' + esc(n) + '">').join('') + '</datalist></form>';
    }
    function draw() {
      if (!el) return;
      const live = items.filter(p => p.status !== 'done').sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || String(a.end_date || '9999').localeCompare(String(b.end_date || '9999')) || a.sort - b.sort);
      const done = items.filter(p => p.status === 'done').sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || '')));
      el.className = 'kgroup projects';
      el.innerHTML = '<div class="gh"><h2>Projects</h2><span class="st">shared with everyone on this page</span><span style="margin-left:auto;display:flex;gap:.35rem">' +
          (done.length ? '<button type="button" class="tool pjshow">' + (showDone ? 'Hide' : 'Show') + ' done (' + done.length + ')</button>' : '') +
          (loaded && !failed && !editing ? '<button type="button" class="tool pjnew">+ New project</button>' : '') + '</span></div>' +
        (editing ? form() : '') +
        (failed ? '<div class="state">Projects cannot be loaded right now' + (R.C.ENV === 'live' ? '' : ' — the database part (sql/007_projects.sql) may not be applied yet') + '.</div>' : !loaded ? '<div class="state">Loading…</div>' :
          (live.length ? '<ul class="pjl">' + live.map(row).join('') + '</ul>' : (editing ? '' : '<div class="tdempty">No projects yet. Click “+ New project” — e.g. “Find new calling tool” or “Implement dashboard 2.0”, with owner, timeframe, subtasks and a description.</div>')) +
          (showDone && done.length ? '<div class="tdsec">Done</div><ul class="pjl">' + done.slice(0, 50).map(row).join('') + '</ul>' : '')) +
        (!editing && msg ? '<div class="tdmsg">' + esc(msg) + '</div>' : '');
      wire();
    }
    const fail = err => { msg = err.message; draw(); };
    function wire() {
      el.querySelectorAll('.pjshow').forEach(b => b.onclick = () => { showDone = !showDone; draw(); });
      el.querySelectorAll('.pjnew').forEach(b => b.onclick = () => { editing = { status: 'planned' }; msg = ''; draw(); el.querySelector('.pjform input[name="name"]').focus(); });
      const f = el.querySelector('.pjform');
      if (f) {
        f.querySelector('[data-a="cancel"]').onclick = () => { editing = null; msg = ''; draw(); };
        f.onsubmit = async e => {
          e.preventDefault();
          const body = { name: f.name.value.trim(), status: f.status.value, owner: f.owner.value.trim(), start_date: f.start_date.value || '', end_date: f.end_date.value || '', description: f.description.value };
          const keep = () => { editing = Object.assign({}, editing, body); draw(); };          // a refused entry keeps what was typed
          if (body.start_date && body.end_date && body.end_date < body.start_date) { msg = 'The end lies before the start.'; keep(); return; }
          try {
            const p = editing.id ? await op(Object.assign({ op: 'update', id: editing.id }, body)) : await op(Object.assign({ op: 'add', scope, by: R.userName() || '' }, body));
            replace(p); editing = null; msg = ''; draw();
          } catch (err) { msg = err.message; keep(); }
        };
      }
      el.querySelectorAll('li.pj').forEach(li => {
        const p = items.find(x => String(x.id) === li.dataset.id); if (!p) return;
        li.querySelector('.pjst').onchange = async e => { try { replace(await op({ op: 'update', id: p.id, status: e.target.value })); msg = ''; draw(); } catch (err) { fail(err); } };
        li.querySelector('.ed').onclick = () => { editing = p; msg = ''; draw(); el.querySelector('.pjform').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); el.querySelector('.pjform input[name="name"]').focus(); };
        const del = li.querySelector('.del');
        del.onclick = async () => {
          if (!del.classList.contains('sure')) { del.classList.add('sure'); del.textContent = 'Delete?'; setTimeout(() => { if (del.isConnected) { del.classList.remove('sure'); del.textContent = '✕'; } }, 4000); return; }
          try { await op({ op: 'delete', id: p.id }); items = items.filter(x => x.id !== p.id); if (editing && editing.id === p.id) editing = null; draw(); } catch (err) { fail(err); }
        };
        li.querySelectorAll('.pjtg').forEach(b => b.onclick = () => { const s = open[b.dataset.dd]; s.has(p.id) ? s.delete(p.id) : s.add(p.id); draw();
          if (b.dataset.dd === 'sub' && open.sub.has(p.id)) { const i = el.querySelector('li.pj[data-id="' + p.id + '"] .pjsadd input'); if (i && !(p.subtasks || []).length) i.focus(); } });
        const de = li.querySelector('.pjdesced'); if (de) de.onclick = () => { editing = p; msg = ''; draw(); const t = el.querySelector('.pjform textarea'); if (t) { t.focus(); t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } };
        const sf = li.querySelector('.pjsadd');
        if (sf) sf.onsubmit = async e => {
          e.preventDefault(); const t = sf.t.value.trim(); if (!t) return;
          try { replace(await op({ op: 'task_add', id: p.id, title: t })); msg = ''; draw(); const i = el.querySelector('li.pj[data-id="' + p.id + '"] .pjsadd input'); if (i) i.focus(); } catch (err) { fail(err); }
        };
        li.querySelectorAll('.pjsubs li[data-t]').forEach(tl => {
          const tid = +tl.dataset.t;
          tl.querySelector('input[type="checkbox"]').onchange = async e => { tl.classList.toggle('done', e.target.checked); try { replace(await op({ op: 'task_done', task_id: tid, done: e.target.checked, by: R.userName() || '' })); draw(); } catch (err) { fail(err); } };
          tl.querySelector('.tdel').onclick = async () => { try { replace(await op({ op: 'task_delete', task_id: tid })); draw(); } catch (err) { fail(err); } };
          const tt = tl.querySelector('.pjtt');
          tt.ondblclick = () => {
            const old = tt.textContent; tt.innerHTML = '<input type="text" maxlength="300" value="' + esc(old) + '">'; const i = tt.querySelector('input'); i.focus(); i.select();
            let gone = false;
            const save = async () => { if (gone) return; gone = true; const v = i.value.trim(); if (!v || v === old) { draw(); return; } try { replace(await op({ op: 'task_edit', task_id: tid, title: v })); draw(); } catch (err) { fail(err); } };
            i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { gone = true; draw(); } };
            i.onblur = save;
          };
        });
      });
    }
    window.addEventListener('focus', () => { if (loaded && !editing && document.activeElement === document.body) load(); });
    draw(); load();
    return { reload: load, setPeople: list => { opts.people = list; } };
  };
})();
