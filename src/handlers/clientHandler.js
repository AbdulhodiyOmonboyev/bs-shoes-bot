const { Markup } = require('telegraf');
const db = require('../database');
const { getClientKeyboard, getCancelKeyboard } = require('../keyboards');
const { setSession, getSession, clearSession } = require('../utils/session');
const { formatMoney } = require('../utils/helpers');
const { notifyAllAdmins } = require('../services/notificationService');

function registerClientHandlers(bot) {
  function getClient(ctx) {
    return db.getClientByTelegramId(ctx.from.id);
  }

  // 1. My orders & debt
  bot.hears('📦 Mening buyurtmalarim', async (ctx) => {
    const client = getClient(ctx);
    if (!client) return;
    clearSession(ctx.from.id);

    const summary = db.getClientFinancialSummary(client.id);
    const orders = db.getClientOrders(client.id);

    let text = `📦 <b>Hurmatli ${client.name}, sizning hisobingiz:</b>\n\n`;
    text += `📦 <b>Jami xarid qilingan pochkalar:</b> ${summary.total_packs} ta\n`;
    text += `💰 <b>Jami xarid summasi:</b> ${formatMoney(summary.total_bought)}\n`;
    text += `💵 <b>To'langan summa:</b> ${formatMoney(summary.total_paid)}\n`;
    text += `⚠️ <b>Qoldiq qarzingiz:</b> <b>${formatMoney(summary.total_debt)}</b>\n\n`;

    if (orders.length > 0) {
      text += `📜 <b>Xaridlar tarixi:</b>\n`;
      orders.forEach((o, i) => {
        text += `${i + 1}. <b>${o.product_name}</b> - ${o.packs_quantity} pochka (${formatMoney(o.total_amount)})\n   📅 ${o.created_at.slice(0, 10)} | Qarz: ${formatMoney(o.debt_amount)}\n`;
      });
    }

    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 2. Message factory boss
  bot.hears('✉️ Sex rahbariga yozish', async (ctx) => {
    const client = getClient(ctx);
    if (!client) return;
    clearSession(ctx.from.id);

    setSession(ctx.from.id, { step: 'client_send_msg_to_admin' });
    return ctx.reply(
      '✉️ <b>Sex rahbariga xabar yozish:</b>\n\nSavolingiz yoki buyurtmangiz haqida yozib qoldiring. Rahbarimiz sizga tez orada javob beradi:',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // 3. Contact info
  bot.hears('📞 Aloqa', async (ctx) => {
    return ctx.reply(
      '🏭 <b>BS-SHOES Poyabzal Ishlab Chiqarish Korxonasi</b>\n\n' +
      '📞 Aloqa uchun telefon: +998 90 123 45 67\n' +
      '📍 Manzil: Toshkent shahar\n' +
      '⏰ Ish vaqti: 09:00 - 18:00\n\n' +
      'Biz bilan hamkorlik qilayotganingizdan mamnunmiz!',
      { parse_mode: 'HTML' }
    );
  });
}

module.exports = {
  registerClientHandlers
};
