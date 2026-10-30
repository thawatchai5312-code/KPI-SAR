// dropdown ค้นหา ผู้รับผิดชอบ/หน่วยงาน: การ์ด · แถวตาราง · ฟอร์มเพิ่ม — กรองตามคำที่พิมพ์ · เลือกด้วยเมาส์/คีย์บอร์ด · ต่อท้ายหลัง /

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
 await pg.waitForFunction(()=>document.getElementById('kpi-table')||document.querySelector('.kpi-card'),null,{timeout:60000});
 return pg;
}
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
 const Y=y=>h.sheets['ปีงบ '+y].d,rowOf=(y,id)=>Y(y).slice(1).find(r=>String(r[0]).trim()===id);
 const stf=U.find(r=>r[2]==='staff'&&C.getAllData(C.createSession_(r[0],r[1]),fy).data.some(k=>k.canEditResults&&k.canEditDetails&&rowOf(2569,k.id)));
 stf[1]=C.hashPassword_('pw123456');stf[4]='FALSE';
 const kp=C.getAllData(C.createSession_(stf[0],stf[1]),fy).data.find(k=>k.canEditResults&&k.canEditDetails&&rowOf(2569,k.id));
 const cur=rowOf(fy,kp.id),prev=rowOf(2569,kp.id);
 for(let i=6;i<=10;i++){cur[i]='';prev[i]=''}cur[23]='';
 prev[6]=11;prev[7]=22;prev[8]=33;prev[9]=44;prev[10]=55;prev[23]='รายละเอียดจากปีก่อน';
 const pg=await open(br,stf);
 // ---- การ์ด (staff เริ่มที่การ์ด): ปุ่มอยู่ข้างปุ่มแก้ไข
 await pg.evaluate(id=>{pageSize=50;currentPage=1;goToKpi(id)},kp.id);await pg.waitForTimeout(500);
 const btn=pg.locator('.kpi-card[data-id="'+kp.id+'"] button:has-text("ปีงบก่อน")');assert.strictEqual(await btn.count(),1,'card button');
 await btn.click();await pg.waitForSelector('#modal-pull',{state:'visible'});
 const txt=await pg.innerText('#pull-body');
 assert(/ผลทั้งปี 2566: เติม 22/.test(txt)&&/ผลทั้งปี 2567: เติม 33/.test(txt)&&/ผลทั้งปี 2568: เติม 44/.test(txt)&&/ข้าม — ปีที่ล็อก/.test(txt)&&/เติม/.test(txt)&&/รายละเอียดจากปีก่อน/.test(txt),txt);
 await pg.screenshot({path:'ui65-modal.png'});
 // ยกเลิก = ไม่เขียนอะไร
 await pg.click('#modal-pull button:has-text("ยกเลิก")');assert.strictEqual(cur[7],'');
 // ยืนยัน → การ์ดอัปเดต
 await btn.click();await pg.waitForSelector('#modal-pull',{state:'visible'});await pg.click('#pull-go');
 await pg.waitForFunction(id=>{const k=globalDatabase.find(x=>x.id===id);return k&&k.templateDetails==='รายละเอียดจากปีก่อน'},kp.id,{timeout:30000});
 const got=await pg.evaluate(id=>{const k=globalDatabase.find(x=>x.id===id);return k.years.slice(0,4)},kp.id);
 assert.deepStrictEqual(got,[22,33,44,null],JSON.stringify(got));
 assert.strictEqual(cur[6],22);
 // ดึงซ้ำ: ไม่มีอะไรใหม่ (ปุ่มยืนยันกดไม่ได้)
 await btn.click();await pg.waitForSelector('#modal-pull',{state:'visible'});
 assert(await pg.evaluate(()=>document.getElementById('pull-go').disabled),'nothing new → confirm disabled');assert(/ไม่มีข้อมูลใหม่/.test(await pg.innerText('#pull-body')));
 await pg.click('#modal-pull button:has-text("ยกเลิก")');
 // ---- ตาราง
 await pg.evaluate(()=>setListMode('table'));await pg.waitForSelector('#kpi-table');
 await pg.evaluate(id=>{goToKpi(id)},kp.id);await pg.waitForTimeout(500);
 assert.strictEqual(await pg.locator('tr.kpi-row[data-id="'+kp.id+'"] button:has-text("ปีงบก่อน")').count(),1,'table button');
 // ---- ดูอย่างเดียว: ไม่มีปุ่ม
 const ro=await pg.evaluate(()=>{const k=globalDatabase.find(x=>!x.canEditResults&&!x.canEditDetails);return k?k.id:null});
 if(ro){await pg.evaluate(id=>{goToKpi(id)},ro);await pg.waitForTimeout(400);assert.strictEqual(await pg.locator('[data-id="'+ro+'"] button:has-text("ปีงบก่อน")').count(),0,'no button when view-only');}
 console.log('errors',pg.errs);assert.strictEqual(pg.errs.length,0);
 await br.close();console.log('UI65 OK');
})().catch(e=>{console.error(e);process.exit(1)});
