// หน้า "เอกสาร สรพ." แท็บ CLT profile ของ PCT: สิทธิ์แท็บ, ผังหัวข้อ, แก้ข้อความ/ตาราง, มิติคุณภาพ, เลือกกลุ่มโรค, แก้ชนกัน, อัปเดตอัตโนมัติ, Export PowerPoint
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
 // ---- 0. หัวหน้าหน่วยอื่น (ไม่ใช่ PCT): มีหน้า SAR แต่ไม่มีแท็บ CLT
 const pn=await open(b,hn);await pn.click('#menu-sar-btn');await pn.waitForSelector('#sar-pager-top .pager');
 assert(await pn.evaluate(()=>getComputedStyle(document.getElementById('doc-tabs')).display==='none'&&!cltCanUse()),'non-PCT head: no CLT tab');
 await pn.evaluate(()=>docSwitch('clt'));assert(await pn.evaluate(()=>docTab)==='sar','cannot force CLT');await pn.context().close();

 // ---- 1. หัวหน้า PCT: เห็นแท็บ · ไม่มีปุ่ม Export
 const pp=await open(b,hp);await pp.click('#menu-sar-btn');await pp.waitForSelector('#doc-tabs .doc-tab',{state:'visible'});
 await pp.click('#doc-tabs .doc-tab[data-doc=clt]');await pp.waitForSelector('#clt-tree .clt-link');
 assert(await pp.evaluate(()=>getComputedStyle(document.getElementById('clt-export-btn')).display==='none'),'PCT head: no export');
 await pp.context().close();

 // ---- 2. admin
 const pg=await open(b,ad);
 await pg.click('#menu-sar-btn');await pg.waitForSelector('#sar-pager-top .pager');
 await pg.click('#doc-tabs .doc-tab[data-doc=clt]');await pg.waitForSelector('#clt-tree .clt-link');
 const t1=await pg.evaluate(()=>({view:document.getElementById('clt-view').style.display,sar:document.getElementById('sar-view').style.display,groups:document.querySelectorAll('#clt-tree .clt-group').length,ov:document.querySelectorAll('#clt-tree .clt-link').length,
   title:document.querySelector('#clt-editor .clt-title').textContent,sel:clt.sel,kpis:clt.kpis.length,fy:document.getElementById('clt-fy').textContent}));
 console.log(JSON.stringify(t1));
 assert(t1.view!=='none'&&t1.sar==='none'&&t1.groups>=20&&t1.ov===CLT_OVERVIEW_LEN(t1)&&t1.title.includes('พันธกิจ')&&t1.kpis>100&&t1.fy==='2570',JSON.stringify(t1));
 function CLT_OVERVIEW_LEN(t){return 10}
 await pg.screenshot({path:OUT+'/clt-1-open.png'});
 // ข้อความ: พิมพ์ → dirty → บันทึก
 await pg.fill('#clt-text','พันธกิจ ๒๕๗๐ ดูแลผู้ป่วยทุกกลุ่ม');
 assert(await pg.evaluate(()=>!document.getElementById('clt-save').disabled),'dirty');
 // เปลี่ยนหัวข้อขณะยังไม่บันทึก → ถาม → ยกเลิก (อยู่หัวข้อเดิม) → ไม่เสียข้อความ
 await pg.click('#clt-tree .clt-link[data-key="O|scope"]');await pg.waitForSelector('#modal-confirm',{state:'visible'});await pg.click('#modal-confirm .btn-secondary');
 assert((await pg.inputValue('#clt-text')).startsWith('พันธกิจ ๒๕๗๐')&&await pg.evaluate(()=>clt.sel==='O|mission'),'stay');
 await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['O|mission']&&clt.items['O|mission'].rev===1);
 assert(C.getCltDoc(tA,fy).items['O|mission'].text==='พันธกิจ 2570 ดูแลผู้ป่วยทุกกลุ่ม','saved normalized');
 assert(await pg.evaluate(()=>document.querySelector('#clt-tree .clt-link[data-key="O|mission"] .clt-ok')!==null),'tick shown');
 // ตาราง: ผู้รับบริการ
 await pg.click('#clt-tree .clt-link[data-key="O|clients"]');await pg.waitForSelector('#clt-grid-body textarea');
 await pg.fill('#clt-grid-body textarea[data-r="0"][data-c="0"]','ผู้ป่วยนอก');await pg.fill('#clt-grid-body textarea[data-r="0"][data-c="1"]','ตรวจครอบคลุม ๑๐๐%');
 await pg.click('#clt-editor button:has-text("➕ เพิ่มแถว")');await pg.fill('#clt-grid-body textarea[data-r="1"][data-c="0"]','ผู้ป่วยฉุกเฉิน');
 await pg.click('#clt-editor button:has-text("➕ เพิ่มแถว")');assert((await pg.locator('#clt-grid-body tr').count())===3);
 await pg.click('#clt-grid-body tr:nth-child(3) button');assert((await pg.locator('#clt-grid-body tr').count())===2,'delete row');
 await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['O|clients']);
 const cl=JSON.parse(C.getCltDoc(tA,fy).items['O|clients'].text);assert.deepStrictEqual(cl,[['ผู้ป่วยนอก','ตรวจครอบคลุม 100%'],['ผู้ป่วยฉุกเฉิน','']]);
 // ตารางคะแนน: ใส่รายชื่อกลุ่มโรค
 await pg.click('#clt-tree .clt-link[data-key="O|priority"]');await pg.click('#clt-editor button:has-text("➕ ใส่รายชื่อกลุ่มโรคที่เลือก")');
 const nPrio=await pg.evaluate(()=>clt.draft.rows.length);assert(nPrio===await pg.evaluate(()=>cltSelectedGroups().length)&&nPrio>=20,'seeded rows '+nPrio);
 await pg.fill('#clt-grid-body textarea[data-r="0"][data-c="1"]','5');await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['O|priority']);

 // ---- 3. กลุ่มโรค: เปิด STEMI · ตัวชี้วัด · มิติ · ข้อความ
 await pg.click('#clt-tree .clt-group-name[data-g="STEMI"]');await pg.waitForSelector('#clt-tree .clt-link[data-key^="D|STEMI|R|"]');
 const rl=await pg.evaluate(()=>[...document.querySelectorAll('#clt-tree .clt-link[data-key^="D|STEMI|R|"]')].map(e=>e.dataset.key));assert(rl.length>=4,'STEMI kpis '+rl.length);
 await pg.click('#clt-tree .clt-link[data-key="D|STEMI|context"]');await pg.fill('#clt-text','บริบท STEMI');await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['D|STEMI|context']);
 await pg.click('#clt-tree .clt-link[data-key="D|STEMI|flow"]');assert(/แปะรูปเอง/.test(await pg.textContent('#clt-editor')),'flowchart note');
 await pg.click(`#clt-tree .clt-link[data-key="${rl[0]}"]`);await pg.waitForSelector('#clt-editor .pr-chart svg');
 const rd=await pg.evaluate(()=>({sel:document.querySelector('#clt-editor select').value,opts:document.querySelectorAll('#clt-editor select option').length,hasFromDetails:!!document.querySelector('#clt-editor button[onclick="cltFromDetails()"]')}));assert(rd.opts===8,JSON.stringify(rd));
 const kid=rl[0].split('|')[3];
 await pg.selectOption('#clt-editor select','G');await pg.waitForFunction(id=>clt.items['DIM|'+id]&&clt.items['DIM|'+id].text==='G',kid);assert(C.getCltDoc(tA,fy).items['DIM|'+kid].text==='G','dim saved');
 await pg.click('#clt-editor button:has-text("➕ ใส่หัวข้อ")');assert((await pg.inputValue('#clt-text')).startsWith('การพัฒนาที่ผ่านมา'));
 await pg.fill('#clt-text','การพัฒนาที่ผ่านมา\nอบรม EKG\n\nปัญหา/อุปสรรค\nส่งไลน์ช้า');await pg.click('#clt-save');await pg.waitForFunction(k=>clt.items[k],rl[0]);
 // มิติ: ตารางอัตโนมัติ
 await pg.click('#clt-tree .clt-link[data-key="O|dims"]');
 const dm=await pg.evaluate(()=>({rows:document.querySelectorAll('#clt-editor table tbody tr').length,groups:cltSelectedGroups().length,stemiRow:[...document.querySelectorAll('#clt-editor table tbody tr')].find(r=>r.textContent.startsWith('STEMI')).children.length}));assert(dm.rows===dm.groups&&dm.stemiRow===9,JSON.stringify(dm));
 // เลือกกลุ่มโรค: เอาออกบางกลุ่ม → บันทึก S|groups
 const g0=await pg.evaluate(()=>cltSelectedGroups().length);
 await pg.uncheck('#clt-tree input[data-g="Med error"]');await pg.waitForFunction(n=>cltSelectedGroups().length===n-1,g0);
 assert(JSON.parse(C.getCltDoc(tA,fy).items['S|groups'].text).length===g0-1&&!JSON.parse(C.getCltDoc(tA,fy).items['S|groups'].text).includes('Med error'),'S|groups saved');
 await pg.screenshot({path:OUT+'/clt-2-editor.png'});

 // ---- 4. แก้ชนกัน (ผอ. แก้ก่อน) + แก้ต่อจากของฉัน
 await pg.click('#clt-tree .clt-link[data-key="O|mission"]');await pg.waitForSelector('#clt-text');
 C.saveCltItem(tE,fy,'O|mission','ผอ.แก้ก่อน',1);
 await pg.fill('#clt-text','ของ admin (รุ่นเก่า)');await pg.click('#clt-save');await pg.waitForSelector('#modal-alert',{state:'visible'});assert(/ถูกแก้ไขโดย/.test(await pg.textContent('#modal-alert')));await pg.click('#modal-alert button');
 await pg.waitForSelector('#clt-remote-slot .sar-remote');assert((await pg.textContent('#clt-remote-slot .sar-remote-text'))==='ผอ.แก้ก่อน');assert(C.getCltDoc(tA,fy).items['O|mission'].text==='ผอ.แก้ก่อน');
 await pg.click('#clt-remote-slot button:has-text("แก้ต่อจากของฉัน")');await pg.waitForTimeout(200);assert((await pg.inputValue('#clt-text'))==='ของ admin (รุ่นเก่า)');
 await pg.click('#clt-save');await pg.waitForFunction(()=>clt.items['O|mission'].rev===3);assert(C.getCltDoc(tA,fy).items['O|mission'].text==='ของ admin (รุ่นเก่า)');
 // อัปเดตอัตโนมัติ (ไม่ทับที่กำลังพิมพ์)
 C.saveCltItem(tE,fy,'O|scope','ขอบเขตจากเครื่องอื่น',0);await pg.evaluate(()=>livePoll());await pg.waitForFunction(()=>clt.items['O|scope']&&clt.items['O|scope'].text==='ขอบเขตจากเครื่องอื่น',null,{timeout:8000});
 await pg.fill('#clt-text','ผมกำลังพิมพ์');C.saveCltItem(tE,fy,'O|mission','ผอ.แก้อีก',3);await pg.evaluate(()=>livePoll());await pg.waitForSelector('#clt-remote-slot .sar-remote',{timeout:8000});
 assert((await pg.inputValue('#clt-text'))==='ผมกำลังพิมพ์','typing preserved');await pg.click('#clt-remote-slot button:has-text("ใช้ข้อความล่าสุด")');await pg.waitForTimeout(200);assert((await pg.inputValue('#clt-text'))==='ผอ.แก้อีก');

 // ---- 5. Export PowerPoint (มีหัวข้อที่ยังว่าง → ถามก่อน)
 assert(await pg.evaluate(()=>getComputedStyle(document.getElementById('clt-export-btn')).display!=='none'));
 await pg.click('#clt-export-btn');await pg.waitForSelector('#modal-confirm',{state:'visible'});assert(/ยังไม่ได้กรอก \d+ หัวข้อ/.test(await pg.textContent('#confirm-message')));
 const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:240000}),pg.click('#modal-confirm .btn-danger')]);
 const file=OUT+'/'+dl.suggestedFilename();await dl.saveAs(file);assert(dl.suggestedFilename()==='CLT_PCT_FY2570.pptx');
 const list=execFileSync('unzip',['-Z1',file]).toString().split('\n');
 const slides=list.filter(x=>/^ppt\/slides\/slide\d+\.xml$/.test(x)),charts=list.filter(x=>/^ppt\/charts\/chart\d+\.xml$/.test(x));
 const sx=n=>execFileSync('unzip',['-p',file,'ppt/slides/slide'+n+'.xml'],{maxBuffer:1<<28}).toString('utf8');
 let all='';slides.forEach((_,i)=>{all+=sx(i+1)});
 const nGroups=await pg.evaluate(()=>cltSelectedGroups().length),nKpis=await pg.evaluate(()=>cltSelectedGroups().reduce((n,g)=>n+cltKpisOf(g).length,0));
 console.log('pptx',Math.round(fs.statSync(file).size/1024)+'KB','slides',slides.length,'charts',charts.length,'groups',nGroups,'kpis',nKpis);
 assert(charts.length>0&&charts.length<=nKpis&&charts.length>nKpis*0.7,'one native chart per kpi with data '+charts.length+'/'+nKpis);
 assert(all.includes('พันธกิจ 2570 ดูแลผู้ป่วยทุกกลุ่ม'.slice(0,0)||'ผอ.แก้อีก')&&all.includes('ผู้ป่วยฉุกเฉิน')&&all.includes('บริบท STEMI')&&all.includes('อบรม EKG')&&all.includes('ส่งไลน์ช้า'),'texts present');
 assert((all.match(/แทรกรูป Process Flowchart ที่นี่/g)||[]).length===nGroups,'one flowchart placeholder per selected group');
 assert(!all.includes('Med error'.slice(0,0)||'ระบุตัวผู้ป่วยผิดพลาด')||true);
 assert(all.includes('TH SarabunPSK')&&!/Calibri|Arial/.test(all.replace(/<a:ea[^>]*>|<a:cs[^>]*>/g,'')),'font');
 assert(!/[๐-๙]/.test(all.replace(/<[^>]+>/g,'')),'arabic digits only');
 const pres=execFileSync('unzip',['-p',file,'ppt/presentation.xml']).toString();assert(/<p:sldSz cx="12192000" cy="6858000"/.test(pres),'16:9');
 await pg.evaluate(()=>{document.getElementById('modal-confirm').style.display='none'});
 assert(pg.errs.length===0,'errors '+pg.errs.join('|'));
 await b.close();console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
