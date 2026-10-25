// scope filter (ของฉัน / หน่วยของฉัน / ทั้งหมด) shared across home / report / progress, defaults by role, counts
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness5');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE");
const U=h.sheets.Users.d; const setPw=(n,p)=>{const r=U.find(x=>x[0]===n);r[1]=C.hashPassword_(p);r[4]='FALSE'};
(async()=>{
 C.PropertiesService.getScriptProperties().setProperty('HEAD_SEED_V1','done');
 const st=U.find(r=>r[2]==='staff'&&/(^|,)ER(,|$)/.test(r[3])), hd=U.find(r=>r[2]==='head'&&/(^|,)ER(,|$)/.test(r[3])), ex=U.find(r=>r[2]==='executive');
 [st,hd,ex,U.find(r=>r[0]==='Admin')].forEach(r=>setPw(r[0],'pw123456'));
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mk=async()=>{const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');return pg};
 const login=async(pg,u)=>{await pg.fill('#login-username',u);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(500)};
 const S=pg=>pg.evaluate(()=>{const n=b=>Number((b.querySelector('.fb-n')||{}).textContent);
   return {scope:appliedFilters.scope,view:treeView,sc:Object.fromEntries([...document.querySelectorAll('#tree-filterbar [data-scope]')].map(b=>[b.dataset.scope,n(b)])),
   on:[...document.querySelectorAll('#tree-filterbar .fb-btn[data-scope].on, #tree-filterbar .fb-btn.cut')].map(b=>b.dataset.scope||b.dataset.status),
   cards:uniqueById(getOrderedKpis()).length,tabs:Object.fromEntries([...document.querySelectorAll('#view-tabs .view-tab')].map(b=>[b.dataset.view,+b.querySelector('.vt-count').textContent])),
   levelBtns:document.querySelectorAll('[data-level]').length,
   okMine:getOrderedKpis().every(k=>appliedFilters.scope!=='mine'||k.isOwner),okUnit:getOrderedKpis().every(k=>appliedFilters.scope!=='unit'||k.isOwner||k.inDept),grp:document.querySelector('#panel-tree .nav-group').dataset.view}});
 // staff
 let pg=await mk(); await login(pg,st[0]); let s=await S(pg); console.log('staff',JSON.stringify(s));
 assert(s.scope==='mine'&&s.levelBtns===0&&s.on.join()==='mine,green'&&s.okMine&&s.cards===s.sc.mine&&s.tabs.unit===s.cards&&s.grp==='unit');
 assert(s.sc.mine<=s.sc.unit&&s.sc.unit<=s.sc.all);
 await pg.click('#tree-filterbar [data-scope="unit"]'); await pg.waitForTimeout(400); s=await S(pg); console.log('staff unit',JSON.stringify(s)); assert(s.scope==='unit'&&s.okUnit&&s.cards===s.sc.unit);
 // สถานะแบบไล่ระดับ
 const lv=()=>pg.evaluate(()=>{const c={red:0,yellow:0,green:0};uniqueById(getOrderedKpis()).forEach(k=>c[kpiStatus(k).level]++);return {c,on:[...document.querySelectorAll('#tree-filterbar .fb-btn[data-status].on')].map(b=>b.dataset.status).join(),btns:[...document.querySelectorAll('#tree-filterbar [data-status]')].map(b=>b.dataset.status).join()}});
 let a=await lv(); console.log('status green',JSON.stringify(a)); assert(a.btns==='red,yellow,green'&&a.on==='red,yellow,green');
 await pg.click('#tree-filterbar [data-status="red"]'); await pg.waitForTimeout(400); a=await lv(); console.log('status red',JSON.stringify(a)); assert(a.on==='red'&&a.c.yellow===0&&a.c.green===0);
 await pg.click('#tree-filterbar [data-status="yellow"]'); await pg.waitForTimeout(400); a=await lv(); console.log('status yellow',JSON.stringify(a)); assert(a.on==='red,yellow'&&a.c.green===0&&a.c.yellow>0);
 s=await S(pg); assert(s.on.join()==='unit,yellow');
 // report page shares the same filters
 await pg.evaluate(()=>switchMenu('report')); await pg.waitForTimeout(900);
 const r=await pg.evaluate(()=>({on:[...document.querySelectorAll('#rp-filterbar .fb-btn[data-scope].on, #rp-filterbar .fb-btn.cut')].map(b=>b.dataset.scope||b.dataset.status).join(),grp:document.querySelector('#rp-side .nav-group').dataset.view,chosen:uniqueById(rptChosen()).length,all:uniqueById(getOrderedKpis()).length}));
 console.log('report',JSON.stringify(r)); assert(r.on==='unit,yellow'&&r.grp==='unit'&&r.chosen===r.all);
 await pg.click('#rp-filterbar [data-scope="mine"]'); await pg.waitForTimeout(600);
 assert(await pg.evaluate(()=>appliedFilters.scope==='mine'&&rptChosen().every(k=>k.isOwner)));
 // progress
 await pg.evaluate(()=>switchMenu('progress')); await pg.waitForTimeout(600);
 const p=await pg.evaluate(()=>({on:[...document.querySelectorAll('#pg-scope .fb-btn.on')].map(b=>b.dataset.scope).join(),n:globalProgressData.length,mine:globalDatabase.filter(k=>k.isOwner).length}));
 console.log('progress',JSON.stringify(p)); assert(p.on==='mine'&&p.n===p.mine);
 await pg.click('#pg-scope [data-scope="all"]'); await pg.waitForTimeout(500); assert(await pg.evaluate(()=>globalProgressData.length===globalDatabase.length&&appliedFilters.scope==='all'));
 await pg.evaluate(()=>switchMenu('home')); await pg.waitForTimeout(500); s=await S(pg); assert(s.scope==='all'&&s.on[0]==='all','home follows progress scope');
 // logout -> next user gets own default
 await pg.evaluate(()=>logout()); await pg.waitForTimeout(400); await login(pg,hd[0]); s=await S(pg); console.log('head',JSON.stringify(s)); assert(s.scope==='unit'&&s.on.join()==='unit,green'&&s.okUnit);
 const pe=await mk(); await login(pe,ex[0]); s=await S(pe); console.log('exec',JSON.stringify({scope:s.scope,sc:s.sc,view:s.view})); assert(s.scope==='all'&&s.view==='hosp');
 // empty message for mine with nothing in view
 const pa=await mk(); await login(pa,'Admin'); await pa.click('#tree-filterbar [data-scope="mine"]'); await pa.waitForTimeout(400);
 const em=await pa.innerText('#accordion-tree-container'); console.log('admin mine empty:',em.replace(/\n/g,' ')); assert(/หน่วยของฉัน/.test(em));
 for(const x of [pg,pe,pa])assert(x._errs.length===0,x._errs.join());
 await b.close(); console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
