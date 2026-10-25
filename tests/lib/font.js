// ฟอนต์ Google Sans ฝังในหน้าเว็บที่เทสต์เปิด (ให้ภาพหน้าจอเหมือนของจริง) — ไม่มีไฟล์ใน fixtures/gsfont ก็ข้าม
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'fixtures', 'gsfont');
module.exports = sub => {
  const url = path.join(DIR, sub + '.url'), woff = path.join(DIR, sub + '.woff2');
  if (!fs.existsSync(url) || !fs.existsSync(woff)) return '';
  const range = fs.readFileSync(url, 'utf8').split('\n')[1];
  return `@font-face{font-family:'Google Sans';font-style:normal;font-weight:400 700;src:url(data:font/woff2;base64,${fs.readFileSync(woff).toString('base64')}) format('woff2');unicode-range:${range};}`;
};
