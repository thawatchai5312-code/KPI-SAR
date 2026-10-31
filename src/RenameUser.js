/**
 * ✏️ เปลี่ยนชื่อผู้ใช้ (admin, ⚙️ ตั้งค่า → ✏️ เปลี่ยนชื่อ → แท็บ "ผู้ใช้") — ใช้กับคนที่ชื่อต้นซ้ำกัน ให้ใช้ "ชื่อ นามสกุล"
 * ชื่อผู้ใช้ = ชื่อในช่องผู้รับผิดชอบ (คอลัมน์ Z) จึงเปลี่ยนทั้งสองที่พร้อมกัน ทุกปีงบ
 *  - ดูตัวอย่างก่อนเขียนเสมอ (renameUserPreview) · เขียนใต้ lock + สำรองชีต (ซ่อน) + จด Tidy_Log + bumpDataVersion_
 *  - ไม่เปลี่ยน: ประวัติ "แก้ไข/เข้าดูล่าสุดโดย" · SAR_Doc · KPI_Links · Tidy_Log (เป็นประวัติ)
 *  - ย้ายค่าที่จำไว้ต่อบัญชี (TOUR_HIDE_V1 / REPORT_PREFS_V1) ไปชื่อใหม่
 */
var RENAME_USER_BACKUP_PREFIX = "สำรองก่อนเปลี่ยนชื่อผู้ใช้ ";
var RENAME_USER_MAX = 60;

/** ทำชื่อใหม่ให้เป็นรูปมาตรฐาน: ตัดช่องว่างหัวท้าย รวมช่องว่างซ้อนเป็นช่องเดียว */
function renameUserClean_(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

/** ข้อความผิดพลาดของชื่อใหม่ (ว่าง = ใช้ได้) */
function renameUserNameError_(from, to, usernames) {
  if (!to) return "กรุณาระบุชื่อใหม่";
  if (to === from) return "ชื่อใหม่เหมือนชื่อเดิม";
  if (to.length > RENAME_USER_MAX) return "ชื่อยาวเกิน " + RENAME_USER_MAX + " ตัวอักษร";
  if (to.indexOf("/") !== -1) return "ชื่อห้ามมีเครื่องหมาย / (ใช้คั่นผู้รับผิดชอบหลายคน)";
  if (/[\u0000-\u001f]/.test(to)) return "ชื่อมีอักขระที่ใช้ไม่ได้";
  if (usernames.indexOf(to) !== -1) return "มีบัญชีชื่อ \"" + to + "\" อยู่แล้ว";
  if (Object.prototype.hasOwnProperty.call(OWNER_ALIASES, to) || Object.prototype.hasOwnProperty.call(OWNER_SPLITS, to) || Object.prototype.hasOwnProperty.call(OWNER_SKIP, to)) {
    return "ชื่อ \"" + to + "\" เป็นชื่อที่ระบบแปลงอัตโนมัติ (ตารางชื่อเดียวกัน/ตำแหน่ง) ใช้เป็นชื่อบัญชีไม่ได้";
  }
  return "";
}

/**
 * ผู้รับผิดชอบ (ข้อความ) → แทนที่ชื่อ from ด้วย to (เฉพาะส่วนที่ตรงทั้งคำ คั่นด้วย /) · ช่องว่างหน้าหลังของแต่ละส่วนคงเดิม
 * ส่วนที่เป็นชื่อสะกดอื่นที่ตารางชื่อ (OWNER_ALIASES) แปลงเป็น from ก็แทนที่ด้วย · ไม่เปลี่ยน = คืนข้อความเดิม
 */
function renameUserOwnerText_(text, from, to) {
  var raw = (text || "").toString();
  if (!raw) return raw;
  var changed = false;
  var parts = raw.split("/").map(function(seg) {
    var t = seg.trim();
    var hit = t === from || (Object.prototype.hasOwnProperty.call(OWNER_ALIASES, t) && OWNER_ALIASES[t] === from);
    if (!hit) return seg;
    changed = true;
    return seg.replace(/\S(?:[\s\S]*\S)?/, function() { return to; });
  });
  if (!changed) return raw;
  // ชื่อใหม่ซ้ำกันในช่องเดียว (เช่น เดิมเขียนทั้งชื่อต้นและสะกดอื่น) — ตัดตัวซ้ำ
  var seen = {}, out = [];
  parts.forEach(function(seg) {
    var t = seg.trim();
    if (t === to) { if (seen[t]) return; seen[t] = 1; }
    out.push(seg);
  });
  return out.join("/");
}

function renameUserPlan_(rawReq) {
  var req = rawReq || {};
  var from = (req.from || "").toString().trim();
  var to = renameUserClean_(req.to);
  var plan = { from: from, to: to, errors: [], years: [], user: null, usersSheet: null, props: [] };
  var us = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
  var users = us ? readUsers_(us) : [];
  var names = users.map(function(u) { return u.username; });
  plan.user = users.filter(function(u) { return u.username === from; })[0] || null;
  plan.usersSheet = us;
  if (!plan.user) { plan.errors.push("ไม่พบบัญชี \"" + from + "\""); return plan; }
  var err = renameUserNameError_(from, to, names);
  if (err) plan.errors.push(err);
  if (plan.errors.length) return plan;
  listFiscalYears_().forEach(function(fy) {
    var d = tidyReadFy_(fy);
    if (!d) return;
    var rows = [];
    d.rows.forEach(function(r, i) {
      if (!r[0]) return;
      var next = renameUserOwnerText_(r[25], from, to);
      if (next !== (r[25] || "").toString()) rows.push({ index: i, id: r[0].toString().trim(), name: (r[4] || "").toString(), from: (r[25] || "").toString(), to: next });
    });
    plan.years.push({ fy: fy, sheet: d.sheet, total: d.rows.length, rows: rows });
  });
  var props = PropertiesService.getScriptProperties();
  [TOUR_HIDE_PREFIX, REPORT_PREFS_PREFIX].forEach(function(p) {
    var v = props.getProperty(p + from);
    if (v !== null && v !== undefined) plan.props.push({ key: p + from, newKey: p + to, value: v });
  });
  return plan;
}

function renameUserSummary_(plan) {
  var total = 0;
  var years = plan.years.map(function(y) {
    total += y.rows.length;
    return { fy: y.fy, count: y.rows.length, samples: y.rows.slice(0, 4).map(function(r) { return { id: r.id, name: r.name, from: r.from, to: r.to }; }) };
  });
  return {
    from: plan.from, to: plan.to, errors: plan.errors,
    tier: plan.user ? plan.user.tier : "", depts: plan.user ? plan.user.depts : [],
    years: years, total: total,
    props: plan.props.length
  };
}

function renameUserApply_(plan, admin) {
  var ss = getUsersSpreadsheet_(), stamp = nowStamp_();
  var fileStamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
  var logRows = [[stamp, "", plan.from, "rename-user", plan.from, plan.to]];
  var out = { years: {}, rows: 0 };

  // สำรองก่อนเขียน (ซ่อน): ชีตผู้ใช้ + ชีตปีงบที่จะแก้
  var ub = plan.usersSheet.copyTo(ss);
  ub.setName(RENAME_USER_BACKUP_PREFIX + "ผู้ใช้ " + fileStamp);
  ub.hideSheet();
  renameBackupSheets_(ss, RENAME_USER_BACKUP_PREFIX + "ผู้ใช้ ", 3);
  plan.years.forEach(function(y) {
    if (y.rows.length === 0) return;
    var b = y.sheet.copyTo(ss);
    b.setName(RENAME_USER_BACKUP_PREFIX + fiscalSheetName_(y.fy) + " " + fileStamp);
    b.hideSheet();
  });
  renameBackupSheets_(ss, RENAME_USER_BACKUP_PREFIX + "ปีงบ ", 3 * Math.max(1, plan.years.length));

  plan.usersSheet.getRange(plan.user.row, 1, 1, 1).setValue(plan.to);
  plan.years.forEach(function(y) {
    out.years[y.fy] = y.rows.length;
    y.rows.forEach(function(r) {
      y.sheet.getRange(r.index + 2, 26, 1, 1).setValue(r.to);
      logRows.push([stamp, y.fy, r.id, "owner", r.from, r.to]);
      out.rows++;
    });
  });

  var props = PropertiesService.getScriptProperties();
  plan.props.forEach(function(p) {
    props.setProperty(p.newKey, p.value);
    props.deleteProperty(p.key);
  });

  var log = ss.getSheetByName(TIDY_LOG_SHEET);
  if (!log) {
    log = ss.insertSheet(TIDY_LOG_SHEET);
    log.getRange(1, 1, 1, 6).setValues([["เวลา", "ปีงบ", "รหัส", "ฟิลด์", "ค่าเดิม", "ค่าใหม่"]]).setFontWeight("bold");
    log.hideSheet();
  }
  log.getRange(log.getLastRow() + 1, 1, logRows.length, 6).setNumberFormat("@").setValues(logRows);
  return out;
}

// ---------------------------------------------------------------- จุดเรียกจากหน้าเว็บ (เฉพาะ admin)

/** รายชื่อบัญชีทั้งหมด + คู่ที่ชื่อคล้ายกัน (ชื่อหนึ่งขึ้นต้นด้วยอีกชื่อ) เพื่อให้ admin เห็นว่าใครควรเปลี่ยนเป็น ชื่อ นามสกุล */
function renameUserInfo(token) {
  try {
    var me = requireAdmin_(token);
    var us = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
    var users = us ? readUsers_(us) : [];
    var cmp = function(a, b) { return a.username.localeCompare(b.username, "th"); };
    var base = function(n) { return n.replace(/[.\s]+$/, ""); };
    var similar = {};
    users.forEach(function(a) {
      users.forEach(function(b) {
        if (a === b || a.username.length > b.username.length) return;
        if (b.username.indexOf(base(a.username)) === 0 && base(a.username).length >= 2) { similar[a.username] = 1; similar[b.username] = 1; }
      });
    });
    return {
      success: true, me: me.username,
      users: users.sort(cmp).map(function(u) { return { username: u.username, tier: u.tier, depts: u.depts, similar: !!similar[u.username] }; })
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function renameUserPreview(token, req) {
  try {
    requireAdmin_(token);
    return { success: true, preview: renameUserSummary_(renameUserPlan_(req || {})) };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function renameUserCommit(token, req) {
  var lock = null;
  try {
    var admin = requireAdmin_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var plan = renameUserPlan_(req || {});
    if (plan.errors.length) return { success: false, message: plan.errors.join("\n"), preview: renameUserSummary_(plan) };
    var wrote = renameUserApply_(plan, admin);
    SpreadsheetApp.flush();
    touchUser_(admin, "edit");
    bumpDataVersion_("*", "*", admin);
    var self = plan.from === admin.username;
    return {
      success: true, wrote: wrote, selfRenamed: self,
      message: "เปลี่ยนชื่อ \"" + plan.from + "\" เป็น \"" + plan.to + "\" แล้ว (ตัวชี้วัด " + wrote.rows + " แถว)" + (self ? " — ต้องเข้าสู่ระบบใหม่ด้วยชื่อใหม่" : " — เจ้าของบัญชีต้องเข้าสู่ระบบใหม่ด้วยชื่อใหม่")
    };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}
