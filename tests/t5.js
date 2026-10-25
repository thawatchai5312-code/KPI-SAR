const {ctx,sheets}=require('./harness');const assert=require('assert');
ctx.authenticateUser('Admin','Admin11038'); const a=ctx.authenticateUser('Admin','Admin11038');
const S=()=>sheets['ปีงบ 2570'].d, row=id=>S().find(r=>r[0]===id);
const st=ctx.authenticateUser('มานี','11038');
const all=ctx.getAllData(a.token,2570).data; assert(all.every(k=>Array.isArray(k.levels)&&k.level===k.levels[k.levels.length-1]));
// multi-level save, stored sorted low->high, display = highest
const k=all.find(x=>!/มานี/.test(x.owner)&&!/PCU/.test(x.department));
row(k.id)[2]='หมวดทดสอบ'; /* หมวดนอก Part I–IV เปลี่ยนเป็นระดับต่ำได้ */
let r=ctx.saveKpi(a.token,2570,{id:k.id,levels:['SAR','รายบุคคล','หน่วยงาน','bogus']}); assert(!r.success&&/SAR/.test(r.message),'SAR needs Part I-IV');
row(k.id)[36]='Part I | I-1 ทดสอบ';
r=ctx.saveKpi(a.token,2570,{id:k.id,levels:['SAR','รายบุคคล','หน่วยงาน','bogus']}); assert(r.success&&r.changed);
console.log('stored:',row(k.id)[28],'| levels',r.kpi.levels,'| shown',r.kpi.level); assert(row(k.id)[28]==='รายบุคคล, หน่วยงาน, SAR'&&r.kpi.level==='SAR');
// visibility = union: with SAR, outsider sees it; remove SAR -> hidden
assert(ctx.getAllData(st.token,2570).data.some(x=>x.id===k.id));
row(k.id)[36]='';
r=ctx.saveKpi(a.token,2570,{id:k.id,levels:['รายบุคคล','หน่วยงาน']}); assert(r.kpi.level==='หน่วยงาน'); assert(!ctx.getAllData(st.token,2570).data.some(x=>x.id===k.id),'not visible to outsider');
r=ctx.saveKpi(a.token,2570,{id:k.id,levels:['ฝ่ายการพยาบาล','QA-หน่วยงาน']}); assert(r.kpi.level==='QA-หน่วยงาน'&&row(k.id)[28]==='หน่วยงาน, QA-หน่วยงาน');
// empty list ignored (kept), same list no change
r=ctx.saveKpi(a.token,2570,{id:k.id,levels:[]}); assert(r.success&&!r.changed&&row(k.id)[28]==='หน่วยงาน, QA-หน่วยงาน');
r=ctx.saveKpi(a.token,2570,{id:k.id,levels:['QA-หน่วยงาน','หน่วยงาน']}); assert(!r.changed);
// legacy QA-รพ in sheet -> read as QA-หน่วยงาน (dept-level visibility), saved as QA-หน่วยงาน
row(k.id)[28]='QA-รพ'; let kk=ctx.getAllData(a.token,2570).data.find(x=>x.id===k.id); assert(kk.level==='QA-หน่วยงาน'&&kk.levels.join()==='QA-หน่วยงาน');
assert(!ctx.getAllData(st.token,2570).data.some(x=>x.id===k.id),'QA-หน่วยงาน not visible to outsider');
r=ctx.saveKpi(a.token,2570,{id:k.id,levels:['QA-รพ','หน่วยงาน']}); assert(row(k.id)[28]==='หน่วยงาน, QA-หน่วยงาน',row(k.id)[28]);
row(k.id)[28]='QA-รพ, SAR'; assert(ctx.getAllData(a.token,2570).data.find(x=>x.id===k.id).levels.join()==='QA-หน่วยงาน,SAR');
const k2=all.find(x=>x.id!==k.id);
// old comma/slash formats parse
row(k2.id)[28]='SAR / หน่วยงาน'; assert(ctx.getAllData(a.token,2570).data.find(x=>x.id===k2.id).levels.join()==='หน่วยงาน,SAR');
row(k2.id)[28]='xyz'; assert(ctx.getAllData(a.token,2570).data.find(x=>x.id===k2.id).level==='รายบุคคล');
// staff cannot change levels
const mine=ctx.getAllData(st.token,2570).data.find(x=>x.mine); r=ctx.saveKpi(st.token,2570,{id:mine.id,levels:['รายบุคคล']}); assert(!r.changed&&row(mine.id)[28]==='SAR');
// add with multiple levels
const add=ctx.addIndicator(a.token,2570,{part:'Part I',category:'x',name:'n',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['SAR','หน่วยงาน']});
assert(row(add.newId)[28]==='หน่วยงาน, SAR'); const add2=ctx.addIndicator(a.token,2570,{part:'Part I',category:'x',name:'n2',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:[]}); assert(row(add2.newId)[28]==='SAR');
console.log('ALL OK');
