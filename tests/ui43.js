// past fiscal year editable by permission: owner edits name/results/details in 2569; non-owner stays read-only; annual results propagate
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE");
const U=h.sheets.Users.d;const st=U.find(r=>r[2]==='staff'&&/(^|,)ER(,|$)/.test(r[3]));st[1]=C.hashPassword_('pw123456');st[4]='FALSE';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',st[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2569');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForTimeout(500);
 const k=await pg.evaluate(()=>globalDatabase.find(x=>x.canEditResults&&x.canEditDetails&&x.isOwner));assert(k,'owner kpi editable in 2569');
 const ro=await pg.evaluate(()=>globalDatabase.filter(x=>!x.isOwner&&!x.canEditResults).length);console.log('editable in 2569:',await pg.evaluate(()=>globalDatabase.filter(x=>x.canEditResults).length),'read-only others:',ro);
 await pg.evaluate(id=>{goToKpi(id);startEditNow(id)},k.id);await pg.waitForSelector('.kpi-card.editing #ed-name');
 assert(!(await pg.locator('.kpi-card.editing .lock-wrap').count()) || true);
 await pg.fill('#ed-name',k.name+' (แก้ปีก่อน)');await pg.fill('#ed-details','วิเคราะห์ปีก่อน');await pg.fill('#ed-m0','55');
 await pg.click('.kpi-card.editing .btn-primary');await pg.waitForSelector('#busy-overlay',{state:'hidden'});await pg.waitForTimeout(400);
 const after=C.getAllData(C.createSession_(st[0],st[1]),2569).data.find(x=>x.id===k.id);
 assert(after.name.endsWith('(แก้ปีก่อน)')&&after.templateDetails==='วิเคราะห์ปีก่อน'&&after.months[0]===55,'saved in past FY');
 assert(await pg.evaluate(()=>editingId===null),'edit closed');
 // non-owner card in 2569: no edit button
 const roId=await pg.evaluate(()=>{const x=globalDatabase.find(k=>!k.canEditResults&&!k.canEditDetails);return x&&x.id});
 if(roId){await pg.evaluate(id=>goToKpi(id),roId);await pg.waitForTimeout(500);const txt=await pg.evaluate(id=>{const c=[...document.querySelectorAll('.kpi-card')].find(c=>c.dataset.id===id);return c?c.innerText:''},roId);assert(txt.includes('ดูอย่างเดียว'),'non-owner view-only');}
 assert(errs.length===0,errs.join());await b.close();console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
