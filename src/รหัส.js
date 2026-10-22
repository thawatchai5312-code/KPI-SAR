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
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('ระบบจัดการตัวชี้วัดโรงพยาบาล')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function cleanValue_(val) {
  if (val === "" || val === undefined || val === null) return null;
  var str = val.toString().trim().toUpperCase();
  if (str === "NA" || str === "N/A" || str === "-" || isNaN(val)) {
    return null;
  }
  return Number(val);
}

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
      cleanValue_(row[11]), cleanValue_(row[12]), cleanValue_(row[13]), cleanValue_(row[14]),
      cleanValue_(row[15]), cleanValue_(row[16]), cleanValue_(row[17]), cleanValue_(row[18]),
      cleanValue_(row[19]), cleanValue_(row[20]), cleanValue_(row[21]), cleanValue_(row[22])
    ],
    templateDetails: row[23] ? row[23].toString().trim() : "",
    dataSource: row[24] ? row[24].toString().trim() : "",
    owner: row[25] ? row[25].toString().trim() : "",
    department: row[26] ? row[26].toString().trim() : "",
    summaryMethod: normalizeSummaryMethod_(row[SUMMARY_COL - 1]),
    analysisUpdatedAt: formatStamp_(row[ANALYSIS_COL - 1]),
    frequency: normalizeFrequency_(row[FREQ_COL - 1]),
    levels: normalizeLevels_(row[28]),
    level: normalizeLevels_(row[28]).slice(-1)[0], // ระดับสูงสุด ใช้แสดงผล
    editedAt: formatStamp_(row[STAMP_EDIT_AT_COL - 1]),
    editedBy: row[STAMP_EDIT_BY_COL - 1] ? row[STAMP_EDIT_BY_COL - 1].toString() : "",
    viewedAt: formatStamp_(row[STAMP_VIEW_AT_COL - 1]),
    viewedBy: row[STAMP_VIEW_BY_COL - 1] ? row[STAMP_VIEW_BY_COL - 1].toString() : ""
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
    var sources = getAnnualSources_(fy);
    var data = getFiscalSheet_(fy).getDataRange().getValues();
    var allData = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      var kpi = rowToKpi_(data[i]);
      if (!getKpiPermission_(user, kpi, fy).view) continue;
      allData.push(decorateKpi_(user, fy, kpi, sources));
    }
    return { success: true, data: allData, fy: fy, currentFy: currentFy, years: years };
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
  // ผอ./QMR เห็นเฉพาะหมวด Part I–IV ของตัวชี้วัดที่ไม่ใช่ของตัวเอง
  kpi.cats = visibleCats_(user, kpi, perm);
  kpi.part = kpi.cats[0].part;
  kpi.category = kpi.cats[0].category;
  // ผลทั้งปีของปีที่มีชีตต้นทางอยู่ (และมีตัวชี้วัดนี้) แก้ได้เฉพาะ admin, ผอ., QMR
  kpi.lockedYears = sources.map(function(m) { return !!(m && m[kpi.id]); });
  return kpi;
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
 * จัดหมวดหน่วยงานอัตโนมัติ: หน่วยงานที่เพิ่มเข้ามา → เพิ่มหมวดชื่อหน่วยนั้น (หมวดย่อยชั่วคราว) · หน่วยงานที่เอาออก → เอาหมวดหน่วยนั้นออก
 * (เหลืออย่างน้อย 1 หมวดเสมอ) ไม่แตะหมวดอื่น
 */
function syncUnitCats_(cats, oldDepts, newDepts) {
  var out = cats.filter(function(c) { return !(oldDepts.indexOf(c.part) !== -1 && newDepts.indexOf(c.part) === -1); });
  if (out.length === 0) out = cats.slice();
  newDepts.forEach(function(d) {
    if (oldDepts.indexOf(d) === -1 && !out.some(function(c) { return c.part === d; })) {
      out.push({ part: d, category: UNIT_CATS_PLACEHOLDER });
    }
  });
  return out;
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
    var privileged = isPrivileged_(user);
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: false, message: "ไม่พบชีตปีงบประมาณ" };
    ensureColumns_(sheet, EXTRA_CATS_COL);

    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === item.id.toString().trim()) { rowIndex = i; break; }
    }
    if (rowIndex === -1) return { success: false, message: "ไม่พบรหัสตัวชี้วัดในปีงบ " + fy };

    var old = rowToKpi_(data[rowIndex]);
    var perm = getKpiPermission_(user, old, fy);
    if (!perm.view) return { success: false, message: "ไม่มีสิทธิ์เข้าถึงตัวชี้วัดนี้" };
    var hasResults = item.years !== undefined || item.months !== undefined;
    var hasDetails = item.templateDetails !== undefined || item.dataSource !== undefined;
    if (hasResults && !perm.editResults) return { success: false, message: "ไม่มีสิทธิ์แก้ไขผลตัวชี้วัดนี้ในปีงบ " + fy };
    if (hasDetails && !perm.editDetails) return { success: false, message: "ไม่มีสิทธิ์แก้ไขรายละเอียดตัวชี้วัดนี้ในปีงบ " + fy };
    var metaDiffers = ["name", "target", "owner", "department"].some(function(f) {
      return item[f] !== undefined && item[f].toString().trim() !== (old[f] || "").toString().trim();
    });
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
    if (deptAfter !== old.department) {
      var baseCats = newCats || old.cats;
      var syncedCats = syncUnitCats_(baseCats, parseDepts_(old.department), parseDepts_(deptAfter));
      if (syncedCats.map(catKey_).join("\n") !== baseCats.map(catKey_).join("\n")) newCats = syncedCats;
    }
    var coreAfter = (newCats || old.cats).some(function(c) { return isCorePart_(c.part); });
    if (newLevels.length > 0 && coreAfter && !hasHospitalLevel_(newLevels)) {
      return { success: false, message: "ตัวชี้วัดที่อยู่ในหมวด Part I–IV ต้องมีระดับ SAR หรือ QA-หน่วยงาน อย่างน้อย 1 ระดับ" };
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
        newMonths.push(item.months ? numberOrNull_(item.months[m]) : old.months[m]);
      }
      if (newYears.join("|") !== old.years.join("|") || newMonths.join("|") !== old.months.join("|")) changed = true;
      sheet.getRange(row, ANNUAL_FIRST_COL, 1, 17).setValues([newYears.concat(newMonths)]);
    }

    if (hasDetails) {
      var tpl = item.templateDetails !== undefined ? item.templateDetails : old.templateDetails;
      var src = item.dataSource !== undefined ? item.dataSource : old.dataSource;
      var detailsChanged = (tpl || "").trim() !== old.templateDetails || (src || "").trim() !== old.dataSource;
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
      if (item.name !== undefined && item.name.toString().trim() !== "" && item.name.toString().trim() !== old.name) {
        sheet.getRange(row, 5).setValue(item.name.toString().trim());
        changed = true;
      }
      if (item.target !== undefined && item.target.toString().trim() !== old.target) {
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
    }

    var fresh = rowToKpi_(sheet.getRange(row, 1, 1, EXTRA_CATS_COL).getValues()[0]);
    return {
      success: true,
      changed: changed,
      message: changed ? "บันทึกข้อมูลปีงบ " + fy + " เรียบร้อยแล้ว" : "ไม่มีการเปลี่ยนแปลง",
      kpi: decorateKpi_(user, fy, fresh, getAnnualSources_(fy))
    };
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  } finally {
    if (lock) lock.releaseLock();
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
    ensureColumns_(sheet, EXTRA_CATS_COL);
    if (!privileged && fy !== getCurrentFiscalYear_()) {
      return { success: false, message: "เพิ่มตัวชี้วัดใหม่ได้เฉพาะปีงบปัจจุบัน (" + getCurrentFiscalYear_() + ")" };
    }
    // หมวด: ส่งมาเป็นรายการ cats (หมวดแรก = หมวดหลัก) หรือ part/category เดี่ยวๆ แบบเดิม
    var cats = cleanCatList_(newItem.cats && newItem.cats.length ? newItem.cats : [{ part: newItem.part, category: newItem.category }]);
    newItem.name = (newItem.name || "").toString().trim();
    if (cats.length === 0 || !newItem.name) {
      return { success: false, message: "กรุณาระบุ หมวดหลัก หมวดหมู่ย่อย และชื่อตัวชี้วัด" };
    }
    newItem.part = cats[0].part;
    newItem.category = cats[0].category;
    var coreInvolved = cats.some(function(c) { return isCorePart_(c.part); });
    var newLevels = cleanLevelList_(newItem.levels || (newItem.level ? [newItem.level] : []), []);
    if (newLevels.length === 0) newLevels = [DEFAULT_KPI_LEVEL];
    if (coreInvolved && !hasHospitalLevel_(newLevels)) {
      return { success: false, message: "หมวด Part I–IV ต้องเป็นตัวชี้วัดระดับ SAR หรือ QA-หน่วยงาน (ถ้าเป็นระดับรายบุคคล/หน่วยงาน ให้ตั้งชื่อหมวดอื่น)" };
    }
    var data = sheet.getDataRange().getValues();
    // ผู้เพิ่ม (ที่ไม่ใช่ admin) ต้องเห็นตัวชี้วัดที่ตัวเองเพิ่ม จึงใส่ตัวเองเป็นผู้รับผิดชอบให้
    // ยกเว้น ผอ./QMR ที่เพิ่มตัวชี้วัด Part I–IV ระดับ SAR/QA ซึ่งเห็นได้อยู่แล้ว
    var seesAnyway = user.tier === "admin" || (user.tier === "executive" && coreInvolved && hasHospitalLevel_(newLevels));
    if (!seesAnyway) {
      var owners = parseOwners_(newItem.owner);
      if (owners.indexOf(user.username) === -1) owners.unshift(user.username);
      newItem.owner = owners.join(" / ");
    }
    if (!privileged && !(newItem.department || "").toString().trim()) newItem.department = user.depts.join(" / ");
    // ช่องหน่วยงานยังว่าง แต่ระบุผู้รับผิดชอบ → ใช้หน่วยงานของผู้รับผิดชอบ
    if (!(newItem.department || "").toString().trim() && newItem.owner) newItem.department = deptsOfOwners_(newItem.owner).join(" / ");
    // จัดหมวดหน่วยงานให้อัตโนมัติตามหน่วยงานของตัวชี้วัด (หมวดย่อยชั่วคราว "รอจัดหมวดย่อย")
    cats = syncUnitCats_(cats, [], parseDepts_(newItem.department));
    // ผู้เพิ่มต้องเห็นตัวชี้วัดที่ตัวเองเพิ่ม (เช่น ผอ. เพิ่มได้เฉพาะ Part I–IV ระดับ SAR/QA)
    var probe = { part: newItem.part, category: newItem.category, cats: cats, owner: newItem.owner || "", department: newItem.department || "", levels: newLevels };
    if (!getKpiPermission_(user, probe, fy).view) {
      return { success: false, message: "บัญชีผอ./QMR เพิ่มได้เฉพาะตัวชี้วัด Part I–IV ระดับ SAR/QA หรือที่ตัวเองเป็นผู้รับผิดชอบ" };
    }

    var count = data.filter(function(r) {
      return r[2] && r[2].toString().trim() === newItem.part.trim() &&
             r[3] && r[3].toString().trim() === newItem.category.trim();
    }).length;
    var autoNo = count + 1;
    var levels = newLevels;

    var newId = "KPI-" + new Date().getTime();
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
    sheet.appendRow(newRow);
    if (cats.length > 1 && !sheet.getRange(1, EXTRA_CATS_COL).getValue()) {
      sheet.getRange(1, EXTRA_CATS_COL).setValue(EXTRA_CATS_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
    }
    touchUser_(user, "edit");
    return { success: true, message: "เพิ่มตัวชี้วัดในปีงบ " + fy + " เรียบร้อยแล้ว", newId: newId };
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