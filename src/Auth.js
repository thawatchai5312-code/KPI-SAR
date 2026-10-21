/**
 * ระบบยืนยันตัวตนและสิทธิ์การเข้าถึง (Authentication & Authorization)
 *
 * Tier ผู้ใช้:  admin | executive (ผอ./QMR) | head (หัวหน้าหน่วย) | staff (รายบุคคล)
 * ระดับตัวชี้วัด (คอลัมน์ AC ของชีต Database): รายบุคคล | หน่วยงาน | QA-หน่วยงาน | QA-รพ | SAR
 *
 * ทุกฟังก์ชันที่เว็บเรียกต้องส่ง session token มา และ server ตรวจสิทธิ์เองทุกครั้ง
 * ฟังก์ชันที่ลงท้ายด้วย _ เป็น private เรียกจากหน้าเว็บไม่ได้
 */

var DEFAULT_PASSWORD = "11038";
var DEFAULT_ADMIN_USERNAME = "Admin";
var DEFAULT_ADMIN_PASSWORD = "Admin11038";
var MIN_PASSWORD_LENGTH = 6;
var SESSION_TTL_SECONDS = 21600; // 6 ชั่วโมง (สูงสุดของ CacheService)
var MAX_LOGIN_FAILURES = 5;
var LOGIN_LOCK_SECONDS = 300;

var USERS_HEADERS = ["Username", "Password", "Tier", "Departments", "MustChangePassword", "LastAccess", "LastEdit"];
var TIERS = ["admin", "executive", "head", "staff"];

// ระดับตัวชี้วัด เรียงจากต่ำไปสูง — 1 ตัวชี้วัดเลือกได้หลายระดับ (คอลัมน์ AC คั่นด้วย ", ") แสดงผลเป็นระดับสูงสุด
var KPI_LEVELS = ["รายบุคคล", "หน่วยงาน", "ฝ่ายการพยาบาล", "QA-หน่วยงาน", "SAR"];
// ระดับเดิมที่ยังรองรับถ้ามีอยู่ในชีตแล้ว แต่ไม่มีให้เลือกใหม่
var LEGACY_KPI_LEVELS = ["QA-รพ"];
var LEVEL_RANK = ["รายบุคคล", "หน่วยงาน", "ฝ่ายการพยาบาล", "QA-หน่วยงาน", "QA-รพ", "SAR"];
// ผู้ใช้ที่มี "ฝ่ายการพยาบาล" ในช่องหน่วยงาน เห็นตัวชี้วัดระดับ "ฝ่ายการพยาบาล" ทั้งหมด
var NURSING_DIVISION_TAG = "ฝ่ายการพยาบาล";
var DEFAULT_KPI_LEVEL = "SAR";
var LEVEL_COLUMN = 29; // คอลัมน์ AC
// คอลัมน์ Time stamp ในชีต Database: แก้ไขล่าสุดเมื่อ / โดย, เข้าดูล่าสุดเมื่อ / โดย
var STAMP_EDIT_AT_COL = 30;
var STAMP_EDIT_BY_COL = 31;
var STAMP_VIEW_AT_COL = 32;
var STAMP_VIEW_BY_COL = 33;
var STAMP_HEADERS = ["แก้ไขล่าสุดเมื่อ", "แก้ไขล่าสุดโดย", "เข้าดูล่าสุดเมื่อ", "เข้าดูล่าสุดโดย"];

// หัวหน้าหน่วยตั้งต้น (ใช้ครั้งเดียวหลังอัปเดตนี้) — ชื่อ → หน่วยงานที่ดูแล
// ผู้บริหาร (executive) จะไม่ถูกลดสิทธิ์ แค่บันทึกหน่วยงานไว้
var INITIAL_HEADS = {
  "อรทัย": ["ER"], "ชนกนันท์": ["HR"], "มุจรินทร์": ["PCU"], "รินทร์ลภัส": ["PCT"], "เดือนเพ็ญ": ["NSO"],
  "สถาพร": ["RM"], "สิรีธร": ["RM"], "ทินกร": ["PTC"], "สุรเชษฐ์": ["IT"]
};
var HEAD_OWNER_TOKEN = "หัวหน้าหน่วย"; // ผู้รับผิดชอบที่เขียนว่า "หัวหน้าหน่วย" = ผู้ใช้ Tier head ทุกคน

// ผอ. และ QMR ได้ Tier executive ตอนสร้างบัญชีอัตโนมัติ
var EXECUTIVE_NAMES = ["ผอ.", "เดือนเพ็ญ", "อานัติ"];

// ชื่อผู้รับผิดชอบในชีตมีคำพิมพ์ผิดและรูปแบบไม่สม่ำเสมอ — แปลงเป็นชื่อมาตรฐานก่อนใช้งาน
var OWNER_ALIASES = {
  "สุุรเชษฐ์": "สุรเชษฐ์", "ทิิชากร": "ทิชากร", "มุุจรินทร์": "มุจรินทร์", "มุจรินทร์์": "มุจรินทร์",
  "โชคอำนวบ": "โชคอำนวย", "จิิตษฎา": "จิตษฎา", "พรายเพขร": "พรายเพชร", "ประว๊ณา": "ประวีณา",
  "อมราวดีี": "อมราวดี", "สุุฎายม": "สุฎายม", "วิิชุลดา": "วิชุลดา", "มลธิรา บาดาจันทร์": "มลธิรา"
};
var OWNER_SPLITS = {
  "ภาวิดาพนม": ["ภาวิดา", "พนม"],
  "พญ.สิรีธร ประธาน RM  สถาพร เลขา RM": ["สิรีธร", "สถาพร"]
};
// ค่าที่ไม่ใช่ชื่อบุคคล ไม่สร้างบัญชีและไม่ใช้เป็นผู้รับผิดชอบ
var OWNER_SKIP = {
  "ICN": 1, "ICWN": 1, "ICEN": 1, "แพทย์": 1, "ผอ.": 1, "หัวหน้าหน่วย": 1, "หัวหน้าฝ่าย": 1,
  "ทีมระบบ": 1, "คณะกรรมการความเสี่ยง ทุกหน่วยงาน": 1
};
var DEPT_ALIASES = {
  "จิิตเวช": "จิตเวช", "งานIC": "IC", "ICWN": "IC", "ทีมบริหารความเสี่ยง(RM)": "RM", "แพทย์แผนไทย": "แผนไทย"
};

function getUsersSpreadsheet_() {
  return SpreadsheetApp.openByUrl(SPREADSHEET_URL);
}

/** แยกคอลัมน์ผู้รับผิดชอบ (คั่นด้วย /) เป็นรายชื่อมาตรฐาน ตัดค่าที่ไม่ใช่ชื่อคนออก */
function parseOwners_(text) {
  var out = [];
  if (!text) return out;
  text.toString().split("/").forEach(function(part) {
    var name = part.trim();
    var names = OWNER_SPLITS.hasOwnProperty(name) ? OWNER_SPLITS[name] : [OWNER_ALIASES[name] || name];
    names.forEach(function(n) {
      if (n && !OWNER_SKIP.hasOwnProperty(n) && out.indexOf(n) === -1) out.push(n);
    });
  });
  return out;
}

/** แยกคอลัมน์หน่วยงาน เช่น "ER/IPD", "NSO PCT IM" เป็นรายการหน่วยงาน */
function parseDepts_(text) {
  var out = [];
  if (!text) return out;
  text.toString().replace(/TB clinic/g, "TB").split(/[\/\s,]+/).forEach(function(part) {
    var d = DEPT_ALIASES[part.trim()] || part.trim();
    if (d && out.indexOf(d) === -1) out.push(d);
  });
  return out;
}

function sortLevels_(levels) {
  return levels.sort(function(a, b) { return LEVEL_RANK.indexOf(a) - LEVEL_RANK.indexOf(b); });
}

/** ค่าในคอลัมน์ระดับ → รายการระดับเรียงต่ำไปสูง (ว่าง = SAR, ไม่รู้จักเลย = รายบุคคล เพื่อจำกัดสิทธิ์ไว้ก่อน) */
function normalizeLevels_(value) {
  var text = value ? value.toString().trim() : "";
  if (text === "") return [DEFAULT_KPI_LEVEL];
  var out = [];
  text.split(/[,\/]/).forEach(function(t) {
    t = t.trim();
    if (LEVEL_RANK.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t);
  });
  if (out.length === 0) return [KPI_LEVELS[0]];
  return sortLevels_(out);
}

/** ระดับที่ส่งมาจากหน้าเว็บ → เก็บเฉพาะที่เลือกได้ (ระดับเดิมแบบ legacy คงไว้ได้ถ้าตัวชี้วัดมีอยู่แล้ว) */
function cleanLevelList_(list, oldLevels) {
  var out = [];
  (list || []).forEach(function(t) {
    t = (t || "").toString().trim();
    var ok = KPI_LEVELS.indexOf(t) !== -1 || (LEGACY_KPI_LEVELS.indexOf(t) !== -1 && (oldLevels || []).indexOf(t) !== -1);
    if (ok && out.indexOf(t) === -1) out.push(t);
  });
  return sortLevels_(out);
}

// ---------------------------------------------------------------- รหัสผ่าน

function bytesToHex_(bytes) {
  return bytes.map(function(b) {
    var v = b < 0 ? b + 256 : b;
    return (v < 16 ? "0" : "") + v.toString(16);
  }).join("");
}

function hashPassword_(password, salt) {
  salt = salt || Utilities.getUuid().replace(/-/g, "").substring(0, 16);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + password, Utilities.Charset.UTF_8);
  return salt + "$" + bytesToHex_(digest);
}

function verifyPassword_(password, stored) {
  var parts = (stored || "").toString().split("$");
  if (parts.length !== 2) return false;
  return hashPassword_(password, parts[0]) === stored.toString();
}

// ---------------------------------------------------------------- ชีต Users

function isTrue_(v) {
  return v === true || (v || "").toString().toUpperCase() === "TRUE";
}

/** เวลาปัจจุบันตามเขตเวลาไทย รูปแบบ "21/10/2569 09:15" (ปี พ.ศ.) */
function nowStamp_() {
  var now = new Date();
  var be = parseInt(Utilities.formatDate(now, "Asia/Bangkok", "yyyy"), 10) + 543;
  return Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/") + be + Utilities.formatDate(now, "Asia/Bangkok", " HH:mm");
}

/** ค่าในเซลล์ Time stamp อาจถูกชีตแปลงเป็น Date — แปลงกลับเป็นข้อความเสมอ (ส่ง Date ไปหน้าเว็บไม่ได้) */
function formatStamp_(v) {
  if (!v) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    var be = parseInt(Utilities.formatDate(v, "Asia/Bangkok", "yyyy"), 10) + 543;
    return Utilities.formatDate(v, "Asia/Bangkok", "dd/MM/") + be + Utilities.formatDate(v, "Asia/Bangkok", " HH:mm");
  }
  return v.toString();
}

/** บันทึกเวลาล่าสุดของผู้ใช้: kind = "access" (เข้าใช้) หรือ "edit" (แก้ไข) */
function touchUser_(user, kind) {
  var sheet = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
  if (sheet && user && user.row) sheet.getRange(user.row, kind === "edit" ? 7 : 6).setValue(nowStamp_());
}

/** ใส่ Time stamp ให้แถวตัวชี้วัด: kind = "edit" หรือ "view" */
function stampRow_(sheet, rowNumber, user, kind) {
  var col = kind === "edit" ? STAMP_EDIT_AT_COL : STAMP_VIEW_AT_COL;
  sheet.getRange(rowNumber, col, 1, 2).setValues([[nowStamp_(), user.username]]);
}

/** เพิ่มหัวคอลัมน์ Time stamp (ชีต Users: F-G, ชีต Database: AD-AG) ถ้ายังไม่มี และบังคับเป็นข้อความ */
function ensureStampColumns_(usersSheet) {
  if (usersSheet.getRange(1, 6).getValue() !== USERS_HEADERS[5]) {
    usersSheet.getRange(1, 6, 1, 2).setValues([[USERS_HEADERS[5], USERS_HEADERS[6]]])
      .setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
    usersSheet.getRange(1, 6, usersSheet.getMaxRows(), 2).setNumberFormat("@");
  }
  var db = getActiveDataSheet_();
  if (db && db.getRange(1, STAMP_EDIT_AT_COL).getValue() !== STAMP_HEADERS[0]) {
    db.getRange(1, STAMP_EDIT_AT_COL, 1, 4).setValues([STAMP_HEADERS])
      .setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
    db.getRange(1, STAMP_EDIT_AT_COL, db.getMaxRows(), 4).setNumberFormat("@");
  }
}

/** ตั้งหัวหน้าหน่วยตั้งต้นครั้งเดียว (INITIAL_HEADS) — จดไว้ใน Script Properties ว่าทำแล้ว */
function applyInitialHeads_(sheet) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("HEAD_SEED_V1")) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (props.getProperty("HEAD_SEED_V1")) return;
    var users = readUsers_(sheet);
    users.forEach(function(u) {
      if (!INITIAL_HEADS.hasOwnProperty(u.username)) return;
      u.depts = INITIAL_HEADS[u.username];
      if (u.tier === "staff") u.tier = "head";
    });
    writeUsers_(sheet, users);
    props.setProperty("HEAD_SEED_V1", "1");
  } finally {
    lock.releaseLock();
  }
}

function readUsers_(sheet) {
  var data = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    var name = data[i][0] ? data[i][0].toString().trim() : "";
    if (!name) continue;
    users.push({
      row: i + 1,
      username: name,
      hash: data[i][1] ? data[i][1].toString() : "",
      tier: data[i][2] ? data[i][2].toString().trim() : "staff",
      depts: data[i][3] ? data[i][3].toString().split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [],
      mustChange: isTrue_(data[i][4]),
      lastAccess: formatStamp_(data[i][5]),
      lastEdit: formatStamp_(data[i][6])
    });
  }
  return users;
}

function writeUsers_(sheet, users) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, USERS_HEADERS.length).clearContent();
  if (users.length === 0) return;
  var rows = users.map(function(u) {
    return [u.username, u.hash, u.tier, u.depts.join(","), u.mustChange ? "TRUE" : "FALSE", u.lastAccess || "", u.lastEdit || ""];
  });
  sheet.getRange(2, 1, rows.length, USERS_HEADERS.length).setValues(rows);
}

function buildUser_(username, password, tier, depts, mustChange) {
  return { username: username, hash: hashPassword_(password), tier: tier, depts: depts || [], mustChange: mustChange, lastAccess: "", lastEdit: "" };
}

/**
 * คืนชีต Users รูปแบบใหม่ ถ้ายังเป็นชีตแบบเดิม (Role/Username/Password) จะย้ายอัตโนมัติ:
 * สำรองชีตเดิมไว้ (ปิดรหัสผ่านเป็น ***), เก็บบัญชี Admin เดิม, สร้างบัญชีจากผู้รับผิดชอบทุกคน
 */
function ensureUsersSheet_() {
  var ss = getUsersSpreadsheet_();
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (sheet && sheet.getRange(1, 1).getValue() === USERS_HEADERS[0]) {
    ensureStampColumns_(sheet);
    applyInitialHeads_(sheet);
    return sheet;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (sheet && sheet.getRange(1, 1).getValue() === USERS_HEADERS[0]) return sheet;

    var adminName = DEFAULT_ADMIN_USERNAME;
    var adminPass = DEFAULT_ADMIN_PASSWORD;
    var adminMustChange = true;
    if (sheet) {
      var old = sheet.getDataRange().getValues();
      for (var i = 1; i < old.length; i++) {
        if (old[i][0] === "admin" && old[i][1] && old[i][2]) {
          adminName = old[i][1].toString().trim();
          adminPass = old[i][2].toString();
          adminMustChange = false;
          break;
        }
      }
      if (old.length > 1) sheet.getRange(2, 3, old.length - 1, 1).setValue("***");
      sheet.setName("Users_old_" + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss"));
    }

    var fresh = ss.insertSheet(USERS_SHEET_NAME);
    fresh.getRange(1, 1, 1, USERS_HEADERS.length).setValues([USERS_HEADERS])
      .setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
    fresh.setFrozenRows(1);
    fresh.getRange(1, 1, fresh.getMaxRows(), USERS_HEADERS.length).setNumberFormat("@");

    var users = [buildUser_(adminName, adminPass, "admin", [], adminMustChange)];
    buildAccountsFromOwners_(users).forEach(function(u) { users.push(u); });
    writeUsers_(fresh, users);

    normalizeDatabaseOwners_();
    ensureLevelColumn_();
    ensureStampColumns_(fresh);
    return fresh;
  } finally {
    lock.releaseLock();
  }
}

/** สร้างบัญชี (รหัสผ่านตั้งต้น 11038) ให้ผู้รับผิดชอบทุกคนที่ยังไม่มีใน existingUsers */
function buildAccountsFromOwners_(existingUsers) {
  var sheet = getActiveDataSheet_();
  var deptsByOwner = {};
  EXECUTIVE_NAMES.forEach(function(n) { deptsByOwner[n] = []; });

  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      var depts = parseDepts_(data[i][26]);
      parseOwners_(data[i][25]).forEach(function(name) {
        if (!deptsByOwner.hasOwnProperty(name)) deptsByOwner[name] = [];
        depts.forEach(function(d) { if (deptsByOwner[name].indexOf(d) === -1) deptsByOwner[name].push(d); });
      });
    }
  }

  var existing = {};
  existingUsers.forEach(function(u) { existing[u.username] = true; });
  var created = [];
  Object.keys(deptsByOwner).sort().forEach(function(name) {
    if (existing[name]) return;
    var isExec = EXECUTIVE_NAMES.indexOf(name) !== -1;
    created.push(buildUser_(name, DEFAULT_PASSWORD, isExec ? "executive" : "staff", isExec ? [] : deptsByOwner[name], true));
  });
  return created;
}

/** แก้คำพิมพ์ผิดในคอลัมน์ผู้รับผิดชอบของชีต Database (ไม่ลบค่าที่ไม่ใช่ชื่อคน) */
function normalizeDatabaseOwners_() {
  var sheet = getActiveDataSheet_();
  if (!sheet || sheet.getLastRow() < 2) return;
  var range = sheet.getRange(2, 26, sheet.getLastRow() - 1, 1);
  var values = range.getValues();
  var changed = false;
  var fixed = values.map(function(r) {
    var text = r[0] ? r[0].toString() : "";
    if (!text) return [r[0]];
    var parts = [];
    text.split("/").forEach(function(p) {
      var name = p.trim();
      var repl = OWNER_SPLITS.hasOwnProperty(name) ? OWNER_SPLITS[name] : [OWNER_ALIASES[name] || p];
      repl.forEach(function(x) { parts.push(x); });
    });
    var joined = parts.join("/");
    if (joined !== text) changed = true;
    return [joined];
  });
  if (changed) range.setValues(fixed);
}

/** เพิ่มคอลัมน์ "ระดับตัวชี้วัด" (AC) และตั้งค่าเริ่มต้นเป็น SAR ให้แถวที่ยังว่าง */
function ensureLevelColumn_() {
  var sheet = getActiveDataSheet_();
  if (!sheet) return;
  if (!sheet.getRange(1, LEVEL_COLUMN).getValue()) {
    sheet.getRange(1, LEVEL_COLUMN).setValue("ระดับตัวชี้วัด (Level)")
      .setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
  }
  var last = sheet.getLastRow();
  if (last < 2) return;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  var range = sheet.getRange(2, LEVEL_COLUMN, last - 1, 1);
  var levels = range.getValues();
  var changed = false;
  for (var i = 0; i < levels.length; i++) {
    if (ids[i][0] && !levels[i][0]) { levels[i][0] = DEFAULT_KPI_LEVEL; changed = true; }
  }
  if (changed) range.setValues(levels);
}

// ---------------------------------------------------------------- session

function publicUser_(user) {
  return { username: user.username, tier: user.tier, depts: user.depts, mustChange: user.mustChange };
}

function createSession_(username) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put("sess_" + token, username, SESSION_TTL_SECONDS);
  return token;
}

/** คืนผู้ใช้ปัจจุบันจาก token (อ่านสิทธิ์ล่าสุดจากชีตทุกครั้ง) ถ้าหมดอายุให้ throw SESSION_EXPIRED */
function requireUser_(token) {
  var username = token ? CacheService.getScriptCache().get("sess_" + token) : null;
  if (!username) throw new Error("SESSION_EXPIRED");
  var sheet = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
  var users = sheet ? readUsers_(sheet) : [];
  for (var i = 0; i < users.length; i++) {
    if (users[i].username === username) return users[i];
  }
  throw new Error("SESSION_EXPIRED");
}

function isPrivileged_(user) {
  return user.tier === "admin" || user.tier === "executive";
}

function requirePrivileged_(token) {
  var user = requireUser_(token);
  if (!isPrivileged_(user)) throw new Error("ไม่มีสิทธิ์ดำเนินการนี้ (เฉพาะ admin, ผอ., QMR)");
  return user;
}

function requireAdmin_(token) {
  var user = requireUser_(token);
  if (user.tier !== "admin") throw new Error("ไม่มีสิทธิ์ดำเนินการนี้ (เฉพาะ admin)");
  return user;
}

/**
 * สิทธิ์ดู/แก้ตัวชี้วัดแต่ละตัวในปีงบ fy
 * editResults = กรอกผลทั้งปี/รายเดือน (ผู้รับผิดชอบ/หัวหน้าหน่วย: ปีงบปัจจุบันและปีก่อนหน้า)
 * editDetails = แก้รายละเอียด/ที่มาข้อมูล (ปีงบปัจจุบันเท่านั้น) — admin, ผอ., QMR แก้ได้ทุกอย่างทุกปี
 */
function getKpiPermission_(user, kpi, fy) {
  var isOwner = parseOwners_(kpi.owner).indexOf(user.username) !== -1;
  if (!isOwner && user.tier === "head") {
    // ตัวชี้วัดที่ผู้รับผิดชอบเขียนว่า "หัวหน้าหน่วย" ให้หัวหน้าหน่วยทุกคนรับผิดชอบ
    isOwner = (kpi.owner || "").toString().split("/").some(function(t) { return t.trim() === HEAD_OWNER_TOKEN; });
  }
  var inDept = parseDepts_(kpi.department).some(function(d) { return user.depts.indexOf(d) !== -1; });
  var edit = isOwner || (user.tier === "head" && inDept);
  // "ของฉัน" = ตัวชี้วัดที่ผู้ใช้เป็นผู้รับผิดชอบ (ผู้บริหารนับเฉพาะที่ระบุชื่อตัวเอง)
  var mine = edit;
  if (isPrivileged_(user)) return { view: true, editResults: true, editDetails: true, mine: isOwner };
  var view = edit;
  if (!view) {
    // หลายระดับ: เห็นได้ถ้าระดับใดระดับหนึ่งให้สิทธิ์ดู
    view = (kpi.levels || normalizeLevels_(kpi.level)).some(function(l) {
      if (l === "SAR" || l === "QA-รพ") return true;
      if (l === "หน่วยงาน" || l === "QA-หน่วยงาน") return inDept;
      if (l === "ฝ่ายการพยาบาล") return inDept || user.depts.indexOf(NURSING_DIVISION_TAG) !== -1;
      return false;
    });
  }
  var current = getCurrentFiscalYear_();
  return {
    view: view,
    mine: mine,
    editResults: edit && fy >= current - 1,
    editDetails: edit && fy === current
  };
}

// ---------------------------------------------------------------- ล็อกอิน

function authenticateUser(username, password) {
  try {
    var sheet = ensureUsersSheet_();
    ensureFiscalSheets_();
    username = username ? username.toString().trim() : "";
    password = password ? password.toString() : "";
    if (!username || !password) return { success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };

    var cache = CacheService.getScriptCache();
    var failKey = "fail_" + username;
    if (parseInt(cache.get(failKey) || "0", 10) >= MAX_LOGIN_FAILURES) {
      return { success: false, message: "ลองผิดหลายครั้งเกินไป กรุณารอ 5 นาทีแล้วลองใหม่" };
    }

    var users = readUsers_(sheet);
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === username && verifyPassword_(password, users[i].hash)) {
        cache.remove(failKey);
        touchUser_(users[i], "access");
        return { success: true, token: createSession_(username), user: publicUser_(users[i]) };
      }
    }
    cache.put(failKey, String(parseInt(cache.get(failKey) || "0", 10) + 1), LOGIN_LOCK_SECONDS);
    return { success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function logoutUser(token) {
  if (token) CacheService.getScriptCache().remove("sess_" + token);
  return { success: true };
}

function changePassword(token, oldPassword, newPassword) {
  try {
    var user = requireUser_(token);
    newPassword = newPassword ? newPassword.toString() : "";
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { success: false, message: "รหัสผ่านใหม่ต้องมีอย่างน้อย " + MIN_PASSWORD_LENGTH + " ตัวอักษร" };
    }
    if (newPassword === DEFAULT_PASSWORD) {
      return { success: false, message: "ห้ามใช้รหัสผ่านตั้งต้น กรุณาตั้งรหัสผ่านใหม่" };
    }
    if (!verifyPassword_(oldPassword ? oldPassword.toString() : "", user.hash)) {
      return { success: false, message: "รหัสผ่านเดิมไม่ถูกต้อง" };
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var sheet = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
      var users = readUsers_(sheet);
      users.forEach(function(u) {
        if (u.username === user.username) { u.hash = hashPassword_(newPassword); u.mustChange = false; }
      });
      writeUsers_(sheet, users);
    } finally {
      lock.releaseLock();
    }
    return { success: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// ---------------------------------------------------------------- จัดการผู้ใช้ (admin)

function getUsersForAdmin(token) {
  try {
    requireAdmin_(token);
    var users = readUsers_(ensureUsersSheet_()).map(function(u) {
      return { username: u.username, tier: u.tier, depts: u.depts.join(","), mustChange: u.mustChange, lastAccess: u.lastAccess, lastEdit: u.lastEdit };
    });
    return { success: true, users: users };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * บันทึกรายชื่อผู้ใช้ทั้งหมดจากหน้าตั้งค่า: แก้ Tier/หน่วยงาน, เพิ่มคนใหม่ (รหัสตั้งต้น 11038),
 * คนที่ไม่อยู่ในรายการจะถูกลบ, resetList คือชื่อที่ต้องรีเซ็ตรหัสผ่านกลับเป็น 11038
 */
function saveUsersForAdmin(token, list, resetList) {
  try {
    var me = requireAdmin_(token);
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var sheet = ensureUsersSheet_();
      var current = {};
      readUsers_(sheet).forEach(function(u) { current[u.username] = u; });
      var resets = {};
      (resetList || []).forEach(function(n) { resets[n] = true; });

      var seen = {};
      var result = [];
      var hasAdmin = false;
      for (var i = 0; i < list.length; i++) {
        var name = (list[i].username || "").toString().trim();
        if (!name) continue;
        if (seen[name]) return { success: false, message: "ชื่อผู้ใช้ซ้ำกัน: " + name };
        seen[name] = true;
        if (TIERS.indexOf(list[i].tier) === -1) return { success: false, message: "Tier ไม่ถูกต้องของ " + name };
        var depts = (list[i].depts || "").toString().split(",").map(function(s) { return s.trim(); }).filter(Boolean);
        var existing = current[name];
        var user = existing
          ? { username: name, hash: existing.hash, tier: list[i].tier, depts: depts, mustChange: existing.mustChange, lastAccess: existing.lastAccess, lastEdit: existing.lastEdit }
          : buildUser_(name, DEFAULT_PASSWORD, list[i].tier, depts, true);
        if (existing && resets[name]) { user.hash = hashPassword_(DEFAULT_PASSWORD); user.mustChange = true; }
        if (user.tier === "admin") hasAdmin = true;
        result.push(user);
      }
      if (!hasAdmin) return { success: false, message: "ต้องมีผู้ใช้ Tier admin อย่างน้อย 1 คน" };
      if (!seen[me.username]) return { success: false, message: "ไม่สามารถลบบัญชีของตัวเองได้" };
      writeUsers_(sheet, result);
    } finally {
      lock.releaseLock();
    }
    return { success: true, message: "บันทึกรายชื่อผู้ใช้เรียบร้อยแล้ว" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/** สร้างบัญชีให้ผู้รับผิดชอบใหม่ๆ ในชีต Database ที่ยังไม่มีบัญชี */
function generateAccountsFromOwners(token) {
  try {
    requireAdmin_(token);
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var sheet = ensureUsersSheet_();
      var users = readUsers_(sheet);
      var created = buildAccountsFromOwners_(users);
      if (created.length > 0) writeUsers_(sheet, users.concat(created));
      return { success: true, count: created.length, message: "สร้างบัญชีใหม่ " + created.length + " บัญชี (รหัสผ่านตั้งต้น " + DEFAULT_PASSWORD + ")" };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
