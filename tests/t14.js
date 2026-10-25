// live updates: change log, pollChanges (same / incremental / full / other fy / eviction), rev conflict + force, bumps on add/delete/users
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;const pick=(tier,dept)=>U.find(r=>r[2]===tier&&(!dept||new RegExp('(^|,)'+dept+'(,|$)').test(r[3])));
const ad=pick('admin'),st=pick('staff','ER'),ex=pick('executive');
[ad,st,ex].forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tA=C.createSession_(ad[0],ad[1]),tS=C.createSession_(st[0],st[1]);
const g=C.getAllData(tA,2570);assert(g.success);assert(g.dataV===0,'no log yet → 0');
assert(g.data.every(k=>typeof k.rev==='string'&&k.rev.length>3),'rev on every kpi');
// rev stable across reads, ignores view stamps
const g2=C.getAllData(tA,2570);assert(JSON.stringify(g.data.map(k=>k.rev))===JSON.stringify(g2.data.map(k=>k.rev)),'rev stable');
const k0=g.data.find(k=>k.canEditResults);C.recordViews(tA,2570,[k0.id]);
assert(C.getAllData(tA,2570).data.find(k=>k.id===k0.id).rev===k0.rev,'views do not change rev');
// poll same (no log)
let p=C.pollChanges(tA,2570,0);assert(p.success&&p.same&&p.v===0);
// save → bump
let r=C.saveKpi(tA,2570,{id:k0.id,months:k0.months.map((v,i)=>i===0?123:v),years:k0.years,baseRev:k0.rev});assert(r.success&&r.changed,r.message);
assert(r.kpi.rev!==k0.rev,'rev changed after save');
p=C.pollChanges(tA,2570,0);assert(p.success&&!p.same,'log created → not same');assert(p.full===true,'0 not in new log → full');assert(p.kpis.length===g.data.length,'full returns all visible');
const base=JSON.parse(h.ctx.CacheService.getScriptCache().get('KPI_CHANGES_V1'));const v1=p.v;assert(v1===base.base+1);
p=C.pollChanges(tA,2570,v1);assert(p.same,'up to date');
p=C.pollChanges(tA,2570,base.base);assert(!p.full&&p.kpis.length===1&&p.kpis[0].id===k0.id&&p.kpis[0].rev===r.kpi.rev&&p.by[0]===ad[0],'incremental from base');
// other fy only → same for 2570
const o69=C.getAllData(tA,2569).data.find(k=>k.canEditResults&&k.canEditDetails);
r=C.saveKpi(tA,2569,{id:o69.id,target:(o69.target||'')+' x',baseRev:o69.rev});assert(r.success&&r.changed,r.message);
p=C.pollChanges(tA,2570,v1);assert(p.same&&p.v===v1+1,'other-fy change → same for 2570');
p=C.pollChanges(tA,2569,v1);assert(!p.same&&!p.full&&p.kpis.length===1&&p.kpis[0].id===o69.id,'2569 sees it');
// conflict: stale baseRev
const stale=C.getAllData(tA,2570).data.find(k=>k.id===k0.id);
r=C.saveKpi(tA,2570,{id:k0.id,target:'A1',baseRev:stale.rev});assert(r.success&&r.changed);
r=C.saveKpi(tA,2570,{id:k0.id,target:'B1',baseRev:stale.rev});assert(!r.success&&r.conflict,'conflict detected');assert(/ถูกแก้ไขโดย/.test(r.message)&&r.kpi.target==='A1'&&r.kpi.rev,'latest returned');
assert(C.getAllData(tA,2570).data.find(k=>k.id===k0.id).target==='A1','conflict wrote nothing');
r=C.saveKpi(tA,2570,{id:k0.id,target:'B1',baseRev:stale.rev,force:true});assert(r.success&&r.changed&&r.kpi.target==='B1','force overwrites');
// no baseRev (old clients) still saves
r=C.saveKpi(tA,2570,{id:k0.id,target:'C1'});assert(r.success);
// unchanged save does not bump
let vb=C.pollChanges(tA,2570,-1).v;r=C.saveKpi(tA,2570,{id:k0.id,target:'C1',baseRev:r.kpi.rev});assert(r.success&&!r.changed);assert(C.pollChanges(tA,2570,vb).same,'no-op save no bump');
// annual change → fy '*'
const cur=C.getAllData(tA,2570).data.find(k=>k.id===k0.id);
r=C.saveKpi(tA,2570,{id:k0.id,years:cur.years.map((v,i)=>i===3?77:v),months:cur.months,baseRev:cur.rev});assert(r.success&&r.changed,r.message);
let L=JSON.parse(C.CacheService.getScriptCache().get('KPI_CHANGES_V1'));assert(L.entries[L.entries.length-1].fy==='*','annual → all fy');
// add / delete bump ids
vb=C.pollChanges(tA,2570,-1).v;
r=C.addIndicator(tA,2570,{name:'live test kpi',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],cats:[{part:'ทดสอบสด',category:'หมวด'}]});assert(r.success,r.message);const nid=r.newId;
p=C.pollChanges(tA,2570,vb);assert(p.kpis.length===1&&p.kpis[0].id===nid&&p.removed.length===0,'add incremental');
r=C.deleteIndicator(tA,2570,'ทดสอบสด',nid);assert(r.success);p=C.pollChanges(tA,2570,p.v);assert(p.kpis.length===0&&p.removed[0]===nid,'delete → removed');
// invisible change → removed for staff (not visible)
const sIds=new Set(C.getAllData(tS,2570).data.map(x=>x.id));const hid=C.getAllData(tA,2570).data.find(k=>!sIds.has(k.id));
vb=C.pollChanges(tS,2570,-1).v;r=C.saveKpi(tA,2570,{id:hid.id,target:'zz',baseRev:hid.rev});assert(r.success);
p=C.pollChanges(tS,2570,vb);assert(p.kpis.length===0&&p.removed[0]===hid.id,'not visible → removed (client ignores unknown ids)');
// users change → full
vb=C.pollChanges(tA,2570,-1).v;const ul=C.getUsersForAdmin(tA).users;r=C.saveUsersForAdmin(tA,ul,[]);assert(r.success,r.message);p=C.pollChanges(tA,2570,vb);assert(p.full&&p.headings,'users → full');
// trim: >80 entries → old v gone → full
const old=C.pollChanges(tA,2570,-1).v;for(let i=0;i<85;i++)C.bumpDataVersion_(2570,['x'+i],null);p=C.pollChanges(tA,2570,old);assert(p.full,'trimmed → full');
// eviction: log gone → v 0 → full once, then same
h.ctx.CacheService.getScriptCache().remove('KPI_CHANGES_V1');p=C.pollChanges(tA,2570,old+85);assert(p.full&&p.v===0);assert(C.pollChanges(tA,2570,0).same);
// session
assert(/SESSION_EXPIRED/.test(C.pollChanges('bad',2570,0).message));
// rev ignores width beyond KPI_COLS
const row=h.sheets['ปีงบ 2570'].d[1].slice();const a=C.rowRev_(row);row.push('extra');assert(C.rowRev_(row)===a);
console.log('ALL OK');
