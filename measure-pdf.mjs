// _bbox.mjs —— 用 pdftotext -bbox 量成品 PDF 的真实文字边界（不靠肉眼）
import { spawnSync } from 'node:child_process';
const PT = 'D:/texlive/2024/bin/windows/pdftotext.exe';
const PINFO = 'D:/texlive/2024/bin/windows/pdfinfo.exe';
const f = process.argv[2] || 'C:/Users/Administrator/Desktop/Context-Native Agent/Agent架构革新：迈向上下文原生智能-Context-Native Agent.pdf';
const info = spawnSync(PINFO, [f], { encoding: 'utf8' }).stdout || '';
const pages = +((info.match(/Pages:\s+(\d+)/) || [])[1] || 0);
const out = spawnSync(PT, ['-bbox', f, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).stdout || '';
const mm = p => +(p / 72 * 25.4).toFixed(1);
const parts = out.split('<page ').slice(1);
let minX = 1e9, maxX = 0, bad = [], footMin = 1e9, footMax = 0, noteMin = 1e9, noteMax = 0;
const rows = [];
parts.forEach((p, i) => {
  const ws = Array.from(p.matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g))
    .map(m => m.slice(1, 5).map(Number));
  if (!ws.length) { rows.push([i + 1, 0, '-', '-', '-', '-']); return; }
  const foot = ws.filter(w => w[1] > 275 * 72 / 25.4);
  const note = ws.filter(w => w[0] > 174 * 72 / 25.4);
  const body = ws.filter(w => w[1] <= 275 * 72 / 25.4 && w[0] <= 174 * 72 / 25.4);
  const lo = Math.min(...body.map(w => w[0])), hi = Math.max(...body.map(w => w[2]));
  minX = Math.min(minX, lo); maxX = Math.max(maxX, hi);
  if (foot.length) { footMin = Math.min(footMin, Math.min(...foot.map(w => w[0]))); footMax = Math.max(footMax, Math.max(...foot.map(w => w[2]))); }
  if (note.length) { noteMin = Math.min(noteMin, Math.min(...note.map(w => w[0]))); noteMax = Math.max(noteMax, Math.max(...note.map(w => w[2]))); }
  const top = Math.min(...body.map(w => w[1])), bot = Math.max(...body.map(w => w[3]));
  rows.push([i + 1, ws.length, mm(lo), mm(hi), mm(top), mm(bot)]);
});
console.log('pdfinfo 页数 %d · bbox 解析到 %d 页', pages, parts.length);
console.log('正文文字横向 %s – %s mm（期望 22.0 – 172.0）', mm(minX), mm(maxX));
if (footMax) console.log('页脚文字横向 %s – %s mm（应在 22 – 172 之内）', mm(footMin), mm(footMax));
if (noteMax) console.log('页边注横向 %s – %s mm（期望 178 – 202）', mm(noteMin), mm(noteMax));
console.log('页  词数    左     右     上     下');
for (const r of rows) console.log(String(r[0]).padStart(3) + String(r[1]).padStart(7) + String(r[2]).padStart(7) + String(r[3]).padStart(7) + String(r[4]).padStart(7) + String(r[5]).padStart(7));
