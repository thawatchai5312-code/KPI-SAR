// level binding flows on live data (after tidy)
const h=require('./harness4');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;
const tok=C.createSession_('Admin',U.find(r=>r[0]==='Admin')[1]);
assert(C.tidyCommit(tok).success);
const S=h.sheets['ปีงบ 2570'];
const get=id=>C.rowToKpi_(S.d.find(r=>r[0]===id));
const show=k=>k.cats.map(c=>c.part+'›'+c.category).join(' ; ')+'  ['+k.levels+'] '+k.department;
// 1) add: QA+หน่วยงาน, dept ER, SAR without core -> error
let r=C.addIndicator(tok,2570,{name:'อัตราการคัดแยกผู้ป่วยถูกต้อง',cats:[{part:'ER',category:'Triage'}],levels:['SAR','QA-หน่วยงาน'],department:'ER',owner:'',years:[null,null,null,null,null],months:Array(12).fill(null)});
console.log('SAR no core:',r.success,r.message);assert(!r.success);
r=C.addIndicator(tok,2570,{name:'อัตราการคัดแยกผู้ป่วยถูกต้อง',cats:[{part:'Part III',category:'III-1 การเข้าถึงและเข้ารับบริการ'}],levels:['หน่วยงาน','QA-หน่วยงาน','SAR'],department:'ER / NSO',owner:'',years:[null,null,null,null,null],months:Array(12).fill(null)});
assert(r.success,r.message);let k=get(r.newId);console.log('add1',show(k));
assert(k.cats.some(c=>c.part==='ER QA'&&/^มิติที่/.test(c.category)));assert(k.cats.some(c=>c.part==='ER'&&c.category!=='รอจัดหมวดย่อย'));assert(!k.cats.some(c=>/NSO/.test(c.part)));
// 2) add unit level only, dept PCU
r=C.addIndicator(tok,2570,{name:'ร้อยละผู้สูงอายุได้รับการคัดกรอง',cats:[{part:'PCU',category:'รอจัดหมวดย่อย'}],levels:['หน่วยงาน'],department:'PCU',owner:'',years:[null,null,null,null,null],months:Array(12).fill(null)});
assert(r.success,r.message);k=get(r.newId);console.log('add2',show(k));assert(k.cats.length===1&&k.cats[0].part==='PCU'&&k.cats[0].category==='การคัดกรองและคัดแยก');
const id2=r.newId;
// 3) save: tick QA → adds PCU QA
r=C.saveKpi(tok,2570,{id:id2,levels:['หน่วยงาน','QA-หน่วยงาน']});assert(r.success,r.message);k=get(id2);console.log('tickQA',show(k));assert(k.cats.some(c=>c.part==='PCU QA'));
// 4) add dept OPD → OPD unit + OPD QA? (has both placements) 
r=C.saveKpi(tok,2570,{id:id2,department:'PCU / OPD'});assert(r.success,r.message);k=get(id2);console.log('addDept',show(k));assert(k.cats.some(c=>c.part==='OPD')&&k.cats.some(c=>c.part==='OPD QA'));
// 5) untick QA → QA placements gone
r=C.saveKpi(tok,2570,{id:id2,levels:['หน่วยงาน']});assert(r.success,r.message);k=get(id2);console.log('untickQA',show(k));assert(!k.cats.some(c=>/ QA$/.test(c.part)));
// 6) remove dept OPD
r=C.saveKpi(tok,2570,{id:id2,department:'PCU'});k=get(id2);console.log('rmDept',show(k));assert(!k.cats.some(c=>c.part.startsWith('OPD')));
// 7) QA-only NSO row: dept change does not add unit cat
const qaOnly=S.d.slice(1).map(C.rowToKpi_).find(x=>x.cats.length===1&&x.cats[0].part==='ER QA');
console.log('qaOnly before',qaOnly.id,show(qaOnly));
r=C.saveKpi(tok,2570,{id:qaOnly.id,department:qaOnly.department+' / IPD'});assert(r.success,r.message);k=get(qaOnly.id);console.log('qaOnly after',show(k));
assert(k.cats.some(c=>c.part==='IPD QA')&&!k.cats.some(c=>c.part==='IPD'));
// 8) result save untouched cats
const any=S.d.slice(1).map(C.rowToKpi_).find(x=>x.id.startsWith('NURSE'));const before=show(any);
r=C.saveKpi(tok,2570,{id:any.id,months:Array(12).fill(null).map((_,i)=>i===1?5:null)});assert(r.success);assert(show(get(any.id))===before);
// 9) visibility of QA cats: staff of OPD on a KPI with ER QA + OPD
const st=U.find(r=>r[2]==='staff'&&String(r[3]).includes('OPD')&&!String(r[3]).includes('ER'));
const stok=C.createSession_(st[0],st[1]);const data=C.getAllData(stok,2570);
const multi=data.data.find(x=>x.cats.some(c=>c.part==='OPD'))
console.log('staff',st[0],st[3],'sees',data.data.length,'any ER QA cat:',data.data.some(x=>x.cats.some(c=>c.part==='ER QA')));
console.log('pctOrder sample',data.data.filter(x=>x.pctOrder!==null).length);
// tidy idempotent after these edits
const p=C.tidyPreview(tok);console.log('tidy after edits hasWork',p.preview.hasWork,JSON.stringify(p.preview.fys.map(f=>[f.fy,f.rows])));
const pl=C.tidyPlanAll_();pl.fys.forEach(f=>f.comp.rows.filter(r=>r.changed).slice(0,4).forEach(r=>console.log(f.fy,r.id,JSON.stringify(r.changes).slice(0,400))));
