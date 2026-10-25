const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness2');const C=h.ctx;const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
const U=h.sheets.Users.d; const r0=U.find(x=>x[0]==='Admin'); r0[1]=C.hashPassword_('pw123456'); r0[4]='FALSE';
(async()=>{
 C.PropertiesService.getScriptProperties().setProperty('HEAD_SEED_V1','done');
 const at=C.createSession_('Admin',r0[1]); assert(C.nsoImportCommit(at).success);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username','Admin');await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(400);
 await pg.evaluate(()=>setTreeView('unit')); await pg.evaluate(()=>switchMenu('report')); await pg.waitForTimeout(1500);
 const chk=(sel)=>pg.evaluate(sel=>{const rows=[...document.querySelectorAll(sel+' table.pr-table')].filter(t=>t.querySelector('th').innerText.trim()==='ที่').flatMap(t=>[...t.querySelectorAll('tbody tr')]);const out={main:0,sub:0,badMain:0,badSub:0,otherBold:0};
   rows.forEach(tr=>{const tds=[...tr.children];const num=tds[0],name=tds[1];const isSub=num.innerText.includes('.')&&/[0-9]\.[0-9]/.test(num.innerText);
     const wn=getComputedStyle(num).fontWeight,wm=getComputedStyle(name).fontWeight;const bold=w=>Number(w)>=600;
     if(isSub){out.sub++;if(bold(wn)||bold(wm))out.badSub++}else{out.main++;if(!bold(wn)||!bold(wm))out.badMain++}
     tds.slice(2).forEach(td=>{if(!td.classList.contains('pr-target')&&bold(getComputedStyle(td).fontWeight))out.otherBold++})});return out},sel);
 const a=await chk('#rp-paper'); console.log('preview',JSON.stringify(a)); assert(a.main>0&&a.badMain===0&&a.badSub===0&&a.otherBold===0);
 await pg.evaluate(()=>{document.getElementById('print-root').innerHTML=buildPrintHtml(rpt.opts,false)});
 const p=await chk('#print-root'); console.log('print',JSON.stringify(p)); assert(p.main>0&&p.badMain===0&&p.badSub===0&&p.otherBold===0);
 // print media check: emulate print
 await pg.emulateMedia({media:'print'}); const pm=await pg.evaluate(()=>{const td=document.querySelector('#print-root table.pr-table td.pr-main');return td?getComputedStyle(td).fontWeight:null}); console.log('print media bold',pm); assert(Number(pm)>=600);
 await pg.emulateMedia({media:'screen'});
 await pg.evaluate(()=>{document.getElementById('print-root').innerHTML='';rpt.opts={table:true};rpt.size=50;const pages=Math.ceil(rptRowCount()/50);for(let p=1;p<=pages;p++){rpt.page=p;rptRenderPreview();if(document.querySelector('#rp-paper td.pr-subkpi'))break;}}); await pg.waitForTimeout(800);
 const y=await pg.evaluate(()=>{const t=[...document.querySelectorAll('#rp-paper table.pr-table')].find(t=>t.querySelector('td.pr-subkpi'));const r=t.querySelector('td.pr-subkpi').closest('tr').previousElementSibling;r.scrollIntoView({block:'center'});return 1}); await pg.waitForTimeout(300); await pg.screenshot({path:'ui33.png'});
 assert(errs.length===0,errs.join()); await b.close(); console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
