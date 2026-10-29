// ระดับตัวชี้วัดกับหมวด: การ์ดแก้ไข — เอาระดับ SAR (และ QA-หน่วยงาน) ออกแล้วหมวด Part I–IV หายตาม (ถ้ายังเหลือหมวดอื่น) · ฟอร์มเพิ่มตัวชี้วัด — ช่องหมวดและคำอธิบายตามระดับที่ติ๊ก

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
 const pg=await open(br,ad);
 await pg.evaluate(()=>setListMode('card'));await pg.waitForSelector('.kpi-card');
 const pick=await pg.evaluate(()=>{const ok=k=>k.canEditDetails&&kpiCats(k).some(c=>isCorePart(c.part))&&kpiCats(k).some(c=>!isCorePart(c.part));
  const a=globalDatabase.find(k=>ok(k)&&(k.levels||[]).includes('SAR')&&!(k.levels||[]).includes('QA-หน่วยงาน'));
  const b=globalDatabase.find(k=>ok(k)&&(k.levels||[]).includes('SAR')&&(k.levels||[]).includes('QA-หน่วยงาน'));
  return {a:a&&a.id,b:b&&b.id}});
 console.log('picked',JSON.stringify(pick));assert(pick.a,'KPI with SAR (no QA) + unit cat');
 const coreRows=()=>pg.evaluate(()=>[...document.querySelectorAll('#ed-cats .cat-row')].map(r=>r.querySelector('.cat-part').value.trim()).filter(isCorePart).length);
 const allRows=()=>pg.evaluate(()=>document.querySelectorAll('#ed-cats .cat-row').length);
 const edit=async id=>{await pg.evaluate(id=>goToKpi(id),id);await pg.waitForTimeout(500);await pg.evaluate(id=>{startEditNow(id)},id);await pg.waitForSelector('#ed-cats');};
 const click=async v=>{await pg.click('.ed-level-cb[value="'+v+'"]');await pg.waitForTimeout(150)};
 // 1) SAR เท่านั้น → เอา SAR ออก = หมวด Part หาย ที่เหลือเป็นหมวดหน่วยงาน
 await edit(pick.a);
 const n0=await coreRows(),t0=await allRows();assert(n0>=1&&t0>n0,'has core + other cats '+n0+'/'+t0);
 await click('SAR');
 assert.strictEqual(await coreRows(),0,'core rows gone after unchecking SAR');assert(await allRows()>=1);
 assert(/เอาหมวด Part I–IV ออกแล้ว/.test(await pg.evaluate(()=>document.getElementById('toast').innerText)),'toast');
 await pg.screenshot({path:OUT+'/ui62-edit-sar-off.png'});
 // ติ๊ก SAR กลับ → ขึ้นแถวให้เลือก Part (พฤติกรรมเดิม)
 await click('SAR');assert((await allRows())>=1&&await pg.evaluate(()=>!!document.querySelector('#ed-cats .cat-row .cat-part')));
 await pg.evaluate(()=>cancelEdit());await pg.evaluate(()=>{if(document.getElementById('modal-confirm').style.display==='flex')closeConfirm(true)});
 // 2) มี QA-หน่วยงาน อยู่ด้วย → เอา SAR ออกแล้ว Part ยังอยู่ (ระดับ รพ. ยังเหลือ) · เอา QA ออกอีก → Part หาย
 if(pick.b){
  await pg.waitForFunction(()=>editingId===null);await edit(pick.b);
  const m0=await coreRows();assert(m0>=1);
  await click('SAR');assert.strictEqual(await coreRows(),m0,'QA level remains → core kept');
  await click('QA-หน่วยงาน');assert.strictEqual(await coreRows(),0,'no hospital level → core gone');
  await pg.evaluate(()=>cancelEdit());await pg.evaluate(()=>{if(document.getElementById('modal-confirm').style.display==='flex')closeConfirm(true)});
 }
 // 3) ฟอร์มเพิ่ม: คำอธิบายและช่องหมวดตามระดับที่ติ๊ก
 await pg.waitForFunction(()=>editingId===null);
 await pg.evaluate(()=>openAddKpiModal());await pg.waitForSelector('#modal-add-kpi',{state:'visible'});
 const st=()=>pg.evaluate(()=>({lv:checkedLevels('add-level-cb'),rows:document.querySelectorAll('#add-kpi-level-cats .lvc-row').length,part:!!document.querySelector('#add-kpi-level-cats .lvc-part'),hint:document.getElementById('add-kpi-lvl-hint').textContent}));
 let r=await st();assert(r.part&&/SAR → หมวด รพ\./.test(r.hint)&&!/QA-หน่วยงาน →/.test(r.hint)&&!/หน่วยงาน → หน่วยงาน/.test(r.hint),JSON.stringify(r));
 await pg.click('#add-kpi-levels input[value="SAR"]');r=await st();assert(!r.part&&/SAR → หมวด/.test(r.hint)&&/QA-หน่วยงาน → QA/.test(r.hint)&&/หน่วยงาน\/รายบุคคล → หน่วยงาน/.test(r.hint),'none checked shows the full guide: '+JSON.stringify(r));
 await pg.fill('#add-kpi-dept','ER');await pg.dispatchEvent('#add-kpi-dept','input');
 await pg.click('#add-kpi-levels input[value="QA-หน่วยงาน"]');r=await st();assert(!r.part&&r.rows>=1&&/QA-หน่วยงาน → QA ของหน่วย/.test(r.hint)&&!/SAR → หมวด/.test(r.hint),'QA: '+JSON.stringify(r));
 await pg.click('#add-kpi-levels input[value="หน่วยงาน"]');r=await st();assert(!r.part&&/QA-หน่วยงาน → QA/.test(r.hint)&&/หน่วยงาน → หน่วยงาน › หัวข้อ/.test(r.hint),'QA+unit: '+JSON.stringify(r));
 await pg.screenshot({path:OUT+'/ui62-add-qa-unit.png'});
 await pg.click('#add-kpi-levels input[value="SAR"]');r=await st();assert(r.part&&/SAR → หมวด รพ\./.test(r.hint),'SAR back: '+JSON.stringify(r));
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 await br.close();console.log('ui62 ok');
})().catch(e=>{console.error(e);process.exit(1)});
