// guided tour: welcome popup (skip / never again, per account on server), full walk per role, end anytime, 🎓 button, mobile
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness5');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const st=pick('staff','ER'),hd=pick('head','ER'),ad=pick('admin');
[st,hd,ad].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const SNAP=()=>JSON.stringify(h.sheets['ปีงบ 2570'].d)+JSON.stringify(h.sheets['ปีงบ 2569'].d);
const ex=pick('executive'); if(ex){ex[1]=C.hashPassword_('pw123456');ex[4]='FALSE';}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mk=async(w,hh)=>{const pg=await b.newPage({viewport:{width:w||1440,height:hh||900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');return pg};
 const login=async(pg,u)=>{await pg.fill('#login-username',u);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});};
 const welcome=pg=>pg.waitForSelector('#modal-tour-welcome',{state:'visible',timeout:3000}).then(()=>true,()=>false);
 // fy change from the top bar must not show the welcome popup
 let pg=await mk(); await login(pg,st[0]);
 assert(await welcome(pg),'welcome shows after FY pick'); console.log('welcome shown ✔');
 // skip → not saved
 await pg.click('#modal-tour-welcome button:has-text("ข้าม")'); assert(!(await pg.isVisible('#modal-tour-welcome')));
 assert(C.getTourPrefs(C.createSession_(st[0],st[1])).hide===false);
 await pg.evaluate(()=>{changeFiscalYear(2569)}); await pg.waitForTimeout(800); assert(!(await pg.isVisible('#modal-tour-welcome')),'no popup on FY change');
 await pg.evaluate(()=>logout()); await pg.waitForTimeout(300);
 await login(pg,st[0]); assert(await welcome(pg),'skip → shows again next login'); console.log('skip → again ✔');
 // never again (tick + skip)
 await pg.check('#tour-hide-cb'); await pg.click('#modal-tour-welcome button:has-text("ข้าม")');
 await pg.waitForTimeout(300); assert(C.getTourPrefs(C.createSession_(st[0],st[1])).hide===true,'saved on server');
 await pg.evaluate(()=>logout()); await pg.waitForTimeout(300);
 const pg2=await mk(); await login(pg2,st[0]); assert(!(await welcome(pg2)),'never again honoured (other browser)'); console.log('never again (per account) ✔');
 // 🎓 button position: right before change-password
 const order=await pg2.evaluate(()=>[...document.querySelectorAll('#user-bar button')].map(b=>b.innerText.trim()));console.log('buttons',order.join(' | '));
 assert(order.indexOf('🎓 แนะนำการใช้งาน')===order.indexOf('🔑 เปลี่ยนรหัสผ่าน')-1);
 // walk the full tour from the button as staff
 const walk=async(p,label)=>{const seen=[];await p.click('#tour-btn');await p.waitForSelector('#tour-tip',{state:'visible'});
   for(let i=0;i<60;i++){await p.waitForSelector('#tour-tip .tour-title',{timeout:6000});await p.waitForTimeout(250);
     const info=await p.evaluate(()=>{const t=document.getElementById('tour-tip'),s=document.getElementById('tour-spot'),r=s.getBoundingClientRect(),tr=t.getBoundingClientRect(),vw=innerWidth,vh=innerHeight;
       return {ctx:tourState.ctx,editing:!!document.querySelector('.kpi-card.editing, tr.kpi-row.editing'),addOpen:getComputedStyle(document.getElementById('modal-add-kpi')).display!=='none',title:t.querySelector('.tour-title').textContent,step:t.querySelector('.tour-step').textContent,tab:currentTab,inView:r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=vw+1&&r.bottom<=vh+1,tipIn:tr.left>=0&&tr.top>=0&&tr.right<=vw+1&&tr.bottom<=vh+1,btn:[...t.querySelectorAll('.tour-foot .btn')].map(x=>x.textContent.trim())}});
     seen.push(info); assert(info.editing===(info.ctx==='edit')&&info.addOpen===(info.ctx==='add'),label+' ctx state '+info.title+' '+info.ctx+' '+info.editing+' '+info.addOpen);
     assert(info.inView&&info.tipIn,label+' step '+info.step+' '+info.title+' out of view '+JSON.stringify(info));
     if(info.btn[1].includes('เสร็จสิ้น')){await p.click('#tour-tip .tour-foot .btn-primary');break;}
     await p.click('#tour-tip .tour-foot .btn-primary');}
   await p.waitForTimeout(300); return seen;};
 const before=SNAP();
 let seen=await walk(pg2,'staff'); assert(SNAP()===before,'staff walk changed data'); console.log('after walk:',JSON.stringify(await pg2.evaluate(()=>({e:editingId,m:getComputedStyle(document.getElementById('modal-add-kpi')).display,ctx:tourState.ctx,tab:currentTab})))); assert(await pg2.evaluate(()=>editingId===null&&getComputedStyle(document.getElementById('modal-add-kpi')).display==='none'),'ctx closed after walk');
 console.log('staff titles:',seen.map(x=>x.title).join(' | ')); console.log('staff steps:',seen.map(s=>s.step+' '+s.title+' ['+s.tab+']').join('\n  '));
 assert(!(await pg2.isVisible('#tour-tip'))&&await pg2.evaluate(()=>currentTab==='home'),'tour ends on home');
 assert(!seen.some(s=>/⚙️ ตั้งค่า/.test(s.title)),'staff has no settings step'); assert(seen.length>=24,'staff step count '+seen.length); assert(seen.filter(x=>x.ctx==='edit').length>=8&&seen.filter(x=>x.ctx==='add').length===9&&seen.some(x=>x.title==='ผลรายเดือน'&&x.ctx==='edit')&&seen.some(x=>x.title==='หมวดตามระดับ (ตั้งค่าหลัก)'));
 assert(seen.map(s=>s.tab).includes('report')&&seen.map(s=>s.tab).includes('progress'));
 // end anytime (button), back button, Esc
 await pg2.click('#tour-btn'); await pg2.waitForSelector('#tour-tip .tour-title'); await pg2.click('#tour-tip .btn-primary'); await pg2.waitForTimeout(500);
 await pg2.click('#tour-tip .btn-secondary'); await pg2.waitForTimeout(500); assert((await pg2.innerText('#tour-tip .tour-step')).startsWith('ขั้นที่ 1/'),'back works');
 await pg2.click('#tour-tip .tour-end'); assert(!(await pg2.isVisible('#tour-tip'))&&!(await pg2.isVisible('#tour-spot'))&&!(await pg2.isVisible('#tour-blocker')),'end button'); 
 await pg2.click('#tour-btn'); await pg2.waitForSelector('#tour-tip .tour-title'); await pg2.keyboard.press('Escape'); await pg2.waitForTimeout(200); assert(!(await pg2.isVisible('#tour-tip')),'Esc ends');
 // end in the middle of edit ctx → edit mode closed, no data change
 { const b0=SNAP(); await pg2.click('#tour-btn'); await pg2.waitForSelector('#tour-tip .tour-title'); for(let i=0;i<8;i++){await pg2.waitForTimeout(250);await pg2.click('#tour-tip .tour-foot .btn-primary');} await pg2.waitForTimeout(600); assert(await pg2.evaluate(()=>!!document.querySelector('tr.kpi-row.editing, .kpi-card.editing')),'in edit ctx'); await pg2.click('#tour-tip .tour-end'); await pg2.waitForTimeout(400); assert(await pg2.evaluate(()=>editingId===null&&!document.querySelector('.kpi-card.editing')),'edit closed on end'); assert(SNAP()===b0); }
 // blocker prevents clicks on the page while touring; logout mid-tour clears it
 await pg2.click('#tour-btn'); await pg2.waitForSelector('#tour-tip .tour-title'); const cl=await pg2.evaluate(()=>{const e=document.elementFromPoint(300,300);return e&&e.id});assert(cl==='tour-blocker','page click blocked');
 await pg2.evaluate(()=>logout()); await pg2.waitForTimeout(300); assert(!(await pg2.evaluate(()=>!!document.getElementById('tour-tip')||!!document.getElementById('tour-blocker'))),'logout clears tour');
 // start from welcome 'เริ่มแนะนำ' (head), admin extra step
 const pg3=await mk(); await login(pg3,hd[0]); assert(await welcome(pg3)); await pg3.click('#modal-tour-welcome button:has-text("เริ่มแนะนำ")'); await pg3.waitForSelector('#tour-tip .tour-title'); await pg3.click('#tour-tip .tour-end');
 const pg4=await mk(); await login(pg4,ad[0]); await pg4.click('#modal-tour-welcome button:has-text("ข้าม")'); const b4=SNAP(); seen=await walk(pg4,'admin'); assert(SNAP()===b4,'admin walk changed data'); console.log('admin titles:',seen.map(x=>x.title).join(' | ')); console.log('admin steps',seen.length,'| last:',seen[seen.length-1].title);
 assert(seen.some(s=>/⚙️ ตั้งค่า/.test(s.title))&&seen.some(s=>/ความถี่และวิธีสรุปผล \(ผู้บริหาร\)/.test(s.title))&&seen.some(s=>/ระดับตัวชี้วัด \(ผู้บริหาร\)/.test(s.title))&&seen.length>=27,'admin count '+seen.length);
 // mobile
 const m=await mk(390,844); await login(m,st[0]); assert(!(await welcome(m)),'staff already hid welcome'); await m.evaluate(()=>tourStart());
 await m.waitForSelector('#tour-tip .tour-title'); let n=0; for(let i=0;i<60;i++){await m.waitForTimeout(300);const o=await m.evaluate(()=>{const t=document.getElementById('tour-tip').getBoundingClientRect(),s=document.getElementById('tour-spot').getBoundingClientRect();return {tipBottom:t.bottom<=innerHeight+1,tipTop:t.top>0,spot:s.width>0}});assert(o.tipBottom&&o.spot,'mobile step '+i);n++;const last=(await m.innerText('#tour-tip .tour-foot .btn-primary')).includes('เสร็จสิ้น');await m.click('#tour-tip .tour-foot .btn-primary');if(last)break;}
 console.log('mobile steps',n);
 for(const p of [pg,pg2,pg3,pg4,m])assert(p._errs.length===0,p._errs.join());
 await b.close(); console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
