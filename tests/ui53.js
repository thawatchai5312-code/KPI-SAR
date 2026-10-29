// เอกสารแนบตัวชี้วัด (ลิงก์ Drive): กล่องในการ์ด · คอลัมน์ตาราง · หน้าต่างแนบ + dropdown เลือกตัวชี้วัดหลายตัว · ถามยืนยันว่าเลือกครบหรือยัง · แก้/ลบ · อัปเดตจากเครื่องอื่น · สิทธิ์
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
 await pg.waitForFunction(()=>document.getElementById('kpi-table')||document.querySelector('.kpi-card'),null,{timeout:60000});await pg.evaluate(()=>{if(listMode!=='table')setListMode('table')});await pg.waitForSelector('#kpi-table'); // staff start on cards (tier default): these tests exercise the table
 return pg;
}
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const GOOD='https://drive.google.com/file/d/1AbCdEfG/view?usp=sharing';
// ผู้ใช้ทดสอบ: staff ที่แก้ได้ ≥3 ตัว และมีตัวที่ดูได้อย่างเดียว
const info=(r)=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE';const t=C.createSession_(r[0],r[1]);const d=C.getAllData(t,fy);const ed=[],vw=[];d.data.forEach(k=>{vw.push(k.id);if(k.canEditDetails)ed.push(k.id)});return {r,t,ed,vw}};
const S=U.filter(r=>r[2]==='staff').map(info).find(x=>x.ed.length>=3&&x.vw.length>x.ed.length);assert(S,'fixture staff');
const [a,b,c3]=S.ed;const ro=S.vw.find(id=>!S.ed.includes(id));
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await open(br,S.r);
 const rows=()=>h.sheets.KPI_Links?h.sheets.KPI_Links.d.slice(1):[];
 // ---- มุมมองตาราง (ค่าเริ่มต้น): หัวคอลัมน์ + เซลล์ + ปุ่มแนบ (เฉพาะตัวที่แก้ได้)
 await pg.waitForFunction(()=>document.querySelector('#kpi-table .c-lnk .lnk-add')||document.querySelector('#kpi-table .c-lnk .lnk-empty'));
 assert(/เอกสารแนบ/.test(await pg.textContent('#kpi-table thead .tbl-h2 .c-lnk')),'table header');
 await pg.evaluate(()=>tblEnsureRendered&&tblEnsureRendered());
 const tb=await pg.evaluate((id)=>{const td=document.querySelector('#kpi-table tr[data-id="'+id+'"] td.c-lnk');
   return {add:!!(td&&td.querySelector('.lnk-add')),empty:!!(td&&/ยังไม่มีเอกสารแนบ/.test(td.textContent))}},a);
 assert(tb.add&&tb.empty,'table cell with add button '+JSON.stringify(tb));
 // ---- มุมมองการ์ด
 await pg.click('#mode-switch button[data-mode=card]');await pg.waitForSelector('.kpi-card');
 await pg.evaluate(id=>goToKpi(id),a);await pg.waitForSelector('.kpi-card[data-id="'+a+'"] .lnk-card');
 const cardSel='.kpi-card[data-id="'+a+'"]';
 assert(/เอกสารแนบ/.test(await pg.textContent(cardSel+' .lnk-card .info-card-title')));
 assert(await pg.evaluate(s=>{const bx=[...document.querySelector(s).querySelectorAll('.card-right-inner > .info-card')].map(e=>e.className);return /lnk-card/.test(bx[2])&&/owner-box/.test(bx[3])},cardSel),'order: details, source, links, owner');
 assert(await pg.$(cardSel+' .lnk-add'),'add button');
 await pg.locator(cardSel).screenshot({path:OUT+'/ui53-card-empty.png'});
 // ---- เปิดหน้าต่างแนบ: ตัวชี้วัดนี้ถูกเลือกไว้แล้ว
 await pg.click(cardSel+' .lnk-add');await pg.waitForSelector('#modal-link',{state:'visible'});
 eq(await pg.evaluate(()=>[...document.querySelectorAll('#lk-chips .lk-chip')].length),1);
 assert(/1 ตัว/.test(await pg.textContent('#lk-sel-badge')));
 // dropdown: เปิด · มีเฉพาะตัวที่แก้ได้ · กลุ่ม "ของฉัน" ขึ้นก่อน · ชิดซ้าย
 await pg.click('#lk-sel-btn');await pg.waitForSelector('#lk-pop',{state:'visible'});
 const lst=await pg.evaluate(()=>({n:document.querySelectorAll('#lk-list .lk-row').length,first:document.querySelector('#lk-list .lk-grp')?.textContent||'',align:getComputedStyle(document.querySelector('#lk-list .lk-row')).textAlign,ids:[...document.querySelectorAll('#lk-list .lk-row')].map(r=>r.dataset.id)}));
 assert(lst.n>=3&&lst.n<=S.ed.length&&lst.ids.every(id=>S.ed.includes(id)),'only editable kpis '+JSON.stringify(lst));
 assert(/ของฉัน/.test(lst.first),lst.first);eq(lst.align,'left');
 assert(await pg.evaluate(id=>document.querySelector('#lk-list .lk-row[data-id="'+id+'"]').classList.contains('on'),a),'current kpi highlighted');
 await pg.screenshot({path:OUT+'/ui53-dropdown.png'});
 // เลือกเพิ่ม 2 ตัว → ป้ายชื่อด้านล่างและตัวนับเพิ่มตาม · ไม่ปิด dropdown
 await pg.click('#lk-list .lk-row[data-id="'+b+'"]');await pg.click('#lk-list .lk-row[data-id="'+c3+'"]');
 eq(await pg.evaluate(()=>document.querySelectorAll('#lk-chips .lk-chip').length),3);
 assert(/3 ตัว/.test(await pg.textContent('#lk-sel-badge'))&&/3 ตัว/.test(await pg.textContent('#lk-pop-count')));
 assert(await pg.isVisible('#lk-pop'),'stays open');
 // ค้นหา: ชื่อที่ไม่มี → ว่าง · เฉพาะที่เลือก
 await pg.fill('#lk-q','zzzz-ไม่มีแน่นอน');assert(/ไม่พบ/.test(await pg.textContent('#lk-list')));
 await pg.fill('#lk-q','');await pg.check('#lk-only');eq(await pg.evaluate(()=>document.querySelectorAll('#lk-list .lk-row').length),3);await pg.uncheck('#lk-only');
 // เอาออกที่ป้ายชื่อ (✕) แล้วเลือกกลับ
 await pg.click('#lk-head');assert(!await pg.isVisible('#lk-pop'),'outside click closes');
 await pg.click('#lk-chips .lk-chip b[data-id="'+c3+'"]');eq(await pg.evaluate(()=>document.querySelectorAll('#lk-chips .lk-chip').length),2);
 await pg.click('#lk-sel-btn');assert(!await pg.evaluate(id=>document.querySelector('#lk-list .lk-row[data-id="'+id+'"]').classList.contains('on'),c3),'row unchecked too');
 await pg.click('#lk-list .lk-row[data-id="'+c3+'"]');
 // ปุ่มเสร็จ = ปิด
 assert(await pg.isVisible('#lk-pop'));await pg.click('#lk-pop .lk-pop-foot button');assert(!await pg.isVisible('#lk-pop'));
 // ---- ตรวจข้อมูลก่อนบันทึก
 await pg.click('#lk-save-btn');assert(/ชื่อเอกสาร/.test(await pg.textContent('#lk-err')));
 await pg.fill('#lk-title','รายงานรอบ ๖ เดือน');
 await pg.fill('#lk-url','https://example.com/x');assert(/ต้องเป็นลิงก์/.test(await pg.textContent('#lk-url-msg')));await pg.click('#lk-save-btn');assert(/ลิงก์/.test(await pg.textContent('#lk-err')));
 await pg.fill('#lk-url','javascript:alert(1)');await pg.click('#lk-save-btn');assert(await pg.isHidden('#modal-link-confirm'));
 await pg.fill('#lk-url',GOOD);assert(/ลิงก์ถูกต้อง/.test(await pg.textContent('#lk-url-msg')));
 // ---- ถามยืนยันว่าเลือกครบหรือยัง
 await pg.click('#lk-save-btn');await pg.waitForSelector('#modal-link-confirm',{state:'visible'});
 assert(/ครบทุกตัวที่เอกสารนี้กล่าวถึงแล้วหรือยัง/.test(await pg.textContent('#modal-link-confirm')));
 eq(await pg.evaluate(()=>document.querySelectorAll('#lkc-list > div').length),3);
 assert(/3<\/b> ตัว/.test(await pg.innerHTML('#lkc-doc')));
 await pg.waitForTimeout(700);await pg.screenshot({path:OUT+'/ui53-confirm.png'});
 // กลับไปเพิ่ม → dropdown เปิด ข้อมูลที่กรอกยังอยู่ → ถอดตัวที่ 3 ออก
 await pg.click('#modal-link-confirm .btn-secondary');assert(await pg.isHidden('#modal-link-confirm'));await pg.waitForSelector('#lk-pop',{state:'visible'});
 assert.strictEqual(await pg.inputValue('#lk-title'),'รายงานรอบ ๖ เดือน');
 await pg.click('#lk-list .lk-row[data-id="'+c3+'"]');await pg.click('#lk-pop .lk-pop-foot button');
 assert(!rows().length,'nothing saved yet');
 await pg.click('#lk-save-btn');await pg.waitForSelector('#modal-link-confirm',{state:'visible'});
 eq(await pg.evaluate(()=>document.querySelectorAll('#lkc-list > div').length),2);
 await pg.click('#modal-link-confirm .btn-primary');
 await pg.waitForSelector('#modal-link',{state:'hidden'});
 await pg.waitForSelector(cardSel+' .lnk-item');
 // ---- บันทึกแล้ว: อยู่ในชีต · การ์ดของทั้ง 2 ตัวชี้วัดเห็นลิงก์ · ตัวที่ไม่ได้เลือกไม่เห็น
 eq(rows().length,1);assert.strictEqual(rows()[0][2],'รายงานรอบ 6 เดือน');assert.strictEqual(rows()[0][3],GOOD);eq(rows()[0][4],a+', '+b);
 const href=await pg.getAttribute(cardSel+' .lnk-item a.lnk-a','href');assert.strictEqual(href,GOOD);
 assert.strictEqual(await pg.getAttribute(cardSel+' .lnk-item a.lnk-a','target'),'_blank');assert(/noopener/.test(await pg.getAttribute(cardSel+' .lnk-item a.lnk-a','rel')));
 assert(/ใช้ร่วมกับอีก 1 ตัวชี้วัด/.test(await pg.textContent(cardSel+' .lnk-item')),'shared note');
 await pg.evaluate(id=>goToKpi(id),b);await pg.waitForSelector('.kpi-card[data-id="'+b+'"] .lnk-item');
 await pg.evaluate(id=>goToKpi(id),c3);await pg.waitForSelector('.kpi-card[data-id="'+c3+'"] .lnk-card');
 assert(!await pg.$('.kpi-card[data-id="'+c3+'"] .lnk-item'),'unselected has no link');
 await pg.evaluate(id=>goToKpi(id),a);await pg.waitForSelector(cardSel+' .lnk-item');
 await pg.waitForTimeout(500);await pg.locator(cardSel).screenshot({path:OUT+'/ui53-card-linked.png'});
 // ---- ตาราง: เซลล์เดียวกันมีลิงก์
 await pg.click('#mode-switch button[data-mode=table]');await pg.waitForSelector('#kpi-table');await pg.evaluate(()=>tblEnsureRendered&&tblEnsureRendered());
 assert.strictEqual(await pg.getAttribute('#kpi-table tr[data-id="'+a+'"] td.c-lnk a.lnk-a','href'),GOOD);
 await pg.evaluate(id=>{const td=document.querySelector('#kpi-table tr[data-id="'+id+'"] td.c-lnk');td.scrollIntoView({block:'center',inline:'center'})},a);await pg.waitForTimeout(300);
 await pg.screenshot({path:OUT+'/ui53-table.png'});
 // ---- จอมือถือ: หน้าต่างแนบ + dropdown ไม่ล้นจอ
 await pg.setViewportSize({width:390,height:780});await pg.click('#mode-switch button[data-mode=card]');await pg.evaluate(id=>goToKpi(id),a);await pg.waitForSelector(cardSel+' .lnk-item');
 await pg.click(cardSel+' .lnk-item .lnk-btn[aria-label="แก้ไขลิงก์"]');await pg.waitForSelector('#modal-link',{state:'visible'});await pg.waitForTimeout(500);
 await pg.screenshot({path:OUT+'/ui53-mobile-modal.png'});
 await pg.click('#lk-sel-btn');await pg.waitForSelector('#lk-pop',{state:'visible'});await pg.waitForTimeout(300);
 const box=await pg.evaluate(()=>{const r=document.getElementById('lk-pop').getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight}});
 assert(box.l>=0&&box.r<=box.w&&box.t>=0&&box.b<=box.h,'dropdown inside viewport '+JSON.stringify(box));
 await pg.screenshot({path:OUT+'/ui53-mobile-dropdown.png'});
 await pg.click('#lk-pop .lk-pop-foot button');await pg.click('#modal-link .modal-footer .btn-secondary');await pg.setViewportSize({width:1500,height:950});
 // ---- แก้ลิงก์: เห็นค่าเดิม · ถอดตัวชี้วัด b ออก · เปลี่ยนชื่อ
 await pg.click('#mode-switch button[data-mode=card]');await pg.evaluate(id=>goToKpi(id),a);await pg.waitForSelector(cardSel+' .lnk-item');
 await pg.click(cardSel+' .lnk-item .lnk-btn[aria-label="แก้ไขลิงก์"]');await pg.waitForSelector('#modal-link',{state:'visible'});
 assert.strictEqual(await pg.inputValue('#lk-title'),'รายงานรอบ 6 เดือน');assert.strictEqual(await pg.inputValue('#lk-url'),GOOD);
 eq(await pg.evaluate(()=>document.querySelectorAll('#lk-chips .lk-chip').length),2);
 await pg.click('#lk-chips .lk-chip b[data-id="'+b+'"]');await pg.fill('#lk-title','รายงานรอบ 6 เดือน (แก้)');
 await pg.click('#lk-save-btn');await pg.waitForSelector('#modal-link-confirm',{state:'visible'});await pg.click('#modal-link-confirm .btn-primary');
 await pg.waitForSelector('#modal-link',{state:'hidden'});
 await pg.waitForFunction(s=>/\(แก้\)/.test(document.querySelector(s+' .lnk-item')?.textContent||''),cardSel);
 eq(rows()[0][4],a);assert.strictEqual(rows()[0][6],2);
 await pg.evaluate(id=>goToKpi(id),b);await pg.waitForFunction(id=>!document.querySelector('.kpi-card[data-id="'+id+'"] .lnk-item'),b);
 // ---- เครื่องอื่นเพิ่มลิงก์ผูกตัวชี้วัดที่ S แก้ไม่ได้ (ro) + a → หน้านี้เห็นภายในรอบอัปเดตอัตโนมัติ
 const tAdm=C.createSession_(ad[0],ad[1]);
 const r2=C.saveKpiLink(tAdm,fy,{title:'โฟลเดอร์รวม',url:'https://drive.google.com/drive/folders/1abc',ids:[a,ro]});assert(r2.success,JSON.stringify(r2));
 await pg.evaluate(()=>livePoll());
 await pg.waitForFunction(()=>kpiLinks.list.length===2);
 await pg.evaluate(id=>goToKpi(id),a);
 await pg.waitForFunction(s=>document.querySelectorAll(s+' .lnk-item').length===2,cardSel);
 await pg.evaluate(id=>goToKpi(id),ro);await pg.waitForSelector('.kpi-card[data-id="'+ro+'"] .lnk-item');
 assert(!await pg.$('.kpi-card[data-id="'+ro+'"] .lnk-add'),'read-only kpi has no add button');
 // ลิงก์ที่ผูกกับ ro (แก้ไม่ได้) และ a (แก้ได้): S แก้ไขลิงก์ได้ → เห็นตัว ro เป็นป้ายล็อก (คงเดิม)
 await pg.click('.kpi-card[data-id="'+ro+'"] .lnk-item .lnk-btn[aria-label="แก้ไขลิงก์"]');await pg.waitForSelector('#modal-link',{state:'visible'});
 eq(await pg.evaluate(()=>[document.querySelectorAll('#lk-chips .lk-chip:not(.lock)').length,document.querySelectorAll('#lk-chips .lk-chip.lock').length]),[1,1]);
 assert(!await pg.$('#lk-chips .lk-chip.lock b'),'locked chip has no remove');
 await pg.screenshot({path:OUT+'/ui53-edit-locked.png'});
 await pg.click('#modal-link .modal-footer .btn-secondary');assert(await pg.isHidden('#modal-link'));
 // ---- ลบ: ลิงก์ที่ผูกกับตัวที่แก้ไม่ได้ → ข้อความอธิบาย · ลิงก์ยังอยู่กับตัวนั้น
 await pg.evaluate(id=>goToKpi(id),a);
 const delBtn=cardSel+' .lnk-item:has(a.lnk-a[href*="folders"]) .lnk-btn[aria-label="ลบลิงก์"]';
 await pg.click(delBtn);await pg.waitForSelector('#modal-confirm',{state:'visible'});
 assert(/ตัวชี้วัดอื่นอีก 1 ตัว/.test(await pg.textContent('#confirm-message')),await pg.textContent('#confirm-message'));
 await pg.click('#modal-confirm .btn-danger');
 await pg.waitForFunction(s=>document.querySelectorAll(s+' .lnk-item').length===1,cardSel);
 assert(C.getKpiLinks(tAdm,fy).links.some(l=>l.title==='โฟลเดอร์รวม'&&JSON.stringify(l.ids)===JSON.stringify([ro])),'link kept for the read-only kpi');
 // ลบลิงก์สุดท้ายของ a (ผูกแค่ a) → ข้อความไม่มี "ตัวชี้วัดอื่น" → ลิงก์หายไป
 await pg.click(cardSel+' .lnk-item .lnk-btn[aria-label="ลบลิงก์"]');await pg.waitForSelector('#modal-confirm',{state:'visible'});
 assert(!/ตัวชี้วัดอื่น/.test(await pg.textContent('#confirm-message')));await pg.click('#modal-confirm .btn-danger');
 await pg.waitForFunction(s=>!document.querySelector(s+' .lnk-item'),cardSel);
 assert(rows().some(r=>r[1]&&r[11]==='ลบ'),'soft deleted row kept');
 // ไม่มี JS error · ไม่กระทบชีตปีงบ
 eq(pg.errs,[],'page errors');
 await br.close();console.log('ui53 OK');
})().catch(e=>{console.error(e);process.exit(1)});
