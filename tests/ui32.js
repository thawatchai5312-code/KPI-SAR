const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness2');const C=h.ctx;const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
const U=h.sheets.Users.d; const setPw=(name,pw)=>{const r=U.find(x=>x[0]===name); r[1]=C.hashPassword_(pw); r[4]='FALSE'};
(async()=>{
 C.PropertiesService.getScriptProperties().setProperty('HEAD_SEED_V1','done');
 ['Admin'].forEach(n=>setPw(n,'pw123456'));
 const at=C.createSession_('Admin',U.find(r=>r[0]==='Admin')[1]);
 assert(C.nsoImportCommit(at).success);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mk=async(vw=1440,vh=900)=>{const pg=await b.newPage({viewport:{width:vw,height:vh}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>{const u=r.request().url();if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});return r.abort()});
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');return pg};
 const login=async(pg,u,p)=>{await pg.fill('#login-username',u);await pg.fill('#login-password',p);await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(400)};
 let pg=await mk(); await login(pg,'Admin','pw123456');
 // numbering: roots sequential, children parent.n
 const nums=await pg.evaluate(()=>{const out={bad:0,sub:0,samples:[]};const byCat={};
   globalDatabase.forEach(k=>placementsOf(k).forEach(p=>{(byCat[p.part+'||'+p.category]=byCat[p.part+'||'+p.category]||[]).push(p)}));
   Object.values(byCat).forEach(ps=>{const roots=ps.map(p=>kpiNumber(p)).filter(n=>n.indexOf('.')===-1).map(Number).sort((a,b)=>a-b);roots.forEach((n,i)=>{if(n!==i+1)out.bad++});
     ps.forEach(p=>{const n=kpiNumber(p);if(n.indexOf('.')!==-1){out.sub++;const pn=kpiNumber({part:p.part,category:p.category,id:p.parentId});if(n.slice(0,n.lastIndexOf('.'))!==pn)out.bad++;if(out.samples.length<4)out.samples.push(n+' '+p.name.slice(0,30)+' ⟵ '+pn)}})});return out});
 console.log('numbering',JSON.stringify(nums)); assert(nums.bad===0&&nums.sub>50);
 // tree shows 4.1 style labels for children
 await pg.evaluate(()=>{setTreeView('unit')}); await pg.waitForTimeout(600);
 await pg.evaluate(()=>{document.querySelectorAll('.accordion-part').forEach(p=>p.classList.add('open'));document.querySelectorAll('.category-block').forEach(c=>c.classList.add('open'))});
 const tl=await pg.evaluate(()=>{const ch=Array.from(document.querySelectorAll('.kpi-link-item.child .kn')).map(e=>e.innerText);return {n:ch.length,ok:ch.every(t=>/^\d+\.\d+(\.\d+)?$/.test(t)),s:ch.slice(0,5),arrows:document.querySelectorAll('.kpi-link-item .kn').length&&Array.from(document.querySelectorAll('.kpi-link-item .kn')).filter(e=>e.innerText.includes('↳')).length}});
 console.log('tree labels',JSON.stringify(tl)); assert(tl.n>30&&tl.ok&&tl.arrows===0);
 // pick a root KPI in a unit category with ≥3 roots and make the 3rd root a child of the 1st through the edit card
 const pick=await pg.evaluate(()=>{const arr=getOrderedKpis(false,'unit');const by={};arr.forEach(p=>{if(!p.depth&&kpiNumber(p).indexOf('.')===-1)(by[p.part+'||'+p.category]=by[p.part+'||'+p.category]||[]).push(p)});
   const c=Object.keys(by).find(k=>by[k].length>=4&&!globalDatabase.some(x=>x.parentId===by[k][2].id));const ps=by[c];return {cat:c,parent:ps[0].id,pno:kpiNumber(ps[0]),child:ps[2].id,key:ps[2].key,cno:kpiNumber(ps[2]),nextNo:kpiNumber(ps[3]),nextId:ps[3].id,nextKey:ps[3].key}});
 console.log('pick',JSON.stringify(pick));
 await pg.evaluate(p=>{goToKpi(p.child,p.key)},pick); await pg.waitForTimeout(600);
 await pg.evaluate(p=>startEdit(p.child,p.key),pick); await pg.waitForTimeout(500);
 const opts=await pg.evaluate(()=>Array.from(document.querySelectorAll('#ed-parent option')).map(o=>[o.value,o.innerText.slice(0,40)]));
 console.log('options',opts.length,JSON.stringify(opts.slice(0,4)));
 assert(opts.length>3&&opts.some(o=>o[0]===pick.parent)&&!opts.some(o=>o[0]===pick.child));
 await pg.selectOption('#ed-parent',pick.parent); await pg.waitForTimeout(200);
 assert(await pg.isVisible('#dirty-mark'),'dirty mark shown');
 await pg.evaluate(()=>document.getElementById('ed-parent').scrollIntoView({block:'center'})); await pg.waitForTimeout(300); await pg.screenshot({path:'ui32-edit.png'});
 await pg.evaluate(()=>saveKpiEdit()); await pg.waitForTimeout(1200);
 const res=await pg.evaluate(p=>{const k=globalDatabase.find(x=>x.id===p.child);const pl=placementsOf(k).find(x=>x.part+'||'+x.category===p.cat);return {pid:k.parentId,no:kpiNumber(pl),next:kpiNumber(placementsOf(globalDatabase.find(x=>x.id===p.nextId)).find(x=>x.part+'||'+x.category===p.cat)),title:document.querySelector('.kpi-card[data-id="'+p.child+'"] .kpi-card-title')?.innerText,badge:document.querySelector('.kpi-card[data-id="'+p.child+'"] .parent-badge')?.innerText}},pick);
 console.log('after save',JSON.stringify(res));
 assert.strictEqual(res.pid,pick.parent); assert(res.no.startsWith(pick.pno+'.'),'child numbered under parent'); assert.strictEqual(String(res.next),String(Number(pick.nextNo)-1),'roots renumbered');
 assert(res.badge&&res.badge.includes('ข้อ '+pick.pno+'.'));
 // server stored it
 const row=h.sheets['ปีงบ 2570'].d.find(r=>r[0]===pick.child); assert.strictEqual(row[37],pick.parent);
 // clear again
 await pg.evaluate(p=>startEdit(p.child,p.key),pick); await pg.waitForTimeout(400);
 await pg.selectOption('#ed-parent',''); await pg.evaluate(()=>saveKpiEdit()); await pg.waitForTimeout(1000);
 assert.strictEqual(h.sheets['ปีงบ 2570'].d.find(r=>r[0]===pick.child)[37],'');
 // report page: Thai digits in document, Arabic outside
 await pg.evaluate(()=>switchMenu('report')); await pg.waitForTimeout(1500);
 const rp=await pg.evaluate(()=>{const t=document.getElementById('rp-paper').innerText;return {arabic:(t.match(/[0-9]/g)||[]).length,thai:(t.match(/[๐-๙]/g)||[]).length,svgArabic:Array.from(document.querySelectorAll('#rp-paper svg text')).filter(e=>/[0-9]/.test(e.textContent)).length,more:document.getElementById('rp-more').innerText.slice(0,60),side:(document.getElementById('rp-side').innerText.match(/[0-9]/g)||[]).length,len:t.length}});
 console.log('report',JSON.stringify(rp)); assert(rp.len>500&&rp.arabic===0&&rp.thai>50&&rp.svgArabic===0&&rp.side>0);
 await pg.screenshot({path:'ui32-report.png'});
 // print html too
 const pr=await pg.evaluate(()=>{const s=buildPrintHtml(rpt.opts,false);const d=document.createElement('div');d.innerHTML=s;return {arabic:(d.innerText.match(/[0-9]/g)||[]).length,hasStyleNums:/width:\d/.test(s)}});
 console.log('print',JSON.stringify(pr)); assert(pr.arabic===0&&pr.hasStyleNums);
 // home page: names use Arabic digits (after import-tidy)
 await pg.evaluate(()=>switchMenu('home')); await pg.waitForTimeout(800);
 const home=await pg.evaluate(()=>({thaiInNames:globalDatabase.filter(k=>/[๐-๙]/.test(k.name+k.target+k.templateDetails+k.dataSource)).length}));
 console.log('home',JSON.stringify(home)); assert.strictEqual(home.thaiInNames,0);
 console.log('errors',pg._errs); assert(pg._errs.length===0);
 await b.close(); console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
