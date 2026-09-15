// build-html.mjs —— 把定稿 Markdown 渲染成自包含单文件 HTML
// 用法: node build-html.mjs
// 说明: 只读 Markdown，绝不修改它；KaTeX 与字体全部内联，离线可用。
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 文档目录默认取本脚本所在目录，可用 DOC_DIR 覆盖
const DIR = (process.env.DOC_DIR || path.dirname(fileURLToPath(import.meta.url))).split(path.sep).join('/');
const SRC = DIR + '/Agent架构革新：迈向上下文原生智能-Context-Native Agent.md';
const OUT = DIR + '/Agent架构革新：迈向上下文原生智能-Context-Native Agent.html';
// KaTeX 的 dist 目录：默认找本仓库的 node_modules，可用 KATEX_DIR 指向别处
const KATEX = process.env.KATEX_DIR || DIR + '/node_modules/katex/dist';
if (!fs.existsSync(KATEX + '/katex.min.css')) {
  console.error('找不到 KaTeX：' + KATEX);
  console.error('先 `npm i katex@0.16.47`，或用 KATEX_DIR 指向 katex/dist');
  process.exit(1);
}

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
  const isNum = (s, i) => i > 0 && /^[¥$]?\s?\d[\d,.]*\s?(k|M|%|倍|步|字|个|条|页)?$/.test(s.replace(/\*\*/g, ''));
  // 价格写法（如 ¥0.02 / M）强制不折行，否则窄列里会被折成两行
  const isPrice = s => /^[¥$]\s?\d[\d.,]*\s*\/\s*[kM]$/.test(s.trim());
  const cellCls = (c, i) => [colCls[i], isNum(c, i) ? 'numr' : '', isPrice(c) ? 'nw' : ''].filter(Boolean).join(' ');
  let h = `<div class="tw"><table${isRefTable ? ' class="reftable"' : ''}>`;
  h += '<thead><tr>' + head.map((c, i) => `<th class="${cellCls(c, i)}">${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
  for (const r of body) {
    let trAttr = '', first = null;
    if (isRefTable) {
      const m = (r[0] || '').match(/^\[(\d+)\]$/);
      if (m) { trAttr = ` id="ref-${m[1]}"`; first = m[1]; }
    }
    h += `<tr${trAttr}>` + r.map((c, i) => {
      if (i === 0 && first) return `<td class="refno ${colCls[i]}"><a href="#cite-${first}-1">[${first}]</a></td>`;
      return `<td class="${cellCls(c, i)}">${inline(c)}</td>`;
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
function chartArch() { // 一轮的动作：环境共享 · 代码 fork · 上下文 build · 合并后重写变动的那一段
  const W = 760, H = 286;
  const X0 = 170, BW = 126, GAP = 16, SPAN = BW * 4 + GAP * 3, XR = X0 + SPAN;
  const bx = i => X0 + i * (BW + GAP), cx = i => bx(i) + BW / 2;
  const loop = XR + 18;                      // 回环竖线，画在右侧留白里
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="上下文原生架构的一轮：共享前缀、四个分支、合并与更新前缀、新一版前缀">`;
  s += `<defs>`
    + `<marker id="arwA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arw"/></marker>`
    + `<marker id="arwB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9.5" markerHeight="9.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arwb"/></marker>`
    + `</defs>`;
  // 共享前缀：所有分支、所有轮次逐字节相同
  s += `<rect x="${X0}" y="16" width="${SPAN}" height="46" rx="4" class="cboxP"/>`;
  s += `<text x="${X0 + 16}" y="36" class="cl2">共享缓存前缀　P</text>`;
  s += `<text x="${X0 + 16}" y="54" class="cen">人设与工具　·　意图映射　·　系统状态</text>`;
  s += `<text x="${XR - 16}" y="42" class="cen" text-anchor="end">逐字节不变 → 缓存命中</text>`;
  // 环境：共享（分支跑在同一套环境里）
  s += `<rect x="${X0 - 8}" y="84" width="${SPAN + 16}" height="128" rx="6" class="cenv"/>`;
  s += `<text x="${X0 + 2}" y="80" class="cen">环境共享</text>`;
  // 主 Agent：把种子委派给分支行
  s += `<rect x="4" y="94" width="112" height="96" rx="4" class="cbox"/>`;
  s += `<text x="60" y="120" class="cn" text-anchor="middle">主 Agent</text>`;
  s += `<text x="60" y="144" class="cbs" text-anchor="middle">对齐需求</text>`;
  s += `<text x="60" y="162" class="cbs" text-anchor="middle">拆分任务</text>`;
  s += `<text x="60" y="180" class="cbs" text-anchor="middle">定契约与断言</text>`;
  s += `<text x="139" y="138" class="cn2" text-anchor="middle">委派</text>`;
  s += `<line x1="116" y1="142" x2="${X0 - 1}" y2="142" class="cflow" marker-end="url(#arwA)"/>`;
  // 四个分支
  for (let i = 0; i < 4; i++) {
    s += `<line x1="${cx(i)}" y1="62" x2="${cx(i)}" y2="90" class="cflow" marker-end="url(#arwA)"/>`;
    s += `<rect x="${bx(i)}" y="94" width="${BW}" height="96" rx="4" class="cbox"/>`;
    s += `<text x="${cx(i)}" y="120" class="cn" text-anchor="middle">分支 ${i + 1}</text>`;
    s += `<text x="${cx(i)}" y="148" class="cbs" text-anchor="middle">fork 代码</text>`;
    s += `<text x="${cx(i)}" y="168" class="cbs" text-anchor="middle">build 种子</text>`;
    s += `<line x1="${cx(i)}" y1="190" x2="${cx(i)}" y2="232" class="cflow" marker-end="url(#arwA)"/>`;
  }
  // 合并与更新前缀
  s += `<rect x="${X0}" y="236" width="${SPAN}" height="38" rx="4" class="cbox"/>`;
  s += `<text x="${X0 + 16}" y="260" class="cn">单写者合并　·　重写意图映射 M</text>`;
  s += `<text x="${XR - 16}" y="260" class="cen" text-anchor="end">Harness 分段装配</text>`;
  // 回到前缀：新一版前缀成为下一轮的公共前缀（箭头止于前缀右边界，不入框）
  s += `<polyline points="${XR},255 ${loop},255 ${loop},39 ${XR},39" class="cloop" marker-end="url(#arwB)"/>`;
  return s + '</svg>';
}
function figure(svg, cap) { return `<figure class="fig">${svg}<figcaption>${cap}</figcaption></figure>`; }

/* ---------------- 4.5 第 1 层阅读增强（装置的形状由渲染层给，选哪句由作者在 Markdown 里加粗决定） ----------------
   胶囊是一种装置、两种宽度：作者写 **重点**，≥12 字渲染成整句主张（宽胶囊），<12 字渲染成短语/术语（窄胶囊），
   列表标号（推论1：…）保持纯加粗。强调因此不再靠渲染层里的一份字面量表——作者改一个字，胶囊会跟着走，不会静默失效。 */
const LQ = String.fromCharCode(0x201c), RQ = String.fromCharCode(0x201d);
const CAP_MIN = 12;            // 12 字（含）以上算“一整句话”
const CAP_LABEL = /^推论/;      // 推论1/2/3/3′ 是列表标号，不是主张
const TERMS = [
  '[ Environmental View ] + [ Project Structure and Intention Mapping ] + [ Raw Files Assigned ]',
  `AI native ${LQ}Git tree${RQ}`,
];
const MNOTES = [
  ['全部子Agent回归后', 'A2.4', '这笔账怎么算'],
  ['在缓存利用层面', 'A3.4', '41 个字符的缓存崩塌'],
  ['而对于我们这套Git架构', 'A3.4', '同类踩坑：N² 写冲突'],
];
const R = { cap: 0, wide: 0, term: 0, note: 0, hits: [], cnt: new Map() };
const bump = (type, t, n = 1) => { const k = type + '|' + t; R.cnt.set(k, (R.cnt.get(k) || 0) + n); };
const plainOf = s => s.replace(/<[^>]+>/g, '');
function enhance(html, plain, ln) {
  let h = html;
  TERMS.forEach(t => {
    const n = h.split(t).length - 1;
    if (n) { bump('term', t, n); R.term += n; R.hits.push(['专名', ln, plainOf(t).slice(0, 26) + (n > 1 ? ' ×' + n : '')]); h = h.split(t).join('<span class="term">' + t + '</span>'); }
  });
  // 胶囊：作者写在 Markdown 里的 **加粗** 就是强调，渲染层只决定这个胶囊有多宽
  h = h.replace(/<strong>([^<]+)<\/strong>/g, (m, t) => {
    if (CAP_LABEL.test(t)) return m;
    const wide = t.length >= CAP_MIN;
    R.cap++; if (wide) R.wide++;
    R.hits.push([wide ? '主张·宽胶囊' : '标记·窄胶囊', ln, t.slice(0, 34) + (t.length > 34 ? '…' : '') + '（' + t.length + '字）']);
    return '<span class="' + (wide ? 'claim' : 'em') + '">' + t + '</span>';
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
    let h = '<p' + idAttr + '>' + b.lines.map(inline).join('<br>') + '</p>';
    if (curSection.startsWith('正文')) h = enhance(h, plain, b.ln);
    out.push(h);
    // 架构拓扑图：紧跟在“以这一理念出发……”这一句之后，正文一字未动
    if (curSection.startsWith('正文') && plain.startsWith('以这一理念出发')) {
      out.push(figure(chartArch(), '图 3　一轮的动作：环境维持共享、代码 fork、上下文 build。全部子 Agent 回归后由主 Agent 单写者合并，并重写需要模型更新的那一段，其余各段由 Harness 从环境取出、分段装配成新一版前缀。没变的字节照旧命中缓存；分支的上下文随分支消失，原文留在 git 里。数据源：正文“具体实现”一节。'));
    }
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
    if (isLevelsTable) out.push(figure(chartLevels(), '图 2　三种活法与本架构的对比。31% 一档是实测中人工停手的位置（中位 30.9%）；@8% 一档是基线按钱算出的最优点，工程上不可达、实测里没有人能走到；本架构一档取 20% 水位、4 分支、更新量 10k。数据源：附录2 A2.4 / A2.5。'));
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

// 版本戳：直接问 git 要短哈希。比"读 .git/HEAD 再解引用"可靠——refs 一旦被 gc 打包，
// .git/refs/heads/<branch> 就不存在了，那时只会印出 "ref: re" 这种半截串。
let hash = 'unknown';
try {
  hash = execSync('git rev-parse --short=7 HEAD', { cwd: DIR, encoding: 'utf8' }).trim() || 'unknown';
} catch (e) { hash = 'unknown'; }
const today = new Date().toISOString().slice(0, 10);

const CSS = `
/* ---- 设计变量：屏幕为暖白纸，打印为纯白；强调一律中性底色、不用彩色高亮 ---- */
:root{
  --paper:#fbfaf7;--ink:#1b1b1b;--ink-soft:#3c3c3c;--muted:#7a756d;
  --rule:#e0ddd5;--rule-ink:#2a2a2a;--tint:#f2f0ea;--tint-2:#e6e1d5;
  --accent:#3f5f7f;--base:#c6c2b9;
  --sans:"Noto Sans SC","Source Han Sans SC","Microsoft YaHei",system-ui,sans-serif;
  --serif:"Noto Serif SC","Source Han Serif SC",Georgia,serif;
  --mono:"Cascadia Mono","Source Code Pro",ui-monospace,Consolas,monospace;
  --measure:150mm;--mo:-12.5em;--mw:11em;
}
@media (prefers-color-scheme:dark){:root{--paper:#15171a;--ink:#e8e6e1;--ink-soft:#cfccc6;--muted:#9aa0a6;--rule:#2e3238;--rule-ink:#d8d5cf;--tint:#23262b;--tint-2:#30343a;--accent:#8fb0d4;--base:#4a5158}}
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
td.nw,th.nw{white-space:nowrap}
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
/* 紧跟在胶囊后面的角标要拉开一点，否则上标的方括号会贴到胶囊右缘，看起来像被一起涂了底 */
.claim + a.cite,.em + a.cite{margin-left:.16em}
a.anchor{opacity:0;margin-left:.4em;color:var(--muted);text-decoration:none;font-size:.8em}
h2:hover a.anchor,h3:hover a.anchor{opacity:1}
.fig{margin:1.4em 0 1.7em;padding:6px 0 2px}
.toolbar{display:flex;gap:16px;align-items:center;font-size:12.5px;color:var(--muted);background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:7px 12px;margin:0 0 26px}
.toolbar strong{color:var(--ink);font-weight:600}
.toolbar label{cursor:pointer;color:var(--ink);display:flex;gap:6px;align-items:center}
/* ---- 强调（胶囊）：一种装置、两种宽度——窄胶囊给短语与术语，宽胶囊给整句主张；套色一律中性，不抢注意力 ----
   两个内边距都是量出来的：①宽胶囊常整句落在行尾，左右内边距稍大就顶出版心（0.34em 时右溢 3px）；
   ②竖直内边距每多一分，同一段里相邻两行的胶囊就靠近一分（0.1em 时只隔 3px，连读像给整段加了底），
   所以宽胶囊竖直归零——底色带正好贴住字身框，相邻行之间留出约 2mm 白缝。 */
.em{font-weight:700;background:var(--tint);border-radius:2px;padding:.02em .2em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.claim{font-weight:700;background:var(--tint-2);border-radius:2px;padding:0 .09em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.term{font-family:var(--mono);background:var(--tint);border-radius:3px;padding:.1em .34em;font-size:.87em}
/* ---- 页边注：屏幕上落在正文右侧留白、与所注段落首行齐平 ----
   注意：PDF 导出时会丢弃落在版心外的绝对定位元素，所以打印时改为紧贴该段落上方的一行灰色小注 ---- */
.mnote{position:absolute;top:.42em;right:var(--mo);width:var(--mw);font-size:10.5px;line-height:1.5;color:var(--muted);text-decoration:none;text-align:left;border-top:1px solid var(--rule);padding-top:3px}
.mnote .mn-t{display:block;font-weight:600;letter-spacing:.02em;color:var(--ink-soft)}
.mnote:hover .mn-t{text-decoration:underline}
p,li{position:relative}
body.no-em .em,body.no-em .claim{font-weight:inherit;background:none;padding:0}
body.no-em .term{font-family:inherit;background:none;padding:0;font-size:inherit}
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
body.light{--paper:#fff;--ink:#111;--ink-soft:#333;--muted:#666;--rule:#dcd9d2;--rule-ink:#222;--tint:#f2efe9;--tint-2:#e6e1d5;--accent:#33556f;--base:#c6c2b9;--mo:-30mm;--mw:24mm;color-scheme:light}
body.light .cover,body.light .tocpage{display:block}
body.light main{max-width:var(--measure);padding-top:0}
body.light .doc-title,body.light p.doc-author{display:none}
body.light .toolbar{margin:18px 0 30px}
@page{size:A4;margin:22mm 38mm 20mm 22mm}
@media print{
  :root,body.light{--paper:#fff;--ink:#111;--ink-soft:#333;--muted:#666;--rule:#dcd9d2;--rule-ink:#222;--tint:#f2efe9;--tint-2:#e6e1d5;--accent:#33556f;--base:#c6c2b9;--mo:-30mm;--mw:24mm;color-scheme:light}
  html,body{background:#fff !important;color:#111 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body,main,p,li,td,th,h1,h2,h3,blockquote,figcaption,ol.toc-list,.cv-meta,.mnote{font-family:var(--sans) !important}
  .cv-title{font-family:var(--serif) !important}
  nav,.toolbar{display:none !important}
  #wrap{display:block;max-width:none;padding:0}
  main{max-width:none;padding:0;font-size:10.5pt;line-height:1.75}
  main h2{font-size:13.5pt;margin:12mm 0 4mm}
  main h3{font-size:11.5pt;color:#111;margin:7mm 0 2.5mm}
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
  /* 表格允许跨页。整表不拆的代价实测很大：A3.2 / A3.4 / A3.6 三张表会被整张推到下一页，
     分别留出 67 / 95 / 154 mm 的空白。行仍然不拆，表头设成 table-header-group，跨页时每页重印。 */
  tr,.callout,.fig{break-inside:avoid;page-break-inside:avoid}
  table{break-inside:auto;page-break-inside:auto}
  thead{display:table-header-group}
  .fig{break-inside:avoid}
  a{color:var(--ink);text-decoration:none}
  a.cite{color:#33556f}
  .mnote{position:static;display:block;width:auto;top:auto;right:auto;text-align:right;font-size:8pt;line-height:1.45;
         color:#6b6b6b;border-top:0;padding:0;margin:0 0 .45em}
  .mnote .mn-t{display:inline;color:#6b6b6b;font-weight:600;letter-spacing:.02em}
  .mnote .mn-t::after{content:"　"}
  .em{background:#f2efe9}
  .claim{background:#e6e1d5}
  .term{background:#f2efe9}
  blockquote.callout{background:#f2efe9;border-left-color:#b9b4ac}
  figcaption{font-size:8.5pt;line-height:1.5}
  .fig svg{break-inside:avoid}
  footer{page-break-before:avoid;break-inside:avoid;page-break-inside:avoid;font-size:8.5pt}
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
.cboxP{fill:var(--tint-2);stroke:var(--rule-ink);stroke-width:1}
.cbox{fill:var(--tint);stroke:var(--rule-ink);stroke-width:1}
.cenv{fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:4 4}
.cflow{stroke:var(--rule-ink);stroke-width:1;fill:none}
.cflowD{stroke:var(--muted);stroke-width:1;stroke-dasharray:3 3;fill:none}
.cloop{stroke:var(--accent);stroke-width:1.5;fill:none}
.cn{font-size:14px;fill:var(--ink);font-weight:600}
.cbs{font-size:13px;fill:var(--muted)}
.cen{font-size:13.5px;fill:var(--muted);letter-spacing:.03em}
.arw{fill:var(--rule-ink)}
.arwb{fill:var(--accent)}
.cn2{font-size:14px;fill:var(--muted);letter-spacing:.06em}
/* 前缀名与专名的细线提示 */
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
const TOOLBAR = `<div class="toolbar"><strong>阅读增强</strong><label><input type="checkbox" id="em" checked> 胶囊 · 专名 · 边注</label><label><input type="checkbox" id="lt"> 白底（PDF 预览）</label><span>文字未改一字，强调取自 Markdown 的加粗</span></div>`;

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
  单文件离线版 · 文字与 Markdown 逐字一致 · 版本 <code>${hash}</code> · ${today}
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
console.log('  块 %d，目录项 %d，角标 %d，内联字体 %d 个', blocks.length, toc.length, citeSeq, fontCount);
console.log('  封面 + 目录页：目录 %d 行（%d 个二级 / %d 个三级）', toc.length, toc.filter(t => t.level === 2).length, toc.filter(t => t.level === 3).length);
console.log('  体积 %s KB（其中 KaTeX CSS %s KB / JS %s KB）', (html.length / 1024).toFixed(0), (kcss.length / 1024).toFixed(0), ((kjs.length + arjs.length) / 1024).toFixed(0));
console.log('  自检：残留占位符 %d，残留 url(fonts/ %d，svg %d 个，表格 %d 个',
  (html.match(/\u0001|%%MN/g) || []).length, (html.match(/url\(fonts\//g) || []).length,
  (html.match(/<svg /g) || []).length, (html.match(/<table>/g) || []).length);
console.log('\n  阅读增强：胶囊 %d 处（其中整句主张 %d、短语标记 %d）、专名 %d 处、边注 %d 处',
  R.cap, R.wide, R.cap - R.wide, R.term, R.note);
for (const [k, ln, t] of R.hits.sort((a, b) => a[1] - b[1])) console.log('    ' + k + '  L' + ln + '  ' + t);
const miss = TERMS.filter(t => !R.cnt.get('term|' + t));
console.log(miss.length ? '  ✗ 未命中的目标：' + miss.map(t => plainOf(t).slice(0, 20)).join(' | ') : '  ✓ 专名目标都已命中');
if (mnMiss.length) console.log('  ✗ 边注目标未解析：%s', mnMiss.join(' | '));
