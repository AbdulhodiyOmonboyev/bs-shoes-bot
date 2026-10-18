const { Markup } = require('telegraf');
const db = require('../database');
const { getAdminKeyboard, getWorkerKeyboard, getClientKeyboard, getCancelKeyboard } = require('../keyboards');
const { getSession, setSession, clearSession, updateSession } = require('../utils/session');
const { formatMoney, formatDuration } = require('../utils/helpers');
const {
  notifyAllAdmins,
  notifyWorker,
  notifyClient,
  broadcastToWorkers
} = require('../services/notificationService');

function registerWizardHandlers(bot) {
  // Global text listener for interactive wizards
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return next();

    // Ignore keyboard button clicks
    const knownButtons = [
      '👥 Ishchilar boshqaruvi', "⚙️ Narxlar va Bo'limlar",
      '⏱ Davomat va Nazorat', '📥 Tasdiqlash qutisi',
      '📊 Hisobotlar', "✉️ E'lon va Topshiriqlar",
      '💸 Avans berish', '⚠️ Jarima berish',
      '👨‍💼 Clientlar', '💰 Pul va haftalik',
      "🔧 Qo'shimcha sozlamalar",
      '🟢 Ishga keldim', '🔴 Ishni tugatdim',
      '📥 Ish topshirish', '💰 Mening hisobim',
      '⏱ Davomatim', "💸 Avans so'rash",
      '📦 Mening buyurtmalarim', '✉️ Sex rahbariga yozish',
      '📞 Aloqa', '❌ Bekor qilish'
    ];
    if (knownButtons.includes(text)) return next();

    const session = getSession(ctx.from.id);
    if (!session || !session.step) return next();

    try {
      // ---------------------------------------------------------
      // AUTH: ADMIN LOGIN & PASSWORD
      // ---------------------------------------------------------
      if (session.step === 'awaiting_admin_login') {
        updateSession(ctx.from.id, { step: 'awaiting_admin_password', inputLogin: text });
        return ctx.reply('🔑 Endi maxfiy <b>parolni</b> kiriting:', { parse_mode: 'HTML' });
      }

      if (session.step === 'awaiting_admin_password') {
        const expectedLogin = db.getSetting('admin_login') || 'admin';
        const expectedPassword = db.getSetting('admin_password') || 'admin777';

        if (session.inputLogin === expectedLogin && text === expectedPassword) {
          db.addAdmin(ctx.from.id, ctx.from.first_name || 'Admin', ctx.from.username || '', 'super_admin');
          clearSession(ctx.from.id);
          return ctx.reply(
            `👨‍💼 Assalomu alaykum, ${ctx.from.first_name}!\n\n🏭 Ishlab chiqarish boshqaruv paneli\n🔑 Rol: Super Admin\n_______________________\n\n📌 Quyidagi bo'limlardan birini tanlang:`,
            getAdminKeyboard()
          );
        } else {
          clearSession(ctx.from.id);
          return ctx.reply('❌ <b>Login yoki parol noto\'g\'ri!</b>\nQayta urinish uchun /admin buyrug\'ini yuboring.', { parse_mode: 'HTML' });
        }
      }

      // ---------------------------------------------------------
      // ISHCHI QO'SHISH (Add Worker)
      // ---------------------------------------------------------
      if (session.step === 'add_worker_name') {
        updateSession(ctx.from.id, { step: 'add_worker_role', fullName: text });
        return ctx.reply(
          `👤 Ishchi: <b>${text}</b>\n\nIshchining rolini tanlang:`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [Markup.button.callback('👷‍♂️ Oddiy ishchi (09:00)', 'worker_role_worker')],
                [Markup.button.callback('🎒 Maktab o\'quvchisi (13:00)', 'worker_role_student')]
              ]
            }
          }
        );
      }

      if (session.step === 'add_worker_phone') {
        const phone = text;
        const role = session.role || 'worker';
        const fullName = session.fullName;

        const workerId = db.createWorker({
          fullName,
          phone,
          role
        });

        clearSession(ctx.from.id);
        const roleText = role === 'student' ? 'Maktab o\'quvchisi 🎒 (13:00)' : 'Oddiy ishchi 👷‍♂️ (09:00)';
        return ctx.reply(
          `✅ <b>Yangi ishchi muvaffaqiyatli qo'shildi!</b>\n\n` +
          `👤 Ism: <b>${fullName}</b>\n` +
          `📌 Rol: <b>${roleText}</b>\n` +
          `📞 Telefon: <b>${phone}</b>\n\n` +
          `Ishchi botga kirib o'z telefon raqamini yuborsa, tizim avtomatik ravishda uni taniydi!`,
          { parse_mode: 'HTML', ...getAdminKeyboard() }
        );
      }

      if (session.step === 'edit_worker_time') {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(text)) {
          return ctx.reply('⚠️ Noto\'g\'ri vaqt formati! Masalan: <b>09:00</b> yoki <b>13:30</b> shaklida kiriting:', { parse_mode: 'HTML' });
        }
        db.updateWorker(session.workerId, { workStartTime: text });
        clearSession(ctx.from.id);
        return ctx.reply(`✅ Ishchining ish boshlanish vaqti <b>${text}</b> ga o'zgartirildi!`, { parse_mode: 'HTML', ...getAdminKeyboard() });
      }

      // ---------------------------------------------------------
      // ISH TURI QO'SHISH / TAHRIRLASH (Job Types)
      // ---------------------------------------------------------
      if (session.step === 'add_job_name') {
        updateSession(ctx.from.id, { step: 'add_job_price', jobName: text });
        return ctx.reply(
          `🛠 Ish turi: <b>${text}</b>\n\nUshbu ish uchun 1 birlik (juft) to'lanadigan narxni kiriting (Masalan: <b>2500</b>):`,
          { parse_mode: 'HTML', ...getCancelKeyboard() }
        );
      }

      if (session.step === 'add_job_price') {
        const price = Number(text.replace(/[^0-9]/g, ''));
        if (isNaN(price) || price <= 0) {
          return ctx.reply('⚠️ Iltimos, faqat musbat son kiriting (Masalan: 2500):');
        }
        db.createJobType(session.jobName, price, 'juft');
        clearSession(ctx.from.id);
        return ctx.reply(
          `✅ <b>Yangi ish turi qo'shildi!</b>\n\n🛠 Nomi: <b>${session.jobName}</b>\n💵 Narxi: <b>${formatMoney(price)} / 1 juft</b>`,
          { parse_mode: 'HTML', ...getAdminKeyboard() }
        );
      }

      if (session.step === 'edit_job_price') {
        const price = Number(text.replace(/[^0-9]/g, ''));
        if (isNaN(price) || price <= 0) {
          return ctx.reply('⚠️ Iltimos, to\'g\'ri narx kiriting (Masalan: 3000):');
        }
        db.updateJobType(session.jobId, { price });
        clearSession(ctx.from.id);
        return ctx.reply(`✅ Ish narxi <b>${formatMoney(price)}</b> ga yangilandi!`, { parse_mode: 'HTML', ...getAdminKeyboard() });
      }

      // ---------------------------------------------------------
      // TASDIQLASH QUTISI (Edit & Approve / Reject Submissions)
      // ---------------------------------------------------------
      if (session.step === 'edit_sub_quantity') {
        const newQty = Number(text.replace(/[^0-9.]/g, ''));
        if (isNaN(newQty) || newQty <= 0) {
          return ctx.reply('⚠️ Iltimos, to\'g\'ri son kiriting:');
        }
        const sub = db.editAndApproveSubmission(session.subId, ctx.from.id, newQty, `Rahbar tomonidan to'g'rilandi (${session.originalQty} dan ${newQty} ga)`);
        clearSession(ctx.from.id);

        await ctx.reply(
          `✅ <b>${sub.worker_name}</b>ning ishi <b>${newQty} ${sub.job_unit}</b> qilib tasdiqlandi!\n` +
          `💰 Ishchining hisobiga <b>+${formatMoney(sub.total_price)}</b> qo'shildi.`,
          { parse_mode: 'HTML', ...getAdminKeyboard() }
        );

        // Notify worker
        await notifyWorker(
          sub.worker_id,
          `⚠️ <b>Topshirgan ishingiz miqdori to'g'rilanib qabul qilindi:</b>\n\n` +
          `🛠 Ish turi: <b>${sub.job_name}</b>\n` +
          `🔢 Topshirganingiz: ${session.originalQty} ${sub.job_unit}\n` +
          `✅ Qabul qilingani: <b>${newQty} ${sub.job_unit}</b>\n` +
          `💰 Hisobingizga qo'shildi: <b>+${formatMoney(sub.total_price)}</b>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      if (session.step === 'reject_sub_reason') {
        const reason = text;
        const sub = db.rejectSubmission(session.subId, ctx.from.id, reason);
        clearSession(ctx.from.id);

        await ctx.reply(`❌ Ish rad etildi va ishchiga xabar jo'natildi.`, getAdminKeyboard());

        // Notify worker
        await notifyWorker(
          sub.worker_id,
          `❌ <b>Topshirgan ishingiz rad etildi!</b>\n\n` +
          `🛠 Ish turi: <b>${sub.job_name}</b> (${sub.quantity} ${sub.job_unit})\n` +
          `⚠️ Sabab: <i>${reason}</i>\n\n` +
          `Iltimos, ishni qayta tekshirib sex rahbariga murojaat qiling.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // ---------------------------------------------------------
      // E'LON VA TOPSHIRIQLAR
      // ---------------------------------------------------------
      if (session.step === 'broadcast_message') {
        const count = await broadcastToWorkers(
          `📢 <b>SEX RAHBARIDAN UMUMIY E'LON:</b>\n\n${text}`,
          { parse_mode: 'HTML' }
        );
        clearSession(ctx.from.id);
        return ctx.reply(`✅ E'lon <b>${count} ta ishchiga</b> muvaffaqiyatli yuborildi!`, { parse_mode: 'HTML', ...getAdminKeyboard() });
      }

      if (session.step === 'single_worker_msg') {
        const worker = db.getWorkerById(session.workerId);
        clearSession(ctx.from.id);
        if (worker && worker.telegram_id) {
          await notifyWorker(
            worker.id,
            `✉️ <b>SEX RAHBARIDAN SHAXSIY TOPSHIRIQ / XABAR:</b>\n\n${text}`,
            { parse_mode: 'HTML' }
          );
          return ctx.reply(`✅ Xabar <b>${worker.full_name}</b>ga yuborildi!`, { parse_mode: 'HTML', ...getAdminKeyboard() });
        } else {
          return ctx.reply(`⚠️ Ushbu ishchi hali Telegram botiga ulanmagan.`, getAdminKeyboard());
        }
      }

      // ---------------------------------------------------------
      // AVANS BERISH
      // ---------------------------------------------------------
      if (session.step === 'give_advance_amount') {
        const amount = Number(text.replace(/[^0-9]/g, ''));
        if (isNaN(amount) || amount <= 0) {
          return ctx.reply('⚠️ To\'g\'ri summa kiriting:');
        }
        updateSession(ctx.from.id, { step: 'give_advance_reason', amount });
        return ctx.reply('📝 Avans sababi yoki izohini yozing (Masalan: <i>Yo\'l kira uchun</i> yoki <i>Oylik hisobidan</i>):', { parse_mode: 'HTML' });
      }

      if (session.step === 'give_advance_reason') {
        const worker = db.getWorkerById(session.workerId);
        db.createAdvance(session.workerId, session.amount, text, 'given');
        clearSession(ctx.from.id);

        await ctx.reply(
          `✅ <b>${worker.full_name}</b>ga <b>${formatMoney(session.amount)}</b> avans berildi va balansi yangilandi.`,
          { parse_mode: 'HTML', ...getAdminKeyboard() }
        );

        // Notify worker
        await notifyWorker(
          worker.id,
          `💸 <b>Sizga avans berildi!</b>\n\n` +
          `💵 Summa: <b>${formatMoney(session.amount)}</b>\n` +
          `📝 Sabab: <i>${text}</i>\n` +
          `💰 Balansingizdan avtomatik chegirildi.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // ---------------------------------------------------------
      // JARIMA BERISH
      // ---------------------------------------------------------
      if (session.step === 'give_fine_amount') {
        const amount = Number(text.replace(/[^0-9]/g, ''));
        if (isNaN(amount) || amount <= 0) {
          return ctx.reply('⚠️ To\'g\'ri summa kiriting:');
        }
        updateSession(ctx.from.id, { step: 'give_fine_reason', amount });
        return ctx.reply('⚠️ Jarima berilish sababini yozing (Ishchiga ogohlantirish sifatida boradi):', { parse_mode: 'HTML' });
      }

      if (session.step === 'give_fine_reason') {
        const worker = db.getWorkerById(session.workerId);
        db.createFine(session.workerId, session.amount, text);
        clearSession(ctx.from.id);

        await ctx.reply(
          `⚠️ <b>${worker.full_name}</b>ga <b>${formatMoney(session.amount)}</b> jarima berildi va oyligidan chegirildi.`,
          { parse_mode: 'HTML', ...getAdminKeyboard() }
        );

        // Notify worker
        await notifyWorker(
          worker.id,
          `⚠️ <b>OGOHLANTIRISH VA JARIMA!</b>\n\n` +
          `Sizga <b>${formatMoney(session.amount)}</b> miqdorida jarima qo'llanildi.\n` +
          `📝 Sabab: <i>${text}</i>\n` +
          `Ushbu summa joriy hisobingizdan minus qilindi.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // ---------------------------------------------------------
      // CLIENTLAR: QO'SHISH VA SOTUV
      // ---------------------------------------------------------
      if (session.step === 'add_client_name') {
        updateSession(ctx.from.id, { step: 'add_client_phone', clientName: text });
        return ctx.reply('📞 Mijozning telefon raqamini kiriting (Masalan: <b>+998901234567</b>):', { parse_mode: 'HTML' });
      }

      if (session.step === 'add_client_phone') {
        updateSession(ctx.from.id, { step: 'add_client_company', clientPhone: text });
        return ctx.reply('🏬 Mijozning do\'koni yoki firmasi nomini kiriting (Masalan: <i>Chorsu Bozor #12</i> yoki <i>Yo\'q</i>):', { parse_mode: 'HTML' });
      }

      if (session.step === 'add_client_company') {
        const company = text.toLowerCase() === 'yo\'q' ? '' : text;
        db.createClient({
          name: session.clientName,
          phone: session.clientPhone,
          companyName: company
        });
        clearSession(ctx.from.id);
        return ctx.reply(`✅ <b>${session.clientName}</b> mijozlar ro'yxatiga muvaffaqiyatli qo'shildi!`, { parse_mode: 'HTML', ...getAdminKeyboard() });
      }

      // Client sale wizard
      if (session.step === 'client_sale_product') {
        updateSession(ctx.from.id, { step: 'client_sale_packs', productName: text });
        return ctx.reply('📦 Nechta <b>pochka</b> sotildi? (Masalan: <b>25</b>):', { parse_mode: 'HTML' });
      }

      if (session.step === 'client_sale_packs') {
        const packs = Number(text.replace(/[^0-9.]/g, ''));
        if (isNaN(packs) || packs <= 0) return ctx.reply('⚠️ To\'g\'ri son kiriting:');
        updateSession(ctx.from.id, { step: 'client_sale_price', packsQuantity: packs });
        return ctx.reply('💵 1 pochkaning narxi necha pul? (Masalan: <b>180000</b>):', { parse_mode: 'HTML' });
      }

      if (session.step === 'client_sale_price') {
        const price = Number(text.replace(/[^0-9]/g, ''));
        if (isNaN(price) || price <= 0) return ctx.reply('⚠️ To\'g\'ri narx kiriting:');
        const total = session.packsQuantity * price;
        updateSession(ctx.from.id, { step: 'client_sale_paid', pricePerPack: price, totalAmount: total });
        return ctx.reply(
          `💰 Jami xarid summasi: <b>${formatMoney(total)}</b> (${session.packsQuantity} pochka * ${formatMoney(price)})\n\n` +
          `Mijoz qancha to'ladi? (Agar to'liq qarzga berilgan bo'lsa <b>0</b> kiriting):`,
          { parse_mode: 'HTML' }
        );
      }

      if (session.step === 'client_sale_paid') {
        const paid = Number(text.replace(/[^0-9]/g, ''));
        const order = db.createClientOrder({
          clientId: session.clientId,
          productName: session.productName,
          packsQuantity: session.packsQuantity,
          pricePerPack: session.pricePerPack,
          paidAmount: paid
        });
        const client = db.getClientById(session.clientId);
        clearSession(ctx.from.id);

        await ctx.reply(
          `✅ <b>Sotuv muvaffaqiyatli qayd etildi!</b>\n\n` +
          `👤 Mijoz: <b>${client.name}</b>\n` +
          `👟 Mahsulot: <b>${session.productName}</b>\n` +
          `📦 Pochka soni: <b>${session.packsQuantity} ta</b>\n` +
          `💰 Jami summa: <b>${formatMoney(order.totalAmount)}</b>\n` +
          `💵 To'langan: <b>${formatMoney(paid)}</b>\n` +
          `⚠️ Qoldiq qarz: <b>${formatMoney(order.debtAmount)}</b>`,
          { parse_mode: 'HTML', ...getAdminKeyboard() }
        );

        // Notify client if registered
        if (client.telegram_id) {
          await notifyClient(
            client.id,
            `📦 <b>Yangi xaridingiz qayd etildi:</b>\n\n` +
            `👟 Mahsulot: <b>${session.productName}</b>\n` +
            `📦 Soni: <b>${session.packsQuantity} pochka</b>\n` +
            `💰 Summa: <b>${formatMoney(order.totalAmount)}</b>\n` +
            `💵 To'landi: ${formatMoney(paid)}\n` +
            `⚠️ Qoldiq qarz: <b>${formatMoney(order.debtAmount)}</b>`,
            { parse_mode: 'HTML' }
          );
        }
        return;
      }

      if (session.step === 'admin_client_msg') {
        const client = db.getClientById(session.clientId);
        db.saveClientMessage(session.clientId, 'admin', text);
        clearSession(ctx.from.id);

        if (client.telegram_id) {
          await notifyClient(
            client.id,
            `✉️ <b>BS-SHOES Sex rahbaridan xabar:</b>\n\n${text}`,
            { parse_mode: 'HTML' }
          );
          return ctx.reply(`✅ Xabar <b>${client.name}</b>ga yuborildi!`, { parse_mode: 'HTML', ...getAdminKeyboard() });
        } else {
          return ctx.reply(`⚠️ Client hali botga kirmagan. Xabar tizimda saqlandi.`, getAdminKeyboard());
        }
      }

      // ---------------------------------------------------------
      // CLIENT: SEND MESSAGE TO ADMIN
      // ---------------------------------------------------------
      if (session.step === 'client_send_msg_to_admin') {
        const client = db.getClientByTelegramId(ctx.from.id);
        if (client) {
          db.saveClientMessage(client.id, 'client', text);
          clearSession(ctx.from.id);

          await ctx.reply('✅ Xabaringiz sex rahbariga yetkazildi. Rahmat!', getClientKeyboard());

          await notifyAllAdmins(
            `✉️ <b>Mijozdan yangi xabar!</b>\n\n` +
            `👤 Mijoz: <b>${client.name}</b> (${client.phone || ''})\n` +
            `🏬 Do'kon: ${client.company_name || '-'}\n\n` +
            `💬 <i>"${text}"</i>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [Markup.button.callback('✉️ Javob yozish', `admin_client_msg_${client.id}`)]
                ]
              }
            }
          );
          return;
        }
      }

      // ---------------------------------------------------------
      // WORKER: SUBMIT JOB QUANTITY
      // ---------------------------------------------------------
      if (session.step === 'worker_input_job_qty') {
        const qty = Number(text.replace(/[^0-9.]/g, ''));
        if (isNaN(qty) || qty <= 0) return ctx.reply('⚠️ Iltimos, to\'g\'ri son kiriting (Masalan: 120):');

        const worker = db.getWorkerByTelegramId(ctx.from.id);
        const job = db.getJobTypeById(session.jobId);
        const sub = db.createWorkSubmission(worker.id, session.jobId, qty);
        clearSession(ctx.from.id);

        await ctx.reply(
          `✅ <b>Ishingiz muvaffaqiyatli topshirildi!</b>\n\n` +
          `🛠 Ish turi: <b>${job.name}</b>\n` +
          `🔢 Soni: <b>${qty} ${job.unit}</b>\n` +
          `💵 Birlik narxi: ${formatMoney(job.price)}\n` +
          `💰 Jami hisoblangan: <b>${formatMoney(sub.totalPrice)}</b>\n\n` +
          `⏳ Sex rahbari tekshirib tasdiqlagach, shaxsiy hisobingizga qo'shiladi!`,
          { parse_mode: 'HTML', ...getWorkerKeyboard() }
        );

        // Notify admins
        const roleIcon = worker.role === 'student' ? '🎒' : '👷‍♂️';
        await notifyAllAdmins(
          `📥 <b>Yangi ish topshirildi! (#${sub.id})</b>\n\n` +
          `👤 Ishchi: ${roleIcon} <b>${worker.full_name}</b>\n` +
          `🛠 Ish turi: <b>${job.name}</b>\n` +
          `🔢 Soni: <b>${qty} ${job.unit}</b>\n` +
          `💰 Summa: <b>${formatMoney(sub.totalPrice)}</b>\n\n` +
          `Tasdiqlash uchun <b>"📥 Tasdiqlash qutisi"</b> bo'limiga kiring:`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [Markup.button.callback('✅ Qabul qilish', `admin_approve_sub_${sub.id}`)],
                [Markup.button.callback('✏️ Tahrirlab qabul qilish', `admin_edit_sub_${sub.id}`)],
                [Markup.button.callback('❌ Rad etish', `admin_reject_sub_${sub.id}`)]
              ]
            }
          }
        );
        return;
      }

      // ---------------------------------------------------------
      // WORKER: REQUEST ADVANCE
      // ---------------------------------------------------------
      if (session.step === 'worker_request_advance') {
        const amount = Number(text.replace(/[^0-9]/g, ''));
        if (isNaN(amount) || amount <= 0) return ctx.reply('⚠️ To\'g\'ri summa kiriting:');

        const worker = db.getWorkerByTelegramId(ctx.from.id);
        clearSession(ctx.from.id);

        await ctx.reply(
          `✅ <b>Avans so'rovingiz rahbariga yuborildi!</b>\n\n` +
          `💵 So'ralgan summa: <b>${formatMoney(amount)}</b>`,
          { parse_mode: 'HTML', ...getWorkerKeyboard() }
        );

        const roleIcon = worker.role === 'student' ? '🎒' : '👷‍♂️';
        await notifyAllAdmins(
          `💸 <b>Ishchidan avans so'rovi!</b>\n\n` +
          `👤 Ishchi: ${roleIcon} <b>${worker.full_name}</b>\n` +
          `💵 So'ralgan summa: <b>${formatMoney(amount)}</b>\n` +
          `💰 Hozirgi balansi: ${formatMoney(worker.balance)}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [Markup.button.callback('💸 Avans berish', `admin_give_advance_${worker.id}`)]
              ]
            }
          }
        );
        return;
      }

      // ---------------------------------------------------------
      // SOZLAMALAR: ISH VAQTI, BONUS/JARIMA, PAROL
      // ---------------------------------------------------------
      if (session.step === 'set_work_start_worker') {
        db.setSetting('work_start_worker', text);
        updateSession(ctx.from.id, { step: 'set_work_start_student' });
        return ctx.reply('🎒 <b>Maktab o\'quvchilari uchun ish boshlanish vaqtini kiriting</b> (Masalan: <b>13:00</b>):', { parse_mode: 'HTML' });
      }

      if (session.step === 'set_work_start_student') {
        db.setSetting('work_start_student', text);
        clearSession(ctx.from.id);
        return ctx.reply(`✅ Ish vaqtlari saqlandi!`, getAdminKeyboard());
      }

      if (session.step === 'set_bonus_amount') {
        const bonus = Number(text.replace(/[^0-9]/g, ''));
        db.setSetting('on_time_bonus_amount', bonus);
        updateSession(ctx.from.id, { step: 'set_late_fine_amount' });
        return ctx.reply('⚠️ <b>Ishga kech qolganda beriladigan JARIMA summasini kiriting</b> (Masalan: <b>10000</b>):', { parse_mode: 'HTML' });
      }

      if (session.step === 'set_late_fine_amount') {
        const fine = Number(text.replace(/[^0-9]/g, ''));
        db.setSetting('late_fine_amount', fine);
        clearSession(ctx.from.id);
        return ctx.reply('✅ Bonus va Jarima miqdorlari saqlandi!', getAdminKeyboard());
      }

      if (session.step === 'set_admin_new_login') {
        updateSession(ctx.from.id, { step: 'set_admin_new_pwd', newLogin: text });
        return ctx.reply('🔑 Endi yangi <b>parolni</b> kiriting:', { parse_mode: 'HTML' });
      }

      if (session.step === 'set_admin_new_pwd') {
        db.setSetting('admin_login', session.newLogin);
        db.setSetting('admin_password', text);
        clearSession(ctx.from.id);
        return ctx.reply(`✅ <b>Admin login va paroli muvaffaqiyatli yangilandi!</b>\n\nLogin: <code>${session.newLogin}</code>\nParol: <code>${text}</code>`, { parse_mode: 'HTML', ...getAdminKeyboard() });
      }

    } catch (err) {
      console.error('Wizard xatoligi:', err);
      return ctx.reply('⚠️ Xatolik yuz berdi: ' + err.message);
    }

    return next();
  });

  // Action: Choose worker role during creation
  bot.action(/^worker_role_(worker|student)$/, async (ctx) => {
    const role = ctx.match[1];
    await ctx.answerCbQuery();
    updateSession(ctx.from.id, { step: 'add_worker_phone', role });
    const roleName = role === 'student' ? 'Maktab o\'quvchisi 🎒' : 'Oddiy ishchi 👷‍♂️';
    return ctx.reply(
      `📌 Tanlangan rol: <b>${roleName}</b>\n\nIltimos, ishchining <b>telefon raqamini</b> kiriting (Masalan: <b>+998901234567</b>):`,
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });
}

module.exports = {
  registerWizardHandlers
};
