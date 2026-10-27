// ตัวอย่างก่อน Export: Word (SAR) + PowerPoint (CLT) — กด Export แล้วยังไม่ดาวน์โหลด · เห็นตัวอย่างแบ่งหน้า · ยกเลิก = ไม่มีไฟล์ · ยืนยัน = ได้ไฟล์ที่เนื้อหาตรงกับตัวอย่าง
// ต้องมี tests/fixtures/lib/docx.iife.js และ pptxgen.bundle.js (ใช้แทน CDN ตอนเทสต์)
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
 const kp=C.getCltDoc(tA,fy).kpis.filter(k=>k.groups.includes('STEMI')&&/^[^&<>"'\\]+$/.test(k.name));const [A,B]=kp;assert(B,'2 STEMI kpis');
 assert(C.saveCltItem(tA,fy,'S|groups',JSON.stringify(['STEMI']),0).success);
 assert(C.saveCltItem(tA,fy,'O|mission','พันธกิจของทีม PCT เพื่อทดสอบตัวอย่าง',0).success);
 assert(C.saveCltItem(tA,fy,'D|STEMI|context','บริบทของโรค STEMI',0).success);
 assert(C.saveCltItem(tA,fy,'D|STEMI|driver',JSON.stringify([['เข้าถึงเร็ว','ลด door-to-balloon',A.id,'ประชาสัมพันธ์',A.id,'',B.id,'']]),0).success);
 assert(C.saveCltItem(tA,fy,'D|STEMI|R|'+A.id,'พัฒนาที่ผ่านมา: ลดเวลาได้ 10 นาที',0).success);
 const ctx=await br.newContext({viewport:{width:1500,height:950},acceptDownloads:true});
 const pg=await open(br,ad);
 const downloads=[];pg.on('download',d=>downloads.push(d));
 const unchecked=()=>pg.evaluate(()=>xp.blob===null&&xp.model===null);
 // ================= Word (SAR) =================
 await pg.click('#menu-sar-btn');await pg.waitForSelector('#sar-pager-top .pager');
 // เลือกหมวดจนมีตัวชี้วัดพอแบ่งหน้า (>= 15) แต่ไม่มาก เพื่อให้เทสต์เร็ว
 const n=await pg.evaluate(()=>{sarSelectAll(false);const cs=[...document.querySelectorAll('#sar-cat-list input.sar-cat, #sar-cat-list input[data-cat]')];for(const c of cs){c.checked=true;sarToggleCat(c);if(sarChosen().length>=15)break}return sarChosen().length});
 assert(n>=15&&n<80,'chosen '+n);
 await pg.click('#sar-export-btn');
 await pg.waitForSelector('#modal-xp',{state:'visible',timeout:120000});
 assert.strictEqual(downloads.length,0,'no download before confirm');
 assert(/Word/.test(await pg.textContent('#xp-title'))&&/SAR_Part-I-IV_FY2570\.docx/.test(await pg.textContent('#xp-meta')),await pg.textContent('#xp-meta'));
 const total=await pg.evaluate(()=>xp.total);assert(total>=15,'total '+total);
 assert.strictEqual((await pg.textContent('#xp-range')).replace(/\s+/g,' ').trim(),'ตัวชี้วัด 1–10 จาก '+total);
 assert(/หน้า 1 \//.test(await pg.textContent('#xp-pg')));assert(await pg.isDisabled('#xp-prev'));assert(!await pg.isDisabled('#xp-next'));
 // หน้า 1: ปก + หัวหมวด + ตาราง 2 ชั้น · กราฟเป็น SVG เดียวกับเว็บ
 const p1=await pg.evaluate(()=>({cover:!!document.querySelector('.xp-paper div[style*="font-size:24pt"]'),part:document.querySelectorAll('.xp-part').length,cat:document.querySelectorAll('.xp-cat').length,tbls:document.querySelectorAll('.xp-tbl').length,rows:document.querySelectorAll('.xp-tbl:nth-of-type(1) tbody tr').length,svg:document.querySelectorAll('.xp-paper svg').length,fit:(()=>{const w=document.querySelector('.xp-paper-wrap'),b=document.getElementById('xp-body');return w.getBoundingClientRect().right<=b.getBoundingClientRect().right+1})()}));
 assert(p1.cover&&p1.part>=1&&p1.cat>=1&&p1.tbls>=2&&p1.fit,JSON.stringify(p1));
 await pg.screenshot({path:OUT+'/ui56-word.png'});
 // หน้า 2 + เปลี่ยนจำนวนต่อหน้า
 await pg.click('#xp-next');assert(/^ตัวชี้วัด 11–/.test((await pg.textContent('#xp-range')).trim()),await pg.textContent('#xp-range'));
 assert(!(await pg.evaluate(()=>!!document.querySelector('.xp-paper div[style*="font-size:24pt"]'))),'cover only on first page');
 await pg.selectOption('#xp-size','20');assert.strictEqual((await pg.textContent('#xp-range')).replace(/\s+/g,' ').trim(),'ตัวชี้วัด 1–'+Math.min(20,total)+' จาก '+total);
 // จอมือถือ: หน้ากระดาษย่อพอดีความกว้าง ไม่ล้นจอ
 await pg.setViewportSize({width:390,height:780});await pg.waitForTimeout(400);
 const mb=await pg.evaluate(()=>{const w=document.querySelector('.xp-paper-wrap').getBoundingClientRect(),b=document.getElementById('xp-body').getBoundingClientRect();return {r:w.right,br:b.right,l:w.left,bl:b.left,vw:innerWidth}});
 assert(mb.r<=mb.br+1&&mb.l>=mb.bl-1&&mb.br<=mb.vw+1,'mobile fit '+JSON.stringify(mb));
 await pg.screenshot({path:OUT+'/ui56-mobile.png'});await pg.setViewportSize({width:1500,height:950});await pg.waitForTimeout(300);
 // ยกเลิก = ไม่ดาวน์โหลด และทิ้งไฟล์/ตัวอย่าง
 await pg.click('#modal-xp .xp-foot .btn-secondary');assert(await pg.isHidden('#modal-xp'));assert(await unchecked(),'blob+model dropped');assert.strictEqual(downloads.length,0,'cancel → no file');
 // Esc ก็ปิดได้
 await pg.click('#sar-export-btn');await pg.waitForSelector('#modal-xp',{state:'visible',timeout:120000});await pg.keyboard.press('Escape');assert(await pg.isHidden('#modal-xp'));assert.strictEqual(downloads.length,0);
 // ยืนยัน = ดาวน์โหลด · เนื้อหาไฟล์ตรงกับตัวอย่าง (จำนวนกราฟ / แถวผลลัพธ์ / ชื่อตัวชี้วัดทุกตัว)
 await pg.click('#sar-export-btn');await pg.waitForSelector('#modal-xp',{state:'visible',timeout:120000});
 const pvm=await pg.evaluate(()=>({charts:xp.model.cats.reduce((a,c)=>a+c.rows.filter(r=>r.svg).length,0),cats:xp.model.cats.length,names:xp.model.cats.reduce((a,c)=>a.concat(c.results.map(r=>r.name)),[]),total:xp.total}));
 const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:120000}),pg.click('#xp-confirm')]);
 assert(await pg.isHidden('#modal-xp')&&await unchecked(),'closed after confirm');
 const file=OUT+'/ui56.docx';await dl.saveAs(file);assert.strictEqual(dl.suggestedFilename(),'SAR_Part-I-IV_FY2570.docx');
 const xml=execFileSync('unzip',['-p',file,'word/document.xml'],{maxBuffer:1<<28}).toString('utf8');
 assert.strictEqual((xml.match(/<w:drawing>/g)||[]).length,pvm.charts,'charts in file = charts in preview');
 assert.strictEqual((xml.match(/<w:tbl>/g)||[]).length,pvm.cats*2,'2 tables per category = preview');
 const flat=xml.replace(/<[^>]+>/g,'');pvm.names.forEach(nm=>assert(flat.includes(nm.replace(/&/g,'&amp;')),'name in file: '+nm));
 assert.strictEqual(pvm.total,total);
 // ================= PowerPoint (CLT) =================
 await pg.click('#doc-tabs .doc-tab[data-doc=clt]');await pg.waitForSelector('#clt-tree .clt-link');
 await pg.click('#clt-export-btn');
 await pg.waitForFunction(()=>['modal-confirm','modal-xp'].some(i=>document.getElementById(i).style.display==='flex'),null,{timeout:120000});
 if(await pg.evaluate(()=>document.getElementById('modal-confirm').style.display==='flex'))await pg.click('#modal-confirm .btn-danger');
 await pg.waitForSelector('#modal-xp',{state:'visible',timeout:240000});
 const before=downloads.length;
 assert(/PowerPoint/.test(await pg.textContent('#xp-title'))&&/CLT_PCT_FY2570\.pptx/.test(await pg.textContent('#xp-meta')));
 assert(/ยังไม่ได้กรอก/.test(await pg.textContent('#xp-warn')),'missing-topics warning');
 const st=await pg.evaluate(()=>({total:xp.total,slides:xp.model.slides.length,wraps:document.querySelectorAll('.xp-slide-wrap').length,imgs:document.querySelectorAll('.xp-slide img').length,tbls:document.querySelectorAll('.xp-slide table').length,bar:document.querySelectorAll('.xp-slide > div').length,allPng:[...document.querySelectorAll('.xp-slide img')].every(i=>/^data:image\/png;base64,/.test(i.src))}));
 assert(st.total===st.slides&&st.wraps===Math.min(10,st.total)&&st.total>=10,JSON.stringify(st));
 assert(st.allPng,'chart images are PNG data');
 await pg.screenshot({path:OUT+'/ui56-pptx.png'});
 // ทุกสไลด์พอดีกรอบ 16:9 และข้อความในกล่องย่อพอดีความสูง (fit: shrink)
 const geo=await pg.evaluate(()=>[...document.querySelectorAll('.xp-slide-wrap')].map(w=>{const r=w.getBoundingClientRect();return Math.abs(r.width/r.height-16/9)<0.02}));assert(geo.every(Boolean),'16:9');
 const fitOk=await pg.evaluate(()=>[...document.querySelectorAll('[data-fit]')].every(b=>b.firstElementChild.offsetHeight<=Number(b.dataset.room)+2));assert(fitOk,'shrink boxes fit');
 // หน้าถัดไป + หา "สไลด์ผลลัพธ์/Driver" ในตัวอย่างและถ่ายภาพ
 const slidesIdx=await pg.evaluate(()=>{const tt=(sl)=>sl.items.map(i=>i.t==='text'?i.text:i.t==='table'?i.rows.map(r=>r.map(c=>c.text).join(' ')).join(' '):'').join(' ');const S=xp.model.slides;return {drv:S.findIndex(s=>/Driver Diagram/.test(tt(s))),res:S.findIndex(s=>/ผลลัพธ์และการพัฒนาที่ผ่านมา/.test(tt(s)))}});
 assert(slidesIdx.drv>=0&&slidesIdx.res>=0,JSON.stringify(slidesIdx));
 for(const [nm,i] of [['driver',slidesIdx.drv],['result',slidesIdx.res]]){
   await pg.evaluate(i=>{xp.page=Math.floor(i/xp.size)+1;xpRender()},i);
   await pg.evaluate(i=>{document.querySelectorAll('.xp-slide-wrap')[i%xp.size].scrollIntoView({block:'center'})},i);await pg.waitForTimeout(300);
   await pg.screenshot({path:OUT+'/ui56-pptx-'+nm+'.png'});
 }
 // ยกเลิก = ไม่ดาวน์โหลด
 await pg.click('#modal-xp .xp-foot .btn-secondary');assert(await unchecked());assert.strictEqual(downloads.length,before,'cancel → no pptx');
 // ยืนยัน → จำนวนสไลด์ในไฟล์ = ในตัวอย่าง
 await pg.click('#clt-export-btn');await pg.waitForFunction(()=>['modal-confirm','modal-xp'].some(i=>document.getElementById(i).style.display==='flex'),null,{timeout:120000});
 if(await pg.evaluate(()=>document.getElementById('modal-confirm').style.display==='flex'))await pg.click('#modal-confirm .btn-danger');
 await pg.waitForSelector('#modal-xp',{state:'visible',timeout:240000});
 const pvSlides=await pg.evaluate(()=>xp.model.slides.length);
 const [dl2]=await Promise.all([pg.waitForEvent('download',{timeout:240000}),pg.click('#xp-confirm')]);
 const f2=OUT+'/ui56.pptx';await dl2.saveAs(f2);assert.strictEqual(dl2.suggestedFilename(),'CLT_PCT_FY2570.pptx');
 const list=execFileSync('unzip',['-Z1',f2]).toString().split('\n').filter(x=>/^ppt\/slides\/slide\d+\.xml$/.test(x));
 assert.strictEqual(list.length,pvSlides,'slides in file = slides in preview');
 assert.deepStrictEqual(pg.errs,[],'page errors');
 await br.close();console.log('ui56 OK');
})().catch(e=>{console.error(e);process.exit(1)});
