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
const sar=all.find(k=>(k.levels||[]).includes('SAR')),qa=all.find(k=>(k.levels||[]).includes('QA-หน่วยงาน')&&!(k.levels||[]).includes('SAR'));
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
console.log('perm2 ok');
