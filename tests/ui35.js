// views re-categorisation on live data: QA / unit / PCT order + level-bound add form
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness4');const C=h.ctx;const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = defaultListMode(); tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
const U=h.sheets.Users.d; const setPw=(n,p)=>{const r=U.find(x=>x[0]===n);r[1]=C.hashPassword_(p);r[4]='FALSE'};
(async()=>{
 C.PropertiesService.getScriptProperties().setProperty('HEAD_SEED_V1','done');
 setPw('Admin','pw123456');
 const er=U.find(r=>r[2]==='staff'&&/(^|,)ER(,|$)/.test(r[3])); setPw(er[0],'pw123456');
 const at=C.createSession_('Admin',U.find(r=>r[0]==='Admin')[1]); assert(C.tidyCommit(at).success);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mk=async()=>{const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');return pg};
 const login=async(pg,u,p)=>{await pg.fill('#login-username',u);await pg.fill('#login-password',p);await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(500)};
 const pg=await mk(); await login(pg,'Admin','pw123456');
 // QA view
 await pg.evaluate(()=>{appliedFilters.scope='all';setTreeView('qa')}); await pg.waitForTimeout(700);
 const qa=await pg.evaluate(()=>({parts:[...document.querySelectorAll('#accordion-tree-container .accordion-header > span:first-child')].map(e=>e.textContent),
   raw:[...new Set(getOrderedKpis(false,'qa').map(p=>p.part))], cats:[...new Set(getOrderedKpis(false,'qa').map(p=>p.category))]}));
 console.log('QA parts',qa.parts.join(' | '));console.log('QA cats',qa.cats.join(' | '));
 assert(qa.parts[0]==='ภาพรวมฝ่ายการพยาบาล'&&qa.parts.every(p=>!/ QA$/.test(p))&&qa.raw.every(p=>/ QA$/.test(p)));
 assert(qa.cats.every(c=>/^มิติที่ [1-5]/.test(c)));
 await pg.screenshot({path:'ui35-qa.png'});
 // unit view
 await pg.evaluate(()=>setTreeView('unit')); await pg.waitForTimeout(700);
 const un=await pg.evaluate(()=>{const ps=getOrderedKpis(false,'unit');const by=p=>[...new Set(ps.filter(x=>x.part===p).map(x=>x.category))];
   const stemi=ps.filter(x=>x.part==='PCT'&&x.category==='STEMI').filter(x=>!x.depth).map(x=>x.pctOrder);
   return {parts:[...new Set(ps.map(p=>p.part))],pct:by('PCT'),er:by('ER'),pcu:by('PCU'),stemi,ckd:ps.filter(x=>x.part==='PCT'&&x.category==='CKD').map(x=>kpiNoLabel(x)+' '+x.name.slice(0,28))}});
 console.log('unit parts',un.parts.join(','));console.log('PCT',un.pct.join(' | '));console.log('ER',un.er.slice(0,12).join(' | '));console.log('PCU',un.pcu.join(' | '));
 console.log('CKD',un.ckd.join(' / '));
 assert(!un.parts.includes('NSO')&&!un.parts.some(p=>/ QA$/.test(p)));
 assert(un.pct[0]==='STEMI'&&un.pct.indexOf('การดูแลระยะกลาง (IMC)')===un.pct.indexOf('Stroke')+1&&un.pct[un.pct.length-1]==='จริยธรรมและสิทธิผู้ป่วย');
 const st=un.stemi.filter(x=>x!==null);assert(st.every((v,i)=>i===0||v>=st[i-1]),'STEMI by file order');
 // PCT ordering: first PCT tree category header text order matches
 await pg.evaluate(()=>{openParts.add('PCT');renderTree()}); await pg.waitForTimeout(300);
 const tcats=await pg.evaluate(()=>[...document.querySelectorAll('.accordion-part[data-part="PCT"] .category-header > span:first-child')].map(e=>e.textContent));
 assert(JSON.stringify(tcats)===JSON.stringify(un.pct),'tree cat order');
 await pg.screenshot({path:'ui35-unit.png'});
 // add form bound to levels
 await pg.evaluate(()=>openAddKpiModal()); await pg.waitForTimeout(300);
 await pg.fill('#add-kpi-name','ทดสอบ ร้อยละผู้ป่วยได้รับการคัดแยกถูกต้อง'); await pg.fill('#add-kpi-dept','ER / NSO');
 await pg.check('.add-level-cb[value="QA-หน่วยงาน"]'); await pg.check('.add-level-cb[value="หน่วยงาน"]'); await pg.dispatchEvent('#add-kpi-levels','change'); await pg.waitForTimeout(200);
 const rows=await pg.evaluate(()=>[...document.querySelectorAll('#add-kpi-level-cats .lvc-row')].map(r=>r.innerText.replace(/\s+/g,' ').slice(0,60)));
 console.log('form rows',JSON.stringify(rows)); assert(rows.length===3);
 await pg.screenshot({path:'ui35-add.png'});
 // SAR without HA category → alert
 await pg.click('#modal-add-kpi button:has-text("บันทึกข้อมูล")'); await pg.waitForSelector('#modal-alert',{state:'visible'});
 assert(/SAR/.test(await pg.innerText('#modal-alert'))); await pg.click('#modal-alert button');
 await pg.selectOption('#add-kpi-level-cats .lvc-part','Part III');
 await pg.fill('#add-kpi-level-cats [data-key="sar-cat"]','III-1 การเข้าถึงและเข้ารับบริการ');
 await pg.click('#modal-add-kpi button:has-text("บันทึกข้อมูล")'); await pg.waitForTimeout(1500);
 const added=C.rowToKpi_(h.sheets['ปีงบ 2570'].d.find(r=>r[4]==='ทดสอบ ร้อยละผู้ป่วยได้รับการคัดแยกถูกต้อง'));
 console.log('added',added.cats.map(c=>c.part+'›'+c.category).join(' ; '),added.levels.join());
 assert(added.cats.some(c=>c.part==='Part III')&&added.cats.some(c=>c.part==='ER QA'&&/^มิติที่/.test(c.category))&&added.cats.some(c=>c.part==='ER'&&c.category==='Triage')&&!added.cats.some(c=>/NSO/.test(c.part)));
 // edit card shows kind tags
 await pg.waitForTimeout(800);
 const tags=await pg.evaluate(()=>[...document.querySelectorAll('#ed-cats .cat-kind')].map(e=>e.textContent.trim()));
 console.log('edit tags',tags.join(',')); assert(tags.length===3&&tags.some(t=>/QA/.test(t)));
 // staff ER: unit view default, sees ER headings
 const pg2=await mk(); await login(pg2,er[0],'pw123456');
 const sv=await pg2.evaluate(()=>({view:treeView,parts:[...new Set(getOrderedKpis(false,'unit').map(p=>p.part))],qa:[...new Set(getOrderedKpis(false,'qa').map(p=>partLabel(p.part)))]}));
 console.log('staff',er[0],JSON.stringify(sv)); assert(sv.view==='unit');
 await pg2.screenshot({path:'ui35-staff.png'});
 for(const p of [pg,pg2])assert(p._errs.length===0,p._errs.join());
 await b.close(); console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
