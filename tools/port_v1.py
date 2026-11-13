"""Generates v2 pages from the deployed v1 pages in archive/v1-live/.

The v1 page logic is kept as it is; what changes is everything around it:
  * the v2 shell (left menu, title, feedback) instead of the v1 top navigation
  * the page's filters are moved into the standard filter bar (period first) by R.legacyFilters
  * every time filter becomes the standard period picker (R.quarterOptions in app.js)
  * colours are mapped to the v2 brand tokens, page styles are scoped to `.v1`
  * headings / metrics get their "?" explanation from assets/help.js

Run:  python3 tools/port_v1.py        (rewrites the pages listed in PAGES)
"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from v1lib import recolor, scope_css

ROOT = pathlib.Path(__file__).resolve().parents[1]
V1 = ROOT / 'archive/v1-live'
SITE = ROOT / 'site'

EMAIL_TABS = [['Sequences', 'email-outreach/'], ['Subject lines', 'email-outreach/subjects/']]

PAGES = [
    dict(src='leads', out='marketing/leads', key='leads', title='Leads',
         subtitle='Companies entering each lifecycle stage — by week, month or quarter, on corrected dates',
         period={'f-range': '90d'},
         labels={'f-gran': 'Group by', 'f-view': 'Dates', 'f-range': 'Period'},
         hints={'f-range': 'Shows the weeks / months that fall into this period', 'f-view': 'Corrected = the date the stage was really reached (meeting, call, reply). As set in HubSpot = the day the field was changed.'},
         css='#funnel,#compare,.sechead:last-of-type{display:none!important}',
         patches=[
             ("const range=Number(v('f-range')), gran=v('f-gran');", "const range=v('f-range'), gran=v('f-gran');"),
             ("if(range) periods=periods.slice(0,range);", "if(R.periodRange(range)){ const __in=R.rangeTest(range); const __keep=new Set(rows.filter(r=>__in(r._date)).map(r=>r._p)); periods=periods.filter(p=>__keep.has(p)); }"),
         ]),
    dict(src='leads', out='funnel', key='funnel', title='Full funnel',
         subtitle='From lead to customer: how many companies make it to each stage, and how the conversion types compare',
         period={'fun-period': 'lastquarter'},
         labels={'fun-period': 'Period', 'f-view': 'Dates'},
         hints={'fun-period': 'Cohort: companies that entered the start stage in this period. Activity: stage changes that happened in this period.'},
         add_filters='<select id="fun-period"></select>',
         stash=['f-gran', 'f-range'],
         css='#metrics,.split,.sechead,#stage-trends,.fun-ctl > label.fun-dates:first-child{display:none!important} #funnel{margin-top:0!important}',
         pre_js="""// the standard period picker drives the funnel's from / to dates
(function () {
  const sel = document.getElementById('fun-period'), f = document.getElementById('fun-from'), t = document.getElementById('fun-to');
  const set = () => { const r = R.periodRange(sel.value); const day = d => new Date(d).toISOString().slice(0, 10);
    f.value = r ? r.from : '2024-01-01'; t.value = r ? day(Math.min(Date.parse(r.to) - 864e5, Date.now())) : day(Date.now()); };
  set(); sel.addEventListener('change', () => { set(); f.dispatchEvent(new Event('change')); });
})();""",
         patches=[("move “to” back for mature rates", "pick an earlier period for mature rates")]),
    dict(src='sequences', out='email-outreach', key='email', title='Email outreach', tabs=EMAIL_TABS, tab=0,
         subtitle='Which outreach sequences work — step by step, and what they turn into',
         period={'f-range': 'all'},
         labels={'f-status': 'Status', 'f-range': 'Period', 'f-source': 'Source', 'f-icp': 'ICP', 'f-persona': 'Persona', 'f-sen': 'Seniority', 'f-coll': 'Collateral'},
         hints={'f-range': 'Sequences that sent at least one email in this period'}),
    dict(src='subjects', out='email-outreach/subjects', key='email', help='email-subjects', title='Email outreach', tabs=EMAIL_TABS, tab=1,
         subtitle='Which subject lines earn opens and real replies — and with whom',
         period={'f-range': '90d'}, labels={'f-range': 'Period'},
         hints={'f-range': 'Subject lines that were sent in this period'}),
    dict(src='responded', out='marketing/responses', key='responses', title='Responses',
         subtitle='Who answered — and what they said',
         period={'f-range': '30d'}, labels={'f-range': 'Period', 'f-scope': 'Signals', 'f-channel': 'Channel'}),
    dict(src='calls', out='bd/calls', key='calls', title='Calls',
         subtitle='Volume, connection rate and outcomes — by day, week, ICP type and persona',
         period={'f-range': '7d', 'f-trange': '90d'}, labels={'f-owner': 'Owner', 'f-range': 'Period', 'f-gran': 'Chart'},
         patches=[("if(gran==='auto') gran=(Number(days)&&Number(days)<=31)?'daily':'weekly';",
                   "if(gran==='auto') gran=(R.rangeDays(days)&&R.rangeDays(days)<=31)?'daily':'weekly';")]),
    dict(src='discoveries', out='bd/discoveries', key='discoveries', title='Discoveries',
         subtitle='Upcoming and completed discovery meetings — outcomes, TODOs, and what they turned into',
         period={'f-range': '90d'}, labels={'f-owner': 'Owner', 'f-part': 'JENTIS participant', 'f-range': 'Period'},
         hints={'f-range': 'Meetings from the start of this period on — upcoming meetings are always shown'},
         patches=[("inR=R.rangeTest(gv('f-range'))", "inR=R.rangeTest(gv('f-range'),{openEnd:true})")]),
    dict(src='journeys', out='bd/journeys', key='journeys', title='Customer journeys',
         subtitle='Every closed customer, from first touch to signature — and what happened in between',
         period={'f-quarter': 'all'}, labels={'f-quarter': 'Period', 'f-sort': 'Sort'},
         hints={'f-quarter': 'Customers whose deal was closed in this period'}),
    dict(src='deals', out='sales/deals', key='deals', title='Deals',
         subtitle='Pipeline by deal type — health, status and what to do next',
         period={'f-created': 'all'}, labels={'f-owner': 'Owner', 'f-status': 'Status', 'f-partner': 'Partner', 'f-created': 'Period'},
         hints={'f-created': 'Deals created in this period'}),
    dict(src='cs-quote-checker', out='sales/quote-checker', key='quotes', title='Quote checker',
         subtitle='Check an open or draft quote against our quoting rules before it goes out',
         labels={'quote-select': 'Quote'}),
    dict(src='cs-customers', out='cs/customers', key='customers', title='Customers',
         subtitle='The full book of business — contract, usage, status and an AI briefing per customer',
         period={'f-range': 'all'}, labels={'ownerbar': 'Owner', 'f-status': 'Status', 'f-range': 'Period', 'f-service': 'Services'},
         hints={'f-range': 'Customers who became a customer in this period'},
         # charts are drawn at the width they are shown at (v1 stretched a fixed 1000 px drawing, which distorts the text on wide screens)
         pre_js="const vw = f => Math.max(480, Math.round(((document.getElementById('page') || document.body).clientWidth || 1200) * f) - 60);",
         patches=[
             ('const W = 1000, H = 86, L = 8, Rr = 8, Y = 30, BH = 18;', 'const W = vw(1), H = 86, L = 8, Rr = 8, Y = 30, BH = 18;'),
             ('const W = 560, H = 110, pad = 18, lh = 14, top = 14;', 'const W = vw(.42), H = 110, pad = 18, lh = 14, top = 14;'),
             # legend swatches in the colours the bars are actually drawn in
             ('<span class="sw" style="background:#1FA294;opacity:.9"></span>current period', '<span class="sw" style="background:var(--brand-teal);opacity:.9"></span>current period'),
             ('<span class="sw" style="background:#14506C;opacity:.35"></span>upcoming (renewed)', '<span class="sw" style="background:var(--brand-blue);opacity:.3"></span>upcoming (renewed)'),
             ('<span class="sw" style="background:#C4574E;opacity:.75"></span>30-day cancellation period', '<span class="sw" style="background:var(--red);opacity:.7"></span>30-day cancellation period'),
             ('<span class="sw" style="background:#9AA4AD;opacity:.6"></span>past period', '<span class="sw" style="background:#9AA4AD;opacity:.45"></span>past period'),
         ]),
    dict(src='cs-renewals', out='cs/renewals', key='renewals', title='Renewals & expansion',
         subtitle='Every renewal on the clock — value, stage, days left',
         period={'f-quarter': 'all'}, next=['f-quarter'], labels={'ownerbar': 'Owner', 'f-status': 'Status', 'f-quarter': 'Period'},
         hints={'f-quarter': 'Renewals whose licence ends in this period'}),
    dict(src='cs-tickets', out='cs/tickets', key='tickets', title='Tickets',
         subtitle='Support load per customer — filter by the owner of the company (tickets carry no owner in HubSpot)',
         period={'f-range': 'all'}, labels={'ownerbar': 'Owner', 'f-status': 'Status', 'f-range': 'Period'},
         hints={'f-range': 'Tickets created in this period'}),
    dict(src='cs-capacity', out='cs/professional-services', key='ps', title='Professional services',
         subtitle='Capacity planning: sold, used and sellable hours of the JENTIS team per period'),
]

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · JENTIS Reporting</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{up}assets/app.css?b=__BUILD__">
<link rel="stylesheet" href="{up}assets/legacy.css?b=__BUILD__">
<style>
{style}
</style>
</head>
<body>
<!-- GENERATED by tools/port_v1.py from archive/v1-live/{src}/index.html — change the generator or the v1 source, not this file. -->
<div id="shell"></div>
<div id="page-content" class="v1" hidden>
{body}
</div>
<script src="{up}assets/config.js?b=__BUILD__"></script>
<script src="{up}assets/app.js?b=__BUILD__"></script>
<script src="{up}assets/help.js?b=__BUILD__"></script>
<script>
const C = window.RCONFIG;
R.shell({shell});
R.legacyFilters({filters});
{pre_js}
</script>
<script>
{script}
</script>
</body>
</html>
'''


def match_div(html, start):
    """index just after the </div> that closes the <div ...> starting at `start`"""
    depth = 0
    for m in re.finditer(r'<(/?)div\b[^>]*>', html[start:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return start + m.start(), start + m.end()
    raise ValueError('unbalanced div')


def port(cfg):
    src = (V1 / cfg['src'] / 'index.html').read_text()
    style = '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', src, flags=re.S))
    b0 = src.index('<body'); b0 = src.index('>', b0) + 1
    s0 = src.index('<script src', b0)
    body = src[b0:s0]
    w = body.find('<div class="wrap"')
    if w >= 0:                                   # unwrap .wrap, keep whatever follows it (drill panels etc.)
        inner_start = body.index('>', w) + 1
        close_start, close_end = match_div(body, w)
        body = body[:w] + body[inner_start:close_start] + body[close_end:]
    assert '<div id="shell"></div>' in body, cfg['src']
    body = body.replace('<div id="shell"></div>', '', 1)
    scripts = re.findall(r'<script>(.*?)</script>', src[s0:], flags=re.S)
    assert scripts, cfg['src']
    script = '\n'.join(scripts)
    m = re.search(r'^R\.shell\(', script, flags=re.M)
    assert m and len(re.findall(r'^R\.shell\(', script, flags=re.M)) == 1, (cfg['src'], 'R.shell call')
    depth, j = 0, m.end() - 1
    while True:                                   # skip to the matching ")" (quotes in titles contain no parentheses)
        if script[j] == '(': depth += 1
        elif script[j] == ')':
            depth -= 1
            if depth == 0: break
        j += 1
    j += 1
    if script[j:j + 1] == ';': j += 1
    script = script[:m.start()] + script[j:]
    script = re.sub(r'^const C\s*=\s*[^\n;]*;?[ \t]*\n', '', script, count=1, flags=re.M)   # the wrapper declares C
    for old, new in cfg.get('patches', []):
        assert script.count(old) == 1, (cfg['src'], 'patch not unique / missing', old[:60], script.count(old))
        script = script.replace(old, new)
    if cfg.get('add_filters'):
        assert '<div class="filters">' in body
        body = body.replace('<div class="filters">', '<div class="filters">' + cfg['add_filters'], 1)
    depth = cfg['out'].count('/') + 1
    up = '../' * depth
    shell = dict(page=cfg['key'], title=cfg['title'], subtitle=cfg['subtitle'])
    if cfg.get('help'): shell['help'] = cfg['help']
    if cfg.get('tabs'):
        shell['tabs'] = [dict(label=l, href=h, on=(i == cfg['tab'])) for i, (l, h) in enumerate(cfg['tabs'])]
    filters = dict(period=cfg.get('period', {}), labels=cfg.get('labels', {}), hints=cfg.get('hints', {}),
                   next=cfg.get('next', []), stash=cfg.get('stash', []))
    page_css = scope_css(recolor(style), '.v1') + ('\n' + cfg['css'] if cfg.get('css') else '')
    html = HEAD.format(title=cfg['title'], up=up, src=cfg['src'], style=page_css, body=recolor(body).strip(),
                       shell=json.dumps(shell, ensure_ascii=False), filters=json.dumps(filters, ensure_ascii=False),
                       pre_js=cfg.get('pre_js', ''), script=recolor(script).strip())
    out = SITE / cfg['out'] / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print('  %-22s -> site/%s/index.html  (%d kB)' % (cfg['src'], cfg['out'], len(html) // 1000))


if __name__ == '__main__':
    for cfg in PAGES:
        port(cfg)
