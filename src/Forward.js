/**
 * ส่งต่อไปปีงบถัดไป + ย้ายข้อมูล SAR/CLT ตามเมื่อย้ายหมวด
 *
 *  - ช่อง "ใช้กับปีงบถัดไปด้วย" (item.forward) ตอนบันทึกตัวชี้วัด / เพิ่มตัวชี้วัด: ส่งเฉพาะ "ช่องที่เปลี่ยนในครั้งนั้น" ไปทุกปีงบที่ใหม่กว่า
 *    ชื่อ · เป้าหมาย · หมวด (ส่งเป็นส่วนต่าง: เพิ่ม/เอาออก) · ผู้รับผิดชอบ · หน่วยงาน · ที่มา/สูตร · ระดับ · วิธีสรุปผล · ความถี่ · ตัวชี้วัดแม่
 *    ไม่ส่ง: รายละเอียด/การวิเคราะห์ · ผลทั้งปี/รายเดือน · ประวัติ (ผลทั้งปีมีระบบส่งต่อของตัวเองอยู่แล้ว)
 *  - จับคู่ด้วยรหัส (คอลัมน์ A) · เรียก saveKpiCore_ ซ้ำด้วยผู้ใช้คนเดิม จึงตรวจสิทธิ์/ระดับ/หมวดหน่วยงานชุดเดียวกับตอนแก้ในปีนั้นเอง · ผลคืนทีละปีงบ (ok / ข้าม + เหตุผล)
 *  - ย้ายหมวด PCT เป็นกลุ่มโรคอื่น (ทุกปีที่เขียน): ข้อความ CLT ของตัวชี้วัดนั้น (`D|<โรค>|R|<รหัส>`) และการติ๊ก "ไม่เอา" (`S|kpis`) ย้ายตามไปกลุ่มใหม่
 *  ทุกอย่างเรียกภายใต้ script lock ของผู้เรียก
 */

var FWD_FIELD_LABELS = { name: "ชื่อ", target: "เป้าหมาย", owner: "ผู้รับผิดชอบ", department: "หน่วยงาน", dataSource: "ที่มา/สูตร",
  summaryMethod: "วิธีสรุปผล", frequency: "ความถี่", parentId: "ตัวชี้วัดแม่", levels: "ระดับ", cats: "หมวด" };
var FWD_TEXT_FIELDS = ["name", "target", "owner", "department", "dataSource", "summaryMethod", "frequency", "parentId"];

function fwdLaterYears_(fy) {
  return listFiscalYears_().filter(function(y) { return y > fy; }).sort(function(a, b) { return a - b; });
}

function fwdHas_(list, c) {
  return list.some(function(x) { return catKey_(x) === catKey_(c); });
}

/** ช่องที่เปลี่ยนระหว่างก่อน/หลังบันทึก → { fields: {ช่อง: ค่าใหม่}, added: [หมวด], removed: [หมวด], any } */
function fwdDiff_(before, after) {
  var d = { fields: {}, added: [], removed: [], any: false };
  FWD_TEXT_FIELDS.forEach(function(f) {
    if ((after[f] || "") !== (before[f] || "")) { d.fields[f] = after[f] || ""; d.any = true; }
  });
  if ((after.levels || []).join(", ") !== (before.levels || []).join(", ")) { d.fields.levels = (after.levels || []).slice(); d.any = true; }
  d.added = after.cats.filter(function(c) { return !fwdHas_(before.cats, c); });
  d.removed = before.cats.filter(function(c) { return !fwdHas_(after.cats, c); });
  if (d.added.length || d.removed.length) d.any = true;
  return d;
}

function fwdPctGroups_(cats) {
  return (cats || []).filter(function(c) { return c.part === PCT_UNIT; }).map(function(c) { return c.category; });
}

/** ย้ายข้อมูล CLT ของตัวชี้วัด id จากกลุ่มโรค from → to ในปีงบ fy · คืน null ถ้าไม่มีอะไรต้องย้าย */
function cltMoveKpi_(user, fy, id, from, to) {
  var sheet = sarDocSheetIfAny_();
  if (!sheet || !from || !to || from === to) return null;
  var cur = sarDocRead_(sheet, fy, SARDOC_CLT);
  var res = { fy: fy, from: from, to: to, moved: false, excluded: false, conflict: false };
  var fk = "D|" + from + "|R|" + id, tk = "D|" + to + "|R|" + id;
  var src = cur[fk], dst = cur[tk];
  if (src && src.text) {
    if (!dst || !dst.text) {
      sarDocWrite_(user, fy, SARDOC_CLT, tk, src.text);
      sarDocWrite_(user, fy, SARDOC_CLT, fk, "");
      res.moved = true;
    } else {
      res.conflict = true; // ปลายทางมีข้อความอยู่แล้ว คงของปลายทางไว้ ไม่ทับ
    }
  }
  var ex = cur["S|kpis"], arr = null;
  if (ex && ex.text) { try { arr = JSON.parse(ex.text); } catch (e) { arr = null; } }
  if (Array.isArray(arr) && arr.indexOf(from + "|" + id) !== -1) {
    var seen = {}, next = [];
    arr.forEach(function(x) { if (x === from + "|" + id) x = to + "|" + id; if (!seen[x]) { seen[x] = 1; next.push(x); } });
    sarDocWrite_(user, fy, SARDOC_CLT, "S|kpis", JSON.stringify(next.sort()));
    res.excluded = true;
  }
  return res.moved || res.excluded || res.conflict ? res : null;
}

/** หมวดของตัวชี้วัดเปลี่ยนจากกลุ่มโรค PCT 1 กลุ่มไปอีก 1 กลุ่ม (ไม่ได้อยู่ทั้งสองกลุ่ม) → ย้าย CLT ตาม */
function cltMoveOnCatChange_(user, fy, id, oldCats, newCats) {
  var og = fwdPctGroups_(oldCats), ng = fwdPctGroups_(newCats);
  var removed = og.filter(function(g) { return ng.indexOf(g) === -1; });
  var added = ng.filter(function(g) { return og.indexOf(g) === -1; });
  if (removed.length !== 1 || added.length !== 1) return null;
  return cltMoveKpi_(user, fy, id, removed[0], added[0]);
}

/** ส่งส่วนที่เปลี่ยนไปปีงบ ty (เรียกภายใต้ lock) */
function fwdApplyToYear_(user, ty, id, diff) {
  var out = { fy: ty, ok: false, fields: [], message: "" };
  var sheet = getFiscalSheet_(ty);
  if (!sheet) { out.message = "ไม่พบชีตปีงบ " + ty; return out; }
  ensureColumns_(sheet, KPI_COLS);
  var data = sheet.getDataRange().getValues(), row = null, ids = {};
  for (var i = 1; i < data.length; i++) {
    var rid = data[i][0] ? data[i][0].toString().trim() : "";
    if (rid) ids[rid] = 1;
    if (rid === id) row = data[i];
  }
  if (!row) { out.message = "ไม่พบตัวชี้วัดนี้ในปีงบ " + ty; return out; }
  var old = rowToKpi_(row), perm = getKpiPermission_(user, old, ty);
  if (!perm.view) { out.message = "ไม่มีสิทธิ์เข้าถึงตัวชี้วัดนี้ในปีงบ " + ty; return out; }

  var it = { id: id }, notes = [];
  Object.keys(diff.fields).forEach(function(f) {
    if (f === "parentId" && diff.fields[f] && !ids[diff.fields[f]]) { notes.push("ตัวชี้วัดแม่ไม่มีในปีงบ " + ty); return; }
    it[f] = diff.fields[f];
  });
  if (diff.added.length || diff.removed.length) {
    var vis = visibleCats_(user, old, perm).filter(function(c) { return !fwdHas_(diff.removed, c); });
    var at = -1;
    visibleCats_(user, old, perm).forEach(function(c, k) { if (at === -1 && fwdHas_(diff.removed, c)) at = k; });
    var next = vis.slice();
    diff.added.forEach(function(c) { if (!fwdHas_(next, c)) { if (at === -1) next.push(c); else next.splice(Math.min(at, next.length), 0, c); } });
    it.cats = next;
  }
  var sent = Object.keys(it).filter(function(k) { return k !== "id"; });
  if (sent.length === 0) { out.ok = true; out.message = notes.join(" · "); return out; }
  var res = saveKpiCore_(user, ty, it);
  if (!res.success) { out.message = res.message; return out; }
  out.ok = true;
  out.changed = !!res.changed;
  out.fields = sent.map(function(k) { return FWD_FIELD_LABELS[k] || k; });
  out.message = notes.join(" · ");
  if (res.changed) {
    var mv = cltMoveOnCatChange_(user, ty, id, res._old.cats, res._fresh.cats);
    if (mv) out.clt = mv;
  }
  return out;
}

/**
 * หลังบันทึกตัวชี้วัดในปีงบ fy สำเร็จ (และมีการเปลี่ยนแปลง): ย้าย CLT ของปีนี้ตามหมวด + ส่งต่อปีถัดไปถ้าผู้ใช้ติ๊ก
 * คืน { clt: [ผลย้าย CLT ต่อปี], forward: [ผลต่อปีงบ] }
 */
function kpiAfterSave_(user, fy, item, before, after) {
  var out = { clt: [], forward: [] }, cltTouched = {};
  var mv = cltMoveOnCatChange_(user, fy, before.id, before.cats, after.cats);
  if (mv) { out.clt.push(mv); cltTouched[fy] = 1; }
  if (item.forward) {
    var diff = fwdDiff_(before, after);
    if (diff.any) {
      fwdLaterYears_(fy).forEach(function(ty) {
        var r = fwdApplyToYear_(user, ty, before.id, diff);
        out.forward.push(r);
        if (r.clt) { out.clt.push(r.clt); cltTouched[ty] = 1; }
      });
    }
  }
  Object.keys(cltTouched).forEach(function(y) { bumpDataVersion_(Number(y), [], user, SARDOC_CLT); });
  return out;
}

/** เพิ่มตัวชี้วัดใหม่ (แถว newRow ของปีงบ fy) เข้าปีงบ ty ด้วย รหัสเดียวกัน · ผลทั้งปีเลื่อนตามตำแหน่งปี ไม่มีผลรายเดือน */
function fwdAddToYear_(user, ty, fy, newRow, newId, cats, privileged) {
  var out = { fy: ty, ok: false, message: "" };
  if (!privileged && ty !== getCurrentFiscalYear_()) { out.message = "เพิ่มตัวชี้วัดใหม่ได้เฉพาะปีงบปัจจุบัน"; return out; }
  var sheet = getFiscalSheet_(ty);
  if (!sheet) { out.message = "ไม่พบชีตปีงบ " + ty; return out; }
  ensureColumns_(sheet, KPI_COLS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (data[i][0] && data[i][0].toString().trim() === newId) { out.message = "มีรหัสนี้อยู่แล้ว"; return out; }
  var row = newRow.slice();
  for (var k = 0; k < 5; k++) {
    var si = k + (ty - fy); // ตำแหน่งปีเดียวกันในชีตต้นทาง
    row[ANNUAL_FIRST_COL - 1 + k] = si >= 0 && si < 5 ? newRow[ANNUAL_FIRST_COL - 1 + si] : "";
  }
  for (var m = 0; m < MONTHLY_COLS; m++) row[ANNUAL_FIRST_COL - 1 + 5 + m] = "";
  var part = row[2].toString().trim(), cat = row[3].toString().trim();
  row[1] = data.filter(function(r) { return r[2] && r[2].toString().trim() === part && r[3] && r[3].toString().trim() === cat; }).length + 1;
  sheet.appendRow(row);
  if (cats.length > 1 && !sheet.getRange(1, EXTRA_CATS_COL).getValue()) {
    sheet.getRange(1, EXTRA_CATS_COL).setValue(EXTRA_CATS_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
  }
  bumpDataVersion_(ty, [newId], user);
  out.ok = true;
  return out;
}

/**
 * ตรวจผลกระทบต่อเอกสาร สรพ. ก่อนบันทึก (ให้หน้าเว็บเตือน) — ตัวชี้วัด id ในปีงบ fy จะมีหมวดตาม cats
 *  - pdca: ปีงบที่มีสรุป PDCA ของตัวชี้วัดนี้ และการบันทึกนี้จะเอาออกจาก Part I–IV ทั้งหมด (ข้อความยังเก็บไว้ แต่ไม่ขึ้นในเอกสาร SAR)
 *  - clt: ปีงบ/กลุ่มโรคที่มีข้อความ CLT หรือการติ๊กไม่เอาของตัวชี้วัดนี้ และจะย้ายตามไปกลุ่มใหม่
 */
function kpiDocImpact(token, fy, id, newCats, forward) {
  try {
    var user = requireUser_(token);
    fy = resolveFiscalYear_(fy);
    var sheet = getFiscalSheet_(fy);
    if (!sheet) return { success: true, impact: { pdca: [], clt: [] } };
    var data = sheet.getDataRange().getValues(), row = null;
    id = (id || "").toString().trim();
    for (var i = 1; i < data.length; i++) if (data[i][0] && data[i][0].toString().trim() === id) { row = data[i]; break; }
    if (!row) return { success: true, impact: { pdca: [], clt: [] } };
    var old = rowToKpi_(row), perm = getKpiPermission_(user, old, fy);
    if (!perm.view) return { success: false, message: "ไม่มีสิทธิ์เข้าถึงตัวชี้วัดนี้" };
    var wanted = cleanCatList_(newCats || []);
    if (wanted.length === 0) return { success: true, impact: { pdca: [], clt: [] } };
    var visible = visibleCats_(user, old, perm);
    var removed = visible.filter(function(c) { return !fwdHas_(wanted, c); });
    var added = wanted.filter(function(c) { return !fwdHas_(old.cats, c); });
    var after = old.cats.filter(function(c) { return !fwdHas_(removed, c); }).concat(added);
    var impact = { pdca: [], clt: [] };
    var years = [fy].concat(forward ? fwdLaterYears_(fy) : []);
    var sd = sarDocSheetIfAny_();
    if (sd) {
      var leavesCore = old.cats.some(function(c) { return isCorePart_(c.part); }) && !after.some(function(c) { return isCorePart_(c.part); });
      var og = fwdPctGroups_(old.cats), ng = fwdPctGroups_(after);
      var rem = og.filter(function(g) { return ng.indexOf(g) === -1; }), add = ng.filter(function(g) { return og.indexOf(g) === -1; });
      years.forEach(function(y) {
        if (leavesCore) {
          var p = sarDocRead_(sd, y, SARDOC_SAR)[SARDOC_PDCA_PREFIX + id];
          if (p && p.text) impact.pdca.push(y);
        }
        if (rem.length === 1 && add.length === 1) {
          var cur = sarDocRead_(sd, y, SARDOC_CLT), hit = cur["D|" + rem[0] + "|R|" + id], ex = cur["S|kpis"], exHit = false;
          if (ex && ex.text) { try { exHit = JSON.parse(ex.text).indexOf(rem[0] + "|" + id) !== -1; } catch (e) { exHit = false; } }
          if ((hit && hit.text) || exHit) impact.clt.push({ fy: y, from: rem[0], to: add[0], text: !!(hit && hit.text), excluded: exHit });
        }
      });
    }
    return { success: true, impact: impact };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
