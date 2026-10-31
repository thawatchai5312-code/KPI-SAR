/**
 * 👤 นำเข้าตัวชี้วัดรายบุคคลจาก Google Sheet (admin, ⚙️ ตั้งค่า → 📥 นำเข้าตัวชี้วัด ▾) — แผน/ข้อตกลง: docs/import-personal-plan.md
 *  - ไฟล์: แถวหัวตารางมีคอลัมน์ ตัวชี้วัดรายบุคคล (ชื่อผู้รับผิดชอบ · ชื่อใส่แถวแรกของกลุ่ม) · ตัวชี้วัด · เป้าหมาย · KPI Template · ต.ค.–ก.ย. · หน่วยงาน
 *  - นำเข้าเข้าปีงบปัจจุบันเท่านั้น · ระดับ "รายบุคคล" · หน่วยงานตามไฟล์ · หมวดจัดอัตโนมัติ (เหมือน addIndicator) · KPI Template → ช่อง ที่มา/สูตร
 *  - บัญชีผู้รับผิดชอบ: ชื่อบัญชีในระบบ = ชื่อต้นอย่างเดียว → ตัดคำนำหน้า/นามสกุล · ยังไม่มีบัญชี = สร้าง staff (รหัสตั้งต้น DEFAULT_PASSWORD บังคับเปลี่ยน)
 *    ชื่อต้นชนบัญชีที่มีอยู่ = ให้ admin เลือก (ค่าตั้งต้น: สร้างใหม่ "<ชื่อ><อักษรแรกนามสกุล>.") · พบตัวชี้วัดชื่อเดียวกันของบัญชีนั้นอยู่แล้ว = ถือเป็นคนเดิม (รันซ้ำได้)
 *  - personalImportPreview = ตรวจไฟล์ (ไม่เขียน) · personalImportCommit = เขียนจริง: script lock + สำรองชีตปีงบ/Users + Tidy_Log + bumpDataVersion_
 */

var PIMP_BACKUP_PREFIX = "สำรองก่อนนำเข้ารายบุคคล ";
var PIMP_USERS_BACKUP_PREFIX = "สำรองผู้ใช้ก่อนนำเข้ารายบุคคล ";
var PIMP_MAX_ROWS = 500;
var PIMP_TITLES_RE = /^(นางสาว|น\.\s?ส\.|นส\.|นาง|นาย|ว่าที่\s*ร\.?\s?ต\.?|ด\.\s?ต\.|ส\.\s?ต\.\s?อ\.|จ\.\s?ส\.\s?อ\.|พ\.\s?จ\.\s?อ\.|ดร\.|คุณ)\s*/;
var PIMP_MONTH_HEADS = ["ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."];

/** ชื่อในไฟล์ → { clean (ไม่มีคำนำหน้า), first (ชื่อต้น = ชื่อบัญชี), last (นามสกุล) } */
function pimpSplitName_(full) {
  var t = (full === null || full === undefined ? "" : full).toString().replace(/[ \s]+/g, " ").trim();
  for (var g = 0; g < 3 && PIMP_TITLES_RE.test(t); g++) t = t.replace(PIMP_TITLES_RE, "");
  var parts = t.split(" ").filter(function(x) { return x; });
  return { clean: parts.join(" "), first: parts[0] || "", last: parts.slice(1).join(" ") };
}

/** ตัดเลขข้อนำหน้า ("1. ", "2 ", "3.1) ") ยุบช่องว่าง เลขอารบิก */
function pimpStripNo_(name) {
  return arabicDigits_((name === null || name === undefined ? "" : name).toString()).replace(/[ \s]+/g, " ").replace(/^\s*\d+(\.\d+)*\s*[.)]?\s+/, "").trim();
}

function pimpKey_(name) { return normalizeKpiName_(pimpStripNo_(name)); }

/**
 * เป้าหมายในไฟล์ → รูปแบบระบบ "<เครื่องหมาย> <ตัวเลข>" · คืน { value, original, sure, note }
 * sure = false → หน้าตัวอย่างขึ้น ⚠️ ให้ admin ตรวจ/แก้ (ข้อความยาว · เลขหลายค่า · ช่วง · กำกวม)
 */
function pimpTarget_(text) {
  var orig = arabicDigits_((text === null || text === undefined ? "" : text).toString()).replace(/[ \s]+/g, " ").trim();
  if (!orig) return { value: "", original: "", sure: true, note: "ไม่มีเป้าหมายในไฟล์", empty: true };
  var nums = orig.match(/\d+(?:\.\d+)?/g) || [];
  if (nums.length === 0) return { value: "", original: orig, sure: false, note: "ไม่พบตัวเลขในเป้าหมาย" };
  var distinct = nums.filter(function(n, i) { return nums.indexOf(n) === i; });
  var num = nums[0];
  var op = "";
  var sym = /^\s*(≥|>=|≤|<=|>|<|=)/.exec(orig);
  if (sym) op = sym[1] === ">=" ? "≥" : sym[1] === "<=" ? "≤" : sym[1];
  else if (/^(เป็น\s*)?0(\.0+)?(\D|$)/.test(orig)) { op = "="; num = "0"; }
  else if (/ไม่ต่ำกว่า|ไม่น้อยกว่า|อย่างน้อย|ขึ้นไป|มากกว่าหรือเท่ากับ/.test(orig)) op = "≥";
  else if (/ไม่เกิน|ไม่มากกว่า|น้อยกว่าหรือเท่ากับ/.test(orig)) op = "≤";
  else if (/น้อยกว่า|ต่ำกว่า/.test(orig)) op = "<";
  else if (/มากกว่า/.test(orig)) op = ">";
  else op = "≥";
  var sure = true, note = "";
  if (/^\d+(?:\.\d+)?$/.test(orig) && (num === "0" || num === "1")) { sure = false; note = "ตัวเลข " + num + " ล้วน ทิศไม่ชัด"; }
  if (/\d\s*%?\s*[-–]\s*\d/.test(orig)) { sure = false; note = "เป็นช่วง — ตรวจว่าต้องการค่าไหน"; }
  else if (distinct.length > 1) { sure = false; note = "มีตัวเลขหลายค่า — ตรวจว่าค่าไหนคือเป้า"; }
  if (orig.length > 25 && sure) { sure = false; note = "ข้อความยาว — ตรวจให้ตรงกับที่ต้องการ"; }
  return { value: op + " " + num, original: orig, sure: sure, note: note };
}

/** อ่านไฟล์ต้นทาง → { rows: [{ i, owner, name, target, template, months, unit }] } หรือ throw ข้อความไทย */
function pimpReadSource_(url) {
  url = (url || "").toString().trim();
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url)) throw new Error("ลิงก์ต้องเป็น Google ชีต (ขึ้นต้นด้วย https://docs.google.com/spreadsheets/) — ถ้าเป็นไฟล์ Excel ให้เปิดด้วย Google ชีตแล้วบันทึกเป็น Google ชีตก่อน");
  var ss;
  try { ss = SpreadsheetApp.openByUrl(url); } catch (e) {
    throw new Error("เปิดไฟล์ไม่ได้ — ตรวจว่าเป็น Google ชีต (ไม่ใช่ไฟล์ .xlsx) และแชร์ให้บัญชี Google ที่เป็นเจ้าของสคริปต์แล้ว");
  }
  var sheets = ss.getSheets();
  for (var si = 0; si < sheets.length; si++) {
    var vals = sheets[si].getDataRange().getValues();
    for (var h = 0; h < Math.min(vals.length, 15); h++) {
      var head = vals[h].map(function(c) { return (c === null || c === undefined ? "" : c).toString().replace(/\s+/g, " ").trim(); });
      var cName = head.indexOf("ตัวชี้วัด"), cUnit = head.indexOf("หน่วยงาน"), cTarget = head.indexOf("เป้าหมาย");
      if (cName === -1 || cUnit === -1) continue;
      var cOwner = -1;
      head.forEach(function(c, i) { if (cOwner === -1 && i !== cName && /รายบุคคล|ผู้รับผิดชอบ/.test(c)) cOwner = i; });
      if (cOwner === -1) cOwner = 0;
      var cTpl = -1;
      head.forEach(function(c, i) { if (cTpl === -1 && /template/i.test(c)) cTpl = i; });
      var cMonths = PIMP_MONTH_HEADS.map(function(m) { return head.indexOf(m); });
      var hasMonths = cMonths.every(function(c) { return c !== -1; });
      var rows = [], owner = "";
      for (var r = h + 1; r < vals.length; r++) {
        var row = vals[r];
        var o = (row[cOwner] === null || row[cOwner] === undefined ? "" : row[cOwner]).toString().trim();
        if (o) owner = o;
        var nm = (row[cName] === null || row[cName] === undefined ? "" : row[cName]).toString().trim();
        if (!nm) continue;
        rows.push({
          i: rows.length, owner: owner, name: nm,
          target: cTarget === -1 ? "" : (row[cTarget] === null || row[cTarget] === undefined ? "" : row[cTarget]).toString().trim(),
          template: cTpl === -1 ? "" : (row[cTpl] === null || row[cTpl] === undefined ? "" : row[cTpl]).toString().replace(/\r\n?/g, "\n").trim(),
          months: hasMonths ? cMonths.map(function(c) { return row[c]; }) : null,
          unit: (row[cUnit] === null || row[cUnit] === undefined ? "" : row[cUnit]).toString().replace(/\s+/g, " ").trim()
        });
        if (rows.length > PIMP_MAX_ROWS) throw new Error("ไฟล์มีตัวชี้วัดมากเกิน " + PIMP_MAX_ROWS + " แถว");
      }
      if (rows.length === 0) throw new Error("ไม่พบแถวตัวชี้วัดในไฟล์");
      return { rows: rows };
    }
  }
  throw new Error("ไม่พบหัวตารางที่มีคอลัมน์ \"ตัวชี้วัด\" และ \"หน่วยงาน\" ในไฟล์นี้");
}

/** ชื่อบัญชีใหม่ที่ไม่ชน: ชื่อต้น → ชื่อต้น+อักษรแรกนามสกุล+"." → เพิ่มอักษรทีละตัว → ต่อเลข */
function pimpUniqueName_(first, last, taken) {
  if (!taken[first]) return first;
  var l = (last || "").replace(/\s+/g, "");
  for (var k = 1; k <= l.length; k++) { var c = first + l.slice(0, k) + "."; if (!taken[c]) return c; }
  for (var n = 2; n < 100; n++) { var d = first + n; if (!taken[d]) return d; }
  return first + "x";
}

var PIMP_TARGET_OK_RE = /^(≥|≤|>|<|=)\s?\d+(\.\d+)?$/;

/** วางแผนนำเข้า (ไม่เขียน) — ใช้ร่วมกันโดยตรวจไฟล์/นำเข้าจริง · decisions: { people: { key: { choice } }, targets: { i: "≥ 95" }, skip: [i] } */
function pimpPlan_(url, decisions) {
  decisions = decisions || {};
  var fy = getCurrentFiscalYear_();
  var sheet = getFiscalSheet_(fy);
  if (!sheet) throw new Error("ไม่พบชีตปีงบ " + fy);
  var src = pimpReadSource_(url);
  var usersSheet = ensureUsersSheet_(), users = readUsers_(usersSheet);
  var userBy = {};
  users.forEach(function(u) { userBy[u.username] = u; });
  var data = sheet.getDataRange().getValues();
  var existing = []; // ตัวชี้วัดที่มีอยู่แล้วในปีงบ
  var units = {};
  users.forEach(function(u) { u.depts.forEach(function(d) { units[d] = 1; }); });
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    existing.push({ id: data[r][0].toString().trim(), key: pimpKey_(data[r][4]), owners: parseOwners_(data[r][25]) });
    parseDepts_(data[r][26]).forEach(function(d) { units[d] = 1; });
  }
  // กลุ่มตามคน (ชื่อเต็มที่ตัดคำนำหน้า)
  var people = [], byKey = {};
  src.rows.forEach(function(row) {
    var nm = pimpSplitName_(row.owner);
    if (!nm.first) throw new Error("แถวที่ " + (row.i + 1) + " ไม่มีชื่อผู้รับผิดชอบ");
    var key = nm.clean.replace(/\s+/g, "");
    if (!byKey[key]) { byKey[key] = { key: key, fullName: nm.clean, first: nm.first, last: nm.last, rows: [] }; people.push(byKey[key]); }
    byKey[key].rows.push(row);
  });
  var taken = {};
  Object.keys(userBy).forEach(function(n) { taken[n] = true; });
  var ownedKeys = function(username) {
    var s = {};
    existing.forEach(function(k) { if (k.owners.indexOf(username) !== -1) s[k.key] = 1; });
    return s;
  };
  var resolved = [];
  people.forEach(function(p) {
    var fileKeys = p.rows.map(function(row) { return pimpKey_(row.name); });
    var initial = (p.last || "").replace(/\s+/g, "").charAt(0);
    var cands = [p.first];
    if (initial) cands.push(p.first + initial + ".");
    var same = null;
    cands.forEach(function(c) {
      if (same || !userBy[c]) return;
      var owned = ownedKeys(c);
      if (fileKeys.some(function(k) { return owned[k]; })) same = c;
    });
    var info = { key: p.key, fullName: p.fullName, kpis: p.rows.length };
    var choice = decisions.people && decisions.people[p.key] && decisions.people[p.key].choice;
    if (same) {
      info.status = "same"; info.existing = { username: same, tier: userBy[same].tier, depts: userBy[same].depts };
      info.choice = "existing"; info.username = same; info.created = false;
    } else if (userBy[p.first]) {
      info.status = "collision"; info.existing = { username: p.first, tier: userBy[p.first].tier, depts: userBy[p.first].depts };
      if (choice === "existing") { info.choice = "existing"; info.username = p.first; info.created = false; }
      else { info.choice = "new"; info.username = pimpUniqueName_(p.first, p.last, taken); info.created = true; }
    } else {
      info.status = "fresh"; info.existing = null; info.choice = "new";
      info.username = pimpUniqueName_(p.first, p.last, taken); info.created = true;
    }
    if (info.created) taken[info.username] = true;
    resolved.push(info);
  });
  var infoBy = {};
  resolved.forEach(function(x) { infoBy[x.key] = x; });
  // แถวตัวชี้วัด
  var skipSet = {};
  (decisions.skip || []).forEach(function(i) { skipSet[i] = true; });
  var rows = [], newUnitsSeen = {};
  src.rows.forEach(function(row) {
    var info = infoBy[pimpSplitName_(row.owner).clean.replace(/\s+/g, "")];
    var name = pimpStripNo_(row.name);
    var key = pimpKey_(row.name);
    var unit = renameUnit_(row.unit);
    var tgt = pimpTarget_(row.target);
    var ov = decisions.targets && decisions.targets[row.i];
    if (ov !== undefined && ov !== null) {
      ov = arabicDigits_(String(ov)).trim();
      if (ov && !PIMP_TARGET_OK_RE.test(ov)) throw new Error("เป้าหมายแถวที่ " + (row.i + 1) + " ไม่อยู่ในรูปแบบ (เช่น ≥ 90, < 2, = 0)");
      tgt = { value: ov, original: tgt.original, sure: true, note: "", edited: true };
    }
    var dup = null, dupId = "";
    existing.forEach(function(k) {
      if (k.key !== key || dup === "same") return;
      if (k.owners.indexOf(info.username) !== -1) { dup = "same"; dupId = k.id; }
      else if (!dup) { dup = "similar"; dupId = k.id; }
    });
    var problem = unit ? "" : "ไม่มีหน่วยงานในไฟล์";
    var newUnit = unit && !units[unit];
    if (newUnit) newUnitsSeen[unit] = 1;
    rows.push({
      i: row.i, personKey: info.key, owner: info.username, name: name, target: tgt, unit: unit, template: row.template, months: row.months,
      dup: dup, dupId: dupId, newUnit: !!newUnit, problem: problem, include: dup !== "same" && !skipSet[row.i] && !problem
    });
  });
  var stats = {
    people: resolved.length, rows: rows.length, include: rows.filter(function(x) { return x.include; }).length,
    skipSame: rows.filter(function(x) { return x.dup === "same"; }).length, similar: rows.filter(function(x) { return x.dup === "similar"; }).length,
    newAccounts: resolved.filter(function(x) { return x.created && rows.some(function(r) { return r.personKey === x.key && r.include; }); }).length,
    review: rows.filter(function(x) { return x.include && !x.target.sure; }).length,
    noTarget: rows.filter(function(x) { return x.include && x.target.empty; }).length
  };
  return { fy: fy, sheet: sheet, data: data, usersSheet: usersSheet, users: users, people: resolved, rows: rows, newUnits: Object.keys(newUnitsSeen), stats: stats };
}

function pimpPublic_(plan) {
  return {
    fy: plan.fy, stats: plan.stats, newUnits: plan.newUnits,
    people: plan.people.map(function(p) { return { key: p.key, fullName: p.fullName, kpis: p.kpis, status: p.status, existing: p.existing, choice: p.choice, username: p.username, created: p.created }; }),
    rows: plan.rows.map(function(r) {
      return { i: r.i, personKey: r.personKey, owner: r.owner, name: r.name, target: r.target, unit: r.unit, hasTemplate: !!r.template, dup: r.dup, newUnit: r.newUnit, problem: r.problem, include: r.include };
    })
  };
}

/** ตรวจไฟล์ก่อนนำเข้า (ไม่เขียนอะไร) */
function personalImportPreview(token, url, decisions) {
  try {
    requireAdmin_(token);
    return { success: true, preview: pimpPublic_(pimpPlan_(url, decisions)) };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  }
}

/** นำเข้าจริง (admin) — ทำแผนซ้ำฝั่งเซิร์ฟเวอร์ ไม่เชื่อแถวจากหน้าเว็บ รับเฉพาะการตัดสินใจ */
function personalImportCommit(token, url, decisions) {
  var lock = null;
  try {
    var admin = requireAdmin_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var plan = pimpPlan_(url, decisions);
    var sheet = plan.sheet, fy = plan.fy;
    ensureColumns_(sheet, KPI_COLS);
    var todo = plan.rows.filter(function(r) { return r.include; });
    if (todo.length === 0) return { success: true, created: 0, skipped: plan.rows.length, accounts: [], ids: [], message: "ไม่มีตัวชี้วัดใหม่ให้นำเข้า (มีอยู่แล้วทั้งหมด)" };

    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL), stamp = nowStamp_();
    var fileStamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
    // สำรองก่อนเขียน
    var b = sheet.copyTo(ss);
    b.setName(PIMP_BACKUP_PREFIX + fiscalSheetName_(fy) + " " + fileStamp);
    b.hideSheet();
    renameBackupSheets_(ss, PIMP_BACKUP_PREFIX, 3);
    var uss = getUsersSpreadsheet_();
    var ub = plan.usersSheet.copyTo(uss);
    ub.setName(PIMP_USERS_BACKUP_PREFIX + fileStamp);
    ub.hideSheet();
    renameBackupSheets_(uss, PIMP_USERS_BACKUP_PREFIX, 3);

    // บัญชีใหม่ (เฉพาะคนที่มีตัวชี้วัดจะนำเข้า)
    var need = {};
    todo.forEach(function(r) { need[r.personKey] = true; });
    var newUsers = [], taken = {};
    plan.users.forEach(function(u) { taken[u.username] = true; });
    plan.people.forEach(function(p) {
      if (!p.created || !need[p.key]) return;
      if (taken[p.username]) throw new Error("ชื่อบัญชี " + p.username + " ซ้ำ — ให้ตรวจสอบใหม่");
      taken[p.username] = true;
      newUsers.push(buildUser_(p.username, DEFAULT_PASSWORD, "staff", [], true));
    });
    if (newUsers.length > 0) writeUsers_(plan.usersSheet, plan.users.concat(newUsers));

    // แถวตัวชี้วัด (ใช้แกนเดียวกับ addIndicator)
    var data = plan.data.slice(), built = [], ids = [], baseTime = new Date().getTime();
    for (var k = 0; k < todo.length; k++) {
      var r = todo[k];
      var item = {
        name: r.name, target: r.target.value || "",
        dataSource: pimpSourceText_(r.template, r.target),
        templateDetails: "", owner: r.owner, department: r.unit, levels: ["รายบุคคล"],
        cats: [{ part: r.unit, category: UNIT_CATS_PLACEHOLDER }],
        years: [null, null, null, null, null],
        months: r.months && r.months.length === 12 ? r.months.map(function(v) { return monthOrNull_(v); }) : [null, null, null, null, null, null, null, null, null, null, null, null]
      };
      var res = buildNewKpiRow_(admin, fy, sheet, data, item, true, baseTime + k);
      if (res.error) throw new Error("แถวที่ " + (r.i + 1) + ": " + res.error);
      var row = res.row.slice();
      while (row.length < KPI_COLS) row.push("");
      [4, 5, 23, 24, 25, 26].forEach(function(c) { row[c] = tidyLiteral_(row[c]); });
      built.push(row); data.push(row); ids.push(res.newId);
    }
    var first = sheet.getLastRow() + 1;
    sheet.getRange(first, 1, built.length, KPI_COLS).setValues(built);
    if (!sheet.getRange(1, EXTRA_CATS_COL).getValue() && built.some(function(rw) { return rw[EXTRA_CATS_COL - 1]; })) {
      sheet.getRange(1, EXTRA_CATS_COL).setValue(EXTRA_CATS_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
    }

    // Tidy_Log
    var logRows = [[stamp, fy, "", "personal-import", "", "ตัวชี้วัด " + built.length + " · บัญชีใหม่ " + newUsers.length + " · ข้าม " + (plan.rows.length - built.length)]];
    newUsers.forEach(function(u) { logRows.push([stamp, "", u.username, "personal-import-user", "", "staff"]); });
    ids.forEach(function(id) { logRows.push([stamp, fy, id, "personal-import-kpi", "", ""]); });
    var log = ss.getSheetByName(TIDY_LOG_SHEET);
    if (!log) {
      log = ss.insertSheet(TIDY_LOG_SHEET);
      log.getRange(1, 1, 1, 6).setValues([["เวลา", "ปีงบ", "รหัส", "ฟิลด์", "ค่าเดิม", "ค่าใหม่"]]).setFontWeight("bold");
      log.hideSheet();
    }
    log.getRange(log.getLastRow() + 1, 1, logRows.length, 6).setNumberFormat("@").setValues(logRows);

    touchUser_(admin, "edit");
    bumpDataVersion_("*", "*", admin);
    return {
      success: true, created: built.length, skipped: plan.rows.length - built.length, ids: ids,
      accounts: newUsers.map(function(u) { return { username: u.username }; }),
      message: "นำเข้าตัวชี้วัด " + built.length + " ตัว" + (newUsers.length ? " · สร้างบัญชี " + newUsers.length + " บัญชี (รหัสผ่านตั้งต้น " + DEFAULT_PASSWORD + ")" : "")
    };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** ที่มา/สูตร = KPI Template · เป้าหมายเดิมที่ปรับค่าแล้วต่อท้ายเป็นบรรทัดอ้างอิง */
function pimpSourceText_(template, target) {
  var t = arabicDigits_((template || "").toString()).trim();
  if (target && target.original && target.value !== target.original && !/^\d+(\.\d+)?\s*%?$/.test(target.original)) {
    t = (t ? t + "\n\n" : "") + "เป้าหมายตามเอกสารต้นฉบับ: " + target.original;
  }
  return t;
}
