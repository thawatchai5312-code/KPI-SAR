// มุมมองตาราง: ลูกกลิ้งบนคอลัมน์ที่ไม่ตรึง = เลื่อนซ้าย-ขวา (หยุดที่ขอบ), บนที่/ชื่อ/จัดการ = เลื่อนขึ้น-ลง · สีคอลัมน์ที่ตรึงตามสถานะ
// + เมนูไม่มีวงเล็บอังกฤษ + ไม่มีปุ่ม Export PDF มุมขวาบน
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const OUT=process.cwd();
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const ad=U.find(r=>r[2]==='admin');ad[1]=C.hashPassword_('pw123456');ad[4]='FALSE';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await b.newPage({viewport:{width:1280,height:800}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForSelector('#kpi-table');await pg.waitForFunction(()=>tblPending.length===0,null,{timeout:30000});

 // ---- 1. เมนู + ปุ่ม Export PDF มุมขวาบน
 const nav=await pg.evaluate(()=>({home:document.getElementById('menu-home-btn').textContent.trim(),prog:document.getElementById('menu-progress-btn').textContent.trim(),
   exportBtn:!!document.getElementById('btn-export-pdf'),fn:typeof exportPdfClick,navText:document.querySelector('.nav-bar').textContent}));
 assert(nav.home==='📊 หน้าแรก'&&nav.prog==='📋 ติดตามงาน'&&!nav.exportBtn&&nav.fn==='undefined'&&!/Dashboard|Progress/.test(nav.navText),JSON.stringify(nav));
 console.log('menu OK');

 // ---- 2. ลูกกลิ้ง
 await pg.evaluate(()=>{tblHide.clear();renderList()});await pg.waitForFunction(()=>tblPending.length===0,null,{timeout:30000});
 const geo=()=>pg.evaluate(()=>{const w=document.getElementById('tbl-wrap');return {l:Math.round(w.scrollLeft),t:Math.round(w.scrollTop),maxL:w.scrollWidth-w.clientWidth,maxT:w.scrollHeight-w.clientHeight}});
 const cellPt=(sel)=>pg.evaluate(sel=>{const w=document.getElementById('tbl-wrap').getBoundingClientRect();
   const tds=[...document.querySelectorAll('tr.kpi-row')].slice(0,12).flatMap(r=>[...r.querySelectorAll('td')]);
   const pick=sel==='free'?tds.find(td=>!td.matches('.c-no,.c-name,.c-act')&&td.dataset.g==='annual'):tds.find(td=>td.matches(sel));
   const r=pick.getBoundingClientRect();const cx=r.left+r.width/2;return {x:Math.round(sel==='free'?Math.min(Math.max(cx,w.left+340),w.right-120):cx),y:Math.round(r.top+Math.min(r.height/2,12))}},sel);
 const g0=await geo();assert(g0.maxL>500&&g0.maxT>300,'table is wide and tall: '+JSON.stringify(g0));
 let p=await cellPt('free');await pg.mouse.move(p.x,p.y);
 await pg.mouse.wheel(0,200);await pg.waitForTimeout(150);let g=await geo();
 assert(g.l===200&&g.t===g0.t,'wheel down on free column scrolls right only: '+JSON.stringify(g));
 await pg.mouse.wheel(0,-120);await pg.waitForTimeout(150);g=await geo();assert(g.l===80&&g.t===g0.t,'wheel up scrolls back left: '+JSON.stringify(g));
 for(let i=0;i<30;i++)await pg.mouse.wheel(0,400);await pg.waitForTimeout(250);g=await geo();assert(g.l===g.maxL&&g.t===g0.t,'stops at right edge, no vertical movement: '+JSON.stringify(g));
 await pg.mouse.wheel(0,400);await pg.waitForTimeout(150);const g2=await geo();assert(g2.l===g.maxL&&g2.t===g0.t,'still stopped at edge');
 for(let i=0;i<40;i++)await pg.mouse.wheel(0,-400);await pg.waitForTimeout(250);g=await geo();assert(g.l===0&&g.t===g0.t,'stops at left edge: '+JSON.stringify(g));
 // คอลัมน์ที่ตรึง → เลื่อนขึ้น-ลง
 for(const sel of ['td.c-name','td.c-no','td.c-act']){
  await pg.evaluate(()=>{const w=document.getElementById('tbl-wrap');w.scrollTop=0;w.scrollLeft=300});p=await cellPt(sel);await pg.mouse.move(p.x,p.y);
  await pg.mouse.wheel(0,300);await pg.waitForTimeout(200);g=await geo();assert(g.t>0&&g.l===300,sel+' scrolls vertically only: '+JSON.stringify(g));
 }
 // ส่วนหัวตาราง: คอลัมน์ไม่ตรึง = ซ้าย-ขวา
 await pg.evaluate(()=>{const w=document.getElementById('tbl-wrap');w.scrollTop=0;w.scrollLeft=0});
 const hp=await pg.evaluate(()=>{const th=[...document.querySelectorAll('#kpi-table thead tr.tbl-h2 th')].find(t=>!t.matches('.c-no,.c-name,.c-act')&&t.getBoundingClientRect().left>360&&t.getBoundingClientRect().right<1100);const r=th.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}});
 await pg.mouse.move(hp.x,hp.y);await pg.mouse.wheel(0,150);await pg.waitForTimeout(150);g=await geo();assert(g.l===150&&g.t===0,'header free column scrolls horizontally: '+JSON.stringify(g));
 // ท่าเลื่อนข้างอยู่แล้ว (deltaX) ไม่ถูกแปลง
 await pg.evaluate(()=>{document.getElementById('tbl-wrap').scrollLeft=0});p=await cellPt('free');await pg.mouse.move(p.x,p.y);await pg.mouse.wheel(100,0);await pg.waitForTimeout(150);g=await geo();assert(g.l>0&&g.t===0,'native horizontal wheel still works: '+JSON.stringify(g));
 console.log('wheel OK');

 // ---- 3. สีคอลัมน์ที่ตรึง
 await pg.evaluate(()=>{const w=document.getElementById('tbl-wrap');w.scrollTop=0;w.scrollLeft=0});
 const want={green:'rgb(236, 253, 245)',yellow:'rgb(255, 251, 235)',red:'rgb(254, 242, 242)'};
 await pg.mouse.move(5,5);
 // ข้อมูลชุดนี้มีไม่ครบทุกสถานะ → ตั้งคลาสสถานะให้แถวแรกทีละระดับ (CSS ผูกกับคลาสนี้)
 const seen=await pg.evaluate(()=>{const o={},row=document.querySelector('tr.kpi-row');const orig=row.className;
   for(const lv of ['green','yellow','red']){row.className='kpi-row st-'+lv;const bg=s=>getComputedStyle(row.querySelector(s)).backgroundColor;o[lv]={no:bg('td.c-no'),name:bg('td.c-name'),act:bg('td.c-act'),free:bg('td[data-g=annual]')}}row.className=orig;return o});
 console.log(JSON.stringify(seen));
 for(const lv of ['green','yellow','red']){assert(seen[lv].no===want[lv]&&seen[lv].name===want[lv]&&seen[lv].act===want[lv],lv+' fixed columns tinted: '+JSON.stringify(seen[lv]));assert(seen[lv].free==='rgb(255, 255, 255)',lv+' other cells stay white: '+seen[lv].free)}
 const real=await pg.evaluate(()=>{const r=[...document.querySelectorAll('tr.kpi-row')].map(r=>r.className.match(/st-(\w+)/)[1]);return [...new Set(r)]});console.log('real levels in data',real.join(','));
 const sel=await pg.evaluate(()=>{const row=document.querySelector('tr.kpi-row.st-red')||document.querySelector('tr.kpi-row');const o={};for(const cls of ['selected','editing']){row.classList.add(cls);const bg=s=>getComputedStyle(row.querySelector(s)).backgroundColor;o[cls]={no:bg('td.c-no'),name:bg('td.c-name'),act:bg('td.c-act'),free:bg('td[data-g=annual]')};row.classList.remove(cls)}return o});
 assert(sel.selected.no==='rgb(254, 252, 232)'&&sel.selected.name===sel.selected.free&&sel.selected.act===sel.selected.free,'selected row uses row colour: '+JSON.stringify(sel.selected));
 assert(sel.editing.no==='rgb(239, 246, 255)'&&sel.editing.name===sel.editing.free&&sel.editing.act===sel.editing.free,'editing row uses row colour: '+JSON.stringify(sel.editing));
 await pg.screenshot({path:OUT+'/ui49-table.png'});
 assert(errs.length===0,errs.join('|'));
 console.log('ALL OK');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
