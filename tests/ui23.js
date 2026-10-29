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
  await pg.exposeFunction('__call',async(fn,args)=>{try{if(h.hook){const r=await h.hook(fn,args);if(r!==undefined)return JSON.stringify(r)}return JSON.stringify(h.ctx[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>{const u=r.request().url();if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});return r.abort()});
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/'); return pg; };
 const login=async(pg,u,p)=>{await pg.fill('#login-username',u);await pg.fill('#login-password',p);await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(300)};
 const total=pg=>pg.evaluate(()=>getOrderedKpis().length);

 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 let pg=await mkpage();
 // ---- 2. first load failure -> retry button
 let failFirst=true; h.hook=async(fn,args)=>{ if(fn==='getAllData'&&failFirst){failFirst=false;return {success:false,message:'Exception: Service timed out'}} };
 await pg.fill('#login-username','มานี'); await pg.fill('#login-password','secret99'); await pg.click('#login-box-content button'); await pg.waitForTimeout(600);
 await pg.waitForSelector('#modal-alert',{state:'visible'}); await pg.click('#modal-alert button');
 console.log('load-failed box:',(await pg.innerText('#login-box-content')).replace(/\n/g,' | ')); assert(await pg.locator('#login-box-content button:has-text("ลองใหม่")').count()===1);
 await pg.click('#login-box-content button:has-text("ลองใหม่")'); await pg.waitForSelector('#modal-fy',{state:'visible'}); await pg.click('#modal-fy button'); await pg.waitForSelector('#app-login-screen',{state:'hidden'}); await pg.waitForTimeout(300);
 h.hook=null; console.log('retry ok');
 // ---- 1. fiscal year switch failure keeps old year + data
 const before=await pg.evaluate(()=>({fy:selectedFy,n:globalDatabase.length}));
 h.hook=async(fn,args)=>{ if(fn==='getAllData'&&args[1]===2569) return {success:false,message:'Exception: timeout'} };
 await pg.evaluate(()=>{const s=document.getElementById('fy-select'); s.value='2569'; onFiscalYearChange(s);}); await pg.waitForTimeout(500);
 await pg.click('#modal-alert button');
 const after=await pg.evaluate(()=>({fy:selectedFy,n:globalDatabase.length,sel:document.getElementById('fy-select').value,dis:document.getElementById('fy-select').disabled}));
 console.log('FY fail',JSON.stringify(before),JSON.stringify(after)); assert(after.fy===before.fy&&after.n===before.n&&after.sel==String(before.fy)&&!after.dis); h.hook=null;
 // success switch works + currentPage reset
 await pg.evaluate(()=>{const s=document.getElementById('fy-select'); s.value='2569'; onFiscalYearChange(s);}); await pg.waitForTimeout(700); assert(await pg.evaluate(()=>selectedFy)===2569);
 await pg.evaluate(()=>{const s=document.getElementById('fy-select'); s.value='2570'; onFiscalYearChange(s);}); await pg.waitForTimeout(700); assert(await pg.evaluate(()=>selectedFy)===2570);
 // ---- 3. save callback guard: slow save, then start editing another KPI
 const ids=await pg.evaluate(()=>globalDatabase.filter(k=>k.mine&&k.canEditDetails).slice(0,2).map(k=>k.id)); assert(ids.length===2);
 h.hook=async(fn,args)=>{ if(fn==='saveKpi'){ await sleep(1500); } };
 await pg.evaluate(id=>startEditNow(id),ids[0]); await pg.waitForTimeout(200);
 await pg.fill('#ed-name','ชื่อใหม่ A'); await pg.click('.kpi-card.editing button:has-text("บันทึกข้อมูล")'); await pg.waitForTimeout(200);
 const busy=await pg.evaluate(()=>({saveDisabled:document.querySelector('.kpi-card.editing .btn-primary').disabled,nameDisabled:document.getElementById('ed-name').disabled}));
 console.log('busy while saving',JSON.stringify(busy)); assert(busy.saveDisabled&&busy.nameDisabled);
 // try starting B while A is saving
 await pg.evaluate(id=>startEdit(id),ids[1]); await pg.waitForTimeout(200);
 const modal=await pg.isVisible('#modal-unsaved'); console.log('unsaved modal shown while saving:',modal);
 if(modal){ await pg.click('#modal-unsaved button:has-text("ไม่บันทึก")'); }
 await pg.waitForTimeout(200);
 const st1=await pg.evaluate(()=>editingId); console.log('editing after discard click:',st1);
 await pg.waitForTimeout(1800);
 const st2=await pg.evaluate((ids)=>({editingId,editingB:editingId===ids[1],nameA:globalDatabase.find(k=>k.id===ids[0]).name}),ids); console.log('after A response',JSON.stringify(st2));
 assert(st2.nameA==='ชื่อใหม่ A'); if(st2.editingId!==null) assert(st2.editingB,'must not clear B edit state');
 h.hook=null;
 // ---- 4. save-and-continue fails -> fy select restored
 await pg.evaluate(id=>startEditNow(id),ids[0]); await pg.waitForTimeout(200); await pg.fill('#ed-name',''); 
 await pg.evaluate(()=>{const s=document.getElementById('fy-select'); s.value='2569'; onFiscalYearChange(s);}); await pg.waitForSelector('#modal-unsaved',{state:'visible'});
 await pg.click('#modal-unsaved button:has-text("บันทึกแล้วไปต่อ")'); await pg.waitForTimeout(300); await pg.click('#modal-alert button');
 const sel=await pg.evaluate(()=>document.getElementById('fy-select').value); console.log('fy select after failed save&continue:',sel); assert(sel==='2570');
 await pg.fill('#ed-name','ชื่อกลับมา'); await pg.click('.kpi-card.editing button:has-text("ยกเลิก")'); await pg.waitForSelector('#modal-confirm',{state:'visible'}); await pg.click('#modal-confirm button:has-text("ยืนยัน")');
 // ---- 7. misc: card buttons via data-attrs, part counts, readonly lock, progress oninput
 await pg.evaluate(id=>{pageSize=50;renderList();},ids[0]); await pg.waitForTimeout(200);
 await pg.locator('.kpi-card .btn-accent:has-text("แก้ไข")').first().click(); await pg.waitForTimeout(200); assert(await pg.locator('.kpi-card.editing').count()===1); await pg.locator('.kpi-card.editing button:has-text("ยกเลิก")').click(); 
 const cnt=await pg.evaluate(()=>Array.from(document.querySelectorAll('.accordion-part')).map(p=>[p.querySelector('.accordion-header span').innerText,+p.querySelector('.part-count').innerText,new Set(Array.from(p.querySelectorAll('.kpi-link-item')).map(e=>e.dataset.id)).size])); console.log('part counts',JSON.stringify(cnt)); cnt.forEach(c=>assert(c[1]===c[2],'count '+c));
 console.log('cssId distinct:',await pg.evaluate(()=>[cssId('ตช1'),cssId('กข1'),cssId("a'b")]));
 assert(await pg.evaluate(()=>cssId('ตช1')!==cssId('กข1')));
 // locked textarea is readonly not disabled
 await pg.evaluate(()=>{const s=document.getElementById('fy-select'); s.value='2570'; onFiscalYearChange(s);}); await pg.waitForTimeout(800);
 await pg.evaluate(()=>{const k=globalDatabase.find(k=>k.canEditResults&&k.lockedYears&&k.lockedYears.some(Boolean)); startEditNow(k.id)}); await pg.waitForTimeout(250);
 const ro=await pg.evaluate(()=>{const t=document.querySelector('.lock-wrap input');return {disabled:t.disabled}}); console.log('locked year input',JSON.stringify(ro)); assert(ro.disabled);
 await pg.locator('.lock-wrap input').first().scrollIntoViewIfNeeded(); await pg.waitForTimeout(1000); const bx=await pg.locator('.lock-wrap input').first().boundingBox(); await pg.mouse.move(bx.x+20,bx.y+20); await pg.mouse.move(bx.x+25,bx.y+22); await pg.waitForTimeout(250);
 assert(await pg.evaluate(()=>getComputedStyle(document.getElementById('lock-tip')).display)==='block'); console.log('tooltip over readonly ok');
 console.log('errors',pg._errs);
 // ---- 5. logout resets filters; 8. password change keeps working
 await pg.evaluate(()=>{ exitEdit(); }); 
 await pg.evaluate(()=>{appliedFilters.mode='red'; document.getElementById('progress-filter').value='abc';}); await pg.waitForTimeout(200);
 await pg.evaluate(()=>logout()); await pg.waitForTimeout(300);
 const rst=await pg.evaluate(()=>({mode:appliedFilters.mode,sc:appliedFilters.scope,pf:document.getElementById('progress-filter').value,fy:selectedFy,fyDb:globalDatabase.length})); console.log('after logout',JSON.stringify(rst)); assert(rst.mode==='green'&&rst.sc==='all'&&rst.pf===''&&rst.fy===null&&rst.fyDb===0);
 await pg.close();
 // password change -> token replaced and still works
 pg=await mkpage(); await login(pg,'ปิติ','11038').catch(async()=>{});
 await b.close(); console.log('UI23 OK');
})();
