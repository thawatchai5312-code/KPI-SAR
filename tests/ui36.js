// views re-categorisation on live data: QA / unit / PCT order + level-bound add form
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness5');const C=h.ctx;const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
const U=h.sheets.Users.d; const setPw=(n,p)=>{const r=U.find(x=>x[0]===n);r[1]=C.hashPassword_(p);r[4]='FALSE'};
(async()=>{
 C.PropertiesService.getScriptProperties().setProperty('HEAD_SEED_V1','done');
 setPw('Admin','pw123456'); const hd=U.find(r=>r[2]==='head'&&/(^|,)ER(,|$)/.test(r[3])); setPw(hd[0],'pw123456');
 const er=U.find(r=>r[2]==='staff'&&/(^|,)ER(,|$)/.test(r[3])); setPw(er[0],'pw123456');
 const at=C.createSession_('Admin',U.find(r=>r[0]==='Admin')[1]); assert(C.tidyCommit(at).success);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mk=async()=>{const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');return pg};
 const login=async(pg,u,p)=>{await pg.fill('#login-username',u);await pg.fill('#login-password',p);await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(500)};
 const side=async(pg,path,h)=>{const bb=await pg.evaluate(()=>{const r=document.getElementById('panel-tree').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}});await pg.screenshot({path,clip:{x:bb.x,y:bb.y,width:bb.width,height:h}});};
 const pg=await mk(); await login(pg,'Admin','pw123456');
 const st=async pg=>pg.evaluate(()=>({scope:appliedFilters.scope,view:treeView,btn:[...document.querySelectorAll('#tree-filterbar .fb-btn')].map(b=>b.innerText.replace(/\s+/g,' ')+(b.classList.contains('on')?'*':'')),tabs:[...document.querySelectorAll('#view-tabs .view-tab')].map(b=>b.innerText.replace(/\s+/g,' '))}));
 console.log('admin',JSON.stringify(await st(pg))); await side(pg,'nav-admin.png',360);
 await pg.click('#tree-filterbar .fb-btn[data-scope="mine"]'); await pg.waitForTimeout(400); console.log('admin mine',JSON.stringify(await st(pg)));
 await pg.evaluate(()=>setTreeView('qa')); await pg.waitForTimeout(400); await side(pg,'nav-qa.png',360);
 const p2=await mk(); await login(p2,er[0],'pw123456'); console.log('staff',JSON.stringify(await st(p2))); await side(p2,'nav-staff.png',600);
 const p3=await mk(); await login(p3,hd[0],'pw123456'); console.log('head',hd[0],JSON.stringify(await st(p3))); await side(p3,'nav-head.png',360);
 // progress page shares scope
 await p3.click('#menu-progress-btn'); await p3.waitForTimeout(500);
 const pr=await p3.evaluate(()=>({btn:[...document.querySelectorAll('#pg-scope .fb-btn')].map(b=>b.innerText+(b.classList.contains('on')?'*':'')),n:globalProgressData.length}));console.log('progress',JSON.stringify(pr));
 await p3.click('#pg-scope .fb-btn[data-scope="mine"]'); await p3.waitForTimeout(400); console.log('progress mine',await p3.evaluate(()=>globalProgressData.length+' '+appliedFilters.scope));
 await p3.screenshot({path:'nav-progress.png',clip:{x:300,y:140,width:1140,height:200}});
 // report page
 await p3.click('#menu-report-btn').catch(()=>p3.evaluate(()=>switchMenu('report'))); await p3.waitForTimeout(900);
 console.log('report scope btns',await p3.evaluate(()=>[...document.querySelectorAll('#rp-filterbar .fb-btn[data-scope]')].map(b=>b.innerText.replace(/\s+/g,' ')+(b.classList.contains('on')?'*':'')).join(' | ')));
 await p3.screenshot({path:'nav-report.png',clip:{x:0,y:140,width:420,height:500}});
 const m=await mk(); await m.setViewportSize({width:390,height:844}); await login(m,er[0],'pw123456'); await m.screenshot({path:'nav-mobile.png'}); const w=await mk(); await w.setViewportSize({width:1920,height:1000}); await login(w,'Admin','pw123456'); await side(w,'nav-wide.png',330);
 for(const p of [pg,p2,p3])assert(p._errs.length===0,p._errs.join());
 await b.close(); console.log('SHOTS OK');
})().catch(e=>{console.error(e);process.exit(1)});
