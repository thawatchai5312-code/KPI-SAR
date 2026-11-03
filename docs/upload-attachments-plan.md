# แผน: 📤 อัปโหลดไฟล์เป็นเอกสารแนบตัวชี้วัด (ข้างช่องวางลิงก์)

สถานะ: **วางแผนเสร็จ รอผู้ใช้สั่ง "เริ่มได้"** — โมเดลที่ทำต่อ อ่านไฟล์นี้ + `CLAUDE.md` (หัวข้อ "เอกสารแนบตัวชี้วัด") ก่อนเริ่ม

## เป้าหมาย

หน้าต่าง 📎 แนบลิงก์เอกสาร มีปุ่ม **📤 อัปโหลดไฟล์** ข้างช่องวางลิงก์ — เลือกไฟล์จากเครื่อง/ถ่ายรูปจากมือถือ
ระบบเก็บไฟล์ไว้ใน Google Drive ของเจ้าของเว็บแอป แล้วบันทึกเป็นเอกสารแนบแบบเดียวกับลิงก์ (แถวใน `KPI_Links`)
ผูกได้หลายตัวชี้วัด สิทธิ์เหมือนเดิม และ **น้องเป้าอ่านไฟล์ที่อัปโหลดได้** (ปุ่มวิเคราะห์/PDCA/CLT และแชท)

## ข้อตกลงกับผู้ใช้ (ตัดสินแล้ว ห้ามเปลี่ยนเอง)

| เรื่อง | ข้อตกลง |
|---|---|
| คนอื่นเปิดไฟล์อย่างไร | แชร์ไฟล์แบบ **"ทุกคนที่มีลิงก์ดูได้"** (ANYONE_WITH_LINK + VIEW) กดแล้วเปิดใน Google Drive ทันที — ต้องมีคำเตือนห้ามอัปโหลดข้อมูลระบุตัวผู้ป่วย |
| ชนิดไฟล์ | PDF · รูป JPG/PNG · Word (.doc/.docx) · Excel (.xls/.xlsx) · PowerPoint (.ppt/.pptx) — ไฟล์ Office **แปลงเป็น Google Docs/Sheets/Slides ตอนอัปโหลด** (น้องเป้าอ่านได้ + เปิดดูในเบราว์เซอร์ได้) |
| ขนาดสูงสุด | **10 MB** ต่อไฟล์ (ตรวจทั้งหน้าเว็บและเซิร์ฟเวอร์) |
| ลบเอกสารแนบที่เป็นไฟล์อัปโหลด | เมื่อไม่มีแถวลิงก์ที่ใช้งานอยู่ (ทุกปีงบ) อ้างไฟล์นั้นแล้ว → **ย้ายไปโฟลเดอร์ "ลบแล้ว"** และปิดการแชร์ (เป็นส่วนตัว) ไม่ลบถาวร — admin ลบทิ้งเองภายหลัง |

## ขอบเขต — ห้ามกระทบระบบอื่น

- ลิงก์แบบเดิม (วาง URL) ทำงานเหมือนเดิมทุกอย่าง: ฟังก์ชัน `saveKpiLink` / `deleteKpiLink` / `getKpiLinks` เปลี่ยนเฉพาะจุดที่ระบุด้านล่าง
- ไม่แตะชีตปีงบ, `SAR_Doc`, การบันทึกตัวชี้วัด, การส่งต่อปีถัดไป
- แก้ไฟล์: `src/Upload.js` (ใหม่), `src/Links.js` (จุดเล็ก), `src/Ai.js` (อ่านรูป/Slides), `src/Index.html` (หน้าต่างแนบ), `src/appsscript.json` (scope + Drive API), เทสต์, `CLAUDE.md`

## 1. ตั้งค่าโปรเจกต์ (`src/appsscript.json`)

- เปลี่ยน `https://www.googleapis.com/auth/drive.readonly` → `https://www.googleapis.com/auth/drive` (DriveApp สร้างไฟล์/แชร์/ย้ายต้องใช้ drive เต็ม · ไม่ต้องเพิ่ม scope อื่น)
- เพิ่ม Advanced Drive Service (ใช้แปลงไฟล์ Office และ export ข้อความของ Slides):
  ```json
  "dependencies": { "enabledAdvancedServices": [ { "userSymbol": "Drive", "serviceId": "drive", "version": "v3" } ] }
  ```
- **ลำดับขึ้นระบบสำคัญมาก** (web app รันเป็นเจ้าของ `USER_DEPLOYING`): `clasp push -f` → **เจ้าของสคริปต์เปิด Apps Script editor แล้ว Run `uploadAuthorizeOnce` 1 ครั้ง กดอนุญาตสิทธิ์ใหม่** → deploy ลิงก์ทดสอบ → ทดสอบ → `npm run deploy`
  (deployment หลักชี้เวอร์ชันเก่าอยู่จึงไม่พังระหว่างนั้น แต่ถ้า deploy ก่อนอนุญาต ทุกคำขอของเวอร์ชันใหม่จะ error เรื่องสิทธิ์) · ต้องบอกผู้ใช้ขั้นนี้ชัดเจนก่อน deploy
- `uploadAuthorizeOnce()` (ใน `Upload.js`): เรียก `DriveApp.getRootFolder().getName()`, `Drive.Files.list({pageSize:1})` แล้ว `return "อนุญาตแล้ว"` — แบบเดียวกับ `aiAuthorizeOnce`

## 2. เซิร์ฟเวอร์ — `src/Upload.js` (ไฟล์ใหม่)

### ค่าคงที่
```
UPLOAD_MAX_BYTES = 10 * 1024 * 1024
UPLOAD_ROOT_NAME = "KPI SAR - ไฟล์แนบ (อัปโหลดผ่านระบบ)"
UPLOAD_ROOT_PROP = "UPLOAD_ROOT_ID_V1"      // Script Property: id โฟลเดอร์หลัก
UPLOAD_TRASH_NAME = "ลบแล้ว"
UPLOAD_DAILY_LIMIT = 30                     // ครั้ง/คน/วัน (CacheService คีย์ "upl_<user>_<yyyyMMdd>")
UPLOAD_TYPES = {  // นามสกุล → { mime ต้นทางที่ยอมรับ, convertTo (ว่าง = เก็บตามเดิม) }
  pdf:  { mimes: ["application/pdf"] },
  jpg:  { mimes: ["image/jpeg"] }, jpeg: { mimes: ["image/jpeg"] }, png: { mimes: ["image/png"] },
  doc:  { mimes: ["application/msword"], convertTo: "application/vnd.google-apps.document" },
  docx: { mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], convertTo: "application/vnd.google-apps.document" },
  xls:  { mimes: ["application/vnd.ms-excel"], convertTo: "application/vnd.google-apps.spreadsheet" },
  xlsx: { mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], convertTo: "application/vnd.google-apps.spreadsheet" },
  ppt:  { mimes: ["application/vnd.ms-powerpoint"], convertTo: "application/vnd.google-apps.presentation" },
  pptx: { mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], convertTo: "application/vnd.google-apps.presentation" }
}
```
ตัดสินชนิดจาก **นามสกุล** (บางเครื่องส่ง mime ว่าง/`application/octet-stream`) — mime ที่ส่งมาต้องอยู่ในรายการหรือว่าง/octet-stream เท่านั้น
และตรวจ **ลายเซ็นไฟล์** หลัง decode: PDF ขึ้นต้น `%PDF` · PNG `\x89PNG` · JPG `FF D8 FF` · docx/xlsx/pptx = zip `PK\x03\x04` · doc/xls/ppt = OLE `D0 CF 11 E0` — ไม่ตรง = ปฏิเสธ

### โฟลเดอร์ใน Drive ของเจ้าของ
- `uploadRoot_()`: อ่าน `UPLOAD_ROOT_PROP` → `DriveApp.getFolderById` (หาไม่เจอ/ถูกลบ = สร้างใหม่ที่ My Drive แล้วจำ id ใหม่) · โฟลเดอร์ **ไม่แชร์** (แชร์ทีละไฟล์)
- `uploadFolder_(name)`: โฟลเดอร์ย่อยใต้ root ตามชื่อ (`"ปีงบ 2570"`, `"ลบแล้ว"`) สร้างถ้ายังไม่มี
- เรียกภายใต้ script lock (กันสร้างโฟลเดอร์ซ้ำเมื่อสองคนอัปโหลดพร้อมกันครั้งแรก)

### ฟังก์ชันที่หน้าเว็บเรียก: `uploadKpiLinkFile(token, fy, p)`
`p = { title, note, ids: [...], file: { name, type, size, data /* base64 ไม่มี prefix data: */ } }`
1. `requireUser_` · `fy = resolveFiscalYear_(fy)`
2. ตรวจ title/note/ids ด้วยกติกาเดียวกับ `saveKpiLink` (ความยาว, ต้องมีตัวชี้วัด ≥ 1, ≤ `KPILINK_MAX_IDS`)
3. **ตรวจสิทธิ์ก่อนสร้างไฟล์** (กันไฟล์กำพร้า): `kpiLinkPerms_(user, fy, wanted)` ทุกตัวที่เลือกต้อง `edit` (= `editDetails`) ไม่งั้นปฏิเสธพร้อมข้อความแบบเดียวกับ `saveKpiLink`
4. ตรวจโควตารายวัน · ชนิด/นามสกุล · ขนาด (`size` และความยาวหลัง decode ≤ 10 MB) · ลายเซ็นไฟล์
5. สร้างไฟล์ (นอก lock — Drive ช้า):
   - ชื่อไฟล์: `"<ปีงบ> <วันที่ yyyy-MM-dd> <ชื่อไฟล์เดิม>"` (ตัด `/\:*?"<>|` และอักขระควบคุม, ยาว ≤ 150)
   - คำอธิบายไฟล์ (`setDescription`): `"อัปโหลดผ่านระบบ KPI SAR โดย <ผู้ใช้> · ตัวชี้วัด <ids>"`
   - ไม่แปลง: `folder.createFile(Utilities.newBlob(bytes, mime, name))`
   - แปลง Office: `Drive.Files.create({ name, mimeType: convertTo, parents: [folderId] }, blob)` แล้ว `DriveApp.getFileById(res.id)`
   - `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)`
   - url = `file.getUrl()` (ขึ้นต้น `https://drive.google.com/` หรือ `https://docs.google.com/` จึงผ่าน `kpiLinkUrlError_` เดิม)
6. บันทึกแถวลิงก์ด้วย **`saveKpiLink(token, fy, { title, url, note, ids })` ตัวเดิม** (ไม่ refactor) → ได้ `id`
   - ถ้าบันทึกไม่สำเร็จ → `uploadRetire_(fileId)` (ย้ายไป "ลบแล้ว" + ปิดแชร์) แล้วคืนข้อความผิดพลาดเดิม
7. ใต้ script lock: เขียนคอลัมน์ใหม่ของแถวนั้น (ข้อ 3) = `"อัปโหลด"`, `fileId`, ชื่อไฟล์เดิม, ขนาด (ไบต์)
8. นับโควตา · คืน `{ success, id, url, converted: true|false }`
- ห่อทั้งหมดด้วย try/catch คืน `{ success:false, message }` ภาษาไทย (เช่น "ไฟล์ใหญ่เกิน 10 MB", "ชนิดไฟล์ไม่รองรับ (รองรับ PDF รูป JPG/PNG Word Excel PowerPoint)", "แปลงไฟล์ไม่สำเร็จ ลองบันทึกเป็น PDF แล้วอัปโหลดใหม่")
- ไม่ต้อง `bumpDataVersion_` เพิ่ม — `saveKpiLink` ทำให้แล้ว (`"LINKS"`)

### เลิกใช้ไฟล์: `uploadRetireIfUnused_(fileId)`
- อ่าน `KPI_Links` ทุกแถว **ทุกปีงบ**: มีแถวสถานะไม่ใช่ "ลบ" ที่ `aiFileId_(url) === fileId` → ไม่ทำอะไร (เช่น ⤵ ดึงจากปีก่อนลอกลิงก์ไปปีใหม่แล้ว)
- ไม่มีแล้ว และไฟล์นี้เป็นไฟล์อัปโหลดของระบบ (มีแถวใดก็ได้ที่คอลัมน์ "ที่มา" = อัปโหลด และ fileId ตรง) → `uploadRetire_`: `file.moveTo(โฟลเดอร์ "ลบแล้ว")` + `setSharing(PRIVATE, NONE)`
- ไฟล์ที่ผู้ใช้วางลิงก์เอง (ไม่ได้อัปโหลด) **ห้ามแตะ**
- ผิดพลาด = ข้าม (log อย่างเดียว) ห้ามทำให้การลบลิงก์ล้มเหลว

## 3. `src/Links.js` — แก้เฉพาะจุดนี้

- `KPILINK_HEADERS` ต่อท้าย 4 คอลัมน์: `"ที่มา"` (ว่าง = วางลิงก์ / `"อัปโหลด"`), `"รหัสไฟล์ Drive"`, `"ชื่อไฟล์เดิม"`, `"ขนาดไฟล์ (ไบต์)"`
  - ชีตเดิมที่มีอยู่แล้ว: helper `kpiLinkEnsureUploadCols_(sheet)` เติมหัวคอลัมน์ M–P ถ้ายังว่าง (เรียกตอนเขียนแถวอัปโหลด ใต้ lock)
  - **ระวัง**: `saveKpiLink` สร้างแถวใหม่ด้วย `setValues` กว้าง `KPILINK_HEADERS.length` — เมื่อต่อท้าย header ต้องให้แถวลิงก์ปกติเขียนค่าว่างใน 4 คอลัมน์ใหม่ (เพิ่ม `"", "", "", ""` ท้าย array) ไม่งั้นจำนวนคอลัมน์ไม่ตรง
- `kpiLinkRead_` เพิ่มฟิลด์ `source` (r[12]), `fileId` (r[13]), `fileName` (r[14]), `fileSize` (r[15]) — อ่านอย่างเดียว ไม่เปลี่ยน logic เดิม
- `kpiLinkView_` (ส่งให้หน้าเว็บ) เพิ่ม `uploaded: source === "อัปโหลด"`, `fileName`, `fileSize`
- `saveKpiLink`: ถ้าแก้ลิงก์เดิมที่เป็นไฟล์อัปโหลด (`cur.source === "อัปโหลด"`) แล้ว `url` ไม่ตรงของเดิม → ปฏิเสธ `"ไฟล์ที่อัปโหลดเปลี่ยนลิงก์ไม่ได้ — ลบแล้วอัปโหลดไฟล์ใหม่"` (แก้ชื่อ/หมายเหตุ/ตัวชี้วัดได้ตามเดิม)
- `deleteKpiLink`: หลังเขียนสถานะเป็น "ลบ" สำเร็จ (และปล่อย lock แล้ว) ถ้าลิงก์นั้นเป็นไฟล์อัปโหลด → `uploadRetireIfUnused_(fileId)` ใน try/catch แยก

## 4. `src/Ai.js` — ให้น้องเป้าอ่านไฟล์อัปโหลดได้ครบ

`aiAttachments_` อ่านตาม mime ของไฟล์อยู่แล้ว (Google Docs / Sheets / PDF) — ไฟล์ Word/Excel ที่แปลงแล้วจึงอ่านได้ทันที เพิ่ม 2 ชนิด:
- **Google Slides** (`application/vnd.google-apps.presentation`): `Drive.Files.export(fid, "text/plain")` → ข้อความ (ตัด `AI_MAX_FILE_CHARS`, ผ่าน `aiRedact_`) kind = "Google Slides"
- **รูป** (`image/jpeg`, `image/png`): กติกาเดียวกับ PDF — ใช้ได้เฉพาะเมื่อ `allowPdf` (ปุ่มวิเคราะห์) · ≤ `AI_MAX_PDF_BYTES` · ส่งเป็น `inline_data` mime ตามไฟล์ (ตอนนี้ `aiAnalyze` push `mime_type: "application/pdf"` ตายตัว → เปลี่ยนให้ใช้ `f.mime` ที่เก็บไว้ใน `out.pdfs`)
- รายงานผลอ่าน (`report`) ข้อความ "อ่านแล้ว (รูปภาพ — ส่งให้ AI อ่านโดยตรง)" / "อ่านแล้ว (Google Slides)"
- prompt `AI_FILE_RULES`: เพิ่มบรรทัด "รูปภาพ/ภาพสแกน: อ่านเฉพาะข้อความและตัวเลขที่เห็นชัด ถ้าอ่านไม่ออกให้บอกว่าอ่านไม่ชัด ห้ามเดา"
- **ไม่เปลี่ยน** การทำงานของชนิดเดิม · แชท (`allowPdf=false`) ยังไม่ส่ง PDF/รูป เหมือนเดิม

## 5. หน้าเว็บ `src/Index.html` (หน้าต่าง `#modal-link`)

### หน้าตา
```
ลิงก์ Google Drive / Docs
[ วางลิงก์ที่คัดลอกจาก Drive (https://drive.google.com/…) ]  [📤 อัปโหลดไฟล์]
  หรือเลือกไฟล์: PDF รูป Word Excel PowerPoint ไม่เกิน 10 MB
⚠️ ไฟล์ที่อัปโหลดจะแชร์แบบ "ทุกคนที่มีลิงก์ดูได้" — ห้ามอัปโหลดไฟล์ที่มีชื่อ HN หรือเลขบัตรผู้ป่วย
```
- `<input type="file" id="lk-file" hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx">` + ปุ่ม `#lk-file-btn` (`📤 อัปโหลดไฟล์`) วางในแถวเดียวกับ `#lk-url` (flex, มือถือขึ้นบรรทัดใหม่ได้)
- เลือกไฟล์แล้ว: แสดงชิป `📄 ชื่อไฟล์ · 2.4 MB  ✕` ใต้ช่อง · ช่อง `#lk-url` ถูกล้างและ disabled (ใช้อย่างใดอย่างหนึ่ง) · กด ✕ = ยกเลิกไฟล์ กลับไปวางลิงก์ได้
- ชื่อเอกสาร (`#lk-title`) ว่างอยู่ → เติมชื่อไฟล์ (ตัดนามสกุล) ให้อัตโนมัติ
- ตรวจที่หน้าเว็บก่อน: นามสกุลอยู่ในรายการ · ขนาด ≤ 10 MB → ไม่ผ่าน `lkErr("…")` และไม่รับไฟล์
- มือถือ: input file เปิดกล้อง/คลังรูปได้เอง (ไม่ต้องทำเพิ่ม)
- **แก้ไขลิงก์เดิม**: ถ้าเป็นไฟล์อัปโหลด (`l.uploaded`) ซ่อนปุ่มอัปโหลด และ `#lk-url` อ่านอย่างเดียว พร้อมข้อความ "ไฟล์ที่อัปโหลด — เปลี่ยนไฟล์: ลบแล้วอัปโหลดใหม่" · ลิงก์ปกติแก้ได้เหมือนเดิม (ไม่มีปุ่มอัปโหลดตอนแก้ไข — อัปโหลดได้เฉพาะตอนแนบใหม่)

### บันทึก
- `lkSave`: ถ้ามีไฟล์ (`lk.file`) ข้าม `lkUrlCheck` (ยังตรวจชื่อ + ตัวชี้วัดเหมือนเดิม) แล้วเปิดหน้าต่างยืนยันเดิม (`#modal-link-confirm`) + บรรทัด "📤 จะอัปโหลดไฟล์ <ชื่อ> (<ขนาด>) และแชร์แบบทุกคนที่มีลิงก์ดูได้"
- `lkConfirmGo`: มีไฟล์ → อ่านด้วย `FileReader.readAsDataURL` (ตัด `data:...;base64,`) → `showBusy('กำลังอัปโหลดไฟล์… อย่าปิดหน้านี้', 300000)` → `google.script.run.uploadKpiLinkFile(token, fy, {...})` → สำเร็จ: ปิดหน้าต่าง + `linksLoad()` แบบเดียวกับบันทึกลิงก์ · ล้มเหลว: `lkErr(res.message)` คงข้อมูลในหน้าต่างไว้ · ไม่มีไฟล์ → `saveKpiLink` เดิมทุกอย่าง
- กันกดซ้ำระหว่างอัปโหลด (ปุ่มบันทึก disabled)

### แสดงผล
- รายการในกล่อง 📎 และเซลล์ตาราง (`linkItemHtml`): ไฟล์อัปโหลดใช้ไอคอน `📤` แทน `📄` และ title "ไฟล์ที่อัปโหลด · <ชื่อไฟล์เดิม> · <ขนาด>" — ลิงก์ปกติเหมือนเดิม
- กติกา `linkUrlOk` เดิม (ก่อนใส่ `href`) ใช้ต่อได้ เพราะ URL ไฟล์อัปโหลดเป็น drive/docs.google.com
- กติกา `//` ใน `<script>` (ดู CLAUDE.md): ข้อความ URL ในสคริปต์เขียน `'https:\/\/…'` · `tests/gas1.js` ต้องผ่าน

## 6. เทสต์ (ข้อมูลสมมติ ไม่เรียก Drive/Gemini จริง)

- `tests/upload1.js` (เซิร์ฟเวอร์ — จำลอง `DriveApp`, `Drive.Files.create/export`, `Utilities.base64Decode/newBlob` ในไฟล์เทสต์):
  - สิทธิ์: staff แนบกับตัวที่ไม่ใช่ของตน = ปฏิเสธ **และไม่มีไฟล์ถูกสร้าง** · token ผิด = ปฏิเสธ
  - ชนิด/นามสกุลไม่รองรับ · ลายเซ็นไม่ตรง (เช่น .pdf ที่ข้างในไม่ใช่ PDF) · เกิน 10 MB · เกินโควตารายวัน = ปฏิเสธ
  - PDF/รูป = เก็บตามเดิม · docx/xlsx/pptx = เรียก `Drive.Files.create` พร้อม mimeType แปลง · ทุกไฟล์ `setSharing(ANYONE_WITH_LINK, VIEW)` · อยู่ในโฟลเดอร์ `ปีงบ <fy>` ใต้ root ที่จำ id ไว้
  - แถว `KPI_Links`: คอลัมน์เดิมถูกต้อง + ที่มา/รหัสไฟล์/ชื่อเดิม/ขนาด · `bumpDataVersion_` (`LINKS`) ถูกเรียก
  - ลิงก์ปกติที่บันทึกหลังเพิ่มคอลัมน์ยังมี 16 คอลัมน์ครบ และ `getKpiLinks` คืนเหมือนเดิม (+ `uploaded:false`)
  - ลบลิงก์อัปโหลดจนไม่เหลือตัวชี้วัด → ไฟล์ย้ายไป "ลบแล้ว" + ปิดแชร์ · ถ้ามีแถวปีงบอื่นอ้างไฟล์เดียวกัน → ไม่ย้าย · ลบลิงก์ปกติ → ไม่แตะไฟล์
  - แก้ url ของลิงก์อัปโหลด = ปฏิเสธ · แก้ชื่อ/ตัวชี้วัดได้
  - `saveKpiLink` ล้ม (เช่น ชน) หลังสร้างไฟล์ → ไฟล์ถูกย้ายไป "ลบแล้ว"
  - Ai: `aiAttachments_` อ่าน Google Slides (export) และรูป (inline_data mime ถูกต้อง) · แชทไม่ส่งรูป
- `tests/ui71.js` (Playwright, `pg.setInputFiles('#lk-file', …)` ไฟล์สมมติเล็ก ๆ):
  - ปุ่มอยู่ข้างช่องลิงก์ · เลือกไฟล์ → ชิปชื่อไฟล์ + ช่องลิงก์ disabled + ชื่อเอกสารเติมให้ · ✕ ยกเลิกได้
  - ไฟล์ .exe / ไฟล์ใหญ่ (สร้าง buffer 11 MB) → ข้อความผิดพลาด ไม่ส่งเซิร์ฟเวอร์
  - บันทึก → หน้าต่างยืนยันมีบรรทัดอัปโหลด → เซิร์ฟเวอร์ได้ base64 ถูกต้อง → รายการขึ้น 📤
  - แก้ไขลิงก์อัปโหลด: ช่องลิงก์อ่านอย่างเดียว ไม่มีปุ่มอัปโหลด
  - มือถือ (390×844 isMobile hasTouch + meta viewport แบบ `tests/ui70.js`): ปุ่มอัปโหลดไม่ล้นจอ
  - ภาพหน้าจอดูเองใน `tests/out/` (ไม่ต้องส่งให้ผู้ใช้)
- เทสต์เดิมที่ต้องผ่าน (กันกระทบ): `link1`, `ui53`, `pull1`, `ai1`, `ai2`, `ui66`, `gas1`, `chars1` + `bash tests/run.sh server`
- ลงทะเบียน `upload1` ใน SERVER และ `ui71` ใน UI ของ `tests/run.sh` · เพิ่ม `Upload.js` ใน load list ของ `tests/harness7.js`

## 7. ขั้นตอนขึ้นระบบ

1. เทสต์ผ่าน → commit/push
2. `npx @google/clasp@3 push -f`
3. **แจ้งผู้ใช้ให้เปิด Apps Script editor → เลือกฟังก์ชัน `uploadAuthorizeOnce` → Run → อนุญาตสิทธิ์ (Drive เต็ม)** รอผู้ใช้ยืนยันว่าทำแล้ว
4. `clasp deploy -i <ลิงก์ทดสอบ>` → ผู้ใช้ทดลองอัปโหลด PDF / รูปจากมือถือ / docx แล้วกดน้องเป้าวิเคราะห์
5. ผู้ใช้สั่ง "ขึ้นหลัก" → `npm run deploy`
6. อัปเดต `CLAUDE.md` (ตาราง `Upload.js` + หัวข้อเอกสารแนบ: คอลัมน์ M–P, แชร์ทุกคนที่มีลิงก์, 10 MB, ย้ายไป "ลบแล้ว", ลำดับอนุญาตสิทธิ์) — **ไม่ต้องแตะคู่มือ** จนกว่าผู้ใช้สั่ง

## ความเสี่ยงที่ต้องบอกผู้ใช้

- **ลิงก์ไฟล์อัปโหลดเปิดได้โดยไม่ต้องล็อกอินระบบ** (ตามที่เลือก) — ใครได้ลิงก์ไปก็เปิดได้ · มีคำเตือนในหน้าต่างแล้ว แต่ผู้อัปโหลดต้องระวังเอง
- พื้นที่ Drive ฟรีของเจ้าของ 15 GB (รวม Gmail/Photos) — ไฟล์ละ ≤ 10 MB × 30 ครั้ง/คน/วัน · ควรดูพื้นที่เป็นระยะ และล้างโฟลเดอร์ "ลบแล้ว"
- scope Drive เต็ม = สคริปต์เข้าถึง Drive ทั้งหมดของเจ้าของได้ (ใช้เฉพาะโฟลเดอร์ของระบบ แต่สิทธิ์กว้างขึ้นจากเดิมที่อ่านอย่างเดียว)
- ไฟล์ Office ที่แปลงแล้ว รูปแบบอาจเพี้ยนเล็กน้อย (ตาราง/ฟอนต์) — ถ้าต้องการหน้าตาเดิม 100% ให้บันทึกเป็น PDF ก่อนอัปโหลด
