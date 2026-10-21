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
  return {
    id: row[0].toString().trim(),
    no: row[1] ? row[1].toString().trim() : "",
    part: row[2] ? row[2].toString().trim() : "ทั่วไป",
    category: row[3] ? row[3].toString().trim() : "ทั่วไป",
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
    level: normalizeLevel_(row[28]),
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
      var perm = getKpiPermission_(user, kpi, fy);
      if (!perm.view) continue;
      kpi.canEditResults = perm.editResults;
      kpi.canEditDetails = perm.editDetails;
      // ผลทั้งปีของปีที่มีชีตต้นทางอยู่ (และมีตัวชี้วัดนี้) แก้ได้เฉพาะ admin, ผอ., QMR
      kpi.lockedYears = sources.map(function(m) { return !!(m && m[kpi.id]); });
      allData.push(kpi);
    }
    return { success: true, data: allData, fy: fy, currentFy: currentFy, years: years };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

function getCategoryKpis_(user, fy, partName, categoryName) {
  var sheet = getFiscalSheet_(fy);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var kpis = [];
  var targetPart = partName.toString().trim();
  var targetCategory = categoryName.toString().trim();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0] && row[2] && row[3] && row[2].toString().trim() === targetPart && row[3].toString().trim() === targetCategory) {
      var kpi = rowToKpi_(row);
      if (getKpiPermission_(user, kpi, fy).view) kpis.push(kpi);
    }
  }
  return kpis;
}

// ผู้ใช้ทั่วไปแก้ได้เฉพาะตัวที่ตนมีสิทธิ์ (ผู้รับผิดชอบ / หัวหน้าหน่วย) ในปีงบปัจจุบัน และเฉพาะรายละเอียด/ที่มาข้อมูล
// ส่วนผู้รับผิดชอบ หน่วยงาน และระดับตัวชี้วัด แก้ได้เฉพาะ admin, ผอ., QMR — แก้ในปีงบที่เลือกเท่านั้น ปีอื่นไม่เปลี่ยน
function updateKpiDetails(token, fy, partName, id, details) {
  try {
    var user = requireUser_(token);
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: false, message: "ไม่พบชีตปีงบประมาณ" };

    var data = sheet.getDataRange().getValues();
    var targetId = id.toString().trim();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === targetId) {
        var old = rowToKpi_(data[i]);
        if (!getKpiPermission_(user, old, fy).editDetails) {
          return { success: false, message: "ไม่มีสิทธิ์แก้ไขรายละเอียดตัวชี้วัดนี้ในปีงบ " + fy };
        }
        var actualRow = i + 1;
        var changed = (details.templateDetails || "").trim() !== old.templateDetails ||
                      (details.dataSource || "").trim() !== old.dataSource;
        sheet.getRange(actualRow, 24).setValue(details.templateDetails || "");
        sheet.getRange(actualRow, 25).setValue(details.dataSource || "");
        if (isPrivileged_(user)) {
          var newLevel = details.level && KPI_LEVELS.indexOf(details.level) !== -1 ? details.level : old.level;
          if ((details.owner || "").trim() !== old.owner || (details.department || "").trim() !== old.department || newLevel !== old.level) changed = true;
          sheet.getRange(actualRow, 26).setValue(details.owner || "");
          sheet.getRange(actualRow, 27).setValue(details.department || "");
          sheet.getRange(actualRow, LEVEL_COLUMN).setValue(newLevel);
        }
        if (changed) {
          stampRow_(sheet, actualRow, user, "edit");
          touchUser_(user, "edit");
        }
        return { success: true, message: "บันทึกข้อมูลรายละเอียดสำเร็จ (ปีงบ " + fy + ")" };
      }
    }
    return { success: false, message: "ไม่พบรหัสตัวชี้วัดในระบบ" };
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  }
}

function updateIndicatorsBulk(token, fy, partName, updatedItems) {
  try {
    var user = requireUser_(token);
    var privileged = isPrivileged_(user);
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: false, message: "ไม่พบชีตปีงบประมาณ" };

    var sources = getAnnualSources_(fy);
    var data = sheet.getDataRange().getValues();
    var ids = data.map(function(r) { return r[0] ? r[0].toString().trim() : ""; });
    var saved = 0;
    var denied = 0;
    var edited = false;
    var annualChanges = [];

    updatedItems.forEach(function(item) {
      var rowIndex = ids.indexOf(item.id.toString().trim());
      if (rowIndex === -1) return;
      var old = rowToKpi_(data[rowIndex]);
      if (!getKpiPermission_(user, old, fy).editResults) { denied++; return; }
      var actualRow = rowIndex + 1;

      var newYears = old.years.slice();
      for (var i = 0; i < 5; i++) {
        var locked = i < 4 && sources[i] && sources[i][old.id];
        if (locked && !privileged) continue; // ผลปีที่มีชีตต้นทางอยู่ แก้ได้เฉพาะ admin, ผอ., QMR
        var nv = numberOrNull_(item.years ? item.years[i] : null);
        if (nv === old.years[i]) continue;
        newYears[i] = nv;
        // ผลทั้งปีของปี Y ต้องตรงกันทุกชีตที่เก็บปีนั้น (ช่อง K ของชีตปี Y และ G–J ของชีตปีถัดๆ ไป)
        annualChanges.push({ id: old.id, year: fy - 4 + i, value: nv, skipFy: i === 4 ? fy : null });
      }
      var newMonths = [];
      for (var m = 0; m < 12; m++) newMonths.push(numberOrNull_(item.months ? item.months[m] : null));

      var changed = newYears.join("|") !== old.years.join("|") || newMonths.join("|") !== old.months.join("|");
      if (privileged) {
        if ((item.name || "").trim() !== old.name || (item.target || "").toString().trim() !== old.target) changed = true;
        sheet.getRange(actualRow, 2).setValue(item.no);
        sheet.getRange(actualRow, 5).setValue(item.name);
        sheet.getRange(actualRow, 6).setValue(item.target);
      }
      sheet.getRange(actualRow, ANNUAL_FIRST_COL, 1, 17).setValues([newYears.concat(newMonths)]);
      if (changed) { stampRow_(sheet, actualRow, user, "edit"); edited = true; }
      saved++;
    });
    propagateAnnual_(annualChanges);
    if (edited) touchUser_(user, "edit");
    var msg = "บันทึกข้อมูลปีงบ " + fy + " เรียบร้อยแล้ว (" + saved + " รายการ)";
    if (denied > 0) msg += " — ข้าม " + denied + " รายการที่ไม่มีสิทธิ์แก้ไข";
    return { success: true, message: msg };
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  }
}

// บันทึกเวลาเข้าดูตัวชี้วัด — หน้าเว็บรวมรายการแล้วส่งเป็นชุดทุก ~30 วินาที (ไม่ให้ช้าตอนคลิกดู)
function recordViews(token, fy, ids) {
  try {
    var user = requireUser_(token);
    if (!ids || ids.length === 0) return { success: true, count: 0 };
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
  }
}

// เพิ่มตัวชี้วัดใหม่ในปีงบที่เลือก — เฉพาะ admin, ผอ., QMR (ปีงบถัดไปจะคัดลอกตามจากปีล่าสุดเอง)
function addIndicator(token, fy, newItem) {
  try {
    var user = requirePrivileged_(token);
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: false, message: "ไม่พบชีตปีงบประมาณ" };
    var data = sheet.getDataRange().getValues();

    var count = data.filter(function(r) {
      return r[2] && r[2].toString().trim() === newItem.part.trim() &&
             r[3] && r[3].toString().trim() === newItem.category.trim();
    }).length;
    var autoNo = count + 1;
    var level = KPI_LEVELS.indexOf(newItem.level) !== -1 ? newItem.level : DEFAULT_KPI_LEVEL;

    var newId = "KPI-" + new Date().getTime();
    var newRow = [
      newId, autoNo, newItem.part, newItem.category, newItem.name, newItem.target,
      newItem.years[0], newItem.years[1], newItem.years[2], newItem.years[3], newItem.years[4],
      newItem.months[0], newItem.months[1], newItem.months[2], newItem.months[3],
      newItem.months[4], newItem.months[5], newItem.months[6], newItem.months[7],
      newItem.months[8], newItem.months[9], newItem.months[10], newItem.months[11],
      newItem.templateDetails || "", newItem.dataSource || "", newItem.owner || "", newItem.department || "",
      "", level, nowStamp_(), user.username
    ];
    sheet.appendRow(newRow);
    touchUser_(user, "edit");
    return { success: true, message: "เพิ่มตัวชี้วัดในปีงบ " + fy + " เรียบร้อยแล้ว", newId: newId };
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  }
}

// ลบตัวชี้วัดออกจากปีงบที่เลือกเท่านั้น (ปีงบอื่นยังเก็บไว้เป็นประวัติ) — เฉพาะ admin, ผอ., QMR
function deleteIndicator(token, fy, partName, id) {
  try {
    requirePrivileged_(token);
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: false, message: "ไม่พบชีตปีงบประมาณ" };

    var data = sheet.getDataRange().getValues();
    var ids = data.map(function(r) { return r[0] ? r[0].toString().trim() : ""; });
    var rowIndex = ids.indexOf(id.toString().trim());

    if (rowIndex !== -1) {
      sheet.deleteRow(rowIndex + 1);
      return { success: true, message: "ลบตัวชี้วัดออกจากปีงบ " + fy + " เรียบร้อยแล้ว" };
    } else {
      return { success: false, message: "ไม่พบรหัสตัวชี้วัดที่ต้องการลบ" };
    }
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  }
}

function exportCategoryToPdf(token, fy, partName, categoryName) {
  try {
    fy = resolveFiscalYear_(fy);
    var kpis = getCategoryKpis_(requireUser_(token), fy, partName, categoryName);
    var yLabels = [fy-4, fy-3, fy-2, fy-1, fy];
    
    var html = '<html><head><meta charset="utf-8"><style>' +
               '@page { size: A4 landscape; margin: 10mm; }' +
               'body { font-family: "sans-serif"; margin: 0; color: #1e293b; }' +
               '.title { text-align: center; font-size: 18px; font-weight: bold; color: #0284c7; margin-bottom: 5px; }' +
               '.subtitle { text-align: center; font-size: 13px; color: #64748b; margin-bottom: 20px; }' +
               'table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }' +
               'th, td { border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; }' +
               'th { background-color: #e0f2fe; font-weight: bold; color: #0f172a; }' +
               '.col-target { background-color: #dcfce7 !important; }' + 
               'td.left-align { text-align: left; font-weight: bold; }' +
               '</style></head><body>' +
               '<div class="title">รายงานสรุปผลการดำเนินงานระบบตัวชี้วัดคุณภาพ</div>' +
               '<div class="subtitle">หมวดหมู่: ' + categoryName + ' (' + partName + ') ปีงบประมาณ ' + fy + '</div>' +
               '<table><thead><tr>' +
               '<th rowspan="2" style="width:30px;">ลำดับ</th><th rowspan="2">ชื่อตัวชี้วัด</th><th rowspan="2" class="col-target" style="width:60px;">เป้าหมาย</th>' +
               '<th colspan="5">ผลงานย้อนหลัง 5 ปี</th><th colspan="12">ผลงานรายเดือน ปีงบ ' + fy + ' (ต.ค. - ก.ย.)</th>' +
               '</tr><tr>' +
               '<th>' + yLabels[0] + '</th><th>' + yLabels[1] + '</th><th>' + yLabels[2] + '</th><th>' + yLabels[3] + '</th><th>' + yLabels[4] + '</th>' +
               '<th>ต.ค.</th><th>พ.ย.</th><th>ธ.ค.</th><th>ม.ค.</th><th>ก.พ.</th><th>มี.ค.</th><th>เม.ย.</th><th>พ.ค.</th><th>มิ.ย.</th><th>ก.ค.</th><th>ส.ค.</th><th>ก.ย.</th>' +
               '</tr></thead><tbody>';
               
    if (kpis.length === 0) {
      html += '<tr><td colspan="20">ไม่พบข้อมูลตัวชี้วัดในหมวดนี้</td></tr>';
    } else {
      kpis.forEach(function(kpi, idx) {
        html += '<tr>' +
                '<td>' + (idx + 1) + '</td>' +
                '<td class="left-align">' + kpi.name + '</td>' +
                '<td class="col-target">' + kpi.target + '</td>';
                
        for (var i = 0; i < 5; i++) {
          html += '<td>' + (kpi.years[i] !== null ? kpi.years[i] : '-') + '</td>';
        }
        for (var j = 0; j < 12; j++) {
          html += '<td>' + (kpi.months[j] !== null ? kpi.months[j] : '-') + '</td>';
        }
        html += '</tr>';
      });
    }
    
    html += '</tbody></table></body></html>';
    
    var blob = HtmlService.createHtmlOutput(html).getAs('application/pdf');
    var filename = "รายงานตัวชี้วัด_" + categoryName.replace(/\s+/g, '_') + ".pdf";
    blob.setName(filename);
    
    return {
      success: true,
      base64: Utilities.base64Encode(blob.getBytes()),
      filename: filename
    };
  } catch(e) {
    return { success: false, message: e.toString() };
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