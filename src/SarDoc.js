/**
 * เอกสารส่ง สรพ. (HA reaccreditation): SAR Part I–IV + CLT profile ของ PCT
 *  - ข้อมูลตัวชี้วัด (เป้าหมาย/ผล/การวิเคราะห์) ใช้จากชีตปีงบตามเดิม — ที่นี่เก็บเฉพาะ "ข้อความที่ผู้ใช้กรอกเพิ่ม" ในชีต SAR_Doc
 *    (ไม่เพิ่มคอลัมน์ในชีตปีงบ) แถวละ 1 รายการ: ปีงบ · เอกสาร (SAR/CLT) · กุญแจ · เนื้อหา · รุ่น · แก้ไขล่าสุดเมื่อ/โดย
 *  - SAR: สรุป PDCA ต่อตัวชี้วัดต่อปีงบ  กุญแจ = "PDCA|<รหัสตัวชี้วัด>" (แก้ได้ตามสิทธิ์แก้รายละเอียดของตัวชี้วัดนั้น)
 *  - ใช้ได้เฉพาะหัวหน้าหน่วยขึ้นไป (head / executive / admin) · ทุกการเขียนอยู่ใต้ script lock + ตรวจรุ่น (baseRev) กันเขียนทับกัน
 *    และจดลงบันทึกการเปลี่ยนแปลง (Live.js) เพื่อให้เครื่องอื่นเห็นข้อมูลใหม่
 */

var SARDOC_SHEET = "SAR_Doc";
var SARDOC_HEADERS = ["ปีงบ", "เอกสาร", "กุญแจ", "เนื้อหา", "รุ่น", "แก้ไขล่าสุดเมื่อ", "แก้ไขล่าสุดโดย"];
var SARDOC_MAX_CHARS = 45000; // เซลล์ของชีตรับได้ไม่เกิน 50,000 ตัวอักษร
var SARDOC_TIERS = { head: 1, executive: 1, admin: 1 };
var SARDOC_SAR = "SAR";
var SARDOC_PDCA_PREFIX = "PDCA|";
// ข้อความที่ลอกมาจากปีงบก่อน (ยังไม่มีใครตรวจ): ช่อง "แก้ไขล่าสุดโดย" เป็น "ร่างจากปีงบ <ปี>" — พอมีคนบันทึกหรือกดยืนยัน ช่องนี้เปลี่ยนเป็นชื่อผู้ใช้ (ป้ายร่างหายเอง)
var SARDOC_DRAFT_PREFIX = "ร่างจากปีงบ ";
function sarDocIsDraftBy_(by) { return (by || "").toString().indexOf(SARDOC_DRAFT_PREFIX) === 0; }

function requireDocUser_(token) {
  var user = requireUser_(token);
  if (!SARDOC_TIERS[user.tier]) throw new Error("ไม่มีสิทธิ์ใช้งานเอกสาร สรพ. (เฉพาะหัวหน้าหน่วยขึ้นไป)");
  return user;
}

/** ชีต SAR_Doc (ไม่มี = null) — ใช้ตอนอ่าน ไม่สร้างชีตเอง */
function sarDocSheetIfAny_() {
  return SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SARDOC_SHEET);
}

/** ชีต SAR_Doc — สร้างให้ถ้ายังไม่มี (เรียกภายใต้ script lock เท่านั้น) */
function sarDocSheetEnsure_() {
  var sheet = sarDocSheetIfAny_();
  if (sheet) return sheet;
  sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).insertSheet(SARDOC_SHEET);
  sheet.getRange(1, 1, 1, SARDOC_HEADERS.length).setValues([SARDOC_HEADERS]).setFontWeight("bold").setBackground("#e0f2fe");
  sheet.setFrozenRows(1);
  return sheet;
}

function sarDocItem_(r) {
  return { text: (r[3] === null || r[3] === undefined ? "" : r[3]).toString(), rev: Number(r[4]) || 0, at: formatStamp_(r[5]), by: (r[6] || "").toString() };
}

/** แถวทั้งหมดของเอกสาร doc ในปีงบ fy → { กุญแจ: { text, rev, at, by, row } } (row = เลขแถวในชีต เริ่ม 1) */
function sarDocRead_(sheet, fy, doc) {
  var out = {};
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(fy) || String(data[i][1]) !== doc || !data[i][2]) continue;
    var it = sarDocItem_(data[i]);
    it.row = i + 1;
    out[data[i][2].toString()] = it;
  }
  return out;
}

/** ข้อความที่จะเก็บ: เลขอารบิก ตัดช่องว่างท้ายบรรทัด/ท้ายข้อความ (เลขไทยใช้เฉพาะตอนพิมพ์) */
function sarDocCleanText_(text) {
  return arabicDigits_(text).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\s+$/, "");
}

/**
 * เขียนรายการ 1 รายการ (เรียกภายใต้ script lock) — แถวเดิมที่รุ่นไม่ตรง baseRev คืน conflict (ยกเว้น force)
 * คืน { ok: true, item } หรือ { conflict: true, current } · ไม่มีการเปลี่ยน = { ok: true, item, unchanged: true }
 */
function sarDocWrite_(user, fy, doc, key, text, baseRev, force) {
  var sheet = sarDocSheetEnsure_();
  var cur = sarDocRead_(sheet, fy, doc)[key] || null;
  var curRev = cur ? cur.rev : 0;
  if (!force && baseRev !== undefined && baseRev !== null && Number(baseRev) !== curRev) {
    return { conflict: true, current: cur ? { text: cur.text, rev: cur.rev, at: cur.at, by: cur.by } : { text: "", rev: 0, at: "", by: "" } };
  }
  if ((cur ? cur.text : "") === text) return { ok: true, unchanged: true, item: cur ? { text: cur.text, rev: cur.rev, at: cur.at, by: cur.by } : { text: "", rev: 0, at: "", by: "" } };
  var stamp = nowStamp_(), rev = curRev + 1;
  if (cur) {
    sheet.getRange(cur.row, 4, 1, 4).setValues([[text, rev, stamp, user.username]]);
  } else {
    var row = sheet.getLastRow() + 1;
    sheet.getRange(row, 3, 1, 4).setNumberFormat("@"); // กุญแจ/เนื้อหา/รุ่น/เวลา เป็นข้อความล้วน — ข้อความที่ขึ้นต้นด้วย = หรือ + ต้องไม่ถูกตีเป็นสูตร (ตั้งก่อนเขียนค่า)
    sheet.getRange(row, 1, 1, SARDOC_HEADERS.length).setValues([[fy, doc, key, text, rev, stamp, user.username]]);
  }
  return { ok: true, item: { text: text, rev: rev, at: stamp, by: user.username } };
}

/**
 * เติมข้อความหลายรายการในครั้งเดียว (เรียกภายใต้ script lock) — เฉพาะรายการที่ยังว่าง ไม่ทับของที่กรอกแล้ว · อ่านชีตครั้งเดียว เขียนเป็นก้อนเดียว (คัดลอกจากปีงบก่อน ~300 รายการ)
 * entries = [{ key, text }] → จำนวนที่เติม
 */
function sarDocFillMany_(user, fy, doc, entries) {
  var sheet = sarDocSheetEnsure_(), cur = sarDocRead_(sheet, fy, doc), stamp = nowStamp_(), add = [], n = 0;
  entries.forEach(function(e) {
    var c = cur[e.key];
    if (c && c.text) return;
    n++;
    if (c) sheet.getRange(c.row, 4, 1, 4).setValues([[e.text, c.rev + 1, stamp, user.username]]);
    else add.push([fy, doc, e.key, e.text, 1, stamp, user.username]);
  });
  if (add.length) {
    var row = sheet.getLastRow() + 1;
    sheet.getRange(row, 3, add.length, 4).setNumberFormat("@");
    sheet.getRange(row, 1, add.length, SARDOC_HEADERS.length).setValues(add);
  }
  return n;
}

/** ปีงบก่อนหน้า (ใหม่ → เก่า) ล่าสุดที่เอกสาร doc มีข้อความ ที่กุญแจผ่านตัวกรอง accept → { fy, rows } หรือ null */
function sarDocPreviousWithData_(sheet, fy, doc, accept) {
  var found = null;
  listFiscalYears_().filter(function(y) { return y < fy; }).some(function(y) {
    var rows = sarDocRead_(sheet, y, doc);
    if (Object.keys(rows).some(function(k) { return rows[k].text && accept(k); })) { found = { fy: y, rows: rows }; return true; }
    return false;
  });
  return found;
}

/** รหัสตัวชี้วัด Part I–IV ของปีงบ fy ที่ผู้ใช้ดูได้ → { รหัส: สิทธิ์แก้รายละเอียด } */
function sarVisibleKpis_(user, fy) {
  var out = {};
  var sheet = getFiscalSheet_(fy);
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    var kpi = rowToKpi_(data[r]);
    if (!inCorePart_(kpi)) continue;
    var perm = getKpiPermission_(user, kpi, fy);
    if (perm.view) out[kpi.id] = !!perm.editDetails;
  }
  return out;
}

/** สรุป PDCA ของตัวชี้วัดทุกตัวในปีงบ fy ที่ผู้ใช้ดูได้ (หน้าเอกสาร SAR) */
function getSarDoc(token, fy) {
  try {
    var user = requireDocUser_(token);
    fy = resolveFiscalYear_(fy);
    var visible = sarVisibleKpis_(user, fy);
    var rows = sarDocRead_(sarDocSheetIfAny_(), fy, SARDOC_SAR), pdca = {};
    Object.keys(rows).forEach(function(key) {
      if (key.indexOf(SARDOC_PDCA_PREFIX) !== 0) return;
      var id = key.slice(SARDOC_PDCA_PREFIX.length), it = rows[key];
      if (visible[id] === undefined || (!it.text && !it.rev)) return;
      pdca[id] = { text: it.text, rev: it.rev, at: it.at, by: it.by };
    });
    return { success: true, fy: fy, pdca: pdca, v: dataVersion_(readChangeLog_()) };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/** บันทึกสรุป PDCA ของตัวชี้วัด id ในปีงบ fy — ต้องแก้รายละเอียดของตัวชี้วัดนั้นได้ */
function saveSarPdca(token, fy, id, text, baseRev, force) {
  var lock = null;
  try {
    var user = requireDocUser_(token);
    id = (id || "").toString().trim();
    text = sarDocCleanText_(text);
    if (text.length > SARDOC_MAX_CHARS) return { success: false, message: "ข้อความยาวเกินไป (ไม่เกิน " + SARDOC_MAX_CHARS + " ตัวอักษร)" };
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var visible = sarVisibleKpis_(user, fy);
    if (visible[id] === undefined) return { success: false, message: "ไม่พบตัวชี้วัด Part I–IV นี้ในปีงบ " + fy + " หรือไม่มีสิทธิ์ดู" };
    if (!visible[id]) return { success: false, message: "ไม่มีสิทธิ์แก้ไขตัวชี้วัดนี้ในปีงบ " + fy };
    var res = sarDocWrite_(user, fy, SARDOC_SAR, SARDOC_PDCA_PREFIX + id, text, baseRev, force);
    if (res.conflict) {
      return { success: false, conflict: true, current: res.current,
        message: "การวิเคราะห์และ PDCA นี้ถูกแก้ไขโดย " + (res.current.by || "ผู้ใช้อื่น") + (res.current.at ? " เมื่อ " + res.current.at : "") + " ระหว่างที่คุณกำลังแก้ไข" };
    }
    if (!res.unchanged) {
      touchUser_(user, "edit");
      bumpDataVersion_(fy, [], user, SARDOC_SAR);
    }
    return { success: true, changed: !res.unchanged, item: res.item };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/**
 * คัดลอกสรุป PDCA จากปีงบก่อนหน้าล่าสุดที่มีข้อมูล มาเป็นร่างของปีงบ fy — เฉพาะตัวชี้วัดที่ผู้ใช้แก้ได้ และที่ยังว่างในปีงบนี้ (ไม่ทับของที่กรอกแล้ว)
 */
function copySarPdcaFromPrevious(token, fy) {
  var lock = null;
  try {
    var user = requireDocUser_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var isPdca = function(k) { return k.indexOf(SARDOC_PDCA_PREFIX) === 0; };
    var prev = sarDocPreviousWithData_(sarDocSheetIfAny_(), fy, SARDOC_SAR, isPdca);
    if (!prev) return { success: false, message: "ยังไม่มีการวิเคราะห์และ PDCA ของปีงบก่อนหน้าให้คัดลอก" };
    var visible = sarVisibleKpis_(user, fy), entries = [];
    Object.keys(prev.rows).forEach(function(key) {
      if (!isPdca(key) || !prev.rows[key].text) return;
      if (visible[key.slice(SARDOC_PDCA_PREFIX.length)]) entries.push({ key: key, text: prev.rows[key].text });
    });
    var copied = sarDocFillMany_({ username: SARDOC_DRAFT_PREFIX + prev.fy }, fy, SARDOC_SAR, entries);
    if (copied > 0) {
      touchUser_(user, "edit");
      bumpDataVersion_(fy, [], user, SARDOC_SAR);
    }
    return { success: true, from: prev.fy, copied: copied,
      message: copied > 0 ? "คัดลอกการวิเคราะห์และ PDCA จากปีงบ " + prev.fy + " แล้ว " + copied + " ตัวชี้วัด (เป็นร่าง — ตรวจและแก้ไขก่อนส่ง)" : "ไม่มีตัวชี้วัดที่ต้องคัดลอก (กรอกไว้แล้วทั้งหมด หรือไม่มีสิทธิ์แก้)" };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ================================================================ CLT profile ของ PCT
// ข้อความของ CLT (ภาพรวม PCT + รายโรค) เก็บในชีต SAR_Doc เดียวกัน (เอกสาร = "CLT") กุญแจ:
//   O|<หัวข้อ>               ภาพรวม PCT (พันธกิจ ขอบเขต ผู้รับบริการ จุดเน้น กลุ่มผู้ป่วยสำคัญ ความเสี่ยง กระบวนการ QI แผน)
//   D|<กลุ่มโรค>|<หัวข้อ>     รายโรค (บริบท ประเด็นท้าทาย เป้าหมาย driver diagram process management แผน)
//   D|<กลุ่มโรค>|R|<รหัส>     ข้อความผลลัพธ์/การพัฒนาของตัวชี้วัดในกลุ่มโรคนั้น
//   DIM|<รหัส>               มิติคุณภาพ (A–H) ของตัวชี้วัด ที่ผู้ใช้ปรับจากค่าที่ระบบเดา
//   S|groups                 กลุ่มโรคที่เลือกใส่ในเอกสาร (JSON) — ไม่มี = ทุกกลุ่มที่มีตัวชี้วัด
// ใช้ได้เฉพาะ admin, ผอ./QMR และหัวหน้าหน่วย PCT — ผอ./QMR เห็นตัวชี้วัดฝั่งหน้าเว็บเฉพาะ Part I–IV (ไม่รู้กลุ่มโรค PCT) จึงให้เซิร์ฟเวอร์ส่งรายการตัวชี้วัด PCT มาให้ที่นี่

var SARDOC_CLT = "CLT";
var CLT_OVERVIEW_FIELDS = { mission: "text", scope: "text", clients: "table", focus: "text", priority: "table", risks: "table", process: "table", qi: "table", plan: "table" };
var CLT_DISEASE_FIELDS = { context: "text", challenge: "text", purpose: "text", driver: "table", pm: "table", plan: "text" };
var CLT_TABLE_MAX_ROWS = 300;
var CLT_TABLE_MAX_COLS = 8;

// กุญแจที่แก้ได้เฉพาะ admin: โรค/ตัวชี้วัดที่ใส่ในเอกสาร CLT
var CLT_ADMIN_KEYS_ = ["S|groups", "S|kpis"];

function cltAllowed_(user) {
  return user.tier === "admin" || user.tier === "executive" || (user.tier === "head" && user.depts.indexOf(PCT_UNIT) !== -1);
}

function requireCltUser_(token) {
  var user = requireUser_(token);
  if (!cltAllowed_(user)) throw new Error("ไม่มีสิทธิ์ใช้งาน CLT profile (เฉพาะ admin, ผอ./QMR และหัวหน้าหน่วย PCT)");
  return user;
}

/** ตัวชี้วัดที่อยู่หมวดของหน่วย PCT ในปีงบ fy (หมวดย่อย = กลุ่มโรค) — เฉพาะข้อมูลที่ใช้ทำเอกสาร */
function cltKpis_(fy) {
  var out = [], sheet = getFiscalSheet_(fy);
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    var kpi = rowToKpi_(data[r]);
    var groups = kpiCats_(kpi).filter(function(c) { return c.part === PCT_UNIT; }).map(function(c) { return c.category; });
    if (groups.length === 0) continue;
    var details = (kpi.templateDetails || "").toString().split("\n").filter(function(l) { return !TIDY_NOTE_LINE.test(l.trim()); }).join("\n").trim();
    out.push({ id: kpi.id, name: kpi.name, target: kpi.target, years: kpi.years, details: details, groups: groups, order: viewPctOrder_(kpi.id), row: r });
  }
  return out;
}

/** ตรวจกุญแจ CLT → { kind: "text" | "table" | "groups" | "dim" | "result", kpi } หรือ { error } */
function cltCheckKey_(key, kpiIds) {
  var bad = { error: "กุญแจข้อความ CLT ไม่ถูกต้อง" };
  if (typeof key !== "string" || key.length > 200 || /[\r\n]/.test(key)) return bad;
  var p = key.split("|");
  if (p[0] === "O" && p.length === 2 && CLT_OVERVIEW_FIELDS.hasOwnProperty(p[1])) return { kind: CLT_OVERVIEW_FIELDS[p[1]] };
  if (key === "S|groups") return { kind: "groups" };
  if (key === "S|kpis") return { kind: "kpiex" };
  if (p[0] === "D" && p.length === 3 && p[1] && p[1].length <= 100 && CLT_DISEASE_FIELDS.hasOwnProperty(p[2])) return { kind: CLT_DISEASE_FIELDS[p[2]] };
  if (p[0] === "D" && p.length === 4 && p[1] && p[1].length <= 100 && p[2] === "R" && kpiIds[p[3]]) return { kind: "result" };
  if (p[0] === "DIM" && p.length === 2 && kpiIds[p[1]]) return { kind: "dim" };
  return bad;
}

/** ตารางที่ผู้ใช้ส่งมา (JSON ของแถว×คอลัมน์) → JSON มาตรฐาน: เลขอารบิก ตัดช่องว่าง ตัดแถวที่ว่างทั้งแถว · ผิดรูปคืน null */
function cltCleanTable_(raw) {
  var rows;
  try { rows = JSON.parse(raw); } catch (e) { return null; }
  if (!Array.isArray(rows) || rows.length > CLT_TABLE_MAX_ROWS) return null;
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (!Array.isArray(rows[i]) || rows[i].length > CLT_TABLE_MAX_COLS) return null;
    var row = rows[i].map(function(c) { return typeof c === "string" ? sarDocCleanText_(c) : ""; });
    if (row.some(function(c) { return c; })) out.push(row);
  }
  return JSON.stringify(out);
}

function cltCleanValue_(kind, content) {
  content = content === null || content === undefined ? "" : content.toString();
  if (kind === "table") { var t = cltCleanTable_(content || "[]"); return t === null ? { error: "ข้อมูลตารางไม่ถูกต้อง" } : { value: t === "[]" ? "" : t }; }
  if (kind === "groups") {
    var g;
    try { g = JSON.parse(content || "[]"); } catch (e) { g = null; }
    if (!Array.isArray(g) || g.length > 100 || g.some(function(x) { return typeof x !== "string" || !x || x.length > 100 || /[|\r\n]/.test(x); })) return { error: "รายการกลุ่มโรคไม่ถูกต้อง" };
    return { value: JSON.stringify(g) };
  }
  if (kind === "kpiex") { // ตัวชี้วัดที่ไม่เอา: ["<กลุ่มโรค>|<รหัสตัวชี้วัด>", …]
    var x;
    try { x = JSON.parse(content || "[]"); } catch (e) { x = null; }
    if (!Array.isArray(x) || x.length > 5000 || x.some(function(e) { return typeof e !== "string" || !/^[^|\r\n]{1,100}\|[^|\r\n]{1,100}$/.test(e); })) return { error: "รายการตัวชี้วัดที่ไม่เอาไม่ถูกต้อง" };
    return { value: JSON.stringify(x) };
  }
  if (kind === "dim") {
    var d = content.trim().toUpperCase();
    if (d && !/^[A-H]$/.test(d)) return { error: "มิติคุณภาพไม่ถูกต้อง" };
    return { value: d };
  }
  var text = sarDocCleanText_(content);
  if (text.length > SARDOC_MAX_CHARS) return { error: "ข้อความยาวเกินไป (ไม่เกิน " + SARDOC_MAX_CHARS + " ตัวอักษร)" };
  return { value: text };
}

/** ข้อความ CLT ทั้งหมดของปีงบ fy + รายการตัวชี้วัด PCT (หน้า CLT) */
function getCltDoc(token, fy) {
  try {
    requireCltUser_(token);
    fy = resolveFiscalYear_(fy);
    var rows = sarDocRead_(sarDocSheetIfAny_(), fy, SARDOC_CLT), items = {};
    Object.keys(rows).forEach(function(k) { items[k] = { text: rows[k].text, rev: rows[k].rev, at: rows[k].at, by: rows[k].by }; });
    return { success: true, fy: fy, items: items, kpis: cltKpis_(fy), v: dataVersion_(readChangeLog_()) };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/** บันทึกข้อความ CLT 1 รายการ (ข้อความ / ตารางเป็น JSON / มิติ) — ตรวจรุ่นกันเขียนทับ */
function saveCltItem(token, fy, key, content, baseRev, force) {
  var lock = null;
  try {
    var user = requireCltUser_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var ids = {};
    if (/^(DIM\||D\|[^|]*\|R\|)/.test(key || "")) cltKpis_(fy).forEach(function(k) { ids[k.id] = true; });
    var spec = cltCheckKey_(key, ids);
    if (spec.error) return { success: false, message: spec.error };
    if (CLT_ADMIN_KEYS_.indexOf(key) !== -1 && user.tier !== "admin") return { success: false, message: "เลือกโรค/ตัวชี้วัดที่จะใส่ในเอกสารได้เฉพาะผู้ดูแลระบบ (admin)" };
    var clean = cltCleanValue_(spec.kind, content);
    if (clean.error) return { success: false, message: clean.error };
    var res = sarDocWrite_(user, fy, SARDOC_CLT, key, clean.value, baseRev, force);
    if (res.conflict) {
      return { success: false, conflict: true, current: res.current,
        message: "ข้อความนี้ถูกแก้ไขโดย " + (res.current.by || "ผู้ใช้อื่น") + (res.current.at ? " เมื่อ " + res.current.at : "") + " ระหว่างที่คุณกำลังแก้ไข" };
    }
    if (!res.unchanged) {
      touchUser_(user, "edit");
      bumpDataVersion_(fy, [], user, SARDOC_CLT);
    }
    return { success: true, changed: !res.unchanged, item: res.item };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** คัดลอกข้อความ CLT จากปีงบก่อนหน้าล่าสุดที่มีข้อมูล มาเป็นร่าง — เฉพาะรายการที่ยังว่างในปีงบนี้ (รายการของตัวชี้วัดที่ไม่มีในปีงบนี้ข้าม) */
function copyCltFromPrevious(token, fy) {
  var lock = null;
  try {
    var user = requireCltUser_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var prev = sarDocPreviousWithData_(sarDocSheetIfAny_(), fy, SARDOC_CLT, function() { return true; });
    if (!prev) return { success: false, message: "ยังไม่มีข้อความ CLT ของปีงบก่อนหน้าให้คัดลอก" };
    var ids = {};
    cltKpis_(fy).forEach(function(k) { ids[k.id] = true; });
    var entries = [];
    Object.keys(prev.rows).forEach(function(key) {
      if (!prev.rows[key].text || cltCheckKey_(key, ids).error) return;
      if (CLT_ADMIN_KEYS_.indexOf(key) !== -1 && user.tier !== "admin") return;
      var text = cltCarryText_(key, prev.rows[key].text, ids);
      if (text) entries.push({ key: key, text: text });
    });
    var copied = sarDocFillMany_({ username: SARDOC_DRAFT_PREFIX + prev.fy }, fy, SARDOC_CLT, entries);
    if (copied > 0) {
      touchUser_(user, "edit");
      bumpDataVersion_(fy, [], user, SARDOC_CLT);
    }
    return { success: true, from: prev.fy, copied: copied,
      message: copied > 0 ? "คัดลอกข้อความ CLT จากปีงบ " + prev.fy + " แล้ว " + copied + " รายการ (เป็นร่าง — ตรวจและแก้ไขก่อนส่ง)" : "ไม่มีรายการที่ต้องคัดลอก (กรอกไว้แล้วทั้งหมด)" };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ================================================================ ขึ้นปีงบใหม่: ดึงข้อความ SAR + CLT จากปีก่อน

/** ข้อความ CLT ที่ลอกจากปีก่อน: ตาราง Driver Diagram ตัดรหัสตัวชี้วัดที่ปีนี้ไม่มีออกจากช่องตัวชี้วัด (ช่อง 5–8) · Process Management ทิ้งแถวที่ผูกตัวชี้วัดที่ปีนี้ไม่มี — คืนข้อความว่างถ้าไม่เหลืออะไร */
function cltCarryText_(key, text, ids) {
  var m = /^D\|[^|]+\|(driver|pm)$/.exec(key);
  if (!m) return text;
  var rows;
  try { rows = JSON.parse(text); } catch (e) { return text; }
  if (!Array.isArray(rows)) return text;
  var out = [];
  rows.forEach(function(r) {
    if (!Array.isArray(r)) return;
    r = r.slice();
    if (m[1] === "driver") {
      for (var c = 4; c < 8 && c < r.length; c++) {
        r[c] = (r[c] || "").toString().split(",").map(function(x) { return x.trim(); }).filter(function(id) { return id && ids[id]; }).join(",");
      }
    } else if (r.length >= 5 && r[4] && !ids[r[4]]) {
      return;
    }
    out.push(r);
  });
  return out.length ? JSON.stringify(out) : "";
}

/** รหัสตัวชี้วัด Part I–IV ที่มีในชีตปีงบ fy */
function sarCoreKpiIds_(fy) {
  var out = {}, sheet = getFiscalSheet_(fy);
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    var kpi = rowToKpi_(data[r]);
    if (inCorePart_(kpi)) out[kpi.id] = true;
  }
  return out;
}

/**
 * ลอกข้อความ SAR (สรุป PDCA) และ CLT ทั้งเล่มจากปีงบก่อนหน้าล่าสุดที่มีข้อมูล มาเป็น "ร่าง" ของปีงบ fy
 * เติมเฉพาะหัวข้อที่ยังว่าง (ไม่ทับของที่กรอกแล้ว) · ข้ามตัวชี้วัดที่ปีนี้ไม่มี · เรียกภายใต้ script lock
 * คืน { sar, clt, sarFrom, cltFrom } = จำนวนที่ลอกและปีต้นทาง
 */
function carryOverDocs_(fy) {
  var out = { sar: 0, clt: 0, sarFrom: null, cltFrom: null }, sheet = sarDocSheetIfAny_();
  if (!sheet) return out;
  var isPdca = function(k) { return k.indexOf(SARDOC_PDCA_PREFIX) === 0; };
  var prevS = sarDocPreviousWithData_(sheet, fy, SARDOC_SAR, isPdca);
  if (prevS) {
    var core = sarCoreKpiIds_(fy), entries = [];
    Object.keys(prevS.rows).forEach(function(key) {
      if (!isPdca(key) || !prevS.rows[key].text) return;
      if (core[key.slice(SARDOC_PDCA_PREFIX.length)]) entries.push({ key: key, text: prevS.rows[key].text });
    });
    out.sar = sarDocFillMany_({ username: SARDOC_DRAFT_PREFIX + prevS.fy }, fy, SARDOC_SAR, entries);
    out.sarFrom = prevS.fy;
  }
  var prevC = sarDocPreviousWithData_(sheet, fy, SARDOC_CLT, function() { return true; });
  if (prevC) {
    var ids = {}, items = [];
    cltKpis_(fy).forEach(function(k) { ids[k.id] = true; });
    Object.keys(prevC.rows).forEach(function(key) {
      if (!prevC.rows[key].text || cltCheckKey_(key, ids).error) return;
      var text = cltCarryText_(key, prevC.rows[key].text, ids);
      if (text) items.push({ key: key, text: text });
    });
    out.clt = sarDocFillMany_({ username: SARDOC_DRAFT_PREFIX + prevC.fy }, fy, SARDOC_CLT, items);
    out.cltFrom = prevC.fy;
  }
  return out;
}

/** admin กดปุ่ม: ดึงข้อความ SAR + CLT ทั้งเล่มจากปีงบก่อนหน้ามาเป็นร่างของปีงบ fy (กดซ้ำได้ — เติมเฉพาะที่ยังว่าง) */
function carryOverDocsFromPrevious(token, fy) {
  var lock = null;
  try {
    var user = requireUser_(token);
    if (user.tier !== "admin") return { success: false, message: "เฉพาะผู้ดูแลระบบ (admin) เท่านั้น" };
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var res = carryOverDocs_(fy);
    if (res.sar + res.clt > 0) {
      touchUser_(user, "edit");
      if (res.sar > 0) bumpDataVersion_(fy, [], user, SARDOC_SAR);
      if (res.clt > 0) bumpDataVersion_(fy, [], user, SARDOC_CLT);
    }
    var msg;
    if (!res.sarFrom && !res.cltFrom) msg = "ยังไม่มีข้อความ SAR / CLT ของปีงบก่อนหน้าให้ดึง";
    else if (res.sar + res.clt === 0) msg = "ไม่มีรายการที่ต้องดึง (ปีงบนี้กรอกไว้แล้วทั้งหมด)";
    else msg = "ดึงจากปีงบก่อนหน้าแล้ว: SAR " + res.sar + " ตัวชี้วัด" + (res.sarFrom ? " (จากปีงบ " + res.sarFrom + ")" : "") + " · CLT " + res.clt + " หัวข้อ" + (res.cltFrom ? " (จากปีงบ " + res.cltFrom + ")" : "") + " — เป็นร่าง ตรวจและแก้ไขก่อนส่ง";
    return { success: true, sar: res.sar, clt: res.clt, sarFrom: res.sarFrom, cltFrom: res.cltFrom, message: msg };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** ยืนยันว่าตรวจร่างที่ลอกมาแล้ว (ใช้ข้อความเดิม): ป้ายร่างหาย — ต้องมีสิทธิ์แก้หัวข้อนั้น */
function confirmDocDraft(token, fy, doc, key) {
  var lock = null;
  try {
    var user = doc === SARDOC_CLT ? requireCltUser_(token) : requireDocUser_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    key = (key || "").toString();
    if (doc === SARDOC_SAR) {
      var id = key.slice(SARDOC_PDCA_PREFIX.length);
      if (key.indexOf(SARDOC_PDCA_PREFIX) !== 0 || !sarVisibleKpis_(user, fy)[id]) return { success: false, message: "ไม่มีสิทธิ์แก้ไขตัวชี้วัดนี้ในปีงบ " + fy };
    } else if (doc === SARDOC_CLT) {
      var ids = {};
      if (/^(DIM\||D\|[^|]*\|R\|)/.test(key)) cltKpis_(fy).forEach(function(k) { ids[k.id] = true; });
      if (cltCheckKey_(key, ids).error) return { success: false, message: "กุญแจข้อความ CLT ไม่ถูกต้อง" };
      if (CLT_ADMIN_KEYS_.indexOf(key) !== -1 && user.tier !== "admin") return { success: false, message: "เฉพาะผู้ดูแลระบบ (admin)" };
    } else {
      return { success: false, message: "ชนิดเอกสารไม่ถูกต้อง" };
    }
    var sheet = sarDocSheetIfAny_(), cur = sarDocRead_(sheet, fy, doc)[key];
    if (!cur || !sarDocIsDraftBy_(cur.by)) return { success: true, changed: false, item: cur ? { text: cur.text, rev: cur.rev, at: cur.at, by: cur.by } : null };
    var stamp = nowStamp_(), rev = cur.rev + 1;
    sheet.getRange(cur.row, 5, 1, 3).setValues([[rev, stamp, user.username]]);
    touchUser_(user, "edit");
    bumpDataVersion_(fy, [], user, doc);
    return { success: true, changed: true, item: { text: cur.text, rev: rev, at: stamp, by: user.username } };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}
