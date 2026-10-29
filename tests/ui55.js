// เอกสารแนบ: เปลี่ยนผู้รับผิดชอบ (สิทธิ์แก้หาย/กลับมา → ปุ่มแก้/ลบ/แนบตามสิทธิ์ใหม่ทันทีโดยไม่ต้องโหลดหน้าใหม่) · ย้ายหมวด (ลิงก์ตามไปทุกหมวด) · แก้/ลบลิงก์ที่ถูกลบไปแล้ว
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
const GOOD='https://drive.google.com/file/d/1Owner/view';
const info=(r)=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE';const t=C.createSession_(r[0],r[1]);const d=C.getAllData(t,fy);return {r,t,d:d.data}};
// staff ที่เป็นผู้รับผิดชอบโดยตรง (ชื่อตัวเองในช่องผู้รับผิดชอบ) ของตัวชี้วัดอย่างน้อย 1 ตัว
const S=U.filter(r=>r[2]==='staff').map(info).find(x=>x.d.some(k=>k.canEditDetails&&String(k.owner).split('/').map(s=>s.trim()).includes(x.r[0])));assert(S,'fixture staff owner');
const A=S.d.find(k=>k.canEditDetails&&String(k.owner).split('/').map(s=>s.trim()).includes(S.r[0]));const a=A.id,oldOwner=A.owner,oldCats=JSON.parse(JSON.stringify(A.cats&&A.cats.length?A.cats:[{part:A.part,category:A.category}]));
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const L=C.saveKpiLink(S.t,fy,{title:'เอกสารของตัวชี้วัด',url:GOOD,ids:[a]});assert(L.success,JSON.stringify(L));
 const pg=await open(br,S.r);
 await pg.click('#mode-switch button[data-mode=card]');await pg.evaluate(id=>goToKpi(id),a);
 const card='.kpi-card[data-id="'+a+'"]';
 await pg.waitForSelector(card+' .lnk-item .lnk-btn[aria-label="แก้ไขลิงก์"]');assert(await pg.$(card+' .lnk-add'));
 // ---- admin เปลี่ยนผู้รับผิดชอบเป็นคนอื่น → S ไม่มีสิทธิ์แก้แล้ว
 const r1=C.saveKpi(tA,fy,{id:a,owner:ad[0]});assert(r1.success,JSON.stringify(r1));
 const sv=C.getAllData(S.t,fy).data.find(k=>k.id===a);
 await pg.evaluate(()=>livePoll());
 if(sv){ // ยังเห็นอยู่ (ระดับ SAR/หน่วยงาน) → ลิงก์ยังแสดง แต่ไม่มีปุ่มแก้/ลบ/แนบ
   assert(!sv.canEditDetails,'lost edit right');
   await pg.waitForFunction(id=>{const k=globalDatabase.find(x=>x.id===id);return k&&!k.canEditDetails},a);
   await pg.evaluate(id=>goToKpi(id),a); // ไม่ใช่ "ของฉัน" แล้ว → ตัวกรองขอบเขตซ่อนการ์ด goToKpi ล้างตัวกรองให้
   await pg.waitForFunction(c=>{const el=document.querySelector(c);return el&&el.querySelector('.lnk-item')&&!el.querySelector('.lnk-item .lnk-btn')&&!el.querySelector('.lnk-add')},card);
 } else { // มองไม่เห็นแล้ว → การ์ดหายไป
   await pg.waitForFunction(id=>!globalDatabase.some(k=>k.id===id),a);
 }
 await pg.waitForFunction(()=>kpiLinks.list.every(l=>!l.canEdit));
 // เซิร์ฟเวอร์ปฏิเสธ (กันกรณีหน้าเว็บยังค้างปุ่มเก่า)
 let r=C.saveKpiLink(S.t,fy,{id:L.id,title:'แอบแก้',url:GOOD,ids:[a]});assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message),JSON.stringify(r));
 r=C.deleteKpiLink(S.t,fy,L.id,1);assert(!r.success&&/ไม่มีสิทธิ์/.test(r.message));
 // ---- เปลี่ยนกลับ → ปุ่มกลับมาเองโดยไม่ต้องโหลดหน้าใหม่
 assert(C.saveKpi(tA,fy,{id:a,owner:oldOwner}).success);
 await pg.evaluate(()=>livePoll());
 if(!sv) await pg.waitForFunction(id=>globalDatabase.some(k=>k.id===id),a);
 await pg.evaluate(id=>goToKpi(id),a);
 await pg.waitForSelector(card+' .lnk-item .lnk-btn[aria-label="แก้ไขลิงก์"]');assert(await pg.$(card+' .lnk-add'));
 // ---- ย้ายหมวด / เพิ่มหมวด → ลิงก์ขึ้นทุกการ์ดของตัวชี้วัดนี้ (ผูกกับรหัส ไม่ใช่หมวด)
 const extra={part:'ทดสอบลิงก์',category:'หมวดใหม่'};
 const r2=C.saveKpi(tA,fy,{id:a,cats:oldCats.concat([extra])});assert(r2.success,JSON.stringify(r2));
 await pg.evaluate(()=>livePoll());
 await pg.waitForFunction(id=>{const k=globalDatabase.find(x=>x.id===id);return k&&kpiCats(k).some(c=>c.category==='หมวดใหม่')},a);
 await pg.evaluate(()=>{treeView=VIEWS[0]});
 const keys=await pg.evaluate(id=>placementsOf(globalDatabase.find(k=>k.id===id)).map(p=>p.key),a);
 assert(keys.length>=2,'two placements');
 for(const key of keys){
   await pg.evaluate(([id,k])=>goToKpi(id,k),[a,key]);
   const n=await pg.evaluate(id=>[...document.querySelectorAll('.kpi-card[data-id="'+id+'"]')].map(c=>c.querySelectorAll('.lnk-item').length),a);
   assert(n.length&&n.every(x=>x===1),'link on every card of the kpi '+JSON.stringify(n));
 }
 // ย้ายหมวด: เอาหมวดเดิมที่ไม่ใช่ Part I–IV ออก (ระดับ SAR ต้องมีหมวด Part I–IV อย่างน้อย 1 หมวด) แล้วไปอยู่หมวดใหม่ → ยังมีลิงก์
 const moved=oldCats.filter(c=>C.isCorePart_(c.part)).concat([extra]);
 {const rr=C.saveKpi(tA,fy,{id:a,cats:moved});assert(rr.success,JSON.stringify(rr));}
 await pg.evaluate(()=>livePoll());
 await pg.waitForFunction(([id,n])=>{const k=globalDatabase.find(x=>x.id===id);return k&&kpiCats(k).length===n&&kpiCats(k).some(c=>c.category==='หมวดใหม่')},[a,moved.length]);
 await pg.evaluate(id=>goToKpi(id),a);await pg.waitForSelector(card+' .lnk-item a.lnk-a');
 assert(C.getKpiLinks(S.t,fy).links.some(l=>l.id===L.id&&l.ids.includes(a)),'link kept on server');
 await pg.click('#mode-switch button[data-mode=table]');await pg.waitForSelector('#kpi-table');await pg.evaluate(()=>tblEnsureRendered&&tblEnsureRendered());
 await pg.waitForSelector('#kpi-table tr[data-id="'+a+'"] td.c-lnk a.lnk-a');
 // คืนหมวดเดิม
 assert(C.saveKpi(tA,fy,{id:a,cats:oldCats}).success);await pg.evaluate(()=>livePoll());
 // ---- ลิงก์ถูกลบจากเครื่องอื่น ระหว่างที่หน้านี้ยังเห็นปุ่ม → กดแก้/ลบ ได้ข้อความ "ไม่พบลิงก์" และรายการอัปเดต
 await pg.click('#mode-switch button[data-mode=card]');await pg.evaluate(id=>goToKpi(id),a);await pg.waitForSelector(card+' .lnk-item .lnk-btn[aria-label="ลบลิงก์"]');
 const cur=C.getKpiLinks(tA,fy).links.find(l=>l.id===L.id);
 assert(C.deleteKpiLink(tA,fy,L.id,cur.rev).success);
 await pg.click(card+' .lnk-item .lnk-btn[aria-label="ลบลิงก์"]');await pg.waitForSelector('#modal-confirm',{state:'visible'});await pg.click('#modal-confirm .btn-danger');
 await pg.waitForSelector('#modal-alert',{state:'visible'});assert(/ไม่พบลิงก์/.test(await pg.textContent('#modal-alert')));await pg.click('#modal-alert button');
 await pg.waitForFunction(c=>!document.querySelector(c+' .lnk-item'),card);
 assert.deepStrictEqual(pg.errs,[],'page errors');
 await br.close();console.log('ui55 OK');
})().catch(e=>{console.error(e);process.exit(1)});
