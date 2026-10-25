// anti-hang: paged report preview (10/30/50, numbers continuous), chunked home table (first batch fast, rest in background, ensure-render on demand),
// no heavy home re-render while other tabs are open, report-prefs timeout fallback, continuous numbering in table + tree, menu button colours
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const ad=U.find(r=>r[2]==='admin');ad[1]=C.hashPassword_('pw123456');ad[4]='FALSE';
const tA=C.createSession_(ad[0],ad[1]);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{window.__delay={};window.__drop={};function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>new Promise(r=>setTimeout(r,window.__delay[fn]||0)).then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForSelector('#kpi-table');

 // ---- 1. home table: first batch quickly, the rest in background, nothing lost
 const first=await pg.evaluate(()=>({rows:document.querySelectorAll('tr.kpi-row').length,pending:tblPending.length,total:uniqueById(getOrderedKpis()).length}));
 console.log('first batch',JSON.stringify(first));
 await pg.waitForFunction(()=>tblPending.length===0,null,{timeout:20000});
 const done=await pg.evaluate(()=>({rows:document.querySelectorAll('tr.kpi-row').length,total:uniqueById(getOrderedKpis()).length,ids:new Set([...document.querySelectorAll('tr.kpi-row')].map(r=>r.dataset.key)).size,cats:document.querySelectorAll('tr.tbl-cat').length}));
 assert(done.rows===done.total&&done.ids===done.total,JSON.stringify(done));
 // chunking really defers rows (unit view = 666 rows)
 await pg.evaluate(()=>{setScopeFilter('all');setTreeView('unit')});
 const ch=await pg.evaluate(()=>{renderList();return {rows:document.querySelectorAll('tr.kpi-row').length,pending:tblPending.length,total:uniqueById(getOrderedKpis()).length}});
 assert(ch.rows<=60&&ch.pending===ch.total-ch.rows&&ch.pending>400,'first batch only: '+JSON.stringify(ch));console.log('unit first batch',ch.rows,'pending',ch.pending);
 await pg.waitForFunction(()=>tblPending.length===0,null,{timeout:20000});
 // ---- 2. continuous numbering in table + left tree (hosp: main only; unit: with subs)
 for(const view of ['hosp','unit']){
   await pg.evaluate(v=>{setScopeFilter('all');setTreeView(v)},view);await pg.waitForFunction(()=>tblPending.length===0,null,{timeout:20000});await pg.waitForTimeout(300);
   const nums=await pg.evaluate(()=>[...document.querySelectorAll('tr.kpi-row')].map(r=>({id:r.dataset.id,no:r.querySelector('.c-no').textContent.trim()})));
   let main=0;nums.forEach((n,i)=>{const p=n.no.replace(/\.$/,'').split('.');if(p.length===1){assert.strictEqual(+p[0],++main,view+' main seq at '+i+' '+n.no)}else assert(nums.slice(0,i).some(x=>x.no.replace(/\.$/,'')===p.slice(0,-1).join('.')),view+' sub '+n.no+' has parent before')});
   assert(main>30&&new Set(nums.map(n=>n.no)).size===nums.length,view+' unique numbers');
   // left tree shows the same number as the table for the same KPI
   await pg.evaluate(()=>{document.querySelectorAll('.accordion-part,.accordion-cat').forEach(e=>e.classList.add('open'));openParts.clear();openCats.clear();getOrderedKpis().forEach(p=>{openParts.add(p.part);openCats.add(p.part+'||'+p.category)});renderTree()});
   const tree=await pg.evaluate(()=>[...document.querySelectorAll('.kpi-link-item')].slice(0,400).map(el=>({id:el.dataset.id,t:el.textContent.trim().split(' ')[0]})));
   const m=new Map(nums.map(n=>[n.id,n.no.replace(/\.$/,'')]));let checked=0;
   tree.forEach(t=>{if(m.has(t.id)){assert.strictEqual(t.t.replace(/\.$/,'').replace(/[^\d.]/g,''),m.get(t.id),view+' tree vs table '+t.t+' '+m.get(t.id));checked++}});
   assert(checked>20,view+' checked '+checked);
   console.log(view,'rows',nums.length,'main',main,'subs',nums.length-main,'tree checked',checked);
 }
 // card mode keeps per-category numbers
 await pg.evaluate(()=>{setTreeView('hosp')});await pg.click('#mode-switch button[data-mode=card]');await pg.waitForSelector('.kpi-card');
 const cardNos=await pg.evaluate(()=>[...document.querySelectorAll('.kpi-card .kpi-card-title')].slice(0,40).map(e=>e.textContent.trim().split(' ')[0]));
 assert(cardNos.filter(n=>n==='1.').length>1,'card numbering restarts per category: '+cardNos.slice(0,12).join(' '));
 await pg.click('#mode-switch button[data-mode=table]');await pg.waitForSelector('#kpi-table');await pg.waitForFunction(()=>tblPending.length===0);

 // ---- 3. ensure-render on demand: go to a late row right after switching view
 await pg.evaluate(()=>{setTreeView('unit')});await pg.waitForSelector('#kpi-table');
 const lateId=await pg.evaluate(()=>{const l=uniqueById(getOrderedKpis());return l[l.length-3].id});
 const early=await pg.evaluate(()=>({pending:tblPending.length}));
 await pg.evaluate(id=>{selectKpi(id)},lateId);await pg.waitForTimeout(1500);
 assert(await pg.evaluate(id=>!![...document.querySelectorAll('tr.kpi-row')].find(r=>r.dataset.id===id),lateId),'late row rendered on demand');
 await pg.waitForFunction(()=>tblPending.length===0,null,{timeout:20000});
 // edit a late row right after a re-render
 await pg.evaluate(()=>{setScopeFilter('mine');setScopeFilter('all')});
 await pg.evaluate(id=>{goToKpi(id);if(globalDatabase.find(k=>k.id===id).canEditResults)startEditNow(id)},lateId);await pg.waitForTimeout(600);
 assert(await pg.evaluate(()=>!!document.querySelector('tr.kpi-row.editing')),'edit on a not-yet-rendered row');await pg.evaluate(()=>exitEdit());

 // ---- 4. report page: paged preview
 await pg.evaluate(()=>{setTreeView('hosp')});await pg.waitForFunction(()=>tblPending.length===0);
 await pg.click('#menu-report-btn');await pg.waitForSelector('#rp-pager-top .pager');
 const r1=await pg.evaluate(()=>({blocks:document.querySelectorAll('#rp-paper .pr-block').length,rows:document.querySelectorAll('#rp-paper table.pr-table')[0].querySelectorAll('tbody tr').length,size:rpt.size,sel:document.querySelector('#rp-pager-top .pager-size select').value,info:document.querySelector('#rp-pager-top .pager-info').textContent.trim(),bottom:!!document.querySelector('#rp-more .pager'),total:rptRowCount()}));
 assert(r1.size===10&&r1.sel==='10'&&r1.blocks<=10&&r1.bottom&&/แสดง 1–10 จาก/.test(r1.info),JSON.stringify(r1));console.log('report page 1',r1.info);
 // numbers on page 2 continue (full-report numbers, not restarted)
 const full=await pg.evaluate(()=>{const d=document.createElement('div');d.innerHTML=buildPrintHtmlRaw(rpt.opts,true,0);return [...d.querySelectorAll('.pr-kpi-title')].map(x=>thaiDigitsHtml(x.textContent.split(' ')[0]))});
 await pg.click('#rp-pager-top .page-btn:has-text("2")');await pg.waitForTimeout(500);
 const p2=await pg.evaluate(()=>[...document.querySelectorAll('#rp-paper .pr-kpi-title')].map(x=>x.textContent.split(' ')[0]));
 assert.deepStrictEqual(p2,full.slice(10,20).map(x=>x),'page 2 numbers = full report numbers 11..20 '+p2.join(','));
 await pg.selectOption('#rp-pager-top .pager-size select','50');await pg.waitForTimeout(800);
 const r50=await pg.evaluate(()=>({blocks:document.querySelectorAll('#rp-paper .pr-block').length,page:rpt.page,size:rpt.size}));assert(r50.size===50&&r50.page===1&&r50.blocks<=50&&r50.blocks>10,JSON.stringify(r50));
 await pg.selectOption('#rp-pager-top .pager-size select','30');await pg.waitForTimeout(600);assert((await pg.evaluate(()=>rpt.size))===30);
 // render time of one page (50) stays small
 const tPage=await pg.evaluate(()=>{rpt.size=50;rpt.page=1;const t=performance.now();rptRenderPreview();return Math.round(performance.now()-t)});console.log('render 50 rows ms',tPage);assert(tPage<4000,'page render too slow '+tPage);
 // filter change resets to page 1; Export builds ALL rows
 await pg.evaluate(()=>{rpt.size=10;rpt.page=3;rptRenderPreview();rptPreviewSoon()});await pg.waitForTimeout(600);assert((await pg.evaluate(()=>rpt.page))===1,'filter/selection change → page 1');
 assert(await pg.evaluate(()=>{const d=document.createElement('div');d.innerHTML=buildPrintHtml(rpt.opts,true);return d.querySelectorAll('.pr-block,.pr-ref').length===rptRowCount()}),'export has every row');
 // live refresh on report page keeps page + scroll and is cheap
 await pg.evaluate(()=>{rpt.size=10;rpt.page=2;rptRenderPreview()});
 const k0=C.getAllData(tA,2570).data.find(k=>k.canEditResults&&k.canEditDetails);const cur=k0;C.saveKpi(tA,2570,{id:k0.id,target:'live-'+Date.now(),baseRev:cur.rev});
 await pg.evaluate(()=>{window.scrollTo(0,300)});await pg.evaluate(()=>livePoll());await pg.waitForTimeout(900);
 const lv=await pg.evaluate(()=>({page:rpt.page,y:Math.round(scrollY),blocks:document.querySelectorAll('#rp-paper .pr-block').length}));assert(lv.page===2&&lv.blocks<=10,JSON.stringify(lv));

 // ---- 5. nothing heavy happens on the home list while on the report page; home re-renders once on return
 await pg.evaluate(()=>{window.__c={list:0,table:0};const a=renderList,b2=renderTable;window.renderList=function(){window.__c.list++;return a.apply(this,arguments)};window.renderTable=function(){window.__c.table++;return b2.apply(this,arguments)}});
 const k1=C.getAllData(tA,2570).data.filter(k=>k.canEditResults&&k.canEditDetails)[1];
 const add=C.addIndicator(tA,2570,{name:'งานระหว่างอยู่หน้ารายงาน',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['SAR'],owner:ad[0],cats:[{part:'Part I',category:'I-1 การนำ'}]});assert(add.success,add.message);
 await pg.evaluate(()=>livePoll());await pg.waitForTimeout(900);
 assert((await pg.evaluate(()=>window.__c.list))===0,'no home list render while on report page');
 const tb=Date.now();await pg.click('#menu-home-btn');await pg.waitForSelector('#kpi-table');await pg.waitForTimeout(100);
 const back=await pg.evaluate(()=>({list:window.__c.list,rows:document.querySelectorAll('tr.kpi-row').length}));assert(back.list===1&&back.rows>0,JSON.stringify(back));console.log('home re-render once on return; first rows after',Date.now()-tb,'ms');
 C.deleteIndicator(tA,2570,'Part I',add.newId);

 // ---- 6. report-prefs timeout: slow server must not hang the page
 await pg.evaluate(()=>{rptReset();rptControlsBuilt=false;window.__delay.getReportPrefs=15000});
 const t6=Date.now();await pg.click('#menu-report-btn');await pg.waitForTimeout(500);assert(await pg.isVisible('#busy-overlay'),'busy while waiting');
 await pg.waitForSelector('#busy-overlay',{state:'hidden',timeout:12000});const waited=Date.now()-t6;assert(waited>7000&&waited<10500,'fallback after ~8s '+waited);
 assert(await pg.evaluate(()=>rpt.loaded&&document.querySelectorAll('#rp-paper .pr-block').length>0),'preview shown with default options');console.log('prefs fallback after',waited,'ms');
 await pg.evaluate(()=>{window.__delay.getReportPrefs=0});await pg.waitForTimeout(8000); // late reply must not break anything
 assert(await pg.evaluate(()=>!document.getElementById('busy-overlay').classList.contains('show')));

 // ---- 7. menu button colours
 await pg.click('#menu-home-btn');await pg.waitForTimeout(300);
 const col=await pg.evaluate(()=>['menu-home-btn','menu-report-btn','menu-progress-btn'].map(id=>{const e=document.getElementById(id),c=getComputedStyle(e);return {id,active:e.classList.contains('active'),bg:c.backgroundColor,bd:c.borderTopColor,color:c.color,h:Math.round(e.getBoundingClientRect().height)}}));
 const act=col.find(c=>c.active),inact=col.filter(c=>!c.active);
 assert(inact.every(c=>c.bg!=='rgba(0, 0, 0, 0)'&&c.bg!==act.bg&&c.bd!=='rgba(0, 0, 0, 0)'),JSON.stringify(col));assert(new Set(col.map(c=>c.h)).size===1,'same height active/inactive '+JSON.stringify(col.map(c=>c.h)));console.log('menu colours',JSON.stringify(col.map(c=>[c.id,c.bg])));
 assert(errs.length===0,errs.join());await b.close();console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
