// เอกสารแนบตัวชี้วัด (ลิงก์ Drive): ชีต KPI_Links แยกจากชีตเดิม · ตรวจลิงก์ · สิทธิ์แนบ/แก้/ลบตามสิทธิ์แก้รายละเอียด · แก้ชน · แจ้งเครื่องอื่น
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;
const FY=2570;
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m); // ค่าจาก vm context เทียบด้วย JSON (prototype ต่าง realm)
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const adminRow=U.find(r=>r[2]==='admin');const tA=tok(adminRow);
const info=(r)=>{const t=tok(r);const d=C.getAllData(t,FY);const ed=new Set(),vw=new Set();d.data.forEach(k=>{vw.add(k.id);if(k.canEditDetails)ed.add(k.id)});return {r,t,ed,vw}};
const staffs=U.slice(1).filter(r=>r[2]==='staff').map(info).filter(x=>x.ed.size>=2);
assert(staffs.length>=2);
const allStaff=U.slice(1).filter(r=>r[2]==='staff').map(info);
// S1 = ผู้ใช้ที่แก้ได้ ≥2 ตัวที่มีผู้ใช้อีกคน (S2) มองไม่เห็นเลย
let S1,S2,a,b;
for(const x of staffs){for(const y of allStaff){if(y===x)continue;const only=[...x.ed].filter(id=>!y.vw.has(id));if(only.length>=2){S1=x;S2=y;[a,b]=only;break}}if(S1)break}
assert(S1&&S2,'fixture users');
const c=[...S1.vw].find(id=>!S1.ed.has(id));assert(c,'a viewable-only kpi');
// ผู้ใช้ที่เห็น a แต่แก้ไม่ได้
const S3=allStaff.find(x=>x.vw.has(a)&&!x.ed.has(a)&&x!==S1);
const rowsOf=()=>(h.sheets.KPI_Links?h.sheets.KPI_Links.d.slice(1):[]);
const before=JSON.stringify(h.sheets['ปีงบ '+FY].d)+JSON.stringify(h.sheets['ปีงบ 2569'].d);
const GOOD='https://drive.google.com/file/d/1AbCdEfG/view?usp=sharing';

// ---- ยังไม่มีชีต: ว่าง · ไม่สร้างชีตตอนอ่าน
assert(!h.sheets.KPI_Links);
let r=C.getKpiLinks(S1.t,FY);assert(r.success&&r.links.length===0&&!h.sheets.KPI_Links,JSON.stringify(r));
r=C.getKpiLinks('bad-token',FY);assert(!r.success&&/SESSION_EXPIRED/.test(r.message));

// ---- ตรวจข้อมูลที่ส่งมา (ไม่สร้างชีตเมื่อไม่ผ่าน)
const bad=(p,re)=>{const x=C.saveKpiLink(S1.t,FY,Object.assign({title:'รายงาน',url:GOOD,ids:[a]},p));assert(!x.success&&re.test(x.message),JSON.stringify(p)+' → '+JSON.stringify(x))};
bad({title:'  '},/ชื่อเอกสาร/);
bad({url:''},/วางลิงก์/);
bad({url:'http://drive.google.com/file/d/1/view'},/Google Drive/);
bad({url:'https://example.com/x'},/Google Drive/);
bad({url:'https://drive.google.com.evil.com/x'},/Google Drive/);
bad({url:'https://drive.google.com/ x'},/Google Drive/);
bad({url:'javascript:alert(1)'},/Google Drive/);
bad({url:'https://docs.google.com/'},/Google Drive/);
bad({url:GOOD+'a'.repeat(1000)},/ยาวเกินไป/);
bad({title:'ก'.repeat(201)},/ยาวเกินไป/);
bad({note:'ก'.repeat(501)},/ยาวเกินไป/);
bad({ids:[]},/อย่างน้อย 1/);
bad({ids:[c]},/ไม่มีสิทธิ์แนบ/);
bad({ids:[a,c]},/ไม่มีสิทธิ์แนบ/);
bad({ids:['NO-SUCH-ID']},/ไม่มีสิทธิ์แนบ/);
assert(!h.sheets.KPI_Links,'no sheet when nothing saved');

// ---- เพิ่มลิงก์ (1 ลิงก์ ผูก 2 ตัวชี้วัด) · เลขไทยในชื่อ/หมายเหตุเป็นอารบิก
r=C.saveKpiLink(S1.t,FY,{title:'รายงานรอบ ๖ เดือน',url:'  '+GOOD+'  ',note:'ไฟล์ ๑ ใช้กับ ๒ ตัว',ids:[a,b,a]});
assert(r.success&&r.changed&&/^L[0-9a-f]{10}$/.test(r.id),JSON.stringify(r));
const L1=r.id;
eq(h.sheets.KPI_Links.d[0],C.KPILINK_HEADERS);
let rows=rowsOf();assert.strictEqual(rows.length,1);
assert.strictEqual(rows[0][0],FY);assert.strictEqual(rows[0][1],L1);assert.strictEqual(rows[0][2],'รายงานรอบ 6 เดือน');assert.strictEqual(rows[0][3],GOOD);
assert.strictEqual(rows[0][4],a+', '+b);assert.strictEqual(rows[0][5],'ไฟล์ 1 ใช้กับ 2 ตัว');assert.strictEqual(rows[0][6],1);assert.strictEqual(rows[0][8],S1.r[0]);assert.strictEqual(rows[0][10],S1.r[0]);assert.strictEqual(rows[0][11],'ใช้งาน');
assert.strictEqual(JSON.stringify(h.sheets['ปีงบ '+FY].d)+JSON.stringify(h.sheets['ปีงบ 2569'].d),before,'fiscal sheets untouched');

// ---- อ่าน: เจ้าของเห็นและแก้ได้ · คนที่ไม่เห็นตัวชี้วัดเลยไม่เห็นลิงก์ · ปีงบอื่นไม่เห็น
r=C.getKpiLinks(S1.t,FY);assert(r.success&&r.links.length===1);
let L=r.links[0];eq(L.ids,[a,b]);eq(L.editableIds,[a,b]);assert(L.canEdit&&L.hidden===0&&L.rev===1&&L.url===GOOD&&L.createdBy===S1.r[0],JSON.stringify(L));
assert.strictEqual(C.getKpiLinks(S2.t,FY).links.length,0,'no view → no link');
assert.strictEqual(C.getKpiLinks(S1.t,2569).links.length,0,'other year');
if(S3){const l3=C.getKpiLinks(S3.t,FY).links;assert(l3.length===1&&l3[0].ids.includes(a)&&!l3[0].canEdit&&l3[0].editableIds.length===0,'view only');
  r=C.saveKpiLink(S3.t,FY,{id:L1,title:'แอบแก้',url:GOOD,ids:[a]});assert(!r.success&&/ไม่มีสิทธิ์แก้ไขลิงก์/.test(r.message),JSON.stringify(r));
  r=C.deleteKpiLink(S3.t,FY,L1,1);assert(!r.success&&/ไม่มีสิทธิ์ลบ/.test(r.message));}
r=C.saveKpiLink(S2.t,FY,{id:L1,title:'แอบแก้',url:GOOD,ids:[a]});assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message));
r=C.deleteKpiLink(S2.t,FY,L1,1);assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message));
assert.strictEqual(rowsOf()[0][2],'รายงานรอบ 6 เดือน','unauthorised attempts changed nothing');

// ---- ไม่เปลี่ยนอะไร = ไม่เขียน ไม่แจ้งเครื่องอื่น
let v0=C.dataVersion_(C.readChangeLog_());
r=C.saveKpiLink(S1.t,FY,{id:L1,title:'รายงานรอบ 6 เดือน',url:GOOD,note:'ไฟล์ 1 ใช้กับ 2 ตัว',ids:[b,a],baseRev:1});assert(r.success&&r.changed===false,JSON.stringify(r));
assert.strictEqual(C.dataVersion_(C.readChangeLog_()),v0);

// ---- admin เพิ่มตัวชี้วัด c (ที่ S1 แก้ไม่ได้) เข้าลิงก์เดิม · S1 แก้ต่อโดยตัว c ยังอยู่
v0=C.dataVersion_(C.readChangeLog_());
r=C.saveKpiLink(tA,FY,{id:L1,title:'รายงานรอบ 6 เดือน (admin)',url:GOOD,note:'',ids:[a,b,c],baseRev:1});assert(r.success&&r.changed,JSON.stringify(r));
assert.strictEqual(rowsOf()[0][6],2);assert.strictEqual(rowsOf()[0][8],adminRow[0]);assert.strictEqual(rowsOf()[0][10],S1.r[0],'creator kept');
let poll=C.pollChanges(S1.t,FY,v0);assert(poll.success&&poll.docs.includes('LINKS'),'other devices told: '+JSON.stringify(poll.docs));
// S1 ยังมี baseRev เก่า → ชน
r=C.saveKpiLink(S1.t,FY,{id:L1,title:'ของ S1',url:GOOD,ids:[a],baseRev:1});assert(!r.success&&r.conflict&&r.current.rev===2&&r.current.by===adminRow[0]&&/ถูกแก้ไขโดย/.test(r.message),JSON.stringify(r));
r=C.getKpiLinks(S1.t,FY).links[0];eq(r.ids,[a,b,c]);eq(r.editableIds,[a,b]);
// S1 เอา b ออก แก้ชื่อ: c คงอยู่ (แก้ไม่ได้) · ใส่ c มาในรายการเลือกก็ไม่กระทบ
r=C.saveKpiLink(S1.t,FY,{id:L1,title:'ของ S1',url:GOOD,note:'x',ids:[a,c],baseRev:2});assert(r.success&&r.changed,JSON.stringify(r));
assert.strictEqual(rowsOf()[0][4],c+', '+a,'locked kept first: '+rowsOf()[0][4]);
// S1 พยายามเพิ่มตัวที่ไม่มีสิทธิ์ (ที่ไม่ได้อยู่ในลิงก์อยู่แล้ว)
const d2=[...S1.vw].find(id=>!S1.ed.has(id)&&id!==c);
if(d2){r=C.saveKpiLink(S1.t,FY,{id:L1,title:'ของ S1',url:GOOD,ids:[a,d2],baseRev:3});assert(!r.success&&/ไม่มีสิทธิ์แนบ/.test(r.message),JSON.stringify(r));}
// ไม่เลือกตัวที่แก้ได้เลย
r=C.saveKpiLink(S1.t,FY,{id:L1,title:'ของ S1',url:GOOD,ids:[c],baseRev:3});assert(!r.success&&/อย่างน้อย 1/.test(r.message),JSON.stringify(r));
// force ทับได้แม้รุ่นไม่ตรง
r=C.saveKpiLink(S1.t,FY,{id:L1,title:'ของ S1 (บังคับ)',url:GOOD,ids:[a],baseRev:1,force:true});assert(r.success&&r.changed,JSON.stringify(r));
assert.strictEqual(rowsOf()[0][6],4);

// ---- ลบ: S1 ลบส่วนของตน → c (ที่แก้ไม่ได้) ยังเหลือ · ลิงก์ยังอยู่ · S1 ไม่เห็นแล้วถ้าไม่เหลือที่ดูได้... (c ยังดูได้จึงเห็น)
r=C.deleteKpiLink(S1.t,FY,L1,1);assert(!r.success&&r.conflict,JSON.stringify(r));
r=C.deleteKpiLink(S1.t,FY,L1,4);assert(r.success&&!r.removedAll&&r.remaining===1,JSON.stringify(r));
assert.strictEqual(rowsOf()[0][4],c);assert.strictEqual(rowsOf()[0][11],'ใช้งาน');assert.strictEqual(rowsOf()[0][6],5);
r=C.getKpiLinks(S1.t,FY).links[0];eq(r.ids,[c]);assert(!r.canEdit);
// admin ลบทั้งลิงก์ → แถวคงอยู่ สถานะ "ลบ" · ไม่แสดงอีก · แก้/ลบซ้ำ = ไม่พบ
r=C.deleteKpiLink(tA,FY,L1,5);assert(r.success&&r.removedAll,JSON.stringify(r));
assert.strictEqual(rowsOf().length,1);assert.strictEqual(rowsOf()[0][11],'ลบ');
assert.strictEqual(C.getKpiLinks(tA,FY).links.length,0);
r=C.deleteKpiLink(tA,FY,L1,6);assert(!r.success&&/ไม่พบลิงก์/.test(r.message));
r=C.saveKpiLink(tA,FY,{id:L1,title:'x',url:GOOD,ids:[a]});assert(!r.success&&/ไม่พบลิงก์/.test(r.message));
r=C.deleteKpiLink(tA,FY,'NOPE',1);assert(!r.success&&/ไม่พบลิงก์/.test(r.message));

// ---- หลายลิงก์ในปีเดียว · ปีงบแยกกัน · docs.google.com ใช้ได้
r=C.saveKpiLink(tA,FY,{title:'สไลด์',url:'https://docs.google.com/presentation/d/1xyz/edit',ids:[a]});assert(r.success);
r=C.saveKpiLink(tA,FY,{title:'โฟลเดอร์',url:'https://drive.google.com/drive/folders/1abc',ids:[a,b,c]});assert(r.success);
r=C.saveKpiLink(tA,2569,{title:'ปีก่อน',url:GOOD,ids:[C.getAllData(tA,2569).data[0].id]});assert(r.success);
assert.strictEqual(C.getKpiLinks(tA,FY).links.length,2);
assert.strictEqual(C.getKpiLinks(tA,2569).links.length,1);
assert.strictEqual(rowsOf().length,4);
assert.strictEqual(JSON.stringify(h.sheets['ปีงบ '+FY].d)+JSON.stringify(h.sheets['ปีงบ 2569'].d),before,'fiscal sheets still untouched');
// ถึงขีดจำกัดจำนวนตัวชี้วัดต่อลิงก์
const many=[];for(let i=0;i<301;i++)many.push('X'+i);
r=C.saveKpiLink(tA,FY,{title:'เยอะ',url:GOOD,ids:many});assert(!r.success&&/ไม่เกิน 300/.test(r.message));
console.log('link1 ok');
