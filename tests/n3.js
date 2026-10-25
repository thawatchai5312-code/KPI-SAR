const h=require('./harness2');const C=h.ctx;const assert=require('assert');
const tok=C.createSession_('Admin',h.sheets.Users.d.find(r=>r[0]==='Admin')[1]);
const Y69=()=>h.sheets['ปีงบ 2569'].d;
const withOwner=Y69().slice(1).filter(r=>r[0]&&C.parseOwners_(r[25]).length>0).length, noOwner=Y69().slice(1).filter(r=>r[0]&&C.parseOwners_(r[25]).length===0).length;
const r=C.getAllData(tok,2569); assert(r.success,r.message);
const lv=Y69().slice(1).filter(x=>x[0]);
const missing=lv.filter(x=>C.parseOwners_(x[25]).length>0&&!x[28].includes('รายบุคคล')).length;
const extra=lv.filter(x=>C.parseOwners_(x[25]).length===0&&x[28].includes('รายบุคคล')).length;
console.log('rows with owner',withOwner,'no owner',noOwner,'missing level after',missing,'unexpected level',extra);
assert(missing===0&&extra===0);
// idempotent + nursing migration flag effect on real data
console.log('levels sample',lv.slice(0,3).map(x=>x[28]));
console.log('ALL OK');
