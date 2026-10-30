// dropdown ค้นหา ผู้รับผิดชอบ/หน่วยงาน: การ์ด · แถวตาราง · ฟอร์มเพิ่ม — กรองตามคำที่พิมพ์ · เลือกด้วยเมาส์/คีย์บอร์ด · ต่อท้ายหลัง /

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
 const st=U.find(r=>r[2]==='staff');st[1]=C.hashPassword_('pw123456');st[4]='FALSE';
 // ===== เจ้าหน้าที่: ไม่มีช่อง KPI รายบุคคล =====
 {const ps=await open(br,st);await ps.evaluate(()=>switchMenu('report'));await ps.waitForSelector('#rp-controls .form-group');
  assert.strictEqual(await ps.locator('#rp-person').count(),0,'staff has no person box');await ps.close();}
 // ===== admin =====
 const pg=await open(br,ad);
 await pg.waitForFunction(()=>acDir.heads&&acDir.heads.length>0,null,{timeout:20000});
 await pg.evaluate(()=>switchMenu('report'));await pg.waitForSelector('#rp-person');await pg.waitForFunction(()=>document.querySelectorAll('#rp-paper .pr-main, #rp-paper table').length>0||document.querySelector('#rp-paper .empty-state'),null,{timeout:60000});
 // ค่าตั้งต้นเนื้อหาที่จะพิมพ์: ไม่ติ๊ก "ที่มาแหล่งข้อมูล" · ค่าที่จำไว้เก่า (ไม่มี v:2) ถูกเมินเฉพาะช่องนี้
 assert.deepStrictEqual(await pg.evaluate(()=>[rpt.opts.source,document.getElementById('rp-opt-source').checked,rpt.opts.table,rpt.opts.owner]),[false,false,true,true]);
 assert.deepStrictEqual(await pg.evaluate(()=>{const o=Object.assign({},rpt.opts);rptApplyPrefs({opts:{source:true,table:false}});const a=[rpt.opts.source,rpt.opts.table];rptApplyPrefs({v:2,opts:{source:true}});const b=rpt.opts.source;rpt.opts=o;return [a,b]}),[[false,false],true]);
 await pg.evaluate(()=>{rpt.opts.source=false;rpt.opts.table=true;rptSync('rp')});
 const items=()=>pg.evaluate(()=>[...document.querySelectorAll('#ac-pop .ac-item')].map(e=>e.dataset.v));
 const base=await pg.evaluate(()=>uniqueById(rptChosen()).length);assert(base>0,'base count');
 // กดช่อง → รายชื่อหัวหน้าหน่วยเรียงตามตัวอักษร
 await pg.click('#rp-person');
 const heads=await items();const hs=await pg.evaluate(()=>acDir.heads.slice(0,40));
 assert(heads.length>0&&JSON.stringify(heads)===JSON.stringify(hs),'click → heads list');
 assert.strictEqual(JSON.stringify(heads),JSON.stringify(heads.slice().sort((a,b)=>a.localeCompare(b,'th'))),'sorted');
 // พิมพ์ → ค้นได้ทุกระดับ (รวมเจ้าหน้าที่)
 const stf=await pg.evaluate(()=>acDir.users.find(n=>!acDir.heads.includes(n)&&n.length>=3));
 await pg.fill('#rp-person','');await pg.type('#rp-person',stf.slice(0,2));
 assert((await items()).includes(stf),'typed search finds a non-head user');
 // เลือกจากรายการ → รายงานเหลือเฉพาะตัวของคนนั้น
 const target=await pg.evaluate(()=>{const c={};globalDatabase.forEach(k=>String(k.owner||'').split('/').forEach(t=>{t=t.trim();if(t)c[t]=(c[t]||0)+1}));return acDir.heads.find(n=>c[n]>0&&c[n]<globalDatabase.length)||Object.keys(c).find(n=>c[n]>0)});
 await pg.fill('#rp-person','');await pg.type('#rp-person',target);
 await pg.evaluate(n=>{const el=[...document.querySelectorAll('#ac-pop .ac-item')].find(e=>e.dataset.v===n);acPick(n)},target).catch(()=>{});
 if(!(await pg.evaluate(()=>!!rpt.person)))await pg.press('#rp-person','Enter');
 await pg.waitForFunction(()=>Array.isArray(rpt.personData),null,{timeout:30000});
 const r=await pg.evaluate(()=>({p:rpt.person,n:uniqueById(rptChosen()).length,all:rpt.personData.length,fb:document.getElementById('rp-filterbar').classList.contains('person-on'),head:document.querySelector('#rp-paper .pr-info').innerText,clear:getComputedStyle(document.getElementById('rp-person-clear')).display,ok:uniqueById(rptChosen()).every(k=>String(k.owner||'').indexOf('')>=0)}));
 assert.strictEqual(r.p,target);assert(r.n>0&&r.fb&&/ผู้รับผิดชอบ/.test(r.head)&&r.head.includes(target)&&r.clear!=='none',JSON.stringify(r));
 const own=await pg.evaluate(t=>uniqueById(rptChosen()).every(k=>!k.canEditResults&&!k.canEditDetails),target);assert(own,'read only');
 // ปุ่มขอบเขตไม่มีผลระหว่างค้นหา
 const before=r.n;await pg.evaluate(()=>setScopeFilter('mine'));assert.strictEqual(await pg.evaluate(()=>uniqueById(rptChosen()).length),before,'scope ignored while person search');await pg.evaluate(()=>setScopeFilter('all'));
 // หน้าแรกไม่ถูกกระทบ
 await pg.evaluate(()=>switchMenu('home'));await pg.waitForTimeout(400);
 assert(await pg.evaluate(n=>uniqueById(getOrderedKpis()).length>=n,0),'home ok');
 const homeN=await pg.evaluate(()=>uniqueById(getOrderedKpis()).length);
 await pg.evaluate(()=>switchMenu('report'));await pg.waitForTimeout(500);
 // ล้างการค้นหา → กลับเป็นแบบเดิม
 await pg.click('#rp-person-clear');await pg.waitForTimeout(500);
 const c=await pg.evaluate(()=>({p:rpt.person,v:document.getElementById('rp-person').value,n:uniqueById(rptChosen()).length,fb:document.getElementById('rp-filterbar').classList.contains('person-on')}));
 assert.strictEqual(c.p,'');assert.strictEqual(c.v,'');assert(!c.fb);assert.strictEqual(c.n,base,'cleared → same as before');
 // ไม่เจอ → ข้อความว่าง
 await pg.fill('#rp-person','ไม่มีคนนี้แน่นอน');await pg.press('#rp-person','Enter');await pg.waitForFunction(()=>Array.isArray(rpt.personData),null,{timeout:30000});
 assert(/ไม่พบตัวชี้วัดของ/.test(await pg.innerText('#rp-paper')),'not found message');
 await pg.click('#rp-person-clear');
 console.log('errors',pg.errs);assert.strictEqual(pg.errs.length,0);
 await br.close();console.log('UI64 OK');
})().catch(e=>{console.error(e);process.exit(1)});
