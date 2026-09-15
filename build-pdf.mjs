// build-pdf.mjs —— 用浏览器 DevTools 协议把 HTML 定稿导出 A4 PDF，并可分页截图自查
//
//   node build-pdf.mjs                导出 PDF
//   node build-pdf.mjs shots 关键词…   把包含这些关键词的那一页截成 PNG（放在 _shots/）
//
// 与手工"打印→另存为 PDF"的区别：能精确设定页边距、注入页码页脚、逐页核对版式。
// 只读 HTML，不改 Markdown。
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DIR = 'C:/Users/Administrator/Desktop/Context-Native Agent';
const HTML = DIR + '/Agent架构革新：迈向上下文原生智能-Context-Native Agent.html';
const PDF = DIR + '/Agent架构革新：迈向上下文原生智能-Context-Native Agent.pdf';
const SHOTS = DIR + '/_shots';
const PROFILE = DIR + '/.pdfprofile';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;

/* A4 与页边距：与 build-html.mjs 里的 @page 保持一致（上 / 右 / 下 / 左） */
const MM = { top: 22, right: 38, bottom: 20, left: 22 };
const IN = mm => +(mm / 25.4).toFixed(4);
const PAGE_W = 794, PAGE_H = 1123; // A4 @96dpi

/* ---------- 极简 CDP 客户端 ---------- */
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.method + ' ' + JSON.stringify(m.error))) : res(m.result);
      } else if (m.method) {
        const h = this.handlers.get(m.method); if (h) h(m.params);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id, msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify(msg)); });
  }
  once(method) { return new Promise(res => this.handlers.set(method, p => { this.handlers.delete(method); res(p); })); }
  async eval(sessionId, expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForDevtools(timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('DevTools 端口未就绪');
}

async function withBrowser(fn) {
  fs.mkdirSync(PROFILE, { recursive: true });
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, 'about:blank'];
  const proc = spawn(EDGE, args, { stdio: ['ignore', 'ignore', fs.openSync(DIR + '/_edge.log', 'w')], detached: false });
  try {
    const ver = await waitForDevtools();
    const ws = new WebSocket(ver.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const cdp = new CDP(ws);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: pathToFileURL(HTML).href }, sessionId);
    await loaded;
    // 等 KaTeX 渲染完 + 字体就绪
    await cdp.eval(sessionId, `document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,400))))`);
    await cdp.eval(sessionId, `new Promise(r=>{var n=0,f=()=>{var k=document.querySelectorAll('.katex').length;n++;k>0||n>40?r(k):setTimeout(f,150)};f()})`);
    const info = await cdp.eval(sessionId, `JSON.stringify({katex:document.querySelectorAll('.katex').length,
      cover:!!document.querySelector('.cover'),toc:document.querySelectorAll('.toc-list li').length,
      mnotes:document.querySelectorAll('.mnote').length,tables:document.querySelectorAll('table').length,
      figs:document.querySelectorAll('figure.fig').length,cites:document.querySelectorAll('a.cite').length})`);
    await fn(cdp, sessionId);
    ws.close();
    return JSON.parse(info);
  } finally {
    try { proc.kill(); } catch { }
    await sleep(300);
  }
}

/* ---------- 模拟 A4 分页，便于逐页截图核对 ---------- */
const A4_SIM = `
  html{background:#9aa0a6 !important}
  body{width:210mm !important;margin:0 auto !important;background:#fff !important;
       padding:${MM.top}mm ${MM.right}mm ${MM.bottom}mm ${MM.left}mm !important;box-sizing:border-box !important;
       box-shadow:0 0 0 1px #666 !important}
  #wrap{display:block !important;max-width:none !important;padding:0 !important}
  main{max-width:none !important;padding:0 !important}
  nav,.toolbar{display:none !important}
  .cover{display:flex !important;flex-direction:column !important;min-height:248mm !important;padding-top:0 !important}
  .tocpage{display:block !important}
  .doc-title,p.doc-author{display:none !important}
  .cover{break-after:auto !important;page-break-after:auto !important}
  .tocpage{break-after:auto !important;page-break-after:auto !important}`;

async function applySim(cdp, sessionId) {
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: PAGE_W, height: PAGE_H, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cdp.eval(sessionId, `(function(){var s=document.createElement('style');s.id='a4sim';s.textContent=${JSON.stringify(A4_SIM)};document.head.appendChild(s);})()`);
  await sleep(300);
}

async function mode_shots(cdp, sessionId, keys) {
  await applySim(cdp, sessionId);
  fs.mkdirSync(SHOTS, { recursive: true });
  const total = await cdp.eval(sessionId, `Math.ceil(document.documentElement.scrollHeight/${PAGE_H})`);
  console.log('  模拟分页共 %d 页（%d×%d px/页）', total, PAGE_W, PAGE_H);
  const jobs = [['__top__', 0]].concat(keys.map(k => [k, null]));
  for (const [key, fixedY] of jobs) {
    let y = fixedY;
    if (y === null) {
      y = await cdp.eval(sessionId, `(function(){var k=${JSON.stringify(key)};
        var el=[].slice.call(document.querySelectorAll('main *')).filter(function(n){return n.children.length===0&&n.textContent.indexOf(k)>=0})[0]
          || [].slice.call(document.querySelectorAll('main *')).filter(function(n){return n.textContent.indexOf(k)>=0})[0];
        return el?Math.round(el.getBoundingClientRect().top+window.scrollY):-1})()`);
    }
    if (y < 0) { console.log('  x 找不到关键词：' + key); continue; }
    const page = Math.floor(y / PAGE_H) + 1;
    await cdp.eval(sessionId, `window.scrollTo(0,${(page - 1) * PAGE_H})`);
    await sleep(150);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const tag = key === '__top__' ? 'p00-封面' : 'p' + String(page).padStart(2, '0') + '-' + key.slice(0, 10).replace(/[\\/:*?"<>|]/g, '');
    fs.writeFileSync(SHOTS + '/' + tag + '.png', Buffer.from(shot.data, 'base64'));
    console.log('  ok  y=' + String(y).padEnd(6) + ' 第 ' + page + ' 页  ' + key + '  ->  _shots/' + tag + '.png');
  }
}

async function mode_pdf(cdp, sessionId) {
  await injectPdfFonts(cdp, sessionId);
  // 页脚只放数字：页眉页脚由浏览器另画，用不到文档里的 @font-face。
  // 注意：页脚框是「整幅纸宽」，不跟着 @page 边距走，必须自己补内边距，不然页码会贴到纸边。
  const FOOTER = `<div style="width:100%;font-family:'Segoe UI',Arial,sans-serif;font-size:8.5pt;color:#777;text-align:right">
    <span style="padding-right:${MM.right}mm"><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
  const r = await cdp.send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>', footerTemplate: FOOTER,
    paperWidth: 8.27, paperHeight: 11.69,
    marginTop: IN(MM.top), marginBottom: IN(MM.bottom), marginLeft: IN(MM.left), marginRight: IN(MM.right),
  }, sessionId);
  const buf = Buffer.from(r.data, 'base64');
  fs.writeFileSync(PDF, buf);
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const links = (buf.toString('latin1').match(/\/Subtype\s*\/Link/g) || []).length;
  const fonts = [...new Set((buf.toString('latin1').match(/\/BaseFont\s*\/([A-Za-z0-9+\-]+)/g) || [])
    .map(s => s.replace(/.*\//, '')))];
  console.log('  已写出 PDF：%s KB · %d 页 · %d 个链接', (buf.length / 1024).toFixed(0), pages, links);
  console.log('  嵌入字体：%s', fonts.join('，'));
}

/* ---------- 版式几何审计：不靠肉眼，直接量 ---------- */
async function audit(cdp, sessionId) {
  const raw = await cdp.eval(sessionId, `(function(){
    var mm = px => +(px/96*25.4).toFixed(1);
    var main = document.querySelector('main');
    var cs = getComputedStyle(main);
    var contentW = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var P = [].slice.call(main.querySelectorAll('p')).filter(function(p){return !p.closest('.cover,.tocpage') && p.textContent.length > 80;})[0] || document.body;
    var probe = document.createElement('span');
    probe.textContent = '上下文原生智能的'.repeat(4);
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:'+getComputedStyle(P).font;
    document.body.appendChild(probe);
    var cw = probe.getBoundingClientRect().width / 32;
    probe.remove();
    var mr = main.getBoundingClientRect();
    var over = [];
    [].slice.call(main.querySelectorAll('*')).forEach(function(n){
      if (n.closest('.mnote,svg,.katex,.katex-display')) return;
      var r = n.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.right - mr.right > 1.5) over.push(n.tagName.toLowerCase() + (n.className ? '.' + String(n.className).split(' ')[0] : '') + ' 右溢 ' + Math.round(r.right - mr.right) + 'px');
      if (r.left < mr.left - 1.5) over.push(n.tagName.toLowerCase() + ' 左溢 ' + Math.round(mr.left - r.left) + 'px');
    });
    var svgClip = [];
    [].slice.call(document.querySelectorAll('svg.chart')).forEach(function(sv){
      var vb = (sv.getAttribute('viewBox')||'').split(/\\s+/).map(Number), lim = vb[2];
      [].slice.call(sv.querySelectorAll('text')).forEach(function(t){
        try { var b = t.getBBox(); if (b.x + b.width > lim - 0.5) svgClip.push('“' + t.textContent.slice(0,14) + '” 超 ' + Math.round(b.x + b.width - lim) + 'px'); } catch(e){}
      });
    });
    var notes = [].slice.call(document.querySelectorAll('.mnote')).map(function(a){
      var r = a.getBoundingClientRect(), pr = a.parentElement.getBoundingClientRect();
      var st = getComputedStyle(a);
      return {label:a.textContent.replace(/\\s+/g,' ').trim().slice(0,16), gap:mm(r.left-mr.right), w:mm(r.width),
              topDelta:Math.round(r.top-pr.top), h:mm(r.height), mode:st.position, overlapsText:r.left < mr.right,
              parent:a.parentElement.tagName.toLowerCase() + (a.parentElement.className ? '.' + String(a.parentElement.className).split(' ')[0] : ''),
              offPage: +(mm(r.right - mr.right) - ${MM.right}).toFixed(1) };
    });
    var tables = [].slice.call(document.querySelectorAll('table'));
    var worst = tables.map(function(t){
      return {t:t, over:t.getBoundingClientRect().right - mr.right};
    }).sort(function(a,b){return b.over-a.over})[0];
    var wide = null;
    if (worst && worst.over > 1.5) {
      var cells = [].slice.call(worst.t.tHead.rows[0].cells).map(function(c){ return Math.round(c.getBoundingClientRect().width); });
      var mins = [].slice.call(worst.t.tBodies[0].rows).slice(0, 6).map(function(r){ return [].slice.call(r.cells).map(function(c){ return Math.round(c.getBoundingClientRect().width); }); });
      wide = {cls:worst.t.className, cols:cells, over:Math.round(worst.over), sample:mins};
    }
    var facts = {};
    facts['正文宽'] = mm(contentW) + 'mm';
    facts['每行约汉字'] = Math.round(contentW / cw) + ' 字';
    facts['段落 font-family'] = getComputedStyle(P).fontFamily.split(',')[0];
    facts['标题 font-family'] = getComputedStyle(document.querySelector('main h2')).fontFamily.split(',')[0];
    facts['正文 font-size'] = getComputedStyle(P).fontSize;
    facts['正文 line-height'] = getComputedStyle(P).lineHeight;
    facts['段间距'] = getComputedStyle(P).marginBottom;
    facts['汉字宽'] = cw.toFixed(2) + 'px';
    ['Noto Sans SC','Noto Serif SC','Microsoft YaHei','Cascadia Mono','Source Code Pro'].forEach(function(f){
      facts['字体可用 ' + f] = document.fonts.check('16px "' + f + '"');
    });
    var fonts = {};
    [].slice.call(document.querySelectorAll('main *')).forEach(function(n){
      if (!n.textContent.trim() || n.children.length) return;
      var f = getComputedStyle(n).fontFamily.split(',')[0].replace(/["']/g,'');
      fonts[f] = (fonts[f]||0)+1;
    });
    var front = {};
    var cov = document.querySelector('.cover'), ttl = document.querySelector('.cv-title'), meta = document.querySelector('.cv-meta'), tp = document.querySelector('.tocpage');
    if (cov) {
      var cr = cov.getBoundingClientRect();
      front['封面高'] = mm(cr.height) + 'mm';
      front['标题距顶'] = ttl ? mm(ttl.getBoundingClientRect().top - cr.top) + 'mm' : '-';
      front['元信息距底'] = meta ? mm(cr.bottom - meta.getBoundingClientRect().bottom) + 'mm' : '-';
    }
    if (tp) front['目录高'] = mm(tp.getBoundingClientRect().height) + 'mm（' + tp.querySelectorAll('li').length + ' 行）';
    facts['封面/目录'] = Object.entries(front).map(function(kv){return kv[0]+' '+kv[1]}).join(' · ');
    return JSON.stringify({facts:facts, overflow:over.slice(0,10), overflowN:over.length, svgClip:svgClip, notes:notes, wide:wide,
      tableN:tables.length, tableOverflow:tables.filter(function(t){return t.scrollWidth-t.clientWidth>0}).length,
      tableCols:[...new Set(tables.map(function(t){return t.tHead?t.tHead.rows[0].cells.length:0}))].sort(function(a,b){return a-b}),
      docFonts:fonts, h:Math.round(document.documentElement.scrollHeight)});
  })()`);
  const a = JSON.parse(raw);
  console.log('\n  ── 版式几何审计 ──');
  for (const [k, v] of Object.entries(a.facts)) console.log('    ' + k.padEnd(20, ' ') + ' = ' + v);
  console.log('    ' + '实际字体族'.padEnd(20, ' ') + ' = ' + Object.entries(a.docFonts).map(([k, v]) => k + '(' + v + ')').join('，'));
  console.log('    ' + '溢出正文框'.padEnd(20, ' ') + ' = ' + (a.overflowN ? a.overflowN + ' 个：' + a.overflow.slice(0, 5).join(' / ') : '0 个'));
  console.log('    ' + 'SVG 文字越界'.padEnd(20, ' ') + ' = ' + (a.svgClip.length ? a.svgClip.length + ' 处：' + a.svgClip.slice(0, 4).join(' / ') : '0 处'));
  console.log('    ' + '横向溢出表格'.padEnd(20, ' ') + ' = ' + a.tableOverflow + ' / ' + a.tableN + '（列数集合 ' + a.tableCols.join(',') + '）');
  if (a.wide) {
    console.log('    最宽表 ' + (a.wide.cls || '(无类名)') + ' 溢出 ' + a.wide.over + 'px，表头列宽 = ' + a.wide.cols.join(' / '));
    console.log('      前几行列宽 = ' + a.wide.sample.map(r => '[' + r.join(',') + ']').join(' '));
  }
  for (const n of a.notes) console.log('    页边注 ' + n.label.padEnd(16, ' ') + ' 挂载于 ' + n.parent.padEnd(6, ' ') + ' 定位=' + n.mode.padEnd(9, ' ') +
    (n.mode === 'absolute' ? ' 距正文 ' + n.gap + 'mm · 宽 ' + n.w + 'mm · 出纸边 ' + n.offPage + 'mm' : ' 流内注记 · 宽 ' + n.w + 'mm（打印时紧贴段落上方）') +
    ' · 高 ' + n.h + 'mm · 与块首差 ' + n.topDelta + 'px');
  return a;
}

/* ---------- 字体嵌入测试：查清哪些字体族真能被 PDF 嵌入 ---------- */
const FCASES = [
  ['sys', 'Noto Sans SC', '思源黑体 变量字体（按族名）'],
  ['sys', 'Noto Serif SC', '思源宋体 变量字体（按族名）'],
  ['sys', 'Microsoft YaHei', '微软雅黑 静态'],
  ['sys', 'DengXian', '等线 静态'],
  ['sys', 'SimHei', '黑体 静态'],
  ['sys', 'SimSun', '宋体 静态'],
  ['sys', 'NSimSun', '新宋体 静态'],
  ['sys', 'KaiTi', '楷体 静态'],
  ['ff', 'C:/Windows/Fonts/NotoSansSC-VF.ttf', '@font-face 变量黑体'],
  ['ff', 'C:/Windows/Fonts/NotoSerifSC-VF.ttf', '@font-face 变量宋体'],
  ['ff', 'C:/Windows/Fonts/RODE Noto Sans CJK SC R.otf', '@font-face 静态 Noto Sans CJK R'],
  ['ff', 'C:/Windows/Fonts/RODE Noto Sans CJK SC B.otf', '@font-face 静态 Noto Sans CJK B'],
  ['ff', 'C:/Windows/Fonts/Deng.ttf', '@font-face 等线文件'],
  ['ff', 'C:/Windows/Fonts/msyh.ttc', '@font-face 雅黑文件'],
];
async function mode_fonttest(cdp) {
  const ff = FCASES.filter(c => c[0] === 'ff');
  const faces = ff.map((c, i) => `@font-face{font-family:FF${i};src:url("file:///${c[1]}");}`).join('\n');
  const famOf = c => c[0] === 'sys' ? `"${c[1]}"` : 'FF' + ff.indexOf(c);
  const rows = FCASES.map((c, i) => `<p id="c${i}" style="font-family:${famOf(c)}">Hamburgefonstiv 中文测试 0123</p>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><style>${faces}
    @page{size:A4;margin:20mm}body{font-family:sans-serif;font-size:12pt;line-height:1.8}p{margin:0 0 6px}</style>${rows}`;
  fs.writeFileSync(DIR + '/_fonttest.html', html);
  const t = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  await cdp.send('Page.enable', {}, sid);
  await cdp.send('Runtime.enable', {}, sid);
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: pathToFileURL(DIR + '/_fonttest.html').href }, sid);
  await Promise.race([loaded, sleep(8000)]);
  await cdp.eval(sid, `document.fonts.ready.then(()=>1)`);
  await sleep(300);
  const probe = await cdp.eval(sid, `JSON.stringify(${JSON.stringify(FCASES.map((c, i) => i))}.map(function(i){
    var el = document.getElementById('c'+i); var r = el.getBoundingClientRect();
    return [i, +r.width.toFixed(2), +el.getBoundingClientRect().height.toFixed(1)]; }))`);
  const widths = JSON.parse(probe);
  const r = await cdp.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true }, sid);
  const buf = Buffer.from(r.data, 'base64');
  fs.writeFileSync(DIR + '/_fonttest.pdf', buf);
  const fonts = [...new Set((buf.toString('latin1').match(/\/BaseFont\s*\/([A-Za-z0-9+\-]+)/g) || []).map(x => x.replace(/.*\//, '')))];
  console.log('  PDF 实际嵌入字体：' + (fonts.join('，') || '（无）'));
  const groups = new Map();
  for (const [i, w, h] of widths) {
    const k = w + '×' + h;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(FCASES[i][2]);
  }
  console.log('  渲染宽度分组（同一组 = 实际落到同一款字体）：');
  let g = 0;
  for (const [k, list] of [...groups.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
    console.log('    组' + (++g) + ' [' + k + '] ' + list.join(' / '));
  }
}

/* ---------- 把思源黑体/宋体的静态实例接进文档（只作用于 PDF 导出） ----------
   系统里的思源是"变量字体"，Chrome 导 PDF 时无法嵌入、会静默回退到 NSimSun；
   这里用 fontTools 预先实例化出的静态字重（_fonts/）以 @font-face 接入，导出的 PDF 才真正是思源。 */
async function injectPdfFonts(cdp, sessionId) {
  const have = f => fs.existsSync(DIR + '/_fonts/' + f);
  if (!have('NotoSansSC-Regular.ttf')) { console.log('  ! 缺少 _fonts/ 静态字体，PDF 中文会回退到 NSimSun'); return; }
  const face = (fam, file, w) => have(file) ? `@font-face{font-family:'${fam}';src:url("file:///${DIR}/_fonts/${file}") format('truetype');font-weight:${w};font-style:normal;font-display:block}` : '';
  const css = `
    ${face('PDF Sans', 'NotoSansSC-Regular.ttf', 400)}
    ${face('PDF Sans', 'NotoSansSC-SemiBold.ttf', 600)}
    ${face('PDF Sans', 'NotoSansSC-Bold.ttf', 700)}
    ${face('PDF Serif', 'NotoSerifSC-Bold.ttf', 700)}
    body,main,p,li,td,th,h1,h2,h3,blockquote,figcaption,ol.toc-list,.cv-meta,.mnote,.callout,.cv-thesis,strong,b,.em,.eq,.cl,.cl2,.ct,.cs,.cs2,.cax{font-family:'PDF Sans','Noto Sans SC',sans-serif !important}
    .cv-title{font-family:'PDF Serif','Noto Serif SC',serif !important}
    .term,code,.cv,.cv2,td.refno,.cv-kicker{font-family:'Cascadia Mono','Source Code Pro',ui-monospace,Consolas,monospace !important}`;
  const st = await cdp.eval(sessionId, `(function(){if(document.getElementById('pdffonts'))return 'already';
    var s=document.createElement('style');s.id='pdffonts';s.textContent=${JSON.stringify(css)};document.head.appendChild(s);
    return document.fonts.ready.then(function(){return [].slice.call(document.fonts).filter(function(f){return /PDF /.test(f.family)}).map(function(f){return (f.family+' '+f.weight+' '+f.status).replace('PDF ','')}).join(' | ')})})()`);
  console.log('  PDF 专用字体：' + (st || '（无）'));
}

/* ---------- 页边距探针：确认 CSS @page 边距与导出参数没有叠加成双重边距 ---------- */
async function mode_probe(cdp) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    @page{size:A4;margin:${MM.top}mm ${MM.right}mm ${MM.bottom}mm ${MM.left}mm}
    html,body{margin:0;padding:0}
    div{background:#000}
    .a{width:100%;height:20mm}
    .b{width:40mm;height:5mm;margin-top:5mm}
    p{margin:5mm 0 0;font:10pt sans-serif}</style>
    <div class="a"></div><div class="b"></div><p>内容框左缘</p>`;
  fs.writeFileSync(DIR + '/_probe.html', html);
  const t = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  await cdp.send('Page.enable', {}, sid);
  await cdp.send('Runtime.enable', {}, sid);
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: pathToFileURL(DIR + '/_probe.html').href }, sid);
  await Promise.race([loaded, sleep(6000)]);
  const r = await cdp.send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true,
    marginTop: IN(MM.top), marginBottom: IN(MM.bottom), marginLeft: IN(MM.left), marginRight: IN(MM.right),
  }, sid);
  const buf = Buffer.from(r.data, 'base64');
  const zlib = await import('node:zlib');
  const s = buf.toString('latin1');
  const boxes = [];
  const re = /stream\r?\n/g; let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length, end = s.indexOf('endstream', start);
    if (end < 0) continue;
    let out; try { out = zlib.inflateSync(Buffer.from(s.slice(start, end), 'latin1')).toString('latin1'); } catch { continue; }
    for (const q of out.matchAll(/([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+re\s*f/g)) boxes.push(q.slice(1, 5).map(Number));
  }
  const mm = p => +(p / 72 * 25.4).toFixed(1);
  const tall = boxes.filter(b => mm(b[3]) > 5 && mm(b[3]) < 25);
  const a = tall.sort((x, y) => y[2] - x[2])[0];                       // 铺满版心的黑块
  const b2 = tall.filter(b => Math.abs(mm(b[2]) - 40) < 3).pop();       // 已知 40mm 宽的小块
  console.log('  ── 页边距探针（黑块按版心铺满，读它在 PDF 里的坐标）──');
  console.log('    共读到 %d 个填充矩形，前 6 个（左/下/宽/高，mm）：', boxes.length);
  boxes.slice(0, 6).forEach(b => console.log('      %s / %s / %s / %s', mm(b[0]), mm(b[1]), mm(b[2]), mm(b[3])));
  if (a) console.log('    内容框：左 %s mm · 宽 %s mm · 高 %s mm · 上缘距页顶 %s mm', mm(a[0]), mm(a[2]), mm(a[3]), mm(842 - (a[1] + a[3])));
  if (b2) console.log('    40mm 小块：左 %s mm · 宽 %s mm（应左 22.0、宽 40.0）', mm(b2[0]), mm(b2[2]));
  console.log('    期望：左 22.0 mm、宽 150.0 mm、上缘 22.0 mm（若宽 ≈ 90mm 或左 ≈ 44mm，说明边距被叠加了）');
  if (!a) console.log('    ! 没找到黑块矩形，探针无效');;
}

/* ---------- 目录页码：用 pdftotext 反查每个标题落在第几页 ---------- */
const PT = 'D:/texlive/2024/bin/windows/pdftotext.exe';
const PINFO = 'D:/texlive/2024/bin/windows/pdfinfo.exe';
const TOCJSON = DIR + '/_tocpages.json';

function pdfPages(file) {
  const out = spawnSync(PINFO, [file], { encoding: 'utf8' });
  const m = (out.stdout || '').match(/Pages:\s+(\d+)/);
  return m ? +m[1] : 0;
}
function pageTexts(file, pages) {
  const out = spawnSync(PT, ['-layout', file, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return (out.stdout || '').split('\f');
}
const squash = s => s.replace(/\s+/g, '');

async function mode_tocpages(cdp, sessionId) {
  await injectPdfFonts(cdp, sessionId);
  await cdp.send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>', footerTemplate: '<div style="font-size:8.5pt"></div>',
    paperWidth: 8.27, paperHeight: 11.69,
    marginTop: IN(MM.top), marginBottom: IN(MM.bottom), marginLeft: IN(MM.left), marginRight: IN(MM.right),
  }, sessionId).then(r => fs.writeFileSync(DIR + '/_pass.pdf', Buffer.from(r.data, 'base64')));
  // 检索词取自**文档里的锚点元素本身**（不是目录条目文字）：目录条目带页码后，
  // 直接拿目录文字当检索词会把页码也算进去，而且"正文导航组"的标签并不出现在正文里。
  const targets = JSON.parse(await cdp.eval(sessionId, `JSON.stringify([].slice.call(document.querySelectorAll('.toc-list a')).map(function(a){
    var id = a.getAttribute('href').slice(1), el = document.getElementById(id);
    return {id: id, text: (el ? el.textContent : a.textContent).replace(/[\\s#]+/g, ' ').trim(), label: a.textContent.trim()}; }))`));
  const n = pdfPages(DIR + '/_pass.pdf');
  const texts = pageTexts(DIR + '/_pass.pdf', n);
  if (process.env.DBG) {
    console.log('    [dbg] pdfinfo 页数 %d · 文本段数 %d · 段3 长度 %d', n, texts.length, (texts[2] || '').length);
    console.log('    [dbg] 段3 开头: %j', (texts[2] || '').replace(/\s+/g, ' ').slice(0, 90));
    console.log('    [dbg] 前 3 个目标: %j', targets.slice(0, 3).map(t => t.text));
  }
  const map = {};
  const miss = [];
  // 先识别"目录页"：一页里出现 ≥4 个标题，就是目录（目录可能不止一页），从页码检索里排除
  const needles = targets.map(t => squash(t.text).slice(0, 12));
  const tocPages = new Set();
  texts.forEach((t, i) => {
    const s = squash(t);
    if (needles.filter(n => n && s.includes(n)).length >= 4) tocPages.add(i + 1);
  });
  for (const t of targets) {
    const needle = squash(t.text).slice(0, 14);
    let hit = 0;
    for (let p = 2; p <= texts.length; p++) {
      if (tocPages.has(p)) continue;
      if (squash(texts[p - 1] || '').includes(needle)) { hit = p; break; }
    }
    if (hit) map[t.id] = hit; else miss.push(t.label.slice(0, 20));
  }
  fs.writeFileSync(TOCJSON, JSON.stringify(map, null, 1));
  console.log('  目录页码：解析 %d / %d 条标题（PDF 共 %d 页；目录页 = 第 %s 页）',
    Object.keys(map).length, targets.length, n, [...tocPages].join(','));
  if (miss.length) console.log('    未定位到页码：' + miss.join(' / '));
}

/* ---------- 页边注变体测试：找出哪种写法在分页后不会被丢掉 ---------- */
async function mode_notetest(cdp, sessionId) {
  const variants = [
    ['当前 第 1 次打印', ''],
    ['当前 第 2 次打印', ''],
    ['当前 第 3 次打印', ''],
    ['absolute 留在版心内 right:0', '.mnote{right:0 !important;width:24mm !important}'],
    ['当前的 第 4 次打印（再验证）', ''],
    ['流内注记（右对齐小块）', '.mnote{position:static !important;float:none !important;display:block !important;text-align:right !important;right:auto !important;top:auto !important;margin:-.2em 0 .9em !important;width:auto !important;border-top:0 !important}'],
  ];
  const PT = 'D:/texlive/2024/bin/windows/pdftotext.exe';
  for (const [name, css] of variants) {
    const height = await cdp.eval(sessionId, `(function(){var o=document.getElementById('nv');if(o)o.remove();
      document.querySelectorAll('.mnote').forEach(function(a){ if(a.dataset.moved){a.parentElement.after(a); delete a.dataset.moved;} });
      var s=document.createElement('style');s.id='nv';s.textContent=${JSON.stringify(css === '__move__' ? '.mnote{position:static !important;float:none !important;display:block !important;text-align:right !important;right:auto !important;top:auto !important;width:auto !important;border-top:0 !important;margin:.1em 0 .9em !important;font-size:8pt !important;color:#6b6b6b !important;line-height:1.45 !important}' : css)};
      document.head.appendChild(s);
      ${css === '__move__' ? "document.querySelectorAll('.mnote').forEach(function(a){a.dataset.moved='1';a.parentElement.after(a);});" : ''}
      return document.body.scrollHeight})()`);
    await sleep(200);
    const r = await cdp.send('Page.printToPDF', {
      printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
      headerTemplate: '<div></div>', footerTemplate: '<div style="font-size:8.5pt"></div>',
      paperWidth: 8.27, paperHeight: 11.69,
      marginTop: IN(MM.top), marginBottom: IN(MM.bottom), marginLeft: IN(MM.left), marginRight: IN(MM.right),
    }, sessionId);
    const buf = Buffer.from(r.data, 'base64');
    const tmp = DIR + '/_notetest.pdf';
    fs.writeFileSync(tmp, buf);
    const out = spawnSync(PT, ['-layout', tmp, '-'], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    const txt = out.stdout || '';
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    const links = (buf.toString('latin1').match(/\/Subtype\s*\/Link/g) || []).length;
    const mb = (buf.toString('latin1').match(/\/MediaBox\s*\[([^\]]+)\]/) || [, '?'])[1];
    const dim = mb === '?' ? '?' : mb.trim().split(/\s+/).slice(2).map(v => (+v / 72 * 25.4).toFixed(0) + 'mm').join('×');
    console.log('    ' + name.padEnd(36, ' ') + ' 页 ' + String(pages).padStart(2) + ' · 纸 ' + dim + ' · 链接 ' + links +
      ' · 注1=' + (txt.includes('这笔账怎么算') ? '有' : '无') +
      ' 注2=' + (txt.includes('个字符的缓存崩塌') ? '有' : '无') +
      ' 注3=' + (txt.includes('同类踩坑') ? '有' : '无') +
      ' · 连续高度 ' + height + 'px');
  }
  await cdp.eval(sessionId, `(function(){var o=document.getElementById('nv');if(o)o.remove();
    document.querySelectorAll('.mnote').forEach(function(a){if(a.dataset.moved){a.parentElement.prepend(a);delete a.dataset.moved;}});})()`);
}

const [mode = 'pdf', ...keys] = process.argv.slice(2);
const info = await withBrowser(async (cdp, sessionId) => {
  if (mode === 'fonttest') { await mode_fonttest(cdp); return; }
  if (mode === 'notetest') { await mode_notetest(cdp, sessionId); return; }
  if (mode === 'tocpages') { await mode_tocpages(cdp, sessionId); return; }
  if (mode === 'shots' || mode === 'audit' || mode === 'all' || mode === 'final') {
    // 关键顺序：先导出 PDF，再做模拟截图 —— 模拟层（A4 框、设备尺寸覆盖）会污染随后的分页，
    // 实测同一次运行里"先截图后导出"会比"先导出"多出 4 页。
    if (mode === 'all' || mode === 'final') await mode_pdf(cdp, sessionId);
    await applySim(cdp, sessionId);
    await injectPdfFonts(cdp, sessionId);   // 截图与审计都按 PDF 实际字体验证
    if (mode !== 'audit') await mode_shots(cdp, sessionId, keys.length ? keys : ['目 录']);
    await audit(cdp, sessionId);
    if (mode === 'final') await mode_probe(cdp);
  } else await mode_pdf(cdp, sessionId);
  if (mode === 'probe') await mode_probe(cdp);
});
console.log('  文档自检：KaTeX %d 处 · 封面 %s · 目录 %d 行 · 边注 %d · 表 %d · 图 %d · 角标 %d',
  info.katex, info.cover ? '有' : '无', info.toc, info.mnotes, info.tables, info.figs, info.cites);
