/**
 * จัดหมวดของ 3 มุมมอง (ใช้ตอน "🧹 จัดระเบียบข้อมูล" และตอนจัดหมวดอัตโนมัติให้ตัวชี้วัดใหม่)
 *  - รพ.      : หมวด Part I–IV (ไม่แตะ)
 *  - QA       : หมวดหลัก "<หน่วย> QA" › มิติที่ 1–5  ← แถวในไฟล์ NSO ที่ Part ลงท้าย QA, VIP, IC และ "ภาพรวม NSO"
 *  - หน่วยงาน : ไฟล์ NSO  → Part › Category ตามไฟล์ (ไม่มีหมวด NSO)
 *               ไฟล์ PCT  → PCT › กลุ่มโรค (เรียงตามไฟล์)
 *               ตัวชี้วัด รพ./ตัวที่เพิ่มเอง → หน่วย › หัวข้อของหน่วยที่ใกล้ที่สุด (หน่วยที่มีหัวข้อจากไฟล์ NSO) หรือขั้นตอนการดูแล 13 หมวด
 * ตัวคำนวณเป็นฟังก์ชันล้วน (viewPlaceRow_) — ข้อมูลประกอบ (ที่มาจากไฟล์ NSO ฯลฯ) อ่านครั้งเดียวใน viewContext_
 */

var VIEW_QA_SUFFIX = " QA";
var VIEW_NSO_OVERALL = "ภาพรวมฝ่ายการพยาบาล";
var VIEW_QA_UNITS = { VIP: 1, IC: 1 };   // ในไฟล์ NSO ไม่ได้เขียนว่า QA แต่เป็นรายการแบบ QA

// ขั้นตอนการดูแล / มิติคุณภาพ (หมวดย่อยของตัวชี้วัด รพ. ในมุมมองหน่วยงาน) — เรียงตามลำดับนี้
var VIEW_STAGES = [
  "การเข้าถึงบริการ", "การคัดกรองและคัดแยก", "การประเมินและวินิจฉัย", "การวางแผนการดูแล", "การดูแลรักษา",
  "ความปลอดภัยและความเสี่ยง", "การให้ข้อมูลและเสริมพลัง", "การฟื้นฟูสภาพ", "การดูแลต่อเนื่อง",
  "การส่งเสริมสุขภาพและป้องกันโรค", "ความพึงพอใจและข้อร้องเรียน", "บุคลากรและการพัฒนา", "การบริหารจัดการและประสิทธิภาพ"
];
// คำในชื่อตัวชี้วัด → ขั้นตอน (ข้อแรกที่ตรงชนะ)
var VIEW_STAGE_RULES = [
  [12, /ระดับความสำเร็จ|ควบคุมภายใน|ITA|HA Scoring|Internal Survey|ตัวชี้วัด|แผนงาน|โครงการ|ยุทธศาสตร์|งบประมาณ|ต้นทุน|[Pp]roductivity|ผลิตภาพ|การเงิน|รายได้|TPS|efficiency|พลังงาน|ขยะ|น้ำเสีย|สิ่งแวดล้อม|เครื่องมือ|พร้อมใช้|ซ่อม|สารสนเทศ|เวชระเบียน|บันทึก|รายงาน|คลัง|จ่ายกลาง|ซักฟอก|อัคคีภัย|ซ้อมแผน|ฐานข้อมูล|การนำ|วิสัยทัศน์/],
  [11, /บุคลากร|เจ้าหน้าที่|พยาบาลวิชาชีพ|อบรม|สมรรถนะ|[Cc]ompeten|ฟื้นฟูทักษะ|นิเทศ|จริยธรรมวิชาชีพ|จัดการความรู้|องค์ความรู้|นวัตกรรม|นวตกรรม|วิจัย|ผลงานวิชาการ|CQI|ความผูกพัน|Happinometer|ความสุข/],
  [10, /พึงพอใจ|ร้องเรียน|ข้อเสนอแนะ|ข้อคิดเห็น/],
  [1, /คัดกรอง|คัดแยก|[Tt]riage|ESI/],
  [7, /ฟื้นฟู|ฟื้นสภาพ|Barthel|ADL|กายภาพบำบัด|IMC|ระยะกลาง/],
  [5, /อุบัติการณ์|ความเสี่ยง|ผิดพลาด|ผิดคน|ผิดหมู่|คลาดเคลื่อน|พลัดตก|แพ้ยา|[Mm]ed(ication)? ?[Ee]rror|ติดเชื้อ|แผลกดทับ|ไม่คาดคิด|เข็มทิ่ม|[Uu]n ?plan|ไม่ได้วางแผน|ไม่พึงประสงค์|RCA|E up|ระดับ E/],
  [0, /เข้าถึง|รอคอย|ระยะเวลารอ|Door to|ทันเวลา|EMS|ภายใน\s*[0-9]+\s*(นาที|ชม|ชั่วโมง)|ครอบคลุม/],
  [4, /ควบคุม.*ได้|อัตราตาย|เสียชีวิต|ภาวะแทรกซ้อน|ตกเลือด|รักษาสำเร็จ|หาย/],
  [2, /ประเมิน|วินิจฉัย|[Dd]iagnos|EKG|HbA1c|eGFR|ตรวจ/],
  [3, /วางแผน|D\/?C plan|[Dd]ischarge plan|แผนการดูแล|[Aa]dvance care|[Ff]amily meeting/],
  [8, /ต่อเนื่อง|เยี่ยมบ้าน|ติดตาม|ส่งต่อ|[Rr]efer|COC|[Rr]e.?admit|[Rr]e.?visit|ขาดนัด|นัดหมาย|ขึ้นทะเบียน/],
  [6, /ให้ข้อมูล|ให้ความรู้|สุขศึกษา|เสริมพลัง|ความรู้|[Ii]nformed|คำแนะนำ|ดูแลตนเอง/],
  [9, /ส่งเสริม|ป้องกัน|วัคซีน|[Vv]accine|อนามัย|ฝากครรภ์|ANC|พัฒนาการ|ชุมชน|ไข้เลือดออก|อัตราป่วย|รายใหม่|ปรับเปลี่ยนพฤติกรรม|สงสัยป่วย|กลุ่มเสี่ยง|เฝ้าระวัง|ฆ่าตัวตาย|อุบัติเหตุจราจร/]
];
// หมวด HA ของตัวชี้วัด → ขั้นตอน (ใช้เมื่อชื่อไม่บอก)
var VIEW_HA_STAGE = [[/^III-?1/, 0], [/^III-?2/, 2], [/^III-?3/, 3], [/^III-?4/, 4], [/^III-?5/, 6], [/^III-?6/, 8],
  [/^II-?1/, 5], [/^II-?4/, 5], [/^II-?6/, 5], [/^II-?8/, 9], [/^II-?9/, 9], [/^I-?5/, 11], [/^II-?2/, 11], [/^I-?[1-4,6]/, 12], [/^IV/, 4]];
// หน่วยงานที่ไม่ใช่การดูแลผู้ป่วยโดยตรง: ชื่อไม่บอกอะไรเลย → การบริหารจัดการ
var VIEW_SUPPORT_UNITS = { HR: 1, IT: 1, ENV: 1, ENV2: 1, "บริหาร": 1, "งานแผนฯ": 1, MSO: 1, QMR: 1, IM: 1, RM: 1, "ทีมนำ": 1, "คณะกรรมการความเสี่ยง": 1 };

// คำในชื่อตัวชี้วัด → หัวข้อของหน่วย (ใช้กับหน่วยที่มีหัวข้อจากไฟล์ NSO) : [คำในชื่อ, คำในหัวข้อ]
var VIEW_HEADING_RULES = [
  [/STEMI/i, /STEMI/i], [/Stroke|หลอดเลือดสมอง/i, /Stroke/i], [/Sepsis|Septic/i, /Sepsis/i], [/Head|\bHI\b|TBI/i, /Head/i],
  [/เบาหวาน|\bDM\b/i, /DM|NCD/i], [/ความดัน|\bHT\b/i, /HT|NCD/i], [/วัณโรค|\bTB\b/i, /TB/i], [/COPD/i, /COPD/i], [/Asthma/i, /Asthma/i],
  [/PPH|ตกเลือด/i, /PPH/i], [/PIH|ครรภ์เป็นพิษ/i, /PIH/i], [/LBW|น้ำหนักน้อย/i, /LBW/i], [/Appendicitis|ไส้ติ่ง/i, /Appendicitis/i],
  [/Warfarin|Wafarin/i, /Wafarin|Warfarin/i], [/IMC|ระยะกลาง/i, /IMC/i], [/COC|ดูแลต่อเนื่อง/i, /COC/i], [/ARV|HIV/i, /ARV/i], [/CPR|ROSC/i, /CPR/i],
  [/triage|คัดแยก|คัดกรอง/i, /Triage|คัดกรอง/i], [/EMS|กู้ชีพ/i, /EMS/i], [/Ambulance|รถพยาบาล/i, /Ambulance/i],
  [/พึงพอใจ/i, /พึงพอใจ/i], [/ร้องเรียน/i, /ร้องเรียน|พึงพอใจ/i], [/ติดเชื้อ|CAUTI|VAP|\bIC\b/i, /CAUTI|งาน IC|\bIC\b/i],
  [/พลัดตก/i, /พลัดตก|ความปลอดภัย/i], [/ให้เลือด|เลือด/i, /การให้เลือด/i], [/[Mm]ed ?[Ee]rror|คลาดเคลื่อนทางยา|การบริหารยา/i, /Med/i],
  [/[Rr]e.?admit/i, /Re-?admit/i], [/[Rr]e.?visit/i, /Re-?visit/i], [/[Rr]efer|ส่งต่อ/i, /Refer/i], [/D\/?C plan|[Dd]ischarge|จำหน่าย/i, /Discharge/i],
  [/เวชระเบียน|บันทึก/i, /Audit chart|บันทึก/i], [/เสียชีวิต|อัตราตาย/i, /เสียชีวิต/i], [/เครื่องมือ/i, /เครื่องมือ/i], [/หัตถการ/i, /หัตถการ/i],
  [/ระบุตัว|ผิดคน|อุบัติการณ์|ความเสี่ยง/i, /RM|ความเสี่ยง|ความปลอดภัย|อุบัติการณ์/i], [/ตรวจสุขภาพ/i, /ตรวจสุขภาพ/i], [/นัด/i, /นัด/i],
  [/การเข้าถึง|OPD/i, /การเข้าถึงบริการ/i], [/มารดา|ทารก|หลังคลอด/i, /มารดาและทารก/i]
];

// กลุ่มโรคของ PCT (หมวดย่อย) เรียงตามไฟล์ + กลุ่มที่เพิ่มสำหรับตัว PCT เดิม
var VIEW_PCT_GROUPS = ["STEMI", "Stroke", "การดูแลระยะกลาง (IMC)", "Sepsis", "DM", "HT", "CKD", "TB", "PPH",
  "จิตเวช ซึมเศร้า/ฆ่าตัวตาย", "จิตเวช SMIV", "Head injury", "Palliative care", "วินิจฉัยคลาดเคลื่อน (9 มาตรฐาน)",
  "การคัดแยกผู้ป่วย (9 มาตรฐาน)", "ทบทวนผู้ป่วยอาการทรุดลง", "การเสียชีวิตโดยไม่คาดคิด", "ทบทวนผู้ป่วย Revisit / Re-admit",
  "พลัดตกหกล้ม", "ระบุตัวผู้ป่วยผิดพลาด", "ให้เลือดผิดคนผิดหมู่", "Med error", "จริยธรรมและสิทธิผู้ป่วย"];
var VIEW_PCT_RENAME = { "CKD จำแนกตาม Stage": "CKD", "ทบทวนผู้ป่วย Revisit": "ทบทวนผู้ป่วย Revisit / Re-admit" };
// ตัว PCT เดิม (ไม่ได้มาจากไฟล์ PCT) → กลุ่ม
var VIEW_PCT_EXTRA = {
  "KPI-0000000000004": "จริยธรรมและสิทธิผู้ป่วย",
  "KPI-0000000000190": "การดูแลระยะกลาง (IMC)", "KPI-0000000000253": "การดูแลระยะกลาง (IMC)", "KPI-0000000000280": "การดูแลระยะกลาง (IMC)",
  "KPI-0000000000260": "การเสียชีวิตโดยไม่คาดคิด", "KPI-0000000000261": "การเสียชีวิตโดยไม่คาดคิด", "KPI-0000000000262": "การเสียชีวิตโดยไม่คาดคิด",
  "KPI-0000000000263": "การเสียชีวิตโดยไม่คาดคิด", "KPI-0000000000264": "การเสียชีวิตโดยไม่คาดคิด",
  "KPI-0000000000266": "ทบทวนผู้ป่วยอาการทรุดลง",
  "KPI-0000000000269": "ทบทวนผู้ป่วย Revisit / Re-admit", "KPI-0000000000270": "ทบทวนผู้ป่วย Revisit / Re-admit",
  "KPI-0000000000283": "TB", "KPI-0000000000287": "DM"
};
// ตัว PCT ที่ไม่อยู่ในรายการข้างบน → กลุ่มตามคำในชื่อ (ไม่ตรงเลย = ทบทวนผู้ป่วยอาการทรุดลง)
var VIEW_PCT_KEYWORDS = [[/STEMI/i, "STEMI"], [/Stroke|หลอดเลือดสมอง/i, "Stroke"], [/IMC|ระยะกลาง/i, "การดูแลระยะกลาง (IMC)"], [/Sepsis|Septic/i, "Sepsis"],
  [/เบาหวาน|\bDM\b/i, "DM"], [/ความดัน|\bHT\b/i, "HT"], [/CKD|ไต/i, "CKD"], [/วัณโรค|\bTB\b/i, "TB"], [/PPH|ตกเลือด/i, "PPH"],
  [/ซึมเศร้า|ฆ่าตัวตาย/i, "จิตเวช ซึมเศร้า/ฆ่าตัวตาย"], [/SMI/i, "จิตเวช SMIV"], [/Head|\bHI\b|TBI/i, "Head injury"], [/ประคับประคอง|Palliative|Opioid/i, "Palliative care"],
  [/วินิจฉัยคลาด|[Dd]iagnos/i, "วินิจฉัยคลาดเคลื่อน (9 มาตรฐาน)"], [/คัดแยก|คัดกรองที่ห้องฉุกเฉิน|[Tt]riage/i, "การคัดแยกผู้ป่วย (9 มาตรฐาน)"],
  [/ไม่คาดคิด|เสียชีวิต/i, "การเสียชีวิตโดยไม่คาดคิด"], [/[Rr]e.?visit|[Rr]e.?admit/i, "ทบทวนผู้ป่วย Revisit / Re-admit"], [/ทรุดลง/i, "ทบทวนผู้ป่วยอาการทรุดลง"],
  [/พลัดตก/i, "พลัดตกหกล้ม"], [/ระบุตัว/i, "ระบุตัวผู้ป่วยผิดพลาด"], [/เลือด/i, "ให้เลือดผิดคนผิดหมู่"], [/[Mm]ed|ยา/i, "Med error"], [/[Ee]thic|จริยธรรม|สิทธิ/i, "จริยธรรมและสิทธิผู้ป่วย"]];

/** หน่วยสนับสนุน (ไม่ใช่งานดูแลผู้ป่วยโดยตรง) — นับชื่อเดิมของหน่วยที่เปลี่ยนชื่อแล้วด้วย */
function viewIsSupportUnit_(unit) {
  return renameUnitSources_(unit).some(function(n) { return !!VIEW_SUPPORT_UNITS[n]; });
}
function viewIsQaPart_(part) { return / QA$/.test((part || "").toString()); }
function viewUnitOfQaPart_(part) { return (part || "").toString().replace(/ QA$/, ""); }
/** หน่วยงานเจ้าของหมวด: "ER QA" → ER · "ภาพรวมฝ่ายการพยาบาล QA" → NSO · อื่นๆ = ชื่อหมวดเอง */
function viewDeptOfPart_(part) {
  var u = viewUnitOfQaPart_(part);
  return u === VIEW_NSO_OVERALL ? NSO_UNIT : renameUnit_(u);
}

/** ขั้นตอนการดูแลของตัวชี้วัด (ชื่อหมวดย่อย) จากชื่อ → หมวด HA → ชนิดหน่วยงาน */
function viewStageOf_(name, cats, unit) {
  var n = (name || "").toString(), i;
  for (i = 0; i < VIEW_STAGE_RULES.length; i++) if (VIEW_STAGE_RULES[i][1].test(n)) return VIEW_STAGES[VIEW_STAGE_RULES[i][0]];
  var core = (cats || []).filter(function(c) { return isCorePart_(c.part); });
  for (var k = 0; k < core.length; k++) {
    var c = core[k].category.replace(/\s+/g, "");
    for (i = 0; i < VIEW_HA_STAGE.length; i++) if (VIEW_HA_STAGE[i][0].test(c)) return VIEW_STAGES[VIEW_HA_STAGE[i][1]];
  }
  return VIEW_STAGES[viewIsSupportUnit_(unit) ? 12 : 4];
}

/** หัวข้อของหน่วย (จากไฟล์ NSO) ที่ใกล้ที่สุดกับชื่อตัวชี้วัด — ไม่มี = "" */
function viewHeadingOf_(name, headings) {
  var n = (name || "").toString(), i, j;
  if (!headings || !headings.length) return "";
  var squash = function(s) { return s.toLowerCase().replace(/\s+/g, ""); };
  for (j = 0; j < headings.length; j++) { var h = squash(headings[j]); if (h.length >= 4 && squash(n).indexOf(h) !== -1) return headings[j]; }
  for (i = 0; i < VIEW_HEADING_RULES.length; i++) {
    if (!VIEW_HEADING_RULES[i][0].test(n)) continue;
    for (j = 0; j < headings.length; j++) if (VIEW_HEADING_RULES[i][1].test(headings[j])) return headings[j];
  }
  return "";
}

/** หมวดย่อยมาตรฐานของหน่วย u สำหรับตัวชี้วัด (ตัว รพ./ตัวที่เพิ่มเอง): หัวข้อของหน่วยที่ใกล้สุด หรือขั้นตอนการดูแล */
function viewSubcatFor_(unit, name, cats, ctx) {
  var heading = viewHeadingOf_(name, ctx && ctx.headings ? ctx.headings[unit] : null);
  return renameCat_(unit, heading || viewStageOf_(name, cats, unit));
}

function viewDimLabel_(text, name) {
  return tidyDimLabel_(tidyDimOfName_(text) || tidyDimOfText_((name || "").toString()) || 2);
}

function viewPctGroupOf_(id, name, ctx) {
  var g = "ทบทวนผู้ป่วยอาการทรุดลง", i;
  if (ctx && ctx.pctGroup && ctx.pctGroup[id]) g = ctx.pctGroup[id];
  else if (VIEW_PCT_EXTRA[id]) g = VIEW_PCT_EXTRA[id];
  else for (i = 0; i < VIEW_PCT_KEYWORDS.length; i++) if (VIEW_PCT_KEYWORDS[i][0].test(name)) { g = VIEW_PCT_KEYWORDS[i][1]; break; }
  return renameCat_(PCT_UNIT, g); // ชื่อกลุ่มโรคปัจจุบัน (ตารางเปลี่ยนชื่อ — Rename.js)
}

/** หมวดย่อยที่ระบบตั้งให้เอง (เดิม) — เปลี่ยนเป็นหมวดตามกติกาใหม่ได้ · ชื่อที่ผู้ใช้ตั้งเองไม่แตะ */
function viewIsAutoCategory_(cat, part) {
  var c = (cat || "").toString().trim();
  return !c || c === UNIT_CATS_PLACEHOLDER || c === "ทั่วไป" || c === part || c === TIDY_NSO_OVERALL_OLD || !!tidyDimOfName_(c) ||
    /^(9\s*มาตรฐาน|Risk|I{1,3}V?[-\s]?[0-9]|IV[-\s]?[0-9]|I-[0-9])/i.test(c) || /^[0-9.\s]+$/.test(c);
}
var TIDY_NSO_OVERALL_OLD = "ภาพรวม NSO";

/**
 * หมวดใหม่ของแถวหนึ่ง (ฟังก์ชันล้วน)
 * ctx: { origins: {id: [{part, category}]}, headings: {unit: [หัวข้อ]}, pctIds: {id: กลุ่มโรค} }
 * คืน { cats, qa: มีหมวด QA ไหม }
 */
function viewPlaceRow_(id, name, cats, ctx) {
  ctx = ctx || {};
  var out = [], seen = {}, derived = {};
  var add = function(part, category) {
    var k = part + "||" + category;
    if (part && category && !seen[k]) { seen[k] = 1; out.push({ part: part, category: category }); }
  };
  cats.forEach(function(c) { if (isCorePart_(c.part)) add(c.part, c.category); });
  (ctx.origins && ctx.origins[id] || []).forEach(function(o) {
    var up = nsoUnitOfPart_(o.part), unit = up.unit;
    unit = renameUnit_(TIDY_UNIT_ALIAS[unit] || unit);
    if (up.isQa || VIEW_QA_UNITS[unit] || unit === NSO_UNIT) {
      var qaPart = (unit === NSO_UNIT ? VIEW_NSO_OVERALL : unit) + VIEW_QA_SUFFIX;
      add(qaPart, renameCat_(qaPart, viewDimLabel_(o.category, name)));
      derived[unit] = 1;
    } else {
      add(unit, renameCat_(unit, tidyAscii_((o.category || "").toString().replace(/\s+/g, " ").trim()) || viewStageOf_(name, cats, unit)));
      derived[unit] = 1;
    }
  });
  var isPct = ctx.pctIds && ctx.pctIds[id] !== undefined;
  if (isPct || cats.some(function(c) { return c.part === PCT_UNIT; })) {
    add(PCT_UNIT, viewPctGroupOf_(id, name, { pctGroup: ctx.pctIds }));
    derived[PCT_UNIT] = 1;
  }
  cats.forEach(function(c) {
    if (isCorePart_(c.part) || c.part === NSO_UNIT || derived[c.part]) return;
    if (viewIsQaPart_(c.part)) {          // หมวด QA ที่ตั้งเอง (ไม่ได้มาจากไฟล์ NSO): คงไว้ จัดชื่อมิติให้ตรงมาตรฐาน
      if (derived[viewUnitOfQaPart_(c.part)]) return;
      add(c.part, renameCat_(c.part, viewDimLabel_(c.category, name)));
      return;
    }
    add(c.part, viewIsAutoCategory_(c.category, c.part) ? viewSubcatFor_(c.part, name, cats, ctx) : c.category);
  });
  if (out.length === 0) add(cats[0].part === NSO_UNIT ? VIEW_NSO_OVERALL + VIEW_QA_SUFFIX : cats[0].part, cats[0].category || "ทั่วไป");
  // คงลำดับหมวดเดิม (หมวดแรก = หมวดหลักประจำตัว): เรียงตามตำแหน่งของหน่วยนั้นในรายการเดิม หมวดที่เพิ่มใหม่ต่อท้าย
  var rank = function(part) {
    var keys = [part, viewDeptOfPart_(part)];
    for (var i = 0; i < cats.length; i++) if (keys.indexOf(cats[i].part) !== -1) return i;
    return cats.length;
  };
  out = out.map(function(c, i) { return { c: c, r: rank(c.part), i: i }; })
    .sort(function(a, b) { return a.r - b.r || a.i - b.i; }).map(function(x) { return x.c; });
  return { cats: out, qa: out.some(function(c) { return viewIsQaPart_(c.part); }) };
}

/** ข้อมูลประกอบการจัดหมวด: ที่มาจากไฟล์ NSO (Part/Category เดิม) ของแต่ละตัว, หัวข้อของแต่ละหน่วย, ตัวชี้วัดของ PCT */
function viewContext_() {
  var ctx = { origins: {}, headings: {}, pctIds: {} };
  // รหัสที่ถูกรวมไปแล้ว → รหัสที่เก็บไว้ (จากบันทึกใน Tidy_Log)
  var alias = {};
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var log = ss.getSheetByName(TIDY_LOG_SHEET);
  if (log && log.getLastRow() >= 2) {
    log.getRange(2, 1, log.getLastRow() - 1, 6).getValues().forEach(function(r) {
      if (r[3] === "merge-drop" || r[3] === "pct-merge-drop") { var m = /รวมเข้า\s+(\S+)/.exec((r[5] || "").toString()); if (m) alias[(r[2] || "").toString()] = m[1]; }
    });
  }
  TIDY_MERGE.forEach(function(p) { if (!alias[p[1]]) alias[p[1]] = p[0]; });
  var resolve = function(id) { var g = 0; while (alias[id] && g++ < 10) id = alias[id]; return id; };
  var src = null;
  try { src = nsoReadSource_(); } catch (e) { src = null; }
  if (src) {
    var sync = nsoReadSync_();
    src.mapped.forEach(function(m) {
      var link = sync[m.sourceId];
      var our = resolve(link ? link.ourId : NURSING_SYNC_ID_PREFIX + m.sourceId);
      var category = m.cats[0].category;
      (ctx.origins[our] = ctx.origins[our] || []).push({ part: m.partLabel, category: category });
      var up = nsoUnitOfPart_(m.partLabel), unit = TIDY_UNIT_ALIAS[up.unit] || up.unit;
      if (!up.isQa && !VIEW_QA_UNITS[unit] && unit !== NSO_UNIT) {
        var list = ctx.headings[unit] = ctx.headings[unit] || [];
        var cat = tidyAscii_(category.replace(/\s+/g, " ").trim());
        if (cat && list.indexOf(cat) === -1) list.push(cat);
      }
    });
  }
  ctx.headings = renameHeadings_(ctx.headings); // หัวข้อของหน่วยใช้ชื่อหน่วย/หมวดปัจจุบัน
  // ตัวชี้วัดของ PCT: จากไฟล์ (ตัวใหม่ / ตัวที่รวม / ตัวย่อยของหอ) → กลุ่มโรค
  if (typeof PCT_ROWS !== "undefined") {
    PCT_ROWS.forEach(function(e) {
      var g = VIEW_PCT_RENAME[e.g] || e.g;
      ctx.pctIds[resolve(pctId_(e.i))] = g;
      (PCT_PLAN.merge[String(e.i)] || []).forEach(function(id) { ctx.pctIds[resolve(id)] = g; });
      (PCT_PLAN.kids[String(e.i)] || []).forEach(function(id) { ctx.pctIds[resolve(id)] = g; });
    });
    Object.keys(VIEW_PCT_EXTRA).forEach(function(id) { if (ctx.pctIds[resolve(id)] === undefined) ctx.pctIds[resolve(id)] = VIEW_PCT_EXTRA[id]; });
  }
  return ctx;
}

/** ลำดับในกลุ่มโรคของ PCT (ตามแถวในไฟล์) — ใช้เรียงการ์ดในหมวด PCT · ไม่ใช่ตัว PCT = null */
var VIEW_PCT_ORDER_ = null;
function viewPctOrder_(id) {
  if (!VIEW_PCT_ORDER_) {
    VIEW_PCT_ORDER_ = {};
    if (typeof PCT_ROWS !== "undefined") {
      PCT_ROWS.forEach(function(e) {
        var o = e.i;
        var set = function(id2, v) { if (VIEW_PCT_ORDER_[id2] === undefined) VIEW_PCT_ORDER_[id2] = v; };
        set(pctId_(e.i), o);
        (PCT_PLAN.merge[String(e.i)] || []).forEach(function(id2) { set(id2, o); });
        (PCT_PLAN.kids[String(e.i)] || []).forEach(function(id2, k) { set(id2, o + 0.01 * (k + 1)); });
      });
      // CKD Stage 1–5 อยู่ต่อจาก CKD ในไฟล์ → ย้ายมาท้ายกลุ่ม CKD
      for (var s = 153; s <= 157; s++) VIEW_PCT_ORDER_[pctId_(s)] = 50.5 + (s - 153) * 0.01;
      VIEW_PCT_ORDER_[pctId_(159)] = 50.4;
    }
  }
  var v = VIEW_PCT_ORDER_[id];
  return v === undefined ? null : v;
}

// ---------------------------------------------------------------- ผูกหมวดกับระดับ (ตอนเพิ่ม/แก้ตัวชี้วัด)

var VIEW_HEADINGS_PROP = "VIEW_HEADINGS_V1";

/** หัวข้อของแต่ละหน่วยจากไฟล์ NSO ตามลำดับในไฟล์ (เก็บใน Script Properties ตอนจัดระเบียบ — ไม่ต้องเปิดไฟล์ NSO ทุกครั้ง) */
function viewHeadings_() {
  var raw = PropertiesService.getScriptProperties().getProperty(VIEW_HEADINGS_PROP);
  if (raw) { try { return renameHeadings_(JSON.parse(raw)); } catch (e) {} }
  var headings = {};
  try { headings = viewContext_().headings; } catch (e) { headings = {}; }
  viewSaveHeadings_(headings);
  return renameHeadings_(headings);
}
function viewSaveHeadings_(headings) {
  if (!headings || Object.keys(headings).length === 0) return; // อ่านไฟล์ NSO ไม่ได้ — ไม่จำค่าว่าง
  try { PropertiesService.getScriptProperties().setProperty(VIEW_HEADINGS_PROP, JSON.stringify(headings)); } catch (e) {}
}

/** ระดับที่ติ๊ก → ชนิดหมวดที่ต้องมี */
function viewLevelKinds_(levels) {
  var l = levels || [];
  return { sar: l.indexOf("SAR") !== -1, qa: l.indexOf("QA-หน่วยงาน") !== -1, unit: l.indexOf("หน่วยงาน") !== -1 || l.indexOf("รายบุคคล") !== -1 };
}

/** หน่วยงาน → ชื่อหมวด QA ของหน่วย ("ER" → "ER QA", "NSO" → "ภาพรวมฝ่ายการพยาบาล QA") */
function viewQaPartOf_(dept) {
  return (dept === NSO_UNIT ? VIEW_NSO_OVERALL : dept) + VIEW_QA_SUFFIX;
}

/** หน่วยงานของตัวชี้วัดที่ใช้ตั้งหมวด: NSO เป็นสังกัดซ้อน — มีหน่วยอื่นอยู่แล้วไม่ต้องใช้ NSO */
function viewUnitsOf_(depts) {
  var nested = depts.some(function(d) { return d !== NSO_UNIT; });
  return depts.filter(function(d) { return !(nested && d === NSO_UNIT); });
}

/** หมวด "รอจัดหมวดย่อย" → หมวดย่อยตามกติกา: QA = มิติ 1–5 · หน่วยงาน = หัวข้อของหน่วยที่ใกล้สุด / ขั้นตอนการดูแล */
function viewFillPlaceholders_(cats, name) {
  var pending = cats.filter(function(c) { return c.category === UNIT_CATS_PLACEHOLDER && !isCorePart_(c.part); });
  if (pending.length === 0) return cats;
  var ctx = pending.some(function(c) { return !viewIsQaPart_(c.part); }) ? { headings: viewHeadings_() } : {};
  var core = cats.filter(function(c) { return isCorePart_(c.part); })[0];
  // มิติ: ใช้มิติเดียวกับหมวด QA ที่ตัวชี้วัดมีอยู่แล้ว → จากชื่อตัวชี้วัด → จากหมวด HA
  var hasDim = cats.filter(function(c) { return viewIsQaPart_(c.part) && tidyDimOfName_(c.category); })[0];
  var dim = hasDim ? hasDim.category : tidyDimLabel_(tidyDimOfText_((name || "").toString()) || (core ? tidyDimOfCore_(core.category) : 2));
  var out = [], seen = {};
  cats.forEach(function(c) {
    var res = c;
    if (c.category === UNIT_CATS_PLACEHOLDER && !isCorePart_(c.part)) {
      res = { part: c.part, category: viewIsQaPart_(c.part) ? dim : viewSubcatFor_(c.part, name, cats, ctx) };
    }
    if (!seen[catKey_(res)]) { seen[catKey_(res)] = 1; out.push(res); }
  });
  return out;
}

/**
 * ผูกหมวดกับระดับ: ติ๊ก QA-หน่วยงาน → มีหมวด "<หน่วย> QA" · ติ๊กหน่วยงาน/รายบุคคล → มีหมวดของหน่วย
 * opts.qa / opts.unit: ต้องการหมวดชนิดนั้นไหม (true = เพิ่มที่ขาด, false = เอาหมวด QA ออก, undefined = ไม่แตะ)
 */
function viewBindCats_(cats, depts, opts) {
  var out = cats.slice();
  var has = function(part) { return out.some(function(c) { return renamePart_(c.part) === part; }); };
  if (opts.qa === false) {
    var kept = out.filter(function(c) { return !viewIsQaPart_(c.part); });
    if (kept.length) out = kept;
  }
  viewUnitsOf_(depts).forEach(function(d) {
    if (opts.qa && !has(viewQaPartOf_(d))) out.push({ part: viewQaPartOf_(d), category: UNIT_CATS_PLACEHOLDER });
    if (opts.unit && d !== NSO_UNIT && !has(d)) out.push({ part: d, category: UNIT_CATS_PLACEHOLDER });
  });
  return out;
}
