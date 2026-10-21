/**
 * ปีงบประมาณ (Fiscal Year)
 *
 * ข้อมูลตัวชี้วัดแยกเป็นชีตรายปี ชื่อ "ปีงบ <พ.ศ.>" (เช่น "ปีงบ 2570") โครงสร้างคอลัมน์เหมือนกันทุกชีต
 * ปีงบเริ่ม 1 ต.ค. — ชีตปีงบใหม่สร้างอัตโนมัติจากชีตปีล่าสุด (นิยามตัวชี้วัด/ผู้รับผิดชอบ/หน่วยงานคัดลอกมา
 * ผลย้อนหลัง ปี -4…ปี -1 เลื่อนให้ ผลปีนี้และรายเดือนเว้นว่าง) การแก้นิยามในปีหนึ่งไม่กระทบปีอื่น
 * ตัวชี้วัดเดียวกันเชื่อมข้ามปีด้วยรหัสตัวชี้วัด (คอลัมน์ A)
 */

var FISCAL_SHEET_PREFIX = "ปีงบ ";
var LEGACY_DATABASE_FISCAL_YEAR = 2569; // ปีงบของข้อมูลเดิมในชีต Database ก่อนแยกปี
var FISCAL_TRIGGER_FUNCTION = "dailyFiscalYearCheck";

// คอลัมน์ผลทั้งปี ปี -4 … ปีปัจจุบัน = G..K (7..11)
var ANNUAL_FIRST_COL = 7;
var MONTHLY_COLS = 12;

function getCurrentFiscalYear_() {
  var now = new Date();
  var be = parseInt(Utilities.formatDate(now, "Asia/Bangkok", "yyyy"), 10) + 543;
  var month = parseInt(Utilities.formatDate(now, "Asia/Bangkok", "M"), 10);
  return month >= 10 ? be + 1 : be;
}

function fiscalSheetName_(fy) {
  return FISCAL_SHEET_PREFIX + fy;
}

function getFiscalSheet_(fy) {
  return SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(fiscalSheetName_(fy));
}

/** รายการปีงบที่มีชีตอยู่ เรียงจากใหม่ไปเก่า */
function listFiscalYears_() {
  var years = [];
  SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheets().forEach(function(sh) {
    var m = sh.getName().match(/^ปีงบ (\d{4})$/);
    if (m) years.push(parseInt(m[1], 10));
  });
  return years.sort(function(a, b) { return b - a; });
}

/** ชีตที่ใช้เป็นฐานของงานที่ไม่ผูกกับปี (สร้างบัญชี ฯลฯ): ปีงบปัจจุบัน หรือปีล่าสุด หรือ Database เดิม */
function getActiveDataSheet_() {
  var years = listFiscalYears_();
  if (years.length > 0) {
    var current = getCurrentFiscalYear_();
    return getFiscalSheet_(years.indexOf(current) !== -1 ? current : years[0]);
  }
  return SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(DATABASE_SHEET_NAME);
}

/** ตั้งหัวคอลัมน์ผลทั้งปีให้ระบุปีจริง: G = ปี -4 … K = ปีปัจจุบัน */
function setFiscalYearHeaders_(sheet, fy) {
  var labels = [];
  for (var i = 0; i < 5; i++) {
    labels.push(i < 4 ? "ผลปีงบ " + (fy - 4 + i) + " (ปี -" + (4 - i) + ")" : "ผลปีงบ " + fy + " (ปีปัจจุบัน)");
  }
  sheet.getRange(1, ANNUAL_FIRST_COL, 1, 5).setValues([labels]);
}

// ติดตั้ง trigger รายวัน — ถ้าติดตั้งไม่ได้ (เช่น ยังไม่ได้ให้สิทธิ์) ไม่ให้กระทบการใช้งาน
// เพราะตอนมีคนล็อกอินในปีงบใหม่ ระบบสร้างชีตให้อยู่แล้วเป็นตัวสำรอง
function ensureFiscalTrigger_() {
  try {
    var exists = ScriptApp.getProjectTriggers().some(function(t) { return t.getHandlerFunction() === FISCAL_TRIGGER_FUNCTION; });
    if (!exists) {
      ScriptApp.newTrigger(FISCAL_TRIGGER_FUNCTION).timeBased().everyDays(1).atHour(0).nearMinute(30).inTimezone("Asia/Bangkok").create();
    }
  } catch (e) {
    console.error("ติดตั้ง trigger ปีงบไม่สำเร็จ: " + e);
  }
}

/** ย้ายชีต Database เดิมเป็น "ปีงบ 2569" (สำเนาทั้งชีต) แล้วเก็บชีตเดิมไว้เป็นสำรอง (ซ่อน) */
function migrateDatabaseToFiscalYears_() {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var db = ss.getSheetByName(DATABASE_SHEET_NAME);
  if (!db) return;
  var copy = db.copyTo(ss);
  copy.setName(fiscalSheetName_(LEGACY_DATABASE_FISCAL_YEAR));
  setFiscalYearHeaders_(copy, LEGACY_DATABASE_FISCAL_YEAR);
  db.setName("Database_backup_" + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss"));
  db.hideSheet();
}

/** สร้างชีตปีงบใหม่จากชีตปีล่าสุดก่อนหน้า (คัดลอกนิยาม, เลื่อนผลย้อนหลัง, ล้างผลปีนี้/รายเดือน/Time stamp) */
function createFiscalYearSheet_(newFy) {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var older = listFiscalYears_().filter(function(y) { return y < newFy; });
  if (older.length === 0) return null;
  var srcFy = older[0];
  var sheet = getFiscalSheet_(srcFy).copyTo(ss);
  sheet.setName(fiscalSheetName_(newFy));

  var last = sheet.getLastRow();
  if (last >= 2) {
    var vals = sheet.getRange(2, ANNUAL_FIRST_COL, last - 1, 5 + MONTHLY_COLS).getValues();
    var out = vals.map(function(r) {
      var annual = [];
      for (var i = 0; i < 5; i++) {
        var idx = (newFy - 4 + i) - (srcFy - 4); // ตำแหน่งของปีนั้นในชีตต้นทาง
        annual.push(idx >= 0 && idx < 5 ? r[idx] : "");
      }
      for (var m = 0; m < MONTHLY_COLS; m++) annual.push("");
      return annual;
    });
    sheet.getRange(2, ANNUAL_FIRST_COL, last - 1, 5 + MONTHLY_COLS).setValues(out);
    sheet.getRange(2, STAMP_EDIT_AT_COL, last - 1, 4).clearContent();
    sheet.getRange(2, ANALYSIS_COL, last - 1, 1).clearContent(); // ปีงบใหม่ต้องอัปเดตการวิเคราะห์ใหม่
  }
  setFiscalYearHeaders_(sheet, newFy);
  return sheet;
}

/** ให้แน่ใจว่ามีชีตปีงบครบ: ย้ายข้อมูลเดิมครั้งแรก, สร้างปีงบปัจจุบันถ้ายังไม่มี, ติดตั้ง trigger รายวัน */
function ensureFiscalSheets_() {
  var years = listFiscalYears_();
  var current = getCurrentFiscalYear_();
  if (years.length > 0 && (years.indexOf(current) !== -1 || years[0] > current)) return;

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (listFiscalYears_().length === 0) migrateDatabaseToFiscalYears_();
    years = listFiscalYears_();
    if (years.length > 0 && years.indexOf(current) === -1 && years[0] < current) createFiscalYearSheet_(current);
    ensureFiscalTrigger_();
  } finally {
    lock.releaseLock();
  }
}

/** handler ของ trigger รายวัน 00:30 (ขึ้นปีงบใหม่ 1 ต.ค. สร้างชีตให้เอง) */
function dailyFiscalYearCheck() {
  ensureFiscalSheets_();
}

/** รหัสตัวชี้วัด → แถวในชีต */
function readIdRowMap_(sheet) {
  var map = {};
  var last = sheet.getLastRow();
  if (last < 2) return map;
  sheet.getRange(2, 1, last - 1, 1).getValues().forEach(function(r, i) {
    if (r[0]) map[r[0].toString().trim()] = i + 2;
  });
  return map;
}

/**
 * ชีตที่เก็บผลทั้งปีของปี Y เป็น "ต้นทาง" คือชีตปีงบ Y (คอลัมน์ K) ชีตปีถัดไปอีก 4 ปีเก็บสำเนาไว้ที่ G–J
 * คืน sources[i] (i = 0..3 ↔ ปี -4…-1 ของชีต fy) = map รหัส→แถว ของชีตต้นทาง หรือ null ถ้าไม่มีชีตปีนั้น
 */
function getAnnualSources_(fy) {
  var sources = [];
  for (var i = 0; i < 4; i++) {
    var sheet = getFiscalSheet_(fy - 4 + i);
    sources.push(sheet ? readIdRowMap_(sheet) : null);
  }
  return sources;
}

/**
 * เขียนผลทั้งปีของปี Y ลงทุกชีตที่เก็บปีนั้น (ชีตปี Y ช่อง K และชีตปี Y+1…Y+4 ช่อง G–J)
 * changes: [{ id, year, value, skipFy }] — skipFy คือชีตที่ผู้เรียกเขียนเองแล้ว
 */
function propagateAnnual_(changes) {
  if (changes.length === 0) return;
  listFiscalYears_().forEach(function(z) {
    var sheet = getFiscalSheet_(z);
    var rowOf = readIdRowMap_(sheet);
    changes.forEach(function(c) {
      if (c.skipFy === z) return;
      var offset = c.year - (z - 4);
      if (offset < 0 || offset > 4) return;
      var row = rowOf[c.id];
      if (!row) return;
      sheet.getRange(row, ANNUAL_FIRST_COL + offset).setValue(c.value === null || c.value === undefined ? "" : c.value);
    });
  });
}

/** ผู้ใช้เลือกปีงบจากหน้าเว็บ: ถ้าไม่ระบุ/ไม่มีชีตให้ใช้ปีปัจจุบัน หรือปีล่าสุด */
function resolveFiscalYear_(requested) {
  var years = listFiscalYears_();
  var fy = parseInt(requested, 10);
  if (years.indexOf(fy) !== -1) return fy;
  var current = getCurrentFiscalYear_();
  return years.indexOf(current) !== -1 ? current : years[0];
}

/** ให้แน่ใจว่าชีตมีคอลัมน์ครบอย่างน้อย n คอลัมน์ (ชีตเก่าอาจมีน้อยกว่านี้ — อ่าน/เขียนนอกขอบเขตจะ error) */
function ensureColumns_(sheet, n) {
  var max = sheet.getMaxColumns();
  if (max < n) sheet.insertColumnsAfter(max, n - max);
}

// ---------------------------------------------------------------- สร้างหมวดหน่วยงานให้ตัวชี้วัดที่มีหน่วยงาน (ทำครั้งเดียว)

var UNIT_CATS_FLAG = "UNIT_CATEGORIES_V1";
var UNIT_CATS_PLACEHOLDER = "รอจัดหมวดย่อย";

/**
 * ตัวชี้วัดทุกตัวที่ระบุหน่วยงานไว้ → เพิ่มระดับ "หน่วยงาน" และให้แสดงในหมวดชื่อหน่วยงานนั้นด้วย
 * (หมวดย่อยใช้ชื่อชั่วคราว "รอจัดหมวดย่อย" ให้ไปแก้ทีหลัง) หลายหน่วยงาน = หลายหมวด
 * ทำครั้งเดียวกับทุกชีตปีงบที่มีอยู่ (เก็บสำเนาสำรองไว้ในชีตซ่อน) หลังจากนั้นแก้/เอาหมวดออกได้เองโดยไม่ถูกเติมซ้ำ
 */
function migrateUnitCategories_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(UNIT_CATS_FLAG)) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (props.getProperty(UNIT_CATS_FLAG)) return;
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var stamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
    listFiscalYears_().forEach(function(fy) {
      var sheet = getFiscalSheet_(fy);
      var last = sheet.getLastRow();
      if (last < 2) return;
      ensureColumns_(sheet, EXTRA_CATS_COL);
      var rows = sheet.getRange(2, 1, last - 1, EXTRA_CATS_COL).getValues();
      var levelsOut = [], extraOut = [], changed = 0;
      rows.forEach(function(row) {
        var levelsCell = row[LEVEL_COLUMN - 1], extraCell = row[EXTRA_CATS_COL - 1];
        var depts = row[0] ? parseDepts_(row[26]) : [];
        if (depts.length === 0) { levelsOut.push([levelsCell]); extraOut.push([extraCell]); return; }
        var levels = normalizeLevels_(levelsCell);
        if (levels.indexOf("หน่วยงาน") === -1) levels = sortLevels_(levels.concat(["หน่วยงาน"]));
        var cats = kpiCats_({ cats: [{ part: row[2] ? row[2].toString().trim() : "ทั่วไป", category: row[3] ? row[3].toString().trim() : "ทั่วไป" }].concat(parseExtraCats_(extraCell)) });
        depts.forEach(function(d) {
          if (!cats.some(function(c) { return c.part === d; })) cats.push({ part: d, category: UNIT_CATS_PLACEHOLDER });
        });
        var newLevels = levels.join(", "), newExtra = formatExtraCats_(cats.slice(1));
        if (newLevels !== (levelsCell || "").toString() || newExtra !== (extraCell || "").toString()) changed++;
        levelsOut.push([newLevels]);
        extraOut.push([newExtra]);
      });
      if (changed === 0) return;
      var backup = sheet.copyTo(ss);
      backup.setName("สำรองก่อนสร้างหมวดหน่วยงาน " + fiscalSheetName_(fy) + " " + stamp);
      backup.hideSheet();
      sheet.getRange(2, LEVEL_COLUMN, rows.length, 1).setValues(levelsOut);
      sheet.getRange(2, EXTRA_CATS_COL, rows.length, 1).setNumberFormat("@").setValues(extraOut);
      if (!sheet.getRange(1, EXTRA_CATS_COL).getValue()) {
        sheet.getRange(1, EXTRA_CATS_COL).setValue(EXTRA_CATS_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
      }
    });
    props.setProperty(UNIT_CATS_FLAG, Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"));
  } finally {
    lock.releaseLock();
  }
}
