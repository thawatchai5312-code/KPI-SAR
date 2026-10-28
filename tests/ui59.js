// ผลรายเดือน "-" = ไม่มีเคส: พิมพ์ในช่องการ์ด/ตาราง · สรุปไม่นับ "-" แต่นับ 0 · นับว่ากรอกแล้ว (ไม่แดง) · กรอกผิดรูปแบบมีข้อความเตือน

const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2570;
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
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const Y=y=>h.sheets['ปีงบ '+y].d,rowOf=(y,id)=>Y(y).slice(1).find(r=>String(r[0]).trim()===id);
 const pg=await open(br,ad);
 const kp=C.getAllData(tA,2570).data.find(x=>x.canEditResults&&x.months.every(v=>v===null)&&/^[^&<>"'\\]+$/.test(x.name));assert(kp,'kpi');
 // ฟังก์ชันสรุป: "-" ไม่นับ · 0 นับ · ทั้งหมด "-" = "-"
 const sum=await pg.evaluate(()=>[calculateMonthlySummary([80,'-',90,null,null,null,null,null,null,null,null,null],'เฉลี่ย'),calculateMonthlySummary([80,0,null,null,null,null,null,null,null,null,null,null],'เฉลี่ย'),calculateMonthlySummary(['-','-',null,null,null,null,null,null,null,null,null,null],'เฉลี่ย'),calculateMonthlySummary([5,'-',7,'-',null,null,null,null,null,null,null,null],'ผลรวม'),calculateMonthlySummary([5,'-',7,'-',null,null,null,null,null,null,null,null],'เดือนล่าสุด'),prNum('-'),prNum(0),prNum(null)]);
 assert.deepStrictEqual(sum,['85.00','40.00','-','12','7','-',0,'-'],JSON.stringify(sum));
 // สถานะ: เดือนที่ถึงกำหนดเป็น "-" = กรอกแล้ว ไม่ขึ้นแดง "ผลยังว่าง"
 const st=await pg.evaluate(()=>{expectedMonthIdx=()=>1;const base={frequency:'รายเดือน',years:[null,null,null,null,null],templateDetails:'x',analysisUpdatedAt:'1',dataSource:'y'};const mk=(m0,m1)=>Object.assign({},base,{months:[m0,m1,null,null,null,null,null,null,null,null,null,null]});return [kpiStatus(mk(5,null)).level,kpiStatus(mk(5,'-')).level,kpiStatus(mk('-','-')).level,kpiStatus(mk(null,null)).level,kpiStatus(Object.assign(mk('-',null),{frequency:'รายไตรมาส'})).level]});
 assert.strictEqual(st[0],'red');assert.strictEqual(st[1],'green');assert.strictEqual(st[2],'green');assert.strictEqual(st[3],'red');
 // ===== แถวตาราง: พิมพ์ - ในช่องรายเดือน =====
 await pg.evaluate(id=>{startEditNow(id)},kp.id);await pg.waitForSelector('#ed-m0');
 assert.strictEqual(await pg.getAttribute('#ed-m0','type'),'text');
 await pg.fill('#ed-m0','80');await pg.fill('#ed-m1','-');await pg.fill('#ed-m2','0');await pg.fill('#ed-m3','NA');
 await pg.evaluate(()=>saveKpiEdit());await pg.waitForFunction(()=>!savingKpi&&editingId===null,null,{timeout:60000});
 const raw=rowOf(2570,kp.id).slice(11,23).map(v=>v===null?'':v);assert.deepStrictEqual(raw.slice(0,5),[80,'-',0,'-','']);
 const kk=await pg.evaluate(id=>{const k=globalDatabase.find(x=>x.id===id);return [k.months.slice(0,4),calculateMonthlySummary(k.months,k.summaryMethod)]},kp.id);
 assert.deepStrictEqual(kk,[[80,'-',0,'-'],'40.00'],JSON.stringify(kk));
 await pg.evaluate(id=>{const r=document.querySelector('tr.kpi-row[data-id="'+id+'"]');if(r)r.scrollIntoView({block:'center'})},kp.id);await pg.screenshot({path:OUT+'/ui59-table.png'});
 // ===== การ์ด: ข้อความช่วยเหลือ + ค่าแสดงกลับ =====
 await pg.evaluate(()=>setListMode('card'));await pg.waitForSelector('.kpi-card');
 await pg.evaluate(id=>goToKpi(id),kp.id);await pg.waitForTimeout(600);await pg.evaluate(id=>{startEditNow(id)},kp.id);await pg.waitForSelector('#ed-m1');
 assert.strictEqual(await pg.inputValue('#ed-m1'),'-');assert.strictEqual(await pg.inputValue('#ed-m2'),'0');assert.strictEqual(await pg.inputValue('#ed-m4'),'');
 assert(/พิมพ์ - ถ้าเดือนนั้นไม่มีเคส/.test(await pg.textContent('.kpi-card.editing, .kpi-card')),'hint');
 await pg.screenshot({path:OUT+'/ui59-card.png'});
 // กรอกผิดรูปแบบ → เตือน ไม่บันทึก
 await pg.fill('#ed-m4','abc');await pg.evaluate(()=>saveKpiEdit());
 await pg.waitForFunction(()=>document.getElementById('modal-alert')&&document.getElementById('modal-alert').style.display==='flex',null,{timeout:15000}).catch(()=>{});
 assert(/ผลรายเดือนไม่ถูกต้อง|กรอกได้เฉพาะตัวเลข/.test(await pg.evaluate(()=>document.body.innerText)),'bad input warning');
 assert.strictEqual(rowOf(2570,kp.id)[15]===null||rowOf(2570,kp.id)[15]==='',true,'not saved');
 await pg.evaluate(()=>{const b=document.querySelector('#modal-alert .btn');if(b)b.click()});
 await pg.fill('#ed-m4','-');await pg.evaluate(()=>saveKpiEdit());await pg.waitForFunction(()=>!savingKpi&&editingId===null,null,{timeout:60000});
 assert.strictEqual(rowOf(2570,kp.id)[15],'-');
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 await br.close();console.log('ui59 ok');
})().catch(e=>{console.error(e);process.exit(1)});
