# เทสต์ถดถอย (regression tests)

เทสต์รันโค้ดจริงใน `src/` บน Node โดยจำลอง Apps Script (SpreadsheetApp, CacheService, PropertiesService,
LockService ฯลฯ) ด้วยชีตในหน่วยความจำ และเปิด `src/Index.html` ใน Chromium (Playwright) โดยต่อ
`google.script.run` เข้ากับโค้ดเซิร์ฟเวอร์ตัวเดียวกัน — ไม่แตะสเปรดชีตจริง

```bash
bash tests/run.sh            # ทุกตัว (~15–20 นาที)
bash tests/run.sh server     # เฉพาะฝั่งเซิร์ฟเวอร์ (~1 นาที)
bash tests/run.sh ui         # เฉพาะหน้าเว็บ
bash tests/run.sh t3 ui41    # เฉพาะที่ระบุ
```

`gas1` จำลองการตัดคอมเมนต์ `//` ของ Apps Script (ต้องมี `acorn` จาก `npm install` — `run.sh` ติดตั้งให้เอง) และ `chars1` ตรวจอักขระแปลกปลอม
ทั้งสองไม่ต้องใช้ fixtures — **ต้องผ่านก่อน deploy ทุกครั้ง** เพราะเทสต์หน้าเว็บอื่นเปิดไฟล์ตรง ๆ ไม่ผ่านขั้นตอนของ Google

ภาพหน้าจอและไฟล์ผลลัพธ์ของเทสต์อยู่ใน `tests/out/` (ไม่ขึ้น git) — ดูภาพได้เมื่อแก้ UI

## ข้อมูลทดสอบ `tests/fixtures/` (ไม่อยู่ใน git)

เป็นข้อมูลตัวชี้วัดจริงของโรงพยาบาลและรายชื่อบุคลากร repo นี้เป็น public จึงไม่เก็บใน git
(ชื่อบุคลากรที่ปรากฏในโค้ดเทสต์เป็นชื่อสมมติ เช่น มานี มานะ ชูใจ — ข้อมูลใน fixtures แทนชื่อไว้ให้ตรงกัน
ส่วนชื่อที่ฝังอยู่ใน `src/` อยู่แล้ว เช่น `INITIAL_HEADS`, `PCT_HEADS` คงชื่อเดิม) — ไม่มีรหัสผ่าน/hash ของผู้ใช้จริง

| ไฟล์ | ใช้โดย | เนื้อหา |
|---|---|---|
| `db.json` | `harness.js` | แถวชีต Database เดิม (ก่อนแยกปีงบ) |
| `nso/real.json` | `harness2.js` | `{y69, y70, users, nso}` ชีตปีงบ 2569/2570, Users (hash = `x`), ชีต Database ของไฟล์ NSO |
| `live4/data.json` | `harness4.js` (+ `nso` ให้ harness5/7) | `{2569, 2570, hdr, users, sync, tidylog, nso, sheets}` |
| `live5/data.json` | `harness5.js` | รูปแบบเดียวกับ live4 (ข้อมูลหลังจัดระเบียบ) |
| `live7/data.json` | `harness7.js` | รูปแบบเดียวกับ live4 (ข้อมูลล่าสุด) |
| `gsfont/*` | `lib/font.js` | ฟอนต์ Google Sans ให้ภาพหน้าจอเหมือนจริง (ไม่มีก็รันได้) |
| `lib/docx.iife.js` | `ui47.js` | npm `docx@9.5.1` → `dist/index.iife.js` (ใช้แทน CDN ตอนเทสต์ Export Word) |
| `lib/pptxgen.bundle.js` | `ui48.js` | npm `pptxgenjs@4.0.1` → `dist/pptxgen.bundle.js` (ใช้แทน CDN ตอนเทสต์ Export PowerPoint) |

`live7/data.json` สร้างจากสเปรดชีตจริงได้ (ชีต `ปีงบ 2569`/`ปีงบ 2570` ตัดเหลือ 39 คอลัมน์ · `users` = `[ชื่อผู้ใช้, tier, หน่วย]` · `sync`/`tidylog`/`nso` เป็น `[]`) และ `live4/data.json` = `{"nso": []}` —
พอสำหรับเทสต์ที่ใช้ `harness7` (t14, sar1, clt1, ui41–ui48)

session ใหม่ (clone สด) จะไม่มีโฟลเดอร์นี้ — ขอไฟล์จากผู้ใช้ หรือสร้างใหม่จากสเปรดชีตจริงตามรูปแบบข้างบน
(ตัดคอลัมน์ Password ออกเสมอ) ก่อนรัน

## โครงสร้าง

- `harness*.js` — จำลอง Apps Script แล้วโหลดทุกไฟล์ใน `src/` ลง `vm` context เดียวกัน (เหมือน global ของ Apps Script)
  ตั้ง `SRC=/path/to/src/` เพื่อทดสอบโค้ดชุดอื่นได้
- `t*.js, n3, tidy4, merge2, pct2, sub1, v*.js` — ฝั่งเซิร์ฟเวอร์
- `ui*.js` — หน้าเว็บ (Playwright, `executablePath: '/opt/pw-browsers/chromium'`)
- เทสต์ UI รุ่นเก่า (ui18–ui34) แทนที่ `listMode = 'table'` เป็น `'card'` ในหน้าเว็บก่อนเปิด เพราะเขียนไว้ก่อนมีมุมมองตาราง

## ตัวแปรสภาพแวดล้อม

| ตัวแปร | ผล |
|---|---|
| `TOURTEST=1` | ไม่ปิดป๊อปอัประบบสอน (ปกติ harness ตอบ `TOUR_HIDE_V1:*` = ซ่อน) — `run.sh` ตั้งให้ ui40 เอง |
| `MIGRATE=1` | ให้ `harness.js` รัน migration หมวดหน่วยงาน/ระดับผู้รับผิดชอบ (t11, t13, ui26, ui28 ตั้งเองในไฟล์) |
| `NOFLAGS=1` | `harness4/5/7` ไม่ตั้ง flag ว่า migration/นำเข้าทำไปแล้ว |
| `SRC` | โฟลเดอร์โค้ดที่จะทดสอบ (ค่าเริ่มต้น `../src/`) |

## เพิ่มเทสต์ใหม่

คัดลอกเทสต์ที่ใกล้เคียงที่สุด (เช่น `ui46.js` สำหรับมุมมองตาราง, `t14.js` สำหรับฝั่งเซิร์ฟเวอร์ที่ใช้ข้อมูลล่าสุด)
เทสต์ต้อง throw/assert เมื่อผิด (exit code ≠ 0) แล้วเพิ่มชื่อลงรายการ `SERVER` หรือ `UI` ใน `run.sh`
