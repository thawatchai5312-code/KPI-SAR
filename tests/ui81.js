// วิธีสรุปผล/ความถี่ แก้ได้โดยผู้ที่แก้รายละเอียดได้ (staff เจ้าของ): การ์ด + แถวตาราง + บันทึกลงชีต · ตัวที่ดูอย่างเดียวไม่มีช่อง

const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2570;
const DOCX_LIB=path.join(__dirname,'fixtures/lib/docx.iife.js'),PPTX_LIB=path.join(__dirname,'fixtures/lib/pptxgen.bundle.js');assert(fs.existsSync(DOCX_LIB)&&fs.existsSync(PPTX_LIB),'missing libs');
const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),ex=pick('executive'),hp=pick('head','PCT'),hn=U.find(r=>r[2]==='head'&&!/(^|,)PCT(,|$)/.test(r[3]));
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('123456');r[4]='FALSE'});
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
 await pg.fill('#login-username',user[0]);await pg.fill('#login-password','123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForSelector('.kpi-card, #kpi-table');
 return pg;
}
(async()=>{
 const SC=C.SUMMARY_COL-1,FC=C.FREQ_COL-1;
 const Y=y=>h.sheets['ปีงบ '+y].d,rowOf=id=>Y(2570).slice(1).find(r=>String(r[0]).trim()===id);
 // เจ้าหน้าที่ที่มีตัวเป็นเจ้าของ + ตัวที่ดูอย่างเดียว
 let S=null,own=null;
 for(const r of U.filter(x=>x[2]==='staff')){const d=C.getAllData(C.createSession_(r[0],r[1]),2570).data;const o=d.find(k=>k.canEditDetails&&k.canEditResults&&/^[^&<>"'\\]+$/.test(k.name)&&(k.summaryMethod||'เฉลี่ย')==='เฉลี่ย'&&(k.frequency||'รายเดือน')==='รายเดือน');if(o&&d.some(k=>!k.canEditDetails)){S=r;own=o;break}}
 assert(S&&own,'fixture staff');
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await open(br,S);
 // ===== การ์ด: เจ้าของเปิดแก้ → มีช่องวิธีสรุป/ความถี่ → เปลี่ยน → บันทึก =====
 await pg.evaluate(()=>{setScopeFilter('all');setListMode('card');renderList()});
 await pg.evaluate(id=>goToKpi(id),own.id);await pg.waitForTimeout(500);
 await pg.evaluate(id=>startEditNow(id),own.id);await pg.waitForSelector('#ed-summary');
 assert(await pg.locator('#ed-frequency').count()===1,'frequency select');
 assert.strictEqual(await pg.locator('.ed-level-cb').count(),0,'levels still hidden for staff');
 assert.strictEqual(await pg.inputValue('#ed-summary'),'เฉลี่ย');
 await pg.selectOption('#ed-summary','ผลรวม');await pg.selectOption('#ed-frequency','รายไตรมาส');
 assert.strictEqual(await pg.evaluate(()=>isDirty()),true,'dirty after change');
 await pg.evaluate(()=>saveKpiEdit());await pg.waitForFunction(()=>!savingKpi&&editingId===null,null,{timeout:60000});
 assert.deepStrictEqual([rowOf(own.id)[SC],rowOf(own.id)[FC]],['ผลรวม','รายไตรมาส']);
 assert.deepStrictEqual(await pg.evaluate(id=>{const k=globalDatabase.find(x=>x.id===id);return [k.summaryMethod,k.frequency]},own.id),['ผลรวม','รายไตรมาส']);
 const t=await pg.evaluate(id=>document.getElementById('card-'+cssId(findPlacement(globalDatabase.find(x=>x.id===id).id+'@0').key)).textContent,own.id).catch(()=>'');
 assert(/สรุปรายเดือน \(ผลรวม\)/.test(t)||t==='','card shows new method '+t.slice(0,80));
 await pg.screenshot({path:OUT+'/ui81-card.png'});
 // ===== ตาราง: แถวแก้ไขมี select ในคอลัมน์ตั้งค่า =====
 await pg.evaluate(()=>{setListMode('table');tblHide.delete('settings');renderList()});await pg.waitForSelector('#kpi-table');
 await pg.evaluate(id=>{tblEnsureRendered(findPlacement(id+'@0')?findPlacement(id+'@0').key:'');startEditNow(id)},own.id);await pg.waitForSelector('tr.kpi-row.editing #ed-summary');
 assert.strictEqual(await pg.inputValue('#ed-summary'),'ผลรวม');assert.strictEqual(await pg.inputValue('#ed-frequency'),'รายไตรมาส');
 await pg.selectOption('#ed-summary','เดือนล่าสุด');await pg.evaluate(()=>saveKpiEdit());await pg.waitForFunction(()=>!savingKpi&&editingId===null,null,{timeout:60000});
 assert.strictEqual(rowOf(own.id)[SC],'เดือนล่าสุด');
 // ===== ตัวที่ดูอย่างเดียว: เปิดแก้ไม่ได้ (ไม่มีปุ่ม/ช่อง) =====
 const ro=await pg.evaluate(()=>{const k=globalDatabase.find(x=>!x.canEditDetails&&!x.canEditResults);return k?k.id:null});
 if(ro){await pg.evaluate(id=>startEditNow(id),ro);assert.strictEqual(await pg.locator('#ed-summary').count(),0,'read-only kpi has no select');}
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 await br.close();console.log('ui81 ok');
})().catch(e=>{console.error(e);process.exit(1)});
