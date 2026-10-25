// หน้า "เอกสาร สรพ." (SAR Part I–IV): สิทธิ์เมนู, ตัวอย่างเอกสารแบ่งหน้า, กรอก/บันทึกสรุป PDCA, เตือนก่อนออกถ้ายังไม่บันทึก,
// แก้ชนกัน (แถบเตือน 3 ทางเลือก), อัปเดตอัตโนมัติจากเครื่องอื่น, ตัวกรอง/หมวด, Export Word (.docx) ตรวจเนื้อหาในไฟล์
// ต้องมี tests/fixtures/lib/docx.iife.js (npm docx@9.5.1 dist/index.iife.js — ใช้แทน CDN ตอนเทสต์)
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const DOCX_LIB=path.join(__dirname,'fixtures/lib/docx.iife.js');assert(fs.existsSync(DOCX_LIB),'missing '+DOCX_LIB);
const U=h.sheets.Users.d;
const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),ex=pick('executive'),st=pick('staff');
// หัวหน้าที่แก้ได้บางตัว (ไม่ใช่ทั้งหมด) ของ Part I–IV
const fy=2570;let head=null;
for(const hd of U.filter(u=>u[2]==='head')){hd[1]=C.hashPassword_('pw123456');hd[4]='FALSE';const t=C.createSession_(hd[0],hd[1]);const d=C.getAllData(t,fy).data.filter(k=>C.inCorePart_(k));if(d.some(k=>k.canEditDetails)&&d.some(k=>!k.canEditDetails)){head=hd;break}}
assert(head);
[ad,ex,st].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tA=C.createSession_(ad[0],ad[1]),tE=C.createSession_(ex[0],ex[1]);
const OUT=process.cwd();
async function open(b,user,opts={}){
 const ctx=await b.newContext({viewport:{width:1500,height:950},acceptDownloads:true});const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>{const u=r.request().url();
   if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(/docx@9\.5\.1\/dist\/index\.iife\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(DOCX_LIB)});
   return r.abort()});
 await pg.addInitScript(()=>{window.__delay={};function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>new Promise(r=>setTimeout(r,window.__delay[fn]||0)).then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',user[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForSelector('#kpi-table');
 return pg;
}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 // ---- 0. staff: ไม่มีเมนู · server ปฏิเสธ
 const ps=await open(b,st);
 assert(await ps.evaluate(()=>getComputedStyle(document.getElementById('menu-sar-btn')).display==='none'),'staff has no SAR menu');
 await ps.evaluate(()=>switchMenu('sar'));assert(await ps.evaluate(()=>currentTab)==='home','staff cannot open SAR page');
 await ps.context().close();

 // ---- 1. admin: เปิดหน้า
 const pg=await open(b,ad);
 assert(await pg.evaluate(()=>getComputedStyle(document.getElementById('menu-sar-btn')).display!=='none'),'admin has SAR menu');
 await pg.click('#menu-sar-btn');await pg.waitForSelector('#sar-pager-top .pager');
 let s1=await pg.evaluate(()=>({loaded:sar.loaded,fy:sar.fy,parts:[...document.querySelectorAll('#sar-paper .pr-part')].map(e=>e.textContent),blocks:document.querySelectorAll('#sar-paper .sar-block,#sar-paper .pr-ref').length,
   tables:document.querySelectorAll('#sar-paper table.pr-table').length,ths:[...document.querySelectorAll('#sar-paper table.pr-table')[0].querySelectorAll('th')].map(e=>e.textContent),
   monthly:/ต\.ค\./.test(document.getElementById('sar-paper').textContent)&&/ผลลัพธ์รายเดือน/.test(document.getElementById('sar-paper').textContent),owner:/ผู้รับผิดชอบ/.test(document.getElementById('sar-paper').textContent),
   charts:document.querySelectorAll('#sar-paper .pr-chart svg').length,info:document.querySelector('#sar-pager-top .pager-info').textContent,
   cats:document.querySelectorAll('#sar-cat-list .sar-cat').length,total:uniqueById(sarChosen()).length,hdrs:[...document.querySelectorAll('#sar-paper .pr-label')].slice(0,2).map(e=>e.textContent),
   arabic:!/[๐-๙]/.test(document.getElementById('sar-paper').textContent)}));
 console.log(JSON.stringify({parts:s1.parts,blocks:s1.blocks,tables:s1.tables,cats:s1.cats,total:s1.total,info:s1.info}));
 assert(s1.loaded&&s1.fy===fy&&s1.parts[0]==='Part I'&&s1.blocks>0&&s1.blocks<=10&&s1.charts>0,JSON.stringify(s1));
 assert.deepStrictEqual(s1.ths,['ที่','ตัวชี้วัด','เป้าหมาย','2566','2567','2568','2569','2570'],'5-year table only');
 assert(!s1.monthly&&!s1.owner,'no monthly table / owner in SAR');assert(s1.arabic,'arabic digits');
 assert.deepStrictEqual(s1.hdrs,['รายละเอียด/การวิเคราะห์ตัวชี้วัด (ไม่แสดงในเอกสารที่ Export — สำหรับให้หัวหน้าดูข้อมูล)','การวิเคราะห์ผลลัพธ์ตามตัวชี้วัดที่สำคัญและ PDCA (คำอธิบาย)']);
 assert(s1.total>200&&s1.cats>20,JSON.stringify(s1));
 await pg.screenshot({path:OUT+'/sar-1-page.png'});
 // เป็นมุมมอง รพ. เสมอ แม้หน้าแรกอยู่มุมมองอื่น/ตัวกรองอื่น
 await pg.evaluate(()=>{switchMenu('home');setTreeView('unit')});await pg.waitForSelector('#kpi-table');await pg.click('#menu-sar-btn');await pg.waitForSelector('#sar-pager-top .pager');
 const s1b=await pg.evaluate(()=>({parts:[...document.querySelectorAll('#sar-paper .pr-part')].map(e=>e.textContent),total:uniqueById(sarChosen()).length}));assert(s1b.parts[0]==='Part I'&&s1b.total===s1.total,'always hospital view '+JSON.stringify(s1b));
 // เลขข้อต่อเนื่องจากหน้าแรกของเอกสาร และหน้า 2 ต่อจากหน้า 1
 const nos1=await pg.evaluate(()=>[...document.querySelectorAll('#sar-paper .pr-kpi-title')].map(e=>e.textContent.split(' ')[0]));
 await pg.click('#sar-pager-top .page-btn:has-text("2")');await pg.waitForTimeout(300);
 const nos2=await pg.evaluate(()=>[...document.querySelectorAll('#sar-paper .pr-kpi-title')].map(e=>e.textContent.split(' ')[0]));
 assert(nos1[0]==='1.'&&nos2.length>0&&!nos2.some(n=>nos1.includes(n)&&n!=='1.'),'numbers continue: '+nos1.join(',')+' | '+nos2.join(','));
 await pg.click('#sar-pager-top .page-btn:has-text("1")');await pg.waitForTimeout(200);

 // ---- 2. กรอก/บันทึกสรุป PDCA
 const first=await pg.evaluate(()=>{const ta=document.querySelector('#sar-paper .sar-pdca');return {id:ta.dataset.id,saveDisabled:document.querySelector('#sar-paper .sar-save').disabled,revertShown:document.querySelector('#sar-paper .sar-revert').style.display!=='none'}});
 assert(first.saveDisabled&&!first.revertShown,'clean state: save disabled');
 const ta=pg.locator(`#sar-paper .sar-pdca[data-id="${first.id}"]`);
 await ta.fill('ปัญหาที่พบ ๒๕๗๐ ทดสอบ\n\nการพัฒนาที่ผ่านมา x');
 assert(await pg.evaluate(id=>!document.querySelector(`#sar-box-${CSS.escape(id)} .sar-save`).disabled&&document.getElementById('sar-box-'+id).classList.contains('dirty'),first.id),'dirty after typing');
 // ออกจากหน้าโดยไม่บันทึก → ถาม
 await pg.click('#menu-home-btn');await pg.waitForSelector('#modal-confirm',{state:'visible'});assert(/ยังไม่ได้บันทึก 1 รายการ/.test(await pg.textContent("#confirm-message")));
 await pg.click('#modal-confirm .btn-secondary');await pg.waitForTimeout(200);assert((await pg.evaluate(()=>currentTab))==='sar','stay on SAR after cancel');
 assert((await pg.inputValue(`#sar-paper .sar-pdca[data-id="${first.id}"]`)).startsWith('ปัญหาที่พบ ๒๕๗๐'),'draft kept');
 // ยกเลิกการแก้ไข
 await pg.click(`#sar-box-${first.id} .sar-revert`);await pg.waitForTimeout(200);assert((await pg.inputValue(`#sar-paper .sar-pdca[data-id="${first.id}"]`))==='','reverted');
 await pg.fill(`#sar-paper .sar-pdca[data-id="${first.id}"]`,'ปัญหาที่พบ ๒๕๗๐ ทดสอบ\n\nการพัฒนาที่ผ่านมา x');
 await pg.click(`#sar-box-${first.id} .sar-save`);await pg.waitForFunction(id=>sar.pdca[id]&&sar.pdca[id].rev===1,first.id);
 let sv=C.getSarDoc(tA,fy).pdca[first.id];assert(sv.text==='ปัญหาที่พบ 2570 ทดสอบ\n\nการพัฒนาที่ผ่านมา x'&&sv.rev===1&&sv.by===ad[0],JSON.stringify(sv));
 assert((await pg.inputValue(`#sar-paper .sar-pdca[data-id="${first.id}"]`)).startsWith('ปัญหาที่พบ 2570'),'normalized text shown after save');
 assert((await pg.textContent(`#sar-box-${first.id} .sar-stamp`)).includes('โดย '+ad[0]));
 assert(await pg.evaluate(()=>!document.querySelector('.sar-box.dirty')),'clean after save');
 // ปุ่มช่วยกรอก
 const second=await pg.evaluate(id=>[...document.querySelectorAll('#sar-paper .sar-pdca')].map(t=>t.dataset.id).find(x=>x!==id),first.id);
 await pg.click(`#sar-box-${second} .sar-heads`);assert((await pg.inputValue(`#sar-paper .sar-pdca[data-id="${second}"]`)).startsWith('ปัญหาที่พบ\n\nการวางแผนและการกำหนดมาตรฐาน\n\nการปฏิบัติตามแผน\n\nการตรวจสอบผลลัพธ์และวิเคราะห์สาเหตุ\n\nการปรับปรุงมาตรฐานและแผนพัฒนาต่อเนื่อง'),'insert 5 PDCA headings');
 await pg.click(`#sar-box-${second} .sar-revert`);

 // ---- 3. แก้ชนกัน: ผอ. บันทึกก่อน แล้ว admin (ฐานรุ่นเก่า) บันทึก → แถบเตือน
 const r=C.saveSarPdca(tE,fy,first.id,'ผอ.แก้ก่อนนะ',1);assert(r.success,JSON.stringify(r));
 await pg.fill(`#sar-paper .sar-pdca[data-id="${first.id}"]`,'ของ admin แก้ต่อ (รุ่นเก่า)');
 await pg.click(`#sar-box-${first.id} .sar-save`);await pg.waitForSelector('#modal-alert',{state:'visible'});assert(/ถูกแก้ไขโดย/.test(await pg.textContent('#modal-alert')),'conflict alert');
 await pg.click('#modal-alert button');await pg.waitForSelector('.sar-remote');
 const rem=await pg.evaluate(()=>({t:document.querySelector('.sar-remote-text').textContent,btns:[...document.querySelectorAll('.sar-remote-actions button')].map(b=>b.textContent),mine:document.querySelector('.sar-pdca').value}));
 assert(rem.t==='ผอ.แก้ก่อนนะ'&&rem.btns.length===3,JSON.stringify(rem));assert(C.getSarDoc(tA,fy).pdca[first.id].text==='ผอ.แก้ก่อนนะ','conflict wrote nothing');
 await pg.screenshot({path:OUT+'/sar-2-conflict.png'});
 // "แก้ต่อจากของฉัน": ฐานรุ่นล่าสุด draft ยังอยู่ → บันทึกผ่าน
 await pg.click('.sar-remote-actions button:has-text("แก้ต่อจากของฉัน")');await pg.waitForTimeout(200);
 assert(await pg.evaluate(id=>sar.drafts.get(id)==='ของ admin แก้ต่อ (รุ่นเก่า)'&&sar.pdca[id].rev===2&&!document.querySelector('.sar-remote'),first.id),'draft kept, base = latest');
 await pg.click(`#sar-box-${first.id} .sar-save`);await pg.waitForFunction(id=>sar.pdca[id].rev===3,first.id);assert(C.getSarDoc(tA,fy).pdca[first.id].text==='ของ admin แก้ต่อ (รุ่นเก่า)');
 // "ใช้ข้อความล่าสุด" / "บันทึกทับ" จากอีกชนกัน
 C.saveSarPdca(tE,fy,first.id,'ผอ. รอบสอง',3);
 await pg.fill(`#sar-paper .sar-pdca[data-id="${first.id}"]`,'ของ admin รอบสอง');await pg.click(`#sar-box-${first.id} .sar-save`);await pg.waitForSelector('#modal-alert',{state:'visible'});await pg.click('#modal-alert button');await pg.waitForSelector('.sar-remote');
 await pg.click('.sar-remote-actions button:has-text("ใช้ข้อความล่าสุด")');await pg.waitForTimeout(200);assert((await pg.inputValue(`#sar-paper .sar-pdca[data-id="${first.id}"]`))==='ผอ. รอบสอง'&&await pg.evaluate(()=>sar.drafts.size===0),'use theirs');
 C.saveSarPdca(tE,fy,first.id,'ผอ. รอบสาม',4);
 await pg.fill(`#sar-paper .sar-pdca[data-id="${first.id}"]`,'ของ admin ทับ');await pg.click(`#sar-box-${first.id} .sar-save`);await pg.waitForSelector('#modal-alert',{state:'visible'});await pg.click('#modal-alert button');await pg.waitForSelector('.sar-remote');
 await pg.click('.sar-remote-actions button:has-text("บันทึกทับ")');await pg.waitForFunction(id=>sar.pdca[id].text==='ของ admin ทับ',first.id);assert(C.getSarDoc(tA,fy).pdca[first.id].text==='ของ admin ทับ','force overwrite');

 // ---- 4. อัปเดตอัตโนมัติ: เครื่องอื่นบันทึก → หน้านี้เห็นเอง (ไม่ทับที่กำลังแก้)
 C.saveSarPdca(tE,fy,second,'จากเครื่องอื่น',0);
 await pg.evaluate(()=>livePoll());await pg.waitForFunction(id=>sar.pdca[id]&&sar.pdca[id].text==='จากเครื่องอื่น',second,{timeout:8000});
 assert((await pg.inputValue(`#sar-paper .sar-pdca[data-id="${second}"]`))==='จากเครื่องอื่น','live text shown');
 await pg.fill(`#sar-paper .sar-pdca[data-id="${second}"]`,'ผมกำลังพิมพ์อยู่');
 C.saveSarPdca(tE,fy,second,'เครื่องอื่นแก้อีก',1);
 await pg.evaluate(()=>livePoll());await pg.waitForSelector(`#sar-box-${second} .sar-remote`,{timeout:8000});
 assert(await pg.evaluate(id=>sar.drafts.get(id)==='ผมกำลังพิมพ์อยู่',second),'draft not overwritten by live update');
 await pg.click(`#sar-box-${second} .sar-remote-actions button:has-text("ใช้ข้อความล่าสุด")`);await pg.waitForTimeout(200);

 // ---- 5. ตัวกรอง / หมวด / ขนาดหน้า
 await pg.check('#sar-only-todo');await pg.waitForTimeout(200);
 const todo=await pg.evaluate(()=>({n:document.querySelectorAll('#sar-paper .sar-pdca').length,withText:[...document.querySelectorAll('#sar-paper .sar-pdca')].filter(t=>t.value.trim()).length,info:document.querySelector('#sar-pager-top .pager-info').textContent}));
 assert(todo.n>0&&todo.withText===0,'todo filter: only empty PDCA '+JSON.stringify(todo));
 await pg.uncheck('#sar-only-todo');
 await pg.selectOption('#sar-pager-top .pager-size select','30');await pg.waitForTimeout(500);
 const n30=await pg.evaluate(()=>document.querySelectorAll('#sar-paper .sar-block,#sar-paper .pr-ref').length);assert(n30>10&&n30<=30,'30 per page '+n30);
 await pg.selectOption('#sar-pager-top .pager-size select','10');await pg.waitForTimeout(300);
 // ติ๊กหมวดออก: ทั้ง Part I → เอกสารเริ่มที่ Part II แต่เลขข้อรันต่อใหม่
 await pg.evaluate(()=>{const c=document.querySelector('#sar-cat-list .sar-part[data-part="Part I"]');c.checked=false;sarTogglePart(c)});await pg.waitForTimeout(300);
 const noI=await pg.evaluate(()=>({first:document.querySelector('#sar-paper .pr-part').textContent,total:uniqueById(sarChosen()).length,no:document.querySelector('#sar-paper .pr-kpi-title').textContent.split(' ')[0]}));
 assert(noI.first==='Part II'&&noI.total<s1.total&&noI.no==='1.',JSON.stringify(noI));
 await pg.click('#sar-cat-list ~ * button,.rpt-bar button:has-text("เลือกทั้งหมด")');await pg.waitForTimeout(300);assert((await pg.evaluate(()=>uniqueById(sarChosen()).length))===s1.total);

 // ---- 6. เปลี่ยนปีงบ: โหลดสรุป PDCA ของปีนั้น (2569 ยังว่าง)
 await pg.selectOption('#fy-select','2569');await pg.waitForFunction(()=>sar.fy===2569&&sar.loaded,null,{timeout:15000});
 assert(await pg.evaluate(()=>Object.keys(sar.pdca).length===0&&[...document.querySelectorAll('#sar-paper .sar-pdca')].every(t=>t.value==='')),'2569 has no PDCA');
 await pg.selectOption('#fy-select','2570');await pg.waitForFunction(()=>sar.fy===2570&&sar.loaded&&Object.keys(sar.pdca).length>=2,null,{timeout:15000});

 // ---- 7. Export Word (.docx)
 assert(await pg.evaluate(()=>getComputedStyle(document.getElementById('sar-export-btn')).display!=='none'),'admin sees export');
 const t0=Date.now();const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:240000}),pg.click('#sar-export-btn')]);console.log('export ms',Date.now()-t0);
 const file=OUT+'/'+dl.suggestedFilename();await dl.saveAs(file);
 assert(dl.suggestedFilename()==='SAR_Part-I-IV_FY2570.docx',dl.suggestedFilename());
 const xml=execFileSync('unzip',['-p',file,'word/document.xml'],{maxBuffer:1<<29}).toString('utf8');
 const styles=execFileSync('unzip',['-p',file,'word/styles.xml']).toString('utf8');
 const media=execFileSync('unzip',['-Z1',file]).toString().split('\n').filter(x=>/^word\/media\//.test(x));
 const nCharts=await pg.evaluate(()=>{const t=sarTreeOf(sarChosen());const seen=new Set();let n=0;sarFlat(t).forEach(k=>{if(!seen.has(k.id)){seen.add(k.id);if(sarHasResults(k))n++}});return n});
 const mid=await pg.evaluate(id=>({a:sarSaved(id).text}),first.id);
 const drawings=(xml.match(/<w:drawing>/g)||[]).length;console.log('docx',Math.round(fs.statSync(file).size/1024)+'KB','charts',drawings,'/',nCharts,'(media files',media.length+')','tables',(xml.match(/<w:tbl>/g)||[]).length);
 assert(/<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"\/>/.test(xml),'A4 landscape');
 assert(xml.includes('รายงานการประเมินตนเอง (SAR)')&&xml.includes('โรงพยาบาลภูหลวง'),'title');
 assert(xml.includes('ของ admin ทับ')&&xml.includes('เครื่องอื่นแก้อีก')&&xml.includes('ปัญหาที่พบ 2570'.slice(0,0)||'ของ admin ทับ'),'saved PDCA text in file');
 assert(xml.includes('ผอ. รอบสาม')===false,'only latest text');
 assert(!/[๐-๙]/.test(xml.replace(/<[^>]+>/g,'')),'arabic digits only');
 assert(styles.includes('TH SarabunPSK')&&xml.includes('w:szCs')&&xml.includes('w:bCs'),'TH SarabunPSK + complex-script size/bold');
 assert(drawings===nCharts&&nCharts>200&&media.length>100,'one chart per kpi with data (identical charts share a media file)');
 assert(/ตัวชี้วัด\/ผลลัพธ์ \(แสดงกราฟ\)/.test(xml)&&/การวิเคราะห์ผลลัพธ์ตามตัวชี้วัดที่สำคัญและ PDCA/.test(xml),'analysis table headers');
 assert(!/ผลลัพธ์รายเดือน|ผู้รับผิดชอบดูแล|ที่มาแหล่งข้อมูล/.test(xml),'no monthly/owner/source in docx');
 assert(!xml.includes('ตัวย่อยของตัวชี้วัด รพ. (SAR)'),'import note stripped');
 assert(!xml.includes('รายละเอียด/การวิเคราะห์')&&!xml.includes('สรุป PDCA'),'docx has no details heading and no "สรุป PDCA"');
 const det=await pg.evaluate(()=>{const t=sarTreeOf(sarChosen());const k=sarFlat(t).find(k=>sarDetails(k).length>30&&/^[ก-๙A-Za-z0-9 ]+$/.test(sarDetails(k).slice(0,25)));return k?sarDetails(k).slice(0,25):null});
 assert(det&&!xml.includes(det),'details text of a kpi is not in docx: '+det);
 // กดพร้อมที่ยังไม่บันทึก → ไม่ export
 await pg.fill(`#sar-paper .sar-pdca[data-id="${first.id}"]`,'ยังไม่บันทึก');await pg.click('#sar-export-btn');await pg.waitForSelector('#modal-alert',{state:'visible'});assert(/ยังไม่ได้บันทึก/.test(await pg.textContent('#modal-alert')));await pg.click('#modal-alert button');
 await pg.click(`#sar-box-${first.id} .sar-revert`);
 assert(pg.errs.length===0,'page errors: '+pg.errs.join(' | '));
 await pg.context().close();

 // ---- 8. หัวหน้าหน่วย: เห็นเมนู · แก้ได้เฉพาะตัวของหน่วยตัวเอง · ไม่มีปุ่ม Export
 const ph=await open(b,head);
 await ph.click('#menu-sar-btn');await ph.waitForSelector('#sar-pager-top .pager');
 const hv=await ph.evaluate(()=>({exp:getComputedStyle(document.getElementById('sar-export-btn')).display,ta:document.querySelectorAll('#sar-paper .sar-pdca').length,ro:[...document.querySelectorAll('#sar-paper .sar-stamp')].filter(e=>/🔒/.test(e.textContent)).length,hint:document.getElementById('sar-hint').textContent}));
 assert(hv.exp==='none'&&/ผอ\.\/QMR\/admin/.test(hv.hint),JSON.stringify(hv));
 await ph.check('#sar-only-mine');await ph.waitForTimeout(300);
 const mine=await ph.evaluate(()=>({ta:document.querySelectorAll('#sar-paper .sar-pdca').length,ro:document.querySelectorAll('#sar-paper .sar-stamp').length-document.querySelectorAll('#sar-paper .sar-pdca').length,all:[...document.querySelectorAll('#sar-paper .sar-block')].length}));
 assert(mine.ta>0&&mine.ta===mine.all,'only-mine shows only editable: '+JSON.stringify(mine));
 const hid=await ph.evaluate(()=>document.querySelector('#sar-paper .sar-pdca').dataset.id);
 await ph.fill(`#sar-paper .sar-pdca[data-id="${hid}"]`,'หัวหน้าเขียน');await ph.click(`#sar-box-${hid} .sar-save`);await ph.waitForFunction(id=>sar.pdca[id]&&sar.pdca[id].by,hid);
 assert(C.getSarDoc(tA,fy).pdca[hid].by===head[0]);
 await ph.screenshot({path:OUT+'/sar-3-head.png'});
 assert(ph.errs.length===0,'head page errors: '+ph.errs.join(' | '));
 await b.close();console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
