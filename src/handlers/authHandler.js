const db = require('../database');
const { getAdminKeyboard, getWorkerKeyboard, getClientKeyboard } = require('../keyboards');
const { setSession, getSession, clearSession } = require('../utils/session');

function registerAuthHandlers(bot) {
  // /admin or /login command
  bot.command(['admin', 'login'], async (ctx) => {
    const admin = db.getAdminByTelegramId(ctx.from.id);
    if (admin) {
      const name = admin.full_name || ctx.from.first_name || 'Admin';
      return ctx.reply(
        `👨‍💼 Assalomu alaykum, ${name}!\n\n🏭 Ishlab chiqarish boshqaruv paneli\n🔑 Rol: Super Admin\n_______________________\n\n📌 Quyidagi bo'limlardan birini tanlang:`,
        getAdminKeyboard()
      );
    }

    setSession(ctx.from.id, { step: 'awaiting_admin_login' });
    return ctx.reply(
      '🔐 <b>Ishlab chiqarish boshqaruv paneli</b>\n\nIltimos, admin <b>loginini</b> kiriting:',
      { parse_mode: 'HTML' }
    );
  });

  // /logout command
  bot.command('logout', async (ctx) => {
    const admin = db.getAdminByTelegramId(ctx.from.id);
    if (admin) {
      db.getDb().prepare(`DELETE FROM admins WHERE telegram_id = ?`).run(ctx.from.id);
      clearSession(ctx.from.id);
      return ctx.reply(
        '🚪 Admin tizimidan chiqdingiz. Qayta kirish uchun /admin buyrug\'ini yuboring.',
        { reply_markup: { remove_keyboard: true } }
      );
    }
    clearSession(ctx.from.id);
    return ctx.reply('Sessiya yakunlandi.', { reply_markup: { remove_keyboard: true } });
  });

  // /unsleep command
  bot.command('unsleep', async (ctx) => {
    const { getUnsleepStats } = require('../server');
    const { formatDuration } = require('../utils/helpers');
    const stats = getUnsleepStats();
    const uptime = formatDuration(Math.floor(process.uptime() / 60));
    let text = `⚡️ <b>Unsleep (Anti-Sleep) Holati:</b>\n\n`;
    text += `🟢 <b>Holati:</b> FAOL (Doimiy uyg'oq)\n`;
    text += `⏱ <b>Interval:</b> Har <b>${stats.intervalSeconds} soniyada (1.5 minut)</b>\n`;
    text += `🌐 <b>Server URL:</b> <code>${stats.externalUrl || 'Aniqlanmoqda'}</code>\n`;
    text += `📊 <b>Jami yuborilgan so'rovlar:</b> ${stats.totalPings} ta\n`;
    text += `✅ <b>Muvaffaqiyatli uyg'otishlar:</b> ${stats.successfulPings} ta\n`;
    text += `🕒 <b>So'nggi so'rov vaqti:</b> ${stats.lastPingAt || '-'}\n`;
    text += `⏳ <b>Bot ish vaqti:</b> ${uptime}\n\n`;
    text += `<i>Render serveringiz har 90 soniyada avtomatik so'rovlar bilan uyg'otib turiladi va hech qachon o'chib qolmaydi!</i>`;
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // /start command
  bot.command('start', async (ctx) => {
    clearSession(ctx.from.id);
    const tgId = ctx.from.id;

    // 1. Check if admin
    const admin = db.getAdminByTelegramId(tgId);
    if (admin) {
      const name = admin.full_name || ctx.from.first_name || 'Admin';
      return ctx.reply(
        `👨‍💼 Assalomu alaykum, ${name}!\n\n🏭 Ishlab chiqarish boshqaruv paneli\n🔑 Rol: Super Admin\n_______________________\n\n📌 Quyidagi bo'limlardan birini tanlang:`,
        getAdminKeyboard()
      );
    }

    // 2. Check if worker
    const worker = db.getWorkerByTelegramId(tgId);
    if (worker) {
      const roleText = worker.role === 'student' ? "Maktab o'quvchisi 🎒" : "Oddiy ishchi 👷‍♂️";
      return ctx.reply(
        `👋 Assalomu alaykum, <b>${worker.full_name}</b>!\n\n🏭 BS-SHOES Ishlab chiqarish tizimi\n📌 Roli: ${roleText}\n⏰ Ish boshlanishi: ${worker.work_start_time}\n💰 Joriy hisob: ${worker.balance} so'm\n\nQuyidagi amallardan birini tanlang:`,
        { parse_mode: 'HTML', ...getWorkerKeyboard() }
      );
    }

    // 3. Check if client
    const client = db.getClientByTelegramId(tgId);
    if (client) {
      return ctx.reply(
        `👋 Assalomu alaykum, hurmatli <b>${client.name}</b>!\n\n🏭 BS-SHOES Mijozlar bo'limi\n\nQuyidagi menyu orqali buyurtmalaringizni ko'rishingiz yoki sex rahbari bilan bog'lanishingiz mumkin:`,
        { parse_mode: 'HTML', ...getClientKeyboard() }
      );
    }

    // 4. Unregistered user
    return ctx.reply(
      `👋 Assalomu alaykum, <b>${ctx.from.first_name}</b>!\n\n` +
      `🏭 <b>BS-SHOES Ishlab chiqarish sex botiga xush kelibsiz!</b>\n\n` +
      `Siz hali tizimda ro'yxatdan o'tmagansiz. Agar siz sex ishchisi bo'lsangiz, profilingizni faollashtirish uchun pastdagi tugmani bosing va telefon raqamingizni yuboring.\n\n` +
      `<i>(Agar siz sex rahbari bo'lsangiz, kirish uchun /admin buyrug'ini yuboring)</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '📱 Telefon raqamni yuborish', request_contact: true }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
  });

  // Handle contact sharing for worker / client matching
  bot.on('contact', async (ctx) => {
    const contact = ctx.message.contact;
    if (!contact || contact.user_id !== ctx.from.id) {
      return ctx.reply('⚠️ Iltimos, o\'zingizning shaxsiy telefon raqamingizni yuboring.');
    }

    const phone = contact.phone_number;
    const worker = db.getWorkerByPhone(phone);

    if (worker) {
      db.updateWorker(worker.id, { telegramId: ctx.from.id });
      const roleText = worker.role === 'student' ? "Maktab o'quvchisi 🎒" : "Oddiy ishchi 👷‍♂️";
      return ctx.reply(
        `✅ <b>Tabriklaymiz!</b> Siz tizimda muvaffaqiyatli aniqlandingiz.\n\n` +
        `👤 Ism: <b>${worker.full_name}</b>\n` +
        `📌 Rol: <b>${roleText}</b>\n` +
        `⏰ Ish boshlanish vaqtingiz: <b>${worker.work_start_time}</b>\n\n` +
        `Endi bot orqali davomat qilish va qilgan ishlaringizni topshirishingiz mumkin!`,
        { parse_mode: 'HTML', ...getWorkerKeyboard() }
      );
    }

    // Check if client
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const client = db.getDb().prepare(`SELECT * FROM clients WHERE phone LIKE ? OR phone LIKE ?`).get(`%${cleanPhone}%`, `%${cleanPhone.slice(-9)}%`);
    if (client) {
      db.updateClient(client.id, { telegramId: ctx.from.id });
      return ctx.reply(
        `✅ Assalomu alaykum, <b>${client.name}</b>! Siz mijoz sifatida tizimga ulandingiz.`,
        { parse_mode: 'HTML', ...getClientKeyboard() }
      );
    }

    return ctx.reply(
      `⚠️ <b>${phone}</b> raqami tizimda topilmadi.\n\n` +
      `Sex rahbari sizni ishchilar ro'yxatiga qo'shganidan so'ng qayta /start bosing yoki rahbar bilan bog'laning.\n` +
      `Agar siz sex rahbari bo'lsangiz, /admin buyrug'i orqali kiring.`,
      { parse_mode: 'HTML' }
    );
  });
}

module.exports = {
  registerAuthHandlers
};
