"""Shared helpers for bringing v1 pages / styles into v2: colour mapping and CSS scoping."""
import re

# v1 palette -> v2 brand tokens (JENTIS website colours)
HEX = {
    '#14506C': '#004771', '#1E6488': '#0A5C8C', '#1FA294': '#4FA3D8', '#127264': '#2F8F6A', '#0B7C7A': '#2F8F6A',
    '#5BA79D': '#4FA3D8', '#7FE0D6': '#9DDCFF', '#CDEBE6': '#E8F5FD', '#BFE3DC': '#CFE9F8', '#9DC3D6': '#9DDCFF',
    '#E98862': '#F38C62', '#C4574E': '#ED4502', '#FBEDE6': '#FDEDE6', '#F9E9E7': '#FDE8E0', '#F6BFA8': '#F9C9B4',
    '#D9A441': '#E0A458', '#7FB3CE': '#9DDCFF', '#7A93A5': '#7FA3BC', '#1E2A32': '#272727', '#1E2A33': '#272727',
    '#F7F6F4': '#F2F4F7', '#E9E8E4': '#E6E8EB', '#5F6B74': '#5B6770', '#3F6683': '#2C6A93', '#5C7C93': '#4D83A6',
}
RGBA = {'rgba(20,80,108,': 'rgba(0,71,113,', 'rgba(20, 80, 108,': 'rgba(0,71,113,', 'rgba(31,162,148,': 'rgba(79,163,216,', 'rgba(31, 162, 148,': 'rgba(79,163,216,'}

def recolor(text):
    def sub(m):
        return HEX.get(m.group(0).upper(), m.group(0))
    text = re.sub(r'#[0-9A-Fa-f]{6}\b', sub, text)
    for a, b in RGBA.items():
        text = text.replace(a, b)
    return text

DROP_SELECTORS = re.compile(r'^(\*|html|body|\.wrap|\.topbar|\.brand|\.reports|nav\.reports|\.navdiv|\.topmeta|\.pagehead|h1|\.runmeta|\.subnav|footer a)\b')

def scope_css(css, scope='.v1', drop_shell=False):
    """Prefix every selector with `scope` so v1 rules only touch ported page content."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, i, n = [], 0, len(css)

    def block_end(start):
        depth, j = 0, start
        while j < n:
            if css[j] == '{': depth += 1
            elif css[j] == '}':
                depth -= 1
                if depth == 0: return j
            j += 1
        return n - 1

    def scope_rules(text):
        res = []
        for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', text):
            sels, body = m.group(1).strip(), m.group(2).strip()
            if not sels or not body: continue
            if sels.startswith(':root'):
                continue
            kept = []
            for sel in sels.split(','):
                sel = sel.strip()
                if not sel: continue
                if drop_shell and DROP_SELECTORS.match(sel): continue
                if sel in ('body', 'html'): continue
                kept.append(scope + ' ' + sel)
            if kept: res.append(','.join(kept) + '{' + body + '}')
        return '\n'.join(res)

    while i < n:
        at = css.find('@', i)
        if at < 0:
            out.append(scope_rules(css[i:])); break
        out.append(scope_rules(css[i:at]))
        brace = css.find('{', at); semi = css.find(';', at)
        if brace < 0 or (0 <= semi < brace):          # @import etc.
            i = (semi + 1) if semi >= 0 else n; continue
        end = block_end(brace)
        head, inner = css[at:brace].strip(), css[brace + 1:end]
        if head.startswith('@media') or head.startswith('@supports'):
            out.append(head + '{\n' + scope_rules(inner) + '\n}')
        else:                                           # @keyframes, @font-face: keep as they are
            out.append(head + '{' + inner + '}')
        i = end + 1
    return '\n'.join(x for x in out if x.strip())
