// ปุ่ม 📲 ติดตั้งแอป: ขึ้นบนหน้าล็อกอินและหลังล็อกอิน · หน้าต่างบอกวิธีตามเครื่อง/เบราว์เซอร์ · คัดลอกลิงก์ · ล็อกอินยังใช้ได้ปกติ
// ต้องมี tests/fixtures/lib/pptxgen.bundle.js (npm pptxgenjs@4.0.1 dist/pptxgen.bundle.js — ใช้แทน CDN ตอนเทสต์)
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const PPTX_LIB=path.join(__dirname,'fixtures/lib/pptxgen.bundle.js');assert(fs.existsSync(PPTX_LIB),'missing '+PPTX_LIB);
const U=h.sheets.Users.d;const fy=2570;
const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),ex=pick('executive'),hp=pick('head','PCT'),hn=U.find(r=>r[2]==='head'&&!/(^|,)PCT(,|$)/.test(r[3]));
[ad,ex,hp,hn].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tA=C.createSession_(ad[0],ad[1]),tE=C.createSession_(ex[0],ex[1]);
const OUT=process.cwd();
async function open(b,user,ua,stopAtLogin){
 const ctx=await b.newContext({viewport:{width:1500,height:950},acceptDownloads:true,...(ua?{userAgent:ua}:{})});const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>{const u=r.request().url();
   if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(/pptxgenjs@4\.0\.1\/dist\/pptxgen\.bundle\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(PPTX_LIB)});
   return r.abort()});
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 if(stopAtLogin)return pg;
 await pg.fill('#login-username',user[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForSelector('#kpi-table');
 return pg;
}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const LINK='https://script.google.com/macros/s/AKfycbzuT2u3T3x8aa97LafoiXMtgSPzYlXMbXJ8UPLF_JXZjzdcleH6xGXMcEk4KQb7xTtaDQ/exec';
 const UAS={
  android:['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',/Android \(Chrome\)/,/เพิ่มลงในหน้าจอหลัก/],
  ios:['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',/iPhone \/ iPad \(Safari\)/,/เพิ่มไปยังหน้าจอโฮม/],
  line:['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.5.0',/เปิดอยู่ในแอป LINE/,/เปิดในเบราว์เซอร์/],
  edge:['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',/Edge/,/ติดตั้งไซต์นี้เป็นแอป/],
  chrome:[null,/Chrome/,/ติดตั้งหน้าเว็บเป็นแอป/]
 };
 for(const [name,[ua,envRe,stepRe]] of Object.entries(UAS)){
  const pg=await open(b,ad,ua||undefined,true);
  // หน้าล็อกอิน: ปุ่มมุมขวาบน มองเห็นและอยู่ด้านบนสุด
  const vis=await pg.evaluate(()=>{const e=document.querySelector('#app-login-screen .install-btn');const r=e.getBoundingClientRect();const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {shown:getComputedStyle(e).display!=='none'&&r.width>0,right:window.innerWidth-r.right<80,top:r.top<80,hit:top===e||e.contains(top)}});
  assert(vis.shown&&vis.right&&vis.top&&vis.hit,name+' login button '+JSON.stringify(vis));
  await pg.click('#app-login-screen .install-btn');await pg.waitForSelector('#modal-install',{state:'visible'});
  const env=await pg.textContent('#install-env'),main=await pg.textContent('#install-main'),others=await pg.textContent('#install-others');
  assert(envRe.test(env),name+' env: '+env);assert(stepRe.test(main),name+' steps: '+main);
  assert(others.length>50&&!stepRe.test(others)||name==='line','others listed '+name);
  assert.strictEqual(await pg.inputValue('#install-link'),LINK);
  // หน้าต่างอยู่เหนือหน้าล็อกอิน (กดปิดได้)
  assert(await pg.evaluate(()=>{const c=document.querySelector('#modal-install .modal-card').getBoundingClientRect();const e=document.elementFromPoint(c.left+c.width/2,c.top+30);return !!e.closest('#modal-install')}),name+' modal on top');
  if(name==='line'){const href=await pg.getAttribute('#install-main a','href');assert(href===LINK+'?openExternalBrowser=1',href);}
  if(name==='chrome'){await pg.screenshot({path:OUT+'/ui52-modal.png'});
   // คัดลอกลิงก์: ไม่ว่าเบราว์เซอร์อนุญาตคลิปบอร์ดหรือไม่ ต้องมีข้อความผลลัพธ์
   await pg.click('#modal-install button:has-text("คัดลอกลิงก์")');await pg.waitForFunction(()=>document.getElementById('install-copy-msg').innerText.length>0);
   const m=await pg.textContent('#install-copy-msg');assert(/คัดลอกลิงก์แล้ว|เลือกลิงก์ไว้แล้ว/.test(m),m);}
  await pg.click('#modal-install .modal-footer button');await pg.waitForSelector('#modal-install',{state:'hidden'});
  await pg.context().close();
 }
 // ล็อกอินปกติ + ปุ่มหลังล็อกอิน
 const pg=await open(b,ad);
 assert(await pg.evaluate(()=>{const e=document.querySelector('#user-bar .install-btn');return getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0&&document.getElementById('user-bar').style.display!=='none'}),'button after login');
 await pg.click('#user-bar .install-btn');await pg.waitForSelector('#modal-install',{state:'visible'});await pg.screenshot({path:OUT+'/ui52-after-login.png'});
 await pg.click('#modal-install .modal-footer button');
 assert(await pg.evaluate(()=>document.getElementById('app-login-screen').style.display==='none'||getComputedStyle(document.getElementById('app-login-screen')).display==='none'),'logged in');
 assert.deepStrictEqual(pg.errs,[]);await b.close();console.log('ui52 OK');
})().catch(e=>{console.error(e);process.exit(1)});
