// ปีงบใหม่: ดึงข้อความ SAR/CLT จากปีก่อนเป็นร่าง — ปุ่ม admin · ป้ายร่าง · ยังไม่นับว่ากรอกแล้ว · ปุ่มยืนยัน · เตือนตอน Export · ผู้ที่ไม่ใช่ admin ไม่เห็นปุ่ม
// ต้องมี tests/fixtures/lib/pptxgen.bundle.js (npm pptxgenjs@4.0.1 dist/pptxgen.bundle.js — ใช้แทน CDN ตอนเทสต์)
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const PPTX_LIB=path.join(__dirname,'fixtures/lib/pptxgen.bundle.js');assert(fs.existsSync(PPTX_LIB),'missing '+PPTX_LIB);
const U=h.sheets.Users.d;const fy=2570;
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
   if(/pptxgenjs@4\.0\.1\/dist\/pptxgen\.bundle\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(PPTX_LIB)});
   return r.abort()});
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',user[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForSelector('#kpi-table');
 return pg;
}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ex2=pick('executive');ex2[1]=C.hashPassword_('pw123456');ex2[4]='FALSE';
 const pg=await open(b,ad);
 await pg.click('#menu-sar-btn');await pg.waitForSelector('#sar-pager-top .pager');
 const id=await pg.evaluate(()=>sarFlat(sarTreeOf(sarChosen()))[0].id);
 // ข้อมูลปีงบ 2569 (ปีก่อน)
 assert(C.saveSarPdca(tA,2569,id,'ปัญหาที่พบ ปีก่อน',0).success);
 assert(C.saveCltItem(tA,2569,'O|mission','พันธกิจปีก่อน',0).success);
 assert(C.saveCltItem(tA,2569,'D|STEMI|context','บริบทปีก่อน',0).success);
 assert(C.saveCltItem(tA,2569,'S|groups',JSON.stringify(['STEMI']),0).success);
 // ปุ่มเห็นเฉพาะ admin
 assert(await pg.evaluate(()=>[...document.querySelectorAll('#sar-controls .doc-carry-btn')].every(b=>getComputedStyle(b).display!=='none')&&document.querySelectorAll('#sar-controls .doc-carry-btn').length===1),'admin sees button');
 const prog0=await pg.evaluate(()=>document.getElementById('sar-progress').textContent.replace(/\s+/g,' '));
 // ดึงทั้งเล่ม
 await pg.click('#sar-controls .doc-carry-btn');await pg.waitForSelector('#modal-confirm',{state:'visible'});assert(/ปีงบ 2570/.test(await pg.textContent('#confirm-message')));
 await pg.click('#modal-confirm .btn-danger');await pg.waitForSelector('#modal-alert',{state:'visible'});
 const msg=await pg.textContent('#modal-alert');assert(/SAR 1 ตัวชี้วัด/.test(msg)&&/CLT 3 หัวข้อ/.test(msg),msg);await pg.click('#modal-alert button');
 await pg.waitForSelector('#sar-box-'+id+' .doc-draft');
 assert(/ร่างจากปีงบ 2569/.test(await pg.textContent('#sar-box-'+id+' .doc-draft')));
 assert.strictEqual(await pg.inputValue('#sar-box-'+id+' .sar-pdca'),'ปัญหาที่พบ ปีก่อน');
 const prog1=await pg.evaluate(()=>document.getElementById('sar-progress').textContent.replace(/\s+/g,' '));assert.strictEqual(prog1,prog0,'draft not counted as done');
 await pg.screenshot({path:OUT+'/ui51-sar-draft.png'});
 // ปุ่มยืนยัน
 await pg.click('#sar-box-'+id+' .sar-confirm');await pg.waitForFunction(i=>!document.querySelector('#sar-box-'+i+' .doc-draft'),id);
 assert(new RegExp('โดย '+ad[0]).test(await pg.textContent('#sar-box-'+id+' .sar-stamp')));
 const prog2=await pg.evaluate(()=>document.getElementById('sar-progress').textContent.replace(/\s+/g,' '));assert.notStrictEqual(prog2,prog0,'counted after confirm: '+prog0+' → '+prog2);
 // ---- CLT
 await pg.click('#doc-tabs .doc-tab[data-doc=clt]');await pg.waitForSelector('#clt-tree .clt-link');
 await pg.evaluate(()=>cltOpenGroup('STEMI'));await pg.waitForTimeout(300);
 const marks=await pg.evaluate(()=>({mission:document.querySelector('#clt-tree .clt-link[data-key="O|mission"] .clt-draft')?1:0,ctx:document.querySelector('#clt-tree .clt-link[data-key="D|STEMI|context"] .clt-draft')?1:0}));
 assert.deepStrictEqual(marks,{mission:1,ctx:1});
 const cp0=await pg.evaluate(()=>document.getElementById('clt-progress').textContent.replace(/\s+/g,' '));
 await pg.evaluate(()=>cltSelect('O|mission'));await pg.waitForSelector('#clt-editor .doc-draft');
 await pg.screenshot({path:OUT+'/ui51-clt-draft.png'});
 await pg.click('#clt-editor button:has-text("ตรวจแล้ว")');await pg.waitForFunction(()=>!document.querySelector('#clt-editor .doc-draft'));
 assert(await pg.evaluate(()=>!!document.querySelector('#clt-tree .clt-link[data-key="O|mission"] .clt-ok')));
 const cp1=await pg.evaluate(()=>document.getElementById('clt-progress').textContent.replace(/\s+/g,' '));assert.notStrictEqual(cp0,cp1);
 // Export: เตือนหัวข้อที่ยังเป็นร่าง
 await pg.click('#clt-export-btn');await pg.waitForSelector('#modal-confirm',{state:'visible'});
 assert(/ยังเป็นร่างจากปีงบก่อน \(ยังไม่ได้ตรวจ\) 1 หัวข้อ/.test(await pg.textContent('#confirm-message')),await pg.textContent('#confirm-message'));
 await pg.click('#modal-confirm button:not(.btn-danger)');await pg.waitForSelector('#modal-confirm',{state:'hidden'});
 // ดึงซ้ำ: ไม่ทับ (ไม่เพิ่มอะไร)
 await pg.click('#clt-controls .doc-carry-btn');await pg.waitForSelector('#modal-confirm',{state:'visible'});await pg.click('#modal-confirm .btn-danger');await pg.waitForSelector('#modal-alert',{state:'visible'});
 assert(/กรอกไว้แล้วทั้งหมด/.test(await pg.textContent('#modal-alert')),await pg.textContent('#modal-alert'));await pg.click('#modal-alert button');
 assert.strictEqual(C.getCltDoc(tA,fy).items['O|mission'].by,ad[0]);
 assert.deepStrictEqual(pg.errs,[]);await pg.context().close();
 // ผู้บริหารไม่ใช่ admin: ไม่เห็นปุ่ม
 const pe=await open(b,ex2);await pe.click('#menu-sar-btn');await pe.waitForSelector('#sar-pager-top .pager');
 assert(await pe.evaluate(()=>[...document.querySelectorAll('.doc-carry-btn')].every(b=>getComputedStyle(b).display==='none')),'non-admin hides button');
 await b.close();console.log('ui51 OK');
})().catch(e=>{console.error(e);process.exit(1)});
