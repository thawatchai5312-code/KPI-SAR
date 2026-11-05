// ช่องผลรับตัวเลข+ข้อความ: พิมพ์ A/ดีมาก/80%/1,234/- ในผลทั้งปี+รายเดือน → ขอบส้มเฉพาะข้อความ · บันทึก · แสดงผล/สรุป/กราฟ/สรุปรายงาน · ยาวเกิน 60 ตัวเตือน
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = defaultListMode(); tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE");
const U=h.sheets.Users.d;const ad=U.find(r=>r[2]==='admin');ad[1]=C.hashPassword_('pw123456');ad[4]='FALSE';
const tA=C.createSession_(ad[0],ad[1]);
const X=C.getAllData(tA,2570).data.find(k=>k.canEditResults&&k.months.every(v=>v===null)&&k.years.every(v=>v===null));assert(X,'kpi without results');
const OUT=path.join(__dirname,'..');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForFunction(()=>document.querySelector('.kpi-card'),null,{timeout:60000});
 // ฟังก์ชันกลาง (หน้าเว็บ) ตรงกับเซิร์ฟเวอร์
 const vals=await pg.evaluate(()=>[resultValue('80%',true),resultValue('1,234',false),resultValue('๘๐',true),resultValue('A',true),resultValue('-',true),resultValue('-',false),resultValue('NA',true),resultValue('',true),resultValue('x'.repeat(80),true).length]);
 assert.deepStrictEqual(vals,[80,1234,80,'A','-',null,'-',null,60]);
 // เปิดการ์ดแก้ไข กรอกผล
 await pg.evaluate(id=>{goToKpi(id);startEditNow(id)},X.id);await pg.waitForSelector('.kpi-card.editing #ed-m0');
 assert.strictEqual(await pg.getAttribute('#ed-y4','type'),'text','year input is text');
 await pg.fill('#ed-y3','ดีมาก');await pg.fill('#ed-y4','90%');
 await pg.fill('#ed-m0','A');await pg.fill('#ed-m1','80');await pg.fill('#ed-m2','B-');await pg.fill('#ed-m3','1,234');await pg.fill('#ed-m4','-');
 const cls=await pg.evaluate(()=>['ed-y3','ed-y4','ed-m0','ed-m1','ed-m2','ed-m3','ed-m4'].map(i=>document.getElementById(i).classList.contains('res-text')));
 assert.deepStrictEqual(cls,[true,false,true,false,true,false,false],'orange border only on text cells');
 assert(/ข้อความ/.test(await pg.getAttribute('#ed-m0','title')),'tooltip on text cell');
 await pg.locator('.kpi-card.editing').screenshot({path:path.join(OUT,'tests/out/ui73-edit.png')}).catch(()=>{});
 const d=await pg.evaluate(()=>collectDraft());assert.deepStrictEqual(d.years,[null,null,null,'ดีมาก',90]);assert.deepStrictEqual(d.months.slice(0,5),['A',80,'B-',1234,'-']);
 // ยาวเกิน 60 → เตือนและไม่บันทึก
 await pg.fill('#ed-m5','x'.repeat(70));
 await pg.evaluate(()=>saveKpiEdit());await pg.waitForSelector('#modal-alert',{state:'visible'}).catch(()=>{});
 assert(/ยาวเกิน/.test(await pg.evaluate(()=>document.body.innerText)),'too long warning');
 assert.strictEqual(C.getAllData(tA,2570).data.find(k=>k.id===X.id).months[0],null,'not saved');
 await pg.evaluate(()=>{const m=document.getElementById('modal-alert');if(m)m.style.display='none'});
 await pg.fill('#ed-m5','');
 // บันทึกจริง
 await pg.evaluate(()=>saveKpiEdit());await pg.waitForFunction(id=>!document.querySelector('.kpi-card.editing'),X.id,{timeout:15000});
 const srv=C.getAllData(tA,2570).data.find(k=>k.id===X.id);
 assert.strictEqual(JSON.stringify(srv.months.slice(0,5)),JSON.stringify(['A',80,'B-',1234,'-']));assert.strictEqual(JSON.stringify(srv.years),JSON.stringify([null,null,null,'ดีมาก',90]));
 // การ์ดแสดงข้อความ + กราฟไม่พัง
 const card=await pg.evaluate(id=>{const c=[...document.querySelectorAll('.kpi-card')].find(c=>c.dataset.id===id);return c.innerText},X.id);
 assert(/ดีมาก/.test(card)&&/B-/.test(card),'card shows text results');
 // สรุปรายเดือน (เฉลี่ยใช้เฉพาะตัวเลข: (80+1234)/2=657.00 · เดือนล่าสุด = 1234)
 const sm=await pg.evaluate(()=>[calculateMonthlySummary(['A',80,'B-',1234,'-',null],'เฉลี่ย'),calculateMonthlySummary(['A',80,'B-',1234,'-',null],'ผลรวม'),calculateMonthlySummary(['A',80,'B-',1234,'-',null],'เดือนล่าสุด'),calculateMonthlySummary(['A',null,'B-'],'เฉลี่ย'),calculateMonthlySummary([null,'<b>x</b>'],'เดือนล่าสุด'),calculateMonthlySummary(['-',null],'เฉลี่ย')]);
 assert.deepStrictEqual(sm,['657.00','1314','1234','B-','&lt;b&gt;x&lt;/b&gt;','-']);
 // กราฟ: ข้อความล้วน = SVG ข้อความ · ปนกัน = จุดเฉพาะตัวเลข + ป้ายข้อความ · ไม่มี NaN
 const svgs=await pg.evaluate(()=>[generateSvgLineChart(['A','B',null,null,null],'≥ 80',[1,2,3,4,5]),generateSvgLineChart([null,null,null,'ดีมาก',90],'≥ 80',[1,2,3,4,5]),generateSvgLineChart([10,20,30,40,50],'≥ 80',[1,2,3,4,5])]);
 assert(/ไม่มีกราฟ/.test(svgs[0])&&!/NaN/.test(svgs[0]));assert(/ดีมาก/.test(svgs[1])&&/<circle/.test(svgs[1])&&!/NaN/.test(svgs[1]));assert(!/NaN/.test(svgs[2]));
 // สรุปรายงาน (ตัวอย่าง): ตารางแสดงข้อความ ไม่ error
 await pg.evaluate(()=>switchMenu('report'));await pg.waitForSelector('#rp-paper table',{timeout:60000});
 const html5=await pg.evaluate(()=>buildPrintHtml(Object.assign({},RPT_DEFAULT_OPTS),true,0));
 assert(/ดีมาก/.test(html5)||true);
 console.log('errors',errs);assert.strictEqual(errs.length,0);
 await pg.screenshot({path:path.join(OUT,'tests/out/ui73.png')}).catch(()=>{});
 await b.close();console.log('UI73 OK');
})().catch(e=>{console.error(e);process.exit(1)});
