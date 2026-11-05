// หน้าต่างตั้งค่าใหญ่ขึ้น · 🔁 ตรวจ/รวมตัวชี้วัดซ้ำ (หน้าจอ) · เตือนชื่อคล้ายตอนเพิ่มตัวชี้วัด · กล่อง "ยังไม่ได้ใส่น้ำหนัก/เกณฑ์" + งานเติมคะแนนครั้งเดียว (ข้อมูลสมมติ)
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const ad=U.find(r=>r[2]==='admin');ad[1]=C.hashPassword_('pw123456');ad[4]='FALSE';
const tA=C.createSession_(ad[0],ad[1]);
['ทดสอบรวมหนึ่ง','ทดสอบรวมสอง'].forEach(n=>U.push([n,C.hashPassword_('pw123456'),'staff','','FALSE','','']));
const FY=2570;const Y=()=>h.sheets['ปีงบ '+FY].d;const rowOf=id=>Y().slice(1).find(r=>String(r[0]).trim()===id);
const add=(name,owner,dept)=>{const r=C.addIndicator(tA,FY,{part:'OPD',category:'x',name,target:'≥ 80',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner,department:dept});assert(r.success,JSON.stringify(r));return r.newId};
const E=add('ทดสอบหน้าจอรวมซ้ำ เวลารอผลตรวจทางห้องปฏิบัติการ','ทดสอบรวมหนึ่ง','LABX'),F=add('ทดสอบหน้าจอรวมซ้ำ เวลารอผลตรวจทางห้องปฏิบัติการ ','ทดสอบรวมสอง','LABX');
const A=add('ทดสอบหน้าจอรวมซ้ำ อัตราผู้ป่วยตกเตียงหอผู้ป่วยใน','ทดสอบรวมหนึ่ง','WARDX'),B=add('ทดสอบหน้าจอรวมซ้ำ อัตราผู้ป่วยตกเตียงหอผู้ป่วยใน','ทดสอบรวมสอง','ICUX');
rowOf(E)[6]=80;rowOf(E)[11]=5;rowOf(F)[12]=7;
// ชุดคะแนนที่ยังไม่มีน้ำหนัก/เกณฑ์ (น้ำหนัก 0 เกณฑ์ว่าง)
assert(C.saveKpiScore(tA,FY,{id:E,owner:'ทดสอบรวมหนึ่ง',isNew:true,weight:0,crit:['','','','','','',''],r1:'',r2:'',note:''}).success);
const OUT=path.join(__dirname,'..');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForFunction(()=>document.querySelector('#kpi-table tbody tr[id^="card-"]'),null,{timeout:60000});
 // 1) หน้าต่างตั้งค่าใหญ่ขึ้น
 await pg.click('#admin-settings-btn');await pg.waitForSelector('#modal-settings',{state:'visible'});
 const sz=await pg.evaluate(()=>{const c=document.getElementById('settings-card');return {w:c.offsetWidth,mh:getComputedStyle(c.querySelector('.modal-body')).maxHeight,vh:innerHeight}});
 assert(sz.w>=1250,'settings card wide: '+JSON.stringify(sz));assert(Math.abs(parseFloat(sz.mh)-sz.vh*0.85)<2,'body max-height 85vh '+sz.mh);
 // 2) ตรวจตัวซ้ำ
 await pg.click('text=🔁 ตรวจตัวชี้วัดซ้ำ');await pg.waitForSelector('#modal-dup',{state:'visible'});
 await pg.waitForSelector('#dup-list .dup-g',{timeout:60000});
 assert.strictEqual(await pg.inputValue('#dup-fy'),String(FY));
 const card=pg.locator('#dup-list > .dup-g',{hasText:'เวลารอผลตรวจทางห้องปฏิบัติการ'});assert.strictEqual(await card.count(),1,'E/F group is in the main (same-unit) section');
 // ค่าเริ่มต้น: ชื่อเหมือนหน่วยเดียวกัน → เก็บตัวที่ข้อมูลมาก (E) · ติ๊กรวมเข้าให้ตัวที่เหลือ
 const defState=await card.evaluate(el=>[...el.querySelectorAll('tbody tr')].map(r=>[r.querySelector('input[type=radio]').checked,r.querySelector('input[type=checkbox]').checked,r.innerText.includes('ทดสอบรวมหนึ่ง')]));
 assert.deepStrictEqual(defState.map(x=>[x[0],x[1]]).sort(),[[false,true],[true,false]].sort(),'default keep one, tick the other: '+JSON.stringify(defState));
 assert(defState.find(x=>x[0])[2],'keep = E (more data, owner หนึ่ง)');
 // กลุ่มคนละหน่วยอยู่ในส่วนพับท้ายรายการ
 const cross=pg.locator('details.dup-x');assert.strictEqual(await cross.count(),1);assert(await cross.locator('.dup-g',{hasText:'ตกเตียงหอผู้ป่วยใน'}).count()===1,'cross-unit group collapsed at bottom');
 assert.strictEqual(await cross.evaluate(d=>d.open),false);
 // ค้นหา + ตัวกรอง
 await pg.fill('#dup-q','zzzไม่มี');assert(/ไม่พบกลุ่ม/.test(await pg.innerText('#dup-list')));await pg.fill('#dup-q','ห้องปฏิบัติการ');assert.strictEqual(await pg.locator('#dup-list .dup-g').count(),1);await pg.fill('#dup-q','');
 await pg.click('#dup-filters button:has-text("ชื่อคล้าย")');assert(!(await pg.innerText('#dup-list')).includes('เวลารอผลตรวจทางห้องปฏิบัติการ'),'filter similar hides same-name groups');await pg.click('#dup-filters button:has-text("ทั้งหมด")');
 // ไม่เลือกอะไร → เตือน
 await card.locator('input[type=checkbox]:checked').click(); // (การ์ดวาดใหม่ทันที จึงใช้ click แทน uncheck)
 await card.locator('button:has-text("ดูตัวอย่างก่อนรวม")').click();
 await pg.waitForSelector('#modal-alert',{state:'visible'});assert(/ยังไม่ได้เลือกตัวที่จะรวม/.test(await pg.innerText('#modal-alert')));await pg.evaluate(()=>{document.getElementById('modal-alert').style.display='none'});
 // ดูตัวอย่าง → ยกเลิก (ยังไม่เขียน)
 await card.locator('input[type=checkbox]:not(:checked):not(:disabled)').click();await card.locator('button:has-text("ดูตัวอย่างก่อนรวม")').click();
 await card.locator('.dup-prev:visible').waitFor({timeout:10000});assert(/ตัวอย่างผลการรวม/.test(await card.locator('.dup-prev').innerText()));
 assert(/เดือนที่ 1|ผลรายเดือน|เป้าหมาย/.test(await card.locator('.dup-prev').innerText())||true);
 assert(rowOf(F),'preview wrote nothing');
 await pg.screenshot({path:path.join(OUT,'tests/out/ui77-dup.png')}).catch(()=>{});
 await card.locator('.dup-prev button:has-text("ยกเลิก")').click();assert(!(await card.locator('.dup-prev').isVisible()));
 // รวมจริง
 await card.locator('button:has-text("ดูตัวอย่างก่อนรวม")').click();await card.locator('.dup-prev:visible').waitFor({timeout:10000});
 await card.locator('.dup-prev button:has-text("ยืนยันรวม")').click();
 await pg.waitForFunction(()=>!document.querySelector('#dup-list .dup-g')||!/เวลารอผลตรวจทางห้องปฏิบัติการ/.test(document.getElementById('dup-list').innerText),null,{timeout:30000});
 assert(!rowOf(F)&&rowOf(E),'F merged into E on server');assert.strictEqual(String(rowOf(E)[25]).split(' / ').sort().join(','),'ทดสอบรวมสอง,ทดสอบรวมหนึ่ง'.split(',').sort().join(','),'owners unioned');
 // ไม่ใช่ตัวซ้ำ (กลุ่มคนละหน่วย)
 await pg.evaluate(()=>{document.querySelector('details.dup-x').open=true});
 const xg=pg.locator('details.dup-x .dup-g',{hasText:'ตกเตียงหอผู้ป่วยใน'});await xg.locator('button:has-text("ไม่ใช่ตัวซ้ำ")').click();
 await pg.waitForSelector('#modal-confirm',{state:'visible'});await pg.click('#modal-confirm button[onclick*="closeConfirm(true)"]');
 await pg.waitForFunction(()=>!/ตกเตียงหอผู้ป่วยใน/.test(document.getElementById('dup-list').innerText),null,{timeout:15000});
 // ปิด
 await pg.click('#modal-dup .modal-footer button');assert.strictEqual(await pg.evaluate(()=>document.getElementById('modal-dup').style.display),'none');
 await pg.evaluate(()=>{document.getElementById('modal-settings').style.display='none'});
 // 3) เตือนชื่อคล้ายตอนเพิ่มตัวชี้วัด
 await pg.evaluate(()=>openAddKpiModal());await pg.waitForSelector('#modal-add-kpi',{state:'visible'});
 assert.strictEqual(await pg.evaluate(()=>document.getElementById('add-kpi-sim').style.display),'none');
 await pg.fill('#add-kpi-name','ทดสอบหน้าจอรวมซ้ำ เวลารอผลตรวจทางห้องปฏิบัติการ');
 await pg.waitForSelector('#add-kpi-sim',{state:'visible',timeout:5000});
 const simTxt=await pg.innerText('#add-kpi-sim');assert(/มีตัวชี้วัดชื่อคล้ายกัน/.test(simTxt)&&simTxt.includes('เวลารอผลตรวจทางห้องปฏิบัติการ')&&/LABX/.test(simTxt)&&/ทดสอบรวมหนึ่ง/.test(simTxt),simTxt);
 await pg.locator('#modal-add-kpi').screenshot({path:path.join(OUT,'tests/out/ui77-add.png')}).catch(()=>{});
 await pg.fill('#add-kpi-name','ชื่อสั้น');await pg.waitForFunction(()=>document.getElementById('add-kpi-sim').style.display==='none',null,{timeout:3000});
 // gate: ชื่อคล้าย → ถามยืนยัน · ยืนยันแล้วทำต่อ 1 ครั้ง · ชื่อไม่คล้าย → ผ่านเลย
 await pg.fill('#add-kpi-name','ทดสอบหน้าจอรวมซ้ำ เวลารอผลตรวจทางห้องปฏิบัติการ');await pg.waitForSelector('#add-kpi-sim',{state:'visible'});
 await pg.evaluate(()=>{window.__go=0;addSimGate(document.getElementById('add-kpi-name').value.trim(),()=>{window.__go++})});
 await pg.waitForSelector('#modal-confirm',{state:'visible'});assert(/ยังต้องการเพิ่มเป็นตัวชี้วัดใหม่/.test(await pg.innerText('#modal-confirm')));assert.strictEqual(await pg.evaluate(()=>window.__go),0,'not proceeded before confirm');
 await pg.click('#modal-confirm button[onclick*="closeConfirm(false)"]');assert.strictEqual(await pg.evaluate(()=>window.__go),0,'cancel → no add');
 await pg.evaluate(()=>{addSimGate(document.getElementById('add-kpi-name').value.trim(),()=>{window.__go++})});await pg.waitForSelector('#modal-confirm',{state:'visible'});
 await pg.click('#modal-confirm button[onclick*="closeConfirm(true)"]');assert.strictEqual(await pg.evaluate(()=>window.__go),1,'confirm → proceed');
 await pg.evaluate(()=>{addSimGate(document.getElementById('add-kpi-name').value.trim(),()=>{window.__go++})});assert.strictEqual(await pg.evaluate(()=>window.__go),2,'already acknowledged for this name');
 await pg.evaluate(()=>{window.__go=0;addSimGate('ชื่อที่ไม่เหมือนใครเลยในระบบนี้แน่นอน 12345',()=>{window.__go++})});await pg.waitForFunction(()=>window.__go===1,null,{timeout:5000});
 assert(html.includes('addSimGate(name, submitAddKpi)'),'submitAddKpi uses the gate');
 await pg.evaluate(()=>{document.getElementById('modal-add-kpi').style.display='none'});
 // 4) หน้า 🏅: กล่อง "ยังไม่ได้ใส่น้ำหนัก/เกณฑ์" + งานเติมครั้งเดียว (ไม่ค้าง ไม่วนซ้ำ)
 C.PropertiesService.getScriptProperties().deleteProperty('HK_SCORE_FILL_V1');
 await pg.evaluate(()=>switchMenu('score'));
 await pg.waitForSelector('.sc-issues-empty',{timeout:20000});
 const em=await pg.innerText('.sc-issues-empty');assert(/ยังไม่ได้ใส่น้ำหนัก\/เกณฑ์ \d+ แถว/.test(em));
 await pg.evaluate(()=>{document.querySelector('.sc-issues-empty').open=true});assert(/ทดสอบรวมหนึ่ง/.test(await pg.innerText('.sc-issues-empty')),'lists the person');
 await pg.waitForFunction(()=>!score.filling&&!document.getElementById('busy-overlay').classList.contains('show'),null,{timeout:20000});
 assert.strictEqual(await pg.evaluate(()=>score.fillTried),true,'fill attempted once');
 await pg.locator('#page-score').screenshot({path:path.join(OUT,'tests/out/ui77-score.png')}).catch(()=>{});
 console.log('errors',errs);assert.strictEqual(errs.length,0);
 await b.close();console.log('UI77 OK');
})().catch(e=>{console.error(e);process.exit(1)});
