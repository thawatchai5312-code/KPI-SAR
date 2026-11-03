/**
 * 📤 อัปโหลดไฟล์เป็นเอกสารแนบตัวชี้วัด (ข้างช่องวางลิงก์ — docs/upload-attachments-plan.md)
 *  - ไฟล์เก็บใน Google Drive ของเจ้าของเว็บแอป (โฟลเดอร์ "KPI SAR - ไฟล์แนบ (อัปโหลดผ่านระบบ)" › "ปีงบ <ปี>") แชร์แบบ "ทุกคนที่มีลิงก์ดูได้"
 *  - บันทึกเป็นแถวใน KPI_Links ผ่าน saveKpiLink ตัวเดิม (สิทธิ์/ผูกหลายตัวชี้วัด/อัปเดตเครื่องอื่นชุดเดียวกับลิงก์) + คอลัมน์ M–P: ที่มา=อัปโหลด · รหัสไฟล์ · ชื่อเดิม · ขนาด
 *  - ชนิดไฟล์: PDF · JPG/PNG · Word/Excel/PowerPoint (แปลงเป็น Google Docs/Sheets/Slides ตอนอัปโหลด — น้องเป้าอ่านได้) · ≤ 10 MB
 *  - ตรวจสิทธิ์ก่อนสร้างไฟล์ (ไม่มีไฟล์กำพร้า) · ตรวจนามสกุล + ลายเซ็นไฟล์ + ขนาด + โควตารายวัน
 *  - ลบเอกสารแนบ → ไม่เหลือแถวใดใช้ไฟล์ (ทุกปีงบ) → ย้ายไปโฟลเดอร์ "ลบแล้ว" + ปิดการแชร์ (ไม่ลบถาวร) · ไฟล์ที่ผู้ใช้วางลิงก์เองไม่แตะ
 *  ต้องการสิทธิ์ Drive เต็ม + Advanced Drive Service (appsscript.json) — เจ้าของสคริปต์ Run uploadAuthorizeOnce ใน editor ครั้งเดียวก่อนใช้
 */

var UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
var UPLOAD_ROOT_NAME = "KPI SAR - ไฟล์แนบ (อัปโหลดผ่านระบบ)";
var UPLOAD_ROOT_PROP = "UPLOAD_ROOT_ID_V1";
var UPLOAD_TRASH_NAME = "ลบแล้ว";
var UPLOAD_DAILY_LIMIT = 30;
var UPLOAD_GDOC = "application/vnd.google-apps.document";
var UPLOAD_GSHEET = "application/vnd.google-apps.spreadsheet";
var UPLOAD_GSLIDES = "application/vnd.google-apps.presentation";
// นามสกุล → { mime: ชนิดของไฟล์ต้นทาง, sig: ลายเซ็นไฟล์, convertTo: ชนิด Google ที่แปลงให้ (ไม่มี = เก็บตามเดิม) }
var UPLOAD_TYPES = {
  pdf: { mime: "application/pdf", sig: "pdf" },
  jpg: { mime: "image/jpeg", sig: "jpg" },
  jpeg: { mime: "image/jpeg", sig: "jpg" },
  png: { mime: "image/png", sig: "png" },
  doc: { mime: "application/msword", sig: "ole", convertTo: UPLOAD_GDOC },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sig: "zip", convertTo: UPLOAD_GDOC },
  xls: { mime: "application/vnd.ms-excel", sig: "ole", convertTo: UPLOAD_GSHEET },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sig: "zip", convertTo: UPLOAD_GSHEET },
  ppt: { mime: "application/vnd.ms-powerpoint", sig: "ole", convertTo: UPLOAD_GSLIDES },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", sig: "zip", convertTo: UPLOAD_GSLIDES }
};

/** เจ้าของสคริปต์ Run ครั้งเดียวใน editor เพื่ออนุญาตสิทธิ์ Drive เต็ม (ก่อน deploy เวอร์ชันที่ใช้ฟังก์ชันอัปโหลด) */
function uploadAuthorizeOnce() {
  var name = DriveApp.getRootFolder().getName();
  Drive.Files.list({ pageSize: 1 });
  return "อนุญาตแล้ว (Drive: " + name + ")";
}

// ---------------------------------------------------------------- ฟังก์ชันล้วน

/** ชื่อไฟล์ที่ปลอดภัย: ตัด / \ : * ? " < > | และอักขระควบคุม · ยาว ≤ 150 */
function uploadSafeName_(name) {
  var n = (name || "").toString().replace(/[\u0000-\u001f\u007f\/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return (n || "ไฟล์").slice(0, 150);
}

function uploadExt_(name) {
  var m = /\.([A-Za-z0-9]{2,5})$/.exec((name || "").toString().trim());
  return m ? m[1].toLowerCase() : "";
}

/** ลายเซ็นไฟล์ (bytes เป็น signed ตาม Utilities.base64Decode) ตรงกับนามสกุลหรือไม่ */
function uploadSigOk_(sig, b) {
  function u(i) { return (((b && b[i]) || 0) + 256) % 256; }
  if (sig === "pdf") return u(0) === 0x25 && u(1) === 0x50 && u(2) === 0x44 && u(3) === 0x46;
  if (sig === "png") return u(0) === 0x89 && u(1) === 0x50 && u(2) === 0x4E && u(3) === 0x47;
  if (sig === "jpg") return u(0) === 0xFF && u(1) === 0xD8 && u(2) === 0xFF;
  if (sig === "zip") return u(0) === 0x50 && u(1) === 0x4B && u(2) === 0x03 && u(3) === 0x04;
  if (sig === "ole") return u(0) === 0xD0 && u(1) === 0xCF && u(2) === 0x11 && u(3) === 0xE0;
  return false;
}

// ---------------------------------------------------------------- โฟลเดอร์

/** โฟลเดอร์หลัก (จำ id ใน Script Property · หาไม่เจอ/อยู่ในถังขยะ = สร้างใหม่) — ไม่แชร์ (แชร์ทีละไฟล์) */
function uploadRoot_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty(UPLOAD_ROOT_PROP);
  if (id) {
    try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {}
  }
  var folder = DriveApp.createFolder(UPLOAD_ROOT_NAME);
  props.setProperty(UPLOAD_ROOT_PROP, folder.getId());
  return folder;
}

function uploadFolder_(root, name) {
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

// ---------------------------------------------------------------- โควตา

function uploadQuotaKey_(username) {
  return "upl_" + username + "_" + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd");
}
function uploadUsed_(username) { return parseInt(CacheService.getScriptCache().get(uploadQuotaKey_(username)) || "0", 10) || 0; }
function uploadConsume_(username) { CacheService.getScriptCache().put(uploadQuotaKey_(username), String(uploadUsed_(username) + 1), 25 * 3600); }
function uploadRefund_(username) { var n = uploadUsed_(username); if (n > 0) CacheService.getScriptCache().put(uploadQuotaKey_(username), String(n - 1), 25 * 3600); }

// ---------------------------------------------------------------- เลิกใช้ไฟล์

/** ย้ายไฟล์ไปโฟลเดอร์ "ลบแล้ว" + ปิดการแชร์ (ไม่ลบถาวร) */
function uploadRetire_(fileId) {
  var file = DriveApp.getFileById(fileId);
  file.moveTo(uploadFolder_(uploadRoot_(), UPLOAD_TRASH_NAME));
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
}

/**
 * ไม่มีแถวลิงก์ที่ใช้งานอยู่ (ทุกปีงบ) อ้างไฟล์นี้แล้ว และเป็นไฟล์ที่อัปโหลดผ่านระบบ → uploadRetire_
 * ไฟล์ที่ผู้ใช้วางลิงก์เอง (ไม่มีแถวที่มา=อัปโหลด รหัสตรงกัน) ไม่แตะ
 */
function uploadRetireIfUnused_(fileId) {
  if (!fileId) return false;
  var sheet = kpiLinkSheetIfAny_();
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues(), ours = false, used = false;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var mine = String(r[13] || "") === fileId || aiFileId_((r[3] || "").toString()) === fileId;
    if (!mine) continue;
    if (String(r[12] || "") === KPILINK_SRC_UPLOAD && String(r[13] || "") === fileId) ours = true;
    if (String(r[11]) !== KPILINK_DELETED) used = true;
  }
  if (!ours || used) return false;
  uploadRetire_(fileId);
  return true;
}

// ---------------------------------------------------------------- จุดเรียกจากหน้าเว็บ

/**
 * อัปโหลดไฟล์ + แนบกับตัวชี้วัด — p = { title, note, ids, file: { name, size, data (base64 ไม่มี prefix) } }
 * สำเร็จ: { success, id, url, converted }
 */
function uploadKpiLinkFile(token, fy, p) {
  var user = null, consumed = false, fileId = "";
  try {
    user = requireUser_(token);
    p = p || {};
    var f = p.file || {};
    fy = resolveFiscalYear_(fy);
    var title = arabicDigits_((p.title || "").toString()).replace(/\s+/g, " ").trim();
    var note = (p.note || "").toString();
    if (!title) return { success: false, message: "กรุณาใส่ชื่อเอกสาร" };
    if (title.length > KPILINK_MAX_TITLE) return { success: false, message: "ชื่อเอกสารยาวเกินไป (ไม่เกิน " + KPILINK_MAX_TITLE + " ตัวอักษร)" };
    if (note.length > KPILINK_MAX_NOTE) return { success: false, message: "หมายเหตุยาวเกินไป (ไม่เกิน " + KPILINK_MAX_NOTE + " ตัวอักษร)" };
    var want = kpiLinkSplitIds_((p.ids || []).join(","));
    if (!want.length) return { success: false, message: "กรุณาเลือกตัวชี้วัดอย่างน้อย 1 ตัว" };
    if (want.length > KPILINK_MAX_IDS) return { success: false, message: "เลือกตัวชี้วัดได้ไม่เกิน " + KPILINK_MAX_IDS + " ตัวต่อเอกสาร" };

    // สิทธิ์ก่อนสร้างไฟล์ (กันไฟล์กำพร้า) — เงื่อนไขเดียวกับ saveKpiLink: ต้องแก้รายละเอียดได้ทุกตัวที่เลือก
    var wanted = {};
    want.forEach(function(id) { wanted[id] = true; });
    var perms = kpiLinkPerms_(user, fy, wanted);
    var denied = want.filter(function(id) { return !(perms[id] && perms[id].edit); });
    if (denied.length) return { success: false, message: "ไม่มีสิทธิ์แนบกับตัวชี้วัด " + denied.slice(0, 3).join(", ") + (denied.length > 3 ? " และอีก " + (denied.length - 3) + " ตัว" : "") + " (ต้องแก้ไขรายละเอียดตัวชี้วัดนั้นได้)" };

    if (uploadUsed_(user.username) >= UPLOAD_DAILY_LIMIT) return { success: false, message: "วันนี้อัปโหลดครบ " + UPLOAD_DAILY_LIMIT + " ไฟล์แล้ว ใช้ได้อีกครั้งพรุ่งนี้" };

    var origName = uploadSafeName_(f.name), ext = uploadExt_(origName), type = UPLOAD_TYPES[ext];
    if (!type) return { success: false, message: "ชนิดไฟล์ไม่รองรับ (รองรับ PDF รูป JPG/PNG Word Excel PowerPoint)" };
    var b64 = (f.data || "").toString();
    if (!b64) return { success: false, message: "ไม่พบข้อมูลไฟล์" };
    if (b64.length > Math.ceil(UPLOAD_MAX_BYTES * 4 / 3) + 16) return { success: false, message: "ไฟล์ใหญ่เกิน 10 MB" };
    var bytes = Utilities.base64Decode(b64);
    if (bytes.length > UPLOAD_MAX_BYTES) return { success: false, message: "ไฟล์ใหญ่เกิน 10 MB" };
    if (bytes.length === 0) return { success: false, message: "ไฟล์ว่างเปล่า" };
    if (!uploadSigOk_(type.sig, bytes)) return { success: false, message: "เนื้อไฟล์ไม่ตรงกับนามสกุล ." + ext + " (ไฟล์อาจเสียหรือเปลี่ยนนามสกุล)" };

    // โฟลเดอร์ (ใต้ lock กันสร้างซ้ำเมื่ออัปโหลดพร้อมกันครั้งแรก) แล้วปล่อย lock ก่อนอัปโหลดจริง (Drive ช้า)
    var folder, lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try { folder = uploadFolder_(uploadRoot_(), "ปีงบ " + fy); } finally { lock.releaseLock(); }

    uploadConsume_(user.username); consumed = true;
    var stampDay = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
    var driveName = uploadSafeName_(fy + " " + stampDay + " " + origName);
    var blob = Utilities.newBlob(bytes, type.mime, driveName), file;
    if (type.convertTo) {
      var made = Drive.Files.create({ name: driveName.replace(/\.[A-Za-z0-9]{2,5}$/, ""), mimeType: type.convertTo, parents: [folder.getId()] }, blob);
      file = DriveApp.getFileById(made.id);
    } else {
      file = folder.createFile(blob);
    }
    fileId = file.getId();
    try { file.setDescription("อัปโหลดผ่านระบบ KPI SAR โดย " + user.username + " · ตัวชี้วัด " + want.slice(0, 5).join(", ")); } catch (e0) {}
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = file.getUrl();

    // บันทึกเป็นเอกสารแนบด้วย saveKpiLink ตัวเดิม (ตรวจสิทธิ์/lock/bump ในนั้น)
    var res = saveKpiLink(token, fy, { title: title, url: url, note: note, ids: want });
    if (!res || !res.success) {
      try { uploadRetire_(fileId); } catch (e1) {}
      if (consumed) uploadRefund_(user.username);
      return res || { success: false, message: "บันทึกเอกสารแนบไม่สำเร็จ" };
    }
    // คอลัมน์ M–P ของแถวใหม่ (ใต้ lock)
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var sheet = kpiLinkSheetEnsure_();
      kpiLinkEnsureUploadCols_(sheet);
      var row = kpiLinkRead_(sheet, fy).filter(function(l) { return l.id === res.id; })[0];
      if (row) sheet.getRange(row.row, KPILINK_HEADERS.length + 1, 1, KPILINK_UP_HEADERS.length).setNumberFormat("@").setValues([[KPILINK_SRC_UPLOAD, fileId, origName, String(bytes.length)]]);
    } finally { lock.releaseLock(); }
    return { success: true, id: res.id, url: url, converted: !!type.convertTo };
  } catch (e) {
    if (fileId) { try { uploadRetire_(fileId); } catch (e2) {} }
    if (consumed && user) uploadRefund_(user.username);
    var msg = String(e && e.message ? e.message : e).replace(/^Error: /, "");
    if (/Drive|drive|authorization|permission/i.test(msg) && !/SESSION_EXPIRED/.test(msg)) msg = "อัปโหลดไม่สำเร็จ: " + msg + " (ถ้าเพิ่งอัปเดตระบบ ให้ผู้ดูแลระบบอนุญาตสิทธิ์ Drive ก่อน)";
    return { success: false, message: msg };
  }
}
