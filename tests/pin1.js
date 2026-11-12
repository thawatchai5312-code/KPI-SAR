// รหัสผ่านตัวเลข 6 หลัก: เปลี่ยนรหัสต้องเลข 6 หลัก · ล็อกอินด้วยรหัสที่ไม่ใช่เลข 6 หลัก = ต้องตั้งใหม่ก่อน (ใช้ได้แค่เปลี่ยนรหัส) · รหัสตั้งต้น 11038 ไม่บังคับ
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const U=h.sheets.Users.d;
const rows=U.slice(1).filter(r=>r[2]==='staff').slice(0,4);assert(rows.length===4);
const [A,B,D,E]=rows;
const setPw=(r,pw,must)=>{r[1]=C.hashPassword_(pw);r[4]=must?'TRUE':'FALSE'};
const okData=t=>{try{const r=C.getAllData(t,2570);return !!(r&&r.success!==false&&r.data)}catch(e){return false}};

// 1) รหัสเดิมเป็นตัวอักษร (ตั้งเองแล้ว) → ล็อกอินได้ แต่ pinRequired และใช้ฟังก์ชันอื่นไม่ได้
setPw(A,'abc123xyz',false);
let lg=C.authenticateUser(A[0],'abc123xyz');assert(lg.success&&lg.user.pinRequired===true,JSON.stringify(lg));
assert(!okData(lg.token),'pending session cannot read data');
let blocked;try{blocked=C.getAllData(lg.token,2570)}catch(e){blocked={success:false,message:String(e)}}
assert(blocked.success===false&&/ตัวเลข 6 หลัก/.test(blocked.message||''),JSON.stringify(blocked).slice(0,200));
// 2) เปลี่ยนรหัส: ต้องเลข 6 หลัก
for(const bad of ['12345','1234567','abcdef','abc123','11038','','12 3456','12-3456']){
  const r=C.changePassword(lg.token,'abc123xyz',bad);assert(r.success===false&&/ตัวเลข 6 หลัก/.test(r.message),bad+' '+JSON.stringify(r));
}
assert(C.changePassword(lg.token,'wrongold','482915').success===false,'wrong old password');
let ch=C.changePassword(lg.token,'abc123xyz','482915');assert(ch.success&&ch.token,JSON.stringify(ch));
assert(!okData(lg.token),'old session dead after change');
assert(okData(ch.token),'new token works');
lg=C.authenticateUser(A[0],'482915');assert(lg.success&&lg.user.pinRequired===false&&okData(lg.token));
assert(C.authenticateUser(A[0],'abc123xyz').success===false,'old password no longer works');
// 3) เลขไทย/เว้นวรรคตอนตั้งรหัส → แปลงเป็นอารบิก
setPw(B,'abc123xyz',false);lg=C.authenticateUser(B[0],'abc123xyz');
ch=C.changePassword(lg.token,'abc123xyz',' ๑๒๓๔๕๖ ');assert(ch.success,JSON.stringify(ch));
assert(C.authenticateUser(B[0],'123456').success,'stored as arabic digits');
assert(C.authenticateUser(B[0],'๑๒๓๔๕๖').success,'login with thai digits works');
assert(C.authenticateUser(B[0],' 123456 ').success,'login trims spaces');
assert(C.authenticateUser(B[0],'123457').success===false);
// 4) รหัสตั้งต้น 11038: ไม่บังคับ (ใช้ mustChange เดิม) · ใช้งานได้ปกติ
setPw(D,'11038',true);lg=C.authenticateUser(D[0],'11038');assert(lg.success&&lg.user.pinRequired===false&&lg.user.mustChange===true&&okData(lg.token),JSON.stringify(lg.user));
assert(C.changePassword(lg.token,'11038','11038').success===false,'11038 is not a valid new password');
// 5) เลข 6 หลักอยู่แล้ว: ไม่บังคับ
setPw(E,'654321',false);lg=C.authenticateUser(E[0],'654321');assert(lg.success&&lg.user.pinRequired===false&&okData(lg.token));
// 6) ออกจากระบบได้ระหว่างรอตั้งรหัส
setPw(A,'abc123xyz',false);lg=C.authenticateUser(A[0],'abc123xyz');assert(lg.user.pinRequired);C.logoutUser(lg.token);
let gone;try{gone=C.changePassword(lg.token,'abc123xyz','482915')}catch(e){gone={success:false}}assert(gone.success===false,'logout kills session');
console.log('pin1 ok');
