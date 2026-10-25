const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness5');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE");
const U=h.sheets.Users.d; const a=U.find(x=>x[0]==='Admin'); a[1]=C.hashPassword_('pw123456'); a[4]='FALSE';
const S=h.sheets['ปีงบ 2570'];const row=id=>C.rowToKpi_(S.d.find(r=>r[0]===id));const show=k=>k.cats.map(c=>c.part+'›'+c.category).join(' ; ')+' ['+k.levels+'] dept='+k.department;
// fixtures for cases 4/5: SAR-only KPIs with Part placement only (one with dept ER, one without dept)
const coreOnly=S.d.slice(1).filter(r=>r[0]&&/^Part/.test(String(r[2]))).slice(5,7);coreOnly.forEach(r=>{r[36]='';});
coreOnly[0][28]='SAR';coreOnly[0][26]='ER';coreOnly[1][28]='SAR';coreOnly[1][26]='';coreOnly[1][25]='';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username','Admin');await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(500);
 const pick=f=>pg.evaluate(f);
 const edit=async(id)=>{await pg.evaluate(id=>{selectKpi(id);},id);await pg.waitForTimeout(500);await pg.evaluate(id=>{const k=globalDatabase.find(x=>x.id===id);startEditNow(id,placementsOf(k)[0].key)},id);await pg.waitForTimeout(500);};
 const rows=()=>pg.evaluate(()=>readCatRows('ed-cats').map(c=>c.part+'›'+c.category).join(' ; '));
 const save=async()=>{await pg.evaluate(()=>saveKpiEdit());await pg.waitForTimeout(800);const al=await pg.isVisible('#modal-alert');let msg='';if(al){msg=await pg.innerText('#modal-alert');await pg.click('#modal-alert button');}return msg.replace(/\n/g,' ');};
 const tick=async(l,on)=>{await pg.evaluate(([l,on])=>{const cb=document.querySelector('.ed-level-cb[value="'+l+'"]');cb.checked=on;cb.dispatchEvent(new Event('change',{bubbles:true}));},[l,on]);await pg.waitForTimeout(200);};
 const done=async()=>{await pg.evaluate(()=>{if(editingId)exitEdit();});await pg.waitForTimeout(300);};
 // 1) tick QA → editor shows "<unit> QA" row immediately; save → dim filled
 let id=await pick(()=>globalDatabase.find(k=>!k.levels.includes('QA-หน่วยงาน')&&k.levels.includes('SAR')&&k.department&&!/NSO/.test(k.department)).id);
 await edit(id); await tick('QA-หน่วยงาน',true); let r=await rows(); console.log('QA tick rows:',r); assert(/ QA›รอจัดหมวดย่อย/.test(r));
 let m=await save(); let k=row(id); console.log(' saved:',m||'ok',show(k)); assert(!m&&k.cats.some(c=>/ QA$/.test(c.part)&&/^มิติที่/.test(c.category))&&k.levels.includes('QA-หน่วยงาน')); await done();
 // 2) untick QA → QA rows removed in editor; save → gone
 await edit(id); await tick('QA-หน่วยงาน',false); r=await rows(); console.log('QA untick rows:',r); assert(!/ QA›/.test(r));
 m=await save(); k=row(id); console.log(' saved:',m||'ok',show(k)); assert(!m&&!k.cats.some(c=>/ QA$/.test(c.part))&&!k.levels.includes('QA-หน่วยงาน')); await done();
 // 3) tick SAR on unit-only KPI → empty Part row added; save blocked until filled; fill → saved
 id=await pick(()=>globalDatabase.find(k=>!k.levels.includes('SAR')&&!kpiCats(k).some(c=>isCorePart(c.part))).id);
 await edit(id); await tick('SAR',true); r=await rows(); console.log('SAR tick rows:',r);
 m=await save(); console.log(' save empty Part:',m); assert(/ระบุทั้งหมวดหลักและหมวดย่อย|Part I–IV/.test(m));
 await pg.evaluate(()=>{const rr=[...document.querySelectorAll('#ed-cats .cat-row')].pop();rr.querySelector('.cat-part').value='Part III';rr.querySelector('.cat-cat').value='III-4 การดูแลผู้ป่วย';});
 m=await save(); k=row(id); console.log(' saved:',m||'ok',show(k)); assert(!m&&k.cats.some(c=>c.part==='Part III')&&k.levels.includes('SAR')); await done();
 // 4) tick หน่วยงาน on a KPI with only Part placement + dept → unit row appears, saved with subcat
 id=await pick(()=>{const k=globalDatabase.find(k=>!k.levels.some(l=>l==='หน่วยงาน'||l==='รายบุคคล')&&k.department&&!/NSO/.test(k.department));return k&&k.id});
 if(id){ await pg.evaluate(id=>{},id); const dep=row(id).department; // ensure no unit placement so a new row is expected
  await edit(id); await tick('หน่วยงาน',true); r=await rows(); console.log('unit tick rows:',r);
  m=await save(); k=row(id); console.log(' saved:',m||'ok',show(k)); assert(!m&&k.levels.includes('หน่วยงาน')&&k.cats.some(c=>!/^Part/.test(c.part)&&!/ QA$/.test(c.part)&&c.category!=='รอจัดหมวดย่อย')); await done(); }
 else console.log('unit tick: no candidate');
 // 5) QA tick with no department → message, server refuses
 id=await pick(()=>{const k=globalDatabase.find(k=>!k.levels.includes('QA-หน่วยงาน')&&!k.department&&kpiCats(k).some(c=>isCorePart(c.part)));return k&&k.id});
 if(id){ await edit(id); await tick('QA-หน่วยงาน',true); m=await save(); console.log('QA no dept:',m); assert(/QA/.test(m)); await done(); } else console.log('QA no dept: no candidate');
 // 6) placeholder row added by hand with blank subcat → filled by server
 id=await pick(()=>globalDatabase.find(k=>kpiCats(k).length===1&&isCorePart(kpiCats(k)[0].part)).id);
 await edit(id); await pg.evaluate(()=>{addCatRow('ed-cats');const rr=[...document.querySelectorAll('#ed-cats .cat-row')].pop();rr.querySelector('.cat-part').value='HR';});
 m=await save(); k=row(id); console.log('blank subcat:',m||'ok',show(k)); assert(!m&&k.cats.some(c=>c.part==='HR'&&c.category!=='รอจัดหมวดย่อย')); await done();
 assert(errs.length===0,errs.join()); console.log('ALL OK');
 console.log('errors',errs.join()); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
