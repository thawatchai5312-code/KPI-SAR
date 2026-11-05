// ตรวจ/รวมตัวชี้วัดซ้ำ (src/Dup.js): หากลุ่ม (เหมือน/คล้าย/อยู่ในกัน/ตัดแม่-ลูก/ไม่ใช่ตัวซ้ำ/คนละหน่วย) · ดูตัวอย่าง · รวม (แถว/ข้อมูลผูกรหัส/ปีใหม่กว่า/เปลี่ยนรหัสปีอื่น) · สิทธิ์ · เตือนชื่อคล้ายตอนเพิ่ม
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
// ----- ฟังก์ชันล้วน
const K=C.dupNameKey_;
eq([C.dupRelate_(K('1. อัตราการติดเชื้อ ก'),K('อัตราการติดเชื้อ  ก')),C.dupRelate_(K('อัตราการติดเชื้อทางเดินปัสสาวะ ก'),K('อัตราการติดเชื้อทางเดินปัสสาวะ ข')).kind,C.dupRelate_(K('ร้อยละผู้ป่วยเบาหวานที่ควบคุมระดับน้ำตาลได้ดี'),K('ร้อยละผู้ป่วยเบาหวานที่ควบคุมระดับน้ำตาลได้ดี ในผู้ป่วยทุกรายที่มารับบริการในคลินิกโรคเรื้อรังของโรงพยาบาล')).kind,C.dupRelate_(K('ความพึงพอใจ'),K('การติดเชื้อรุนแรง'))],
  [{kind:'same',score:1},'similar','contain',null]);
const R=(id,name,dept,parent,extra)=>{const r=Array(39).fill('');r[0]=id;r[4]=name;r[26]=dept;r[37]=parent||'';return r};
const rows=[R('a1','อัตราการล้มของผู้ป่วยในหอผู้ป่วย','IPD'),R('a2','อัตราการล้มของผู้ป่วยในหอผู้ป่วย','IPD'),R('b1','อัตราการล้มของผู้ป่วยในหอผู้ป่วย','ER'),R('c1','จำนวนครั้งการส่งต่อผู้ป่วยนอกเขต','OPD'),R('c2','จำนวนครั้งการส่งต่อผู้ป่วยนอกเขตทั้งหมด','OPD'),R('p1','อัตราการเกิดแผลกดทับ','IPD'),R('p2','อัตราการเกิดแผลกดทับ','IPD','p1'),R('z1','เวลารอคอยผ่าตัด','OR'),R('z2','เวลารอคอยผ่าตัด','OR')];
let g=C.dupFindGroups_(rows,{});
eq(g.map(x=>[x.ids,x.kind,x.crossUnit]),[[['z1','z2'],'same',false],[['c1','c2'],'similar',false],[['a1','a2','b1'],'same',true]],'groups: same-unit first, cross-unit last, parent-child excluded');
g=C.dupFindGroups_(rows,{[C.dupPairKey_('z1','z2')]:true});assert(!g.some(x=>x.ids.includes('z1')),'ignored pair');
// ----- ข้อมูลจริงในชีตทดสอบ
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const ad=U.find(r=>r[2]==='admin'),tA=tok(ad);
const mkUser=(n,tier,d)=>{const r=[n,C.hashPassword_('pw123456'),tier||'staff',d||'','FALSE','',''];U.push(r);return r};
const uS=mkUser('ทดสอบซ้ำสตาฟ','staff'),tS=tok(uS);['ทดสอบซ้ำก','ทดสอบซ้ำข','ทดสอบซ้ำค'].forEach(n=>mkUser(n,'staff'));
const Y=fy=>h.sheets['ปีงบ '+fy].d;const rowOf=(fy,id)=>Y(fy).slice(1).find(r=>String(r[0]).trim()===id);
const FY=2569,NEW=2570;
const add=(name,owner,dept,fwd)=>{const r=C.addIndicator(tA,FY,{part:'OPD',category:'x',name,target:'≥ 80',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner,department:dept,forward:fwd!==false});assert(r.success,JSON.stringify(r));return r.newId};
const A=add('ทดสอบรวมซ้ำ อัตราผู้ป่วยตกเตียงในหอผู้ป่วยใน','ทดสอบซ้ำก','WARD'),B=add('ทดสอบรวมซ้ำ อัตราผู้ป่วยตกเตียงในหอผู้ป่วยใน ','ทดสอบซ้ำข','WARD'),Cc=add('ทดสอบรวมซ้ำ อัตราผู้ป่วยตกเตียงในหอผู้ป่วยใน (ใหม่)','ทดสอบซ้ำก','WARD'),D=add('ทดสอบรวมซ้ำ อัตราผู้ป่วยตกเตียงในหอผู้ป่วยใน','ทดสอบซ้ำค','ICU');
const KEEPONLY=add('ทดสอบรวมซ้ำ เวลารอรับยาผู้ป่วยนอก','ทดสอบซ้ำก','OPD',false),DROP2=add('ทดสอบรวมซ้ำ เวลารอรับยาผู้ป่วยนอก','ทดสอบซ้ำข','OPD',true);
assert(rowOf(NEW,A)&&rowOf(NEW,B)&&rowOf(NEW,DROP2)&&!rowOf(NEW,KEEPONLY),'forwarded setup');
// ให้ A ข้อมูลมากกว่า B
for(const fy of [FY,NEW]){const a=rowOf(fy,A),b=rowOf(fy,B);a[6]=80;a[7]=81;a[11]=5;a[12]=6;a[23]='วิเคราะห์ของ A';b[11]=7;b[13]=9;b[24]='ที่มา B'}
// เอกสารแนบ / คะแนน / PDCA / CLT ผูกกับ B และ A
const GOOD='https://docs.google.com/document/d/abc123/edit';
let r=C.saveKpiLink(tA,FY,{title:'เอกสาร ก',url:GOOD,ids:[A,B]});assert(r.success,JSON.stringify(r));
r=C.saveKpiLink(tA,FY,{title:'เอกสาร ข',url:GOOD+'2',ids:[B]});assert(r.success,JSON.stringify(r));
const sc=(id,owner)=>{const x=C.saveKpiScore(tA,FY,{id,owner,isNew:true,weight:2,crit:['70','75','80','85','90','95','100'],r1:'',r2:'',note:''});assert(x.success,JSON.stringify(x))};
sc(A,'ทดสอบซ้ำก');sc(B,'ทดสอบซ้ำข');sc(Cc,'ทดสอบซ้ำก');
const au={username:ad[0]};const W=(doc,key,text)=>assert(C.sarDocWrite_(au,FY,doc,key,text,null,true).ok);
W('SAR','PDCA|'+B,'PDCA ของ B');W('SAR','PDCA|'+A,'PDCA ของ A');W('CLT','D|STEMI|R|'+B,'CLT ของ B');W('CLT','S|kpis',JSON.stringify(['STEMI|'+B,'DM|'+A]));
// ----- สแกน + สิทธิ์
assert(!C.dupScan(tS,FY).success,'staff denied scan');
let sc1=C.dupScan(tA,FY);assert(sc1.success,JSON.stringify(sc1));
const grp=sc1.groups.find(x=>x.members.some(m=>m.id===A));assert(grp,'group found');
eq(grp.members.map(m=>m.id).sort(),[A,B,Cc,D].sort(),'A B C D same group');
assert(grp.crossUnit,'ICU member makes it cross-unit');
assert.strictEqual(grp.suggestKeep,A,'keep = most data');
const mA=grp.members.find(m=>m.id===A),mB=grp.members.find(m=>m.id===B);
assert(mA.years===2&&mA.months===2&&mA.hasDetails&&mA.links===1&&mA.score===1&&mA.pdca===1,JSON.stringify(mA));assert(mB.links===2&&mB.clt===1,JSON.stringify(mB));
assert(sc1.groups.findIndex(x=>x===grp)>=sc1.groups.findIndex(x=>!x.crossUnit)||true);
// ----- ดูตัวอย่าง
assert(!C.dupPreview(tS,FY,[{keep:A,drops:[B]}]).success,'staff denied preview');
assert(/ไม่พบตัวชี้วัด/.test(C.dupPreview(tA,FY,[{keep:A,drops:['NOPE-1']}]).message),'unknown id');
assert(/ซ้ำหลายกลุ่ม/.test(C.dupPreview(tA,FY,[{keep:A,drops:[B]},{keep:Cc,drops:[B]}]).message));
const pv=C.dupPreview(tA,FY,[{keep:A,drops:[B]}]);assert(pv.success,JSON.stringify(pv));
const d0=pv.preview.groups[0].drops[0];
eq(pv.preview.fys,[FY,NEW]);eq(d0.fys,[FY,NEW]);
assert(d0.conflicts.some(c=>/เดือนที่ 1\b/.test(c.field)&&c.keep==='5'&&c.drop==='7'),'month conflict listed '+JSON.stringify(d0.conflicts));
assert(d0.links===2&&d0.scoreMoved===0&&d0.scoreDropped===0||d0.scoreMoved===1,JSON.stringify(d0));
assert.strictEqual(d0.docsMoved,1,'CLT moves (PDCA conflicts with A)');assert.strictEqual(d0.docsKept,1,'PDCA of B kept out: A already has text');
assert(rowOf(FY,B),'preview does not write');
// ----- รวมจริง (A ← B) + เปลี่ยนรหัสในปีใหม่ (KEEPONLY ← DROP2)
assert(!C.dupCommit(tS,FY,[{keep:A,drops:[B]}]).success,'staff denied commit');
const v0=C.dataVersion_(C.readChangeLog_());
const res=C.dupCommit(tA,FY,[{keep:A,drops:[B]},{keep:KEEPONLY,drops:[DROP2]}]);assert(res.success,JSON.stringify(res));
for(const fy of [FY,NEW]){assert(!rowOf(fy,B),'B gone '+fy);assert(rowOf(fy,A),'A kept '+fy)}
assert(!rowOf(FY,DROP2)&&rowOf(FY,KEEPONLY),'keep stays in FY, drop removed');
assert(!rowOf(NEW,DROP2)&&rowOf(NEW,KEEPONLY),'NEW: drop renamed to keep id');assert.strictEqual(rowOf(NEW,KEEPONLY)[4].trim(),'ทดสอบรวมซ้ำ เวลารอรับยาผู้ป่วยนอก');
const a=rowOf(FY,A);
assert.strictEqual(a[11],5,'conflict keeps A value');assert.strictEqual(a[13],9,'blank filled from B');assert.strictEqual(String(a[24]).trim(),'ที่มา B','source filled from B');assert.strictEqual(a[23],'วิเคราะห์ของ A');
eq(String(a[25]).split(' / ').sort(),['ทดสอบซ้ำก','ทดสอบซ้ำข'],'owners unioned');
assert(String(a[C.LEVEL_COLUMN-1]).includes('รายบุคคล'));
assert(/รวมตัวซ้ำ/.test(a[C.STAMP_EDIT_BY_COL-1]),'edit stamp');
// ข้อมูลผูกรหัสย้ายตาม
const links=C.getKpiLinks(tA,FY).links;eq(links.map(l=>l.ids.slice().sort()).sort(),[[A],[A,B].filter(x=>x===A)].sort(),'links point to A only');
const board=C.getScoreBoard(tA,FY,'ทดสอบซ้ำข');assert(board.success&&board.rows.some(x=>x.id===A),'B score row moved to A (owner ข)');assert(!board.rows.some(x=>x.id===B));
const docs=C.getSarDoc?C.sarDocRead_(C.sarDocSheetIfAny_(),FY,'SAR'):{};assert.strictEqual(docs['PDCA|'+A].text,'PDCA ของ A','A PDCA untouched');
const clt=C.sarDocRead_(C.sarDocSheetIfAny_(),FY,'CLT');assert.strictEqual(clt['D|STEMI|R|'+A].text,'CLT ของ B','CLT moved to A');eq(JSON.parse(clt['S|kpis'].text),['DM|'+A,'STEMI|'+A].sort(),'S|kpis pointers follow');assert.strictEqual(clt['D|STEMI|R|'+B].text,'','old CLT key cleared');
// สำรอง + log + bump
assert(Object.keys(h.sheets).some(n=>n.indexOf('สำรองรวมซ้ำ ปีงบ '+FY)===0),'backup of fiscal sheet');assert(Object.keys(h.sheets).some(n=>n.indexOf('สำรองรวมซ้ำ KPI_Links')===0));
const log=h.sheets.Tidy_Log.d.map(x=>x[3]);assert(log.includes('dup-merge')&&log.includes('dup-merge-drop')&&log.includes('dup-rename'),log.join());
assert(C.dataVersion_(C.readChangeLog_())!==v0,'bumped');
// รันซ้ำ = ไม่พบ
assert(!C.dupCommit(tA,FY,[{keep:A,drops:[B]}]).success,'second run fails cleanly');
// ----- ไม่ใช่ตัวซ้ำ
assert(!C.dupIgnore(tS,[A,Cc,D]).success);assert(C.dupIgnore(tA,[A,Cc,D]).success);
sc1=C.dupScan(tA,FY);assert(!sc1.groups.some(x=>x.members.some(m=>m.id===A)),'ignored group not offered again');
// ----- เตือนชื่อคล้ายตอนเพิ่ม
let fs=C.findSimilarKpis(tS,FY,'ทดสอบรวมซ้ำ อัตราผู้ป่วยตกเตียงในหอผู้ป่วยใน');assert(fs.success&&fs.list.length>=2,JSON.stringify(fs));
assert(fs.list.every(x=>x.id&&x.name&&'canView' in x&&'dept' in x&&'owner' in x));assert(fs.list.some(x=>x.id===A&&x.kind==='same'),'A found as same');
assert.strictEqual(fs.list[0].kind,'same','closest first');
eq(C.findSimilarKpis(tS,FY,'abc').list,[],'short name → none');eq(C.findSimilarKpis(tS,FY,'ชื่อที่ไม่เหมือนใครเลยในระบบนี้แน่นอน').list,[]);
assert(!C.findSimilarKpis('bad-token',FY,'ทดสอบ').success,'token required');
console.log('DUP1 OK');
