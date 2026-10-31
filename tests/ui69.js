// ชื่อผู้ใช้ซ้ำ: แท็บ "ผู้ใช้" ใน ✏️ เปลี่ยนชื่อ · ล็อกอินพิมพ์แค่ชื่อต้น → เลือกนามสกุล · บันทึกผู้รับผิดชอบที่เป็นชื่อกำกวม (การ์ด/ฟอร์มเพิ่ม) — ข้อมูลสมมติ
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2570;const OUT=process.cwd();
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const ad=U.find(r=>r[2]==='admin');const tA=C.createSession_(ad[0],ad[1]);
const mk=n=>{const r=[n,C.hashPassword_('pw123456'),'staff','','FALSE','',''];U.push(r);return r};
const u1=mk('ซ้ำทดสอบ'),u2=mk('ซ้ำทดสอบแ.');
const item=(name,owner)=>({part:'OPD',category:'x',name,target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner,department:'OPD'});
const k1=C.addIndicator(tA,fy,item('ตัวชี้วัดซ้ำ 1','ซ้ำทดสอบ'));const k2=C.addIndicator(tA,fy,item('ตัวชี้วัดซ้ำ 2','ซ้ำทดสอบแ.'));const k3=C.addIndicator(tA,fy,item('ตัวชี้วัดซ้ำ 3','อื่นๆ'));
assert(k1.success&&k2.success&&k3.success);
const Y=()=>h.sheets['ปีงบ '+fy].d;const rowOf=id=>Y().find(r=>r[0]===id);
async function page(br){
 const pg=await br.newPage({viewport:{width:1440,height:900}});pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');return pg;
}
const loginFy=async pg=>{await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForFunction(()=>document.getElementById('kpi-table')||document.querySelector('.kpi-card'),null,{timeout:60000})};
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 let pg=await page(br);
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await loginFy(pg);
 // ===== แท็บผู้ใช้ =====
 await pg.click('#admin-settings-btn');await pg.waitForSelector('#modal-settings',{state:'visible'});await pg.waitForTimeout(300);
 await pg.click('button:has-text("✏️ เปลี่ยนชื่อ")');await pg.waitForSelector('#modal-rename',{state:'visible'});
 await pg.click('#rn-tab-user');await pg.waitForSelector('#rn-from option[value="ซ้ำทดสอบ"]',{state:'attached'});
 assert(await pg.locator('#rn-tab-user.on').count()===1);
 const simTxt=await pg.innerText('#rn-body .rn-box.warn');assert(/ซ้ำทดสอบ/.test(simTxt)&&/ซ้ำทดสอบแ\./.test(simTxt),simTxt);
 // ปุ่มชื่อที่คล้ายกัน → เลือกในช่อง
 await pg.click('#rn-body .rn-box.warn button:has-text("ซ้ำทดสอบแ.")');assert.strictEqual(await pg.inputValue('#rn-from'),'ซ้ำทดสอบแ.');
 assert(await pg.isDisabled('#rn-commit-btn'));
 await pg.fill('#rn-to','ซ้ำทดสอบ');await pg.click('#rn-preview-btn');await pg.waitForSelector('#rn-result .rn-box.err');
 assert(/เหมือนกัน|มีบัญชี/.test(await pg.innerText('#rn-result')));assert(await pg.isDisabled('#rn-commit-btn'),'error blocks commit');
 await pg.fill('#rn-to','ซ้ำทดสอบ แถวบุญตา');await pg.click('#rn-preview-btn');await pg.waitForSelector('#rn-result .rn-box.ok');
 let t=await pg.innerText('#rn-result');assert(/ซ้ำทดสอบแ\./.test(t)&&/1 ตัวชี้วัด/.test(t),t);assert(!(await pg.isDisabled('#rn-commit-btn')));
 await pg.screenshot({path:OUT+'/ui69-rename.png'});
 await pg.click('#rn-commit-btn');await pg.click('#modal-confirm button:has-text("ยืนยัน")');
 await pg.waitForFunction(()=>/เปลี่ยนชื่อ "ซ้ำทดสอบแ\." เป็น/.test(document.getElementById('rn-result').innerText),null,{timeout:30000});
 assert.strictEqual(u2[0],'ซ้ำทดสอบ แถวบุญตา');assert.strictEqual(rowOf(k2.newId)[25],'ซ้ำทดสอบ แถวบุญตา');assert.strictEqual(rowOf(k1.newId)[25],'ซ้ำทดสอบ');
 // คนที่ 1 → ชื่อ นามสกุล (ใช้ select)
 await pg.selectOption('#rn-from','ซ้ำทดสอบ');await pg.fill('#rn-to','ซ้ำทดสอบ ธนาคุณ');await pg.click('#rn-preview-btn');await pg.waitForSelector('#rn-result .rn-box.ok');
 await pg.click('#rn-commit-btn');await pg.click('#modal-confirm button:has-text("ยืนยัน")');
 await pg.waitForFunction(()=>/เปลี่ยนชื่อ "ซ้ำทดสอบ" เป็น/.test(document.getElementById('rn-result').innerText),null,{timeout:30000});
 assert.strictEqual(u1[0],'ซ้ำทดสอบ ธนาคุณ');assert.strictEqual(rowOf(k1.newId)[25],'ซ้ำทดสอบ ธนาคุณ');
 await pg.evaluate(()=>{document.getElementById('modal-rename').style.display='none';document.getElementById('modal-settings').style.display='none'});
 // ===== บันทึกผู้รับผิดชอบที่เป็นชื่อกำกวม (การ์ด) =====
 await pg.evaluate(()=>acLoad());await pg.waitForFunction(()=>acDir.users.includes('ซ้ำทดสอบ ธนาคุณ'));
 await pg.evaluate(id=>{setListMode('card');pageSize=50;currentPage=1;goToKpi(id);startEditNow(id)},k3.newId);await pg.waitForSelector('#ed-owner');
 await pg.fill('#ed-owner','ซ้ำทดสอบ');await pg.evaluate(()=>saveKpiEdit());
 await pg.waitForSelector('#modal-owner-pick',{state:'visible'});
 assert(/ซ้ำทดสอบ ธนาคุณ/.test(await pg.innerText('#owner-pick-body'))&&/ซ้ำทดสอบ แถวบุญตา/.test(await pg.innerText('#owner-pick-body')));
 await pg.screenshot({path:OUT+'/ui69-pick.png'});
 // ยังไม่เลือก → เตือน ไม่ปิด
 await pg.click('#modal-owner-pick button:has-text("ตกลง")');await pg.waitForTimeout(200);assert(await pg.isVisible('#modal-owner-pick'),'must choose');
 await pg.evaluate(()=>{document.getElementById('modal-alert').style.display='none'});
 assert.strictEqual(rowOf(k3.newId)[25],'อื่นๆ','nothing saved yet');
 // ยกเลิก → ไม่บันทึก
 await pg.click('#modal-owner-pick button:has-text("ยกเลิก")');await pg.waitForTimeout(300);assert.strictEqual(rowOf(k3.newId)[25],'อื่นๆ');
 // เลือกแล้วบันทึก
 await pg.evaluate(()=>saveKpiEdit());await pg.waitForSelector('#modal-owner-pick',{state:'visible'});
 await pg.check('#owner-pick-body input[value="ซ้ำทดสอบ แถวบุญตา"]');await pg.click('#modal-owner-pick button:has-text("ตกลง")');
 await pg.waitForFunction(id=>{const r=globalDatabase.find(k=>k.id===id);return r&&r.owner==='ซ้ำทดสอบ แถวบุญตา'},k3.newId,{timeout:30000});
 assert.strictEqual(rowOf(k3.newId)[25],'ซ้ำทดสอบ แถวบุญตา');
 // ===== ฟอร์มเพิ่มตัวชี้วัด =====
 await pg.evaluate(()=>openAddKpiModal());await pg.waitForSelector('#add-kpi-name',{state:'visible'});
 await pg.fill('#add-kpi-name','ตัวชี้วัดซ้ำ ใหม่');
 await pg.evaluate(()=>{document.querySelectorAll('.add-level-cb').forEach(x=>{x.checked=(x.value==='รายบุคคล')});document.getElementById('add-kpi-levels').dispatchEvent(new Event('change'))});
 await pg.fill('#add-kpi-owner','ซ้ำทดสอบ');await pg.fill('#add-kpi-dept','OPD');
 await pg.evaluate(()=>submitAddKpi());await pg.waitForSelector('#modal-owner-pick',{state:'visible'});
 await pg.check('#owner-pick-body input[value="ซ้ำทดสอบ ธนาคุณ"]');await pg.click('#modal-owner-pick button:has-text("ตกลง")');
 await pg.waitForFunction(()=>document.getElementById('modal-add-kpi').style.display==='none',null,{timeout:30000});
 const added=Y().find(r=>r[4]==='ตัวชี้วัดซ้ำ ใหม่');assert(added&&added[25]==='ซ้ำทดสอบ ธนาคุณ',JSON.stringify(added&&added[25]));
 // ปิดหน้า admin
 await pg.evaluate(()=>logout());await pg.waitForSelector('#login-username');
 // ===== ล็อกอินพิมพ์แค่ชื่อต้น =====
 // รหัสผ่านผิด → ไม่เผยนามสกุล
 await pg.fill('#login-username','ซ้ำทดสอบ');await pg.fill('#login-password','ผิดผิดผิด');await pg.click('#login-box-content button');
 await pg.waitForSelector('#login-username');
 await pg.evaluate(()=>{const m=document.getElementById('modal-alert');if(m)m.style.display='none'});
 assert.strictEqual(await pg.locator('.login-choose-btn').count(),0);
 // รหัสผ่านตรงทั้งสองบัญชี → เลือกนามสกุล
 await pg.fill('#login-username','ซ้ำทดสอบ');await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');
 await pg.waitForSelector('.login-choose-btn');assert.strictEqual(await pg.locator('.login-choose-btn').count(),2);
 await pg.screenshot({path:OUT+'/ui69-login.png'});
 await pg.click('#login-box-content button:has-text("กลับ")');await pg.waitForSelector('#login-username');
 await pg.fill('#login-username','ซ้ำทดสอบ');await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');
 await pg.waitForSelector('.login-choose-btn');await pg.click('.login-choose-btn:has-text("แถวบุญตา")');
 await loginFy(pg);
 assert.strictEqual(await pg.evaluate(()=>currentUser.username),'ซ้ำทดสอบ แถวบุญตา');
 // รหัสผ่านตรงบัญชีเดียว → เข้าเลย
 await pg.evaluate(()=>logout());await pg.waitForSelector('#login-username');
 u2[1]=C.hashPassword_('pwOther99');
 await pg.fill('#login-username','ซ้ำทดสอบ');await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await loginFy(pg);
 assert.strictEqual(await pg.evaluate(()=>currentUser.username),'ซ้ำทดสอบ ธนาคุณ');
 console.log('errors',pg.errs);assert.strictEqual(pg.errs.length,0);
 await br.close();console.log('UI69 OK');
})().catch(e=>{console.error(e);process.exit(1)});
