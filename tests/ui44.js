// busy pop-up on loading steps: FY change, reload after add, report prefs, settings users, previews; no pop-up on the first full-screen login load
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const ad=U.find(r=>r[2]==='admin');ad[1]=C.hashPassword_('pw123456');ad[4]='FALSE';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{window.__delay={};window.__seen=[];function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>{const o=document.getElementById('busy-overlay');return new Promise(r=>setTimeout(r,window.__delay[fn]||0)).then(()=>{window.__seen.push(fn+':'+(document.getElementById('busy-overlay').classList.contains('show')?document.getElementById('busy-text').innerText:'NO'));return window.__call(fn,a)}).then(r=>ok&&ok(JSON.parse(r)))}}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 const seen=()=>pg.evaluate(()=>window.__seen.slice());
 const shown=()=>pg.isVisible('#busy-overlay');
 await pg.evaluate(()=>{window.__delay.getAllData=600});
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');
 await pg.waitForSelector('#modal-fy',{state:'visible'});
 assert((await seen()).includes('getAllData:NO'),'first login load has no pop-up (own full screen) '+await seen());
 // FY pick → pop-up
 await pg.selectOption('#fy-pick-select','2569');await pg.click('#modal-fy button');await pg.waitForTimeout(250);
 assert(await shown()&&(await pg.innerText('#busy-text')).includes('ปีงบ 2569'),'fy confirm pop-up');
 assert(await pg.evaluate(()=>document.elementFromPoint(700,450).closest('#busy-overlay')!==null),'blocks clicks');
 await pg.waitForSelector('#busy-overlay',{state:'hidden'});await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 // FY change from the bar
 await pg.evaluate(()=>{const s=document.getElementById('fy-select');s.value='2570';onFiscalYearChange(s)});await pg.waitForTimeout(250);
 assert(await shown()&&(await pg.innerText('#busy-text')).includes('ปีงบ 2570'),'fy change pop-up');
 await pg.waitForSelector('#busy-overlay',{state:'hidden'});assert(await pg.evaluate(()=>selectedFy)===2570);
 // double change attempt while loading: second dropdown event blocked by overlay (fy-select disabled too)
 // reload after delete/add path message
 await pg.evaluate(()=>fetchAllDataFromServer(true));await pg.waitForTimeout(200);assert((await pg.innerText('#busy-text')).includes('ข้อมูลล่าสุด'));await pg.waitForSelector('#busy-overlay',{state:'hidden'});
 // report prefs on first open
 await pg.evaluate(()=>{window.__delay.getReportPrefs=500;switchMenu('report')});await pg.waitForTimeout(200);
 assert(await shown()&&(await pg.innerText('#busy-text')).includes('ตัวเลือกรายงาน'),'report prefs pop-up');await pg.waitForSelector('#busy-overlay',{state:'hidden'});
 // settings users + previews
 await pg.evaluate(()=>{switchMenu('home');window.__delay.getUsersForAdmin=500;openSettings()});await pg.waitForTimeout(200);
 assert(await shown()&&(await pg.innerText('#busy-text')).includes('รายชื่อผู้ใช้'),'users pop-up');await pg.waitForSelector('#busy-overlay',{state:'hidden'});await pg.evaluate(()=>{document.getElementById('modal-settings').style.display='none'});
 for(const [fn,open] of [['pctImportPreview','openPct'],['tidyPreview','openTidy'],['nsoImportPreview','openNsoImport']]){
   await pg.evaluate(([fn,open])=>{window.__delay[fn]=500;window[open]()},[fn,open]);await pg.waitForTimeout(200);
   assert(await shown(),open+' pop-up');await pg.waitForSelector('#busy-overlay',{state:'hidden',timeout:15000});
   await pg.evaluate(()=>document.querySelectorAll('.modal-overlay').forEach(m=>{if(m.id!=='app-login-screen')m.style.display='none'}));
 }
 // failure releases the pop-up
 await pg.evaluate(()=>{window.google.script.run=new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>window.google.script.run;if(fn==='withFailureHandler')return f=>{window.__fh=f;return window.google.script.run};return ()=>setTimeout(()=>window.__fh(new Error('network down')),300)}});fetchAllDataFromServer(true)});
 await pg.waitForTimeout(150);assert(await shown(),'shown during');await pg.waitForSelector('#modal-alert',{state:'visible'});assert(!(await shown()),'hidden after failure');
 assert(errs.length===0,errs.join());await b.close();console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
