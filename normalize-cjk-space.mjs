// normalize-cjk-space.mjs —— 中英混排空格统一（默认只干跑，不写盘）
//
//   node normalize-cjk-space.mjs            只打印将要做的改动（逐行 diff）
//   node normalize-cjk-space.mjs --write    写盘
//
// 规则：中文字与拉丁字母／数字（含 % 与上标 ² ³）直接相邻处，统一为**恰好一个半角空格**。
// 明确不碰：
//   · 全角标点与拉丁的邻接（，。（）等本身就是分隔，加空格反而错）
//   · 引用角标 汉[12]（`[` 不是拉丁字符，天然跳过）
//   · 行内代码 `…`、行内数学 $…$、链接目标 ](…)、HTML 标签 <…>
//   · 表格单元格两端的填充空格（内容变长时从末尾 | 前的填充里扣掉同样多，保住整表右缘）
//
// 唯一改动的字符是半角空格与制表符，**一个字都不会变**。
// 为什么需要它：渲染层不替我们加这个间距——build-html.mjs 里的 `text-spacing:normal`
// 在 Chromium 上不被支持（`CSS.supports` 返回 false），所以成品 PDF 里的中西文间距
// 完全来自源文件里的字面空格；源文件混着两种写法，PDF 就跟着一起不一致。
// 方向取"一律加"而不是"一律不加"：`.md` 本身也是发布物，而 GitHub 不认 `text-autospace`。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 文档目录默认取本脚本所在目录，可用 DOC_DIR 覆盖
const DIR = (process.env.DOC_DIR || path.dirname(fileURLToPath(import.meta.url))).split(path.sep).join('/');
const FILE = process.env.DOC_MD || DIR + '/Agent重架构：迈向上下文原生智能-Context-Native Agent.md';
const write = process.argv.includes('--write');

const CJK = '\\u4e00-\\u9fff';
const LAT = 'A-Za-z0-9%\\u00b2\\u00b3';   // 拉丁字母、数字、百分号、上标 ² ³

// 把一行切成「可改」与「受保护」的片段
function segments(line) {
  const out = [];
  let i = 0, buf = '';
  const flush = editable => { if (buf) { out.push({ text: buf, editable }); buf = ''; } };
  while (i < line.length) {
    const c = line[i];
    if (c === '`') {                                   // 行内代码
      let n = 1; while (line[i + n] === '`') n++;
      const fence = '`'.repeat(n);
      const end = line.indexOf(fence, i + n);
      if (end >= 0) { flush(true); out.push({ text: line.slice(i, end + n), editable: false }); i = end + n; continue; }
    }
    if (c === '$') {                                   // 数学（含货币 $ 误判；误判只会少改，不会改坏）
      const end = line.indexOf('$', i + 1);
      if (end > i) { flush(true); out.push({ text: line.slice(i, end + 1), editable: false }); i = end + 1; continue; }
    }
    if (c === ']' && line[i + 1] === '(') {            // 链接目标
      const end = line.indexOf(')', i + 2);
      if (end > i) { flush(true); out.push({ text: line.slice(i, end + 1), editable: false }); i = end + 1; continue; }
    }
    if (c === '<') {                                   // HTML 标签
      const end = line.indexOf('>', i + 1);
      if (end > i) { flush(true); out.push({ text: line.slice(i, end + 1), editable: false }); i = end + 1; continue; }
    }
    buf += c; i++;
  }
  flush(true);
  return out;
}

// 多空格压成一个，再在缺失处补一个；** 视为透明标记，空格插在标记外侧
function normalize(text) {
  text = text.replace(new RegExp(`([${CJK}])[ \\t]+(?=[${LAT}])`, 'g'), '$1 ');
  text = text.replace(new RegExp(`([${LAT}])[ \\t]+(?=[${CJK}])`, 'g'), '$1 ');
  text = text.replace(new RegExp(`([${CJK}])(?=[${LAT}])`, 'g'), '$1 ');
  text = text.replace(new RegExp(`([${LAT}])(?=[${CJK}])`, 'g'), '$1 ');
  text = text.replace(new RegExp(`([${CJK}])(\\*\\*)(?=[${LAT}])`, 'g'), '$1 $2');
  text = text.replace(new RegExp(`([${LAT}])(\\*\\*)(?=[${CJK}])`, 'g'), '$1$2 ');
  return text;
}

// 表格行：内容变长后，从末尾 | 前的填充里扣掉同样多的空格，保持整表右缘对齐
function compensateTable(next, grow) {
  const i = next.lastIndexOf('|');
  if (i < 0) return next;
  let j = i; while (j > 0 && next[j - 1] === ' ') j--;
  const take = Math.min(grow, i - j);
  return next.slice(0, j) + next.slice(j + take);
}

if (!fs.existsSync(FILE)) { console.error('找不到 Markdown：' + FILE); process.exit(1); }
const lines = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n').split('\n');
const changes = [];
const outLines = lines.map((line, idx) => {
  const segs = segments(line);
  let next = segs.map(s => s.editable ? normalize(s.text) : s.text).join('');
  if (next !== line && /^\s*\|.*\|\s*$/.test(line)) next = compensateTable(next, next.length - line.length);
  if (next !== line) changes.push({ n: idx + 1, before: line, after: next });
  return next;
});

const tbl = changes.filter(c => /^\s*\|/.test(c.before));
console.log('将改动 %d 行（全文 %d 行）；其中表格行 %d 行', changes.length, lines.length, tbl.length);
console.log('净增空格数合计：%d', changes.reduce((a, c) => a + (c.after.length - c.before.length), 0));
changes.forEach(c => {
  const b = c.before, a = c.after;
  let i = 0; while (i < b.length && b[i] === a[i]) i++;
  const from = Math.max(0, i - 22);
  console.log('L%d\n  − …%s…\n  + …%s…', c.n, b.slice(from, i + 30), a.slice(from, i + 30));
});
if (write) { fs.writeFileSync(FILE, outLines.join('\n'), 'utf8'); console.log('\n已写入。'); }
else console.log('\n（dry-run，未写盘；加 --write 落盘）');
