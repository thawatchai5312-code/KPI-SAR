const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness2');const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = defaultListMode(); tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
(async()=>{
 h.sheets.Users.d.find(r=>r[0]==='Admin')[1]=h.ctx.hashPassword_('Admin11038'); h.sheets.Users.d.find(r=>r[0]==='Admin')[4]='FALSE';
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mkpage=async(vw=1440,vh=900)=>{
  const pg=await b.newPage({viewport:{width:vw,height:vh}});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message)); pg._errs=errs;
  await pg.exposeFunction('__call',(fn,args)=>{try{return JSON.stringify(h.ctx[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>{const u=r.request().url();if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});return r.abort()});
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/'); return pg; };
 const login=async(pg,u,p)=>{await pg.fill('#login-username',u);await pg.fill('#login-password',p);await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(300)};
 const total=pg=>pg.evaluate(()=>getOrderedKpis().length);

 let pg=await mkpage(); await login(pg,'Admin','Admin11038');
 await pg.click('#admin-settings-btn'); await pg.waitForSelector('#modal-settings',{state:'visible'});
 await pg.click('button:has-text("นำเข้า/อัปเดตตัวชี้วัดฝ่ายการพยาบาล")'); await pg.waitForSelector('#modal-nso',{state:'visible'});
 await pg.waitForFunction(()=>!document.getElementById('nso-commit-btn').disabled,null,{timeout:60000});
 console.log('preview text:',(await pg.innerText('#nso-body')).replace(/\n+/g,' | ').slice(0,300));
 await pg.screenshot({path:'ui27-preview.png'});
 await pg.click('#nso-commit-btn'); await pg.waitForSelector('#modal-confirm',{state:'visible'}); await pg.click('#modal-confirm button:has-text("ยืนยัน")');
 await pg.waitForFunction(()=>document.getElementById('nso-body').innerText.includes('ผลการนำเข้า'),null,{timeout:90000});
 console.log('result text:',(await pg.innerText('#nso-body')).replace(/\n+/g,' | ').slice(0,260));
 await pg.screenshot({path:'ui27-result.png'});
 await pg.click('#modal-nso .modal-footer button:has-text("ปิด")');
 console.log('errors',pg._errs);
 await pg.close(); await b.close(); console.log('UI27 OK');
})();
