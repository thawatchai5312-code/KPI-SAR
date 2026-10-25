// Apps Script (HtmlService) ตัดคอมเมนต์ // ออกจาก <script> ก่อนส่งหน้าเว็บ ด้วยตัวตัดแบบง่ายที่ไม่รู้จัก regex
// และจำสถานะเครื่องหมายคำพูดข้ามบรรทัด — เช่น /"/g ในโค้ดทำให้มันคิดว่าอยู่ในข้อความไปอีกหลายพันบรรทัด
// แล้วไปตัด "http://..." ทิ้งกลางข้อความ → สคริปต์ทั้งก้อนพัง หน้าเว็บจริงล็อกอินไม่ได้ (เทสต์อื่นไม่เห็น เพราะเปิดไฟล์ตรง ๆ)
// กติกา: ใน <script> ห้ามมี // ที่ไม่ใช่คอมเมนต์จริง (URL ในข้อความให้เขียน 'https:\/\/...') — ตัวตัดจะลบได้แค่คอมเมนต์จริงเสมอ
const fs = require('fs'), path = require('path'), assert = require('assert'), acorn = require('acorn');
const SRC = path.join(__dirname, '../src');

// ตัวจำลองตัวตัดคอมเมนต์หลายแบบ (แบบ ws+esc+multiline ตรงกับที่วัดได้จากหน้าเว็บจริง)
function gasStrip(src, o) {
  let out = '', q = null, i = 0;
  while (i < src.length) {
    const c = src[i];
    if (q) {
      if (o.esc && c === '\\') { out += c + (src[i + 1] || ''); i += 2; continue; }
      if (c === q || (c === '\n' && !o.multiline)) q = null;
      out += c; i++; continue;
    }
    if (o.quotes.includes(c)) { q = c; out += c; i++; continue; }
    if (c === '/' && src[i + 1] === '/' && (!o.ws || i === 0 || /\s/.test(src[i - 1]))) {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    out += c; i++;
  }
  return out;
}
const VARIANTS = [];
for (const ws of [false, true]) for (const esc of [false, true]) for (const multiline of [false, true])
  for (const quotes of ['\'"', '\'"`']) VARIANTS.push({ ws, esc, multiline, quotes });

/** คืนรายการปัญหาของ HTML หนึ่งไฟล์ */
function check(html, file) {
  const problems = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc=/.test(m[1])) continue;
    const code = m[2], base = html.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length - 1;
    const lineOf = p => base + code.slice(0, p).split('\n').length;
    const comments = [];
    acorn.parse(code, { ecmaVersion: 'latest', onComment: (block, text, s, e) => comments.push([s, e]) });
    for (let i = code.indexOf('//'); i !== -1; i = code.indexOf('//', i + 1)) {
      if (!comments.some(([s, e]) => i >= s && i < e)) problems.push(`${file}:${lineOf(i)} มี // ที่ไม่ใช่คอมเมนต์ (ใช้ \\/\\/ แทน): ${code.slice(i - 30, i + 20).trim()}`);
    }
    for (const v of VARIANTS) {
      try { acorn.parse(gasStrip(code, v), { ecmaVersion: 'latest' }); }
      catch (e) { problems.push(`${file}: สคริปต์บรรทัด ${base + 1} พังหลังตัดคอมเมนต์ (${JSON.stringify(v)}): ${e.message}`); break; }
    }
  }
  return problems;
}

// ตรวจตัวตรวจเอง: รูปแบบที่ทำหน้าเว็บจริงพังเมื่อ 25 ต.ค. 2569 ต้องถูกจับได้
const bad = '<script>\nconst a = s.replace(/"/g, "&quot;");\nconst b = \'<svg xmlns="http://www.w3.org/2000/svg">\';\n</script>';
assert(check(bad, 'sample').length >= 2, 'ตัวตรวจต้องจับตัวอย่างที่เคยพังได้');
assert.deepStrictEqual(check(bad.replace('http://', 'http:\\/\\/'), 'sample'), []);

const problems = [];
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.html'))) problems.push(...check(fs.readFileSync(path.join(SRC, f), 'utf8'), f));
assert.deepStrictEqual(problems, [], '\n' + problems.join('\n'));
console.log('gas comment-strip safe OK');
