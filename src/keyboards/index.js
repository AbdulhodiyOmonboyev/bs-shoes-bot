const { Markup } = require('telegraf');

/**
 * Super Admin / Sex Rahbari Main Keyboard
 * (Exactly matches user screenshot)
 */
function getAdminKeyboard() {
  return Markup.keyboard([
    ['👥 Ishchilar boshqaruvi', "⚙️ Narxlar va Bo'limlar"],
    ['⏱ Davomat va Nazorat', '📥 Tasdiqlash qutisi'],
    ['📊 Hisobotlar', "✉️ E'lon va Topshiriqlar"],
    ['💸 Avans berish', '⚠️ Jarima berish'],
    ['👨‍💼 Clientlar', '💰 Pul va haftalik'],
    ["🔧 Qo'shimcha sozlamalar"]
  ]).resize();
}

/**
 * Worker Main Keyboard
 */
function getWorkerKeyboard() {
  return Markup.keyboard([
    ['🟢 Ishga keldim', '🔴 Ishni tugatdim'],
    ['📥 Ish topshirish', '💰 Mening hisobim'],
    ['⏱ Davomatim', '💸 Avans so\'rash']
  ]).resize();
}

/**
 * Worker Check-in with location Keyboard
 */
function getWorkerCheckInKeyboard() {
  return Markup.keyboard([
    [Markup.button.locationRequest('📍 Lokatsiyamni yuborish')],
    ['❌ Bekor qilish']
  ]).resize();
}

/**
 * Client Main Keyboard
 */
function getClientKeyboard() {
  return Markup.keyboard([
    ['📦 Mening buyurtmalarim', '✉️ Sex rahbariga yozish'],
    ['📞 Aloqa']
  ]).resize();
}

/**
 * Back / Cancel Keyboard
 */
function getCancelKeyboard() {
  return Markup.keyboard([
    ['❌ Bekor qilish']
  ]).resize();
}

/**
 * Inline button for back
 */
function backInline(callbackData = 'admin_home') {
  return [Markup.button.callback('⬅️ Orqaga', callbackData)];
}

module.exports = {
  getAdminKeyboard,
  getWorkerKeyboard,
  getWorkerCheckInKeyboard,
  getClientKeyboard,
  getCancelKeyboard,
  backInline
};
