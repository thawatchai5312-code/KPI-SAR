/**
 * 🏅 คะแนน KPI (ประเมินหัวหน้าหน่วย): น้ำหนัก + เกณฑ์คะแนน 2.0–5.0 (7 ช่อง) ต่อ (ปีงบ, ตัวชี้วัด, ผู้รับผิดชอบ) — docs/head-kpi-plan.md ส่วน B
 *  - เก็บในชีต KPI_Score แยกจากชีตปีงบ (ไม่แตะฐานข้อมูลเดิม) · เกณฑ์เก็บเป็นข้อความตามที่กรอก คำนวณตอนอ่านฝั่งเซิร์ฟเวอร์ที่เดียว (scoreCompute_)
 *  - รอบ 1 = ต.ค.–มี.ค. (เดือน 0–5) · รอบ 2 = เม.ย.–ก.ย. (เดือน 6–11) · ผลรอบ = สรุปผลรายเดือนของรอบนั้นตามวิธีสรุปของตัวชี้วัด
 *  - คะแนนกรอกเอง (รอบ 1/รอบ 2) ใช้แทนคะแนนที่คำนวณ · คำนวณไม่ได้ = ⚠️ ให้กรอกเอง
 *  - ดู: เจ้าตัว (ของตัวเอง) · admin · ผอ./QMR (ทุกคน) · แก้: admin, ผอ./QMR เท่านั้น
 *  - ทุกการเขียนอยู่ใต้ script lock + ตรวจรุ่น (baseRev) + bumpDataVersion_(fy, [], user, "SCORE")
 */

var SCORE_SHEET = "KPI_Score";
var SCORE_DOC = "SCORE";
var SCORE_HEADERS = ["ปีงบ", "รหัสตัวชี้วัด", "ผู้รับผิดชอบ", "น้ำหนัก", "เกณฑ์ 2.0", "เกณฑ์ 2.5", "เกณฑ์ 3.0", "เกณฑ์ 3.5", "เกณฑ์ 4.0", "เกณฑ์ 4.5", "เกณฑ์ 5.0", "คะแนนรอบ 1 (กรอกเอง)", "คะแนนรอบ 2 (กรอกเอง)", "หมายเหตุ", "แก้ไขล่าสุดเมื่อ", "แก้ไขล่าสุดโดย"];
var SCORE_LEVELS = [2, 2.5, 3, 3.5, 4, 4.5, 5];
var SCORE_ROUNDS = [[0, 5], [6, 11]]; // ช่วงเดือน (index) ของรอบ 1 / รอบ 2
var SCORE_MAX_CRIT = 60;
var SCORE_MAX_NOTE = 300;
var SCORE_MAX_WEIGHT = 100;

function scoreSheetIfAny_() {
  return SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName(SCORE_SHEET);
}

/** ชีต KPI_Score — สร้างให้ถ้ายังไม่มี (เรียกภายใต้ script lock เท่านั้น) */
function scoreSheetEnsure_() {
  var sheet = scoreSheetIfAny_();
  if (sheet) return sheet;
  sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).insertSheet(SCORE_SHEET);
  sheet.getRange(1, 1, 1, SCORE_HEADERS.length).setValues([SCORE_HEADERS]).setFontWeight("bold").setBackground("#e0f2fe");
  sheet.setFrozenRows(1);
  return sheet;
}

/** ลายนิ้วมือของแถวคะแนน (FNV-1a) ไม่นับเวลา/ผู้แก้ — ตรวจแก้ชน */
function scoreRev_(vals) {
  var s = "";
  for (var c = 0; c < 14; c++) s += (vals[c] === undefined || vals[c] === null ? "" : vals[c]) + "\u0001";
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36) + "." + s.length.toString(36);
}

function scoreCell_(v) { return v === undefined || v === null ? "" : arabicDigits_(v.toString()).replace(/\s+/g, " ").trim(); }

/** แถวคะแนนของปีงบ fy → [{ row, fy, id, owner, weight, crit[7], r1, r2, note, at, by, rev }] */
function scoreRead_(sheet, fy) {
  var out = [];
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[0]).trim() !== String(fy) || !r[1] || !r[2]) continue;
    var crit = [];
    for (var k = 0; k < 7; k++) crit.push(scoreCell_(r[4 + k]));
    out.push({
      row: i + 1, fy: Number(fy), id: r[1].toString().trim(), owner: r[2].toString().trim(),
      weight: scoreNum_(r[3]), crit: crit, r1: scoreManual_(r[11]), r2: scoreManual_(r[12]),
      note: scoreCell_(r[13]), at: formatStamp_(r[14]), by: (r[15] || "").toString(), rev: scoreRev_(r)
    });
  }
  return out;
}

function scoreNum_(v) {
  if (v === "" || v === null || v === undefined) return null;
  var n = Number(arabicDigits_(v.toString()).replace(/,/g, ""));
  return isFinite(n) ? n : null;
}

/** คะแนนกรอกเอง: ว่าง = null · ต้องอยู่ 0–5 ขั้นละ 0.5 (ค่าอื่นในชีต = null) */
function scoreManual_(v) {
  var n = scoreNum_(v);
  if (n === null || n < 0 || n > 5 || Math.round(n * 2) !== n * 2) return null;
  return n;
}

// ---------------------------------------------------------------- แปลงเกณฑ์ → คำนวณคะแนน

/**
 * ข้อความเกณฑ์ 1 ช่อง → { op, num } (ตัวเลข) · { text } (ข้อความ เช่น A, ดีมาก) · null (ว่าง/อ่านไม่ได้)
 * รับ: 80 · 80% · ≥ 85 · >5 · <75 · ≤ 2 % · มากกว่า 1 · ไม่เกิน 3 · ร้อยละ 70 · 1 ครั้ง/ปี ฯลฯ — ค่าหลายตัว (6,6,6) วันที่ ข้อความยาว = อ่านไม่ได้
 */
function scoreParseCrit_(raw) {
  var t = scoreCell_(raw);
  if (!t) return null;
  var op = "";
  var words = [["ไม่น้อยกว่า", "≥"], ["ไม่ต่ำกว่า", "≥"], ["มากกว่าหรือเท่ากับ", "≥"], ["ไม่เกิน", "≤"], ["น้อยกว่าหรือเท่ากับ", "≤"], ["มากกว่า", ">"], ["น้อยกว่า", "<"], ["ต่ำกว่า", "<"]];
  for (var i = 0; i < words.length; i++) {
    if (t.indexOf(words[i][0]) === 0) { op = words[i][1]; t = t.slice(words[i][0].length).trim(); break; }
  }
  var m = /^(≥|>=|≤|<=|>|<|=)?\s*(?:ร้อยละ)?\s*(-?\d+(?:\.\d+)?)\s*(?:%|ครั้ง(?:\/[^\s]+)?|ราย|วัน|เรื่อง|แห่ง|ขึ้นไป|หรือมากกว่า)?\s*$/.exec(t);
  if (m) {
    var o = op || m[1] || "";
    if (o === ">=") o = "≥";
    if (o === "<=") o = "≤";
    return { op: o, num: parseFloat(m[2]) };
  }
  if (/\d/.test(t) || op || t.length > SCORE_MAX_CRIT) return null; // มีตัวเลขปนข้อความ/ช่วง/วันที่ = อ่านไม่ได้
  return { text: t.toLowerCase() };
}

/** ผลรอบ (เดือน lo..hi) ตามวิธีสรุป: ตัวเลข → เฉลี่ย/ผลรวม/ล่าสุด · ไม่มีตัวเลขแต่มีข้อความ → ข้อความล่าสุด · ไม่มีผล = null */
function scoreRoundResult_(months, lo, hi, method) {
  var nums = [], texts = [], last = null;
  for (var i = lo; i <= hi; i++) {
    var v = months[i];
    if (typeof v === "number") { nums.push(v); last = v; }
    else if (typeof v === "string" && v !== "-" && v !== "") { texts.push(v); last = v; }
  }
  if (nums.length) {
    if (method === "เดือนล่าสุด") return last;
    var sum = nums.reduce(function(a, b) { return a + b; }, 0);
    return Math.round((method === "ผลรวม" ? sum : sum / nums.length) * 100) / 100;
  }
  return texts.length ? texts[texts.length - 1] : null;
}

/**
 * ตรวจเกณฑ์ 7 ช่อง (ไม่ขึ้นกับผล) → { ok, kind: "num"|"text", up, nums, parsed } หรือ { ok: false, reason }
 * ใช้ทั้งตอนคิดคะแนนและรายการ "เกณฑ์ที่ต้องแก้" (admin)
 */
function scoreCritCheck_(crit, targetText) {
  var parsed = crit.map(scoreParseCrit_);
  var nums = [], texts = 0;
  parsed.forEach(function(c, i) { if (c && c.num !== undefined) nums.push({ i: i, c: c }); else if (c && c.text !== undefined) texts++; });
  if (!nums.length) {
    if (texts) return { ok: true, kind: "text", parsed: parsed, nums: [] };
    return { ok: false, reason: crit.some(function(c) { return c; }) ? "เกณฑ์อ่านไม่ได้ (เช่น หลายค่า/ช่วง/วันที่)" : "ไม่มีเกณฑ์คะแนน" };
  }
  // ทิศทาง: ยิ่งสูงยิ่งดี / ยิ่งต่ำยิ่งดี — เทียบเลขช่องแรกกับช่องสุดท้าย · เท่ากัน/มีช่องเดียว ดูเครื่องหมายเป้าหมายของตัวชี้วัด
  var first = nums[0].c.num, lastN = nums[nums.length - 1].c.num, up;
  if (lastN > first) up = true;
  else if (lastN < first) up = false;
  else {
    var t = /^\s*(≥|>=|≤|<=|>|<|=)?/.exec(arabicDigits_(String(targetText || "")));
    var to = t && t[1] ? t[1] : "";
    up = !(to === "≤" || to === "<=" || to === "<" || to === "=");
  }
  for (var k = 1; k < nums.length; k++) {
    var a = nums[k - 1].c.num, b = nums[k].c.num;
    if (up ? b < a : b > a) return { ok: false, reason: "ช่องเกณฑ์ไม่เรียงตามทิศทางเดียวกัน (ช่อง " + SCORE_LEVELS[nums[k].i].toFixed(1) + ")" };
  }
  return { ok: true, kind: "num", up: up, nums: nums, parsed: parsed };
}

/** คะแนนจากผลรอบและเกณฑ์ 7 ช่อง → { ok, score, reason } */
function scoreLevelFor_(result, crit, targetText) {
  var parsed = crit.map(scoreParseCrit_);
  if (typeof result === "string") {
    var key = result.trim().toLowerCase(), best = -1;
    parsed.forEach(function(c, i) { if (c && c.text !== undefined && c.text === key) best = i; });
    if (best < 0) return { ok: false, reason: "ผลเป็นข้อความ \"" + result + "\" ไม่ตรงกับเกณฑ์ข้อความใด" };
    return { ok: true, score: SCORE_LEVELS[best] };
  }
  var chk = scoreCritCheck_(crit, targetText);
  if (!chk.ok) return { ok: false, reason: chk.reason };
  if (chk.kind !== "num") return { ok: false, reason: "เกณฑ์ไม่มีตัวเลขที่อ่านได้" };
  var nums = chk.nums, up = chk.up;
  var best2 = 0;
  nums.forEach(function(x) {
    var c = x.c, n = c.num, op = c.op || (up ? "≥" : "≤"), pass;
    if (op === "≥") pass = result >= n;
    else if (op === ">") pass = result > n;
    else if (op === "≤") pass = result <= n;
    else if (op === "<") pass = result < n;
    else pass = result === n;
    if (pass && SCORE_LEVELS[x.i] > best2) best2 = SCORE_LEVELS[x.i];
  });
  return { ok: true, score: best2 }; // ไม่ผ่านช่องใดเลย = 0
}

var SCORE_FREQ_PERIODS = { "รายไตรมาส": [[0, 2], [3, 5], [6, 8], [9, 11]], "ครึ่งปี": [[0, 5], [6, 11]], "รายปี": [[0, 11]] };

/** รอบ idx ของปีงบ fy จบแล้วหรือยัง (รอบ 1 จบ 31 มี.ค. · รอบ 2 จบ 30 ก.ย. ของปี ค.ศ. = fy − 543) */
function scoreRoundEnded_(fy, idx) {
  var y = Number(fy) - 543;
  return new Date().getTime() >= new Date(y, idx === 0 ? 3 : 9, 1).getTime();
}

/** ความครบของผลในรอบ: รอบเก็บข้อมูลตามความถี่ที่จบในรอบนี้ (expected) · รอบที่กรอกแล้ว (filled — ตัวเลข/ข้อความ/"-") */
function scoreRoundFill_(kpi, idx) {
  var rg = SCORE_ROUNDS[idx], periods = SCORE_FREQ_PERIODS[kpi.frequency] || null, list = [];
  if (periods) periods.forEach(function(p) { if (p[1] >= rg[0] && p[1] <= rg[1]) list.push(p); });
  else for (var m = rg[0]; m <= rg[1]; m++) list.push([m, m]);
  var filled = 0;
  list.forEach(function(p) {
    for (var i = p[0]; i <= p[1]; i++) { var v = kpi.months[i]; if (v !== null && v !== undefined && v !== "") { filled++; return; } }
  });
  return { expected: list.length, filled: filled };
}

/**
 * คิดคะแนนของแถว (ตัวชี้วัด kpi ที่ผู้รับผิดชอบคนนี้) → { weight, rounds: [{ result, score, source, reason }, ...2 รอบ], weighted: [รอบ1, รอบ2] }
 *  source: "manual" (กรอกเอง) · "calc" (คำนวณ) · "none" (ยังไม่มีผลในรอบ) · "warn" (คำนวณไม่ได้ ให้กรอกเอง)
 *    · "wait" (วิธีสรุป "ผลรวม" ที่ผลยังไม่ครบรอบและรอบยังไม่จบ — ยังไม่คิด เพราะผลรวมบางส่วนดูดีเกินจริง)
 *  partial = ผลยังไม่ครบตามความถี่ (filled < expected) → หน้าเว็บขึ้นป้าย "ผลบางส่วน x/y"
 */
function scoreCompute_(kpi, row) {
  var rounds = [], weighted = [];
  var w = row.weight === null ? 0 : row.weight;
  [row.r1, row.r2].forEach(function(manual, idx) {
    var rg = SCORE_ROUNDS[idx];
    var result = kpi ? scoreRoundResult_(kpi.months, rg[0], rg[1], kpi.summaryMethod) : null;
    var fill = kpi ? scoreRoundFill_(kpi, idx) : { expected: 0, filled: 0 };
    var ended = scoreRoundEnded_(row.fy, idx);
    var out = { result: result, score: null, source: "none", reason: "", filled: fill.filled, expected: fill.expected, partial: result !== null && fill.filled < fill.expected, ended: ended };
    if (manual !== null) { out.score = manual; out.source = "manual"; }
    else if (result !== null && out.partial && !ended && kpi && kpi.summaryMethod === "ผลรวม") {
      out.source = "wait"; out.reason = "วิธีสรุปผลรวม — รอผลครบรอบ (" + fill.filled + "/" + fill.expected + ") หรือสิ้นรอบ";
    }
    else if (result !== null) {
      var lv = scoreLevelFor_(result, row.crit, kpi ? kpi.target : "");
      if (lv.ok) { out.score = lv.score; out.source = "calc"; }
      else { out.source = "warn"; out.reason = lv.reason; }
    }
    rounds.push(out);
    weighted.push(out.score === null ? null : Math.round(out.score * w * 100) / 100);
  });
  return { weight: row.weight, rounds: rounds, weighted: weighted };
}

// ---------------------------------------------------------------- ผู้ใช้/สิทธิ์

function scoreCanEdit_(user) { return isPrivileged_(user); }
/** เข้าหน้าคะแนน KPI ได้: หัวหน้าหน่วยขึ้นไป (staff ไม่ได้) */
function scoreAllowed_(user) { return user.tier !== "staff"; }
var SCORE_DENIED = "หน้าคะแนน KPI สำหรับหัวหน้าหน่วยขึ้นไปเท่านั้น";

/** บัญชีที่ผู้เรียกดูได้: admin/ผอ./QMR = ทุกคน · อื่น ๆ = ตัวเอง */
function scoreTargetName_(user, person) {
  person = (person || "").toString().trim();
  if (scoreCanEdit_(user) && person) return person;
  return user.username;
}

function scoreUserByName_(name) {
  var us = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
  var users = us ? readUsers_(us) : [];
  return users.filter(function(u) { return u.username === name; })[0] || null;
}

/** ปีงบ fy: รหัส → kpi (rowToKpi_) ของตัวชี้วัดที่ต้องการ */
function scoreKpiMap_(fy, wanted) {
  var out = {}, sheet = getFiscalSheet_(fy);
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    var id = data[r][0].toString().trim();
    if (wanted[id] && !out[id]) out[id] = rowToKpi_(data[r]);
  }
  return out;
}

/** เมนูคะแนน: has = ผู้ใช้มีชุดคะแนนของตัวเองในปีงบนี้ · editor = แก้ได้ */
function scoreMeta(token, fy) {
  try {
    var user = requireUser_(token);
    if (!scoreAllowed_(user)) return { success: true, fy: resolveFiscalYear_(fy), has: false, editor: false, allowed: false, total: 0 };
    fy = resolveFiscalYear_(fy);
    var rows = scoreRead_(scoreSheetIfAny_(), fy);
    return { success: true, allowed: true, fy: fy, has: rows.some(function(r) { return r.owner === user.username; }), editor: scoreCanEdit_(user), total: scoreCanEdit_(user) ? rows.length : 0 };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function scoreRowView_(row, kpi, ownerUser) {
  var stale = "";
  if (!kpi) stale = "ตัวชี้วัดนี้ไม่มีในปีงบนี้แล้ว (อาจถูกลบ)";
  else if (ownerUser && !getKpiPermission_(ownerUser, kpi, row.fy).isOwner) stale = "ผู้นี้ไม่ได้เป็นผู้รับผิดชอบตัวชี้วัดนี้แล้ว";
  var c = scoreCompute_(kpi, row);
  return {
    id: row.id, owner: row.owner, name: kpi ? kpi.name : "(ไม่พบตัวชี้วัด " + row.id + ")", target: kpi ? kpi.target : "",
    summaryMethod: kpi ? kpi.summaryMethod : "", weight: row.weight, crit: row.crit, manual: [row.r1, row.r2], note: row.note,
    rounds: c.rounds, weighted: c.weighted, stale: stale, rev: row.rev, at: row.at, by: row.by
  };
}

/** รวมคะแนน: รอบ 1 / รอบ 2 / ทั้งปี (= เฉลี่ยของรอบที่มีคะแนนรวม) */
function scoreTotals_(rows) {
  var live = rows.filter(function(r) { return !r.stale; });
  var full = 0, perRound = [], scored = [0, 0], fullScored = [0, 0];
  live.forEach(function(r) { full += (r.weight || 0) * 5; });
  for (var i = 0; i < 2; i++) {
    var sum = 0;
    live.forEach(function(r) { if (r.weighted[i] !== null) { sum += r.weighted[i]; scored[i]++; fullScored[i] += (r.weight || 0) * 5; } });
    perRound.push(Math.round(sum * 100) / 100);
  }
  // ร้อยละเฉพาะแถวที่มีคะแนนแล้ว (ระหว่างรอบ ร้อยละปกติจะต่ำเพราะเต็มนับแถวที่ยังไม่มีผลด้วย)
  var pctOf = function(v, f) { return f > 0 ? Math.round(v / f * 10000) / 100 : null; };
  var pct = function(v) { return full > 0 ? Math.round(v / full * 10000) / 100 : null; };
  var yearAvail = [0, 1].filter(function(i) { return scored[i] > 0; });
  var yearSum = yearAvail.length ? Math.round(yearAvail.reduce(function(a, i) { return a + perRound[i]; }, 0) / yearAvail.length * 100) / 100 : null;
  return {
    full: Math.round(full * 100) / 100, count: live.length,
    rounds: [{ sum: perRound[0], pct: pct(perRound[0]), scored: scored[0], pctScored: pctOf(perRound[0], fullScored[0]) }, { sum: perRound[1], pct: pct(perRound[1]), scored: scored[1], pctScored: pctOf(perRound[1], fullScored[1]) }],
    year: { sum: yearSum, pct: yearSum === null ? null : pct(yearSum), rounds: yearAvail.length,
      pctScored: yearAvail.length ? Math.round(yearAvail.reduce(function(a, i) { return a + pctOf(perRound[i], fullScored[i]); }, 0) / yearAvail.length * 100) / 100 : null }
  };
}

/** กระดานคะแนนของ person (ว่าง = ตัวเอง) ในปีงบ fy */
function getScoreBoard(token, fy, person) {
  try {
    var user = requireUser_(token);
    if (!scoreAllowed_(user)) return { success: false, message: SCORE_DENIED };
    fy = resolveFiscalYear_(fy);
    var target = scoreTargetName_(user, person);
    var all = scoreRead_(scoreSheetIfAny_(), fy);
    var mine = all.filter(function(r) { return r.owner === target; });
    var wanted = {};
    mine.forEach(function(r) { wanted[r.id] = true; });
    var kmap = mine.length ? scoreKpiMap_(fy, wanted) : {};
    var ownerUser = mine.length ? scoreUserByName_(target) : null;
    var rows = mine.map(function(r) { return scoreRowView_(r, kmap[r.id], ownerUser); });
    var out = { success: true, fy: fy, person: target, canEdit: scoreCanEdit_(user), self: target === user.username, rows: rows, totals: scoreTotals_(rows) };
    if (scoreCanEdit_(user)) {
      var seen = {}, people = [];
      all.forEach(function(r) { if (!seen[r.owner]) { seen[r.owner] = true; people.push(r.owner); } });
      out.people = people.sort(function(a, b) { return a.localeCompare(b, "th"); });
    }
    out.dir = scoreDir_(user, fy, all);
    if (scoreCanEdit_(user)) { out.issues = scoreIssues_(fy, all); out.fillPending = hkFillPending_() && Number(fy) === HK_FILL_FY; }
    return out;
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * ผังแถบซ้าย: [{ unit, people: [{ person, count, kpis: [{ id, name }] }] }] — admin/ผอ./QMR = ทุกคนที่มีชุดคะแนนในปีงบ · หัวหน้า = ตัวเอง
 * หน่วย = หน่วยแรกของบัญชี (ไม่มี = "ไม่ระบุหน่วยงาน") · ไม่นับแถวที่ตัวชี้วัดถูกลบจากปีงบ
 */
function scoreDir_(user, fy, all) {
  var rows = scoreCanEdit_(user) ? all : all.filter(function(r) { return r.owner === user.username; });
  if (!rows.length) return [];
  var wanted = {};
  rows.forEach(function(r) { wanted[r.id] = true; });
  var kmap = scoreKpiMap_(fy, wanted);
  var us = getUsersSpreadsheet_().getSheetByName(USERS_SHEET_NAME);
  var unitOf = {};
  (us ? readUsers_(us) : []).forEach(function(u) { unitOf[u.username] = (u.depts && u.depts[0]) || ""; });
  var byPerson = {}, order = [];
  rows.forEach(function(r) {
    if (!kmap[r.id]) return;
    var p = byPerson[r.owner];
    if (!p) { p = byPerson[r.owner] = { person: r.owner, count: 0, kpis: [] }; order.push(p); }
    p.count++;
    p.kpis.push({ id: r.id, name: kmap[r.id].name });
  });
  var byUnit = {}, units = [];
  order.forEach(function(p) {
    var unit = renameUnit_(unitOf[p.person] || "") || "ไม่ระบุหน่วยงาน";
    if (!byUnit[unit]) { byUnit[unit] = { unit: unit, people: [] }; units.push(byUnit[unit]); }
    byUnit[unit].people.push(p);
  });
  units.forEach(function(u) { u.people.sort(function(a, b) { return a.person.localeCompare(b.person, "th"); }); });
  return units.sort(function(a, b) {
    if (a.unit === "ไม่ระบุหน่วยงาน") return 1;
    if (b.unit === "ไม่ระบุหน่วยงาน") return -1;
    return a.unit.localeCompare(b.unit, "th");
  });
}

/** แถวที่เกณฑ์คำนวณไม่ได้ (ทุกคน · admin/ผอ./QMR) → [{ person, id, name, reason }] — ไม่นับตัวชี้วัดที่ถูกลบ */
function scoreIssues_(fy, all) {
  if (!all.length) return [];
  var wanted = {};
  all.forEach(function(r) { wanted[r.id] = true; });
  var kmap = scoreKpiMap_(fy, wanted), out = [];
  all.forEach(function(r) {
    var k = kmap[r.id];
    if (!k) return; // ตัวชี้วัดถูกลบ = ไม่กระทบคะแนน
    if (!r.weight) {
      // ยังไม่ได้ใส่น้ำหนักและเกณฑ์ (เช่น นำเข้าจากไฟล์ที่ยังไม่ระบุ) = ขึ้นแยก ให้ไปเติมทีหลัง · น้ำหนัก 0 ที่มีเกณฑ์ = ตั้งใจไม่นับ
      if (!r.crit.some(function(c) { return c; })) out.push({ person: r.owner, id: r.id, name: k.name, kind: "empty", reason: "ยังไม่ได้ใส่น้ำหนัก/เกณฑ์" });
      return;
    }
    var chk = scoreCritCheck_(r.crit, k.target);
    if (!chk.ok) out.push({ person: r.owner, id: r.id, name: k.name, kind: "crit", reason: chk.reason });
  });
  return out.sort(function(a, b) { return (a.kind === b.kind ? 0 : a.kind === "crit" ? -1 : 1) || a.person.localeCompare(b.person, "th") || a.name.localeCompare(b.name, "th"); });
}

// ---------------------------------------------------------------- แก้ไข (admin / ผอ./QMR)

function scoreCleanInput_(p) {
  var weight = scoreNum_(p.weight);
  if (weight === null || weight < 0 || weight > SCORE_MAX_WEIGHT) return { error: "น้ำหนักต้องเป็นตัวเลข 0–" + SCORE_MAX_WEIGHT };
  var crit = [];
  for (var i = 0; i < 7; i++) {
    var c = scoreCell_(p.crit && p.crit[i]);
    if (c.length > SCORE_MAX_CRIT) return { error: "เกณฑ์คะแนน " + SCORE_LEVELS[i].toFixed(1) + " ยาวเกิน " + SCORE_MAX_CRIT + " ตัวอักษร" };
    crit.push(c);
  }
  var manual = [];
  for (var k = 0; k < 2; k++) {
    var raw = p["r" + (k + 1)];
    if (raw === undefined || raw === null || String(raw).trim() === "") { manual.push(""); continue; }
    var m = scoreManual_(raw);
    if (m === null) return { error: "คะแนนรอบ " + (k + 1) + " ต้องเป็น 0–5 ขั้นละ 0.5 (หรือเว้นว่าง)" };
    manual.push(m);
  }
  var note = scoreCell_(p.note);
  if (note.length > SCORE_MAX_NOTE) return { error: "หมายเหตุยาวเกิน " + SCORE_MAX_NOTE + " ตัวอักษร" };
  return { weight: weight, crit: crit, manual: manual, note: note };
}

/**
 * เพิ่ม/แก้แถวคะแนน — p = { id, owner, weight, crit[7], r1, r2, note, isNew, baseRev, force }
 * เพิ่มใหม่: ตัวชี้วัดต้องมีในปีงบ และ owner ต้องเป็นผู้รับผิดชอบ · แก้: ตรวจ baseRev
 */
function saveKpiScore(token, fy, p) {
  var lock = null;
  try {
    var user = requireUser_(token);
    if (!scoreCanEdit_(user)) return { success: false, message: "แก้คะแนนได้เฉพาะ admin และ ผอ./QMR" };
    p = p || {};
    var id = (p.id || "").toString().trim(), owner = (p.owner || "").toString().trim();
    if (!id || !owner) return { success: false, message: "ไม่ระบุตัวชี้วัดหรือผู้รับผิดชอบ" };
    var clean = scoreCleanInput_(p);
    if (clean.error) return { success: false, message: clean.error };
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var sheet = scoreSheetIfAny_();
    var cur = scoreRead_(sheet, fy).filter(function(r) { return r.id === id && r.owner === owner; })[0] || null;
    var stamp = nowStamp_();
    if (cur) {
      if (p.isNew) return { success: false, message: "ตัวชี้วัดนี้อยู่ในชุดคะแนนของผู้นี้แล้ว" };
      if (!p.force && p.baseRev !== undefined && p.baseRev !== null && p.baseRev !== cur.rev) {
        return { success: false, conflict: true, message: "แถวนี้ถูกแก้ไขโดย " + (cur.by || "ผู้ใช้อื่น") + (cur.at ? " เมื่อ " + cur.at : "") + " ระหว่างที่คุณกำลังแก้ไข กรุณาโหลดใหม่" };
      }
      var vals = [clean.weight].concat(clean.crit, clean.manual, [clean.note]);
      sheet.getRange(cur.row, 5, 1, 7).setNumberFormat("@");
      sheet.getRange(cur.row, 14, 1, 1).setNumberFormat("@");
      var same = scoreRev_([fy, id, owner].concat(vals)) === cur.rev;
      if (same) return { success: true, changed: false };
      sheet.getRange(cur.row, 4, 1, 13).setValues([vals]);
      sheet.getRange(cur.row, 15, 1, 2).setValues([[stamp, user.username]]);
    } else {
      if (!p.isNew) return { success: false, message: "ไม่พบแถวนี้ (อาจถูกลบไปแล้ว)" };
      var kmap = scoreKpiMap_(fy, (function() { var o = {}; o[id] = true; return o; })());
      var kpi = kmap[id];
      if (!kpi) return { success: false, message: "ไม่พบตัวชี้วัดนี้ในปีงบ " + fy };
      var ou = scoreUserByName_(owner);
      if (!ou) return { success: false, message: "ไม่พบบัญชีผู้ใช้ \"" + owner + "\"" };
      if (!getKpiPermission_(ou, kpi, fy).isOwner) return { success: false, message: owner + " ไม่ได้เป็นผู้รับผิดชอบตัวชี้วัดนี้ในปีงบ " + fy };
      sheet = scoreSheetEnsure_();
      var row = sheet.getLastRow() + 1;
      sheet.getRange(row, 1, 1, SCORE_HEADERS.length).setNumberFormat("@");
      sheet.getRange(row, 1, 1, SCORE_HEADERS.length).setValues([[String(fy), id, owner, clean.weight].concat(clean.crit, clean.manual, [clean.note, stamp, user.username])]);
    }
    touchUser_(user, "edit");
    bumpDataVersion_(fy, [], user, SCORE_DOC);
    return { success: true, changed: true };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** เอาตัวชี้วัดออกจากชุดคะแนนของผู้นี้ (ลบแถวคะแนน — ไม่ลบตัวชี้วัด) */
function deleteKpiScore(token, fy, p) {
  var lock = null;
  try {
    var user = requireUser_(token);
    if (!scoreCanEdit_(user)) return { success: false, message: "แก้คะแนนได้เฉพาะ admin และ ผอ./QMR" };
    p = p || {};
    var id = (p.id || "").toString().trim(), owner = (p.owner || "").toString().trim();
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var sheet = scoreSheetIfAny_();
    var cur = scoreRead_(sheet, fy).filter(function(r) { return r.id === id && r.owner === owner; })[0] || null;
    if (!cur) return { success: false, message: "ไม่พบแถวนี้ (อาจถูกลบไปแล้ว)" };
    sheet.deleteRow(cur.row);
    touchUser_(user, "edit");
    bumpDataVersion_(fy, [], user, SCORE_DOC);
    return { success: true };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** ตัวชี้วัดของผู้นี้ในปีงบ fy ที่ยังไม่อยู่ในชุดคะแนน (ให้เลือกเพิ่ม) — admin/ผอ./QMR */
function getScoreCandidates(token, fy, person) {
  try {
    var user = requireUser_(token);
    if (!scoreCanEdit_(user)) return { success: false, message: "เฉพาะ admin และ ผอ./QMR" };
    fy = resolveFiscalYear_(fy);
    var owner = (person || "").toString().trim();
    var ou = scoreUserByName_(owner);
    if (!ou) return { success: false, message: "ไม่พบบัญชีผู้ใช้ \"" + owner + "\"" };
    var have = {};
    scoreRead_(scoreSheetIfAny_(), fy).forEach(function(r) { if (r.owner === owner) have[r.id] = true; });
    var sheet = getFiscalSheet_(fy), out = [];
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        if (!data[r][0]) continue;
        var kpi = rowToKpi_(data[r]);
        if (have[kpi.id]) continue;
        if (getKpiPermission_(ou, kpi, fy).isOwner) out.push({ id: kpi.id, name: kpi.name, target: kpi.target });
      }
    }
    return { success: true, fy: fy, person: owner, candidates: out };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// ---------------------------------------------------------------- ขึ้นปีงบใหม่ / เปลี่ยนชื่อผู้ใช้

/** ปีงบใหม่ fy: ลอกน้ำหนัก + เกณฑ์ (ไม่ลอกคะแนนกรอกเอง) จากปีก่อนหน้า เฉพาะตัวชี้วัดที่มีในปีใหม่และยังไม่มีแถว — เรียกภายใต้ script lock · คืนจำนวนแถวที่เพิ่ม */
function scoreCarryOver_(fy) {
  var sheet = scoreSheetIfAny_();
  if (!sheet) return 0;
  var all = scoreRead_(sheet, fy - 1);
  if (!all.length) return 0;
  var haveNew = {};
  scoreRead_(sheet, fy).forEach(function(r) { haveNew[r.id + "\u0001" + r.owner] = true; });
  var wanted = {};
  all.forEach(function(r) { wanted[r.id] = true; });
  var kmap = scoreKpiMap_(fy, wanted), rows = [], stamp = nowStamp_();
  all.forEach(function(r) {
    if (!kmap[r.id] || haveNew[r.id + "\u0001" + r.owner]) return;
    rows.push([String(fy), r.id, r.owner, r.weight === null ? "" : r.weight].concat(r.crit, ["", "", r.note, stamp, "ระบบ (ลอกจากปีงบ " + (fy - 1) + ")"]));
  });
  if (!rows.length) return 0;
  var start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, rows.length, SCORE_HEADERS.length).setNumberFormat("@");
  sheet.getRange(start, 1, rows.length, SCORE_HEADERS.length).setValues(rows);
  return rows.length;
}
