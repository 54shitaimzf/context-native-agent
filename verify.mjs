// _verify.mjs —— 交付校验：Markdown 每一行的文字是否都出现在 HTML 里（去掉 Markdown 语法标记后比对）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// 文档目录默认取本脚本所在目录，可用 DOC_DIR 覆盖
const DIR = (process.env.DOC_DIR || path.dirname(fileURLToPath(import.meta.url))).split(path.sep).join('/');
const SRC = DIR + '/Agent重架构：迈向上下文原生智能-Context-Native Agent.md';
const OUT = DIR + '/Agent重架构：迈向上下文原生智能-Context-Native Agent.html';
const md = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n').split('\n');
const html = fs.readFileSync(OUT, 'utf8');

const body = html.slice(html.indexOf('<main>'), html.indexOf('<footer>'));
const text = body.replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const norm = s => s.replace(/\s+/g, '');
const H = norm(text);

let miss = [], checked = 0;
for (let i = 0; i < md.length; i++) {
  let l = md[i];
  if (!l.trim()) continue;
  if (/^\|[\s:|-]+\|$/.test(l.trim())) continue;    // 表格分隔行
  l = l.replace(/^#{1,4}\s+/, '').replace(/^>\s?/, '').replace(/^-\s+/, '').replace(/^\d+\.\s+/, '');
  l = l.split('|').join('')                          // 表格的竖线是语法
       .replace(/`/g, '')                            // 行内代码的反引号是语法
       .replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, m => m.replace(/\*/g, '\u0001')) // 数学里的 * 保留
       .split('*').join('').split('\u0001').join('*');
  const key = norm(l);
  if (key.length < 6) continue;
  checked++;
  if (!H.includes(key)) miss.push((i + 1) + ': ' + l.slice(0, 70));
}
console.log('文字核对：Markdown 有内容的行 %d，其中比对 %d 行，未命中 %d 行', md.filter(l => l.trim()).length, checked, miss.length);
miss.slice(0, 15).forEach(m => console.log('   ✗ ' + m));

const cite = (html.match(/class="cite"/g) || []).length;
const ids = new Set((html.match(/id="cite-\d+-\d+"/g) || []).map(s => s.match(/cite-(\d+)-(\d+)/).slice(1, 3).join('-')));
const refs = new Set((html.match(/id="ref-\d+"/g) || []).map(s => s.match(/ref-(\d+)/)[1]));
const back = new Set((html.match(/href="#cite-(\d+)-1"/g) || []).map(s => s.match(/cite-(\d+)-1/)[1]));
console.log('引用：角标 %d 个、唯一角标 %d 个、条目 %d 条、有反向链接的条目 %d 条', cite, ids.size, refs.size, back.size);
const missing = [...refs].filter(n => !back.has(n));
if (missing.length) console.log('   ✗ 缺反向链接的条目：' + missing.join(','));
const maxRef = Math.max(...[...refs].map(Number));
const orphan = [...Array(maxRef)].map((_, i) => String(i + 1)).filter(n => !refs.has(n));
if (orphan.length) console.log('   ✗ 缺条目的角标：' + orphan.join(','));

const tables = html.match(/<table[^>]*>[\s\S]*?<\/table>/g) || [];
let bad = 0;
for (const t of tables) {
  const cols = (t.match(/<tr[^>]*>/g) || []).map(() => 0);
  const rows = t.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const counts = rows.map(r => (r.match(/<t[dh][^>]*>/g) || []).length);
  if (new Set(counts).size > 1) { bad++; console.log('   ✗ 列数不一致的表：' + counts.join('/')); }
}
console.log('表格：%d 块，列数不一致 %d 块', tables.length, bad);

const ids2 = new Set((html.match(/id="[^"]+"/g) || []).map(s => s.slice(4, -1)));
const hrefs = [...new Set((html.match(/href="#[^"]+"/g) || []).map(s => s.slice(7, -1)))];
const dead = hrefs.filter(h => !ids2.has(h));
const kinds = { toc: 0, cite: 0, ref: 0, other: 0 };
for (const h of hrefs) {
  if (/^(sec|grp)-/.test(h)) kinds.toc++;          // 目录与正文导航组；页边注也指向这些锚点，不额外计数
  else if (/^cite-/.test(h)) kinds.cite++;
  else if (/^ref-/.test(h)) kinds.ref++;
  else kinds.other++;
}
console.log('内部链接：%d 个目标（目录与锚点 %d + 角标 %d + 回链 %d + 其他 %d），悬空 %d 个',
  hrefs.length, kinds.toc, kinds.cite, kinds.ref, kinds.other, dead.length);
if (dead.length) console.log('   ✗ 找不到锚点：' + dead.slice(0, 10).join(','));

const mnote = (html.match(/class="mnote"/g) || []).length;
const cover = html.includes('class="cover"'), toc = (html.match(/class="t\d"/g) || []).length;
console.log('版面件：封面 %s、目录 %d 行、页边注 %d 条、图 %d 张、胶囊 %d 处（整句 %d / 短语 %d）、专名 %d 处',
  cover ? '有' : '无', toc, mnote, (html.match(/<figure/g) || []).length,
  (html.match(/class="em"|class="claim"/g) || []).length,
  (html.match(/class="claim"/g) || []).length, (html.match(/class="em"/g) || []).length,
  (html.match(/class="term"/g) || []).length);
const visible = body.replace(/<[^>]*>/g, '').replace(/\$\$[\s\S]*?\$\$|\$[^\$\n]*\$/g, ''); // 数学是 KaTeX 源码，不算可见文字
console.log('残留占位符：%d，正文可见的字面星号：%d', (html.match(/\u0001|%%MN/g) || []).length, (visible.match(/\*/g) || []).length);

/* ---- 成品 PDF 的文字落点：确认版心确实是 22–172mm，没有被叠加成双重边距 ---- */
const PDF = DIR + '/Agent重架构：迈向上下文原生智能-Context-Native Agent.pdf';
if (fs.existsSync(PDF)) {
  const zlib = await import('node:zlib');
  const buf = fs.readFileSync(PDF);
  const s = buf.toString('latin1');
  const pages = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const links = (s.match(/\/Subtype\s*\/Link/g) || []).length;
  const fonts = [...new Set((s.match(/\/BaseFont\s*\/([A-Za-z0-9+\-]+)/g) || []).map(x => x.replace(/.*\//, '')))];
  let xs = [], ys = [], rects = [], n = 0;
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    if (end < 0) continue;
    let out;
    try { out = zlib.inflateSync(Buffer.from(s.slice(start, end), 'latin1')).toString('latin1'); } catch { continue; }
    if (!/\bre\b/.test(out)) continue;
    n++;
    for (const r of out.matchAll(/([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+re\b/g)) {
      rects.push([+r[1], +r[2], +r[3], +r[4]]);
    }
  }
  const pt2mm = p => +(p / 72 * 25.4).toFixed(1);
  const tally = new Map();
  for (const [x, y, w, h] of rects) {
    const k = pt2mm(x) + '|' + pt2mm(w);
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log('PDF：%d 页、%d 个链接、内嵌字体 %s', pages, links, fonts.join(' / '));
  console.log('   矢量矩形 %d 个（内容流 %d 个），最常见的「左边距|宽度」= %s',
    rects.length, n, top.map(([k, c]) => k + 'mm×' + c).join('  '));

}

/* ---- 目录页码 vs 链接目标：目录印的页码，必须等于读者点下去会到的那一页 ----
   文本反查对短标题会误判（「具体实现」在正文行文里先出现一次，页码就被记到那一页），
   所以这里的权威来源是锚点自己的目标页；build-pdf.mjs 的 tocpages 也按同一口径生成。 */
{
  const buf = fs.readFileSync(PDF).toString('latin1');
  const objs = new Map();
  const re = /(\d+)\s+0\s+obj\b/g;
  let m;
  while ((m = re.exec(buf))) {
    const end = buf.indexOf('endobj', m.index + m[0].length);
    if (end < 0) continue;
    let b = buf.slice(m.index + m[0].length, end);
    const si = b.indexOf('stream');
    if (si >= 0) b = b.slice(0, si);
    objs.set(+m[1], b);
  }
  let root = null, destBody = null;
  for (const [num, b] of objs) {
    if (root === null && /\/Type\s*\/Pages/.test(b) && !/\/Parent/.test(b)) root = num;
    if (destBody === null && /\/sec-1\s*\[/.test(b)) destBody = b;
  }
  const pageObjs = [];
  const walk = num => {
    const b = objs.get(num) || '';
    const k = b.match(/\/Kids\s*\[([^\]]*)\]/);
    if (!k) { pageObjs.push(num); return; }
    for (const r of k[1].matchAll(/(\d+)\s+0\s+R/g)) walk(+r[1]);
  };
  if (root !== null) walk(root);
  const pageOf = new Map(pageObjs.map((num, i) => [num, i + 1]));
  const dest = new Map();
  if (destBody) {
    for (const r of destBody.matchAll(/\/([A-Za-z0-9_.\-]+)\s*\[\s*(\d+)\s+0\s+R\s*\/[A-Za-z]+/g)) {
      const p = pageOf.get(+r[2]);
      if (p) dest.set(r[1], p);
    }
  }
  const toc = JSON.parse(fs.readFileSync(DIR + '/_tocpages.json', 'utf8'));
  const bad2 = Object.entries(toc).filter(([id, want]) => dest.get(id) !== want);
  console.log('目录页码 vs 链接目标：%d 条，不一致 %d 条 %s',
    Object.keys(toc).length, bad2.length,
    bad2.map(([id, w]) => id + '(印 ' + w + ' → 链接 ' + dest.get(id) + ')').join(' '));
}

