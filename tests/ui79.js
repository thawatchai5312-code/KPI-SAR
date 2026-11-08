// ตัวชี้วัดที่อยู่หลายหมวด: ขึ้นเต็มทุกหมวด (การ์ด/ตาราง/สรุปรายงาน/SAR/CLT) + ป้ายซ้ำ + แก้จากหมวดไหนก็เป็นตัวเดียวกัน

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
 await pg.waitForSelector('#kpi-table');
 return pg;
}
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const pg=await open(br,ad);
 const multi=await pg.evaluate(()=>{const m=globalDatabase.find(k=>k.canEditResults&&k.canEditDetails&&kpiCats(k).filter(c=>isCorePart(c.part)).length>=2&&/^[^&<>"'\\]+$/.test(k.name));return m?{id:m.id,name:m.name,cats:kpiCats(m).filter(c=>isCorePart(c.part)).map(c=>c.part+'||'+c.category)}:null});
 assert(multi,'no multi-category kpi in fixtures');
 const nCat=multi.cats.length;
 // ===== หน้าแรก: ตาราง =====
 await pg.evaluate(()=>{setScopeFilter('all');setTreeView('hosp');tblHide.delete('monthly');renderList()});await pg.waitForFunction(()=>tblPending.length===0,null,{timeout:30000});
 const tb=await pg.evaluate(id=>{const rows=[...document.querySelectorAll('tr.kpi-row')].filter(r=>r.dataset.id===id);return {n:rows.length,keys:new Set(rows.map(r=>r.dataset.key)).size,tags:rows.map(r=>(r.querySelector('.tbl-multi')||{}).textContent||''),nos:rows.map(r=>r.querySelector('.c-no').textContent.trim()),info:document.querySelector('.tbl-toolbar').textContent}},multi.id);
 assert.strictEqual(tb.n,nCat,JSON.stringify(tb));assert.strictEqual(tb.keys,nCat);
 assert(/อยู่ใน \d+ หมวด/.test(tb.tags[0])&&tb.tags.slice(1).every(t=>/ซ้ำ — ตัวเดียวกับ ข้อ/.test(t)),JSON.stringify(tb.tags));
 assert(/รายการ \(\d+ ตัวชี้วัด\)/.test(tb.info),tb.info);
 // แก้จากแถวที่ 2 → ชีตเปลี่ยนแถวเดียว ทุกแถวอัปเดต
 const k2=await pg.evaluate(id=>[...document.querySelectorAll('tr.kpi-row')].filter(r=>r.dataset.id===id)[1].dataset.key,multi.id);
 await pg.evaluate(([id,key])=>startEditNow(id,key),[multi.id,k2]);await pg.waitForSelector('tr.kpi-row.editing #ed-m0');
 assert.strictEqual(await pg.evaluate(()=>document.querySelectorAll('tr.kpi-row.editing').length),1);
 assert.strictEqual(await pg.evaluate(k=>document.querySelector('tr.kpi-row.editing').dataset.key===k,k2),true,'edit opens on the clicked category row');
 await pg.fill('#ed-m0','77');await pg.evaluate(()=>saveKpiEdit());await pg.waitForFunction(()=>!savingKpi&&editingId===null,null,{timeout:60000});
 const after=await pg.evaluate(id=>[...document.querySelectorAll('tr.kpi-row')].filter(r=>r.dataset.id===id).map(r=>r.querySelector('.c-m0').textContent.trim()),multi.id);
 assert(after.length===nCat&&after.every(v=>v==='77'),JSON.stringify(after));
 assert.strictEqual(C.getAllData(tA,2570).data.filter(x=>x.id===multi.id).length,1,'one kpi in data');
 // ===== หน้าแรก: การ์ด =====
 await pg.evaluate(()=>{setListMode('card');pageSize=50;currentPage=1;renderList()});await pg.waitForSelector('.kpi-card');
 await pg.evaluate(id=>goToKpi(id),multi.id);await pg.waitForTimeout(500);
 const cd=await pg.evaluate(id=>{const cs=[...document.querySelectorAll('.kpi-card')].filter(c=>c.dataset.id===id);return {n:cs.length,badges:cs.map(c=>(c.querySelector('.multi-badge')||{}).textContent||''),years:cs.map(c=>c.querySelector('table').textContent.replace(/\s+/g,'')),pager:document.querySelector('.pager-info').textContent}},multi.id);
 assert(cd.n>=1,JSON.stringify(cd));
 if(cd.n===nCat){assert(/ซ้ำ — ตัวเดียวกับ/.test(cd.badges.slice(1).join('')),JSON.stringify(cd.badges));assert(new Set(cd.years).size===1,'same data on every card')}
 // กดชื่อที่หมวดที่ 2 ในแถบซ้าย → ไปการ์ดของหมวดนั้น
 const sel=await pg.evaluate(([id,key])=>{selectKpi(id,key);return key},[multi.id,k2]);await pg.waitForTimeout(600);
 assert.strictEqual(await pg.evaluate(()=>selectedKey),k2,'goToKpi honours key');
 // ===== สรุปรายงาน =====
 await pg.evaluate(()=>switchMenu('report'));await pg.waitForTimeout(1200);
 const rp=await pg.evaluate(id=>{const d=document.createElement('div');d.innerHTML=buildPrintHtmlRaw({table:true,chart:true,detail:true,source:true,owner:true},true);const bl=[...d.querySelectorAll('.pr-block')].filter(b=>{const k=globalDatabase.find(x=>x.id===id);return b.querySelector('.pr-kpi-title').textContent.includes(k.name)});return {n:bl.length,ref:d.querySelectorAll('.pr-ref').length,full:bl.every(b=>b.querySelector('.pr-chart')&&[...b.querySelectorAll('.pr-label')].length>=2),dup:bl.slice(1).every(b=>/ซ้ำ — ตัวเดียวกับ/.test(b.textContent))}},multi.id);
 assert(rp.n>=2&&rp.ref===0&&rp.full&&rp.dup,JSON.stringify(rp));
 // ===== SAR =====
 await pg.click('#menu-sar-btn');await pg.waitForSelector('#sar-pager-top .pager');
 await pg.evaluate(()=>{sar.size=5000;sar.page=1;sarRender()});await pg.waitForTimeout(500);
 const sr=await pg.evaluate(id=>{const bx=[...document.querySelectorAll('.sar-box')].filter(b=>b.dataset.box===id);return {n:bx.length,refs:document.querySelectorAll('#sar-paper .pr-ref').length,ids:new Set([...document.querySelectorAll('[id]')].map(e=>e.id)).size===document.querySelectorAll('[id]').length}},multi.id);
 assert(sr.n>=2,'SAR shows every category box '+JSON.stringify(sr));
 {
   assert(sr.refs===0&&sr.ids,JSON.stringify(sr));
   // พิมพ์ในกล่องที่ 2 → กล่องที่ 1 ตาม → บันทึกครั้งเดียว
   await pg.evaluate(id=>{const bx=[...document.querySelectorAll('.sar-box')].filter(b=>b.dataset.box===id);bx[1].scrollIntoView({block:'center'})},multi.id);
   const ta2=pg.locator('.sar-box[data-box="'+multi.id+'"] .sar-pdca').nth(1);await ta2.fill('PDCA ร่วมกัน');
   const vals=await pg.evaluate(id=>[...document.querySelectorAll('.sar-box')].filter(b=>b.dataset.box===id).map(b=>[b.querySelector('.sar-pdca').value,b.querySelector('.sar-save').disabled,b.classList.contains('dirty')]),multi.id);
   assert(vals.every(v=>v[0]==='PDCA ร่วมกัน'&&!v[1]&&v[2]),JSON.stringify(vals));
   await pg.locator('.sar-box[data-box="'+multi.id+'"] .sar-save').nth(1).click();await pg.waitForFunction(id=>sar.pdca[id]&&sar.pdca[id].text==='PDCA ร่วมกัน',multi.id);await pg.waitForTimeout(500);
   const vs=await pg.evaluate(id=>[...document.querySelectorAll('.sar-box')].filter(b=>b.dataset.box===id).map(b=>b.querySelector('.sar-pdca').value),multi.id);
   assert(vs.length===sr.n&&vs.every(v=>v==='PDCA ร่วมกัน'),JSON.stringify(vs));
   assert.strictEqual(C.getSarDoc(tA,2570).pdca[multi.id].text,'PDCA ร่วมกัน');
 }

 // ===== CLT: ตัวที่อยู่หลายกลุ่มโรค — ป้ายซ้ำที่กลุ่มถัดไป (ข้อความวิเคราะห์ยังแยกต่อกลุ่ม) =====
 await pg.click('#doc-tabs .doc-tab[data-doc=clt]');await pg.waitForSelector('#clt-tree .clt-link');
 const cm=await pg.evaluate(()=>{let k=clt.kpis.find(x=>x.groups.length>=2);if(!k){const gs=cltGroups();k=clt.kpis.find(x=>x.groups.length===1);k.groups=[k.groups[0]].concat(gs.filter(x=>x!==k.groups[0]).slice(0,1));} /* ข้อมูลทดสอบไม่มีตัวที่อยู่หลายกลุ่ม: จำลองโดยเพิ่มกลุ่ม */const order=cltGroups();const g=k.groups.slice().sort((a,b)=>order.indexOf(a)-order.indexOf(b));return {id:k.id,g:g,t0:cltMultiText(k,g[0]),t1:cltMultiText(k,g[1])}});
  assert(/^🔗 อยู่ใน \d+ กลุ่มโรค/.test(cm.t0)&&/^🔁 ซ้ำ — ตัวเดียวกับในกลุ่ม /.test(cm.t1)&&cm.t1.includes(cm.g[0]),JSON.stringify(cm));
 await pg.evaluate(g=>{clt.open.add(g);cltRenderTree()},cm.g[1]);
 const tags=await pg.evaluate(([g,id])=>{const el=document.querySelector('#clt-tree .clt-kpi-row [data-key="D|'+g+'|R|'+id+'"]');const row=el&&el.closest('.clt-kpi-row');return row?(row.querySelector('.clt-multi')||{}).textContent:null},[cm.g[1],cm.id]);
 assert.strictEqual(tags,'🔁','tree tag in 2nd group');
 await pg.evaluate(([g,id])=>cltSelect('D|'+g+'|R|'+id),[cm.g[1],cm.id]);await pg.waitForTimeout(400);
 assert(/ซ้ำ — ตัวเดียวกับในกลุ่ม/.test(await pg.textContent('#clt-editor .clt-multi-note')),'result page note');
 assert.deepStrictEqual(pg.errs,[],pg.errs.join('\n'));
 await br.close();console.log('ui79 ok');
})().catch(e=>{console.error(e);process.exit(1)});
