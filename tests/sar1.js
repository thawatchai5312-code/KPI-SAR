// SAR_Doc: สรุป PDCA ต่อตัวชี้วัด (สิทธิ์ตาม tier/หน่วย, แก้ชนกัน, อัปเดตอัตโนมัติ, คัดลอกจากปีงบก่อน, ปีงบแยกกัน)
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;
const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),ex=pick('executive'),st=pick('staff');
[ad,ex,st].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tA=C.createSession_(ad[0],ad[1]),tE=C.createSession_(ex[0],ex[1]),tS=C.createSession_(st[0],st[1]);
const FY=2570,PREV=2569;
const core=k=>C.inCorePart_(k);

// ---- สิทธิ์ใช้หน้านี้: staff ใช้ไม่ได้
let r=C.getSarDoc(tS,FY);assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message),'staff blocked: '+JSON.stringify(r));
r=C.saveSarPdca(tS,FY,'x','y');assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message));
r=C.getSarDoc('bad-token',FY);assert(!r.success&&/SESSION_EXPIRED/.test(r.message));
// ยังไม่มีชีต → ว่าง ไม่สร้างชีตตอนอ่าน
r=C.getSarDoc(tA,FY);assert(r.success&&Object.keys(r.pdca).length===0&&r.fy===FY);assert(!h.sheets.SAR_Doc,'read does not create the sheet');

// ---- admin บันทึก
const all=C.getAllData(tA,FY).data;const coreK=all.filter(core);assert(coreK.length>50,'core kpis '+coreK.length);
const k1=coreK[0],k2=coreK[1],k3=coreK[2];
const nonCore=all.find(k=>!core(k));assert(nonCore);
r=C.saveSarPdca(tA,FY,k1.id,'ปัญหาที่พบ ๒๕๖๙ ตก   \r\nการพัฒนา\t \n\n',0);
assert(r.success&&r.changed&&r.item.rev===1&&r.item.by===ad[0]&&/\d\d\/\d\d\/25\d\d \d\d:\d\d/.test(r.item.at),JSON.stringify(r));
assert(r.item.text==='ปัญหาที่พบ 2569 ตก\nการพัฒนา','digits arabic, trailing spaces trimmed: '+JSON.stringify(r.item.text));
const sh=h.sheets.SAR_Doc;assert(sh,'sheet created on first write');
assert.deepStrictEqual(sh.d[0],['ปีงบ','เอกสาร','กุญแจ','เนื้อหา','รุ่น','แก้ไขล่าสุดเมื่อ','แก้ไขล่าสุดโดย']);
assert(sh.d[1][0]===FY&&sh.d[1][1]==='SAR'&&sh.d[1][2]==='PDCA|'+k1.id&&sh.d[1][4]===1,JSON.stringify(sh.d[1]));
r=C.getSarDoc(tA,FY);assert(r.success&&r.pdca[k1.id].text==='ปัญหาที่พบ 2569 ตก\nการพัฒนา'&&r.pdca[k1.id].rev===1);
assert.strictEqual(Object.keys(r.pdca).length,1);
// ไม่ใช่ Part I–IV / ไม่มีรหัส
r=C.saveSarPdca(tA,FY,nonCore.id,'x',0);assert(!r.success&&/Part I–IV/.test(r.message),JSON.stringify(r));
r=C.saveSarPdca(tA,FY,'NOPE-1','x',0);assert(!r.success);
// ยาวเกิน
r=C.saveSarPdca(tA,FY,k1.id,'ก'.repeat(45001),1);assert(!r.success&&/ยาวเกิน/.test(r.message));

// ---- แก้ชนกัน (baseRev)
r=C.saveSarPdca(tE,FY,k1.id,'ของ ผอ. แก้ก่อน',1);assert(r.success&&r.item.rev===2&&r.item.by===ex[0],JSON.stringify(r));
r=C.saveSarPdca(tA,FY,k1.id,'ของ admin (รุ่นเก่า)',1);assert(!r.success&&r.conflict&&r.current.text==='ของ ผอ. แก้ก่อน'&&r.current.rev===2&&r.current.by===ex[0]&&/ถูกแก้ไขโดย/.test(r.message),JSON.stringify(r));
assert(C.getSarDoc(tA,FY).pdca[k1.id].text==='ของ ผอ. แก้ก่อน','conflict wrote nothing');
r=C.saveSarPdca(tA,FY,k1.id,'ของ admin (บันทึกทับ)',1,true);assert(r.success&&r.item.rev===3&&r.item.text==='ของ admin (บันทึกทับ)','force overwrites');
r=C.saveSarPdca(tA,FY,k1.id,'ของ admin (บันทึกทับ)',3);assert(r.success&&!r.changed&&r.item.rev===3,'unchanged → no new rev');
// ล้างข้อความ = เก็บแถวไว้ รุ่นเพิ่ม (ให้คนอื่นยังรู้รุ่นล่าสุด)
r=C.saveSarPdca(tA,FY,k1.id,'  \n ',3);assert(r.success&&r.changed&&r.item.text===''&&r.item.rev===4,JSON.stringify(r));
let g=C.getSarDoc(tA,FY);assert(g.pdca[k1.id].rev===4&&g.pdca[k1.id].text==='','cleared row still reports rev');
r=C.saveSarPdca(tA,FY,k1.id,'กลับมามีข้อความ',4);assert(r.success&&r.item.rev===5);

// ---- อัปเดตอัตโนมัติ: ids ว่าง + doc
const vb=C.pollChanges(tA,FY,-1).v;
r=C.saveSarPdca(tA,FY,k2.id,'PDCA ตัวที่ 2',0);assert(r.success);
let p=C.pollChanges(tA,FY,vb);assert(p.success&&!p.same&&!p.full&&p.kpis.length===0&&p.removed.length===0&&p.docs.length===1&&p.docs[0]==='SAR'&&p.by[0]===ad[0],JSON.stringify({s:p.success,f:p.full,d:p.docs,k:p.kpis&&p.kpis.length}));
const vb2=p.v;r=C.saveSarPdca(tA,FY,k2.id,'PDCA ตัวที่ 2',1);assert(C.pollChanges(tA,FY,vb2).same,'unchanged save does not bump');
// ปีงบอื่น: ไม่แจ้งปีงบนี้
const vb3=C.pollChanges(tA,FY,-1).v;C.saveSarPdca(tA,PREV,k3.id,'ข้อความของปีงบ 2569',0);
assert(C.pollChanges(tA,FY,vb3).same,'other fy → same');p=C.pollChanges(tA,PREV,vb3);assert(!p.same&&p.docs[0]==='SAR');
// แก้ตัวชี้วัดปกติ → docs ว่าง
const vb4=C.pollChanges(tA,FY,-1).v;const kk=all.find(k=>k.canEditResults);C.saveKpi(tA,FY,{id:kk.id,target:(kk.target||'')+'1',baseRev:kk.rev});
p=C.pollChanges(tA,FY,vb4);assert(p.kpis.length===1&&p.docs.length===0,'kpi edit has no docs');
// ดึงทั้งปีงบ → docs ถือว่าเปลี่ยน
p=C.pollChanges(tA,FY,123456789);assert(p.full&&p.docs[0]==='SAR');

// ---- ปีงบแยกกัน
g=C.getSarDoc(tA,PREV);assert(g.pdca[k3.id]&&Object.keys(g.pdca).length===1,'2569 has only its own');
g=C.getSarDoc(tA,FY);assert(!g.pdca[k3.id]&&g.pdca[k1.id]&&g.pdca[k2.id],'2570 has its own');

// ---- หัวหน้าหน่วย: แก้ได้เฉพาะตัวของหน่วยตัวเอง
const heads=U.filter(u=>u[2]==='head');let own=null,other=null,tH=null,head=null;
for(const hd of heads){hd[1]=C.hashPassword_('pw123456');hd[4]='FALSE';const t=C.createSession_(hd[0],hd[1]);const d=C.getAllData(t,FY).data.filter(core);
  const a=d.find(k=>k.canEditDetails),b=d.find(k=>!k.canEditDetails);if(a&&b){own=a;other=b;tH=t;head=hd;break}}
assert(head,'found a head with both editable and view-only core kpis');
r=C.saveSarPdca(tH,FY,own.id,'หัวหน้าเขียนของหน่วยตัวเอง',(C.getSarDoc(tH,FY).pdca[own.id]||{rev:0}).rev);assert(r.success&&r.item.by===head[0],JSON.stringify(r));
r=C.saveSarPdca(tH,FY,other.id,'ข้ามหน่วย',0);assert(!r.success&&/ไม่มีสิทธิ์แก้ไข/.test(r.message),JSON.stringify(r));
// หัวหน้าไม่เห็น PDCA ของตัวที่ตัวเองดูไม่ได้ (ตัว Part I–IV ระดับ QA-หน่วยงานของหน่วยอื่น — ข้อมูลจริงทุกตัวเป็นระดับ SAR จึงสร้างตัวทดสอบ)
const myDepts=String(head[3]).split(',').map(x=>x.trim());
const otherDept=U.filter(u=>u[2]==='head').map(u=>String(u[3]).split(',')[0].trim()).find(d=>d&&myDepts.indexOf(d)===-1);assert(otherDept);
const ar=C.addIndicator(tA,FY,{name:'ตัวทดสอบ QA หน่วยอื่น',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['QA-หน่วยงาน'],department:otherDept,cats:[{part:'Part II',category:'II-4 การป้องกันและควบคุมการติดเชื้อ'}]});assert(ar.success,ar.message);
assert(!C.getAllData(tH,FY).data.some(k=>k.id===ar.newId),'head cannot see the QA-only kpi of another unit');
r=C.saveSarPdca(tA,FY,ar.newId,'ลับเฉพาะหน่วยอื่น',0);assert(r.success,JSON.stringify(r));
assert(!C.getSarDoc(tH,FY).pdca[ar.newId],'hidden kpi pdca not leaked');assert(C.getSarDoc(tA,FY).pdca[ar.newId],'admin sees it');
r=C.saveSarPdca(tH,FY,ar.newId,'ลองเขียน',0);assert(!r.success&&/ไม่พบตัวชี้วัด|ไม่มีสิทธิ์/.test(r.message),'head cannot write hidden kpi: '+JSON.stringify(r));

// ---- ผอ./QMR: แก้ได้ทุกตัว Part I–IV ระดับ SAR/QA ที่เห็น
const eK=C.getAllData(tE,FY).data.filter(core);assert(eK.length>0&&eK.every(k=>k.canEditDetails||true));
const eEdit=eK.find(k=>k.canEditDetails);r=C.saveSarPdca(tE,FY,eEdit.id,'ผอ.เขียน',(C.getSarDoc(tE,FY).pdca[eEdit.id]||{rev:0}).rev);assert(r.success,JSON.stringify(r));

// ---- คัดลอกจากปีงบก่อน (admin): 2569 มี k3 เท่านั้น → 2570 ได้ k3 เป็นร่าง
C.saveSarPdca(tA,PREV,k2.id,'ร่างปี 69 ของ k2',0);   // 2570 มีข้อความของ k2 แล้ว → ต้องไม่ถูกทับ
r=C.copySarPdcaFromPrevious(tA,FY);assert(r.success&&r.from===PREV&&r.copied===1&&/คัดลอก/.test(r.message),JSON.stringify(r));
g=C.getSarDoc(tA,FY);assert(g.pdca[k3.id].text==='ข้อความของปีงบ 2569'&&g.pdca[k3.id].rev===1,'copied as draft');assert(g.pdca[k2.id].text==='PDCA ตัวที่ 2','existing not overwritten');
r=C.copySarPdcaFromPrevious(tA,FY);assert(r.success&&r.copied===0,'second run copies nothing');
// ปีงบแรกสุด/ไม่มีข้อมูลก่อนหน้า
r=C.copySarPdcaFromPrevious(tA,PREV);assert(!r.success&&/ยังไม่มี/.test(r.message),JSON.stringify(r));
// staff คัดลอกไม่ได้
r=C.copySarPdcaFromPrevious(tS,FY);assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message));
// หัวหน้าคัดลอกเฉพาะตัวที่ตัวเองแก้ได้: ใส่ PDCA ปี 69 ให้ own/other แล้วลบของปี 70 ไม่ได้ → ตรวจผ่านปีงบใหม่สมมติ
C.saveSarPdca(tA,PREV,own.id,'ร่างปี 69 ของ own',0);C.saveSarPdca(tA,PREV,other.id,'ร่างปี 69 ของ other',0);
const before=Object.keys(C.getSarDoc(tA,FY).pdca).length;
r=C.copySarPdcaFromPrevious(tH,FY);assert(r.success,JSON.stringify(r));
g=C.getSarDoc(tA,FY);assert(!g.pdca[other.id]||g.pdca[other.id].text!=='ร่างปี 69 ของ other','head cannot copy into kpis outside own unit');
console.log('ALL OK');
