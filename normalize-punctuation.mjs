// normalize-punctuation.mjs —— 中文标点规范化（默认只干跑，不写盘）
//
//   node normalize-punctuation.mjs                     只打印将要做的替换
//   node normalize-punctuation.mjs --write              全部写入
//   node normalize-punctuation.mjs --write --papers-only 只改附录2/3（附录是 AI 主导的部分）
//
// 规则：
//   1. 行内 ASCII 直引号 " 成对出现时，按出现次序换成 “ ”；出现奇数次的行会被跳过并报出来
//      （不做猜测，避免把开引号写成闭引号）。
//   2. ASCII 省略号 ... 换成中文省略号 ……
// 只读/写 Markdown 源文件本身，不碰渲染层。
import fs from 'node:fs';

const FILE = 'C:/Users/Administrator/Desktop/Context-Native Agent/Agent架构革新：迈向上下文原生智能-Context-Native Agent.md';
const args = process.argv.slice(2);
const write = args.includes('--write');
const papersOnly = args.includes('--papers-only');
const raw = fs.readFileSync(FILE, 'utf8');
const lines = raw.replace(/\r\n/g, '\n').split('\n');

const LQ = '\u201C', RQ = '\u201D', ELL = '\u2026\u2026';
const APPENDIX_FROM = 166;   // 附录1 起（附录2/3 在其后）

let quoteLines = 0, quotes = 0, ellLines = 0, ells = 0, skipped = [];
const out = lines.map((s, i) => {
  const n = i + 1;
  if (papersOnly && n < APPENDIX_FROM) return s;
  if (!s.includes('"') && !s.includes('...')) return s;
  let t = s;
  const nq = (t.match(/"/g) || []).length;
  if (nq) {
    if (nq % 2) { skipped.push([n, nq, t.slice(0, 70)]); return s; }
    let k = 0;
    t = t.replace(/"/g, () => (++k % 2 ? LQ : RQ));
    quoteLines++; quotes += nq;
  }
  const ne = (t.match(/\.\.\./g) || []).length;
  if (ne) { t = t.replace(/\.\.\./g, ELL); ellLines++; ells += ne; }
  if (t !== s) console.log('L%d\n  − %s\n  + %s', n, s, t);
  return t;
});

console.log('\n小结：直引号替换 %d 行 / %d 个；省略号替换 %d 行 / %d 个；因奇数个引号跳过 %d 行',
  quoteLines, quotes, ellLines, ells, skipped.length);
skipped.forEach(([n, c, s]) => console.log('  跳过 L%d（%d 个引号）：%s', n, c, s));
if (!write) { console.log('\n（干跑，未写盘。加 --write 才会写入）'); process.exit(0); }
fs.writeFileSync(FILE, out.join('\n'), 'utf8');
console.log('\n已写入 %s', FILE.split('/').pop());
