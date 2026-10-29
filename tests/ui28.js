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


 const C=h.ctx;
 const state=pg=>pg.evaluate(()=>({tab:currentTab,levels:appliedFilters.scope,view:treeView,orient:rpt.orient,count:document.getElementById('rp-count')&&document.getElementById('rp-count').innerText,unchecked:rpt.unchecked.size,blocks:document.querySelectorAll('#rp-paper .pr-block').length,rows:document.querySelectorAll('#rp-paper tbody tr').length,more:document.getElementById('rp-more').innerText.slice(0,80),paperW:document.getElementById('rp-paper').getBoundingClientRect().width,cls:document.getElementById('rp-paper').className,zoom:document.getElementById('rp-paper').style.zoom}));
 // ---- staff: open page, defaults
 let pg=await mkpage(1440,900); await login(pg,'มานี','secret99');
 await pg.click('#menu-report-btn'); await pg.waitForSelector('#rp-cat-list label'); await pg.waitForTimeout(500);
 let st=await state(pg); console.log('open',JSON.stringify(st)); assert(st.tab==='report'&&st.levels==='mine'&&st.blocks>0);
 assert(await pg.evaluate(()=>document.getElementById('menu-report-btn').classList.contains('active')&&!document.getElementById('menu-home-btn').classList.contains('active')));
 // nav order
 const order=await pg.evaluate(()=>Array.from(document.querySelectorAll('.nav-bar .nav-item')).map(e=>e.innerText.trim().slice(0,10))); console.log(order.join(' | ')); 
 await pg.screenshot({path:'ui28-open.png'});
 // uncheck a category -> preview count changes
 await pg.click('#rp-view-tabs .view-tab[data-view="hosp"]'); await pg.waitForTimeout(600); st=await state(pg); console.log('hosp view on report',JSON.stringify({view:st.view,blocks:st.blocks,count:st.count})); assert(st.view==='hosp'&&st.blocks>0);
 const before=st.blocks; 
 await pg.click('#rp-side .rpt-bar button:nth-child(2)'); await pg.waitForTimeout(500);
 assert(await pg.evaluate(()=>document.getElementById('rp-paper').innerText.includes('ยังไม่ได้เลือกตัวชี้วัด')),'cleared -> empty message');
 await pg.evaluate(()=>{document.querySelector('.rp-cat').click();}); await pg.waitForTimeout(600);
 let st2=await state(pg); console.log('one cat',JSON.stringify(st2), await pg.evaluate(()=>JSON.stringify({view:treeView,groups:rptGroups(),un:Array.from(rpt.unchecked)}))); assert(st2.blocks>0&&st2.blocks<=before&&st2.unchecked>=1);
 await pg.click('#rp-side .rpt-bar button:nth-child(1)'); await pg.waitForTimeout(600); st2=await state(pg); assert(st2.unchecked===0&&st2.blocks===before);
 await pg.evaluate(()=>{document.querySelectorAll('.rp-cat')[0].click();}); await pg.waitForTimeout(500);
 // orientation switch
 await pg.click('input[name="rp-orient"][value="portrait"]'); await pg.waitForTimeout(500); st2=await state(pg); assert(st2.cls==='portrait'&&st2.orient==='portrait');
 // option toggle: chart off => no pr-chart
 await pg.click('#rp-opt-chart'); await pg.waitForTimeout(500); assert(await pg.evaluate(()=>document.querySelectorAll('#rp-paper .pr-chart').length)===0);
 await pg.screenshot({path:'ui28-portrait.png'});
 // prefs saved server-side per user
 await pg.waitForTimeout(1200);
 let saved=C.getReportPrefs(C.authenticateUser('มานี','secret99').token); console.log('saved',JSON.stringify(saved)); assert(saved.prefs&&saved.prefs.orient==='portrait'&&saved.prefs.opts.chart===false&&saved.prefs.unchecked.length===1);
 // ปุ่ม Export PDF มุมขวาบนถูกเอาออกแล้ว — พิมพ์จากปุ่มในแถบซ้ายของหน้าสรุปรายงาน (intercept print)
 await pg.evaluate(()=>{window.__printed=0; window.print=()=>{window.__printed++}});
 assert(await pg.evaluate(()=>!document.getElementById('btn-export-pdf')&&typeof exportPdfClick==='undefined'),'top Export PDF button removed');
 await pg.click('#rp-side button:has-text("Export PDF")'); await pg.waitForTimeout(900);
 assert(await pg.evaluate(()=>window.__printed)===1,'export from report page sidebar prints directly');
 const pr=await pg.evaluate(()=>({blocks:document.querySelectorAll('#print-root .pr-block').length,style:document.getElementById('print-page-style').textContent,tables:document.querySelectorAll('#print-root .pr-table').length})); console.log('print',JSON.stringify(pr)); assert(pr.style.includes('portrait')&&pr.tables>0);
 // กลับหน้าแรกแล้วเข้าสรุปรายงานด้วยเมนู: ตัวกรองชุดเดิม (ไม่มี modal)
 await pg.click('#menu-home-btn'); await pg.waitForTimeout(300);
 assert(await pg.evaluate(()=>!document.getElementById('modal-pdf')),'modal removed');
 assert(await pg.evaluate(()=>/^📊 หน้าแรก$/.test(document.getElementById('menu-home-btn').textContent.trim())&&/^📋 ติดตามงาน$/.test(document.getElementById('menu-progress-btn').textContent.trim())),'menu labels without English');
 await pg.click('#menu-report-btn'); await pg.waitForTimeout(700);
 assert(await pg.evaluate(()=>currentTab)==='report','report menu opens report page');
 st=await state(pg); assert(st.orient==='portrait'&&st.unchecked===1&&st.blocks>0);
 console.log('errors',pg._errs); await pg.close();
 // ---- same user logs in again (fresh page): remembered
 pg=await mkpage(1440,900); await login(pg,'มานี','secret99'); await pg.click('#menu-report-btn'); await pg.waitForSelector('#rp-cat-list label'); await pg.waitForTimeout(500);
 st=await state(pg); console.log('relogin',JSON.stringify(st)); assert(st.orient==='portrait'&&st.unchecked===1&&st.cls==='portrait');
 await pg.close();
 // ---- other user not affected
 pg=await mkpage(1440,900); await login(pg,'อรทัย','secret99'); await pg.click('#menu-report-btn'); await pg.waitForSelector('#rp-cat-list label'); await pg.waitForTimeout(500);
 st=await state(pg); console.log('other user',JSON.stringify(st)); assert(st.orient==='landscape'&&st.unchecked===0);
 await pg.close();
 // ---- admin: scope all, large set, paged preview
 pg=await mkpage(1440,900); await login(pg,'Admin','Admin11038'); await pg.click('#menu-report-btn'); await pg.waitForSelector('#rp-cat-list label'); await pg.waitForTimeout(800);
 st=await state(pg); console.log('admin',JSON.stringify(st)); assert(st.levels==='all'&&st.blocks>=10);
 const t0=await pg.evaluate(()=>document.querySelector('#rp-paper .pr-kpi-title').textContent); await pg.evaluate(()=>rptGoPage(2)); await pg.waitForTimeout(800); st=await state(pg); const t1=await pg.evaluate(()=>document.querySelector('#rp-paper .pr-kpi-title').textContent); console.log('page 2',st.blocks,t0.slice(0,20),'→',t1.slice(0,20)); assert(st.blocks>=1&&t1!==t0,'paged preview');
 // clear all -> empty message, select all back
 await pg.click('#rp-side .rpt-bar button:nth-child(2)'); await pg.waitForTimeout(600); assert(await pg.evaluate(()=>document.getElementById('rp-paper').innerText.includes('ยังไม่ได้เลือกตัวชี้วัด')));
 // export with nothing selected -> alert not print
 await pg.evaluate(()=>{window.__printed=0; window.print=()=>{window.__printed++}}); await pg.click('#rp-side > button.btn-primary'); await pg.waitForTimeout(400); assert(await pg.evaluate(()=>window.__printed)===0&&await pg.evaluate(()=>getComputedStyle(document.getElementById('modal-alert')).display)==='flex');
 console.log('admin errors',pg._errs); await pg.close();
 // ---- mobile
 pg=await mkpage(390,844); await login(pg,'มานี','secret99'); await pg.click('#menu-report-btn'); await pg.waitForSelector('#rp-cat-list label'); await pg.waitForTimeout(600);
 st=await state(pg); const mw=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,tog:getComputedStyle(document.querySelector('.rp-toggle')).display})); console.log('mobile',JSON.stringify(st),JSON.stringify(mw)); assert(mw.sw<=391&&mw.tog==='block'&&Number(st.zoom)<1);
 await pg.screenshot({path:'ui28-mobile.png'}); console.log('mobile errors',pg._errs); await pg.close();
 await b.close(); console.log('UI28 OK');
})();
