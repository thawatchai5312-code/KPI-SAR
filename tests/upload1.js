// อัปโหลดไฟล์เป็นเอกสารแนบ (Upload.js) — จำลอง Drive/Utilities ไม่เรียกของจริง ข้อมูลสมมติ
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;const FY=2570;
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const info=(r)=>{const t=tok(r);const d=C.getAllData(t,FY);const ed=new Set(),vw=new Set();d.data.forEach(k=>{vw.add(k.id);if(k.canEditDetails)ed.add(k.id)});return {r,t,ed,vw}};
const allStaff=U.slice(1).filter(r=>r[2]==='staff').map(info);
let S1,S2,a,b;
for(const x of allStaff){if(x.ed.size<2)continue;for(const y of allStaff){if(y===x)continue;const only=[...x.ed].filter(id=>!y.vw.has(id));if(only.length>=2){S1=x;S2=y;[a,b]=only;break}}if(S1)break}
assert(S1&&S2,'fixture users');
const c=[...S1.vw].find(id=>!S1.ed.has(id));assert(c);
const tA=tok(U.find(r=>r[2]==='admin'));

// ---- จำลอง Drive
let nextId=1;const folders={},files={};
const mkFolder=(name,parent)=>{const id='FLD'+(nextId++);const f={id,name,parent,trashed:false};folders[id]=f;return {getId:()=>id,getName:()=>name,isTrashed:()=>f.trashed,
  getFoldersByName:n=>{const m=Object.values(folders).filter(x=>x.parent===id&&x.name===n);let i=0;return {hasNext:()=>i<m.length,next:()=>mkFolder_(m[i++])}},
  createFolder:n=>mkFolder(n,id),createFile:blob=>mkFile({name:blob.name,mime:blob.mime,bytes:blob.bytes,parent:id})}};
const mkFolder_=f=>({getId:()=>f.id,getName:()=>f.name,isTrashed:()=>f.trashed,getFoldersByName:n=>{const m=Object.values(folders).filter(x=>x.parent===f.id&&x.name===n);let i=0;return {hasNext:()=>i<m.length,next:()=>mkFolder_(m[i++])}},createFolder:n=>mkFolder(n,f.id),createFile:blob=>mkFile({name:blob.name,mime:blob.mime,bytes:blob.bytes,parent:f.id})});
const mkFile=(o)=>{const id='FILE'+String(nextId++).padStart(10,'0');const f=Object.assign({id,share:'PRIVATE',perm:'NONE',desc:''},o);files[id]=f;return fileApi(f)};
const fileApi=f=>({getId:()=>f.id,getUrl:()=>f.mime.startsWith('application/vnd.google-apps')?'https://docs.google.com/document/d/'+f.id+'/edit':'https://drive.google.com/file/d/'+f.id+'/view?usp=drivesharing',
  setSharing:(a,p)=>{f.share=a;f.perm=p},setDescription:d=>{f.desc=d},moveTo:folder=>{f.parent=folder.getId()},getMimeType:()=>f.mime});
const root=mkFolder('My Drive',null);
let driveBroken=false;
C.DriveApp={Access:{ANYONE_WITH_LINK:'ANYONE_WITH_LINK',PRIVATE:'PRIVATE'},Permission:{VIEW:'VIEW',NONE:'NONE'},
  getRootFolder:()=>root,createFolder:n=>mkFolder(n,null),getFolderById:id=>{if(!folders[id])throw new Error('no folder');return mkFolder_(folders[id])},getFileById:id=>{if(!files[id])throw new Error('no file');return fileApi(files[id])}};
const created=[];
C.Drive={Files:{create:(res,blob)=>{if(driveBroken)throw new Error('Drive API ปิดอยู่');const f=mkFile({name:res.name,mime:res.mimeType,bytes:blob.bytes,parent:res.parents[0]});created.push({res,blob});return {id:f.getId()}},list:()=>({files:[]})}};
C.Utilities.base64Decode=s=>[...Buffer.from(s,'base64')].map(x=>x>127?x-256:x);
C.Utilities.base64Encode=bytes=>Buffer.from(bytes.map(x=>(x+256)%256)).toString('base64');
C.Utilities.newBlob=(bytes,mime,name)=>({bytes,mime,name});
const b64=(buf)=>Buffer.from(buf).toString('base64');
const PDF=b64(Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(200,65)]));
const PNG=b64(Buffer.concat([Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),Buffer.alloc(100)]));
const JPG=b64(Buffer.concat([Buffer.from([0xFF,0xD8,0xFF,0xE0]),Buffer.alloc(100)]));
const ZIP=b64(Buffer.concat([Buffer.from([0x50,0x4B,0x03,0x04]),Buffer.alloc(100)]));
const OLE=b64(Buffer.concat([Buffer.from([0xD0,0xCF,0x11,0xE0]),Buffer.alloc(100)]));
const up=(t,name,data,extra)=>C.uploadKpiLinkFile(t,FY,Object.assign({title:'เอกสารทดสอบ',note:'หมายเหตุ',ids:[a],file:{name,size:1,data}},extra||{}));
const rows=()=>h.sheets.KPI_Links?h.sheets.KPI_Links.d.slice(1):[];
const nFiles=()=>Object.keys(files).length;

// ---- ตรวจก่อนสร้างไฟล์: ไม่มีไฟล์/โฟลเดอร์ถูกสร้าง
let r=C.uploadKpiLinkFile('bad-token',FY,{});assert(!r.success&&/SESSION_EXPIRED/.test(r.message));
r=up(S2.t,'a.pdf',PDF);assert(!r.success&&/ไม่มีสิทธิ์แนบ/.test(r.message),JSON.stringify(r));
r=up(S1.t,'a.pdf',PDF,{ids:[a,c]});assert(!r.success&&/ไม่มีสิทธิ์แนบ/.test(r.message),'viewable-only kpi is denied');
r=up(S1.t,'a.pdf',PDF,{title:' '});assert(!r.success&&/ชื่อเอกสาร/.test(r.message));
r=up(S1.t,'a.pdf',PDF,{ids:[]});assert(!r.success&&/ตัวชี้วัดอย่างน้อย/.test(r.message));
r=up(S1.t,'a.exe',PDF);assert(!r.success&&/ชนิดไฟล์ไม่รองรับ/.test(r.message),JSON.stringify(r));
r=up(S1.t,'noext',PDF);assert(!r.success&&/ชนิดไฟล์ไม่รองรับ/.test(r.message));
r=up(S1.t,'fake.pdf',PNG);assert(!r.success&&/ไม่ตรงกับนามสกุล/.test(r.message),'signature check: '+JSON.stringify(r));
r=up(S1.t,'fake.docx',OLE);assert(!r.success&&/ไม่ตรงกับนามสกุล/.test(r.message));
r=up(S1.t,'a.pdf','');assert(!r.success&&/ไม่พบข้อมูลไฟล์/.test(r.message));
const big=b64(Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(10*1024*1024+10,65)]));
r=up(S1.t,'big.pdf',big);assert(!r.success&&/ใหญ่เกิน 10 MB/.test(r.message),JSON.stringify(r).slice(0,120));
assert.strictEqual(nFiles(),0,'nothing created by rejected uploads');assert(!Object.keys(folders).some(k=>folders[k].name!=='My Drive'),'no folders yet');assert(rows().length===0);

// ---- PDF: เก็บตามเดิม · แชร์ทุกคนที่มีลิงก์ดูได้ · โฟลเดอร์ปีงบ
const v0=C.dataVersion_(C.readChangeLog_());
r=up(S1.t,'รายงาน ทดสอบ.pdf',PDF);assert(r.success&&r.id&&r.converted===false&&/^https:\/\/drive\.google\.com\//.test(r.url),JSON.stringify(r));
const f1=Object.values(files)[0];assert.strictEqual(f1.mime,'application/pdf');assert.strictEqual(f1.share,'ANYONE_WITH_LINK');assert.strictEqual(f1.perm,'VIEW');
assert(/^2570 \d{4}-\d{2}-\d{2} รายงาน ทดสอบ\.pdf$/.test(f1.name),f1.name);assert(/อัปโหลดผ่านระบบ KPI SAR/.test(f1.desc));
const rootF=Object.values(folders).find(f=>f.name===C.UPLOAD_ROOT_NAME);assert(rootF&&rootF.parent===null,'root folder');
assert.strictEqual(folders[f1.parent].name,'ปีงบ 2570');assert.strictEqual(folders[f1.parent].parent,rootF.id);
assert.strictEqual(h.ctx.PropertiesService.getScriptProperties().getProperty('UPLOAD_ROOT_ID_V1'),rootF.id);
let row=rows()[0];assert.strictEqual(row.length,16,'row has 16 columns');assert.strictEqual(row[11],'ใช้งาน');assert.strictEqual(row[12],'อัปโหลด');assert.strictEqual(row[13],f1.id);assert.strictEqual(row[14],'รายงาน ทดสอบ.pdf');assert.strictEqual(Number(row[15]),209);
eq(h.sheets.KPI_Links.d[0].slice(12),['ที่มา','รหัสไฟล์ Drive','ชื่อไฟล์เดิม','ขนาดไฟล์ (ไบต์)']);
assert(C.dataVersion_(C.readChangeLog_())!==v0,'bumped for other clients');
let g=C.getKpiLinks(S1.t,FY);const lk=g.links.find(l=>l.id===r.id);assert(lk&&lk.uploaded===true&&lk.fileName==='รายงาน ทดสอบ.pdf'&&lk.fileSize===209&&lk.canEdit,JSON.stringify(lk));
// ผู้ใช้อื่นที่ไม่เห็นตัวชี้วัด ไม่เห็นลิงก์
assert(!C.getKpiLinks(S2.t,FY).links.some(l=>l.id===r.id));

// ---- โฟลเดอร์หลักใช้ซ้ำ ไม่สร้างใหม่ · รูป PNG/JPG เก็บตามเดิม
const nFolders=Object.keys(folders).length;
r=up(S1.t,'สแกน.PNG',PNG);assert(r.success&&!r.converted);r=up(S1.t,'photo.jpeg',JPG);assert(r.success&&!r.converted);
assert.strictEqual(Object.keys(folders).length,nFolders,'folders reused');
assert(Object.values(files).some(f=>f.mime==='image/png')&&Object.values(files).some(f=>f.mime==='image/jpeg'));
// ---- Office → แปลงเป็น Google Docs/Sheets/Slides
r=up(S1.t,'แผน.docx',ZIP);assert(r.success&&r.converted===true&&/^https:\/\/docs\.google\.com\//.test(r.url),JSON.stringify(r));
assert.strictEqual(created[0].res.mimeType,'application/vnd.google-apps.document');assert.strictEqual(created[0].res.name.indexOf('.docx'),-1,'ext stripped for converted');assert(/wordprocessingml/.test(created[0].blob.mime));
r=up(S1.t,'ตาราง.xlsx',ZIP);assert(r.success&&created[1].res.mimeType==='application/vnd.google-apps.spreadsheet');
r=up(S1.t,'สไลด์.pptx',ZIP);assert(r.success&&created[2].res.mimeType==='application/vnd.google-apps.presentation');
r=up(S1.t,'เก่า.doc',OLE);assert(r.success&&created[3].res.mimeType==='application/vnd.google-apps.document');
r=up(S1.t,'เก่า.xls',OLE);assert(r.success);r=up(S1.t,'เก่า.ppt',OLE);assert(r.success&&created[5].res.mimeType==='application/vnd.google-apps.presentation');
assert(created.every(x=>files[Object.keys(files).find(k=>files[k].parent===x.res.parents[0]&&files[k].name===x.res.name)].share==='ANYONE_WITH_LINK'),'converted files shared');

// ---- admin แนบหลายตัวชี้วัด · ชื่อไฟล์ถูกทำความสะอาด
r=up(tA,'a/b\\c:d*e?.pdf',PDF,{ids:[a,b,c]});assert(r.success,JSON.stringify(r));
const last=Object.values(files).pop();assert(!/[\/\\:*?]/.test(last.name),last.name);
// ---- ลิงก์ปกติหลังเพิ่มคอลัมน์ ยังเป็น 12 คอลัมน์ที่ถูกต้อง · ไม่มีที่มา
const plain=C.saveKpiLink(S1.t,FY,{title:'ลิงก์เอง',url:'https://drive.google.com/file/d/1AbCdEfG/view',ids:[a]});assert(plain.success);
const pr=rows().find(x=>x[1]===plain.id);assert.strictEqual(pr[11],'ใช้งาน');assert(!pr[12]&&!pr[13],'plain link has no upload source');
g=C.getKpiLinks(S1.t,FY);assert.strictEqual(g.links.find(l=>l.id===plain.id).uploaded,false);

// ---- แก้ไข: ไฟล์อัปโหลดเปลี่ยน url ไม่ได้ · แก้ชื่อ/หมายเหตุได้
const upl=rows().find(x=>x[12]==='อัปโหลด');const upId=upl[1],upUrl=upl[3];
let e=C.saveKpiLink(S1.t,FY,{id:upId,title:'ชื่อใหม่',url:'https://drive.google.com/file/d/OTHER/view',ids:[a]});assert(!e.success&&/เปลี่ยนลิงก์ไม่ได้/.test(e.message),JSON.stringify(e));
e=C.saveKpiLink(S1.t,FY,{id:upId,title:'ชื่อใหม่',url:upUrl,note:'x',ids:[a]});assert(e.success&&e.changed,JSON.stringify(e));
assert.strictEqual(rows().find(x=>x[1]===upId)[12],'อัปโหลด','source kept after edit');

// ---- โควตารายวัน
const q0=C.uploadUsed_(S1.r[0]);assert(q0>=8);
for(let i=q0;i<C.UPLOAD_DAILY_LIMIT;i++)C.uploadConsume_(S1.r[0]);
const nf=nFiles();r=up(S1.t,'x.pdf',PDF);assert(!r.success&&/ครบ 30 ไฟล์/.test(r.message)&&nFiles()===nf,JSON.stringify(r));
// ล้มเหลวหลังสร้างไฟล์ → ไฟล์ถูกย้ายไปลบแล้ว + คืนโควตา
for(let i=0;i<5;i++)C.uploadRefund_(S1.r[0]);
const orig=C.saveKpiLink;C.saveKpiLink=()=>({success:false,message:'ชนกัน'});
const before=C.uploadUsed_(S1.r[0]);r=up(S1.t,'rollback.pdf',PDF);assert(!r.success&&r.message==='ชนกัน');
const rb=Object.values(files).pop();assert.strictEqual(folders[rb.parent].name,'ลบแล้ว','orphan moved to trash folder');assert.strictEqual(rb.share,'PRIVATE');assert.strictEqual(C.uploadUsed_(S1.r[0]),before,'quota refunded');
C.saveKpiLink=orig;
// Drive API ล้ม (ยังไม่อนุญาตสิทธิ์) → ข้อความไทย ไม่สร้างแถว
driveBroken=true;const rn=rows().length;r=up(S1.t,'x.docx',ZIP);assert(!r.success&&/อนุญาตสิทธิ์ Drive/.test(r.message)&&rows().length===rn,JSON.stringify(r));driveBroken=false;

// ---- ลบ: ไฟล์ย้ายไป "ลบแล้ว" เมื่อไม่มีแถวใดใช้ · ลิงก์ที่วางเอง/ที่ยังมีตัวชี้วัดอื่นใช้ ไม่แตะ
const rr=up(S1.t,'ลบทดสอบ.pdf',PDF,{ids:[a,b]});assert(rr.success);const fid=rows().find(x=>x[1]===rr.id)[13];
let d=C.deleteKpiLink(S1.t,FY,rr.id);assert(d.success&&d.removedAll,JSON.stringify(d));
assert.strictEqual(folders[files[fid].parent].name,'ลบแล้ว');assert.strictEqual(files[fid].share,'PRIVATE');assert.strictEqual(files[fid].perm,'NONE');
assert.strictEqual(rows().find(x=>x[1]===rr.id)[11],'ลบ','row kept with deleted status');
// ลิงก์ที่วางเอง: ลบแล้วไม่มีการแตะไฟล์ใดๆ
const movesBefore=JSON.stringify(Object.values(files).map(f=>f.parent));
d=C.deleteKpiLink(S1.t,FY,plain.id);assert(d.success);assert.strictEqual(JSON.stringify(Object.values(files).map(f=>f.parent)),movesBefore);
// ยังมีแถวอื่น (เช่น คัดลอกข้ามปี) ใช้ไฟล์เดียวกันอยู่ → ไม่ย้าย
const r2=up(S1.t,'ใช้ร่วม.pdf',PDF);const fid2=rows().find(x=>x[1]===r2.id)[13];
const dupUrl=rows().find(x=>x[1]===r2.id)[3];const dup=C.saveKpiLink(S1.t,FY,{title:'สำเนาลิงก์',url:dupUrl,ids:[a]});assert(dup.success);
d=C.deleteKpiLink(S1.t,FY,r2.id);assert(d.success);assert.notStrictEqual(folders[files[fid2].parent].name,'ลบแล้ว','still used → not retired');
d=C.deleteKpiLink(S1.t,FY,dup.id);assert(d.success);assert.notStrictEqual(folders[files[fid2].parent].name,'ลบแล้ว','pasted copy is not an upload row → file untouched (conservative)');
// ลบไม่ได้เพราะ Drive ล้ม → ลิงก์ยังถูกลบสำเร็จ
const r3=up(S1.t,'drive-ล้ม.pdf',PDF);const g3=C.DriveApp.getFileById;C.DriveApp.getFileById=()=>{throw new Error('boom')};
d=C.deleteKpiLink(S1.t,FY,r3.id);assert(d.success,'delete succeeds even if Drive retire fails');C.DriveApp.getFileById=g3;

// ---- ชีตเดิม 12 คอลัมน์ → เติมหัว M–P ตอนใช้ · อ่านได้ปกติ
const sh=h.sheets.KPI_Links;sh.d[0]=sh.d[0].slice(0,12);
sh.d.forEach((row,i)=>{if(i>0)row.length=Math.min(row.length,12)});
const r4=up(S1.t,'legacy.pdf',PDF);assert(r4.success);eq(sh.d[0].slice(12),['ที่มา','รหัสไฟล์ Drive','ชื่อไฟล์เดิม','ขนาดไฟล์ (ไบต์)']);
assert(C.getKpiLinks(S1.t,FY).success);

// ---- น้องเป้าอ่านไฟล์: Slides (export) · รูป (inline_data) · แชทไม่ส่งรูป
const slideId='SLIDEID001',imgId='IMGID00001',pdfId='PDFID00001';
files[slideId]={id:slideId,mime:'application/vnd.google-apps.presentation',name:'s',share:'ANYONE_WITH_LINK'};files[imgId]={id:imgId,mime:'image/png',name:'i'};files[pdfId]={id:pdfId,mime:'application/pdf',name:'p'};
C.DriveApp.getFileById=id=>({getMimeType:()=>files[id].mime,getSize:()=>1000,getBlob:()=>({getBytes:()=>[1,2,3]}),getId:()=>id});
C.Drive.Files.export=(id,mime)=>{assert.strictEqual(mime,'text/plain');return 'สไลด์ 1 ผลตัวชี้วัด 85% HN 1234567 ติดต่อ 0812345678'};
const mk=(id,t)=>C.saveKpiLink(S1.t,FY,{title:t,url:'https://docs.google.com/presentation/d/'+id+'/edit',ids:[a]});
mk(slideId,'สไลด์ประชุม');mk(imgId,'ภาพสแกน');mk(pdfId,'ไฟล์ pdf');
let att=C.aiAttachments_(FY,a,100,true);
const sl=att.texts.find(t=>t.title==='สไลด์ประชุม');assert(sl&&sl.kind==='Google Slides'&&/ผลตัวชี้วัด 85%/.test(sl.text),JSON.stringify(att.texts));assert(!/1234567|0812345678/.test(sl.text),'redacted');
const im=att.pdfs.find(t=>t.title==='ภาพสแกน');assert(im&&im.mime==='image/png'&&im.data,JSON.stringify(att.report));assert.strictEqual(att.pdfs.find(t=>t.title==='ไฟล์ pdf').mime,'application/pdf');
assert(att.report.some(x=>x.title==='สไลด์ประชุม'&&x.ok&&/Google Slides/.test(x.note))&&att.report.some(x=>x.title==='ภาพสแกน'&&x.ok&&/รูปภาพ/.test(x.note)));
const txt=C.aiAttachText_(att);assert(/ประเภท: รูปภาพ/.test(txt)&&/ประเภท: PDF/.test(txt)&&/รูปภาพ\/ภาพสแกน: อ่านเฉพาะข้อความ/.test(txt));
att=C.aiAttachments_(FY,a,100,false);assert(!att.pdfs.length&&att.report.some(x=>x.title==='ภาพสแกน'&&!x.ok&&/ใช้ได้เฉพาะปุ่มวิเคราะห์/.test(x.note)),'chat does not send images');
// payload ถึง Gemini ใช้ mime ของรูป
let calls=[];C.UrlFetchApp={fetch:(u,o)=>{calls.push(o.payload?JSON.parse(o.payload):null);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:'ผลวิเคราะห์'}]}}]})}}};
assert(C.aiSaveSettings(tA,{key:'AIza'+'B'.repeat(35),limit:50,enabled:true}).success);
const res=C.aiAnalyze(S1.t,FY,'detail',a,{text:''});assert(res.success,JSON.stringify(res));
const parts=calls[calls.length-1].contents[0].parts;assert(parts.some(p=>p.inline_data&&p.inline_data.mime_type==='image/png')&&parts.some(p=>p.inline_data&&p.inline_data.mime_type==='application/pdf'),JSON.stringify(parts.map(p=>p.inline_data&&p.inline_data.mime_type)));
console.log('UPLOAD1 OK');
