// วิธีสรุปผลรายเดือน + ความถี่การเก็บข้อมูล: แก้ได้ตามสิทธิ์ editDetails (ไม่ใช่แค่ admin/ผอ./QMR) · ไม่มีสิทธิ์ = ปฏิเสธพร้อมเหตุผล ไม่เขียนชีต · ระดับยังเฉพาะ admin/ผอ./QMR
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const U=h.sheets.Users.d;
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const tA=tok(U.find(r=>r[2]==='admin'));
const Y=fy=>h.sheets['ปีงบ '+fy].d;
const rowOf=(fy,id)=>Y(fy).slice(1).find(r=>String(r[0]).trim()===id);
const SC=C.SUMMARY_COL-1,FC=C.FREQ_COL-1;
// หาเจ้าหน้าที่ที่เป็นผู้รับผิดชอบตัวหนึ่ง (แก้รายละเอียดได้ ทั้ง 2569/2570) + ตัวที่ดูได้แต่แก้ไม่ได้
let S=null,own=null,ro=null;
for(const r of U.slice(1).filter(x=>x[2]==='staff')){
  const t=tok(r),d=C.getAllData(t,2570).data,o=d.find(k=>k.canEditDetails&&k.canEditResults&&rowOf(2569,k.id)&&(k.summaryMethod||'เฉลี่ย')==='เฉลี่ย'&&(k.frequency||'รายเดือน')==='รายเดือน'),v=d.find(k=>!k.canEditDetails);
  if(o&&v){S=r;own=o;ro=v;break}
}
assert(S&&own&&ro,'fixture: staff with own + read-only kpi');
const tS=tok(S);
const cur=id=>C.getAllData(tS,2570).data.find(k=>k.id===id);

// 1) เจ้าของ (staff) เปลี่ยนวิธีสรุป + ความถี่ได้
let r=C.saveKpi(tS,2570,{id:own.id,summaryMethod:'ผลรวม',frequency:'รายไตรมาส',baseRev:own.rev});
assert(r.success&&r.changed,JSON.stringify(r));
eq([rowOf(2570,own.id)[SC],rowOf(2570,own.id)[FC]],['ผลรวม','รายไตรมาส'],'sheet columns');
eq([cur(own.id).summaryMethod,cur(own.id).frequency],['ผลรวม','รายไตรมาส']);
// 2) ส่งค่าเดิม/ค่าที่ไม่อยู่ในรายการ → ไม่ error ไม่เปลี่ยน
r=C.saveKpi(tS,2570,{id:own.id,summaryMethod:'ผลรวม',frequency:'รายไตรมาส'});assert(r.success&&!r.changed,'same values = unchanged '+JSON.stringify(r));
r=C.saveKpi(tS,2570,{id:own.id,summaryMethod:'ค่ามั่ว',frequency:'ทุกวัน'});assert(r.success&&!r.changed,'invalid values ignored');
eq([rowOf(2570,own.id)[SC],rowOf(2570,own.id)[FC]],['ผลรวม','รายไตรมาส'],'invalid ignored');
// 3) ตัวที่ดูได้แต่แก้ไม่ได้ → ปฏิเสธ + ชีตไม่เปลี่ยน
const before=[rowOf(2570,ro.id)[SC],rowOf(2570,ro.id)[FC]],rev0=C.rowRev_(rowOf(2570,ro.id));
r=C.saveKpi(tS,2570,{id:ro.id,summaryMethod:'เดือนล่าสุด'});assert(r.success===false&&/ไม่มีสิทธิ์แก้ไขวิธีสรุปผล/.test(r.message),JSON.stringify(r));
r=C.saveKpi(tS,2570,{id:ro.id,frequency:'รายปี'});assert(r.success===false&&/ไม่มีสิทธิ์แก้ไขวิธีสรุปผล/.test(r.message),JSON.stringify(r));
eq([rowOf(2570,ro.id)[SC],rowOf(2570,ro.id)[FC]],before,'read-only kpi untouched');assert.strictEqual(C.rowRev_(rowOf(2570,ro.id)),rev0);
// 4) ระดับ: staff ยังแก้ไม่ได้ (เมินเงียบ ๆ เหมือนเดิม) · admin แก้วิธีสรุปได้เหมือนเดิม
const lv0=rowOf(2570,own.id)[C.LEVEL_COLUMN-1];
r=C.saveKpi(tS,2570,{id:own.id,levels:['SAR']});assert(r.success);eq(rowOf(2570,own.id)[C.LEVEL_COLUMN-1],lv0,'staff cannot change levels');
r=C.saveKpi(tA,2570,{id:own.id,summaryMethod:'เดือนล่าสุด'});assert(r.success&&r.changed,JSON.stringify(r));eq(rowOf(2570,own.id)[SC],'เดือนล่าสุด','admin still can');
// 5) ส่งต่อปีถัดไป: ปีที่ใหม่กว่าเปลี่ยนตาม (ตามสิทธิ์ในปีนั้น)
{
  const o2=C.getAllData(tS,2569).data.find(k=>k.id===own.id&&k.canEditDetails);
  if(o2){
    const row70=rowOf(2570,own.id);row70[SC]='เฉลี่ย';row70[FC]='รายเดือน';rowOf(2569,own.id)[SC]='เฉลี่ย';rowOf(2569,own.id)[FC]='รายเดือน';
    const f=C.saveKpi(tS,2569,{id:own.id,summaryMethod:'ผลรวม',forward:true});assert(f.success&&f.changed,JSON.stringify(f));
    eq(f.docs.forward.map(x=>[x.fy,x.ok]),[[2570,true]],'forward ok');
    eq(rowOf(2570,own.id)[SC],'ผลรวม','2570 follows');eq(rowOf(2569,own.id)[SC],'ผลรวม');
  } else console.log('no editable 2569 for staff — skip forward check');
}
// 6) rowRev เปลี่ยน → แก้ชนกันตรวจได้ (baseRev เก่า)
{
  const k=cur(own.id);const stale=k.rev;C.saveKpi(tA,2570,{id:own.id,frequency:'รายปี'});
  const rr=C.saveKpi(tS,2570,{id:own.id,summaryMethod:'เฉลี่ย',baseRev:stale});assert(rr.success===false&&rr.conflict===true,'conflict detected '+JSON.stringify(rr).slice(0,120));
}
console.log('sum1 ok');
