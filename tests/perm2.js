// หน่วยงานของ staff คิดอัตโนมัติจากตัวชี้วัดที่รับผิดชอบ · หัวหน้าหน่วย QMR/QA สิทธิ์พิเศษ · getDirectory · หน้าตั้งค่าแสดง autoDepts
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(a,b,m)=>assert.strictEqual(JSON.stringify(a),JSON.stringify(b),m);
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);const tA=tok(U.find(r=>r[2]==='admin'));
const Y=h.sheets['ปีงบ 2570'].d;
// staff: ล้างหน่วยงานในชีต Users แล้วต้องยังได้หน่วยจากตัวชี้วัดที่รับผิดชอบ
const st=U.find(r=>r[2]==='staff'&&C.getAllData(tok(r),2570).data.some(k=>k.isOwner));assert(st,'staff owner');
const mineKpis=C.getAllData(tok(st),2570).data.filter(k=>k.isOwner);
const want=[...new Set(mineKpis.flatMap(k=>C.parseDepts_(k.department)))];
const before=C.getAllData(tok(st),2570).data.map(k=>k.id).sort().join();
st[3]='';const ts=tok(st);
const after=C.getAllData(ts,2570).data.map(k=>k.id).sort().join();
assert.strictEqual(after,before,'staff sees the same KPIs without any stored department');
const lg=C.authenticateUser(st[0],'pw123456');assert(lg.success);eq(lg.user.depts.slice().sort(),want.slice().sort(),'login payload carries derived depts');
// หน้าตั้งค่า
const lu=C.getUsersForAdmin(tA).users.find(u=>u.username===st[0]);assert.strictEqual(lu.depts,'');eq(lu.autoDepts.split(', ').filter(Boolean).sort(),want.slice().sort());
// getDirectory
const dir=C.getDirectory(ts);assert(dir.success&&dir.users.includes(st[0])&&want.every(d=>dir.units.includes(d)),'directory');assert(!C.getDirectory('bad').success);
// หัวหน้า QMR / QA
const hd=U.find(r=>r[2]==='head');hd[1]=C.hashPassword_('pw123456');hd[4]='FALSE';
const all=C.getAllData(tA,2570).data;
// ถอดชื่อหัวหน้าทดสอบออกจากผู้รับผิดชอบทุกตัวก่อน (กันหน่วยอัตโนมัติจากข้อมูลจริงปนเข้ามา) แล้วคืนตอนท้าย
const ownBackup=[];Y.slice(1).forEach(r=>{if(C.parseOwners_(r[25]).indexOf(hd[0])!==-1){ownBackup.push([r,r[25]]);r[25]='ไม่มีใคร'}});
const all2=C.getAllData(tA,2570).data;
const sar=all2.find(k=>(k.levels||[]).includes('SAR')),autoH=[],qa=all2.find(k=>(k.levels||[]).includes('QA-หน่วยงาน')&&!(k.levels||[]).includes('SAR')&&!C.parseDepts_(k.department).some(d=>autoH.includes(d))&&C.parseOwners_(k.owner).indexOf(hd[0])===-1);
assert(sar&&qa,'sample kpis');
const mk=depts=>{hd[3]=depts;return tok(hd)};
const perm=(t,id)=>{const k=C.getAllData(t,2570).data.find(x=>x.id===id);return k?{view:true,edit:k.canEditResults&&k.canEditDetails,mine:k.mine}:{view:false}};
let t0=mk('ZZZ');assert.strictEqual(perm(t0,sar.id).edit,false,'plain head cannot edit SAR');
let t1=mk('QMR');assert.strictEqual(perm(t1,sar.id).edit,true,'QMR head edits SAR');assert.strictEqual(perm(t1,sar.id).mine,false,'not "mine"');
const qaKpi=all.find(k=>(k.levels||[]).includes('QA-หน่วยงาน')&&!k.department.includes('ZZZ'));
assert.strictEqual(perm(mk('ZZZ'),qa.id).view,false,'plain head cannot see other unit QA kpi');
let t2=mk('QA');eq(perm(t2,qa.id),{view:true,edit:true,mine:false},'QA head sees+edits QA kpis of every unit');
assert.strictEqual(perm(t2,sar.id).edit,false,'QA head: SAR not editable (SAR-only kpi)');
// บันทึกจริงผ่าน saveKpi
mk('QA');let r=C.saveKpi(t2,2570,{id:qa.id,target:'≥ 91',});assert(r.success,JSON.stringify(r));
mk('QMR');r=C.saveKpi(t1,2570,{id:sar.id,target:'≥ 92'});assert(r.success,JSON.stringify(r));
r=C.saveKpi(mk('ZZZ'),2570,{id:sar.id,target:'≥ 1'});assert(!r.success,'plain head denied');
// หัวหน้า 2 ชั้น: หน่วยที่ระบุ = สิทธิ์หัวหน้า · หน่วยอัตโนมัติ (จากตัวชี้วัดที่รับผิดชอบ) = สิทธิ์แบบ staff
{
 const unitKpis=d=>all2.filter(k=>(k.levels||[]).includes('หน่วยงาน')&&!(k.levels||[]).includes('SAR')&&C.parseDepts_(k.department).length===1&&C.parseDepts_(k.department)[0]===d);
 const dcount={};all2.forEach(k=>{if((k.levels||[]).includes('หน่วยงาน')&&!(k.levels||[]).includes('SAR')&&C.parseDepts_(k.department).length===1){const d=C.parseDepts_(k.department)[0];dcount[d]=(dcount[d]||0)+1}});
 const D=Object.keys(dcount).find(d=>dcount[d]>=2&&d!=='ZZZ');assert(D,'a unit with 2+ unit-level kpis');
 const [own,other]=unitKpis(D);
 const rowOf=id=>Y.slice(1).find(r=>String(r[0]).trim()===id);
 const oldOwner=rowOf(own.id)[25];rowOf(own.id)[25]=hd[0];
 // หัวหน้าหน่วย ZZZ เท่านั้น แต่รับผิดชอบตัวชี้วัดของหน่วย D
 let th=mk('ZZZ');
 const pOwn=perm(th,own.id),pOther=perm(th,other.id);
 assert.strictEqual(pOwn.edit,true,'head edits own kpi of an auto unit (staff-like)');assert.strictEqual(pOwn.mine,true);
 assert.strictEqual(pOther.view,true,'head sees other unit-level kpi of auto unit');assert.strictEqual(pOther.edit,false,'...but cannot edit it (not head of D)');
 const lg2=C.authenticateUser(hd[0],'pw123456');assert(lg2.success);
 assert(lg2.user.depts.includes('ZZZ')&&lg2.user.depts.includes(D),'depts = specified + auto');eq(lg2.user.headDepts,['ZZZ']);
 const au=C.getUsersForAdmin(tA).users.find(u=>u.username===hd[0]);assert.strictEqual(au.depts,'ZZZ');assert(au.autoDepts.split(', ').includes(D),'settings shows auto for head');
 // ระบุ D เป็นหน่วยที่เป็นหัวหน้า → แก้ได้ทั้งหน่วย
 th=mk(D);assert.strictEqual(perm(th,other.id).edit,true,'head of D edits whole unit');
 // QMR/QA มาจากหน่วยที่ระบุเท่านั้น: หน่วยอัตโนมัติชื่อ QA ไม่ให้สิทธิ์พิเศษ
 rowOf(own.id)[25]=oldOwner;
 const qaRow=rowOf(qa.id),oldDept=qaRow[26],oldOwn=qaRow[25];qaRow[26]='QA';qaRow[25]=hd[0];
 th=mk('ZZZ');const kq=C.getAllData(th,2570).data.find(k=>k.id===qa.id);
 const other2=all2.find(k=>(k.levels||[]).includes('QA-หน่วยงาน')&&k.id!==qa.id&&!C.parseDepts_(k.department).includes('QA'));
 if(other2)assert.strictEqual(perm(th,other2.id).edit,false,'auto "QA" unit gives no special QA right');
 qaRow[26]=oldDept;qaRow[25]=oldOwn;
}
ownBackup.forEach(([r,v])=>{r[25]=v});
console.log('perm2 ok');
