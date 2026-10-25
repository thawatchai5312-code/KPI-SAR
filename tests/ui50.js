// CLT: Driver diagram (Purpose เป็นหัวตาราง + ตัวชี้วัดต่อช่อง) + Process Management ดึงตัวชี้วัดจาก Driver อัตโนมัติ + Export PowerPoint
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
 const K='D|STEMI|driver',KP='D|STEMI|pm';
 const kp=C.getCltDoc(tA,fy).kpis.filter(k=>k.groups.includes('STEMI')&&/^[^&<>"'\\]+$/.test(k.name));
 const [A,B,Cc]=kp.slice(0,3);assert(Cc,'need 3 STEMI kpis');
 // ข้อมูลรูปแบบเดิม (3 ช่อง ไม่มี Purpose) + เลือกเฉพาะโรค STEMI ให้ Export เร็ว
 assert(C.saveCltItem(tA,fy,K,JSON.stringify([['เข้าถึงเร็ว','ลด delay','ประชาสัมพันธ์'],['วินิจฉัยเร็ว','EKG','checklist']]),0).success);
 assert(C.saveCltItem(tA,fy,'S|groups',JSON.stringify(['STEMI']),0).success);
 const pg=await open(b,ad);
 await pg.click('#menu-sar-btn');await pg.waitForSelector('#sar-pager-top .pager');
 await pg.click('#doc-tabs .doc-tab[data-doc=clt]');await pg.waitForSelector('#clt-tree .clt-link');
 await pg.evaluate(k=>cltSelect(k),K);await pg.waitForSelector('#clt-drv .clt-drv');
 // 1) ข้อมูลเดิม: 1 ตาราง Purpose ว่าง 2 แถว · หัวตาราง 6 คอลัมน์ (ตัวชี้วัดต่อช่อง)
 let st=await pg.evaluate(()=>[...document.querySelectorAll('#clt-drv .clt-drv')].map(d=>({p:d.querySelector('.clt-drv-head textarea').value,rows:d.querySelectorAll('tbody tr').length,ths:[...d.querySelectorAll('thead th')].map(t=>t.textContent).filter(Boolean)})));
 assert.deepStrictEqual(st,[{p:'',rows:2,ths:['Primary driver','ตัวชี้วัด','Secondary driver','ตัวชี้วัด','Change idea / Intervention','ตัวชี้วัด']}],JSON.stringify(st));
 assert(await pg.evaluate(()=>document.getElementById('clt-save').disabled),'not dirty');
 // 2) โครงตาราง: Purpose 1 + เพิ่ม Purpose 2 + แถว
 await pg.fill('#clt-drv .clt-drv:nth-child(1) .clt-drv-head textarea','ผู้ป่วย STEMI ปลอดภัย');
 await pg.click('button:has-text("เพิ่ม Purpose")');
 assert.strictEqual(await pg.evaluate(()=>document.querySelectorAll('#clt-drv .clt-drv').length),2);
 await pg.fill('#clt-drv .clt-drv:nth-child(2) .clt-drv-head textarea','ลดการเสียชีวิต');
 await pg.fill('#clt-drv .clt-drv:nth-child(2) textarea[data-c="1"]','ส่งต่อทันเวลา');
 await pg.click('#clt-drv .clt-drv:nth-child(2) button:has-text("เพิ่มแถวในตารางนี้")');
 await pg.fill('#clt-drv .clt-drv:nth-child(2) tbody tr:nth-child(2) textarea[data-c="3"]','STEMI Refer Pack');
 await pg.click('#clt-drv .clt-drv:nth-child(1) button:has-text("เพิ่มแถวในตารางนี้")');
 await pg.fill('#clt-drv .clt-drv:nth-child(1) tbody tr:nth-child(3) textarea[data-c="2"]','อ่าน EKG');
 // 3) เลือกตัวชี้วัด (รายการเฉพาะที่ติ๊กใส่เอกสาร · เลือกได้หลายตัว · เอาออกได้)
 const kc=sel=>'.clt-kcell'+sel;
 const pick=async(sel,...ids)=>{await pg.evaluate(s=>{document.querySelector(s+' details').open=true},kc(sel));for(const id of ids)await pg.check(kc(sel)+' input[value="'+id.id+'"]');};
 await pick('[data-r="0"][data-k="5"]',A,B);
 assert.strictEqual(await pg.evaluate(s=>document.querySelectorAll(s+' .clt-chip').length,kc('[data-r="0"][data-k="5"]')),2,'2 chips');
 await pick('[data-r="1"][data-k="6"]',Cc);
 await pg.uncheck(kc('[data-r="1"][data-k="6"]')+' input[value="'+Cc.id+'"]');
 assert.strictEqual(await pg.evaluate(s=>document.querySelectorAll(s+' .clt-chip').length,kc('[data-r="1"][data-k="6"]')),0,'toggle off');
 await pick('[data-r="4"][data-k="7"]',A);
 await pick('[data-s="0"][data-k="4"]',Cc);
 await pick('[data-s="3"][data-k="4"]',B);
 // ตัวเลือกมีเฉพาะตัวชี้วัดของ STEMI ที่ติ๊กใส่เอกสาร
 const opts=await pg.evaluate(()=>document.querySelectorAll('.clt-kcell[data-r="0"][data-k="5"] .clt-klist input').length);
 assert.strictEqual(opts,kp.length>0?await pg.evaluate(()=>cltKpisPicked('STEMI').length):0,'list = picked kpis of STEMI');
 // กดเอาออกที่ป้าย ×
 await pg.click(kc('[data-r="0"][data-k="5"]')+' .clt-chip b >> nth=1');
 assert.strictEqual(await pg.evaluate(s=>document.querySelectorAll(s+' .clt-chip').length,kc('[data-r="0"][data-k="5"]')),1,'chip removed');
 await pick('[data-r="0"][data-k="5"]',B);
 await pg.screenshot({path:OUT+'/ui50-driver-edit.png',fullPage:true});
 await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['D|STEMI|driver'].rev===2);
 const P1='ผู้ป่วย STEMI ปลอดภัย',P2='ลดการเสียชีวิต';
 const saved=JSON.parse(C.getCltDoc(tA,fy).items[K].text);
 assert.deepStrictEqual(saved,[[P1,'เข้าถึงเร็ว','ลด delay','ประชาสัมพันธ์',Cc.id,A.id+','+B.id,'',''],[P1,'วินิจฉัยเร็ว','EKG','checklist',Cc.id,'','',''],[P1,'','อ่าน EKG','',Cc.id,'','',''],
   [P2,'ส่งต่อทันเวลา','','',B.id,'','',''],[P2,'','','STEMI Refer Pack',B.id,'','',A.id]],JSON.stringify(saved));
 // 4) เปิดใหม่: 2 ตาราง ตัวชี้วัดกลับมาเป็นป้าย
 await pg.evaluate(()=>cltSelect('O|mission'));await pg.evaluate(k=>cltSelect(k),K);await pg.waitForSelector('#clt-drv .clt-drv');
 st=await pg.evaluate(()=>[...document.querySelectorAll('#clt-drv .clt-drv')].map(d=>[d.querySelector('.clt-drv-head textarea').value,d.querySelectorAll('tbody tr').length,d.querySelectorAll('.clt-chip').length]));
 assert.deepStrictEqual(st,[[P1,3,3],[P2,2,2]],JSON.stringify(st));
 // 5) หน้าการจัดการกระบวนการ: แถวตามตัวชี้วัดที่เลือกใน Driver (C, A, B ตามลำดับ) ขึ้นอัตโนมัติ
 await pg.evaluate(k=>cltSelect(k),KP);await pg.waitForSelector('#clt-pm table');
 let pm=await pg.evaluate(()=>[...document.querySelectorAll('#clt-pm tr.clt-auto')].map(tr=>({ind:tr.querySelector('td.clt-ro').textContent,dflt:tr.querySelector('select option').textContent,ideas:(tr.querySelector('td:nth-child(4) .clt-ro')||{}).textContent||''})));
 assert.strictEqual(pm.length,3,JSON.stringify(pm));
 assert(pm[0].ind.startsWith(Cc.name)&&pm[1].ind.startsWith(A.name)&&pm[2].ind.startsWith(B.name),'order C,A,B');
 assert(/ตามมิติ/.test(pm[0].dflt));
 assert(/ประชาสัมพันธ์/.test(pm[0].ideas)&&/checklist/.test(pm[0].ideas),'change ideas of rows with this kpi: '+pm[0].ideas);
 assert(await pg.evaluate(()=>document.getElementById('clt-save').disabled),'pm not dirty');
 assert(await pg.evaluate(()=>cltHasText('D|STEMI|pm')),'derived rows count as filled');
 await pg.fill('#clt-pm tr.clt-auto:nth-of-type(1) textarea[data-f="1"]','ข้อกำหนด 1');
 await pg.fill('#clt-pm tr.clt-auto:nth-of-type(1) textarea[data-f="3"]','อธิบาย 1');
 await pg.selectOption('#clt-pm tr.clt-auto:nth-of-type(2) select','Care');
 await pg.click('button:has-text("เพิ่มแถวเอง")');
 const man=await pg.$$('#clt-pm tbody tr:not(.clt-auto) textarea');assert.strictEqual(man.length,4);
 for(const [i,t] of ['กระบวนการเอง','ข้อกำหนดเอง','ตัวชี้วัดเอง','ออกแบบเอง'].entries())await man[i].fill(t);
 await pg.screenshot({path:OUT+'/ui50-pm.png',fullPage:true});
 await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['D|STEMI|pm']&&clt.items['D|STEMI|pm'].rev===1);
 const spm=JSON.parse(C.getCltDoc(tA,fy).items[KP].text);
 assert.deepStrictEqual(spm,[['','ข้อกำหนด 1','','อธิบาย 1',Cc.id],['Care','','','',A.id],['กระบวนการเอง','ข้อกำหนดเอง','ตัวชี้วัดเอง','ออกแบบเอง','']],JSON.stringify(spm));
 // 6) เอาตัวชี้วัด A ออกจาก Driver → แถวหายจากตาราง แต่ข้อความที่กรอกพักไว้ (ไม่หาย) · กรอกอีกก็ไม่ทำให้หาย
 await pg.evaluate(k=>cltSelect(k),K);await pg.waitForSelector('#clt-drv .clt-drv');
 await pg.click(kc('[data-r="0"][data-k="5"]')+' .clt-chip b >> nth=0');
 await pg.click(kc('[data-r="4"][data-k="7"]')+' .clt-chip b');
 await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['D|STEMI|driver'].rev===3);
 await pg.evaluate(k=>cltSelect(k),KP);await pg.waitForSelector('#clt-pm table');
 pm=await pg.evaluate(()=>[...document.querySelectorAll('#clt-pm tr.clt-auto')].map(tr=>tr.querySelector('td.clt-ro').textContent));
 assert.strictEqual(pm.length,2);assert(pm.every(t=>!t.startsWith(A.name)),'A gone from pm table');
 await pg.fill('#clt-pm tr.clt-auto:nth-of-type(1) textarea[data-f="1"]','ข้อกำหนด 1 แก้');await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['D|STEMI|pm'].rev===2);
 assert(C.getCltDoc(tA,fy).items[KP].text.includes(A.id),'parked row kept');
 // ใส่ A กลับ → ข้อความเดิมของ A (Care) กลับมา
 await pg.evaluate(k=>cltSelect(k),K);await pg.waitForSelector('#clt-drv .clt-drv');
 await pick('[data-r="0"][data-k="5"]',A);await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['D|STEMI|driver'].rev===4);
 await pg.evaluate(k=>cltSelect(k),KP);await pg.waitForSelector('#clt-pm table');
 assert.strictEqual(await pg.evaluate(()=>[...document.querySelectorAll('#clt-pm tr.clt-auto select')].map(s=>s.value).join('|')),'||Care','restored override (order C,B,A)');
 // 7) ลบแถว/ลบตาราง (ยืนยัน) → ยกเลิกการแก้ไขกลับเป็นเดิม
 await pg.evaluate(k=>cltSelect(k),K);await pg.waitForSelector('#clt-drv .clt-drv');
 await pg.click('#clt-drv .clt-drv:nth-child(1) tbody tr:nth-child(3) button');
 await pg.click('#clt-drv .clt-drv:nth-child(2) button:has-text("ลบตาราง")');await pg.waitForSelector('#modal-confirm',{state:'visible'});await pg.click('#modal-confirm .btn-danger');
 st=await pg.evaluate(()=>[...document.querySelectorAll('#clt-drv .clt-drv')].map(d=>d.querySelectorAll('tbody tr').length));assert.deepStrictEqual(st,[2]);
 await pg.click('#clt-revert');await pg.waitForSelector('#clt-drv .clt-drv');
 assert.strictEqual(await pg.evaluate(()=>document.querySelectorAll('#clt-drv .clt-drv').length),2,'revert');
 await pg.screenshot({path:OUT+'/ui50-driver.png',fullPage:true});
 // 8) Export PowerPoint: Driver 2 สไลด์ (แถว Purpose + ตัวชี้วัด 6 คอลัมน์) + Process Management รวมแถวอัตโนมัติและแถวเอง
 await pg.click('#clt-export-btn');await pg.waitForSelector('#modal-confirm',{state:'visible'});
 const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:240000}),pg.click('#modal-confirm .btn-danger')]);
 const file=OUT+'/ui50.pptx';await dl.saveAs(file);
 const list=execFileSync('unzip',['-Z1',file]).toString().split('\n').filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f));
 const all=list.map(f=>execFileSync('unzip',['-p',file,f],{maxBuffer:1<<28}).toString('utf8'));
 const xs=all.filter(x=>x.includes('Driver Diagram'));
 assert.strictEqual(xs.length,2,'driver slides '+xs.length);
 assert(xs[0].includes('Purpose: '+P1)&&xs[0].includes('อ่าน EKG')&&!xs[0].includes(P2),'slide 1');
 assert(xs[0].includes(Cc.name)&&xs[0].includes(A.name)&&xs[0].includes(B.name),'kpi names on slide 1');
 assert(xs[1].includes('Purpose: '+P2)&&xs[1].includes('STEMI Refer Pack')&&/gridSpan="6"/.test(xs[1]),'slide 2 purpose row spans 6 cols');
 const pms=all.filter(x=>x.includes('Process Management'));assert(pms.length>=1);
 const pmx=pms.join('');
 assert(pmx.includes('ข้อกำหนด 1 แก้')&&pmx.includes('อธิบาย 1')&&pmx.includes('ประชาสัมพันธ์')&&pmx.includes('กระบวนการเอง')&&pmx.includes('ออกแบบเอง')&&pmx.includes('Care')&&pmx.includes(Cc.name),'pm slide content');
 assert.deepStrictEqual(pg.errs,[]);
 await b.close();console.log('ui50 OK');
})().catch(e=>{console.error(e);process.exit(1)});
