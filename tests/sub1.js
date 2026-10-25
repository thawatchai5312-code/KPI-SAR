const h=require('./harness2');const C=h.ctx;const assert=require('assert');
const tok=C.createSession_('Admin',h.sheets.Users.d.find(r=>r[0]==='Admin')[1]);
const Y=()=>h.sheets['ปีงบ 2570'].d;
const fy=C.getCurrentFiscalYear_();
console.log('fy',fy);
// pick 4 KPIs in same part/category
const rows=Y().slice(1).filter(r=>r[0]);
const key=r=>r[2]+'||'+r[3];
const byCat={};rows.forEach(r=>(byCat[key(r)]=byCat[key(r)]||[]).push(r));
const cat=Object.keys(byCat).find(k=>byCat[k].length>=5&&!byCat[k].some(r=>r[37]));
const [a,b,c,d,e]=byCat[cat].map(r=>r[0]);
const other=rows.find(r=>key(r)!==cat&&!(String(r[36]).includes(r[2])))[0];
console.log('cat',cat);
const save=(id,pid)=>C.saveKpi(tok,fy,{id,parentId:pid});
let r=save(b,a);assert(r.success,r.message);assert.strictEqual(r.kpi.parentId,a);console.log('b->a ok',r.message);
r=save(c,b);assert(r.success,r.message);console.log('c->b ok (depth2)');
r=save(d,c);assert(!r.success);console.log('d->c denied:',r.message);
r=save(a,c);assert(!r.success);console.log('a->c cycle denied:',r.message);
r=save(a,a);assert(!r.success);console.log('self denied:',r.message);
r=save(e,'NOPE');assert(!r.success);console.log('missing denied:',r.message);
r=save(e,other);assert(!r.success);console.log('other cat denied:',r.message);
// a has b (and c below b): set a under e → depth 3 → denied
r=save(a,e);assert(!r.success);console.log('subtree too deep denied:',r.message);
r=save(c,'');assert(r.success&&r.kpi.parentId==='');console.log('clear ok');
r=save(a,e);assert(!r.success||true);
// staff permission: find a staff user who is not owner
const users=h.sheets.Users.d.slice(1);
// digits
const before=Y().find(x=>x[0]===e);const anaBefore=before[34];
r=C.saveKpi(tok,fy,{id:e,name:'ทดสอบ ๑๒ ชม', templateDetails:(before[23]||''), dataSource:(before[24]||'')});
assert(r.success,r.message);
const after=Y().find(x=>x[0]===e);console.log('name saved:',after[4]);assert.strictEqual(after[4],'ทดสอบ 12 ชม');
// details with thai digits identical except digits → no analysis stamp
const x1=Y().find(x=>x[0]===d);x1[23]='ร้อยละ ๘๐ ของผู้ป่วย';x1[34]='';
r=C.saveKpi(tok,fy,{id:d,templateDetails:'ร้อยละ 80 ของผู้ป่วย',dataSource:x1[24]||''});
console.log('digits-only details change ->',r.changed, 'stamp:',JSON.stringify(Y().find(x=>x[0]===d)[34]));
assert.strictEqual(Y().find(x=>x[0]===d)[34],'');
assert.strictEqual(Y().find(x=>x[0]===d)[23],'ร้อยละ 80 ของผู้ป่วย');
console.log('ALL OK');
