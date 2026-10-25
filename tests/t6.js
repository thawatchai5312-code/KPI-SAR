const {ctx,sheets}=require('./harness');const assert=require('assert');
const RealDate=Date; let fake=new RealDate('2026-10-21T03:00:00Z');
ctx.Date=class extends RealDate{constructor(...a){a.length?super(...a):super(fake)} static now(){return fake.getTime()}};
ctx.authenticateUser('Admin','Admin11038'); const a=ctx.authenticateUser('Admin','Admin11038');
const st=ctx.authenticateUser('มานี','11038'); const row=(fy,id)=>sheets['ปีงบ '+fy].d.find(r=>r[0]===id);
const all=ctx.getAllData(a.token,2570).data; assert(all.every(k=>k.summaryMethod==='เฉลี่ย'),'default');
const mine=ctx.getAllData(st.token,2570).data.find(x=>x.mine); const k=mine;
// staff cannot change
let r=ctx.saveKpi(st.token,2570,{id:k.id,summaryMethod:'ผลรวม'}); assert(r.success&&!r.changed&&r.kpi.summaryMethod==='เฉลี่ย');
// admin sets, validates
r=ctx.saveKpi(a.token,2570,{id:k.id,summaryMethod:'ผลรวม'}); assert(r.changed&&r.kpi.summaryMethod==='ผลรวม'&&row(2570,k.id)[33]==='ผลรวม'); assert(sheets['ปีงบ 2570'].d[0][33]==='วิธีสรุปผลรายเดือน (Summary)');
r=ctx.saveKpi(a.token,2570,{id:k.id,summaryMethod:'bogus'}); assert(!r.changed&&r.kpi.summaryMethod==='ผลรวม');
r=ctx.saveKpi(a.token,2570,{id:k.id,summaryMethod:'ผลรวม'}); assert(!r.changed);
// per-year isolation
assert(!row(2569,k.id)[33]); 
// executive can set
const ex=ctx.authenticateUser('ผอ.','11038'); r=ctx.saveKpi(ex.token,2570,{id:k.id,summaryMethod:'เดือนล่าสุด'}); assert(r.changed&&r.kpi.summaryMethod==='เดือนล่าสุด');
// survives staff saves of results
const kk=ctx.getAllData(st.token,2570).data.find(x=>x.id===k.id); const m=kk.months.slice(); m[0]=5; r=ctx.saveKpi(st.token,2570,{id:k.id,years:kk.years,months:m}); assert(r.kpi.summaryMethod==='เดือนล่าสุด');
// add with method / default
const add=ctx.addIndicator(a.token,2570,{part:'Part I',category:'x',name:'n',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['SAR'],summaryMethod:'ผลรวม'}); assert(row(2570,add.newId)[33]==='ผลรวม'&&row(2570,add.newId)[32]===''&&row(2570,add.newId)[29]);
fake=new RealDate(fake.getTime()+5000); const add2=ctx.addIndicator(a.token,2570,{part:'Part I',category:'x',name:'n2',target:'',years:[null,null,null,null,null],months:Array(12).fill(null)}); assert(row(2570,add2.newId)[33]==='เฉลี่ย');
// new fiscal year copies the setting
fake=new RealDate('2027-09-30T20:00:00Z'); ctx.dailyFiscalYearCheck(); assert(row(2571,k.id)[33]==='เดือนล่าสุด'&&row(2571,add.newId)[33]==='ผลรวม','copied to next year');
// old sheets without column: blank => default
row(2569,all[5].id)[33]=''; assert(ctx.getAllData(a.token,2569).data.find(x=>x.id===all[5].id).summaryMethod==='เฉลี่ย');
console.log('ALL OK');
