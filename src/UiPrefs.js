// ตัวเลือกการแสดงผลหน้าแรกต่อบัญชี: มุมมอง การ์ด/ตาราง และกลุ่มคอลัมน์ของตารางที่ซ่อนไว้ (เก็บใน Script Properties)
var UI_PREFS_PREFIX = "UI_PREFS_V1:";
var UI_MODES = ["card", "table"];
var UI_HIDE_GROUPS = ["annual", "monthly", "settings", "text", "people", "cats", "history"];

function getUiPrefs(token) {
  try {
    var user = requireUser_(token);
    var raw = PropertiesService.getScriptProperties().getProperty(UI_PREFS_PREFIX + user.username);
    return { success: true, prefs: raw ? JSON.parse(raw) : null };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function saveUiPrefs(token, prefs) {
  try {
    var user = requireUser_(token);
    var p = prefs || {};
    var clean = {
      mode: UI_MODES.indexOf(p.mode) !== -1 ? p.mode : "table",
      hide: (Array.isArray(p.hide) ? p.hide : []).filter(function(g, i, a) { return UI_HIDE_GROUPS.indexOf(g) !== -1 && a.indexOf(g) === i; })
    };
    PropertiesService.getScriptProperties().setProperty(UI_PREFS_PREFIX + user.username, JSON.stringify(clean));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
