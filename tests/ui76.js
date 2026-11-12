// ช่องค้นหาหน้าแรก (ชื่อตัวชี้วัด / ผู้รับผิดชอบ / หน่วยงาน): ตาราง + การ์ด · หลายคำ AND · ✕ ล้าง · ผังซ้ายกรองตาม · คงคำค้นเมื่อสลับโหมด/อัปเดตอัตโนมัติ · เลขข้อไม่เปลี่ยน · จอโทรศัพท์
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const ad=U.find(r=>r[2]==='admin');ad[1]=C.hashPassword_('123456');ad[4]='FALSE';
const OUT=path.join(__dirname,'..');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForFunction(()=>document.querySelector('#kpi-table tbody tr[id^="card-"]'),null,{timeout:60000});
 // ตัวแปรช่วย: ชุดฐาน (ไม่สนคำค้น) เทียบกับที่แสดง
 const base=()=>pg.evaluate(()=>uniqueById(getOrderedKpis(false,treeView,false,true)).map(k=>({id:k.id,name:k.name,owner:k.owner,department:k.department})));
 const shown=()=>pg.evaluate(()=>uniqueById(getOrderedKpis()).map(k=>k.id));
 const B=await base();assert(B.length>10,'enough KPIs');
 assert.strictEqual(await pg.evaluate(()=>listMode),'table','admin starts in table mode');
 assert(await pg.evaluate(()=>!!document.querySelector('#kpi-list-area .tbl-toolbar #home-q')),'search box in table toolbar');
 assert((await pg.getAttribute('#home-q','placeholder')).includes('ผู้รับผิดชอบ'));
 const typeQ=async v=>{await pg.fill('#home-q',v);await pg.waitForFunction(q=>homeQuery===q,v,{timeout:5000})};
 const norm=s=>String(s||'').toLowerCase();
 const expect=(q)=>{const t=q.toLowerCase().split(/\s+/).filter(Boolean);return B.filter(k=>t.every(w=>(norm(k.name)+' '+norm(k.owner)+' '+norm(k.department)).includes(w))).map(k=>k.id)};
 // 1) ชื่อตัวชี้วัด (ตาราง)
 const withName=B.find(k=>k.name&&k.name.length>8);const qName=withName.name.slice(2,8);
 await typeQ(qName);let exp=expect(qName);assert(exp.length>=1&&exp.length<B.length||exp.length===B.length);
 assert.deepStrictEqual((await shown()).sort(),exp.slice().sort(),'name search');
 assert(await pg.evaluate(n=>{const t=document.querySelector('#kpi-list-area .tbl-toolbar').innerText;return t.includes('แสดง '+n+' ตัวชี้วัด')||t.includes('('+n+' ตัวชี้วัด)')},exp.length),'toolbar count');
 assert(await pg.evaluate(n=>document.getElementById('tree-count').innerText.includes('แสดง '+n+' ตัว'),exp.length),'left tree count follows');
 // ผังซ้าย: หมวดทั้งหมดที่ขึ้นมีตัวที่ค้นเจอ — จำนวนรายการตัวชี้วัดในผังตรงกับฝั่งขวา
 assert.strictEqual(await pg.evaluate(()=>document.querySelectorAll('#accordion-tree-container .accordion-part').length>0),true);
 // โฟกัสยังอยู่ในช่องหลังวาดใหม่
 assert.strictEqual(await pg.evaluate(()=>document.activeElement&&document.activeElement.id),'home-q','focus kept');
 // 2) ผู้รับผิดชอบ
 await typeQ('');const withOwner=B.find(k=>k.owner&&k.owner.length>3);const qOwner=withOwner.owner.split(/[ ,]+/)[0];
 await typeQ(qOwner);exp=expect(qOwner);assert.deepStrictEqual((await shown()).sort(),exp.slice().sort(),'owner search');assert(exp.includes(withOwner.id));
 // 3) หน่วยงาน
 await typeQ('');const withDept=B.find(k=>k.department&&k.department.length>2);const qDept=withDept.department.split(/[ ,]+/)[0];
 await typeQ(qDept);exp=expect(qDept);assert.deepStrictEqual((await shown()).sort(),exp.slice().sort(),'department search');assert(exp.includes(withDept.id));
 // 4) หลายคำ = AND · ตัวพิมพ์ใหญ่เล็กไม่สำคัญ · ช่องว่างหัวท้าย
 await typeQ('  '+qName.toUpperCase()+'   '+qOwner+'  ');exp=expect(qName+' '+qOwner);assert.deepStrictEqual((await shown()).sort(),exp.slice().sort(),'AND of terms');
 // 5) ไม่พบ → ข้อความ + ปุ่มล้าง · ช่องค้นหายังอยู่
 await typeQ('zzzไม่มีแน่นอน999');await pg.waitForFunction(()=>/ไม่พบตัวชี้วัดที่ตรงกับ/.test(document.getElementById('kpi-list-area').innerText),null,{timeout:5000});
 assert.strictEqual((await shown()).length,0);assert(await pg.evaluate(()=>!!document.getElementById('home-q')),'box stays when empty');
 await pg.click('#kpi-list-area .empty-state button');await pg.waitForFunction(()=>homeQuery==='',null,{timeout:5000});
 assert.strictEqual((await shown()).length,B.length,'cleared → all back');
 // 6) ใช้ร่วมกับตัวกรองเดิม: เปลี่ยนสถานะ "ต้องแก้ไข" แล้วค้น → ตัดกัน
 await pg.evaluate(()=>setStatusFilter('red'));await pg.waitForFunction(()=>appliedFilters.mode==='red');
 const redBase=await pg.evaluate(()=>uniqueById(getOrderedKpis(false,treeView,false,true)).map(k=>k.id));
 await typeQ(qName);const shownRed=await shown();assert(shownRed.every(id=>redBase.includes(id)&&exp.concat(expect(qName)).includes(id)),'search ∩ status');
 await pg.evaluate(()=>setStatusFilter('green'));await pg.waitForFunction(()=>appliedFilters.mode==='green');
 // 7) คงคำค้นเมื่อสลับเป็นการ์ด/ตาราง · ช่องค้นหาแถบการ์ด · เลขข้อตาราง (ไม่เปลี่ยนตามคำค้น)
 const noFull=await pg.evaluate(()=>{homeQuery='';const m=tblNumbers();return [...m.entries()]});await pg.evaluate(q=>{homeQuery=q},qName);
 const noQ=await pg.evaluate(()=>{tblNoMap=null;const m=tblNumbers();return [...m.entries()]});
 const noMapFull=new Map(noFull),noMapQ=new Map(noQ);for(const [id,v] of noMapQ)assert.strictEqual(v,noMapFull.get(id),'numbering stable under search');
 await pg.evaluate(()=>setListMode('card'));await pg.waitForSelector('.kpi-card');
 assert.strictEqual(await pg.inputValue('#home-q'),qName,'query kept across mode switch');
 exp=expect(qName);assert.deepStrictEqual((await shown()).sort(),exp.slice().sort());
 assert(await pg.evaluate(()=>!!document.querySelector('#kpi-list-area > .tbl-toolbar #home-q')),'search box on top of card list');
 assert.strictEqual(await pg.evaluate(()=>document.querySelectorAll('.kpi-card').length),Math.min(exp.length,await pg.evaluate(()=>pageSize)),'cards shown');
 // 8) อัปเดตอัตโนมัติ/วาดใหม่ไม่ล้างคำค้นและไม่ทำให้ช่องหายโฟกัสกลางทาง
 await pg.focus('#home-q');await pg.evaluate(()=>{renderTree();renderList()});
 assert.strictEqual(await pg.inputValue('#home-q'),qName);assert.strictEqual(await pg.evaluate(()=>document.activeElement.id),'home-q');
 // 9) พิมพ์ค้างระหว่างรอ (ยังไม่ครบ 0.3 วิ) แล้ววาดใหม่ → ข้อความที่พิมพ์ไม่หาย
 await pg.evaluate(()=>{const q=document.getElementById('home-q');q.value='abc';q.dispatchEvent(new Event('input',{bubbles:true}));renderList()});
 assert.strictEqual(await pg.inputValue('#home-q'),'abc','draft survives re-render');
 await pg.waitForFunction(()=>homeQuery==='abc',null,{timeout:5000});
 // 10) ปุ่ม ✕ และ Esc ล้าง
 await pg.click('#home-q-clear');await pg.waitForFunction(()=>homeQuery==='',null,{timeout:5000});assert.strictEqual(await pg.inputValue('#home-q'),'');
 await typeQ('ก');await pg.focus('#home-q');await pg.keyboard.press('Escape');await pg.waitForFunction(()=>homeQuery==='',null,{timeout:5000});
 // 11) แก้ไขค้างอยู่ → เปลี่ยนคำค้นถามก่อน · "กลับไปแก้ต่อ" คืนคำค้นเดิม
 const E=await pg.evaluate(()=>uniqueById(getOrderedKpis()).find(k=>k.canEditDetails||k.canEditResults).id);
 await pg.evaluate(id=>{goToKpi(id);startEditNow(id)},E);await pg.waitForSelector('.kpi-card.editing');
 await pg.fill('#ed-y4',String(Date.now()%1000)); // แก้ผลทั้งปีให้มีงานค้าง
 await pg.fill('#home-q',qName);await pg.waitForSelector('#modal-unsaved',{state:'visible',timeout:5000});
 await pg.evaluate(()=>resolveUnsaved('stay'));assert.strictEqual(await pg.inputValue('#home-q'),'','stay → query restored');assert.strictEqual(await pg.evaluate(()=>homeQuery),'');
 await pg.evaluate(()=>exitEdit());
 // 12) goToKpi ของตัวที่ถูกคำค้นซ่อนอยู่ → ล้างคำค้นแล้วไปที่ตัวนั้น (ตัวกรองอื่นไม่ถูกแตะ)
 await typeQ('zzz999');await pg.evaluate(id=>goToKpi(id),E);
 assert.strictEqual(await pg.evaluate(()=>homeQuery),'','goToKpi clears query');assert(await pg.evaluate(id=>!!document.getElementById('card-'+cssId(uniqueById(getOrderedKpis()).find(k=>k.id===id).key)),E));
 // 13) สรุปรายงานไม่ใช้คำค้นหน้าแรก
 await typeQ(qName);const nAll=B.length;
 await pg.evaluate(()=>switchMenu('report'));await pg.waitForSelector('#rp-paper table',{timeout:60000});
 assert.strictEqual(await pg.evaluate(()=>uniqueById(getOrderedKpis(false,treeView,true)).length),nAll,'report ignores home query');
 await pg.evaluate(()=>switchMenu('home'));await pg.waitForSelector('#home-q');assert.strictEqual(await pg.inputValue('#home-q'),qName);
 // 14) เปลี่ยนปีงบคงคำค้น (ปีเดียวกันในข้อมูลทดสอบ → ตรวจแค่ว่าไม่ถูกล้างจากการโหลดซ้ำ)
 await pg.evaluate(()=>{dbVersion++;renderTree();renderList()});assert.strictEqual(await pg.evaluate(()=>homeQuery),qName);
 await pg.screenshot({path:path.join(OUT,'tests/out/ui76-card.png')}).catch(()=>{});
 await pg.evaluate(()=>setListMode('table'));await pg.waitForSelector('#kpi-table');await pg.screenshot({path:path.join(OUT,'tests/out/ui76-table.png')}).catch(()=>{});
 // 15) จอโทรศัพท์: ช่องเต็มความกว้าง ไม่ล้นจอ
 const mob=await b.newContext({viewport:{width:390,height:800},isMobile:true,hasTouch:true});const pm=await mob.newPage();
 await pm.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pm.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html.replace('<head>','<head><meta name="viewport" content="width=device-width, initial-scale=1">')}):r.abort());
 await pm.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pm.goto('http://app.test/');
 await pm.fill('#login-username',ad[0]);await pm.fill('#login-password','123456');await pm.click('#login-box-content button');await pm.waitForSelector('#modal-fy',{state:'visible'});await pm.selectOption('#fy-pick-select','2570');await pm.click('#modal-fy button');await pm.waitForSelector('#app-login-screen',{state:'hidden'});
 await pm.waitForSelector('#home-q',{timeout:60000});
 const box=await pm.evaluate(()=>{const r=document.getElementById('home-q').getBoundingClientRect();return {l:r.left,r:r.right,w:r.width,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}});
 assert(box.l>=0&&box.r<=box.cw+1,'mobile search inside screen '+JSON.stringify(box));assert(box.w>200,'mobile search wide '+box.w);assert(box.sw<=box.cw+1,'no horizontal page scroll');
 await pm.screenshot({path:path.join(OUT,'tests/out/ui76-mobile.png')}).catch(()=>{});
 console.log('errors',errs);assert.strictEqual(errs.length,0);
 await b.close();console.log('UI76 OK');
})().catch(e=>{console.error(e);process.exit(1)});
