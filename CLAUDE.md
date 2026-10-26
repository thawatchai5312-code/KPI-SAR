# CLAUDE.md — ระบบจัดการตัวชี้วัดโรงพยาบาล (KPI SAR)

เว็บแอป Google Apps Script (V8) ผูกกับสเปรดชีต "Phuluang KPI SAR data" ให้บุคลากร รพ. ดู/กรอกผลตัวชี้วัดรายปีงบ
ติดตามงาน และพิมพ์สรุปรายงาน ผู้ใช้ ~70 บัญชี ใช้งานพร้อมกันได้ (อัปเดตอัตโนมัติทุก 10 วินาที)

## กติกาการทำงานกับผู้ใช้ (สำคัญ)

- **ตอบเป็นภาษาไทย** เสมอ
- **ไม่เข้าใจให้ถาม ห้ามเดา** — ถ้าผู้ใช้ขอ "วางแผนก่อน / อย่าเพิ่งแก้โค้ด" ให้เสนอแผนและถามข้อที่ไม่ชัด (AskUserQuestion) แล้วรอคำสั่ง "เริ่มได้"
- **แก้เฉพาะที่สั่ง ห้ามแก้โค้ดส่วนอื่นที่ไม่เกี่ยว** และห้ามทำเกินที่สั่ง
- หลังแก้โค้ดใน `src/` เสร็จและเทสต์ผ่าน: `npm run deploy` → `git commit` → `git push -u origin claude/apps-script-auto-deploy-nhxswh`
  (งานเอกสาร/เทสต์ล้วนไม่ต้อง deploy) — **ห้ามสร้าง Pull Request** เว้นแต่ผู้ใช้สั่ง
- ทำงานบน branch `claude/apps-script-auto-deploy-nhxswh` (เป็น default branch ของ repo)
- **คู่มือ: อัปเดตเฉพาะเมื่อผู้ใช้สั่งเท่านั้น** (ผู้ใช้แก้ระบบต่อเนื่อง การอัปเดตคู่มือทุกครั้งเปลือง token) — แก้ระบบเสร็จ **ไม่ต้อง**แตะคู่มือเอง ตอนผู้ใช้สั่งให้อัปเดต: publish ทับลิงก์เดิม (Artifact) ห้ามสร้างลิงก์ใหม่
  - คู่มือฉบับเต็ม: https://claude.ai/artifact/D9J4BE8amE77v1xiPD1Sft
  - คู่มือย่อ: https://claude.ai/artifact/CTvPP71JP7fthnwRTe2R95
  - อ่านของเดิมด้วย Artifact `read` ก่อนแก้/เปลี่ยนรูป · **ห้ามใช้ชื่อจริงของบุคลากร**ในคู่มือ/ภาพตัวอย่าง (ใช้ "มานี (ชื่อสมมติ)")
- repo นี้เป็น **public**: ห้าม commit ข้อมูลตัวชี้วัดจริง รายชื่อบุคลากร รหัสผ่าน/hash หรือไฟล์จาก Drive ของผู้ใช้

## Deploy

```bash
npm run deploy   # scripts/deploy.sh: clasp push -f แล้ว redeploy ทุก web-app deployment ทับ ID เดิม (URL /exec ไม่เปลี่ยน)
```

ใช้ `npx @google/clasp@3` + `.clasprc.json` (ไม่อยู่ใน git) · `.clasp.json` ชี้ `rootDir: src`
web app: `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS` (ระบบล็อกอินของแอปเอง ไม่ใช่บัญชี Google)

## เทสต์

```bash
bash tests/run.sh server   # ฝั่งเซิร์ฟเวอร์ ~1 นาที
bash tests/run.sh          # ทั้งหมด รวมหน้าเว็บ (Playwright) ~15–20 นาที
```

ต้องมี `tests/fixtures/` (ข้อมูลจริง ไม่อยู่ใน git) — รายละเอียด/ตัวแปร `TOURTEST`, `MIGRATE` ดู `tests/README.md`
แก้ UI แล้วให้ดูภาพหน้าจอใน `tests/out/` ด้วย ไม่ใช่ดูแค่ว่าผ่าน

## โครงสร้างโค้ด

ทุกไฟล์ `.js` ใน `src/` เป็น global เดียวกัน (Apps Script) — ฟังก์ชันลงท้าย `_` เป็น private เรียกจากหน้าเว็บไม่ได้
ทุกฟังก์ชันที่หน้าเว็บเรียกรับ `token` และตรวจสิทธิ์ที่เซิร์ฟเวอร์เองทุกครั้ง (`requireUser_`)

| ไฟล์ | หน้าที่ |
|---|---|
| `src/รหัส.js` | `doGet`, คอลัมน์/`rowToKpi_`, `getAllData`, `saveKpi` (ตรวจแก้ชน `baseRev`), `addIndicator`, `deleteIndicator`, `recordViews`, report prefs, ซิงค์ระบบพยาบาลเดิม (ปิดอยู่) |
| `src/Auth.js` | ล็อกอิน/session (CacheService 6 ชม.), Users, Tier, สิทธิ์ต่อตัวชี้วัด `getKpiPermission_`, หน้าตั้งค่าผู้ใช้ |
| `src/Fiscal.js` | ชีตรายปีงบ "ปีงบ <พ.ศ.>", สร้างปีใหม่อัตโนมัติ (trigger รายวัน), migration หมวด/ระดับ |
| `src/Live.js` | บันทึกการเปลี่ยนแปลง (CacheService `KPI_CHANGES_V1`), `bumpDataVersion_`, `rowRev_`, `pollChanges` |
| `src/Views.js` | จัดหมวด 3 มุมมอง (รพ. / QA / หน่วยงาน), หัวข้อมุมมอง |
| `src/Tidy.js` | 🧹 จัดระเบียบข้อมูล (admin, รันซ้ำได้) |
| `src/Nso.js`, `src/NsoMatch.js` | นำเข้า/ซิงค์ตัวชี้วัดฝ่ายการพยาบาล (NSO) แบบ three-way merge |
| `src/Pct.js`, `src/PctData.js` | นำเข้าตัวชี้วัด PCT (ครั้งเดียว) |
| `src/Tour.js` | จำ "ไม่ต้องแสดงระบบสอนอีก" ต่อบัญชี |
| `src/SarDoc.js` | เอกสารส่ง สรพ.: ชีต `SAR_Doc` (ข้อความที่หัวหน้ากรอก ไม่แตะชีตปีงบ) — สรุป PDCA ต่อตัวชี้วัด (`getSarDoc`, `saveSarPdca`, `copySarPdcaFromPrevious`) และ CLT profile (`getCltDoc`, `saveCltItem`, `copyCltFromPrevious`) |
| `src/Links.js` | เอกสารแนบตัวชี้วัด (ลิงก์ Google Drive/Docs): ชีต `KPI_Links` (แยกจากชีตปีงบ) — `getKpiLinks`, `saveKpiLink`, `deleteKpiLink` |
| `src/Index.html` | หน้าเว็บทั้งหมด (~4,700 บรรทัด) — CSS บนสุด แล้ว 4 บล็อก `<script>` |

`Index.html` แบ่งด้วยคอมเมนต์ `// ===================== <ชื่อส่วน> =====================` ค้นด้วยชื่อส่วนได้:
สถานะ · เข้าสู่ระบบ · โหลดข้อมูล / ปีงบ · ตัวกรอง + ลำดับการแสดง · ผังรายการ (ซ้าย) · รายการการ์ดตัวชี้วัด (ขวา) ·
แก้ไข / บันทึก ทีละตัวชี้วัด · เพิ่มตัวชี้วัดใหม่ · ตั้งค่าผู้ใช้ · จัดระเบียบข้อมูล · กราฟ · ติดตามงาน (Progress) ·
สรุปรายงาน / Export PDF · เอกสาร สรพ. (SAR / CLT) · (script 2) หลายคนใช้งานพร้อมกัน · (script 3) มุมมองตาราง · (script 4) ระบบสอนการใช้งาน

## ข้อมูล

- สเปรดชีต `12UKdv0Y8fum7aXh2Uk05ZtcxM7SMatA_CusuC3j51gQ` (`SPREADSHEET_URL` ใน `รหัส.js`) — ชีต `ปีงบ 2569`, `ปีงบ 2570`, … , `Users`, `NSO_Sync`, `Tidy_Log`
- ปีงบเริ่ม 1 ต.ค. · ตัวชี้วัดเดียวกันข้ามปีเชื่อมด้วยรหัส (คอลัมน์ A)
- คอลัมน์ชีตปีงบ (1-based): A รหัส · B ลำดับ · C Part · D หมวด · E ชื่อ · F เป้าหมาย (ข้อความ เช่น `≥ 80`) ·
  G–K ผลทั้งปี ปี-4…ปีนี้ · L–W รายเดือน ต.ค.–ก.ย. · X รายละเอียด/การวิเคราะห์ (`templateDetails`) · Y ที่มา/สูตร (`dataSource`) ·
  Z ผู้รับผิดชอบ · AA หน่วยงาน · AB รหัสต้นทาง NSO · AC ระดับ (หลายค่า คั่น `, `: รายบุคคล/หน่วยงาน/QA-หน่วยงาน/SAR) ·
  AD–AE แก้ไขล่าสุดเมื่อ/โดย · AF–AG เข้าดูล่าสุดเมื่อ/โดย · AH วิธีสรุปผล · AI วันที่อัปเดตการวิเคราะห์ · AJ ความถี่ ·
  AK หมวดเพิ่มเติม · AL ตัวชี้วัดแม่ · AM หัวข้อกลุ่ม (`KPI_COLS = 39`)
- Tier ผู้ใช้: `admin` | `executive` (ผอ./QMR) | `head` (หัวหน้าหน่วย) | `staff` — แก้ข้อมูลได้ทุกปีงบตามสิทธิ์
- Script Properties ที่เป็น flag "ทำแล้ว" ของ migration/นำเข้า: `HEAD_SEED_V1`, `UNIT_CATEGORIES_V1`, `NURSING_LEVEL_TO_UNIT_V1`,
  `OWNER_LEVEL_V1`, `NSO_IMPORT_BACKUP_V1`, `PCT_IMPORT_V1`, `TIDY_BACKUP_V1`, `VIEW_HEADINGS_V1`, และ `TOUR_HIDE_V1:<user>`
- ไฟล์ NSO ต้นทาง (`NURSING_SPREADSHEET_URL`) มีชีต Users ที่เก็บรหัสผ่านแบบข้อความ — **ห้ามนำเข้า/คัดลอก**

## ข้อควรระวังที่เคยเจอ (อย่าให้บัคกลับมา)

- **ทุกเส้นทางที่เขียนชีต** ต้องอยู่ใต้ `LockService` script lock และเรียก `bumpDataVersion_(fy, ids|"*", user)` หลังเขียนเสร็จ
  ไม่งั้นเครื่องอื่นจะไม่เห็นข้อมูลใหม่ · `rowRev_` ไม่นับคอลัมน์เวลาเข้าดู
- หน้าเว็บอัปเดตอัตโนมัติ (`livePoll` ทุก `LIVE_POLL_MS`) — **ห้ามวาดใหม่ทั้งหน้าในแท็บที่ซ่อนอยู่**: ถ้า `currentTab !== 'home'`
  ให้ตั้ง `homeStale = true` แล้ววาดตอนกลับหน้าแรก (เคยทำหน้าเว็บค้างหลังเปิดสรุปรายงาน)
- มุมมองตาราง (ค่าเริ่มต้นของทุกคน ทุกครั้งที่ล็อกอิน — `listMode = 'table'`, ซ่อนกลุ่ม `TBL_DEFAULT_HIDE` = ตั้งค่า/ประวัติ/หมวด, ไม่จำค่า):
  วาดทีละชุด (`TBL_FIRST = 60`, `TBL_CHUNK = 40`) — โค้ดที่ต้องหาแถวที่ยังไม่ได้วาดต้องเรียก `tblEnsureRendered()` ก่อน
- แถวตารางใช้ id ช่องกรอก `ed-*` ชุดเดียวกับการ์ด (`collectDraft`/`saveKpiEdit` ใช้ร่วม) — selector การ์ด/แถวใช้ `CARD_SEL`, `EDITING_SEL`
  ช่องข้อความยาวอยู่ใน `.tbl-hold` ที่ซ่อนไว้ และถูกย้ายเข้า `#modal-tbl-long` ชั่วคราว
- สรุปรายงานแบ่งหน้า (10/30/50 ตัวต่อหน้า) — ห้ามกลับไปวาดตัวอย่างทั้งหมดทีเดียว (300 ตัว ≈ 6 วินาที) · เลขข้อรันต่อเนื่องทุกตารางด้วย `prNumbering`
  (หน้าแรกใช้ `tblNumbers()` / `kpiNumber` ชุดเดียวกัน)
- การรอเซิร์ฟเวอร์ใช้ `showBusy(msg)` / `hideBusy()` (นับซ้อนได้ มี timeout กันค้าง 90 วิ) ห่อ callback ด้วย `unbusy(fn)`
- บันทึกชนกัน: `saveKpi` คืน `{conflict:true, kpi}` เมื่อ `baseRev` ไม่ตรง → หน้าเว็บมี 3 ทางเลือก (รวมการแก้ของฉันกับค่าล่าสุดใช้ `conflictMergeDraft`)
- **Apps Script ตัดคอมเมนต์ `//` ใน `<script>` ก่อนส่งหน้าเว็บ** ด้วยตัวตัดแบบง่ายที่ไม่รู้จัก regex และจำเครื่องหมายคำพูดข้ามบรรทัด
  (เช่น `/"/g` ทำให้มันคิดว่าอยู่ในข้อความยาวไปหลายพันบรรทัด) → ไปตัด `"http://...` ทิ้งกลางข้อความ สคริปต์ทั้งก้อนพัง **หน้าเว็บจริงล็อกอินไม่ได้**
  ทั้งที่เทสต์ผ่าน (เคยเกิด 25 ต.ค. 2569) — กติกา: ใน `<script>` ห้ามมี `//` ที่ไม่ใช่คอมเมนต์ URL ในข้อความเขียน `'https:\/\/...'` · `tests/gas1.js` ตรวจให้
- ไม่พิมพ์อักขระพิเศษลงไฟล์ตรง ๆ (noncharacter, control char, U+2028/2029, BOM) ใช้รหัส `\uFFFE` แทน · `tests/chars1.js` ตรวจให้
- ใช้เลขอารบิกทั้งโครงการ (หน้าเว็บ สรุปรายงาน/Export PDF Word PowerPoint) ไม่ใช้เลขไทย · ขนาดตัวอักษรพิมพ์: เนื้อหา 12pt, ตารางรายเดือนแนวตั้ง 9pt

- เอกสารแนบตัวชี้วัด (กล่อง 📎 ต่อจากที่มา/สูตร + คอลัมน์ "📎 เอกสารแนบ" ในมุมมองตาราง): เก็บเฉพาะ **ลิงก์** Drive/Docs (ไม่เก็บไฟล์) ในชีต `KPI_Links` แถวละ 1 ลิงก์ ผูกได้หลายตัวชี้วัด (คอลัมน์ "รหัสตัวชี้วัด" คั่น `, `) ผูกกับปีงบ ไม่ลอกไปปีใหม่ · ลบ = สถานะ "ลบ" (ไม่ลบแถว)
  สิทธิ์: ทุกคนที่ดูตัวชี้วัดได้เห็นลิงก์ · แนบ/แก้/ลบได้เฉพาะตัวที่ `editDetails` — ตัวชี้วัดอื่นในลิงก์เดียวกันที่ผู้ใช้แก้ไม่ได้ (หรือมองไม่เห็น) คงเดิมเสมอ · ลิงก์ต้องขึ้นต้น `https://drive.google.com/` หรือ `https://docs.google.com/` (ตรวจทั้งเซิร์ฟเวอร์และหน้าเว็บก่อนใส่ `href`)
  หน้าเว็บโหลดแยกหลัง `getAllData` (`linksLoad`) แล้วอัปเดตกล่อง/เซลล์ในที่เดิมด้วย `data-links-for` (ไม่วาดการ์ดใหม่ ไม่แตะการ์ดที่กำลังแก้) · เขียนใต้ lock + `baseRev` + `bumpDataVersion_(fy, [], user, "LINKS")` (`pollChanges` ส่ง `docs` มี `"LINKS"`)
  หน้าต่างแนบ: เลือกตัวชี้วัดแบบ dropdown (`#lk-pop` ลอยแบบ fixed, ติ๊กหลายตัว, ของฉันขึ้นก่อน, ค้นหา, ป้ายชื่อที่เลือกใต้ปุ่ม) แล้ว**ถามยืนยันว่าเลือกครบหรือยังก่อนบันทึกทุกครั้ง** (`#modal-link-confirm`) — เปิด dropdown จากปุ่มอื่นต้อง `setTimeout(lkPickOpen, 0)` ไม่งั้นตัวจับคลิกนอก dropdown ปิดทันที
- เอกสาร สรพ. (เมนู 🏛️ เอกสาร สรพ. — head/executive/admin; แท็บ CLT เฉพาะ admin, ผอ./QMR, หัวหน้าหน่วย PCT): SAR = ตัวชี้วัด รพ. Part I–IV มุมมอง "รพ." เสมอ (`sarAllPlacements`, ไม่ขึ้นกับตัวกรองหน้าแรก)
  ตัวเลขแก้ไม่ได้ในหน้านี้ · สรุป PDCA เก็บใน `SAR_Doc` กุญแจ `PDCA|<รหัส>` แก้ได้ตามสิทธิ์ `editDetails` · CLT กุญแจ `O|…`, `D|<กลุ่มโรค>|…`, `DIM|<รหัส>`, `S|groups` (โรคที่ใส่ในเอกสาร), `S|kpis` (ตัวชี้วัดที่ **ไม่เอา** `["<กลุ่มโรค>|<รหัส>"]`) — สองกุญแจหลังแก้ได้เฉพาะ **admin** (`CLT_ADMIN_KEYS_`) คัดลอกจากปีก่อนเฉพาะตอน admin
  — ทุกการเขียนอยู่ใต้ lock + ตรวจ `baseRev` + `bumpDataVersion_(fy, [], user, "SAR"|"CLT")` (`pollChanges` ส่ง `docs` ให้หน้าเว็บดึงใหม่) · ช่องที่กำลังพิมพ์ห้ามถูกวาดทับ (`sarRender` รอ `focusout`)
  ผอ./QMR เห็นหมวด PCT ฝั่งหน้าเว็บไม่ครบ → CLT ใช้รายการตัวชี้วัดจาก `getCltDoc` (เซิร์ฟเวอร์) ไม่ใช่ `globalDatabase`
- ขึ้นปีงบใหม่ (`ensureFiscalSheets_` → `carryOverDocsForNewYear_`) ระบบลอกข้อความ SAR (PDCA) + CLT จากปีก่อนอัตโนมัติ (`carryOverDocs_`, ใต้ lock, เติมเฉพาะที่ว่าง) · ปุ่ม admin `carryOverDocsFromPrevious` ใช้ดึงซ้ำ · **ข้อความที่ลอกมาเป็น "ร่าง"** = คอลัมน์ "แก้ไขล่าสุดโดย" ใน `SAR_Doc` เป็น `ร่างจากปีงบ <ปี>` (`SARDOC_DRAFT_PREFIX`) บันทึก/`confirmDocDraft` แล้วเปลี่ยนเป็นชื่อผู้ใช้ ป้ายหาย · ร่างยังไม่นับว่ากรอกแล้ว (`docIsDraft`) · ตาราง Driver/Process Management ที่ลอกมา ตัดรหัสตัวชี้วัดที่ปีนี้ไม่มีออก (`cltCarryText_`)
- แถบซ้ายหน้า SAR/CLT: ช่อง ☑ (เลือกว่าอยู่ในเอกสาร) แยกจากชื่อ (กด = นำทาง: SAR `sarNavTo`, CLT `cltOpenGroup`) — อย่าใส่ checkbox กับชื่อใน `<label>` เดียวกัน · กราฟตัวชี้วัดใน Word/PowerPoint เป็นรูป PNG จาก `generateSvgLineChart` (`sarChartCanvas`) เหมือนบนเว็บ
- Export ทำในเบราว์เซอร์: Word = `docx@9.5.1`, PowerPoint = `pptxgenjs@4.0.1` โหลดจาก jsDelivr ตอนกดปุ่ม (ระบุเวอร์ชันตายตัว) · ฟอนต์ TH SarabunPSK เลขอารบิก · ขนาดตัวอักษรไทยใน docx ต้องตั้ง `sizeComplexScript`/`boldComplexScript` ด้วย
  (ไม่งั้น Word ใช้ขนาด/ตัวหนาของอักษรซับซ้อนเดิม) · ต้องทดสอบการดาวน์โหลดบน `/exec` จริงหลัง deploy ทุกครั้งที่แก้ส่วน Export (sandbox iframe ของ Apps Script)

## งานถัดไปที่ผู้ใช้วางไว้

ยังไม่มี (ฟีเจอร์เอกสาร สรพ. ทำแล้ว — รายละเอียด/ข้อตกลงกับผู้ใช้ดู `docs/SAR-CLT-export.md`)
