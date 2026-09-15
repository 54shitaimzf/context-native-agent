// build-html.mjs —— 把定稿 Markdown 渲染成自包含单文件 HTML
// 用法: node build-html.mjs
// 说明: 只读 Markdown，绝不修改它；KaTeX 与字体全部内联，离线可用。
import fs from 'node:fs';

const DIR = 'C:/Users/Administrator/Desktop/Context-Native Agent';
const SRC = DIR + '/Agent架构革新：迈向上下文原生智能-Context-Native Agent.md';
const OUT = DIR + '/Agent架构革新：迈向上下文原生智能-Context-Native Agent.html';
const KATEX = 'G:/deepseek-harness/node_modules/.pnpm/katex@0.16.47/node_modules/katex/dist';

const md = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const lines = md.split('\n');

/* ---------------- 1. 分块 ---------------- */
const blocks = [];
const isTable = l => l.startsWith('|');
const isQuote = l => l.startsWith('>');
const isOl = l => /^\d+\.\s/.test(l);
const isUl = l => /^-\s/.test(l);
const isHr = l => /^-{3,}$/.test(l.trim());
const isHead = l => /^#{1,4} /.test(l);

for (let i = 0; i < lines.length;) {
  const l = lines[i];
  if (!l.trim()) { i++; continue; }
  const h = l.match(/^(#{1,4}) (.*)$/);
  if (h) { blocks.push({ t: 'h' + h[1].length, text: h[2].trim() }); i++; continue; }
  if (isHr(l)) { blocks.push({ t: 'hr' }); i++; continue; }
  if (isTable(l)) { const rows = []; while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]); blocks.push({ t: 'table', rows }); continue; }
  if (isQuote(l)) { const q = []; while (i < lines.length && (isQuote(lines[i]) || (lines[i].trim() === '' && isQuote(lines[i + 1] || '')))) { q.push(lines[i].replace(/^>\s?/, '')); i++; } blocks.push({ t: 'quote', lines: q }); continue; }
  if (isOl(l)) { const it = []; while (i < lines.length && isOl(lines[i])) it.push(lines[i++].replace(/^\d+\.\s/, '')); blocks.push({ t: 'ol', items: it }); continue; }
  if (isUl(l)) { const it = []; while (i < lines.length && isUl(lines[i])) it.push(lines[i++].replace(/^-\s/, '')); blocks.push({ t: 'ul', items: it }); continue; }
  const p = []; while (i < lines.length && lines[i].trim() && !isHead(lines[i]) && !isTable(lines[i]) && !isQuote(lines[i]) && !isOl(lines[i]) && !isUl(lines[i]) && !isHr(lines[i])) p.push(lines[i++]);
  blocks.push({ t: 'p', lines: p });
}

/* ---------------- 2. 行内转换 ---------------- */
let citeSeq = 0;
const citePer = {};
const TAG = '\u0001';
function inline(s) {
  let x = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const store = [];
  const keep = (html) => { store.push(html); return TAG + (store.length - 1) + TAG; };
  x = x.replace(/`([^`]+)`/g, (m, c) => keep('<code>' + c + '</code>'));
  x = x.replace(/\$\$([^$]+)\$\$/g, (m, c) => keep('$$' + c + '$$'));
  x = x.replace(/\$([^$]+)\$/g, (m, c) => keep('$' + c + '$'));
  x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  x = x.replace(/¥\s?(\d[\d.,]*(?:\s?[kM])?)/g, '¥<span class="num">$1</span>');
  x = x.replace(/\[(\d{1,2})\]/g, (m, n) => { citeSeq++; const k = (citePer[n] = (citePer[n] || 0) + 1); return `<a class="cite" id="cite-${n}-${k}" href="#ref-${n}">[${n}]</a>`; });
  x = x.replace(new RegExp(TAG + '(\\d+)' + TAG, 'g'), (m, i) => store[Number(i)]);
  return x;
}
function inlinePlain(s) { // 不做角标/金额处理（用于 A3.1 条目首列）
  let x = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  x = x.replace(/`([^`]+)`/g, '<code>$1</code>');
  return x;
}

/* ---------------- 3. 渲染 ---------------- */
let secSeq = 0;
const toc = [];
const secId = (level, text) => { const id = 'sec-' + (++secSeq); if (level === 2 || level === 3) toc.push({ id, level, text }); return id; };

function renderTable(rows) {
  const cells = r => r.replace(/^\||\|$/g, '').split('|').map(s => s.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const isRefTable = head[0] === '#';
  const colCls = head.map(h => /本架构|共享前缀/.test(h) ? 'col-ours' : (/基线|累积/.test(h) ? 'col-base' : ''));
  let h = '<div class="tw"><table>';
  h += '<thead><tr>' + head.map((c, i) => `<th class="${colCls[i]}">${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
  for (const r of body) {
    let trAttr = '', first = null;
    if (isRefTable) {
      const m = (r[0] || '').match(/^\[(\d+)\]$/);
      if (m) { trAttr = ` id="ref-${m[1]}"`; first = m[1]; }
    }
    h += `<tr${trAttr}>` + r.map((c, i) => {
      if (i === 0 && first) return `<td class="refno ${colCls[i]}"><a href="#cite-${first}-1">[${first}]</a></td>`;
      const cls = colCls[i];
      return `<td class="${cls}">${inline(c)}</td>`;
    }).join('') + '</tr>';
  }
  return h + '</tbody></table></div>';
}

/* ---------------- 4. 两张 SVG 图（数据全部出自附录2） ---------------- */
function chartSteps() { // 四个台阶：单价 ↔ 背多少步
  const data = [
    { name: '台阶一　被写下来', price: '¥4 / M', steps: 200, color: '#c2410c', note: '写摘要与写坐标同档' },
    { name: '台阶二　第一次构建进上下文', price: '¥1 / M', steps: 50, color: '#ea8c2f', note: '' },
    { name: '台阶三　此后每一步都被读', price: '¥0.02 / M', steps: 1, color: '#3b82f6', note: '' },
    { name: '台阶四　根本没被构建', price: '0', steps: 0, color: '#10b981', note: '原文留在 git 里，随时可照坐标取回' },
  ];
  const W = 760, padL = 250, padR = 96, top = 34, rowH = 46;
  const H = top + data.length * rowH + 26;
  const x = v => padL + (v === 0 ? 0 : (Math.log10(v + 1) / Math.log10(201)) * (W - padL - padR));
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="四个台阶的单价与背着多少步的换算">`;
  s += `<text x="0" y="16" class="ct">一份内容的四种价钱：把单价换算成“背着它走多少步”</text>`;
  for (const t of [1, 10, 100, 200]) { s += `<line x1="${x(t)}" y1="${top - 8}" x2="${x(t)}" y2="${H - 22}" class="cgrid"/><text x="${x(t)}" y="${H - 8}" class="cax" text-anchor="middle">${t} 步</text>`; }
  data.forEach((d, i) => {
    const y = top + i * rowH, w = Math.max(x(d.steps) - padL, d.steps === 0 ? 3 : 3);
    s += `<text x="0" y="${y + 17}" class="cl">${d.name}</text>`;
    if (d.steps === 0) {
      s += `<rect x="${padL}" y="${y + 4}" width="120" height="18" rx="3" class="cempty"/>`;
      s += `<text x="${padL + 126}" y="${y + 18}" class="cv" fill="${d.color}">0（不付）</text>`;
    } else {
      s += `<rect x="${padL}" y="${y + 4}" width="${w}" height="18" rx="3" fill="${d.color}"/>`;
      s += `<text x="${padL + w + 8}" y="${y + 18}" class="cv" fill="${d.color}">${d.steps} 步　<i>${d.price}</i>${d.note ? '　' + d.note : ''}</text>`.replace(/<\/?i>/g, '');
    }
  });
  return s + '</svg>';
}
function chartLevels() { // 三种活法 + 本架构
  const groups = [
    { name: '基线 @31%', sub: '人停手的位置（实测）', carry: 162.6, bill: 7.02, ours: false },
    { name: '基线 @80%', sub: '完全不管控', carry: 407.6, bill: 16.97, ours: false },
    { name: '基线 @8%', sub: '钱最优·工程不可达', carry: 47.8, bill: 3.33, ours: false, ghost: true },
    { name: '本架构 @20%', sub: '4 分支·申报 10k', carry: 130.0, bill: 5.70, ours: true },
  ];
  const W = 760, H = 320, padB = 62, top = 34;
  const panelW = 330, gap = 40, x0 = 20, x1 = x0 + panelW + gap;
  const barW = 46, inner = 24;
  const col = g => g.ours ? '#3b82f6' : '#9aa4b2';
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="三种活法与本架构的平均占用与账单对比">`;
  s += `<text x="${x0}" y="16" class="ct">平均每步背着多少 token</text>`;
  s += `<text x="${x1}" y="16" class="ct">一次 2,068 步任务的账单</text>`;
  const maxC = 407.6, maxB = 16.97;
  const slot = panelW / groups.length;
  groups.forEach((g, i) => {
    [[x0, maxC, g.carry, v => v + 'k'], [x1, maxB, g.bill, v => '¥' + v.toFixed(2)]].forEach(([gx, max, val, fmt]) => {
      const h = (val / max) * (H - padB - top), y = H - padB - h;
      const bx = gx + i * slot + (slot - barW) / 2;
      s += `<rect x="${bx}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${g.ours ? '#3b82f6' : '#9aa4b2'}"${g.ghost ? ' opacity="0.45"' : ''}/>`;
      s += `<text x="${bx + barW / 2}" y="${y - 7}" class="cv2" text-anchor="middle" fill="${g.ours ? '#3b82f6' : '#6b7280'}">${fmt(val)}</text>`;
    });
    const cx = x0 + i * slot + slot / 2;
    s += `<text x="${cx}" y="${H - padB + 20}" class="cl2" text-anchor="middle">${g.name}</text>`;
    s += `<text x="${cx}" y="${H - padB + 37}" class="cs" text-anchor="middle">${g.sub}</text>`;
    if (g.ghost) s += `<text x="${cx}" y="${H - 8}" class="cs2" text-anchor="middle">工程上不可达</text>`;
  });
  s += `<line x1="${x0}" y1="${H - padB}" x2="${x0 + panelW}" y2="${H - padB}" class="caxis"/>`;
  s += `<line x1="${x1}" y1="${H - padB}" x2="${x1 + panelW}" y2="${H - padB}" class="caxis"/>`;
  s += `</svg>`;
  return s;
}
function figure(svg, cap) { return `<figure class="fig">${svg}<figcaption>${cap}</figcaption></figure>`; }

/* ---------------- 5. 组装 ---------------- */
const out = [];
for (const b of blocks) {
  if (b.t === 'h1') { out.push(`<h1>${inline(b.text)}</h1>`); continue; }
  if (/^h[234]$/.test(b.t)) {
    const raw = Number(b.t.slice(1));
    const lv = raw >= 3 ? raw - 1 : raw; // 文档用 ### 作节、#### 作子节 → 渲染为 h2/h3
    const id = secId(lv, b.text);
    out.push(`<h${lv} id="${id}">${inline(b.text)}<a class="anchor" href="#${id}" aria-label="链接">#</a></h${lv}>`);
    continue;
  }
  if (b.t === 'hr') { out.push('<hr>'); continue; }
  if (b.t === 'p') { out.push('<p>' + b.lines.map(inline).join('<br>') + '</p>'); continue; }
  if (b.t === 'quote') {
    const ps = [[]];
    for (const l of b.lines) { if (!l.trim()) { if (ps[ps.length - 1].length) ps.push([]); } else ps[ps.length - 1].push(l); }
    out.push('<blockquote class="callout">' + ps.filter(p => p.length).map(p => '<p>' + p.map(inline).join('<br>') + '</p>').join('') + '</blockquote>');
    continue;
  }
  if (b.t === 'ol' || b.t === 'ul') {
    out.push(`<${b.t}>` + b.items.map(i => '<li>' + inline(i) + '</li>').join('') + `</${b.t}>`);
    continue;
  }
  if (b.t === 'table') {
    const isStepsTable = /台阶/.test(b.rows[0]);
    const isLevelsTable = /活法/.test(b.rows[0]);
    out.push(renderTable(b.rows));
    if (isStepsTable) out.push(figure(chartSteps(), '数据源：附录2 A2.2 四个台阶表。横轴为对数刻度（台阶四为 0，另用空心条表示）。'));
    if (isLevelsTable) out.push(figure(chartLevels(), '数据源：附录2 A2.4 / A2.5。@8% 一档是基线按钱算出的最优点，实测里没有人能走到那里。'));
    continue;
  }
}

/* ---------------- 6. 样式 / 脚本 / KaTeX ---------------- */
let kcss = fs.readFileSync(KATEX + '/katex.min.css', 'utf8');
let fontCount = 0;
kcss = kcss.replace(/url\(([^)]*?\.woff2)\)/g, (m, p) => {
  const n = p.split('/').pop();
  const f = KATEX + '/fonts/' + n;
  if (!fs.existsSync(f)) return m;
  fontCount++;
  return 'url(data:font/woff2;base64,' + fs.readFileSync(f).toString('base64') + ')';
});
kcss = kcss.replace(/,\s*url\([^)]*?\.woff\)\s*format\((?:&quot;|"|')woff(?:&quot;|"|')\)/g, '')
  .replace(/,\s*url\([^)]*?\.ttf\)\s*format\((?:&quot;|"|')truetype(?:&quot;|"|')\)/g, '');
const kjs = fs.readFileSync(KATEX + '/katex.min.js', 'utf8');
const arjs = fs.readFileSync(KATEX + '/contrib/auto-render.min.js', 'utf8');

const head = fs.readFileSync(DIR + '/.git/HEAD', 'utf8').trim();
let hash = 'unknown';
try {
  hash = head.startsWith('ref: ') ? fs.readFileSync(DIR + '/' + head.slice(5), 'utf8').trim().slice(0, 7) : head.slice(0, 7);
} catch (e) { hash = head.slice(0, 7); }
const today = new Date().toISOString().slice(0, 10);

const CSS = `
:root{--bg:#fbfaf7;--fg:#1f2328;--muted:#6b7280;--line:#e5e2da;--card:#fff;--accent:#3b82f6;--warm:#c2410c;--base:#9aa4b2;--code:#f3f1ec;}
@media (prefers-color-scheme:dark){:root{--bg:#15171a;--fg:#e6e6e6;--muted:#9aa0a6;--line:#2b2f36;--card:#1b1e22;--code:#22262c;}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.9 -apple-system,"Segoe UI","Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei",sans-serif;text-spacing:normal}
#wrap{display:flex;gap:32px;max-width:1240px;margin:0 auto;padding:0 24px}
nav{position:sticky;top:0;align-self:flex-start;height:100vh;overflow:auto;flex:0 0 244px;padding:28px 0;font-size:13px;border-right:1px solid var(--line)}
nav a{display:block;color:var(--muted);text-decoration:none;padding:3px 10px;border-left:2px solid transparent;line-height:1.5}
nav a:hover{color:var(--fg)}
nav a.lv2{font-weight:600;color:var(--fg);margin-top:10px}
nav a.lv3{padding-left:20px}
nav a.on{color:var(--accent);border-left-color:var(--accent);background:color-mix(in srgb,var(--accent) 7%,transparent)}
main{flex:1 1 auto;min-width:0;max-width:46em;padding:56px 0 120px}
h1{font-size:30px;line-height:1.4;margin:0 0 8px;letter-spacing:.2px}
h2{font-size:22px;margin:56px 0 18px;padding-top:14px;border-top:1px solid var(--line)}
h3{font-size:17px;margin:38px 0 12px;color:var(--fg)}
p{margin:0 0 1.05em;text-align:justify}
hr{border:0;border-top:1px dashed var(--line);margin:34px 0}
ol,ul{padding-left:1.4em;margin:0 0 1.1em}
li{margin:.32em 0}
strong{font-weight:700}
.num{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--warm);font-size:.95em}
code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--code);padding:.1em .34em;border-radius:4px;font-size:.9em}
.callout{margin:0 0 1.3em;padding:.85em 1.1em;background:var(--card);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.callout p:last-child{margin-bottom:0}
.tw{overflow-x:auto;margin:0 0 1.3em;border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{padding:8px 11px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
thead th{position:sticky;top:0;background:var(--card);z-index:2;font-weight:600}
tbody tr:nth-child(even){background:color-mix(in srgb,var(--fg) 3%,transparent)}
tbody tr:hover{background:color-mix(in srgb,var(--accent) 6%,transparent)}
td.col-ours,th.col-ours{background:color-mix(in srgb,var(--accent) 9%,transparent)}
td.col-base,th.col-base{background:color-mix(in srgb,var(--base) 12%,transparent)}
td.refno{white-space:nowrap;font-family:ui-monospace,monospace}
td.refno a{text-decoration:none}
a.cite{color:var(--accent);text-decoration:none;font-size:.82em;vertical-align:super;padding:0 .5px}
a.cite:hover{text-decoration:underline}
a.anchor{opacity:0;margin-left:.4em;color:var(--muted);text-decoration:none;font-size:.8em}
h2:hover a.anchor,h3:hover a.anchor{opacity:1}
.fig{margin:1.6em 0 1.8em;padding:10px 6px 4px}
.chart{width:100%;height:auto;display:block}
figcaption{font-size:12.5px;color:var(--muted);text-align:center;margin-top:8px}
.ct{font-size:13px;fill:var(--fg);font-weight:600}
.cl{font-size:12.5px;fill:var(--fg)}
.cl2{font-size:12.5px;fill:var(--fg);font-weight:600}
.cs{font-size:11px;fill:var(--muted)}
.cs2{font-size:11px;fill:var(--warm)}
.cv,.cv2{font-size:11.5px;font-family:ui-monospace,monospace}
.cax{font-size:10.5px;fill:var(--muted)}
.cgrid{stroke:var(--line);stroke-dasharray:2 3}
.caxis{stroke:var(--line)}
.cempty{fill:none;stroke:var(--line);stroke-dasharray:3 3}
footer{border-top:1px solid var(--line);margin-top:60px;padding-top:14px;font-size:12.5px;color:var(--muted)}
@media (max-width:900px){nav{display:none}#wrap{padding:0 18px}main{padding-top:32px}}
@media print{nav,.tw{overflow:visible}body{background:#fff;font-size:11.5pt}main{max-width:none}h2{page-break-after:avoid}table,.fig,.callout{page-break-inside:avoid}a.cite{color:#000}footer{page-break-before:avoid}}
`;

const tocHtml = toc.map(t => `<a class="lv${t.level}" href="#${t.id}">${t.text.replace(/</g, '&lt;')}</a>`).join('\n');

const html = `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent重架构：迈向上下文原生智能（Context-Native Agent）</title>
<style>${kcss}</style>
<style>${CSS}</style>
</head><body>
<div id="wrap">
<nav>${tocHtml}</nav>
<main>
${out.join('\n')}
<footer>
  单文件离线版 · 由 <code>build-html.mjs</code> 从 Markdown 定稿渲染（文字逐字一致，仅渲染层加图与颜色）<br>
  版本：<code>${hash}</code> · 生成于 ${today} · 正文文字自 <code>8229d01</code> 起未改动
</footer>
</main>
</div>
<script>${kjs}</script>
<script>${arjs}</script>
<script>
(function(){
  renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],throwOnError:false,ignoredTags:["script","noscript","style","textarea","pre","code","option"]});
  var links=[].slice.call(document.querySelectorAll("nav a"));
  var map={};links.forEach(function(a){map[a.getAttribute("href").slice(1)]=a;});
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.remove("on");});var a=map[e.target.id];if(a)a.classList.add("on");}})},{rootMargin:"-10% 0px -80% 0px"});
  document.querySelectorAll("h2[id],h3[id]").forEach(function(h){io.observe(h);});
})();
</script>
</body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('已写出: %s', OUT.split('/').pop());
console.log('  块 %d，目录项 %d，角标 %d，内联字体 %d 个', blocks.length, toc.length, citeSeq, fontCount);
console.log('  体积 %s KB（其中 KaTeX CSS %s KB / JS %s KB）', (html.length / 1024).toFixed(0), (kcss.length / 1024).toFixed(0), ((kjs.length + arjs.length) / 1024).toFixed(0));
console.log('  自检：残留占位符 %d，残留 url(fonts/ %d，svg %d 个，表格 %d 个',
  (html.match(/\u0001/g) || []).length, (html.match(/url\(fonts\//g) || []).length,
  (html.match(/<svg /g) || []).length, (html.match(/<table>/g) || []).length);
