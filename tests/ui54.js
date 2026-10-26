// เอกสารแนบในหน้าเอกสาร สรพ.: แท็บ SAR (ใต้รายละเอียด ก่อน PDCA) + แท็บ CLT (หน้าผลลัพธ์ตัวชี้วัด ใต้กราฟ) · ดูอย่างเดียว ไม่มีปุ่มแนบ/แก้/ลบ · อัปเดตจากเครื่องอื่นโดยไม่ทับข้อความที่กำลังพิมพ์
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2570;
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
   return r.abort()});
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',user[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForSelector('#kpi-table');
 return pg;
}
const GOOD='https://drive.google.com/file/d/1SarDoc/view';
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const kp=C.getCltDoc(tA,fy).kpis.filter(k=>k.groups.includes('STEMI'));assert(kp.length,'STEMI kpi');const ck=kp[0];
 assert(C.saveCltItem(tA,fy,'S|groups',JSON.stringify(['STEMI']),0).success);
 const pg=await open(br,ad);
 await pg.click('#menu-sar-btn');await pg.waitForSelector('#sar-pager-top .pager');
 const id=await pg.evaluate(()=>sarFlat(sarTreeOf(sarChosen()))[0].id);
 const sel='.doc-links[data-links-ro="'+id+'"]';
 await pg.waitForFunction(s=>/ไม่มีเอกสารแนบ/.test(document.querySelector(s)?.textContent||''),sel);
 // ตำแหน่ง: หลังรายละเอียด/การวิเคราะห์ ก่อนหัวข้อ PDCA · ป้ายไม่ Export
 const order=await pg.evaluate(s=>{const el=document.querySelector(s),labs=[...el.closest('.sar-right').querySelectorAll('.pr-label')].map(x=>x.textContent);return labs},sel);
 assert(/รายละเอียด/.test(order[0])&&/เอกสารแนบ/.test(order[1])&&/ไม่แสดงในเอกสารที่ Export/.test(order[1])&&/PDCA/.test(order[2]),JSON.stringify(order));
 // กำลังพิมพ์ PDCA อยู่ แล้วเครื่องอื่นแนบลิงก์ → ลิงก์ขึ้นในที่เดิม ข้อความที่พิมพ์ไม่หาย
 const ta='#sar-box-'+id+' .sar-pdca';
 await pg.click(ta);await pg.fill(ta,'กำลังพิมพ์ร่าง PDCA');
 const r=C.saveKpiLink(tA,fy,{title:'แนวทาง STEMI ฉบับรวม',url:GOOD,note:'หน้า 3–5',ids:[id,ck.id]});assert(r.success,JSON.stringify(r));
 await pg.evaluate(()=>livePoll());
 await pg.waitForSelector(sel+' a.lnk-a');
 assert.strictEqual(await pg.inputValue(ta),'กำลังพิมพ์ร่าง PDCA','typing kept');
 assert(await pg.evaluate(t=>document.activeElement===document.querySelector(t),ta),'focus kept');
 assert.strictEqual(await pg.getAttribute(sel+' a.lnk-a','href'),GOOD);assert.strictEqual(await pg.getAttribute(sel+' a.lnk-a','target'),'_blank');
 const t1=await pg.textContent(sel);assert(/แนวทาง STEMI ฉบับรวม/.test(t1)&&/หน้า 3–5/.test(t1)&&/ใช้ร่วมกับอีก 1 ตัวชี้วัด/.test(t1)&&/แนบหรือแก้ลิงก์ได้ที่หน้าแรก/.test(t1),t1);
 // ดูอย่างเดียว: ไม่มีปุ่มใด ๆ ในรายการ
 assert.strictEqual(await pg.evaluate(s=>document.querySelector(s).querySelectorAll('button').length,sel),0,'no buttons in SAR');
 await pg.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),sel);await pg.waitForTimeout(300);
 await pg.screenshot({path:OUT+'/ui54-sar.png'});
 // ยกเลิกร่างที่พิมพ์ (ไม่ให้ค้างเตือน)
 await pg.click('#sar-box-'+id+' .sar-revert');
 // ---- CLT: หน้าผลลัพธ์ตัวชี้วัด ใต้กราฟ
 await pg.click('#doc-tabs .doc-tab[data-doc=clt]');await pg.waitForSelector('#clt-tree .clt-link');
 const key='D|STEMI|R|'+ck.id;
 await pg.evaluate(k=>cltSelect(k),key);
 const csel='#clt-editor .doc-links[data-links-ro="'+ck.id+'"]';
 await pg.waitForSelector(csel+' a.lnk-a');
 assert.strictEqual(await pg.getAttribute(csel+' a.lnk-a','href'),GOOD);
 assert.strictEqual(await pg.evaluate(s=>document.querySelector(s).querySelectorAll('button').length,csel),0,'no buttons in CLT');
 assert(await pg.evaluate(s=>{const el=document.querySelector(s).closest('.form-group');const prev=el.previousElementSibling;return !!prev&&(prev.classList.contains('pr-chart')||prev.classList.contains('pr-meta'))},csel),'below chart/meta');
 // เครื่องอื่นลบลิงก์ → หายจากหน้า CLT
 const L=C.getKpiLinks(tA,fy).links.find(l=>l.title==='แนวทาง STEMI ฉบับรวม');
 assert(C.deleteKpiLink(tA,fy,L.id,L.rev).success);
 await pg.evaluate(()=>livePoll());
 await pg.waitForFunction(s=>/ไม่มีเอกสารแนบ/.test(document.querySelector(s)?.textContent||''),csel);
 // แนบใหม่เพื่อถ่ายภาพ
 assert(C.saveKpiLink(tA,fy,{title:'แนวทาง STEMI ฉบับรวม',url:GOOD,ids:[ck.id]}).success);
 await pg.evaluate(()=>livePoll());await pg.waitForSelector(csel+' a.lnk-a');await pg.waitForTimeout(300);
 await pg.screenshot({path:OUT+'/ui54-clt.png'});
 // ---- หน้าแรกยังแนบ/แก้ได้ตามเดิม (การ์ดของตัวชี้วัดนี้มีปุ่ม)
 await pg.click('#menu-home-btn');await pg.click('#mode-switch button[data-mode=card]');await pg.evaluate(i=>goToKpi(i),ck.id);
 await pg.waitForSelector('.kpi-card[data-id="'+ck.id+'"] .lnk-item .lnk-btn[aria-label="แก้ไขลิงก์"]');
 assert(await pg.$('.kpi-card[data-id="'+ck.id+'"] .lnk-add'));
 assert.deepStrictEqual(pg.errs,[],'page errors');
 await br.close();console.log('ui54 OK');
})().catch(e=>{console.error(e);process.exit(1)});
