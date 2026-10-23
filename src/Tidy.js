/**
 * จัดระเบียบข้อมูลตัวชี้วัด (admin กดครั้งเดียว และรันซ้ำได้ — ผลเหมือนเดิมเสมอ)
 *  1) ผู้รับผิดชอบ: แปลงชื่อที่เป็นคนเดียวกัน / ตำแหน่ง → ชื่อมาตรฐาน ("หัวหน้าตึก" = head ขึ้นไปที่สังกัด NSO)
 *  2) ชื่อตัวชี้วัด: ตัดเลขข้อหน้าชื่อ (๒.๑.๑ / 4.7 / - / ตัวชี้วัดที่ ๑๙) แต่จำความเป็นตัวย่อยไว้ที่คอลัมน์ "ตัวชี้วัดแม่"
 *  3) หมวดย่อยในมุมมองหน่วยงาน: มาตรฐาน 5 มิติ + "หัวข้อกลุ่ม" (เก็บชื่อหัวข้อเดิม/หมวด HA ไว้เป็นกลุ่ม)
 *  4) บัญชีผู้ใช้: รวมชื่อซ้ำ ลบบัญชีที่ไม่ใช่คน
 *  ก่อนเขียนจริงสำรองชีตไว้ (ครั้งแรก) และบันทึกค่าเดิมทุกจุดที่เปลี่ยนไว้ในชีต Tidy_Log
 * ตัวคำนวณ (tidyComputeSheet_ / tidyComputeUsers_) เป็นฟังก์ชันล้วนไม่แตะชีต ใช้ทดสอบกับข้อมูลจริงได้
 */

var TIDY_LOG_SHEET = "Tidy_Log";
var TIDY_BACKUP_FLAG = "TIDY_BACKUP_V1";
var TIDY_NSO_OVERALL = "ภาพรวม NSO";
var TIDY_DIMS = [
  "มิติที่ 1 ด้านประสิทธิผลตามพันธกิจ",
  "มิติที่ 2 ด้านคุณภาพการให้บริการ",
  "มิติที่ 3 ด้านประสิทธิภาพของการปฏิบัติงาน",
  "มิติที่ 4 ด้านการพัฒนาองค์กร",
  "มิติที่ 5 ด้านการดูแลรายโรคและงานเฉพาะ"
];
// ตัวชี้วัด 3 ตัวที่ติ๊ก QA-หน่วยงาน ในปีงบปัจจุบันโดยไม่ตั้งใจ (ตรวจแล้วว่าไม่มีในปีงบก่อนหน้า) → เอาระดับ QA ออก
var TIDY_QA_REMOVE = { 2570: ["KPI-0000000000059", "KPI-0000000000194", "KPI-0000000000195"] };
// ผู้ใช้ที่เป็นคนเดียวกัน (ชื่อเดิม → ชื่อที่เก็บไว้) และบัญชีที่ไม่ใช่คน
var TIDY_USER_MERGE = { "ปิยะนันท์": "ปิยนันท์", "ชลิธิชา": "ชลธิชา", "ทักษฺณา": "ทักษิณา", "สุธาสินี": "สุธาสินีย์", "ผอ.": "ประภาพร" };
var TIDY_USER_DELETE = ["หัวหน้าพยาบาล", "หัวหน้าตึกหรือหัวหน้าหน่วยงานพยาบาลแต่ละฝ่าย"];

// ---------------------------------------------------------------- ชื่อตัวชี้วัด: ตัดเลขข้อ

var TIDY_TH_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
var TIDY_DIG = "0-9๐-๙";
var TIDY_TOK = new RegExp("^(?:ตัวชี้วัดที่\\s*[" + TIDY_DIG + "]+\\.?|[-–•·*]+|\\(?[" + TIDY_DIG + "]{1,3}(?:[.,][" + TIDY_DIG + "]{1,3})+[.)]?|\\(?[" + TIDY_DIG + "]{1,3}[.)])\\s*");
var TIDY_BARE = new RegExp("^[" + TIDY_DIG + "]{1,2}\\s+(?!(?:อันดับ|ครั้ง|วัน|ชม|ชั่วโมง|เดือน|ปี|ราย|คน|ข้อ|มาตรฐาน|นาที|กลุ่ม|ด้าน|ระดับ))");
var TIDY_NUMRE = new RegExp("^\\s*(?:ตัวชี้วัดที่\\s*)?\\(?([" + TIDY_DIG + "]{1,3}(?:\\s*[.,]\\s*[" + TIDY_DIG + "]{1,3})*)\\s*[.)]?\\s*");

function tidyAscii_(s) {
  return s.replace(/[๐-๙]/g, function(c) { return String(TIDY_TH_DIGITS.indexOf(c)); });
}

/** ชื่อที่ตัดเลขข้อหน้าชื่อออกแล้ว (ไม่มีเลข = คืนชื่อเดิม) */
function tidyStripName_(name) {
  var s = (name || "").toString().trim(), changed = true, guard = 0;
  while (changed && guard++ < 6) {
    changed = false;
    var m = TIDY_TOK.exec(s);
    if (m && m[0].length > 0) { s = s.slice(m[0].length); changed = true; continue; }
    m = TIDY_BARE.exec(s);
    if (m) { s = s.slice(m[0].length); changed = true; }
  }
  s = s.replace(/^[.,)\s]+/, "").trim(); // เลขซ้อน/เศษเครื่องหมายที่เหลือ เช่น "๑..ระบบ"
  return s || (name || "").toString().trim();
}

/** เลขข้อของชื่อ: "2.1.1" / "-" (ขีดนำหน้า = ตัวย่อย) / "" (ไม่มี) */
function tidyNumOf_(name) {
  var n = (name || "").toString().trim();
  if (/^[-–•·*]/.test(n)) return "-";
  var m = TIDY_NUMRE.exec(n);
  if (!m) return "";
  var num = tidyAscii_(m[1].replace(/\s/g, "")).replace(/,/g, ".");
  var rest = n.slice(m[0].length);
  var dotted = /^\s*(?:ตัวชี้วัดที่\s*)?\(?[0-9๐-๙]{1,3}\s*[.)]/.test(n);
  if (num.indexOf(".") === -1 && !dotted && /^(อันดับ|ครั้ง|วัน|ชม|ชั่วโมง|เดือน|ปี|ราย|คน|ข้อ|มาตรฐาน|นาที)/.test(rest)) return "";
  return num.replace(/^\.+|\.+$/g, "");
}

// ---------------------------------------------------------------- รายละเอียด → ที่มา/สูตร

// ช่อง "รายละเอียด/การวิเคราะห์" เก็บเฉพาะผลการวิเคราะห์ · นิยาม/วัตถุประสงค์/เกณฑ์/ตัวตั้ง-ตัวหาร/สูตร/แหล่งข้อมูล ย้ายไปช่อง "ที่มาแหล่งข้อมูล/สูตรคำนวณ"
// แยกทีละบรรทัด: บรรทัดหัวข้อเปลี่ยนโหมด บรรทัดที่ไม่มีหัวข้อใช้โหมดเดียวกับบรรทัดก่อนหน้า (เริ่มต้น = ย้าย)
var TIDY_NOTE_LINE = /^ตัวย่อยของตัวชี้วัด รพ\. \(SAR\)/; // หมายเหตุที่ระบบใส่ตอนนำเข้า NSO — คงไว้
var TIDY_DEF_LINE = /หมายถึง|^(?:คำนิยาม|คํานิยาม|นิยาม|คำจำกัดความ)/;
var TIDY_ANALYSIS_HEAD = /^(?:ผลการวิเคราะห์|การวิเคราะห์|วิเคราะห์(?:ผล|ข้อมูล|ปัญหา|สาเหตุ|ถึง)?|ผลการดำเนินงาน|ผลการดำเนินการ|ผลการปฏิบัติงาน|สรุปผล|ปัญหา(?:และ)?(?:อุปสรรค)?|สาเหตุ|โอกาส(?:ใน(?:การ)?)?พัฒนา|แนวทาง(?:การ)?(?:แก้ไข|พัฒนา|ปรับปรุง)|ข้อเสนอแนะ|บทเรียน|จาก(?:การ)?(?:ทบทวน|วิเคราะห์|ดำเนินงาน|ติดตาม|สถิติ|ปัญหา))/;
var TIDY_ANALYSIS_LINE = /^(?:จาก.{0,80})?พบว่า|^วันที่\s*[0-9]|คิดเป็น(?:ร้อยละ)?\s*[0-9]|ทั้งหมด\s*[0-9]+\s*(?:ครั้ง|ราย|คน)/;
var TIDY_ANALYSIS_KPI = /^(?:แนวทาง(?:การ)?แก้ไข|โอกาส(?:ใน(?:การ)?)?พัฒนา)/; // ตัวชี้วัดที่ตัวมันเองคือแผนแก้ไข → รายละเอียดทั้งหมดเป็นการวิเคราะห์
var TIDY_SPEC_HEAD = /^(?:วัตถุประสงค์|เป้าหมาย|เกณฑ์|กลุ่มเป้าหมาย|ประชากร|ตัวตั้ง|ตัวหาร|สูตร|วิธี(?:การ)?คำนวณ|การคำนวณ|แหล่ง(?:ข้อมูล|ที่มา)|ที่มา|วิธีการ(?:จัด)?เก็บ|การ(?:จัด)?เก็บข้อมูล|รายการข้อมูล|ระยะเวลา|ความถี่|หมายเหตุ|ตัวชี้วัด|[AB][0-9]?\s*[:=：])/;

function tidyLineKey_(line) {
  return line.replace(/^[\s"“”'*•·\-–>]+/, "").replace(/^\(?[0-9]{1,2}(?:\.[0-9]{1,2})*[.)]\s*/, "").trim();
}

// ข้อความที่ทั้งก้อนอยู่ในเครื่องหมายคำพูด (คัดลอกมาจาก Excel) → เอาเครื่องหมายคำพูดออก
function tidyUnquote_(s) {
  var t = s.trim();
  if (t.length > 1 && t.charAt(0) === '"' && t.charAt(t.length - 1) === '"' && t.slice(1, -1).indexOf('"') === -1) return t.slice(1, -1).trim();
  return t;
}

function tidyTidyText_(lines) {
  return lines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function tidySquash_(s) { return s.replace(/\s+/g, ""); }

/** แยกรายละเอียดเป็น { keep: ส่วนที่เป็นการวิเคราะห์ (คงไว้), move: ส่วนที่ต้องย้ายไปช่องที่มา/สูตร } */
function tidySplitDetails_(details) {
  var text = tidyUnquote_((details || "").toString());
  var keep = [], move = [], mode = "move", lines = text.split("\n");
  // รายงานผลการดำเนินงานทั้งฉบับ (มีหัวข้อผล/วิเคราะห์หลายจุด) → คงไว้ทั้งหมด ไม่ตัดแยกให้เสียเนื้อความ
  var cues = lines.filter(function(l) { var k = tidyLineKey_(l); return k && (TIDY_ANALYSIS_HEAD.test(k) || TIDY_ANALYSIS_LINE.test(k)); }).length;
  if (cues >= 5) return { keep: text, move: "" };
  lines.forEach(function(line) {
    var k = tidyLineKey_(line);
    if (!k) { (mode === "keep" ? keep : move).push(""); return; }
    if (TIDY_NOTE_LINE.test(k)) { keep.push(line); return; }
    if (TIDY_DEF_LINE.test(k)) mode = "move";
    else if (TIDY_ANALYSIS_HEAD.test(k) || TIDY_ANALYSIS_LINE.test(k)) mode = "keep";
    else if (TIDY_SPEC_HEAD.test(k)) mode = "move";
    (mode === "keep" ? keep : move).push(line);
  });
  return { keep: tidyTidyText_(keep), move: tidyTidyText_(move) };
}

/** รายละเอียด/ที่มาใหม่ (ไม่มีอะไรต้องย้าย = คืนค่าเดิม) · ส่วนที่มีอยู่ในช่องที่มาแล้วไม่ใส่ซ้ำ */
function tidyMoveDetails_(details, source, name) {
  var d = (details || "").toString(), s = (source || "").toString();
  if (TIDY_ANALYSIS_KPI.test((name || "").toString().trim())) return { details: d, source: s };
  var sp = tidySplitDetails_(d);
  if (!sp.move) return { details: d, source: s };
  var src = tidyUnquote_(s);
  if (src && tidySquash_(src).indexOf(tidySquash_(sp.move)) !== -1) return { details: sp.keep, source: src };
  return { details: sp.keep, source: src ? sp.move + "\n\n" + src : sp.move };
}

// ---------------------------------------------------------------- ผู้รับผิดชอบ

/** ข้อความผู้รับผิดชอบ → แปลงชื่อเป็นมาตรฐาน (ไม่เปลี่ยนถ้าไม่มีอะไรต้องแปลง จึงไม่ปรับช่องว่าง/ตัวคั่นของข้อความเดิม) */
function tidyOwnerText_(text) {
  var raw = (text || "").toString();
  if (!raw.trim()) return raw;
  var parts = raw.split("/"), out = [], changed = false;
  parts.forEach(function(t) {
    var tt = t.trim(), n = OWNER_ALIASES.hasOwnProperty(tt) ? OWNER_ALIASES[tt] : tt;
    if (n !== tt) changed = true;
    out.push(n);
  });
  if (!changed) return raw;
  var seen = {}, uniq = [];
  out.forEach(function(n) { if (n && !seen[n]) { seen[n] = 1; uniq.push(n); } });
  return uniq.join(" / ");
}

// ---------------------------------------------------------------- หมวดย่อย: 5 มิติ + หัวข้อกลุ่ม

/** ชื่อหมวดที่เป็นมิติอยู่แล้ว → เลข 1–5 (ไม่ใช่ = 0) */
function tidyDimOfName_(cat) {
  var c = (cat || "").toString().trim();
  var m = /^มิติที่\s*\.?\s*([1-5])/.exec(c);
  if (m) return parseInt(m[1], 10);
  if (/^ด้านประสิทธิผล/.test(c)) return 1;
  if (/^ด้านคุณภาพการให้บริการ/.test(c)) return 2;
  if (/^ด้านประสิทธิภาพ/.test(c)) return 3;
  if (/^ด้านการพัฒนาองค์กร/.test(c)) return 4;
  return 0;
}

// หัวข้องานของหน่วย → มิติ (ตัวแรกที่ตรงชนะ ไม่ตรงเลย = มิติ 2)
var TIDY_HEAD_RULES = [
  [4, /บุคลากร|สมรรถนะ|อบรม|องค์กร|นิเทศ|ตรวจสุขภาพ/],
  [2, /(?<![A-Za-z])(?:RM|AE|IC)(?![A-Za-z])|Med Error|Triage|Refer|Re-?visit|Re-?admit|บันทึกทาง|ทบทวน|ความพึงพอใจ|ร้องเรียน|ความปลอดภัย|อุบัติการณ์|พลัดตก|ให้เลือด|Lab วิกฤต|เคลื่อนย้าย|เสียชีวิต|HosXp|Hos-Xp|IP voice|CPG|Audit|ระบุตัว|ความเสี่ยง|ติดเชื้อ|CAUTI|Bed sore|Mised Diagnosis/i],
  [3, /รายงาน|EMS|Ambulance|Productivity|ผลิตภาพ|จ่ายกลาง|ซักฟอก|ขยะ|คลัง|เครื่องมือ|SRRT|อันดับโรค|Mapping|นัด|คลินิกพิเศษ|เศรษฐกิจ/i],
  [5, /Stroke|STEMI|Sepsis|Head|CPR|(?<![A-Za-z])(?:ARV|COPD|DM|HT|NCD|TB|COC|IMC|PIH|LBW|PPH)(?![A-Za-z])|Asthma|Wafarin|Warfarin|Appendicitis|new born|Pretrm|asphyxia|Episiotomy|Discharge|โรค|คลินิก|หัตถการ|มารดา|fast track|ยาเสพติด|คัดกรอง/i]
];
function tidyDimOfHeading_(h) {
  for (var i = 0; i < TIDY_HEAD_RULES.length; i++) if (TIDY_HEAD_RULES[i][1].test(h)) return TIDY_HEAD_RULES[i][0];
  return 2;
}

// หมวด HA ของ Part I–IV → มิติ
var TIDY_CORE_RULES = [
  [/^I-?[12](?![\d.])/, 1], [/^I-?3/, 2], [/^I-?4/, 3], [/^I-?5/, 4], [/^I-?6/, 3],
  [/^9\s*มาตรฐาน/, 2], [/^II-?1\.1/, 3], [/^II-?1\.2/, 2], [/^II-?2/, 4], [/^II-?3/, 2], [/^II-?4/, 2], [/^II-?5/, 3],
  [/^II-?6/, 2], [/^II-?7/, 2], [/^II-?8/, 5], [/^II-?9/, 1], [/^Risk/i, 2],
  [/^III-?1(?![\d.])/, 2], [/^III-?[234]/, 5], [/^III-?5/, 2], [/^III-?6/, 5],
  [/^IV[\s-]*1\.1/, 2], [/^IV[\s-]*1\.[23]/, 2], [/^IV[\s-]*1\.4/, 5], [/^IV[\s-]*1\.5/, 1], [/^IV[\s-]*1(?![\d.])/, 5],
  [/^IV[\s-]*2/, 2], [/^IV[\s-]*3/, 4], [/^IV[\s-]*4/, 1], [/^IV[\s-]*5/, 3], [/^IV[\s-]*6/, 3]
];
function tidyDimOfCore_(cat) {
  var c = (cat || "").toString().trim();
  for (var i = 0; i < TIDY_CORE_RULES.length; i++) if (TIDY_CORE_RULES[i][0].test(c)) return TIDY_CORE_RULES[i][1];
  return 2;
}

function tidyDimLabel_(n) { return TIDY_DIMS[n - 1]; }

/** หมวดที่ไม่ใช่ "หัวข้อ" จริง: ว่าง / รอจัดหมวดย่อย / เป็นตัวเลขล้วน / ซ้ำชื่อหน่วย */
function tidyIsFiller_(cat, unit) {
  var c = (cat || "").toString().trim();
  return c === "" || c === UNIT_CATS_PLACEHOLDER || /^[0-9.\s]+$/.test(c) || c === unit;
}

/** NSO: หมวดย่อยต้นทางเป็นชื่อหน่วย (ตัด QA ออก รวมกับหน่วยเดียวกัน) */
function tidyNsoUnit_(cat) {
  return (cat || "").toString().replace(/\s*(?:TTM-)?QA\s*$/i, "").trim();
}

/**
 * หมวดที่ต้องการของแถวหนึ่ง (ฟังก์ชันล้วน)
 * คืน { cats: [{part, category}], group }
 */
function tidyPlaceCats_(cats, oldGroup) {
  var core = cats.filter(function(c) { return isCorePart_(c.part); });
  var firstCore = core.length ? core[0].category : "";
  var heading = "", nsoDim = "";
  cats.forEach(function(c) {
    if (isCorePart_(c.part)) return;
    if (c.part === NURSING_UNIT_NAME) {
      var d0 = tidyDimOfName_(c.category);
      if (d0 && !nsoDim) nsoDim = tidyDimLabel_(d0);
      return;
    }
    if (!heading && !tidyIsFiller_(c.category, c.part) && !tidyDimOfName_(c.category)) heading = c.category.trim();
  });
  var contextDim = heading ? tidyDimOfHeading_(heading) : (firstCore ? tidyDimOfCore_(firstCore) : 0);
  if (!contextDim) {
    cats.forEach(function(c) { if (!contextDim && !isCorePart_(c.part) && c.part !== NURSING_UNIT_NAME && tidyDimOfName_(c.category)) contextDim = tidyDimOfName_(c.category); });
  }
  if (!contextDim) contextDim = 2;
  var out = [], seen = {};
  cats.forEach(function(c) {
    var part = c.part, cat = c.category, res;
    if (isCorePart_(part)) res = { part: part, category: cat };
    else if (part === NURSING_UNIT_NAME) {
      res = { part: part, category: (tidyIsFiller_(cat, part) || tidyDimOfName_(cat)) ? TIDY_NSO_OVERALL : tidyNsoUnit_(cat) };
    } else {
      var d = tidyDimOfName_(cat);
      if (!d) d = tidyIsFiller_(cat, part) ? contextDim : tidyDimOfHeading_(cat);
      res = { part: part, category: tidyDimLabel_(d) };
    }
    var k = catKey_(res);
    if (!seen[k]) { seen[k] = 1; out.push(res); }
  });
  return { cats: out, group: (oldGroup || "").toString().trim() || heading || firstCore || nsoDim || "" };
}

// ---------------------------------------------------------------- ตัวชี้วัดแม่ (จากเลขข้อ)

/** คืน map: รหัสตัวย่อย → รหัสแม่ (เฉพาะแถวที่หมวดหลักไม่ใช่ Part I–IV; จัดกลุ่มตามหมวดหลักเดิมและเรียงตามแถวในชีต) */
function tidyFindParents_(rows) {
  var parentOf = {}, state = {};
  rows.forEach(function(row) {
    var id = (row[0] || "").toString().trim();
    if (!id) return;
    var part = (row[2] || "").toString().trim();
    if (isCorePart_(part)) return;
    var n = tidyNumOf_((row[4] || "").toString().split("\n")[0]);
    if (!n) return;
    var key = part + "||" + (row[3] || "").toString().trim();
    var st = state[key] || (state[key] = { stack: {}, last: "" });
    if (n === "-") { if (st.last) parentOf[id] = st.last; return; }
    var parts = n.split(".");
    for (var k = parts.length - 1; k >= 1; k--) {
      var p = parts.slice(0, k).join(".");
      if (st.stack[p]) { parentOf[id] = st.stack[p]; break; }
    }
    st.stack[n] = id;
    st.last = id;
  });
  return parentOf;
}

// ---------------------------------------------------------------- คำนวณทั้งชีต (ฟังก์ชันล้วน)

/**
 * rows: แถวข้อมูลตัวชี้วัด (ไม่รวมหัวตาราง) ยาว ≥ KPI_COLS ต่อแถว · fy: ปีงบ
 * คืน { rows: [{ index, id, changes: {...}, next: {...} }], counts }
 */
function tidyComputeSheet_(rows, fy) {
  var parentOf = tidyFindParents_(rows);
  var res = [], counts = { names: 0, owners: 0, parents: 0, cats: 0, groups: 0, levels: 0, details: 0, emptied: 0, digits: 0 };
  rows.forEach(function(row, index) {
    var id = (row[0] || "").toString().trim();
    if (!id) return;
    var oldName = (row[4] || "").toString(), oldOwner = (row[25] || "").toString();
    var oldCats = kpiCats_({ cats: [{ part: (row[2] || "ทั่วไป").toString().trim(), category: (row[3] || "ทั่วไป").toString().trim() }].concat(parseExtraCats_(row[EXTRA_CATS_COL - 1])) });
    var oldParent = (row[PARENT_COL - 1] || "").toString().trim(), oldGroup = (row[GROUP_COL - 1] || "").toString().trim();
    var oldLevels = (row[LEVEL_COLUMN - 1] || "").toString();

    var newName = tidyStripName_(oldName.split("\n")[0]);
    if (oldName.indexOf("\n") !== -1) newName = newName + oldName.slice(oldName.indexOf("\n"));
    newName = tidyAscii_(newName); // ตัวเลขบนเว็บใช้เลขอารบิก (เลขไทยใช้เฉพาะตอนพิมพ์รายงาน)
    var oldTarget = row[5], newTarget = typeof oldTarget === "string" ? tidyAscii_(oldTarget) : oldTarget;
    var oldDetails = (row[23] === null || row[23] === undefined ? "" : row[23]).toString();
    var oldSource = (row[24] === null || row[24] === undefined ? "" : row[24]).toString();
    var moved = tidyMoveDetails_(tidyAscii_(oldDetails), tidyAscii_(oldSource), newName);
    var newOwner = tidyOwnerText_(oldOwner);
    var placed = tidyPlaceCats_(oldCats, oldGroup);
    var newParent = oldParent || parentOf[id] || "";
    var newLevels = oldLevels;
    if ((TIDY_QA_REMOVE[fy] || []).indexOf(id) !== -1) {
      var lv = normalizeLevels_(oldLevels).filter(function(l) { return l !== "QA-หน่วยงาน"; });
      if (lv.length) newLevels = sortLevels_(lv).join(", ");
    }
    var changes = {};
    if (newName !== oldName) { changes.name = [oldName, newName]; counts.names++; }
    if (newOwner !== oldOwner) { changes.owner = [oldOwner, newOwner]; counts.owners++; }
    if (placed.cats.map(catKey_).join("\n") !== oldCats.map(catKey_).join("\n")) {
      changes.cats = [oldCats, placed.cats]; counts.cats++;
    }
    if (newParent !== oldParent) { changes.parent = [oldParent, newParent]; counts.parents++; }
    if (placed.group !== oldGroup) { changes.group = [oldGroup, placed.group]; counts.groups++; }
    if (newLevels !== oldLevels) { changes.levels = [oldLevels, newLevels]; counts.levels++; }
    if (newTarget !== oldTarget) changes.target = [oldTarget, newTarget];
    if (moved.details !== oldDetails) changes.details = [oldDetails, moved.details];
    if (moved.source !== oldSource) changes.source = [oldSource, moved.source];
    if (tidyAscii_(oldDetails) !== moved.details || tidyAscii_(oldSource) !== moved.source) {
      counts.details++;
      if (!moved.details.trim()) counts.emptied++;
    }
    if (/[๐-๙]/.test(oldName + oldDetails + oldSource + (typeof oldTarget === "string" ? oldTarget : ""))) counts.digits++;
    res.push({ index: index, id: id, changes: changes, changed: Object.keys(changes).length > 0,
      next: { name: newName, owner: newOwner, cats: placed.cats, parent: newParent, group: placed.group, levels: newLevels,
        target: newTarget, details: moved.details, source: moved.source } });
  });
  return { rows: res, counts: counts };
}

// ---------------------------------------------------------------- บัญชีผู้ใช้ (ฟังก์ชันล้วน)

var TIDY_TIER_RANK = { staff: 0, head: 1, executive: 2, admin: 3 };

/** users: [{username, tier, depts[], ...}] → { users (ผลลัพธ์), merges, deletes } */
function tidyComputeUsers_(users) {
  var byName = {};
  users.forEach(function(u) { byName[u.username] = u; });
  var drop = {}, merges = [], deletes = [], out = users.map(function(u) { return Object.assign({}, u, { depts: u.depts.slice() }); });
  var outBy = {};
  out.forEach(function(u) { outBy[u.username] = u; });
  Object.keys(TIDY_USER_MERGE).forEach(function(from) {
    var to = TIDY_USER_MERGE[from];
    var a = outBy[from], b = outBy[to];
    if (!a) return;
    if (b) {
      a.depts.forEach(function(d) { if (b.depts.indexOf(d) === -1) b.depts.push(d); });
      if (TIDY_TIER_RANK[a.tier] > TIDY_TIER_RANK[b.tier]) b.tier = a.tier;
      drop[from] = 1;
      merges.push({ from: from, to: to, depts: b.depts.join(","), tier: b.tier });
    } else {
      a.username = to; outBy[to] = a; delete outBy[from];
      merges.push({ from: from, to: to, depts: a.depts.join(","), tier: a.tier, renamed: true });
    }
  });
  TIDY_USER_DELETE.forEach(function(n) { if (outBy[n]) { drop[n] = 1; deletes.push(n); } });
  var kept = out.filter(function(u) { return !drop[u.username]; });
  return { users: kept, merges: merges, deletes: deletes };
}

// ---------------------------------------------------------------- อ่านชีต / วางแผน / เขียนจริง

function tidyReadFy_(fy) {
  var sheet = getFiscalSheet_(fy);
  if (!sheet) return null;
  ensureColumns_(sheet, KPI_COLS);
  var last = sheet.getLastRow();
  var rows = last >= 2 ? sheet.getRange(2, 1, last - 1, KPI_COLS).getValues() : [];
  return { sheet: sheet, rows: rows };
}

/** วางแผนจัดระเบียบทุกชีตปีงบ + บัญชีผู้ใช้ (ยังไม่เขียนอะไร) */
function tidyPlanAll_() {
  var plan = { fys: [], users: null, usersSheet: null };
  listFiscalYears_().forEach(function(fy) {
    var d = tidyReadFy_(fy);
    if (!d) return;
    plan.fys.push({ fy: fy, sheet: d.sheet, rows: d.rows, comp: tidyComputeSheet_(d.rows, fy) });
  });
  var us = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
  if (us) {
    plan.usersSheet = us;
    var users = readUsers_(us);
    plan.users = tidyComputeUsers_(users);
    plan.users.before = users.length;
  }
  return plan;
}

function tidyHasWork_(plan) {
  var any = plan.fys.some(function(f) { return f.comp.rows.some(function(r) { return r.changed; }); });
  return any || !!(plan.users && (plan.users.merges.length || plan.users.deletes.length));
}

// ข้อความที่ขึ้นต้นด้วย = หรือ + ชีตจะตีเป็นสูตร → ใส่ ' นำหน้าให้เก็บเป็นข้อความ
function tidyLiteral_(v) { return typeof v === "string" && /^[=+]/.test(v) ? "'" + v : v; }

function tidyCatsText_(cats) { return cats.map(function(c) { return c.part + " | " + c.category; }).join("\n"); }

/** เขียนผลที่วางแผนไว้ (เรียกในล็อกของผู้เรียก) opts.backup: สำรองชีตก่อน (ถ้ายังไม่มี) · opts.users: ปรับบัญชีผู้ใช้ด้วย */
function tidyApply_(plan, opts) {
  opts = opts || {};
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var stamp = nowStamp_(), out = { fys: {}, users: { merged: 0, deleted: 0 }, nsoSync: 0, logRows: 0 };
  var logRows = [];
  plan.fys.forEach(function(f) {
    var changedRows = f.comp.rows.filter(function(r) { return r.changed; });
    var c0 = f.comp.counts;
    out.fys[f.fy] = { rows: changedRows.length, names: c0.names, owners: c0.owners, parents: c0.parents, cats: c0.cats, groups: c0.groups, levels: c0.levels, details: c0.details, digits: c0.digits };
    if (changedRows.length === 0) return;
    if (opts.backup) {
      // สำรองแยกตามรอบ: รอบแรก "จัดระเบียบ" · รอบย้ายรายละเอียด/ตัวเลข (เพิ่มภายหลัง) สำรองอีกชุดก่อนเขียน
      var textRound = c0.details > 0 || c0.digits > 0;
      var bname = "สำรองก่อน" + (textRound ? "ย้ายรายละเอียด " : "จัดระเบียบ ") + fiscalSheetName_(f.fy);
      if (!ss.getSheetByName(bname)) { var b = f.sheet.copyTo(ss); b.setName(bname); b.hideSheet(); }
    }
    var byIndex = {};
    f.comp.rows.forEach(function(r) { byIndex[r.index] = r; });
    var colName = [], colOwner = [], colCD = [], colLevels = [], colExtra = [], colTarget = [], colText = [];
    f.rows.forEach(function(row, i) {
      var r = byIndex[i];
      var nx = r ? r.next : null;
      colName.push([nx ? nx.name : row[4]]);
      colTarget.push([nx ? nx.target : row[5]]);
      colText.push(nx ? [tidyLiteral_(nx.details), tidyLiteral_(nx.source)] : [row[23], row[24]]);
      colOwner.push([nx ? nx.owner : row[25]]);
      colCD.push(nx ? [nx.cats[0].part, nx.cats[0].category] : [row[2], row[3]]);
      colLevels.push([nx ? nx.levels : row[LEVEL_COLUMN - 1]]);
      colExtra.push(nx ? [formatExtraCats_(nx.cats.slice(1)), nx.parent, nx.group] : [row[EXTRA_CATS_COL - 1], row[PARENT_COL - 1], row[GROUP_COL - 1]]);
      if (r && r.changed) {
        Object.keys(r.changes).forEach(function(k) {
          var ch = r.changes[k];
          var o = k === "cats" ? tidyCatsText_(ch[0]) : ch[0], n = k === "cats" ? tidyCatsText_(ch[1]) : ch[1];
          logRows.push([stamp, f.fy, r.id, k, String(o).slice(0, 49000), String(n).slice(0, 49000)]);
        });
      }
    });
    var n = f.rows.length;
    f.sheet.getRange(2, 5, n, 1).setValues(colName);
    f.sheet.getRange(2, 6, n, 1).setValues(colTarget);
    f.sheet.getRange(2, 24, n, 2).setValues(colText);
    f.sheet.getRange(2, 26, n, 1).setValues(colOwner);
    f.sheet.getRange(2, 3, n, 2).setValues(colCD);
    f.sheet.getRange(2, LEVEL_COLUMN, n, 1).setValues(colLevels);
    f.sheet.getRange(2, EXTRA_CATS_COL, n, 3).setNumberFormat("@").setValues(colExtra);
    [[PARENT_COL, PARENT_HEADER], [GROUP_COL, GROUP_HEADER]].forEach(function(h) {
      if (!f.sheet.getRange(1, h[0]).getValue()) f.sheet.getRange(1, h[0]).setValue(h[1]).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
    });
  });

  // ชีต NSO_Sync: ให้สำเนาต้นทางใช้ชื่อผู้รับผิดชอบมาตรฐานเดียวกัน (กันรายการ "ขัดแย้ง" ตอนอัปเดตจาก NSO ครั้งถัดไป)
  var sync = ss.getSheetByName(NSO_SYNC_SHEET);
  if (sync && sync.getLastRow() >= 2) {
    var sv = sync.getRange(2, 3, sync.getLastRow() - 1, 1).getValues(), schanged = 0;
    var sOut = sv.map(function(r) {
      var txt = (r[0] || "").toString();
      if (!txt) return [txt];
      try {
        var snap = JSON.parse(txt);
        if (snap && typeof snap.owner === "string") {
          var fixed = tidyOwnerText_(snap.owner);
          if (fixed !== snap.owner) { snap.owner = fixed; schanged++; return [JSON.stringify(snap)]; }
        }
      } catch (e) {}
      return [txt];
    });
    if (schanged > 0) { sync.getRange(2, 3, sOut.length, 1).setValues(sOut); out.nsoSync = schanged; }
  }

  if (opts.users && plan.users && plan.usersSheet && (plan.users.merges.length || plan.users.deletes.length)) {
    var us = plan.usersSheet;
    var uss = getUsersSpreadsheet_(), bn = "สำรองผู้ใช้ก่อนจัดระเบียบ";
    if (!uss.getSheetByName(bn)) { var ub = us.copyTo(uss); ub.setName(bn); ub.hideSheet(); }
    writeUsers_(us, plan.users.users);
    out.users = { merged: plan.users.merges.length, deleted: plan.users.deletes.length };
    plan.users.merges.forEach(function(m) { logRows.push([stamp, "", m.from, "user-merge", m.from, m.to + " (" + m.depts + ")"]); });
    plan.users.deletes.forEach(function(d) { logRows.push([stamp, "", d, "user-delete", d, ""]); });
  }

  if (logRows.length > 0) {
    var log = ss.getSheetByName(TIDY_LOG_SHEET);
    if (!log) {
      log = ss.insertSheet(TIDY_LOG_SHEET);
      log.getRange(1, 1, 1, 6).setValues([["เวลา", "ปีงบ", "รหัส", "ฟิลด์", "ค่าเดิม", "ค่าใหม่"]]).setFontWeight("bold");
      log.hideSheet();
    }
    log.getRange(log.getLastRow() + 1, 1, logRows.length, 6).setNumberFormat("@").setValues(logRows);
    out.logRows = logRows.length;
  }
  return out;
}

/** สรุปแผนสำหรับแสดงในหน้าตั้งค่า (ตัดรายการยาวให้พอดี) */
function tidySummary_(plan) {
  var s = { fys: [], samples: { names: [], parents: [], owners: [], levels: [], cats: [], users: [], details: [] }, usersMerge: [], usersDelete: [], hasWork: tidyHasWork_(plan) };
  var catMap = {};
  plan.fys.forEach(function(f) {
    var c = f.comp.counts;
    s.fys.push({ fy: f.fy, total: f.comp.rows.length, rows: f.comp.rows.filter(function(r) { return r.changed; }).length, names: c.names, owners: c.owners, parents: c.parents, cats: c.cats, groups: c.groups, levels: c.levels, details: c.details, emptied: c.emptied, digits: c.digits });
    if (f.fy !== plan.fys[plan.fys.length - 1].fy && plan.fys.length > 1) { /* แสดงตัวอย่างจากปีล่าสุดเท่านั้น */ }
  });
  var last = plan.fys[plan.fys.length - 1];
  if (last) {
    var nameOf = {};
    last.comp.rows.forEach(function(r) { nameOf[r.id] = r.next.name; });
    last.comp.rows.forEach(function(r) {
      var ch = r.changes;
      if (ch.name && s.samples.names.length < 14) s.samples.names.push({ id: r.id, from: ch.name[0], to: ch.name[1] });
      if (ch.parent && s.samples.parents.length < 14) s.samples.parents.push({ child: r.next.name, parent: nameOf[r.next.parent] || r.next.parent });
      if (ch.owner && s.samples.owners.length < 30) s.samples.owners.push({ id: r.id, from: ch.owner[0], to: ch.owner[1] });
      var mvText = ch.details && s.samples.details.length < 12 ? tidySplitDetails_(tidyAscii_(ch.details[0])).move : "";
      if (mvText) s.samples.details.push({ name: r.next.name, moved: mvText.slice(0, 160), keep: r.next.details.slice(0, 120) });
      if (ch.levels && s.samples.levels.length < 10) s.samples.levels.push({ id: r.id, name: r.next.name, from: ch.levels[0], to: ch.levels[1] });
      if (ch.cats) {
        ch.cats[0].forEach(function(o, i) {
          var n = ch.cats[1][i];
          if (!n || (o.part === n.part && o.category === n.category)) return;
          var k = o.part + " › " + o.category + "  →  " + n.part + " › " + n.category;
          catMap[k] = (catMap[k] || 0) + 1;
        });
      }
    });
    s.samples.cats = Object.keys(catMap).sort(function(a, b) { return catMap[b] - catMap[a]; }).slice(0, 25).map(function(k) { return { map: k, n: catMap[k] }; });
  }
  if (plan.users) { s.usersMerge = plan.users.merges; s.usersDelete = plan.users.deletes; }
  return s;
}

function tidyPreview(token) {
  try {
    requireAdmin_(token);
    return { success: true, preview: tidySummary_(tidyPlanAll_()) };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

function tidyCommit(token) {
  var lock = null;
  try {
    var admin = requireAdmin_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var plan = tidyPlanAll_();
    if (!tidyHasWork_(plan)) return { success: true, message: "ข้อมูลเป็นระเบียบอยู่แล้ว ไม่มีอะไรต้องแก้", wrote: null, preview: tidySummary_(plan) };
    var wrote = tidyApply_(plan, { backup: true, users: true });
    SpreadsheetApp.flush();
    touchUser_(admin, "edit");
    return { success: true, message: "จัดระเบียบเรียบร้อย", wrote: wrote, preview: tidySummary_(tidyPlanAll_()) };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}
