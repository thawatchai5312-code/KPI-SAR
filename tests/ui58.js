// ✔ ใช้กับปีงบถัดไปด้วย: การ์ด / แถวตาราง / ฟอร์มเพิ่มตัวชี้วัด + เตือนก่อนบันทึกเมื่อกระทบ CLT/SAR + สรุปผลหลังบันทึก

const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2569;
const DOCX_LIB=path.join(__dirname,'fixtures/lib/docx.iife.js'),PPTX_LIB=path.join(__dirname,'fixtures/lib/pptxgen.bundle.js');assert(fs.existsSync(DOCX_LIB)&&fs.existsSync(PPTX_LIB),'missing libs');
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
   if(/docx@9\.5\.1\/dist\/index\.iife\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(DOCX_LIB)});
   if(/pptxgenjs@4\.0\.1\/dist\/pptxgen\.bundle\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(PPTX_LIB)});
   if(/fonts\.(googleapis|gstatic)\.com/.test(u))return r.abort();
   return r.abort()});
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',user[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForSelector('#kpi-table');
 return pg;
}
const catsOf=r=>[[r[2],r[3]]].concat(String(r[36]||'').split('\n').filter(x=>x.includes('|')).map(x=>{const i=x.indexOf('|');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const Y=y=>h.sheets['ปีงบ '+y].d,rowOf=(y,id)=>Y(y).slice(1).find(r=>String(r[0]).trim()===id);
 const stemi=C.getCltDoc(tA,2570).kpis.filter(k=>k.groups.length===1&&k.groups[0]==='STEMI'&&rowOf(2569,k.id)&&/^[^&<>"'\\]+$/.test(k.name));assert(stemi.length>=2);const [k1,k2]=stemi;
 [2569,2570].forEach(y=>{assert(C.saveCltItem(tA,y,'S|groups',JSON.stringify(['STEMI','Stroke']),0,true).success);assert(C.saveCltItem(tA,y,'D|STEMI|R|'+k1.id,'ผลลัพธ์ STEMI '+y,0,true).success)});
 const pg=await open(br,ad);
 const toast=()=>pg.evaluate(()=>document.getElementById('toast').innerText);
 const waitDone=async()=>{await pg.waitForFunction(()=>!savingKpi&&editingId===null,null,{timeout:60000})};
 // ===== แถวตาราง: ติ๊กไว้เสมอ + ส่งผู้รับผิดชอบไป 2570 =====
 await pg.evaluate(id=>{startEditNow(id)},k2.id);await pg.waitForSelector('#ed-fwd');
 assert(await pg.isChecked('#ed-fwd'),'checked by default');assert(/2570/.test(await pg.textContent('tr.kpi-row.editing .tbl-fwd')));
 await pg.locator('tr.kpi-row.editing').first().scrollIntoViewIfNeeded();await pg.screenshot({path:OUT+'/ui58-table-edit.png'});
 await pg.fill('#ed-owner','ผู้รับผิดชอบทดสอบตาราง');
 const r70name=rowOf(2570,k2.id)[4];
 await pg.evaluate(()=>saveKpiEdit());await waitDone();
 assert.strictEqual(rowOf(2569,k2.id)[25],'ผู้รับผิดชอบทดสอบตาราง');assert.strictEqual(rowOf(2570,k2.id)[25],'ผู้รับผิดชอบทดสอบตาราง');assert.strictEqual(rowOf(2570,k2.id)[4],r70name);
 assert(/ส่งไปปีงบ 2570 แล้ว/.test(await toast()),await toast());
 // เอาติ๊กออก = ปี 2570 ไม่เปลี่ยน
 await pg.evaluate(id=>{startEditNow(id)},k2.id);await pg.waitForSelector('#ed-fwd');await pg.uncheck('#ed-fwd');await pg.fill('#ed-owner','เฉพาะ 2569');
 await pg.evaluate(()=>saveKpiEdit());await waitDone();
 assert.strictEqual(rowOf(2569,k2.id)[25],'เฉพาะ 2569');assert.strictEqual(rowOf(2570,k2.id)[25],'ผู้รับผิดชอบทดสอบตาราง','ไม่ติ๊ก = ไม่ส่ง');
 // ===== การ์ด: ย้ายกลุ่มโรค → เตือน → ยกเลิก / ยืนยัน =====
 await pg.evaluate(()=>setListMode('card'));await pg.waitForSelector('.kpi-card');
 await pg.evaluate(id=>goToKpi(id),k1.id);await pg.waitForTimeout(600);await pg.evaluate(id=>{startEditNow(id)},k1.id);await pg.waitForSelector('#ed-fwd');
 assert(/ใช้กับปีงบถัดไปด้วย \(2570\)/.test(await pg.textContent('.fwd-chk')));
 await pg.screenshot({path:OUT+'/ui58-card-edit.png'});
 await pg.evaluate(()=>{const r=[...document.querySelectorAll('#ed-cats .cat-row')].find(x=>x.querySelector('.cat-part').value==='PCT');r.querySelector('.cat-cat').value='Stroke'});
 await pg.evaluate(()=>saveKpiEdit());
 await pg.waitForFunction(()=>document.getElementById('modal-confirm').style.display==='flex',null,{timeout:30000});
 const msg=await pg.textContent('#confirm-message');assert(/กระทบเอกสาร สรพ\./.test(msg)&&/CLT ปีงบ 2569/.test(msg)&&/CLT ปีงบ 2570/.test(msg)&&/STEMI จะย้ายไปกลุ่ม Stroke/.test(msg),msg);
 await pg.screenshot({path:OUT+'/ui58-confirm.png'});
 await pg.click('#modal-confirm .btn-secondary');
 assert.strictEqual(catsOf(rowOf(2569,k1.id)).filter(c=>c[0]==='PCT')[0][1],'STEMI','ยกเลิก = ไม่บันทึก');
 await pg.evaluate(()=>saveKpiEdit());await pg.waitForFunction(()=>document.getElementById('modal-confirm').style.display==='flex');
 await pg.click('#modal-confirm .btn-danger');await waitDone();
 assert.strictEqual(catsOf(rowOf(2569,k1.id)).filter(c=>c[0]==='PCT')[0][1],'Stroke');assert.strictEqual(catsOf(rowOf(2570,k1.id)).filter(c=>c[0]==='PCT')[0][1],'Stroke');
 assert.strictEqual(C.getCltDoc(tA,2570).items['D|Stroke|R|'+k1.id].text,'ผลลัพธ์ STEMI 2570');
 await pg.screenshot({path:OUT+'/ui58-after-move.png'});
 // ===== ฟอร์มเพิ่มตัวชี้วัด =====
 await pg.evaluate(()=>openAddKpiModal());await pg.waitForSelector('#add-kpi-fwd-box',{state:'visible'});
 assert(await pg.isChecked('#add-kpi-fwd')&&/2570/.test(await pg.textContent('#add-kpi-fwd-text')));
 await pg.screenshot({path:OUT+'/ui58-add.png'});
 await pg.fill('#add-kpi-name','ตัวชี้วัดใหม่ส่งต่อทดสอบ');
 await pg.evaluate(()=>{document.querySelectorAll('.add-level-cb').forEach(x=>{x.checked=(x.value==='รายบุคคล')});document.getElementById('add-kpi-levels').dispatchEvent(new Event('change'))});
 await pg.fill('#add-kpi-owner','ผู้ทดสอบเพิ่ม');await pg.fill('#add-kpi-dept','MSO');
 await pg.evaluate(()=>submitAddKpi());
 await pg.waitForFunction(()=>document.getElementById('modal-add-kpi').style.display==='none',null,{timeout:30000});
 await pg.waitForFunction(()=>/เพิ่ม/.test(document.getElementById('toast').innerText),null,{timeout:30000});
 const added=Y(2569).slice(1).find(r=>r[4]==='ตัวชี้วัดใหม่ส่งต่อทดสอบ');assert(added,'added 2569');const a70=rowOf(2570,String(added[0]).trim());assert(a70,'added 2570 too');
 assert(/เพิ่มในปีงบ 2570 แล้ว/.test(await pg.evaluate(()=>document.getElementById('toast').innerText)),'toast');
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 await br.close();console.log('ui58 ok');
})().catch(e=>{console.error(e);process.exit(1)});
