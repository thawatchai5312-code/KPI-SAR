const h=require('./harness2');const C=h.ctx;const assert=require('assert');
const tok=C.createSession_('Admin',h.sheets.Users.d.find(r=>r[0]==='Admin')[1]);
let r=C.nsoImportCommit(tok); console.log('import',r.success,JSON.stringify(r.wrote||r.message));
const Y=()=>h.sheets['ปีงบ 2570'].d;
const pv=C.tidyPreview(tok); console.log('preview',pv.success,JSON.stringify(pv.preview&&pv.preview.fys),pv.message||'');
const o={ids:Y().slice(1).filter(x=>x[0]).length};
const c=C.tidyCommit(tok); console.log('commit',c.success,c.message,JSON.stringify(c.wrote));
assert(c.success,c.message);
const rows=Y().slice(1).filter(x=>x[0]);
console.log('names starting digit/dash:',rows.filter(x=>/^\s*[0-9๐-๙\-]/.test(x[4])).length);
console.log('parents set:',rows.filter(x=>x[37]).length,'groups set:',rows.filter(x=>x[38]).length,'placeholders left:',rows.filter(x=>/รอจัดหมวดย่อย/.test(x[36]+x[3])).length);
const c2=C.tidyPreview(tok); console.log('2nd preview hasWork',c2.preview.hasWork);
assert(!c2.preview.hasWork);
const c3=C.tidyCommit(tok); console.log('2nd commit',c3.message);
// backup + log sheets exist
console.log('sheets',Object.keys(h.sheets).join(' | '));
// NSO preview: nothing changed, no conflicts
const p=C.nsoImportPreview(tok); console.log('nso preview',JSON.stringify(p.preview.counts));
assert(p.preview.counts.conflicts===0&&p.preview.counts.updated===0&&p.preview.counts.added===0);
// second import then idempotent
const r2=C.nsoImportCommit(tok); console.log('import 2',JSON.stringify(r2.wrote)); 
console.log('tidy after import has work:',C.tidyPreview(tok).preview.hasWork);
console.log('ALL OK');
