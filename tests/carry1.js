// ขึ้นปีงบใหม่: ดึงข้อความ SAR (PDCA) + CLT จากปีก่อนอัตโนมัติเป็นร่าง · ปุ่ม admin · ไม่ทับของที่กรอกแล้ว · ตัดตัวชี้วัดที่ไม่มีในปีใหม่ · ป้ายร่างหายเมื่อบันทึก/ยืนยัน
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const RealDate=Date;let fake=new RealDate('2026-10-25T03:00:00Z');
C.Date=class extends RealDate{constructor(...a){a.length?super(...a):super(fake)} static now(){return fake.getTime()}};
const U=h.sheets.Users.d;
const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),ex=pick('executive'),st=pick('staff');
[ad,ex,st].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tA=C.createSession_(ad[0],ad[1]),tE=C.createSession_(ex[0],ex[1]),tS=C.createSession_(st[0],st[1]);
const FY=2570,NEW=2571,D70='ร่างจากปีงบ 2570';
const docRows=(fy,doc)=>h.sheets.SAR_Doc.d.slice(1).filter(r=>r[0]===fy&&r[1]===doc);
const item=(fy,doc,key)=>docRows(fy,doc).find(r=>r[2]===key);

// ---- เตรียมข้อมูลปีงบ 2570
const core=C.getAllData(tA,FY).data.filter(k=>C.inCorePart_(k));const ids=[...new Set(core.map(k=>k.id))];assert(ids.length>=3);
const kp=C.getCltDoc(tA,FY).kpis.filter(k=>k.groups.includes('STEMI'));assert(kp.length>=2);const [pA,pB]=kp;
for(const [i,t] of [[0,'ปัญหาที่พบ ก'],[1,'ปัญหาที่พบ ข']])assert(C.saveSarPdca(tA,FY,ids[i],t,0).success);
assert(C.saveCltItem(tA,FY,'O|mission','พันธกิจ 2570',0).success);
assert(C.saveCltItem(tA,FY,'D|STEMI|context','บริบท STEMI',0).success);
assert(C.saveCltItem(tA,FY,'S|groups',JSON.stringify(['STEMI']),0).success);
assert(C.saveCltItem(tA,FY,'D|STEMI|driver',JSON.stringify([['P','p1','s1','c1',pA.id,pA.id+','+pB.id+',KPI-GONE','','KPI-GONE'],['P','p2','','',pA.id,'','','']]),0).success);
assert(C.saveCltItem(tA,FY,'D|STEMI|pm',JSON.stringify([['','ข้อกำหนด A','','อธิบาย',pA.id],['Care','ข้อกำหนดที่หายไป','','','KPI-GONE'],['กระบวนการเอง','ข้อกำหนดเอง','ตัวชี้วัดเอง','ออกแบบเอง','']]),0).success);
h.sheets.SAR_Doc.d.push([FY,'SAR','PDCA|NOPE-ID','ไม่มีในปีใหม่',1,'01/10/2570 00:00','x']); // ตัวชี้วัดที่ไม่มีในชีต

// ---- ไม่มีข้อมูลปีก่อน → ปุ่ม admin แจ้งว่าไม่มี (ปีงบ 2569 ไม่มีข้อความ SAR/CLT)
let r=C.carryOverDocsFromPrevious(tA,2569);assert(r.success&&r.sar===0&&r.clt===0&&/ยังไม่มีข้อความ/.test(r.message),JSON.stringify(r));

// ---- ขึ้นปีงบใหม่ (1 ต.ค. 2570): trigger สร้างชีตและดึงข้อความอัตโนมัติ
fake=new RealDate('2027-09-30T20:00:00Z');C.dailyFiscalYearCheck();
assert(h.sheets['ปีงบ '+NEW],'new year created');
const pdca=docRows(NEW,'SAR');assert.strictEqual(pdca.length,2,'only existing core kpis: '+pdca.map(x=>x[2]));
assert(pdca.every(x=>x[6]===D70&&x[4]===1),'drafts');assert(!item(NEW,'SAR','PDCA|NOPE-ID'));
assert.strictEqual(item(NEW,'SAR','PDCA|'+ids[0])[3],'ปัญหาที่พบ ก');
const clt=docRows(NEW,'CLT');['O|mission','D|STEMI|context','S|groups','D|STEMI|driver','D|STEMI|pm'].forEach(k=>{const x=item(NEW,'CLT',k);assert(x&&x[6]===D70,'carried '+k)});
const drv=JSON.parse(item(NEW,'CLT','D|STEMI|driver')[3]);
assert.deepStrictEqual(drv,[['P','p1','s1','c1',pA.id,pA.id+','+pB.id,'',''],['P','p2','','',pA.id,'','','']],'driver: removed kpi ids dropped '+JSON.stringify(drv));
const pm=JSON.parse(item(NEW,'CLT','D|STEMI|pm')[3]);
assert.deepStrictEqual(pm,[['','ข้อกำหนด A','','อธิบาย',pA.id],['กระบวนการเอง','ข้อกำหนดเอง','ตัวชี้วัดเอง','ออกแบบเอง','']],'pm: parked row of missing kpi dropped '+JSON.stringify(pm));
// ปีเก่าไม่เปลี่ยน
assert.strictEqual(item(FY,'CLT','D|STEMI|driver')[3].includes('KPI-GONE'),true);

// ---- หน้าเว็บเห็นเป็นร่าง
let d=C.getSarDoc(tA,NEW);assert(d.success&&d.pdca[ids[0]].by===D70);
let c=C.getCltDoc(tA,NEW);assert(c.items['O|mission'].by===D70);

// ---- บันทึก = ป้ายร่างหาย · ยืนยัน = ป้ายร่างหาย (rev+1) · ยืนยันซ้ำไม่เปลี่ยน
r=C.saveSarPdca(tA,NEW,ids[0],'ปัญหาที่พบ ก (ปรับ)',1);assert(r.success&&r.item.by===ad[0]&&r.item.rev===2,JSON.stringify(r));
r=C.confirmDocDraft(tA,NEW,'SAR','PDCA|'+ids[1]);assert(r.success&&r.changed&&r.item.by===ad[0]&&r.item.rev===2&&item(NEW,'SAR','PDCA|'+ids[1])[6]===ad[0],JSON.stringify(r));
r=C.confirmDocDraft(tA,NEW,'SAR','PDCA|'+ids[1]);assert(r.success&&!r.changed);
r=C.confirmDocDraft(tA,NEW,'CLT','O|mission');assert(r.success&&r.changed&&item(NEW,'CLT','O|mission')[6]===ad[0]);
r=C.confirmDocDraft(tS,NEW,'SAR','PDCA|'+ids[1]);assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message),'staff blocked');
r=C.confirmDocDraft(tA,NEW,'CLT','X|bad');assert(!r.success);r=C.confirmDocDraft(tA,NEW,'OTHER','x');assert(!r.success);
r=C.confirmDocDraft(tE,NEW,'CLT','S|groups');assert(!r.success&&/admin/.test(r.message),'executive cannot confirm admin key');

// ---- ปุ่ม admin: เฉพาะ admin · ไม่ทับที่กรอก/แก้แล้ว · เติมเฉพาะที่ว่าง
r=C.carryOverDocsFromPrevious(tE,NEW);assert(!r.success&&/admin/.test(r.message));
r=C.carryOverDocsFromPrevious(tS,NEW);assert(!r.success);
r=C.carryOverDocsFromPrevious(tA,NEW);assert(r.success&&r.sar===0&&r.clt===0&&/กรอกไว้แล้วทั้งหมด/.test(r.message),JSON.stringify(r));
assert.strictEqual(item(NEW,'SAR','PDCA|'+ids[0])[3],'ปัญหาที่พบ ก (ปรับ)','edited text kept');
// ข้อความในปีใหม่ว่าง → ดึงกลับมา (เฉพาะที่ว่าง)
item(NEW,'CLT','D|STEMI|context')[3]='';
const before=item(NEW,'CLT','O|mission')[3];
r=C.carryOverDocsFromPrevious(tA,NEW);assert(r.success&&r.clt===1&&r.sar===0&&r.sarFrom===FY&&r.cltFrom===FY,JSON.stringify(r));
assert.strictEqual(item(NEW,'CLT','D|STEMI|context')[3],'บริบท STEMI');assert.strictEqual(item(NEW,'CLT','D|STEMI|context')[6],D70);assert.strictEqual(item(NEW,'CLT','O|mission')[3],before);
// ปีงบก่อนมีข้อมูลทับซ้อน: ปีงบ 2570 เองก็ดึงจาก 2569 ไม่ได้เพราะไม่มีข้อมูล (ไม่ทับของ 2570)
r=C.carryOverDocsFromPrevious(tA,FY);assert(r.success&&r.sar===0&&r.clt===0);
assert.strictEqual(item(FY,'SAR','PDCA|'+ids[0])[3],'ปัญหาที่พบ ก');

// ---- ปุ่มคัดลอกของแต่ละคน (เดิม) ก็ทำเป็นร่างและตัดตัวชี้วัดที่ไม่มีในปีนั้น
item(NEW,'SAR','PDCA|'+ids[1])[3]='';
r=C.copySarPdcaFromPrevious(tA,NEW);assert(r.success&&r.copied===1&&item(NEW,'SAR','PDCA|'+ids[1])[6]===D70,JSON.stringify(r));
item(NEW,'CLT','D|STEMI|driver')[3]='';
r=C.copyCltFromPrevious(tA,NEW);assert(r.success&&r.copied===1&&item(NEW,'CLT','D|STEMI|driver')[6]===D70&&!item(NEW,'CLT','D|STEMI|driver')[3].includes('KPI-GONE'),JSON.stringify(r));

// ---- ขึ้นปีงบใหม่ซ้ำ ไม่ซ้ำซ้อน
fake=new RealDate(fake.getTime()+60000);C.dailyFiscalYearCheck();assert.strictEqual(docRows(NEW,'SAR').length,2);
console.log('carry1 OK');
