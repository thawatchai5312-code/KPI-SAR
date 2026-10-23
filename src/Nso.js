/**
 * นำเข้า / อัปเดตตัวชี้วัดของฝ่ายการพยาบาล (NSO) จากไฟล์เดิม (NURSING_SPREADSHEET_URL) เข้าชีตปีงบ 2569
 *
 * หลักการ
 *  - ตัวชี้วัดโรงพยาบาล (Part I–IV / SAR) คงเดิม ตัวที่เป็นตัวเดียวกับ NSO (ตามตาราง NSO_MATCH ใน NsoMatch.js) รวมข้อมูลเข้าตัวเดิม ส่วนตัวที่ไม่ซ้ำเพิ่มเป็นตัวใหม่ รหัส "NURSE-<รหัสต้นทาง>"
 *  - ทุกตัวเป็นของหน่วยงานนั้น + NSO · ตัวที่ Part ลงท้าย QA = ระดับ QA-หน่วยงาน · มีผู้รับผิดชอบ = รายบุคคล · มีหน่วยงาน = หน่วยงาน
 *  - รันซ้ำได้ (อัปเดต): เทียบรายตัวชี้วัด รายช่อง กับสำเนาต้นทางที่นำเข้าครั้งก่อน (ชีตซ่อน NSO_Sync)
 *      ต้นทางเปลี่ยน/ฝั่งนี้ไม่เปลี่ยน → ใช้ของต้นทาง · ต้นทางไม่เปลี่ยน → คงของเรา · เปลี่ยนทั้งสองฝั่งช่องเดียวกัน → ต้นทาง NSO ชนะ (ช่วงเปลี่ยนผ่าน) และแจ้งเป็นรายการขัดแย้ง
 *  - ผลลัพธ์ปีงบ 2569 ลงชีตปีงบ 2569 · ตัวชี้วัดใหม่/นิยามที่ยังไม่ถูกแก้ ถูกคัดลอกไปชีตปีงบ 2570 ด้วย (ผลรายปีเลื่อนปีให้)
 */

var NSO_SYNC_SHEET = "NSO_Sync";
var NSO_IMPORT_FY = 2569;
var NSO_UNIT = "NSO";
var NSO_IMPORTER = "นำเข้าจาก NSO";
var NSO_BACKUP_FLAG = "NSO_IMPORT_BACKUP_V1";
var NSO_OWNER_LEVEL_FLAG = "OWNER_LEVEL_V1";
var NSO_FIELDS = ["target", "details", "dataSource", "owner"];

// ชื่อหน่วยงาน/ผู้รับผิดชอบในไฟล์ NSO ที่เขียนไม่เหมือนระบบนี้
var NSO_DEPT_FIX = [
  [/ทุกหน่วยงานการพยาบาล[^\/\s,]*/g, "NSO"], [/งานห้องคลอด/g, "LR"], [/งานป้องกันและควบคุมการติดเชื้อในโรงพยาบาล/g, "IC"],
  [/\bICN\b/g, "IC"], [/\bER\s+v\b/gi, "ER"]
];
var NSO_OWNER_FIX = { "ชฏาพร": "ชฎาพร", "ชฏพร": "ชฎาพร" };
// คำในช่องผู้รับผิดชอบที่ไม่ใช่ชื่อคน (ชื่อทีม/หน่วย) — ไม่นำมาเป็นผู้รับผิดชอบ
var NSO_NOT_PERSON = /^(ทีม|หอ|หน่วย|จ่าย|งาน|ห้อง|กลุ่ม|คณะ|ฝ่าย)/;

// ---------------------------------------------------------------- ตัวช่วย

function nsoNorm_(s) {
  var t = (s === null || s === undefined ? "" : s).toString();
  try { t = t.normalize("NFKC"); } catch (e) {}
  t = t.toLowerCase().replace(/[\s​]+/g, "").replace(/[.,\-_()%\/:;"'\[\]]/g, "");
  return t.replace(/^[0-9๐-๙]+/, "");
}

/** Part ของ NSO → หน่วยงาน (ตัด "QA"/"TTM-QA" ออก) */
function nsoUnitOfPart_(part) {
  var p = (part || "").toString().trim();
  var isQa = /QA/i.test(p);
  var unit = p.replace(/TTM-QA/gi, "").replace(/\bQA\b/gi, "").replace(/\s+/g, " ").trim();
  if (/ภาพรวม/.test(unit) || unit === "") unit = NSO_UNIT;
  unit = parseDepts_(unit)[0] || unit; // แผนไทย ฯลฯ ตาม alias ของระบบ
  return { unit: unit, isQa: isQa };
}

function nsoDeptTokens_(text) {
  var t = (text || "").toString();
  NSO_DEPT_FIX.forEach(function(f) { t = t.replace(f[0], f[1]); });
  return parseDepts_(t).filter(function(d) { return d.length > 1; });
}

function nsoOwnerNames_(text) {
  var out = [];
  (text || "").toString().split("/").forEach(function(part) {
    var first = part.replace(/[\u200b\u200c\u200d]/g, "").trim().split(/\s+/)[0];
    if (!first || !/^[ก-๙]{2,}$/.test(first) || NSO_NOT_PERSON.test(first)) return; // เฉพาะชื่อไทยล้วน (ไม่รวมตัวเลข/อังกฤษ/วงเล็บ/ชื่อทีม)
    first = NSO_OWNER_FIX[first] || first;
    if (first.indexOf(HEAD_WARD_TOKEN) === 0) { if (out.indexOf(HEAD_WARD_TOKEN) === -1) out.push(HEAD_WARD_TOKEN); return; } // "หัวหน้าตึก…" = head ขึ้นไปที่สังกัด NSO
    parseOwners_(first).forEach(function(n) { if (out.indexOf(n) === -1) out.push(n); });
  });
  return out;
}

function nsoStr_(v) { return v === null || v === undefined ? "" : v.toString().trim(); }

/** ข้อความบอกว่าเป็นตัวย่อยของตัวชี้วัด รพ. ตัวไหน (ตามตาราง NSO_MATCH ชนิด U) */
function nsoSubNote_(sourceId) {
  var mt = NSO_MATCH[sourceId];
  if (!mt || mt[1] !== "U") return "";
  return "ตัวย่อยของตัวชี้วัด รพ. (SAR): " + (NSO_MATCH_NAMES[mt[0]] || "") + " [" + mt[0].replace(/^KPI-0*/, "KPI-") + "]";
}

/** แถวต้นทาง → ข้อมูลมาตรฐานที่จะใช้ในระบบนี้ (ไม่มีรหัสหรือชื่อ = แถวหัวข้อ ข้าม) */
function nsoMapRow_(row) {
  var id = nsoStr_(row[0]), fullName = nsoStr_(row[4]);
  if (!id || !fullName) return null;
  // ช่องชื่อในไฟล์ NSO มักมีนิยามต่อท้ายหลายบรรทัด: ชื่อ = บรรทัดแรก ส่วนที่เหลือย้ายไปรายละเอียด
  var lines = fullName.split(/\r?\n/).map(function(x) { return x.trim(); }).filter(Boolean);
  var name = lines[0], extraDetail = lines.slice(1).join("\n");
  var partLabel = nsoStr_(row[2]);
  var up = nsoUnitOfPart_(partLabel);
  var owners = nsoOwnerNames_(row[25]);
  var tokens = nsoDeptTokens_(row[26]);
  var depts = [up.unit];
  tokens.forEach(function(d) { if (depts.indexOf(d) === -1) depts.push(d); });
  if (depts.indexOf(NSO_UNIT) === -1) depts.push(NSO_UNIT);
  var levels = ["หน่วยงาน"];
  if (up.isQa) levels.push("QA-หน่วยงาน");
  if (owners.length > 0) levels.push("รายบุคคล");
  levels = sortLevels_(levels);
  var category = nsoStr_(row[3]) || partLabel || "ทั่วไป";
  var cats = [{ part: up.unit, category: category }];
  // NSO เป็นสังกัดซ้อน: ตัวชี้วัดของหอผู้ป่วยอยู่ในหมวดของหอนั้น ไม่ต้องมีหมวด NSO ซ้ำ (เหลือหมวด NSO เฉพาะตัวของฝ่าย)
  depts.forEach(function(d) { if (d !== up.unit && d !== NSO_UNIT) cats.push({ part: d, category: UNIT_CATS_PLACEHOLDER }); });
  var years = [], months = [];
  for (var i = 0; i < 5; i++) years.push(cleanValue_(row[6 + i]));
  for (var m = 0; m < 12; m++) months.push(cleanValue_(row[11 + m]));
  return {
    sourceId: id, name: name, partLabel: partLabel, unit: up.unit, isQa: up.isQa,
    target: nsoStr_(row[5]), years: years, months: months,
    details: [nsoSubNote_(id), extraDetail, nsoStr_(row[23])].filter(Boolean).join("\n\n"), dataSource: nsoStr_(row[24]),
    owner: owners.join(" / "), ownerRaw: nsoStr_(row[25]), owners: owners, depts: depts, levels: levels, cats: cats
  };
}

function nsoSnapshotOf_(m) {
  return { target: m.target, years: m.years, months: m.months, details: m.details, dataSource: m.dataSource, owner: m.owner };
}

function nsoSameValue_(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }

/** "ความใหม่" ของผลรายเดือน: เดือนล่าสุดที่กรอก (ลำดับปีงบ) แล้วจำนวนเดือนที่กรอก แล้วจำนวนปีที่กรอก */
function nsoFreshness_(years, months) {
  var last = -1, cnt = 0, y = 0, i;
  for (i = 0; i < 12; i++) if (months[i] !== null && months[i] !== undefined) { last = i; cnt++; }
  for (i = 0; i < 5; i++) if (years[i] !== null && years[i] !== undefined) y++;
  return [last, cnt, y];
}

/** 1 = ต้นทาง NSO ใหม่กว่า, -1 = ของเราใหม่กว่า, 0 = เท่ากัน (ใช้ของเรา) */
function nsoCompareFresh_(srcYears, srcMonths, ourYears, ourMonths) {
  var a = nsoFreshness_(srcYears, srcMonths), b = nsoFreshness_(ourYears, ourMonths);
  for (var i = 0; i < 3; i++) { if (a[i] > b[i]) return 1; if (a[i] < b[i]) return -1; }
  return 0;
}

function nsoReadSource_() {
  var ss = SpreadsheetApp.openByUrl(NURSING_SPREADSHEET_URL);
  var sheet = ss.getSheetByName(NURSING_DATABASE_SHEET_NAME);
  if (!sheet) throw new Error("ไม่พบชีต " + NURSING_DATABASE_SHEET_NAME + " ในไฟล์ฝ่ายการพยาบาล");
  var last = sheet.getLastRow();
  if (last < 2) return { mapped: [], skipped: 0 };
  var values = sheet.getRange(2, 1, last - 1, 27).getValues();
  var mapped = [], skipped = 0, seen = {};
  values.forEach(function(row) {
    var m = nsoMapRow_(row);
    if (!m) { if (nsoStr_(row[4])) skipped++; return; }
    if (seen[m.sourceId]) return;
    seen[m.sourceId] = true;
    mapped.push(m);
  });
  return { mapped: mapped, skipped: skipped };
}

// ---------------------------------------------------------------- ชีตสำเนาต้นทาง (NSO_Sync)

function nsoReadSync_() {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var sheet = ss.getSheetByName(NSO_SYNC_SHEET);
  var map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues().forEach(function(r) {
    if (!r[0]) return;
    var snap = null;
    try { snap = JSON.parse(r[2]); } catch (e) {}
    map[r[0].toString()] = { ourId: r[1].toString(), snap: snap, syncedAt: r[3] ? r[3].toString() : "" };
  });
  return map;
}

function nsoWriteSync_(map) {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var sheet = ss.getSheetByName(NSO_SYNC_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(NSO_SYNC_SHEET);
    sheet.getRange(1, 1, 1, 5).setValues([["รหัสต้นทาง NSO", "รหัสในระบบนี้", "สำเนาต้นทาง (JSON)", "ซิงค์ล่าสุด", "ปีงบ"]]).setFontWeight("bold");
    sheet.hideSheet();
  }
  var keys = Object.keys(map);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
  if (keys.length === 0) return;
  ensureColumns_(sheet, 5);
  if (sheet.getMaxRows() < keys.length + 1) sheet.insertRowsAfter(sheet.getMaxRows(), keys.length + 1 - sheet.getMaxRows());
  var out = keys.map(function(k) { return [k, map[k].ourId, JSON.stringify(map[k].snap), map[k].syncedAt, NSO_IMPORT_FY]; });
  sheet.getRange(2, 1, out.length, 5).setNumberFormat("@").setValues(out);
}

// ---------------------------------------------------------------- แผนการนำเข้า (ใช้ร่วมกันทั้งตัวอย่างและนำเข้าจริง)

function nsoNewRow_(m, years, months, fyShift) {
  // 37 คอลัมน์ตามโครงสร้างชีตปีงบ
  var y = fyShift ? [m.years[1], m.years[2], m.years[3], m.years[4], null] : m.years;
  var mo = fyShift ? Array(12).fill(null) : m.months;
  var id = NURSING_SYNC_ID_PREFIX + m.sourceId;
  var row = [id, "", m.cats[0].part, m.cats[0].category, m.name, m.target];
  y.forEach(function(v) { row.push(v === null || v === undefined ? "" : v); });
  mo.forEach(function(v) { row.push(v === null || v === undefined ? "" : v); });
  row.push(m.details, m.dataSource, m.owner, m.depts.join(" / "), m.sourceId, m.levels.join(", "));
  // ลงเวลา: แก้ไขล่าสุด = ตอนนำเข้า
  row.push(nowStamp_(), NSO_IMPORTER, "", "", DEFAULT_SUMMARY_METHOD, "", DEFAULT_FREQUENCY, formatExtraCats_(m.cats.slice(1)));
  return row;
}

function nsoRowIndex_(rows) {
  var byId = {}, byLink = {};
  rows.forEach(function(r, i) {
    var id = nsoStr_(r[0]);
    if (!id) return;
    byId[id] = i;
    var link = nsoStr_(r[27]);
    if (link) byLink[link] = i;
  });
  return { byId: byId, byLink: byLink };
}

/**
 * คำนวณแผน: ตัวไหนเพิ่มใหม่ / รวมเข้าตัวเดิม / อัปเดต / ไม่เปลี่ยน / ขัดแย้ง / ไม่แน่ใจ ไม่เขียนข้อมูลใดๆ
 * ret.ops = รายการที่ต้องเขียนจริง
 */
function nsoPlan_() {
  var src = nsoReadSource_();
  var sheet = getFiscalSheet_(NSO_IMPORT_FY);
  if (!sheet) throw new Error("ไม่พบชีตปีงบ " + NSO_IMPORT_FY);
  ensureColumns_(sheet, EXTRA_CATS_COL);
  var last = sheet.getLastRow();
  var rows = last >= 2 ? sheet.getRange(2, 1, last - 1, EXTRA_CATS_COL).getValues() : [];
  var idx = nsoRowIndex_(rows);
  var sync = nsoReadSync_();
  var users = {};
  var usersSheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(USERS_SHEET_NAME);
  (usersSheet ? readUsers_(usersSheet) : []).forEach(function(u) { users[u.username] = true; });

  var plan = { ops: [], counts: { source: src.mapped.length, headings: src.skipped, added: 0, merged: 0, updated: 0, unchanged: 0, conflicts: 0, ambiguous: 0, similar: 0, deletedLocally: 0 },
    added: [], merged: [], updated: [], conflicts: [], ambiguous: [], similar: [], unknownOwners: {}, deletedLocally: [] };

  src.mapped.forEach(function(m) {
    m.owners.forEach(function(n) { if (!users[n] && !OWNER_SKIP.hasOwnProperty(n)) plan.unknownOwners[n] = (plan.unknownOwners[n] || 0) + 1; });
    var link = sync[m.sourceId];
    var rowIdx;
    if (link) rowIdx = idx.byId[link.ourId];
    else if (idx.byLink[m.sourceId] !== undefined) rowIdx = idx.byLink[m.sourceId];
    else if (idx.byId[NURSING_SYNC_ID_PREFIX + m.sourceId] !== undefined) rowIdx = idx.byId[NURSING_SYNC_ID_PREFIX + m.sourceId];

    if (link && rowIdx === undefined) { // ผู้ดูแลลบตัวนี้ออกจากระบบแล้ว ไม่นำกลับมา
      plan.counts.deletedLocally++; if (plan.deletedLocally.length < 40) plan.deletedLocally.push(m.name);
      return;
    }

    if (rowIdx === undefined) {
      // ไม่เคยนำเข้า: ดูตารางจับคู่ (NSO_MATCH) ชนิด S = ตัวเดียวกับตัวชี้วัด รพ. → รวมเข้าตัวนั้น
      var mt = NSO_MATCH[m.sourceId];
      if (mt && mt[1] === "S") {
        var hi = idx.byId[mt[0]];
        var taken = hi !== undefined && nsoStr_(rows[hi][27]) && nsoStr_(rows[hi][27]) !== m.sourceId;
        if (hi !== undefined && !taken) {
          plan.ops.push({ type: "merge", m: m, rowIdx: hi });
          plan.counts.merged++;
          plan.merged.push({ name: m.name, ourId: mt[0], part: m.partLabel });
          return;
        }
        plan.counts.ambiguous++; // ตัวชี้วัด รพ. ถูกลบ หรือผูกกับต้นทางอื่นแล้ว → นำเข้าเป็นตัวใหม่แทน
        if (plan.ambiguous.length < 40) plan.ambiguous.push({ name: m.name, part: m.partLabel, with: mt[0] });
      } else if (mt) {
        plan.counts.similar++; // ตัวย่อยของหน่วย: นำเข้าแยก (ระบุตัวชี้วัด รพ. ที่เกี่ยวข้องในรายละเอียด)
        if (plan.similar.length < 40) plan.similar.push({ name: m.name, part: m.partLabel, like: NSO_MATCH_NAMES[mt[0]] || "", ourId: mt[0] });
      }
      plan.ops.push({ type: "add", m: m });
      plan.counts.added++;
      if (plan.added.length < 40) plan.added.push({ name: m.name, part: m.partLabel, levels: m.levels.join(", ") });
      return;
    }

    // เคยผูกแล้ว (หรือผูกด้วยชื่อที่เคยตรวจแล้ว): เทียบรายช่องกับสำเนาต้นทางครั้งก่อน
    var base = link && link.snap ? link.snap : null;
    plan.ops.push({ type: "update", m: m, rowIdx: rowIdx, base: base, syncedAt: link ? link.syncedAt : "" });
  });
  plan.rows = rows;
  plan.sheet = sheet;
  plan.sync = sync;
  return plan;
}

/** ค่าที่ต้องเขียนในแถวของเรา (อัปเดตตามต้นทาง) */
function nsoApplyUpdate_(row, op, report) {
  var m = op.m, base = op.base, changed = false, conflict = false;
  var setIfSource = function(label, ours, srcVal, baseVal, apply) {
    if (baseVal !== undefined && nsoSameValue_(srcVal, baseVal)) return;      // ต้นทางไม่เปลี่ยน → คงของเรา
    if (nsoSameValue_(ours, srcVal)) return;                                   // เหมือนกันอยู่แล้ว
    if (baseVal !== undefined && !nsoSameValue_(ours, baseVal)) conflict = true; // เปลี่ยนทั้งสองฝั่ง → ต้นทางชนะ
    apply(srcVal);
    changed = true;
  };
  var cur = { years: [], months: [] };
  for (var i = 0; i < 5; i++) cur.years.push(cleanValue_(row[6 + i]));
  for (i = 0; i < 12; i++) cur.months.push(cleanValue_(row[11 + i]));
  var yearChanges = [];
  if (!base) {
    // ยังไม่เคยมีสำเนา (ผูกด้วยวิธีอื่น): ใช้ฝั่งที่ผลใหม่กว่า แล้วเติมช่องว่างจากอีกฝั่ง
    var srcNewer = nsoCompareFresh_(m.years, m.months, cur.years, cur.months) > 0;
    for (i = 0; i < 5; i++) {
      var v = srcNewer ? (m.years[i] !== null ? m.years[i] : cur.years[i]) : (cur.years[i] !== null ? cur.years[i] : m.years[i]);
      if (!nsoSameValue_(v, cur.years[i])) { row[6 + i] = v === null ? "" : v; yearChanges.push({ i: i, value: v }); changed = true; }
    }
    for (i = 0; i < 12; i++) {
      var mv = srcNewer ? (m.months[i] !== null ? m.months[i] : cur.months[i]) : (cur.months[i] !== null ? cur.months[i] : m.months[i]);
      if (!nsoSameValue_(mv, cur.months[i])) { row[11 + i] = mv === null ? "" : mv; changed = true; }
    }
    var txt = [[5, "target", m.target], [23, "details", m.details], [24, "dataSource", m.dataSource]];
    txt.forEach(function(t) {
      var o = nsoStr_(row[t[0]]), v2 = srcNewer ? (t[2] || o) : (o || t[2]);
      if (v2 !== o) { row[t[0]] = v2; changed = true; }
    });
    if (m.owner) { var merged = parseOwners_(row[25]).slice(); m.owners.forEach(function(n) { if (merged.indexOf(n) === -1) merged.push(n); }); var mo = merged.join(" / "); if (mo !== nsoStr_(row[25])) { row[25] = mo; changed = true; } }
  } else {
    for (i = 0; i < 5; i++) {
      (function(k) {
        setIfSource("years" + k, cur.years[k], m.years[k], base.years ? base.years[k] : null, function(v) { row[6 + k] = v === null ? "" : v; yearChanges.push({ i: k, value: v }); });
      })(i);
    }
    for (i = 0; i < 12; i++) {
      (function(k) {
        setIfSource("months" + k, cur.months[k], m.months[k], base.months ? base.months[k] : null, function(v) { row[11 + k] = v === null ? "" : v; });
      })(i);
    }
    setIfSource("target", nsoStr_(row[5]), m.target, base.target, function(v) { row[5] = v; });
    setIfSource("details", nsoStr_(row[23]), m.details, base.details, function(v) { row[23] = v; });
    setIfSource("dataSource", nsoStr_(row[24]), m.dataSource, base.dataSource, function(v) { row[24] = v; });
    setIfSource("owner", parseOwners_(row[25]).join(" / "), m.owner, base.owner, function(v) { row[25] = v; });
  }
  // ระดับ/หน่วยงาน/หมวด: เพิ่มส่วนที่ขาด (ไม่ลบของเดิม)
  var levels = normalizeLevels_(row[LEVEL_COLUMN - 1]);
  m.levels.forEach(function(l) { if (levels.indexOf(l) === -1) levels.push(l); });
  levels = sortLevels_(levels);
  if (levels.join(", ") !== nsoStr_(row[LEVEL_COLUMN - 1])) { row[LEVEL_COLUMN - 1] = levels.join(", "); changed = true; }
  var oldDepts = parseDepts_(row[26]), depts = oldDepts.slice();
  m.depts.forEach(function(d) { if (depts.indexOf(d) === -1) depts.push(d); });
  var deptText = depts.join(" / ");
  if (depts.length !== oldDepts.length) { row[26] = oldDepts.length ? nsoStr_(row[26]) + " / " + depts.slice(oldDepts.length).join(" / ") : deptText; changed = true; }
  var cats = kpiCats_({ cats: [{ part: nsoStr_(row[2]) || "ทั่วไป", category: nsoStr_(row[3]) || "ทั่วไป" }].concat(parseExtraCats_(row[EXTRA_CATS_COL - 1])) });
  var before = cats.map(catKey_).join("\n");
  // ตัวที่เคยนำเข้าแล้ว (มีสำเนาต้นทาง) ไม่เติมหมวดต้นทางกลับ — หมวดถูกจัดระเบียบเป็น 5 มิติแล้ว (ดู Tidy.js)
  if (!base) m.cats.forEach(function(c) { if (!cats.some(function(x) { return catKey_(x) === catKey_(c); })) cats.push(c); });
  if (cats.map(catKey_).join("\n") !== before) {
    // หมวดหน่วยงานที่มีหมวดย่อยจริงอยู่แล้ว ไม่ต้องมี "รอจัดหมวดย่อย" ซ้ำ
    cats = cats.filter(function(c) { return !(c.category === UNIT_CATS_PLACEHOLDER && cats.some(function(x) { return x.part === c.part && x.category !== UNIT_CATS_PLACEHOLDER; })); });
    row[EXTRA_CATS_COL - 1] = formatExtraCats_(cats.slice(1));
    changed = true;
  }
  if (!nsoStr_(row[27])) { row[27] = m.sourceId; changed = true; }
  if (changed) { row[STAMP_EDIT_AT_COL - 1] = nowStamp_(); row[STAMP_EDIT_BY_COL - 1] = NSO_IMPORTER; }
  return { changed: changed, conflict: conflict, yearChanges: yearChanges };
}

// ---------------------------------------------------------------- ตัวอย่าง / นำเข้าจริง (เฉพาะ admin)

function nsoSummary_(plan) {
  return { counts: plan.counts, added: plan.added, merged: plan.merged, ambiguous: plan.ambiguous, similar: plan.similar, conflicts: plan.conflicts, updated: plan.updated,
    deletedLocally: plan.deletedLocally, unknownOwners: Object.keys(plan.unknownOwners).sort().map(function(n) { return { name: n, count: plan.unknownOwners[n] }; }) };
}

/** นับผลของการอัปเดต (ไม่เขียน) เพื่อแสดงในตัวอย่าง */
function nsoDryUpdates_(plan) {
  plan.ops.forEach(function(op) {
    if (op.type !== "update" && op.type !== "merge") return;
    var row = plan.rows[op.rowIdx].slice();
    var res = nsoApplyUpdate_(row, { m: op.m, base: op.base || null }, null);
    op.result = res;
    if (op.type === "update") {
      if (res.conflict) { plan.counts.conflicts++; if (plan.conflicts.length < 40) plan.conflicts.push({ name: op.m.name, id: nsoStr_(row[0]) }); }
      if (res.changed) { plan.counts.updated++; if (plan.updated.length < 40) plan.updated.push({ name: op.m.name, id: nsoStr_(row[0]) }); } else plan.counts.unchanged++;
    }
  });
}

function nsoImportPreview(token) {
  try {
    requireAdmin_(token);
    var plan = nsoPlan_();
    nsoDryUpdates_(plan);
    return { success: true, preview: nsoSummary_(plan) };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

function nsoImportCommit(token) {
  var lock = null;
  try {
    var admin = requireAdmin_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var plan = nsoPlan_();
    nsoDryUpdates_(plan);
    var sheet = plan.sheet, rows = plan.rows;
    var props = PropertiesService.getScriptProperties();
    var stamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");

    // สำเนาสำรองครั้งแรก (ชีตซ่อน)
    if (!props.getProperty(NSO_BACKUP_FLAG)) {
      listFiscalYears_().forEach(function(fy) {
        var b = getFiscalSheet_(fy).copyTo(ss);
        b.setName("สำรองก่อนนำเข้า NSO " + fiscalSheetName_(fy) + " " + stamp);
        b.hideSheet();
      });
      props.setProperty(NSO_BACKUP_FLAG, stamp);
    }

    var sheet70 = getFiscalSheet_(NSO_IMPORT_FY + 1);
    if (sheet70) ensureColumns_(sheet70, EXTRA_CATS_COL);
    var rows70 = sheet70 && sheet70.getLastRow() >= 2 ? sheet70.getRange(2, 1, sheet70.getLastRow() - 1, EXTRA_CATS_COL).getValues() : [];
    var idx70 = nsoRowIndex_(rows70);

    var newRows = [], newRows70 = [], syncNow = nowStamp_(), annual = [];
    var updates = [], updates70 = [];
    plan.ops.forEach(function(op) {
      var m = op.m;
      if (op.type === "add") {
        var r = nsoNewRow_(m, null, null, false);
        r[1] = rows.length + newRows.length + 1;
        newRows.push(r);
        plan.sync[m.sourceId] = { ourId: r[0], snap: nsoSnapshotOf_(m), syncedAt: syncNow };
        if (sheet70 && idx70.byId[r[0]] === undefined) { var r70 = nsoNewRow_(m, null, null, true); r70[1] = rows70.length + newRows70.length + 1; newRows70.push(r70); }
        return;
      }
      var row = rows[op.rowIdx];
      var before = row.slice();
      var res = nsoApplyUpdate_(row, { m: m, base: op.base || null }, null);
      var id = nsoStr_(row[0]);
      plan.sync[m.sourceId] = { ourId: id, snap: nsoSnapshotOf_(m), syncedAt: syncNow };
      if (!res.changed) return;
      updates.push({ rowIdx: op.rowIdx, row: row });
      res.yearChanges.forEach(function(c) { annual.push({ id: id, year: NSO_IMPORT_FY - 4 + c.i, value: c.value, skipFy: NSO_IMPORT_FY }); });
      // ชีตปีงบถัดไป: เติมนิยามเฉพาะแถวที่ยังเป็นสำเนาที่ไม่ถูกแก้ (ค่าเดียวกับปีงบ 2569 ก่อนอัปเดต)
      if (sheet70 && idx70.byId[id] !== undefined) {
        var i70 = idx70.byId[id], r70u = rows70[i70], touched = false;
        [[5, "target"], [23, "details"], [24, "dataSource"], [25, "owner"]].forEach(function(f) {
          var c = f[0];
          if (nsoStr_(r70u[c]) === nsoStr_(before[c]) && nsoStr_(row[c]) !== nsoStr_(before[c])) { r70u[c] = row[c]; touched = true; }
        });
        [[26, "dept"], [LEVEL_COLUMN - 1, "levels"], [EXTRA_CATS_COL - 1, "cats"], [27, "link"]].forEach(function(f) {
          if (nsoStr_(row[f[0]]) !== nsoStr_(before[f[0]]) && nsoStr_(r70u[f[0]]) === nsoStr_(before[f[0]])) { r70u[f[0]] = row[f[0]]; touched = true; }
        });
        if (touched) updates70.push({ rowIdx: i70, row: r70u });
      }
    });

    // เขียนจริง (เป็นชุด)
    updates.forEach(function(u) { sheet.getRange(u.rowIdx + 2, 1, 1, EXTRA_CATS_COL).setValues([u.row]); });
    if (newRows.length > 0) {
      var start = rows.length + 2;
      if (sheet.getMaxRows() < start + newRows.length) sheet.insertRowsAfter(sheet.getMaxRows(), start + newRows.length - sheet.getMaxRows());
      sheet.getRange(start, 1, newRows.length, EXTRA_CATS_COL).setValues(newRows);
      sheet.getRange(start, EXTRA_CATS_COL, newRows.length, 1).setNumberFormat("@");
    }
    if (sheet70) {
      updates70.forEach(function(u) { sheet70.getRange(u.rowIdx + 2, 1, 1, EXTRA_CATS_COL).setValues([u.row]); });
      if (newRows70.length > 0) {
        var start70 = rows70.length + 2;
        if (sheet70.getMaxRows() < start70 + newRows70.length) sheet70.insertRowsAfter(sheet70.getMaxRows(), start70 + newRows70.length - sheet70.getMaxRows());
        sheet70.getRange(start70, 1, newRows70.length, EXTRA_CATS_COL).setValues(newRows70);
        sheet70.getRange(start70, EXTRA_CATS_COL, newRows70.length, 1).setNumberFormat("@");
      }
    }
    // หัวคอลัมน์หมวดเพิ่มเติม
    [sheet, sheet70].forEach(function(sh) {
      if (sh && !sh.getRange(1, EXTRA_CATS_COL).getValue()) sh.getRange(1, EXTRA_CATS_COL).setValue(EXTRA_CATS_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
    });
    propagateAnnual_(annual);
    nsoWriteSync_(plan.sync);
    SpreadsheetApp.flush();
    var tidied = tidyApply_(tidyPlanAll_(), { backup: true, users: false }); // ตัวที่เพิ่ง/รวมเข้ามาใหม่: ตัดเลข จัดหมวด 5 มิติ หาตัวแม่ ฯลฯ ตามกติกาเดียวกับ "จัดระเบียบข้อมูล"
    touchUser_(admin, "edit");
    return { success: true, message: "นำเข้า/อัปเดตเรียบร้อย", result: nsoSummary_(plan), wrote: { added: newRows.length, updated: updates.length, mirrored2570New: newRows70.length, mirrored2570Updated: updates70.length, tidied: tidied.logRows } };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ---------------------------------------------------------------- ระดับ "รายบุคคล" ให้ตัวชี้วัดเดิมที่มีผู้รับผิดชอบ (ทำครั้งเดียว)

function migrateOwnerLevels_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(NSO_OWNER_LEVEL_FLAG)) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (props.getProperty(NSO_OWNER_LEVEL_FLAG)) return;
    listFiscalYears_().forEach(function(fy) {
      var sheet = getFiscalSheet_(fy), last = sheet.getLastRow();
      if (last < 2) return;
      var rows = sheet.getRange(2, 1, last - 1, LEVEL_COLUMN).getValues(), out = [], changed = 0;
      rows.forEach(function(r) {
        var cell = r[LEVEL_COLUMN - 1];
        if (!r[0] || parseOwners_(r[25]).length === 0) { out.push([cell]); return; }
        var levels = normalizeLevels_(cell);
        if (levels.indexOf("รายบุคคล") === -1) { levels = sortLevels_(levels.concat(["รายบุคคล"])); changed++; out.push([levels.join(", ")]); } else out.push([cell]);
      });
      if (changed > 0) sheet.getRange(2, LEVEL_COLUMN, out.length, 1).setValues(out);
    });
    props.setProperty(NSO_OWNER_LEVEL_FLAG, Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"));
  } finally {
    lock.releaseLock();
  }
}
