// CLT Driver diagram: Purpose เป็นหัวตาราง · 1 โรคมีได้หลาย Purpose (หลายตาราง) · ข้อมูลเดิม 3 ช่องยังแสดงได้ · Export PowerPoint มีแถว Purpose
// ต้องมี tests/fixtures/lib/pptxgen.bundle.js (npm pptxgenjs@4.0.1 dist/pptxgen.bundle.js — ใช้แทน CDN ตอนเทสต์)
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const PPTX_LIB=path.join(__dirname,'fixtures/lib/pptxgen.bundle.js');assert(fs.existsSync(PPTX_LIB),'missing '+PPTX_LIB);
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
   if(/pptxgenjs@4\.0\.1\/dist\/pptxgen\.bundle\.js$/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(PPTX_LIB)});
   return r.abort()});
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',user[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForSelector('#kpi-table');
 return pg;
}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const K='D|STEMI|driver';
 // ข้อมูลรูปแบบเดิม (3 ช่อง ไม่มี Purpose) + เลือกเฉพาะโรค STEMI ให้ Export เร็ว
 assert(C.saveCltItem(tA,fy,K,JSON.stringify([['เข้าถึงเร็ว','ลด delay','ประชาสัมพันธ์'],['วินิจฉัยเร็ว','EKG','checklist']]),0).success);
 assert(C.saveCltItem(tA,fy,'S|groups',JSON.stringify(['STEMI']),0).success);
 const pg=await open(b,ad);
 await pg.click('#menu-sar-btn');await pg.waitForSelector('#sar-pager-top .pager');
 await pg.click('#doc-tabs .doc-tab[data-doc=clt]');await pg.waitForSelector('#clt-tree .clt-link');
 await pg.evaluate(k=>cltSelect(k),K);await pg.waitForSelector('#clt-drv .clt-drv');
 // 1) ข้อมูลเดิม: 1 ตาราง Purpose ว่าง 2 แถว · หัวตาราง 3 คอลัมน์
 let st=await pg.evaluate(()=>[...document.querySelectorAll('#clt-drv .clt-drv')].map(d=>({p:d.querySelector('.clt-drv-head textarea').value,rows:d.querySelectorAll('tbody tr').length,ths:[...d.querySelectorAll('thead th')].map(t=>t.textContent).filter(Boolean)})));
 assert.deepStrictEqual(st,[{p:'',rows:2,ths:['Primary driver','Secondary driver','Change idea / Intervention']}],JSON.stringify(st));
 assert(await pg.evaluate(()=>document.getElementById('clt-save').disabled),'not dirty');
 // 2) ใส่ Purpose 1 · เพิ่ม Purpose 2 (ตารางใหม่) + 2 แถว · เพิ่มแถวในตารางแรก
 await pg.fill('#clt-drv .clt-drv:nth-child(1) .clt-drv-head textarea','ผู้ป่วย STEMI ปลอดภัย');
 await pg.click('button:has-text("เพิ่ม Purpose")');
 st=await pg.evaluate(()=>document.querySelectorAll('#clt-drv .clt-drv').length);assert.strictEqual(st,2);
 await pg.fill('#clt-drv .clt-drv:nth-child(2) .clt-drv-head textarea','ลดการเสียชีวิต');
 await pg.fill('#clt-drv .clt-drv:nth-child(2) textarea[data-c="1"]','ส่งต่อทันเวลา');
 await pg.click('#clt-drv .clt-drv:nth-child(2) button:has-text("เพิ่มแถวในตารางนี้")');
 await pg.fill('#clt-drv .clt-drv:nth-child(2) tbody tr:nth-child(2) textarea[data-c="3"]','STEMI Refer Pack');
 await pg.click('#clt-drv .clt-drv:nth-child(1) button:has-text("เพิ่มแถวในตารางนี้")');
 await pg.fill('#clt-drv .clt-drv:nth-child(1) tbody tr:nth-child(3) textarea[data-c="2"]','อ่าน EKG');
 assert(!(await pg.evaluate(()=>document.getElementById('clt-save').disabled)),'dirty');
 await pg.screenshot({path:OUT+'/ui50-driver-edit.png',fullPage:true});
 await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['D|STEMI|driver'].rev===2);
 const saved=JSON.parse(C.getCltDoc(tA,fy).items[K].text);
 assert.deepStrictEqual(saved,[['ผู้ป่วย STEMI ปลอดภัย','เข้าถึงเร็ว','ลด delay','ประชาสัมพันธ์'],['ผู้ป่วย STEMI ปลอดภัย','วินิจฉัยเร็ว','EKG','checklist'],['ผู้ป่วย STEMI ปลอดภัย','','อ่าน EKG',''],
   ['ลดการเสียชีวิต','ส่งต่อทันเวลา','',''],['ลดการเสียชีวิต','','','STEMI Refer Pack']],JSON.stringify(saved));
 // 3) เปิดใหม่: 2 ตารางตามลำดับ
 await pg.evaluate(()=>cltSelect('O|mission'));await pg.evaluate(k=>cltSelect(k),K);await pg.waitForSelector('#clt-drv .clt-drv');
 st=await pg.evaluate(()=>[...document.querySelectorAll('#clt-drv .clt-drv')].map(d=>[d.querySelector('.clt-drv-head textarea').value,d.querySelectorAll('tbody tr').length]));
 assert.deepStrictEqual(st,[['ผู้ป่วย STEMI ปลอดภัย',3],['ลดการเสียชีวิต',2]],JSON.stringify(st));
 // 4) ลบแถว + ลบตาราง (ยืนยัน) → ยกเลิกการแก้ไขกลับเป็นเดิม
 await pg.click('#clt-drv .clt-drv:nth-child(1) tbody tr:nth-child(3) button');
 await pg.click('#clt-drv .clt-drv:nth-child(2) button:has-text("ลบตาราง")');await pg.waitForSelector('#modal-confirm',{state:'visible'});await pg.click('#modal-confirm .btn-danger');
 st=await pg.evaluate(()=>[...document.querySelectorAll('#clt-drv .clt-drv')].map(d=>d.querySelectorAll('tbody tr').length));assert.deepStrictEqual(st,[2]);
 await pg.click('#clt-revert');await pg.waitForSelector('#clt-drv .clt-drv');
 assert.strictEqual(await pg.evaluate(()=>document.querySelectorAll('#clt-drv .clt-drv').length),2,'revert');
 await pg.screenshot({path:OUT+'/ui50-driver.png',fullPage:true});
 // 5) Export PowerPoint: ตาราง Driver 2 สไลด์ แต่ละสไลด์มีแถว Purpose
 await pg.click('#clt-export-btn');await pg.waitForSelector('#modal-confirm',{state:'visible'});
 const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:240000}),pg.click('#modal-confirm .btn-danger')]);
 const file=OUT+'/ui50.pptx';await dl.saveAs(file);
 const list=execFileSync('unzip',['-Z1',file]).toString().split('\n').filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f));
 const xs=list.map(f=>execFileSync('unzip',['-p',file,f],{maxBuffer:1<<28}).toString('utf8')).filter(x=>x.includes('Driver Diagram'));
 assert.strictEqual(xs.length,2,'driver slides '+xs.length);
 assert(xs[0].includes('Purpose: ผู้ป่วย STEMI ปลอดภัย')&&xs[0].includes('อ่าน EKG')&&!xs[0].includes('ลดการเสียชีวิต'),'slide 1');
 assert(xs[1].includes('Purpose: ลดการเสียชีวิต')&&xs[1].includes('STEMI Refer Pack')&&/gridSpan="3"/.test(xs[1]),'slide 2 purpose row spans 3 cols');
 assert.deepStrictEqual(pg.errs,[]);
 await b.close();console.log('ui50 OK');
})().catch(e=>{console.error(e);process.exit(1)});
