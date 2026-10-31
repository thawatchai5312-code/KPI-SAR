// จอโทรศัพท์: ปุ่มแถบบน/แถบเมนูแสดงแต่ไอคอน (เมนูที่เปิดอยู่ยังมีชื่อ) · iPad/แท็บเล็ต/คอม เหมือนเดิม
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
// เซิร์ฟเวอร์จริงใส่ meta viewport ให้ใน doGet (addMetaTag) — จำลองเหมือนกัน ไม่งั้นมือถือจำลองใช้ความกว้าง 980px
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8').replace('<head>','<head><meta name="viewport" content="width=device-width, initial-scale=1">');
const U=h.sheets.Users.d;const fy=2570;const OUT=process.cwd();
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const ad=U.find(r=>r[2]==='admin');
async function open(b,ctxOpts){
 const ctx=await b.newContext(ctxOpts);const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForFunction(()=>document.getElementById('kpi-table')||document.querySelector('.kpi-card'),null,{timeout:60000});
 await pg.evaluate(()=>{document.querySelectorAll('.modal-overlay').forEach(m=>m.style.display='none')});
 return pg;
}
// สถานะการแสดง: ข้อความ (.lbl) ที่มองเห็นอยู่ของแต่ละปุ่ม
const probe=pg=>pg.evaluate(()=>{
 const sels={settings:'#admin-settings-btn',install:'#user-bar .install-btn',tour:'#tour-btn',pw:'.header-actions .btn-icon:nth-of-type(4)',logout:'.header-actions .btn-icon:last-of-type',home:'#menu-home-btn',report:'#menu-report-btn',progress:'#menu-progress-btn',sar:'#menu-sar-btn',card:'.mode-switch [data-mode=card]',table:'.mode-switch [data-mode=table]',add:'#btn-add-kpi',fy:'.nav-item.static',user:'#user-info'};
 const out={};
 for(const k in sels){const el=document.querySelector(sels[k]);if(!el){out[k]=null;continue}const l=el.querySelector('.lbl');out[k]={lbl:l?getComputedStyle(l).display!=='none':null,aria:el.getAttribute('aria-label')||el.getAttribute('title')||'',w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)}}
 out.overflowX=document.documentElement.scrollWidth>window.innerWidth+1;out.userText=document.getElementById('user-info').innerText;
 return out});
const PHONE={viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2};
const PHONE_LAND={viewport:{width:844,height:390},isMobile:true,hasTouch:true};
const IPAD={viewport:{width:820,height:1180},isMobile:true,hasTouch:true};
const IPAD_MINI={viewport:{width:744,height:1133},isMobile:true,hasTouch:true};
const IPAD_LAND={viewport:{width:1180,height:820},isMobile:true,hasTouch:true};
const DESK={viewport:{width:1500,height:950}};
const ICONS=['settings','install','tour','pw','logout','report','progress','sar','card','table','add','fy'];
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 // ---- โทรศัพท์แนวตั้ง + แนวนอน: ไอคอนอย่างเดียว
 for(const [name,opts] of [['phone',PHONE],['phone-land',PHONE_LAND]]){
  const pg=await open(br,opts);const p=await probe(pg);console.log(name,JSON.stringify(p).slice(0,300));
  ICONS.forEach(k=>{assert(p[k],name+' has '+k);assert.strictEqual(p[k].lbl,false,name+' '+k+' label hidden');assert(p[k].aria,name+' '+k+' has title/aria-label');});
  assert.strictEqual(p.home.lbl,true,name+' active menu keeps its name');assert(p.home.aria==='หน้าแรก');
  ['settings','install','tour','pw','logout','report','progress','sar','card','table','add'].forEach(k=>assert(p[k].w>=38&&p[k].h>=34,name+' '+k+' touch size '+p[k].w+'x'+p[k].h));
  assert(!/\(/.test(p.userText)&&/Admin|\S/.test(p.userText),name+' user name without tier: '+p.userText);
  assert(!p.overflowX,name+' no horizontal scroll');
  await pg.screenshot({path:OUT+'/ui70-'+name+'.png'});
  // เปลี่ยนเมนู → ชื่อย้ายไปที่เมนูที่เปิด
  await pg.click('#menu-report-btn');await pg.waitForTimeout(600);
  const q=await probe(pg);assert.strictEqual(q.report.lbl,true,name+' report shows name when active');assert.strictEqual(q.home.lbl,false,name+' home back to icon');
  // ปุ่มยังใช้งานได้: การ์ด/ตาราง + เพิ่มตัวชี้วัด + ตั้งค่า
  await pg.click('#menu-home-btn');await pg.waitForTimeout(500);
  await pg.click('.mode-switch [data-mode=table]');await pg.waitForSelector('#kpi-table');await pg.click('.mode-switch [data-mode=card]');await pg.waitForSelector('.kpi-card');
  await pg.click('#btn-add-kpi');await pg.waitForSelector('#modal-add-kpi',{state:'visible'});await pg.evaluate(()=>{document.getElementById('modal-add-kpi').style.display='none'});
  await pg.click('#admin-settings-btn');await pg.waitForSelector('#modal-settings',{state:'visible'});
  assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));await pg.context().close();
 }
 // ---- iPad / iPad mini / iPad แนวนอน / คอม: เหมือนเดิม (ข้อความครบ)
 for(const [name,opts] of [['ipad',IPAD],['ipad-mini',IPAD_MINI],['ipad-land',IPAD_LAND],['desktop',DESK]]){
  const pg=await open(br,opts);const p=await probe(pg);console.log(name,JSON.stringify(p.home),p.userText);
  ICONS.forEach(k=>{assert(p[k],name+' has '+k);assert.strictEqual(p[k].lbl,true,name+' '+k+' label still shown');});
  assert.strictEqual(p.home.lbl,true);assert(/\(.+\)/.test(p.userText),name+' user name keeps tier: '+p.userText);
  if(name==='ipad')await pg.screenshot({path:OUT+'/ui70-ipad.png'});
  assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));await pg.context().close();
 }
 await br.close();console.log('UI70 OK');
})().catch(e=>{console.error(e);process.exit(1)});
