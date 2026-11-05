/**
 * 🏅 นำเข้า KPI หัวหน้าหน่วยจาก Google Sheet (admin, ⚙️ ตั้งค่า → 📥 นำเข้าตัวชี้วัด ▾) — แผน/ข้อตกลง: docs/head-kpi-plan.md ส่วน C
 *  - ไฟล์: 1 ชีต = 1 คน (ชื่อชีต/แถวเหนือหัวตาราง = ชื่อ) · หัวตารางหาจากข้อความ (ลำดับ · ตัวชี้วัด · Template · ค่าเป้าหมาย · น้ำหนัก · 2.0–5.0 · เดือน) ไม่ยึดตำแหน่ง
 *  - นำเข้าเฉพาะรายการ KPI หลักของหัวหน้า (หยุดที่ "KPI กลาง"/แถว rd) · ปีงบที่เลือก (ปกติ 2570) · KPI ใหม่ระดับ "รายบุคคล" · หมวดจัดอัตโนมัติ
 *  - ตัวชี้วัดที่มีในปีงบอยู่แล้ว (ชื่อตรงกัน) = ใช้ตัวเดิม เพิ่มเฉพาะผู้รับผิดชอบ + เติมผลรายเดือนที่ว่าง (ตัวเลขเท่านั้น) · ชื่อคล้าย = ให้ admin เลือก
 *  - น้ำหนัก + เกณฑ์ 7 ช่อง → ชีต KPI_Score (Score.js) ต่อ (ปีงบ, ตัวชี้วัด, ผู้รับผิดชอบ) · ไม่นำเข้าคะแนนรอบที่กรอกในไฟล์ · มีแถวอยู่แล้ว = ไม่ทับ
 *  - headKpiPreview = ตรวจไฟล์ (ไม่เขียน) · headKpiCommit = เขียนจริง: script lock + สำรองชีต + Tidy_Log + bumpDataVersion_ · รันซ้ำได้
 */

var HK_BACKUP_PREFIX = "สำรองก่อนนำเข้า KPI หัวหน้า ";
var HK_USERS_BACKUP_PREFIX = "สำรองผู้ใช้ก่อนนำเข้า KPI หัวหน้า ";
var HK_SCORE_BACKUP_PREFIX = "สำรองคะแนนก่อนนำเข้า KPI หัวหน้า ";
var HK_MAX_SHEETS = 60;
var HK_MAX_ROWS = 600;
var HK_SIMILAR = 0.8;
var HK_MONTH_KEYS = ["ตค", "พย", "ธค", "มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย"];

function hkCell_(v) { return v === null || v === undefined ? "" : v.toString().replace(/\r\n?/g, "\n").trim(); }
function hkNorm_(v) { return hkCell_(v).replace(/\s+/g, " ").trim(); }
function hkMonthKey_(v) { return hkNorm_(v).replace(/[.\s]/g, ""); }

/** ความคล้ายของชื่อ (Dice บนคู่อักขระ) 0–1 — ใช้กับชื่อที่ผ่าน pimpKey_ แล้ว */
function hkDice_(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  var grams = {}, n = 0, i;
  for (i = 0; i < a.length - 1; i++) { var g = a.substr(i, 2); grams[g] = (grams[g] || 0) + 1; }
  for (i = 0; i < b.length - 1; i++) { var h = b.substr(i, 2); if (grams[h] > 0) { grams[h]--; n++; } }
  return 2 * n / (a.length + b.length - 2);
}

/**
 * แยกชีตเดียว → { person, rows, reason } (ฟังก์ชันล้วน — vals/rich = ตาราง 2 มิติของข้อความที่แสดง / URL ของลิงก์ในเซลล์)
 * rows: [{ row (เลขแถวในชีต), name, target, template, templateUrl, weight, crit[7], months[12] (ข้อความ), sub (ชื่อประกอบจากหัวข้อกลุ่ม) }]
 */
function hkParseSheet_(vals, title, rich) {
  var hdr = -1, r, c;
  for (r = 0; r < Math.min(vals.length, 12) && hdr === -1; r++) {
    for (c = 0; c < vals[r].length; c++) if (hkNorm_(vals[r][c]) === "ลำดับ") { hdr = r; break; }
  }
  if (hdr === -1) return { person: "", rows: [], reason: "ไม่พบหัวตาราง (ไม่มีคอลัมน์ ลำดับ)" };
  var head = vals[hdr].map(hkNorm_);
  var cName = -1, cTpl = -1, cTarget = -1, cWeight = -1;
  head.forEach(function(t, i) {
    if (cName === -1 && /^(KPI|ตั+วชี้วัด)/i.test(t)) cName = i;
    else if (cTpl === -1 && /^(template|เทมเพ)/i.test(t)) cTpl = i;
    else if (cTarget === -1 && /^ค่าเป้าหมาย/.test(t)) cTarget = i;
    else if (cWeight === -1 && /^น้ำหนัก/.test(t)) cWeight = i;
  });
  if (cName === -1) return { person: "", rows: [], reason: "ไม่พบคอลัมน์ ตัวชี้วัด/KPI" };
  // เกณฑ์ 2.0–5.0: ช่องแรกที่หัวเป็นเลขนั้น (หลังคอลัมน์เป้าหมาย/น้ำหนัก)
  var cCrit = [], from = Math.max(cTarget, cWeight, cName) + 1;
  [2, 2.5, 3, 3.5, 4, 4.5, 5].forEach(function(lv) {
    var found = -1;
    for (var i = from; i < head.length && found === -1; i++) if (head[i] !== "" && parseFloat(head[i]) === lv && /^\d+(\.\d+)?$/.test(head[i])) found = i;
    cCrit.push(found);
    if (found !== -1) from = found + 1;
  });
  // เดือน: ชื่อเดือนในแถวหัวตาราง/แถวเหนือ (ชื่อซ้ำ เช่น มี.ค. = ใช้ช่องแรก)
  var cMonth = HK_MONTH_KEYS.map(function() { return -1; });
  [hdr, hdr - 1].forEach(function(rr) {
    if (rr < 0 || !vals[rr]) return;
    vals[rr].forEach(function(t, i) {
      var k = HK_MONTH_KEYS.indexOf(hkMonthKey_(t));
      if (k !== -1 && cMonth[k] === -1 && i > cName) cMonth[k] = i;
    });
  });
  // ชื่อคน: ข้อความแรกเหนือหัวตาราง (ตัดคำว่า ช่วงคะแนน / ตัวชี้วัดที่รับผิดชอบ ของ)
  var person = "";
  for (r = 0; r < hdr && !person; r++) {
    for (c = 0; c < Math.min(vals[r].length, 4); c++) {
      var t = hkNorm_(vals[r][c]);
      if (!t || /ช่วงคะแนน/.test(t) || /^เดือน/.test(t)) continue;
      t = t.replace(/^ตัวชี้วัดที่รับผิดชอบ\s*ของ/, "").trim();
      if (t) { person = t; break; }
    }
  }
  var rows = [], blank = 0, heading = "";
  for (r = hdr + 1; r < vals.length; r++) {
    var row = vals[r];
    var ord = hkNorm_(row[0]), nm = hkNorm_(row[cName]);
    if (/^rd/i.test(ord) || /KPI\s*กลาง/.test(nm)) break; // ส่วนอื่นของไฟล์ (KPI กลาง / โน้ต) — หยุด
    if (!nm && !ord) { if (++blank > 8) break; continue; }
    blank = 0;
    if (!nm) continue;
    if (!/^\d/.test(ord)) { heading = nm; continue; } // แถวไม่มีลำดับ = หัวข้อกลุ่ม/โน้ต (ใช้ประกอบชื่อแถวย่อย)
    var sub = false;
    if (/^-\s*\S/.test(nm) && heading) { nm = heading + " " + nm; sub = true; } else if (!/^-/.test(nm)) heading = "";
    var tplCell = cTpl === -1 ? "" : hkCell_(row[cTpl]);
    var tplUrl = "";
    if (cTpl !== -1 && rich && rich[r] && rich[r][cTpl]) tplUrl = rich[r][cTpl];
    var crit = cCrit.map(function(ci) { return ci === -1 ? "" : hkNorm_(row[ci]).slice(0, SCORE_MAX_CRIT); });
    rows.push({
      row: r + 1, name: nm.replace(/^\s*-\s*/, "").trim(), target: cTarget === -1 ? "" : hkNorm_(row[cTarget]), template: tplCell, templateUrl: tplUrl,
      weight: cWeight === -1 ? "" : hkNorm_(row[cWeight]), crit: crit, months: cMonth.map(function(ci) { return ci === -1 ? "" : hkNorm_(row[ci]); }), sub: sub
    });
    if (rows.length > HK_MAX_ROWS) throw new Error("ชีต \"" + title + "\" มีตัวชี้วัดมากเกิน " + HK_MAX_ROWS + " แถว");
  }
  return { person: person, rows: rows, reason: rows.length ? "" : "ไม่พบแถวตัวชี้วัด", hasScore: cWeight !== -1 && cCrit.some(function(x) { return x !== -1; }) };
}

/** อ่านไฟล์ → [{ title, person, rows, reason, hasScore }] (ชีตที่ไม่ใช่รายการ KPI ของคน จะมี rows ว่าง + reason) */
function hkReadSource_(url) {
  url = (url || "").toString().trim();
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url)) throw new Error("ลิงก์ต้องเป็น Google ชีต (ขึ้นต้นด้วย https://docs.google.com/spreadsheets/) — ถ้าเป็นไฟล์ Excel ให้เปิดด้วย Google ชีตแล้วบันทึกเป็น Google ชีตก่อน");
  var ss;
  var idm = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(url); // เปิดด้วยรหัสไฟล์ (ไม่ขึ้นกับรูปแบบท้ายลิงก์ เช่น /edit?usp=…)
  try { ss = idm ? SpreadsheetApp.openById(idm[1]) : SpreadsheetApp.openByUrl(url); } catch (e) {
    throw new Error("เปิดไฟล์ไม่ได้ — ตรวจว่าเป็น Google ชีต (ไม่ใช่ไฟล์ .xlsx) และแชร์ให้บัญชี Google ที่เป็นเจ้าของสคริปต์แล้ว (" + String(e && e.message ? e.message : e).slice(0, 160) + ")");
  }
  var sheets = ss.getSheets();
  if (sheets.length > HK_MAX_SHEETS) throw new Error("ไฟล์มีมากกว่า " + HK_MAX_SHEETS + " ชีต");
  var out = [];
  sheets.forEach(function(sh) {
    var rng = sh.getDataRange();
    var vals = rng.getDisplayValues ? rng.getDisplayValues() : rng.getValues();
    var rich = null;
    try {
      if (rng.getRichTextValues) rich = rng.getRichTextValues().map(function(rw) { return rw.map(function(rt) { return rt && rt.getLinkUrl ? (rt.getLinkUrl() || "") : ""; }); });
    } catch (e2) { rich = null; }
    var title = sh.getName().toString().trim();
    var res = hkParseSheet_(vals, title, rich);
    out.push({ title: title, person: res.person, rows: res.rows, reason: res.reason, hasScore: !!res.hasScore });
  });
  if (!out.some(function(s) { return s.rows.length > 0; })) throw new Error("ไม่พบรายการตัวชี้วัดของหัวหน้าในไฟล์นี้ (ต้องมีหัวตารางที่มีคอลัมน์ ลำดับ และ KPI/ตัวชี้วัด)");
  return out;
}

/** ค่าในไฟล์ → ตัวเลข (ผลรายเดือนที่นำเข้าได้) หรือ null */
function hkMonthNum_(v) {
  var x = resultValue_(v, true);
  return typeof x === "number" ? x : null;
}

/**
 * วางแผนนำเข้า (ไม่เขียน) · decisions: { sheets: { ชื่อชีต: true|false }, people: { key: { choice: "existing"|"new", username, unit } },
 *   groups: { gkey: { action: "use"|"new"|"skip" } }, targets: { gkey: "≥ 90" } }
 */
function hkPlan_(url, fy, decisions) {
  decisions = decisions || {};
  fy = resolveFiscalYear_(fy);
  var sheet = getFiscalSheet_(fy);
  if (!sheet) throw new Error("ไม่พบชีตปีงบ " + fy);
  ensureColumns_(sheet, KPI_COLS);
  var src = hkReadSource_(url);
  var usersSheet = ensureUsersSheet_(), users = readUsers_(usersSheet);
  var userBy = {}, names = [];
  users.forEach(function(u) { userBy[u.username] = u; names.push(u.username); });
  var data = sheet.getDataRange().getValues();
  var existing = [];
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    existing.push({ idx: r, id: data[r][0].toString().trim(), name: data[r][4].toString().trim(), key: pimpKey_(data[r][4]), owners: parseOwners_(data[r][25]), months: data[r].slice(11, 23) });
  }
  var existByKey = {};
  existing.forEach(function(k) { if (k.key && !existByKey[k.key]) existByKey[k.key] = k; });
  var scoreRows = scoreRead_(scoreSheetIfAny_(), fy), scoreHave = {};
  scoreRows.forEach(function(s) { scoreHave[s.id + "\u0001" + s.owner] = true; });

  // ---- ชีต → คน (หลายชีตของคนเดียวกัน: ค่าเริ่มต้นใช้ชีตที่มีน้ำหนัก/เกณฑ์ ถ้ามี)
  var sheetsOut = [], byPerson = {};
  src.forEach(function(s, i) {
    var nm = pimpSplitName_(s.person || s.title);
    var first = nm.first || pimpSplitName_(s.title).first;
    var entry = { index: i, title: s.title, person: nm.clean || s.title, first: first, rows: s.rows, reason: s.reason, hasScore: s.hasScore, personKey: first.replace(/\s+/g, "") };
    entry.checked = entry.rows.length > 0;
    sheetsOut.push(entry);
    if (entry.rows.length) (byPerson[entry.personKey] = byPerson[entry.personKey] || []).push(entry);
  });
  Object.keys(byPerson).forEach(function(k) {
    var list = byPerson[k];
    if (list.length > 1 && list.some(function(e) { return e.hasScore; })) list.forEach(function(e) { e.checked = e.hasScore; });
  });
  sheetsOut.forEach(function(e) {
    if (decisions.sheets && decisions.sheets[e.title] !== undefined && e.rows.length) e.checked = !!decisions.sheets[e.title];
  });
  var active = sheetsOut.filter(function(e) { return e.checked && e.rows.length; });

  // ---- คน → บัญชี
  var people = [], pBy = {}, taken = {};
  names.forEach(function(n) { taken[n] = true; });
  active.forEach(function(e) {
    if (pBy[e.personKey]) { pBy[e.personKey].sheets.push(e.title); return; }
    var dec = (decisions.people && decisions.people[e.personKey]) || {};
    var info = { key: e.personKey, fullName: e.person, first: e.first, sheets: [e.title], candidates: [], status: "", choice: "", username: "", created: false, unit: "", needsChoice: false };
    var full = nameMatchesFull_(e.first, names);
    if (userBy[e.first]) { info.status = "same"; info.username = e.first; }
    else if (full.length === 1) { info.status = "same"; info.username = full[0]; }
    else if (full.length > 1) { info.status = "multi"; info.candidates = full.slice().sort(function(a, b) { return a.localeCompare(b, "th"); }); }
    else info.status = "fresh";
    if (dec.choice === "existing" && dec.username && userBy[dec.username]) { info.choice = "existing"; info.username = dec.username; }
    else if (dec.choice === "new") { info.choice = "new"; info.username = ""; }
    else info.choice = info.status === "fresh" ? "new" : "existing";
    if (info.choice === "new" || (info.status === "fresh" && !info.username)) {
      info.choice = "new"; info.username = pimpUniqueName_(e.first, "", taken); info.created = true; taken[info.username] = true;
    } else if (!info.username) { info.needsChoice = true; }
    var acct = info.username && userBy[info.username];
    info.unit = renameUnit_(hkNorm_(dec.unit) || (acct ? ((acct.depts && acct.depts[0]) || "") : ""));
    people.push(info);
    pBy[e.personKey] = info;
  });

  // ---- รวม KPI ตามชื่อ (ข้ามชีต/คน)
  var groups = [], gBy = {};
  active.forEach(function(e) {
    e.rows.forEach(function(row) {
      var key = pimpKey_(row.name);
      if (!key) return;
      var g = gBy[key];
      if (!g) { g = { key: key, name: pimpStripNo_(row.name), items: [], targets: {}, sub: false }; gBy[key] = g; groups.push(g); }
      if (row.sub) g.sub = true;
      g.items.push({ personKey: e.personKey, sheet: e.title, row: row });
      g.targets[row.target || ""] = true;
    });
  });

  // ---- จับคู่กับตัวชี้วัดในปีงบ + คำนวณผล
  var result = [], blockers = 0;
  groups.forEach(function(g) {
    var gdec = (decisions.groups && decisions.groups[g.key]) || {};
    var st, match = null, ex = existByKey[g.key] || null;
    if (ex) { st = "exact"; match = { id: ex.id, name: ex.name, score: 1 }; }
    else {
      var best = null;
      existing.forEach(function(k) {
        if (!k.key) return;
        var d = hkDice_(g.key, k.key);
        if (d >= HK_SIMILAR && (!best || d > best.score)) best = { id: k.id, name: k.name, score: Math.round(d * 100) / 100, k: k };
      });
      if (best) { st = "similar"; match = { id: best.id, name: best.name, score: best.score }; ex = best.k; } else st = "new";
    }
    var action;
    if (gdec.action === "skip") action = "skip";
    else if (st === "exact") action = gdec.action === "new" ? "new" : "use";
    else if (st === "similar") action = gdec.action === "use" || gdec.action === "new" ? gdec.action : "ask";
    else action = "new";
    if (action === "use" && !ex) action = "new";
    if (action === "ask") blockers++;
    var owners = [];
    g.items.forEach(function(it) { var p = pBy[it.personKey]; if (p && owners.indexOf(p.username) === -1) owners.push(p.username); });
    var first = g.items[0].row;
    var tgt = pimpTarget_(first.target);
    if (!tgt.value && tgt.original) tgt = { value: tgt.original.slice(0, 60), original: tgt.original, sure: false, note: "ไม่พบตัวเลข — เก็บข้อความเดิมเป็นเป้าหมาย" };
    var ov = decisions.targets && decisions.targets[g.key];
    if (ov !== undefined && ov !== null && String(ov).trim() !== "") tgt = { value: arabicDigits_(String(ov)).trim().slice(0, 60), original: tgt.original, sure: true, note: "", edited: true };
    var differing = Object.keys(g.targets).filter(function(x) { return x !== ""; });
    var tpl = "", tplUrl = "";
    g.items.forEach(function(it) { if (!tpl && it.row.template) tpl = it.row.template; if (!tplUrl && it.row.templateUrl) tplUrl = it.row.templateUrl; });
    var months = Array(12).fill(null);
    g.items.forEach(function(it) { it.row.months.forEach(function(m, i) { if (months[i] === null) months[i] = hkMonthNum_(m); }); });
    var fillable = 0;
    if (action === "use" && ex) months.forEach(function(v, i) { var cur = ex.months[i]; if (v !== null && (cur === "" || cur === null || cur === undefined)) fillable++; });
    else if (action === "new") fillable = months.filter(function(v) { return v !== null; }).length;
    var addOwners = ex && action === "use" ? owners.filter(function(o) { return ex.owners.indexOf(o) === -1; }) : owners;
    var scoreN = 0;
    g.items.forEach(function(it) {
      var p = pBy[it.personKey];
      if (p) scoreN++; // ทุกแถวเข้าชุดคะแนน (ไม่มีน้ำหนัก/เกณฑ์ = ว่างไว้ เติมทีหลัง)
    });
    result.push({
      key: g.key, name: g.name, status: st, action: action, match: match, owners: owners, addOwners: addOwners, ex: ex && action === "use" ? ex : null, sub: g.sub,
      target: tgt, targetDiffers: differing.length > 1 ? differing : null, template: tpl, templateUrl: tplUrl, months: months, monthsFill: fillable, items: g.items, scoreN: scoreN,
      same: action === "use" && addOwners.length === 0
    });
  });
  var needUnit = [];
  people.forEach(function(p) {
    var hasNew = result.some(function(g) { return g.action === "new" && g.owners.indexOf(p.username) !== -1; });
    p.needUnit = hasNew && !p.unit;
    if (p.needUnit) needUnit.push(p.fullName);
    if (p.needsChoice || p.needUnit) blockers++;
  });
  var stats = {
    sheets: active.length, skippedSheets: sheetsOut.length - active.length, people: people.length, kpis: result.length,
    use: result.filter(function(g) { return g.action === "use"; }).length, same: result.filter(function(g) { return g.same; }).length, created: result.filter(function(g) { return g.action === "new"; }).length,
    ask: result.filter(function(g) { return g.action === "ask"; }).length, skip: result.filter(function(g) { return g.action === "skip"; }).length,
    newAccounts: people.filter(function(p) { return p.created; }).length, review: result.filter(function(g) { return g.action === "new" && !g.target.sure; }).length,
    monthsFill: result.reduce(function(a, g) { return a + (g.action === "skip" ? 0 : g.monthsFill); }, 0),
    blockers: blockers
  };
  // แถวคะแนนที่จะเพิ่ม (ยังไม่รู้รหัสของ KPI ใหม่ — commit จะเติม)
  var scoreNew = 0;
  result.forEach(function(g) {
    if (g.action === "skip") return;
    g.items.forEach(function(it) {
      var p = pBy[it.personKey];
      if (!p) return;
      if (g.action === "use" && g.match && scoreHave[g.match.id + "\u0001" + p.username]) return;
      scoreNew++;
    });
  });
  stats.scoreNew = scoreNew;
  return { fy: fy, sheet: sheet, data: data, usersSheet: usersSheet, users: users, userNames: names, sheetsOut: sheetsOut, people: people, groups: result, stats: stats, scoreHave: scoreHave };
}

function hkPublic_(plan) {
  return {
    fy: plan.fy, stats: plan.stats, userNames: plan.userNames.slice().sort(function(a, b) { return a.localeCompare(b, "th"); }),
    sheets: plan.sheetsOut.map(function(e) { return { title: e.title, person: e.person, rows: e.rows.length, reason: e.reason, checked: e.checked, hasScore: e.hasScore }; }),
    people: plan.people.map(function(p) { return { key: p.key, fullName: p.fullName, sheets: p.sheets, status: p.status, choice: p.choice, username: p.username, created: p.created, unit: p.unit, candidates: p.candidates, needsChoice: p.needsChoice, needUnit: !!p.needUnit }; }),
    groups: plan.groups.map(function(g) {
      return {
        key: g.key, name: g.name, status: g.status, action: g.action, match: g.match, owners: g.owners, addOwners: g.addOwners, same: g.same, sub: g.sub,
        target: g.target, targetDiffers: g.targetDiffers, hasTemplate: !!g.template, monthsFill: g.monthsFill, scoreN: g.scoreN
      };
    })
  };
}

/** ตรวจไฟล์ก่อนนำเข้า (ไม่เขียนอะไร) */
function headKpiPreview(token, url, fy, decisions) {
  try {
    requireAdmin_(token);
    return { success: true, preview: hkPublic_(hkPlan_(url, fy, decisions)) };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  }
}

/** นำเข้าจริง (admin) — ทำแผนซ้ำฝั่งเซิร์ฟเวอร์ ไม่เชื่อแถวจากหน้าเว็บ รับเฉพาะการตัดสินใจ */
function headKpiCommit(token, url, fy, decisions) {
  var lock = null;
  try {
    var admin = requireAdmin_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var plan = hkPlan_(url, fy, decisions);
    if (plan.stats.blockers > 0) return { success: false, message: "ยังมีรายการที่ต้องเลือกก่อนนำเข้า " + plan.stats.blockers + " รายการ (ชื่อคล้าย / บัญชี / หน่วยงาน)" };
    var sheet = plan.sheet, fyr = plan.fy;
    var todo = plan.groups.filter(function(g) { return g.action !== "skip"; });
    if (todo.length === 0) return { success: true, created: 0, used: 0, message: "ไม่มีรายการให้นำเข้า" };
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL), stamp = nowStamp_();
    var fileStamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
    var b = sheet.copyTo(ss);
    b.setName(HK_BACKUP_PREFIX + fiscalSheetName_(fyr) + " " + fileStamp);
    b.hideSheet();
    renameBackupSheets_(ss, HK_BACKUP_PREFIX, 3);
    var newPeople = plan.people.filter(function(p) { return p.created; });
    if (newPeople.length) {
      var uss = getUsersSpreadsheet_();
      var ub = plan.usersSheet.copyTo(uss);
      ub.setName(HK_USERS_BACKUP_PREFIX + fileStamp);
      ub.hideSheet();
      renameBackupSheets_(uss, HK_USERS_BACKUP_PREFIX, 3);
    }
    var oldScore = scoreSheetIfAny_();
    if (oldScore) {
      var sb = oldScore.copyTo(ss);
      sb.setName(HK_SCORE_BACKUP_PREFIX + fileStamp);
      sb.hideSheet();
      renameBackupSheets_(ss, HK_SCORE_BACKUP_PREFIX, 3);
    }

    // บัญชีใหม่ (หัวหน้าหน่วย + หน่วยที่ระบุ)
    var taken = {};
    plan.users.forEach(function(u) { taken[u.username] = true; });
    var newUsers = [];
    newPeople.forEach(function(p) {
      if (taken[p.username]) throw new Error("ชื่อบัญชี " + p.username + " ซ้ำ — ให้ตรวจสอบใหม่");
      taken[p.username] = true;
      newUsers.push(buildUser_(p.username, DEFAULT_PASSWORD, "head", p.unit ? [p.unit] : [], true));
    });
    if (newUsers.length) writeUsers_(plan.usersSheet, plan.users.concat(newUsers));

    var unitOf = {};
    plan.people.forEach(function(p) { unitOf[p.username] = p.unit; });
    var logRows = [], data = plan.data.slice(), built = [], builtIds = [], idOf = {}, baseTime = new Date().getTime(), usedN = 0, ownersAdded = 0, monthsFilled = 0;

    // ตัวชี้วัดเดิม: เพิ่มผู้รับผิดชอบ + เติมผลรายเดือนที่ว่าง (ไม่แตะช่องอื่น)
    todo.filter(function(g) { return g.action === "use" && g.ex; }).forEach(function(g) {
      var row = g.ex.idx + 1, touched = false;
      if (g.addOwners.length) {
        var cur = (plan.data[g.ex.idx][25] || "").toString().trim();
        var next = (cur ? cur + " / " : "") + g.addOwners.join(" / ");
        sheet.getRange(row, 26).setValue(next);
        logRows.push([stamp, fyr, g.ex.id, "head-import-owner", cur, next]);
        ownersAdded += g.addOwners.length; touched = true;
      }
      g.months.forEach(function(v, i) {
        var curV = g.ex.months[i];
        if (v === null || !(curV === "" || curV === null || curV === undefined)) return;
        sheet.getRange(row, 12 + i).setValue(v);
        monthsFilled++; touched = true;
      });
      if (touched) stampRow_(sheet, row, admin, "edit");
      idOf[g.key] = g.ex.id; usedN++;
    });

    // ตัวชี้วัดใหม่ (แกนเดียวกับ addIndicator)
    var k = 0;
    todo.filter(function(g) { return g.action === "new"; }).forEach(function(g) {
      var unit = "";
      g.owners.forEach(function(o) { if (!unit && unitOf[o]) unit = unitOf[o]; });
      var item = {
        name: g.name, target: g.target.value || "",
        dataSource: hkSourceText_(g.template, g.templateUrl, g.target),
        templateDetails: "", owner: g.owners.join(" / "), department: unit, levels: ["รายบุคคล"],
        cats: [{ part: unit, category: UNIT_CATS_PLACEHOLDER }],
        years: [null, null, null, null, null], months: g.months.slice()
      };
      var res = buildNewKpiRow_(admin, fyr, sheet, data, item, true, baseTime + k++);
      if (res.error) throw new Error("\"" + g.name + "\": " + res.error);
      var rw = res.row.slice();
      while (rw.length < KPI_COLS) rw.push("");
      [4, 5, 23, 24, 25, 26].forEach(function(c) { rw[c] = tidyLiteral_(rw[c]); });
      built.push(rw); data.push(rw); builtIds.push(res.newId); idOf[g.key] = res.newId;
      logRows.push([stamp, fyr, res.newId, "head-import-kpi", "", g.name]);
    });
    if (built.length) {
      var first = sheet.getLastRow() + 1;
      sheet.getRange(first, 1, built.length, KPI_COLS).setNumberFormat("@");
      sheet.getRange(first, 1, built.length, KPI_COLS).setValues(built);
      if (!sheet.getRange(1, EXTRA_CATS_COL).getValue() && built.some(function(rw) { return rw[EXTRA_CATS_COL - 1]; })) {
        sheet.getRange(1, EXTRA_CATS_COL).setValue(EXTRA_CATS_HEADER).setFontWeight("bold").setBackground("#e0f2fe").setHorizontalAlignment("center");
      }
    }

    // ชุดคะแนน (KPI_Score): น้ำหนัก + เกณฑ์ — มีแถวอยู่แล้วไม่ทับ
    var scoreRowsOut = [], scoreSkipped = 0, seen = {};
    todo.forEach(function(g) {
      var id = idOf[g.key];
      if (!id) return;
      g.items.forEach(function(it) {
        var p = plan.people.filter(function(x) { return x.key === it.personKey; })[0];
        if (!p) return; // ทุกแถวเข้าชุดคะแนน แม้ไฟล์ยังไม่ได้ใส่น้ำหนัก/เกณฑ์
        var kk = id + "\u0001" + p.username;
        if (plan.scoreHave[kk] || seen[kk]) { scoreSkipped++; return; }
        seen[kk] = true;
        var hasScore = !!(it.row.weight || it.row.crit.some(function(c) { return c; }));
        var w = scoreNum_(it.row.weight);
        if (!hasScore) w = 0; // ยังไม่มีน้ำหนัก/เกณฑ์ → น้ำหนัก 0 (ไม่นับคะแนน) ขึ้นในกล่อง "ยังไม่ได้ใส่น้ำหนัก/เกณฑ์"
        else if (w === null || w < 0 || w > SCORE_MAX_WEIGHT) w = 1;
        scoreRowsOut.push([String(fyr), id, p.username, w].concat(it.row.crit.map(function(c) { return scoreCell_(c).slice(0, SCORE_MAX_CRIT); }), ["", "", "", stamp, admin.username + " (นำเข้า)"]));
      });
    });
    if (scoreRowsOut.length) {
      var ssheet = scoreSheetEnsure_();
      var sf = ssheet.getLastRow() + 1;
      ssheet.getRange(sf, 1, scoreRowsOut.length, SCORE_HEADERS.length).setNumberFormat("@");
      ssheet.getRange(sf, 1, scoreRowsOut.length, SCORE_HEADERS.length).setValues(scoreRowsOut);
    }

    logRows.unshift([stamp, fyr, "", "head-import", "", "ตัวชี้วัดใหม่ " + built.length + " · ใช้ตัวเดิม " + usedN + " · เพิ่มผู้รับผิดชอบ " + ownersAdded + " · เติมผลรายเดือน " + monthsFilled + " · คะแนน " + scoreRowsOut.length + " · บัญชีใหม่ " + newUsers.length]);
    newUsers.forEach(function(u) { logRows.push([stamp, "", u.username, "head-import-user", "", "head"]); });
    var log = ss.getSheetByName(TIDY_LOG_SHEET);
    if (!log) {
      log = ss.insertSheet(TIDY_LOG_SHEET);
      log.getRange(1, 1, 1, 6).setValues([["เวลา", "ปีงบ", "รหัส", "ฟิลด์", "ค่าเดิม", "ค่าใหม่"]]).setFontWeight("bold");
      log.hideSheet();
    }
    log.getRange(log.getLastRow() + 1, 1, logRows.length, 6).setNumberFormat("@").setValues(logRows);

    touchUser_(admin, "edit");
    bumpDataVersion_("*", "*", admin);
    if (scoreRowsOut.length) bumpDataVersion_(fyr, [], admin, SCORE_DOC);
    return {
      success: true, created: built.length, used: usedN, ownersAdded: ownersAdded, monthsFilled: monthsFilled, scoreRows: scoreRowsOut.length, scoreSkipped: scoreSkipped,
      accounts: newUsers.map(function(u) { return { username: u.username }; }), ids: builtIds,
      message: "นำเข้าตัวชี้วัดใหม่ " + built.length + " · ใช้ตัวเดิม " + usedN + " (เพิ่มผู้รับผิดชอบ " + ownersAdded + ") · ชุดคะแนน " + scoreRowsOut.length + " แถว" + (newUsers.length ? " · สร้างบัญชี " + newUsers.length + " บัญชี (รหัสผ่านตั้งต้น " + DEFAULT_PASSWORD + ")" : "")
    };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** ที่มา/สูตร = Template (+ URL ของลิงก์ถ้ามี) · เป้าหมายเดิมที่ปรับค่าแล้วต่อท้ายเป็นบรรทัดอ้างอิง */
function hkSourceText_(template, url, target) {
  var t = arabicDigits_((template || "").toString()).trim();
  if (url && /^https:\/\/(drive|docs)\.google\.com\//.test(url)) t = (t ? t + "\n" : "") + url;
  return pimpSourceText_(t, target);
}


// ---------------------------------------------------------------- เติมชุดคะแนนที่ตกหล่นจากการนำเข้าครั้งแรก (งานครั้งเดียว)
// ครั้งแรกที่นำเข้า แถวที่ไฟล์ไม่มีน้ำหนัก/เกณฑ์ไม่ถูกใส่ในชุดคะแนน → อ่านไฟล์เดิมซ้ำ จับคู่ตัวชี้วัดที่คนนั้นเป็นผู้รับผิดชอบ แล้วเติมเฉพาะแถวที่ยังไม่มี
// ไม่สร้างตัวชี้วัด/บัญชี ไม่แตะข้อมูลอื่น · ทำครั้งเดียว (Script Property HK_SCORE_FILL_V1) · ลบโค้ดส่วนนี้ได้หลังทำเสร็จ
var HK_FILL_FLAG = "HK_SCORE_FILL_V1";
var HK_FILL_FY = 2570;
var HK_FILL_URL = "https://docs.google.com/spreadsheets/d/18G-Q7Fr-7aDL2-mEEjuHR0DsxBrKeQGe3ETA2tmJzyk/edit";

function hkFillPending_() { return !PropertiesService.getScriptProperties().getProperty(HK_FILL_FLAG); }

/** ฟังก์ชันล้วนเกือบทั้งหมด: คืน { add: [แถวคะแนน], missed: [{person, name}], skipped: [ชื่อ], sheets, people } */
function hkFillPlan_(fy, url, stamp, by) {
  var plan = hkPlan_(url, fy, {});
  var kpis = [];
  plan.data.forEach(function(r, i) {
    if (i === 0 || !r[0]) return;
    kpis.push({ id: r[0].toString().trim(), key: pimpKey_(r[4]), owners: parseOwners_(r[25]) });
  });
  var pBy = {};
  plan.people.forEach(function(p) { pBy[p.key] = p; });
  var add = [], missed = [], skipped = [], seen = {}, nSheets = 0;
  plan.sheetsOut.forEach(function(e) {
    if (!e.checked || !e.rows.length) return;
    var p = pBy[e.personKey];
    if (!p || !p.username || p.created || p.needsChoice) { if (skipped.indexOf(e.person) === -1) skipped.push(e.person); return; }
    nSheets++;
    var mine = kpis.filter(function(k) { return k.owners.indexOf(p.username) !== -1; });
    e.rows.forEach(function(row) {
      var key = pimpKey_(row.name);
      if (!key) return;
      var hit = null, best = 0;
      mine.forEach(function(k) {
        if (!k.key) return;
        var d = k.key === key ? 1 : hkDice_(key, k.key);
        if (d > best) { best = d; hit = k; }
      });
      if (!hit || best < HK_SIMILAR) { missed.push({ person: p.username, name: pimpStripNo_(row.name) }); return; }
      var kk = hit.id + "\u0001" + p.username;
      if (plan.scoreHave[kk] || seen[kk]) return;
      seen[kk] = true;
      var hasScore = !!(row.weight || row.crit.some(function(c) { return c; }));
      var w = scoreNum_(row.weight);
      if (!hasScore) w = 0;
      else if (w === null || w < 0 || w > SCORE_MAX_WEIGHT) w = 1;
      add.push([String(plan.fy), hit.id, p.username, w].concat(row.crit.map(function(c) { return scoreCell_(c).slice(0, SCORE_MAX_CRIT); }), ["", "", "", stamp, by]));
    });
  });
  return { add: add, missed: missed, skipped: skipped, sheets: nSheets, people: plan.people.length, fy: plan.fy };
}

/** เรียกจากหน้า 🏅 (admin/ผอ./QMR) ครั้งแรกหลังอัปเดต — ทำครั้งเดียว ล้มเหลว = ไม่ตั้ง flag ลองใหม่ครั้งถัดไป */
function scoreFillOnce(token) {
  var lock = null;
  try {
    var user = requireUser_(token);
    if (!scoreCanEdit_(user)) return { success: false, message: "เฉพาะ admin และ ผอ./QMR" };
    if (!hkFillPending_()) return { success: true, done: true, added: 0 };
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    if (!hkFillPending_()) return { success: true, done: true, added: 0 };
    var stamp = nowStamp_();
    var res = hkFillPlan_(HK_FILL_FY, HK_FILL_URL, stamp, user.username + " (เติมจากไฟล์นำเข้า)");
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    if (res.add.length) {
      var old = scoreSheetIfAny_();
      if (old) {
        var b = old.copyTo(ss);
        b.setName(HK_SCORE_BACKUP_PREFIX + "เติมคะแนน " + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss"));
        b.hideSheet();
        renameBackupSheets_(ss, HK_SCORE_BACKUP_PREFIX, 3);
      }
      var ssheet = scoreSheetEnsure_();
      var sf = ssheet.getLastRow() + 1;
      ssheet.getRange(sf, 1, res.add.length, SCORE_HEADERS.length).setNumberFormat("@");
      ssheet.getRange(sf, 1, res.add.length, SCORE_HEADERS.length).setValues(res.add);
    }
    var log = ss.getSheetByName(TIDY_LOG_SHEET);
    if (!log) {
      log = ss.insertSheet(TIDY_LOG_SHEET);
      log.getRange(1, 1, 1, 6).setValues([["เวลา", "ปีงบ", "รหัส", "ฟิลด์", "ค่าเดิม", "ค่าใหม่"]]).setFontWeight("bold");
      log.hideSheet();
    }
    var logRows = [[stamp, res.fy, "", "score-fill", "", "เพิ่ม " + res.add.length + " แถว · หาตัวชี้วัดไม่เจอ " + res.missed.length + " · ข้ามบัญชี " + res.skipped.length]];
    res.missed.slice(0, 40).forEach(function(m) { logRows.push([stamp, res.fy, m.person, "score-fill-missed", "", String(m.name).slice(0, 200)]); });
    log.getRange(log.getLastRow() + 1, 1, logRows.length, 6).setNumberFormat("@").setValues(logRows);
    PropertiesService.getScriptProperties().setProperty(HK_FILL_FLAG, stamp);
    if (res.add.length) bumpDataVersion_(res.fy, [], user, SCORE_DOC);
    return { success: true, done: true, added: res.add.length, missed: res.missed.length, skipped: res.skipped.length };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  } finally {
    if (lock) lock.releaseLock();
  }
}
