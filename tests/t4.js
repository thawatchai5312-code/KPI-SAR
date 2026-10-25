const {ctx,sheets}=require('./harness');const assert=require('assert');
ctx.authenticateUser('Admin','Admin11038'); const a=ctx.authenticateUser('Admin','Admin11038');
const S=n=>sheets['ปีงบ '+n].d, find=(fy,id)=>S(fy).find(r=>r[0]===id);
// mine flag: owner staff, head via dept, executive by name only
const st=ctx.authenticateUser('มานี','11038'); const list=ctx.getAllData(st.token,2570).data;
const mine=list.filter(k=>k.mine); assert(mine.length>0&&mine.every(k=>/มานี/.test(k.owner))); console.log('staff mine',mine.length,'of',list.length);
const ex=ctx.authenticateUser('ผอ.','11038'); const exAll=ctx.getAllData(ex.token,2570).data; assert(exAll.every(k=>k.canEditResults&&k.canEditDetails)); assert(exAll.filter(k=>k.mine).length<exAll.length); console.log('executive mine',exAll.filter(k=>k.mine).length,'(by name only)');
// combined save by owner in current FY: results + details at once, returns decorated kpi
const k=mine[0]; const m=k.months.slice(); m[1]=12.5;
let r=ctx.saveKpi(st.token,2570,{id:k.id,years:k.years,months:m,templateDetails:'วิเคราะห์ใหม่',dataSource:'สูตร A/B'});
assert(r.success&&r.changed,JSON.stringify(r)); assert(r.kpi.months[1]===12.5&&r.kpi.templateDetails==='วิเคราะห์ใหม่'&&r.kpi.editedBy==='มานี'&&r.kpi.canEditDetails&&Array.isArray(r.kpi.lockedYears)&&r.kpi.mine===true);
console.log('combined save ok:',r.message,'| stamp',r.kpi.editedAt);
// unchanged save -> no change, no restamp
const stamp=r.kpi.editedAt; r=ctx.saveKpi(st.token,2570,{id:k.id,years:r.kpi.years,months:r.kpi.months,templateDetails:'วิเคราะห์ใหม่',dataSource:'สูตร A/B'}); assert(r.success&&!r.changed&&r.message==='ไม่มีการเปลี่ยนแปลง'&&r.kpi.editedAt===stamp);
// staff cannot touch privileged fields (ignored), cannot rename
r=ctx.saveKpi(st.token,2570,{id:k.id,name:'HACK',target:'999',owner:'x',department:'y',level:'รายบุคคล'}); assert(r.success&&r.changed); const row=find(2570,k.id); assert(row[4]==='HACK'&&row[5]==='999'&&row[25]==='x'&&row[28]==='SAR'); /* เจ้าของแก้ชื่อ/เป้า/ผู้รับผิดชอบ/หน่วยงานได้ แต่ระดับแก้ไม่ได้ */
// staff cannot save someone else's KPI
const other=list.find(x=>!x.mine&&!x.canEditResults); r=ctx.saveKpi(st.token,2570,{id:other.id,months:Array(12).fill(1)}); assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message));
// previous FY: results ok, details denied; two years back (after rollover) results denied
const k69=ctx.getAllData(st.token,2569).data.find(x=>x.id===k.id); assert(k69.canEditResults&&k69.canEditDetails);
r=ctx.saveKpi(st.token,2569,{id:k.id,templateDetails:'x'}); assert(r.success,'past-FY details editable by permission');
const y=k69.years.slice(); y[4]=66; r=ctx.saveKpi(st.token,2569,{id:k.id,years:y,months:k69.months}); assert(r.success&&r.changed); assert(Number(find(2570,k.id)[9])===66,'propagated to 2570 J'); assert(r.kpi.lockedYears.join()==='false,false,false,false');
// privileged: all fields, level, owner; reflected only in selected FY
r=ctx.saveKpi(a.token,2570,{id:k.id,name:'ชื่อใหม่',target:'≥ 90 %',owner:'มานี/อรทัย',department:'PCU/ER',levels:['QA-หน่วยงาน']}); assert(r.success&&r.changed&&r.kpi.name==='ชื่อใหม่'&&r.kpi.level==='QA-หน่วยงาน');
assert(find(2569,k.id)[4]!=='ชื่อใหม่'); console.log('privileged edit isolated to 2570');
// blank name ignored for privileged
r=ctx.saveKpi(a.token,2570,{id:k.id,name:'   '}); assert(r.success&&!r.changed&&find(2570,k.id)[4]==='ชื่อใหม่');
// admin edits locked year via 2570 J -> source 2569 K
const k70=ctx.getAllData(a.token,2570).data.find(x=>x.id===k.id); const y2=k70.years.slice(); y2[3]=44; r=ctx.saveKpi(a.token,2570,{id:k.id,years:y2,months:k70.months}); assert(r.success); assert(Number(find(2569,k.id)[10])===44);
// non-priv can't change locked J in 2570
const k70s=ctx.getAllData(st.token,2570).data.find(x=>x.id===k.id); const y3=k70s.years.slice(); y3[3]=1; y3[2]=7; r=ctx.saveKpi(st.token,2570,{id:k.id,years:y3,months:k70s.months}); assert(r.success&&Number(find(2570,k.id)[9])===44&&Number(find(2570,k.id)[8])===7);
// add -> returns newId; level default; delete only current sheet
const add=ctx.addIndicator(a.token,2570,{part:'หมวดฉัน',category:'ใหม่',name:'ตัวใหม่',target:'1',years:[null,null,null,null,null],months:Array(12).fill(null),level:'ฝ่ายการพยาบาล',owner:'มานี',department:'PCU'}); assert(add.success&&add.newId);
const nk=ctx.getAllData(a.token,2570).data.find(x=>x.id===add.newId); assert(nk.level==='หน่วยงาน'&&nk.editedBy==='Admin');
assert(ctx.deleteIndicator(a.token,2570,'p',add.newId).success);
// missing-id / bad session
assert(!ctx.saveKpi(a.token,2570,{id:'KPI-NOPE'}).success); assert(/SESSION_EXPIRED/.test(ctx.saveKpi('bad',2570,{id:k.id}).message));
// server PDF removed; old fns removed
assert(typeof ctx.exportCategoryToPdf==='undefined'); 
console.log('ALL OK');
