// ---------------------------------------------------------------- อัปเดตข้อมูลอัตโนมัติ (หลายคนใช้งานพร้อมกัน)
// ทุกครั้งที่มีการเขียนข้อมูลตัวชี้วัด ระบบจดลง "บันทึกการเปลี่ยนแปลง" (เก็บใน CacheService ไม่กินโควตา Properties)
// หน้าเว็บถามทุก ~10 วินาทีว่ามีอะไรเปลี่ยนหลังเลขรุ่นที่ตัวเองมี — ถ้าไม่มี ตอบกลับทันทีโดยไม่อ่านชีต
// ถ้าบันทึกหายจากแคช (หมดอายุ/ถูกล้าง) หน้าเว็บจะดึงข้อมูลทั้งปีงบใหม่ 1 ครั้ง แล้วนับต่อจากรุ่นใหม่

var CHANGE_LOG_KEY = "KPI_CHANGES_V1";
var CHANGE_LOG_MAX = 80;          // จำนวนรายการล่าสุดที่เก็บ (เก่ากว่านี้ หน้าเว็บดึงทั้งปีงบใหม่แทน)
var CHANGE_LOG_TTL = 21600;       // 6 ชั่วโมง (สูงสุดของ CacheService)
var CHANGE_LOG_MAX_CHARS = 90000; // ค่าใน CacheService จำกัด 100KB ต่อคีย์

function readChangeLog_() {
  var raw = CacheService.getScriptCache().get(CHANGE_LOG_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/** เลขรุ่นข้อมูลล่าสุด (0 = ยังไม่มีบันทึกในแคช) */
function dataVersion_(log) {
  if (!log) return 0;
  return log.entries.length ? log.entries[log.entries.length - 1].v : log.base;
}

/**
 * จดว่าข้อมูลเปลี่ยน — เรียกภายใต้ script lock หลังเขียนชีตเสร็จแล้วเท่านั้น
 * fy: ปีงบที่เปลี่ยน หรือ "*" (ทุกปีงบ) · ids: รหัสตัวชี้วัดที่เปลี่ยน หรือ "*" (เปลี่ยนหลายตัว/สิทธิ์ผู้ใช้ → ดึงใหม่ทั้งปีงบ)
 * doc: ชื่อเอกสารที่เปลี่ยน (เช่น "SAR") เมื่อเปลี่ยนข้อความเอกสาร สรพ. ไม่ใช่แถวตัวชี้วัด — ids เป็น [] ได้ · pollChanges แจ้งชื่อเอกสารให้หน้าเว็บ
 * จดไม่สำเร็จไม่ให้กระทบการบันทึก (หน้าเว็บจะได้ข้อมูลใหม่ตอนโหลดครั้งถัดไป)
 */
function bumpDataVersion_(fy, ids, user, doc) {
  try {
    var log = readChangeLog_() || { base: new Date().getTime(), entries: [] };
    var entry = { v: dataVersion_(log) + 1, fy: fy, ids: ids, by: user ? user.username : "" };
    if (doc) entry.doc = doc;
    log.entries.push(entry);
    while (log.entries.length > CHANGE_LOG_MAX) log.base = log.entries.shift().v;
    var json = JSON.stringify(log);
    while (json.length > CHANGE_LOG_MAX_CHARS && log.entries.length > 1) {
      log.base = log.entries.shift().v;
      json = JSON.stringify(log);
    }
    CacheService.getScriptCache().put(CHANGE_LOG_KEY, json, CHANGE_LOG_TTL);
  } catch (e) {
    console.error("จดการเปลี่ยนแปลงไม่สำเร็จ: " + e);
  }
}

/** ลายนิ้วมือของข้อมูลแถว (ไม่นับเวลาเข้าดู) — ใช้ตรวจว่ามีคนอื่นแก้ตัวชี้วัดนี้ไปก่อน และให้หน้าเว็บรู้ว่าตัวไหนเปลี่ยน */
function rowRev_(row) {
  var s = "";
  for (var c = 0; c < KPI_COLS; c++) {
    if (c === STAMP_VIEW_AT_COL - 1 || c === STAMP_VIEW_BY_COL - 1) continue;
    var v = row[c];
    if (v === undefined || v === null) v = "";
    else if (Object.prototype.toString.call(v) === "[object Date]") v = v.getTime();
    s += v + "\u0001";
  }
  var h = 0x811c9dc5; // FNV-1a 32 บิต
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36) + "." + s.length.toString(36);
}

/**
 * หน้าเว็บถามการเปลี่ยนแปลงหลังรุ่น lastV ของปีงบ fy
 * คืน { same: true } เมื่อไม่มีอะไรใหม่ · { kpis, removed } เฉพาะตัวที่เปลี่ยน · { full: true, kpis } ทั้งปีงบ
 */
function pollChanges(token, fy, lastV) {
  try {
    // ตรวจ session จากแคชก่อน (ไม่อ่านชีต) — รอบที่ไม่มีอะไรเปลี่ยนจะเร็วและไม่กินทรัพยากร
    if (!token || !CacheService.getScriptCache().get("sess_" + token)) throw new Error("SESSION_EXPIRED");
    var log = readChangeLog_();
    var v = dataVersion_(log);
    if (v === lastV) return { success: true, v: v, same: true };

    fy = resolveFiscalYear_(fy);
    var full = !log, ids = {}, by = {}, docs = {}, any = full;
    if (log) {
      var start = lastV === log.base ? 0 : -1;
      for (var i = 0; start === -1 && i < log.entries.length; i++) {
        if (log.entries[i].v === lastV) start = i + 1;
      }
      if (start === -1) full = any = true; // รุ่นเก่าเกินบันทึก หรือแคชถูกล้างไปแล้ว
      else {
        for (var j = start; j < log.entries.length; j++) {
          var e = log.entries[j];
          if (e.fy !== "*" && e.fy !== fy) continue;
          any = true;
          if (e.by) by[e.by] = true;
          if (e.doc) docs[e.doc] = true;
          if (e.ids === "*") full = true;
          else e.ids.forEach(function(id) { ids[id] = true; });
        }
      }
    }
    if (!any) return { success: true, v: v, same: true }; // เปลี่ยนแต่ปีงบอื่น

    var user = requireUser_(token);
    var sources = getAnnualSources_(fy);
    var data = getFiscalSheet_(fy).getDataRange().getValues();
    var kpis = [], found = {};
    for (var r = 1; r < data.length; r++) {
      if (!data[r][0]) continue;
      var id = data[r][0].toString().trim();
      if (!full && !ids[id]) continue;
      var kpi = rowToKpi_(data[r]);
      if (!getKpiPermission_(user, kpi, fy).view) continue;
      kpis.push(decorateKpi_(user, fy, kpi, sources));
      found[id] = true;
    }
    var res = { success: true, v: v, full: full, kpis: kpis, by: Object.keys(by) };
    res.docs = full ? [SARDOC_SAR, SARDOC_CLT] : Object.keys(docs); // เอกสาร สรพ. ที่ข้อความเปลี่ยน (ทุกอย่างถือว่าเปลี่ยนเมื่อดึงทั้งปีงบใหม่)
    if (full) res.headings = viewHeadings_();
    else res.removed = Object.keys(ids).filter(function(id) { return !found[id]; }); // ถูกลบ หรือไม่มีสิทธิ์ดูแล้ว
    return res;
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
