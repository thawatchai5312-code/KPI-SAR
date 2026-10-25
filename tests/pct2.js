const h=require('./harness2');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;
['ธวัชชัย','รินทร์ลภัส','อรทัย','ดวงแก้ว','รุจีพร'].forEach(n=>{if(!U.find(r=>r[0]===n))U.push([n,'x',n==='ดวงแก้ว'||n==='รุจีพร'?'staff':'head','ER','FALSE','','']);});
const tok=C.createSession_('Admin',U.find(r=>r[0]==='Admin')[1]);
assert(C.nsoImportCommit(tok).success);assert(C.tidyCommit(tok).success);
const Y=()=>h.sheets['ปีงบ 2570'].d.slice(1).filter(r=>r[0]);
const before=Y().length;
const pv=C.pctImportPreview(tok);console.log('preview',pv.success,JSON.stringify(pv.preview.fys),pv.preview.users.map(u=>u.name+':'+u.exists+'/'+u.hasPct).join(' '));
assert(pv.success&&!pv.preview.done);
const c=C.pctImportCommit(tok);assert(c.success,c.message);console.log('commit',JSON.stringify(c.wrote),JSON.stringify(c.tidied));
const rows=Y();console.log('rows',before,'→',rows.length);
const nw=rows.filter(r=>r[0].startsWith('PCT-KPI-'));console.log('new rows',nw.length);
assert(nw.length>100);
const byId=Object.fromEntries(rows.map(r=>[r[0],r]));
assert(rows.every(r=>!r[37]||byId[r[37]]),'dangling parent');
// users
const au=U.find(r=>r[0]==='อรทัย');console.log('อรทัย depts',au[3]);assert(String(au[3]).includes('PCT'));
// second commit refused
const c2=C.pctImportCommit(tok);console.log('2nd:',c2.success,c2.message);assert(!c2.success);
// tidy after: nothing to do except nothing
const t=C.tidyPreview(tok);console.log('tidy hasWork',t.preview.hasWork,JSON.stringify(t.preview.fys.map(f=>[f.fy,f.rows,f.merged])));
assert(!t.preview.hasWork,'tidy idempotent after PCT');
// backups + log
assert(h.sheets['สำรองก่อนนำเข้า PCT ปีงบ 2570']&&h.sheets['สำรองก่อนนำเข้า PCT ปีงบ 2569']);
const log=h.sheets['Tidy_Log'].d;console.log('log kinds',JSON.stringify(log.reduce((a,r)=>(a[r[3]]=(a[r[3]]||0)+1,a),{})));
// NSO preview unaffected
const p=C.nsoImportPreview(tok).preview.counts;console.log('nso',JSON.stringify(p));assert(p.conflicts===0&&p.added===0);
// saveKpi works on a new PCT row by head (ธวัชชัย)
const ht=C.createSession_('ธวัชชัย',U.find(r=>r[0]==='ธวัชชัย')[1]);
const id=nw[0][0];const r=C.saveKpi(ht,2570,{id,months:Array(12).fill(null).map((_,i)=>i===0?55:null)});console.log('head save',r.success,r.message);
console.log('ALL OK');
