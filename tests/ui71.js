// อัปโหลดไฟล์ในหน้าต่างแนบเอกสาร: ปุ่มข้างช่องลิงก์ · ตรวจชนิด/ขนาดที่หน้าเว็บ · ชิปไฟล์ · ยืนยัน · อัปโหลดสำเร็จขึ้น 📤 · แก้ไขไฟล์อัปโหลด · มือถือ (Drive จำลอง ข้อมูลสมมติ)
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8').replace('<head>','<head><meta name="viewport" content="width=device-width, initial-scale=1">');
const U=h.sheets.Users.d;const fy=2570;const OUT=process.cwd();
// ---- Drive จำลอง (ย่อ)
let nid=1;const folders={},files={};
const fo=(name,parent)=>{const id='FLD'+(nid++);folders[id]={id,name,parent};return fApi(folders[id])};
const fApi=f=>({getId:()=>f.id,isTrashed:()=>false,getFoldersByName:n=>{const m=Object.values(folders).filter(x=>x.parent===f.id&&x.name===n);let i=0;return {hasNext:()=>i<m.length,next:()=>fApi(m[i++])}},createFolder:n=>fo(n,f.id),createFile:b=>mf({name:b.name,mime:b.mime,parent:f.id})});
const mf=o=>{const id='FILE'+String(nid++).padStart(10,'0');files[id]=Object.assign({id},o);return fiApi(files[id])};
const fiApi=f=>({getId:()=>f.id,getUrl:()=>'https://drive.google.com/file/d/'+f.id+'/view',setSharing(){},setDescription(){},moveTo(){}});
C.DriveApp={Access:{},Permission:{},getRootFolder:()=>fo('root',null),createFolder:n=>fo(n,null),getFolderById:id=>fApi(folders[id]),getFileById:id=>fiApi(files[id])};
C.Drive={Files:{create:(res,blob)=>({id:mf({name:res.name,mime:res.mimeType,parent:res.parents[0]}).getId()}),list:()=>({})}};
C.Utilities.base64Decode=s=>[...Buffer.from(s,'base64')].map(x=>x>127?x-256:x);C.Utilities.newBlob=(bytes,mime,name)=>({bytes,mime,name});
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('123456');r[4]='FALSE'});
const info=(r)=>{const t=C.createSession_(r[0],r[1]);const d=C.getAllData(t,fy);const ed=[];d.data.forEach(k=>{if(k.canEditDetails)ed.push(k.id)});return {r,t,ed}};
const S=U.filter(r=>r[2]==='staff').map(info).find(x=>x.ed.length>=2);assert(S,'fixture staff');const [a,b]=S.ed;
const PDFBUF=Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(3000,65)]);
async function open(br,opts){
 const ctx=await br.newContext(opts);const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));pg.calls=[];
 await pg.exposeFunction('__call',(fn,args)=>{if(fn==='uploadKpiLinkFile')pg.calls.push({size:args[2].file.size,len:args[2].file.data.length,name:args[2].file.name,ids:args[2].ids});try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',S.r[0]);await pg.fill('#login-password','123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForFunction(()=>document.getElementById('kpi-table')||document.querySelector('.kpi-card'),null,{timeout:60000});
 await pg.evaluate(()=>{document.querySelectorAll('.modal-overlay').forEach(m=>{if(m.style.display==='flex')m.style.display='none'})});
 return pg;
}
const rows=()=>h.sheets.KPI_Links?h.sheets.KPI_Links.d.slice(1):[];
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 let pg=await open(br,{viewport:{width:1500,height:950}});
 await pg.evaluate(id=>{setListMode('card');pageSize=50;currentPage=1;goToKpi(id)},a);
 const cardSel='.kpi-card[data-id="'+a+'"]';await pg.waitForSelector(cardSel+' .lnk-add');
 await pg.click(cardSel+' .lnk-add');await pg.waitForSelector('#modal-link',{state:'visible'});
 // ปุ่มอยู่ข้างช่องลิงก์ (แถวเดียวกัน) + คำเตือน
 const pos=await pg.evaluate(()=>{const u=document.getElementById('lk-url').getBoundingClientRect(),b=document.getElementById('lk-file-btn').getBoundingClientRect();return {sameRow:Math.abs((u.top+u.height/2)-(b.top+b.height/2))<14,right:b.left>=u.right-2,txt:document.getElementById('lk-file-btn').innerText}});
 assert(pos.sameRow&&pos.right&&/อัปโหลดไฟล์/.test(pos.txt),JSON.stringify(pos));
 assert(/ทุกคนที่มีลิงก์ดูได้/.test(await pg.textContent('#lk-upl-warn'))&&/HN/.test(await pg.textContent('#lk-upl-warn')));
 await pg.screenshot({path:OUT+'/ui71-modal.png'});
 // ไฟล์ชนิดไม่รองรับ / ใหญ่เกิน → ข้อความ ไม่รับไฟล์
 await pg.setInputFiles('#lk-file',{name:'virus.exe',mimeType:'application/octet-stream',buffer:Buffer.from('MZ')});
 assert(/ชนิดไฟล์ไม่รองรับ/.test(await pg.textContent('#lk-err')));assert(await pg.isHidden('#lk-filechip'));
 await pg.setInputFiles('#lk-file',{name:'ใหญ่.pdf',mimeType:'application/pdf',buffer:Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(10*1024*1024+5,65)])});
 assert(/ใหญ่เกิน 10 MB/.test(await pg.textContent('#lk-err')));assert(await pg.isHidden('#lk-filechip'));
 await pg.setInputFiles('#lk-file',{name:'ว่าง.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(0)});assert(/ว่างเปล่า/.test(await pg.textContent('#lk-err')));
 // ไฟล์ที่ถูกต้อง → ชิป + ช่องลิงก์ปิด + ชื่อเอกสารเติมให้
 await pg.fill('#lk-url','');
 await pg.setInputFiles('#lk-file',{name:'รายงานผลตัวชี้วัด รอบ 6 เดือน.pdf',mimeType:'application/pdf',buffer:PDFBUF});
 assert(await pg.isVisible('#lk-filechip')&&/รายงานผลตัวชี้วัด รอบ 6 เดือน\.pdf/.test(await pg.textContent('#lk-fname')));
 assert(await pg.isDisabled('#lk-url'));assert.strictEqual(await pg.inputValue('#lk-title'),'รายงานผลตัวชี้วัด รอบ 6 เดือน');
 assert(/จะอัปโหลดไฟล์/.test(await pg.textContent('#lk-url-msg')));
 await pg.screenshot({path:OUT+'/ui71-chosen.png'});
 // ยกเลิก (✕) → กลับไปวางลิงก์ได้
 await pg.click('#lk-filechip button');assert(await pg.isHidden('#lk-filechip')&&!(await pg.isDisabled('#lk-url')));
 await pg.setInputFiles('#lk-file',{name:'รายงานผลตัวชี้วัด รอบ 6 เดือน.pdf',mimeType:'application/pdf',buffer:PDFBUF});
 // บันทึก → หน้าต่างยืนยันมีบรรทัดอัปโหลด
 await pg.click('#lk-save-btn');await pg.waitForSelector('#modal-link-confirm',{state:'visible'});
 const cf=await pg.textContent('#lkc-doc');assert(/จะอัปโหลดไฟล์/.test(cf)&&/ทุกคนที่มีลิงก์ดูได้/.test(cf),cf);
 assert.strictEqual(rows().length,0,'nothing uploaded before confirm');
 await pg.click('#modal-link-confirm button:has-text("ครบแล้ว")');
 await pg.waitForFunction(()=>document.getElementById('modal-link').style.display==='none',null,{timeout:30000});
 assert.strictEqual(pg.calls.length,1);assert.strictEqual(pg.calls[0].size,PDFBUF.length);assert(pg.calls[0].len>=PDFBUF.length&&!/^data:/.test(''+pg.calls[0].name));assert.deepStrictEqual(pg.calls[0].ids,[a]);
 assert.strictEqual(rows().length,1);assert.strictEqual(rows()[0][12],'อัปโหลด');assert(/^https:\/\/drive\.google\.com\/file\/d\/FILE/.test(rows()[0][3]));
 // รายการขึ้น 📤
 await pg.waitForSelector(cardSel+' .lnk-a');
 const li=await pg.evaluate(s=>{const e=document.querySelector(s+' .lnk-a');return {t:e.textContent,tip:e.getAttribute('title'),href:e.getAttribute('href')}},cardSel);
 assert(/^📤 /.test(li.t.trim())&&/ไฟล์ที่อัปโหลด/.test(li.tip)&&/^https:\/\/drive\.google\.com\//.test(li.href),JSON.stringify(li));
 await pg.locator(cardSel).screenshot({path:OUT+'/ui71-card.png'});
 // แก้ไขลิงก์ที่เป็นไฟล์อัปโหลด: ช่องลิงก์อ่านอย่างเดียว ไม่มีปุ่มอัปโหลด/คำเตือน
 await pg.click(cardSel+' .lnk-btn[data-lid]:not(.lnk-add)');await pg.waitForSelector('#modal-link',{state:'visible'});
 assert(await pg.isHidden('#lk-file-btn')&&await pg.isHidden('#lk-upl-warn')&&await pg.evaluate(()=>document.getElementById('lk-url').readOnly));
 assert(/ลบเอกสารนี้แล้วอัปโหลดใหม่/.test(await pg.textContent('#lk-url-msg')));
 await pg.fill('#lk-title','ชื่อใหม่ของไฟล์');await pg.click('#lk-save-btn');await pg.waitForSelector('#modal-link-confirm',{state:'visible'});
 await pg.click('#modal-link-confirm button:has-text("ครบแล้ว")');await pg.waitForFunction(()=>document.getElementById('modal-link').style.display==='none',null,{timeout:30000});
 assert.strictEqual(rows()[0][2],'ชื่อใหม่ของไฟล์');assert.strictEqual(rows()[0][12],'อัปโหลด');assert.strictEqual(pg.calls.length,1,'edit does not upload again');
 // เปิดแนบใหม่อีกครั้ง → สถานะรีเซ็ต (ปุ่มกลับมา ช่องลิงก์ใช้ได้)
 await pg.click(cardSel+' .lnk-add');await pg.waitForSelector('#modal-link',{state:'visible'});
 assert(await pg.isVisible('#lk-file-btn')&&!(await pg.isDisabled('#lk-url'))&&!(await pg.evaluate(()=>document.getElementById('lk-url').readOnly))&&await pg.isHidden('#lk-filechip'));
 // ลิงก์ปกติยังใช้ได้เหมือนเดิม
 await pg.fill('#lk-title','ลิงก์ปกติ');await pg.fill('#lk-url','https://drive.google.com/file/d/1AbCdEfG/view');await pg.click('#lk-save-btn');await pg.waitForSelector('#modal-link-confirm',{state:'visible'});
 assert(!/จะอัปโหลดไฟล์/.test(await pg.textContent('#lkc-doc')));await pg.click('#modal-link-confirm button:has-text("ครบแล้ว")');
 await pg.waitForFunction(()=>document.getElementById('modal-link').style.display==='none',null,{timeout:30000});assert.strictEqual(rows().length,2);assert(!rows()[1][12]);assert.strictEqual(pg.calls.length,1);
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));await pg.context().close();
 // ---- เซิร์ฟเวอร์ปฏิเสธ → แจ้งข้อความ + หน้าต่างยังอยู่ ไม่หาย
 pg=await open(br,{viewport:{width:1500,height:950}});
 await pg.evaluate(id=>{setListMode('card');pageSize=50;currentPage=1;goToKpi(id)},b);await pg.waitForSelector('.kpi-card[data-id="'+b+'"] .lnk-add');
 await pg.click('.kpi-card[data-id="'+b+'"] .lnk-add');await pg.waitForSelector('#modal-link',{state:'visible'});
 for(let i=C.uploadUsed_(S.r[0]);i<C.UPLOAD_DAILY_LIMIT;i++)C.uploadConsume_(S.r[0]);
 await pg.setInputFiles('#lk-file',{name:'x.pdf',mimeType:'application/pdf',buffer:PDFBUF});
 await pg.click('#lk-save-btn');await pg.waitForSelector('#modal-link-confirm',{state:'visible'});await pg.click('#modal-link-confirm button:has-text("ครบแล้ว")');
 await pg.waitForFunction(()=>/ครบ 30 ไฟล์/.test(document.body.innerText),null,{timeout:20000});
 assert(await pg.isVisible('#modal-link'),'modal stays after server rejection');assert.strictEqual(rows().length,2);
 await pg.context().close();
 // ---- มือถือ 390×844: ปุ่มไม่ล้นจอ ใช้งานได้
 pg=await open(br,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await pg.evaluate(id=>{setListMode('card');pageSize=50;currentPage=1;goToKpi(id)},b);await pg.waitForSelector('.kpi-card[data-id="'+b+'"] .lnk-add');
 await pg.click('.kpi-card[data-id="'+b+'"] .lnk-add');await pg.waitForSelector('#modal-link',{state:'visible'});
 const mob=await pg.evaluate(()=>{const m=document.querySelector('#modal-link .modal-card').getBoundingClientRect(),b=document.getElementById('lk-file-btn').getBoundingClientRect(),u=document.getElementById('lk-url').getBoundingClientRect();return {inCard:b.left>=m.left-1&&b.right<=m.right+1&&u.right<=m.right+1,btnW:Math.round(b.width),overflow:document.documentElement.scrollWidth>innerWidth+1}});
 assert(mob.inCard&&!mob.overflow,JSON.stringify(mob));
 await pg.screenshot({path:OUT+'/ui71-mobile.png'});
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 await br.close();console.log('UI71 OK');
})().catch(e=>{console.error(e);process.exit(1)});
