const h=require('./harness2');const C=h.ctx;const assert=require('assert');
const tok=C.createSession_('Admin',h.sheets.Users.d.find(r=>r[0]==='Admin')[1]);
const im=C.nsoImportCommit(tok);assert(im.success,im.message);console.log('import',JSON.stringify(im.wrote));
const pv=C.tidyPreview(tok);console.log('preview merged',JSON.stringify(pv.preview.fys.map(f=>[f.fy,f.merged,f.total])),'samples',pv.preview.samples.merges.length);
const before={};for(const fy of ['2569','2570'])before[fy]=h.sheets['ปีงบ '+fy].d.filter(r=>r[0]).length-1;
const c=C.tidyCommit(tok);assert(c.success,c.message);console.log('commit',JSON.stringify(c.wrote.fys));
const drop=C.TIDY_MERGE.map(p=>p[1]);
for(const fy of ['2569','2570']){
  const rows=h.sheets['ปีงบ '+fy].d.slice(1).filter(r=>r[0]);
  console.log(fy,'rows',before[fy]+1,'→',rows.length);
  assert(rows.every(r=>!drop.includes(r[0])),'dropped still present');
  assert(C.TIDY_MERGE.every(p=>rows.some(r=>r[0]===p[0])),'keep missing');
  const k=rows.find(r=>r[0]==='NURSE-KPI-0000000000379'); assert(k[28].includes('QA-หน่วยงาน')); console.log('  379 levels:',k[28],'| stamp',k[30]);
  const ids=new Set(rows.map(r=>r[0]));assert(rows.every(r=>!r[37]||ids.has(r[37])),'dangling parent');
  // multi-cats retained for part III pair
  const t=rows.find(r=>r[0]==='KPI-0000000000255'); console.log('  255 cats:',[t[2]+'|'+t[3]].concat(String(t[36]).split('\n')).join(' ; ').slice(0,200));
  assert(String(t[36]).includes('III-3')||t[3].includes('III-3'));
}
// sync redirect
const sync=h.sheets['NSO_Sync'].d; const row=sync.find(r=>r[0]==='KPI-0000000000034'); console.log('sync 034 →',row[1]); assert.strictEqual(row[1],'KPI-0000000000255');
// log
const log=h.sheets['Tidy_Log'].d.filter(r=>r[3]==='merge-drop'); console.log('log merge-drop rows',log.length); assert.strictEqual(log.length,44);
assert(!C.tidyPreview(tok).preview.hasWork,'idempotent after merge');
const p=C.nsoImportPreview(tok).preview.counts;console.log('nso preview',JSON.stringify(p));assert(p.conflicts===0&&p.added===0&&p.updated===0);
const r2=C.nsoImportCommit(tok);console.log('import2',JSON.stringify(r2.wrote));
assert(!C.tidyPreview(tok).preview.hasWork);
for(const fy of ['2569','2570']){const rows=h.sheets['ปีงบ '+fy].d.slice(1).filter(r=>r[0]);assert(rows.every(r=>!drop.includes(r[0])),'dropped came back');}
console.log('ALL OK');
