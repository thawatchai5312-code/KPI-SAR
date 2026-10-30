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
 const pg=await open(br,ad);
 await pg.waitForFunction(()=>acDir.users.length>0&&acDir.units.length>0,null,{timeout:20000});
 const items=()=>pg.evaluate(()=>[...document.querySelectorAll('#ac-pop .ac-item')].map(e=>e.dataset.v));
 const shown=()=>pg.evaluate(()=>{const p=document.getElementById('ac-pop');return !!p&&p.style.display==='block'});
 // ===== แถวตาราง (admin): ผู้รับผิดชอบ =====
 const id=await pg.evaluate(()=>globalDatabase.find(k=>k.canEditDetails).id);
 await pg.evaluate(id=>{goToKpi(id);startEditNow(id)},id);await pg.waitForSelector('#ed-owner');
 const nm=await pg.evaluate(()=>acDir.users.find(n=>n.length>=3));const q=nm.slice(0,2);
 await pg.fill('#ed-owner','');await pg.type('#ed-owner',q);
 assert(await shown(),'popup shows');const it=await items();assert(it.length>0&&it.every(n=>n.toLowerCase().includes(q.toLowerCase())),'filtered by typed text '+JSON.stringify(it.slice(0,5)));
 assert(it.includes(nm),'contains the user');
 await pg.screenshot({path:OUT+'/ui63-owner.png'});
 // คีย์บอร์ด: ลูกศรลง + Enter
 await pg.keyboard.press('ArrowDown');await pg.keyboard.press('Enter');
 assert.strictEqual(await pg.inputValue('#ed-owner'),it[0],'enter picks first');assert(!(await shown()),'closed after pick');
 assert(await pg.evaluate(()=>document.getElementById('dirty-mark').style.display!=='none'),'dirty after pick');
 // ต่อท้ายหลัง / : ชื่อที่เลือกแล้วไม่ขึ้นซ้ำ
 await pg.type('#ed-owner',' / '+q);const it2=await items();assert(it2.length>0&&!it2.includes(it[0]),'already-chosen name not listed again');
 const second=it2[0];await pg.click('#ac-pop .ac-item');
 assert.strictEqual(await pg.inputValue('#ed-owner'),it[0]+' / '+second,'append with " / "');
 // Esc ปิด
 await pg.type('#ed-owner',' / ');assert(await shown(),'all remaining names listed after the separator');await pg.keyboard.press('Escape');assert(!(await shown()),'Esc closes');
 // ===== หน่วยงาน =====
 const un=await pg.evaluate(()=>acDir.units.find(n=>n.length>=2));
 await pg.fill('#ed-dept','');await pg.type('#ed-dept',un.slice(0,1));const du=await items();assert(du.length>0&&du.every(n=>n.toLowerCase().includes(un.slice(0,1).toLowerCase())),'unit filtered');
 await pg.type('#ed-dept','zzzz-no-match');assert(!(await shown()),'no match → hidden');
 await pg.evaluate(()=>cancelEdit());await pg.evaluate(()=>{if(document.getElementById('modal-confirm').style.display==='flex')closeConfirm(true)});
 // ===== ฟอร์มเพิ่ม =====
 await pg.evaluate(()=>openAddKpiModal());await pg.waitForSelector('#add-kpi-owner',{state:'visible'});
 await pg.fill('#add-kpi-owner','');await pg.type('#add-kpi-owner',q);assert(await shown());
 await pg.click('#ac-pop .ac-item');assert((await pg.inputValue('#add-kpi-owner')).length>0&&!(await shown()));
 await pg.fill('#add-kpi-dept','');await pg.type('#add-kpi-dept',un.slice(0,1));assert(await shown(),'unit list in add form');
 await pg.screenshot({path:OUT+'/ui63-add.png'});
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 // ===== staff: ไม่มีสิทธิ์เห็นหน่วยอัตโนมัติ แต่ dropdown ใช้ได้ =====
 await br.close();console.log('ui63 ok');
})().catch(e=>{console.error(e);process.exit(1)});
