// รหัสผ่านเลข 6 หลัก (หน้าเว็บ): บังคับตั้งใหม่ก่อนใช้งาน (ไม่มีปุ่มข้าม) · ช่องตัดตัวอักษร/แปลงเลขไทย · ปุ่มแสดงรหัส · แป้นตัวเลขหน้าเข้าสู่ระบบ + สลับ · รหัสตั้งต้นยังข้ามได้

const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2570;
const DOCX_LIB=path.join(__dirname,'fixtures/lib/docx.iife.js'),PPTX_LIB=path.join(__dirname,'fixtures/lib/pptxgen.bundle.js');assert(fs.existsSync(DOCX_LIB)&&fs.existsSync(PPTX_LIB),'missing libs');
const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),ex=pick('executive'),hp=pick('head','PCT'),hn=U.find(r=>r[2]==='head'&&!/(^|,)PCT(,|$)/.test(r[3]));

const tA=C.createSession_(ad[0],ad[1]),tE=C.createSession_(ex[0],ex[1]);
const OUT=process.cwd();
async function mk(b){
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
 return pg;
}

const staff=U.filter(r=>r[2]==='staff').slice(0,2);const [SA,SB]=staff;
const setPw=(r,pw,must)=>{r[1]=C.hashPassword_(pw);r[4]=must?'TRUE':'FALSE'};
const login=async(pg,name,pw)=>{await pg.fill('#login-username',name);await pg.fill('#login-password',pw);await pg.click('#login-box-content button')};
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await mk(br);
 // ===== หน้าเข้าสู่ระบบ: แป้นตัวเลข + ลิงก์สลับ =====
 assert.strictEqual(await pg.getAttribute('#login-password','inputmode'),'numeric');
 await pg.click('#login-kb-toggle');assert.strictEqual(await pg.getAttribute('#login-password','inputmode'),'text');
 await pg.click('#login-kb-toggle');assert.strictEqual(await pg.getAttribute('#login-password','inputmode'),'numeric');
 // ===== รหัสเดิมมีตัวอักษร → บังคับตั้งเลข 6 หลัก =====
 setPw(SA,'abc123xyz',false);
 await login(pg,SA[0],'abc123xyz');await pg.waitForSelector('#modal-change-password',{state:'visible'});
 assert.strictEqual((await pg.textContent('#chpw-cancel')).trim(),'ออกจากระบบ');
 assert(/ตัวเลข 6 หลัก/.test(await pg.textContent('#change-password-note')));
 assert.strictEqual(await pg.evaluate(()=>chpwPin),true);
 assert.strictEqual(await pg.getAttribute('#chpw-new','inputmode'),'numeric');
 // ช่องกรอก: ตัดตัวอักษร · เลขไทย → อารบิก · ไม่เกิน 6
 await pg.fill('#chpw-new','ab12cd34ef');assert.strictEqual(await pg.inputValue('#chpw-new'),'1234');
 await pg.fill('#chpw-new','๑๒๓๔๕๖๗๘');assert.strictEqual(await pg.inputValue('#chpw-new'),'123456');
 // ปุ่มแสดงรหัส
 assert.strictEqual(await pg.getAttribute('#chpw-new','type'),'password');
 await pg.check('#chpw-show');assert.strictEqual(await pg.getAttribute('#chpw-new','type'),'text');assert.strictEqual(await pg.getAttribute('#chpw-confirm','type'),'text');
 await pg.uncheck('#chpw-show');assert.strictEqual(await pg.getAttribute('#chpw-new','type'),'password');
 // ไม่ครบ 6 หลัก / ไม่ตรงกัน → เตือน ไม่ส่ง
 await pg.fill('#chpw-old','abc123xyz');await pg.fill('#chpw-new','12345');await pg.fill('#chpw-confirm','12345');await pg.click('#chpw-submit');
 await pg.waitForSelector('#modal-alert',{state:'visible'});assert(/ตัวเลข 6 หลัก/.test(await pg.textContent('#modal-alert')));await pg.click('#modal-alert button');
 await pg.fill('#chpw-new','482915');await pg.fill('#chpw-confirm','482916');await pg.click('#chpw-submit');
 await pg.waitForSelector('#modal-alert',{state:'visible'});assert(/ไม่ตรงกัน/.test(await pg.textContent('#modal-alert')));await pg.click('#modal-alert button');
 // ส่งถูก → เข้าระบบต่อ
 await pg.fill('#chpw-confirm','482915');await pg.click('#chpw-submit');
 await pg.waitForSelector('#modal-fy',{state:'visible',timeout:20000});
 assert.strictEqual(await pg.evaluate(()=>currentUser.pinRequired),false);
 assert.strictEqual(await pg.evaluate(()=>chpwPin),false);
 // รหัสใหม่ใช้ล็อกอินได้ · รหัสเดิมไม่ได้
 assert(C.authenticateUser(SA[0],'482915').success&&!C.authenticateUser(SA[0],'abc123xyz').success);
 await pg.close();
 // ===== กด "ออกจากระบบ" ในหน้าบังคับ =====
 setPw(SA,'abc123xyz',false);
 const p2=await mk(br);await login(p2,SA[0],'abc123xyz');await p2.waitForSelector('#modal-change-password',{state:'visible'});
 await p2.click('#chpw-cancel');
 await p2.waitForFunction(()=>document.getElementById('modal-change-password').style.display==='none'&&getComputedStyle(document.getElementById('app-login-screen')).display!=='none');
 assert.strictEqual(await p2.evaluate(()=>isAppUnlocked),false);
 await p2.close();
 // ===== รหัสตั้งต้น 11038: ข้ามไปก่อนได้ (เหมือนเดิม) =====
 setPw(SB,'11038',true);
 const p3=await mk(br);await login(p3,SB[0],'11038');await p3.waitForSelector('#modal-change-password',{state:'visible'});
 assert.strictEqual((await p3.textContent('#chpw-cancel')).trim(),'ข้ามไปก่อน');assert.strictEqual(await p3.evaluate(()=>chpwPin),false);
 await p3.click('#chpw-cancel');await p3.waitForSelector('#modal-fy',{state:'visible',timeout:20000});
 await p3.screenshot({path:OUT+'/ui80-default.png'});
 await p3.close();
 // ===== รหัสเลข 6 หลักอยู่แล้ว: เข้าได้เลย ไม่มีหน้าต่างเปลี่ยนรหัส =====
 setPw(SB,'654321',false);
 const p4=await mk(br);await login(p4,SB[0],'654321');await p4.waitForSelector('#modal-fy',{state:'visible',timeout:20000});
 assert.strictEqual(await p4.evaluate(()=>getComputedStyle(document.getElementById('modal-change-password')).display),'none');
 await p4.close();
 await br.close();console.log('ui80 ok');
})().catch(e=>{console.error(e);process.exit(1)});
