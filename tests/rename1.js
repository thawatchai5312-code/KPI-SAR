// เครื่องมือ admin เปลี่ยนชื่อ หมวด/หน่วยงาน (src/Rename.js) + ตารางชื่อเดิม→ชื่อใหม่ที่กันชื่อเก่ากลับมา (🧹 จัดระเบียบ, นำเข้า NSO, ลำดับหมวด)
// ข้อมูลทดสอบ = สำเนาข้อมูลจริงวันที่ 25 ต.ค. (ยังใช้ชื่อหมวด PCT เดิม) → ค่าตั้งต้น 5 ชื่อต้องถูกใช้ทุกที่
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const U=h.sheets.Users.d;
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const adminRow=U.find(r=>r[2]==='admin'),tA=tok(adminRow);
const staffRow=U.find(r=>r[2]==='staff'),tS=tok(staffRow);
const FY=[2569,2570];
const Y=fy=>h.sheets['ปีงบ '+fy].d;
const rowOf=(fy,id)=>Y(fy).slice(1).find(r=>String(r[0]).trim()===id);
const catsOf=r=>[[r[2],r[3]]].concat(String(r[36]||'').split('\n').filter(x=>x.includes('|')).map(x=>{const i=x.indexOf('|');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));
const pctCats=(fy)=>{const s={};Y(fy).slice(1).filter(r=>r[0]).forEach(r=>catsOf(r).filter(c=>c[0]==='PCT').forEach(c=>{s[c[1]]=(s[c[1]]||0)+1}));return s};
const OLD=['Med error','ระบุตัวผู้ป่วยผิดพลาด','ให้เลือดผิดคนผิดหมู่','วินิจฉัยคลาดเคลื่อน (9 มาตรฐาน)','การคัดแยกผู้ป่วย (9 มาตรฐาน)'];
const NEW=['9 มาตรฐาน : Med error','9 มาตรฐาน : ระบุตัวผู้ป่วยผิดพลาด','9 มาตรฐาน : ให้เลือดผิดคนผิดหมู่','9 มาตรฐาน : วินิจฉัยคลาดเคลื่อน','9 มาตรฐาน : การคัดแยกผู้ป่วย'];
const bad=(r,re,m)=>{assert(r.success&&r.preview&&r.preview.errors.length&&re.test(r.preview.errors.join('|')),(m||'')+JSON.stringify(r))};

// ================= ค่าตั้งต้น: 5 ชื่อหมวด PCT ที่เปลี่ยนไปแล้ว =================
OLD.forEach((o,i)=>eq(C.renameCat_('PCT',o),NEW[i],'seed '+o));
eq(C.renameCat_('PCT','STEMI'),'STEMI');eq(C.renameCat_('OPD','Med error'),'Med error','only PCT part');
const pg=C.renamePctGroups_();
OLD.forEach((o,i)=>{const oldIdx=C.VIEW_PCT_GROUPS.indexOf(o);assert(oldIdx>=0);eq(pg[oldIdx],NEW[i],'order position kept for '+o);assert(!pg.includes(o))});
eq(pg.length,C.VIEW_PCT_GROUPS.length);
// การจัดหมวดอัตโนมัติใช้ชื่อใหม่ (คำในชื่อ / ตัวที่ระบุไว้)
eq(C.viewPctGroupOf_('X-1','อุบัติการณ์เกิด Med error A-D',{}),'9 มาตรฐาน : Med error');
eq(C.viewPctGroupOf_('X-2','Under ESI 1 คัดแยก',{}),'9 มาตรฐาน : การคัดแยกผู้ป่วย');
eq(C.viewPctGroupOf_('X-3','อะไรก็ได้',{pctGroup:{'X-3':'ให้เลือดผิดคนผิดหมู่'}}),'9 มาตรฐาน : ให้เลือดผิดคนผิดหมู่');
// 🧹 จัดระเบียบ: ข้อมูลชุดนี้ยังเป็นชื่อเก่า → เปลี่ยนเป็นชื่อใหม่ แล้วไม่มีชื่อเก่าเหลือและรันซ้ำไม่มีอะไรเปลี่ยน
let c=C.tidyCommit(tA);assert(c.success,c.message);
FY.forEach(fy=>{const p=pctCats(fy);OLD.forEach(o=>assert(!p[o],fy+' old name left: '+o));NEW.forEach(n=>assert(p[n]>0,fy+' new name present: '+n))});
let pv=C.tidyPreview(tA);assert(pv.success&&!pv.preview.hasWork,'tidy idempotent after first run');
// หน้าเว็บได้ลำดับกลุ่มโรคและตารางชื่อหน่วย
let all=C.getAllData(tA,2570);assert(all.success);eq(all.pctGroups,pg);eq(all.unitRenames,{});
// ================= สิทธิ์ =================
let r=C.renamePreview(tS,{kind:'cat',part:'PCT',from:'STEMI',to:'X',years:[2570]});assert(!r.success&&/admin/.test(r.message));
r=C.renameCommit(tS,{kind:'cat',part:'PCT',from:'STEMI',to:'X',years:[2570]});assert(!r.success&&/admin/.test(r.message));
assert(!C.renameInfo(tS).success);
// ================= รายการหน่วย/หมวด =================
const info=C.renameInfo(tA);assert(info.success);const inv=info.inventory;eq(inv.years,[2570,2569]);
const unitOf=n=>inv.units.find(u=>u.name===n);
assert(unitOf('PCT').locked&&unitOf('NSO').locked&&unitOf('IC').locked&&unitOf('VIP').locked,'locked units');
assert(!unitOf('MSO').locked&&unitOf('MSO').users>0&&unitOf('MSO').years[2570]>0);
assert(unitOf('งานแผนฯ').users===0&&unitOf('งานแผนฯ').years[2570]>0,'unit without users is listed');
const partOf=p=>inv.parts.find(x=>x.part===p);
assert(partOf('PCT').cats.some(x=>x.name==='STEMI'&&x.years[2570]>0));assert(partOf('PCT').cats.some(x=>x.name==='9 มาตรฐาน : Med error'));
assert(!partOf('PCT').cats.some(x=>x.name==='Med error'),'inventory shows current names');
assert(partOf('Part I')&&partOf('Part I').core);
// ================= ตรวจชื่อ (หมวด) =================
const P=(o)=>C.renamePreview(tA,Object.assign({kind:'cat',part:'PCT',from:'STEMI',years:[2570]},o));
bad(P({to:''}),/ชื่อใหม่/);bad(P({to:'STEMI'}),/เหมือนชื่อเดิม/);bad(P({to:'a|b'}),/\|/);bad(P({to:'ก'.repeat(81)}),/ยาวเกิน/);
bad(P({to:C.UNIT_CATS_PLACEHOLDER}),/ชั่วคราว/);bad(P({from:'ไม่มีหมวดนี้',to:'x'}),/ไม่พบหมวด/);bad(P({years:[]}),/ปีงบ/);bad(P({years:[1999]}),/ปีงบ/);
bad(C.renamePreview(tA,{kind:'cat',part:'ER QA',from:partOf('ER QA').cats.find(x=>/^มิติที่ 1/.test(x.name)).name,to:'x',years:[2570]}),/มาตรฐาน/);
// ================= เปลี่ยนชื่อหมวด PCT (มี CLT) เฉพาะปี 2570 =================
const stemi=C.getCltDoc(tA,2570).kpis.filter(k=>k.groups.includes('STEMI'));assert(stemi.length>=2);const [k1,k2]=stemi;
[2569,2570].forEach(fy=>{
  assert(C.saveCltItem(tA,fy,'S|groups',JSON.stringify(['STEMI','Stroke']),0).success);
  assert(C.saveCltItem(tA,fy,'S|kpis',JSON.stringify(['STEMI|'+k2.id,'Stroke|'+k1.id]),0).success);
  assert(C.saveCltItem(tA,fy,'D|STEMI|context','บริบท STEMI '+fy,0).success);
  assert(C.saveCltItem(tA,fy,'D|STEMI|R|'+k1.id,'ผลลัพธ์ '+fy,0).success);
});
const cnt={2569:pctCats(2569).STEMI,2570:pctCats(2570).STEMI};assert(cnt[2570]>=2);
const before69=JSON.stringify(Y(2569));
let pr=P({to:'STEMI/ACS'.replace('/','-')});assert(pr.success&&pr.preview.canCommit&&!pr.preview.merge,JSON.stringify(pr));
eq(pr.preview.years.map(y=>[y.fy,y.count]),[[2570,cnt[2570]]]);
eq(pr.preview.clt.years.map(y=>[y.fy,y.ticks,y.excluded,y.keys]),[[2570,true,1,2]]);
assert.strictEqual(JSON.stringify(Y(2570)).includes('STEMI-ACS'),false,'preview writes nothing');
const v0=C.dataVersion_(C.readChangeLog_()),rev0=C.rowRev_(rowOf(2570,k1.id));
r=C.renameCommit(tA,{kind:'cat',part:'PCT',from:'STEMI',to:'STEMI-ACS',years:[2570]});assert(r.success,JSON.stringify(r));
eq(r.wrote.years,{2570:cnt[2570]});eq(r.wrote.clt,{keys:2,ticks:1,excluded:1});
assert.strictEqual(pctCats(2570).STEMI,undefined);assert.strictEqual(pctCats(2570)['STEMI-ACS'],cnt[2570]);
assert.strictEqual(JSON.stringify(Y(2569)),before69,'year not ticked is untouched');assert.strictEqual(pctCats(2569).STEMI,cnt[2569]);
assert.notStrictEqual(C.rowRev_(rowOf(2570,k1.id)),rev0,'rowRev changes → open editors get the conflict warning');
let d70=C.getCltDoc(tA,2570);eq(JSON.parse(d70.items['S|groups'].text),['STEMI-ACS','Stroke']);eq(JSON.parse(d70.items['S|kpis'].text),['STEMI-ACS|'+k2.id,'Stroke|'+k1.id]);
assert.strictEqual(d70.items['D|STEMI-ACS|context'].text,'บริบท STEMI 2570');assert.strictEqual(d70.items['D|STEMI-ACS|R|'+k1.id].text,'ผลลัพธ์ 2570');
assert(!d70.items['D|STEMI|context']||!d70.items['D|STEMI|context'].text,'old key gone');
let d69=C.getCltDoc(tA,2569);eq(JSON.parse(d69.items['S|groups'].text),['STEMI','Stroke']);assert.strictEqual(d69.items['D|STEMI|context'].text,'บริบท STEMI 2569','2569 CLT untouched');
// ตารางชื่อ + หน้าเว็บ + แจ้งเครื่องอื่น + ประวัติ + สำรอง
eq(C.renameCat_('PCT','STEMI'),'STEMI-ACS');assert(C.renamePctGroups_().includes('STEMI-ACS')&&!C.renamePctGroups_().includes('STEMI'));
assert(C.dataVersion_(C.readChangeLog_())>v0);let poll=C.pollChanges(tA,2570,v0);assert(poll.success&&poll.full&&poll.pctGroups.includes('STEMI-ACS')&&poll.docs.includes('CLT'));
const log=h.sheets.Tidy_Log.d;const lastRename=log.filter(x=>x[3]==='rename-cat').pop();assert(lastRename&&/PCT › STEMI → STEMI-ACS/.test(lastRename[4])&&lastRename[5]==='2570');
assert(log.some(x=>x[3]==='cats'&&x[2]===k1.id&&/STEMI-ACS/.test(x[5])),'per-row log');
const bk=Object.keys(h.sheets).filter(n=>n.indexOf('สำรองก่อนเปลี่ยนชื่อ ')===0);eq(bk.length,1);assert(h.sheets[bk[0]].hidden,'backup hidden');
// 🧹 และการจัดหมวดอัตโนมัติ ไม่ย้อนชื่อเดิมกลับมาในปีที่เปลี่ยน
const plan=C.tidyPlanAll_();plan.fys.filter(f=>f.fy===2570).forEach(f=>f.comp.rows.forEach(x=>{const nx=x.next.cats.filter(c=>c.part==='PCT').map(c=>c.category);assert(!nx.includes('STEMI'),'tidy keeps new name: '+x.id)}));
eq(C.viewPctGroupOf_('Z','ผู้ป่วย STEMI รอบใหม่',{}),'STEMI-ACS');
// เปลี่ยนซ้ำเรื่องเดิม = ไม่พบหมวดเดิมแล้ว
bad(P({to:'ใหม่อีก'}),/ไม่พบหมวด/);
// ปี 2569 เปลี่ยนตามทีหลัง (ชื่อเดิมในชีตยังเป็น STEMI แต่ระบบรู้จักว่าคือ STEMI-ACS)
pr=C.renamePreview(tA,{kind:'cat',part:'PCT',from:'STEMI-ACS',to:'STEMI-ACS2',years:[2569]});assert(pr.success&&pr.preview.canCommit,JSON.stringify(pr));
eq(pr.preview.years.map(y=>[y.fy,y.count]),[[2569,cnt[2569]]],'unticked-year rows are matched by their current name');
r=C.renameCommit(tA,{kind:'cat',part:'PCT',from:'STEMI-ACS',to:'STEMI-ACS2',years:[2569]});assert(r.success,JSON.stringify(r));
assert.strictEqual(pctCats(2569)['STEMI-ACS2'],cnt[2569]);eq(C.renameCat_('PCT','STEMI'),'STEMI-ACS2','chain flattened');eq(C.renameCat_('PCT','STEMI-ACS'),'STEMI-ACS2');
// ชื่อที่เลิกใช้แล้วใช้เป็นชื่อใหม่ไม่ได้
bad(C.renamePreview(tA,{kind:'cat',part:'PCT',from:'Stroke',to:'STEMI-ACS',years:[2570]}),/เคยถูกเปลี่ยนเป็น/);
// ================= รวมหมวด (ชื่อใหม่ซ้ำหมวดที่มีอยู่) + ข้อความ CLT ชนกัน =================
r=C.renameCommit(tA,{kind:'cat',part:'PCT',from:'STEMI-ACS2',to:'STEMI-ACS3',years:[2570]});assert(r.success,JSON.stringify(r));
assert(C.saveCltItem(tA,2570,'D|Stroke|challenge','เป้า Stroke',0).success);assert(C.saveCltItem(tA,2570,'D|STEMI-ACS3|plan','แผน STEMI',0).success);assert(C.saveCltItem(tA,2570,'D|Stroke|plan','แผน Stroke',0).success);
const nStroke=pctCats(2570).Stroke,nAcs=pctCats(2570)['STEMI-ACS3'];
pr=C.renamePreview(tA,{kind:'cat',part:'PCT',from:'Stroke',to:'STEMI-ACS',years:[2570]});
bad(pr,/เคยถูกเปลี่ยนเป็น/); // STEMI-ACS เลิกใช้แล้ว (→ STEMI-ACS3)
pr=C.renamePreview(tA,{kind:'cat',part:'PCT',from:'Stroke',to:'STEMI-ACS3',years:[2570]});assert(pr.success&&pr.preview.canCommit&&pr.preview.merge,JSON.stringify(pr));
assert(pr.preview.warnings.some(w=>/รวม/.test(w)),'merge warning');assert(pr.preview.clt.conflicts.length>=1,'CLT text conflict reported');
r=C.renameCommit(tA,{kind:'cat',part:'PCT',from:'Stroke',to:'STEMI-ACS3',years:[2570]});assert(r.success,JSON.stringify(r));
assert.strictEqual(pctCats(2570).Stroke,undefined);assert.strictEqual(pctCats(2570)['STEMI-ACS3'],nStroke+nAcs,'merged count');
d70=C.getCltDoc(tA,2570);eq(JSON.parse(d70.items['S|groups'].text),['STEMI-ACS3'],'ticks merged without duplicates');
assert.strictEqual(d70.items['D|STEMI-ACS3|challenge'].text,'เป้า Stroke','key without destination is moved');assert.strictEqual(d70.items['D|STEMI-ACS3|context'].text,'บริบท STEMI 2570','existing text kept');
assert.strictEqual(d70.items['D|STEMI-ACS3|plan'].text,'แผน STEMI','non-empty destination kept (not overwritten)');
// ตัวชี้วัดที่อยู่ทั้งสองหมวดรวมเป็นหมวดเดียว (ไม่ซ้ำ)
Y(2570).slice(1).filter(x=>x[0]).forEach(x=>{const k=catsOf(x).map(c=>c.join('|'));assert.strictEqual(new Set(k).size,k.length,'no duplicate cats '+x[0])});
// ================= เปลี่ยนกลับเป็นชื่อเดิม (ค่าตั้งต้นต้องไม่กลับมา) =================
r=C.renameCommit(tA,{kind:'cat',part:'PCT',from:'9 มาตรฐาน : Med error',to:'Med error',years:[2569,2570]});assert(r.success,JSON.stringify(r));
eq(C.renameCat_('PCT','Med error'),'Med error');eq(C.renameCat_('PCT','9 มาตรฐาน : Med error'),'Med error');
assert(C.renamePctGroups_().includes('Med error')&&!C.renamePctGroups_().includes('9 มาตรฐาน : Med error'));
eq(C.viewPctGroupOf_('Q','อุบัติการณ์เกิด Med error A-D',{}),'Med error');
FY.forEach(fy=>{assert(pctCats(fy)['Med error']>0&&!pctCats(fy)['9 มาตรฐาน : Med error'])});

// ================= เปลี่ยนชื่อหน่วยงาน =================
const UNIT='MSO',NEWU='MSOใหม่';
const unitUsers=U.slice(1).filter(x=>String(x[3]).split(/[\/\s,]+/).includes(UNIT));assert(unitUsers.length>=1);
const unitKpis=Y(2570).slice(1).filter(x=>x[0]&&String(x[26]).split(/[\/\s,]+/).includes(UNIT));assert(unitKpis.length>=2);
const UP=o=>C.renamePreview(tA,Object.assign({kind:'unit',from:UNIT,to:NEWU},o));
bad(UP({to:'MS O'}),/ช่องว่าง/);bad(UP({to:'A/B'}),/ช่องว่าง/);bad(UP({to:'งานIC'}),/ชื่อเรียกอื่น/);bad(UP({to:UNIT}),/เหมือนชื่อเดิม/);bad(UP({to:'PartX'}),/ใช้ชื่อนี้ไม่ได้/);bad(UP({to:''}),/ชื่อใหม่/);
['NSO','PCT','VIP','IC'].forEach(u=>bad(C.renamePreview(tA,{kind:'unit',from:u,to:'ชื่อใหม่'}),/เปลี่ยนชื่อไม่ได้/,u));
bad(UP({to:'NSO'}),/NSO/);bad(UP({from:'ไม่มีหน่วยนี้'}),/ไม่พบหน่วยงาน/);
// ตัวอย่างเสมอรวมทุกปีงบ (แม้ส่งปีเดียวมา)
pr=UP({years:[2570]});assert(pr.success&&pr.preview.canCommit&&!pr.preview.merge,JSON.stringify(pr));
eq(pr.preview.years.map(y=>y.fy).sort(),[2569,2570]);eq(pr.preview.usersCount,unitUsers.length);assert(pr.preview.users.every(u=>u.username));
// สิทธิ์ก่อนเปลี่ยน: ผู้ใช้ในหน่วยแก้ตัวชี้วัดของหน่วยได้
const memberRow=unitUsers.find(x=>x[2]==='head')||unitUsers.find(x=>x[2]==='staff');const tM=tok(memberRow);
const canEdit=(t,id,fy)=>{const k=C.getAllData(t,fy||2570).data.find(x=>x.id===id);return k?k.canEditDetails:null};
const probe=unitKpis.map(x=>String(x[0]).trim()).find(id=>canEdit(tM,id)===true);
r=C.renameCommit(tA,{kind:'unit',from:UNIT,to:NEWU});assert(r.success,JSON.stringify(r));eq(r.wrote.users,unitUsers.length);assert(/ออกจากระบบ/.test(r.usersNote));
FY.forEach(fy=>{Y(fy).slice(1).filter(x=>x[0]).forEach(x=>{
  assert(!String(x[26]).split(/[\/\s,]+/).includes(UNIT),fy+' dept text '+x[0]);
  catsOf(x).forEach(c=>assert(c[0]!==UNIT&&c[0]!==UNIT+' QA',fy+' cat part '+x[0]+' '+c[0]));
})});
assert(unitKpis.some(x=>String(rowOf(2570,String(x[0]).trim())[26]).includes(NEWU)),'dept text renamed');
U.slice(1).forEach(x=>{const ds=String(x[3]).split(/[\/\s,]+/);assert(!ds.includes(UNIT),'user '+x[0])});
assert(unitUsers.every(x=>String(U.find(y=>y[0]===x[0])[3]).split(/[\/\s,]+/).includes(NEWU)),'users moved to the new unit');
eq(C.renameUnit_(UNIT),NEWU);eq(C.parseDepts_('ER / '+UNIT),['ER',NEWU]);eq(C.viewDeptOfPart_(UNIT+' QA'),NEWU);eq(C.viewDeptOfPart_(NEWU+' QA'),NEWU);
assert(C.viewIsSupportUnit_(NEWU),'support-unit rule follows the old name');
// สิทธิ์ยังทำงาน: ผู้ใช้ในหน่วยแก้ได้เหมือนเดิม · ผู้ใช้เดิมที่ถือชื่อใหม่ในชีตใหม่ก็ใช้ได้
if(probe)assert.strictEqual(canEdit(tM,probe),true,'permission kept after rename');
// ชื่อเดิมค้างอยู่ในชีต (จำลองปีงบที่ยังไม่ได้ย้าย) → ตารางชื่อทำให้สิทธิ์ยังถูกต้อง
const probeRow=rowOf(2570,probe||String(unitKpis[0][0]).trim());const savedDept=probeRow[26];probeRow[26]=String(savedDept).replace(NEWU,UNIT);
if(probe)assert.strictEqual(canEdit(tM,probe),true,'permission works with the old unit name still in the sheet');
probeRow[26]=savedDept;
// 🧹 / นำเข้า NSO ไม่ย้อนชื่อหน่วยเดิมกลับมา
const plan2=C.tidyPlanAll_();plan2.fys.forEach(f=>f.comp.rows.forEach(x=>x.next.cats.forEach(cc=>assert(cc.part!==UNIT&&cc.part!==UNIT+' QA','tidy keeps new unit name '+x.id))));
const np=C.nsoImportPreview(tA);assert(np.success,JSON.stringify(np));
// ชื่อเดิมของหน่วยที่เปลี่ยนไปแล้วใช้เป็นชื่อใหม่ของหน่วยอื่นไม่ได้ · รวมเข้าหน่วยที่มีอยู่แล้วได้
const OTHER=C.renameInfo(tA).inventory.units.filter(u=>!u.locked&&u.name!==NEWU&&u.name!=='งานแผนฯ'&&u.name!=='งานแผน')[0].name;
bad(C.renamePreview(tA,{kind:'unit',from:OTHER,to:UNIT}),/เคยถูกเปลี่ยนเป็น/);
// รวมหน่วย: "งานแผนฯ" (ไม่มีผู้ใช้) → "งานแผน" (มีผู้ใช้)
pr=C.renamePreview(tA,{kind:'unit',from:'งานแผนฯ',to:'งานแผน'});assert(pr.success&&pr.preview.canCommit&&pr.preview.merge&&pr.preview.warnings.some(w=>/รวม/.test(w)),JSON.stringify(pr));
const planKpis=Y(2570).slice(1).filter(x=>x[0]&&String(x[26]).includes('งานแผนฯ')).map(x=>String(x[0]).trim());assert(planKpis.length>=1);
const planUser=U.slice(1).find(x=>String(x[3]).split(/[\/\s,]+/).includes('งานแผน'));const tP=tok(planUser);
const before=planKpis.map(id=>canEdit(tP,id));
r=C.renameCommit(tA,{kind:'unit',from:'งานแผนฯ',to:'งานแผน'});assert(r.success,JSON.stringify(r));
planKpis.forEach(id=>{const dept=String(rowOf(2570,id)[26]);assert(/งานแผน/.test(dept)&&!/งานแผนฯ/.test(dept),dept)});
const after=planKpis.map(id=>canEdit(tP,id));assert(after.every(x=>x!==false),'merged unit: members see/edit their unit KPIs '+JSON.stringify([before,after]));
// เปลี่ยนชื่อหน่วยที่เพิ่งรวมไป → ต่อโซ่ถูกต้อง
eq(C.renameUnit_('งานแผนฯ'),'งานแผน');
r=C.renameCommit(tA,{kind:'unit',from:'งานแผน',to:'งานแผนใหม่'});assert(r.success,JSON.stringify(r));eq(C.renameUnit_('งานแผนฯ'),'งานแผนใหม่');eq(C.renameUnit_('งานแผน'),'งานแผนใหม่');
// ตารางชื่ออยู่ในหน้าเว็บ + สำรอง/ประวัติ
all=C.getAllData(tA,2570);eq(all.unitRenames.MSO,NEWU);eq(all.unitRenames['งานแผนฯ'],'งานแผนใหม่');
assert(Object.keys(h.sheets).some(n=>n.indexOf('สำรองผู้ใช้ก่อนเปลี่ยนชื่อหน่วย ')===0&&h.sheets[n].hidden));
assert(h.sheets.Tidy_Log.d.some(x=>x[3]==='rename-unit'&&/MSO → MSOใหม่/.test(x[4])));assert(h.sheets.Tidy_Log.d.some(x=>x[3]==='user-dept'));
// คนไม่ใช่ admin เปลี่ยนไม่ได้ · ผู้ใช้ที่ถูกเปลี่ยนหน่วยยัง login ได้และเห็นหน่วยใหม่
const lg=C.authenticateUser(memberRow[0],'pw123456');assert(lg.success&&lg.user.depts.includes(NEWU)&&!lg.user.depts.includes(UNIT),JSON.stringify(lg.user));
console.log('rename1 ok');
