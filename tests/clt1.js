// CLT profile (SAR_Doc เอกสาร "CLT"): สิทธิ์ (admin/ผอ./หัวหน้า PCT), รายการตัวชี้วัด PCT จากเซิร์ฟเวอร์, ตรวจกุญแจ/ตาราง, แก้ชนกัน, อัปเดตอัตโนมัติ, คัดลอกจากปีงบก่อน
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;const FY=2570,PREV=2569;
const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),ex=pick('executive'),st=pick('staff'),hp=pick('head','PCT');
const hn=U.find(r=>r[2]==='head'&&!/(^|,)PCT(,|$)/.test(r[3]));
assert(hp&&hn,'need a PCT head and a non-PCT head');
[ad,ex,st,hp,hn].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const T=u=>C.createSession_(u[0],u[1]);const tA=T(ad),tE=T(ex),tS=T(st),tP=T(hp),tN=T(hn);

// ---- สิทธิ์
for(const [t,who] of [[tS,'staff'],[tN,'head non-PCT']]){let r=C.getCltDoc(t,FY);assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message),who+' blocked '+JSON.stringify(r));
  r=C.saveCltItem(t,FY,'O|mission','x',0);assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message),who+' cannot save');
  r=C.copyCltFromPrevious(t,FY);assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message),who+' cannot copy')}
for(const t of [tA,tE,tP]){const r=C.getCltDoc(t,FY);assert(r.success,JSON.stringify(r))}
assert(!h.sheets.SAR_Doc,'read does not create the sheet');

// ---- ตัวชี้วัด PCT จากเซิร์ฟเวอร์ (ผอ.เห็นเหมือน admin แม้หน้าเว็บของ ผอ. ไม่มีหมวด PCT)
const dA=C.getCltDoc(tA,FY),dE=C.getCltDoc(tE,FY),dP=C.getCltDoc(tP,FY);
const kp=dA.kpis;assert(kp.length>100,'pct kpis '+kp.length);
assert(JSON.stringify(dE.kpis.map(k=>k.id))===JSON.stringify(kp.map(k=>k.id))&&dP.kpis.length===kp.length,'same list for admin/exec/PCT head');
assert(kp.every(k=>k.id&&k.name&&Array.isArray(k.years)&&k.years.length===5&&Array.isArray(k.groups)&&k.groups.length>0&&typeof k.details==='string'),'shape');
const groups=[...new Set([].concat(...kp.map(k=>k.groups)))];console.log('groups',groups.length,groups.slice(0,5).join(' / '));assert(groups.includes('STEMI')&&groups.includes('DM'));
assert(!kp.some(k=>/ตัวย่อยของตัวชี้วัด รพ\. \(SAR\)/.test(k.details)),'import note stripped');
const exWeb=C.getAllData(tE,FY).data.find(k=>k.id===kp[0].id);console.log('exec web cats for first pct kpi:',JSON.stringify(exWeb&&exWeb.cats&&exWeb.cats.map(c=>c.part)));
const stemi=kp.find(k=>k.groups.includes('STEMI'));

// ---- บันทึก: ข้อความ / ตาราง / มิติ / กลุ่ม
let r=C.saveCltItem(tP,FY,'O|mission','พันธกิจ ๒๕๗๐\r\n  ดูแลผู้ป่วย  \n',0);assert(r.success&&r.changed&&r.item.rev===1&&r.item.by===hp[0]&&r.item.text==='พันธกิจ 2570\n  ดูแลผู้ป่วย',JSON.stringify(r));
const sh=h.sheets.SAR_Doc;assert(sh.d[1][1]==='CLT'&&sh.d[1][2]==='O|mission'&&sh.d[1][0]===FY);
r=C.saveCltItem(tP,FY,'O|clients',JSON.stringify([['ผู้ป่วยนอก','ตรวจครอบคลุม ๑๐๐%'],['',''],['  ','  '],['กลุ่ม  ','']]),0);
assert(r.success&&JSON.parse(r.item.text).length===2&&JSON.parse(r.item.text)[0][1]==='ตรวจครอบคลุม 100%'&&JSON.parse(r.item.text)[1][0]==='กลุ่ม','table cleaned: '+r.item.text);
r=C.saveCltItem(tP,FY,'O|priority','[]',0);assert(r.success&&r.item.text==='','empty table → empty string');
for(const [k,c] of [['O|nope','x'],['D|STEMI|nope','x'],['D|STEMI|R|NOPE-1','x'],['DIM|NOPE-1','A'],['X','x'],['O|mission|extra','x'],['D||context','x'],['D|'+'g'.repeat(101)+'|context','x'],[undefined,'x']]){
  r=C.saveCltItem(tA,FY,k,c,0);assert(!r.success&&/ไม่ถูกต้อง/.test(r.message),'bad key '+k+': '+JSON.stringify(r))}
r=C.saveCltItem(tA,FY,'O|risks','not json',0);assert(!r.success&&/ตาราง/.test(r.message));
r=C.saveCltItem(tA,FY,'O|risks','{"a":1}',0);assert(!r.success);
r=C.saveCltItem(tA,FY,'O|risks',JSON.stringify([[1,2]]),0);assert(r.success&&r.item.text==='','non-string cells dropped → empty row removed');
r=C.saveCltItem(tA,FY,'O|risks',JSON.stringify(Array(301).fill(['a'])),0);assert(!r.success);
r=C.saveCltItem(tA,FY,'O|risks',JSON.stringify([['a','b','c','d','e','f','g','h','i']]),0);assert(!r.success);
r=C.saveCltItem(tA,FY,'O|mission','ก'.repeat(45001),1);assert(!r.success&&/ยาวเกิน/.test(r.message));
// ผลลัพธ์/มิติของตัวชี้วัดที่มีจริง
r=C.saveCltItem(tP,FY,'D|STEMI|R|'+stemi.id,'ผลลัพธ์ STEMI',0);assert(r.success&&r.item.rev===1,JSON.stringify(r));
r=C.saveCltItem(tP,FY,'DIM|'+stemi.id,'b',0);assert(r.success&&r.item.text==='B','dim uppercased');
r=C.saveCltItem(tP,FY,'DIM|'+stemi.id,'Z',1);assert(!r.success&&/มิติ/.test(r.message));
r=C.saveCltItem(tP,FY,'DIM|'+stemi.id,'',1);assert(r.success&&r.item.text===''&&r.item.rev===2,'clear dim');
r=C.saveCltItem(tP,FY,'S|groups',JSON.stringify(['STEMI','DM']),0);assert(r.success);
r=C.saveCltItem(tP,FY,'S|groups',JSON.stringify(['a|b']),1);assert(!r.success&&/กลุ่ม/.test(r.message));
r=C.saveCltItem(tP,FY,'D|จิตเวช ซึมเศร้า/ฆ่าตัวตาย|context','มีเครื่องหมาย / ในชื่อกลุ่ม',0);assert(r.success);
const doc=C.getCltDoc(tE,FY);assert(doc.items['O|mission'].text==='พันธกิจ 2570\n  ดูแลผู้ป่วย'&&doc.items['D|STEMI|R|'+stemi.id].rev===1&&doc.items['D|จิตเวช ซึมเศร้า/ฆ่าตัวตาย|context']);

// ---- แก้ชนกัน
r=C.saveCltItem(tE,FY,'O|mission','ผอ.แก้ก่อน',1);assert(r.success&&r.item.rev===2);
r=C.saveCltItem(tP,FY,'O|mission','หัวหน้า PCT (รุ่นเก่า)',1);assert(!r.success&&r.conflict&&r.current.text==='ผอ.แก้ก่อน'&&r.current.rev===2&&r.current.by===ex[0]&&/ถูกแก้ไขโดย/.test(r.message),JSON.stringify(r));
assert(C.getCltDoc(tA,FY).items['O|mission'].text==='ผอ.แก้ก่อน','nothing written on conflict');
r=C.saveCltItem(tP,FY,'O|mission','หัวหน้า PCT ทับ',1,true);assert(r.success&&r.item.rev===3);
r=C.saveCltItem(tP,FY,'O|mission','หัวหน้า PCT ทับ',3);assert(r.success&&!r.changed,'unchanged');

// ---- อัปเดตอัตโนมัติ + แยกเอกสาร SAR/CLT
const vb=C.pollChanges(tA,FY,-1).v;
C.saveCltItem(tP,FY,'O|scope','ขอบเขต',0);let p=C.pollChanges(tA,FY,vb);assert(p.success&&!p.full&&p.kpis.length===0&&p.docs.length===1&&p.docs[0]==='CLT',JSON.stringify(p.docs));
const vb2=p.v;assert(C.pollChanges(tA,FY,vb2).same);
const core=C.getAllData(tA,FY).data.find(k=>C.inCorePart_(k));C.saveSarPdca(tA,FY,core.id,'pdca',0);p=C.pollChanges(tA,FY,vb2);assert(p.docs.length===1&&p.docs[0]==='SAR');
assert(!Object.keys(C.getSarDoc(tA,FY).pdca).some(k=>/^O\|/.test(k))&&Object.keys(C.getSarDoc(tA,FY).pdca).length===1,'SAR does not see CLT rows');
assert(!C.getCltDoc(tA,FY).items['PDCA|'+core.id],'CLT does not see SAR rows');
p=C.pollChanges(tA,FY,123456789);assert(p.full&&p.docs.includes('SAR')&&p.docs.includes('CLT'));

// ---- คัดลอกจากปีงบก่อน
assert(!Object.keys(C.getCltDoc(tA,PREV).items).length,'2569 empty');
const k69=C.getCltDoc(tA,PREV).kpis;assert(k69.length>100);
C.saveCltItem(tA,PREV,'O|mission','พันธกิจปี 69',0);C.saveCltItem(tA,PREV,'O|focus','จุดเน้นปี 69',0);
C.saveCltItem(tA,PREV,'D|STEMI|R|'+k69.find(k=>k.groups.includes('STEMI')).id,'ผลลัพธ์ STEMI ปี 69',0);
C.saveCltItem(tA,PREV,'O|qi',JSON.stringify([['เดิม','ปี 69']]),0);
const dm69=k69.find(k=>k.groups.includes('DM'));C.saveCltItem(tA,PREV,'D|DM|R|'+dm69.id,'ผลลัพธ์ DM ปี 69',0);
// ปีงบนี้ (2570) มี mission และผลลัพธ์ STEMI แล้ว → ไม่ทับ · focus / qi / ผลลัพธ์ DM ยังว่าง → เติม
const n0=h.sheets.SAR_Doc.d.length;
r=C.copyCltFromPrevious(tP,FY);assert(r.success&&r.from===PREV&&r.copied===3&&/คัดลอก/.test(r.message),JSON.stringify(r));
let d=C.getCltDoc(tA,FY).items;assert(d['O|mission'].text==='หัวหน้า PCT ทับ'&&d['O|focus'].text==='จุดเน้นปี 69'&&d['O|focus'].rev===1&&JSON.parse(d['O|qi'].text)[0][0]==='เดิม'&&d['D|DM|R|'+dm69.id].text==='ผลลัพธ์ DM ปี 69'&&d['D|STEMI|R|'+stemi.id].text==='ผลลัพธ์ STEMI','copy fills only empty');
assert(d['O|priority']===undefined||d['O|priority'].text==='','empty ones not copied');
r=C.copyCltFromPrevious(tP,FY);assert(r.success&&r.copied===0,'second copy: nothing');
assert(!C.copyCltFromPrevious(tA,PREV).success,'no earlier year');
// ปีงบก่อนมีตัวชี้วัดที่ปีนี้ไม่มี → ข้าม
h.sheets.SAR_Doc.d.push([PREV,'CLT','D|STEMI|R|KPI-GONE',  'ของตัวที่หายไป',1,'x','y'],[PREV,'CLT','DIM|KPI-GONE','C',1,'x','y']);
r=C.copyCltFromPrevious(tA,FY);assert(r.success&&r.copied===0,'unknown kpis skipped');
assert(!Object.keys(C.getCltDoc(tA,FY).items).some(k=>/GONE/.test(k)));
console.log('ALL OK');
