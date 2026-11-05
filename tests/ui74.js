// เมนู 🏅 คะแนน KPI: เจ้าตัวเห็นของตัวเอง (staff เห็นเมนูเมื่อมีชุดคะแนน) · admin เลือกบุคคล แก้น้ำหนัก/เกณฑ์/คะแนนกรอกเอง เพิ่ม-ลบ · พิมพ์ · โทรศัพท์แสดงไอคอน
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const mkUser=(n,tier,d)=>{const r=[n,C.hashPassword_('pw123456'),tier||'staff',d||'','FALSE','',''];U.push(r);return r};
const ad=U.find(r=>r[2]==='admin'),tA=C.createSession_(ad[0],ad[1]);
const uM=mkUser('ทดสอบมานี','head','OPD'),uP=mkUser('ทดสอบปิติ','head','IPD'),uSt=mkUser('ทดสอบสตาฟ');
const item=(name,owner)=>({part:'OPD',category:'x',name,target:'≥ 80',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner,department:'OPD'});
const idP=C.addIndicator(tA,2570,item('ตัวชี้วัดของปิติ','ทดสอบปิติ')).newId;
const ids=[C.addIndicator(tA,2570,item('ตัวชี้วัดคะแนนทดสอบ ก','ทดสอบมานี')).newId,C.addIndicator(tA,2570,item('ตัวชี้วัดคะแนนทดสอบ ข','ทดสอบมานี')).newId,C.addIndicator(tA,2570,item('ตัวชี้วัดคะแนนทดสอบ ค','ทดสอบมานี')).newId];
const base={weight:2,crit:['70','75','80','85','90','95','100'],r1:'',r2:'',note:''};
assert(C.saveKpiScore(tA,2570,Object.assign({id:ids[0],owner:'ทดสอบมานี',isNew:true},base)).success);
assert(C.saveKpiScore(tA,2570,Object.assign({id:ids[1],owner:'ทดสอบมานี',isNew:true},base,{weight:1,crit:['6','5','4','3','2','1','0']})).success);
assert(C.saveKpiScore(tA,2570,Object.assign({id:idP,owner:'ทดสอบปิติ',isNew:true},base,{crit:['70','75','80','85','90','85','90']})).success); // เกณฑ์ไม่เรียง → อยู่ในรายการที่ต้องแก้
const k0=C.getAllData(tA,2570).data.find(x=>x.id===ids[0]);C.saveKpi(tA,2570,{id:ids[0],years:k0.years,months:[88,90,null,null,null,null,null,null,null,null,null,null]});
const k1=C.getAllData(tA,2570).data.find(x=>x.id===ids[1]);C.saveKpi(tA,2570,{id:ids[1],years:k1.years,months:[3,3,null,null,null,null,null,null,null,null,null,null]});
const idS=C.addIndicator(tA,2570,item('ตัวชี้วัดของสตาฟ','ทดสอบสตาฟ')).newId;assert(C.saveKpiScore(tA,2570,Object.assign({id:idS,owner:'ทดสอบสตาฟ',isNew:true},base)).success);
const OUT=path.join(__dirname,'..');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const open=async(user,opt)=>{const ctx=await b.newContext(opt||{viewport:{width:1440,height:900}});const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');
  await pg.fill('#login-username',user);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
  await pg.waitForFunction(()=>document.querySelector('.kpi-card')||document.getElementById('kpi-table'),null,{timeout:60000});return pg};
 // ===== เจ้าตัว (staff): เห็นเมนู + ของตัวเอง แก้ไม่ได้
 const pm=await open('ทดสอบมานี');
 await pm.waitForFunction(()=>getComputedStyle(document.getElementById('menu-score-btn')).display!=='none',null,{timeout:15000});
 await pm.evaluate(()=>switchMenu('score'));await pm.waitForSelector('#score-body table.sc-table',{timeout:15000});
 let txt=await pm.innerText('#score-body');
 assert(/ตัวชี้วัดคะแนนทดสอบ ก/.test(txt)&&/ตัวชี้วัดคะแนนทดสอบ ข/.test(txt)&&!/ตัวชี้วัดคะแนนทดสอบ ค/.test(txt),'own rows only');
 assert.strictEqual(await pm.locator('#score-person').count(),0,'head has no person picker');assert.strictEqual(await pm.getByText('แก้ไขชุดคะแนน').count(),0,'head cannot edit');
 // แถบซ้าย (หัวหน้า): หน่วย OPD › ตัวเอง เท่านั้น
 const sideM=await pm.evaluate(()=>[...document.querySelectorAll('#score-side-body .accordion-header span:first-child')].map(e=>e.textContent));assert.deepStrictEqual(sideM,['OPD']);
 assert.deepStrictEqual(await pm.evaluate(()=>[...document.querySelectorAll('#score-side-body .category-header span:first-child')].map(e=>e.textContent)),['ทดสอบมานี'],'head sees only self in side');
 assert.strictEqual(await pm.locator('#score-side').count(),1);
 // รอบ 1: ก เฉลี่ย 89 → 3.5 (≥85) ถ่วง 7 · ข ผล 3 → 3.5 ถ่วง 3.5 · รวม 10.5/15=70%
 assert(/10\.5/.test(txt)&&/70%/.test(txt),'totals shown: '+txt.slice(-300));
 assert(/คำนวณ/.test(txt),'calc badge');
 assert(/ผลบางส่วน 2\/6/.test(txt),'partial badge (2/6 months)');assert.strictEqual(await pm.locator('.sc-issues').count(),0,'head: no issues box');
 await pm.screenshot({path:path.join(OUT,'tests/out/ui74-self.png')}).catch(()=>{});
 // staff ไม่เห็นเมนูแม้มีชุดคะแนนของตัวเอง · staff ทั่วไปก็ไม่เห็น
 const ps=await open('ทดสอบสตาฟ');await ps.waitForTimeout(800);
 assert.strictEqual(await ps.evaluate(()=>getComputedStyle(document.getElementById('menu-score-btn')).display),'none','staff: no menu');
 await ps.evaluate(()=>switchMenu('score'));await ps.waitForTimeout(800);
 assert(!(await ps.evaluate(()=>score.data)),'staff gets no data');
 const other=U.find(r=>r[2]==='staff'&&r[0]!=='ทดสอบสตาฟ');
 const po=await open(other[0]);await po.waitForTimeout(800);
 assert.strictEqual(await po.evaluate(()=>getComputedStyle(document.getElementById('menu-score-btn')).display),'none','no score → no menu');
 // ===== admin: เลือกบุคคล แก้ไข
 const pa=await open(ad[0]);
 assert.notStrictEqual(await pa.evaluate(()=>getComputedStyle(document.getElementById('menu-score-btn')).display),'none');
 await pa.evaluate(()=>switchMenu('score'));await pa.waitForSelector('#score-person',{timeout:15000});
 // แถบซ้าย: จัดตามหน่วย (IPD, OPD) · จำนวน KPI ข้างชื่อ
 const units=await pa.evaluate(()=>[...document.querySelectorAll('#score-side-body .accordion-header span:first-child')].map(e=>e.textContent));assert(units.includes('OPD')&&units.includes('IPD'),JSON.stringify(units));
 assert(units.indexOf('IPD')<units.indexOf('OPD'),'units sorted');
 // admin ชุดตัวเองว่าง → เปิดคนแรกในผังให้อัตโนมัติ
 await pa.waitForFunction(()=>score.data&&score.data.rows.length>0,null,{timeout:15000});
 // ค้นหาชื่อ
 await pa.fill('#score-q','มานี');assert.deepStrictEqual(await pa.evaluate(()=>[...document.querySelectorAll('#score-side-body .category-header span:first-child')].map(e=>e.textContent)),['ทดสอบมานี']);await pa.fill('#score-q','');
 await pa.waitForFunction(()=>score.data&&score.data.person==='ทดสอบปิติ'&&score.data.rows.length===1,null,{timeout:15000});
 // กดชื่อมานี → ขึ้นหน้าต่างรอโหลด → ตารางมานี + กางรายชื่อ KPI · หน้าต่างรอโหลดหายเมื่อเสร็จ · กด KPI → เลื่อน/กะพริบแถว
 // (ตัวจำลองเซิร์ฟเวอร์ตอบเร็ว — ตรวจจากข้อความที่ showBusy ตั้งไว้)
 const busyNow=await pa.evaluate(()=>{document.getElementById('busy-text').innerText='';document.querySelector('#score-side-body .category-header[data-p="ทดสอบมานี"]').click();return document.getElementById('busy-text').innerText});
 assert(/กำลังโหลดคะแนน KPI ของ ทดสอบมานี/.test(busyNow),'busy popup on person switch: '+busyNow);
 await pa.waitForFunction(()=>score.data&&score.data.person==='ทดสอบมานี'&&score.data.rows.length===2,null,{timeout:15000});
 await pa.waitForFunction(()=>!document.getElementById('busy-overlay').classList.contains('show'),null,{timeout:5000});
 assert(await pa.evaluate(()=>[...document.querySelectorAll('#score-side-body .category-block.open .kpi-link-item')].length===2),'KPI list opened under the person');
 await pa.evaluate(id=>{document.querySelector('#score-side-body .kpi-link-item[data-id="'+id+'"]').click()},ids[1]);
 await pa.waitForFunction(id=>[...document.querySelectorAll('#score-body tr.sc-flash')].some(r=>r.dataset.id===id),ids[1],{timeout:5000});
 // รายการเกณฑ์ที่ต้องแก้ (admin) → กดแล้วเปิดชุดของคนนั้นในโหมดแก้ไข + เลื่อนไปแถว
 assert(/เกณฑ์คะแนนที่ต้องแก้ 1 แถว/.test(await pa.innerText('.sc-issues summary')));
 await pa.click('.sc-issues summary');await pa.screenshot({path:path.join(OUT,'tests/out/ui74-issues.png')}).catch(()=>{});await pa.click('.sc-issue');
 await pa.waitForFunction(id=>score.data&&score.data.person==='ทดสอบปิติ'&&score.editing&&[...document.querySelectorAll('#score-body tr.sc-flash')].some(r=>r.dataset.id===id),idP,{timeout:15000});
 await pa.click('text=เสร็จสิ้นการแก้ไข');await pa.waitForTimeout(300);
 // ช่อง "เปิดชุดคะแนนของบัญชีอื่น" ยังใช้ได้
 await pa.fill('#score-person','ทดสอบปิติ');await pa.press('#score-person','Tab');
 await pa.waitForFunction(()=>score.data&&score.data.person==='ทดสอบปิติ',null,{timeout:15000});
 await pa.evaluate(()=>{document.querySelector('#score-side-body .category-header[data-p="ทดสอบมานี"]').click()});
 await pa.waitForFunction(()=>score.data&&score.data.person==='ทดสอบมานี'&&score.data.rows.length===2,null,{timeout:15000});
 await pa.screenshot({path:path.join(OUT,'tests/out/ui74-side.png')}).catch(()=>{});
 // เปลี่ยนรอบ
 await pa.click('.sc-rbtn:nth-of-type(3)');txt=await pa.innerText('#score-body');assert(/คะแนน รอบ 2/.test(txt),'year columns');
 await pa.click('.sc-rbtn:nth-of-type(1)');
 // โหมดแก้ไข: เพิ่มตัวชี้วัด ค
 await pa.click('text=แก้ไขชุดคะแนน');await pa.waitForSelector('#sc-w-0');
 await pa.waitForFunction(()=>score.cand&&score.cand.list&&score.cand.list.length>0,null,{timeout:15000});
 await pa.selectOption('#score-cand',ids[2]);await pa.click('text=เพิ่มตัวชี้วัดเข้าชุดคะแนน');
 await pa.waitForFunction(()=>score.data.rows.length===3,null,{timeout:15000});
 // แก้น้ำหนักแถวแรก 2→4 + กรอกคะแนนรอบ 1 เอง 5
 await pa.fill('#sc-w-0','4');await pa.fill('#sc-m1-0','5');await pa.click('tr[data-i="0"] button.btn-primary');
 await pa.waitForFunction(()=>score.data.rows[0].weight===4&&score.data.rows[0].rounds[0].source==='manual',null,{timeout:15000});
 // บันทึกเกณฑ์ผิด → ข้อความเตือน ไม่บันทึก
 await pa.fill('#sc-m1-0','4.3');await pa.click('tr[data-i="0"] button.btn-primary');
 await pa.waitForSelector('#modal-alert',{state:'visible'});assert(/0–5/.test(await pa.evaluate(()=>document.getElementById('modal-alert').innerText)));
 await pa.evaluate(()=>{document.getElementById('modal-alert').style.display='none'});
 // เอาแถวที่ 3 ออก
 await pa.evaluate(()=>{scoreDeleteRow(2)});await pa.waitForSelector('#modal-confirm',{state:'visible'}).catch(()=>{});
 await pa.evaluate(()=>{const b=document.querySelector('#modal-confirm .btn-danger,#modal-confirm .btn-primary');if(b)b.click()});
 await pa.waitForFunction(()=>score.data.rows.length===2,null,{timeout:15000});
 await pa.click('text=เสร็จสิ้นการแก้ไข');await pa.waitForTimeout(500);
 // พิมพ์
 await pa.evaluate(()=>{window.print=()=>{window.__printed=1}});await pa.evaluate(()=>scorePrint());await pa.waitForFunction(()=>window.__printed===1,null,{timeout:5000});
 assert(/คะแนนรวม/.test(await pa.evaluate(()=>document.getElementById('print-root').innerText)),'print content');
 await pa.screenshot({path:path.join(OUT,'tests/out/ui74-admin.png')}).catch(()=>{});
 // ===== โทรศัพท์: ปุ่มเมนูแสดงแต่ไอคอน (อยู่ในกติกาเดิม)
 const pp=await open('ทดสอบมานี',{viewport:{width:390,height:800},isMobile:true,hasTouch:true});
 await pp.waitForFunction(()=>getComputedStyle(document.getElementById('menu-score-btn')).display!=='none',null,{timeout:15000});
 assert(await pp.getAttribute('#menu-score-btn','aria-label')==='คะแนน KPI'&&await pp.getAttribute('#menu-score-btn','title')==='คะแนน KPI');
 await pp.evaluate(()=>switchMenu('score'));await pp.waitForSelector('#score-body table.sc-table',{timeout:15000});
 for(const p of [pm,pa,pp,po,ps])assert.strictEqual(p.errs.length,0,JSON.stringify(p.errs));
 await b.close();console.log('UI74 OK');
})().catch(e=>{console.error(e);process.exit(1)});
