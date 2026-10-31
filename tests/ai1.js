// ผู้ช่วย AI (Gemini): ตั้งค่า/เพดาน · สิทธิ์ · payload (ไม่ส่งผู้รับผิดชอบ/ชื่อผู้ใช้) · ข้อเท็จจริงที่คำนวณ · ลบเลขระบุตัว · ไฟล์แนบ · แชทตามสิทธิ์ — จำลอง Gemini ไม่เรียกจริง
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;const FY=2570;
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const ad=U.find(r=>r[2]==='admin'),tA=tok(ad);

// ---- จำลอง Gemini
let calls=[],reply={code:200,text:'**สรุปผล**\n- ผล ๘๐ ตามเป้า\n# หัวข้อ'};
C.UrlFetchApp={fetch:(url,o)=>{calls.push({url,o,body:o.payload?JSON.parse(o.payload):null});
  if(/\/models\?/.test(url))return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({models:[{name:'models/gemini-flash-latest',supportedGenerationMethods:['generateContent']},{name:'models/embedding-001',supportedGenerationMethods:['embedContent']}]})};
  const body=reply.code===200?{candidates:[{content:{parts:[{text:reply.text}]}}]}:{error:{message:reply.msg||'x'}};
  return {getResponseCode:()=>reply.code,getContentText:()=>JSON.stringify(body)}}};
const prompt=()=>calls[calls.length-1].body.contents.map(c=>c.parts.map(p=>p.text||'').join('')).join('\n');

// ---- ไม่มีคีย์ → แจ้ง · ไม่เรียก Gemini
const staffRow=U.find(r=>r[2]==='staff'&&C.getAllData(tok(r),FY).data.some(k=>k.canEditDetails));const tS=tok(staffRow);
const mine=C.getAllData(tS,FY).data.find(k=>k.canEditDetails);
let r=C.aiAnalyze(tS,FY,'detail',mine.id,{text:''});assert(!r.success&&/ยังไม่ได้ตั้งค่า API key/.test(r.message),JSON.stringify(r));assert.strictEqual(calls.length,0);
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.aiStatus(tS))),{success:true,enabled:false,limit:30,used:0});
// ---- ตั้งค่า: เฉพาะ admin · ตรวจรูปแบบ · ไม่ส่งคีย์เต็มกลับ
assert(!C.aiSaveSettings(tS,{key:'x'}).success,'staff cannot save');assert(!C.aiGetSettings(tS).success);
assert(!C.aiSaveSettings(tA,{key:'bad'}).success);
const KEY='AIza'+'B'.repeat(35);
r=C.aiSaveSettings(tA,{key:KEY,model:'gemini-flash-latest',limit:3,enabled:true});assert(r.success&&r.hasKey&&r.keyMasked==='AIza••••'+KEY.slice(-4)&&JSON.stringify(r).indexOf(KEY)===-1,JSON.stringify(r));
assert(!C.aiSaveSettings(tA,{limit:9999}).success);
r=C.aiTest(tA);assert(r.success&&r.models.includes('gemini-flash-latest')&&!r.models.includes('embedding-001'),JSON.stringify(r));
assert(calls.some(c=>c.o.headers['x-goog-api-key']===KEY&&c.url.indexOf(KEY)===-1),'key in header not url');
calls=[];
// ---- ปุ่มรายละเอียด: ตัด markdown/เลขไทย · payload ปลอดภัย
r=C.aiAnalyze(tS,FY,'detail',mine.id,{text:'ข้อความเดิม HN 123456 โทร 081-234-5678'});
assert(r.success&&r.text==='สรุปผล\n- ผล 80 ตามเป้า\nหัวข้อ'&&r.used===1&&r.limit===3,JSON.stringify(r));
const sent=prompt(),sys=calls[0].body.systemInstruction.parts[0].text;
assert(/<ข้อมูล>/.test(sent)&&/<ข้อเท็จจริงที่คำนวณแล้ว>/.test(sent)&&sent.indexOf(mine.name)!==-1&&/สรุปผลการดำเนินงาน/.test(sent)&&/P – การวางแผน/.test(sent),'task+data');
assert(/ยึดข้อเท็จจริง/.test(sys),'system');
assert(sent.indexOf('HN 123456')===-1&&sent.indexOf('081-234-5678')===-1&&sent.indexOf('[ปิดบัง]')!==-1,'redacted draft');
const ownerName=(mine.owner||'').split('/')[0].trim();
if(ownerName)assert(sent.indexOf(ownerName)===-1||mine.name.indexOf(ownerName)!==-1,'owner not sent');
assert(sent.indexOf(staffRow[0])===-1||mine.name.indexOf(staffRow[0])!==-1,'username not sent');
assert.strictEqual(calls[0].body.generationConfig.temperature,0.3);
// ---- เพดาน: ครบ 3 → ปฏิเสธ · ล้มเหลวคืนโควตา
C.aiAnalyze(tS,FY,'detail',mine.id,{});r=C.aiAnalyze(tS,FY,'detail',mine.id,{});assert(r.used===3);
const before=calls.length;r=C.aiAnalyze(tS,FY,'detail',mine.id,{});assert(!r.success&&/ครบ 3 ครั้ง/.test(r.message)&&calls.length===before,JSON.stringify(r));
assert.strictEqual(C.aiStatus(tS).used,3);
C.aiSaveSettings(tA,{limit:10});reply={code:429};r=C.aiAnalyze(tS,FY,'detail',mine.id,{});assert(!r.success&&/มีคนใช้เยอะ/.test(r.message),JSON.stringify(r));assert.strictEqual(C.aiStatus(tS).used,3,'refunded');
reply={code:403,msg:'API key not valid'};r=C.aiAnalyze(tS,FY,'detail',mine.id,{});assert(!r.success&&/API key/.test(r.message));
reply={code:404};r=C.aiAnalyze(tS,FY,'detail',mine.id,{});assert(!r.success&&/ไม่พบรุ่น/.test(r.message));
reply={code:200,text:'ตกลง'};
// ---- สิทธิ์
const ro=C.getAllData(tS,FY).data.find(k=>!k.canEditDetails);
if(ro){r=C.aiAnalyze(tS,FY,'detail',ro.id,{});assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message));}
r=C.aiAnalyze(tS,FY,'detail','ไม่มีรหัสนี้',{});assert(!r.success);
r=C.aiAnalyze(tS,FY,'pdca',mine.id,{});assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message),'staff no SAR docs');
r=C.aiAnalyze(tS,FY,'clt',{id:mine.id,group:'STEMI'},{});assert(!r.success,'staff no CLT');
r=C.aiAnalyze(tS,FY,'xxx',mine.id,{});assert(!r.success);
r=C.aiAnalyze('bad',FY,'detail',mine.id,{});assert(!r.success);
// ---- PDCA (SAR) สำหรับหัวหน้าที่แก้ได้ · CLT สำหรับ admin
const sarKpi=C.getAllData(tA,FY).data.find(k=>C.inCorePart_(k));
r=C.aiAnalyze(tA,FY,'pdca',sarKpi.id,{text:'PDCA เดิม'});assert(r.success,JSON.stringify(r));
assert(/ปัญหาที่พบ[\s\S]*การปรับปรุงมาตรฐานและแผนพัฒนาต่อเนื่อง/.test(prompt())&&/PDCA เดิม/.test(prompt()));
const cl=C.cltKpis_(FY)[0];
if(cl){r=C.aiAnalyze(tA,FY,'clt',{id:cl.id,group:cl.groups[0]},{text:''});assert(r.success,JSON.stringify(r));assert(prompt().indexOf('กลุ่มโรค "'+cl.groups[0]+'"')!==-1&&/การพัฒนาที่ผ่านมา/.test(prompt()));
  r=C.aiAnalyze(tA,FY,'clt',{id:cl.id,group:'ไม่ใช่โรค'},{});assert(!r.success);}
// ---- ไฟล์แนบ: อ่านแล้วลบเลขระบุตัว · อ่านไม่ได้ก็ไม่พัง
const DOC='https://docs.google.com/document/d/DOCID12345678/edit',PDF='https://drive.google.com/file/d/PDFID12345678/view',BAD='https://drive.google.com/file/d/BADID12345678/view';
[['รายงาน RCA',DOC],['สรุป PDF',PDF],['ไฟล์เสีย',BAD]].forEach(([t,u])=>{const x=C.saveKpiLink(tA,FY,{title:t,url:u,ids:[mine.id]});assert(x.success,JSON.stringify(x))});
const files={DOCID12345678:{m:'application/vnd.google-apps.document',doc:'ผู้ป่วย HN 7654321 เลขบัตร 1-2345-67890-12-3 โทร 0812345678 อีเมล a@b.com ทบทวนแล้ว ปรับขั้นตอน'},PDFID12345678:{m:'application/pdf'}};
C.DriveApp={getFileById:id=>{const f=files[id];if(!f)throw new Error('no access');return {getMimeType:()=>f.m,getSize:()=>1000,getBlob:()=>({getBytes:()=>[37,80,68,70]})}}};
C.DocumentApp={openById:id=>({getBody:()=>({getText:()=>files[id].doc})})};
r=C.aiAnalyze(tS,FY,'detail',mine.id,{text:''});assert(r.success,JSON.stringify(r));
const p2=prompt(),parts=calls[calls.length-1].body.contents[0].parts;
assert(/รายงาน RCA/.test(p2)&&/ทบทวนแล้ว ปรับขั้นตอน/.test(p2)&&p2.indexOf('7654321')===-1&&p2.indexOf('1-2345-67890-12-3')===-1&&p2.indexOf('0812345678')===-1&&p2.indexOf('a@b.com')===-1,'file text redacted');
assert(parts.some(p=>p.inline_data&&p.inline_data.mime_type==='application/pdf'),'pdf attached');
assert(/ไฟล์เสีย[^\n]*อ่านไม่ได้/.test(p2)&&p2.indexOf('DOCID12345678')===-1,'unreadable noted, url not sent');
assert(r.files.some(f=>f.title==='รายงาน RCA'&&f.ok)&&r.files.some(f=>f.title==='ไฟล์เสีย'&&!f.ok),JSON.stringify(r.files));
// ---- ข้อเท็จจริง
const f=(t,y,m,meth)=>C.aiFacts_({target:t,years:y,frequency:'รายเดือน',summaryMethod:meth||'เฉลี่ย'},2570,m);
const M=(a)=>a.concat(Array(12-a.length).fill(null));
let t1=f('≥ 80',[72.5,78,81.2,79.4,null],M([85,'-',76]));
assert(/ผลล่าสุด[^\n]*2569 = 79\.4 → ไม่ผ่านเป้า \(ต่ำกว่าเป้า 0\.6\)/.test(t1)&&/ผ่านเป้า 1 จาก 4 ปี/.test(t1)&&/ผ่าน: 2568/.test(t1)&&/มีผล 2 จาก 12 เดือน · ไม่มีเคส 1 เดือน/.test(t1)&&/ค่าสรุปปี 2570 \(เฉลี่ย\) = 80\.5 → ผ่านเป้า/.test(t1)&&/เดือนที่ไม่ผ่านเป้า: ธ\.ค\. \(76\)/.test(t1),t1);
let t2=f('≤ 5',[10,8,6,4,null],M([3,6]),'ผลรวม');
assert(/ผ่านเป้า 1 จาก 4/.test(t2)&&/\(ดีขึ้น\)/.test(t2)&&/ค่าสรุปปี 2570 \(ผลรวม\) = 9 → ไม่ผ่านเป้า/.test(t2),t2);
assert(!/ผ่านเป้า/.test(f('',[1,2,3,4,null],M([5]))),'no target direction → no pass/fail');
assert.strictEqual(C.aiTarget_('> 90%').op,'>');assert.strictEqual(C.aiTarget_('๘๐').op,'');
// ---- redact / clean
assert.strictEqual(C.aiRedact_('HN:12345 AN 9-9999 บัตร 1 2345 67890 12 3 โทร 02-123-4567 x@y.th'),'[ปิดบัง] [ปิดบัง] บัตร [ปิดบัง] โทร [ปิดบัง] [ปิดบัง]');
assert.strictEqual(C.aiClean_('## หัวข้อ\n**หนา** `โค้ด`\n* รายการ ๑๒๓\n\n\n\nจบ'),'หัวข้อ\nหนา โค้ด\n- รายการ 123\n\nจบ');
// ---- แชทตามสิทธิ์
reply={code:200,text:'ตอบแชท'};
const visible=C.getAllData(tS,FY).data,invisible=C.getAllData(tA,FY).data.find(k=>!visible.some(v=>v.id===k.id));
calls=[];r=C.aiChat(tS,FY,[{role:'user',text:'ตัวชี้วัด '+mine.id+' เป็นอย่างไร'}],'home');assert(r.success&&r.text==='ตอบแชท',JSON.stringify(r));
const cp=prompt();
assert(cp.indexOf('['+mine.id+']')!==-1&&/<ดัชนีตัวชี้วัด/.test(cp)&&/<คู่มือการใช้ระบบ>/.test(cp),'chat context');
{const seg=cp.slice(cp.indexOf('<ดัชนีตัวชี้วัด'),cp.indexOf('</ดัชนีตัวชี้วัด>')).split('\n').slice(2).filter(l=>l.trim()&&l.indexOf('(แสดง ')!==0);assert.strictEqual(seg.length,Math.min(visible.length,500),'index size '+seg.length+' vs '+visible.length);}
if(invisible)assert(cp.indexOf(invisible.id+' | ')===-1&&cp.indexOf(invisible.name)===-1,'invisible kpi never sent');
console.log('index lines',Math.min(visible.length,500),'of',visible.length,'prompt chars',cp.length);
assert.strictEqual(calls[0].body.systemInstruction.parts[0].text.indexOf('ผู้ช่วยระบบตัวชี้วัด')!==-1,true);
assert.strictEqual(calls[0].body.generationConfig.temperature,0.5);
// ประวัติ: ตัดเหลือ 10 · ต้องจบที่ผู้ใช้
const many=[];for(let i=0;i<14;i++)many.push({role:i%2?'model':'user',text:'ข้อความ '+i});many.push({role:'user',text:'คำถามสุดท้าย'});
calls=[];r=C.aiChat(tS,FY,many,'home');assert(r.success);assert(calls[0].body.contents.length<=10&&calls[0].body.contents[0].role==='user'&&calls[0].body.contents.slice(-1)[0].role==='user');
assert(!C.aiChat(tS,FY,[{role:'model',text:'x'}],'home').success,'must end with user');
// ปิดระบบ
C.aiSaveSettings(tA,{enabled:false});r=C.aiChat(tS,FY,[{role:'user',text:'สวัสดี'}],'home');assert(!r.success&&/ปิดใช้งาน/.test(r.message));assert.strictEqual(C.aiStatus(tS).enabled,false);
console.log('ai1 ok');
