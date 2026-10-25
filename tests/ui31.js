const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness2');const C=h.ctx;const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
const U=h.sheets.Users.d; const setPw=(name,pw)=>{const r=U.find(x=>x[0]===name); r[1]=C.hashPassword_(pw); r[4]='FALSE'};
const upd=(name,tier,depts)=>{const r=U.find(x=>x[0]===name); r[2]=tier; r[3]=depts};
(async()=>{
C.PropertiesService.getScriptProperties().setProperty('HEAD_SEED_V1','done');
 upd('อรทัย','head','ER,NSO'); upd('ชูใจ','head','NSO,OPD');
 U.push(['หัวหน้าพยาบาล','x','staff','NSO,OPD','FALSE','','']); U.push(['หัวหน้าตึกหรือหัวหน้าหน่วยงานพยาบาลแต่ละฝ่าย','x','staff','NSO','FALSE','','']);
 ['Admin','อรทัย','ชูใจ','เดือนเพ็ญ','ผอ.'].forEach(n=>setPw(n,'pw123456'));
 const kp=U.find(x=>x[0]==='สมศรี'); if(!kp)U.push(['สมศรี','x','staff','IPD,NSO','FALSE','','']); setPw('สมศรี','pw123456');
 const at=C.createSession_('Admin',U.find(r=>r[0]==='Admin')[1]);
 assert(C.nsoImportCommit(at).wrote.added===521);
 // the import auto-tidies; for the UI flow test restore the un-tidied state: re-run via backup copy
 const Y70=h.sheets['ปีงบ 2570'], Y69=h.sheets['ปีงบ 2569'];
 const bk70=h.sheets['สำรองก่อนจัดระเบียบ ปีงบ 2570']||h.sheets['สำรองก่อนย้ายรายละเอียด ปีงบ 2570'], bk69=h.sheets['สำรองก่อนจัดระเบียบ ปีงบ 2569']||h.sheets['สำรองก่อนย้ายรายละเอียด ปีงบ 2569'];
 assert(bk70&&bk69,'tidy backup created by import');
 Y70.d=bk70.d.map(r=>r.slice()); Y69.d=bk69.d.map(r=>r.slice()); delete h.sheets['Tidy_Log'];
 [Y70,Y69].forEach(Y=>{const r=Y.d.find(x=>x[0]==='NURSE-KPI-0000000000625'); r[25]='หัวหน้าพยาบาล / หัวหน้าตึกหรือหัวหน้าหน่วยงานพยาบาลแต่ละฝ่าย'; r[28]='รายบุคคล, หน่วยงาน';});
 U.splice(0,U.length,...U); // keep users untouched (merge/delete still pending)
 console.log('U before browser',JSON.stringify(U.find(r=>r[0]==='อรทัย')));
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mk=async(vw=1440,vh=900)=>{const pg=await b.newPage({viewport:{width:vw,height:vh}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>{const u=r.request().url();if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});return r.abort()});
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');return pg};
 const login=async(pg,u,p)=>{await pg.fill('#login-username',u);await pg.fill('#login-password',p);await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(400)};
 // ---------- admin: before tidy
 let pg=await mk(); await login(pg,'Admin','pw123456');
 const before=await pg.evaluate(()=>({numbered:globalDatabase.filter(k=>/^\s*[0-9๐-๙\-]/.test(k.name)).length,placeholders:globalDatabase.filter(k=>kpiCats(k).some(c=>c.category==='รอจัดหมวดย่อย')).length}));
 console.log('before',JSON.stringify(before)); assert(before.numbered>300&&before.placeholders>100);
 // ---------- tidy modal
 await pg.click('#admin-settings-btn'); await pg.waitForSelector('#modal-settings',{state:'visible'}); await pg.waitForTimeout(400);
 await pg.click('button:has-text("จัดระเบียบข้อมูล")'); await pg.waitForSelector('#tidy-body .note, #tidy-body details',{timeout:20000}); await pg.waitForTimeout(300);
 const prevTxt=await pg.innerText('#tidy-body'); console.log('preview text:',prevTxt.replace(/\n+/g,' | ').slice(0,300));
 assert(!(await pg.isDisabled('#tidy-commit-btn')));
 await pg.screenshot({path:'ui31-tidy.png'});
 await pg.click('#tidy-commit-btn'); await pg.click('#modal-confirm button:has-text("ยืนยัน")'); await pg.waitForFunction(()=>document.getElementById('tidy-body').innerText.includes('ผลการจัดระเบียบ'),null,{timeout:30000}); await pg.waitForTimeout(800);
 const doneTxt=await pg.innerText('#tidy-body'); console.log('done text:',doneTxt.replace(/\n+/g,' | ').slice(0,260));
 assert(await pg.isDisabled('#tidy-commit-btn'));
 await pg.click('#modal-tidy button:has-text("ปิด")'); await pg.click('#modal-settings button:has-text("ยกเลิก")'); await pg.waitForTimeout(600);
 const after=await pg.evaluate(()=>({numbered:globalDatabase.filter(k=>/^\s*[0-9๐-๙\-]/.test(k.name)).length,placeholders:globalDatabase.filter(k=>kpiCats(k).some(c=>c.category==='รอจัดหมวดย่อย')).length,parents:globalDatabase.filter(k=>k.parentId).length,groups:globalDatabase.filter(k=>k.group).length}));
 console.log('after',JSON.stringify(after)); assert(after.numbered<=3&&after.placeholders===0&&after.parents>100);
 // users merged/deleted
 const names=U.filter(r=>r[0]).map(r=>r[0]); assert(!names.includes('หัวหน้าพยาบาล')&&!names.includes('ผอ.')&&names.includes('ประภาพร'),'users tidy: '+names.filter(n=>/หัวหน้า|ผอ|ประภาพร/.test(n)));
 console.log('users ok',JSON.stringify(h.sheets.Users.d.find(r=>r[0]==='อรทัย')));
 // ---------- unit view tree: groups + children
 await pg.evaluate(()=>{setTreeView('unit')}); await pg.waitForTimeout(700);
 await pg.evaluate(()=>{document.querySelectorAll('.accordion-part').forEach(p=>p.classList.add('open'));document.querySelectorAll('.category-block').forEach(c=>c.classList.add('open'))});
 const tr=await pg.evaluate(()=>({groups:document.querySelectorAll('.tree-group').length,children:document.querySelectorAll('.kpi-link-item.child').length,cats:Array.from(document.querySelectorAll('.accordion-part[data-part="ER"] .category-header span:first-child')).map(e=>e.innerText)}));
 console.log('tree',JSON.stringify(tr)); assert(tr.groups===0&&tr.children>30&&tr.cats.length>=4&&!tr.cats.some(c=>/^มิติที่/.test(c)));
 await pg.screenshot({path:'ui31-tree.png'});
 // child follows its parent in order
 const ord=await pg.evaluate(()=>{const arr=getOrderedKpis(false,'unit');let bad=0;arr.forEach((p,i)=>{if(p.depth>0){const prev=arr[i-1];if(!prev||(prev.id!==p.parentId&&!(prev.parentId===p.parentId)&&!(prev.depth>=1)))bad++}});return {n:arr.length,bad}}); console.log('order',JSON.stringify(ord)); assert(ord.bad===0);
 // card parent badge navigates
 const cid=await pg.evaluate(()=>{const k=globalDatabase.find(k=>k.parentId&&getOrderedKpis(false,'unit').some(p=>p.id===k.id));return k&&k.id});
 await pg.evaluate(id=>{goToKpi(id)},cid); await pg.waitForTimeout(700);
 const badge=await pg.evaluate(id=>{const c=document.querySelector('.kpi-card[data-id="'+id+'"] .parent-badge');return c?{pid:c.dataset.pid,t:c.innerText}:null},cid); console.log('badge',JSON.stringify(badge)); assert(badge);
 await pg.click('.kpi-card[data-id="'+cid+'"] .parent-badge'); await pg.waitForTimeout(800);
 assert(await pg.evaluate(pid=>!!document.querySelector('.kpi-card[data-id="'+pid+'"]'),badge.pid)); 
 // report ↳
 await pg.click('#menu-report-btn'); await pg.waitForSelector('#rp-cat-list label'); await pg.waitForTimeout(600);
 const rp=await pg.evaluate(()=>{const s=buildPrintHtml(rpt.opts,true);return s.includes('pr-subkpi')&&/<td>[๐-๙]+\.[๐-๙]+<\/td>/.test(s)}); assert(rp,'report shows sub numbers (Thai digits)');
 // view tab highlight colors
 await pg.click('#menu-home-btn'); await pg.waitForTimeout(400);
 await pg.evaluate(()=>{document.querySelectorAll('#view-tabs .view-tab').forEach(b=>{b.classList.add('active')})}); await pg.waitForTimeout(400);
 const colors=await pg.evaluate(()=>{const o={};['hosp','qa','unit'].forEach(v=>{const b=document.querySelector('#view-tabs .view-tab[data-view="'+v+'"]');o[v]=[getComputedStyle(b).backgroundColor,getComputedStyle(b).color]});return o}); console.log('tab colors',JSON.stringify(colors));
 assert(colors.hosp[0]==='rgb(22, 163, 74)'&&colors.qa[0]==='rgb(14, 116, 144)'&&colors.unit[0]==='rgb(124, 58, 237)'&&colors.unit[1]==='rgb(255, 255, 255)');
 console.log('admin errors',pg._errs); await pg.close();
 // ---------- head-ward permission
 const getK=(user,name)=>{const UU=h.sheets.Users.d;const t=C.createSession_(user,UU.find(r=>r[0]===user)[1]);const d=C.getAllData(t,2570);if(!d.success)console.log('GETALL FAIL',user,d.message); else console.log('getAll',user,d.data.length,'tier',C.requireUser_(t).tier,JSON.stringify(C.requireUser_(t).depts));return d.data.find(k=>k.id==='NURSE-KPI-0000000000625')};
 const wardName=C.getAllData(C.createSession_('Admin',h.sheets.Users.d.find(r=>r[0]==='Admin')[1]),2570).data.find(k=>k.id==='NURSE-KPI-0000000000625');
 console.log('ward KPI',wardName&&wardName.name.slice(0,30),'owner=',wardName&&wardName.owner);
 assert(wardName&&wardName.owner.includes('เดือนเพ็ญ')&&wardName.owner.includes('หัวหน้าตึก'));
 for(const [u,exp] of [['อรทัย',true],['ชูใจ',true],['เดือนเพ็ญ',true],['สมศรี',false]]){const k=getK(u,wardName.name); console.log(u,'sees?',!!k,'mine=',k&&k.mine,'isOwner=',k&&k.isOwner,'edit=',k&&k.canEditResults); if(exp){assert(k&&k.isOwner&&k.canEditResults,u+' should own ward KPI')} else {assert(!k||!k.isOwner,u+' must not own')}}
 const adm=getK('Admin',wardName.name); console.log('Admin isOwner',adm.isOwner);
 await b.close(); console.log('UI31 OK');
})();
