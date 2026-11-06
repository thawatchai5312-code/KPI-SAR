// บันทึกข้อมูล: ข้อความไม่ถูกชีตแปลงชนิด (ชื่อ/เป้าหมาย/รายละเอียด/ที่มา/ผู้รับผิดชอบ/หน่วยงาน — ตอนบันทึกและตอนเพิ่ม) + ไม่เขียนค่าเดิมซ้ำ (กันแก้ชนหลอก)
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const FY=2570;
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tA=C.createSession_(U.find(r=>r[2]==='admin')[0],U.find(r=>r[2]==='admin')[1]);
const sh=h.sheets['ปีงบ '+FY],Y=()=>sh.d;
const rowNo=id=>Y().findIndex(r=>String(r[0]).trim()===id)+1;   // เลขแถวในชีต (เริ่ม 1)
const conv=(rn)=>sh.autoConv.filter(x=>x.r===rn);
const ver=()=>C.dataVersion_(C.readChangeLog_());
const pick=()=>C.getAllData(tA,FY).data.find(k=>k.canEditResults&&k.canEditDetails&&k.months.every(v=>v===null));
// ===== 1) บันทึกชื่อ/เป้าหมาย/รายละเอียด/ที่มา ที่หน้าตาเหมือนสูตร/ร้อยละ/วันที่ → เก็บเป็นข้อความ
{
  const k=pick();assert(k,'kpi');const rn=rowNo(k.id);sh.autoConv.length=0;
  const r=C.saveKpi(tA,FY,{id:k.id,name:'= ทดสอบชื่อ',target:'80%',templateDetails:'=รายละเอียด\n+บรรทัดสอง',dataSource:'1/2'});assert(r.success&&r.changed,JSON.stringify(r));
  eq([Y()[rn-1][4],Y()[rn-1][5],Y()[rn-1][23],Y()[rn-1][24]],['= ทดสอบชื่อ','80%','=รายละเอียด\n+บรรทัดสอง','1/2']);
  eq(conv(rn),[],'name/target/details/source written as text (no auto-conversion): '+JSON.stringify(conv(rn)));
  [5,6,24,25].forEach(c=>assert.strictEqual(sh.fmt[rn+','+c],'@','format @ on col '+c));
}
// ===== 2) บันทึกผลอย่างเดียว: ไม่เขียนรายละเอียด/ที่มาซ้ำ (ข้อความดิบที่เป็นสูตรอยู่ในชีตไม่ถูกแตะ) · ไม่ตั้งรูปแบบซ้ำ
{
  const k=pick();const rn=rowNo(k.id);
  Y()[rn-1][23]='=ข้อความดิบ';Y()[rn-1][24]='3/4';delete sh.fmt[rn+',24'];delete sh.fmt[rn+',25'];sh.autoConv.length=0;
  const cur=C.getAllData(tA,FY).data.find(x=>x.id===k.id);
  const months=Array(12).fill(null);months[0]=55;
  const r=C.saveKpi(tA,FY,{id:k.id,years:cur.years,months:months,templateDetails:cur.templateDetails,dataSource:cur.dataSource,baseRev:cur.rev});assert(r.success&&r.changed,JSON.stringify(r));
  eq([Y()[rn-1][23],Y()[rn-1][24],Y()[rn-1][11]],['=ข้อความดิบ','3/4',55],'details/source untouched when only results change');
  eq(sh.fmt[rn+',24'],undefined,'details cell format not touched');eq(conv(rn),[],'no conversion');
}
// ===== 3) กดบันทึกโดยไม่เปลี่ยนอะไร (ค่าเดิมในชีตเป็นข้อความรูปแบบอื่น) → ไม่เขียนทับ รุ่นแถวไม่เปลี่ยน ไม่ bump → เครื่องอื่นไม่ขึ้นแก้ชนหลอก
{
  const k=pick();const rn=rowNo(k.id);
  Y()[rn-1][11]='1,234';Y()[rn-1][12]='80%';   // ผลเดิมในชีตเก็บเป็นข้อความ
  const cur=C.getAllData(tA,FY).data.find(x=>x.id===k.id);eq([cur.months[0],cur.months[1]],[1234,80]);
  const v0=ver(),rev0=cur.rev;
  const r=C.saveKpi(tA,FY,{id:k.id,years:cur.years,months:cur.months,templateDetails:cur.templateDetails,dataSource:cur.dataSource,baseRev:rev0});
  assert(r.success&&r.changed===false,JSON.stringify(r));
  eq([Y()[rn-1][11],Y()[rn-1][12]],['1,234','80%'],'raw cells not rewritten');
  assert.strictEqual(C.getAllData(tA,FY).data.find(x=>x.id===k.id).rev,rev0,'row rev unchanged');assert.strictEqual(ver(),v0,'no bump when nothing changed');
  // เครื่องอื่นที่ถือรุ่นเดิมบันทึกต่อ ต้องไม่ชน
  const r2=C.saveKpi(tA,FY,{id:k.id,years:cur.years,months:cur.months,baseRev:rev0});assert(r2.success&&!r2.conflict,'no false conflict: '+JSON.stringify(r2).slice(0,120));
}
// ===== 4) แถวเปลี่ยนจริงแต่ไม่นับเป็นการแก้ (เลขไทยในรายละเอียดถูกแปลงเป็นอารบิก) → แจ้งเครื่องอื่น (bump) แต่ไม่ลงเวลาแก้ไข
{
  const k=pick();const rn=rowNo(k.id);Y()[rn-1][23]='ร้อยละ ๘๐ ของผู้ป่วย';const by0=Y()[rn-1][C.STAMP_EDIT_BY_COL-1];
  const cur=C.getAllData(tA,FY).data.find(x=>x.id===k.id);const v0=ver();
  const r=C.saveKpi(tA,FY,{id:k.id,templateDetails:'ร้อยละ 80 ของผู้ป่วย',dataSource:cur.dataSource,baseRev:cur.rev});assert(r.success&&r.changed===false,JSON.stringify(r));
  eq(Y()[rn-1][23],'ร้อยละ 80 ของผู้ป่วย','digits normalized');assert(ver()!==v0,'bumped because the sheet row changed');eq(Y()[rn-1][C.STAMP_EDIT_BY_COL-1],by0,'edit stamp not touched');
}
// ===== 5) เพิ่มตัวชี้วัดใหม่ (+ส่งต่อปีถัดไป): ข้อความไม่ถูกแปลง
{
  const fyF=2569;sh.autoConv.length=0;const sh2=h.sheets['ปีงบ '+fyF];sh2.autoConv.length=0;
  const adm=U.find(r=>r[2]==='admin')[0];
  const r=C.addIndicator(tA,fyF,{part:'OPD',category:'x',name:'= ทดสอบเพิ่ม',target:'80%',years:[null,null,null,null,null],months:Array(12).fill(null),templateDetails:'',dataSource:'1/2',levels:['รายบุคคล'],owner:adm,department:'OPD',forward:true});assert(r.success,JSON.stringify(r));
  const row2=sh2.d.findIndex(x=>String(x[0]).trim()===r.newId)+1,row1=sh.d.findIndex(x=>String(x[0]).trim()===r.newId)+1;assert(row2>1&&row1>1,'added to both years');
  eq(sh2.autoConv.filter(x=>x.r===row2),[],'new row: no auto-conversion (add year): '+JSON.stringify(sh2.autoConv.filter(x=>x.r===row2)));
  eq(sh.autoConv.filter(x=>x.r===row1),[],'new row: no auto-conversion (forwarded year)');
  eq([sh2.d[row2-1][4],sh2.d[row2-1][5],sh2.d[row2-1][24]],['= ทดสอบเพิ่ม','80%','1/2']);eq([sh.d[row1-1][4],sh.d[row1-1][5],sh.d[row1-1][24]],['= ทดสอบเพิ่ม','80%','1/2']);
  [5,6,24,25,26,27].forEach(c=>{assert.strictEqual(sh2.fmt[row2+','+c],'@');assert.strictEqual(sh.fmt[row1+','+c],'@')});
}
console.log('SAVE1 OK');
