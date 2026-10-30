// ⤵ ดึงข้อมูลจากปีงบก่อนหน้า: ผลทั้งปีย้อนหลัง (เติมเฉพาะช่องว่าง · คำนวณจากผลรายเดือน · ปีที่ล็อก) · รายละเอียด · ลิงก์เอกสารแนบ · สิทธิ์ · ตรวจรุ่น
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;const FY=2570;
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const adminRow=U.find(r=>r[2]==='admin');const tA=tok(adminRow);
const Y=y=>h.sheets['ปีงบ '+y].d;
const rowOf=(y,id)=>Y(y).slice(1).find(r=>String(r[0]).trim()===id);
// ตัวชี้วัดที่มีทั้ง 2 ปี และมีเจ้าของที่เป็น staff (แก้ได้)
const staffRow=U.find(r=>r[2]==='staff'&&C.getAllData(tok(r),FY).data.some(k=>k.canEditResults&&k.canEditDetails&&rowOf(2569,k.id)));assert(staffRow,'staff with editable kpi in both years');
const tS=tok(staffRow);
const kp=C.getAllData(tS,FY).data.find(k=>k.canEditResults&&k.canEditDetails&&rowOf(2569,k.id));
const cur=rowOf(FY,kp.id),prev=rowOf(2569,kp.id);
const reset=()=>{for(let i=6;i<=10;i++){cur[i]='';prev[i]=''}for(let i=11;i<=22;i++)prev[i]='';cur[23]='';prev[23]='';(h.sheets.KPI_Links&&(h.sheets.KPI_Links.d.length=1))};
const pv=(t)=>{const r=C.pullPrevPreview(t,FY,kp.id);assert(r.success,JSON.stringify(r));return r.preview};

// ---- ไม่มีอะไรให้ดึง
reset();let p=pv(tS);assert.strictEqual(p.todo,0);
let r=C.pullPrevCommit(tS,FY,kp.id,p.rev);assert(r.success&&r.changed===false&&/ไม่มีข้อมูลใหม่/.test(r.message),JSON.stringify(r));
// ---- ผลทั้งปี: ปีก่อนมี 5 ช่อง (ปี−5…ปี−1) → ปีนี้ช่อง 0..2 เติมได้ · ช่อง 3 (ปีที่แล้ว) ล็อก (มีชีตต้นทาง) สำหรับ staff
reset();prev[6]=10;prev[7]=20;prev[8]=30;prev[9]=40;prev[10]=50;cur[7]=99; // ช่องปีนี้ idx1 มีค่าอยู่แล้ว → ต้องไม่ทับ
p=pv(tS);eq(p.years.map(y=>y.action),['fill','keep','fill','locked'],JSON.stringify(p.years));
eq(p.years.map(y=>y.value),[20,30,40,50]);
r=C.pullPrevCommit(tS,FY,kp.id,p.rev);assert(r.success&&r.changed&&r.done.years===2,JSON.stringify(r));
eq([cur[6],cur[7],cur[8],cur[9]],[20,99,40,''],'filled 0 and 2 only; 1 kept; 3 locked for staff');
// ---- admin: ปีที่ล็อกเติมได้ · ปีก่อนว่างแต่รายเดือนครบ → คำนวณตามวิธีสรุป
reset();prev[10]='';for(let i=11;i<=22;i++)prev[i]=i%2?'-':10; // ครบ 12 เดือน (ครึ่งหนึ่ง "-")
const method=C.getAllData(tA,FY).data.find(k=>k.id===kp.id).summaryMethod;
p=pv(tA);assert.strictEqual(p.years[3].action,'fill');
const exp=method==='ผลรวม'?60:10;assert.strictEqual(p.years[3].value,exp,'summary by '+method);assert(/คำนวณ/.test(p.years[3].via));
r=C.pullPrevCommit(tA,FY,kp.id,p.rev);assert(r.success&&r.changed,JSON.stringify(r));assert.strictEqual(cur[9],exp);assert.strictEqual(prev[10],exp,'propagated to previous sheet K');
// รายเดือนไม่ครบ → ไม่คำนวณ
reset();prev[10]='';for(let i=11;i<=21;i++)prev[i]=5;prev[22]='';p=pv(tA);assert.strictEqual(p.years[3].action,'none');
// ---- รายละเอียด
reset();prev[23]='รายละเอียดปีก่อน';p=pv(tS);assert.strictEqual(p.details.action,'fill');
const aBefore=cur[C.ANALYSIS_COL-1];
r=C.pullPrevCommit(tS,FY,kp.id,p.rev);assert(r.success&&r.changed&&r.done.details===1,JSON.stringify(r));assert.strictEqual(cur[23],'รายละเอียดปีก่อน');
assert.strictEqual(cur[C.ANALYSIS_COL-1],aBefore,'analysis-updated stamp NOT set');
cur[23]='ของปีนี้';p=pv(tS);assert.strictEqual(p.details.action,'keep');r=C.pullPrevCommit(tS,FY,kp.id,p.rev);assert(r.success&&r.changed===false);assert.strictEqual(cur[23],'ของปีนี้');
// ---- ลิงก์
reset();const URL1='https://drive.google.com/file/d/AAA/view',URL2='https://docs.google.com/document/d/BBB/edit';
const nl=(fy,u,t,ids)=>C.saveKpiLink(tA,fy,{title:t,url:u,ids:ids});
let x=nl(2569,URL1,'เอกสาร 1',[kp.id]);assert(x.success,JSON.stringify(x));x=nl(2569,URL2,'เอกสาร 2',[kp.id]);assert(x.success,JSON.stringify(x));
x=nl(FY,URL2,'เอกสาร 2 ปีนี้',[]).success; // ต้องมีตัวชี้วัด ≥1 → สร้างด้วยตัวอื่นแทน
const other=C.getAllData(tA,FY).data.find(k=>k.id!==kp.id).id;
x=nl(FY,URL2,'เอกสาร 2 ปีนี้',[other]);assert(x.success,JSON.stringify(x));
p=pv(tS);eq(p.links.map(l=>l.action).sort(),['attach','new']);
r=C.pullPrevCommit(tS,FY,kp.id,p.rev);assert(r.success&&r.changed&&r.done.links===2,JSON.stringify(r));
let L=C.getKpiLinks(tS,FY).links;assert(L.some(l=>l.url===URL1&&l.ids.includes(kp.id)),'new link');
assert.strictEqual(L.filter(l=>l.url===URL2).length,1,'no duplicate row for same URL');assert(L.find(l=>l.url===URL2).ids.includes(kp.id)&&L.find(l=>l.url===URL2).ids.includes(other),'attached to existing');
// ดึงซ้ำ → ไม่มีอะไรใหม่
p=pv(tS);assert.strictEqual(p.todo,0);r=C.pullPrevCommit(tS,FY,kp.id,p.rev);assert(r.success&&r.changed===false);
// ---- สิทธิ์ / ข้อผิดพลาด
const noEdit=U.slice(1).filter(u=>u[2]==='staff').map(u=>({u,t:tok(u)})).find(x=>{const k=C.getAllData(x.t,FY).data.find(k=>k.id===kp.id);return !k||(!k.canEditResults&&!k.canEditDetails)});
if(noEdit){const e=C.pullPrevPreview(noEdit.t,FY,kp.id);assert(!e.success,'no edit rights');assert(!C.pullPrevCommit(noEdit.t,FY,kp.id,0).success);}
assert(!C.pullPrevPreview('bad',FY,kp.id).success);assert(!C.pullPrevPreview(tS,FY,'ไม่มีรหัสนี้').success);
assert(!C.pullPrevPreview(tS,2569,kp.id).success,'no previous sheet (2568)');
// ---- ตรวจรุ่น
reset();prev[23]='x';p=pv(tS);cur[23]='';cur[4]=cur[4]+' แก้';r=C.pullPrevCommit(tS,FY,kp.id,p.rev);
assert(r.success===false&&r.conflict===true,'stale rev → conflict '+JSON.stringify(r).slice(0,100));cur[4]=cur[4].replace(' แก้','');
console.log('pull1 ok');
