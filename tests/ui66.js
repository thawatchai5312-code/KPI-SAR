// dropdown ค้นหา ผู้รับผิดชอบ/หน่วยงาน: การ์ด · แถวตาราง · ฟอร์มเพิ่ม — กรองตามคำที่พิมพ์ · เลือกด้วยเมาส์/คีย์บอร์ด · ต่อท้ายหลัง /

const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2570;
const DOCX_LIB=path.join(__dirname,'fixtures/lib/docx.iife.js'),PPTX_LIB=path.join(__dirname,'fixtures/lib/pptxgen.bundle.js');assert(fs.existsSync(DOCX_LIB)&&fs.existsSync(PPTX_LIB),'missing libs');
const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),ex=pick('executive'),hp=pick('head','PCT'),hn=U.find(r=>r[2]==='head'&&!/(^|,)PCT(,|$)/.test(r[3]));
[ad,ex,hp,hn].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tA=C.createSession_(ad[0],ad[1]),tE=C.createSession_(ex[0],ex[1]);
const OUT=process.cwd();
async function open(b,user){
 const ctx=await b.newContext({viewport:{width:1500,height:950},acceptDownloads:true});const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>{const u=r.request().url();
   if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(/docx@9\.5\.1\/dist\/index\.iife\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(DOCX_LIB)});
   if(/pptxgenjs@4\.0\.1\/dist\/pptxgen\.bundle\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(PPTX_LIB)});
   if(/fonts\.(googleapis|gstatic)\.com/.test(u))return r.abort();
   return r.abort()});
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',user[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForFunction(()=>document.getElementById('kpi-table')||document.querySelector('.kpi-card'),null,{timeout:60000});
 return pg;
}
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
 let replyText='ผลการดำเนินงาน\nร่างจาก AI',calls=[];
 C.UrlFetchApp={fetch:(u,o)=>{calls.push(JSON.parse(o.payload));return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:replyText}]}}]})}}};
 {const ck0=C.cltKpis_(fy)[0];if(ck0){const sv=C.saveCltItem(C.createSession_(ad[0],ad[1]),fy,'S|groups',JSON.stringify([ck0.groups[0]]),0,true);assert(sv.success,JSON.stringify(sv));}}
 const stf=U.find(r=>r[2]==='staff'&&C.getAllData(C.createSession_(r[0],r[1]),fy).data.some(k=>k.canEditDetails));
 const kp=C.getAllData(C.createSession_(stf[0],stf[1]),fy).data.find(k=>k.canEditDetails);
 // ===== ยังไม่ตั้งคีย์: ไม่มีไอคอน/ปุ่ม AI =====
 let pg=await open(br,stf);await pg.waitForTimeout(800);
 assert.deepStrictEqual(await pg.evaluate(()=>[document.body.classList.contains('ai-on'),getComputedStyle(document.getElementById('ai-fab')).display]),[false,'none']);
 await pg.evaluate(id=>{pageSize=50;currentPage=1;goToKpi(id);startEditNow(id)},kp.id);await pg.waitForSelector('#ed-details');
 assert.strictEqual(await pg.locator('button:has-text("วิเคราะห์รายละเอียดโดย AI")').isVisible(),false,'hidden while AI off');
 await pg.close();
 // ===== ตั้งคีย์แล้ว =====
 C.aiSaveSettings(C.createSession_(ad[0],ad[1]),{key:'AIza'+'C'.repeat(35),limit:30,enabled:true,model:'gemini-flash-latest'});
 pg=await open(br,stf);await pg.waitForFunction(()=>document.body.classList.contains('ai-on'),null,{timeout:20000});
 assert.strictEqual(await pg.evaluate(()=>getComputedStyle(document.getElementById('ai-fab')).display),'block');
 // --- หน้าแรก: ปุ่มใต้ช่องรายละเอียด
 await pg.evaluate(id=>{pageSize=50;currentPage=1;goToKpi(id);startEditNow(id)},kp.id);await pg.waitForSelector('#ed-details');
 const btn=pg.locator('button:has-text("วิเคราะห์รายละเอียดโดย AI")');assert(await btn.isVisible(),'button visible when AI on');
 await pg.fill('#ed-details','ข้อความเดิม');
 await btn.click();await pg.waitForSelector('#modal-ai',{state:'visible'});
 assert.strictEqual(await pg.inputValue('#ai-result'),'ผลการดำเนินงาน\nร่างจาก AI');
 const sent=calls[calls.length-1].contents[0].parts[0].text;assert(/ข้อความเดิม/.test(sent)&&/P – การวางแผน/.test(sent));
 await pg.screenshot({path:OUT+'/ui66-modal.png'});
 await pg.click('#modal-ai button:has-text("ยกเลิก")');assert.strictEqual(await pg.inputValue('#ed-details'),'ข้อความเดิม');
 await btn.click();await pg.waitForSelector('#modal-ai',{state:'visible'});
 await pg.click('#modal-ai button:has-text("ต่อท้าย")');
 assert.strictEqual(await pg.inputValue('#ed-details'),'ข้อความเดิม\n\nผลการดำเนินงาน\nร่างจาก AI');
 assert(await pg.evaluate(()=>getComputedStyle(document.getElementById('dirty-mark')).display!=='none'),'dirty mark after apply');
 await btn.click();await pg.waitForSelector('#modal-ai',{state:'visible'});await pg.click('#modal-ai button:has-text("แทนที่")');
 assert.strictEqual(await pg.inputValue('#ed-details'),'ผลการดำเนินงาน\nร่างจาก AI');
 await pg.evaluate(()=>cancelEdit());await pg.waitForSelector('#modal-confirm',{state:'visible'});await pg.click('#modal-confirm .btn-danger');await pg.waitForSelector('#modal-confirm',{state:'hidden'});
 // --- แชทลอย ¼ × ¾
 await pg.click('#ai-fab');await pg.waitForSelector('#ai-chat.open');
 const box=await pg.evaluate(()=>{const r=document.getElementById('ai-chat').getBoundingClientRect();return {w:r.width,h:r.height,right:innerWidth-r.right,vw:innerWidth,vh:innerHeight}});
 assert(Math.abs(box.w-Math.max(340,box.vw*0.25))<3&&Math.abs(box.h-Math.min(box.vh*0.75,box.vh-96))<3&&box.right>=8,JSON.stringify(box));
 assert((await pg.locator('#ai-quick button').count())>=3,'quick questions');
 await pg.click('#ai-quick button >> nth=0');await pg.waitForFunction(()=>document.querySelectorAll('#ai-msgs .ai-msg.m').length>=1&&/ร่างจาก AI/.test(document.getElementById('ai-msgs').innerText),null,{timeout:20000});
 assert(/ร่างจาก AI/.test(await pg.innerText('#ai-msgs')));assert(/ใช้แล้ว 3\/30|ใช้แล้ว \d+\/30/.test(await pg.innerText('#ai-foot')));
 const chatCall=calls[calls.length-1];assert(/<ดัชนีตัวชี้วัด/.test(chatCall.contents.slice(-1)[0].parts[0].text)&&/ผู้ช่วยระบบตัวชี้วัด/.test(chatCall.systemInstruction.parts[0].text));
 await pg.fill('#ai-text','คำถามที่สอง');await pg.press('#ai-text','Enter');
 await pg.waitForFunction(()=>document.querySelectorAll('#ai-msgs .ai-msg.u').length>=2&&document.querySelectorAll('#ai-msgs .ai-msg.m').length>=2,null,{timeout:20000});
 await pg.screenshot({path:OUT+'/ui66-chat.png'});
 // เปลี่ยนหน้าแล้วข้อความยังอยู่ · ล้างได้
 await pg.evaluate(()=>switchMenu('progress'));await pg.waitForTimeout(300);assert((await pg.locator('#ai-msgs .ai-msg').count())>=4,'chat survives page switch');
 await pg.click('#ai-chat .ai-head button:has-text("ล้าง")');assert.strictEqual(await pg.locator('#ai-msgs .ai-msg.u').count(),0);
 assert.deepStrictEqual(pg.errs,[]);await pg.close();
 // ===== ข้อผิดพลาดจากเซิร์ฟเวอร์ แสดงในแชท/หน้าต่างแจ้ง =====
 C.UrlFetchApp={fetch:()=>({getResponseCode:()=>429,getContentText:()=>'{}'})};
 pg=await open(br,stf);await pg.waitForFunction(()=>document.body.classList.contains('ai-on'));
 await pg.click('#ai-fab');await pg.fill('#ai-text','ทดสอบ');await pg.press('#ai-text','Enter');await pg.waitForSelector('#ai-msgs .ai-msg.err',{timeout:20000});
 assert(/มีคนใช้เยอะ/.test(await pg.innerText('#ai-msgs .ai-msg.err')));await pg.close();
 C.UrlFetchApp={fetch:(u,o)=>{calls.push(JSON.parse(o.payload));return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:'ร่าง PDCA จาก AI'}]}}]})}}};
 // ===== SAR (admin) =====
 pg=await open(br,ad);await pg.waitForFunction(()=>document.body.classList.contains('ai-on'));
 await pg.click('#menu-sar-btn');await pg.waitForSelector('.sar-pdca');
 const sb=pg.locator('.sar-ai').first();assert(await sb.isVisible(),'SAR ai button');
 await sb.click();await pg.waitForSelector('#modal-ai',{state:'visible'});assert.strictEqual(await pg.inputValue('#ai-result'),'ร่าง PDCA จาก AI');
 assert(/ปัญหาที่พบ/.test(calls[calls.length-1].contents[0].parts[0].text));
 await pg.click('#modal-ai button:has-text("แทนที่")');
 assert.strictEqual(await pg.locator('.sar-pdca').first().inputValue(),'ร่าง PDCA จาก AI');assert(await pg.locator('.sar-save').first().isEnabled(),'save enabled, not saved yet');
 const unsaved=C.getSarDoc(C.createSession_(ad[0],ad[1]),fy);assert(!Object.keys(unsaved.pdca).some(k=>unsaved.pdca[k].text==='ร่าง PDCA จาก AI'),'AI never saves by itself');
 // ===== CLT (admin) =====
 const ck=C.cltKpis_(fy)[0];
 if(ck){
  await pg.locator('.sar-revert').first().click(); // ทิ้งร่าง SAR ก่อนสลับแท็บ (ไม่งั้นระบบถามยืนยัน)
  await pg.click('#doc-tabs .doc-tab[data-doc=clt]');await pg.waitForSelector('#clt-tree .clt-link');
  await pg.evaluate(g=>cltOpenGroup(g),ck.groups[0]);await pg.waitForTimeout(300);
  await pg.evaluate(([g,id])=>cltSelect('D|'+g+'|R|'+id),[ck.groups[0],ck.id]);await pg.waitForSelector('#clt-text');
  const cb=pg.locator('button:has-text("วิเคราะห์ CLT โดย AI")');assert(await cb.isVisible(),'CLT ai button');
  await cb.click();await pg.waitForSelector('#modal-ai',{state:'visible'});
  assert(calls[calls.length-1].contents[0].parts[0].text.indexOf('กลุ่มโรค "'+ck.groups[0]+'"')!==-1);
  await pg.click('#modal-ai button:has-text("แทนที่")');assert.strictEqual(await pg.inputValue('#clt-text'),'ร่าง PDCA จาก AI');
 }
 // ===== ตั้งค่า AI (admin) =====
 await pg.evaluate(()=>{cltRevert();switchMenu('home');openSettings()});await pg.waitForSelector('#ai-set-model');
 await pg.waitForFunction(()=>document.getElementById('ai-set-model').value!=='');
 assert.strictEqual(await pg.inputValue('#ai-set-model'),'gemini-flash-latest');assert(/AIza••••/.test(await pg.innerText('#ai-key-state')),'key masked');
 const keyOnPage=await pg.evaluate(()=>document.documentElement.innerHTML.indexOf('AIza'+'C'.repeat(35)));assert.strictEqual(keyOnPage,-1,'full key never reaches the page');
 await pg.fill('#ai-set-limit','12');await pg.click('#ai-settings button:has-text("บันทึกค่า AI")');await pg.waitForFunction(()=>/บันทึกแล้ว/.test(document.getElementById('ai-set-msg').innerText));
 assert.strictEqual(C.aiConfig_().limit,12);
 console.log('errors',pg.errs);assert.strictEqual(pg.errs.length,0);
 await br.close();console.log('UI66 OK');
})().catch(e=>{console.error(e);process.exit(1)});
