// เครื่องมือ admin ✏️ เปลี่ยนชื่อ (หมวด/หน่วยงาน): หน้าต่าง 2 แท็บ · ตรวจสอบก่อนเขียน · ยืนยัน · หน้าเว็บใช้ชื่อใหม่ทันที

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
 await pg.waitForSelector('#kpi-table');
 return pg;
}
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await open(br,ad);
 const st=()=>pg.evaluate(()=>({tab:rn.tab,prev:!!rn.preview}));
 // ปุ่มในตั้งค่า
 await pg.evaluate(()=>openSettings());await pg.waitForSelector('#modal-settings',{state:'visible'});
 assert(/เปลี่ยนชื่อ/.test(await pg.textContent('#modal-settings .btn-accent:nth-of-type(3), #modal-settings')),'button');
 await pg.evaluate(()=>openRename());await pg.waitForSelector('#rn-from',{state:'visible'});
 assert(await pg.isDisabled('#rn-commit-btn'),'commit disabled before preview');
 // ===== แท็บหมวด: PCT › STEMI → STEMI-ใหม่ (เฉพาะ 2570) =====
 await pg.selectOption('#rn-part','PCT');await pg.selectOption('#rn-from','STEMI');
 const yrs=await pg.evaluate(()=>[...rn.years]);assert(yrs.length>=1,JSON.stringify(yrs));
 await pg.uncheck('.rn-years input[onchange*="2569"]');
 await pg.fill('#rn-to','STEMI-ใหม่');
 await pg.click('#rn-preview-btn');await pg.waitForSelector('#rn-result .rn-box.ok');
 assert(!await pg.isDisabled('#rn-commit-btn'),'commit enabled');
 const t1=await pg.textContent('#rn-result');assert(/ปีงบ 2570/.test(t1)&&!/ปีงบ 2569 —/.test(t1)&&/เอกสาร CLT/.test(t1),t1);
 await pg.screenshot({path:OUT+'/ui57-cat-preview.png'});
 // แก้ชื่อหลังตรวจ → ต้องตรวจใหม่
 await pg.fill('#rn-to','STEMI-ใหม่2');assert(await pg.isDisabled('#rn-commit-btn'),'preview invalidated');
 await pg.fill('#rn-to','STEMI-ใหม่');await pg.click('#rn-preview-btn');await pg.waitForSelector('#rn-result .rn-box.ok');
 await pg.click('#rn-commit-btn');await pg.waitForFunction(()=>document.getElementById('modal-confirm').style.display==='flex');
 await pg.click('#modal-confirm .btn-danger');
 await pg.waitForSelector('#rn-result .rn-box.ok b:has-text("เปลี่ยนชื่อเรียบร้อย")',{timeout:60000});
 await pg.screenshot({path:OUT+'/ui57-cat-done.png'});
 assert(await pg.evaluate(()=>PCT_GROUPS.includes('STEMI-ใหม่')&&!PCT_GROUPS.includes('STEMI')),'PCT_GROUPS refreshed');
 assert(await pg.evaluate(()=>globalDatabase.some(k=>(k.cats||[]).some(c=>c.part==='PCT'&&c.category==='STEMI-ใหม่'))),'data shows new name');
 // ===== แท็บหน่วยงาน =====
 await pg.click('#rn-tab-unit');await pg.waitForSelector('#rn-from option[value="MSO"]',{state:'attached'});
 assert(await pg.evaluate(()=>[...document.querySelectorAll('#rn-from option')].filter(o=>o.disabled).map(o=>o.value).sort().join()).then(v=>['IC','NSO','PCT','VIP'].every(u=>v.split(',').includes(u))),'locked units disabled');
 assert(/ทุกปีงบเสมอ/.test(await pg.textContent('#rn-body')));
 await pg.selectOption('#rn-from','MSO');await pg.fill('#rn-to','MSOใหม่');
 await pg.click('#rn-preview-btn');await pg.waitForSelector('#rn-result .rn-box.ok');
 const t2=await pg.textContent('#rn-result');assert(/ผู้ใช้ที่ชื่อหน่วยเปลี่ยนตาม/.test(t2),t2);
 await pg.screenshot({path:OUT+'/ui57-unit-preview.png'});
 // ชื่อไม่ถูกต้อง → แสดงข้อผิดพลาด ปุ่มยืนยันดับ
 await pg.fill('#rn-to','MS O');await pg.click('#rn-preview-btn');await pg.waitForSelector('#rn-result .rn-box.err');
 assert(await pg.isDisabled('#rn-commit-btn'));
 await pg.fill('#rn-to','MSOใหม่');await pg.click('#rn-preview-btn');await pg.waitForSelector('#rn-result .rn-box.ok');
 await pg.click('#rn-commit-btn');await pg.waitForFunction(()=>document.getElementById('modal-confirm').style.display==='flex');
 await pg.click('#modal-confirm .btn-danger');
 await pg.waitForSelector('#rn-result .rn-box.ok b:has-text("เปลี่ยนชื่อเรียบร้อย")',{timeout:60000});
 assert(/ออกจากระบบ/.test(await pg.textContent('#rn-result')),'users note');
 assert.strictEqual(await pg.evaluate(()=>UNIT_RENAMES['MSO']),'MSOใหม่');
 assert.strictEqual(await pg.evaluate(()=>pdfKpiDepts({department:'ER, MSO'}).join()),'ER,MSOใหม่');
 // รายการชื่อที่ไม่ตรงผู้ใช้ + ปุ่มรวม
 const unm=await pg.evaluate(()=>document.querySelectorAll('.rn-merge').length);
 if(unm){await pg.click('.rn-merge');assert(await pg.evaluate(()=>document.activeElement.id==='rn-to'),'focus to-input');assert((await pg.inputValue('#rn-from'))!=='');}
 await pg.screenshot({path:OUT+'/ui57-unit-done.png'});
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 // ผู้ใช้ที่ไม่ใช่ admin ไม่เห็น/เรียกไม่ได้
 assert.strictEqual(C.renameInfo(tE).success,false);
 await br.close();console.log('ui57 ok');
})().catch(e=>{console.error(e);process.exit(1)});
