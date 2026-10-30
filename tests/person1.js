// KPI รายบุคคล (หน้าสรุปรายงาน): getKpisOfPerson — เฉพาะหัวหน้าขึ้นไป · ครบทุกตัวของคนนั้น (ข้ามหน่วย/ระดับ) · ดูอย่างเดียว · getDirectory ส่งรายชื่อหัวหน้า
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const ad=U.find(r=>r[2]==='admin'),st=U.find(r=>r[2]==='staff'),hd=U.find(r=>r[2]==='head'),ex=U.find(r=>r[2]==='executive');
const tA=tok(ad);
const all=C.getAllData(tA,2570).data;
// คนที่เป็นผู้รับผิดชอบหลายตัว
const cnt={};all.forEach(k=>C.parseOwners_(k.owner).forEach(n=>{cnt[n]=(cnt[n]||0)+1}));
const who=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).find(n=>U.some(r=>r[0]===n&&r[2]==='staff'))||Object.keys(cnt)[0];assert(who,'owner');
const want=all.filter(k=>C.parseOwners_(k.owner).indexOf(who)!==-1).map(k=>k.id).sort();
// หัวหน้า/ผอ./admin ใช้ได้ · เจ้าหน้าที่ไม่ได้
for(const r of [hd,ex,ad]){const res=C.getKpisOfPerson(tok(r),2570,who);assert(res.success,r[2]+' '+JSON.stringify(res).slice(0,120));
  const got=res.data.map(k=>k.id).sort();
  for(const id of want)assert(got.includes(id),r[2]+' sees every KPI of the person (cross-unit)');
  res.data.forEach(k=>{assert.strictEqual(k.canEditResults,false);assert.strictEqual(k.canEditDetails,false);assert.strictEqual(k.mine,false);assert(k.cats&&k.cats.length>0&&k.part===k.cats[0].part,'cats full');});}
assert(!C.getKpisOfPerson(tok(st),2570,who).success,'staff denied');
assert(!C.getKpisOfPerson('bad',2570,who).success,'bad token');
assert(!C.getKpisOfPerson(tA,2570,'  ').success,'empty name');
const none=C.getKpisOfPerson(tA,2570,'ไม่มีคนนี้');assert(none.success&&none.data.length===0,'unknown name → empty');
// ผู้ใช้ head: ตัวที่ผู้รับผิดชอบเขียน "หัวหน้าหน่วย" นับเป็นของหัวหน้าที่หน่วยตรงกัน
const dep=C.parseDepts_(hd[3].toString().split(',')[0])[0]||hd[3].toString().split(',')[0].trim();
const tokKpi=all.find(k=>/(^|\/)\s*หัวหน้าหน่วย\s*(\/|$)/.test(String(k.owner||''))&&C.parseDepts_(k.department).some(d=>hd[3].toString().split(',').map(x=>x.trim()).includes(d)));
if(tokKpi){const res=C.getKpisOfPerson(tA,2570,hd[0]);assert(res.data.some(k=>k.id===tokKpi.id),'หัวหน้าหน่วย token counts for the head of that unit');}
// getDirectory: heads
const d=C.getDirectory(tA);assert(d.success&&Array.isArray(d.heads)&&d.heads.includes(hd[0])&&!d.heads.includes(st[0])&&d.heads.length===U.filter(r=>r[2]==='head').length,'directory heads');
const sorted=d.heads.slice().sort((a,b)=>String(a).localeCompare(String(b),'th'));assert.strictEqual(JSON.stringify(d.heads),JSON.stringify(sorted),'heads sorted');
console.log('person1 ok');
