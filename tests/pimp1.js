// นำเข้าตัวชี้วัดรายบุคคลจาก Google Sheet (PersonalImport.js) — ข้อมูลสมมติเท่านั้น: แปลงเป้าหมาย · ชื่อบัญชี/ชื่อซ้ำ · ตรวจไฟล์ไม่เขียน · นำเข้า+สำรอง+log · รันซ้ำ · สิทธิ์
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;const FY=2570;
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const tA=tok(U.find(r=>r[2]==='admin')),stRow=U.find(r=>r[2]==='staff'),tS=tok(stRow);
const Y=()=>h.sheets['ปีงบ '+FY].d;

// ---- แปลงเป้าหมาย (รูปแบบจริงที่พบในไฟล์ต้นทาง)
const T=(t)=>C.pimpTarget_(t);const v=(t,val,sure)=>{const r=T(t);assert.strictEqual(r.value,val,JSON.stringify(t)+' → '+JSON.stringify(r));assert.strictEqual(r.sure,sure,'sure '+JSON.stringify(t)+' '+JSON.stringify(r))};
v('100','≥ 100',true);v('≥ 95%','≥ 95',true);v('≥ 98%','≥ 98',true);v('>98%','> 98',true);v('< 2%','< 2',true);v('< 0.5% ','< 0.5',true);
v('≥ ร้อยละ 90  ขึ้นไป','≥ 90',true);v('ร้อยละ 95 ขึ้นไป','≥ 95',true);v('ไม่ต่ำกว่าร้อยละ 95','≥ 95',true);v('ไม่เกิน 5','≤ 5',true);
v('1','≥ 1',false);v('0','= 0',false);
v('≥ 95% ของวันเปิดทำการทั้งหมดในเดือนนั้น','≥ 95',false);                                   // ข้อความยาว
v('ไม่น้อยกว่า 3 เรื่อง ต่อคน ต่อเดือน (คิดเป็น 100% ของเป้าหมายรายบุคคล)','≥ 3',false);       // เลขหลายค่า
v('บุคลากรทุกคนรายงานความเสี่ยงอย่างน้อย 3 เรื่อง ต่อคน ต่อเดือน (100%)','≥ 3',false);
v('≥ 85% - 95% ขึ้นไป','≥ 85',false);                                                         // ช่วง
v('0 ครั้ง (หรือ น้อยกว่า 2 ครั้งต่อเดือน','= 0',false);
v('เป็น 0% หรือ 0 ครั้ง (เนื่องจากส่งผลกระทบต่อความสุขสบายและการควบคุมอาการของผู้ป่วยระยะท้ายโดยตรง)','= 0',false);
v('<','',false);v('','',true);assert(T('').empty&&T('').note==='ไม่มีเป้าหมายในไฟล์');
assert.strictEqual(T('≥ ร้อยละ 90  ขึ้นไป').original,'≥ ร้อยละ 90 ขึ้นไป');
// ---- ชื่อ
eq(C.pimpSplitName_('น.ส.มานี  ใจดี'),{clean:'มานี ใจดี',first:'มานี',last:'ใจดี'});eq(C.pimpSplitName_('นางสาวทดสอบเอ รักงาน').first,'ทดสอบเอ');eq(C.pimpSplitName_('นายปิติ ดีมาก').last,'ดีมาก');eq(C.pimpSplitName_('ว่าที่ ร.ต.ชัย ใจกล้า').first,'ชัย');
assert.strictEqual(C.pimpStripNo_('1. อัตราความพร้อมใช้ set'),'อัตราความพร้อมใช้ set');assert.strictEqual(C.pimpStripNo_('3 ร้อยละของผ้า'),'ร้อยละของผ้า');assert.strictEqual(C.pimpStripNo_('2.1) ชื่อ'),'ชื่อ');
// ---- ไฟล์จำลอง (โครงเหมือนไฟล์จริง: หัวเรื่อง · หัวตาราง 17 คอลัมน์ · ชื่อคนอยู่แถวแรกของกลุ่ม · เลขข้อ · หน่วยใหม่)
const MON=['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.'];
const HEAD=['ตัวชี้วัดรายบุคคล','ตัวชี้วัด','เป้าหมาย','KPI Template'].concat(MON,['หน่วยงาน']);
const grp=(owner,unit,items)=>items.map((it,i)=>[i===0?owner:'',it[0],it[1],it[2]].concat(Array(12).fill(''),[unit]));
const collide=stRow[0];
const SRC1=[['ผู้ช่วยเหลือคนไข้/พนักงานเปล'].concat(Array(16).fill('')),HEAD]
 .concat(grp('น.ส.'+collide+' นามสมมติ','OPD',[['1. ตัวชี้วัดทดสอบ A','100','นิยาม A\nสูตร A'],['2. ตัวชี้วัดทดสอบ B','≥ ร้อยละ 90  ขึ้นไป','นิยาม B'],['3. ตัวชี้วัดทดสอบ C','','']]))
 .concat(grp('นางทดสอบเอ รักงาน','จ่ายกลาง',[['1 ตัวชี้วัดทดสอบ D','< 2%','นิยาม D'],['2 ตัวชี้วัดทดสอบ E','1','= ตัวคูณ นิยาม E'],['3 ตัวชี้วัดทดสอบ F','≥ 85% - 95% ขึ้นไป','นิยาม F']]))
 .concat(grp('นางทดสอบเอ ใจเย็น','ซักฟอก',[['1. ตัวชี้วัดทดสอบ G','≥ 95%','นิยาม G'],['2. ตัวชี้วัดทดสอบ H','>98%','นิยาม H']]));
const URL1='https://docs.google.com/spreadsheets/d/FAKE1/edit';
const mock=(rows)=>({getSheets:()=>[{getDataRange:()=>({getValues:()=>rows})}]});
const files={[URL1]:mock(SRC1)};
const origOpen=C.SpreadsheetApp.openByUrl;
C.SpreadsheetApp.openByUrl=(u)=>files[u]?files[u]:u==='https://docs.google.com/spreadsheets/d/DENIED/edit'?(()=>{throw new Error('no access')})():origOpen(u);

// ---- สิทธิ์ / URL
assert(!C.personalImportPreview(tS,URL1).success,'staff cannot preview');assert(!C.personalImportCommit(tS,URL1,{}).success,'staff cannot commit');assert(!C.personalImportPreview('bad',URL1).success);
let r=C.personalImportPreview(tA,'https://example.com/x');assert(!r.success&&/Google ชีต/.test(r.message),r.message);
r=C.personalImportPreview(tA,'https://docs.google.com/spreadsheets/d/DENIED/edit');assert(!r.success&&/เปิดไฟล์ไม่ได้/.test(r.message),r.message);
files['https://docs.google.com/spreadsheets/d/NOHEAD/edit']=mock([['a','b'],['c','d']]);r=C.personalImportPreview(tA,'https://docs.google.com/spreadsheets/d/NOHEAD/edit');assert(!r.success&&/หัวตาราง/.test(r.message),r.message);

// ---- ตรวจไฟล์: ไม่เขียนอะไร
const snap=()=>JSON.stringify([Y().length,U.length,Object.keys(h.sheets).sort()]);const before=snap();
r=C.personalImportPreview(tA,URL1);assert(r.success,JSON.stringify(r));const pv=r.preview;assert.strictEqual(snap(),before,'preview writes nothing');
assert.strictEqual(pv.fy,FY);assert.strictEqual(pv.stats.rows,8);assert.strictEqual(pv.stats.people,3);assert.strictEqual(pv.stats.include,8);assert.strictEqual(pv.stats.newAccounts,3);
const pm=Object.fromEntries(pv.people.map(p=>[p.fullName,p]));
const pc=pm[collide+' นามสมมติ'];assert(pc.status==='collision'&&pc.choice==='new'&&pc.username===collide+'น.'&&pc.existing.username===collide,JSON.stringify(pc));
const p1=pm['ทดสอบเอ รักงาน'],p2=pm['ทดสอบเอ ใจเย็น'];assert(p1.username==='ทดสอบเอ'&&p1.status==='fresh'&&p2.username==='ทดสอบเอใ.',JSON.stringify([p1,p2]));
eq(pv.newUnits.sort(),['จ่ายกลาง','ซักฟอก']);
const rw=pv.rows;assert.strictEqual(rw[0].name,'ตัวชี้วัดทดสอบ A');assert.strictEqual(rw[0].target.value,'≥ 100');assert(rw[2].target.empty&&rw[2].target.sure);assert(!rw[4].target.sure&&!rw[5].target.sure&&rw[3].target.sure);assert.strictEqual(pv.stats.review,2);assert.strictEqual(pv.stats.noTarget,1);

// ---- เลือกใช้บัญชีเดิม (คนเดิม) + แก้เป้า + ข้ามบางแถว → ตรวจก่อนเขียน
r=C.personalImportPreview(tA,URL1,{people:{[pc.key]:{choice:'existing'}},targets:{4:'≤ 1',5:'≥ 85'},skip:[2]});assert(r.success);
const q=r.preview,qc=q.people.find(p=>p.fullName===pc.fullName);assert(qc.choice==='existing'&&qc.username===collide&&!qc.created);assert.strictEqual(q.stats.newAccounts,2);assert.strictEqual(q.stats.include,7);
assert(q.rows[4].target.value==='≤ 1'&&q.rows[4].target.sure&&q.rows[5].target.value==='≥ 85'&&q.stats.review===0);assert(!r.preview.rows[2].include);
r=C.personalImportPreview(tA,URL1,{targets:{4:'เกือบ 5'}});assert(!r.success&&/ไม่อยู่ในรูปแบบ/.test(r.message),r.message);

// ---- นำเข้าจริง (ค่าตั้งต้น: ชื่อซ้ำ = สร้างบัญชีใหม่)
const nBefore=Y().length,uBefore=U.length,v0=C.dataVersion_(C.readChangeLog_());
r=C.personalImportCommit(tA,URL1,{});assert(r.success&&r.created===8&&r.skipped===0&&r.accounts.length===3,JSON.stringify(r));
assert.strictEqual(Y().length,nBefore+8);assert.strictEqual(U.length,uBefore+3);
const newU=U.slice(uBefore);eq(newU.map(x=>x[0]).sort(),[collide+'น.','ทดสอบเอ','ทดสอบเอใ.'].sort());newU.forEach(x=>{assert.strictEqual(x[2],'staff');assert.strictEqual(String(x[4]).toUpperCase(),'TRUE');assert(C.verifyPassword_('11038',x[1]),'default password');assert(String(x[1]).indexOf('11038')===-1,'no plain password')});
const rows=Y().slice(nBefore);const byName=n=>rows.find(x=>x[4]===n);
const A=byName('ตัวชี้วัดทดสอบ A'),Dd=byName('ตัวชี้วัดทดสอบ D'),Ee=byName('ตัวชี้วัดทดสอบ E'),Cc=byName('ตัวชี้วัดทดสอบ C'),Ff=byName('ตัวชี้วัดทดสอบ F');
assert(A&&Dd&&Ee&&Cc&&Ff);assert.strictEqual(A[5],'≥ 100');assert.strictEqual(A[25],collide+'น.');assert.strictEqual(A[26],'OPD');assert.strictEqual(A[28],'รายบุคคล');assert.strictEqual(A[24],'นิยาม A\nสูตร A');assert(!A[24].includes('เป้าหมายตามเอกสารต้นฉบับ'),'pure number: no original note');
assert.strictEqual(byName('ตัวชี้วัดทดสอบ B')[24],'นิยาม B\n\nเป้าหมายตามเอกสารต้นฉบับ: ≥ ร้อยละ 90 ขึ้นไป');assert.strictEqual(Cc[5],'');assert.strictEqual(Dd[5],'< 2');assert.strictEqual(Dd[26],'จ่ายกลาง');
assert(String(Ee[24]).startsWith("'=")&&Ee[24].includes('นิยาม E'),'text starting with = is stored as literal (apostrophe prefix): '+Ee[24]);
assert.strictEqual(rows.length,new Set(rows.map(x=>x[0])).size,'unique ids');rows.forEach(x=>{assert(/^KPI-\d+$/.test(x[0]));assert(x[2]&&x[3],'category set');assert.strictEqual(x[2],x[26]);assert(x[3]!==C.UNIT_CATS_PLACEHOLDER,'placeholder filled: '+x[3])});
// สำรอง + Tidy_Log + แจ้งเครื่องอื่น
const names=Object.keys(h.sheets);assert(names.some(n=>n.indexOf('สำรองก่อนนำเข้ารายบุคคล ')===0),'backup year sheet');assert(names.some(n=>n.indexOf('สำรองผู้ใช้ก่อนนำเข้ารายบุคคล ')===0),'backup users');
const log=h.sheets.Tidy_Log.d.slice(1).filter(x=>String(x[3]).indexOf('personal-import')===0);assert(log.some(x=>x[3]==='personal-import')&&log.filter(x=>x[3]==='personal-import-kpi').length===8&&log.filter(x=>x[3]==='personal-import-user').length===3,JSON.stringify(log.length));
assert(C.dataVersion_(C.readChangeLog_())>v0,'change log bumped');
// บัญชีใหม่ล็อกอินได้ เห็น/แก้ตัวของตัวเองได้
const la=C.authenticateUser('ทดสอบเอ','11038');assert(la.success&&la.user.tier==='staff',JSON.stringify(la));
const mine=C.getAllData(la.token,FY).data.filter(k=>k.isOwner);assert.strictEqual(mine.length,3);mine.forEach(k=>{assert(k.canEditResults&&k.canEditDetails);assert(k.levels.includes('รายบุคคล'))});
assert(la.user.depts.includes('จ่ายกลาง'),'staff unit derived from kpis');
// ---- รันซ้ำ: ข้ามทั้งหมด ไม่เกิดซ้ำ
r=C.personalImportPreview(tA,URL1);assert(r.success);assert.strictEqual(r.preview.stats.include,0);assert.strictEqual(r.preview.stats.skipSame,8);assert(r.preview.people.every(p=>p.status==='same'&&!p.created),JSON.stringify(r.preview.people.map(p=>p.status)));
const n2=Y().length,u2=U.length;r=C.personalImportCommit(tA,URL1,{});assert(r.success&&r.created===0&&/มีอยู่แล้ว/.test(r.message),JSON.stringify(r));assert.strictEqual(Y().length,n2);assert.strictEqual(U.length,u2);

// ---- ไฟล์ที่ 2: ใช้บัญชีเดิม (ชื่อต้นชน แล้วผู้ดูแลเลือก "คนเดียวกัน") + แถวที่ไม่มีหน่วยงาน
const other=U.find(x=>x[2]==='staff'&&x[0]!==collide);
const SRC2=[HEAD].concat(grp('นางสาว'+other[0]+' นามอื่น','ER',[['1. ตัวชี้วัดทดสอบ X','≥ 90','นิยาม X']])).concat([['นายคนไม่มีหน่วย','ตัวชี้วัดทดสอบ Y','100','นิยาม Y'].concat(Array(12).fill(''),[''])]);
const URL2='https://docs.google.com/spreadsheets/d/FAKE2/edit';files[URL2]=mock(SRC2);
r=C.personalImportPreview(tA,URL2);assert(r.success);const p2a=r.preview.people.find(p=>p.fullName===other[0]+' นามอื่น');assert(p2a.status==='collision'&&p2a.username===other[0]+'น.'),JSON.stringify(p2a);
assert(r.preview.rows.some(x=>x.problem==='ไม่มีหน่วยงานในไฟล์'&&!x.include));
const nb=Y().length,ub=U.length;r=C.personalImportCommit(tA,URL2,{people:{[p2a.key]:{choice:'existing'}}});assert(r.success&&r.created===1&&r.accounts.length===0,JSON.stringify(r));assert.strictEqual(U.length,ub,'no new account when using the existing one');
const X=Y().slice(nb)[0];assert.strictEqual(X[25],other[0]);assert.strictEqual(X[4],'ตัวชี้วัดทดสอบ X');
// ถ้าเลือก existing ที่ไม่มีบัญชีจริง = ไม่รับ (ใช้ค่าตั้งต้นสร้างใหม่)
console.log('pimp1 ok');
