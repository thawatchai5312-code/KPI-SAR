/**
 * ระบบสอนการใช้งาน (Guided Tour) ฝั่งเซิร์ฟเวอร์: จำว่าบัญชีไหนกด "ไม่ต้องแสดงอีก" ที่ป๊อปอัปต้อนรับ
 * เก็บใน Script Properties ต่อชื่อผู้ใช้ (ข้ามเครื่องได้) — ตัวการสอนเองทำงานบนหน้าเว็บทั้งหมด ไม่แตะข้อมูลตัวชี้วัด
 */
var TOUR_HIDE_PREFIX = "TOUR_HIDE_V1:";

function getTourPrefs(token) {
  try {
    var user = requireUser_(token);
    var raw = PropertiesService.getScriptProperties().getProperty(TOUR_HIDE_PREFIX + user.username);
    return { success: true, hide: raw === "1" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/** hide = true: ไม่ขึ้นป๊อปอัปต้อนรับอีก · false: กลับมาขึ้นตามเดิม */
function saveTourPrefs(token, hide) {
  try {
    var user = requireUser_(token);
    var props = PropertiesService.getScriptProperties();
    if (hide) props.setProperty(TOUR_HIDE_PREFIX + user.username, "1");
    else props.deleteProperty(TOUR_HIDE_PREFIX + user.username);
    return { success: true, hide: !!hide };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
