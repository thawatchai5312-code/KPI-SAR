const {ctx,sheets}=require('./harness');const assert=require('assert');
ctx.authenticateUser('Admin','Admin11038'); const a=ctx.authenticateUser('Admin','Admin11038');
const S=()=>sheets['ปีงบ 2570'].d, row=id=>S().find(r=>r[0]===id);
const login=u=>ctx.authenticateUser(u,'11038');
const st=login('มานี'), head=login('อรทัย'), exec=login('ผอ.');
const base={years:[null,null,null,null,null],months:Array(12).fill(null)};
// --- core part regex
const core=['Part I','Part II','Part III','Part IV','part iv'], nonCore=['Part V','Parties','หมวดฉัน','Part'];
core.forEach(p=>assert(ctx.isCorePart_(p),p)); nonCore.forEach(p=>assert(!ctx.isCorePart_(p),p));
// --- staff adds: owner forced, non-core with personal level
let r=ctx.addIndicator(st.token,2570,{...base,part:'หมวดมานี',category:'ส่วนตัว',name:'ตัวชี้วัดฉัน',target:'1',levels:['รายบุคคล'],owner:'คนอื่น',department:''});
assert(r.success,JSON.stringify(r)); let rw=row(r.newId); assert(parseOwners(rw[25]).includes('มานี')); assert(rw[28]==='รายบุคคล'&&rw[26]!==''); console.log('staff add ok; owner',rw[25],'dept',rw[26]);
function parseOwners(t){return t.split('/').map(x=>x.trim())}
const mineList=ctx.getAllData(st.token,2570).data; const mk=mineList.find(k=>k.id===r.newId); assert(mk&&mk.mine&&mk.canEditDetails&&mk.canEditResults);
// other staff / other head cannot see personal-level KPI; own dept head sees
const other=login('ปิติ'); assert(!ctx.getAllData(other.token,2570).data.some(k=>k.id===r.newId),'other staff must not see');
assert(!ctx.getAllData(exec.token,2570).data.some(k=>k.id===r.newId),'exec must not see non-core');
assert(ctx.getAllData(a.token,2570).data.some(k=>k.id===r.newId),'admin sees all');
// --- core part needs SAR/QA
r=ctx.addIndicator(st.token,2570,{...base,part:'Part II',category:'x',name:'n',levels:['รายบุคคล']}); assert(!r.success&&/SAR/.test(r.message),JSON.stringify(r));
r=ctx.addIndicator(st.token,2570,{...base,part:'Part II',category:'x',name:'n',levels:['หน่วยงาน','QA-หน่วยงาน']}); assert(r.success); const qaId=r.newId;
// owner only (staff) sees; exec sees QA core KPI
assert(ctx.getAllData(exec.token,2570).data.some(k=>k.id===qaId),'exec sees Part II QA');
// missing fields
assert(!ctx.addIndicator(st.token,2570,{...base,part:'',category:'x',name:'n',levels:['SAR']}).success);
// staff cannot add to a non-current year
assert(!ctx.addIndicator(st.token,2569,{...base,part:'หมวดมานี',category:'c',name:'n',levels:['รายบุคคล']}).success);
// --- staff edits meta of own KPI; not of others'
const myId=mk.id;
r=ctx.saveKpi(st.token,2570,{id:myId,name:'ชื่อใหม่',target:'> 90',templateDetails:'d',dataSource:'s',owner:'มานี / เพื่อน',department:'PCU'}); assert(r.success&&r.changed,JSON.stringify(r));
rw=row(myId); assert(rw[4]==='ชื่อใหม่'&&rw[5]==='> 90'&&rw[23]==='d'&&rw[24]==='s'&&rw[25]==='มานี / เพื่อน'&&rw[26]==='PCU');
// staff cannot change levels / summary / frequency
r=ctx.saveKpi(st.token,2570,{id:myId,levels:['SAR'],summaryMethod:'ผลรวม',frequency:'รายปี'}); assert(r.success&&!r.changed&&rw[28]==='รายบุคคล');
// staff cannot rename KPI of others (visible SAR)
const vis=ctx.getAllData(st.token,2570).data.find(k=>!k.mine&&!k.canEditDetails);
r=ctx.saveKpi(st.token,2570,{id:vis.id,name:'HACK'}); assert(!r.success); assert(row(vis.id)[4]!=='HACK');
// invisible KPI cannot be saved/viewed by id
r=ctx.saveKpi(other.token,2570,{id:myId,months:Array(12).fill(1)}); assert(!r.success);
r=ctx.saveKpi(other.token,2570,{id:myId,name:'X'}); assert(!r.success&&row(myId)[4]==='ชื่อใหม่');
// previous-year: results editable, meta not (head/staff)
const k69=ctx.getAllData(st.token,2569).data.find(k=>k.mine); if(k69){ r=ctx.saveKpi(st.token,2569,{id:k69.id,name:'ปีก่อน'}); assert(r.success&&r.changed,'meta in past FY now allowed per permission'); r=ctx.saveKpi(st.token,2569,{id:k69.id,name:k69.name,target:k69.target,owner:k69.owner,department:k69.department,months:k69.months}); assert(r.success,JSON.stringify(r)); }
// --- admin: core part KPI levels cannot drop SAR/QA, validated before any write
const coreK=S().find(x=>/^Part I$/.test(x[2])); const beforeRow=JSON.stringify(coreK);
r=ctx.saveKpi(a.token,2570,{id:coreK[0],levels:['รายบุคคล'],months:Array(12).fill(3)}); assert(!r.success&&/SAR/.test(r.message)); assert(JSON.stringify(coreK)===beforeRow,'no partial write');
r=ctx.saveKpi(a.token,2570,{id:coreK[0],levels:['QA-หน่วยงาน','หน่วยงาน']}); assert(r.success&&coreK[28]==='หน่วยงาน, QA-หน่วยงาน');
coreK[28]='SAR';
// --- executive: only core+hospital level KPIs, own KPIs
const ex=ctx.getAllData(exec.token,2570).data; assert(ex.length>0&&ex.every(k=>k.mine||(ctx.isCorePart_(k.part)&&k.levels.some(l=>l==='SAR'||l==='QA-หน่วยงาน'))));
const hidden=S().find(x=>x[0]&&x[0].startsWith('KPI-')&&!ctx.isCorePart_(x[2])&&x[25]!=='ผอ.'); 
// make a non-core SAR KPI -> executive must not see; core but personal level -> not see
const tmp=S().find(x=>x[0]===coreK[0]); const keepPart=tmp[2]; tmp[2]='หมวดอื่น'; assert(!ctx.getAllData(exec.token,2570).data.some(k=>k.id===tmp[0]),'non-core hidden from exec'); tmp[2]=keepPart;
tmp[28]='รายบุคคล'; assert(!ctx.getAllData(exec.token,2570).data.some(k=>k.id===tmp[0]),'core but personal level hidden from exec'); tmp[28]='SAR';
assert(ctx.getAllData(exec.token,2570).data.some(k=>k.id===tmp[0]));
r=ctx.saveKpi(exec.token,2570,{id:myId,name:'EXEC'}); assert(!r.success,'exec cannot edit invisible'); 
// exec adds non-core: auto owner; core SAR: no forced owner
r=ctx.addIndicator(exec.token,2570,{...base,part:'หมวดผอ',category:'c',name:'n',levels:['หน่วยงาน']}); assert(!r.success&&/Part I–IV/.test(r.message),JSON.stringify(r));
const qmr=login('เดือนเพ็ญ'); r=ctx.addIndicator(qmr.token,2570,{...base,part:'หมวดQMR',category:'c',name:'n',levels:['หน่วยงาน']}); assert(r.success&&ctx.getAllData(qmr.token,2570).data.some(k=>k.id===r.newId));
r=ctx.addIndicator(exec.token,2570,{...base,part:'Part III',category:'c',name:'n',levels:['SAR'],owner:''}); assert(r.success&&row(r.newId)[25]==='');
// --- head: sees own-dept unit-level KPIs, other staff in same dept do not
const hk=ctx.getAllData(head.token,2570).data.find(k=>k.levels.join()==='หน่วยงาน'||k.levels.join()==='รายบุคคล');
const pcuStaff=login('มานี'); // มานี dept?
console.log('ALL OK');
