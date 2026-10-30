const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),path=require('path');
const FX=path.join(__dirname,'fixtures');
const L=JSON.parse(fs.readFileSync(FX+'/live7/data.json','utf8'));L.nso=JSON.parse(fs.readFileSync(FX+'/live4/data.json','utf8')).nso;
class Sheet{
  constructor(name,data){this.name=name;this.d=data;this.maxCols=Math.max(36,...data.map(r=>r.length));}
  getMaxColumns(){return this.maxCols} insertColumnsAfter(p,n){this.maxCols+=n}
  getName(){return this.name} setName(n){this.name=n}
  _ensure(r,c){while(this.d.length<r)this.d.push([]);for(let i=0;i<r;i++)while(this.d[i].length<c)this.d[i].push('')}
  getDataRange(){const w=Math.max(...this.d.map(r=>r.length));this._ensure(this.d.length,w);return this._rng(1,1,this.d.length,w)}
  getLastRow(){return this.d.length} getMaxRows(){return 1000} insertRowsAfter(){}
  getRange(r,c,nr=1,nc=1){if(c+nc-1>this.maxCols)throw new Error('The coordinates of the range are outside the dimensions of the sheet.');return this._rng(r,c,nr,nc)}
  _rng(r,c,nr,nc){const s=this;const o={
    getValues(){s._ensure(r+nr-1,c+nc-1);return s.d.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+nc))},
    getValue(){s._ensure(r,c);return s.d[r-1][c-1]},
    setValues(v){s._ensure(r+nr-1,c+nc-1);v.forEach((row,i)=>row.forEach((x,j)=>s.d[r-1+i][c-1+j]=x));return o},
    setValue(v){s._ensure(r+nr-1,c+nc-1);for(let i=0;i<nr;i++)for(let j=0;j<nc;j++)s.d[r-1+i][c-1+j]=v;return o},
    clearContent(){s._ensure(r+nr-1,c+nc-1);for(let i=0;i<nr;i++)for(let j=0;j<nc;j++)s.d[r-1+i][c-1+j]='';return o},
    setFontWeight(){return o},setBackground(){return o},setHorizontalAlignment(){return o},setNumberFormat(){return o}};return o}
  hideSheet(){this.hidden=true} copyTo(ss){const c=new Sheet('Copy of '+this.name,JSON.parse(JSON.stringify(this.d),(k,v)=>v));c.maxCols=this.maxCols;sheets[c.name]=c;return c}
  setFrozenRows(){} appendRow(r){this.d.push(r)} deleteRow(n){this.d.splice(n-1,1)}
}
const mk=(n,d)=>{const sh=new Sheet(n,d.map(r=>r.map(v=>v===null?'':v)));return sh};
const H=L.hdr;const sheets={'ปีงบ 2569':mk('ปีงบ 2569',[H].concat(L['2569'])),'ปีงบ 2570':mk('ปีงบ 2570',[H].concat(L['2570'])),
 Users:mk('Users',[['Username','Password','Tier','Departments','MustChangePassword','LastAccess','LastEdit']].concat(L.users.map(u=>[u[0],'x',u[1],u[2]||'','FALSE','','']))),
 NSO_Sync:mk('NSO_Sync',[['sourceId','ourId','snap','at','fy']].concat(L.sync)),Tidy_Log:mk('Tidy_Log',[['เวลา','ปีงบ','รหัส','ฟิลด์','ค่าเดิม','ค่าใหม่']].concat(L.tidylog))};
const nsoSheet=mk('Database',[Array(27).fill('h')].concat(L.nso.map(r=>{r=r.slice();while(r.length<27)r.push('');return r})));const nsoSs={getSheets:()=>[nsoSheet],getSheetByName:n=>n==='Database'?nsoSheet:null};
const ss={getSheets:()=>Object.values(sheets),getSheetByName:n=>sheets[n]||null,insertSheet:n=>sheets[n]=new Sheet(n,[[]])};
const db=sheets['ปีงบ 2569'];
// renaming support
const origSet=Sheet.prototype.setName;Sheet.prototype.setName=function(n){delete sheets[this.name];this.name=n;sheets[n]=this};
const triggers=[];const cache={};const props={};props.UNIT_CATEGORIES_V1='done';if(!process.env.NOFLAGS){props.NURSING_LEVEL_TO_UNIT_V1='done';props.OWNER_LEVEL_V1='done';props.PCT_IMPORT_V1='done';props.NSO_IMPORT_BACKUP_V1='done';props.TIDY_BACKUP_V1='done';}
const ctx={console,
 SpreadsheetApp:{openByUrl:(u)=>String(u).includes('1LmpMCQ')?nsoSs:ss,flush(){}},
 Utilities:{getUuid:()=>crypto.randomUUID(),computeDigest:(a,s)=>[...crypto.createHash('sha256').update(s).digest()].map(b=>b>127?b-256:b),
   DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},formatDate:(d,tz,f)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d).map(x=>[x.type,x.value]));if(f==='M')return String(parseInt(p.month,10));return f.replace('yyyy',p.year).replace('dd',p.day).replace('MM',p.month).replace('HH',p.hour).replace('mm',p.minute).replace('ss',p.second)},base64Encode:()=>''},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>cache[k]=v,remove:k=>delete cache[k]})},
 LockService:{getScriptLock:()=>{let held=false;return {waitLock(){if(held)throw new Error('lock already held');held=true},tryLock(){held=true;return true},releaseLock(){held=false}}}},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>(k.startsWith('TOUR_HIDE_V1:')&&!process.env.TOURTEST?'1':(props[k]??null)),setProperty:(k,v)=>props[k]=v,deleteProperty:k=>{delete props[k]}})},
 HtmlService:{},ScriptApp:{getProjectTriggers:()=>triggers,deleteTrigger:t=>{triggers.splice(triggers.indexOf(t),1)},newTrigger:fn=>{const t={fn,getHandlerFunction:()=>fn};const b={timeBased:()=>b,everyDays:()=>b,atHour:()=>b,nearMinute:()=>b,inTimezone:()=>b,create:()=>{triggers.push(t);return t}};return b}}};
vm.createContext(ctx);
const SRC=process.env.SRC||path.join(__dirname,'../src/');for(const f of ['รหัส.js','Auth.js','Fiscal.js','NsoMatch.js','Nso.js','Tidy.js','Views.js','PctData.js','Pct.js','Tour.js','Live.js','SarDoc.js','Links.js','PullPrev.js','Rename.js','Forward.js'].filter(f=>fs.existsSync(SRC+f)))vm.runInContext(fs.readFileSync(SRC+f,'utf8'),ctx,{filename:f});
// SHIMS: API เก่า (updateIndicatorsBulk/updateKpiDetails) แปลงเป็น saveKpi สำหรับเทสเดิม
ctx.updateIndicatorsBulk=(token,fy,part,items)=>{let saved=0,denied=0,fyv=fy;items.forEach(it=>{const r=ctx.saveKpi(token,fy,{id:it.id,name:it.name,target:it.target,years:it.years,months:it.months});if(r.success)saved++;else if(/ไม่มีสิทธิ์/.test(r.message))denied++;else throw new Error(r.message)});let m='บันทึกข้อมูลปีงบ '+fy+' เรียบร้อยแล้ว ('+saved+' รายการ)';if(denied)m+=' — ข้าม '+denied+' รายการที่ไม่มีสิทธิ์แก้ไข';return{success:true,message:m}};
ctx.updateKpiDetails=(token,fy,part,id,d)=>ctx.saveKpi(token,fy,Object.assign({id},d));
module.exports={ctx,sheets,db,nsoSheet,run:c=>vm.runInContext(c,ctx)};
