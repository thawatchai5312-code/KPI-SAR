/**
 * เอกสารแนบตัวชี้วัด (ลิงก์ Google Drive/Docs): คนทำงานวางลิงก์ไฟล์ที่หัวหน้าเก็บใน Drive แล้วผูกกับตัวชี้วัดได้หลายตัวในครั้งเดียว
 *  - เก็บในชีต KPI_Links แยกจากชีตปีงบและ SAR_Doc (ไม่แตะฐานข้อมูลเดิม) แถวละ 1 ลิงก์ ผูกได้หลายตัวชี้วัด (คอลัมน์ รหัสตัวชี้วัด คั่นด้วย ", ")
 *  - ไม่เก็บตัวไฟล์ — เก็บเฉพาะลิงก์ ชื่อ และหมายเหตุ · การเปิดไฟล์เป็นไปตามสิทธิ์แชร์ใน Drive
 *  - สิทธิ์: ดูลิงก์ได้ตามสิทธิ์ดูตัวชี้วัด · แนบ/แก้/ลบได้เฉพาะตัวชี้วัดที่แก้รายละเอียดได้ (editDetails) — ตัวชี้วัดอื่นในลิงก์เดียวกันที่ผู้ใช้แก้ไม่ได้จะคงเดิม
 *  - ผูกกับปีงบ ไม่ลอกไปปีใหม่ · ทุกการเขียนอยู่ใต้ script lock + ตรวจรุ่น (baseRev) + จดลงบันทึกการเปลี่ยนแปลง (Live.js, เอกสาร "LINKS")
 *  - ลบ = เปลี่ยนสถานะเป็น "ลบ" (ไม่ลบแถว) เผื่อกู้คืน
 */

var KPILINK_SHEET = "KPI_Links";
var KPILINK_HEADERS = ["ปีงบ", "รหัสลิงก์", "ชื่อเอกสาร", "ลิงก์", "รหัสตัวชี้วัด", "หมายเหตุ", "รุ่น", "แก้ไขล่าสุดเมื่อ", "แก้ไขล่าสุดโดย", "แนบเมื่อ", "แนบโดย", "สถานะ"];
var KPILINK_DOC = "LINKS";
var KPILINK_ACTIVE = "ใช้งาน";
var KPILINK_DELETED = "ลบ";
var KPILINK_MAX_TITLE = 200;
var KPILINK_MAX_URL = 1000;
var KPILINK_MAX_NOTE = 500;
var KPILINK_MAX_IDS = 300;

/** ชีต KPI_Links (ไม่มี = null) — ใช้ตอนอ่าน ไม่สร้างชีตเอง */
function kpiLinkSheetIfAny_() {
  return SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(KPILINK_SHEET);
}

/** ชีต KPI_Links — สร้างให้ถ้ายังไม่มี (เรียกภายใต้ script lock เท่านั้น) */
function kpiLinkSheetEnsure_() {
  var sheet = kpiLinkSheetIfAny_();
  if (sheet) return sheet;
  sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).insertSheet(KPILINK_SHEET);
  sheet.getRange(1, 1, 1, KPILINK_HEADERS.length).setValues([KPILINK_HEADERS]).setFontWeight("bold").setBackground("#e0f2fe");
  sheet.setFrozenRows(1);
  return sheet;
}

function kpiLinkSplitIds_(v) {
  var seen = {}, out = [];
  (v === null || v === undefined ? "" : v).toString().split(",").forEach(function(s) {
    s = s.trim();
    if (s && !seen[s]) { seen[s] = true; out.push(s); }
  });
  return out;
}

/** ลิงก์ที่ใช้งานอยู่ของปีงบ fy → [{ row, id, title, url, ids, note, rev, at, by, createdAt, createdBy }] */
function kpiLinkRead_(sheet, fy) {
  var out = [];
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[0]) !== String(fy) || !r[1] || String(r[11]) === KPILINK_DELETED) continue;
    out.push({
      row: i + 1, id: r[1].toString(), title: (r[2] || "").toString(), url: (r[3] || "").toString(), ids: kpiLinkSplitIds_(r[4]),
      note: (r[5] || "").toString(), rev: Number(r[6]) || 0, at: formatStamp_(r[7]), by: (r[8] || "").toString(),
      createdAt: formatStamp_(r[9]), createdBy: (r[10] || "").toString()
    });
  }
  return out;
}

/** ลิงก์ต้องเป็น Google Drive/Docs (https) เท่านั้น — คืนข้อความผิดพลาด หรือ "" เมื่อใช้ได้ */
function kpiLinkUrlError_(url) {
  if (!url) return "กรุณาวางลิงก์เอกสาร";
  if (url.length > KPILINK_MAX_URL) return "ลิงก์ยาวเกินไป";
  if (!/^https:\/\/(drive|docs)\.google\.com\/[^\s"'<>]+$/.test(url)) return "ลิงก์ต้องเป็นของ Google Drive หรือ Google Docs (ขึ้นต้นด้วย https://drive.google.com/ หรือ https://docs.google.com/)";
  return "";
}

/**
 * สิทธิ์ของผู้ใช้ต่อตัวชี้วัดในชุด wanted ({รหัส: true}) ของปีงบ fy → { รหัส: { view, edit } } (เฉพาะรหัสที่มีในชีตปีงบ)
 * edit = แก้รายละเอียดได้ (เงื่อนไขเดียวกับการแก้ช่องที่มา/สูตร)
 */
function kpiLinkPerms_(user, fy, wanted) {
  var out = {};
  var sheet = getFiscalSheet_(fy);
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    var id = data[r][0].toString().trim();
    if (!wanted[id] || out[id]) continue;
    var perm = getKpiPermission_(user, rowToKpi_(data[r]), fy);
    out[id] = { view: !!perm.view, edit: !!perm.view && !!perm.editDetails };
  }
  return out;
}

/** ลิงก์ในมุมของผู้ใช้: เห็นเฉพาะตัวชี้วัดที่ตัวเองดูได้ · hidden = จำนวนตัวชี้วัดในลิงก์ที่ผู้ใช้ไม่เห็น · ไม่เห็นสักตัว = null */
function kpiLinkView_(link, perms) {
  var visible = link.ids.filter(function(id) { return perms[id] && perms[id].view; });
  if (!visible.length) return null;
  var editable = visible.filter(function(id) { return perms[id].edit; });
  return {
    id: link.id, title: link.title, url: link.url, note: link.note, ids: visible, editableIds: editable,
    hidden: link.ids.length - visible.length, rev: link.rev, at: link.at, by: link.by, createdAt: link.createdAt, createdBy: link.createdBy,
    canEdit: editable.length > 0
  };
}

/** ลิงก์เอกสารแนบทั้งหมดของปีงบ fy ที่ผู้ใช้เห็น (ผูกกับตัวชี้วัดที่ดูได้อย่างน้อย 1 ตัว) */
function getKpiLinks(token, fy) {
  try {
    var user = requireUser_(token);
    fy = resolveFiscalYear_(fy);
    var links = kpiLinkRead_(kpiLinkSheetIfAny_(), fy);
    var wanted = {};
    links.forEach(function(l) { l.ids.forEach(function(id) { wanted[id] = true; }); });
    var perms = links.length ? kpiLinkPerms_(user, fy, wanted) : {};
    var out = [];
    links.forEach(function(l) { var v = kpiLinkView_(l, perms); if (v) out.push(v); });
    return { success: true, fy: fy, links: out };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function kpiLinkConflict_(link) {
  return { success: false, conflict: true, current: { title: link.title, url: link.url, rev: link.rev, at: link.at, by: link.by },
    message: "ลิงก์นี้ถูกแก้ไขโดย " + (link.by || "ผู้ใช้อื่น") + (link.at ? " เมื่อ " + link.at : "") + " ระหว่างที่คุณกำลังแก้ไข" };
}

/**
 * เพิ่มหรือแก้ลิงก์ — p = { id (ว่าง = เพิ่มใหม่), title, url, note, ids, baseRev, force }
 * เพิ่มใหม่: ตัวชี้วัดที่เลือกต้องแก้รายละเอียดได้ทุกตัว
 * แก้ลิงก์เดิม: ต้องแก้ได้อย่างน้อย 1 ตัวในลิงก์ · เพิ่ม/เอาออกได้เฉพาะตัวที่แก้ได้ (ตัวที่แก้ไม่ได้คงเดิม)
 */
function saveKpiLink(token, fy, p) {
  var lock = null;
  try {
    var user = requireUser_(token);
    p = p || {};
    var title = arabicDigits_((p.title || "").toString()).replace(/\s+/g, " ").trim();
    var url = (p.url || "").toString().trim();
    var note = arabicDigits_((p.note || "").toString()).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
    if (!title) return { success: false, message: "กรุณาใส่ชื่อเอกสาร" };
    if (title.length > KPILINK_MAX_TITLE) return { success: false, message: "ชื่อเอกสารยาวเกินไป (ไม่เกิน " + KPILINK_MAX_TITLE + " ตัวอักษร)" };
    var urlErr = kpiLinkUrlError_(url);
    if (urlErr) return { success: false, message: urlErr };
    if (note.length > KPILINK_MAX_NOTE) return { success: false, message: "หมายเหตุยาวเกินไป (ไม่เกิน " + KPILINK_MAX_NOTE + " ตัวอักษร)" };
    var want = kpiLinkSplitIds_((p.ids || []).join(","));
    if (!want.length) return { success: false, message: "กรุณาเลือกตัวชี้วัดอย่างน้อย 1 ตัว" };
    if (want.length > KPILINK_MAX_IDS) return { success: false, message: "เลือกตัวชี้วัดได้ไม่เกิน " + KPILINK_MAX_IDS + " ตัวต่อลิงก์" };

    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var linkId = (p.id || "").toString().trim();
    var sheet = kpiLinkSheetIfAny_();
    var cur = null;
    if (linkId) {
      cur = kpiLinkRead_(sheet, fy).filter(function(l) { return l.id === linkId; })[0] || null;
      if (!cur) return { success: false, message: "ไม่พบลิงก์นี้ (อาจถูกลบไปแล้ว)" };
    }
    var wanted = {};
    want.forEach(function(id) { wanted[id] = true; });
    if (cur) cur.ids.forEach(function(id) { wanted[id] = true; });
    var perms = kpiLinkPerms_(user, fy, wanted);
    var canEdit = function(id) { return !!(perms[id] && perms[id].edit); };

    var finalIds;
    if (cur) {
      if (!cur.ids.some(canEdit)) return { success: false, message: "ไม่มีสิทธิ์แก้ไขลิงก์นี้ (ต้องแก้ไขรายละเอียดของตัวชี้วัดในลิงก์ได้)" };
      if (!p.force && p.baseRev !== undefined && p.baseRev !== null && Number(p.baseRev) !== cur.rev) return kpiLinkConflict_(cur);
      var added = want.filter(function(id) { return cur.ids.indexOf(id) === -1; });
      var bad = added.filter(function(id) { return !canEdit(id); });
      if (bad.length) return { success: false, message: "ไม่มีสิทธิ์แนบกับตัวชี้วัด " + bad.slice(0, 3).join(", ") + (bad.length > 3 ? " และอีก " + (bad.length - 3) + " ตัว" : "") };
      var mine = want.filter(canEdit);
      if (!mine.length) return { success: false, message: "ต้องเลือกตัวชี้วัดอย่างน้อย 1 ตัว (ถ้าไม่ต้องการลิงก์นี้ ให้กดลบลิงก์)" };
      // ตัวที่ผู้ใช้แก้ไม่ได้ (หรือไม่เห็น) คงเดิมตามลำดับเดิม · ตัวที่แก้ได้ตามที่เลือกไว้
      finalIds = cur.ids.filter(function(id) { return !canEdit(id); }).concat(mine);
    } else {
      var denied = want.filter(function(id) { return !canEdit(id); });
      if (denied.length) return { success: false, message: "ไม่มีสิทธิ์แนบกับตัวชี้วัด " + denied.slice(0, 3).join(", ") + (denied.length > 3 ? " และอีก " + (denied.length - 3) + " ตัว" : "") + " (แนบได้เฉพาะตัวชี้วัดที่คุณแก้รายละเอียดได้)" };
      finalIds = want;
    }

    var stamp = nowStamp_(), joined = finalIds.join(", ");
    if (cur) {
      var same = cur.title === title && cur.url === url && cur.note === note && cur.ids.length === finalIds.length && cur.ids.slice().sort().join(",") === finalIds.slice().sort().join(",");
      if (same) return { success: true, changed: false, id: cur.id, rev: cur.rev };
      sheet.getRange(cur.row, 3, 1, 7).setValues([[title, url, joined, note, cur.rev + 1, stamp, user.username]]);
      linkId = cur.id;
    } else {
      sheet = kpiLinkSheetEnsure_();
      linkId = "L" + Utilities.getUuid().replace(/-/g, "").slice(0, 10);
      var row = sheet.getLastRow() + 1;
      sheet.getRange(row, 2, 1, KPILINK_HEADERS.length - 1).setNumberFormat("@"); // ข้อความล้วน — รหัสตัวชี้วัด/ข้อความที่ขึ้นต้นด้วย = หรือ + ต้องไม่ถูกตีเป็นสูตร/ตัวเลข (ตั้งก่อนเขียนค่า)
      sheet.getRange(row, 1, 1, KPILINK_HEADERS.length).setValues([[fy, linkId, title, url, joined, note, 1, stamp, user.username, stamp, user.username, KPILINK_ACTIVE]]);
    }
    touchUser_(user, "edit");
    bumpDataVersion_(fy, [], user, KPILINK_DOC);
    return { success: true, changed: true, id: linkId };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/**
 * ลบลิงก์ออกจากตัวชี้วัดที่ผู้ใช้แก้ได้ · ถ้าไม่เหลือตัวชี้วัดใดเลย ลิงก์ถูกลบ (สถานะ "ลบ") · ถ้ายังมีตัวชี้วัดที่ผู้ใช้แก้ไม่ได้ ลิงก์ยังอยู่กับตัวเหล่านั้น
 */
function deleteKpiLink(token, fy, linkId, baseRev, force) {
  var lock = null;
  try {
    var user = requireUser_(token);
    linkId = (linkId || "").toString().trim();
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var sheet = kpiLinkSheetIfAny_();
    var cur = kpiLinkRead_(sheet, fy).filter(function(l) { return l.id === linkId; })[0] || null;
    if (!cur) return { success: false, message: "ไม่พบลิงก์นี้ (อาจถูกลบไปแล้ว)" };
    var wanted = {};
    cur.ids.forEach(function(id) { wanted[id] = true; });
    var perms = kpiLinkPerms_(user, fy, wanted);
    var canEdit = function(id) { return !!(perms[id] && perms[id].edit); };
    if (!cur.ids.some(canEdit)) return { success: false, message: "ไม่มีสิทธิ์ลบลิงก์นี้ (ต้องแก้ไขรายละเอียดของตัวชี้วัดในลิงก์ได้)" };
    if (!force && baseRev !== undefined && baseRev !== null && Number(baseRev) !== cur.rev) return kpiLinkConflict_(cur);
    var remaining = cur.ids.filter(function(id) { return !canEdit(id); }), stamp = nowStamp_();
    if (remaining.length) {
      sheet.getRange(cur.row, 5, 1, 1).setValue(remaining.join(", "));
      sheet.getRange(cur.row, 7, 1, 3).setValues([[cur.rev + 1, stamp, user.username]]);
    } else {
      sheet.getRange(cur.row, 7, 1, 3).setValues([[cur.rev + 1, stamp, user.username]]);
      sheet.getRange(cur.row, 12, 1, 1).setValue(KPILINK_DELETED);
    }
    touchUser_(user, "edit");
    bumpDataVersion_(fy, [], user, KPILINK_DOC);
    return { success: true, removedAll: remaining.length === 0, remaining: remaining.length };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}
