const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness2');const C=h.ctx;const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
const U=h.sheets.Users.d; const setPw=(n,p)=>{const r=U.find(x=>x[0]===n);r[1]=C.hashPassword_(p);r[4]='FALSE'};
(async()=>{
 C.PropertiesService.getScriptProperties().setProperty('HEAD_SEED_V1','done');
 ['ธวัชชัย','รินทร์ลภัส','อรทัย','ดวงแก้ว','รุจีพร'].forEach(n=>{if(!U.find(r=>r[0]===n))U.push([n,'x',n==='ดวงแก้ว'||n==='รุจีพร'?'staff':'head','ER','FALSE','','']);});
 U.find(r=>r[0]==='ธวัชชัย')[3]='PCT,MSO'; setPw('Admin','pw123456'); setPw('ธวัชชัย','pw123456'); setPw('ดวงแก้ว','pw123456');
 const at=C.createSession_('Admin',U.find(r=>r[0]==='Admin')[1]); assert(C.nsoImportCommit(at).success); C.tidyCommit(at);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mk=async()=>{const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');return pg};
 const login=async(pg,u,p)=>{await pg.fill('#login-username',u);await pg.fill('#login-password',p);await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(500)};
 let pg=await mk(); await login(pg,'Admin','pw123456');
 await pg.click('#admin-settings-btn'); await pg.waitForSelector('#modal-settings',{state:'visible'}); await pg.waitForTimeout(400);
 await pg.click('button:has-text("นำเข้าตัวชี้วัด PCT")'); await pg.waitForSelector('#pct-body details',{timeout:20000});
 const prev=await pg.innerText('#pct-body'); console.log('preview:',prev.replace(/\n+/g,' | ').slice(0,260));
 assert(!(await pg.isDisabled('#pct-commit-btn')));
 await pg.screenshot({path:'ui34-pct.png'});
 await pg.click('#pct-commit-btn'); await pg.click('#modal-confirm button:has-text("ยืนยัน")');
 await pg.waitForFunction(()=>document.getElementById('pct-body').innerText.includes('ผลการนำเข้า'),null,{timeout:40000}); await pg.waitForTimeout(800);
 console.log('done:',(await pg.innerText('#pct-body')).replace(/\n+/g,' | ').slice(0,200));
 assert(await pg.isDisabled('#pct-commit-btn'));
 await pg.click('#modal-pct button:has-text("ปิด")'); await pg.click('#modal-settings button:has-text("ยกเลิก")'); await pg.waitForTimeout(700);
 // admin unit view: PCT category with sub numbers
 await pg.evaluate(()=>setTreeView('unit')); await pg.waitForTimeout(600);
 const info=await pg.evaluate(()=>{const arr=getOrderedKpis(false,'unit').filter(p=>p.part==='PCT');const nums=arr.map(p=>kpiNumber(p));return {n:arr.length,subs:nums.filter(x=>x.includes('.')).length,roots:nums.filter(x=>!x.includes('.')).length,cats:[...new Set(arr.map(p=>p.category))],sample:arr.slice(0,8).map(p=>kpiNumber(p)+' '+p.name.slice(0,30))}});
 console.log('PCT unit view',JSON.stringify(info)); assert(info.n>150&&info.subs>60&&info.cats.length>=2);
 // ward child shows in PCT group as child with badge
 const kid=await pg.evaluate(()=>{const k=globalDatabase.find(x=>x.parentId&&/\(IPD\)$/.test(x.name));return k&&{id:k.id,name:k.name,parent:globalDatabase.find(x=>x.id===k.parentId).name}}); console.log('kid',JSON.stringify(kid)); assert(kid);
 await pg.screenshot({path:'ui34-tree.png'});
 // PCT head sees everything of PCT; staff in PCT sees cards of their merged KPI
 const pg2=await mk(); await login(pg2,'ธวัชชัย','pw123456');
 const hv=await pg2.evaluate(()=>({total:globalDatabase.length,pct:globalDatabase.filter(k=>(k.cats||[]).some(c=>c.part==='PCT')).length,canEdit:globalDatabase.filter(k=>(k.cats||[]).some(c=>c.part==='PCT')&&k.canEditDetails).length}));
 console.log('head',JSON.stringify(hv)); assert(hv.pct>150&&hv.canEdit>=hv.pct-5);
 const pg3=await mk(); await login(pg3,'ดวงแก้ว','pw123456');
 const sv=await pg3.evaluate(()=>({mine:globalDatabase.filter(k=>k.isOwner).length,merged:globalDatabase.filter(k=>k.isOwner&&(k.cats||[]).some(c=>c.part==='PCT')).length}));
 console.log('staff',JSON.stringify(sv)); assert(sv.merged>=1);
 for(const p of [pg,pg2,pg3])assert(p._errs.length===0,p._errs.join());
 await b.close(); console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
