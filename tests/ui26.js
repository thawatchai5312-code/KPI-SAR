process.env.MIGRATE='1';
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness');const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = defaultListMode(); tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
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

 const C=h.ctx; const a=C.authenticateUser('Admin','Admin11038');
 // give one KPI QA level + nursing level for มานี (PCU) and one two-unit KPI
 const S=h.sheets['ปีงบ 2570'].d; C.getAllData(a.token,2570);
 const mineIds=C.getAllData(C.authenticateUser('มานี','secret99').token,2570).data.filter(k=>k.mine).map(k=>k.id);
 const qaRow=S.find(r=>r[0]===mineIds[0]); qaRow[28]='หน่วยงาน, QA-หน่วยงาน, SAR';
 const nurseRow=S.find(r=>r[0]===mineIds[1]); nurseRow[28]='QA-หน่วยงาน, SAR';
 // มุมมอง QA = หมวด "<หน่วย> QA" (ผูกกับระดับ QA)
 [qaRow,nurseRow].forEach(r=>{r[36]=(r[36]?r[36]+'\n':'')+'PCU QA | มิติที่ 2 ด้านคุณภาพการให้บริการ';});
 const state=pg=>pg.evaluate(()=>({view:treeView,tabs:Array.from(document.querySelectorAll('.view-tab')).map(b=>b.dataset.view+':'+b.querySelector('.vt-count').innerText+(b.classList.contains('active')?'*':'')),section:(document.querySelector('.tree-section')||{}).innerText,parts:Array.from(document.querySelectorAll('.accordion-part')).map(p=>p.dataset.part),cards:document.querySelectorAll('.kpi-card').length,uniq:new Set(Array.from(document.querySelectorAll('.kpi-card')).map(c=>c.dataset.id)).size,pager:(document.querySelector('.pager-info')||{}).innerText,count:document.getElementById('tree-count').innerText.split('\n')[0]}));
 // ---- staff: default = unit
 let pg=await mkpage(); await login(pg,'มานี','secret99');
 let st=await state(pg); console.log('staff default',JSON.stringify(st)); assert(st.view==='unit'&&st.cards===st.uniq);
 const tabs=Object.fromEntries(st.tabs.map(t=>t.replace('*','').split(':'))); 
 // each view: cards unique; pager = unique count
 for(const v of ['hosp','qa','unit']){ await pg.click('.view-tab[data-view="'+v+'"]'); await pg.waitForTimeout(400); const s=await state(pg); console.log(v,JSON.stringify({tabs:s.tabs,section:s.section,parts:s.parts,cards:s.cards,pager:s.pager,count:s.count}));
   assert(s.view===v&&s.cards===s.uniq); const n=Number(tabs[v]); if(n>0) assert(s.pager.includes('จาก '+n+' '),'pager equals tab count '+s.pager+' vs '+n); }
 // QA view holds the two flagged KPIs grouped by unit PCU
 await pg.click('.view-tab[data-view="qa"]'); await pg.waitForTimeout(300); const qa=await state(pg); assert(qa.parts.includes('PCU QA')&&Number(tabs.qa)===2,'qa view has 2 KPIs under PCU: '+JSON.stringify(qa));
 await pg.screenshot({path:'ui26-qa.png'});
 // click tree item in unit view whose KPI also in hosp: card exists once; goToKpi from progress page switches view
 await pg.click('.view-tab[data-view="unit"]'); await pg.waitForTimeout(300);
 const id=await pg.evaluate(()=>globalDatabase.find(k=>k.mine&&k.cats.length>1).id);
 await pg.click('.view-tab[data-view="hosp"]'); await pg.waitForTimeout(300);
 await pg.evaluate(id=>gotoKpi(id,false),id); await pg.waitForTimeout(600); st=await state(pg); console.log('after goto',st.view,st.cards);
 assert(await pg.evaluate(id=>!!document.querySelector('.kpi-card[data-id="'+id+'"]'),id));
 // switching to a view that lacks the KPI
 await pg.click('.view-tab[data-view="unit"]'); await pg.waitForTimeout(300);
 const onlyHosp=await pg.evaluate(()=>{const k=globalDatabase.find(k=>k.mine&&!k.cats.some(c=>!isCorePart(c.part))); return k&&k.id}); console.log('only-hosp kpi',onlyHosp);
 if(onlyHosp){ await pg.evaluate(id=>gotoKpi(id,false),onlyHosp); await pg.waitForTimeout(500); st=await state(pg); assert(st.view==='hosp','auto switch to hosp'); }
 // empty state in qa view for a staff without QA KPI
 console.log('errors',pg._errs); await pg.close();
 // ---- admin default hosp; exec default hosp with tabs present
 for(const [u,p] of [['Admin','Admin11038'],['ผอ.','11038']]){
   pg=await mkpage(); await login(pg,u,u==='ผอ.'?'secret99':p);
   st=await state(pg); console.log(u,'default',st.view,JSON.stringify(st.tabs)); assert(st.view==='hosp'&&st.tabs.length===3);
   if(u==='ผอ.'){ await pg.click('.view-tab[data-view="unit"]'); await pg.waitForTimeout(300); console.log('exec unit view message:',(await pg.innerText('#accordion-tree-container')).replace(/\n/g,' | ').slice(0,120)); }
   console.log(u,'errors',pg._errs); await pg.close(); }
 // mobile: panel not nested-scroll
 pg=await mkpage(390,844); await login(pg,'มานี','secret99'); const m=await pg.evaluate(()=>{const p=document.getElementById('panel-tree');const cs=getComputedStyle(p);return {max:cs.maxHeight,ov:cs.overflowY,w:document.documentElement.scrollWidth}}); console.log('mobile panel',JSON.stringify(m)); assert(m.ov==='visible'&&m.max==='none'&&m.w<=391);
 await pg.screenshot({path:'ui26-mobile.png'}); console.log('mobile errors',pg._errs); await pg.close();
 await b.close(); console.log('UI26 OK');
})();
