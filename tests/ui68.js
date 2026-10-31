// เมนู 📥 นำเข้าตัวชี้วัด ▾ (NSO / PCT / รายบุคคล) + หน้าต่างนำเข้ารายบุคคล — ไฟล์ต้นทางจำลอง ข้อมูลสมมติ
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2570;
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const ad=U.find(r=>r[2]==='admin'),stf=U.find(r=>r[2]==='staff');
const OUT=process.cwd();
const MON=['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.'];
const HEAD=['ตัวชี้วัดรายบุคคล','ตัวชี้วัด','เป้าหมาย','KPI Template'].concat(MON,['หน่วยงาน']);
const grp=(owner,unit,items)=>items.map((it,i)=>[i===0?owner:'',it[0],it[1],it[2]].concat(Array(12).fill(''),[unit]));
const SRC=[['ตัวชี้วัดรายบุคคล'].concat(Array(16).fill('')),HEAD]
 .concat(grp('น.ส.'+stf[0]+' นามสมมติ','OPD',[['1. ตัวชี้วัดทดสอบยูไอ A','100','นิยาม A'],['2. ตัวชี้วัดทดสอบยูไอ B','1','นิยาม B']]))
 .concat(grp('นางทดสอบบี รักงาน','จ่ายกลาง',[['1. ตัวชี้วัดทดสอบยูไอ C','< 2%','นิยาม C']]));
const URL='https://docs.google.com/spreadsheets/d/FAKEUI/edit';
const origOpen=C.SpreadsheetApp.openByUrl;
C.SpreadsheetApp.openByUrl=u=>u===URL?{getSheets:()=>[{getDataRange:()=>({getValues:()=>SRC})}]}:origOpen(u);
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await br.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForFunction(()=>document.getElementById('kpi-table')||document.querySelector('.kpi-card'),null,{timeout:60000});
 await pg.click('#admin-settings-btn');await pg.waitForSelector('#modal-settings',{state:'visible'});await pg.waitForTimeout(400);
 // เมนูยุบ
 assert(!(await pg.isVisible('#import-menu')),'menu closed by default');
 assert.strictEqual(await pg.locator('#modal-settings button:has-text("นำเข้าตัวชี้วัดจาก")').count(),0,'old standalone buttons are gone');
 await pg.click('#import-menu-btn');assert(await pg.isVisible('#import-menu'));
 assert.strictEqual(await pg.locator('#import-menu button').count(),3);
 await pg.screenshot({path:OUT+'/ui68-menu.png'});
 await pg.keyboard.press('Escape');assert(!(await pg.isVisible('#import-menu')),'Esc closes');
 await pg.click('#import-menu-btn');await pg.mouse.click(8,8);
 await pg.waitForTimeout(150);assert(!(await pg.isVisible('#import-menu')),'click outside closes');
 // NSO / PCT เปิดหน้าต่างเดิม
 await pg.click('#import-menu-btn');await pg.click('#import-menu button:has-text("NSO")');await pg.waitForSelector('#modal-nso',{state:'visible'});
 assert(!(await pg.isVisible('#import-menu')),'menu closes after choose');
 await pg.evaluate(()=>{document.getElementById('modal-nso').style.display='none'});
 // รายบุคคล
 await pg.click('#import-menu-btn');await pg.click('#import-menu button:has-text("รายบุคคล")');await pg.waitForSelector('#modal-pimp',{state:'visible'});
 assert(await pg.isDisabled('#pimp-commit-btn'));
 await pg.fill('#pimp-url','https://example.com/x');await pg.click('#modal-pimp button:has-text("ตรวจไฟล์")');
 await pg.waitForFunction(()=>/Google ชีต/.test(document.getElementById('pimp-body').innerText),null,{timeout:10000});
 await pg.fill('#pimp-url',URL);await pg.click('#modal-pimp button:has-text("ตรวจไฟล์")');
 await pg.waitForSelector('#pimp-body .pimp-tbl',{timeout:15000});
 let txt=await pg.innerText('#pimp-body');
 assert(/3 ตัวชี้วัด|ตัวชี้วัดใหม่ 3/.test(txt)&&/จ่ายกลาง/.test(txt)&&/ชื่อต้นซ้ำกับบัญชี/.test(txt),txt.slice(0,500));
 assert(/⚠️/.test(txt),'target "1" is flagged');
 await pg.screenshot({path:OUT+'/ui68-preview.png'});
 const rowsBefore=h.sheets['ปีงบ '+fy].d.length;
 assert.strictEqual(h.sheets['ปีงบ '+fy].d.length,rowsBefore);
 // เลือกใช้บัญชีเดิม + แก้เป้าที่ ⚠️
 await pg.click('#pimp-body input[type=radio][onchange*="existing"]');
 await pg.waitForFunction(()=>!/ชื่อต้นซ้ำกับบัญชี/.test(document.getElementById('pimp-body').innerText)||document.querySelector('#pimp-body input[type=radio][onchange*="existing"]:checked'),null,{timeout:10000});
 await pg.waitForTimeout(300);
 assert(await pg.locator('#pimp-body input[type=radio][onchange*="existing"]:checked').count()===1,'existing chosen');
 const inp=pg.locator('#pimp-body .pimp-tgt').nth(1);assert.strictEqual(await inp.inputValue(),'≥ 1');
 await inp.fill('≥ 90');await inp.dispatchEvent('change');
 await pg.waitForFunction(()=>!/⚠️ เป้าหมายที่ต้องตรวจ/.test(document.getElementById('pimp-body').innerText),null,{timeout:10000});
 assert.strictEqual(await pg.locator('#pimp-body .pimp-tgt').nth(1).inputValue(),'≥ 90');
 assert.strictEqual(h.sheets['ปีงบ '+fy].d.length,rowsBefore,'preview steps write nothing');
 assert(!(await pg.isDisabled('#pimp-commit-btn')));
 const btn=await pg.innerText('#pimp-commit-btn');assert(/3 ตัวชี้วัด/.test(btn)&&/1 บัญชี/.test(btn),btn);
 // นำเข้า
 await pg.click('#pimp-commit-btn');await pg.click('#modal-confirm button:has-text("ยืนยัน")');
 await pg.waitForFunction(()=>/นำเข้า/.test(document.getElementById('pimp-body').innerText)&&/✅/.test(document.getElementById('pimp-body').innerText),null,{timeout:30000});
 txt=await pg.innerText('#pimp-body');assert(/ทดสอบบี/.test(txt)&&/11038/.test(txt),txt);
 await pg.screenshot({path:OUT+'/ui68-done.png'});
 const Y=h.sheets['ปีงบ '+fy].d;assert.strictEqual(Y.length,rowsBefore+3);
 const mine=Y.filter(r=>/ตัวชี้วัดทดสอบยูไอ/.test(r[4]));assert.strictEqual(mine.length,3);
 assert(mine.some(r=>r[5]==='≥ 90'&&r[25]===stf[0]),'edited target + existing account owner');
 assert(mine.every(r=>/รายบุคคล/.test(r[28])),'level');
 // รายการในหน้าเว็บมีตัวชี้วัดใหม่ (โหลดซ้ำ)
 await pg.waitForFunction(()=>globalDatabase.filter(k=>/ตัวชี้วัดทดสอบยูไอ/.test(k.name)).length===3,null,{timeout:20000});
 // รันซ้ำ → ข้ามหมด ปุ่มนำเข้าปิด
 await pg.fill('#pimp-url',URL);await pg.click('#modal-pimp button:has-text("ตรวจไฟล์")');
 await pg.waitForSelector('#pimp-body .pimp-tbl',{timeout:15000});
 assert(await pg.isDisabled('#pimp-commit-btn'),'rerun: nothing to import');
 console.log('errors',errs);assert.strictEqual(errs.length,0);
 await br.close();console.log('UI68 OK');
})().catch(e=>{console.error(e);process.exit(1)});
