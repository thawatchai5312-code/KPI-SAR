/**
 * 🔁 ตรวจ/รวมตัวชี้วัดซ้ำ (admin) + เตือนชื่อคล้ายตอนเพิ่มตัวชี้วัด — docs/dup-kpi-plan.md
 *  - dupScan: หาคู่ที่น่าจะซ้ำในปีงบเดียว (ชื่อเหมือน / คล้าย / อยู่ในกัน) จัดเป็นกลุ่ม — อ่านอย่างเดียว ระบบไม่รวมเอง admin ตัดสินทุกกลุ่ม
 *  - dupPreview / dupCommit: รวมตัวที่เลือกเข้าตัวที่เก็บ ในปีที่เลือก + ปีที่ใหม่กว่า (ปีที่เก่ากว่าคงเดิม) ใต้ script lock + สำรองชีต (ซ่อน) + Tidy_Log
 *    แถว = tidyMergeRows_ (ช่องว่างเติมจากตัวที่รวม · ระดับ/ผู้รับผิดชอบ/หน่วยงาน/หมวดรวมกัน) · ข้อมูลที่ผูกด้วยรหัส (เอกสารแนบ · PDCA/CLT · ชุดคะแนน · ต้นทาง NSO) ย้ายตามตัวที่เก็บ
 *  - findSimilarKpis: ฟอร์มเพิ่มตัวชี้วัด (ทุกคน) — เตือนอย่างเดียว ไม่บล็อก
 */

var DUP_IGNORE_KEY = "DUP_IGNORE_V1";
var DUP_SIMILAR = 0.8;
var DUP_CONTAIN_MIN = 10;
var DUP_MAX_GROUPS = 400;
var DUP_MAX_MEMBERS = 8;
var DUP_BACKUP_PREFIX = "สำรองรวมซ้ำ ";

function dupNameKey_(v) { return pimpKey_((v === null || v === undefined ? "" : v).toString().split("\n")[0]); }

/** ความคล้ายของชื่อที่ผ่าน dupNameKey_ แล้ว → { kind: "same" | "similar" | "contain", score } หรือ null */
function dupRelate_(a, b) {
  if (!a || !b) return null;
  if (a === b) return { kind: "same", score: 1 };
  var la = a.length, lb = b.length, mn = Math.min(la, lb), mx = Math.max(la, lb);
  if (mn >= 3 && 2 * (mn - 1) / (la + lb - 2) >= DUP_SIMILAR) {
    var d = hkDice_(a, b);
    if (d >= DUP_SIMILAR) return { kind: "similar", score: Math.round(d * 100) / 100 };
  }
  if (mn >= DUP_CONTAIN_MIN && (la < lb ? b.indexOf(a) : a.indexOf(b)) !== -1) return { kind: "contain", score: Math.round(mn / mx * 100) / 100 };
  return null;
}

function dupIgnoreRead_() {
  var set = {};
  try { JSON.parse(PropertiesService.getScriptProperties().getProperty(DUP_IGNORE_KEY) || "[]").forEach(function(k) { set[k] = true; }); } catch (e) {}
  return set;
}
function dupPairKey_(a, b) { return a < b ? a + "|" + b : b + "|" + a; }

function dupRowItem_(r, i) {
  return {
    i: i, id: (r[0] || "").toString().trim(), name: (r[4] || "").toString().split("\n")[0].trim(), key: dupNameKey_(r[4]),
    parent: (r[PARENT_COL - 1] || "").toString().trim(), depts: parseDepts_(r[26]), owner: (r[25] || "").toString().trim(), row: r
  };
}

/** กลุ่มที่น่าจะซ้ำ (ฟังก์ชันล้วน) — rows = แถวข้อมูล (ไม่รวมหัวตาราง) · ignore = { "idA|idB": true } → [{ ids: [รหัส], kind, crossUnit, score }] */
function dupFindGroups_(rows, ignore) {
  var items = [], k, j;
  rows.forEach(function(r, i) { var it = dupRowItem_(r, i); if (it.id && it.key) items.push(it); });
  var parent = {}, rel = {};
  var find = function(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  items.forEach(function(it) { parent[it.id] = it.id; });
  var pairs = [];
  for (k = 0; k < items.length; k++) {
    for (j = k + 1; j < items.length; j++) {
      var a = items[k], b = items[j];
      if (a.parent === b.id || b.parent === a.id) continue;
      if (ignore[dupPairKey_(a.id, b.id)]) continue;
      var r = dupRelate_(a.key, b.key);
      if (!r) continue;
      pairs.push([a.id, b.id, r]);
      parent[find(a.id)] = find(b.id);
    }
  }
  var byRoot = {}, byId = {};
  items.forEach(function(it) { byId[it.id] = it; });
  pairs.forEach(function(p) {
    var root = find(p[0]);
    var g = byRoot[root] || (byRoot[root] = { ids: {}, kinds: {}, score: 1 });
    g.ids[p[0]] = true; g.ids[p[1]] = true;
    g.kinds[p[2].kind] = true;
    if (p[2].score < g.score) g.score = p[2].score;
  });
  var out = Object.keys(byRoot).map(function(root) {
    var g = byRoot[root], ids = Object.keys(g.ids).sort(function(x, y) { return byId[x].i - byId[y].i; });
    var keys = {};
    ids.forEach(function(id) { keys[byId[id].key] = true; });
    var sameName = Object.keys(keys).length === 1;
    var cross = false;
    for (k = 0; k < ids.length && !cross; k++) {
      for (j = k + 1; j < ids.length && !cross; j++) {
        var da = byId[ids[k]].depts, db = byId[ids[j]].depts;
        if (da.length && db.length && !da.some(function(x) { return db.indexOf(x) !== -1; })) cross = true;
      }
    }
    return { ids: ids, kind: sameName ? "same" : "similar", crossUnit: cross, score: sameName ? 1 : g.score, firstIndex: byId[ids[0]].i };
  });
  out.sort(function(a, b) {
    if (a.crossUnit !== b.crossUnit) return a.crossUnit ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === "same" ? -1 : 1;
    return b.score - a.score || a.firstIndex - b.firstIndex;
  });
  return out;
}

/** ตัวชี้วัดที่ชื่อคล้ายกับ key ในแถวทั้งหมด (ฟังก์ชันล้วน) → [{ i, id, name, kind, score }] เรียงใกล้สุดก่อน */
function dupSimilarTo_(rows, key, limit) {
  var out = [];
  if (!key || key.length < 4) return out;
  rows.forEach(function(r, i) {
    var id = (r[0] || "").toString().trim();
    if (!id) return;
    var rel = dupRelate_(key, dupNameKey_(r[4]));
    if (rel) out.push({ i: i, id: id, name: (r[4] || "").toString().split("\n")[0].trim(), kind: rel.kind, score: rel.score });
  });
  var rank = { same: 0, similar: 1, contain: 2 };
  out.sort(function(a, b) { return rank[a.kind] - rank[b.kind] || b.score - a.score || a.i - b.i; });
  return out.slice(0, limit || 8);
}

// ---------------------------------------------------------------- สแกน

function dupDocCounts_(fy) {
  var res = { links: {}, score: {}, pdca: {}, clt: {} };
  var ls = kpiLinkSheetIfAny_();
  if (ls) kpiLinkRead_(ls, fy).forEach(function(l) { l.ids.forEach(function(id) { res.links[id] = (res.links[id] || 0) + 1; }); });
  scoreRead_(scoreSheetIfAny_(), fy).forEach(function(s) { res.score[s.id] = (res.score[s.id] || 0) + 1; });
  var ds = sarDocSheetIfAny_();
  if (ds) {
    var sar = sarDocRead_(ds, fy, SARDOC_SAR), clt = sarDocRead_(ds, fy, SARDOC_CLT);
    Object.keys(sar).forEach(function(k) { if (k.indexOf(SARDOC_PDCA_PREFIX) === 0 && sar[k].text) res.pdca[k.slice(SARDOC_PDCA_PREFIX.length)] = 1; });
    Object.keys(clt).forEach(function(k) {
      var m = /^D\|.*\|R\|(.+)$/.exec(k) || /^DIM\|(.+)$/.exec(k);
      if (m && clt[k].text) res.clt[m[1]] = (res.clt[m[1]] || 0) + 1;
    });
  }
  return res;
}

function dupFilled_(r, from, to) {
  var n = 0;
  for (var c = from; c <= to; c++) if (!tidyBlank_(r[c]) && String(r[c]).trim() !== "") n++;
  return n;
}

function dupMemberView_(it, docs) {
  var r = it.row;
  var cats = kpiCats_({ cats: [{ part: (r[2] || "").toString().trim(), category: (r[3] || "").toString().trim() }].concat(parseExtraCats_(r[EXTRA_CATS_COL - 1])) });
  var m = {
    id: it.id, name: it.name, depts: it.depts, owner: it.owner, levels: normalizeLevels_(r[LEVEL_COLUMN - 1]), cat: cats.length ? (cats[0].part + " › " + cats[0].category) : "",
    target: (r[5] === null || r[5] === undefined ? "" : r[5]).toString(), years: dupFilled_(r, 6, 10), months: dupFilled_(r, 11, 22),
    hasDetails: !tidyBlank_(r[23]) && String(r[23]).trim() !== "", links: docs.links[it.id] || 0, score: docs.score[it.id] || 0, pdca: docs.pdca[it.id] ? 1 : 0, clt: docs.clt[it.id] || 0,
    editedAt: formatStamp_(r[STAMP_EDIT_AT_COL - 1]), editedBy: (r[STAMP_EDIT_BY_COL - 1] || "").toString(), parent: it.parent
  };
  m.points = m.years * 2 + m.months + (m.hasDetails ? 5 : 0) + m.links * 2 + m.score * 3 + m.pdca * 3 + m.clt * 2;
  return m;
}

function dupScan(token, fy) {
  try {
    requireAdmin_(token);
    fy = resolveFiscalYear_(fy);
    var d = tidyReadFy_(fy);
    if (!d) return { success: false, message: "ไม่พบชีตปีงบ " + fy };
    var ignore = dupIgnoreRead_(), groups = dupFindGroups_(d.rows, ignore);
    var docs = dupDocCounts_(fy), byId = {};
    d.rows.forEach(function(r, i) { var it = dupRowItem_(r, i); if (it.id) byId[it.id] = it; });
    var total = groups.length, cut = groups.length > DUP_MAX_GROUPS;
    var out = groups.slice(0, DUP_MAX_GROUPS).map(function(g, gi) {
      var members = g.ids.slice(0, DUP_MAX_MEMBERS).map(function(id) { return dupMemberView_(byId[id], docs); });
      var best = members.slice().sort(function(a, b) { return b.points - a.points; })[0];
      return { n: gi, kind: g.kind, crossUnit: g.crossUnit, score: g.score, members: members, more: g.ids.length - members.length, suggestKeep: best ? best.id : "" };
    });
    return { success: true, fy: fy, groups: out, total: total, truncated: cut, ignored: Object.keys(ignore).length };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  }
}

/** "ไม่ใช่ตัวซ้ำ" — จำทุกคู่ในกลุ่มไว้ ไม่เสนออีก */
function dupIgnore(token, ids) {
  var lock = null;
  try {
    requireAdmin_(token);
    ids = (ids || []).map(function(x) { return String(x || "").trim(); }).filter(function(x) { return x; });
    if (ids.length < 2 || ids.length > 30) return { success: false, message: "ไม่ระบุตัวชี้วัด" };
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var set = dupIgnoreRead_();
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) set[dupPairKey_(ids[i], ids[j])] = true;
    PropertiesService.getScriptProperties().setProperty(DUP_IGNORE_KEY, JSON.stringify(Object.keys(set)));
    return { success: true };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** เตือนชื่อคล้ายตอนเพิ่มตัวชี้วัด (ทุกคนที่ล็อกอิน) — เทียบกับทุกตัวในปีงบ แสดงเฉพาะ ชื่อ/หน่วยงาน/ผู้รับผิดชอบ · canView = ผู้ใช้เปิดดูตัวนั้นได้ */
function findSimilarKpis(token, fy, name) {
  try {
    var user = requireUser_(token);
    fy = resolveFiscalYear_(fy);
    var d = tidyReadFy_(fy);
    if (!d) return { success: true, list: [] };
    var hits = dupSimilarTo_(d.rows, dupNameKey_(name), 8);
    var list = hits.map(function(h) {
      var r = d.rows[h.i], canView = false;
      try { canView = !!getKpiPermission_(user, rowToKpi_(r), fy).view; } catch (e) { canView = false; }
      return { id: h.id, name: h.name, dept: (r[26] || "").toString().trim(), owner: (r[25] || "").toString().trim(), kind: h.kind, score: h.score, canView: canView };
    });
    return { success: true, list: list };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  }
}

// ---------------------------------------------------------------- รวม

var DUP_CONFLICT_COLS = (function() {
  var cols = [[5, "เป้าหมาย"]], i;
  for (i = 0; i < 5; i++) cols.push([6 + i, "ผลทั้งปี (ช่องที่ " + (i + 1) + ")"]);
  for (i = 0; i < 12; i++) cols.push([11 + i, "ผลรายเดือน (เดือนที่ " + (i + 1) + ")"]);
  cols.push([23, "รายละเอียด / การวิเคราะห์"], [24, "ที่มา / สูตร"]);
  return cols;
})();

/** ช่องที่ทั้งสองแถวมีค่าไม่ตรงกัน (ใช้ค่าของตัวที่เก็บ) */
function dupConflicts_(keepRow, dropRow) {
  var out = [];
  DUP_CONFLICT_COLS.forEach(function(c) {
    var a = keepRow[c[0]], b = dropRow[c[0]];
    if (tidyBlank_(a) || tidyBlank_(b) || String(a).trim() === "" || String(b).trim() === "") return;
    if (String(a).trim() !== String(b).trim()) out.push({ field: c[1], keep: String(a).slice(0, 60), drop: String(b).slice(0, 60) });
  });
  return out;
}

/** แผนรวมในชีตปีงบหนึ่ง (ฟังก์ชันล้วน): rows = แถวข้อมูลเดิม · groups = [{ keep, drops[] }] → { rows, changed{index}, deletes[index], remap{dropId→keepId}, conflicts[], merged[], renamed[] } */
function dupApplyRows_(rows, groups, stamp, by) {
  var out = rows.map(function(r) { return r.slice(); }), idx = {}, changed = {}, deletes = [], remap = {}, conflicts = [], merged = [], renamed = [];
  out.forEach(function(r, i) { var id = (r[0] || "").toString().trim(); if (id) idx[id] = i; });
  groups.forEach(function(g) {
    g.drops.forEach(function(did) {
      var k = idx[g.keep], d = idx[did];
      if (d === undefined || did === g.keep) return;
      if (k !== undefined) {
        dupConflicts_(out[k], out[d]).forEach(function(c) { c.keepId = g.keep; c.dropId = did; conflicts.push(c); });
        out[k] = tidyMergeRows_(out[k], out[d]);
        if (stamp) { out[k][STAMP_EDIT_AT_COL - 1] = stamp; out[k][STAMP_EDIT_BY_COL - 1] = by; }
        changed[k] = true; deletes.push(d); merged.push({ keep: g.keep, drop: did, dropRow: rows[d] });
        delete idx[did];
      } else {
        out[d][0] = g.keep; idx[g.keep] = d; delete idx[did]; changed[d] = true; renamed.push({ keep: g.keep, drop: did });
      }
      remap[did] = g.keep;
    });
  });
  var gone = {};
  deletes.forEach(function(i) { gone[i] = true; });
  out.forEach(function(r, i) {
    if (gone[i]) return;
    var p = (r[PARENT_COL - 1] || "").toString().trim(), id = (r[0] || "").toString().trim();
    if (p && remap[p]) { r[PARENT_COL - 1] = remap[p] === id ? "" : remap[p]; changed[i] = true; }
  });
  return { rows: out, changed: changed, deletes: deletes, remap: remap, conflicts: conflicts, merged: merged, renamed: renamed };
}

function dupCheckGroups_(groups) {
  if (!Array.isArray(groups) || groups.length === 0) throw new Error("ไม่ได้เลือกตัวชี้วัดที่จะรวม");
  var seen = {}, out = [];
  groups.forEach(function(g) {
    var keep = String(g && g.keep || "").trim(), drops = [];
    (g && g.drops || []).forEach(function(x) { x = String(x || "").trim(); if (x && x !== keep && drops.indexOf(x) === -1) drops.push(x); });
    if (!keep || drops.length === 0) throw new Error("แต่ละกลุ่มต้องมีตัวที่เก็บและตัวที่จะรวมเข้าอย่างน้อย 1 ตัว");
    [keep].concat(drops).forEach(function(id) { if (seen[id]) throw new Error("ตัวชี้วัด " + id + " อยู่ซ้ำหลายกลุ่ม"); seen[id] = true; });
    out.push({ keep: keep, drops: drops });
  });
  return out;
}

/** แผนทั้งหมด (อ่านอย่างเดียว) — ใช้ทั้งดูตัวอย่างและตอนรวมจริง */
function dupPlan_(fy, groups, stamp, by) {
  groups = dupCheckGroups_(groups);
  var fys = listFiscalYears_().map(Number).filter(function(y) { return y >= fy; }).sort(function(a, b) { return a - b; });
  var plan = { fy: fy, groups: groups, fys: [], remap: {}, links: [], score: { moves: [], deletes: [] }, docs: [], stat: {} };
  var stat = function(id) { return plan.stat[id] || (plan.stat[id] = { fys: [], renamed: [], conflicts: [], links: 0, scoreMoved: 0, scoreDropped: 0, docsMoved: 0, docsKept: 0 }); };
  fys.forEach(function(y) {
    var d = tidyReadFy_(y);
    if (!d) return;
    var res = dupApplyRows_(d.rows, groups, stamp, by);
    if (y === fy) {
      groups.forEach(function(g) {
        var ids = {};
        d.rows.forEach(function(r) { ids[(r[0] || "").toString().trim()] = true; });
        [g.keep].concat(g.drops).forEach(function(id) { if (!ids[id]) throw new Error("ไม่พบตัวชี้วัด " + id + " ในปีงบ " + fy + " (ข้อมูลอาจเปลี่ยนไป — สแกนใหม่)"); });
      });
    }
    res.merged.forEach(function(m) { stat(m.drop).fys.push(y); });
    res.renamed.forEach(function(m) { stat(m.drop).renamed.push(y); });
    res.conflicts.forEach(function(c) { if (y === fy) stat(c.dropId).conflicts.push({ field: c.field, keep: c.keep, drop: c.drop }); });
    Object.keys(res.remap).forEach(function(k) { plan.remap[k] = res.remap[k]; });
    if (res.merged.length || res.renamed.length || Object.keys(res.changed).length) plan.fys.push({ fy: y, sheet: d.sheet, raw: d.rows, res: res });
  });
  var remap = plan.remap;
  // เอกสารแนบ: รหัสตัวชี้วัดในลิงก์ (ปีที่เลือกและใหม่กว่า)
  var ls = kpiLinkSheetIfAny_();
  if (ls && ls.getLastRow() >= 2) {
    var ld = ls.getDataRange().getValues();
    for (var i = 1; i < ld.length; i++) {
      var ly = Number(ld[i][0]);
      if (!(ly >= fy)) continue;
      var ids = kpiLinkSplitIds_(ld[i][4]), next = [], seen = {}, hit = [];
      ids.forEach(function(id) {
        var to = remap[id] || id;
        if (remap[id]) hit.push(id);
        if (!seen[to]) { seen[to] = true; next.push(to); }
      });
      if (hit.length) { plan.links.push({ row: i + 1, ids: next.join(", "), rev: (Number(ld[i][6]) || 0) + 1 }); hit.forEach(function(id) { stat(id).links++; }); }
    }
  }
  // ชุดคะแนน
  var ss = scoreSheetIfAny_();
  if (ss && ss.getLastRow() >= 2) {
    var sd = ss.getDataRange().getValues(), have = {};
    for (var s = 1; s < sd.length; s++) have[String(sd[s][0]).trim() + "|" + (sd[s][1] || "").toString().trim() + "|" + (sd[s][2] || "").toString().trim()] = true;
    for (s = 1; s < sd.length; s++) {
      var sy = Number(sd[s][0]), sid = (sd[s][1] || "").toString().trim(), sowner = (sd[s][2] || "").toString().trim();
      if (!(sy >= fy) || !remap[sid]) continue;
      var kk = String(sd[s][0]).trim() + "|" + remap[sid] + "|" + sowner;
      if (have[kk]) { plan.score.deletes.push(s + 1); stat(sid).scoreDropped++; }
      else { have[kk] = true; plan.score.moves.push({ row: s + 1, id: remap[sid] }); stat(sid).scoreMoved++; }
    }
  }
  // เอกสาร สรพ.: PDCA / CLT
  var ds = sarDocSheetIfAny_();
  if (ds) {
    fys.forEach(function(y) {
      [[SARDOC_SAR, ["PDCA|"]], [SARDOC_CLT, ["D|", "DIM|", "S|kpis"]]].forEach(function(dc) {
        var cur = sarDocRead_(ds, y, dc[0]);
        Object.keys(cur).forEach(function(key) {
          var item = cur[key], to = null, from = null, m;
          if (dc[0] === SARDOC_SAR) { m = /^PDCA\|(.+)$/.exec(key); if (m && remap[m[1]]) { from = m[1]; to = "PDCA|" + remap[m[1]]; } }
          else if ((m = /^(D\|.*\|R\|)(.+)$/.exec(key)) && remap[m[2]]) { from = m[2]; to = m[1] + remap[m[2]]; }
          else if ((m = /^(DIM\|)(.+)$/.exec(key)) && remap[m[2]]) { from = m[2]; to = m[1] + remap[m[2]]; }
          if (to) {
            if (!item.text) return;
            var dst = cur[to];
            if (dst && dst.text) { plan.docs.push({ fy: y, doc: dc[0], key: key, to: to, conflict: true }); stat(from).docsKept++; }
            else { plan.docs.push({ fy: y, doc: dc[0], key: key, to: to, text: item.text }); stat(from).docsMoved++; }
          } else if (dc[0] === SARDOC_CLT && key === "S|kpis" && item.text) {
            var arr = null;
            try { arr = JSON.parse(item.text); } catch (e) { arr = null; }
            if (!Array.isArray(arr)) return;
            var changedArr = false, sn = {}, nx = [];
            arr.forEach(function(x) {
              var p = String(x).split("|"), idp = p.slice(1).join("|");
              if (p.length >= 2 && remap[idp]) { x = p[0] + "|" + remap[idp]; changedArr = true; }
              if (!sn[x]) { sn[x] = true; nx.push(x); }
            });
            if (changedArr) plan.docs.push({ fy: y, doc: dc[0], key: key, to: key, text: JSON.stringify(nx.sort()), inPlace: true });
          }
        });
      });
    });
  }
  return plan;
}

function dupPublic_(plan) {
  return {
    fy: plan.fy, fys: plan.fys.map(function(f) { return f.fy; }),
    groups: plan.groups.map(function(g) {
      return { keep: g.keep, drops: g.drops.map(function(d) {
        var st = plan.stat[d] || {};
        return { id: d, fys: st.fys || [], renamed: st.renamed || [], conflicts: st.conflicts || [], links: st.links || 0, scoreMoved: st.scoreMoved || 0, scoreDropped: st.scoreDropped || 0, docsMoved: st.docsMoved || 0, docsKept: st.docsKept || 0 };
      }) };
    }),
    totals: { links: plan.links.length, scoreMoved: plan.score.moves.length, scoreDropped: plan.score.deletes.length, docs: plan.docs.filter(function(x) { return !x.conflict; }).length, docsKept: plan.docs.filter(function(x) { return x.conflict; }).length }
  };
}

function dupPreview(token, fy, groups) {
  try {
    requireAdmin_(token);
    fy = resolveFiscalYear_(fy);
    return { success: true, preview: dupPublic_(dupPlan_(fy, groups, "", "")) };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  }
}

function dupWriteCells_(sheet, rowNum, before, after) {
  for (var c = 0; c < after.length; c++) {
    var a = after[c], b = before[c];
    if (String(a === undefined || a === null ? "" : a) === String(b === undefined || b === null ? "" : b) && typeof a === typeof b) continue;
    var cell = sheet.getRange(rowNum, c + 1);
    if (typeof a === "string") cell.setNumberFormat("@");
    cell.setValue(a === undefined || a === null ? "" : a);
  }
}

function dupCommit(token, fy, groups) {
  var lock = null;
  try {
    var admin = requireAdmin_(token);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    fy = resolveFiscalYear_(fy);
    var stamp = nowStamp_(), by = "รวมตัวซ้ำ (" + admin.username + ")";
    var plan = dupPlan_(fy, groups, stamp, by);
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL), fileStamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
    var backup = function(sheet, prefix) {
      if (!sheet) return;
      var b = sheet.copyTo(ss);
      b.setName(prefix + fileStamp);
      b.hideSheet();
      renameBackupSheets_(ss, prefix, 3);
    };
    plan.fys.forEach(function(f) { backup(f.sheet, DUP_BACKUP_PREFIX + fiscalSheetName_(f.fy) + " "); });
    if (plan.links.length) backup(kpiLinkSheetIfAny_(), DUP_BACKUP_PREFIX + KPILINK_SHEET + " ");
    if (plan.score.moves.length || plan.score.deletes.length) backup(scoreSheetIfAny_(), DUP_BACKUP_PREFIX + SCORE_SHEET + " ");
    if (plan.docs.length) backup(sarDocSheetIfAny_(), DUP_BACKUP_PREFIX + SARDOC_SHEET + " ");

    var logRows = [], nMerged = 0, nRenamed = 0;
    plan.fys.forEach(function(f) {
      var r = f.res;
      Object.keys(r.changed).forEach(function(k) {
        var i = Number(k);
        if (r.deletes.indexOf(i) !== -1) return;
        dupWriteCells_(f.sheet, i + 2, f.raw[i], r.rows[i]);
      });
      r.deletes.slice().sort(function(a, b) { return b - a; }).forEach(function(i) { f.sheet.deleteRow(i + 2); });
      r.merged.forEach(function(m) { nMerged++; logRows.push([stamp, f.fy, m.drop, "dup-merge-drop", JSON.stringify(m.dropRow).slice(0, 49000), "รวมเข้า " + m.keep]); });
      r.renamed.forEach(function(m) { nRenamed++; logRows.push([stamp, f.fy, m.drop, "dup-rename", m.drop, m.keep]); });
    });
    if (plan.links.length) {
      var ls = kpiLinkSheetIfAny_();
      plan.links.forEach(function(l) {
        ls.getRange(l.row, 5).setNumberFormat("@").setValue(l.ids);
        ls.getRange(l.row, 7).setValue(l.rev);
      });
    }
    if (plan.score.moves.length || plan.score.deletes.length) {
      var sc = scoreSheetIfAny_();
      plan.score.moves.forEach(function(m) { sc.getRange(m.row, 2).setNumberFormat("@").setValue(m.id); });
      plan.score.deletes.slice().sort(function(a, b) { return b - a; }).forEach(function(n) { sc.deleteRow(n); });
    }
    plan.docs.forEach(function(d) {
      if (d.conflict) return;
      sarDocWrite_(admin, d.fy, d.doc, d.to, d.text, null, true);
      if (!d.inPlace) sarDocWrite_(admin, d.fy, d.doc, d.key, "", null, true);
    });
    // ต้นทาง NSO ที่ผูกกับตัวที่รวม → ผูกกับตัวที่เก็บ (ตัว NURSE ที่ลบ ปล่อยเป็น "ลบแล้ว")
    var syncSheet = ss.getSheetByName(NSO_SYNC_SHEET);
    if (syncSheet && syncSheet.getLastRow() >= 2) {
      var ids = syncSheet.getRange(2, 2, syncSheet.getLastRow() - 1, 1).getValues(), taken = {}, moved = 0;
      ids.forEach(function(r) { taken[(r[0] || "").toString()] = 1; });
      var newIds = ids.map(function(r) {
        var id = (r[0] || "").toString();
        if (plan.remap[id] && id.indexOf("NURSE-") !== 0 && !taken[plan.remap[id]]) { taken[plan.remap[id]] = 1; moved++; return [plan.remap[id]]; }
        return [id];
      });
      if (moved > 0) syncSheet.getRange(2, 2, newIds.length, 1).setValues(newIds);
    }
    logRows.unshift([stamp, fy, "", "dup-merge", "", "รวม " + nMerged + " แถว · เปลี่ยนรหัส " + nRenamed + " · ลิงก์ " + plan.links.length + " · คะแนนย้าย " + plan.score.moves.length + "/ลบ " + plan.score.deletes.length + " · เอกสาร " + plan.docs.filter(function(x) { return !x.conflict; }).length]);
    var log = ss.getSheetByName(TIDY_LOG_SHEET);
    if (!log) {
      log = ss.insertSheet(TIDY_LOG_SHEET);
      log.getRange(1, 1, 1, 6).setValues([["เวลา", "ปีงบ", "รหัส", "ฟิลด์", "ค่าเดิม", "ค่าใหม่"]]).setFontWeight("bold");
      log.hideSheet();
    }
    log.getRange(log.getLastRow() + 1, 1, logRows.length, 6).setNumberFormat("@").setValues(logRows);
    touchUser_(admin, "edit");
    bumpDataVersion_("*", "*", admin);
    return { success: true, merged: nMerged, renamed: nRenamed, fys: plan.fys.map(function(f) { return f.fy; }), preview: dupPublic_(plan),
      message: "รวมตัวชี้วัดซ้ำ " + nMerged + " ตัว" + (nRenamed ? " · เปลี่ยนรหัสในปีอื่น " + nRenamed + " ตัว" : "") + " (ปีงบ " + plan.fys.map(function(f) { return f.fy; }).join(", ") + ")" };
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e).replace(/^Error: /, "") };
  } finally {
    if (lock) lock.releaseLock();
  }
}
