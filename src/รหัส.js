/**
 * ระบบจัดการตัวชี้วัดโรงพยาบาล (Hospital KPI Management System)
 * โค้ดฝั่ง Server-side (Code.gs) - เวอร์ชัน Single Database & รองรับเครื่องหมายในเป้าหมาย
 */

// อัปเดตลิงก์ฐานข้อมูลเป็นไฟล์ใหม่
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/12UKdv0Y8fum7aXh2Uk05ZtcxM7SMatA_CusuC3j51gQ/edit?gid=404868087#gid=404868087";
const DATABASE_SHEET_NAME = "Database";
const USERS_SHEET_NAME = "Users";

// ระบบต้นทาง: ระบบจัดการตัวชี้วัดคุณภาพการพยาบาล (ฝ่ายการพยาบาลเป็นต้นทางหลัก ดึงข้อมูลเข้ามาไว้ที่นี่)
const NURSING_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1LmpMCQ-ijN_JTsXlokiQ4YtdwpiefXVMIMnMKmkQLfY/edit?gid=2041776270#gid=2041776270";
const NURSING_DATABASE_SHEET_NAME = "Database";
const NURSING_SYNC_ID_PREFIX = "NURSE-";
const NURSING_SYNC_FUNCTION_NAME = "syncFromNursingSystem";
// หยุดการซิงค์จากระบบพยาบาลไว้ก่อน (ฝ่ายการพยาบาลจะย้ายมาใช้เว็บนี้ ใช้ระดับตัวชี้วัด "ฝ่ายการพยาบาล")
// โค้ดซิงค์ด้านล่างยังอ้างชีต Database เดิม ถ้าจะเปิดใช้ต้องปรับให้เขียนลงชีตปีงบก่อน
const NURSING_SYNC_ENABLED = false;
const NURSING_SYNC_PAUSED_MESSAGE = "ปิดการซิงค์ข้อมูลจากระบบฝ่ายการพยาบาลชั่วคราว";

function doGet() {
  var out = HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('ระบบจัดการตัวชี้วัดโรงพยาบาล')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  try { out.setFaviconUrl(APP_ICON_URL); } catch (e) { console.error("ตั้งไอคอนเว็บไม่สำเร็จ: " + e); } // ไอคอนแท็บเบราว์เซอร์/ทางลัดบนมือถือ (ไฟล์ใน repo: assets/icon-192.png)
  return out;
}
var APP_ICON_URL = "https://raw.githubusercontent.com/thawatchai5312-code/KPI-SAR/claude/apps-script-auto-deploy-nhxswh/assets/icon-192.png";

function cleanValue_(val) {
  if (val === "" || val === undefined || val === null) return null;
  var str = val.toString().trim().toUpperCase();
  if (str === "NA" || str === "N/A" || str === "-" || isNaN(val)) {
    return null;
  }
  return Number(val);
}

/** ผลรายเดือนจากชีต: "-" = เดือนนั้นไม่มีเคส (ไม่นับในค่าเฉลี่ย แต่นับว่ากรอกแล้ว) · NA/ว่าง/ข้อความอื่น = null เหมือนเดิม */
function cleanMonth_(val) {
  if (typeof val === "string" && val.trim() === "-") return NO_CASE_;
  return cleanValue_(val);
}

/** ผลรายเดือนจากหน้าเว็บ: ตัวเลข / "-" (หรือ NA, N/A → เก็บเป็น "-") / ว่าง → null */
function monthOrNull_(v) {
  if (typeof v === "string" && ["-", "NA", "N/A"].indexOf(v.trim().toUpperCase()) !== -1) return NO_CASE_;
  return numberOrNull_(v);
}

var NO_CASE_ = "-";

function rowToKpi_(row) {
  var part = row[2] ? row[2].toString().trim() : "ทั่วไป";
  var category = row[3] ? row[3].toString().trim() : "ทั่วไป";
  return {
    id: row[0].toString().trim(),
    no: row[1] ? row[1].toString().trim() : "",
    part: part,
    category: category,
    // หมวดทั้งหมดที่ตัวชี้วัดนี้แสดงอยู่ (หมวดแรก = หมวดหลัก) — ตัวเดียวกัน แก้ที่ไหนก็เปลี่ยนทุกที่
    cats: kpiCats_({ cats: [{ part: part, category: category }].concat(parseExtraCats_(row[EXTRA_CATS_COL - 1])) }),
    name: row[4] ? row[4].toString().trim() : "",
    // ดึงค่าเป้าหมายเป็นข้อความ (String) เพื่อเก็บเครื่องหมายต่างๆ ไว้
    target: row[5] ? row[5].toString().trim() : "",
    years: [
      cleanValue_(row[6]), cleanValue_(row[7]), cleanValue_(row[8]), cleanValue_(row[9]), cleanValue_(row[10])
    ],
    months: [
      cleanMonth_(row[11]), cleanMonth_(row[12]), cleanMonth_(row[13]), cleanMonth_(row[14]),
      cleanMonth_(row[15]), cleanMonth_(row[16]), cleanMonth_(row[17]), cleanMonth_(row[18]),
      cleanMonth_(row[19]), cleanMonth_(row[20]), cleanMonth_(row[21]), cleanMonth_(row[22])
    ],
    templateDetails: row[23] ? row[23].toString().trim() : "",
    dataSource: row[24] ? row[24].toString().trim() : "",
    owner: row[25] ? row[25].toString().trim() : "",
    parentId: row[PARENT_COL - 1] ? row[PARENT_COL - 1].toString().trim() : "", // ตัวชี้วัดแม่ (ว่าง = ไม่ใช่ตัวย่อย)
    group: row[GROUP_COL - 1] ? row[GROUP_COL - 1].toString().trim() : "",      // หัวข้อกลุ่มในหมวด
    department: row[26] ? row[26].toString().trim() : "",
    summaryMethod: normalizeSummaryMethod_(row[SUMMARY_COL - 1]),
    analysisUpdatedAt: formatStamp_(row[ANALYSIS_COL - 1]),
    frequency: normalizeFrequency_(row[FREQ_COL - 1]),
    levels: normalizeLevels_(row[28]),
    level: normalizeLevels_(row[28]).slice(-1)[0], // ระดับสูงสุด ใช้แสดงผล
    editedAt: formatStamp_(row[STAMP_EDIT_AT_COL - 1]),
    editedBy: row[STAMP_EDIT_BY_COL - 1] ? row[STAMP_EDIT_BY_COL - 1].toString() : "",
    viewedAt: formatStamp_(row[STAMP_VIEW_AT_COL - 1]),
    viewedBy: row[STAMP_VIEW_BY_COL - 1] ? row[STAMP_VIEW_BY_COL - 1].toString() : "",
    rev: rowRev_(row) // ลายนิ้วมือข้อมูลแถว (Live.js) — ตรวจการแก้ชนกัน/อัปเดตอัตโนมัติ
  };
}

// ค่าจากหน้าเว็บ: ว่าง/ไม่ใช่ตัวเลข → null
function numberOrNull_(v) {
  return v === undefined || v === "" || v === null || isNaN(v) ? null : Number(v);
}

// คืนเฉพาะตัวชี้วัดที่ผู้ใช้มีสิทธิ์ดูในปีงบที่เลือก พร้อมสิทธิ์แก้ไขและช่องผลย้อนหลังที่ถูกล็อก
function getAllData(token, requestedFy) {
  try {
    var user = requireUser_(token);
    ensureFiscalSheets_();
    migrateNursingUnit_(); // ต้องทำก่อน (อ่านระดับ "ฝ่ายการพยาบาล" เดิมก่อนถูกปรับ)
    migrateUnitCategories_();
    migrateOwnerLevels_();
    var years = listFiscalYears_();
    var currentFy = getCurrentFiscalYear_();
    if (years.length === 0) return { success: true, data: [], fy: currentFy, currentFy: currentFy, years: [] };

    var fy = resolveFiscalYear_(requestedFy);
    var dataV = dataVersion_(readChangeLog_()); // อ่านเลขรุ่นก่อนอ่านชีต: ถ้ามีคนแก้ระหว่างนี้ รอบอัปเดตถัดไปจะดึงมาให้
    var sources = getAnnualSources_(fy);
    var data = getFiscalSheet_(fy).getDataRange().getValues();
    var allData = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      var kpi = rowToKpi_(data[i]);
      if (!getKpiPermission_(user, kpi, fy).view) continue;
      allData.push(decorateKpi_(user, fy, kpi, sources));
    }
    // ลำดับหมวดย่อยในมุมมองหน่วยงาน: หัวข้อของหน่วยตามลำดับในไฟล์ NSO
    return { success: true, data: allData, fy: fy, currentFy: currentFy, years: years, headings: viewHeadings_(), pctGroups: renamePctGroups_(), unitRenames: renameUnitMapForClient_(), dataV: dataV };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

// ข้อมูลตัวชี้วัดที่ส่งให้หน้าเว็บ: เติมสิทธิ์แก้ไข ธง "ของฉัน" และช่องผลย้อนหลังที่ถูกล็อก
function decorateKpi_(user, fy, kpi, sources) {
  var perm = getKpiPermission_(user, kpi, fy);
  kpi.canEditResults = perm.editResults;
  kpi.canEditDetails = perm.editDetails;
  kpi.mine = perm.mine;
  kpi.isOwner = perm.isOwner; // ผู้ใช้เป็นผู้รับผิดชอบ (หรือเป็นหัวหน้าหน่วยของตัวชี้วัดที่ระบุ "หัวหน้าหน่วย")
  kpi.inDept = perm.inDept; // ตัวชี้วัดของหน่วยงานที่ผู้ใช้สังกัด (ใช้กับตัวกรองระดับหน่วยงาน/QA ฝั่งหน้าเว็บ)
  // ผอ./QMR เห็นเฉพาะหมวด Part I–IV ของตัวชี้วัดที่ไม่ใช่ของตัวเอง
  kpi.cats = visibleCats_(user, kpi, perm);
  kpi.part = kpi.cats[0].part;
  kpi.category = kpi.cats[0].category;
  // ผลทั้งปีของปีที่มีชีตต้นทางอยู่ (และมีตัวชี้วัดนี้) แก้ได้เฉพาะ admin, ผอ., QMR
  kpi.lockedYears = sources.map(function(m) { return !!(m && m[kpi.id]); });
  kpi.pctOrder = viewPctOrder_(kpi.id); // ลำดับตามไฟล์ PCT (เรียงการ์ดในหมวด PCT) — ไม่ใช่ตัว PCT = null
  return kpi;
}

/**
 * KPI รายบุคคล (หน้าสรุปรายงาน): ตัวชี้วัดทุกตัวในปีงบ fy ที่ `name` เป็นผู้รับผิดชอบ — ดูอย่างเดียว ไม่ขึ้นกับสิทธิ์ของคนค้น
 * ใช้ได้เฉพาะหัวหน้าหน่วยขึ้นไป · นับ "หัวหน้าหน่วย"/"หัวหน้าตึก" ตามหน่วยของคนที่ค้นด้วย (ใช้ getKpiPermission_ ของคนนั้น)
 */
function getKpisOfPerson(token, requestedFy, name) {
  try {
    var user = requireUser_(token);
    if (user.tier === "staff") return { success: false, message: "ใช้ได้เฉพาะหัวหน้าหน่วยขึ้นไป" };
    name = (name || "").toString().trim();
    if (!name) return { success: false, message: "กรุณาระบุชื่อผู้รับผิดชอบ" };
    ensureFiscalSheets_();
    var fy = resolveFiscalYear_(requestedFy);
    var usersSheet = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
    var target = (usersSheet ? readUsers_(usersSheet) : []).filter(function(u) { return u.username === name; })[0]
      || { username: name, tier: "staff", depts: [] };
    var dataV = dataVersion_(readChangeLog_());
    var sources = getAnnualSources_(fy);
    var data = getFiscalSheet_(fy).getDataRange().getValues();
    var out = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      var kpi = rowToKpi_(data[i]);
      if (!getKpiPermission_(target, kpi, fy).isOwner) continue;
      kpi.canEditResults = false;
      kpi.canEditDetails = false;
      kpi.mine = false;
      kpi.isOwner = true;
      kpi.inDept = false;
      kpi.cats = kpiCats_(kpi);
      kpi.part = kpi.cats[0].part;
      kpi.category = kpi.cats[0].category;
      kpi.lockedYears = sources.map(function(m) { return !!(m && m[kpi.id]); });
      kpi.pctOrder = viewPctOrder_(kpi.id);
      out.push(kpi);
    }
    return { success: true, data: out, fy: fy, name: name, dataV: dataV };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// ตัดหมวดว่าง/ซ้ำ จากรายการที่ส่งมา
function cleanCatList_(list) {
  var seen = {}, out = [];
  (list || []).forEach(function(c) {
    var part = c && c.part ? c.part.toString().trim() : "";
    var category = c && c.category ? c.category.toString().trim() : "";
    if (!part || !category) return;
    var key = catKey_({ part: part, category: category });
    if (!seen[key]) { seen[key] = true; out.push({ part: part, category: category }); }
  });
  return out;
}

/**
 * จัดหมวดหน่วยงานอัตโนมัติ: หน่วยงานที่เพิ่มเข้ามา → เพิ่มหมวดของหน่วยนั้น (หมวดย่อยชั่วคราว "รอจัดหมวดย่อย")
 *   want.unit = หมวดหน่วยงาน ("ER") · want.qa = หมวด QA ("ER QA") — ไม่ส่ง want = หมวดหน่วยงาน
 * หน่วยงานที่เอาออก → เอาหมวดของหน่วยนั้นออก (เหลืออย่างน้อย 1 หมวดเสมอ) ไม่แตะหมวดอื่น
 * NSO เป็นสังกัดซ้อนของพยาบาลทุกหน่วย: "ER / NSO" ใช้หน่วย ER อย่างเดียว · ไม่มีหมวด NSO ในมุมมองหน่วยงาน
 */
function syncUnitCats_(cats, oldDepts, newDepts, want) {
  // หน่วยที่ถูกเอาออก: เอาหมวดของหน่วยนั้นออกทั้งหมวดหน่วยงานและหมวด QA ("ER" และ "ER QA")
  var gone = function(part) { var d = viewDeptOfPart_(part); return oldDepts.indexOf(d) !== -1 && newDepts.indexOf(d) === -1; };
  var out = cats.filter(function(c) { return !gone(c.part); });
  if (out.length === 0) out = cats.slice();
  var added = viewUnitsOf_(newDepts).filter(function(d) { return oldDepts.indexOf(d) === -1; });
  return viewBindCats_(out, added, want || { unit: true });
}

/** ผู้รับผิดชอบ (ชื่อผู้ใช้) → หน่วยงานที่สังกัดของคนเหล่านั้น (ไม่รวมผู้บริหาร) ใช้เติมช่องหน่วยงานที่ว่างอยู่ */
function deptsOfOwners_(ownerText) {
  var names = parseOwners_(ownerText), depts = [];
  if (names.length === 0) return depts;
  var sheet = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
  (sheet ? readUsers_(sheet) : []).forEach(function(u) {
    if (names.indexOf(u.username) === -1 || u.tier === "executive" || u.tier === "admin") return;
    u.depts.forEach(function(d) { if (depts.indexOf(d) === -1) depts.push(d); });
  });
  return depts;
}

/**
 * รวมรายการหมวดที่ผู้ใช้ส่งมา (เฉพาะหมวดที่เห็น) กับหมวดที่ซ่อนอยู่ แล้วตรวจกฎ
 *  - ต้องมีอย่างน้อย 1 หมวด
 *  - เจ้าของ (staff/head) เพิ่ม/เอาออกได้เฉพาะหมวดนอก Part I–IV · ผอ./QMR (ที่ไม่ใช่เจ้าของ) เพิ่มได้เฉพาะ Part I–IV
 *  - ตัวชี้วัดที่อยู่ใน Part I–IV ต้องมีระดับ SAR หรือ QA-หน่วยงาน
 * คืน { error } หรือ { cats, changed } (หมวดแรก = หมวดหลัก)
 */
function mergeCats_(user, perm, old, requested, levels) {
  var wanted = cleanCatList_(requested);
  if (wanted.length === 0) return { error: "ตัวชี้วัดต้องอยู่ในหมวดอย่างน้อย 1 หมวด (ระบุทั้งหมวดหลักและหมวดย่อย)" };
  var has = function(list, c) { return list.some(function(x) { return catKey_(x) === catKey_(c); }); };
  var visible = visibleCats_(user, old, perm);
  var hidden = old.cats.filter(function(c) { return !has(visible, c); });
  var added = wanted.filter(function(c) { return !has(old.cats, c); });
  var removed = visible.filter(function(c) { return !has(wanted, c); });
  if (user.tier !== "admin") {
    var isExec = user.tier === "executive";
    if (!isExec && (added.some(function(c) { return isCorePart_(c.part); }) || removed.some(function(c) { return isCorePart_(c.part); }))) {
      return { error: "การเพิ่ม/เอาออกจาก Part I–IV ต้องให้ admin หรือ ผอ./QMR ดำเนินการ (ตั้งหมวดอื่นเพิ่มได้เอง)" };
    }
    if (isExec && !perm.mine && added.some(function(c) { return !isCorePart_(c.part); })) {
      return { error: "ผอ./QMR เพิ่มตัวชี้วัดเข้าได้เฉพาะหมวด Part I–IV" };
    }
  }
  var result = wanted.concat(hidden);
  if (result.some(function(c) { return isCorePart_(c.part); }) && !hasHospitalLevel_(levels)) {
    return { error: "ตัวชี้วัดที่อยู่ใน Part I–IV ต้องมีระดับ SAR หรือ QA-หน่วยงาน อย่างน้อย 1 ระดับ" };
  }
  var changed = result.map(catKey_).join("\n") !== old.cats.map(catKey_).join("\n");
  return { cats: result, changed: changed };
}

/** เลขไทย → เลขอารบิก (ข้อมูลที่เก็บและแสดงบนเว็บใช้เลขอารบิก) */
function arabicDigits_(s) {
  return (s === null || s === undefined ? "" : s.toString()).replace(/[๐-๙]/g, function(c) { return String(c.charCodeAt(0) - 0x0E50); });
}

/**
 * ตรวจการตั้งตัวชี้วัดแม่: ต้องอยู่ในชีตเดียวกัน ไม่ใช่ตัวเอง ไม่วนกัน อยู่หมวดเดียวกันอย่างน้อย 1 หมวด
 * และซ้อนได้ไม่เกิน 2 ชั้น (4.1.1) — คืนข้อความผิดพลาด หรือ "" ถ้าใช้ได้
 */
function parentError_(data, id, parentId, cats) {
  if (parentId === id) return "ตั้งตัวเองเป็นตัวชี้วัดแม่ไม่ได้";
  var byId = {}, kids = {};
  for (var i = 1; i < data.length; i++) {
    var rid = data[i][0] ? data[i][0].toString().trim() : "";
    if (!rid) continue;
    byId[rid] = data[i];
    var pid = data[i][PARENT_COL - 1] ? data[i][PARENT_COL - 1].toString().trim() : "";
    if (pid) (kids[pid] = kids[pid] || []).push(rid);
  }
  if (!byId[parentId]) return "ไม่พบตัวชี้วัดแม่ในปีงบนี้";
  var parent = rowToKpi_(byId[parentId]);
  var mine = {};
  cats.forEach(function(c) { mine[catKey_(c)] = 1; });
  if (!parent.cats.some(function(c) { return mine[catKey_(c)]; })) return "ตัวชี้วัดแม่ต้องอยู่ในหมวดเดียวกันอย่างน้อย 1 หมวด";
  // ชั้นของตัวแม่ (นับขึ้นไปจนถึงตัวหลัก) — ถ้าเจอตัวเองระหว่างทาง = วนกัน
  var level = 0, cur = parentId, guard = 0;
  while (guard++ < 50) {
    var up = byId[cur] && byId[cur][PARENT_COL - 1] ? byId[cur][PARENT_COL - 1].toString().trim() : "";
    if (!up || !byId[up]) break;
    if (up === id) return "เลือกไม่ได้: ตัวที่เลือกเป็นตัวย่อยของตัวชี้วัดนี้อยู่แล้ว";
    level++;
    cur = up;
  }
  // ความลึกของตัวย่อยใต้ตัวนี้ (มีตัวย่อย = 1, มีตัวย่อยของตัวย่อย = 2)
  var depthBelow = function(x, d) {
    if (d > 5) return d;
    return (kids[x] || []).reduce(function(m, k) { return Math.max(m, 1 + depthBelow(k, d + 1)); }, 0);
  };
  if (level + 1 + depthBelow(id, 0) > 2) return "ตัวชี้วัดย่อยซ้อนได้ไม่เกิน 2 ชั้น (เช่น 4.1 และ 4.1.1)";
  return "";
}

/**
 * บันทึกตัวชี้วัดทีละตัวในปีงบที่เลือก (ผลลัพธ์ + รายละเอียดในครั้งเดียว) ส่วนที่ไม่ได้ส่งมา (undefined) จะไม่แตะ
 *  - years/months (ผลทั้งปี/รายเดือน): ต้องมีสิทธิ์กรอกผล; ช่องผลย้อนหลังที่มีชีตต้นทางล็อกไว้ให้ admin/ผอ./QMR
 *  - templateDetails/dataSource: ต้องมีสิทธิ์แก้รายละเอียด (ปีงบปัจจุบัน)
 *  - cats (หมวดที่แสดง): เจ้าของแก้ได้เฉพาะหมวดนอก Part I–IV (ปีงบปัจจุบัน) · admin, ผอ., QMR ทุกหมวด
 *  - name/target/owner/department/levels/summaryMethod/frequency (ความถี่การเก็บข้อมูล): เฉพาะ admin, ผอ., QMR — แก้ในปีงบที่เลือกเท่านั้น ปีอื่นไม่เปลี่ยน
 * คืน kpi ที่อัปเดตแล้วให้หน้าเว็บแทนที่ได้ทันที
 */
function saveKpi(token, fy, item) {
  var lock = null;
  try {
    var user = requireUser_(token);
    // ล็อกตลอดช่วงอ่าน-แก้-เขียน: ถ้ามีคนลบ/เพิ่มแถวพร้อมกัน เลขแถวจะไม่เลื่อนจนเขียนทับตัวอื่น
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var res = saveKpiCore_(user, fy, item);
    if (res.success) {
      var before = res._old, after = res._fresh;
      delete res._old; delete res._fresh;
      if (res.changed) res.docs = kpiAfterSave_(user, resolveFiscalYear_(fy), item, before, after);
    }
    return res;
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** แกนของ saveKpi: บันทึกตัวชี้วัด 1 ตัวใน 1 ปีงบ (เรียกภายใต้ script lock เท่านั้น · ไม่ตรวจ token) — ส่งต่อปีถัดไป (kpiForward_) เรียกซ้ำด้วยสิทธิ์ของผู้ใช้คนเดิม */
function saveKpiCore_(user, fy, item) {
  {
    var privileged = isPrivileged_(user);
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: false, message: "ไม่พบชีตปีงบประมาณ" };
    ensureColumns_(sheet, KPI_COLS);

    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === item.id.toString().trim()) { rowIndex = i; break; }
    }
    if (rowIndex === -1) return { success: false, message: "ไม่พบรหัสตัวชี้วัดในปีงบ " + fy };

    var old = rowToKpi_(data[rowIndex]);
    var perm = getKpiPermission_(user, old, fy);
    if (!perm.view) return { success: false, message: "ไม่มีสิทธิ์เข้าถึงตัวชี้วัดนี้" };
    // มีคนอื่นบันทึกตัวชี้วัดนี้ไปก่อน ระหว่างที่ผู้ใช้กำลังแก้ → ให้หน้าเว็บถามว่าจะโหลดล่าสุด / บันทึกทับ / แก้ต่อ
    if (item.baseRev && !item.force && item.baseRev !== old.rev) {
      return {
        success: false, conflict: true,
        message: "ตัวชี้วัดนี้ถูกแก้ไขโดย " + (old.editedBy || "ผู้ใช้อื่น") + (old.editedAt ? " เมื่อ " + old.editedAt : "") + " ระหว่างที่คุณกำลังแก้ไข",
        kpi: decorateKpi_(user, fy, old, getAnnualSources_(fy))
      };
    }
    var hasResults = item.years !== undefined || item.months !== undefined;
    var hasDetails = item.templateDetails !== undefined || item.dataSource !== undefined;
    if (hasResults && !perm.editResults) return { success: false, message: "ไม่มีสิทธิ์แก้ไขผลตัวชี้วัดนี้ในปีงบ " + fy };
    if (hasDetails && !perm.editDetails) return { success: false, message: "ไม่มีสิทธิ์แก้ไขรายละเอียดตัวชี้วัดนี้ในปีงบ " + fy };
    // ข้อความที่บันทึกใช้เลขอารบิกเสมอ (เลขไทยใช้เฉพาะตอนพิมพ์รายงาน) — เทียบหลังแปลงเลข จะได้ไม่นับว่าแก้ เมื่อต่างกันแค่ชนิดตัวเลข
    ["name", "target", "templateDetails", "dataSource"].forEach(function(f) {
      if (item[f] !== undefined && item[f] !== null) item[f] = arabicDigits_(item[f].toString());
    });
    var metaDiffers = ["name", "target", "owner", "department"].some(function(f) {
      return item[f] !== undefined && item[f].toString().trim() !== arabicDigits_((old[f] || "").toString().trim());
    });
    var parentChange = item.parentId !== undefined && (item.parentId || "").toString().trim() !== old.parentId;
    if (parentChange && !perm.editDetails) return { success: false, message: "ไม่มีสิทธิ์กำหนดตัวชี้วัดแม่ของตัวชี้วัดนี้ในปีงบ " + fy };
    if (metaDiffers && !perm.editDetails) return { success: false, message: "ไม่มีสิทธิ์แก้ไขข้อมูลตัวชี้วัดนี้ในปีงบ " + fy };
    // ตรวจระดับก่อนเขียนข้อมูลใดๆ (หมวด Part I–IV ต้องมีระดับ SAR หรือ QA-หน่วยงาน)
    var levelList = item.levels !== undefined ? item.levels : (item.level !== undefined ? [item.level] : undefined);
    var newLevels = levelList !== undefined && privileged ? cleanLevelList_(levelList, old.levels) : [];
    // หมวดที่แสดง (หลายหมวดได้ — ตัวชี้วัดเดียวกัน) ตรวจก่อนเขียนเช่นกัน
    var newCats = null; // null = ไม่เปลี่ยน
    if (item.cats !== undefined) {
      var merged = mergeCats_(user, perm, old, item.cats, newLevels.length > 0 ? newLevels : old.levels);
      if (merged.error) return { success: false, message: merged.error };
      if (!perm.editDetails && merged.changed) return { success: false, message: "ไม่มีสิทธิ์แก้ไขหมวดของตัวชี้วัดนี้ในปีงบ " + fy };
      if (merged.changed) newCats = merged.cats;
    }
    // ช่องหน่วยงานว่างแต่มีผู้รับผิดชอบ → เติมจากหน่วยงานที่ผู้รับผิดชอบสังกัด แล้วจัดหมวดหน่วยงานให้อัตโนมัติ
    var ownerAfter = perm.editDetails && item.owner !== undefined ? item.owner.toString().trim() : old.owner;
    var deptAfter = perm.editDetails && item.department !== undefined ? item.department.toString().trim() : old.department;
    if (perm.editDetails && !deptAfter && ownerAfter) deptAfter = deptsOfOwners_(ownerAfter).join(" / ");
    // หมวดผูกกับระดับและหน่วยงาน (Views.js): หน่วยที่เพิ่มได้หมวดชนิดเดียวกับที่มีอยู่ · ติ๊ก QA เพิ่ม = มีหมวด "<หน่วย> QA"
    //   · เอา QA ออก = เอาหมวด QA ออก · ติ๊กหน่วยงาน/รายบุคคลเพิ่ม = มีหมวดของหน่วย
    var levelsChanged = newLevels.length > 0 && newLevels.join(", ") !== old.levels.join(", ");
    if (deptAfter !== old.department || levelsChanged) {
      var baseCats = newCats || old.cats;
      var kNew = viewLevelKinds_(newLevels.length > 0 ? newLevels : old.levels), kOld = viewLevelKinds_(old.levels);
      var qaPl = baseCats.some(function(c) { return viewIsQaPart_(c.part); });
      var unitPl = baseCats.some(function(c) { return !isCorePart_(c.part) && !viewIsQaPart_(c.part); });
      var deptsAfter = parseDepts_(deptAfter);
      var bound = syncUnitCats_(baseCats, parseDepts_(old.department), deptsAfter, { qa: kNew.qa && (qaPl || !unitPl), unit: unitPl || (kNew.unit && !qaPl) });
      if (levelsChanged) {
        if (kNew.qa && !kOld.qa) bound = viewBindCats_(bound, deptsAfter, { qa: true });
        if (kNew.unit && (!kOld.unit || (kOld.qa && !kNew.qa))) bound = viewBindCats_(bound, deptsAfter, { unit: true });
        if (kOld.qa && !kNew.qa) bound = viewBindCats_(bound, deptsAfter, { qa: false });
      }
      bound = viewFillPlaceholders_(bound, item.name || old.name);
      if (bound.map(catKey_).join("\n") !== baseCats.map(catKey_).join("\n")) newCats = bound;
    }
    // หมวดที่เพิ่มเองแต่เว้นหมวดย่อยไว้ ("รอจัดหมวดย่อย") → ระบบเลือกให้
    if (newCats) newCats = viewFillPlaceholders_(newCats, item.name || old.name);
    var catsAfter = newCats || old.cats;
    var coreAfter = catsAfter.some(function(c) { return isCorePart_(c.part); });
    if (newLevels.length > 0 && coreAfter && !hasHospitalLevel_(newLevels)) {
      return { success: false, message: "ตัวชี้วัดที่อยู่ในหมวด Part I–IV ต้องมีระดับ SAR หรือ QA-หน่วยงาน อย่างน้อย 1 ระดับ" };
    }
    if (levelsChanged && viewLevelKinds_(newLevels).qa && !viewLevelKinds_(old.levels).qa && !catsAfter.some(function(c) { return viewIsQaPart_(c.part); })) {
      return { success: false, message: "ระดับ QA-หน่วยงาน ต้องมีหมวด QA ของหน่วย — ระบุหน่วยงานของตัวชี้วัด หรือเพิ่มหมวด \"<หน่วย> QA\"" };
    }
    if ((levelsChanged || newCats) && viewLevelKinds_(newLevels.length > 0 ? newLevels : old.levels).sar && !coreAfter) {
      return { success: false, message: "ตัวชี้วัดระดับ SAR ต้องอยู่ในหมวด Part I–IV อย่างน้อย 1 หมวด (เลือกหมวด รพ.)" };
    }

    var newParent = parentChange ? (item.parentId || "").toString().trim() : old.parentId;
    if (parentChange && newParent) {
      var perr = parentError_(data, old.id, newParent, newCats || old.cats);
      if (perr) return { success: false, message: perr };
    }

    var row = rowIndex + 1;
    var changed = false;
    var annualChanges = [];
    var sources = getAnnualSources_(fy);

    if (hasResults) {
      var newYears = old.years.slice();
      for (var y = 0; y < 5; y++) {
        var locked = y < 4 && sources[y] && sources[y][old.id];
        if (locked && !privileged) continue; // ผลปีที่มีชีตต้นทางอยู่ แก้ได้เฉพาะ admin, ผอ., QMR
        var nv = numberOrNull_(item.years ? item.years[y] : null);
        if (nv === old.years[y]) continue;
        newYears[y] = nv;
        // ผลทั้งปีของปี Y ต้องตรงกันทุกชีตที่เก็บปีนั้น (ช่อง K ของชีตปี Y และ G–J ของชีตปีถัดๆ ไป)
        annualChanges.push({ id: old.id, year: fy - 4 + y, value: nv, skipFy: y === 4 ? fy : null });
      }
      var newMonths = [];
      for (var m = 0; m < 12; m++) {
        newMonths.push(item.months ? monthOrNull_(item.months[m]) : old.months[m]);
      }
      if (newYears.join("|") !== old.years.join("|") || newMonths.join("|") !== old.months.join("|")) changed = true;
      sheet.getRange(row, ANNUAL_FIRST_COL, 1, 17).setValues([newYears.concat(newMonths)]);
    }

    if (hasDetails) {
      var tpl = item.templateDetails !== undefined ? item.templateDetails : old.templateDetails;
      var src = item.dataSource !== undefined ? item.dataSource : old.dataSource;
      var detailsChanged = (tpl || "").trim() !== arabicDigits_(old.templateDetails) || (src || "").trim() !== arabicDigits_(old.dataSource);
      if (detailsChanged) {
        changed = true;
        // บันทึกเวลาอัปเดตการวิเคราะห์ (ใช้ดูว่าปีงบนี้ได้ทบทวนรายละเอียดแล้วหรือยัง)
        sheet.getRange(row, ANALYSIS_COL).setNumberFormat("@").setValue(nowStamp_());
        if (!sheet.getRange(1, ANALYSIS_COL).getValue()) {
          sheet.getRange(1, ANALYSIS_COL).setValue(ANALYSIS_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
        }
      }
      sheet.getRange(row, 24).setValue(tpl || "");
      sheet.getRange(row, 25).setValue(src || "");
    }

    // ชื่อ/เป้าหมาย/ผู้รับผิดชอบ/หน่วยงาน: ผู้ที่แก้รายละเอียดได้ (ผู้รับผิดชอบ/หัวหน้าหน่วยในปีงบปัจจุบัน หรือ admin/ผอ./QMR)
    if (perm.editDetails) {
      if (item.name !== undefined && item.name.toString().trim() !== "" && item.name.toString().trim() !== arabicDigits_(old.name)) {
        sheet.getRange(row, 5).setValue(item.name.toString().trim());
        changed = true;
      }
      if (item.target !== undefined && item.target.toString().trim() !== arabicDigits_(old.target)) {
        sheet.getRange(row, 6).setValue(item.target.toString().trim());
        changed = true;
      }
      if (item.owner !== undefined && item.owner.toString().trim() !== old.owner) {
        sheet.getRange(row, 26).setValue(item.owner.toString().trim());
        changed = true;
      }
      if (deptAfter !== old.department) {
        sheet.getRange(row, 27).setValue(deptAfter);
        changed = true;
      }
    }

    // ตัวชี้วัดแม่ (ตัวย่อยได้ลำดับย่อยต่อจากตัวแม่ เช่น 4.1)
    if (parentChange) {
      sheet.getRange(row, PARENT_COL).setNumberFormat("@").setValue(newParent);
      if (!sheet.getRange(1, PARENT_COL).getValue()) {
        sheet.getRange(1, PARENT_COL).setValue(PARENT_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
      }
      changed = true;
    }

    if (newCats) {
      sheet.getRange(row, 3, 1, 2).setValues([[newCats[0].part, newCats[0].category]]);
      sheet.getRange(row, EXTRA_CATS_COL).setNumberFormat("@").setValue(formatExtraCats_(newCats.slice(1)));
      if (!sheet.getRange(1, EXTRA_CATS_COL).getValue()) {
        sheet.getRange(1, EXTRA_CATS_COL).setValue(EXTRA_CATS_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
      }
      changed = true;
    }

    // วิธีสรุป/ความถี่/ระดับ: เฉพาะ admin, ผอ., QMR
    if (privileged) {
      if (item.summaryMethod !== undefined && SUMMARY_METHODS.indexOf(item.summaryMethod) !== -1 && item.summaryMethod !== old.summaryMethod) {
        sheet.getRange(row, SUMMARY_COL).setValue(item.summaryMethod);
        if (!sheet.getRange(1, SUMMARY_COL).getValue()) {
          sheet.getRange(1, SUMMARY_COL).setValue(SUMMARY_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
        }
        changed = true;
      }
      if (item.frequency !== undefined && FREQUENCIES.indexOf(item.frequency) !== -1 && item.frequency !== old.frequency) {
        sheet.getRange(row, FREQ_COL).setValue(item.frequency);
        if (!sheet.getRange(1, FREQ_COL).getValue()) {
          sheet.getRange(1, FREQ_COL).setValue(FREQ_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
        }
        changed = true;
      }
      if (newLevels.length > 0 && newLevels.join(", ") !== old.levels.join(", ")) {
        sheet.getRange(row, LEVEL_COLUMN).setValue(newLevels.join(", "));
        changed = true;
      }
    }

    propagateAnnual_(annualChanges);
    if (changed) {
      stampRow_(sheet, row, user, "edit");
      touchUser_(user, "edit");
      bumpDataVersion_(annualChanges.length > 0 ? "*" : fy, [old.id], user); // ผลทั้งปีเขียนลงชีตปีอื่นด้วย
    }

    var fresh = rowToKpi_(sheet.getRange(row, 1, 1, KPI_COLS).getValues()[0]);
    return {
      success: true,
      changed: changed,
      message: changed ? "บันทึกข้อมูลปีงบ " + fy + " เรียบร้อยแล้ว" : "ไม่มีการเปลี่ยนแปลง",
      kpi: decorateKpi_(user, fy, fresh, getAnnualSources_(fy)),
      _old: old, _fresh: fresh
    };
  }
}

// ---------------------------------------------------------------- ตัวกรองหน้า "สรุปรายงาน" (จำแยกตามผู้ใช้)
var REPORT_PREFS_PREFIX = "REPORT_PREFS_V1:";
var REPORT_PREFS_MAX = 8000; // ค่าใน PropertiesService จำกัด ~9KB ต่อคีย์

function getReportPrefs(token) {
  try {
    var user = requireUser_(token);
    var raw = PropertiesService.getScriptProperties().getProperty(REPORT_PREFS_PREFIX + user.username);
    return { success: true, prefs: raw ? JSON.parse(raw) : null };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function saveReportPrefs(token, prefs) {
  try {
    var user = requireUser_(token);
    var p = prefs || {}, o = p.opts || {};
    var clean = {
      scope: ["mine", "dept", "all"].indexOf(p.scope) !== -1 ? p.scope : "mine",
      orient: p.orient === "portrait" ? "portrait" : "landscape",
      opts: { table: o.table !== false, chart: o.chart !== false, detail: o.detail !== false, source: o.source === true, owner: o.owner !== false }, // ที่มาแหล่งข้อมูล: ค่าตั้งต้นไม่ติ๊ก
      v: 2, // v2 = ค่าที่จำไว้ใช้ได้ (v ต่ำกว่า/ไม่มี = บันทึกก่อนเปลี่ยนค่าตั้งต้น 'ที่มา' เป็นไม่ติ๊ก หน้าเว็บจึงไม่ใช้ค่า source เก่า)

      unchecked: (Array.isArray(p.unchecked) ? p.unchecked : []).slice(0, 400).map(function(x) { return String(x).slice(0, 120); })
    };
    var json = JSON.stringify(clean);
    if (json.length > REPORT_PREFS_MAX) { clean.unchecked = []; json = JSON.stringify(clean); } // ยาวเกิน: ไม่เก็บรายการหมวดที่ไม่ติ๊ก
    PropertiesService.getScriptProperties().setProperty(REPORT_PREFS_PREFIX + user.username, json);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// บันทึกเวลาเข้าดูตัวชี้วัด — หน้าเว็บรวมรายการแล้วส่งเป็นชุดทุก ~30 วินาที (ไม่ให้ช้าตอนคลิกดู)
function recordViews(token, fy, ids) {
  var lock = null;
  try {
    var user = requireUser_(token);
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    // ใช้ล็อกเดียวกับการแก้ไข (เลขแถวไม่เลื่อนระหว่างลงเวลา) ถ้าล็อกไม่ว่างใน 5 วินาที ข้ามรอบนี้ไป ไม่ให้หน้าเว็บค้าง
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) { lock = null; return { success: true, count: 0 }; }
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: true, count: 0 };
    var data = sheet.getDataRange().getValues();
    var wanted = {};
    ids.slice(0, 200).forEach(function(id) { wanted[id.toString().trim()] = true; });
    var count = 0;
    for (var i = 1; i < data.length; i++) {
      var id = data[i][0] ? data[i][0].toString().trim() : "";
      if (!wanted[id]) continue;
      if (!getKpiPermission_(user, rowToKpi_(data[i]), fy).view) continue;
      stampRow_(sheet, i + 1, user, "view");
      count++;
    }
    touchUser_(user, "access");
    return { success: true, count: count };
  } catch (error) {
    return { success: false, message: error.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/**
 * สร้างแถวตัวชี้วัดใหม่ 1 แถว (ไม่เขียนชีต) — ใช้ร่วมกันโดย addIndicator และนำเข้าตัวชี้วัดรายบุคคล (PersonalImport.js)
 * data = ค่าทั้งชีตปีงบ (ใช้นับลำดับในหมวด · ผู้เรียกที่สร้างหลายแถวต้องต่อแถวที่สร้างแล้วเข้า data เอง)
 * idTime = ตัวเลขต่อท้ายรหัส "KPI-<idTime>" (ไม่ส่ง = เวลาปัจจุบัน; นำเข้าหลายแถวต้องส่งค่าไม่ซ้ำกัน)
 * คืน { error } หรือ { row, newId, cats, newItem }
 */
function buildNewKpiRow_(user, fy, sheet, data, newItem, privileged, idTime) {
    // หมวด: ส่งมาเป็นรายการ cats (หมวดแรก = หมวดหลัก) หรือ part/category เดี่ยวๆ แบบเดิม
    var cats = cleanCatList_(newItem.cats && newItem.cats.length ? newItem.cats : [{ part: newItem.part, category: newItem.category }]);
    newItem.name = arabicDigits_((newItem.name || "").toString().trim());
    ["target", "templateDetails", "dataSource"].forEach(function(f) {
      if (newItem[f] !== undefined && newItem[f] !== null) newItem[f] = arabicDigits_(newItem[f].toString());
    });
    if (cats.length === 0 || !newItem.name) {
      return { error: "กรุณาระบุ หมวดหลัก หมวดหมู่ย่อย และชื่อตัวชี้วัด" };
    }
    newItem.part = cats[0].part;
    newItem.category = cats[0].category;
    var coreInvolved = cats.some(function(c) { return isCorePart_(c.part); });
    var newLevels = cleanLevelList_(newItem.levels || (newItem.level ? [newItem.level] : []), []);
    if (newLevels.length === 0) newLevels = [DEFAULT_KPI_LEVEL];
    if (coreInvolved && !hasHospitalLevel_(newLevels)) {
      return { error: "หมวด Part I–IV ต้องเป็นตัวชี้วัดระดับ SAR หรือ QA-หน่วยงาน (ถ้าเป็นระดับรายบุคคล/หน่วยงาน ให้ตั้งชื่อหมวดอื่น)" };
    }
    // ผู้เพิ่ม (ที่ไม่ใช่ admin) ต้องเห็นตัวชี้วัดที่ตัวเองเพิ่ม จึงใส่ตัวเองเป็นผู้รับผิดชอบให้
    // ยกเว้น ผอ./QMR ที่เพิ่มตัวชี้วัด Part I–IV ระดับ SAR/QA ซึ่งเห็นได้อยู่แล้ว
    var seesAnyway = user.tier === "admin" || (user.tier === "executive" && coreInvolved && hasHospitalLevel_(newLevels));
    if (!seesAnyway) {
      var owners = parseOwners_(newItem.owner);
      if (owners.indexOf(user.username) === -1) owners.unshift(user.username);
      newItem.owner = owners.join(" / ");
    }
    if (!privileged && !(newItem.department || "").toString().trim()) newItem.department = (user.tier === "head" ? user.depts : effectiveDepts_(user, fy)).join(" / ");
    // ช่องหน่วยงานยังว่าง แต่ระบุผู้รับผิดชอบ → ใช้หน่วยงานของผู้รับผิดชอบ
    if (!(newItem.department || "").toString().trim() && newItem.owner) newItem.department = deptsOfOwners_(newItem.owner).join(" / ");
    // หมวดผูกกับระดับ: QA-หน่วยงาน → "<หน่วย> QA › มิติ" · หน่วยงาน/รายบุคคล → "<หน่วย> › หัวข้อ/ขั้นตอน" (ที่ยังไม่ได้เลือกเอง ระบบจัดให้)
    var kinds = viewLevelKinds_(newLevels);
    cats = viewFillPlaceholders_(viewBindCats_(cats, parseDepts_(newItem.department), { qa: kinds.qa, unit: kinds.unit }), newItem.name);
    if (kinds.sar && !cats.some(function(c) { return isCorePart_(c.part); })) {
      return { error: "ตัวชี้วัดระดับ SAR ต้องเลือกหมวด รพ. (Part I–IV) อย่างน้อย 1 หมวด" };
    }
    newItem.part = cats[0].part;
    newItem.category = cats[0].category;
    // ผู้เพิ่มต้องเห็นตัวชี้วัดที่ตัวเองเพิ่ม (เช่น ผอ. เพิ่มได้เฉพาะ Part I–IV ระดับ SAR/QA)
    var probe = { part: newItem.part, category: newItem.category, cats: cats, owner: newItem.owner || "", department: newItem.department || "", levels: newLevels };
    if (!getKpiPermission_(user, probe, fy).view) {
      return { error: "บัญชีผอ./QMR เพิ่มได้เฉพาะตัวชี้วัด Part I–IV ระดับ SAR/QA หรือที่ตัวเองเป็นผู้รับผิดชอบ" };
    }

    var count = data.filter(function(r) {
      return r[2] && r[2].toString().trim() === newItem.part.trim() &&
             r[3] && r[3].toString().trim() === newItem.category.trim();
    }).length;
    var autoNo = count + 1;
    var levels = newLevels;

    var newId = "KPI-" + (idTime || new Date().getTime());
    var newRow = [
      newId, autoNo, newItem.part, newItem.category, newItem.name, newItem.target,
      newItem.years[0], newItem.years[1], newItem.years[2], newItem.years[3], newItem.years[4],
      newItem.months[0], newItem.months[1], newItem.months[2], newItem.months[3],
      newItem.months[4], newItem.months[5], newItem.months[6], newItem.months[7],
      newItem.months[8], newItem.months[9], newItem.months[10], newItem.months[11],
      newItem.templateDetails || "", newItem.dataSource || "", newItem.owner || "", newItem.department || "",
      "", levels.join(", "), nowStamp_(), user.username, "", "",
      SUMMARY_METHODS.indexOf(newItem.summaryMethod) !== -1 ? newItem.summaryMethod : DEFAULT_SUMMARY_METHOD,
      (newItem.templateDetails || newItem.dataSource) ? nowStamp_() : "",
      FREQUENCIES.indexOf(newItem.frequency) !== -1 ? newItem.frequency : DEFAULT_FREQUENCY,
      formatExtraCats_(cats.slice(1))
    ];
  return { row: newRow, newId: newId, cats: cats, newItem: newItem };
}

// เพิ่มตัวชี้วัดใหม่ในปีงบที่เลือก — ทุกคนที่ล็อกอิน (staff ขึ้นไป) เพิ่มได้ (ปีงบถัดไปจะคัดลอกตามจากปีล่าสุดเอง)
//  - staff/head: เพิ่มได้เฉพาะปีงบปัจจุบัน และระบบใส่ตัวเองเป็นผู้รับผิดชอบให้เสมอ
//  - หมวด Part I–IV ต้องมีระดับ SAR หรือ QA-หน่วยงาน อย่างน้อย 1 ระดับ (หมวดอื่นตั้งชื่อเองได้)
function addIndicator(token, fy, newItem) {
  var lock = null;
  try {
    var user = requireUser_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var privileged = isPrivileged_(user);
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: false, message: "ไม่พบชีตปีงบประมาณ" };
    ensureColumns_(sheet, KPI_COLS);
    if (!privileged && fy !== getCurrentFiscalYear_()) {
      return { success: false, message: "เพิ่มตัวชี้วัดใหม่ได้เฉพาะปีงบปัจจุบัน (" + getCurrentFiscalYear_() + ")" };
    }
    var data = sheet.getDataRange().getValues();
    var built = buildNewKpiRow_(user, fy, sheet, data, newItem, privileged);
    if (built.error) return { success: false, message: built.error };
    var newRow = built.row, newId = built.newId, cats = built.cats;
    sheet.appendRow(newRow);
    if (cats.length > 1 && !sheet.getRange(1, EXTRA_CATS_COL).getValue()) {
      sheet.getRange(1, EXTRA_CATS_COL).setValue(EXTRA_CATS_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
    }
    touchUser_(user, "edit");
    bumpDataVersion_(fy, [newId], user);
    var fwd = [];
    if (newItem.forward) {
      fwdLaterYears_(fy).forEach(function(ty) { fwd.push(fwdAddToYear_(user, ty, fy, newRow, newId, cats, privileged)); });
    }
    return { success: true, message: "เพิ่มตัวชี้วัดในปีงบ " + fy + " เรียบร้อยแล้ว", newId: newId, forward: fwd };
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ลบตัวชี้วัดออกจากปีงบที่เลือกเท่านั้น (ปีงบอื่นยังเก็บไว้เป็นประวัติ) — เฉพาะ admin, ผอ., QMR
function deleteIndicator(token, fy, partName, id) {
  var lock = null;
  try {
    var user = requirePrivileged_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: false, message: "ไม่พบชีตปีงบประมาณ" };

    var data = sheet.getDataRange().getValues();
    var ids = data.map(function(r) { return r[0] ? r[0].toString().trim() : ""; });
    var rowIndex = ids.indexOf(id.toString().trim());

    if (rowIndex !== -1) {
      // ผอ./QMR ลบได้เฉพาะตัวที่ตัวเองมองเห็น
      if (!getKpiPermission_(user, rowToKpi_(data[rowIndex]), fy).view) return { success: false, message: "ไม่มีสิทธิ์ลบตัวชี้วัดนี้" };
      sheet.deleteRow(rowIndex + 1);
      bumpDataVersion_(fy, [id.toString().trim()], user);
      return { success: true, message: "ลบตัวชี้วัดออกจากปีงบ " + fy + " เรียบร้อยแล้ว" };
    } else {
      return { success: false, message: "ไม่พบรหัสตัวชี้วัดที่ต้องการลบ" };
    }
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// คอลัมน์ที่ 28 ของชีต Database เก็บ "รหัสอ้างอิงจากระบบพยาบาล" ไว้จับคู่ว่าแถวนี้ผูกกับ
// ตัวชี้วัดตัวไหนในระบบพยาบาล ถ้ายังไม่มีคอลัมน์นี้ (ชีตที่มีข้อมูลจริงอยู่ก่อนฟีเจอร์นี้) จะเพิ่มให้
// โดยไม่กระทบข้อมูลคอลัมน์ 1-27 ที่มีอยู่แล้ว
function ensureNursingLinkColumn_() {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var sheet = ss.getSheetByName(DATABASE_SHEET_NAME);
  if (!sheet) return;
  var header = sheet.getRange(1, 28).getValue();
  if (!header) {
    sheet.getRange(1, 28).setValue("รหัสอ้างอิงระบบพยาบาล (Nursing Source ID)")
      .setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
  }
}

function normalizeKpiName_(name) {
  if (!name) return "";
  return name.toString().toLowerCase()
    .replace(/[\s ]+/g, ' ')
    .replace(/[.,\-_()%\/]+/g, '')
    .trim();
}

// เปรียบเทียบข้อมูลจากฝ่ายการพยาบาลกับของ KPI PH เพื่อให้แอดมินตรวจสอบและจับคู่เอง
// (ไม่เขียนข้อมูลใดๆ แค่คำนวณรายการที่ต้องให้แอดมินตัดสินใจ)
function getNursingSyncPreview(token) {
  try {
    requireAdmin_(token);
    if (!NURSING_SYNC_ENABLED) return { success: false, message: NURSING_SYNC_PAUSED_MESSAGE };
    ensureNursingLinkColumn_();
    var sourceSs = SpreadsheetApp.openByUrl(NURSING_SPREADSHEET_URL);
    var sourceSheet = sourceSs.getSheetByName(NURSING_DATABASE_SHEET_NAME);
    if (!sourceSheet) return { success: false, message: "ไม่พบชีต Database ในระบบพยาบาล" };
    var sourceData = sourceSheet.getDataRange().getValues();

    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var sheet = ss.getSheetByName(DATABASE_SHEET_NAME);
    var destData = sheet.getDataRange().getValues();

    var linkedBySourceId = {};
    var destNameNormalizedMap = {};
    var linkedDestIndexes = {};

    for (var d = 1; d < destData.length; d++) {
      var link = destData[d][27] ? destData[d][27].toString().trim() : "";
      if (link) {
        linkedBySourceId[link] = d;
        linkedDestIndexes[d] = true;
      }
      var normName = normalizeKpiName_(destData[d][4]);
      if (!destNameNormalizedMap[normName]) destNameNormalizedMap[normName] = [];
      destNameNormalizedMap[normName].push(d);
    }

    var items = [];
    for (var i = 1; i < sourceData.length; i++) {
      var row = sourceData[i];
      if (!row[0]) continue;
      var sourceId = row[0].toString().trim();

      var result = {
        sourceId: sourceId,
        sourceName: row[4] ? row[4].toString().trim() : "",
        sourcePart: row[2] ? row[2].toString().trim() : "",
        sourceCategory: row[3] ? row[3].toString().trim() : "",
        sourceTarget: row[5] ? row[5].toString().trim() : ""
      };

      if (linkedBySourceId.hasOwnProperty(sourceId)) {
        var idx = linkedBySourceId[sourceId];
        result.status = 'linked';
        result.destId = destData[idx][0].toString().trim();
        result.destName = destData[idx][4] ? destData[idx][4].toString().trim() : "";
      } else {
        var norm = normalizeKpiName_(result.sourceName);
        var candidates = (destNameNormalizedMap[norm] || []).filter(function(idx2) { return !linkedDestIndexes[idx2]; });
        if (candidates.length === 1) {
          var cIdx = candidates[0];
          result.status = 'suggested';
          result.suggestedDestId = destData[cIdx][0].toString().trim();
          result.suggestedDestName = destData[cIdx][4] ? destData[cIdx][4].toString().trim() : "";
        } else {
          result.status = 'unmatched';
        }
      }
      items.push(result);
    }

    var unlinkedDestList = [];
    for (var d2 = 1; d2 < destData.length; d2++) {
      if (!linkedDestIndexes[d2]) {
        unlinkedDestList.push({
          id: destData[d2][0].toString().trim(),
          name: destData[d2][4] ? destData[d2][4].toString().trim() : "",
          part: destData[d2][2] ? destData[d2][2].toString().trim() : "",
          category: destData[d2][3] ? destData[d2][3].toString().trim() : ""
        });
      }
    }

    return { success: true, items: items, unlinkedDestList: unlinkedDestList };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

// บันทึกผลการจับคู่ที่แอดมินยืนยันแล้ว: ข้อมูลจากฝ่ายการพยาบาลชนะเสมอ (เขียนทับคอลัมน์ 2-27
// ของแถวที่จับคู่ไว้ โดยคง ID เดิมของ KPI PH ไว้) — ดึงเฉพาะตัวชี้วัดที่ "ซ้ำกันจริง" เท่านั้น
// ถ้าแอดมินเลือก "ข้าม" (destId ว่าง) จะไม่ทำอะไรกับรายการนั้นเลย ไม่สร้างแถวใหม่เด็ดขาด
function commitNursingSync(token, mappings) {
  try {
    requireAdmin_(token);
    if (!NURSING_SYNC_ENABLED) return { success: false, message: NURSING_SYNC_PAUSED_MESSAGE };
    ensureNursingLinkColumn_();
    var sourceSs = SpreadsheetApp.openByUrl(NURSING_SPREADSHEET_URL);
    var sourceSheet = sourceSs.getSheetByName(NURSING_DATABASE_SHEET_NAME);
    if (!sourceSheet) return { success: false, message: "ไม่พบชีต Database ในระบบพยาบาล" };
    var sourceData = sourceSheet.getDataRange().getValues();

    var sourceById = {};
    for (var i = 1; i < sourceData.length; i++) {
      if (sourceData[i][0]) sourceById[sourceData[i][0].toString().trim()] = sourceData[i];
    }

    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var sheet = ss.getSheetByName(DATABASE_SHEET_NAME);
    var destData = sheet.getDataRange().getValues();

    var destIdRowMap = {};
    for (var d = 1; d < destData.length; d++) {
      if (destData[d][0]) destIdRowMap[destData[d][0].toString().trim()] = d + 1;
    }

    var linkedCount = 0;

    mappings.forEach(function(m) {
      if (!m.destId) return; // ข้าม: ไม่ใช่ตัวเดียวกัน ไม่ต้องดึงเข้ามา
      var srcRow = sourceById[m.sourceId];
      if (!srcRow) return;

      var actualRow = destIdRowMap[m.destId.toString().trim()];
      if (!actualRow) return;
      var overwriteRow = srcRow.slice(1, 27);
      sheet.getRange(actualRow, 2, 1, overwriteRow.length).setValues([overwriteRow]);
      sheet.getRange(actualRow, 28).setValue(m.sourceId);
      linkedCount++;
    });

    return { success: true, message: "บันทึกการจับคู่สำเร็จ: อัปเดต " + linkedCount + " รายการ" };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

// ซิงค์แบบปลอดภัย ("ต้นทางพยาบาลชนะเสมอ") — อัปเดตเฉพาะแถวที่แอดมินจับคู่ไว้แล้ว
// (ผ่าน commitNursingSync) เท่านั้น จะไม่สร้างแถวใหม่โดยอัตโนมัติเด็ดขาด ใช้ได้ทั้งกดเอง
// และรันอัตโนมัติผ่าน time-based trigger
function syncFromNursingSystem() {
  if (!NURSING_SYNC_ENABLED) {
    // เก็บกวาด trigger รายวันที่เคยตั้งไว้ ไม่ให้รันต่อ
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === NURSING_SYNC_FUNCTION_NAME) ScriptApp.deleteTrigger(t);
    });
    return { success: false, message: NURSING_SYNC_PAUSED_MESSAGE };
  }
  try {
    ensureNursingLinkColumn_();
    var sourceSs = SpreadsheetApp.openByUrl(NURSING_SPREADSHEET_URL);
    var sourceSheet = sourceSs.getSheetByName(NURSING_DATABASE_SHEET_NAME);
    if (!sourceSheet) return { success: false, message: "ไม่พบชีต Database ในระบบพยาบาล" };
    var sourceData = sourceSheet.getDataRange().getValues();

    var sourceById = {};
    for (var i = 1; i < sourceData.length; i++) {
      if (sourceData[i][0]) sourceById[sourceData[i][0].toString().trim()] = sourceData[i];
    }

    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var sheet = ss.getSheetByName(DATABASE_SHEET_NAME);
    var destData = sheet.getDataRange().getValues();

    var updatedCount = 0;
    var linkedSourceIds = {};

    for (var d = 1; d < destData.length; d++) {
      var link = destData[d][27] ? destData[d][27].toString().trim() : "";
      if (!link) continue;
      linkedSourceIds[link] = true;
      var srcRow = sourceById[link];
      if (!srcRow) continue;
      var overwriteRow = srcRow.slice(1, 27);
      sheet.getRange(d + 1, 2, 1, overwriteRow.length).setValues([overwriteRow]);
      updatedCount++;
    }

    var pendingCount = 0;
    for (var i2 = 1; i2 < sourceData.length; i2++) {
      if (sourceData[i2][0] && !linkedSourceIds[sourceData[i2][0].toString().trim()]) pendingCount++;
    }

    var msg = "ซิงค์ข้อมูลรายการที่จับคู่ไว้แล้วสำเร็จ: อัปเดต " + updatedCount + " รายการ";
    if (pendingCount > 0) {
      msg += " (มี " + pendingCount + " รายการใหม่จากฝ่ายพยาบาลที่ยังไม่จับคู่ กรุณากด \"ตรวจสอบและจับคู่ข้อมูลใหม่\")";
    }

    return { success: true, message: msg, updated: updatedCount, pending: pendingCount };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

// ปุ่มซิงค์ในหน้าเว็บ (เฉพาะ admin) — ตัว syncFromNursingSystem ใช้เป็น handler ของ trigger รายวัน
function syncNursingNow(token) {
  try {
    requireAdmin_(token);
    return syncFromNursingSystem();
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

function getNursingSyncTriggerStatus(token) {
  requireAdmin_(token);
  var triggers = ScriptApp.getProjectTriggers();
  var enabled = triggers.some(function(t) { return t.getHandlerFunction() === NURSING_SYNC_FUNCTION_NAME; });
  return { enabled: enabled };
}

// เปิด/ปิดการซิงค์ข้อมูลจากระบบพยาบาลอัตโนมัติทุกวัน (05:00 น. เวลาไทย)
function toggleNursingSyncTrigger(token) {
  try {
    requireAdmin_(token);
    if (!NURSING_SYNC_ENABLED) return { success: false, message: NURSING_SYNC_PAUSED_MESSAGE };
    var triggers = ScriptApp.getProjectTriggers();
    var existing = triggers.filter(function(t) { return t.getHandlerFunction() === NURSING_SYNC_FUNCTION_NAME; });

    if (existing.length > 0) {
      existing.forEach(function(t) { ScriptApp.deleteTrigger(t); });
      return { success: true, enabled: false, message: "ปิดการซิงค์อัตโนมัติรายวันเรียบร้อยแล้ว" };
    } else {
      ScriptApp.newTrigger(NURSING_SYNC_FUNCTION_NAME)
        .timeBased()
        .everyDays(1)
        .atHour(5)
        .inTimezone("Asia/Bangkok")
        .create();
      return { success: true, enabled: true, message: "เปิดการซิงค์อัตโนมัติรายวัน (05:00 น.) เรียบร้อยแล้ว" };
    }
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}