/**
 * นำเข้าตัวชี้วัดหน่วยงาน PCT (ครั้งเดียว) จากไฟล์ "KPI PCT HA 2568" — ข้อมูลอยู่ใน PctData.js
 *  - ตัวที่ซ้ำกับตัวชี้วัดในระบบ (รพ. / ฝ่ายการพยาบาล / หน่วยอื่น) → รวมเป็นการ์ดเดียว:
 *      เลือกข้อมูลจากแหล่งที่ปีล่าสุดกว่า → ผลครบกว่า → ผลดีกว่า (ตามทิศทางเป้าหมาย) → ตัวที่มีอยู่เดิม
 *      ช่องว่างเติมจากแหล่งอื่น · ผู้รับผิดชอบ/หน่วยงาน/ระดับ/หมวดรวมกัน (ทุกคนเห็นการ์ดนี้)
 *  - ตัวที่แต่ละหอเก็บของตัวเอง (IPD / VIP ฯลฯ) → เป็นตัวชี้วัดย่อยของตัวชี้วัด PCT
 *  - ตัวที่ไม่ซ้ำ → เพิ่มใหม่ในหน่วยงาน PCT (มิติ 2 / 5) ผู้รับผิดชอบ = หัวหน้า PCT
 * ตัวคำนวณ (pctComputeSheet_) เป็นฟังก์ชันล้วน ทดสอบกับข้อมูลจริงได้ · ก่อนเขียนสำรองชีตและบันทึกค่าเดิมใน Tidy_Log
 */

var PCT_UNIT = "PCT";
var PCT_FLAG = "PCT_IMPORT_V1";
var PCT_HEADS = ["ธวัชชัย", "รินทร์ลภัส", "อรทัย"]; // หัวหน้า PCT
var PCT_ID_PREFIX = "PCT-KPI-";
var PCT_NOTE_MARK = "ผลย้อนหลังจากไฟล์ KPI PCT";

function pctId_(i) { var s = "0000" + (i + 1); return PCT_ID_PREFIX + s.slice(-4); }

/** เป้าหมายแบบ "ยิ่งน้อยยิ่งดี" ไหม (1 = ใช่, 0 = ยิ่งมากยิ่งดี, null = ไม่ทราบ) */
function pctLowerBetter_(target) {
  var t = (target || "").toString().trim();
  if (!t) return null;
  if (/[<≤]|ไม่เกิน|ลดลง/.test(t) || /^0(\s|$|%)/.test(t)) return 1;
  return 0;
}

function pctNum_(v) { return v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v); }

/** ปีสัมบูรณ์ → ผล ของแถวในชีตปีงบ fy (คอลัมน์ G–K = fy-4 … fy) */
function pctYearsOfRow_(row, fy) {
  var out = {};
  for (var i = 0; i < 5; i++) { var n = pctNum_(row[6 + i]); if (n !== null) out[fy - 4 + i] = n; }
  return out;
}

/** สรุปแหล่งข้อมูลหนึ่งแหล่งเพื่อจัดอันดับ: ปีล่าสุดที่มีผล / จำนวนปีที่มีผล / ผลปีล่าสุด */
function pctInfo_(years) {
  var ys = Object.keys(years).map(Number).sort(function(a, b) { return b - a; });
  return { latest: ys.length ? ys[0] : 0, count: ys.length, value: ys.length ? years[ys[0]] : null };
}

/** a ดีกว่า b ไหม: ล่าสุดกว่า → ครบกว่า → ผลดีกว่า (ปีล่าสุดเท่ากัน) */
function pctBetter_(a, b, lowerBetter) {
  if (a.latest !== b.latest) return a.latest > b.latest ? 1 : -1;
  if (a.count !== b.count) return a.count > b.count ? 1 : -1;
  if (lowerBetter !== null && a.value !== null && b.value !== null && a.value !== b.value) {
    return (lowerBetter ? a.value < b.value : a.value > b.value) ? 1 : -1;
  }
  return 0;
}

/** ชื่อที่เหมาะสมที่สุดในกลุ่มที่รวมกัน: ไม่มีปี/หมายเหตุพิเศษ ยาวที่สุดไม่เกิน 140 ตัวอักษร */
function pctPickName_(names) {
  var cleaned = names.map(function(n) { return (n || "").toString().replace(/\s+/g, " ").replace(/[*\s]+$/, "").trim(); }).filter(Boolean);
  var good = cleaned.filter(function(n) { return !/25[6-9][0-9]|\*\*/.test(n) && n.length <= 140; });
  var pool = good.length ? good : cleaned;
  var best = pool[0] || "";
  pool.forEach(function(n) { if (n.length > best.length) best = n; });
  return best;
}

function pctAddCat_(row, part, category) {
  var cats = kpiCats_({ cats: [{ part: (row[2] || "ทั่วไป").toString().trim(), category: (row[3] || "ทั่วไป").toString().trim() }].concat(parseExtraCats_(row[EXTRA_CATS_COL - 1])) });
  if (!cats.some(function(c) { return c.part === part; })) cats.push({ part: part, category: category }); // มีหมวดของหน่วยนี้อยู่แล้ว ไม่เพิ่มซ้ำ
  row[2] = cats[0].part; row[3] = cats[0].category; row[EXTRA_CATS_COL - 1] = formatExtraCats_(cats.slice(1));
}

function pctUnion_(text, extra, splitter) {
  var list = splitter(text).slice();
  extra.forEach(function(x) { if (x && list.indexOf(x) === -1) list.push(x); });
  return list.join(" / ");
}

function pctUnitTag_(row) {
  var d = parseDepts_(row[26]).filter(function(x) { return x !== NURSING_UNIT_NAME && x !== PCT_UNIT; });
  return d.length ? d[0] : "";
}

/**
 * rows: แถวข้อมูล (ไม่รวมหัวตาราง) · fy: ปีงบ · users: { ชื่อ: true } ผู้ใช้ที่มีในระบบ
 * คืน { rows (หลังนำเข้า), drops: [{keepId, dropId, row}], created: [id], changed: [id], redirects, counts, samples }
 */
function pctComputeSheet_(rows, fy, users) {
  var out = rows.map(function(r) { return r.slice(); });
  var idx = {}, orig = {}, drop = {}, redirects = {}, rowIdOf = {}, touched = {}, created = [], samples = { merged: [], kids: [], created: [] };
  var counts = { merged: 0, created: 0, kids: 0, dropped: 0, names: 0 };
  out.forEach(function(r, i) { var id = (r[0] || "").toString().trim(); if (id) { idx[id] = i; orig[id] = rows[i]; } });
  var plan = PCT_PLAN;

  function fold(keepId, dropId) {   // รวมแถวซ้ำเข้า keepId (ระดับ/เจ้าของ/หน่วย/หมวด/ช่องว่าง)
    if (drop[dropId] || keepId === dropId || idx[keepId] === undefined || idx[dropId] === undefined) return;
    out[idx[keepId]] = tidyMergeRows_(out[idx[keepId]], out[idx[dropId]]);
    drop[dropId] = keepId; redirects[dropId] = keepId; touched[keepId] = 1; counts.dropped++;
  }
  // 1) ตัวของหอที่ซ้ำกันเอง (เช่น IPD ใส่ทั้งตัวปกติและตัวหัวข้อ QA)
  Object.keys(plan.dup).forEach(function(k) { plan.dup[k].forEach(function(d) { fold(k, d); }); });

  // 2) แต่ละรายการของ PCT
  PCT_ROWS.forEach(function(e) {
    var dimLabel = tidyDimLabel_(e.d);
    var present = (plan.merge[String(e.i)] || []).filter(function(id) { return idx[id] !== undefined && !drop[id]; });
    var pctInfoV = pctInfo_(e.y), pctYears = {};
    Object.keys(e.y).forEach(function(y) { pctYears[Number(y)] = e.y[y]; });
    var id, row;
    if (present.length > 0) {
      // เลือกแหล่งหลัก: ปีล่าสุด → ครบกว่า → ผลดีกว่า → ตัวเดิม (ตัวชี้วัด รพ. ก่อนตัวของหน่วย)
      var lower = pctLowerBetter_(e.t);   // ทิศทางเป้าหมายตามนิยามของ PCT ก่อน ไม่มีค่อยใช้ของตัวเดิม
      if (lower === null) lower = pctLowerBetter_(out[idx[present[0]]][5]);
      var ranked = present.map(function(pid, n) { return { id: pid, info: pctInfo_(pctYearsOfRow_(out[idx[pid]], fy)), n: n, sar: pid.indexOf("NURSE-") !== 0 }; });
      ranked.sort(function(a, b) {
        var c = pctBetter_(b.info, a.info, lower);
        if (c) return c;
        if (a.sar !== b.sar) return a.sar ? -1 : 1;
        return a.n - b.n;
      });
      var keepId = ranked[0].id, pctWins = pctBetter_(pctInfoV, ranked[0].info, lower) > 0;
      var names = present.map(function(pid) { return out[idx[pid]][4]; }).concat([e.n]);
      ranked.slice(1).forEach(function(r) { fold(keepId, r.id); });
      row = out[idx[keepId]]; id = keepId;
      for (var yr = fy - 4; yr <= fy; yr++) {
        var v = pctYears[yr];
        if (v === undefined) continue;
        var col = 6 + (yr - (fy - 4));
        if (pctWins || pctNum_(row[col]) === null) row[col] = v;
      }
      if (e.t && (pctWins || !(row[5] || "").toString().trim())) row[5] = e.t;
      var nm = pctPickName_(names);
      if (nm && nm !== (row[4] || "").toString().trim()) { row[4] = nm; counts.names++; }
      pctAddCat_(row, PCT_UNIT, dimLabel);
      row[25] = pctUnion_(row[25], e.o && users[e.o] ? [e.o] : [], parseOwners_);
      row[26] = pctUnion_(row[26], [PCT_UNIT], parseDepts_);
      var lv = normalizeLevels_(row[LEVEL_COLUMN - 1]);
      if (lv.indexOf("หน่วยงาน") === -1) lv.push("หน่วยงาน");
      row[LEVEL_COLUMN - 1] = sortLevels_(lv).join(", ");
      touched[keepId] = 1; counts.merged++;
      if (samples.merged.length < 60) samples.merged.push({ name: nm, ids: present.slice(), pctName: e.n });
    } else {
      id = pctId_(e.i);
      if (idx[id] !== undefined) { row = out[idx[id]]; }
      else {
        row = []; for (var c0 = 0; c0 < KPI_COLS; c0++) row.push("");
        row[0] = id; row[2] = PCT_UNIT; row[3] = dimLabel; row[4] = e.n; row[5] = e.t;
        row[25] = pctUnion_(e.o && users[e.o] ? e.o : "", PCT_HEADS, parseOwners_);
        row[26] = PCT_UNIT; row[LEVEL_COLUMN - 1] = "รายบุคคล, หน่วยงาน";
        row[33] = DEFAULT_SUMMARY_METHOD; row[35] = "รายปี"; row[GROUP_COL - 1] = e.g;
        for (var y2 = fy - 4; y2 <= fy; y2++) if (pctYears[y2] !== undefined) row[6 + (y2 - (fy - 4))] = pctYears[y2];
        idx[id] = out.length; out.push(row); created.push(id); counts.created++; touched[id] = 1;
        if (samples.created.length < 60) samples.created.push(e.n);
      }
    }
    rowIdOf[e.i] = id;
    // ผลย้อนหลังที่ชีตปีงบนี้ไม่มีช่องเก็บ + ลิงก์ที่มาข้อมูล → เขียนไว้ในช่องที่มา/สูตร (ครั้งเดียว)
    var old = Object.keys(pctYears).map(Number).filter(function(y) { return y < fy - 4; }).sort();
    var src = (row[24] || "").toString(), add = [];
    if (old.length && src.indexOf(PCT_NOTE_MARK) === -1) add.push(PCT_NOTE_MARK + " (ช่วงที่ระบบไม่มีช่องเก็บ): " + old.map(function(y) { return y + " = " + pctYears[y]; }).join("; "));
    if (e.l && src.indexOf(e.l) === -1) add.push("ลิงก์ข้อมูล HDC: " + e.l);
    if (add.length) { row[24] = src ? src + "\n" + add.join("\n") : add.join("\n"); touched[id] = 1; }
  });

  // 3) ตัวของหอ (IPD / VIP ฯลฯ) → ตัวชี้วัดย่อยของตัวชี้วัด PCT · ตัวย่อยภายใน PCT ผูกตามลำดับชั้นของไฟล์
  Object.keys(plan.kids).forEach(function(pi) {
    var parentId = rowIdOf[Number(pi)], dimLabel = tidyDimLabel_(PCT_ROWS[Number(pi)].d);
    if (!parentId) return;
    plan.kids[pi].forEach(function(kid) {
      var i = idx[kid];
      if (i === undefined || drop[kid] || kid === parentId) return;
      var r = out[i], tag = pctUnitTag_(r), nm = (r[4] || "").toString().replace(/[*\s]+$/, "").trim();
      if (tag && nm.indexOf(tag) === -1) { nm += " (" + tag + ")"; }
      if (nm !== (r[4] || "").toString()) { r[4] = nm; counts.names++; }
      r[PARENT_COL - 1] = parentId;
      pctAddCat_(r, PCT_UNIT, dimLabel);
      r[26] = pctUnion_(r[26], [PCT_UNIT], parseDepts_);
      touched[kid] = 1; counts.kids++;
      if (samples.kids.length < 60) samples.kids.push({ name: nm, parent: PCT_ROWS[Number(pi)].n });
    });
  });
  PCT_ROWS.forEach(function(e) {
    var p = plan.parent[String(e.i)];
    if (p === undefined) return;
    var cid = rowIdOf[e.i], pid = rowIdOf[p];
    if (!cid || !pid || cid === pid || idx[cid] === undefined) return;
    var r = out[idx[cid]];
    if (!(r[PARENT_COL - 1] || "").toString().trim()) { r[PARENT_COL - 1] = pid; touched[cid] = 1; }
  });

  var kept = out.filter(function(r) { return !drop[(r[0] || "").toString().trim()]; });
  var changed = Object.keys(touched).filter(function(id) {
    return !drop[id] && created.indexOf(id) === -1 && JSON.stringify(out[idx[id]]) !== JSON.stringify(orig[id]);
  });
  var drops = Object.keys(drop).map(function(d) { return { keepId: drop[d], dropId: d, row: orig[d] }; });
  return { rows: kept, drops: drops, created: created, changed: changed, redirects: redirects, counts: counts, samples: samples };
}

// ---------------------------------------------------------------- อ่าน / วางแผน / เขียนจริง

function pctUsersMap_() {
  var us = getUsersSheetForPct_();
  var map = {};
  if (us) readUsers_(us).forEach(function(u) { map[u.username] = u; });
  return map;
}
function getUsersSheetForPct_() { return getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME); }

function pctPlanAll_() {
  var users = pctUsersMap_(), plan = { fys: [], users: users };
  listFiscalYears_().forEach(function(fy) {
    var d = tidyReadFy_(fy);
    if (!d) return;
    plan.fys.push({ fy: fy, sheet: d.sheet, rawRows: d.rows, comp: pctComputeSheet_(d.rows, fy, users) });
  });
  return plan;
}

function pctSummary_(plan) {
  var done = PropertiesService.getScriptProperties().getProperty(PCT_FLAG);
  var s = { done: done || "", fys: [], samples: { merged: [], kids: [], created: [] }, users: [] };
  plan.fys.forEach(function(f) {
    var c = f.comp.counts;
    s.fys.push({ fy: f.fy, total: f.rawRows.length, after: f.comp.rows.length, merged: c.merged, created: c.created, kids: c.kids, dropped: c.dropped, names: c.names });
  });
  var last = plan.fys[plan.fys.length - 1];
  if (last) s.samples = last.comp.samples;
  PCT_HEADS.forEach(function(n) { var u = plan.users[n]; s.users.push({ name: n, exists: !!u, tier: u ? u.tier : "", hasPct: !!(u && u.depts.indexOf(PCT_UNIT) !== -1) }); });
  return s;
}

function pctApply_(plan) {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL), stamp = nowStamp_(), logRows = [], out = { fys: {}, users: 0, sync: 0 };
  var redirect = {};
  plan.fys.forEach(function(f) {
    var comp = f.comp, c = comp.counts;
    out.fys[f.fy] = { merged: c.merged, created: c.created, kids: c.kids, dropped: c.dropped };
    var bname = "สำรองก่อนนำเข้า PCT " + fiscalSheetName_(f.fy);
    if (!ss.getSheetByName(bname)) { var b = f.sheet.copyTo(ss); b.setName(bname); b.hideSheet(); }
    var rawIdx = {}, byId = {};
    f.rawRows.forEach(function(r, i) { rawIdx[(r[0] || "").toString().trim()] = i; });
    comp.rows.forEach(function(r) { byId[(r[0] || "").toString().trim()] = r; });
    comp.changed.forEach(function(id) {
      var i = rawIdx[id], w = byId[id].slice();
      if (i === undefined || !w) return;
      w[STAMP_EDIT_AT_COL - 1] = stamp; w[STAMP_EDIT_BY_COL - 1] = "นำเข้า PCT";
      f.sheet.getRange(i + 2, 1, 1, KPI_COLS).setNumberFormat("@").setValues([w]);
    });
    comp.drops.map(function(d) { return rawIdx[d.dropId] + 2; }).sort(function(a, b) { return b - a; }).forEach(function(n) { f.sheet.deleteRow(n); });
    comp.drops.forEach(function(d) {
      logRows.push([stamp, f.fy, d.dropId, "pct-merge-drop", JSON.stringify(d.row).slice(0, 49000), "รวมเข้า " + d.keepId]);
      if (d.dropId.indexOf("NURSE-") !== 0) redirect[d.dropId] = d.keepId;
    });
    if (comp.created.length) {
      var newRows = comp.created.map(function(id) { var r = byId[id].slice(); r[STAMP_EDIT_AT_COL - 1] = stamp; r[STAMP_EDIT_BY_COL - 1] = "นำเข้า PCT"; return r; });
      var start = f.sheet.getLastRow() + 1;
      if (f.sheet.getMaxRows() < start + newRows.length) f.sheet.insertRowsAfter(f.sheet.getMaxRows(), start + newRows.length - f.sheet.getMaxRows());
      f.sheet.getRange(start, 1, newRows.length, KPI_COLS).setNumberFormat("@").setValues(newRows);
      comp.created.forEach(function(id) { logRows.push([stamp, f.fy, id, "pct-new", "", byId[id][4]]); });
    }
  });

  // ต้นทาง NSO ที่ผูกกับตัวชี้วัด รพ. ที่ถูกรวม → ผูกกับตัวที่เก็บไว้แทน
  var sync = ss.getSheetByName(NSO_SYNC_SHEET);
  if (sync && Object.keys(redirect).length && sync.getLastRow() >= 2) {
    var ids = sync.getRange(2, 2, sync.getLastRow() - 1, 1).getValues(), taken = {}, moved = 0;
    ids.forEach(function(r) { taken[(r[0] || "").toString()] = 1; });
    var nid = ids.map(function(r) {
      var id = (r[0] || "").toString();
      if (redirect[id] && !taken[redirect[id]]) { taken[redirect[id]] = 1; moved++; return [redirect[id]]; }
      return [id];
    });
    if (moved) { sync.getRange(2, 2, nid.length, 1).setValues(nid); out.sync = moved; }
  }

  // หัวหน้า PCT: ต้องสังกัด PCT (แก้ได้ทุกตัวของหน่วย)
  var us = getUsersSheetForPct_();
  if (us) {
    var users = readUsers_(us), changedUsers = 0;
    users.forEach(function(u) { if (PCT_HEADS.indexOf(u.username) !== -1 && u.depts.indexOf(PCT_UNIT) === -1) { u.depts.push(PCT_UNIT); changedUsers++; } });
    if (changedUsers) {
      var uss = getUsersSpreadsheet_(), bn = "สำรองผู้ใช้ก่อนนำเข้า PCT";
      if (!uss.getSheetByName(bn)) { var ub = us.copyTo(uss); ub.setName(bn); ub.hideSheet(); }
      writeUsers_(us, users);
      out.users = changedUsers;
      users.forEach(function(u) { if (PCT_HEADS.indexOf(u.username) !== -1) logRows.push([stamp, "", u.username, "pct-user", "", u.depts.join(",")]); });
    }
  }

  if (logRows.length) {
    var log = ss.getSheetByName(TIDY_LOG_SHEET);
    if (!log) {
      log = ss.insertSheet(TIDY_LOG_SHEET);
      log.getRange(1, 1, 1, 6).setValues([["เวลา", "ปีงบ", "รหัส", "ฟิลด์", "ค่าเดิม", "ค่าใหม่"]]).setFontWeight("bold");
      log.hideSheet();
    }
    log.getRange(log.getLastRow() + 1, 1, logRows.length, 6).setNumberFormat("@").setValues(logRows);
  }
  return out;
}

function pctImportPreview(token) {
  try {
    requireAdmin_(token);
    return { success: true, preview: pctSummary_(pctPlanAll_()) };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

function pctImportCommit(token) {
  var lock = null;
  try {
    var admin = requireAdmin_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(PCT_FLAG)) return { success: false, message: "นำเข้าตัวชี้วัด PCT ไปแล้วเมื่อ " + props.getProperty(PCT_FLAG) + " (นำเข้าได้ครั้งเดียว)" };
    var plan = pctPlanAll_();
    var before = pctSummary_(plan);   // ตัวเลขก่อนเขียน (แสดงเป็นผลการนำเข้า)
    var wrote = pctApply_(plan);
    SpreadsheetApp.flush();
    // จัดระเบียบต่อ (หมวด/ชื่อ) ให้ตรงมาตรฐานเดียวกัน
    var tidied = tidyApply_(tidyPlanAll_(), { backup: true, users: false });
    props.setProperty(PCT_FLAG, nowStamp_());
    touchUser_(admin, "edit");
    return { success: true, message: "นำเข้าตัวชี้วัด PCT เรียบร้อย", wrote: wrote, tidied: tidied.fys, preview: before };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}
