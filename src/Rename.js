/**
 * เครื่องมือ admin "เปลี่ยนชื่อ หมวด / หน่วยงาน" + ตาราง "ชื่อเดิม → ชื่อใหม่" (กันชื่อเก่ากลับมา)
 *  - ตารางชื่ออยู่ใน Script Properties (RENAME_MAP_V1) รูปแบบ { units: { เดิม: ใหม่ }, cats: { <หมวดหลัก>: { เดิม: ใหม่ } } } เก็บแบบ "แบน" (เดิม → ชื่อปัจจุบันเสมอ ไม่ต่อโซ่)
 *    + ชื่อที่เปลี่ยนไปแล้วก่อนมีเครื่องมือนี้ (RENAME_SEED)
 *  - ที่ใช้ตาราง: parseDepts_ / viewDeptOfPart_ (หน่วยงาน — สิทธิ์ตามหน่วยทำงานได้ถึงปีงบที่ยังเก็บชื่อเดิม) · การจัดหมวดอัตโนมัติ (🧹 จัดระเบียบ, นำเข้า NSO, หมวด PCT)
 *  - ข้อมูลที่เก็บในชีต (คอลัมน์ C D AA AK, บัญชีผู้ใช้, CLT ใน SAR_Doc) เขียนตอนกดยืนยันเท่านั้น: หน่วยงาน = ทุกปีงบ · หมวด = เฉพาะปีงบที่เลือก
 *  - ทุกการเขียนอยู่ใต้ script lock · สำรองชีตปีงบก่อนเขียน · จดลง Tidy_Log · แจ้งเครื่องอื่นด้วย bumpDataVersion_
 */

var RENAME_PROP = "RENAME_MAP_V1";
var RENAME_BACKUP_PREFIX = "สำรองก่อนเปลี่ยนชื่อ ";
var RENAME_BACKUP_KEEP = 6;
// ชื่อหมวด PCT ที่เปลี่ยนไปแล้วก่อนมีเครื่องมือนี้ (ทั้งปีงบ 2569–2570) — ให้ทุกส่วนของระบบใช้ชื่อใหม่ ไม่ย้อนกลับ
var RENAME_SEED = {
  units: {},
  cats: {
    PCT: {
      "วินิจฉัยคลาดเคลื่อน (9 มาตรฐาน)": "9 มาตรฐาน : วินิจฉัยคลาดเคลื่อน",
      "การคัดแยกผู้ป่วย (9 มาตรฐาน)": "9 มาตรฐาน : การคัดแยกผู้ป่วย",
      "ระบุตัวผู้ป่วยผิดพลาด": "9 มาตรฐาน : ระบุตัวผู้ป่วยผิดพลาด",
      "ให้เลือดผิดคนผิดหมู่": "9 มาตรฐาน : ให้เลือดผิดคนผิดหมู่",
      "Med error": "9 มาตรฐาน : Med error"
    }
  }
};
// หน่วยที่โค้ดมีกติกาเฉพาะผูกกับชื่อ — เปลี่ยนชื่อไม่ได้
var RENAME_LOCKED_UNITS = { NSO: 1, PCT: 1, VIP: 1, IC: 1 };
var RENAME_MAX_UNIT = 30;
var RENAME_MAX_CAT = 80;

var RENAME_CACHE_ = null;

function renameHas_(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
/** ชื่อที่ "เลิกใช้แล้ว" = เคยเปลี่ยนไปเป็นชื่ออื่น (รายการที่ชี้ตัวเองคือบันทึกว่าเปลี่ยนกลับแล้ว ไม่นับ) */
function renameRetired_(m, name) { return renameHas_(m, name) && m[name] !== name; }

/** ตารางชื่อปัจจุบัน (อ่านจาก Script Properties ครั้งเดียวต่อการรัน) → { units: {}, cats: { part: {} } } */
function renameMap_() {
  if (RENAME_CACHE_) return RENAME_CACHE_;
  var stored = null;
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(RENAME_PROP);
    if (raw) stored = JSON.parse(raw);
  } catch (e) { stored = null; }
  var map = { units: {}, cats: {} };
  var add = function(src) {
    if (!src) return;
    Object.keys(src.units || {}).forEach(function(k) { map.units[k] = src.units[k]; });
    Object.keys(src.cats || {}).forEach(function(p) {
      map.cats[p] = map.cats[p] || {};
      Object.keys(src.cats[p]).forEach(function(k) { map.cats[p][k] = src.cats[p][k]; });
    });
  };
  add(RENAME_SEED);
  add(stored); // ที่ผู้ใช้เปลี่ยนเอง ทับค่าตั้งต้น
  RENAME_CACHE_ = map;
  return map;
}
function renameReset_() { RENAME_CACHE_ = null; }

function renameSave_(map) {
  PropertiesService.getScriptProperties().setProperty(RENAME_PROP, JSON.stringify(map));
  renameReset_();
}

/** ชื่อหน่วยปัจจุบันของชื่อที่อ่านได้ (ชื่อเดิม → ชื่อใหม่) */
function renameUnit_(name) {
  var m = renameMap_().units, g = 0;
  while (name !== undefined && name !== null && renameHas_(m, name) && g++ < 8) name = m[name];
  return name;
}

/** หมวดย่อยปัจจุบัน ของหมวดหลัก part (ชื่อปัจจุบัน) */
function renameCat_(part, category) {
  var m = renameMap_().cats[part], g = 0;
  if (!m) return category;
  while (renameHas_(m, category) && g++ < 8) category = m[category];
  return category;
}

/** ชื่อหมวดหลักที่เก็บในชีต (อาจเป็นชื่อหน่วยเดิม / "<หน่วยเดิม> QA") → ชื่อปัจจุบัน */
function renamePart_(part) {
  part = (part || "").toString();
  if (viewIsQaPart_(part)) {
    var u = viewUnitOfQaPart_(part);
    return u === VIEW_NSO_OVERALL ? part : renameUnit_(u) + VIEW_QA_SUFFIX;
  }
  return isCorePart_(part) ? part : renameUnit_(part);
}

/** ชื่อเดิมทั้งหมดที่ตอนนี้หมายถึงหน่วย unit (รวมชื่อปัจจุบันเอง) */
function renameUnitSources_(unit) {
  var m = renameMap_().units, out = [unit];
  Object.keys(m).forEach(function(k) { if (renameUnit_(k) === unit && out.indexOf(k) === -1) out.push(k); });
  return out;
}

/** หัวข้อของหน่วย (จากไฟล์ NSO) ใช้ชื่อหน่วย/หมวดปัจจุบัน */
function renameHeadings_(headings) {
  var out = {};
  Object.keys(headings || {}).forEach(function(unit) {
    var nu = renameUnit_(unit);
    out[nu] = out[nu] || [];
    (headings[unit] || []).forEach(function(c) {
      var nc = renameCat_(nu, c);
      if (out[nu].indexOf(nc) === -1) out[nu].push(nc);
    });
  });
  return out;
}

/** ลำดับกลุ่มโรค PCT สำหรับหน้าเว็บ (รายการตามไฟล์ แต่ใช้ชื่อปัจจุบัน) */
function renamePctGroups_() {
  var out = [];
  VIEW_PCT_GROUPS.forEach(function(g) { var n = renameCat_(PCT_UNIT, g); if (out.indexOf(n) === -1) out.push(n); });
  return out;
}

/** ตารางชื่อหน่วยสำหรับหน้าเว็บ (ใช้แปลงชื่อหน่วยในช่องหน่วยงานของปีงบที่ยังเก็บชื่อเดิม) */
function renameUnitMapForClient_() {
  var m = renameMap_().units, out = {};
  Object.keys(m).forEach(function(k) { out[k] = renameUnit_(k); });
  return out;
}

// ---------------------------------------------------------------- ตรวจชื่อ

function renameCleanCat_(s) {
  return arabicDigits_((s === null || s === undefined ? "" : s).toString()).replace(/[\s​]+/g, " ").trim();
}

/** ชื่อหน่วยใหม่: ห้ามมีช่องว่าง / , | (ช่องหน่วยงานของตัวชี้วัดคั่นด้วยอักขระเหล่านี้) */
function renameCleanUnit_(s) {
  return arabicDigits_((s === null || s === undefined ? "" : s).toString()).replace(/[​]/g, "").trim();
}

function renameCatError_(part, from, to) {
  if (!to) return "กรุณาใส่ชื่อใหม่";
  if (to.length > RENAME_MAX_CAT) return "ชื่อยาวเกินไป (ไม่เกิน " + RENAME_MAX_CAT + " ตัวอักษร)";
  if (/[|\r\n]/.test(to)) return "ชื่อห้ามมีเครื่องหมาย | หรือขึ้นบรรทัดใหม่";
  if (to === from) return "ชื่อใหม่เหมือนชื่อเดิม";
  if (to === UNIT_CATS_PLACEHOLDER) return "ใช้ชื่อ \"" + UNIT_CATS_PLACEHOLDER + "\" ไม่ได้ (เป็นชื่อชั่วคราวของระบบ)";
  if (viewIsQaPart_(part) && /^มิติที่\s*[1-5]/.test(from)) return "มิติที่ 1–5 ของหมวด QA เป็นชื่อมาตรฐานของระบบ เปลี่ยนชื่อไม่ได้";
  return "";
}

function renameUnitError_(from, to) {
  if (!to) return "กรุณาใส่ชื่อใหม่";
  if (to.length > RENAME_MAX_UNIT) return "ชื่อยาวเกินไป (ไม่เกิน " + RENAME_MAX_UNIT + " ตัวอักษร)";
  if (/[\s\/,|]/.test(to)) return "ชื่อหน่วยห้ามมีช่องว่าง , / หรือ | (ช่องหน่วยงานของตัวชี้วัดคั่นหน่วยด้วยอักขระเหล่านี้)";
  if (to === from) return "ชื่อใหม่เหมือนชื่อเดิม";
  if (RENAME_LOCKED_UNITS[from]) return "หน่วย " + from + " มีโค้ดเฉพาะผูกกับชื่อนี้ เปลี่ยนชื่อไม่ได้";
  if (renameHas_(DEPT_ALIASES, to)) return "ชื่อ " + to + " เป็นชื่อเรียกอื่นของหน่วย " + DEPT_ALIASES[to] + " อยู่แล้ว — ใช้ชื่ออื่น";
  if (RENAME_LOCKED_UNITS[to]) return "ใช้ชื่อ " + to + " ไม่ได้ (มีโค้ดเฉพาะผูกกับชื่อนี้) — ถ้าต้องการรวมเข้าหน่วยนี้ ให้ใช้เมนูรวมชื่อของผู้ดูแลระบบ";
  if (to === VIEW_NSO_OVERALL || /^part/i.test(to) || to === "ทั่วไป") return "ใช้ชื่อนี้ไม่ได้ (เป็นชื่อที่ระบบใช้กับหมวดอื่น)";
  return "";
}

// ---------------------------------------------------------------- อ่านข้อมูล (ฟังก์ชันล้วน ไม่เขียนอะไร)

function renameRowCats_(row) {
  return kpiCats_({ cats: [{ part: (row[2] || "ทั่วไป").toString().trim(), category: (row[3] || "ทั่วไป").toString().trim() }].concat(parseExtraCats_(row[EXTRA_CATS_COL - 1])) });
}

function renameDedupeCats_(cats) {
  var seen = {}, out = [];
  cats.forEach(function(c) { var k = catKey_(c); if (!seen[k]) { seen[k] = 1; out.push(c); } });
  return out;
}

/** ปีงบ → แถวข้อมูล (ไม่รวมหัวตาราง) */
function renameReadYears_() {
  var out = [];
  listFiscalYears_().forEach(function(fy) {
    var d = tidyReadFy_(fy);
    if (d) out.push({ fy: fy, sheet: d.sheet, rows: d.rows });
  });
  return out;
}

/** รายการหน่วย + หมวด พร้อมจำนวนต่อปีงบ (หน้าจอเครื่องมือ) */
function renameInventory_(years, users) {
  var units = {}, cats = {}, fys = years.map(function(y) { return y.fy; });
  var unit = function(name) {
    if (!units[name]) { units[name] = { name: name, users: 0, years: {}, parts: 0 }; fys.forEach(function(fy) { units[name].years[fy] = 0; }); }
    return units[name];
  };
  users.forEach(function(u) { u.depts.forEach(function(d) { unit(d).users++; }); });
  years.forEach(function(y) {
    y.rows.forEach(function(row) {
      if (!(row[0] || "").toString().trim()) return;
      parseDepts_(row[26]).forEach(function(d) { unit(d).years[y.fy]++; });
      renameRowCats_(row).forEach(function(c) {
        var part = renamePart_(c.part), cat = renameCat_(part, c.category);
        if (!isCorePart_(part) && !viewIsQaPart_(part) && part !== NSO_UNIT) unit(part).parts++;
        if (!isCorePart_(part) && viewIsQaPart_(part)) { var qu = viewUnitOfQaPart_(part); if (qu !== VIEW_NSO_OVERALL) unit(qu).parts++; }
        cats[part] = cats[part] || {};
        if (!cats[part][cat]) { cats[part][cat] = { name: cat, years: {} }; fys.forEach(function(fy) { cats[part][cat].years[fy] = 0; }); }
        cats[part][cat].years[y.fy]++;
      });
    });
  });
  var unitList = Object.keys(units).map(function(n) {
    var u = units[n];
    u.locked = !!RENAME_LOCKED_UNITS[n];
    return u;
  }).sort(function(a, b) { return String(a.name).localeCompare(String(b.name), "th"); });
  var parts = Object.keys(cats).sort(function(a, b) { return comparePartsForRename_(a, b); }).map(function(p) {
    var list = Object.keys(cats[p]).map(function(k) {
      var c = cats[p][k];
      c.locked = viewIsQaPart_(p) && /^มิติที่\s*[1-5]/.test(c.name);
      return c;
    }).sort(function(a, b) { return String(a.name).localeCompare(String(b.name), "th", { numeric: true }); });
    return { part: p, core: isCorePart_(p), cats: list };
  });
  return { years: fys, units: unitList, parts: parts };
}

function comparePartsForRename_(a, b) {
  var ca = isCorePart_(a) ? 0 : 1, cb = isCorePart_(b) ? 0 : 1;
  return ca - cb || String(a).localeCompare(String(b), "th", { numeric: true });
}

/** ผลใหม่ของแถวหนึ่งเมื่อเปลี่ยนชื่อ — คืน null ถ้าไม่เกี่ยวกับแถวนี้ · { cats, dept } เฉพาะที่เปลี่ยน */
function renameRowPlan_(row, req) {
  var cats = renameRowCats_(row), deptText = (row[26] === null || row[26] === undefined ? "" : row[26]).toString();
  var newCats = cats, newDept = deptText, changed = false;
  if (req.kind === "unit") {
    var from = req.from, to = req.to;
    newCats = renameDedupeCats_(cats.map(function(c) {
      var p = renamePart_(c.part);
      if (p === from) return { part: to, category: c.category };
      if (viewIsQaPart_(p) && viewUnitOfQaPart_(p) === from) return { part: to + VIEW_QA_SUFFIX, category: c.category };
      return c;
    }));
    var depts = parseDepts_(deptText);
    if (depts.indexOf(from) !== -1) {
      var seen = {}, out = [];
      depts.forEach(function(d) { d = d === from ? to : d; if (!seen[d]) { seen[d] = 1; out.push(d); } });
      newDept = out.join(" / ");
    }
  } else {
    newCats = renameDedupeCats_(cats.map(function(c) {
      var p = renamePart_(c.part);
      if (p === req.part && renameCat_(p, c.category) === req.from) return { part: p, category: req.to };
      return c;
    }));
  }
  if (newCats.map(catKey_).join("\n") !== cats.map(catKey_).join("\n")) changed = true;
  if (newDept !== deptText) changed = true;
  return changed ? { cats: cats, newCats: newCats, dept: deptText, newDept: newDept } : null;
}

// ---------------------------------------------------------------- CLT (เฉพาะเปลี่ยนชื่อหมวดย่อยของ PCT = กลุ่มโรค)

/** แผนย้ายข้อมูล CLT ของปีงบ fy จากกลุ่มโรค from → to · คืน { ticks, excluded, keys, conflicts, writes } (writes = รายการที่จะเขียน)
 *  from รวมชื่อเก่าทุกชื่อที่ตารางชื่อชี้มาที่ from (ปีที่ไม่ได้ติ๊กตอนเปลี่ยนชื่อครั้งก่อน CLT ยังใช้ชื่อเก่า) */
function renameCltPlan_(sheet, fy, from, to) {
  var plan = { ticks: false, excluded: 0, keys: 0, conflicts: [], writes: [] };
  if (!sheet) return plan;
  var froms = [from], cm = renameMap_().cats[PCT_UNIT] || {};
  Object.keys(cm).forEach(function(k) { if (k !== from && cm[k] === from && froms.indexOf(k) === -1) froms.push(k); });
  var data = sheet.getDataRange().getValues(), byKey = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(fy) || String(data[i][1]) !== SARDOC_CLT || !data[i][2]) continue;
    byKey[data[i][2].toString()] = { row: i + 1, text: (data[i][3] === null || data[i][3] === undefined ? "" : data[i][3]).toString(), rev: Number(data[i][4]) || 0 };
  }
  var moved = {};
  Object.keys(byKey).forEach(function(key) {
    var it = byKey[key];
    if (key === "S|groups") {
      var arr = null;
      try { arr = JSON.parse(it.text); } catch (e) { arr = null; }
      if (arr && arr.some(function(g) { return froms.indexOf(g) !== -1; })) {
        var next = [];
        arr.forEach(function(g) { g = froms.indexOf(g) !== -1 ? to : g; if (next.indexOf(g) === -1) next.push(g); });
        plan.ticks = true;
        plan.writes.push({ kind: "text", row: it.row, rev: it.rev, text: JSON.stringify(next), key: key });
      }
    } else if (key === "S|kpis") {
      var ex = null;
      try { ex = JSON.parse(it.text); } catch (e2) { ex = null; }
      var hit = function(x) { return froms.some(function(f) { return x.indexOf(f + "|") === 0; }); };
      if (ex && ex.some(hit)) {
        var seen = {}, out = [];
        ex.forEach(function(x) {
          if (hit(x)) { var f = froms.filter(function(f) { return x.indexOf(f + "|") === 0; })[0]; x = to + "|" + x.slice(f.length + 1); plan.excluded++; }
          if (!seen[x]) { seen[x] = 1; out.push(x); }
        });
        plan.writes.push({ kind: "text", row: it.row, rev: it.rev, text: JSON.stringify(out), key: key });
      }
    } else {
      var f2 = froms.filter(function(f) { return key.indexOf("D|" + f + "|") === 0; })[0];
      if (f2 === undefined) return;
      var newKey = "D|" + to + "|" + key.slice(("D|" + f2 + "|").length), dest = byKey[newKey];
      if (!dest && !moved[newKey]) {
        moved[newKey] = 1;
        plan.keys++;
        plan.writes.push({ kind: "key", row: it.row, rev: it.rev, newKey: newKey, key: key });
      } else if (dest && !dest.text.trim() && it.text.trim()) {
        plan.keys++;
        plan.writes.push({ kind: "move", row: it.row, rev: it.rev, destRow: dest.row, destRev: dest.rev, text: it.text, key: key, newKey: newKey });
      } else if (it.text.trim() && ((dest && dest.text.trim()) || moved[newKey])) {
        plan.conflicts.push(newKey);
      }
    }
  });
  return plan;
}

// ---------------------------------------------------------------- วางแผน / ตัวอย่าง

/** req = { kind: "cat"|"unit", part, from, to, years } → { errors, warnings, merge, years: [...], users: [...], clt } (ยังไม่เขียนอะไร) */
function renamePlan_(rawReq) {
  var kind = rawReq && rawReq.kind === "unit" ? "unit" : "cat";
  var req = { kind: kind, part: (rawReq.part || "").toString().trim(), from: (rawReq.from || "").toString().trim(),
    to: kind === "unit" ? renameCleanUnit_(rawReq.to) : renameCleanCat_(rawReq.to), years: (rawReq.years || []).map(Number) };
  var years = renameReadYears_();
  var usersSheet = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
  var users = usersSheet ? readUsers_(usersSheet) : [];
  var inv = renameInventory_(years, users);
  var plan = { req: req, errors: [], warnings: [], merge: false, years: [], users: [], clt: null, inventory: inv };
  var allFys = years.map(function(y) { return y.fy; });
  if (!req.from) { plan.errors.push("กรุณาเลือก" + (kind === "unit" ? "หน่วยงาน" : "หมวด") + "ที่จะเปลี่ยนชื่อ"); return plan; }

  if (kind === "unit") {
    var ue = renameUnitError_(req.from, req.to);
    if (ue) plan.errors.push(ue);
    var exist = inv.units.filter(function(u) { return u.name === req.from; })[0];
    if (!exist) plan.errors.push("ไม่พบหน่วยงาน " + req.from);
    // ชื่อใหม่เป็น "ชื่อเดิมของหน่วยอื่น" ที่เคยเปลี่ยนไปแล้ว → ใช้ไม่ได้ (ยกเว้นเปลี่ยนกลับเป็นชื่อเดิมของตัวเอง)
    var um = renameMap_().units;
    if (!ue && renameRetired_(um, req.to) && renameUnit_(req.to) !== req.from) plan.errors.push("ชื่อ " + req.to + " เคยถูกเปลี่ยนเป็น " + renameUnit_(req.to) + " แล้ว — ใช้เป็นชื่อใหม่ไม่ได้ (ใช้ชื่ออื่น หรือรวมเข้า " + renameUnit_(req.to) + ")");
    var target = inv.units.filter(function(u) { return u.name === req.to; })[0];
    if (target && !ue) { plan.merge = true; plan.warnings.push("มีหน่วย " + req.to + " อยู่แล้ว — จะรวม " + req.from + " เข้ากับ " + req.to + " (ผู้ใช้และตัวชี้วัดของทั้งสองหน่วยอยู่หน่วยเดียวกัน)"); }
    req.years = allFys; // หน่วยงานเปลี่ยนทุกปีงบเสมอ
    users.forEach(function(u) { if (u.depts.indexOf(req.from) !== -1) plan.users.push({ username: u.username, tier: u.tier, row: u.row, depts: u.depts }); });
  } else {
    if (!req.part) plan.errors.push("กรุณาเลือกหมวดหลัก");
    var ce = req.part ? renameCatError_(req.part, req.from, req.to) : "";
    if (ce) plan.errors.push(ce);
    var pi = inv.parts.filter(function(p) { return p.part === req.part; })[0];
    var ci = pi ? pi.cats.filter(function(c) { return c.name === req.from; })[0] : null;
    if (!ci) plan.errors.push("ไม่พบหมวด " + req.part + " › " + req.from);
    var cm = renameMap_().cats[req.part] || {};
    if (!ce && renameRetired_(cm, req.to) && renameCat_(req.part, req.to) !== req.from) plan.errors.push("ชื่อ " + req.to + " เคยถูกเปลี่ยนเป็น " + renameCat_(req.part, req.to) + " แล้ว — ใช้เป็นชื่อใหม่ไม่ได้");
    var ti = pi ? pi.cats.filter(function(c) { return c.name === req.to; })[0] : null;
    if (ti && !ce) { plan.merge = true; plan.warnings.push("มีหมวด " + req.part + " › " + req.to + " อยู่แล้ว — จะรวมตัวชี้วัดของสองหมวดเป็นหมวดเดียว"); }
    if (isCorePart_(req.part)) plan.warnings.push("หมวดของ Part I–IV เป็นชื่อมาตรฐาน HA และเป็นหัวข้อในเอกสาร SAR — ตรวจให้แน่ใจก่อนเปลี่ยน");
    req.years = req.years.filter(function(fy) { return allFys.indexOf(fy) !== -1; });
    if (req.years.length === 0) plan.errors.push("กรุณาเลือกปีงบอย่างน้อย 1 ปี");
  }
  if (plan.errors.length) return plan;

  years.forEach(function(y) {
    if (req.years.indexOf(y.fy) === -1) return;
    var rows = [];
    y.rows.forEach(function(row, index) {
      if (!(row[0] || "").toString().trim()) return;
      var p = renameRowPlan_(row, req);
      if (p) rows.push({ index: index, id: (row[0] || "").toString().trim(), name: (row[4] || "").toString().split("\n")[0], plan: p });
    });
    plan.years.push({ fy: y.fy, sheet: y.sheet, rawRows: y.rows, rows: rows });
  });
  if (kind === "cat" && req.part === PCT_UNIT) {
    var sd = sarDocSheetIfAny_();
    plan.clt = { years: [], conflicts: [] };
    req.years.forEach(function(fy) {
      var c = renameCltPlan_(sd, fy, req.from, req.to);
      plan.clt.years.push({ fy: fy, ticks: c.ticks, excluded: c.excluded, keys: c.keys, writes: c.writes });
      c.conflicts.forEach(function(k) { plan.clt.conflicts.push(fy + " · " + k); });
    });
    if (plan.clt.conflicts.length) plan.warnings.push("ข้อความ CLT ของ " + req.to + " มีอยู่แล้วในปีงบเดียวกัน " + plan.clt.conflicts.length + " หัวข้อ — คงข้อความของ " + req.to + " ไว้ ไม่ทับ (ตรวจข้อความของ " + req.from + " ที่ยังค้างในชีต SAR_Doc)");
  }
  if (plan.years.every(function(y) { return y.rows.length === 0; }) && plan.users.length === 0 && !(plan.clt && plan.clt.years.some(function(c) { return c.writes.length; }))) plan.warnings.push("ไม่มีข้อมูลในปีงบที่เลือกที่ต้องแก้ — ระบบจะบันทึกชื่อใหม่ไว้ใช้กับการจัดหมวดอัตโนมัติเท่านั้น");
  return plan;
}

/** สรุปแผนสำหรับหน้าเว็บ (ตัดรายการยาว) */
function renameSummary_(plan) {
  var s = { kind: plan.req.kind, part: plan.req.part, from: plan.req.from, to: plan.req.to, merge: plan.merge, errors: plan.errors, warnings: plan.warnings, years: [], users: [], clt: null, canCommit: plan.errors.length === 0 };
  plan.years.forEach(function(y) { s.years.push({ fy: y.fy, count: y.rows.length, samples: y.rows.slice(0, 12).map(function(r) { return { id: r.id, name: r.name }; }) }); });
  s.users = plan.users.slice(0, 60).map(function(u) { return { username: u.username, tier: u.tier }; });
  s.usersCount = plan.users.length;
  if (plan.clt) s.clt = { years: plan.clt.years.map(function(c) { return { fy: c.fy, ticks: c.ticks, excluded: c.excluded, keys: c.keys }; }), conflicts: plan.clt.conflicts.slice(0, 20) };
  return s;
}

// ---------------------------------------------------------------- เขียนจริง

/** ปรับตารางชื่อให้เป็นแบบแบน (เดิม → ชื่อปัจจุบัน) หลังเปลี่ยน from → to */
function renameMapAdd_(stored, req) {
  var apply = function(m, from, to) {
    Object.keys(m).forEach(function(k) { if (m[k] === from) m[k] = to; });
    m[from] = to;
  };
  stored.units = stored.units || {};
  stored.cats = stored.cats || {};
  if (req.kind === "unit") {
    apply(stored.units, req.from, req.to);
  } else {
    stored.cats[req.part] = stored.cats[req.part] || {};
    apply(stored.cats[req.part], req.from, req.to);
  }
  return stored;
}

/** ลบสำรองเก่าเกินจำนวนที่เก็บ (เรียงตามเวลาท้ายชื่อ yyyyMMdd_HHmmss) */
function renameBackupSheets_(ss, prefix, keep) {
  var names = ss.getSheets().map(function(s) { return s.getName(); }).filter(function(n) { return n.indexOf(prefix) === 0; })
    .sort(function(a, b) { return a.slice(-15) < b.slice(-15) ? -1 : a.slice(-15) > b.slice(-15) ? 1 : 0; });
  while (names.length > keep) { var sh = ss.getSheetByName(names.shift()); if (sh) ss.deleteSheet(sh); }
}

function renameApply_(plan, admin) {
  var req = plan.req, ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL), stamp = nowStamp_();
  var fileStamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
  var logRows = [], out = { years: {}, users: 0, clt: { keys: 0, ticks: 0, excluded: 0 } };
  var label = req.kind === "unit" ? "หน่วย " + req.from + " → " + req.to : req.part + " › " + req.from + " → " + req.to;

  plan.years.forEach(function(y) {
    out.years[y.fy] = y.rows.length;
    if (y.rows.length === 0) return;
    var b = y.sheet.copyTo(ss);
    b.setName(RENAME_BACKUP_PREFIX + fiscalSheetName_(y.fy) + " " + fileStamp);
    b.hideSheet();
    var byIndex = {};
    y.rows.forEach(function(r) { byIndex[r.index] = r; });
    var colCD = [], colDept = [], colExtra = [];
    y.rawRows.forEach(function(row, i) {
      var r = byIndex[i];
      if (!r) { colCD.push([row[2], row[3]]); colDept.push([row[26]]); colExtra.push([row[EXTRA_CATS_COL - 1]]); return; }
      var nc = r.plan.newCats;
      colCD.push([nc[0].part, nc[0].category]);
      colDept.push([tidyLiteral_(r.plan.newDept)]);
      colExtra.push([formatExtraCats_(nc.slice(1))]);
      if (r.plan.newCats.map(catKey_).join("\n") !== r.plan.cats.map(catKey_).join("\n")) logRows.push([stamp, y.fy, r.id, "cats", tidyCatsText_(r.plan.cats), tidyCatsText_(nc)]);
      if (r.plan.newDept !== r.plan.dept) logRows.push([stamp, y.fy, r.id, "dept", r.plan.dept, r.plan.newDept]);
    });
    var n = y.rawRows.length;
    y.sheet.getRange(2, 3, n, 2).setValues(colCD);
    y.sheet.getRange(2, 27, n, 1).setValues(colDept);
    y.sheet.getRange(2, EXTRA_CATS_COL, n, 1).setNumberFormat("@").setValues(colExtra);
  });
  renameBackupSheets_(ss, RENAME_BACKUP_PREFIX, RENAME_BACKUP_KEEP * Math.max(1, plan.years.length));

  // บัญชีผู้ใช้ (เฉพาะเปลี่ยนชื่อหน่วย): แก้เฉพาะคอลัมน์หน่วยงานของคนที่สังกัดหน่วยนั้น
  if (req.kind === "unit" && plan.users.length > 0) {
    var us = ss.getSheetByName(USERS_SHEET_NAME);
    if (us) {
      var ub = us.copyTo(ss);
      ub.setName("สำรองผู้ใช้ก่อนเปลี่ยนชื่อหน่วย " + fileStamp);
      ub.hideSheet();
      renameBackupSheets_(ss, "สำรองผู้ใช้ก่อนเปลี่ยนชื่อหน่วย ", 3);
      plan.users.forEach(function(u) {
        var seen = {}, next = [];
        u.depts.forEach(function(d) { d = d === req.from ? req.to : d; if (!seen[d]) { seen[d] = 1; next.push(d); } });
        us.getRange(u.row, 4, 1, 1).setValue(next.join(","));
        logRows.push([stamp, "", u.username, "user-dept", u.depts.join(","), next.join(",")]);
        out.users++;
      });
    }
  }

  // CLT (เปลี่ยนชื่อกลุ่มโรคของ PCT)
  if (plan.clt) {
    var sd = sarDocSheetIfAny_();
    plan.clt.years.forEach(function(c) {
      if (!sd) return;
      c.writes.forEach(function(w) {
        if (w.kind === "text") { sd.getRange(w.row, 4, 1, 4).setValues([[w.text, w.rev + 1, stamp, admin.username]]); }
        else if (w.kind === "key") { sd.getRange(w.row, 3, 1, 1).setNumberFormat("@").setValue(w.newKey); sd.getRange(w.row, 5, 1, 3).setValues([[w.rev + 1, stamp, admin.username]]); }
        else if (w.kind === "move") {
          sd.getRange(w.destRow, 4, 1, 4).setValues([[w.text, w.destRev + 1, stamp, admin.username]]);
          sd.getRange(w.row, 4, 1, 4).setValues([["", w.rev + 1, stamp, admin.username]]);
        }
        logRows.push([stamp, c.fy, w.key, "clt", w.key, w.newKey || "(รายการติ๊ก)"]);
      });
      out.clt.keys += c.keys; out.clt.excluded += c.excluded; if (c.ticks) out.clt.ticks++;
    });
  }

  // ตารางชื่อ: เก็บเฉพาะที่ผู้ใช้เปลี่ยนเอง + ค่าตั้งต้นที่ต่อโซ่
  // เก็บตารางทั้งชุดที่ใช้อยู่ (ค่าตั้งต้น + ที่เปลี่ยนเอง) หลังปรับให้ต่อโซ่ถูกต้อง · รายการที่ชี้ตัวเอง = เปลี่ยนกลับแล้ว (กันค่าตั้งต้นกลับมา)
  var merged = { units: {}, cats: {} };
  var cur = renameMap_();
  Object.keys(cur.units).forEach(function(k) { merged.units[k] = cur.units[k]; });
  Object.keys(cur.cats).forEach(function(p) { merged.cats[p] = {}; Object.keys(cur.cats[p]).forEach(function(k) { merged.cats[p][k] = cur.cats[p][k]; }); });
  renameSave_(renameMapAdd_(merged, req));

  logRows.unshift([stamp, "", "", req.kind === "unit" ? "rename-unit" : "rename-cat", label, req.years.join(",")]);
  var log = ss.getSheetByName(TIDY_LOG_SHEET);
  if (!log) {
    log = ss.insertSheet(TIDY_LOG_SHEET);
    log.getRange(1, 1, 1, 6).setValues([["เวลา", "ปีงบ", "รหัส", "ฟิลด์", "ค่าเดิม", "ค่าใหม่"]]).setFontWeight("bold");
    log.hideSheet();
  }
  log.getRange(log.getLastRow() + 1, 1, logRows.length, 6).setNumberFormat("@").setValues(logRows);
  out.logRows = logRows.length;
  return out;
}

// ---------------------------------------------------------------- จุดเรียกจากหน้าเว็บ (เฉพาะ admin)

function renameInfo(token) {
  try {
    requireAdmin_(token);
    var years = renameReadYears_();
    var us = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
    var inv = renameInventory_(years, us ? readUsers_(us) : []);
    inv.lockedUnits = Object.keys(RENAME_LOCKED_UNITS);
    return { success: true, inventory: inv };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function renamePreview(token, req) {
  try {
    requireAdmin_(token);
    return { success: true, preview: renameSummary_(renamePlan_(req || {})) };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function renameCommit(token, req) {
  var lock = null;
  try {
    var admin = requireAdmin_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    renameReset_();
    var plan = renamePlan_(req || {});
    if (plan.errors.length) return { success: false, message: plan.errors.join("\n"), preview: renameSummary_(plan) };
    var wrote = renameApply_(plan, admin);
    SpreadsheetApp.flush();
    touchUser_(admin, "edit");
    bumpDataVersion_("*", "*", admin);
    return { success: true, message: "เปลี่ยนชื่อเรียบร้อย", wrote: wrote, usersNote: plan.users.length > 0 ? "ผู้ใช้ " + plan.users.length + " คนต้องออกจากระบบแล้วเข้าใหม่ จึงจะเห็นชื่อหน่วยใหม่ในปุ่ม \"หน่วยของฉัน\" (สิทธิ์แก้ไขใช้ชื่อใหม่ทันที)" : "" };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}
