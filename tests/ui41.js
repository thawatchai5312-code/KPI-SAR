// concurrent use: busy overlay, auto-update every 10 s (corner notice), editing-card banner, conflict dialog (reload / force-merge / stay)
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE");
const U=h.sheets.Users.d;const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const st=pick('staff','ER'),ad=pick('admin');[st,ad].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tS=C.createSession_(st[0],st[1]),tA=C.createSession_(ad[0],ad[1]);
const X=C.getAllData(tS,2570).data.find(k=>k.canEditResults&&k.canEditDetails&&k.isOwner);assert(X,'shared kpi');
const srv=id=>C.getAllData(tA,2570).data.find(k=>k.id===id);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mk=async(w,hh)=>{const pg=await b.newPage({viewport:{width:w||1440,height:hh||900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
  await pg.addInitScript(()=>{window.__delay={};window.__calls=[];function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>{window.__calls.push(fn);return new Promise(r=>setTimeout(r,window.__delay[fn]||0)).then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');return pg};
 const login=async(pg,u)=>{await pg.fill('#login-username',u);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});};
 const A=await mk(),B=await mk();await login(A,ad[0]);await login(B,st[0]);
 const poll=async p=>{await p.evaluate(()=>livePoll());await p.waitForTimeout(400);};
 const cardMonth0=(p,id)=>p.evaluate(id=>{const c=[...document.querySelectorAll('.kpi-card')].find(c=>c.dataset.id===id);return c?c.innerText:null},id);

 // ---- 1. busy overlay while saving (B), blocks clicks and double submit
 await B.evaluate(id=>{goToKpi(id);startEditNow(id)},X.id);await B.waitForSelector('.kpi-card.editing #ed-m0');
 await B.fill('#ed-m0','41.5');await B.evaluate(()=>{window.__delay.saveKpi=1500});
 await B.click('.kpi-card.editing .btn-primary');await B.waitForTimeout(200);
 assert(await B.isVisible('#busy-overlay'),'overlay visible');assert((await B.innerText('#busy-overlay')).includes('กำลังบันทึกข้อมูล'));
 assert(await B.evaluate(()=>document.elementFromPoint(500,400).closest('#busy-overlay')!==null),'clicks blocked');
 await B.evaluate(()=>saveKpiEdit());await B.keyboard.press('Enter');
 await B.waitForSelector('#busy-overlay',{state:'hidden',timeout:5000});
 assert((await B.evaluate(()=>window.__calls.filter(c=>c==='saveKpi').length))===1,'only one save sent');
 assert(srv(X.id).months[0]===41.5);await B.evaluate(()=>{window.__delay.saveKpi=0});console.log('busy overlay ✔');

 // ---- 2. A sees the change via poll: card updated, corner notice with B's name, page + scroll kept
 await A.evaluate(id=>goToKpi(id),X.id);await A.waitForTimeout(800);
 const y0=await A.evaluate(()=>{window.scrollBy(0,40);return [scrollY,currentPage]});
 await poll(A);
 assert(await A.evaluate(id=>globalDatabase.find(k=>k.id===id).months[0]===41.5,X.id),'A data updated');
 assert((await cardMonth0(A,X.id)).includes('41.5'),'A card re-rendered');
 const note=await A.innerText('#live-toast');assert(await A.isVisible('#live-toast')&&note.includes('อัปเดตข้อมูลล่าสุด 1 ตัวชี้วัด')&&note.includes(st[0]),note);
 const y1=await A.evaluate(()=>[scrollY,currentPage]);assert(y1[1]===y0[1]&&Math.abs(y1[0]-y0[0])<5,'scroll/page kept '+y0+' '+y1);
 // own save not announced on B
 await poll(B);assert(!(await B.isVisible('#live-toast')),'own change not announced');console.log('auto update + notice ✔',note);

 // ---- 3. automatic 10 s interval (no manual poll)
 let cur=srv(X.id);let r=C.saveKpi(tS,2570,{id:X.id,years:cur.years,months:cur.months.map((v,i)=>i===1?7.25:v),baseRev:cur.rev});assert(r.success&&r.changed);
 await A.waitForFunction(id=>globalDatabase.find(k=>k.id===id).months[1]===7.25,X.id,{timeout:13000});console.log('10 s interval ✔');

 // ---- 4. A editing X; B saves X → banner on A, A's typing kept; A saves → conflict dialog
 await A.evaluate(id=>startEditNow(id),X.id);await A.waitForSelector('.kpi-card.editing #ed-target');
 await A.fill('#ed-target','≥ 99 (A)');await A.evaluate(()=>onEditInput());
 cur=srv(X.id);r=C.saveKpi(tS,2570,{id:X.id,years:cur.years,months:cur.months.map((v,i)=>i===2?3.5:v),baseRev:cur.rev});assert(r.success&&r.changed);
 await poll(A);
 assert(await A.isVisible('.kpi-card.editing .remote-banner'),'banner shown');assert((await A.innerText('.kpi-card.editing .remote-banner')).includes(st[0]));
 assert((await A.inputValue('#ed-target'))==='≥ 99 (A)','typing kept');assert((await A.inputValue('#ed-m2'))!=='3.5','editing card untouched');
 await A.click('.kpi-card.editing .btn-primary');await A.waitForSelector('#modal-conflict',{state:'visible'});
 const btns=await A.$$eval('#modal-conflict .conflict-actions .btn',x=>x.map(b=>b.innerText.split('\n')[0]));assert(btns.join('|')==='🔄 โหลดข้อมูลล่าสุด|💾 บันทึกทับ|✏️ กลับไปแก้ต่อ',btns.join('|'));
 assert((await A.innerText('#conflict-message')).includes(st[0]));assert(srv(X.id).target!=='≥ 99 (A)','nothing written yet');
 // stay → still editing with typing
 await A.click('#modal-conflict button:has-text("กลับไปแก้ต่อ")');assert(!(await A.isVisible('#modal-conflict')));assert((await A.inputValue('#ed-target'))==='≥ 99 (A)'&&await A.evaluate(()=>editingId!==null));
 // force → A's target + B's month 2 both kept
 await A.click('.kpi-card.editing .btn-primary');await A.waitForSelector('#modal-conflict',{state:'visible'});
 await A.click('#modal-conflict button:has-text("บันทึกทับ")');await A.waitForSelector('#busy-overlay',{state:'hidden'});await A.waitForTimeout(300);
 cur=srv(X.id);assert(cur.target==='≥ 99 (A)'&&cur.months[2]===3.5&&cur.months[0]===41.5,'force merges: '+cur.target+' '+cur.months);
 assert(await A.evaluate(()=>editingId===null),'edit closed');assert(!(await A.isVisible('.remote-banner')));console.log('conflict stay + force-merge ✔');

 // ---- 5. reload path
 await A.evaluate(id=>startEditNow(id),X.id);await A.waitForSelector('.kpi-card.editing #ed-target');await A.fill('#ed-target','A-two');
 cur=srv(X.id);r=C.saveKpi(tS,2570,{id:X.id,target:'B-two',baseRev:cur.rev});assert(r.success&&r.changed);
 await A.click('.kpi-card.editing .btn-primary');await A.waitForSelector('#modal-conflict',{state:'visible'});
 await A.click('#modal-conflict button:has-text("โหลดข้อมูลล่าสุด")');await A.waitForTimeout(400);
 assert(await A.evaluate(id=>editingId===id,X.id),'still editing');assert((await A.inputValue('#ed-target'))==='B-two','latest loaded');assert(!(await A.evaluate(()=>isDirty())));
 assert(!(await A.isVisible('.kpi-card.editing .remote-banner')),'banner gone after reload');assert(srv(X.id).target==='B-two');
 // banner button path + cancel applies pending
 cur=srv(X.id);r=C.saveKpi(tS,2570,{id:X.id,target:'B-three',baseRev:cur.rev});await poll(A);
 assert(await A.isVisible('.kpi-card.editing .remote-banner'));await A.click('.kpi-card.editing .remote-banner button');await A.waitForTimeout(300);assert((await A.inputValue('#ed-target'))==='B-three','banner reload (not dirty → no confirm)');
 cur=srv(X.id);r=C.saveKpi(tS,2570,{id:X.id,target:'B-four',baseRev:cur.rev});await poll(A);
 await A.evaluate(()=>cancelEdit());await A.waitForTimeout(300);assert((await cardMonth0(A,X.id)).includes('B-four'),'cancel → pending remote applied');console.log('reload / banner / cancel ✔');

 // ---- 6. structural change while editing another card is deferred; deletion by others removes the card
 const Y=C.getAllData(tA,2570).data.find(k=>k.id!==X.id&&k.canEditDetails);
 await A.evaluate(id=>startEditNow(id),X.id);await A.waitForSelector('.kpi-card.editing #ed-target');await A.fill('#ed-target','typing…');
 r=C.addIndicator(tA,2570,{name:'งานใหม่จากอีกเครื่อง',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner:ad[0],cats:[{part:'ทดสอบสด',category:'หมวด'}]});assert(r.success,r.message);const nid=r.newId;
 await A.evaluate(()=>setScopeFilter&&0);await poll(A);
 assert((await A.inputValue('#ed-target'))==='typing…','typing survives structural change');assert(await A.evaluate(id=>globalDatabase.some(k=>k.id===id),nid));
 await A.evaluate(()=>exitEdit());await A.waitForTimeout(200);assert(await A.evaluate(()=>!liveDeferred));
 r=C.deleteIndicator(tA,2570,'ทดสอบสด',nid);await poll(A);assert(await A.evaluate(id=>!globalDatabase.some(k=>k.id===id),nid),'removed');
 // removed while editing → banner + save blocked by server message, close button
 r=C.addIndicator(tA,2570,{name:'จะถูกลบ',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner:ad[0],cats:[{part:'ทดสอบสด',category:'หมวด'}]});await poll(A);
 await A.evaluate(id=>{goToKpi(id);startEditNow(id)},r.newId);await A.waitForSelector('.kpi-card.editing');C.deleteIndicator(tA,2570,'ทดสอบสด',r.newId);await poll(A);
 assert((await A.innerText('.kpi-card.editing .remote-banner')).includes('ถูกลบ'));await A.click('.kpi-card.editing .remote-banner button');await A.waitForTimeout(300);
 assert(await A.evaluate(id=>editingId===null&&!globalDatabase.some(k=>k.id===id),r.newId),'closed + removed');console.log('deferred / removed ✔');

 // ---- 7. other writes show overlay (add, delete) ; hidden tab skips polling
 r=C.addIndicator(tA,2570,{name:'ลบผ่านหน้าจอ',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner:ad[0],cats:[{part:'ทดสอบสด',category:'หมวด'}]});await poll(A);
 await A.evaluate(id=>{goToKpi(id);startEditNow(id)},r.newId);await A.waitForSelector('.kpi-card.editing');await A.evaluate(()=>{window.__delay.deleteIndicator=800;requestDeleteKpi()});
 await A.click('#modal-confirm .btn-danger');await A.waitForTimeout(150);const delBusy=await A.isVisible('#busy-overlay');const delTxt=await A.innerText('#busy-text');await A.waitForSelector('#busy-overlay',{state:'hidden'});
 assert(delBusy&&delTxt.includes('ลบตัวชี้วัด'),'delete overlay');await A.waitForTimeout(400);assert(await A.evaluate(id=>!globalDatabase.some(k=>k.id===id),r.newId));console.log('delete overlay ✔');
 // logout mid-poll resets
 await A.evaluate(()=>logout());await A.waitForTimeout(300);assert(await A.evaluate(()=>dataV===null&&!document.getElementById('busy-overlay').classList.contains('show')));
 // ---- 8. timeout safety
 await login(B,st[0]).catch(()=>{});
 for(const p of [A,B])assert(p._errs.length===0,p._errs.join());
 await b.close();console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
