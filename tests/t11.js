process.env.MIGRATE='1';
const {ctx,sheets}=require('./harness');const assert=require('assert');
ctx.authenticateUser('Admin','Admin11038'); const a=ctx.authenticateUser('Admin','Admin11038');
// create previous-year sheet too by rolling? just 2570 and 2569 exist after migration to fiscal years
const names=Object.keys(sheets).filter(n=>/^ปีงบ \d{4}$/.test(n)); console.log('year sheets',names);
const before=JSON.stringify(sheets['ปีงบ 2570'].d);
const keep=sheets['ปีงบ 2570'].d.map(r=>r.slice());
let r=ctx.getAllData(a.token,2570); assert(r.success,r.message);
const S=sheets['ปีงบ 2570'].d;
let withUnit=0;
S.slice(1).forEach((row,i)=>{ if(!row[0])return; const lv=row[28].split(', '); assert(lv.includes('หน่วยงาน'),'level '+row[28]);
  const depts=ctx.parseDepts_(row[26]); const extras=(row[36]||'').split('\n').filter(Boolean).map(l=>l.split(' | ')[0]);
  depts.forEach(d=>assert(extras.includes(d)||row[2]===d,'missing cat '+d+' in '+row[0]));
  // untouched cols
  [0,1,2,3,4,5,6,10,22,23,24,25,26].forEach(c=>assert(String(row[c])===String(keep[i+1][c]),'col '+c+' changed'));
  withUnit++; });
console.log('KPIs processed',withUnit);
// sample
const sample=S.find(r=>r[26]==='OPD/ER/LR/IPD'); console.log(sample[28],'|',JSON.stringify(sample[36]));
const sample2=S.find(r=>r[26]==='ER'); console.log(sample2[28],'|',JSON.stringify(sample2[36]));
// backups hidden and not treated as year sheets
const baks=Object.keys(sheets).filter(n=>n.startsWith('สำรองก่อนสร้างหมวดหน่วยงาน')); console.log('backups',baks); assert(baks.length>=1&&baks.every(n=>sheets[n].hidden));
assert(ctx.listFiscalYears_().join()===names.map(n=>+n.slice(-4)).sort((x,y)=>y-x).join());
// idempotent + one-time (manual removal sticks)
const snap=JSON.stringify(S); ctx.getAllData(a.token,2570); assert(JSON.stringify(S)===snap,'idempotent');
const id=sample2[0]; let rr=ctx.saveKpi(a.token,2570,{id,cats:[{part:sample2[2],category:sample2[3]}]}); assert(rr.success&&!sheets['ปีงบ 2570'].d.find(x=>x[0]===id)[36]); ctx.getAllData(a.token,2570); assert(!sheets['ปีงบ 2570'].d.find(x=>x[0]===id)[36],'removal sticks');
// visibility: ER staff sees ER KPI; ER KPI visible via unit category to other ER member; exec not affected
const users=ctx.getUsersForAdmin(a.token).users; const erStaff=users.find(u=>u.tier==='staff'&&/\bER\b/.test(u.depts)); const st=ctx.authenticateUser(erStaff.username,'11038');
const d=ctx.getAllData(st.token,2570).data; const mineParts=new Set(); d.forEach(k=>k.cats.forEach(c=>mineParts.add(c.part)));
const own=ctx.authenticateUser(erStaff.username,'11038'); const myDepts=ctx.getUsersForAdmin(a.token).users.find(u=>u.username===erStaff.username).depts; console.log('ER staff',erStaff.username,'depts',myDepts);
const unitParts=[...mineParts].filter(p=>!ctx.isCorePart_(p)); console.log('parts visible:',[...mineParts].join(' | '));
const mySet=myDepts.split(/[,\s]+/).filter(Boolean);
assert(unitParts.every(p=>mySet.includes(p)),'only own unit categories: '+unitParts); assert(unitParts.length>0&&[...mineParts].some(p=>ctx.isCorePart_(p)));
// admin sees all unit cats
const adm=ctx.getAllData(a.token,2570).data; const ap=new Set(); adm.forEach(k=>k.cats.forEach(c=>ap.add(c.part))); assert(ap.size>mineParts.size);
// hidden cats preserved when a staff saves others
const own1=d.find(k=>k.mine&&k.cats.length>=2); if(own1){ const before=sheets['ปีงบ 2570'].d.find(x=>x[0]===own1.id)[36]; const rs=ctx.saveKpi(st.token,2570,{id:own1.id,name:own1.name+'!',cats:own1.cats}); assert(rs.success,JSON.stringify(rs)); assert(sheets['ปีงบ 2570'].d.find(x=>x[0]===own1.id)[36]===before,'hidden unit cats preserved'); }
const exec=ctx.authenticateUser('ผอ.','11038'); const ex=ctx.getAllData(exec.token,2570).data; assert(ex.every(k=>k.cats.every(c=>ctx.isCorePart_(c.part)||k.mine)),'exec sees only core cats');
// saveKpi works on sheet with 36 columns (ensureColumns_)
console.log('maxCols',sheets['ปีงบ 2570'].maxCols);
console.log('ALL OK');
