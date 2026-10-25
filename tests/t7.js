const {ctx,sheets}=require('./harness');const assert=require('assert');
const RealDate=Date; let fake=new RealDate('2026-10-21T03:00:00Z');
ctx.Date=class extends RealDate{constructor(...a){a.length?super(...a):super(fake)} static now(){return fake.getTime()}};
ctx.authenticateUser('Admin','Admin11038'); const a=ctx.authenticateUser('Admin','Admin11038');
const st=ctx.authenticateUser('มานี','11038'); const row=(fy,id)=>sheets['ปีงบ '+fy].d.find(r=>r[0]===id);
const all=ctx.getAllData(a.token,2570).data; assert(all.every(k=>k.frequency==='รายเดือน'&&k.analysisUpdatedAt===''));
const k=ctx.getAllData(st.token,2570).data.find(x=>x.mine);
// editing details stamps analysis time; results-only does not
let r=ctx.saveKpi(st.token,2570,{id:k.id,years:k.years,months:k.months.map((v,i)=>i===0?5:v)}); assert(r.changed&&r.kpi.analysisUpdatedAt==='','results edit does not stamp analysis');
r=ctx.saveKpi(st.token,2570,{id:k.id,templateDetails:'วิเคราะห์ใหม่ ปี70',dataSource:k.dataSource}); assert(r.changed&&/^\d\d\/\d\d\/\d{4} \d\d:\d\d$/.test(r.kpi.analysisUpdatedAt),r.kpi.analysisUpdatedAt);
const stamp=r.kpi.analysisUpdatedAt; assert(sheets['ปีงบ 2570'].d[0][34]==='อัปเดตการวิเคราะห์ล่าสุด');
r=ctx.saveKpi(st.token,2570,{id:k.id,templateDetails:'วิเคราะห์ใหม่ ปี70',dataSource:k.dataSource}); assert(!r.changed&&r.kpi.analysisUpdatedAt===stamp,'unchanged text keeps stamp');
fake=new RealDate(fake.getTime()+60000); r=ctx.saveKpi(st.token,2570,{id:k.id,dataSource:'สูตรใหม่'}); assert(r.changed&&r.kpi.analysisUpdatedAt!==''); 
// frequency: staff cannot, admin can, invalid ignored, copies to next FY, analysis cleared next FY
r=ctx.saveKpi(st.token,2570,{id:k.id,frequency:'รายปี'}); assert(!r.changed&&r.kpi.frequency==='รายเดือน');
r=ctx.saveKpi(a.token,2570,{id:k.id,frequency:'รายไตรมาส'}); assert(r.changed&&r.kpi.frequency==='รายไตรมาส'&&row(2570,k.id)[35]==='รายไตรมาส'&&sheets['ปีงบ 2570'].d[0][35]==='ความถี่การเก็บข้อมูล (Frequency)');
r=ctx.saveKpi(a.token,2570,{id:k.id,frequency:'bogus'}); assert(!r.changed&&r.kpi.frequency==='รายไตรมาส');
fake=new RealDate('2027-09-30T20:00:00Z'); ctx.dailyFiscalYearCheck();
assert(row(2571,k.id)[35]==='รายไตรมาส','frequency copied'); assert(!row(2571,k.id)[34],'analysis stamp cleared for new year'); assert(row(2571,k.id)[23]==='วิเคราะห์ใหม่ ปี70','details text carried');
const k71=ctx.getAllData(a.token,2571).data.find(x=>x.id===k.id); assert(k71.analysisUpdatedAt===''&&k71.frequency==='รายไตรมาส'&&k71.templateDetails==='วิเคราะห์ใหม่ ปี70');
// add
fake=new RealDate('2027-10-05T03:00:00Z'); 
const add=ctx.addIndicator(a.token,2571,{part:'Part I',category:'x',name:'n',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),templateDetails:'abc',frequency:'ครึ่งปี'}); assert(row(2571,add.newId)[34]&&row(2571,add.newId)[35]==='ครึ่งปี');
fake=new RealDate(fake.getTime()+5000); const add2=ctx.addIndicator(a.token,2571,{part:'Part I',category:'x',name:'n2',target:'',years:[null,null,null,null,null],months:Array(12).fill(null)}); assert(!row(2571,add2.newId)[34]&&row(2571,add2.newId)[35]==='รายเดือน');
console.log('ALL OK');
