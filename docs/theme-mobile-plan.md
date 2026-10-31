# แผนงาน: สี AI ให้เข้าธีม + โทรศัพท์/แท็บเล็ตเริ่มที่มุมมองการ์ด — **รอผู้ใช้สั่ง "เริ่มได้"**

ตกลงกับผู้ใช้แล้ว (ต.ค. 2569) · กติกาทั่วไปดู `CLAUDE.md` (ตอบไทย · **แก้เฉพาะที่สั่ง ห้ามแตะโค้ดอื่น** · เทสต์เฉพาะส่วนที่แก้ · ไม่ต้องสร้างภาพให้ผู้ใช้ดูระหว่างคุย)
ทั้งสองงานแก้เฉพาะ `src/Index.html` (+ เทสต์) — ไม่แตะฝั่งเซิร์ฟเวอร์

---

## งาน A: สีปุ่ม/ไอคอนผู้ช่วย AI "น้องเป้า" ให้เข้าธีมเขียว (ผู้ใช้เลือก: **เขียวธีม + ดาวสีทอง**)

ปัญหา: ตอนนี้ใช้สีไล่ น้ำเงิน→ม่วง→ชมพู (`#2563eb → #7c3aed → #c026d3`) ไม่เข้าธีมและโดด
ธีมของเว็บ (`:root` บนสุดของ Index.html): `--primary-gradient: linear-gradient(135deg, #2c9936, #004a24)` · `--primary-color: #004a24` ·
`--secondary-gradient` เขียวอ่อน · `--accent-gradient` ทอง `#c9991d → #ae5f05` · ปุ่มรอง `.btn-secondary` พื้น `#edf2ee` ตัวอักษร `#1f2d24`

ค้นจุดที่ต้องแก้: `grep -n "2563eb\|7c3aed\|c026d3\|6d28d9\|aiGlow\|e0f2fe" src/Index.html` (เฉพาะบรรทัดของ AI — CSS `.ai-*`, `#ai-fab`, `#ai-chat`, `#modal-ai`, `#ai-settings`; **ห้ามแก้ `#e0f2fe` ที่ใช้กับส่วนอื่น**)

| จุด | ตอนนี้ | เปลี่ยนเป็น |
|---|---|---|
| `#ai-fab` (ปุ่มลอย) พื้น | ไล่ฟ้า→ม่วง→ชมพู | `var(--primary-gradient)` |
| `#ai-fab` เงา | `rgba(91,33,182,…)` | เงาเขียว `rgba(0, 74, 36, .35)` (hover `.45`) |
| `#ai-fab .ai-ico` (ดาว) | ขาว (currentColor) | **ทอง** `#fcd34d` — ตั้ง `color` ที่ `.ai-ico` ไม่ใช่ที่ปุ่ม เพื่อให้ป้าย "ถามน้องเป้า" ยังเป็นสีขาว |
| `@keyframes aiGlow` | ม่วง `rgba(124,58,237,…)` | เขียว `rgba(44, 153, 54, .55)` → 0 และจบที่เงาเขียวเดียวกับข้างบน |
| `.btn.ai-btn` (ปุ่มใต้ช่อง 3 จุด) | พื้นไล่ม่วง ตัวขาว | พื้น `#edf2ee` · ตัวอักษร `var(--primary-color)` · ขอบ `1px solid #b7d7bd` · ไม่มีเงาม่วง · hover พื้น `#dcefe0` · ไอคอนดาวในปุ่มสีทองเข้ม `#c9991d` (`.btn.ai-btn .ai-ico { color: #c9991d; }`) |
| `.ai-head` (หัวแชท) | ไล่ฟ้า→ม่วง | `var(--primary-gradient)` · ดาวในหัว `.ai-head-title .ai-ico { color: #fcd34d; }` |
| `.ai-msg.u` (ข้อความผู้ใช้) | `#6d28d9` | `#1f7a2b` (เขียวกลาง อ่านตัวขาวชัด) |
| `.ai-quick button:hover` | `#e0f2fe` | `#e8f5e9` |
| `#modal-ai .modal-header` (inline style) | ไล่ฟ้า→ม่วง | `var(--primary-gradient)` (หรือลบ inline style ให้ใช้หัว modal ปกติของเว็บ) |
| `#ai-settings` กล่องตั้งค่า | ขอบ/พื้นฟ้า `#bae6fd`/`#f0f9ff` · หัวสี `#6d28d9` | ขอบ `#b7d7bd` · พื้น `#f3faf4` · หัวสี `var(--primary-color)` · ดาวทอง `#c9991d` |

ไม่เปลี่ยน: รูปทรงไอคอน (`AI_ICON` SVG ประกายดาว), ข้อความ/ชื่อ "น้องเป้า", ขนาด/ตำแหน่งแชท ¼×¾, ตรรกะทั้งหมด
หลังแก้: อัปเดต `CLAUDE.md` บรรทัด "ไอคอนประกายดาว SVG (`AI_ICON`) สีไล่ฟ้า→ม่วง" → "สีเขียวธีม ดาวทอง"

---

## งาน B: ใช้บนอุปกรณ์จอแตะ → มุมมองเริ่มต้น = **การ์ด** ทุกคน (ผู้ใช้เลือก: **จอแตะทุกขนาด รวมแท็บเล็ต**)

กฎเดิม (คงไว้สำหรับคอมพิวเตอร์): `defaultListMode()` ใน Index.html — staff = การ์ด · head/executive/admin = ตาราง (ตั้งตอนล็อกอินใน `tblResetView`, ไม่จำค่า)
กฎใหม่: **ถ้าเป็นอุปกรณ์จอแตะ (โทรศัพท์/แท็บเล็ต) → การ์ด ทุก Tier** · นอกนั้นเหมือนเดิมทุกอย่าง

### ขั้นตอน
1. เพิ่มฟังก์ชันตรวจอุปกรณ์จอแตะ (วางใกล้ `defaultListMode`):
   ```js
   // โทรศัพท์/แท็บเล็ต (จอแตะเป็นหลัก ไม่มีเมาส์ชี้) — โน้ตบุ๊กจอแตะที่มีเมาส์/ทัชแพดไม่นับ
   function isTouchDevice() { try { return window.matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) { return false; } }
   ```
2. `defaultListMode()` → `return isTouchDevice() || (currentUser && currentUser.tier === 'staff') ? 'card' : 'table';`
3. `tblResetView()` ไม่ต้องแก้ (ยังซ่อนกลุ่มคอลัมน์ตาม Tier ไว้ — ถ้าผู้ใช้มือถือกดสลับเป็นตารางเองก็ได้ค่าซ่อนเหมือนเดิม)
4. ระบบสอน: `const tourMode = () => (currentUser && currentUser.tier === 'staff' ? 'card' : 'table');` → เปลี่ยนเป็น `const tourMode = () => defaultListMode();` เพื่อให้ขั้นตอนสอนตรงกับมุมมองที่ผู้ใช้เห็นบนมือถือ
   และข้อความในขั้นสอนที่อ้าง "(เจ้าหน้าที่เริ่มที่การ์ดทุกครั้งที่ล็อกอิน · สลับเป็นตารางได้เอง)" (ค้น `tourMode() === 'card' ? '(เจ้าหน้าที่เริ่มที่การ์ด`) → แก้เป็น "(เจ้าหน้าที่ และการใช้งานบนโทรศัพท์/แท็บเล็ต เริ่มที่การ์ดทุกครั้งที่ล็อกอิน · สลับเป็นตารางได้เอง)" — แก้เฉพาะข้อความนี้
5. ไม่จำค่า / ไม่เปลี่ยนตอนหมุนจอหรือย่อหน้าต่าง — ตัดสินครั้งเดียวตอนล็อกอิน (เหมือนเดิม) · ปุ่มสลับ 🗂️ การ์ด / 📋 ตาราง ยังใช้ได้ตามเดิม
6. อัปเดต `CLAUDE.md` หัวข้อ "มุมมองเริ่มต้นตาม Tier" เพิ่ม: "**อุปกรณ์จอแตะ** (`isTouchDevice()` = `(hover: none) and (pointer: coarse)`) เริ่มที่การ์ดทุก Tier · `tourMode = defaultListMode`"

### จุดที่ต้องระวัง
- เทสต์เดิมทั้งหมดรัน Chromium แบบเดสก์ท็อป (ไม่ใช่จอแตะ) → ค่าเริ่มต้นเดิมไม่เปลี่ยน เทสต์เดิมควรผ่านเหมือนเดิม
- ห้ามใช้ความกว้างจอ (`max-width`) ตัดสิน — ผู้ใช้ต้องการ "จอแตะทุกขนาด" (iPad จอกว้างก็ต้องเป็นการ์ด) และคอมจอแคบต้องยังเป็นตาราง
- `goToKpi` / `tblEnsureRendered` / ส่วนอื่นไม่ต้องแก้

---

## เทสต์ (เฉพาะส่วนที่แก้)
1. `bash tests/run.sh gas1 chars1` — ต้องผ่านก่อน deploy เสมอ
2. เทสต์เดิมที่เกี่ยว: `ui45 ui60 ui61 ui66` และ `TOURTEST=1` เฉพาะ `ui40` (run.sh ตั้งให้เองเมื่อสั่ง `bash tests/run.sh ui40`)
3. เทสต์ใหม่ `tests/ui67.js` (ลงทะเบียนในรายการ UI ของ `tests/run.sh`) — ใช้ helper `open()` แบบ `tests/ui66.js`/`ui63.js` แต่สร้าง context จอแตะ:
   - โทรศัพท์: `browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })` ล็อกอิน **admin** → `listMode === 'card'`, มี `.kpi-card`, ไม่มี `#kpi-table`
   - แท็บเล็ต: `viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true` ล็อกอิน **head** → การ์ด
   - คอมพิวเตอร์ (context ปกติ): admin → ตาราง (ยืนยันว่ากฎเดิมไม่เปลี่ยน) · staff → การ์ด
   - บนโทรศัพท์ กดสลับเป็นตารางได้ (`setListMode('table')`) แล้ว logout/login ใหม่ → กลับเป็นการ์ด
   - `tourMode()` บนโทรศัพท์ = `'card'`
   - **ตรวจก่อนว่า Chromium ใน Playwright ตอบ `matchMedia('(hover: none) and (pointer: coarse)')` เป็น true** เมื่อใช้ `isMobile + hasTouch` (`await pg.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)`) — ถ้าไม่ true ให้ใช้ `addInitScript` จำลอง `window.matchMedia` สำหรับ query นี้ แล้วบันทึกเหตุผลไว้ในคอมเมนต์เทสต์
   - สี AI: ตรวจ `getComputedStyle(#ai-fab).backgroundImage` มีสีเขียว (`44, 153, 54` หรือ `0, 74, 36`) และไม่มี `124, 58, 237` · `.ai-btn` พื้นไม่ใช่ gradient ม่วง (ต้องเปิด AI ด้วย `C.aiSaveSettings` + จำลอง `UrlFetchApp` แบบ ui66)
4. ดูภาพหน้าจอใน `tests/out/` (ปุ่มลอย หัวแชท ปุ่มใต้ช่อง และการ์ดบนจอโทรศัพท์) ให้แน่ใจว่าสีเข้าธีมและไม่ล้น — **ไม่ต้องส่งภาพให้ผู้ใช้**

## Deploy
- เทสต์ผ่าน → `git commit` + `git push -u origin claude/apps-script-auto-deploy-nhxswh`
- ขึ้น **ลิงก์ทดสอบ** ก่อน: `npx --yes @google/clasp@3 push -f` แล้ว `npx --yes @google/clasp@3 deploy -i AKfycbzBSVmolUFi1a_AjLaKKOCB7TXGeUEBt79iEDOEtjJfL18OiK7u_EseYHclaMXOJqRhvg -d "TEST theme+mobile"` (ห้าม `npm run deploy` จนกว่าผู้ใช้สั่ง "ขึ้นหลัก" — มันทับทุก deployment)
- แจ้งผู้ใช้เป็นภาษาไทย: ให้เปิดลิงก์ทดสอบบนโทรศัพท์ (ต้องรีเฟรช/ล็อกอินใหม่) ดูว่าเป็นการ์ด และดูสีปุ่ม AI · ผู้ใช้สั่ง "ขึ้นหลัก" แล้วจึง `npm run deploy` → commit/push
- ไม่ต้องอัปเดตคู่มือ (ผู้ใช้สั่งเองเมื่อต้องการ)
