// ชื่อผู้ใช้ซ้ำ → "ชื่อ นามสกุล": เครื่องมือเปลี่ยนชื่อผู้ใช้ (RenameUser.js) · ล็อกอินพิมพ์แค่ชื่อต้น · กันบันทึกชื่อกำกวม · ไม่สร้างบัญชีชื่อต้นกลับมา — ข้อมูลสมมติ
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const U=h.sheets.Users.d;const FY=2570;
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const adRow=U.find(r=>r[2]==='admin'),tA=tok(adRow);
const Y=()=>h.sheets['ปีงบ '+FY].d;
const mkUser=(n,pw,tier)=>{const r=[n,C.hashPassword_(pw),tier||'staff','','FALSE','',''];U.push(r);return r};
// สองคนชื่อต้นเดียวกัน (บัญชีเดิม = ชื่อต้น และ ชื่อต้น+ตัวย่อ) + คนชื่อไม่ซ้ำ
const u1=mkUser('ทดสอบซ้ำ','pw123456'),u2=mkUser('ทดสอบซ้ำแ.','pw123456'),u3=mkUser('ทดสอบเดี่ยว','pw123456');
const item=(name,owner,dept)=>({part:'OPD',category:'x',name,target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],owner,department:dept});
const k1=C.addIndicator(tA,FY,item('ตัวชี้วัดทดสอบ 1','ทดสอบซ้ำ','OPD'));assert(k1.success,JSON.stringify(k1));
const k2=C.addIndicator(tA,FY,item('ตัวชี้วัดทดสอบ 2','ทดสอบซ้ำแ.','IPD'));assert(k2.success);
const k3=C.addIndicator(tA,FY,item('ตัวชี้วัดทดสอบ 3','ทดสอบซ้ำ / ทดสอบเดี่ยว','OPD'));assert(k3.success);
const k4=C.addIndicator(tA,FY,item('ตัวชี้วัดทดสอบ 4','หัวหน้าหน่วย /  ทดสอบซ้ำ ','OPD'));assert(k4.success);
const row=id=>Y().find(r=>r[0]===id);
// ---- ฟังก์ชันล้วน
assert.strictEqual(C.renameUserOwnerText_('ทดสอบซ้ำ','ทดสอบซ้ำ','ทดสอบซ้ำ ใจดี'),'ทดสอบซ้ำ ใจดี');
assert.strictEqual(C.renameUserOwnerText_('ทดสอบซ้ำแ.','ทดสอบซ้ำ','x y'),'ทดสอบซ้ำแ.','ไม่แตะชื่อที่ขึ้นต้นเหมือนกันแต่ไม่ตรงทั้งคำ');
assert.strictEqual(C.renameUserOwnerText_(' ก /  ทดสอบซ้ำ  / ข','ทดสอบซ้ำ','ทดสอบซ้ำ ใจดี'),' ก /  ทดสอบซ้ำ ใจดี  / ข','คงช่องว่างและตัวคั่นเดิม');
assert.strictEqual(C.renameUserOwnerText_('ทดสอบซ้ำ $& x','ทดสอบซ้ำ $& x','a $& b'),'a $& b','ไม่ตีความ $ ในชื่อใหม่');
eq(C.nameMatchesFull_('ทดสอบซ้ำ',['ทดสอบซ้ำ ก','ทดสอบซ้ำ ข','อื่น']),['ทดสอบซ้ำ ก','ทดสอบซ้ำ ข']);
eq(C.nameMatchesFull_('ทดสอบซ้ำ',['ทดสอบซ้ำ','ทดสอบซ้ำ ก']),[],'มีบัญชีชื่อตรงๆ = ไม่กำกวม');
eq(C.nameMatchesFull_('ทดสอบ',['ทดสอบซ้ำ ก']),[],'ต้องตามด้วยช่องว่าง');

// ---- สิทธิ์
const tS=tok(u3);
assert(!C.renameUserInfo(tS).success&&!C.renameUserPreview(tS,{from:'ทดสอบซ้ำ',to:'ทดสอบซ้ำ ใจดี'}).success&&!C.renameUserCommit(tS,{from:'ทดสอบซ้ำ',to:'ทดสอบซ้ำ ใจดี'}).success,'admin only');
const info=C.renameUserInfo(tA);assert(info.success);
const sim=info.users.filter(u=>u.similar).map(u=>u.username).sort();assert(sim.includes('ทดสอบซ้ำ')&&sim.includes('ทดสอบซ้ำแ.')&&!sim.includes('ทดสอบเดี่ยว'),JSON.stringify(sim));

// ---- ตรวจชื่อใหม่
const bad=(to,re)=>{const r=C.renameUserPreview(tA,{from:'ทดสอบซ้ำ',to});assert(r.success&&r.preview.errors.length&&new RegExp(re).test(r.preview.errors.join()),to+' → '+JSON.stringify(r));const c=C.renameUserCommit(tA,{from:'ทดสอบซ้ำ',to});assert(!c.success)};
bad('','ระบุชื่อใหม่');bad('ทดสอบซ้ำ',/เหมือนชื่อเดิม/);bad('ทดสอบเดี่ยว',/มีบัญชี/);bad('ทดสอบซ้ำ / ใจดี',/\//);bad('ผอ.',/แปลงอัตโนมัติ/);bad('ก'.repeat(61),/ยาวเกิน/);
assert(C.renameUserPreview(tA,{from:'ไม่มีคนนี้',to:'ก ข'}).preview.errors.length>0);

// ---- ตัวอย่างไม่เขียน
C.renameUserPreview(tA,{from:'ทดสอบซ้ำ',to:'ทดสอบซ้ำ ก'}); // อ่านชีตครั้งแรกเติมคอลัมน์ให้ครบ (ensureColumns_ ของ tidyReadFy_) ก่อนถ่ายภาพ
const snap=()=>JSON.stringify([Y(),U,Object.keys(h.sheets).sort()]);const before=snap();
let pv=C.renameUserPreview(tA,{from:'ทดสอบซ้ำ',to:'  ทดสอบซ้ำ   ใจดี '});assert(pv.success&&pv.preview.errors.length===0,JSON.stringify(pv));
assert.strictEqual(pv.preview.to,'ทดสอบซ้ำ ใจดี','ช่องว่างซ้อนถูกรวม');assert.strictEqual(pv.preview.total,3,'แถวที่เจ้าของมีชื่อนี้ (ไม่รวมทดสอบซ้ำแ.)');
assert.strictEqual(snap(),before,'preview writes nothing');

// ---- ตั้งค่าที่จำไว้ต่อบัญชี
const props=C.PropertiesService.getScriptProperties();props.setProperty('REPORT_PREFS_V1:ทดสอบซ้ำ','{"v":2}');
// ---- เปลี่ยนจริง
const v0=C.dataVersion_(C.readChangeLog_());
let r=C.renameUserCommit(tA,{from:'ทดสอบซ้ำ',to:'ทดสอบซ้ำ ใจดี'});assert(r.success&&r.wrote.rows===3,JSON.stringify(r));
assert.strictEqual(u1[0],'ทดสอบซ้ำ ใจดี');assert.strictEqual(u1[2],'staff');assert(C.verifyPassword_('pw123456',u1[1]),'รหัสผ่านคงเดิม');
assert.strictEqual(row(k1.newId)[25],'ทดสอบซ้ำ ใจดี');assert.strictEqual(row(k2.newId)[25],'ทดสอบซ้ำแ.','อีกคนไม่ถูกแตะ');
assert.strictEqual(row(k3.newId)[25],'ทดสอบซ้ำ ใจดี / ทดสอบเดี่ยว');assert.strictEqual(row(k4.newId)[25],'หัวหน้าหน่วย /  ทดสอบซ้ำ ใจดี ');
assert.strictEqual(props.getProperty('REPORT_PREFS_V1:ทดสอบซ้ำ ใจดี'),'{"v":2}');assert.strictEqual(props.getProperty('REPORT_PREFS_V1:ทดสอบซ้ำ'),null,'prefs moved'); // (harness ตอบ TOUR_HIDE_V1:* เป็น "1" เสมอ จึงตรวจเฉพาะ REPORT_PREFS)
const sheets=Object.keys(h.sheets);assert(sheets.some(n=>n.indexOf('สำรองก่อนเปลี่ยนชื่อผู้ใช้ ผู้ใช้ ')===0)&&sheets.some(n=>n.indexOf('สำรองก่อนเปลี่ยนชื่อผู้ใช้ ปีงบ '+FY)===0),'backups');
const log=h.sheets.Tidy_Log.d;assert(log.some(x=>x[3]==='rename-user'&&x[4]==='ทดสอบซ้ำ'&&x[5]==='ทดสอบซ้ำ ใจดี')&&log.filter(x=>x[3]==='owner'&&x[5].indexOf('ทดสอบซ้ำ ใจดี')!==-1).length===3,'log');
assert(C.dataVersion_(C.readChangeLog_())!==v0,'bumped for other clients');
// สิทธิ์ตามชื่อใหม่: ล็อกอินชื่อใหม่เห็น/แก้ตัวชี้วัดของตน · ชื่อเก่า (ที่ไม่มีบัญชีตรงๆ แล้ว) ต้องไม่หลุดเป็นเจ้าของ
let lg=C.authenticateUser('ทดสอบซ้ำ ใจดี','pw123456');assert(lg.success,JSON.stringify(lg));
const all=C.getAllData(lg.token,FY);assert(all.success);const mine=all.data.filter(k=>k.mine).map(k=>k.id).sort();eq(mine,[k1.newId,k3.newId,k4.newId].sort(),'mine');
assert(C.saveKpi(lg.token,FY,{id:k1.newId,years:[null,null,null,null,10],baseRev:all.data.find(k=>k.id===k1.newId).rev}).success,'owner can save');
// session เดิมของบัญชีที่เปลี่ยนชื่อใช้ไม่ได้
const oldTok=C.createSession_('ทดสอบซ้ำ',u1[1]);assert(!C.getAllData(oldTok,FY).success,'old-name session invalid');

// ---- ล็อกอินพิมพ์แค่ชื่อต้น
C.CacheService.getScriptCache().remove('fail_ทดสอบซ้ำ');
// คนเดียวรหัสตรง (เปลี่ยนรหัสของ ใจดี) → เข้าได้ทันที
u1[1]=C.hashPassword_('pwNO1111');lg=C.authenticateUser('ทดสอบซ้ำ','pwNO1111');assert(lg.success&&lg.user.username==='ทดสอบซ้ำ ใจดี',JSON.stringify(lg));
// แก้ชื่อ u2 เป็น ชื่อ นามสกุล แล้วรหัสผ่านตรงทั้งคู่ → ให้เลือก
assert(C.renameUserCommit(tA,{from:'ทดสอบซ้ำแ.',to:'ทดสอบซ้ำ แถวบุญตา'}).success);
u1[1]=C.hashPassword_('pw123456');
lg=C.authenticateUser('ทดสอบซ้ำ','pw123456');assert(!lg.success&&lg.choose&&!lg.token,JSON.stringify(lg));eq(lg.choose,['ทดสอบซ้ำ ใจดี','ทดสอบซ้ำ แถวบุญตา'].sort((a,b)=>a.localeCompare(b,'th')));
lg=C.authenticateUser('ทดสอบซ้ำ แถวบุญตา','pw123456');assert(lg.success&&lg.user.username==='ทดสอบซ้ำ แถวบุญตา');
// รหัสผ่านผิด → ไม่เผยนามสกุล
lg=C.authenticateUser('ทดสอบซ้ำ','ผิดผิดผิด');assert(!lg.success&&!lg.choose&&/ไม่ถูกต้อง/.test(lg.message)&&!JSON.stringify(lg).includes('ใจดี'),JSON.stringify(lg));
// ชื่อต้นที่ไม่มีใครขึ้นต้นด้วย → ผิดปกติ
lg=C.authenticateUser('ไม่มีใคร','pw123456');assert(!lg.success&&!lg.choose);

// ---- บันทึกช่องผู้รับผิดชอบที่เป็นชื่อกำกวม
const fresh=C.getAllData(tA,FY).data.find(k=>k.id===k2.newId);
let sv=C.saveKpi(tA,FY,{id:k2.newId,owner:'ทดสอบซ้ำ',baseRev:fresh.rev});assert(!sv.success&&/มีหลายคน/.test(sv.message)&&sv.message.includes('ทดสอบซ้ำ ใจดี')&&sv.message.includes('ทดสอบซ้ำ แถวบุญตา'),JSON.stringify(sv));
assert.strictEqual(row(k2.newId)[25],'ทดสอบซ้ำ แถวบุญตา','ไม่เขียนเมื่อกำกวม');
sv=C.saveKpi(tA,FY,{id:k2.newId,owner:'ทดสอบซ้ำ แถวบุญตา / ทดสอบเดี่ยว',baseRev:fresh.rev});assert(sv.success,JSON.stringify(sv));
// ไม่ได้แก้ช่องผู้รับผิดชอบ (ข้อความเดิมเป็นชื่อกำกวมอยู่แล้ว) → บันทึกอย่างอื่นได้
row(k4.newId)[25]='ทดสอบซ้ำ';let f4=C.getAllData(tA,FY).data.find(k=>k.id===k4.newId);
sv=C.saveKpi(tA,FY,{id:k4.newId,owner:'ทดสอบซ้ำ',target:'≥ 5',baseRev:f4.rev});assert(sv.success,'owner unchanged → not checked: '+JSON.stringify(sv));
// เพิ่มตัวชี้วัดใหม่
let ad=C.addIndicator(tA,FY,item('ตัวชี้วัดทดสอบ 5','ทดสอบซ้ำ','OPD'));assert(!ad.success&&/มีหลายคน/.test(ad.message),JSON.stringify(ad));
ad=C.addIndicator(tA,FY,item('ตัวชี้วัดทดสอบ 5','ทดสอบซ้ำ ใจดี','OPD'));assert(ad.success,JSON.stringify(ad));

// ---- สร้างบัญชีจากผู้รับผิดชอบ: ไม่สร้างบัญชีชื่อต้นที่กำกวม
const users=C.readUsers_(h.sheets.Users?C.getUsersSpreadsheet_().getSheetByName('Users'):null);
const made=C.buildAccountsFromOwners_(users);
assert(!made.some(u=>u.username==='ทดสอบซ้ำ'),'ไม่สร้างบัญชี "ทดสอบซ้ำ" กลับมา');
console.log('UNAME1 OK');
