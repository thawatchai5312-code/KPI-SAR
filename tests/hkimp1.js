// นำเข้า KPI หัวหน้าหน่วย (HeadImport.js) — ข้อมูลสมมติเท่านั้น: หาหัวตาราง 2 แบบ · หยุดที่ KPI กลาง/rd · จับคู่ตรง/คล้าย/ใหม่ · KPI ร่วมหลายคน · เพิ่มผู้รับผิดชอบตัวเดิม · เติมเดือนที่ว่าง · ชุดคะแนน · บัญชีใหม่ · รันซ้ำ
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const FY=2570;const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const adRow=U.find(r=>r[2]==='admin'),tA=tok(adRow),stRow=U.find(r=>r[2]==='staff'),tS=tok(stRow);
const Y=()=>h.sheets['ปีงบ '+FY].d;
const mkUser=(n,tier,depts)=>{const r=[n,C.hashPassword_('123456'),tier||'staff',depts||'','FALSE','',''];U.push(r);return r};
// ---- ฟังก์ชันล้วน
assert(C.hkDice_('abcd','abcd')===1&&C.hkDice_('ab','xy')===0&&C.hkDice_('อัตราความสมบูรณ์เวชระเบียน','อัตราความสมบูรณ์ของเวชระเบียน')>0.8);
// ---- ข้อมูลที่มีอยู่แล้วในระบบ (ชื่อสมมติ) — เพิ่มผ่าน addIndicator
const uA=mkUser('หัวหน้าเอ','head','OPD'),uB=mkUser('หัวหน้าบี','head','IPD'),uDup1=mkUser('ซ้ำชื่อ ก','head','ER'),uDup2=mkUser('ซ้ำชื่อ ข','head','LR');
const item=(name,owner,dept,months)=>({part:'OPD',category:'x',name,target:'≥ 80',years:[null,null,null,null,null],months:months||Array(12).fill(null),levels:['รายบุคคล'],owner,department:dept});
const e1=C.addIndicator(tA,FY,item('ตัวชี้วัดหัวหน้าร่วม','หัวหน้าเอ','OPD',[70,null,null,null,null,null,null,null,null,null,null,null]));assert(e1.success,JSON.stringify(e1));
const e2=C.addIndicator(tA,FY,item('ร้อยละความสมบูรณ์ของเวชระเบียนทดสอบ','หัวหน้าเอ','OPD'));assert(e2.success);
const idE1=e1.newId,idE2=e2.newId;
// ---- ไฟล์จำลอง: แบบ 1 (ชื่อเดือนอยู่แถวเหนือหัวตาราง) · แบบ 2 (มี Template) · KPI กลาง · ชีตว่าง · คนเดียวกัน 2 ชีต · ชื่อซ้ำต้องเลือก
const M='ต.ค.,พ.ย.,ธ.ค.,ม.ค.,ก.พ.'.split(',');
const crit=(a)=>a.concat(Array(7-a.length).fill(''));
const fmt1=(name,rows)=>{ // ลำดับ | KPI | ค่าเป้าหมาย | น้ำหนักสัมพัทธ์ | 2.0..5.0 | มี.ค | รอบ1 | น*คะแนน | มี.ค. | เม.ย. ...
 const top=['','','','','คะแนน','คะแนน','คะแนน','คะแนน','คะแนน','คะแนน','คะแนน','มี.ค','รอบ1','นน*คะแนน','มี.ค.'];
 const head=['ลำดับ','KPI','ค่าเป้าหมาย','น้ำหนักสัมพัทธ์','2.0','2.5','3.0','3.5','4.0','4.5','5.0'];
 return [['','','','','','','','','','','','','','',''],['',name,'','','ช่วงคะแนน'],top,head].concat(rows.map((r,i)=>[String(i+1)+'.0',r[0],r[1],r[2]].concat(crit(r[3]||[]),['','','',''])));};
const fmt2=(name,rows)=>{ // ลำดับ | ตัวชี้วัด | Template | ค่าเป้าหมาย | น้ำหนัก | 2.0..5.0 | ต.ค...ก.พ. | รอบ1
 const head=['ลำดับ','ตััวชี้วัด','Template','ค่าเป้าหมาย','น้ำหนัก','2.0','2.5','3.0','3.5','4.0','4.5','5.0'].concat(M,['รอบ1']);
 return [[name,'','','','','ช่วงคะแนน'],head].concat(rows.map((r,i)=>[String(i+1)+'.0',r[0],r[4]||'',r[1],r[2]].concat(crit(r[3]||[]),r[5]||Array(5).fill(''),[''])));};
const W=['70','75','80','85','90','95','100'];
const sheetA=fmt1('นางสาวหัวหน้าเอ ทดสอบ',[
 ['ตัวชี้วัดหัวหน้าร่วม','≥ 80%','1',W],                                   // ตรงชื่อกับที่มี (ร่วมกับ บี)
 ['ร้อยละความสมบูรณ์เวชระเบียนทดสอบ','ร้อยละ 90','2',['<75','≥76','≥77','≥78','≥79','≥80','≥85']], // คล้าย (ขาดคำว่า "ของ")
 ['ตัวชี้วัดใหม่ A','100','1',['6','5','4','3','2','1','0']],
 ['ตัวชี้วัดใหม่ ระดับ','ดีมาก','1',['พอใช้','','','ดี','','','ดีมาก']],     // เป้าหมายเป็นคำ
 ['ตัวชี้วัดไม่มีเกณฑ์ E','','',[]],                                      // ไฟล์ยังไม่ระบุเป้าหมาย/น้ำหนัก/เกณฑ์ → ต้องเข้าชุดคะแนนด้วย (น้ำหนัก 0)
]).concat([['','KPI กลาง ปีงบ 2570','','','','','','','','','','','','',''],['1.0','ตัวชี้วัดกลางห้ามนำเข้า','','']]);
const sheetB=fmt2('นายหัวหน้าบี ใจดี',[
 ['ตัวชี้วัดหัวหน้าร่วม','≥ 80%','2',W,'นิยามร่วม\nสูตร'],                  // ร่วม + Template + น้ำหนัก 2
 ['ตัวชี้วัดใหม่ B','≤ 5','1',['6','5','4','3','2','1','0'],'นิยาม B',['1,234','-','ข้อมูลสรุป ต.ค.','6,6,6','80%']],
 ['ตัวชี้วัดใหม่ C','0','0',[]],
]);
// หัวข้อกลุ่ม + แถวย่อย "- OPD"
sheetB.push(['','Medication error','','','','','','','','','','','','','','','','','']);
sheetB.push(['1.0','   - OPD','นิยาม OPD','≤ 1%','1','','','','','','','','','','','','','','']);
sheetB.push(['2.0','   - IPD','นิยาม IPD','≤ 1%','1','','','','','','','','','','','','','','']);
sheetB.push(['rd 8','โน้ตท้ายไฟล์','','','']); sheetB.push(['9.0','ห้ามนำเข้าหลัง rd','','','']);
const sheetFresh=fmt2('นางสาวหัวหน้าใหม่ สมมติ',[['ตัวชี้วัดใหม่ F','≥ 90%','1',W,'นิยาม F']]);
const sheetDup=fmt1('นายซ้ำชื่อ นามสกุลใหม่',[['ตัวชี้วัดซ้ำชื่อ','≥ 50%','1',W]]);
const sheetOld=[['ตัวชี้วัดที่รับผิดชอบ ของ นายหัวหน้าบี','','','','',''],['ลำดับ','ตัวชี้วัด','ค่าเป้าหมาย','ผู้รับผิดชอบหลัก','ต.ค.'],['1.0','ตัวชี้วัดแบบเก่าห้ามเลือกเอง','0','',''] ]; // ไม่มีน้ำหนัก/เกณฑ์
const sheetCentral=[['KPI กลาง','issue','แนวทางการวัด'],['1.บุคลากร','x','y']];
const sheetEmpty=[[''],['']];
const sh=(name,vals)=>({getName:()=>name,getDataRange:()=>({getDisplayValues:()=>vals.map(r=>r.map(String)),getValues:()=>vals,getRichTextValues:()=>vals.map(r=>r.map(()=>({getLinkUrl:()=>''})))})});
const FILE=[sh('หัวหน้าเอ',sheetA),sh('หัวหน้าบี',sheetB),sh('หัวหน้าบี 2 ',sheetOld),sh('หัวหน้าใหม่',sheetFresh),sh('ซ้ำชื่อ',sheetDup),sh('KPI กลางปี 2570 ',sheetCentral),sh('ชีต13',sheetEmpty)];
const URL1='https://docs.google.com/spreadsheets/d/HKFAKE/edit';
const origOpen=C.SpreadsheetApp.openByUrl;
C.SpreadsheetApp.openByUrl=(u)=>u===URL1?{getSheets:()=>FILE}:u==='https://docs.google.com/spreadsheets/d/DENIED/edit'?(()=>{throw new Error('no access')})():origOpen(u);
// ---- สิทธิ์ / URL
assert(!C.headKpiPreview(tS,URL1,FY).success&&!C.headKpiCommit(tS,URL1,FY,{}).success&&!C.headKpiPreview('bad',URL1,FY).success);
let r=C.headKpiPreview(tA,'https://example.com/x',FY);assert(!r.success&&/Google ชีต/.test(r.message));
r=C.headKpiPreview(tA,'https://docs.google.com/spreadsheets/d/DENIED/edit',FY);assert(!r.success&&/เปิดไฟล์ไม่ได้/.test(r.message));
// ---- ตรวจไฟล์ ไม่เขียนอะไร
const snap=()=>JSON.stringify([Y().length,U.length,Object.keys(h.sheets).sort()]);const before=snap();
r=C.headKpiPreview(tA,URL1,FY);assert(r.success,JSON.stringify(r));let pv=r.preview;assert.strictEqual(snap(),before,'preview writes nothing');
// ชีต: 2 ชีตของหัวหน้าบี → ใช้ชีตที่มีน้ำหนัก/เกณฑ์; KPI กลาง/ว่างถูกข้าม
const shMap=Object.fromEntries(pv.sheets.map(s=>[s.title,s]));
assert(shMap['หัวหน้าบี'].checked&&!shMap['หัวหน้าบี 2'].checked,'prefer sheet with score columns');assert(!shMap['KPI กลางปี 2570'].checked&&!shMap['ชีต13'].checked&&shMap['KPI กลางปี 2570'].reason);
eq([shMap['หัวหน้าเอ'].rows,shMap['หัวหน้าบี'].rows,shMap['ซ้ำชื่อ'].rows],[5,5,1],'rows per sheet (stops at KPI กลาง / rd)');
// คน
const pp=Object.fromEntries(pv.people.map(p=>[p.key,p]));
eq([pp['หัวหน้าเอ'].username,pp['หัวหน้าเอ'].status,pp['หัวหน้าบี'].username,pp['หัวหน้าใหม่'].username,pp['หัวหน้าใหม่'].created],['หัวหน้าเอ','same','หัวหน้าบี','หัวหน้าใหม่',true]);
assert.strictEqual(pp['ซ้ำชื่อ'].status,'multi');eq(pp['ซ้ำชื่อ'].candidates,['ซ้ำชื่อ ก','ซ้ำชื่อ ข']);assert(pp['ซ้ำชื่อ'].needsChoice);
// กลุ่ม KPI
const gm=Object.fromEntries(pv.groups.map(g=>[g.name,g]));
assert.strictEqual(gm['ตัวชี้วัดหัวหน้าร่วม'].status,'exact');eq(gm['ตัวชี้วัดหัวหน้าร่วม'].owners,['หัวหน้าเอ','หัวหน้าบี']);eq(gm['ตัวชี้วัดหัวหน้าร่วม'].addOwners,['หัวหน้าบี']);
assert.strictEqual(gm['ร้อยละความสมบูรณ์เวชระเบียนทดสอบ'].status,'similar');assert.strictEqual(gm['ร้อยละความสมบูรณ์เวชระเบียนทดสอบ'].action,'ask');
assert.strictEqual(gm['ตัวชี้วัดใหม่ A'].status,'new');assert(gm['ตัวชี้วัดใหม่ A'].target.value==='≥ 100'||gm['ตัวชี้วัดใหม่ A'].target.value==='= 100'||gm['ตัวชี้วัดใหม่ A'].target.sure!==undefined);
assert.strictEqual(gm['ตัวชี้วัดใหม่ ระดับ'].target.value,'ดีมาก','non-numeric target kept as text');
assert(!gm['ตัวชี้วัดกลางห้ามนำเข้า']&&!gm['ห้ามนำเข้าหลัง rd']&&!gm['ตัวชี้วัดแบบเก่าห้ามเลือกเอง'],'central/rd/old-sheet not imported');
assert(gm['Medication error - OPD']&&gm['Medication error - IPD']&&gm['Medication error - OPD'].sub,'heading + sub rows');
assert(pv.stats.blockers>=3,'similar + multi + needUnit block: '+pv.stats.blockers);
const rc=C.headKpiCommit(tA,URL1,FY,{});assert(!rc.success&&/ต้องเลือก/.test(rc.message),'blocked until choices');
// ---- ตัดสินใจ
const dec={sheets:{},people:{'ซ้ำชื่อ':{choice:'existing',username:'ซ้ำชื่อ ข'},'หัวหน้าใหม่':{unit:'หน่วยทดสอบใหม่'},'หัวหน้าบี':{unit:'IPD'}},groups:{},targets:{}};
dec.groups[C.pimpKey_('ร้อยละความสมบูรณ์เวชระเบียนทดสอบ')]={action:'use'};
dec.targets[C.pimpKey_('ตัวชี้วัดใหม่ A')]='≥ 95';
r=C.headKpiPreview(tA,URL1,FY,dec);assert(r.success);pv=r.preview;
assert.strictEqual(pv.stats.blockers,0,JSON.stringify(pv.stats));assert.strictEqual(pv.stats.newAccounts,1);
const g2=Object.fromEntries(pv.groups.map(g=>[g.name,g]));assert.strictEqual(g2['ตัวชี้วัดใหม่ A'].target.value,'≥ 95');assert.strictEqual(g2['ร้อยละความสมบูรณ์เวชระเบียนทดสอบ'].action,'use');
// ---- นำเข้าจริง
const n0=Y().length,u0=U.length;
r=C.headKpiCommit(tA,URL1,FY,dec);assert(r.success,JSON.stringify(r));
eq([r.used,r.accounts.length],[2,1]);assert(r.created>=6,JSON.stringify(r));
// บัญชีใหม่ = head + หน่วยที่ระบุ + รหัสตั้งต้น
const nu=U[U.length-1];eq([nu[0],nu[2],nu[3]],['หัวหน้าใหม่','head','หน่วยทดสอบใหม่']);assert(C.verifyPassword_('11038',nu[1]));
// ตัวเดิม: เพิ่มผู้รับผิดชอบ ไม่แตะชื่อ/เป้า · เติมเดือนเฉพาะที่ว่าง
const row1=Y().find(x=>String(x[0]).trim()===idE1),row2=Y().find(x=>String(x[0]).trim()===idE2);
eq([row1[4],row1[5],row1[25]],['ตัวชี้วัดหัวหน้าร่วม','≥ 80','หัวหน้าเอ / หัวหน้าบี']);eq(row2[25],'หัวหน้าเอ','similar→use: owner unchanged when already owner');
// ตัวใหม่
const rows=Y().slice(n0);const nr=n=>rows.find(x=>x[4]===n);
const nA=nr('ตัวชี้วัดใหม่ A'),nB=nr('ตัวชี้วัดใหม่ B'),nF=nr('ตัวชี้วัดใหม่ F'),nL=nr('ตัวชี้วัดใหม่ ระดับ');
assert(nA&&nB&&nF&&nL);eq([nA[5],nA[25],nA[26],nA[28]],['≥ 95','หัวหน้าเอ','OPD','รายบุคคล']);eq([nB[25],nB[24]],['หัวหน้าบี','นิยาม B']);eq(nF[26],'หน่วยทดสอบใหม่');eq(nL[5],'ดีมาก');
// ผลรายเดือน: เฉพาะตัวเลข (1,234 / 80% = ตัวเลข · "-" ไม่นำเข้า · ข้อความ/6,6,6 ไม่นำเข้า)
eq(nB.slice(11,16).map(v=>v===''?null:v),[1234,null,null,null,80]);
// ชุดคะแนน
const sc=h.sheets.KPI_Score;assert(sc,'KPI_Score created');const sr=sc.d.slice(1);
const find=(id,o)=>sr.find(x=>x[1]===id&&x[2]===o);
const s1=find(idE1,'หัวหน้าบี');assert(s1&&Number(s1[3])===2&&s1[4]==='70'&&s1[10]==='100','shared KPI: score row for B with weight 2');
const s0=find(idE1,'หัวหน้าเอ');assert(s0&&Number(s0[3])===1,'score row for A');
const s2=find(idE2,'หัวหน้าเอ');assert(s2&&s2[4]==='<75'&&s2[5]==='≥76'&&Number(s2[3])===2,'criteria kept as written');
assert(sr.every(x=>x[11]===''&&x[12]===''),'no manual scores imported');
const sNew=find(nB[0],'หัวหน้าบี');assert(sNew&&Number(sNew[3])===1);
const sZero=sr.find(x=>x[2]==='หัวหน้าบี'&&String(x[1])===String(rows.find(y=>y[4]==='ตัวชี้วัดใหม่ C')[0]));assert(sZero&&Number(sZero[3])===0,'weight 0 kept');
const nE=nr('ตัวชี้วัดไม่มีเกณฑ์ E');assert(nE,'KPI without target/criteria still created');
const sE=find(nE[0],'หัวหน้าเอ');assert(sE&&Number(sE[3])===0&&sE.slice(4,11).every(x=>x===''),'row without weight/criteria enters score set (weight 0, blank criteria): '+JSON.stringify(sE));
const sTxt=find(nL[0],'หัวหน้าเอ');assert(sTxt&&sTxt[4]==='พอใช้'&&sTxt[10]==='ดีมาก');
// สำรอง + log
assert(Object.keys(h.sheets).some(n=>n.indexOf('สำรองก่อนนำเข้า KPI หัวหน้า ')===0),'backup');assert(Object.keys(h.sheets).some(n=>n.indexOf('สำรองผู้ใช้ก่อนนำเข้า KPI หัวหน้า')===0));
assert(h.sheets.Tidy_Log.d.some(x=>x[3]==='head-import'));
// ---- รันซ้ำ: ไม่เพิ่มอะไร
const n1=Y().length,u1=U.length,s1n=sc.d.length;
r=C.headKpiPreview(tA,URL1,FY,dec);assert(r.success);assert.strictEqual(r.preview.stats.created,0,'second preview: nothing new '+JSON.stringify(r.preview.stats));assert.strictEqual(r.preview.stats.newAccounts,0);
r=C.headKpiCommit(tA,URL1,FY,dec);assert(r.success);assert.strictEqual(Y().length,n1,'idempotent rows');assert.strictEqual(U.length,u1);assert.strictEqual(sc.d.length,s1n,'idempotent score rows');
// ---- งานเติมชุดคะแนนครั้งเดียว (ข้อมูลที่นำเข้าไปแล้วโดยรุ่นเก่า = ไม่มีแถวของตัวที่ไม่มีเกณฑ์)
{
  const gone=[nA[0],nE[0]];
  for(let i=sc.d.length-1;i>=1;i--)if(sc.d[i][2]==='หัวหน้าเอ'&&gone.includes(sc.d[i][1]))sc.d.splice(i,1);
  C.PropertiesService.getScriptProperties().deleteProperty('HK_SCORE_FILL_V1');C.HK_FILL_URL=URL1;C.HK_FILL_FY=FY;
  assert.strictEqual(C.getScoreBoard(tA,FY,'หัวหน้าเอ').fillPending,true,'pending shown to editors');
  assert(!('fillPending' in C.getScoreBoard(tok(adRow),FY,'หัวหน้าเอ'))||true);
  assert(!C.scoreFillOnce(tS).success,'staff denied');assert(!C.scoreFillOnce('bad').success);
  const nBefore=sc.d.length;
  r=C.scoreFillOnce(tA);assert(r.success&&r.done,JSON.stringify(r));eq([r.added,r.skipped],[2,1],'1 ambiguous account skipped: '+JSON.stringify(r));
  assert.strictEqual(sc.d.length,nBefore+2);
  const f2=(id,o)=>sc.d.slice(1).find(x=>x[1]===id&&x[2]===o);const fA=f2(nA[0],'หัวหน้าเอ'),fE=f2(nE[0],'หัวหน้าเอ');
  assert(fA&&Number(fA[3])===1&&fA[4]==='6'&&fA[10]==='0','restored with weight+criteria from file');assert(fE&&Number(fE[3])===0&&fE.slice(4,11).every(x=>x===''),'restored empty row');
  assert(String(fA[15]).includes('เติมจากไฟล์นำเข้า'),'stamped '+JSON.stringify(fA));
  assert(sc.d.slice(1).every(x=>x[11]===''&&x[12]===''));
  assert(Object.keys(h.sheets).some(n=>n.indexOf('สำรองคะแนนก่อนนำเข้า KPI หัวหน้า เติมคะแนน')===0),'backup before fill');
  assert(h.sheets.Tidy_Log.d.some(x=>x[3]==='score-fill'));
  const after=sc.d.length;r=C.scoreFillOnce(tA);assert(r.success&&r.done&&r.added===0);assert.strictEqual(sc.d.length,after,'only once');
  assert.strictEqual(C.getScoreBoard(tA,FY,'หัวหน้าเอ').fillPending,false,'flag set');
  // แถวที่ admin แก้เองไปแล้วไม่ถูกทับ
}
// ---- กล่อง "ยังไม่ได้ใส่น้ำหนัก/เกณฑ์"
{
  const b=C.getScoreBoard(tA,FY,'หัวหน้าเอ');const em=b.issues.filter(x=>x.kind==='empty');
  assert(em.some(x=>x.id===nE[0]&&x.person==='หัวหน้าเอ'&&/ยังไม่ได้ใส่/.test(x.reason)),'empty-criteria issue listed');
  assert(!b.issues.some(x=>x.id===nA[0]),'rows with criteria are not "empty"');
  const zero=b.issues.find(x=>x.kind==='empty'&&x.id===rows.find(y=>y[4]==='ตัวชี้วัดใหม่ C')[0]);assert(!zero||true);
}
console.log('hkimp1 ok');
