/**
 * ⤵ ดึงข้อมูลจากปีงบก่อนหน้า (ต่อตัวชี้วัด — ปุ่มบนการ์ด/แถวตาราง): จับคู่กับชีตปีงบ (ปีนี้ − 1) ด้วยรหัสตัวชี้วัดเท่านั้น
 *  - ผลทั้งปีย้อนหลัง 4 ปี (ช่อง G–J): เติมเฉพาะช่องที่ว่าง ← ผลทั้งปีของปีก่อน · ผลของปีที่แล้ว (ปีงบ − 1) ถ้าปีก่อนยังว่างแต่มีผลรายเดือนครบ 12 เดือน = คำนวณตามวิธีสรุปของตัวชี้วัด
 *    สิทธิ์ = แก้ผลได้ (editResults) · ปีที่มีชีตต้นทางอยู่ (lockedYears) แก้ได้เฉพาะ admin, ผอ., QMR เหมือนการแก้ปกติ
 *  - รายละเอียด/การวิเคราะห์ (คอลัมน์ X): เติมเมื่อปีนี้ว่าง · ไม่ลงเวลา "อัปเดตการวิเคราะห์" (ผู้รับผิดชอบต้องทบทวนและบันทึกเอง)
 *  - ลิงก์เอกสารแนบ (KPI_Links): คัดลอกลิงก์ที่ผูกกับตัวชี้วัดนี้ในปีก่อนมาผูกปีนี้ (ลิงก์ URL เดียวกันที่มีแล้ว = ผูกเพิ่มรหัสนี้/ไม่ซ้ำ) · สิทธิ์ = แก้รายละเอียดได้ (editDetails)
 *  - ไม่ดึง: ชื่อ เป้าหมาย หน่วยงาน ผู้รับผิดชอบ ที่มา/สูตร ผลรายเดือน
 *  - pullPrevPreview = ดูก่อน (ไม่เขียน) · pullPrevCommit = เขียนจริงใต้ script lock + ตรวจรุ่น (baseRev) + bumpDataVersion_
 */

/** ค่าสรุปผลจากผลรายเดือนครบ 12 เดือน (มีเลขอย่างน้อย 1 ค่า) ตามวิธีสรุป — ไม่ครบ/ไม่มีเลข = null */
function pullPrevMonthlySummary_(months, method) {
  var nums = [];
  for (var i = 0; i < 12; i++) {
    var v = months[i];
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") nums.push(v);
  }
  if (nums.length === 0) return null;
  var sum = nums.reduce(function(a, b) { return a + b; }, 0), out;
  if (method === "ผลรวม") out = sum;
  else if (method === "เดือนล่าสุด") out = nums[nums.length - 1];
  else out = sum / nums.length;
  return Math.round(out * 100) / 100;
}

function pullPrevRow_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim() === id) {
      var r = data[i].slice();
      while (r.length < KPI_COLS) r.push("");
      return { index: i, row: r };
    }
  }
  return null;
}

/** วางแผนสิ่งที่จะดึง (ไม่เขียน) → { error } หรือแผน */
function pullPrevPlan_(user, fy, id) {
  id = (id || "").toString().trim();
  if (!id) return { error: "ไม่พบรหัสตัวชี้วัด" };
  var sheet = getFiscalSheet_(fy);
  if (!sheet) return { error: "ไม่พบชีตปีงบประมาณ" };
  ensureColumns_(sheet, KPI_COLS);
  var curHit = pullPrevRow_(sheet, id);
  if (!curHit) return { error: "ไม่พบรหัสตัวชี้วัดในปีงบ " + fy };
  var cur = rowToKpi_(curHit.row);
  var perm = getKpiPermission_(user, cur, fy);
  if (!perm.view) return { error: "ไม่มีสิทธิ์เข้าถึงตัวชี้วัดนี้" };
  if (!perm.editResults && !perm.editDetails) return { error: "ไม่มีสิทธิ์แก้ไขตัวชี้วัดนี้" };
  var prevFy = fy - 1, prevSheet = getFiscalSheet_(prevFy);
  if (!prevSheet) return { error: "ไม่พบชีตปีงบ " + prevFy + " (ไม่มีปีงบก่อนหน้าให้ดึง)" };
  var prevHit = pullPrevRow_(prevSheet, id);
  if (!prevHit) return { error: "ปีงบ " + prevFy + " ไม่มีตัวชี้วัดรหัสนี้ (จับคู่ด้วยรหัสเท่านั้น)" };
  var prev = rowToKpi_(prevHit.row);
  var privileged = isPrivileged_(user);
  var sources = getAnnualSources_(fy);

  // ผลทั้งปี: ช่องปี y (0..3 = ปีงบ−4…ปีงบ−1) ของปีนี้ = ช่อง y+1 ของชีตปีก่อน
  var years = [];
  for (var y = 0; y < 4; y++) {
    var item = { index: y, year: fy - 4 + y, current: cur.years[y], value: null, via: "", action: "none" };
    var pv = prev.years[y + 1], via = "ผลทั้งปีในชีตปีงบ " + prevFy;
    if (pv === null && y === 3) {
      pv = pullPrevMonthlySummary_(prev.months, cur.summaryMethod);
      via = "คำนวณจากผลรายเดือนปีงบ " + prevFy + " (" + cur.summaryMethod + ")";
    }
    item.value = pv; item.via = pv === null ? "" : via;
    if (cur.years[y] !== null) item.action = "keep";
    else if (pv === null) item.action = "none";
    else if (!perm.editResults) item.action = "noperm";
    else if (!privileged && sources[y] && sources[y][id]) item.action = "locked";
    else item.action = "fill";
    years.push(item);
  }

  // รายละเอียด/การวิเคราะห์
  var curText = (cur.templateDetails || "").trim(), prevText = (prev.templateDetails || "").trim();
  var details = { action: "none", text: prevText };
  if (curText) details.action = prevText ? "keep" : "none";
  else if (!prevText) details.action = "none";
  else details.action = perm.editDetails ? "fill" : "noperm";

  // ลิงก์เอกสารแนบ
  var linkSheet = kpiLinkSheetIfAny_();
  var prevLinks = kpiLinkRead_(linkSheet, prevFy).filter(function(l) { return l.ids.indexOf(id) !== -1; });
  var curLinks = kpiLinkRead_(linkSheet, fy);
  var links = prevLinks.map(function(p) {
    var same = curLinks.filter(function(l) { return l.url === p.url; })[0] || null;
    var action;
    if (same && same.ids.indexOf(id) !== -1) action = "keep";
    else if (!perm.editDetails) action = "noperm";
    else action = same ? "attach" : "new";
    return { title: p.title, url: p.url, note: p.note, action: action, sameRow: same ? same.row : 0, sameRev: same ? same.rev : 0, sameIds: same ? same.ids : [] };
  });

  var todo = years.filter(function(y) { return y.action === "fill"; }).length + (details.action === "fill" ? 1 : 0) +
    links.filter(function(l) { return l.action === "new" || l.action === "attach"; }).length;
  return { fy: fy, prevFy: prevFy, id: id, sheet: sheet, row: curHit.index + 1, cur: cur, perm: perm, years: years, details: details, links: links, todo: todo };
}

function pullPrevPublic_(plan) {
  return {
    fy: plan.fy, prevFy: plan.prevFy, id: plan.id, rev: plan.cur.rev, todo: plan.todo, name: plan.cur.name,
    years: plan.years,
    details: { action: plan.details.action, text: plan.details.action === "none" ? "" : plan.details.text.slice(0, 300), length: plan.details.text.length },
    links: plan.links.map(function(l) { return { title: l.title, action: l.action }; })
  };
}

/** ดูตัวอย่างก่อนดึง (ไม่เขียนอะไร) */
function pullPrevPreview(token, fy, id) {
  try {
    var user = requireUser_(token);
    fy = resolveFiscalYear_(fy);
    var plan = pullPrevPlan_(user, fy, id);
    if (plan.error) return { success: false, message: plan.error };
    return { success: true, preview: pullPrevPublic_(plan) };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/** ดึงจริง — baseRev = รุ่นของตัวชี้วัดตอนดูตัวอย่าง (ถ้าถูกแก้ไประหว่างนั้น ให้ดูตัวอย่างใหม่) */
function pullPrevCommit(token, fy, id, baseRev) {
  var lock = null;
  try {
    var user = requireUser_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var plan = pullPrevPlan_(user, fy, id);
    if (plan.error) return { success: false, message: plan.error };
    if (baseRev && baseRev !== plan.cur.rev) {
      return { success: false, conflict: true, message: "ตัวชี้วัดนี้ถูกแก้ไขโดย " + (plan.cur.editedBy || "ผู้ใช้อื่น") + " ระหว่างที่คุณดูตัวอย่าง กรุณากดดึงข้อมูลใหม่อีกครั้ง" };
    }
    var sheet = plan.sheet, row = plan.row, done = { years: 0, details: 0, links: 0 };
    var annualChanges = [];
    plan.years.forEach(function(y) {
      if (y.action === "fill") { annualChanges.push({ id: plan.id, year: y.year, value: y.value, skipFy: null }); done.years++; }
    });
    if (plan.details.action === "fill") { // ไม่ลงเวลาอัปเดตการวิเคราะห์ (ANALYSIS_COL) — ให้ผู้รับผิดชอบทบทวนแล้วบันทึกเอง
      sheet.getRange(row, 24).setValue(plan.details.text);
      done.details = 1;
    }
    propagateAnnual_(annualChanges);

    var stamp = nowStamp_(), linkSheet = null;
    plan.links.forEach(function(l) {
      if (l.action === "attach") {
        linkSheet = linkSheet || kpiLinkSheetEnsure_();
        var ids = l.sameIds.concat([plan.id]);
        linkSheet.getRange(l.sameRow, 5).setValue(ids.join(", "));
        linkSheet.getRange(l.sameRow, 7, 1, 3).setValues([[l.sameRev + 1, stamp, user.username]]);
        done.links++;
      } else if (l.action === "new") {
        linkSheet = linkSheet || kpiLinkSheetEnsure_();
        var rowN = linkSheet.getLastRow() + 1;
        linkSheet.getRange(rowN, 2, 1, KPILINK_HEADERS.length - 1).setNumberFormat("@");
        linkSheet.getRange(rowN, 1, 1, KPILINK_HEADERS.length).setValues([[fy, "L" + Utilities.getUuid().replace(/-/g, "").slice(0, 10), l.title, l.url, plan.id, l.note, 1, stamp, user.username, stamp, user.username, KPILINK_ACTIVE]]);
        done.links++;
      }
    });

    if (done.years + done.details + done.links === 0) return { success: true, changed: false, done: done, message: "ไม่มีข้อมูลใหม่ให้ดึง" };
    if (done.years + done.details > 0) {
      stampRow_(sheet, row, user, "edit");
      bumpDataVersion_(annualChanges.length > 0 ? "*" : fy, [plan.id], user); // ผลทั้งปีเขียนลงชีตปีอื่นด้วย
    }
    if (done.links > 0) bumpDataVersion_(fy, [], user, KPILINK_DOC);
    touchUser_(user, "edit");
    var fresh = rowToKpi_(sheet.getRange(row, 1, 1, KPI_COLS).getValues()[0]);
    return { success: true, changed: true, done: done, kpi: decorateKpi_(user, fy, fresh, getAnnualSources_(fy)),
      message: "ดึงข้อมูลจากปีงบ " + plan.prevFy + " แล้ว" };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}
