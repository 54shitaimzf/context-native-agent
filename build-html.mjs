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
  const at = i + 1;
  const h = l.match(/^(#{1,4}) (.*)$/);
  if (h) { blocks.push({ t: 'h' + h[1].length, text: h[2].trim(), ln: at }); i++; continue; }
  if (isHr(l)) { blocks.push({ t: 'hr', ln: at }); i++; continue; }
  if (isTable(l)) { const rows = []; while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]); blocks.push({ t: 'table', rows, ln: at }); continue; }
  if (isQuote(l)) { const q = []; while (i < lines.length && (isQuote(lines[i]) || (lines[i].trim() === '' && isQuote(lines[i + 1] || '')))) { q.push(lines[i].replace(/^>\s?/, '')); i++; } blocks.push({ t: 'quote', lines: q, ln: at }); continue; }
  if (isOl(l)) { const it = []; while (i < lines.length && isOl(lines[i])) it.push(lines[i++].replace(/^\d+\.\s/, '')); blocks.push({ t: 'ol', items: it, ln: at }); continue; }
  if (isUl(l)) { const it = []; while (i < lines.length && isUl(lines[i])) it.push(lines[i++].replace(/^-\s/, '')); blocks.push({ t: 'ul', items: it, ln: at }); continue; }
  const p = []; while (i < lines.length && lines[i].trim() && !isHead(lines[i]) && !isTable(lines[i]) && !isQuote(lines[i]) && !isOl(lines[i]) && !isUl(lines[i]) && !isHr(lines[i])) p.push(lines[i++]);
  blocks.push({ t: 'p', lines: p, ln: at });
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
  x = x.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  x = x.replace(/¥\s?(\d[\d.,]*(?:\s?[kM])?)/g, '¥<span class="num">$1</span>');
  x = x.replace(/\[(\d{1,2})\]/g, (m, n) => { citeSeq++; const k = (citePer[n] = (citePer[n] || 0) + 1); return `<a class="cite" id="cite-${n}-${k}" href="#ref-${n}">[${n}]</a>`; });
  x = x.replace(new RegExp(TAG + '(\\d+)' + TAG, 'g'), (m, i) => store[Number(i)]);
  return x;
}
function inlinePlain(s) { // 不做角标/金额处理（用于 A3.1 条目首列）
  let x = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  x = x.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
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
  const isRefTable = head[0] === '#' && head[3] === '核验'; // 只有 A3.1 那张条目表（首列 #、四列是 档/核验）
  const colCls = head.map(h => /本架构|共享前缀/.test(h) ? 'col-ours' : (/基线|累积/.test(h) ? 'col-base' : ''));
  const isNum = (s, i) => i > 0 && /^[¥$]?\s?\d[\d,.]*\s?(k|M|%|倍|步|字|个|条|页|页)?$/.test(s.replace(/\*\*/g, ''));
  let h = `<div class="tw"><table${isRefTable ? ' class="reftable"' : ''}>`;
  h += '<thead><tr>' + head.map((c, i) => `<th class="${(colCls[i] + ' ' + (isNum(c, i) ? 'numr' : '')).trim()}">${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
  for (const r of body) {
    let trAttr = '', first = null;
    if (isRefTable) {
      const m = (r[0] || '').match(/^\[(\d+)\]$/);
      if (m) { trAttr = ` id="ref-${m[1]}"`; first = m[1]; }
    }
    h += `<tr${trAttr}>` + r.map((c, i) => {
      if (i === 0 && first) return `<td class="refno ${colCls[i]}"><a href="#cite-${first}-1">[${first}]</a></td>`;
      const cls = (colCls[i] + ' ' + (isNum(c, i) ? 'numr' : '')).trim();
      return `<td class="${cls}">${inline(c)}</td>`;
    }).join('') + '</tr>';
  }
  return h + '</tbody></table></div>';
}

/* ---------------- 4. 两张 SVG 图（数据全部出自附录2） ---------------- */
function chartSteps() { // 四个台阶：单价 ↔ 背多少步
  const data = [
    { name: '台阶一　被写下来', price: '¥4 / M', steps: 200, color: '#2b2b2b' },
    { name: '台阶二　第一次构建进上下文', price: '¥1 / M', steps: 50, color: '#6f6b64' },
    { name: '台阶三　此后每一步都被读', price: '¥0.02 / M', steps: 1, color: '#a9a49a' },
    { name: '台阶四　根本没被构建', price: '0（不付）', steps: 0, color: '#a9a49a' },
  ];
  const W = 760, padL = 250, padR = 150, top = 20, rowH = 46;
  const H = top + data.length * rowH + 26;
  const x = v => padL + (v === 0 ? 0 : (Math.log10(v + 1) / Math.log10(201)) * (W - padL - padR));
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="四个台阶的单价与背着多少步的换算">`;
  for (const t of [1, 10, 100, 200]) { s += `<line x1="${x(t)}" y1="${top - 6}" x2="${x(t)}" y2="${H - 22}" class="cgrid"/><text x="${x(t)}" y="${H - 8}" class="cax" text-anchor="middle">${t} 步</text>`; }
  s += `<line x1="${padL}" y1="${H - 22}" x2="${W - padR}" y2="${H - 22}" class="caxis"/>`;
  data.forEach((d, i) => {
    const y = top + i * rowH, w = Math.max(x(d.steps) - padL, 0);
    s += `<text x="0" y="${y + 17}" class="cl">${d.name}</text>`;
    if (d.steps === 0) {
      s += `<rect x="${padL}" y="${y + 4}" width="14" height="18" class="cempty"/>`;   // 0 值只画一个标记，不画长度
      s += `<text x="${padL + 14}" y="${y + 18}" class="cv">${d.price}</text>`;
    } else {
      s += `<rect x="${padL}" y="${y + 4}" width="${w}" height="18" fill="${d.color}"/>`;
      s += `<text x="${W - 2}" y="${y + 18}" class="cv" text-anchor="end">${d.steps} 步　${d.price}</text>`;
    }
  });
  return s + '</svg>';
}
function chartLevels() { // 三种活法 + 本架构
  const groups = [
    { name: '基线 31%', sub: '实测停手处', carry: 162.6, bill: 7.02, ours: false },
    { name: '基线 80%', sub: '', carry: 407.6, bill: 16.97, ours: false },
    { name: '基线 8%', sub: '不可达', carry: 47.8, bill: 3.33, ours: false, ghost: true },
    { name: '本架构 20%', sub: '', carry: 130.0, bill: 5.70, ours: true },
  ];
  const W = 760, H = 346, padB = 64, top = 48;
  const panelW = 330, gap = 40, x0 = 20, x1 = x0 + panelW + gap;
  const barW = 46, OURS = '#33556f', BASE = '#c6c2b9';
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="三种活法与本架构的平均占用与账单对比">`;
  s += `<text x="${x0}" y="16" class="ct">平均每步背着多少 token（k）</text>`;
  s += `<text x="${x1}" y="16" class="ct">一次 2,068 步任务的账单（元）</text>`;
  const maxC = 407.6, maxB = 16.97;
  const slot = panelW / groups.length;
  groups.forEach((g, i) => {
    [[x0, maxC, g.carry, v => v + 'k'], [x1, maxB, g.bill, v => '¥' + v.toFixed(2)]].forEach(([gx, max, val, fmt]) => {
      const h = (val / max) * (H - padB - top), y = H - padB - h;
      const bx = gx + i * slot + (slot - barW) / 2;
      s += `<rect x="${bx}" y="${y}" width="${barW}" height="${h}" fill="${g.ours ? OURS : BASE}"${g.ghost ? ' opacity="0.4"' : ''}/>`;
      s += `<text x="${bx + barW / 2}" y="${y - 8}" class="cv2" text-anchor="middle">${fmt(val)}</text>`;
    });
    const cx = x0 + i * slot + slot / 2;
    s += `<text x="${cx}" y="${H - padB + 22}" class="cl2" text-anchor="middle">${g.name}</text>`;
    if (g.sub) s += `<text x="${cx}" y="${H - padB + 40}" class="cs" text-anchor="middle"${g.ghost ? ' opacity="0.75"' : ''}>${g.sub}</text>`;
  });
  s += `<line x1="${x0}" y1="${H - padB}" x2="${x0 + panelW}" y2="${H - padB}" class="caxis"/>`;
  s += `<line x1="${x1}" y1="${H - padB}" x2="${x1 + panelW}" y2="${H - padB}" class="caxis"/>`;
  s += `</svg>`;
  return s;
}
function figure(svg, cap) { return `<figure class="fig">${svg}<figcaption>${cap}</figcaption></figure>`; }

/* ---------------- 4.5 第 1 层阅读增强（只作用于渲染结果，Markdown 一字不动） ---------------- */
const LQ = String.fromCharCode(0x201c), RQ = String.fromCharCode(0x201d);
// 强调：结论句 / 定义句 / 边界句（与作者原有的 **粗体** 在观感上分层）
const EM = [
  '模型的状态只取决于参数与上下文；Agent的状态取决于环境 + 上下文 + 模型',
  '内容离开上下文，不再等于失去内容',
  '成为Harness的一等公民',
  `<strong>删除</strong>，不可逆；分区是<strong>不构建</strong>，可回取`,
  `有没有可能，上下文是从一颗纯净的前缀${LQ}种子${RQ}中生长出来的？`,
  '上下文压缩与剪切，是否还是正确的上下文处理方式呢？',
  '最大前缀组装',
  '更是从信息熵/上下文长度两方面确保了模型能力发挥稳定',
  '有待实验验证',
  'build上下文',
  '并行写者N²的冲突',
  '共享缓存前缀',
];
const TERMS = [
  '[ Environmental View ] + [ Project Structure and Intention Mapping ] + [ Raw Files Assigned ]',
  `AI native ${LQ}Git tree${RQ}`,
];
const EQ = [
  `${LQ}Agent = Harness + Model${RQ}`,
  `<strong>${LQ}Agent = Environment + Context + Model${RQ}</strong>`,
];
const GROUPS = [
  ['问题的由来', '所以，当我想到这一点的时候'],
  ['换一个主体', '当我们去审视大语言模型的本质'],
  ['四个推论', '那么这种理解方式能给我们带来什么启示？'],
  ['具体实现', '以这一理念出发'],
  ['相对主流的优势', '具体来说其相对主流'],
  ['边界与未来', '其有待实验验证的点在于'],
];
const MNOTES = [
  ['全部子Agent回归后', 'A2.4', '这笔账怎么算'],
  ['在缓存利用层面', 'A3.4', '41 个字符的缓存崩塌'],
  ['而对于我们这套Git架构', 'A3.4', '同类踩坑：N² 写冲突'],
];
const R = { em: 0, term: 0, eq: 0, note: 0, hits: [], cnt: new Map() };
const bump = (type, t, n = 1) => { const k = type + '|' + t; R.cnt.set(k, (R.cnt.get(k) || 0) + n); };
const plainOf = s => s.replace(/<[^>]+>/g, '');
function enhance(html, plain, ln) {
  let h = html;
  EQ.forEach(t => {
    if (R.cnt.get('eq|' + t)) return; // 每个等式只在它首次出现处升格
    if (h.includes(t)) {
      bump('eq', t); R.eq++; R.hits.push(['等式', ln, plainOf(t)]);
      h = h.split(t).join('<span class="eq">' + t.replace(/^<strong>|<\/strong>$/g, '') + '</span>');
    }
  });
  TERMS.forEach(t => {
    const n = h.split(t).length - 1;
    if (n) { bump('term', t, n); R.term += n; R.hits.push(['专名', ln, plainOf(t).slice(0, 26) + (n > 1 ? ' ×' + n : '')]); h = h.split(t).join('<span class="term">' + t + '</span>'); }
  });
  EM.forEach(t => {
    const n = h.split(t).length - 1;
    if (n) {
      bump('em', t, n); R.em += n;
      const cls = plainOf(t).length <= 20 ? 'em' : 'em-plain';   // 短标记带淡底，长句只加粗
      R.hits.push([cls === 'em' ? '强调·底' : '强调·粗', ln, plainOf(t).slice(0, 28) + (n > 1 ? ' ×' + n : '')]);
      h = h.split(t).join('<span class="' + cls + '">' + t + '</span>');
    }
  });
  const mi = MNOTES.findIndex(m => plain.startsWith(m[0]));
  // 注记插在区块**末尾**：屏幕上是绝对定位（位置与源码顺序无关，仍与首行齐平），
  // 打印时是流内块；若插在开头，列表项会被拆成"孤立项目符号 + 换行正文"。
  if (mi >= 0) { R.note++; R.hits.push(['边注', ln, MNOTES[mi][1] + ' ' + MNOTES[mi][2]]); h = h.replace(/<\/(p|li)>$/, `%%MN${mi}%%</$1>`); }
  return h;
}

/* ---------------- 5. 组装 ---------------- */
const out = [];
let curSection = '';
for (const b of blocks) {
  if (b.t === 'h1') { out.push(`<h1 class="doc-title">${inline(b.text)}</h1>`); continue; }
  if (/^h[234]$/.test(b.t)) {
    const raw = Number(b.t.slice(1));
    const lv = raw >= 3 ? raw - 1 : raw; // 文档用 ### 作节、#### 作子节 → 渲染为 h2/h3
    const id = secId(lv, b.text);
    if (lv === 2) curSection = b.text;
    out.push(`<h${lv} id="${id}">${inline(b.text)}<a class="anchor" href="#${id}" aria-label="链接">#</a></h${lv}>`);
    continue;
  }
  if (b.t === 'hr') { out.push('<hr>'); continue; }
  if (b.t === 'p') {
    const plain = b.lines.join('');
    const am = plain.match(/^\*作者：(.*)\*$/);
    if (am) { out.push(`<p class="doc-author">作者：${am[1]}</p>`); continue; }
    let idAttr = '';
    const gi = GROUPS.findIndex(g => plain.startsWith(g[1]));
    if (curSection.startsWith('正文') && gi >= 0) { const gid = 'grp-' + (gi + 1); idAttr = ` id="${gid}"`; toc.push({ id: gid, level: 3, text: GROUPS[gi][0], sub: true }); }
    let h = '<p' + idAttr + '>' + b.lines.map(inline).join('<br>') + '</p>';
    if (curSection.startsWith('正文')) h = enhance(h, plain, b.ln);
    out.push(h);
    continue;
  }
  if (b.t === 'quote') {
    const ps = [[]];
    for (const l of b.lines) { if (!l.trim()) { if (ps[ps.length - 1].length) ps.push([]); } else ps[ps.length - 1].push(l); }
    out.push('<blockquote class="callout">' + ps.filter(p => p.length).map(p => '<p>' + p.map(inline).join('<br>') + '</p>').join('') + '</blockquote>');
    continue;
  }
  if (b.t === 'ol' || b.t === 'ul') {
    const items = b.items.map(t => {
      let h = '<li>' + inline(t) + '</li>';
      if (curSection.startsWith('正文')) h = enhance(h, t, b.ln);
      return h;
    });
    out.push(`<${b.t}>` + items.join('') + `</${b.t}>`);
    continue;
  }
  if (b.t === 'table') {
    const isStepsTable = /台阶/.test(b.rows[0]);
    const isLevelsTable = /活法/.test(b.rows[0]);
    out.push(renderTable(b.rows));
    if (isStepsTable) out.push(figure(chartSteps(), '图 1　一份内容的四种价钱：把单价换算成“背着它走多少步”。数据源：附录2 A2.2（横轴对数刻度；台阶四为 0，用空心方块标记）。'));
    if (isLevelsTable) out.push(figure(chartLevels(), '图 2　三种活法与本架构的对比。31% 一档是实测中人工停手的位置（中位 30.9%）；@8% 一档是基线按钱算出的最优点，工程上不可达、实测里没有人能走到；本架构一档取 20% 水位、4 分支、申报 10k。数据源：附录2 A2.4 / A2.5。'));
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
  hash = head.startsWith('ref: ') ? fs.readFileSync(DIR + '/.git/' + head.slice(5), 'utf8').trim().slice(0, 7) : head.slice(0, 7);
} catch (e) { hash = head.slice(0, 7); }
const today = new Date().toISOString().slice(0, 10);

const CSS = `
/* ---- 设计变量：屏幕为暖白纸，打印为纯白；强调一律中性底色、不用彩色高亮 ---- */
:root{
  --paper:#fbfaf7;--ink:#1b1b1b;--ink-soft:#3c3c3c;--muted:#7a756d;
  --rule:#e0ddd5;--rule-ink:#2a2a2a;--tint:#f2f0ea;--tint-2:#e9e6de;
  --accent:#3f5f7f;--base:#c6c2b9;
  --sans:"Noto Sans SC","Source Han Sans SC","Microsoft YaHei",system-ui,sans-serif;
  --serif:"Noto Serif SC","Source Han Serif SC",Georgia,serif;
  --mono:"Cascadia Mono","Source Code Pro",ui-monospace,Consolas,monospace;
  --measure:150mm;--mo:-12.5em;--mw:11em;
}
@media (prefers-color-scheme:dark){:root{--paper:#15171a;--ink:#e8e6e1;--ink-soft:#cfccc6;--muted:#9aa0a6;--rule:#2e3238;--rule-ink:#d8d5cf;--tint:#23262b;--tint-2:#2b2f35;--accent:#8fb0d4;--base:#4a5158}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.85 var(--sans);text-spacing:normal;-webkit-font-smoothing:antialiased}
#wrap{display:flex;gap:34px;max-width:1280px;margin:0 auto;padding:0 26px}
nav{position:sticky;top:0;align-self:flex-start;height:100vh;overflow:auto;flex:0 0 232px;padding:30px 0;font-size:12.5px;border-right:1px solid var(--rule)}
nav a{display:block;color:var(--muted);text-decoration:none;padding:3px 10px;border-left:2px solid transparent;line-height:1.5}
nav a:hover{color:var(--ink)}
nav a.lv2{font-weight:600;color:var(--ink);margin-top:11px}
nav a.lv3{padding-left:20px}
nav a.on{color:var(--accent);border-left-color:var(--accent)}
nav a.lvsub{font-size:12px;color:var(--muted)}
main{flex:1 1 auto;min-width:0;max-width:44em;padding:54px 0 120px}
h1.doc-title{font-size:27px;line-height:1.4;margin:0 0 4px;font-weight:700;letter-spacing:.01em}
p.doc-author{margin:0 0 2.2em;color:var(--muted);font-size:.94em}
h2{font-size:18.5px;margin:54px 0 15px;padding-top:13px;border-top:1px solid var(--rule);font-weight:700;letter-spacing:.01em}
h3{font-size:14px;margin:34px 0 10px;font-weight:600;color:var(--ink-soft);letter-spacing:.02em}
p{margin:0 0 .72em;text-align:justify;text-justify:inter-ideograph}
hr{border:0;border-top:1px solid var(--rule);margin:32px 0}
ol,ul{padding-left:1.5em;margin:0 0 1em}
li{margin:.3em 0}
strong{font-weight:700}
em{font-style:italic}
.num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;font-weight:600}
code{font-family:var(--mono);background:var(--tint);padding:.08em .32em;border-radius:3px;font-size:.9em}
.callout{margin:1.1em 0 1.35em;padding:.85em 1.1em;background:var(--tint);border-left:1px solid #b9b4ac;border-radius:0}
.callout p:last-child{margin-bottom:0}
/* ---- 三线表（学术惯例：无竖线、无斑马、无圆角；粗细 + 深浅双保险才读得出层级） ---- */
.tw{overflow-x:auto;margin:.35em 0 1.35em}
table{border-collapse:collapse;width:100%;font-size:9pt;line-height:1.55}
th,td{padding:4px 7px;border:0;text-align:left;vertical-align:top}
thead th{background:none;border-top:1.5pt solid #1a1a1a;border-bottom:.6pt solid #8a8a8a;font-weight:700;white-space:nowrap;position:sticky;top:0;z-index:2;background:var(--paper)}
tbody tr:last-child td{border-bottom:1.5pt solid #1a1a1a}
tbody tr:hover{background:var(--tint)}
td.col-ours,th.col-ours{background:var(--tint)}
td.col-base,th.col-base{background:none}
td.numr,th.numr{text-align:right;font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;white-space:nowrap}
table.reftable{table-layout:fixed;font-size:8.2pt;line-height:1.5}
table.reftable td,table.reftable th{overflow-wrap:anywhere}
table.reftable th:nth-child(1){width:7mm}
table.reftable th:nth-child(2){width:47mm;padding-right:12px}
table.reftable th:nth-child(3){width:7mm;padding-right:4px}
table.reftable th:nth-child(4){width:17mm;padding-right:6px}
td.refno{white-space:nowrap;font-family:var(--mono);font-size:.9em;color:var(--muted);padding-right:6px}
td.refno a{text-decoration:none;color:inherit}
a.cite{color:var(--accent);text-decoration:none;font-size:.76em;vertical-align:super;padding:0 .3px}
a.cite:hover{text-decoration:underline}
a.anchor{opacity:0;margin-left:.4em;color:var(--muted);text-decoration:none;font-size:.8em}
h2:hover a.anchor,h3:hover a.anchor{opacity:1}
.fig{margin:1.4em 0 1.7em;padding:6px 0 2px}
.toolbar{display:flex;gap:16px;align-items:center;font-size:12.5px;color:var(--muted);background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:7px 12px;margin:0 0 26px}
.toolbar strong{color:var(--ink);font-weight:600}
.toolbar label{cursor:pointer;color:var(--ink);display:flex;gap:6px;align-items:center}
/* ---- 强调：Markdown 风范——加粗承担醒目；中性极淡底色只给短标记，整句只加粗，不抢注意力 ---- */
.em{font-weight:700;background:var(--tint);border-radius:2px;padding:0 .16em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.em-plain{font-weight:700}
.term{font-family:var(--mono);background:var(--tint);border-radius:3px;padding:.1em .34em;font-size:.87em}
.eq{font-weight:700;background:var(--tint-2);border-radius:3px;padding:.1em .4em;letter-spacing:.01em;white-space:nowrap;-webkit-box-decoration-break:clone;box-decoration-break:clone}
/* ---- 页边注：屏幕上落在正文右侧留白、与所注段落首行齐平 ----
   注意：PDF 导出时会丢弃落在版心外的绝对定位元素，所以打印时改为紧贴该段落上方的一行灰色小注 ---- */
.mnote{position:absolute;top:.42em;right:var(--mo);width:var(--mw);font-size:10.5px;line-height:1.5;color:var(--muted);text-decoration:none;text-align:left;border-top:1px solid var(--rule);padding-top:3px}
.mnote .mn-t{display:block;font-weight:600;letter-spacing:.02em;color:var(--ink-soft)}
.mnote:hover .mn-t{text-decoration:underline}
p,li{position:relative}
body.no-em .em{font-weight:inherit;background:none;padding:0}
body.no-em .em-plain{font-weight:inherit}
body.no-em .term{font-family:inherit;background:none;padding:0;font-size:inherit}
body.no-em .eq{font-weight:inherit;background:none;padding:0;white-space:normal}
body.no-em .mnote{display:none}
/* ---- 封面 / 目录：屏幕默认不显示，白底预览与打印时显示 ---- */
.cover,.tocpage{display:none}
.cover{min-height:250mm;display:flex;flex-direction:column;padding:0}
.cv-kicker{font-family:var(--mono);font-size:11px;letter-spacing:.22em;color:var(--accent);text-transform:uppercase;margin:38mm 0 9mm}
.cv-title{font-family:var(--serif);font-size:33px;line-height:1.34;font-weight:700;margin:0 0 7mm;letter-spacing:.01em}
.cv-thesis{font-size:13px;color:var(--ink-soft);margin:0;letter-spacing:.04em}
.cv-thesis b{font-weight:700}
.cv-meta{font-size:11.5px;color:var(--muted);border-top:1px solid var(--rule);padding-top:4mm;letter-spacing:.06em;margin-top:auto}
.tocpage{padding-top:1mm}
.toc-h{font-size:14px;font-weight:700;letter-spacing:.42em;margin:0 0 6mm;border:0;padding:0}
ol.toc-list{list-style:none;padding:0;margin:0;font-size:9.5pt;line-height:1.5}
ol.toc-list li{margin:0}
ol.toc-list a{color:var(--ink);text-decoration:none;display:flex;align-items:baseline}
ol.toc-list .tt{flex:0 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
ol.toc-list .dots{flex:1 1 auto;border-bottom:1px dotted var(--rule);margin:0 .35em;transform:translateY(-.28em);min-width:1.5em}
ol.toc-list .pg{flex:0 0 auto;color:var(--muted);font-variant-numeric:tabular-nums}
ol.toc-list .t2{font-weight:700;margin-top:3.2mm}
ol.toc-list .t3{padding-left:6mm;color:var(--ink-soft);font-size:9pt}
ol.toc-list .t4{padding-left:12mm;color:var(--muted);font-size:8.5pt;line-height:1.42}
/* ---- 白底预览：与 PDF 观感一致 ---- */
body.light{--paper:#fff;--ink:#111;--ink-soft:#333;--muted:#666;--rule:#dcd9d2;--rule-ink:#222;--tint:#f2efe9;--tint-2:#eae7df;--accent:#33556f;--base:#c6c2b9;--mo:-30mm;--mw:24mm;color-scheme:light}
body.light .cover,body.light .tocpage{display:block}
body.light main{max-width:var(--measure);padding-top:0}
body.light .doc-title,body.light p.doc-author{display:none}
body.light .toolbar{margin:18px 0 30px}
@page{size:A4;margin:22mm 38mm 20mm 22mm}
@media print{
  :root,body.light{--paper:#fff;--ink:#111;--ink-soft:#333;--muted:#666;--rule:#dcd9d2;--rule-ink:#222;--tint:#f2efe9;--tint-2:#eae7df;--accent:#33556f;--base:#c6c2b9;--mo:-30mm;--mw:24mm;color-scheme:light}
  html,body{background:#fff !important;color:#111 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body,main,p,li,td,th,h1,h2,h3,blockquote,figcaption,ol.toc-list,.cv-meta,.mnote{font-family:var(--sans) !important}
  .cv-title{font-family:var(--serif) !important}
  nav,.toolbar{display:none !important}
  #wrap{display:block;max-width:none;padding:0}
  main{max-width:none;padding:0;font-size:10.5pt;line-height:1.75}
  .cover,.tocpage{display:block}
  .doc-title,p.doc-author{display:none}
  .cover{display:flex;flex-direction:column;min-height:248mm;break-after:page;page-break-after:always;padding-top:0}
  .tocpage{break-after:page;page-break-after:always}
  .toc-h{font-size:13pt}
  ol.toc-list{font-size:9.5pt;line-height:1.5}
  h1,h2,h3{break-after:avoid;page-break-after:avoid}
  p{orphans:2;widows:2}
  .tw{overflow:visible}
  thead th{position:static}
  tr,.callout,.fig,table{break-inside:avoid;page-break-inside:avoid}
  .fig,table{break-inside:avoid}
  a{color:var(--ink);text-decoration:none}
  a.cite{color:#33556f}
  .mnote{position:static;display:block;width:auto;top:auto;right:auto;text-align:right;font-size:8pt;line-height:1.45;
         color:#6b6b6b;border-top:0;padding:0;margin:0 0 .45em}
  .mnote .mn-t{display:inline;color:#6b6b6b;font-weight:600;letter-spacing:.02em}
  .mnote .mn-t::after{content:"　"}
  .em{background:#f2efe9}
  .em-plain{background:none}
  .term,.eq{background:#f2efe9}
  blockquote.callout{background:#f2efe9;border-left-color:#b9b4ac}
  figcaption{font-size:8.5pt;line-height:1.5}
  .fig svg{break-inside:avoid}
  footer{page-break-before:avoid;font-size:8.5pt}
}
.chart{width:100%;height:auto;display:block}
figcaption{font-size:12px;color:var(--muted);text-align:left;margin-top:7px;line-height:1.6}
.ct{font-size:17px;fill:var(--ink);font-weight:600}
.cl{font-size:16px;fill:var(--ink)}
.cl2{font-size:16px;fill:var(--ink);font-weight:600}
.cs{font-size:14px;fill:var(--muted)}
.cs2{font-size:14px;fill:var(--muted)}
.cv,.cv2{font-size:15px;font-family:var(--mono)}
.cax{font-size:13.5px;fill:var(--muted)}
.cgrid{stroke:var(--rule);stroke-dasharray:2 4}
.caxis{stroke:var(--rule-ink);stroke-width:1}
.cempty{fill:none;stroke:#8a8a8a;stroke-width:1;stroke-dasharray:3 2}
footer{border-top:1px solid var(--rule);margin-top:56px;padding-top:14px;font-size:11px;color:var(--muted);line-height:1.75}
footer .cl{display:block;font-size:9.5px;letter-spacing:.34em;color:var(--muted);margin-bottom:5px}
footer code{font-size:.94em}
@media screen and (max-width:1180px){.mnote{position:static;width:auto;text-align:right;border-top:0;padding-top:0;display:block;margin:-.3em 0 .9em}}
@media screen and (max-width:940px){nav{display:none}#wrap{padding:0 18px}main{padding-top:32px}body.light main{max-width:none}}
`;

const tocHtml = toc.map(t => `<a class="lv${t.level}${t.sub ? ' lvsub' : ''}" href="#${t.id}">${t.sub ? '· ' : ''}${t.text.replace(/</g, '&lt;')}</a>`).join('\n');

let body = out.join('\n');
const mnMiss = [];
body = body.replace(/%%MN(\d+)%%/g, (m, i) => {
  const [, target, label] = MNOTES[Number(i)];
  const t = toc.find(x => x.text.startsWith(target));
  if (!t) { mnMiss.push(target); return ''; }
  return `<a class="mnote" href="#${t.id}"><span class="mn-t">→ ${target}</span>${label}</a>`;
});

/* ---- 封面页与目录页（渲染层生成，Markdown 一字未动） ----
   目录页码由 build-pdf.mjs 的 tocpages 模式反查生成，写在 _tocpages.json；没有该文件时目录就不显示页码 */
let tocPages = {};
try { tocPages = JSON.parse(fs.readFileSync(DIR + '/_tocpages.json', 'utf8')); } catch { tocPages = {}; }
const COVER = `<section class="cover">
  <div class="cv-kicker">Context-Native Agent</div>
  <h1 class="cv-title">Agent 重架构<br>迈向上下文原生智能</h1>
  <p class="cv-thesis">Agent <b>=</b> Environment + Context + Model</p>
  <div class="cv-meta">余烬　·　2026 年 9 月</div>
</section>`;
const TOCPAGE = `<section class="tocpage">
  <h2 class="toc-h">目 录</h2>
  <ol class="toc-list">${toc.map(t => {
    const pg = tocPages[t.id];
    return `<li class="t${t.sub ? 4 : t.level}"><a href="#${t.id}"><span class="tt">${t.text.replace(/</g, '&lt;')}</span>${pg ? `<span class="dots"></span><span class="pg">${pg}</span>` : ''}</a></li>`;
  }).join('')}</ol>
</section>`;
const FRONT = COVER + '\n' + TOCPAGE;
const TOOLBAR = `<div class="toolbar"><strong>阅读增强</strong><label><input type="checkbox" id="em" checked> 强调 · 专名 · 边注</label><label><input type="checkbox" id="lt"> 白底（PDF 预览）</label><span>Markdown 源文件未改一字</span></div>`;

const html = `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="author" content="余烬">
<meta name="description" content="Agent = Environment + Context + Model：上下文原生智能（Context-Native Agent）">
<meta name="keywords" content="Agent 架构, 上下文工程, 上下文原生, 前缀缓存, Harness">
<title>Agent重架构：迈向上下文原生智能（Context-Native Agent）</title>
<style>${kcss}</style>
<style>${CSS}</style>
</head><body>
<div id="wrap">
<nav>${tocHtml}</nav>
<main>
${TOOLBAR}
${FRONT}
${body}
<footer>
  <span class="cl">版式说明</span>
  单文件离线版 · 由 <code>build-html.mjs</code> 从 Markdown 定稿渲染（文字逐字一致，仅渲染层加图与颜色）<br>
  版本：<code>${hash}</code> · 生成于 ${today}
</footer>
</main>
</div>
<script>${kjs}</script>
<script>${arjs}</script>
<script>
(function(){
  renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],throwOnError:false,ignoredTags:["script","noscript","style","textarea","pre","code","option"]});
  var cb=document.getElementById("em");
  if(cb)cb.addEventListener("change",function(){document.body.classList.toggle("no-em",!cb.checked);});
  var lt=document.getElementById("lt");
  if(lt)lt.addEventListener("change",function(){document.body.classList.toggle("light",lt.checked);});
  var links=[].slice.call(document.querySelectorAll("nav a"));
  var map={};links.forEach(function(a){map[a.getAttribute("href").slice(1)]=a;});
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.remove("on");});var a=map[e.target.id];if(a)a.classList.add("on");}})},{rootMargin:"-10% 0px -80% 0px"});
  document.querySelectorAll("h2[id],h3[id]").forEach(function(h){io.observe(h);});
})();
</script>
</body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('已写出: %s', OUT.split('/').pop());
console.log('  块 %d，目录项 %d（含正文导航组 %d），角标 %d，内联字体 %d 个', blocks.length, toc.length, toc.filter(t => t.sub).length, citeSeq, fontCount);
console.log('  封面 + 目录页：目录 %d 行（%d 个二级 / %d 个三级 / %d 个正文导航组）', toc.length, toc.filter(t => !t.sub && t.level === 2).length, toc.filter(t => !t.sub && t.level === 3).length, toc.filter(t => t.sub).length);
console.log('  体积 %s KB（其中 KaTeX CSS %s KB / JS %s KB）', (html.length / 1024).toFixed(0), (kcss.length / 1024).toFixed(0), ((kjs.length + arjs.length) / 1024).toFixed(0));
console.log('  自检：残留占位符 %d，残留 url(fonts/ %d，svg %d 个，表格 %d 个',
  (html.match(/\u0001|%%MN/g) || []).length, (html.match(/url\(fonts\//g) || []).length,
  (html.match(/<svg /g) || []).length, (html.match(/<table>/g) || []).length);
console.log('\n  阅读增强：强调 %d 处、专名 %d 处、等式 %d 处、边注 %d 处', R.em, R.term, R.eq, R.note);
for (const [k, ln, t] of R.hits.sort((a, b) => a[1] - b[1])) console.log('    ' + k + '  L' + ln + '  ' + t);
const allT = [...EQ.map(t => ['eq', t]), ...TERMS.map(t => ['term', t]), ...EM.map(t => ['em', t])];
const miss = allT.filter(([k, t]) => !R.cnt.get(k + '|' + t));
console.log(miss.length ? '  ✗ 未命中的目标：' + miss.map(([k, t]) => k + ':' + plainOf(t).slice(0, 20)).join(' | ') : '  ✓ 所有增强目标都已命中');
if (mnMiss.length) console.log('  ✗ 边注目标未解析：%s', mnMiss.join(' | '));
