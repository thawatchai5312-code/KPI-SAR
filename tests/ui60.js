// มุมมองเริ่มต้นตาม Tier (staff = การ์ด · head/ผอ./admin = ตาราง) + กดตัวชี้วัดจากหน้าติดตามงานแล้วขึ้นแถว/การ์ดที่ถูกต้อง (ตาราง+การ์ด ตัวในมุมมองเดิม/ต้องสลับมุมมอง/ถูกตัวกรองซ่อน)

const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2570;
const DOCX_LIB=path.join(__dirname,'fixtures/lib/docx.iife.js'),PPTX_LIB=path.join(__dirname,'fixtures/lib/pptxgen.bundle.js');assert(fs.existsSync(DOCX_LIB)&&fs.existsSync(PPTX_LIB),'missing libs');
const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),ex=pick('executive'),hp=pick('head','PCT'),hn=U.find(r=>r[2]==='head'&&!/(^|,)PCT(,|$)/.test(r[3]));
[ad,ex,hp,hn].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tA=C.createSession_(ad[0],ad[1]),tE=C.createSession_(ex[0],ex[1]);
const OUT=process.cwd();
async function open(b,user){
 const ctx=await b.newContext({viewport:{width:1500,height:950},acceptDownloads:true});const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>{const u=r.request().url();
   if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(/docx@9\.5\.1\/dist\/index\.iife\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(DOCX_LIB)});
   if(/pptxgenjs@4\.0\.1\/dist\/pptxgen\.bundle\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(PPTX_LIB)});
   if(/fonts\.(googleapis|gstatic)\.com/.test(u))return r.abort();
   return r.abort()});
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',user[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForFunction(()=>document.getElementById('kpi-table')||document.querySelector('.kpi-card'),null,{timeout:60000});
 return pg;
}
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const st=U.find(r=>r[2]==='staff'),hd=U.find(r=>r[2]==='head'),ex=U.find(r=>r[2]==='executive');[st,hd,ex].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
 // ===== มุมมองเริ่มต้นตาม Tier =====
 for(const [who,want] of [[st,'card'],[hd,'table'],[ex,'table'],[ad,'table']]){
  const pg=await open(br,who);
  const r=await pg.evaluate(()=>({mode:listMode,on:document.querySelector('#mode-switch .on').dataset.mode,table:!!document.getElementById('kpi-table'),cards:document.querySelectorAll('.kpi-card').length,hidden:[...tblHide].join()}));
  assert.strictEqual(r.mode,want,who[2]+' '+JSON.stringify(r));assert.strictEqual(r.on,want);
  if(want==='card')assert(r.cards>0&&!r.table,JSON.stringify(r));else{assert(r.table&&r.cards===0,JSON.stringify(r));assert.strictEqual(r.hidden,'settings,history,cats')}
  if(who===st){ // สลับเป็นตารางเองได้ · ออกจากระบบแล้วเข้าใหม่ → กลับเป็นค่าเริ่มต้น
   await pg.evaluate(()=>setListMode('table'));await pg.waitForSelector('#kpi-table');
   await pg.evaluate(()=>showLogin());await pg.waitForSelector('#login-username',{state:'visible'});
   await pg.fill('#login-username',who[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
   await pg.waitForSelector('.kpi-card');assert.strictEqual(await pg.evaluate(()=>listMode),'card','re-login resets to tier default');
   await pg.screenshot({path:OUT+'/ui60-staff-card.png'});
  }
  await pg.context().close();
 }
 // ===== กดจากหน้าติดตามงาน (admin) =====
 const pg=await open(br,ad);
 const ids=await pg.evaluate(()=>{const hosp=new Set(uniqueById(getOrderedKpis(false,'hosp')).map(k=>k.id));
  const other=globalDatabase.find(k=>!hosp.has(k.id)&&(k.canEditResults||k.canEditDetails));
  const same=uniqueById(getOrderedKpis(false,'hosp')).filter(k=>k.canEditResults||k.canEditDetails).slice(-1)[0];
  return {other:other.id,same:same.id}});
 const probe=async(mode,id,edit)=>pg.evaluate(async([mode,id,edit])=>{
   if(listMode!==mode)setListMode(mode);
   switchMenu('progress');
   const tr=document.createElement('tr');tr.dataset.id=id;tr.dataset.edit=edit?'1':'0';gotoKpiFromRow(tr);
   await new Promise(r=>setTimeout(r,2500));
   const key=selectedKey,el=document.getElementById('card-'+cssId(key));
   const o={mode:listMode,tab:currentTab,view:treeView,sel:selectedKpiId,found:!!el&&el.dataset.id===id,editing:editingId===id,editEl:!!document.querySelector(EDITING_SEL),edId:(document.querySelector(EDITING_SEL)||{dataset:{}}).dataset.id};
   if(el){const r=el.getBoundingClientRect(),wrap=document.getElementById('tbl-wrap'),head=wrap?Math.max(...[...document.querySelectorAll('#kpi-table thead th')].map(t=>t.getBoundingClientRect().bottom)):0;o.top=Math.round(r.top);o.headBottom=Math.round(head);o.visible=r.top>=head-2&&r.top<window.innerHeight-20;}
   return o;},[mode,id,edit]);
 for(const mode of ['table','card','table']){
  for(const [label,id] of [['other-view',ids.other],['same-view',ids.same],['other-view-again',ids.other]]){
   if(mode==='table'&&label==='same-view'){await pg.evaluate(()=>{treeView='hosp';renderTree();renderList()})}
   const r=await probe(mode,id,true);
   assert(r.found&&r.editing&&r.editEl&&r.edId===id&&r.tab==='home',mode+' '+label+' '+JSON.stringify(r));
   if(mode==='table')assert(r.visible,mode+' '+label+' row hidden behind header '+JSON.stringify(r));
   await pg.evaluate(()=>exitEdit());
   if(mode==='table'&&label==='other-view')await pg.screenshot({path:OUT+'/ui60-table-from-progress.png'});
  }
 }
 // ตัวที่ถูกตัวกรองสถานะซ่อน (ตารางเหลือเฉพาะ 🔴 แต่ตัวที่ต้องการเป็น 🟢) → ล้างตัวกรองแล้วขึ้นแถว
 const green=await pg.evaluate(()=>{const k=globalDatabase.find(k=>(k.canEditResults||k.canEditDetails)&&kpiStatus(k).level==='green');return k?k.id:null});
 if(green){await pg.evaluate(()=>{setListMode('table');setStatusFilter('red')});await pg.waitForTimeout(400);const r=await probe('table',green,false);assert(r.found&&r.visible,'hidden-by-filter '+JSON.stringify(r))}
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 await br.close();console.log('ui60 ok');
})().catch(e=>{console.error(e);process.exit(1)});
