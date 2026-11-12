// ช่องผล (ผลทั้งปี/รายเดือน) รับได้ทั้งตัวเลขและข้อความ: แปลงค่า · บันทึก/อ่านกลับ · ตั้งรูปแบบข้อความเฉพาะเซลล์ข้อความ · ส่งผลทั้งปีไปชีตปีอื่น · ไม่นับว่าแก้เมื่อค่าเหมือนเดิม
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
// ----- ตารางแปลงค่า
const W=(v)=>C.resultValue_(v,true),Y=(v)=>C.resultValue_(v,false),R=(v,m)=>C.readResult_(v,m);
eq([W(''),W(null),W(undefined),W(' ')],[null,null,null,null]);
eq([W('-'),W(' - '),W('NA'),W('n/a')],['-','-','-','-'],'month dash/NA');
eq([Y('-'),Y('NA')],[null,null],'year dash/NA = blank');
eq([R('NA',true),R('N/A',true),R('-',true),R('-',false)],[null,null,'-',null],'read: NA blank, - = no case(month)');
eq([W(80),W('80'),W('80%'),W(' 80 % '),W('1,234'),W('1,234.5'),W('๘๐'),W('-5'),W('.5'),W('0')],[80,80,80,80,1234,1234.5,80,-5,0.5,0]);
eq([W('A'),W('B-'),W('ดีมาก'),W('1/2'),W('12,34'),W('8O')],['A','B-','ดีมาก','1/2','12,34','8O'],'text');
eq(W('x'.repeat(80)).length,60,'text capped 60');
eq([W(NaN),W(Infinity)],[null,null]);
// ----- บันทึก/อ่านกลับ
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('123456');r[4]='FALSE'});
const ad=U.find(r=>r[2]==='admin'),tA=C.createSession_(ad[0],ad[1]);
const sh=h.sheets['ปีงบ 2570'];
const fmt=[];const orig=sh.getRange.bind(sh);sh.getRange=function(r,c,nr,nc){const o=orig(r,c,nr,nc);const sf=o.setNumberFormat;o.setNumberFormat=function(f){fmt.push([r,c,nr||1,nc||1,f]);return sf.apply(o,arguments)};return o};
const rowOf=id=>sh.d.slice(1).find(r=>String(r[0]).trim()===id);
const k=C.getAllData(tA,2570).data.find(x=>x.canEditResults&&x.months.every(v=>v===null)&&x.years.every(v=>v===null));assert(k,'KPI with no results');
const mo=Array(12).fill(null);mo[0]='A';mo[1]=80;mo[2]='B-';mo[3]='80%';mo[4]='-';mo[5]='1/2';
const yr=[null,null,null,'ดีมาก',90];
fmt.length=0;
let r=C.saveKpi(tA,2570,{id:k.id,years:yr,months:mo});assert(r.success&&r.changed,JSON.stringify(r));
eq(r.kpi.months.slice(0,6),['A',80,'B-',80,'-','1/2']);eq(r.kpi.years,[null,null,null,'ดีมาก',90]);
// ตั้งรูปแบบข้อความเฉพาะเซลล์ที่เป็นข้อความ (ผลทั้งปีช่อง 4 = คอลัมน์ 10 · เดือนเริ่มคอลัมน์ 12)
const tcols=fmt.filter(f=>f[4]==='@'&&f[0]===sh.d.indexOf(rowOf(k.id))+1).map(f=>f[1]).filter((c,i,a)=>a.indexOf(c)===i).sort((a,b)=>a-b);
eq(tcols,[10,12,14,17],'@ only on text cells (ปีที่4=col10, ต.ค.=12, ธ.ค.=14, มี.ค.=17)');
// อ่านกลับ (รวมค่าที่ชีตเก็บเป็นข้อความตัวเลข)
const raw=rowOf(k.id);raw[12]='80';raw[10]='90';
const again=C.getAllData(tA,2570).data.find(x=>x.id===k.id);eq(again.months.slice(0,6),['A',80,'B-',80,'-','1/2']);eq(again.years,[null,null,null,'ดีมาก',90]);
// บันทึกซ้ำค่าเดิม = ไม่เปลี่ยน
r=C.saveKpi(tA,2570,{id:k.id,years:again.years,months:again.months,baseRev:again.rev});assert(r.success&&!r.changed,'same values: unchanged');
// ข้อความ → ตัวเลข / เปลี่ยนค่า = นับว่าแก้
const m2=again.months.slice();m2[0]=95;m2[2]='ผ่าน';r=C.saveKpi(tA,2570,{id:k.id,years:again.years,months:m2});assert(r.success&&r.changed);eq(r.kpi.months.slice(0,3),[95,80,'ผ่าน']);
// ผลทั้งปีที่เป็นข้อความถูกส่งไปชีตปีที่เก็บปีนั้น: ปีงบ 2569 = ช่อง K (index 10) ของชีต 2569
const sh69=h.sheets['ปีงบ 2569'];const r69=sh69.d.slice(1).find(x=>String(x[0]).trim()===k.id);
if(r69)eq(r69[10],'ดีมาก','propagated text to FY2569 col K');
console.log('result1 ok');
