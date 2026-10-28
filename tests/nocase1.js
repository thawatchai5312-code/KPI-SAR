// ผลรายเดือน "-" = เดือนนั้นไม่มีเคส: เก็บเป็น "-" ในชีต อ่านกลับเป็น "-" · NA/N/A พิมพ์แล้วเก็บเป็น "-" · ข้อความอื่นเป็นว่าง · "NA" เดิมในชีตยังอ่านเป็นว่าง
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tA=C.createSession_(U.find(r=>r[2]==='admin')[0],U.find(r=>r[2]==='admin')[1]);
const Y=fy=>h.sheets['ปีงบ '+fy].d,rowOf=(fy,id)=>Y(fy).slice(1).find(r=>String(r[0]).trim()===id);
const k=C.getAllData(tA,2570).data.find(x=>x.canEditResults&&x.months.every(v=>v===null));assert(k,'KPI with empty months');
const m=Array(12).fill(null);m[0]=80;m[1]='-';m[2]=0;m[3]='NA';m[4]='n/a';m[5]='abc';m[6]=' - ';
let r=C.saveKpi(tA,2570,{id:k.id,years:k.years,months:m});assert(r.success&&r.changed,JSON.stringify(r));
eq(r.kpi.months,[80,'-',0,'-','-',null,'-',null,null,null,null,null]);
const raw=rowOf(2570,k.id);eq(raw.slice(11,23).map(v=>v===null?'':v),[80,'-',0,'-','-','', '-','','','','','']);
// อ่านกลับ + บันทึกซ้ำค่าเดิม = ไม่เปลี่ยน
const again=C.getAllData(tA,2570).data.find(x=>x.id===k.id);eq(again.months,r.kpi.months);
r=C.saveKpi(tA,2570,{id:k.id,years:again.years,months:again.months,baseRev:again.rev});assert(r.success&&!r.changed,'same values: unchanged '+JSON.stringify(r.changed));
// เปลี่ยน "-" เป็น 0 / ว่าง ต้องนับเป็นการเปลี่ยน
const m2=again.months.slice();m2[1]=0;m2[3]=null;r=C.saveKpi(tA,2570,{id:k.id,years:again.years,months:m2});assert(r.success&&r.changed);eq(r.kpi.months.slice(0,5),[80,0,0,null,'-']);
// "NA" เดิมในชีต (นำเข้ามาก่อนหน้านี้) ยังอ่านเป็นว่าง ไม่ใช่ไม่มีเคส
const legacy=Y(2569).slice(1).find(x=>x[0]&&x.slice(11,23).some(v=>v==='NA'));
if(legacy){const kk=C.getAllData(tA,2569).data.find(x=>x.id===String(legacy[0]).trim());if(kk){legacy.slice(11,23).forEach((v,i)=>{if(v==='NA')assert.strictEqual(kk.months[i],null,'legacy NA stays blank')})}}
// ส่งต่อปีถัดไปไม่พาผลรายเดือนไป
const rf=C.saveKpi(tA,2569,{id:k.id,name:'ชื่อทดสอบ no-case',months:[1,'-',null,null,null,null,null,null,null,null,null,null],forward:true});
if(rf.success&&rf.docs&&rf.docs.forward&&rf.docs.forward.length){eq(C.getAllData(tA,2570).data.find(x=>x.id===k.id).months.slice(0,2),[80,0],'monthly not forwarded')}
console.log('nocase1 ok');
