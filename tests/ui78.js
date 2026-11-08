// ช่องผลที่ยังไม่กรอกแสดง "ว่าง" สีอ่อน (แยกจาก "-" = ไม่มีเคส) + กล่องคำอธิบาย 0 / - / ว่าง · รายงานพิมพ์ช่องว่างเป็นเปล่า

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
 const pg=await open(br,ad);
 const kp=C.getAllData(tA,2570).data.find(x=>x.canEditResults&&x.months.every(v=>v===null)&&x.years.every(v=>v===null)&&/^[^&<>"'\\]+$/.test(x.name));assert(kp,'kpi');
 // ===== ฟังก์ชันแสดงผล =====
 const f=await pg.evaluate(()=>[resShow(null),resShow('-'),resShow(0),resShow(85.5),prNum(null),prNum('-'),prNum(0),prNum('A'),calculateMonthlySummary(['-',null],'เฉลี่ย'),calculateMonthlySummary(['-',null],'เฉลี่ย',true),calculateMonthlySummary([null],'เดือนล่าสุด',true),calculateMonthlySummary([80,0],'เฉลี่ย',true),prNumH('<b>')]);
 const E='<span class="res-empty">ว่าง</span>';
 assert.deepStrictEqual(f,[E,'-','0','85.5','','-',0,'A',E,'','','40.00','&lt;b&gt;']);
 // ===== มุมมองตาราง (head ขึ้นไปเริ่มที่ตาราง): กล่องคำอธิบาย + ช่องกรอก placeholder =====
 await pg.evaluate(()=>{tblHide.delete('monthly');renderList()});await pg.waitForSelector('#res-legend');
 let lg=await pg.textContent('#res-legend');assert(/ผลเป็นศูนย์จริง/.test(lg)&&/เดือนนั้นไม่มีเคส/.test(lg)&&/ยังไม่กรอก/.test(lg),lg);
 assert.strictEqual(await pg.evaluate(()=>getComputedStyle(document.querySelector('#res-legend .rl-ex')).display),'none');
 await pg.evaluate(id=>{startEditNow(id)},kp.id);await pg.waitForSelector('#ed-m0');
 assert.strictEqual(await pg.getAttribute('#ed-m0','placeholder'),'ว่าง');assert.strictEqual(await pg.getAttribute('#ed-y4','placeholder'),'ว่าง');
 assert.strictEqual(await pg.inputValue('#ed-m0'),'');
 await pg.evaluate(()=>cancelEdit&&cancelEdit());
 // ===== การ์ด: ดูอย่างเดียว ช่องว่าง = ว่าง สีอ่อน · "-" ยังเป็น "-" · 0 เป็น 0 =====
 await pg.evaluate(id=>{const k=globalDatabase.find(x=>x.id===id);k.months=[0,'-',null,80,null,null,null,null,null,null,null,null];k.years=[null,null,null,null,70];setListMode('card');renderList()},kp.id);
 await pg.waitForSelector('.kpi-card');
 await pg.evaluate(id=>goToKpi(id),kp.id);await pg.waitForTimeout(600);
 const v=await pg.evaluate(id=>{const c=document.getElementById('card-'+cssId(uniqueById(getOrderedKpis()).find(k=>k.id===id).key));const tds=[...c.querySelectorAll('td')].map(t=>t.innerHTML.trim());return {tds,empties:c.querySelectorAll('.res-empty').length,col:getComputedStyle(c.querySelector('.res-empty')).color}},kp.id);
 assert(v.empties>=4,JSON.stringify(v));
 assert(v.tds.includes('-')&&v.tds.includes('0')&&v.tds.includes('80'),JSON.stringify(v.tds));
 assert.notStrictEqual(v.col,'rgb(0, 0, 0)');
 // ===== การ์ดตอนแก้: กล่องคำอธิบาย + ตัวอย่าง =====
 await pg.evaluate(id=>{startEditNow(id)},kp.id);await pg.waitForSelector('#ed-m1');
 lg=await pg.evaluate(()=>{const c=document.querySelector('.kpi-card.editing')||document;return c.querySelector('.res-legend').textContent});
 assert(/ตัวอย่าง/.test(lg)&&/ผู้ป่วย 20 ราย/.test(lg),lg);
 assert.strictEqual(await pg.getAttribute('#ed-m5','placeholder'),'ว่าง');
 await pg.screenshot({path:OUT+'/ui78-card.png'});
 // ===== สรุปรายงานพิมพ์: ช่องว่างเป็นเปล่า · "-" พิมพ์ "-" =====
 const rp=await pg.evaluate(id=>{const k=globalDatabase.find(x=>x.id===id);k.months=[0,'-',null,80,null,null,null,null,null,null,null,null];k.years=[null,null,null,null,70];return [prNumH(k.years[0]),prNumH(k.years[4]),k.months.map(prNumH),calculateMonthlySummary([null],'เฉลี่ย',true)]},kp.id);
 assert.deepStrictEqual(rp,['','70',['0','-','','80','','','','','','','',''],'']);
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 await br.close();console.log('ui78 ok');
})().catch(e=>{console.error(e);process.exit(1)});
