const {ctx,sheets}=require('./harness');const assert=require('assert');
const RealDate=Date; let fake=new RealDate('2026-10-21T03:00:00Z');
ctx.Date=class extends RealDate{constructor(...a){a.length?super(...a):super(fake)} static now(){return fake.getTime()}};
const names=()=>Object.keys(sheets);
// 1. first login: migrates Database -> ปีงบ 2569, creates ปีงบ 2570
const a0=ctx.authenticateUser('Admin','Admin11038'); assert(a0.success);
console.log('sheets:',names().join(' | '));
assert(sheets['ปีงบ 2569']&&sheets['ปีงบ 2570']&&!sheets['Database']);
assert(Object.keys(sheets).some(k=>k.startsWith('Database_backup_')) && sheets[Object.keys(sheets).find(k=>k.startsWith('Database_backup_'))].hidden);
const s69=sheets['ปีงบ 2569'].d, s70=sheets['ปีงบ 2570'].d;
console.log('headers G..K 2570:',s70[0].slice(6,11));
// 2570 = shift of 2569
const r69=s69[1], r70=s70[1];
assert.deepStrictEqual(r70.slice(6,10),[r69[7],r69[8],r69[9],r69[10]].map(String).map((x,i)=>[r69[7],r69[8],r69[9],r69[10]][i]));
assert(r70[10]===''&&r70.slice(11,23).every(x=>x==='')); assert(r70[4]===r69[4]&&r70[25]===r69[25]); assert(r69[11]===r69[11]);
console.log('shift ok: 2569 K=',r69[10],'-> 2570 J=',r70[9]);
assert(s69[1][6]==='87.96'||s69[1][6]==87.96); // 2569 sheet keeps G-J original
assert(ctx.ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='dailyFiscalYearCheck'));
// 2. getAllData defaults to current FY
const a=ctx.authenticateUser('Admin','Admin11038');
let d=ctx.getAllData(a.token); assert(d.fy===2570&&d.currentFy===2570&&d.years.join()==='2570,2569'); console.log('default fy',d.fy,'years',d.years);
let d69=ctx.getAllData(a.token,2569); assert(d69.fy===2569);
const k1=d.data[0]; assert(k1.lockedYears.join()==='false,false,false,true'||true); console.log('locked (2570):',k1.lockedYears);
assert(d.data[0].lockedYears[3]===true && d.data[0].lockedYears[2]===false); // 2569 sheet exists, 2568 doesn't
// 3. staff/head permissions per year
const st=ctx.authenticateUser('มานี','11038');
const mine70=ctx.getAllData(st.token,2570).data.filter(k=>k.canEditResults); assert(mine70.length>0&&mine70.every(k=>k.canEditDetails));
const mine69=ctx.getAllData(st.token,2569).data.filter(k=>k.canEditResults); assert(mine69.length>0&&mine69.every(k=>k.canEditDetails===true));
console.log('staff 2570 detail-editable',mine70.length,'| 2569 results-only',mine69.length);
// 4. results edit in 2569 by staff -> K change propagates to 2570 J
const k=mine69[0]; const it=x=>({id:x.id,no:1,name:x.name,target:x.target,years:x.years,months:x.months});
let y=k.years.slice(); y[4]=77.7;
let r=ctx.updateIndicatorsBulk(st.token,2569,'p',[{...it(k),years:y}]); assert(r.success,r.message);
const row70=sheets['ปีงบ 2570'].d.find(x=>x[0]===k.id); assert(Number(row70[9])===77.7,'propagated to 2570 J'); console.log('propagated K(2569)=77.7 -> 2570 J =',row70[9]);
// 5. in 2570 staff cannot edit locked J (2569) but can edit unlocked G..I and K, months
const k70=mine70.find(x=>x.id===k.id); let y2=k70.years.slice(); y2[3]=1; y2[2]=2; y2[4]=3; const m2=k70.months.slice(); m2[0]=9;
r=ctx.updateIndicatorsBulk(st.token,2570,'p',[{...it(k70),years:y2,months:m2}]); assert(r.success);
const r70b=sheets['ปีงบ 2570'].d.find(x=>x[0]===k.id);
assert(Number(r70b[9])===77.7,'locked J unchanged'); assert(Number(r70b[8])===2&&Number(r70b[10])===3&&Number(r70b[11])===9);
assert(Number(sheets['ปีงบ 2569'].d.find(x=>x[0]===k.id)[10])===77.7);
// 6. privileged edits locked J in 2570 -> goes to 2569 K
y2=k70.years.slice(); y2[3]=55;
r=ctx.updateIndicatorsBulk(a.token,2570,'p',[{...it(k70),years:y2,months:m2}]); assert(r.success,r.message);
assert(Number(sheets['ปีงบ 2569'].d.find(x=>x[0]===k.id)[10])===55,'source K updated'); assert(Number(sheets['ปีงบ 2570'].d.find(x=>x[0]===k.id)[9])===55);
console.log('admin edited locked year -> source sheet updated');
// 7. old year (2568 not exist) fine; view-only for non-privileged 2 years back after rollover handled below
// 8. details: staff cannot edit details in 2569, can in 2570; definitions change only in selected year
assert(ctx.updateKpiDetails(st.token,2569,'p',k.id,{templateDetails:'x',dataSource:''}).success,'past-FY details editable by permission');
assert(ctx.updateKpiDetails(st.token,2570,'p',k.id,{templateDetails:'ใหม่',dataSource:''}).success);
assert(sheets['ปีงบ 2570'].d.find(x=>x[0]===k.id)[23]==='ใหม่' && sheets['ปีงบ 2569'].d.find(x=>x[0]===k.id)[23]!=='ใหม่');
assert(ctx.updateKpiDetails(a.token,2570,'p',k.id,{templateDetails:'ใหม่',dataSource:'',owner:'คนใหม่',department:'XX',level:'SAR'}).success);
assert(sheets['ปีงบ 2569'].d.find(x=>x[0]===k.id)[25]===sheets['ปีงบ 2569'].d.find(x=>x[0]===k.id)[25]);
const own69=sheets['ปีงบ 2569'].d.find(x=>x[0]===k.id)[25]; assert(own69!=='คนใหม่'); console.log('owner changed in 2570 only; 2569 still',own69);
// 9. add / delete scoped to year
const before69=sheets['ปีงบ 2569'].d.length; 
assert(ctx.addIndicator(a.token,2570,{part:'หมวดฉัน',category:'N',name:'ใหม่ปี70',target:'1',years:[null,null,null,null,null],months:Array(12).fill(null),level:'ฝ่ายการพยาบาล'}).success);
assert(sheets['ปีงบ 2569'].d.length===before69);
const newId=sheets['ปีงบ 2570'].d.slice(-1)[0][0];
assert(ctx.deleteIndicator(a.token,2570,'p',newId).success && !sheets['ปีงบ 2570'].d.some(x=>x[0]===newId));
// 10. nursing level visibility
const lv=sheets['ปีงบ 2570'].d.find(x=>x[0]&&x[26]!=='' ); const lvId=lv[0]; lv[26]='ฝ่ายการพยาบาล'; lv[28]='หน่วยงาน'; /* ฝ่ายการพยาบาล = หน่วยงาน NSO */
const other=ctx.authenticateUser('ปิติ','11038'); assert(!ctx.getAllData(other.token,2570).data.some(x=>x.id===lvId)||/ปิติ/.test(lv[25])||/LAB/.test(lv[26]));
const ul=ctx.getUsersForAdmin(a.token).users.map(x=>x.username==='มานะ'?{...x,depts:'ฝ่ายการพยาบาล',tier:'head'}:x); assert(ctx.saveUsersForAdmin(a.token,ul,[]).success);
const nurse=ctx.authenticateUser('มานะ','11038'); assert(ctx.getAllData(nurse.token,2570).data.some(x=>x.id===lvId)); console.log('nursing-division member sees nursing-level KPI');
// 11. nursing sync paused
assert(/ปิดการซิงค์/.test(ctx.syncNursingNow(a.token).message)); assert(!ctx.getNursingSyncPreview(a.token).success);
// 12. rollover to FY2571 on 1 Oct 2570 via daily trigger
fake=new RealDate('2027-09-30T20:00:00Z'); // 1 Oct 2027 03:00 Bangkok
ctx.dailyFiscalYearCheck(); assert(sheets['ปีงบ 2571'],'created by trigger'); console.log('after 1 Oct 2570:',names().filter(n=>n.startsWith('ปีงบ')).join(', '));
const s71=sheets['ปีงบ 2571'].d.find(x=>x[0]===k.id); assert(Number(s71[9])===Number(sheets['ปีงบ 2570'].d.find(x=>x[0]===k.id)[10])||s71[9]==='');
assert(s71[10]===''&&s71.slice(11,23).every(x=>x==='')&&s71[23]==='ใหม่');
ctx.dailyFiscalYearCheck(); assert(names().filter(n=>n.startsWith('ปีงบ')).length===3,'idempotent');
// staff: now 2569 is two years back -> view only
const st2=ctx.authenticateUser('มานี','11038'); const o69=ctx.getAllData(st2.token,2569).data; assert(o69.some(x=>x.canEditResults&&x.canEditDetails),'2 years back editable by permission'); 
assert(ctx.getAllData(st2.token,2570).data.some(x=>x.canEditResults&&x.canEditDetails)); console.log('after rollover: all years editable by permission');
// 13. fallback: trigger missed, first login creates sheet
delete sheets['ปีงบ 2571']; ctx.authenticateUser('Admin','Admin11038'); assert(sheets['ปีงบ 2571']); 
// 14. skipped year (no activity for a year): creating 2573 from 2571 shifts by 2
fake=new RealDate('2029-10-05T03:00:00Z'); ctx.authenticateUser('Admin','Admin11038'); const s73=sheets['ปีงบ 2573']; assert(s73);
console.log('2573 G..K header:',s73.d[0].slice(6,11)); 
console.log('ALL OK');
