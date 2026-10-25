// ห้ามมีอักขระแปลกปลอมในไฟล์ src/ (noncharacter, control char, U+2028/2029, BOM) — ตัวแปลงโค้ดของ Apps Script อาจทำให้เพี้ยน
// และมองไม่เห็นเวลาอ่านโค้ด — ถ้าต้องใช้ใน regex/สตริง ให้เขียนเป็นรหัส เช่น \uFFFE แทนการพิมพ์อักขระลงไฟล์ตรง ๆ
const fs = require('fs'), path = require('path'), assert = require('assert');
const SRC = path.join(__dirname, '../src');
const bad = p => (p < 32 && p !== 9 && p !== 10 && p !== 13) || (p >= 0x7F && p <= 0x9F) ||
  (p >= 0xFDD0 && p <= 0xFDEF) || (p & 0xFFFE) === 0xFFFE || p === 0x2028 || p === 0x2029 || p === 0xFEFF;
const found = [];
for (const f of fs.readdirSync(SRC)) {
  fs.readFileSync(path.join(SRC, f), 'utf8').split('\n').forEach((line, i) => {
    for (const ch of line) {
      const p = ch.codePointAt(0);
      if (bad(p)) found.push(`${f}:${i + 1} U+${p.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  });
}
assert.deepStrictEqual(found, [], 'อักขระต้องห้ามใน src/: ' + found.join(', '));
console.log('src chars OK');
