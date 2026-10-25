process.env.MIGRATE='1';
ctx_pre=1;const {ctx,sheets}=require('./harness');const assert=require('assert');
ctx.PropertiesService.getScriptProperties().setProperty('OWNER_LEVEL_V1','x'); ctx.authenticateUser('Admin','Admin11038'); const a=ctx.authenticateUser('Admin','Admin11038');
// create legacy state: a KPI with level ฝ่ายการพยาบาล, dept text "ฝ่ายการพยาบาล" and "OPD/ฝ่ายการ", users with ฝ่ายการพยาบาล
const S=sheets['ปีงบ 2570'].d;
const r1=S[1], r2=S[2], r3=S[3], r4=S[4];
r1[28]='ฝ่ายการพยาบาล, SAR'; r1[26]='IPD';
r2[28]='SAR'; r2[26]='OPD/ฝ่ายการ';
r3[28]='ฝ่ายการพยาบาล'; r3[26]=''; r3[36]='';
r4[28]='QA-หน่วยงาน, SAR'; r4[26]='ER'; r4[2]='ฝ่ายการพยาบาล'; r4[3]='งานเก่า';
const U=sheets.Users.d; const users=ctx.getUsersForAdmin(a.token).users; const ch=users.find(u=>u.username==='ชฎาพร'); 
U.find(r=>r[0]==='ชฎาพร')[3]='IPD,ฝ่ายการพยาบาล';
const before=JSON.stringify([r1,r2,r3,r4]);
// props flag unset in this process? ensure migration runs
ctx.PropertiesService.getScriptProperties().setProperty('NURSING_LEVEL_TO_UNIT_V1','');
let r=ctx.getAllData(a.token,2570); assert(r.success,r.message);
console.log('r1',r1[28],'|',r1[26],'|',JSON.stringify(r1[36]));
console.log('r2',r2[28],'|',r2[26],'|',JSON.stringify(r2[36]));
console.log('r3',r3[28],'|',r3[26],'|',JSON.stringify(r3[36]));
console.log('r4',r4[2],'|',r4[3],'|',r4[26],'|',JSON.stringify(r4[36]));
assert(r1[28]==='หน่วยงาน, SAR'&&/(^|\/ )NSO$/.test(r1[26])&&r1[36].includes('NSO | รอจัดหมวดย่อย'));
assert(r2[26]==='OPD/NSO'&&r2[36].includes('NSO | รอจัดหมวดย่อย'));
assert(r3[28]==='หน่วยงาน'&&r3[26]==='NSO'&&r3[36].includes('NSO'));
assert(r4[2]==='NSO'&&r4[3]==='งานเก่า');
// no nursing level anywhere + KPI_LEVELS
assert(!S.some(r=>(r[28]||'').includes('ฝ่ายการพยาบาล'))); assert(ctx.KPI_LEVELS.join()==='รายบุคคล,หน่วยงาน,QA-หน่วยงาน,SAR');
// backup hidden
const baks=Object.keys(sheets).filter(n=>n.startsWith('สำรองก่อนย้ายฝ่ายการพยาบาลเป็น NSO')); console.log('backups',baks.length); assert(baks.length>=1&&baks.every(n=>sheets[n].hidden));
// users rewritten
assert(U.find(r=>r[0]==='ชฎาพร')[3]==='IPD,NSO',U.find(r=>r[0]==='ชฎาพร')[3]);
// idempotent
const snap=JSON.stringify(S); ctx.getAllData(a.token,2570); assert(JSON.stringify(S)===snap);
// alias at read time & visibility: NSO member sees r3 (หน่วยงาน level, NSO unit)
const st=ctx.authenticateUser('ชฎาพร','11038'); const d=ctx.getAllData(st.token,2570).data; assert(d.some(k=>k.id===r3[0]));
// someone not in NSO does not see r3 (หน่วยงาน only) unless owner
const o=ctx.authenticateUser('มานี','11038'); assert(!ctx.getAllData(o.token,2570).data.some(k=>k.id===r3[0]&&!k.mine));
// head with NSO edits all NSO KPIs; staff view-only
const head=ctx.authenticateUser('เดือนเพ็ญ','11038'); // executive -> skip
const nh=ctx.getUsersForAdmin(a.token).users.map(u=>u.username==='ชฎาพร'?{...u,tier:'head'}:u); assert(ctx.saveUsersForAdmin(a.token,nh,[]).success);
const st2=ctx.authenticateUser('ชฎาพร','11038'); const k3=ctx.getAllData(st2.token,2570).data.find(k=>k.id===r3[0]); assert(k3.canEditResults&&k3.canEditDetails,'NSO head edits');
// saving levels with legacy value maps to หน่วยงาน
const rs=ctx.saveKpi(a.token,2570,{id:r3[0],levels:['ฝ่ายการพยาบาล','SAR']}); assert(rs.success&&S.find(r=>r[0]===r3[0])[28]==='หน่วยงาน, SAR',S.find(r=>r[0]===r3[0])[28]);
console.log('ALL OK');
