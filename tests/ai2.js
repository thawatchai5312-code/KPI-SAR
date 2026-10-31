// น้องเป้า: แยกข้อความที่คนเขียนกับร่างเดิมของ AI — จำรหัสย่อบรรทัดที่ AI ร่าง (ไม่เก็บข้อความ) แล้วติดป้าย [ร่าง AI] ตอนกดวิเคราะห์ซ้ำ
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;const FY=2570;
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const tA=tok(U.find(r=>r[2]==='admin'));
let calls=[],replyText='';
C.UrlFetchApp={fetch:(url,o)=>{calls.push(o.payload?JSON.parse(o.payload):null);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:replyText}]}}]})}}};
const prompt=()=>calls[calls.length-1].contents.map(c=>c.parts.map(p=>p.text||'').join('')).join('\n');
assert(C.aiSaveSettings(tA,{key:'AIza'+'B'.repeat(35),limit:50,enabled:true}).success);
const staffRow=U.find(r=>r[2]==='staff'&&C.getAllData(tok(r),FY).data.some(k=>k.canEditDetails));const tS=tok(staffRow);
const mine=C.getAllData(tS,FY).data.find(k=>k.canEditDetails);
// รอบ 1: ช่องมีข้อความคนเขียน · AI ตอบร่าง (มีป้ายหลุดมา → ต้องถูกตัด)
const HUMAN='จัดอบรมเจ้าหน้าที่ 12 คน เมื่อ 5 ม.ค. 2570';
replyText='สรุปผลการดำเนินงาน\n[ร่าง AI] ผลปีนี้ 85 ผ่านเป้า\nการปฏิบัติ\n[ต้องเติม: กิจกรรมที่ทำจริง]\nข้อสันนิษฐาน: บุคลากรเข้าใจแนวทางมากขึ้น';
let r=C.aiAnalyze(tS,FY,'detail',mine.id,{text:HUMAN});assert(r.success,JSON.stringify(r));
assert(!/\[ร่าง AI\]/.test(r.text),'tag stripped from answer: '+r.text);
assert(!/\[ร่าง AI\]/.test(prompt().split('<ข้อมูล>')[1]),'first round: nothing tagged');
const sh=h.sheets.AI_Drafts;assert(sh&&sh.hidden,'hidden AI_Drafts sheet');
const stored=JSON.stringify(sh.d);assert(!stored.includes('ผลปีนี้')&&!stored.includes('ข้อสันนิษฐาน'),'stores hashes only, not text');
assert(sh.d.some(row=>row[0]==='detail|'+mine.id&&/^[0-9a-f]{16}(,[0-9a-f]{16})+$/.test(row[1])),'hash row');
// รอบ 2: ผู้ใช้ใส่ร่างลงช่อง แก้ 1 บรรทัด เติม [ต้องเติม] ด้วยข้อมูลจริง
const field=[HUMAN,'สรุปผลการดำเนินงาน','ผลปีนี้ 85 ผ่านเป้า','การปฏิบัติ','ประชุมทบทวนแนวทาง 2 ครั้ง (ผู้ใช้เติมเอง)','ข้อสันนิษฐาน: บุคลากรเข้าใจแนวทางมากขึ้น  '].join('\n');
replyText='สรุปผลการดำเนินงาน\nผลปีนี้ 85 ผ่านเป้า';
r=C.aiAnalyze(tS,FY,'detail',mine.id,{text:field});assert(r.success);
const data=prompt().split('<ข้อมูล>')[1].split('</ข้อมูล>')[0];
assert(data.includes('[ร่าง AI] ผลปีนี้ 85 ผ่านเป้า'),'unchanged AI line tagged');
assert(data.includes('[ร่าง AI] ข้อสันนิษฐาน: บุคลากรเข้าใจแนวทางมากขึ้น'),'whitespace-normalised AI line tagged');
assert(data.includes(HUMAN)&&!data.includes('[ร่าง AI] '+HUMAN),'human line not tagged');
assert(!data.includes('[ร่าง AI] ประชุมทบทวน'),'line the user wrote is not tagged');
assert(/บรรทัดที่ขึ้นต้นด้วย \[ร่าง AI\]/.test(calls[calls.length-1].systemInstruction.parts[0].text),'system prompt explains tag');
// ช่องอื่น (ตัวชี้วัดอื่น) ไม่ได้ป้ายจากร่างของตัวนี้
const other=C.getAllData(tS,FY).data.find(k=>k.canEditDetails&&k.id!==mine.id);
if(other){r=C.aiAnalyze(tS,FY,'detail',other.id,{text:'ผลปีนี้ 85 ผ่านเป้า'});assert(r.success&&!prompt().includes('[ร่าง AI] ผลปีนี้'),'keys are per field');}
// อ่านชีตจำร่างไม่ได้ → ยังวิเคราะห์ได้ปกติ
const real=C.aiDraftSheet_;C.aiDraftSheet_=()=>{throw new Error('boom')};
r=C.aiAnalyze(tS,FY,'detail',mine.id,{text:field});assert(r.success,'draft memory failure does not break analyse');C.aiDraftSheet_=real;
console.log('AI2 OK');
