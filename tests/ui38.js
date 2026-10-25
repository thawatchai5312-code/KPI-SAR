// report/print: multi-category KPI → results tables in every category, detail once, reference note elsewhere
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness5');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE");
const U=h.sheets.Users.d; const r=U.find(x=>x[0]==='Admin'); r[1]=C.hashPassword_('pw123456'); r[4]='FALSE';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username','Admin');await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(500);
 await pg.evaluate(()=>switchMenu('report')); await pg.waitForTimeout(1500);
 const res=await pg.evaluate(()=>{
   const multi=globalDatabase.find(k=>kpiCats(k).filter(c=>isCorePart(c.part)).length>=2);
   const div=document.createElement('div');div.innerHTML=buildPrintHtmlRaw({table:true,chart:true,detail:true,source:true,owner:true},true);
   const rows=[...div.querySelectorAll('table.pr-table td.pr-left')].filter(td=>td.textContent===multi.name||multi.name.startsWith(td.textContent.replace('…','')));
   const blocks=[...div.querySelectorAll('.pr-block')].filter(bk=>bk.querySelector('.pr-kpi-title').textContent.includes(multi.name));
   const unique=uniqueById(rptChosen()).length, pls=rptChosen().length;
   return {name:multi.name,cats:kpiCats(multi).filter(c=>isCorePart(c.part)).map(c=>c.part+' › '+c.category),rows:rows.length,full:blocks.filter(x=>!x.classList.contains('pr-ref')).length,ref:blocks.filter(x=>x.classList.contains('pr-ref')).length,
     note:(blocks[0].querySelector('.pr-note')||{}).textContent,refNote:(blocks.find(x=>x.classList.contains('pr-ref'))||{querySelector:()=>({})}).querySelector('.pr-note').textContent,
     detailInRef:blocks.filter(x=>x.classList.contains('pr-ref')).some(x=>x.querySelector('.pr-label')),
     info:div.querySelector('.pr-info').textContent,unique,pls,
     allBlocks:div.querySelectorAll('.pr-block').length,fullBlocks:div.querySelectorAll('.pr-block:not(.pr-ref)').length};
 });
 console.log(JSON.stringify(res,null,1));
 const n=res.cats.length;
 assert(res.rows===2*n,'results rows (annual+monthly) per category');
 assert(res.full===1&&res.ref===n-1&&!res.detailInRef);
 assert(res.note.includes(n+' หมวด')&&res.refNote.includes('เป็นตัวชี้วัดเดียวกับ'));
 assert(res.fullBlocks===res.unique&&res.allBlocks===res.pls&&res.info.includes(res.unique+' ตัวชี้วัด'));
 // preview on screen shows the note too
 await pg.evaluate(()=>{rpt.size=50;rpt.page=1;rptRenderPreview()});await pg.waitForTimeout(600);
 const prev=await pg.evaluate(()=>document.querySelectorAll('#rp-paper .pr-note').length); console.log('preview notes',prev); assert(prev>0);
 await pg.evaluate(()=>{const p=document.getElementById('rp-paper');p.innerHTML=buildPrintHtml(rpt.opts,true);const el=p.querySelector('.pr-block.pr-ref');const pv=[...p.querySelectorAll('.pr-block:not(.pr-ref) .pr-note')][0];window.__y=[pv.getBoundingClientRect().top+scrollY,el.getBoundingClientRect().top+scrollY];}); await pg.waitForTimeout(300);
 const ys=await pg.evaluate(()=>window.__y); for(const [i,y] of ys.entries()){await pg.evaluate(y=>window.scrollTo(0,y-200),y);await pg.waitForTimeout(200);await pg.screenshot({path:'ui38-'+i+'.png'});}
 assert(errs.length===0,errs.join()); await b.close(); console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
