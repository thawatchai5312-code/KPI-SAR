// ระบบสอน (🎓): staff สอนบนมุมมองการ์ด (ไม่มีขั้นตาราง · ทุกขั้นกรอบอยู่ในจอ · จบแล้วคืนมุมมองเดิมและปิดโหมดแก้ไขโดยไม่บันทึก) · head/admin สอนบนตารางเหมือนเดิม

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
 const st=U.find(r=>r[2]==='staff'&&C.getAllData(C.createSession_(r[0],C.hashPassword_('pw123456')),2570)),hd=U.find(r=>r[2]==='head');[st,hd].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
 const Y=y=>h.sheets['ปีงบ '+y].d;const snap=()=>JSON.stringify(Y(2570).map(r=>r.map((v,i)=>i===31||i===32?'':v)));const before=snap(); // ไม่นับ 'เข้าดูล่าสุด' (การเปิดดูตัวชี้วัดบันทึกเวลาเข้าดูตามปกติ)
 async function run(who,mode,shots){
  const pg=await open(br,who);
  await pg.evaluate(()=>{window.__dummy=1});
  assert.strictEqual(await pg.evaluate(()=>listMode),mode);
  // สลับมุมมองเองก่อนสอน → ระบบสอนต้องใช้มุมมองของ Tier แล้วคืนค่าเดิมตอนจบ
  const other=mode==='card'?'table':'card';await pg.evaluate(m=>setListMode(m),other);
  await pg.evaluate(()=>tourStart());await pg.waitForSelector('#tour-tip',{state:'visible'});
  const steps=await pg.evaluate(()=>tourState.steps.map(s=>s.title));
  const seen=[];
  for(let i=0;i<steps.length;i++){
   await pg.waitForFunction(([i,n])=>{const t=document.getElementById('tour-tip'),s=t&&t.querySelector('.tour-step');return t&&t.style.display==='block'&&s&&s.innerText.replace(/\s+/g,'').startsWith('ขั้นที่'+(i+1)+'/')},[i,steps.length],{timeout:20000});await pg.waitForTimeout(450);
   const info=await pg.evaluate(()=>{const sp=document.getElementById('tour-spot').getBoundingClientRect(),tip=document.getElementById('tour-tip').getBoundingClientRect();return {title:document.querySelector('#tour-tip .tour-title').innerText,step:document.querySelector('#tour-tip .tour-step').innerText,spot:[Math.round(sp.left),Math.round(sp.top),Math.round(sp.right),Math.round(sp.bottom)],inView:sp.bottom>0&&sp.top<innerHeight&&sp.right>0&&sp.left<innerWidth&&sp.width>10&&sp.height>10,tipIn:tip.left>=0&&tip.right<=innerWidth&&tip.top>=0&&tip.bottom<=innerHeight,mode:listMode,editing:editingId}});
   seen.push(info);if(process.env.DBG)console.log(i,JSON.stringify(info.title),info.editing);
   assert(info.inView&&info.tipIn,who[2]+' step '+(i+1)+' '+JSON.stringify(info));
   if(shots&&shots.some(t=>info.title.trim()===t))await pg.screenshot({path:OUT+'/ui61-'+mode+'-'+i+'.png'});
   if(i<steps.length-1)await pg.evaluate(()=>tourNext());
  }
  await pg.evaluate(()=>tourNext());await pg.waitForFunction(()=>!tourState.active,null,{timeout:10000});
  const end=await pg.evaluate(()=>({mode:listMode,editing:editingId,addOpen:document.getElementById('modal-add-kpi').style.display,tour:!!document.getElementById('tour-tip'),tab:currentTab}));
  assert.strictEqual(end.mode,other,'restored mode');assert(end.editing===null&&end.addOpen!=='flex'&&!end.tour&&end.tab==='home',JSON.stringify(end));
  assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
  await pg.context().close();
  return {steps,seen};
 }
 const s=await run(st,'card',['การ์ดตัวชี้วัด','แบ่งหน้าและซ่อนกราฟ','กรอกผลและแก้ไข','โหมดแก้ไข: ชื่อตัวชี้วัด','ผลรายเดือน','ผู้รับผิดชอบ หน่วยงาน และหมวด','บันทึกหรือยกเลิก']);
 console.log('staff steps:',s.steps.join(' | '));
 for(const t of ['การ์ดตัวชี้วัด','แบ่งหน้าและซ่อนกราฟ','กรอกผลและแก้ไข','โหมดแก้ไข: ชื่อตัวชี้วัด','ผลทั้งปี (5 ปีงบ)','ผลรายเดือน','บันทึกหรือยกเลิก'])assert(s.steps.includes(t),'staff step '+t);
 for(const t of ['ตารางตัวชี้วัด','ซ่อน/แสดงกลุ่มคอลัมน์','ความถี่และวิธีสรุปผล (ผู้บริหาร)','ระดับตัวชี้วัด (ผู้บริหาร)'])assert(!s.steps.includes(t),'staff must not see '+t);
 assert(s.seen.every(x=>x.mode==='card'),'staff tour stays on cards');
 const EDT=['โหมดแก้ไข: ชื่อตัวชี้วัด','ค่าเป้าหมาย','ผลทั้งปี (5 ปีงบ)','ผลรายเดือน','รายละเอียด / การวิเคราะห์','ที่มาแหล่งข้อมูล / สูตรคำนวณ','ผู้รับผิดชอบ หน่วยงาน และหมวด','บันทึกหรือยกเลิก'];const e=s.seen.filter(x=>EDT.includes(x.title.trim()));assert(e.length>=5&&e.every(x=>x.editing!==null),'edit steps run in real edit mode '+e.length);assert(s.seen.filter(x=>!EDT.includes(x.title.trim())&&x.title.trim()!=='กรอกผลและแก้ไข'||0).every(x=>x.editing===null||EDT.includes(x.title.trim())),'edit mode closed outside the edit section');
 const t=await run(hd,'table',[]);
 assert(t.steps.includes('ตารางตัวชี้วัด')&&t.steps.includes('ซ่อน/แสดงกลุ่มคอลัมน์')&&!t.steps.includes('การ์ดตัวชี้วัด'),'head tour on table: '+t.steps.join('|'));
 assert(t.seen.every(x=>x.mode==='table'));
 assert.strictEqual(snap(),before,'tour saved nothing (data/edit stamps unchanged)');
 await br.close();console.log('ui61 ok');
})().catch(e=>{console.error(e);process.exit(1)});
