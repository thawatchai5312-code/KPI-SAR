const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),path=require('path');
const FX=path.join(__dirname,'fixtures');
const rows=JSON.parse(fs.readFileSync(FX+'/db.json','utf8'));
class Sheet{
  constructor(name,data){this.name=name;this.d=data;this.maxCols=Math.max(36,...data.map(r=>r.length));}
  getMaxColumns(){return this.maxCols} insertColumnsAfter(p,n){this.maxCols+=n}
  getName(){return this.name} setName(n){this.name=n}
  _ensure(r,c){while(this.d.length<r)this.d.push([]);for(let i=0;i<r;i++)while(this.d[i].length<c)this.d[i].push('')}
  getDataRange(){const w=Math.max(...this.d.map(r=>r.length));this._ensure(this.d.length,w);return this._rng(1,1,this.d.length,w)}
  getLastRow(){return this.d.length} getMaxRows(){return 1000}
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
const db=new Sheet('Database',[rows0=null].slice(1));
const header=new Array(28).fill('');header[0]='ID';
db.d=[header].concat(rows.map(r=>{const x=r.slice();while(x.length<28)x.push('');return x}));
const users=new Sheet('Users',[['Role','Username','Password'],['viewer','','11038'],['admin','Admin','Admin11038'],['officer','ER','ph11038']]);
const sheets={Database:db,Users:users};
const ss={getSheets:()=>Object.values(sheets),getSheetByName:n=>sheets[n]||null,insertSheet:n=>sheets[n]=new Sheet(n,[[]])};
// renaming support
const origSet=Sheet.prototype.setName;Sheet.prototype.setName=function(n){delete sheets[this.name];this.name=n;sheets[n]=this};
const triggers=[];const cache={};const props={};if(!process.env.MIGRATE){props.UNIT_CATEGORIES_V1='skip-in-old-tests';props.OWNER_LEVEL_V1='skip';}
const ctx={console,
 SpreadsheetApp:{openByUrl:()=>ss},
 Utilities:{getUuid:()=>crypto.randomUUID(),computeDigest:(a,s)=>[...crypto.createHash('sha256').update(s).digest()].map(b=>b>127?b-256:b),
   DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},formatDate:(d,tz,f)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d).map(x=>[x.type,x.value]));if(f==='M')return String(parseInt(p.month,10));return f.replace('yyyy',p.year).replace('dd',p.day).replace('MM',p.month).replace('HH',p.hour).replace('mm',p.minute).replace('ss',p.second)},base64Encode:()=>''},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>cache[k]=v,remove:k=>delete cache[k]})},
 LockService:{getScriptLock:()=>{let held=false;return {waitLock(){if(held)throw new Error('lock already held');held=true},tryLock(){held=true;return true},releaseLock(){held=false}}}},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>(k.startsWith('TOUR_HIDE_V1:')&&!process.env.TOURTEST?'1':(props[k]??null)),setProperty:(k,v)=>props[k]=v,deleteProperty:k=>{delete props[k]}})},
 HtmlService:{},ScriptApp:{getProjectTriggers:()=>triggers,deleteTrigger:t=>{triggers.splice(triggers.indexOf(t),1)},newTrigger:fn=>{const t={fn,getHandlerFunction:()=>fn};const b={timeBased:()=>b,everyDays:()=>b,atHour:()=>b,nearMinute:()=>b,inTimezone:()=>b,create:()=>{triggers.push(t);return t}};return b}}};
vm.createContext(ctx);
const SRC=process.env.SRC||path.join(__dirname,'../src/');for(const f of ['รหัส.js','Auth.js','Fiscal.js','NsoMatch.js','Nso.js','Tidy.js','Views.js','PctData.js','Pct.js','Tour.js','Live.js','SarDoc.js','Rename.js','Forward.js'].filter(f=>fs.existsSync(SRC+f)))vm.runInContext(fs.readFileSync(SRC+f,'utf8'),ctx,{filename:f});
// SHIMS: API เก่า (updateIndicatorsBulk/updateKpiDetails) แปลงเป็น saveKpi สำหรับเทสเดิม
ctx.updateIndicatorsBulk=(token,fy,part,items)=>{let saved=0,denied=0,fyv=fy;items.forEach(it=>{const r=ctx.saveKpi(token,fy,{id:it.id,name:it.name,target:it.target,years:it.years,months:it.months});if(r.success)saved++;else if(/ไม่มีสิทธิ์/.test(r.message))denied++;else throw new Error(r.message)});let m='บันทึกข้อมูลปีงบ '+fy+' เรียบร้อยแล้ว ('+saved+' รายการ)';if(denied)m+=' — ข้าม '+denied+' รายการที่ไม่มีสิทธิ์แก้ไข';return{success:true,message:m}};
ctx.updateKpiDetails=(token,fy,part,id,d)=>ctx.saveKpi(token,fy,Object.assign({id},d));
module.exports={ctx,sheets,db,run:c=>vm.runInContext(c,ctx)};
