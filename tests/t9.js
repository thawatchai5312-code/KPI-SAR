const {ctx,sheets}=require('./harness');const assert=require('assert');
ctx.authenticateUser('Admin','Admin11038'); const a=ctx.authenticateUser('Admin','Admin11038');
const users=ctx.getUsersForAdmin(a.token).users; console.log(users.filter(u=>/PCU|ER/.test(u.depts)).map(u=>u.username+':'+u.tier+':'+u.depts).join(' | '));
const S=sheets['ปีงบ 2570'].d;
const head=ctx.authenticateUser('อรทัย','11038'); // ER head
const erStaff=users.find(u=>u.tier==='staff'&&/\bER\b/.test(u.depts));
console.log('er staff',erStaff&&erStaff.username);
const k=S.find(r=>r[0]&&/ER/.test(r[26])&&!/อรทัย/.test(r[25]));
k[28]='หน่วยงาน'; k[2]='หมวดER';
assert(ctx.getAllData(head.token,2570).data.some(x=>x.id===k[0]),'head sees unit-level in own dept');
if(erStaff){const s=ctx.authenticateUser(erStaff.username,'11038'); assert(ctx.getAllData(s.token,2570).data.some(x=>x.id===k[0]),'dept staff sees unit-level');
  k[28]='รายบุคคล'; assert(!ctx.getAllData(s.token,2570).data.some(x=>x.id===k[0]),'dept staff not personal'); k[28]='หน่วยงาน'; }
k[28]='QA-หน่วยงาน'; if(erStaff){const s=ctx.authenticateUser(erStaff.username,'11038'); assert(ctx.getAllData(s.token,2570).data.some(x=>x.id===k[0]),'QA dept visible to dept staff');}
k[28]='ฝ่ายการพยาบาล'; assert(ctx.getAllData(head.token,2570).data.some(x=>x.id===k[0])); 
console.log('ALL OK');
