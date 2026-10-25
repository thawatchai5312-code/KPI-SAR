// report numbering: continuous 1..N across the whole report (tables, headings, 🔗 notes), subs follow parent (15.1), multi-cat = new no. each time, preview == PDF, parent filtered out → main
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE");
const U=h.sheets.Users.d;const ad=U.find(r=>r[2]==='admin');ad[1]=C.hashPassword_('pw123456');ad[4]='FALSE';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.evaluate(()=>{setScopeFilter('all');switchMenu('report')});await pg.waitForTimeout(1500);
 const analyse=()=>pg.evaluate(()=>{
   const parse=(htm)=>{const d=document.createElement('div');d.innerHTML=htm;
     const tbl=[...d.querySelectorAll('table.pr-table')].filter(t=>t.querySelector('th')&&t.querySelector('th').textContent==='ที่');
     const yearly=tbl.filter((t,i)=>i%2===0).flatMap(t=>[...t.querySelectorAll('tbody tr')].map(r=>r.cells[0].textContent));
     const monthly=tbl.filter((t,i)=>i%2===1).flatMap(t=>[...t.querySelectorAll('tbody tr')].map(r=>r.cells[0].textContent));
     const titles=[...d.querySelectorAll('.pr-kpi-title')].map(x=>x.textContent.split(' ')[0]);
     const cats=d.querySelectorAll('.pr-cat').length;
     const notes=[...d.querySelectorAll('.pr-note')].map(x=>x.textContent);
     return {yearly,monthly,titles,cats,notes};};
   rpt.opts={table:true,chart:true,detail:true,source:false,owner:false};
   const full=parse(buildPrintHtmlRaw(rpt.opts,true,0)), prev=parse(buildPrintHtmlRaw(rpt.opts,true,40));
   const chosen=rptChosen();
   const multi=chosen.filter(k=>chosen.filter(x=>x.id===k.id).length>1).length;
   return {full,prev,multi,total:chosen.length};});
 let subSeen=0;for(const view of ['hosp','qa','unit']){await pg.evaluate(v=>{treeView=v;rptRenderPreview()},view);await pg.waitForTimeout(300);let a=await analyse();console.log('== view',view);
 const F=a.full;subSeen+=F.yearly.filter(x=>x.includes('.')).length;console.log('rows',F.yearly.length,'cats',F.cats,'multi-placements',a.multi,'subs',F.yearly.filter(x=>x.includes('.')).length);
 assert(F.cats>5&&F.yearly.length===a.total);assert.deepStrictEqual(F.monthly,F.yearly,'monthly == yearly numbering');
 // mains run 1..N, never restart; subs = previous main/sub prefix
 let main=0,last={};F.yearly.forEach((no,i)=>{const p=no.split('.');if(p.length===1){assert.strictEqual(+no,++main,'main seq at '+i+' got '+no);}else{assert(p[0]===String(main)||F.yearly.slice(0,i).includes(p.slice(0,-1).join('.')),'sub '+no+' parent prefix');}});
 assert(main>100,'continuous across categories '+main);
 assert(new Set(F.yearly).size===F.yearly.length,'each appearance unique number (multi-cat gets new no.)');
 assert.deepStrictEqual(F.titles.map(t=>t.replace(/\.$/,'')),F.yearly,'headings use same numbers');
 assert.deepStrictEqual(a.prev.yearly,F.yearly.slice(0,a.prev.yearly.length),'preview == pdf numbers');
 const note=F.notes.find(n=>/ข้อ \d+/.test(n));if(note){const ns=[...note.matchAll(/ข้อ ([\d.]+)/g)].map(m=>m[1].replace(/\.$/,''));assert(ns.every(n=>F.yearly.includes(n)),'notes use report numbers '+note);console.log('note',note.slice(0,120));}
 }
 assert(subSeen>0,'some view has subs');
 // parent filtered out → sub becomes main number
 await pg.evaluate(()=>{treeView='unit'});
 const sub=await pg.evaluate(()=>{const ch=rptChosen();const s=ch.find(k=>k.parentId&&ch.some(p=>p.id===k.parentId&&p.part===k.part&&p.category===k.category));if(!s)return null;
   const par=globalDatabase.find(p=>p.id===s.parentId);const keep=globalDatabase;
   globalDatabase=globalDatabase.filter(k=>k.id!==par.id);dbVersion++;
   const d=document.createElement('div');d.innerHTML=buildPrintHtmlRaw({table:true},true,0);
   const rows=[...d.querySelectorAll('table.pr-table tbody tr')].map(r=>[r.cells[0].textContent,r.cells[1].textContent]);
   globalDatabase=keep;dbVersion++;
   return rows.find(r=>r[1]===s.name||s.name.startsWith(r[1].replace('…','')));});
 assert(sub&&!sub[0].includes('.'),'orphan sub numbered as main '+JSON.stringify(sub));console.log('orphan sub →',sub[0]);
 // rendered preview + thai digits still OK
 await pg.evaluate(()=>rptRenderPreview());const firstNo=await pg.evaluate(()=>document.querySelector('#rp-paper table.pr-table tbody tr td').textContent);assert(firstNo==='๑',firstNo);
 assert(errs.length===0,errs.join());await b.close();console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
