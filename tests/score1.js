// ระบบคะแนน KPI (Score.js): แปลงเกณฑ์ · คิดคะแนน (ขึ้น/ลง/ข้อความ/คำนวณไม่ได้/0) · ชุดคะแนนต่อคน · สิทธิ์ · แก้ชน · เปลี่ยนชื่อผู้ใช้ · ลอกปีใหม่
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const FY=2570;
// ----- แปลงเกณฑ์
const P=C.scoreParseCrit_;
eq([P('80'),P('80%'),P('≥ 85'),P('>=85'),P('>5'),P('<75'),P('≤ 2 %'),P('มากกว่า 1'),P('ไม่เกิน 3'),P('ร้อยละ 70'),P('1 ครั้ง/ปี'),P('๗๐')],
 [{op:'',num:80},{op:'',num:80},{op:'≥',num:85},{op:'≥',num:85},{op:'>',num:5},{op:'<',num:75},{op:'≤',num:2},{op:'>',num:1},{op:'≤',num:3},{op:'',num:70},{op:'',num:1},{op:'',num:70}]);
eq([P(''),P(null),P('6,6,6'),P('0/0/0'),P('2026-10-07 00:00:00'),P('ผ่าน 3 ข้อ')],[null,null,null,null,null,null],'unreadable');
eq([P('A'),P(' ดีมาก ')],[{text:'a'},{text:'ดีมาก'}]);
// ----- คิดคะแนน
const L=(res,crit,tg)=>{const r=C.scoreLevelFor_(res,crit,tg);return r.ok?r.score:'X:'+r.reason};
const up=['70','75','80','85','90','95','100'];
eq([L(100,up),L(97,up),L(80,up),L(70,up),L(60,up)],[5,4.5,3,2,0],'up: ≥, below 2.0 = 0');
const down=['6','5','4','3','2','1','0'];
eq([L(0,down),L(1,down),L(3.5,down),L(6,down),L(7,down)],[5,4.5,3,2,0],'down: ≤');
// มีเครื่องหมายในช่อง: <75 ที่ 2.0, ≥76.. ที่ 2.5
const mixed=['<75','≥76','≥77','≥78','≥79','≥80','≥85'];
eq([L(70,mixed),L(76,mixed),L(78.5,mixed),L(86,mixed),L(75.5,mixed)],[2,2.5,3.5,5,0]);
// ลง + >5 ที่ 2.0
const dgt=['>5','5','4','3','2','1','0'];eq([L(7,dgt),L(5,dgt),L(3,dgt),L(0,dgt)],[2,2.5,3.5,5]);
// ช่องว่างบางช่อง · ค่าหลายตัว = ข้ามช่องนั้น
eq([L(0,['มากกว่า 1','1','','','','','0']),L(2,['มากกว่า 1','1','','','','','0']),L(1,['มากกว่า 1','1','','','','','0'])],[5,2,2.5]);
eq([L(5,['6,6,6','5,5,5','4','3','2','1','0']),L(3,['6,6,6','5,5,5','4','3','2','1','0'])],[0,3.5],'multi-value cells skipped');
// ไม่เรียงตามทิศ / ไม่มีเลข = คำนวณไม่ได้
assert(/ไม่เรียง/.test(L(80,['70','90','80','85','90','95','100'])));
assert(/ไม่มีเกณฑ์/.test(L(80,['','','','','','',''])));assert(/อ่านไม่ได้/.test(L(5,['6,6,6','5,5,5','','','','',''])));
// ตรวจเกณฑ์อย่างเดียว (ใช้ทำรายการเกณฑ์ที่ต้องแก้)
eq([C.scoreCritCheck_(['70','75','80','85','90','95','100'],'').ok,C.scoreCritCheck_(['','','','','','','ผ่าน'],'').kind,/ไม่เรียง/.test(C.scoreCritCheck_(['70','75','80','85','90','85','90'],'').reason)],[true,'text',true]);
// ข้อความ
eq([L('A',['D','C','B-','B','B+','A-','A']),L('ดีมาก',['พอใช้','','','ดี','','','ดีมาก']),L('Z',['D','C','B-','B','B+','A-','A'])].map(x=>String(x).slice(0,2)),['5','5','X:']);
// ช่องเดียว: ดูเครื่องหมายเป้าหมาย
eq([L(3,['','','','','','','5'],'≤ 5'),L(7,['','','','','','','5'],'≤ 5'),L(7,['','','','','','','5'],'≥ 5')],[5,0,5]);
// ----- ผลรอบ
eq([C.scoreRoundResult_([10,20,30,'-',null,null,1,2,3,4,5,6],0,5,'เฉลี่ย'),C.scoreRoundResult_([10,20,30,'-',null,null,1,2,3,4,5,6],0,5,'ผลรวม'),C.scoreRoundResult_([10,20,30,'-',null,null,1,2,3,4,5,6],6,11,'เดือนล่าสุด'),C.scoreRoundResult_(['A',null,'B',null,null,null,null,null,null,null,null,null],0,5,'เฉลี่ย'),C.scoreRoundResult_(Array(12).fill(null),0,5,'เฉลี่ย')],[20,60,6,'B',null]);
// ----- ชุดคะแนนต่อคน
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const ad=U.find(r=>r[2]==='admin'),tA=tok(ad);
const mkUser=(n,tier)=>{const r=[n,C.hashPassword_('pw123456'),tier||'staff','','FALSE','',''];U.push(r);return r};
const uM=mkUser('ทดสอบคะแนนก','head'),uS=mkUser('ทดสอบคะแนนสตาฟ'),uN=mkUser('ทดสอบคะแนนข','head'),uE=mkUser('ทดสอบผอ','executive');
const item=(name,owner)=>({part:'OPD',category:'x',name,target:'≥ 80',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner,department:'OPD'});
const k1=C.addIndicator(tA,FY,item('ตัวชี้วัดคะแนน 1','ทดสอบคะแนนก'));assert(k1.success,JSON.stringify(k1));
const k2=C.addIndicator(tA,FY,item('ตัวชี้วัดคะแนน 2','ทดสอบคะแนนก'));assert(k2.success);
const k3=C.addIndicator(tA,FY,item('ตัวชี้วัดคะแนน 3','ทดสอบคะแนนข'));assert(k3.success);
const id1=k1.newId,id2=k2.newId,id3=k3.newId;assert(id1&&id2&&id3&&id1!==id2&&id2!==id3);
const tM=tok(uM),tN=tok(uN),tE=tok(uE);
const base={weight:2,crit:['70','75','80','85','90','95','100'],r1:'',r2:'',note:''};
// สิทธิ์แก้: เฉพาะ admin/ผอ.
assert(!C.saveKpiScore(tM,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',isNew:true},base)).success,'head cannot edit');
const tSt=tok(uS);assert(!C.saveKpiScore(tSt,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',isNew:true},base)).success,'staff cannot edit');
assert(!C.saveKpiScore(tN,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',isNew:true},base)).success,'head cannot edit');
// เพิ่ม: ตัวชี้วัดต้องมีและเป็นของคนนั้น
let r=C.saveKpiScore(tA,FY,Object.assign({id:id3,owner:'ทดสอบคะแนนก',isNew:true},base));assert(!r.success&&/ผู้รับผิดชอบ/.test(r.message),JSON.stringify(r));
r=C.saveKpiScore(tA,FY,Object.assign({id:'KPI-NOPE',owner:'ทดสอบคะแนนก',isNew:true},base));assert(!r.success&&/ไม่พบตัวชี้วัด/.test(r.message));
r=C.saveKpiScore(tA,FY,Object.assign({id:id1,owner:'ไม่มีคนนี้',isNew:true},base));assert(!r.success);
r=C.saveKpiScore(tA,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',isNew:true},base,{weight:'abc'}));assert(!r.success&&/น้ำหนัก/.test(r.message));
r=C.saveKpiScore(tA,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',isNew:true},base,{r1:'4.3'}));assert(!r.success&&/0–5/.test(r.message));
r=C.saveKpiScore(tA,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',isNew:true},base,{crit:['x'.repeat(70),'','','','','','']}));assert(!r.success&&/ยาวเกิน/.test(r.message));
assert(C.saveKpiScore(tA,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',isNew:true},base)).success);
assert(C.saveKpiScore(tA,FY,Object.assign({id:id2,owner:'ทดสอบคะแนนก',isNew:true},base,{weight:1,crit:['6','5','4','3','2','1','0']})).success);
assert(C.saveKpiScore(tA,FY,Object.assign({id:id3,owner:'ทดสอบคะแนนข',isNew:true},base,{weight:3})).success);
assert(!C.saveKpiScore(tA,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',isNew:true},base)).success,'duplicate row');
// ชีตเก็บเป็นข้อความ (@) ที่เกณฑ์/หมายเหตุ — harness ไม่จำลองชนิด ตรวจแค่ค่า
const sc=h.sheets.KPI_Score;assert(sc&&sc.d.length===4,'3 rows + header');eq(sc.d[0],C.SCORE_HEADERS);
// อ่าน: เจ้าตัวเห็นของตัวเอง แม้ขอ person อื่น · แก้ไม่ได้
let b=C.getScoreBoard(tM,FY,'');assert(b.success&&b.person==='ทดสอบคะแนนก'&&b.rows.length===2&&!b.canEdit&&!b.people);
b=C.getScoreBoard(tM,FY,'ทดสอบคะแนนข');eq(b.person,'ทดสอบคะแนนก','head cannot view others');
// staff เข้าหน้าคะแนนไม่ได้
r=C.getScoreBoard(tSt,FY,'');assert(!r.success&&/หัวหน้าหน่วยขึ้นไป/.test(r.message),JSON.stringify(r));assert(!C.getScoreBoard(tSt,FY,'ทดสอบคะแนนก').success);
assert(!C.getScoreCandidates(tSt,FY,'ทดสอบคะแนนก').success);eq([C.scoreMeta(tSt,FY).allowed,C.scoreMeta(tSt,FY).has],[false,false]);
b=C.getScoreBoard(tN,FY,'ทดสอบคะแนนก');eq([b.person,b.rows.length],['ทดสอบคะแนนข',1],'head sees own only');
b=C.getScoreBoard(tA,FY,'ทดสอบคะแนนก');assert(b.canEdit&&b.rows.length===2&&b.people.includes('ทดสอบคะแนนข'));
assert(C.getScoreBoard(tE,FY,'ทดสอบคะแนนข').canEdit,'executive edits');
// ผังแถบซ้าย (dir): admin/ผอ. = ทุกคนจัดตามหน่วย · หัวหน้า = ตัวเอง · ไม่นับตัวชี้วัดที่ถูกลบ
const dirA=C.getScoreBoard(tA,FY,'').dir;const allP=dirA.flatMap(u=>u.people.map(p=>p.person));
assert(allP.includes('ทดสอบคะแนนก')&&allP.includes('ทดสอบคะแนนข'),JSON.stringify(dirA).slice(0,300));
dirA.forEach(u=>{eq(u.people.map(p=>p.person),u.people.map(p=>p.person).slice().sort((a,b)=>a.localeCompare(b,'th')),'people sorted in unit')});
const pm=dirA.flatMap(u=>u.people).find(p=>p.person==='ทดสอบคะแนนก');eq([pm.count,pm.kpis.length],[2,2]);assert(pm.kpis.some(k=>k.id===id1&&/ตัวชี้วัดคะแนน 1/.test(k.name)));
const dirM=C.getScoreBoard(tM,FY,'').dir;eq([dirM.length,dirM[0].people.length,dirM[0].people[0].person],[1,1,'ทดสอบคะแนนก'],'head dir = self only');
eq(C.getScoreBoard(tE,FY,'').dir.flatMap(u=>u.people).length,allP.length,'executive sees all');
let meta=C.scoreMeta(tM,FY);assert(meta.has&&!meta.editor);meta=C.scoreMeta(tE,FY);assert(meta.editor&&meta.total===3);assert(!C.scoreMeta(tok(U.find(r=>r[2]==='staff'&&r[0]!=='ทดสอบคะแนนสตาฟ')),FY).has);
// คำนวณ: รอบ 1 (ต.ค.–มี.ค.) ผล kpi1 เฉลี่ย 85 → 3.5 ×น้ำหนัก 2 = 7 · kpi2 ผล 3 → (ลง) 3.5 ×1 · รอบ 2 ยังไม่มีผล
const setMonths=(id,m)=>{const k=C.getAllData(tA,FY).data.find(x=>x.id===id);const rr=C.saveKpi(tA,FY,{id,years:k.years,months:m});assert(rr.success,JSON.stringify(rr))};
setMonths(id1,[80,90,85,null,null,null,null,null,null,null,null,null]);setMonths(id2,[3,3,3,null,null,null,null,null,null,null,null,null]);
b=C.getScoreBoard(tM,FY,'');const R1=b.rows.find(x=>x.id===id1),R2=b.rows.find(x=>x.id===id2);
eq([R1.rounds[0].score,R1.rounds[0].source,R1.weighted[0],R1.rounds[1].source],[3.5,'calc',7,'none']);
eq([R2.rounds[0].score,R2.weighted[0]],[3.5,3.5]);
eq([b.totals.full,b.totals.rounds[0].sum,b.totals.rounds[0].scored,b.totals.rounds[1].scored,b.totals.year.sum],[15,10.5,2,0,10.5]);
assert(Math.abs(b.totals.rounds[0].pct-70)<0.01,JSON.stringify(b.totals.rounds[0]));
// ผลบางส่วน: รอบ 1 กรอก 3/6 เดือน → partial · ร้อยละเฉพาะที่มีคะแนน = 10.5/15 = 70 (ทั้งสองแถวมีคะแนน)
eq([R1.rounds[0].partial,R1.rounds[0].filled,R1.rounds[0].expected],[true,3,6]);assert(Math.abs(b.totals.rounds[0].pctScored-70)<0.01);
// วิธีสรุป "ผลรวม" + ผลไม่ครบ + รอบยังไม่จบ → wait (ยังไม่คิด) · ครบ 6 เดือน → คิด
{const k=C.getAllData(tA,FY).data.find(x=>x.id===id2);let rr=C.saveKpi(tA,FY,{id:id2,years:k.years,months:k.months,summaryMethod:'ผลรวม'});assert(rr.success,JSON.stringify(rr));
 const ended=C.scoreRoundEnded_(FY,0);let bb=C.getScoreBoard(tM,FY,'').rows.find(x=>x.id===id2);
 if(!ended){eq([bb.rounds[0].source,bb.rounds[0].score,bb.weighted[0]],['wait',null,null],'sum + partial → wait')}
 const k2=C.getAllData(tA,FY).data.find(x=>x.id===id2);rr=C.saveKpi(tA,FY,{id:id2,years:k2.years,months:[0,0,0,0,1,'-',null,null,null,null,null,null]});assert(rr.success);
 bb=C.getScoreBoard(tM,FY,'').rows.find(x=>x.id===id2);eq([bb.rounds[0].partial,bb.rounds[0].source,bb.rounds[0].result,bb.rounds[0].score],[false,'calc',1,4.5],'complete round ("-" counts as filled) → calc');
 // ร้อยละเฉพาะที่มีคะแนน: เมื่อรอบ 2 ไม่มีผล = null
 assert(C.getScoreBoard(tM,FY,'').totals.rounds[1].pctScored===null);
 // ความถี่รายไตรมาส: รอบ 1 ต้องมี 2 รอบเก็บ (ต.ค.–ธ.ค., ม.ค.–มี.ค.)
 const k3=C.getAllData(tA,FY).data.find(x=>x.id===id2);rr=C.saveKpi(tA,FY,{id:id2,years:k3.years,months:[null,null,2,null,null,null,null,null,null,null,null,null],frequency:'รายไตรมาส',summaryMethod:'เฉลี่ย'});assert(rr.success);
 bb=C.getScoreBoard(tM,FY,'').rows.find(x=>x.id===id2);eq([bb.rounds[0].filled,bb.rounds[0].expected,bb.rounds[0].partial,bb.rounds[0].source],[1,2,true,'calc']);
 // รอบที่จบแล้ว: ปีงบที่ผ่านไปแล้ว = จบ
 assert(C.scoreRoundEnded_(2560,1)&&!C.scoreRoundEnded_(2600,0));
 rr=C.saveKpi(tA,FY,{id:id2,years:k3.years,months:[3,3,null,null,null,null,null,null,null,null,null,null],frequency:'รายเดือน'});assert(rr.success);}
// รายการเกณฑ์ที่ต้องแก้ (admin/ผอ. เท่านั้น · ทุกคน)
assert(C.saveKpiScore(tA,FY,Object.assign({id:id3,owner:'ทดสอบคะแนนข',baseRev:C.getScoreBoard(tA,FY,'ทดสอบคะแนนข').rows[0].rev},base,{weight:3,crit:['70','75','80','85','90','85','90']})).success);
let iss=C.getScoreBoard(tA,FY,'').issues;assert(iss.some(x=>x.id===id3&&x.person==='ทดสอบคะแนนข'&&/ไม่เรียง/.test(x.reason)),JSON.stringify(iss));
assert(C.getScoreBoard(tM,FY,'').issues===undefined,'head gets no issues list');
assert(C.saveKpiScore(tA,FY,Object.assign({id:id3,owner:'ทดสอบคะแนนข',baseRev:C.getScoreBoard(tA,FY,'ทดสอบคะแนนข').rows[0].rev},base,{weight:3})).success);
assert(!C.getScoreBoard(tA,FY,'').issues.some(x=>x.id===id3),'fixed → off the list');
// คะแนนกรอกเอง ทับคะแนนคำนวณ · ⚠️ คำนวณไม่ได้
r=C.saveKpiScore(tA,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',baseRev:R1.rev},base,{r1:'5',r2:'3.5'}));assert(r.success&&r.changed,JSON.stringify(r));
b=C.getScoreBoard(tM,FY,'');const R1b=b.rows.find(x=>x.id===id1);eq([R1b.rounds[0].score,R1b.rounds[0].source,R1b.rounds[1].score,R1b.rounds[1].source],[5,'manual',3.5,'manual']);
r=C.saveKpiScore(tA,FY,Object.assign({id:id2,owner:'ทดสอบคะแนนก',baseRev:R2.rev},base,{weight:1,crit:['','','','','','','']}));assert(r.success);
b=C.getScoreBoard(tM,FY,'');eq(b.rows.find(x=>x.id===id2).rounds[0].source,'warn');
// แก้ชน
r=C.saveKpiScore(tA,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',baseRev:R1.rev},base,{weight:9}));assert(!r.success&&r.conflict,JSON.stringify(r));
r=C.saveKpiScore(tA,FY,Object.assign({id:id1,owner:'ทดสอบคะแนนก',baseRev:R1.rev,force:true},base,{weight:9,r1:'5',r2:'3.5'}));assert(r.success);
// บันทึกค่าเดิมซ้ำ = ไม่เปลี่ยน
let cur=C.getScoreBoard(tA,FY,'ทดสอบคะแนนก').rows.find(x=>x.id===id1);
r=C.saveKpiScore(tA,FY,{id:id1,owner:'ทดสอบคะแนนก',weight:cur.weight,crit:cur.crit,r1:cur.manual[0]===null?'':cur.manual[0],r2:cur.manual[1]===null?'':cur.manual[1],note:cur.note,baseRev:cur.rev});assert(r.success&&r.changed===false,JSON.stringify(r));
// ผู้สมัคร + ลบ
const cand=C.getScoreCandidates(tA,FY,'ทดสอบคะแนนก');assert(cand.success&&!cand.candidates.some(x=>x.id===id1));
assert(!C.getScoreCandidates(tM,FY,'ทดสอบคะแนนก').success);
assert(!C.deleteKpiScore(tM,FY,{id:id2,owner:'ทดสอบคะแนนก'}).success);
assert(C.deleteKpiScore(tA,FY,{id:id2,owner:'ทดสอบคะแนนก'}).success);eq(C.getScoreBoard(tM,FY,'').rows.length,1);
assert(C.getScoreCandidates(tA,FY,'ทดสอบคะแนนก').candidates.some(x=>x.id===id2),'deleted → candidate again');
// ตัวชี้วัดถูกลบ → แถว stale (ไม่นับรวม)
assert(C.deleteIndicator(tA,FY,'OPD',id3).success);b=C.getScoreBoard(tN,FY,'');assert(b.rows.length===1&&b.rows[0].stale&&b.totals.count===0,JSON.stringify(b.totals));
assert(!C.getScoreBoard(tA,FY,'').dir.flatMap(u=>u.people).some(p=>p.person==='ทดสอบคะแนนข'),'deleted KPI not in dir');
// ----- change log: เอกสาร SCORE
const pc=C.pollChanges(tM,FY,0);assert(pc.success!==false);
// ----- เปลี่ยนชื่อผู้ใช้ → คอลัมน์ผู้รับผิดชอบในชีตคะแนน
const rn=C.renameUserCommit(tA,{from:'ทดสอบคะแนนก',to:'ทดสอบคะแนนก ใหม่'});assert(rn.success,JSON.stringify(rn));
assert(!sc.d.slice(1).some(x=>x[2]==='ทดสอบคะแนนก')&&sc.d.slice(1).some(x=>x[2]==='ทดสอบคะแนนก ใหม่'),'owner renamed in KPI_Score');
assert(Object.keys(h.sheets).some(n=>n.indexOf('สำรองก่อนเปลี่ยนชื่อผู้ใช้ คะแนน')===0),'backup of score sheet');
// ----- ลอกปีใหม่: น้ำหนัก+เกณฑ์ (ไม่ลอกคะแนนกรอกเอง) เฉพาะตัวชี้วัดที่มีในปีใหม่
sc.d.push(['2569',id1,'ทดสอบคะแนนข','4','1','2','3','4','5','6','7','5','5','หมายเหตุ','x','y']);
const added=C.scoreCarryOver_(FY);const rows70=C.scoreRead_(sc,FY);
const c70=rows70.find(x=>x.id===id1&&x.owner==='ทดสอบคะแนนข');
if(h.sheets['ปีงบ 2570'].d.some(x=>String(x[0]).trim()===id1)){assert(added===1&&c70&&c70.weight===4&&c70.r1===null&&c70.crit[6]==='7','carry over weights+criteria only');assert(C.scoreCarryOver_(FY)===0,'idempotent')}
console.log('score1 ok');
