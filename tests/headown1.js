// ผู้รับผิดชอบที่เขียนว่า "หัวหน้า…" = ผู้ใช้ Tier head / executive (docs/head-owner-plan.md) — ข้อมูลสมมติ
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const FY=2570;
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const mk=(n,tier,d)=>{const r=[n,C.hashPassword_('123456'),tier,d||'','FALSE','',''];U.push(r);return r};
const hA=mk('หัวหน้าทดสอบเอ','head','HOWA'),hB=mk('หัวหน้าทดสอบบี','head','HOWB'),ex0=mk('ผู้บริหารทดสอบ0','executive',''),ex1=mk('ผู้บริหารทดสอบ1','executive','HOWA'),st=mk('เจ้าหน้าที่ทดสอบ','staff','HOWA'),nso=mk('หัวหน้าทดสอบเอ็นเอสโอ','head','NSO');
const adRow=U.find(r=>r[2]==='admin');
const user=r=>C.requireUser_(tok(r));
const [uA,uB,u0,u1,uS,uN,uAd]=[hA,hB,ex0,ex1,st,nso,adRow].map(user);
const own=(u,owner,dept)=>C.getKpiPermission_(u,{owner,department:dept,levels:['รายบุคคล'],part:'x',category:'y'},FY).isOwner;
const row=(owner,dept)=>[uA,uB,u0,u1,uS,uN].map(u=>own(u,owner,dept));
// ---- ฟังก์ชันตรวจคำ
eq([C.ownerHeadTokens_('หัวหน้าหน่วย'),C.ownerHeadTokens_('สมชาย / หัวหน้างาน / หัวหน้า'),C.ownerHeadTokens_('หัวหน้าพยาบาล'),C.ownerHeadTokens_('สมชาย'),C.ownerHeadTokens_(''),C.ownerHeadTokens_(null),C.ownerHeadTokens_('หัวหน้าตึกหรือหัวหน้าหน่วยงานพยาบาลแต่ละฝ่าย')],
  [['หัวหน้าหน่วย'],['หัวหน้างาน','หัวหน้า'],[],[],[],[],['หัวหน้าตึก']],'tokens (alias → ชื่อคนไม่นับ · alias ตำแหน่ง → หัวหน้าตึก)');
// ---- หัวหน้าหน่วย + ระบุหน่วย: head/exec ที่หน่วยตรง (A, ex1) · ที่อื่นไม่
eq(row('หัวหน้าหน่วย','HOWA'),[true,false,false,true,false,false],'หัวหน้าหน่วย + หน่วย HOWA');
// ---- ช่องหน่วยงานว่าง: ทุก head + executive (staff ไม่)
eq(row('หัวหน้าหน่วย',''),[true,true,true,true,false,true],'หัวหน้าหน่วย + ไม่ระบุหน่วย = head/executive ทุกคน');
// ---- คำอื่นที่มี "หัวหน้า"
eq(row('หัวหน้างาน','HOWA'),[true,false,false,true,false,false],'หัวหน้างาน + หน่วย');
eq(row('หัวหน้า',''),[true,true,true,true,false,true],'หัวหน้า + ไม่ระบุหน่วย');
eq(row('หัวหน้าหน่วยงาน','HOWB'),[false,true,false,false,false,false],'หัวหน้าหน่วยงาน + หน่วย HOWB');
eq(row('หัวหน้าฝ่าย',''),[true,true,true,true,false,true],'หัวหน้าฝ่าย + ไม่ระบุหน่วย');
// ---- ชื่อคนร่วมในช่องเดียวกัน: ยังเป็นผู้รับผิดชอบตามชื่อ
eq([own(uS,'หัวหน้าหน่วย / เจ้าหน้าที่ทดสอบ','HOWA'),own(uS,'หัวหน้างาน / เจ้าหน้าที่ทดสอบ','HOWB')],[true,true],'ชื่อคนในช่องเดียวกันยังนับ');
// ---- alias ตำแหน่งที่เป็นชื่อคน (หัวหน้าพยาบาล → เดือนเพ็ญ): ไม่ใช่ตำแหน่งหัวหน้าทั่วไป
eq(row('หัวหน้าพยาบาล',''),[false,false,false,false,false,false],'หัวหน้าพยาบาล = ชื่อคน');
// ---- ไม่มีคำว่า หัวหน้า: เหมือนเดิม
eq(row('สมชาย','HOWA'),[false,false,false,false,false,false],'ไม่มีคำหัวหน้า = ไม่เปลี่ยน');
eq(row('','HOWA'),[false,false,false,false,false,false]);
// ---- admin: เห็น/แก้ทุกอย่างเหมือนเดิม (isOwner ไม่เปลี่ยนจากกติกานี้)
eq([own(uAd,'หัวหน้าหน่วย','HOWA'),own(uAd,'สมชาย','HOWA')],[false,false],'admin ไม่ถูกนับเป็นผู้รับผิดชอบ (แต่เห็น/แก้ได้อยู่แล้ว)');
assert(C.getKpiPermission_(uAd,{owner:'สมชาย',department:'HOWA',levels:['รายบุคคล']},FY).editDetails);
// ---- หัวหน้าตึก: กติกา NSO เดิมยังใช้ · ช่องหน่วยงานว่างไม่ขยายเป็นทุกคน · ระบุหน่วยแล้วหัวหน้าของหน่วยนั้นนับด้วย
eq(row('หัวหน้าตึก',''),[false,false,false,false,false,true],'หัวหน้าตึก + ว่าง = เฉพาะสังกัด NSO (เดิม)');
eq(row('หัวหน้าตึก','NSO'),[false,false,false,false,false,true],'หัวหน้าตึก + NSO');
eq(row('หัวหน้าตึก','HOWA'),[true,false,false,true,false,true],'หัวหน้าตึก + หน่วย HOWA: NSO (เดิม) + หัวหน้าของ HOWA (ใหม่)');
// ---- สิทธิ์ที่ตามมา: เห็น/แก้ได้ · อยู่ใน "ของฉัน"
const pr=C.getKpiPermission_(uB,{owner:'หัวหน้าหน่วย',department:'',levels:['รายบุคคล'],part:'x',category:'y'},FY);
assert(pr.view&&pr.editResults&&pr.editDetails&&pr.mine&&pr.isOwner,JSON.stringify(pr));
const pe=C.getKpiPermission_(u0,{owner:'หัวหน้าหน่วย',department:'',levels:['รายบุคคล'],part:'x',category:'y'},FY);assert(pe.view&&pe.editResults&&pe.mine,'executive sees & edits');
const ps=C.getKpiPermission_(uS,{owner:'หัวหน้าหน่วย',department:'',levels:['รายบุคคล'],part:'x',category:'y'},FY);assert(!ps.view&&!ps.isOwner,'staff unaffected');
// ---- หน่วยอัตโนมัติของหัวหน้าไม่เปลี่ยน (ไม่ได้หน่วยจากตัวชี้วัดที่เป็น "หัวหน้า…")
const tA=tok(adRow);
const add=(name,owner,dept)=>{const r=C.addIndicator(tA,FY,{part:'OPD',category:'x',name,target:'≥ 80',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner,department:dept});assert(r.success,JSON.stringify(r));return r.newId};
const K1=add('ทดสอบหัวหน้าเจ้าของ ตัวที่หนึ่งของทุกหน่วย','หัวหน้าหน่วย',''),K2=add('ทดสอบหัวหน้าเจ้าของ ตัวที่สองของหน่วยเอ','หัวหน้างาน','HOWB');
eq(C.effectiveDepts_(C.requireUser_(tok(hA)),FY),['HOWA'],'effectiveDepts ของ head ไม่เพิ่ม');
// ---- ผ่าน getAllData: isOwner / mine
const data=(r)=>C.getAllData(tok(r),FY).data;
const get=(d,id)=>d.find(k=>k.id===id);
const dA=data(hA),dB=data(hB),dS=data(st);
assert(get(dA,K1)&&get(dA,K1).isOwner&&get(dA,K1).canEditResults,'head A: K1 mine & editable');
assert(get(dB,K1)&&get(dB,K1).isOwner,'head B: K1 mine');
assert(!get(dS,K1)||!get(dS,K1).isOwner,'staff: K1 not owner');
assert(!get(dA,K2)||!get(dA,K2).isOwner,'head A: K2 (HOWB) not mine');assert(get(dB,K2)&&get(dB,K2).isOwner,'head B: K2 mine');
// ---- 🏅 ชุดคะแนน: เลือกตัวชี้วัดนี้เข้าชุดของหัวหน้าได้ · แถวไม่ขึ้นว่า "ไม่ได้เป็นผู้รับผิดชอบแล้ว"
const cands=C.getScoreCandidates(tA,FY,'หัวหน้าทดสอบเอ');assert(cands.success&&cands.candidates.some(c=>c.id===K1),'score candidate K1 for head A');assert(!cands.candidates.some(c=>c.id===K2),'K2 not candidate for head A');
assert(C.saveKpiScore(tA,FY,{id:K1,owner:'หัวหน้าทดสอบเอ',isNew:true,weight:1,crit:['70','75','80','85','90','95','100'],r1:'',r2:'',note:''}).success);
const bd=C.getScoreBoard(tok(hA),FY);assert(bd.success&&bd.rows.some(r=>r.id===K1&&!r.stale),'score row not stale: '+JSON.stringify(bd.rows.map(r=>[r.id,r.stale])));
// ---- 👤 KPI รายบุคคล (getKpisOfPerson) เห็นตัวนี้
const kp=C.getKpisOfPerson(tA,FY,'หัวหน้าทดสอบเอ');assert(kp.success&&kp.data.some(k=>k.id===K1),'getKpisOfPerson includes K1');
// ---- ไม่สร้างบัญชีชื่อ "หัวหน้า…"
const before=U.length;const made=C.buildAccountsFromOwners_(C.readUsers_(h.sheets.Users));
assert(!made.some(u=>/หัวหน้า/.test(u.username)),'no account named หัวหน้า…: '+made.map(u=>u.username).filter(n=>/หัวหน้า/.test(n)));
// ---- รวมแถว (🔁 / 🧹): คำ "หัวหน้า…" ไม่หาย
const rowK=Array(39).fill('');rowK[25]='สมชาย / หัวหน้าหน่วย';rowK[4]='x';const rowD=Array(39).fill('');rowD[25]='สมหญิง / หัวหน้างาน / หัวหน้าตึก';rowD[4]='x';
const merged=C.tidyMergeRows_(rowK,rowD);eq(merged[25],'สมชาย / สมหญิง / หัวหน้างาน / หัวหน้าหน่วย / หัวหน้าตึก'.split(' / ').sort().join(' / ')===merged[25].split(' / ').sort().join(' / ')?merged[25]:'MISMATCH','merge keeps head words');
['หัวหน้าหน่วย','หัวหน้างาน','หัวหน้าตึก','สมชาย','สมหญิง'].forEach(n=>assert(merged[25].split(' / ').includes(n),'merged owner has '+n+': '+merged[25]));
console.log('headown1 ok');
