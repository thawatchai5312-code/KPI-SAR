// table view: ALWAYS starts as table + settings/history/cats hidden at every login (nothing remembered); icon-only row buttons, narrow columns: switch + per-account memory, rows == cards list, column groups, whole-row edit (inputs + long-field dialog + cancel),
// permissions, locked cells, conflict/live banner rows, goToKpi, tour restore, unsaved guard, mobile
const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const st=U.find(r=>r[2]==='staff'&&/(^|,)ER(,|$)/.test(r[3])),ad=U.find(r=>r[2]==='admin');
[st,ad].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tS=C.createSession_(st[0],st[1]),tA=C.createSession_(ad[0],ad[1]);
const srv=(t,id)=>C.getAllData(t,2570).data.find(k=>k.id===id);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mk=async(w,hh)=>{const pg=await b.newPage({viewport:{width:w||1440,height:hh||900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>r.request().url()==='http://app.test/'?r.fulfill({contentType:'text/html; charset=utf-8',body:html}):r.abort());
  await pg.addInitScript(()=>{window.__delay={};function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>new Promise(r=>setTimeout(r,window.__delay[fn]||0)).then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/');return pg};
 const login=async(pg,u)=>{await pg.fill('#login-username',u);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select','2570');await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(500);};
 const idle=p=>p.waitForSelector('#busy-overlay',{state:'hidden'});

 // ---- 1. default card, switch, rows == cards list, memory per account
 let A=await mk();await login(A,ad[0]);
 assert(await A.evaluate(()=>listMode==='table'&&!!document.getElementById('kpi-table')&&document.querySelectorAll('.kpi-card').length===0&&document.querySelector('#mode-switch .on').dataset.mode==='table'),'default is table');
 {const dflt=await A.evaluate(()=>['sm','fq','lv','edt','viw','cat','par','det','src','own','y0','m0','sum'].map(k=>[k,getComputedStyle(document.querySelector('td.c-'+k)).display==='none']));const hidden=dflt.filter(x=>x[1]).map(x=>x[0]).join();assert(hidden==='sm,fq,lv,edt,viw,cat,par',hidden);assert(await A.evaluate(()=>[...document.querySelectorAll('.tbl-chip')].map(c=>c.dataset.g+':'+c.classList.contains('on')).join())==='annual:true,monthly:true,settings:false,text:true,people:true,cats:false,history:false');}
 await A.click('#mode-switch button[data-mode=card]');await A.waitForSelector('.kpi-card');assert(await A.isVisible('#btn-toggle-chart'),'chart button in card pager');
 await A.click('#mode-switch button[data-mode=table]');await A.waitForSelector('#kpi-table');
 await A.waitForFunction(()=>tblPending.length===0,null,{timeout:20000});
 const info=await A.evaluate(()=>({rows:document.querySelectorAll('tr.kpi-row').length,uniq:uniqueById(getOrderedKpis()).length,cards:document.querySelectorAll('.kpi-card').length,cats:document.querySelectorAll('tr.tbl-cat').length,areaTable:document.getElementById('kpi-list-area').classList.contains('table-mode'),ths:[...document.querySelectorAll('#kpi-table thead tr.tbl-h2 th')].map(t=>t.textContent.trim()).join('|'),on:document.querySelector('#mode-switch .on').dataset.mode}));
 assert(info.rows===info.uniq&&info.cards===0&&info.cats>3&&info.areaTable&&info.on==='table',JSON.stringify(info));
 assert(['2566','2570','ต.ค.','ก.ย.','สรุป','วิธีสรุป','ความถี่','ระดับ','รายละเอียด / การวิเคราะห์','ที่มา / สูตรคำนวณ','ผู้รับผิดชอบ','หน่วยงาน','หมวดที่แสดง','ตัวชี้วัดแม่','แก้ไขล่าสุด','เข้าดูล่าสุด'].every(t=>info.ths.includes(t)),info.ths);
 console.log('table rows',info.rows,'cats',info.cats);
 // column groups hide/show + remembered
 const w0=await A.evaluate(()=>document.getElementById('kpi-table').offsetWidth);
 await A.click('.tbl-chip[data-g=monthly]');await A.waitForTimeout(200);
 const hid=await A.evaluate(()=>({disp:getComputedStyle(document.querySelector('td.c-m0')).display,w:document.getElementById('kpi-table').offsetWidth,on:document.querySelector('.tbl-chip[data-g=monthly]').classList.contains('on')}));
 assert(hid.disp==='none'&&hid.w===w0-(12*68+96)&&!hid.on,JSON.stringify(hid)+' '+w0);
 // nothing is remembered: another browser / new login of the same account starts from the defaults again
 let A2=await mk();await login(A2,ad[0]);await A2.waitForTimeout(400);
 assert(await A2.evaluate(()=>listMode==='table'&&!!document.getElementById('kpi-table')&&getComputedStyle(document.querySelector('td.c-m0')).display!=='none'&&getComputedStyle(document.querySelector('td.c-sm')).display==='none'),'no memory: defaults again');
 let S=await mk();await login(S,st[0]);assert(await S.evaluate(()=>listMode==='table'&&!!document.getElementById('kpi-table')),'first-time user sees table');
 await A.click('.tbl-chip[data-g=monthly]');await A.waitForTimeout(200);
 await A.click('.tbl-chip[data-g=settings]');assert(await A.evaluate(()=>getComputedStyle(document.querySelector('td.c-sm')).display!=='none'),'user can show a hidden group');await A.click('.tbl-chip[data-g=settings]');

 // ---- 2. staff: permissions in table
 await S.click('#mode-switch button[data-mode=table]');await S.waitForSelector('#kpi-table');
 await S.evaluate(()=>{setScopeFilter('all')});await S.waitForTimeout(300);
 const perm=await S.evaluate(()=>{const rows=[...document.querySelectorAll('tr.kpi-row')];const edit=rows.filter(r=>r.querySelector('.btn-accent')).length;const ro=rows.filter(r=>/ดูอย่างเดียว/.test(r.querySelector('.c-act').textContent)).length;const own=rows.filter(r=>{const k=globalDatabase.find(x=>x.id===r.dataset.id);return k.canEditResults||k.canEditDetails}).length;return {edit,ro,all:rows.length,own}});
 assert(perm.edit+perm.ro===perm.all&&perm.ro>0&&perm.edit===perm.own,JSON.stringify(perm));
 const X=await S.evaluate(()=>{const k=globalDatabase.find(k=>k.canEditResults&&k.canEditDetails&&k.isOwner);return {id:k.id,name:k.name,locked:k.lockedYears}});
 // start edit by clicking the row button
 await S.evaluate(id=>goToKpi(id),X.id);await S.waitForTimeout(600);
 await S.click('tr.kpi-row[data-id="'+X.id+'"] .btn-accent');
 await S.waitForSelector('tr.kpi-row.editing #ed-name');
 const ed=await S.evaluate(()=>{const r=document.querySelector('tr.kpi-row.editing');return {ids:['ed-name','ed-target','ed-y0','ed-y4','ed-m0','ed-m11','ed-owner','ed-dept','ed-details','ed-source','ed-cats','ed-parent'].map(i=>[i,!!document.getElementById(i)]).filter(x=>!x[1]).map(x=>x[0]),lockedYears:[...r.querySelectorAll('.c-y0 .lock-wrap,.c-y1 .lock-wrap,.c-y2 .lock-wrap,.c-y3 .lock-wrap')].length,noPriv:['ed-summary','ed-frequency'].map(i=>!!document.getElementById(i)).join(),lv:!!document.querySelector('.ed-level-cb'),btns:[...r.querySelectorAll('.c-act button')].map(b=>b.title).join('|')}});
 assert(ed.ids.length===0&&ed.noPriv==='false,false'&&!ed.lv&&/บันทึก/.test(ed.btns)&&/ยกเลิก/.test(ed.btns)&&!/ลบ/.test(ed.btns),JSON.stringify(ed));
 console.log('locked year cells (staff):',ed.lockedYears);
 // dirty + simple fields
 await S.fill('#ed-name',X.name+' (ตาราง)');await S.fill('#ed-target','≥ 77 %');await S.fill('#ed-m0','61.5');await S.fill('#ed-owner',st[0]+' / '+ad[0]);
 assert(await S.isVisible('#dirty-mark'),'dirty mark in row');
 // long dialog: cancel restores, ok keeps
 await S.click('tr.kpi-row.editing .c-det button');await S.waitForSelector('#modal-tbl-long',{state:'visible'});
 assert(await S.evaluate(()=>!!document.querySelector('#tbl-long-body #ed-details')&&!document.querySelector('tr.kpi-row.editing .tbl-hold #ed-details')),'elements moved into dialog');
 const orig=await S.inputValue('#ed-details');await S.fill('#ed-details','ข้อความใหม่จากหน้าต่าง');
 await S.click('#modal-tbl-long button:has-text("ยกเลิก")');assert((await S.inputValue('#ed-details'))===orig&&await S.evaluate(()=>!!document.querySelector('tr.kpi-row.editing .tbl-hold #ed-details')),'cancel restores & moves back');
 await S.click('tr.kpi-row.editing .c-det button');await S.fill('#ed-details','วิเคราะห์จากตาราง');await S.fill('#ed-source','สูตรจากตาราง');
 await S.click('#modal-tbl-long button:has-text("ตกลง")');
 assert((await S.innerText('tr.kpi-row.editing .c-det .tbl-prev')).includes('วิเคราะห์จากตาราง')&&(await S.innerText('tr.kpi-row.editing .c-src .tbl-prev')).includes('สูตรจากตาราง'),'preview updated');
 await S.click('.tbl-chip[data-g=cats]'); // default-hidden group: user shows it
 // cats: add row then cancel → restored; add + ok → saved
 const cats0=await S.evaluate(()=>readCatRows('ed-cats').length);
 await S.click('tr.kpi-row.editing .c-cat button');await S.click('#tbl-long-body #ed-cats ~ button');await S.waitForTimeout(100);
 assert(await S.evaluate(n=>document.querySelectorAll('#ed-cats .cat-row').length===n+1,cats0));
 await S.click('#modal-tbl-long button:has-text("ยกเลิก")');assert(await S.evaluate(n=>document.querySelectorAll('#ed-cats .cat-row').length===n,cats0),'cats cancel');
 await S.click('tr.kpi-row.editing .c-cat button');await S.click('#tbl-long-body #ed-cats ~ button');
 await S.evaluate(()=>{const r=[...document.querySelectorAll('#ed-cats .cat-row')].pop();r.querySelector('.cat-part').value='ทดสอบตาราง';r.querySelector('.cat-cat').value='หมวดจากตาราง'});
 await S.click('#modal-tbl-long button:has-text("ตกลง")');assert((await S.innerText('tr.kpi-row.editing .c-cat .tbl-prev')).includes('ทดสอบตาราง › หมวดจากตาราง'));
 // slow save → overlay, no double submit
 await S.evaluate(()=>{window.__delay.saveKpi=900});await S.click('tr.kpi-row.editing .c-act .btn-primary');await S.waitForTimeout(250);
 assert(await S.isVisible('#busy-overlay'),'busy overlay in table');await S.evaluate(()=>saveKpiEdit());await idle(S);await S.waitForTimeout(300);
 const sv=srv(tS,X.id);
 assert(sv.name.endsWith('(ตาราง)')&&sv.target==='≥ 77 %'&&sv.months[0]===61.5&&sv.templateDetails==='วิเคราะห์จากตาราง'&&sv.dataSource==='สูตรจากตาราง'&&sv.owner.includes(ad[0])&&sv.cats.some(c=>c.part==='ทดสอบตาราง'&&c.category==='หมวดจากตาราง'),JSON.stringify(sv).slice(0,300));
 assert(await S.evaluate(()=>editingId===null&&!document.querySelector('tr.kpi-row.editing')),'edit closed');
 // placed in a new category → list re-rendered, row still there once
 console.log('saved via table ✔');

 // ---- 3. admin: settings + levels via dialog
 await A.click('.tbl-chip[data-g=settings]');await A.click('.tbl-chip[data-g=cats]');
 const Y=await A.evaluate(()=>globalDatabase.find(k=>k.canEditDetails&&(k.levels||[]).indexOf('QA-หน่วยงาน')===-1&&k.department&&k.part!=='Part I').id);
 await A.evaluate(id=>{goToKpi(id);startEditNow(id)},Y);await A.waitForSelector('tr.kpi-row.editing #ed-summary');
 assert(await A.evaluate(()=>!!document.getElementById('ed-frequency')&&!!document.querySelector('.ed-level-cb')&&[...document.querySelectorAll('tr.kpi-row.editing .tbl-acts button')].map(b=>b.title).join('|')==='บันทึกข้อมูล|ยกเลิกการแก้ไข|ลบตัวชี้วัด'));
 await A.selectOption('#ed-summary','ผลรวม');
 await A.click('tr.kpi-row.editing .c-lv button');await A.waitForSelector('#modal-tbl-long',{state:'visible'});
 const n0=await A.evaluate(()=>readCatRows('ed-cats').length);
 await A.check('.ed-level-cb[value="QA-หน่วยงาน"]');await A.waitForTimeout(150);
 assert(await A.evaluate(n=>readCatRows('ed-cats').length>n,n0),'level → category rows added (same rule as card)');
 await A.click('#modal-tbl-long button:has-text("ยกเลิก")');assert(await A.evaluate(n=>readCatRows('ed-cats').length===n&&!document.querySelector('.ed-level-cb[value="QA-หน่วยงาน"]').checked,n0),'level cancel restores');
 await A.click('tr.kpi-row.editing .c-lv button');await A.check('.ed-level-cb[value="QA-หน่วยงาน"]');await A.click('#modal-tbl-long button:has-text("ตกลง")');
 assert((await A.innerText('tr.kpi-row.editing .c-lv .tbl-prev')).includes('QA-หน่วยงาน'));
 await A.click('tr.kpi-row.editing .c-act .btn-primary');await idle(A);await A.waitForTimeout(300);
 const sy=srv(tA,Y);assert(sy.summaryMethod==='ผลรวม'&&sy.levels.includes('QA-หน่วยงาน')&&sy.cats.some(c=>/ QA$/.test(c.part)),JSON.stringify([sy.summaryMethod,sy.levels,sy.cats]));
 console.log('admin settings/levels via table ✔');

 // ---- 4. live update + conflict banner rows
 const Z=await A.evaluate(()=>[...document.querySelectorAll('tr.kpi-row')].map(r=>globalDatabase.find(k=>k.id===r.dataset.id)).filter(k=>k.canEditResults&&k.canEditDetails).slice(1)[0].id);
 let cur=srv(tA,Z);let r=C.saveKpi(tA,2570,{id:Z,months:cur.months.map((v,i)=>i===3?9.5:v),years:cur.years,baseRev:cur.rev});
 if(r.success){await A.evaluate(()=>livePoll());await A.waitForTimeout(500);assert(await A.evaluate(id=>globalDatabase.find(k=>k.id===id).months[3]===9.5,Z),'live data');assert(await A.evaluate(id=>{const row=[...document.querySelectorAll('tr.kpi-row')].find(x=>x.dataset.id===id);return !row||row.querySelector('.c-m3').textContent.trim()==='9.5'||getComputedStyle(row.querySelector('.c-m3')).display==='none'},Z),'live row updated');}
 await A.evaluate(id=>{goToKpi(id);startEditNow(id)},Z);await A.waitForSelector('tr.kpi-row.editing');await A.fill('#ed-target','A-tbl');
 cur=srv(tA,Z);C.saveKpi(tA,2570,{id:Z,target:'B-tbl',baseRev:cur.rev});await A.evaluate(()=>livePoll());await A.waitForTimeout(500);
 assert(await A.isVisible('tr.remote-row .remote-banner'),'banner row');assert((await A.inputValue('#ed-target'))==='A-tbl','typing kept');
 await A.click('tr.kpi-row.editing .c-act .btn-primary');await A.waitForSelector('#modal-conflict',{state:'visible'});
 await A.click('#modal-conflict button:has-text("โหลดข้อมูลล่าสุด")');await A.waitForTimeout(500);
 assert((await A.inputValue('#ed-target'))==='B-tbl'&&!(await A.locator('tr.remote-row').count()),'reload → latest, banner gone');
 await A.evaluate(()=>cancelEdit());await A.waitForTimeout(200);

 // ---- 5. unsaved guard when switching modes, switch back to cards, chart button
 await A.evaluate(id=>startEditNow(id),Z);await A.waitForSelector('tr.kpi-row.editing #ed-target');await A.fill('#ed-target','dirty');
 await A.click('#mode-switch button[data-mode=card]');await A.waitForSelector('#modal-unsaved',{state:'visible'});
 await A.click('#modal-unsaved button:has-text("กลับไปแก้ต่อ")');assert(await A.evaluate(()=>listMode==='table'&&editingId!==null));
 await A.click('#mode-switch button[data-mode=card]');await A.click('#modal-unsaved button:has-text("ไม่บันทึก")');await A.waitForTimeout(400);
 assert(await A.evaluate(()=>listMode==='card'&&document.querySelectorAll('.kpi-card').length>0&&!document.getElementById('kpi-list-area').classList.contains('table-mode')&&editingId===null),'back to cards');
 await A.click('#btn-toggle-chart');assert(await A.evaluate(()=>document.getElementById('kpi-list-area').classList.contains('charts-hidden')&&/แสดงกราฟ/.test(document.getElementById('btn-toggle-chart').textContent)),'chart toggle in pager works');await A.click('#btn-toggle-chart');

 // ---- 6. tour explains the TABLE first: from cards it switches to the table with all column groups shown, then restores the user's view
 await A.click('#mode-switch button[data-mode=table]');await A.waitForSelector('#kpi-table');
 await A.evaluate(()=>{tblResetView();renderList()});await A.waitForTimeout(300);
 assert(await A.evaluate(()=>tblHide.size===3));
 await A.click('#mode-switch button[data-mode=card]');await A.waitForSelector('.kpi-card');
 await A.click('#tour-btn');await A.waitForSelector('#tour-tip .tour-title');await A.waitForTimeout(400);
 assert(await A.evaluate(()=>listMode==='table'&&!!document.getElementById('kpi-table')&&tblHide.size===0&&getComputedStyle(document.querySelector('td.c-sm')).display!=='none'),'tour shows table with all groups');
 await A.click('#tour-tip .tour-end');await A.waitForTimeout(500);
 assert(await A.evaluate(()=>listMode==='card'&&document.querySelectorAll('.kpi-card').length>0&&tblHide.size===3),'view restored after tour');
 await A.click('#mode-switch button[data-mode=table]');await A.waitForSelector('#kpi-table');await A.waitForTimeout(300);
 await A.click('#tour-btn');await A.waitForSelector('#tour-tip .tour-title');await A.click('#tour-tip .tour-end');await A.waitForTimeout(500);
 assert(await A.evaluate(()=>listMode==='table'&&tblHide.size===3&&getComputedStyle(document.querySelector('td.c-sm')).display==='none'),'table defaults restored after tour');

 // ---- 7. goToKpi from tree: row inside viewport + flash; FY change keeps table
 const T=await A.evaluate(()=>uniqueById(getOrderedKpis())[120].id);
 await A.evaluate(id=>selectKpi(id),T);await A.waitForTimeout(1200);
 const vis=await A.evaluate(id=>{const row=[...document.querySelectorAll('tr.kpi-row')].find(x=>x.dataset.id===id);const w=document.getElementById('tbl-wrap').getBoundingClientRect(),r=row.getBoundingClientRect();return {inside:r.top>=w.top&&r.bottom<=w.bottom+2,top:Math.round(r.top-w.top)}},T);
 assert(vis.inside,JSON.stringify(vis));
 await A.evaluate(()=>{const s=document.getElementById('fy-select');s.value='2569';onFiscalYearChange(s)});await A.waitForSelector('#kpi-table');await idle(A);
 assert(await A.evaluate(()=>listMode==='table'&&selectedFy===2569&&document.querySelectorAll('tr.kpi-row').length>0));
 // logout resets
 await A.evaluate(()=>{listMode='card';tblHide.clear();logout()});await A.waitForTimeout(300);assert(await A.evaluate(()=>listMode==='table'&&tblHide.size===3));
 await login(A,ad[0]);assert(await A.evaluate(()=>listMode==='table'&&!!document.getElementById('kpi-table')&&tblHide.has('settings')&&tblHide.has('history')&&tblHide.has('cats')),'relogin → defaults');

 // ---- 8. mobile
 const M=await mk(390,844);await login(M,st[0]);await M.click('#mode-switch button[data-mode=table]');await M.waitForSelector('#kpi-table');
 const mob=await M.evaluate(()=>{const a=document.getElementById('kpi-list-area').getBoundingClientRect();return {h:Math.round(a.height),vh:innerHeight,rows:document.querySelectorAll('tr.kpi-row').length,docW:document.documentElement.scrollWidth}});
 assert(mob.rows>0&&mob.h<=mob.vh,JSON.stringify(mob));console.log('mobile',JSON.stringify(mob));
 for(const p of [A,A2,S,M])assert(p._errs.length===0,p._errs.join());
 await b.close();console.log('ALL OK');
})().catch(e=>{console.error(e);process.exit(1)});
