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

 // server-side: staff adds a KPI that is SAR + personal and lives in Part I and a personal category
 const st=h.ctx.authenticateUser('มานี','secret99');
 const base={years:[null,null,null,null,null],months:Array(12).fill(null)};
 let r=h.ctx.addIndicator(st.token,2570,{...base,name:'ตัวชี้วัดสองหมวด',target:'> 80',levels:['รายบุคคล','SAR'],department:'ทดสอบ',cats:[{part:'Part I',category:'I-9 ทดสอบ'},{part:'หมวดมานี',category:'งานส่วนตัว'}]}); assert(r.success,JSON.stringify(r)); const id=r.newId;
 let pg=await mkpage(); await login(pg,'มานี','secret99');
 const placements=await pg.evaluate(id=>placementsOf(globalDatabase.find(k=>k.id===id)).map(k=>k.part+'›'+k.category),id); console.log('placements',placements); assert(placements.length===2);
 await pg.evaluate(()=>{pageSize=50;currentPage=1;renderList();});
 // one card per view (hosp / unit), tree links with 🔗
 for(const v of ['hosp','unit']){ await pg.evaluate(v=>{treeView=v;currentPage=1;renderTree();renderList();},v); await pg.waitForTimeout(250);
   const n=await pg.evaluate(id=>document.querySelectorAll('.kpi-card[data-id="'+id+'"]').length,id); const l=await pg.evaluate(id=>Array.from(document.querySelectorAll('.kpi-link-item')).filter(e=>e.dataset.id===id).map(e=>e.querySelector('.multi-cat')?1:0),id);
   console.log(v,'cards',n,'tree links',l); assert(n===1&&l.length===1&&l[0]===1); }
 // edit the card in unit view
 await pg.evaluate(id=>goToKpi(id),id); await pg.waitForTimeout(400);
 console.log('badge:',await pg.evaluate(id=>document.querySelector('.kpi-card[data-id="'+id+'"] .multi-badge').innerText,id));
 const key2=await pg.evaluate(id=>document.querySelector('.kpi-card[data-id="'+id+'"]').dataset.key,id);
 await pg.evaluate(([id,k])=>startEditNow(id,k),[id,key2]); await pg.waitForTimeout(300);
 const eds=await pg.evaluate(id=>Array.from(document.querySelectorAll('.kpi-card[data-id="'+id+'"]')).map(c=>c.classList.contains('editing')),id); console.log('editing flags',eds); assert(eds.join()==='true');
 assert(await pg.locator('#ed-cats .cat-row').count()===2);
 const locked=await pg.evaluate(()=>Array.from(document.querySelectorAll('#ed-cats .cat-row')).map(r=>r.dataset.locked)); console.log('locked rows',locked); assert(locked.join()==='1,0');
 await pg.fill('#ed-name','แก้ที่การ์ดที่สอง');
 await pg.click('button:has-text("เพิ่มหมวด")'); const rows=pg.locator('#ed-cats .cat-row'); await rows.nth(2).locator('.cat-part').fill('หมวดมานี'); await rows.nth(2).locator('.cat-cat').fill('อีกหมวด');
 await pg.screenshot({path:'ui20-edit.png'});
 // try to add Part II -> blocked client-side
 await pg.click('button:has-text("เพิ่มหมวด")'); await rows.nth(3).locator('.cat-part').fill('Part II'); await rows.nth(3).locator('.cat-cat').fill('x');
 await pg.click('button:has-text("บันทึกข้อมูล")'); await pg.waitForTimeout(300);
 console.log('Part II alert:',(await pg.innerText('#modal-alert')).replace(/\n/g,' / ').slice(0,160)); await pg.click('#modal-alert button');
 await pg.locator('#ed-cats .cat-row').nth(3).locator('.cat-del').click();
 await pg.click('button:has-text("บันทึกข้อมูล")'); await pg.waitForTimeout(800);
 const names=await pg.evaluate(id=>Array.from(document.querySelectorAll('.kpi-card[data-id="'+id+'"] .kpi-card-title')).map(e=>e.innerText.trim()),id); console.log('card titles',names); assert(names.length===1&&names.every(t=>t.includes('แก้ที่การ์ดที่สอง')));
 console.log('tree parts:',await pg.evaluate(()=>Array.from(document.querySelectorAll('.accordion-header > span:first-child')).map(e=>e.innerText)));
 console.log('count line after:',(await pg.innerText('#tree-count')).replace(/\n/g,' '));
 await pg.screenshot({path:'ui20-multi.png'});
 // cursor + lock tooltip: locked past-year result cells (source sheet)
 await pg.evaluate(()=>{const s=document.getElementById('fy-select'); s.value='2570'; onFiscalYearChange(s);}); await pg.waitForTimeout(800);
 await pg.evaluate(()=>{const k=globalDatabase.find(k=>k.canEditResults&&k.lockedYears&&k.lockedYears.some(Boolean))||globalDatabase.find(k=>k.mine); treeView=VIEWS.find(v=>viewPlacements(k,v).length); renderTree(); renderList(); startEditNow(k.id);}); await pg.waitForTimeout(300);
 await pg.locator('.lock-wrap input').first().scrollIntoViewIfNeeded(); await pg.waitForTimeout(1200); const box=await pg.locator('.lock-wrap input').first().boundingBox(); await pg.evaluate(()=>{window.__ev=[];['mouseover','mouseout','scroll'].forEach(t=>document.addEventListener(t,e=>window.__ev.push(t+':'+(e.target.className||e.target.nodeName)+'>'+(e.relatedTarget&&(e.relatedTarget.className||e.relatedTarget.nodeName))),true));}); await pg.mouse.move(box.x+box.width/2-3,box.y+box.height/2); await pg.mouse.move(box.x+box.width/2,box.y+box.height/2); await pg.waitForTimeout(300); console.log('events',await pg.evaluate(()=>window.__ev.slice(0,12)), box);
 const tip=await pg.evaluate(()=>({txt:document.getElementById('lock-tip').innerText,disp:getComputedStyle(document.getElementById('lock-tip')).display}));
 console.log('tooltip:',JSON.stringify(tip)); assert(tip.disp==='block'&&/อ้างอิงจากชีตปีงบนั้น/.test(tip.txt));
 await pg.screenshot({path:'ui20-tip.png'});
 const cur=await pg.evaluate(()=>getComputedStyle(document.querySelector('#ed-y0')).cursor); console.log('input cursor',cur);
 await pg.mouse.move(5,5); await pg.waitForTimeout(200); assert((await pg.evaluate(()=>getComputedStyle(document.getElementById('lock-tip')).display))==='none');
 console.log('errors',pg._errs); await pg.close();
 // progress shows 1 row, exec sees only Part I placement; admin PDF dedupe
 pg=await mkpage(); await login(pg,'ผอ.','secret99');
 const ex=await pg.evaluate(id=>{const k=globalDatabase.find(k=>k.id===id);return {cats:k.cats,n:getOrderedKpis().filter(p=>p.id===id).length}},id); console.log('exec view',JSON.stringify(ex)); assert(ex.cats.length===1&&ex.n===1);
 await pg.close();
 pg=await mkpage(); await login(pg,'Admin','Admin11038');
 const pdf=await pg.evaluate(id=>{rpt.loaded=true;rpt.unchecked=new Set();const html=buildPrintHtml({table:true,chart:false,detail:false,source:false,owner:false},true);return {count:uniqueById(rptChosen()).length,times:(html.match(/แก้ที่การ์ด/g)||[]).length}},id); console.log('pdf',JSON.stringify(pdf)); assert(pdf.times===2,'printed once'); // table + month table = 2 rows for one print
 await pg.evaluate(()=>{switchMenu('progress')}); await pg.waitForTimeout(400);
 const prog=await pg.evaluate(id=>({rows:globalProgressData.filter(x=>x.id===id).length}),id); assert(prog.rows===1); console.log('progress rows for KPI',prog.rows);
 console.log('admin errors',pg._errs); await pg.close();
 await b.close(); console.log('UI20 OK');
})();
