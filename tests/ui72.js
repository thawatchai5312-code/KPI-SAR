// สรุปรายงาน: (ก) ตารางผลรายเดือนแสดงชื่อเต็ม ไม่ล้นช่อง · (ข) KPI รายบุคคลตั้งเนื้อหาที่พิมพ์ให้อัตโนมัติ ล้าง = คืนค่าเดิม ไม่จำค่าโหมดรายบุคคล

const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../src/Index.html'),'utf8');
const U=h.sheets.Users.d;const fy=2570;
const ad=U.find(r=>r[2]==='admin');ad[1]=C.hashPassword_('pw123456');ad[4]='FALSE';
const saved=[];const origSave=C.saveReportPrefs;C.saveReportPrefs=function(t,p){saved.push(JSON.parse(JSON.stringify(p)));return origSave.apply(this,arguments)};
const OUT=path.join(__dirname,'..');
(async()=>{
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await br.newContext({viewport:{width:1500,height:950}});const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(C[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
 await pg.route('**/*',r=>{const u=r.request().url();if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});return r.abort()});
 await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>Promise.resolve().then(()=>window.__call(fn,a)).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
 await pg.goto('http://app.test/');
 await pg.fill('#login-username',ad[0]);await pg.fill('#login-password','pw123456');await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.selectOption('#fy-pick-select',String(fy));await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 await pg.waitForFunction(()=>document.getElementById('kpi-table')||document.querySelector('.kpi-card'),null,{timeout:60000});
 await pg.waitForFunction(()=>acDir.heads&&acDir.heads.length>0,null,{timeout:20000});
 await pg.evaluate(()=>switchMenu('report'));await pg.waitForSelector('#rp-person');await pg.waitForFunction(()=>document.querySelectorAll('#rp-paper table').length>0,null,{timeout:60000});

 // ===== (ก) ชื่อเต็มในตารางรายเดือน =====
 const LONG='ร้อยละของผู้ป่วยที่ได้รับการดูแลตามมาตรฐานครบถ้วนและได้รับการติดตามต่อเนื่องภายในกำหนดเวลาที่โรงพยาบาลกำหนดไว้ในแต่ละเดือนของปีงบประมาณ';
 for(const orient of ['landscape','portrait']){
  const r=await pg.evaluate(async([o,LONG])=>{
   rpt.orient=o;rptSync('rp');
   const id=rptChosen()[0].id;globalDatabase.filter(x=>x.id===id).forEach(k=>{k.name=LONG;k.months=[o==='landscape'?1234.56:123.45,99.5,0,'-',null,null,null,null,null,null,null,null]});
   rptRenderPreview();
   await new Promise(r=>setTimeout(r,600));
   const cells=[...document.querySelectorAll('#rp-paper td.pr-mname')];
   const over=[...document.querySelectorAll('#rp-paper td.pr-mname')].map(td=>td.parentElement).flatMap(tr=>[...tr.children]).filter(td=>td.scrollWidth>td.clientWidth+1).length;
   const ovd=[...document.querySelectorAll('#rp-paper td.pr-mname')].map(td=>td.parentElement).flatMap(tr=>[...tr.children]).filter(td=>td.scrollWidth>td.clientWidth+1).map(td=>td.textContent+'|'+td.scrollWidth+'|'+td.clientWidth);return {ovd,n:cells.length,has:cells.some(c=>c.textContent===LONG),ell:cells.filter(c=>/…$/.test(c.textContent)&&!getDatabaseNames().has(c.textContent)).length,over};
   function getDatabaseNames(){return new Set(globalDatabase.map(x=>x.name))}
  },[orient,LONG]);
  assert(r.n>0,orient+' monthly rows');assert(r.has,orient+' full name');assert.strictEqual(r.ell,0,orient+' no ellipsis');assert.strictEqual(r.over,0,orient+' cell overflow '+JSON.stringify(r.ovd));
  await pg.screenshot({path:OUT+'/tests/out/ui72-'+orient+'.png'}).catch(()=>{});
 }
 await pg.evaluate(()=>{rpt.orient='landscape';rptSync('rp')});

 // ===== (ข) KPI รายบุคคล =====
 const opts=()=>pg.evaluate(()=>({...rpt.opts}));const boxes=()=>pg.evaluate(()=>Object.keys(RPT_DEFAULT_OPTS).map(k=>document.getElementById('rp-opt-'+k).checked));
 assert.deepStrictEqual(await opts(),{table:true,chart:true,detail:true,source:false,owner:true});
 const target=await pg.evaluate(()=>{const c={};globalDatabase.forEach(k=>String(k.owner||'').split('/').forEach(t=>{t=t.trim();if(t)c[t]=(c[t]||0)+1}));return Object.keys(c).filter(n=>c[n]>0).slice(0,2)});
 const choose=async n=>{await pg.fill('#rp-person',n);await pg.press('#rp-person','Enter');await pg.waitForFunction(m=>rpt.person===m&&Array.isArray(rpt.personData),n,{timeout:30000});await pg.waitForTimeout(300)};
 saved.length=0;
 await choose(target[0]);
 assert.deepStrictEqual(await opts(),{table:true,chart:false,detail:false,source:false,owner:false});
 assert.deepStrictEqual(await boxes(),[true,false,false,false,false]);
 assert.strictEqual(await pg.locator('#rp-paper .pr-chart, #rp-paper .pr-label').count(),0,'no chart/detail blocks');
 // ติ๊กเพิ่มระหว่างดูรายบุคคล แล้วเปลี่ยนเป็นอีกคน: ไม่ตั้งทับ
 await pg.click('#rp-opt-chart');await pg.waitForTimeout(1200);
 if(target[1]){await choose(target[1]);assert.strictEqual((await opts()).chart,true,'A→B keeps ticks');}
 // ไม่จำค่าโหมดรายบุคคล
 assert(saved.every(p=>JSON.stringify(p.opts)===JSON.stringify({table:true,chart:true,detail:true,source:false,owner:true})),'saved prefs: '+JSON.stringify(saved));
 // ดึงใหม่เงียบ ๆ ไม่เปลี่ยนช่องติ๊ก
 await pg.evaluate(()=>rptPersonLoad(rpt.person,true));await pg.waitForTimeout(600);
 assert.strictEqual((await opts()).detail,false);
 // ล้าง → คืนค่าเดิม
 await pg.click('#rp-person-clear');await pg.waitForTimeout(500);
 assert.deepStrictEqual(await opts(),{table:true,chart:true,detail:true,source:false,owner:true});
 assert.deepStrictEqual(await boxes(),[true,true,true,false,true]);
 // ผู้ใช้ตั้งเอง (ติ๊กที่มา ไม่ติ๊กกราฟ) → เลือกบุคคล → ล้าง → กลับเป็นที่ตั้งเอง
 await pg.click('#rp-opt-source');await pg.click('#rp-opt-chart');
 await choose(target[0]);assert.deepStrictEqual(await boxes(),[true,false,false,false,false]);
 await pg.click('#rp-person-clear');await pg.waitForTimeout(400);
 assert.deepStrictEqual(await boxes(),[true,false,true,true,true]);
 // ค้นไม่เจอ/ล้าง ก็คืนค่า
 await pg.fill('#rp-person','ไม่มีคนนี้แน่นอน');await pg.press('#rp-person','Enter');await pg.waitForFunction(()=>Array.isArray(rpt.personData),null,{timeout:30000});
 await pg.click('#rp-person-clear');await pg.waitForTimeout(300);
 assert.deepStrictEqual(await boxes(),[true,false,true,true,true]);
 assert.strictEqual(await pg.evaluate(()=>rpt.optsBeforePerson),null);
 console.log('errors',pg.errs);assert.strictEqual(pg.errs.length,0);
 await br.close();console.log('UI72 OK');
})().catch(e=>{console.error(e);process.exit(1)});
