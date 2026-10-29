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

 // ---- staff
 let pg=await mkpage(); await login(pg,'มานี','secret99');
 assert(await pg.locator('#tree-search').count()===0); console.log('search box removed');
 assert(await pg.isVisible('#btn-add-kpi')); console.log('add button visible for staff');
 // progress follows default
 await pg.click('#menu-progress-btn'); await pg.waitForTimeout(400);
 const pgRows=await pg.evaluate(()=>globalProgressData.length), mineN=await pg.evaluate(()=>globalDatabase.filter(k=>k.isOwner).length);
 const onScope=()=>pg.evaluate(()=>(document.querySelector('#pg-scope .fb-btn.on')||{}).dataset.scope);
 console.log('progress rows',pgRows,'mine',mineN,'scope',await onScope()); assert(pgRows===mineN&&await onScope()==='mine');
 await pg.click('#pg-scope [data-scope="all"]'); await pg.waitForTimeout(300);
 const all=await pg.evaluate(()=>globalProgressData.length); console.log('scope all',all); assert(all>mineN&&await onScope()==='all');
 await pg.screenshot({path:'ui18-progress.png'});
 await pg.click('#pg-scope [data-scope="mine"]'); await pg.waitForTimeout(300); assert(await pg.evaluate(()=>globalProgressData.length)===mineN);
 // card edit: staff sees name/target/owner/dept inputs, no level/summary/delete
 await pg.click('#menu-home-btn'); await pg.waitForTimeout(300);
 await pg.evaluate(()=>{const k=globalDatabase.find(k=>k.mine&&viewPlacements(k,treeView).length); startEditNow(k.id);});
 await pg.waitForTimeout(200);
 const has=async s=>(await pg.locator(s).count())>0;
 console.log('inputs',{name:await has('#ed-name'),target:await has('#ed-target'),owner:await has('#ed-owner'),dept:await has('#ed-dept'),level:await has('.ed-level-cb'),summary:await has('#ed-summary'),freq:await has('#ed-frequency'),del:await has('text=ลบตัวชี้วัด')});
 assert(await has('#ed-name')&&await has('#ed-target')&&await has('#ed-owner')&&await has('#ed-dept')&&!(await has('.ed-level-cb'))&&!(await has('#ed-summary'))&&!(await has('#ed-frequency'))&&!(await has('.kpi-card .btn-danger')));
 await pg.fill('#ed-name','ชื่อที่แก้โดยเจ้าของ'); await pg.click('button:has-text("บันทึกข้อมูล")'); await pg.waitForTimeout(500);
 assert((await pg.innerText('#kpi-list-area')).includes('ชื่อที่แก้โดยเจ้าของ')); console.log('staff renamed own KPI');
 await pg.screenshot({path:'ui18-staff-edit.png'});
 // add KPI as staff
 await pg.click('#btn-add-kpi'); await pg.waitForSelector('#modal-add-kpi',{state:'visible'});
 console.log('prefill owner/dept:',await pg.inputValue('#add-kpi-owner'),'/',await pg.inputValue('#add-kpi-dept'));
 await pg.fill('#add-kpi-name','ตัวชี้วัดใหม่ของฉัน');
 await pg.evaluate(()=>{document.querySelectorAll('.add-level-cb').forEach(c=>c.checked=c.value==='รายบุคคล');renderAddLevelCats();
   addCatRow('add-kpi-extra-cats');const r=document.querySelector('#add-kpi-extra-cats .cat-row');r.querySelector('.cat-part').value='Part I';r.querySelector('.cat-cat').value='ทดสอบ';});
 await pg.click('#modal-add-kpi button:has-text("บันทึกข้อมูล")'); await pg.waitForTimeout(300);
 const al=(await pg.innerText('#modal-alert')).replace(/\n/g,' / '); console.log('core+personal alert:',al); assert(/Part I/.test(al));
 await pg.click('#modal-alert button'); 
 await pg.fill('#add-kpi-extra-cats .cat-part','หมวดของมานี');
 await pg.click('#modal-add-kpi button:has-text("บันทึกข้อมูล")'); await pg.waitForTimeout(800);
 const order=await pg.evaluate(()=>Array.from(document.querySelectorAll('.accordion-header > span:first-child')).map(e=>e.innerText));
 console.log('parts in tree:',order); assert(order.includes('หมวดของมานี'));
 console.log('errors',pg._errs); await pg.close();
 // ---- admin: ordering
 pg=await mkpage(); await login(pg,'Admin','Admin11038');
 await pg.evaluate(()=>{globalDatabase.push(Object.assign({},globalDatabase[0],{cats:undefined,id:'z1',part:'หมวด ก',category:'a'}),Object.assign({},globalDatabase[0],{cats:undefined,id:'z2',part:'Part V',category:'a'}),Object.assign({},globalDatabase[0],{cats:undefined,id:'z3',part:'Alpha',category:'a'}));renderTree();});
 const parts=()=>pg.evaluate(()=>Array.from(document.querySelectorAll('.accordion-header > span:first-child')).map(e=>e.innerText));
 const ordH=await parts(); console.log('admin hosp order',ordH); assert(ordH.join()==='Part I,Part II,Part III,Part IV');
 await pg.evaluate(()=>{treeView='unit';renderTree();}); const ordU=await parts(); console.log('admin unit order',ordU.length);
 assert(ordU.join()===ordU.slice().sort((x,y)=>x.localeCompare(y,'th')).join()&&ordU.includes('Alpha')&&ordU.includes('Part V')&&!ordU.includes('Part I'));
 console.log('admin errors',pg._errs); await pg.close();
 // ---- executive
 pg=await mkpage(); await login(pg,'ผอ.','secret99');
 const ex=await pg.evaluate(()=>({n:globalDatabase.length,ok:globalDatabase.every(k=>k.mine||(isCorePart(k.part)&&hasHospitalLevel(k.levels))),mine:appliedFilters.scope!=='all'}));
 console.log('exec',ex); assert(ex.ok&&!ex.mine); console.log('exec errors',pg._errs); await pg.close();
 await b.close(); console.log('UI18 OK');
})();
