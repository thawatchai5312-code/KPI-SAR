const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness');const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
(async()=>{
 h.ctx.authenticateUser('Admin','Admin11038'); h.ctx.authenticateUser('Admin','Admin11038');
 for(const u of ['มานี','อรทัย','ผอ.']){const t=h.ctx.authenticateUser(u,'11038'); h.ctx.changePassword(t.token,'11038','secret99');}
 // a staff with no KPIs
 const at=h.ctx.authenticateUser('Admin','Admin11038'); const users=h.ctx.getUsersForAdmin(at.token).users; users.push({username:'คนใหม่',tier:'staff',depts:'',isNew:true}); h.ctx.saveUsersForAdmin(at.token,users,[]); const tn=h.ctx.authenticateUser('คนใหม่','11038'); h.ctx.changePassword(tn.token,'11038','secret99');
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mkpage=async(vw=1440,vh=900)=>{
  const pg=await b.newPage({viewport:{width:vw,height:vh}});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message)); pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(h.ctx[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>{const u=r.request().url();if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});return r.abort()});
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/'); return pg; };
 const login=async(pg,u,p)=>{await pg.fill('#login-username',u);await pg.fill('#login-password',p);await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(300)};
 const total=pg=>pg.evaluate(()=>getOrderedKpis().length);

 let pg=await mkpage(); await login(pg,'อรทัย','secret99'); await pg.evaluate(()=>setTreeView('hosp')); await pg.waitForTimeout(400); await pg.mouse.move(1300,500); await pg.waitForTimeout(600);
 const state=()=>pg.evaluate(()=>({openParts:Array.from(document.querySelectorAll('.accordion-part.open')).map(e=>e.dataset.part),openCats:Array.from(document.querySelectorAll('.category-block.open')).map(e=>e.dataset.cat),inView:(document.querySelector('.kpi-link-item.in-view')||{}).dataset?.key,firstCard:document.querySelector('.kpi-card').dataset.key}));
 let st=await state(); console.log('initial (mine filter on):',JSON.stringify(st));
 assert(st.openParts.length<=1&&st.openCats.length<=1,'only one open');
 // scroll cards down -> tree follows
 await pg.evaluate(()=>{pageSize=50;currentPage=1;renderList();}); await pg.waitForTimeout(300);
 const keys=await pg.evaluate(()=>Array.from(document.querySelectorAll('.kpi-card')).map(c=>[c.dataset.key,findPlacement(c.dataset.key).part+'||'+findPlacement(c.dataset.key).category]));
 const target=keys.find(k=>k[1]!==keys[0][1]); console.log('scroll to card in other category',JSON.stringify(target));
 await pg.evaluate(k=>document.getElementById('card-'+cssId(k)).scrollIntoView({block:'start'}),target[0]); await pg.waitForTimeout(700);
 st=await state(); console.log('after scroll:',JSON.stringify(st)); console.log('dbg',await pg.evaluate(()=>({y:scrollY,vis:Array.from(visibleCards),nCards:document.querySelectorAll('.kpi-card').length,h:document.body.scrollHeight})));
 assert(st.openCats.length===1&&st.openCats[0]===target[1],'tree focused on scrolled category'); assert(st.inView===target[0]);
 const vis=await pg.evaluate(k=>{const p=document.getElementById('panel-tree'),i=Array.from(p.querySelectorAll('.kpi-link-item')).find(e=>e.dataset.key===k);const pr=p.getBoundingClientRect(),ir=i.getBoundingClientRect();return ir.top>=pr.top&&ir.bottom<=pr.bottom},target[0]); console.log('in-view item visible in panel:',vis); assert(vis);
 await pg.screenshot({path:'ui25-sync.png'});
 // manual browse: open 2 parts by clicking headers -> both stay open; sync paused while hovering
 const hdrs=pg.locator('.accordion-part:not(.open) > .accordion-header'); await hdrs.first().click(); await pg.locator('.accordion-part:not(.open) > .accordion-header').first().click(); await pg.waitForTimeout(200);
 st=await state(); console.log('manual browse:',st.openParts); assert(st.openParts.length>=3,'manual opens accumulate');
 // pick a KPI from the tree -> only its category open
 const item=pg.locator('.accordion-part.open .category-header').first(); await item.click(); await pg.waitForTimeout(800);
 st=await state(); console.log('after selecting:',JSON.stringify(st)); assert(st.openParts.length===1&&st.openCats.length===1);
 // collapse all
 await pg.click('.tree-collapse'); st=await state(); assert(st.openParts.length===0); console.log('collapse ok');
 // status filter does not expand everything
 await pg.mouse.move(1300,500); await pg.click('#tree-filterbar [data-status="yellow"]'); await pg.waitForTimeout(400); st=await state(); console.log('with filter:',st.openParts.length,'open parts'); assert(st.openParts.length<=1);
 // highlight style: only one strong item
 console.log('in-view count',await pg.locator('.kpi-link-item.in-view').count());
 console.log('errors',pg._errs); await pg.close();
 // mobile: no tree scroll-sync
 pg=await mkpage(390,800); await login(pg,'อรทัย','secret99'); await pg.waitForTimeout(400);
 const before=await pg.evaluate(()=>document.getElementById('panel-tree').scrollTop); await pg.evaluate(()=>window.scrollBy(0,3000)); await pg.waitForTimeout(600);
 const m=await pg.evaluate(()=>({st:document.getElementById('panel-tree').scrollTop,open:document.querySelectorAll('.accordion-part.open').length})); console.log('mobile',before,JSON.stringify(m)); assert(m.st===before);
 console.log('mobile errors',pg._errs); await pg.close(); await b.close(); console.log('UI25 OK');
})();
