# แผน: ผู้ที่แก้รายละเอียดตัวชี้วัดได้ แก้ "วิธีสรุปผลรายเดือน" + "ความถี่การเก็บข้อมูล" ได้

สถานะ: **แผน รอผู้ใช้สั่ง "เริ่มได้"** (ผู้ใช้จะให้โมเดลอื่นทำ — เขียนละเอียดพอให้ทำตามได้ทันที) · แก้ `src/รหัส.js` (saveKpiCore_) + `src/Index.html` (การ์ด/แถวตาราง/collectDraft/ระบบสอน) · ไม่แตะข้อมูลในชีต · ขึ้นลิงก์ทดสอบก่อน แล้วผู้ใช้สั่งขึ้นหลัก

## ตอนนี้
- แก้ได้เฉพาะ admin / ผอ. / QMR (`isPrivileged_`) ทั้งเซิร์ฟเวอร์และหน้าเว็บ
  - เซิร์ฟเวอร์ `saveKpiCore_` (รหัส.js ~บรรทัด 544): บล็อก `if (privileged) { summaryMethod … frequency … levels }` — ผู้ใช้อื่นส่งมา = **ถูกเมินเงียบ ๆ**
  - หน้าเว็บ: การ์ด (`cardHtml` ~บรรทัด 3154–3155 `${ed && priv ? … ed-frequency / ed-summary …}`) · ตาราง (`tblCells` `c.sm`/`c.fq` ~บรรทัด 8117–8118 `ed && priv`) · `collectDraft` (~บรรทัด 3434 ส่ง `summaryMethod`/`frequency` เฉพาะ `isPrivilegedUser()`)
- ตอน **เพิ่มตัวชี้วัดใหม่** ทุกคนเลือกได้อยู่แล้ว (`#add-kpi-summary`, `#add-kpi-frequency`, `addIndicator`)

## กติกาใหม่ (ผู้ใช้เลือก)
- **วิธีสรุปผลรายเดือน** (เฉลี่ย / ผลรวม / เดือนล่าสุด) และ **ความถี่การเก็บข้อมูล** (รายเดือน / รายไตรมาส / ครึ่งปี / รายปี): แก้ได้ทุกคนที่มีสิทธิ์ **`editDetails`** ของตัวชี้วัดนั้นในปีงบนั้น (= ผู้รับผิดชอบ, หัวหน้าหน่วยที่ดูแล, ผู้ที่ได้สิทธิ์ "หัวหน้า…", admin/ผอ./QMR — ตาม `getKpiPermission_` เดิม ไม่แก้กติกาสิทธิ์)
- 🏅 คะแนน KPI: **ไม่กันพิเศษ** — เปลี่ยนวิธีสรุป/ความถี่แล้วคะแนนคำนวณใหม่ตามค่าใหม่ทันที (คะแนนคิดตอนอ่านอยู่แล้ว ไม่ต้องแก้ Score.js)
- **ระดับ (levels)** ยังเป็นของ admin/ผอ./QMR เหมือนเดิม (ไม่อยู่ในงานนี้)

## แก้ทีละจุด
### 1. เซิร์ฟเวอร์ `src/รหัส.js` — `saveKpiCore_`
1. ย้าย summaryMethod + frequency ออกจาก `if (privileged) { … }` ไปเป็นบล็อกใหม่ที่เงื่อนไข `perm.editDetails` (คง `levels` ไว้ใน `if (privileged)` ตามเดิม)
2. **ตรวจสิทธิ์ก่อนเขียนอะไรทั้งนั้น** (วางคู่กับ `metaDiffers` เดิม ~บรรทัด 392):
   ```js
   var sfDiffers = (item.summaryMethod !== undefined && SUMMARY_METHODS.indexOf(item.summaryMethod) !== -1 && item.summaryMethod !== old.summaryMethod)
     || (item.frequency !== undefined && FREQUENCIES.indexOf(item.frequency) !== -1 && item.frequency !== old.frequency);
   if (sfDiffers && !perm.editDetails) return { success: false, message: "ไม่มีสิทธิ์แก้ไขวิธีสรุปผล/ความถี่ของตัวชี้วัดนี้ในปีงบ " + fy };
   ```
   - เหตุผล: ส่งต่อปีถัดไป (`Forward.js` `fwdApplyToYear_` เรียก `saveKpiCore_` ซ้ำในปีถัดไป) ต้องได้ข้อความ "ข้าม + เหตุผล" ไม่ใช่รายงานว่าส่งแล้วแต่ถูกเมิน
   - ค่าไม่อยู่ในรายการ (ว่าง/ผิด) = ไม่นับว่าเปลี่ยน (เหมือนเดิม)
3. การเขียน: คงโค้ดเดิมทุกอย่าง (`setValue` + เติมหัวคอลัมน์ถ้าว่าง + `changed = true`) แค่เปลี่ยนเงื่อนไขครอบเป็น `perm.editDetails`
4. แก้คอมเมนต์หัว `saveKpi` (~บรรทัด 333) ให้ตรงกติกาใหม่
- ไม่ต้องแก้: `Forward.js` (มี `summaryMethod`/`frequency` ใน `FWD_TEXT_FIELDS` แล้ว — ใช้กติกาใหม่อัตโนมัติผ่าน `saveKpiCore_`) · `addIndicator` · `Score.js` · `PullPrev.js`

### 2. หน้าเว็บ `src/Index.html`
1. `cardHtml`: 2 บรรทัด `${ed && priv ? \`<div class="form-group" …>ความถี่… / วิธีสรุป…\` : ''}` → เปลี่ยน `ed && priv` เป็น `canDet` (`canDet` = `ed && kpi.canEditDetails` มีอยู่แล้วในฟังก์ชัน)
2. `tblCells`: `c.sm = ed && priv ? …` และ `c.fq = ed && priv ? …` → เปลี่ยนเป็น `canDet ? …` (ตัวแปร `canDet` มีในฟังก์ชันแล้ว)
3. `collectDraft`: ย้าย `p.summaryMethod = getVal('ed-summary'); p.frequency = getVal('ed-frequency');` จากบล็อก `if (isPrivilegedUser())` ไปไว้ในบล็อก `if (kpi.canEditDetails) { … }` · `p.levels` คงอยู่ในบล็อก privileged
   - `getVal` คืน `undefined` เมื่อไม่มีช่อง → ไม่ส่งค่า (ปลอดภัย)
   - `editSnapshot`/`isDirty` ใช้ `collectDraft` อยู่แล้ว → เปลี่ยน select แล้วขึ้น "● ยังไม่ได้บันทึก" เอง
4. ระบบสอน (🎓) ขั้น "ความถี่และวิธีสรุปผล (ผู้บริหาร)" (~บรรทัด 8446): `when: () => isPrivilegedUser() && !!tourEditKpi()` → `when: () => { const k = tourEditKpi(); return !!k && k.canEditDetails; }` · ตัด "(ผู้บริหาร)" ออกจากหัวข้อ
- ไม่แตะ: ตัวเลือก/ค่าตั้งต้นของ select, ช่องในฟอร์มเพิ่มตัวชี้วัด, การแสดง "สรุปรายเดือน (วิธี)" บนการ์ด

### 3. `CLAUDE.md`
- เพิ่ม 1 บรรทัดในหัวข้อข้อควรระวัง: วิธีสรุปผล/ความถี่ แก้ได้ตามสิทธิ์ `editDetails` (เซิร์ฟเวอร์ตรวจใน `saveKpiCore_` ก่อนเขียน · ระดับยังเฉพาะ admin/ผอ./QMR) · เทสต์ `tests/sum1.js`, `tests/ui81.js`

## ผลกระทบ (ตรวจแล้ว)
| ส่วน | ผล |
|---|---|
| 🏅 คะแนน KPI | คิดใหม่ตามวิธีสรุป/ความถี่ใหม่ทันที (ผู้ใช้ยอมรับ) |
| ส่งต่อปีถัดไป ☑ | ส่งวิธีสรุป/ความถี่ไปปีที่ใหม่กว่าตามสิทธิ์ในปีนั้น · ไม่มีสิทธิ์ = ปีนั้นข้ามพร้อมเหตุผล |
| ⤵ ดึงข้อมูลปีก่อน | ใช้วิธีสรุปของปีนี้คำนวณผลปีที่แล้ว (เดิม) |
| สรุปรายงาน/SAR/การ์ด | แสดงสรุปตามวิธีใหม่ (คำนวณตอนแสดง) |
| สถานะ 3 ระดับ (ความถี่) | ระบบเช็กรอบตามความถี่ใหม่ (`kpiStatus` อ่านค่า frequency เดิมอยู่แล้ว) |
| แก้ชนกัน | `rowRev_` นับคอลัมน์ AH/AJ อยู่แล้ว → ตรวจ `baseRev` ตามปกติ |
| อัปเดตอัตโนมัติ | `changed = true` → `bumpDataVersion_` เดิม |

## เทสต์
- ใหม่ `tests/sum1.js` (เซิร์ฟเวอร์, harness7):
  - staff ที่เป็นผู้รับผิดชอบ: เปลี่ยน summaryMethod `เฉลี่ย→ผลรวม` และ frequency `รายเดือน→รายไตรมาส` สำเร็จ, ชีตคอลัมน์ AH/AJ เปลี่ยน, `changed === true`
  - staff ที่ไม่ใช่ผู้รับผิดชอบ (ดูได้แต่แก้ไม่ได้): ส่งมา → `success:false` + ข้อความ "ไม่มีสิทธิ์แก้ไขวิธีสรุปผล" + ชีตไม่เปลี่ยน
  - ส่งค่าเดิม/ค่าที่ไม่อยู่ในรายการ → ไม่ error ไม่เปลี่ยน
  - `forward: true` → ปีถัดไปเปลี่ยนตาม (มีชีตปีถัดไปใน fixture)
  - admin ยังแก้ได้ · levels ยังแก้ไม่ได้สำหรับ staff
- ใหม่ `tests/ui81.js` (หน้าเว็บ): staff ผู้รับผิดชอบเปิดแก้การ์ด → มี `#ed-summary`/`#ed-frequency` → เปลี่ยน → บันทึก → ชีตเปลี่ยน + "สรุปรายเดือน (ผลรวม)" แสดง · ตารางแถวแก้ไขมี select ในคอลัมน์ ⚙️ ตั้งค่า · ตัวที่ดูอย่างเดียวไม่มี select
- **ปรับเทสต์เดิมที่คาดว่า staff ไม่มีช่องนี้**:
  - `tests/ui18.js` บรรทัด ~40: `!(await has('#ed-summary'))&&!(await has('#ed-frequency'))` → ต้องมี (`await has(...)`)
  - `tests/ui45.js` บรรทัด ~53–54: `noPriv:['ed-summary','ed-frequency']…` คาด `'false,false'` → คาด `'true,true'` (ระดับ `.ed-level-cb` ยังไม่มีเหมือนเดิม)
- รัน `bash tests/run.sh` ทั้งชุด (+ เพิ่ม `sum1` ใน SERVER, `ui81` ใน UI ของ `tests/run.sh`)
