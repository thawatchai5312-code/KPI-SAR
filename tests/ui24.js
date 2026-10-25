const {chromium}=require('playwright');
const fs=require('fs');const h=require('./harness');const assert=require('assert');
const ff=require('./lib/font');
const html=fs.readFileSync(require('path').join(__dirname,'../src/Index.html'),'utf8').replace("let listMode = 'table';","let listMode = 'card';").replace("listMode = 'table'; tblHide.clear(); TBL_DEFAULT_HIDE","listMode = 'card'; tblHide.clear(); TBL_DEFAULT_HIDE").replace('</head>','<style>'+ff('thai')+ff('latin')+'</style></head>');
(async()=>{
 h.ctx.authenticateUser('Admin','Admin11038'); h.ctx.authenticateUser('Admin','Admin11038');
 for(const u of ['มานี','อรทัย','ผอ.']){const t=h.ctx.authenticateUser(u,'11038'); h.ctx.changePassword(t.token,'11038','secret99');}
 // a staff with no KPIs
 const at=h.ctx.authenticateUser('Admin','Admin11038'); const users=h.ctx.getUsersForAdmin(at.token).users; users.push({username:'คนใหม่',tier:'staff',depts:'',isNew:true}); h.ctx.saveUsersForAdmin(at.token,users,[]); const tn=h.ctx.authenticateUser('คนใหม่','11038'); h.ctx.changePassword(tn.token,'11038','secret99');
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const mkpage=async(vw=1440,vh=900)=>{
  const pg=await b.newPage({viewport:{width:vw,height:vh}});
  const errs=[];pg.on('pageerror',e=>errs.push(e.message)); pg._errs=errs;
  await pg.exposeFunction('__call',async(fn,args)=>{try{if(h.hook){const r=await h.hook(fn,args);if(r!==undefined)return JSON.stringify(r)}return JSON.stringify(h.ctx[fn](...args)??null)}catch(e){return JSON.stringify({success:false,message:String(e)})}});
  await pg.route('**/*',r=>{const u=r.request().url();if(u==='http://app.test/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});return r.abort()});
  await pg.addInitScript(()=>{function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);return (...a)=>window.__call(fn,a).then(r=>ok&&ok(JSON.parse(r)))}})}window.google={script:{run:mk()}};});
  await pg.goto('http://app.test/'); return pg; };
 const login=async(pg,u,p)=>{await pg.fill('#login-username',u);await pg.fill('#login-password',p);await pg.click('#login-box-content button');await pg.waitForSelector('#modal-fy',{state:'visible'});await pg.click('#modal-fy button');await pg.waitForSelector('#app-login-screen',{state:'hidden'});await pg.waitForTimeout(300)};
 const total=pg=>pg.evaluate(()=>getOrderedKpis().length);


 let pg=await mkpage();
 await pg.fill('#login-username','ปิติ'); await pg.fill('#login-password','11038'); await pg.click('#login-box-content button');
 await pg.waitForSelector('#modal-change-password',{state:'visible'});
 const oldTok=await pg.evaluate(()=>sessionToken);
 await pg.fill('#chpw-old','11038'); await pg.fill('#chpw-new','brandnew77'); await pg.fill('#chpw-confirm','brandnew77'); await pg.click('#chpw-submit');
 await pg.waitForSelector('#modal-alert',{state:'visible'}); await pg.click('#modal-alert button');
 await pg.waitForSelector('#modal-fy',{state:'visible'}); const newTok=await pg.evaluate(()=>sessionToken); console.log('token replaced:',oldTok!==newTok);
 assert(oldTok!==newTok); await pg.click('#modal-fy button'); await pg.waitForSelector('#app-login-screen',{state:'hidden'});
 const n=await pg.evaluate(()=>globalDatabase.length); console.log('KPIs loaded with new token',n); assert(n>0);
 // another save with new token works
 const ok=await pg.evaluate(()=>new Promise(res=>{const k=globalDatabase.find(k=>k.mine); if(!k) return res('no-mine'); google.script.run.withSuccessHandler(r=>res(r.success)).saveKpi(sessionToken,selectedFy,{id:k.id,months:k.months});})); console.log('save ok',ok); assert(ok===true||ok==='no-mine');
 await b.close(); console.log('UI24 OK');
})();
