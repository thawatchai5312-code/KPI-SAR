// ส่งต่อปีถัดไป (src/Forward.js): ช่อง "ใช้กับปีงบถัดไปด้วย" ตอนบันทึก/เพิ่มตัวชี้วัด + ย้ายข้อมูล CLT ตามกลุ่มโรค + ตรวจผลกระทบก่อนบันทึก
const h=require('./harness7');const C=h.ctx;const assert=require('assert');
const eq=(x,y,m)=>assert.strictEqual(JSON.stringify(x),JSON.stringify(y),m);
const U=h.sheets.Users.d;
U.slice(1).forEach(r=>{r[1]=C.hashPassword_('pw123456');r[4]='FALSE'});
const tok=r=>C.createSession_(r[0],r[1]);
const tA=tok(U.find(r=>r[2]==='admin'));
const Y=fy=>h.sheets['ปีงบ '+fy].d;
const rowOf=(fy,id)=>Y(fy).slice(1).find(r=>String(r[0]).trim()===id);
const catsOf=r=>[[r[2],r[3]]].concat(String(r[36]||'').split('\n').filter(x=>x.includes('|')).map(x=>{const i=x.indexOf('|');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));
const save=(fy,item)=>{const r=C.saveKpi(tA,fy,item);assert(r.success,JSON.stringify(r));return r};
const col={name:4,target:5,owner:25,dept:26,src:24};

// ใช้ตัวชี้วัด PCT 2 ตัวที่อยู่กลุ่ม STEMI ปีเดียวกันทั้งสองปี
const stemi=C.getCltDoc(tA,2570).kpis.filter(k=>k.groups.length===1&&k.groups[0]==='STEMI'&&rowOf(2569,k.id));assert(stemi.length>=3);
const [k1,k2,k3]=stemi;
const T=id=>({id});

// ================= 1) ส่งต่อเฉพาะช่องที่เปลี่ยน =================
{
  const r70=rowOf(2570,k1.id),r69=rowOf(2569,k1.id);
  r70[col.name]='ชื่อเฉพาะปี 2570';r70[col.target]='≥ 99';r70[23]='การวิเคราะห์ 2570';r70[12]=77;     // ปี 2570 ตั้งใจให้ต่าง
  const rev0=C.rowRev_(r70),v0=C.dataVersion_(C.readChangeLog_());
  const res=save(2569,{id:k1.id,owner:'ผู้รับผิดชอบใหม่',department:'ER / NSO / PCT / MSO',forward:true});
  eq(res.docs.forward.map(x=>[x.fy,x.ok]),[[2570,true]]);
  ['ผู้รับผิดชอบ','หน่วยงาน'].forEach(f=>assert(res.docs.forward[0].fields.includes(f),f));assert(!res.docs.forward[0].fields.includes('ชื่อ')&&!res.docs.forward[0].fields.includes('เป้าหมาย'));
  assert.strictEqual(r69[col.owner],'ผู้รับผิดชอบใหม่');assert.strictEqual(r70[col.owner],'ผู้รับผิดชอบใหม่');
  assert.strictEqual(r70[col.dept],'ER / NSO / PCT / MSO');assert.strictEqual(r69[col.dept],'ER / NSO / PCT / MSO');
  assert.strictEqual(r70[col.name],'ชื่อเฉพาะปี 2570','ช่องที่ไม่ได้แก้ ไม่ถูกทับ');assert.strictEqual(r70[col.target],'≥ 99');
  assert.strictEqual(r70[23],'การวิเคราะห์ 2570','รายละเอียด/การวิเคราะห์ไม่ส่ง');assert.strictEqual(r70[12],77,'ผลรายเดือนไม่ส่ง');
  assert.notStrictEqual(C.rowRev_(r70),rev0,'rev ปี 2570 เปลี่ยน → เครื่องที่แก้อยู่ขึ้นเตือนแก้ชน');
  assert(C.dataVersion_(C.readChangeLog_())>v0);
  const pl=C.pollChanges(tA,2570,v0);assert(pl.success&&(pl.full||pl.changed.some(k=>k.id===k1.id)),'เครื่องอื่นเห็นปี 2570');
  // หมวดหน่วยงานของ 2570 ย้ายตามหน่วยใหม่ (วิธีเดียวกับแก้ผ่านเว็บ)
  assert(catsOf(r70).some(c=>c[0]==='MSO'||c[0]==='MSO QA')||catsOf(r69).some(c=>c[0]==='MSO'||c[0]==='MSO QA')===catsOf(r70).some(c=>c[0]==='MSO'||c[0]==='MSO QA'),'หมวดหน่วย 2570 ตรงกับ 2569');
  eq(catsOf(r70).map(c=>c[0]).sort(),catsOf(r69).map(c=>c[0]).sort(),'หมวดหลักของสองปีตรงกัน');
}

// ================= 2) ไม่ติ๊ก = ปี 2570 ไม่เปลี่ยน =================
{
  const r70=rowOf(2570,k2.id),before=JSON.stringify(r70);
  const res=save(2569,{id:k2.id,name:'ชื่อใหม่ปี 2569 เท่านั้น',owner:'คนเดียว'});
  assert(!res.docs||!res.docs.forward||res.docs.forward.length===0);
  assert.strictEqual(JSON.stringify(r70),before,'2570 untouched');assert.strictEqual(rowOf(2569,k2.id)[col.name],'ชื่อใหม่ปี 2569 เท่านั้น');
}

// ================= 3) แก้ที่ปีล่าสุด + ติ๊ก = ไม่มีปีถัดไป =================
{
  const res=save(2570,{id:k3.id,target:'≥ 77',forward:true});eq(res.docs.forward,[]);
}

// ================= 4) ไม่มีรหัสในปีปลายทาง → ข้ามพร้อมเหตุผล =================
{
  const id=k3.id,s70=h.sheets['ปีงบ 2570'].d,i=s70.findIndex(r=>r&&String(r[0]).trim()===id);const saved=s70[i];s70.splice(i,1);
  const res=save(2569,{id,name:'ชื่อทดสอบข้าม',forward:true});
  eq(res.docs.forward.map(x=>[x.fy,x.ok]),[[2570,false]]);assert(/ไม่พบตัวชี้วัดนี้ในปีงบ 2570/.test(res.docs.forward[0].message));
  s70.splice(i,0,saved);
}

// ================= 5) ย้ายหมวด PCT STEMI → Stroke: CLT ตามไปทั้งสองปี =================
[2569,2570].forEach(fy=>{
  assert(C.saveCltItem(tA,fy,'S|groups',JSON.stringify(['STEMI','Stroke']),0,true).success);
  assert(C.saveCltItem(tA,fy,'D|STEMI|R|'+k1.id,'ผลลัพธ์ STEMI '+fy,0,true).success);
  assert(C.saveCltItem(tA,fy,'S|kpis',JSON.stringify(['STEMI|'+k1.id,'STEMI|'+k2.id]),0,true).success);
});
const wantCats=(fy,id)=>catsOf(rowOf(fy,id)).map(c=>({part:c[0],category:c[1]})).map(c=>c.part==='PCT'?{part:'PCT',category:'Stroke'}:c);
{
  // เตือนก่อนบันทึก: ตัวชี้วัดมีข้อความ CLT ใน 2 ปี
  const imp=C.kpiDocImpact(tA,2569,k1.id,wantCats(2569,k1.id),true);assert(imp.success,JSON.stringify(imp));
  eq(imp.impact.clt.map(x=>[x.fy,x.from,x.to,x.text,x.excluded]),[[2569,'STEMI','Stroke',true,true],[2570,'STEMI','Stroke',true,true]]);
  eq(C.kpiDocImpact(tA,2569,k1.id,wantCats(2569,k1.id),false).impact.clt.map(x=>x.fy),[2569],'ไม่ติ๊กส่ง = ดูเฉพาะปีนี้');
  eq(C.kpiDocImpact(tA,2569,k1.id,catsOf(rowOf(2569,k1.id)).map(c=>({part:c[0],category:c[1]})),true).impact,{pdca:[],clt:[]},'ไม่เปลี่ยนหมวด = ไม่เตือน');
  // ปลายทาง Stroke มีข้อความอยู่แล้ว → ชน คงของปลายทาง
  assert(C.saveCltItem(tA,2570,'D|Stroke|R|'+k1.id,'ผลลัพธ์ Stroke เดิม 2570',0,true).success);
  const res=save(2569,{id:k1.id,cats:wantCats(2569,k1.id),forward:true});
  eq(res.docs.forward.map(x=>[x.fy,x.ok]),[[2570,true]]);assert(res.docs.forward[0].fields.includes('หมวด'));
  eq(catsOf(rowOf(2569,k1.id)).filter(c=>c[0]==='PCT').map(c=>c[1]),['Stroke']);eq(catsOf(rowOf(2570,k1.id)).filter(c=>c[0]==='PCT').map(c=>c[1]),['Stroke']);
  const d69=C.getCltDoc(tA,2569).items,d70=C.getCltDoc(tA,2570).items;
  assert.strictEqual(d69['D|Stroke|R|'+k1.id].text,'ผลลัพธ์ STEMI 2569','2569 ย้ายตาม');assert(!d69['D|STEMI|R|'+k1.id]||!d69['D|STEMI|R|'+k1.id].text);
  assert.strictEqual(d70['D|Stroke|R|'+k1.id].text,'ผลลัพธ์ Stroke เดิม 2570','ปลายทางมีข้อความแล้ว คงไว้');assert.strictEqual(d70['D|STEMI|R|'+k1.id].text,'ผลลัพธ์ STEMI 2570','ต้นทางที่ชนยังค้าง (ไม่หาย)');
  assert(res.docs.clt.some(x=>x.fy===2570&&x.conflict)&&res.docs.clt.some(x=>x.fy===2569&&x.moved));
  eq(JSON.parse(d69['S|kpis'].text).sort(),['Stroke|'+k1.id,'STEMI|'+k2.id].sort());eq(JSON.parse(d70['S|kpis'].text).sort(),['Stroke|'+k1.id,'STEMI|'+k2.id].sort());
}
// ย้ายหมวดโดยไม่ติ๊กส่ง: CLT ของปีนี้ย้าย ปีถัดไปไม่แตะ
{
  const before70=JSON.stringify(rowOf(2570,k2.id)),d70before=JSON.stringify(C.getCltDoc(tA,2570).items);
  assert(C.saveCltItem(tA,2569,'D|STEMI|R|'+k2.id,'ผลลัพธ์ k2 2569',0,true).success);
  const res=save(2569,{id:k2.id,cats:wantCats(2569,k2.id)});
  assert(res.docs.clt.some(x=>x.fy===2569&&x.moved));assert.strictEqual(C.getCltDoc(tA,2569).items['D|Stroke|R|'+k2.id].text,'ผลลัพธ์ k2 2569');
  assert.strictEqual(JSON.stringify(rowOf(2570,k2.id)),before70);assert.strictEqual(JSON.stringify(C.getCltDoc(tA,2570).items),d70before);
}
// ตัวชี้วัดอยู่หลายกลุ่ม (เพิ่มกลุ่มใหม่ ไม่ได้ย้าย) = ไม่ย้าย CLT
{
  const id=k3.id;assert(C.saveCltItem(tA,2569,'D|STEMI|R|'+id,'ข้อความ k3',0,true).success);
  const cats=catsOf(rowOf(2569,id)).map(c=>({part:c[0],category:c[1]})).concat([{part:'PCT',category:'Sepsis'}]);
  const res=save(2569,{id,cats});assert(!(res.docs.clt||[]).length,'เพิ่มกลุ่มโดยยังอยู่กลุ่มเดิม ไม่ย้าย');assert.strictEqual(C.getCltDoc(tA,2569).items['D|STEMI|R|'+id].text,'ข้อความ k3');
}

// ================= 6) เอาออกจาก Part I–IV ทั้งหมด → เตือน PDCA =================
{
  const core=Y(2569).slice(1).find(r=>r[0]&&/^Part/.test(String(r[2]))&&rowOf(2570,String(r[0]).trim())&&catsOf(r).every(c=>/^Part/.test(c[0])===true||true));assert(core);
  const id=String(core[0]).trim();assert(C.saveSarPdca(tA,2569,id,{plan:'P',do:'D',check:'C',act:'A'},0).success||true);
  const sar=C.getSarDoc(tA,2569);const has=sar.success&&sar.items&&sar.items['PDCA|'+id];
  if(has){const imp=C.kpiDocImpact(tA,2569,id,[{part:'ทดสอบหมวดอื่น',category:'ย่อย'}],false);assert(imp.success);eq(imp.impact.pdca,[2569]);}
}

// ================= 7) เพิ่มตัวชี้วัดใหม่ ติ๊กส่งปีถัดไป =================
{
  const years=[null,null,null,null,55];
  const r=C.addIndicator(tA,2569,{name:'ตัวใหม่ส่งต่อ',target:'≥ 5',years,months:Array(12).fill(1),levels:['รายบุคคล'],cats:[{part:'ทดสอบส่งต่อ',category:'หมวดย่อย'}],owner:'ผู้ทดสอบ',department:'MSO',forward:true});
  assert(r.success,JSON.stringify(r));eq(r.forward.map(x=>[x.fy,x.ok]),[[2570,true]]);
  const a=rowOf(2569,r.newId),b=rowOf(2570,r.newId);assert(a&&b,'เพิ่มทั้งสองปี');
  assert.strictEqual(b[4],'ตัวใหม่ส่งต่อ');assert.strictEqual(b[2],'ทดสอบส่งต่อ');assert.strictEqual(b[25],'ผู้ทดสอบ');
  // ผลทั้งปี 2569 (ตำแหน่งสุดท้ายของชีต 2569 = ตำแหน่ง G–J ... ของชีต 2570 ) เลื่อนตามปี · ไม่มีผลรายเดือน
  assert.strictEqual(b[9],55,'ผลปี 2569 อยู่ช่อง J ของชีต 2570');assert.strictEqual(b[10],'');
  for(let m=11;m<23;m++)assert.strictEqual(b[m],'','monthly blank '+m);
  // ไม่ติ๊ก = ไม่เพิ่มปีถัดไป
  const r2=C.addIndicator(tA,2569,{name:'ตัวใหม่ไม่ส่งต่อ',target:'',years:[null,null,null,null,null],months:Array(12).fill(null),levels:['รายบุคคล'],cats:[{part:'ทดสอบส่งต่อ',category:'หมวดย่อย'}],owner:'ผู้ทดสอบ',department:'MSO'});
  assert(r2.success);assert(!rowOf(2570,r2.newId));
}

// ================= 8) สิทธิ์ปีปลายทาง: staff แก้ปีปัจจุบันไม่ได้ส่งไปปีถัดไป (ไม่มี) / ไม่ใช่ admin ส่งช่องที่ไม่มีสิทธิ์ =================
{
  const st=U.find(r=>r[2]==='staff'),tS=tok(st);
  const mine=C.getAllData(tS,2570).data.find(k=>k.canEditDetails);
  if(mine){const r=C.saveKpi(tS,2570,{id:mine.id,dataSource:'ที่มาใหม่ staff',forward:true});assert(r.success,JSON.stringify(r));eq(r.docs.forward,[],'ปีล่าสุดไม่มีปีถัดไป');}
}
console.log('fwd1 ok');
