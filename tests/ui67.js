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
async function open(b,user,ctxOpts){
 const ctx=await b.newContext(Object.assign({viewport:{width:1500,height:950},acceptDownloads:true},ctxOpts||{}));const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
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
 C.UrlFetchApp={fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:'ร่าง'}]}}]})})};
 C.aiSaveSettings(C.createSession_(ad[0],ad[1]),{key:'AIza'+'D'.repeat(35),limit:30,enabled:true,model:'gemini-flash-lite-latest'});
 const stf=U.find(r=>r[2]==='staff');
 const state=async pg=>pg.evaluate(()=>({mode:listMode,table:!!document.getElementById('kpi-table'),cards:document.querySelectorAll('.kpi-card').length,touch:isTouchDevice(),tour:tourMode()}));
 // ---- โทรศัพท์: admin → การ์ด
 let pg=await open(br,ad,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 let st=await state(pg);console.log('phone',JSON.stringify(st));
 assert(st.touch,'matchMedia(hover:none)and(pointer:coarse) is true on touch emulation');
 assert.strictEqual(st.mode,'card');assert(!st.table&&st.cards>0,JSON.stringify(st));assert.strictEqual(st.tour,'card');
 // สลับเป็นตารางได้ · ล็อกอินใหม่ → กลับเป็นการ์ด
 await pg.evaluate(()=>setListMode('table'));await pg.waitForSelector('#kpi-table');
 await pg.evaluate(()=>{logout()});await pg.waitForTimeout(400);
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(800);
 st=await state(pg);assert.strictEqual(st.mode,'card','relogin on phone → card again');
 await pg.close();
 // ---- แท็บเล็ต: head → การ์ด
 const hd=U.find(r=>r[2]==='head');
 pg=await open(br,hd,{viewport:{width:1024,height:1366},isMobile:true,hasTouch:true});st=await state(pg);assert(st.touch&&st.mode==='card'&&!st.table,JSON.stringify(st));await pg.close();
 // ---- คอมพิวเตอร์: กฎเดิม
 pg=await open(br,ad);st=await state(pg);assert(!st.touch&&st.mode==='table'&&st.table&&st.tour==='table',JSON.stringify(st));
 // สี AI เข้าธีมเขียว
 await pg.waitForFunction(()=>document.body.classList.contains('ai-on'),null,{timeout:20000});
 const col=await pg.evaluate(()=>({fab:getComputedStyle(document.getElementById('ai-fab')).backgroundImage,ico:getComputedStyle(document.querySelector('#ai-fab .ai-ico')).color,head:getComputedStyle(document.querySelector('.ai-head')).backgroundImage}));
 assert(/34, 176, 75|0, 115, 58|44, 153, 54|0, 74, 36/.test(col.fab)&&!/124, 58, 237/.test(col.fab)&&/252, 211, 77/.test(col.ico)&&/34, 176, 75|0, 115, 58|44, 153, 54|0, 74, 36/.test(col.head),JSON.stringify(col));
 await pg.close();
 pg=await open(br,stf);st=await state(pg);assert(!st.touch&&st.mode==='card',JSON.stringify(st));
 await pg.evaluate(()=>{const k=globalDatabase.find(x=>x.canEditDetails);pageSize=50;currentPage=1;goToKpi(k.id);startEditNow(k.id)});await pg.waitForSelector('#ed-details');
 const bt=await pg.evaluate(()=>{const b=document.querySelector('.btn.ai-btn');const c=getComputedStyle(b);return {bg:c.backgroundColor,img:c.backgroundImage,color:c.color}});
 assert(bt.bg==='rgb(237, 242, 238)'&&bt.img==='none'&&/^rgb\(0, (74, 36|115, 58)\)$/.test(bt.color),JSON.stringify(bt));
 await pg.screenshot({path:OUT+'/ui67-card-ai-btn.png'});
 await pg.click('#ai-fab');await pg.waitForSelector('#ai-chat.open');await pg.screenshot({path:OUT+'/ui67-chat.png'});
 console.log('errors',pg.errs);assert.strictEqual(pg.errs.length,0);
 await br.close();console.log('UI67 OK');
})().catch(e=>{console.error(e);process.exit(1)});
