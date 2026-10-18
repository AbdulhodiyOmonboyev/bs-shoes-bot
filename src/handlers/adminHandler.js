const { Markup } = require('telegraf');
const db = require('../database');
const { getAdminKeyboard, getCancelKeyboard, backInline } = require('../keyboards');
const { setSession, getSession, clearSession } = require('../utils/session');
const { formatMoney, formatDuration, getTashkentDate, getTashkentTime } = require('../utils/helpers');
const {
  notifyWorker,
  broadcastToWorkers,
  notifyClient
} = require('../services/notificationService');
const {
  generateAttendanceExcel,
  generatePayrollExcel,
  generateClientReportExcel
} = require('../services/excelService');

function registerAdminHandlers(bot) {
  // Check admin helper
  function checkAdmin(ctx) {
    const admin = db.getAdminByTelegramId(ctx.from.id);
    return !!admin;
  }

  // -------------------------------------------------------------
  // 1. ISHCHILAR BOSHQARUVI
  // -------------------------------------------------------------
  bot.hears('👥 Ishchilar boshqaruvi', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const workers = db.getAllWorkers(false);
    let text = `👥 <b>Ishchilar boshqaruvi bo'limi</b>\n\n`;
    text += `Jami ishchilar: <b>${workers.length} ta</b> (Faol: ${workers.filter(w => w.is_active).length} ta)\n\n`;
    text += `Quyidagi tugmalar orqali yangi ishchi qo'shishingiz yoki ishchini tanlab ma'lumotlarini o'zgartirishingiz mumkin:`;

    const inlineKeyboard = [
      [Markup.button.callback('➕ Yangi ishchi qo\'shish', 'admin_worker_add')]
    ];

    // List active workers as buttons
    workers.forEach(w => {
      const roleIcon = w.role === 'student' ? '🎒' : '👷‍♂️';
      const statusIcon = w.is_active ? '🟢' : '⚪️ (no-faol)';
      const btnText = `${roleIcon} ${w.full_name} (${formatMoney(w.balance)}) ${statusIcon}`;
      inlineKeyboard.push([Markup.button.callback(btnText, `admin_worker_view_${w.id}`)]);
    });

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  });

  // Action: Add Worker Start
  bot.action('admin_worker_add', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    setSession(ctx.from.id, { step: 'add_worker_name' });
    return ctx.reply(
      '👤 <b>Yangi ishchi qo\'shish:</b>\n\nIltimos, ishchining <b>F.I.Sh (Ism va Familiyasi)</b>ni kiriting:',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: View Worker Details
  bot.action(/^admin_worker_view_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const workerId = Number(ctx.match[1]);
    const worker = db.getWorkerById(workerId);
    if (!worker) return ctx.reply('⚠️ Ishchi topilmadi.');

    const roleName = worker.role === 'student' ? 'Maktab o\'quvchisi 🎒' : 'Oddiy ishchi 👷‍♂️';
    const statusText = worker.is_active ? '🟢 Faol' : '🔴 Faol emas';
    const tgLinked = worker.telegram_id ? `Ulangan (ID: ${worker.telegram_id})` : 'Ulanmagan (Botga kirmagan)';

    let text = `👤 <b>Ishchi profili:</b>\n\n`;
    text += `📛 <b>Ismi:</b> ${worker.full_name}\n`;
    text += `📌 <b>Roli:</b> ${roleName}\n`;
    text += `📞 <b>Telefon:</b> ${worker.phone || 'Kiritilmagan'}\n`;
    text += `⏰ <b>Ish boshlanishi:</b> ${worker.work_start_time || '09:00'}\n`;
    text += `💰 <b>Joriy balansi:</b> ${formatMoney(worker.balance)}\n`;
    text += `🤖 <b>Telegram holati:</b> ${tgLinked}\n`;
    text += `📊 <b>Holati:</b> ${statusText}\n`;

    const buttons = [
      [
        Markup.button.callback('💸 Avans berish', `admin_give_advance_${worker.id}`),
        Markup.button.callback('⚠️ Jarima berish', `admin_give_fine_${worker.id}`)
      ],
      [
        Markup.button.callback('✉️ Shaxsiy xabar yuborish', `admin_msg_worker_${worker.id}`),
        Markup.button.callback('⏰ Ish vaqtini o\'zgartirish', `admin_edit_worker_time_${worker.id}`)
      ],
      [
        Markup.button.callback(worker.is_active ? '🔴 Faolsizlantirish' : '🟢 Faollashtirish', `admin_toggle_worker_${worker.id}`),
        Markup.button.callback('⬅️ Ishchilar ro\'yxati', 'admin_workers_list')
      ]
    ];

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Return to workers list
  bot.action('admin_workers_list', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const workers = db.getAllWorkers(false);
    const inlineKeyboard = [
      [Markup.button.callback('➕ Yangi ishchi qo\'shish', 'admin_worker_add')]
    ];
    workers.forEach(w => {
      const roleIcon = w.role === 'student' ? '🎒' : '👷‍♂️';
      const statusIcon = w.is_active ? '🟢' : '⚪️';
      const btnText = `${roleIcon} ${w.full_name} (${formatMoney(w.balance)}) ${statusIcon}`;
      inlineKeyboard.push([Markup.button.callback(btnText, `admin_worker_view_${w.id}`)]);
    });
    return ctx.editMessageText('👥 <b>Ishchilar boshqaruvi:</b>', {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  });

  // Action: Toggle worker status
  bot.action(/^admin_toggle_worker_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const workerId = Number(ctx.match[1]);
    const worker = db.getWorkerById(workerId);
    if (worker) {
      db.updateWorker(workerId, { isActive: !worker.is_active });
      return ctx.reply(`✅ Ishchi holati o'zgartirildi: ${worker.is_active ? 'Faolsizlantirildi' : 'Faollashtirildi'}.`);
    }
  });

  // Action: Edit worker time
  bot.action(/^admin_edit_worker_time_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const workerId = Number(ctx.match[1]);
    setSession(ctx.from.id, { step: 'edit_worker_time', workerId });
    return ctx.reply(
      '⏰ Ishchining ertalab yoki tushdan keyin ishga kelish vaqtini kiriting (Masalan: <b>09:00</b> yoki <b>13:00</b>):',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // -------------------------------------------------------------
  // 2. NARXLAR VA BO'LIMLAR
  // -------------------------------------------------------------
  bot.hears("⚙️ Narxlar va Bo'limlar", async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const jobs = db.getAllJobTypes(false);
    let text = `⚙️ <b>Sex bo'limlari va ish turlari narxlari:</b>\n\n`;
    text += `Ishchilar o'zlari bajargan ishlarni shu bo'limlar va narxlar asosida kiritishadi.\n\n`;

    const inlineKeyboard = [
      [Markup.button.callback('➕ Yangi ish turi qo\'shish', 'admin_job_add')]
    ];

    jobs.forEach(j => {
      const status = j.is_active ? '🟢' : '🔴';
      text += `▫️ <b>${j.name}</b>: ${formatMoney(j.price)} / 1 ${j.unit} ${status}\n`;
      inlineKeyboard.push([
        Markup.button.callback(`✏️ ${j.name} (${formatMoney(j.price)})`, `admin_job_edit_${j.id}`)
      ]);
    });

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  });

  // Action: Add Job Start
  bot.action('admin_job_add', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    setSession(ctx.from.id, { step: 'add_job_name' });
    return ctx.reply(
      '🛠 <b>Yangi ish turini qo\'shish:</b>\n\nIsh yoki bo\'lim nomini kiriting (Masalan: <b>Tortuv</b>, <b>Zagatovka</b>, <b>Padoj</b>, <b>Stirka</b>):',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: Edit Job
  bot.action(/^admin_job_edit_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const jobId = Number(ctx.match[1]);
    const job = db.getJobTypeById(jobId);
    if (!job) return ctx.reply('⚠️ Ish turi topilmadi.');

    setSession(ctx.from.id, { step: 'edit_job_price', jobId });
    return ctx.reply(
      `✏️ <b>${job.name}</b> ish turining yangi narxini kiriting:\n(Hozirgi narx: ${formatMoney(job.price)} / 1 ${job.unit}):`,
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // -------------------------------------------------------------
  // 3. DAVOMAT VA NAZORAT
  // -------------------------------------------------------------
  bot.hears('⏱ Davomat va Nazorat', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const today = getTashkentDate();
    const allWorkers = db.getAllWorkers(true);
    const todayAttendance = db.getTodayAttendance(today);

    const presentWorkerIds = new Set(todayAttendance.map(a => a.worker_id));
    const absentWorkers = allWorkers.filter(w => !presentWorkerIds.has(w.id));
    const currentlyWorking = todayAttendance.filter(a => !a.check_out_time);
    const completedWorkers = todayAttendance.filter(a => a.check_out_time);

    let text = `⏱ <b>Bugungi davomat va nazorat (${today})</b>\n\n`;
    text += `👥 <b>Jami ishchilar:</b> ${allWorkers.length} ta\n`;
    text += `🟢 <b>Kelganlar:</b> ${todayAttendance.length} ta\n`;
    text += `⏳ <b>Hozir ishlayotganlar:</b> ${currentlyWorking.length} ta\n`;
    text += `🏁 <b>Ishni yakunlaganlar:</b> ${completedWorkers.length} ta\n`;
    text += `🔴 <b>Kelmaganlar:</b> ${absentWorkers.length} ta\n\n`;

    if (todayAttendance.length > 0) {
      text += `📋 <b>Bugun kelganlar ro'yxati:</b>\n`;
      todayAttendance.forEach((a, i) => {
        const roleIcon = a.role === 'student' ? '🎒' : '👷‍♂️';
        const outText = a.check_out_time ? ` - ${a.check_out_time} (${formatDuration(a.worked_minutes)})` : ' (Ishda)';
        const bonusOrFine = a.bonus_amount > 0 ? ` 🎁 +${formatMoney(a.bonus_amount)}` : a.fine_amount > 0 ? ` ⚠️ -${formatMoney(a.fine_amount)}` : '';
        text += `${i + 1}. ${roleIcon} <b>${a.full_name}</b>: 🟢 ${a.check_in_time}${outText}${bonusOrFine}\n`;
      });
    }

    if (absentWorkers.length > 0) {
      text += `\n🔴 <b>Bugun kelmaganlar:</b>\n`;
      absentWorkers.forEach((w, i) => {
        const roleIcon = w.role === 'student' ? '🎒' : '👷‍♂️';
        text += `${i + 1}. ${roleIcon} ${w.full_name} (${w.phone || 'tel yo\'q'})\n`;
      });
    }

    const buttons = [
      [Markup.button.callback('📥 Bugungi davomatni Excel yuklash', 'admin_download_today_att')],
      [Markup.button.callback('📊 Oylik / Umumiy davomatni yuklash', 'admin_download_range_att')]
    ];

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Download Today Attendance Excel
  bot.action('admin_download_today_att', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const today = getTashkentDate();
    const records = db.getAttendanceReportData(today, today);
    if (records.length === 0) {
      return ctx.reply('⚠️ Bugun hali hech kim kelmagan.');
    }
    const filePath = await generateAttendanceExcel(records, `Davomat_${today}`);
    await ctx.replyWithDocument({ source: filePath, filename: `davomat_${today}.xlsx` }, {
      caption: `📊 Bugungi davomat hisoboti (${today})`
    });
  });

  // Action: Download Range Attendance Excel
  bot.action('admin_download_range_att', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const today = getTashkentDate();
    const startOfMonth = today.slice(0, 8) + '01';
    const records = db.getAttendanceReportData(startOfMonth, today);
    if (records.length === 0) {
      return ctx.reply('⚠️ Ushbu oy uchun davomat ma\'lumotlari yo\'q.');
    }
    const filePath = await generateAttendanceExcel(records, `Davomat_${startOfMonth}_${today}`);
    await ctx.replyWithDocument({ source: filePath, filename: `davomat_${startOfMonth}_${today}.xlsx` }, {
      caption: `📊 Oylik davomat hisoboti (${startOfMonth} dan ${today} gacha)`
    });
  });

  // -------------------------------------------------------------
  // 4. TASDIQLASH QUTISI (Work submissions review)
  // -------------------------------------------------------------
  bot.hears('📥 Tasdiqlash qutisi', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const pending = db.getPendingSubmissions();
    if (pending.length === 0) {
      return ctx.reply(
        '📥 <b>Tasdiqlash qutisi bo\'sh.</b>\n\nHozircha ishchilar tomonidan tasdiqlash uchun yuborilgan yangi ishlar yo\'q.',
        { parse_mode: 'HTML' }
      );
    }

    // Show first pending submission
    const item = pending[0];
    const roleIcon = item.worker_role === 'student' ? '🎒' : '👷‍♂️';

    let text = `📥 <b>Yangi ish topshirildi (#${item.id}) [${pending.length} ta navbatda]:</b>\n\n`;
    text += `👤 <b>Ishchi:</b> ${roleIcon} ${item.worker_name}\n`;
    text += `🛠 <b>Bo'lim / Ish turi:</b> ${item.job_name}\n`;
    text += `🔢 <b>Topshirgan soni:</b> ${item.quantity} ${item.job_unit}\n`;
    text += `💵 <b>Birlik narxi:</b> ${formatMoney(item.unit_price)}\n`;
    text += `💰 <b>Jami hisoblangan summa:</b> <b>${formatMoney(item.total_price)}</b>\n`;
    text += `📅 <b>Yuborilgan vaqti:</b> ${item.created_at}\n\n`;
    text += `<i>Tekshirib ko'ring va tegishli tugmani bosing:</i>`;

    const buttons = [
      [Markup.button.callback('✅ Qabul qilish (To\'liq)', `admin_approve_sub_${item.id}`)],
      [Markup.button.callback('✏️ Soni kamaytirib qabul qilish', `admin_edit_sub_${item.id}`)],
      [Markup.button.callback('❌ Rad etish', `admin_reject_sub_${item.id}`)]
    ];

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Approve Submission
  bot.action(/^admin_approve_sub_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const subId = Number(ctx.match[1]);
    const sub = db.approveSubmission(subId, ctx.from.id);
    if (!sub) return ctx.reply('⚠️ Ushbu ish allaqachon ko\'rib chiqilgan.');

    await ctx.reply(
      `✅ <b>${sub.worker_name}</b>ning "<b>${sub.job_name}</b>" bo'yicha <b>${sub.quantity} ${sub.job_unit}</b> ishi qabul qilindi!\n` +
      `💰 Ishchining hisobiga <b>+${formatMoney(sub.total_price)}</b> qo'shildi.`,
      { parse_mode: 'HTML' }
    );

    // Notify worker
    await notifyWorker(
      sub.worker_id,
      `✅ <b>Ishingiz qabul qilindi!</b>\n\n` +
      `🛠 Ish turi: <b>${sub.job_name}</b>\n` +
      `🔢 Soni: <b>${sub.quantity} ${sub.job_unit}</b>\n` +
      `💰 Hisobingizga qo'shildi: <b>+${formatMoney(sub.total_price)}</b>`,
      { parse_mode: 'HTML' }
    );

    // Prompt next pending if any
    const pending = db.getPendingSubmissions();
    if (pending.length > 0) {
      const next = pending[0];
      const roleIcon = next.worker_role === 'student' ? '🎒' : '👷‍♂️';
      const text = `📥 <b>Keyingi ish (#${next.id}) [${pending.length} ta qoldi]:</b>\n\n` +
        `👤 <b>Ishchi:</b> ${roleIcon} ${next.worker_name}\n` +
        `🛠 <b>Ish turi:</b> ${next.job_name}\n` +
        `🔢 <b>Soni:</b> ${next.quantity} ${next.job_unit}\n` +
        `💰 <b>Summa:</b> <b>${formatMoney(next.total_price)}</b>\n`;
      return ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('✅ Qabul qilish', `admin_approve_sub_${next.id}`)],
            [Markup.button.callback('✏️ Soni kamaytirib qabul qilish', `admin_edit_sub_${next.id}`)],
            [Markup.button.callback('❌ Rad etish', `admin_reject_sub_${next.id}`)]
          ]
        }
      });
    }
  });

  // Action: Edit & Approve Submission Start
  bot.action(/^admin_edit_sub_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const subId = Number(ctx.match[1]);
    const sub = db.getSubmissionById(subId);
    if (!sub) return ctx.reply('⚠️ Ish topilmadi.');

    setSession(ctx.from.id, { step: 'edit_sub_quantity', subId, originalQty: sub.quantity, unitPrice: sub.unit_price });
    return ctx.reply(
      `✏️ <b>${sub.worker_name}</b> topshirgan miqdor: <b>${sub.quantity} ${sub.job_unit}</b>\n\n` +
      `Siz qabul qiladigan to'g'ri sonni kiriting (Masalan, braklar olib tashlangandan so'ng: <b>85</b>):`,
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: Reject Submission Start
  bot.action(/^admin_reject_sub_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const subId = Number(ctx.match[1]);
    setSession(ctx.from.id, { step: 'reject_sub_reason', subId });
    return ctx.reply(
      '❌ <b>Ishni rad etish sababini yozing</b> (Ishchiga ogohlantirish sifatida yuboriladi):',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // -------------------------------------------------------------
  // 5. HISOBOTLAR
  // -------------------------------------------------------------
  bot.hears('📊 Hisobotlar', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const currentPeriod = db.getCurrentPeriod();
    const workers = db.getAllWorkers(true);

    let totalFactoryWork = 0;
    let totalFactoryBonus = 0;
    let totalFactoryLateFines = 0;
    let totalFactoryOtherFines = 0;
    let totalFactoryAdvances = 0;
    let totalNetPayout = 0;

    workers.forEach(w => {
      const f = db.getWorkerPeriodFinancials(w.id, currentPeriod.id);
      totalFactoryWork += f.totalWork;
      totalFactoryBonus += f.totalBonus;
      totalFactoryLateFines += f.totalLateFine;
      totalFactoryOtherFines += f.totalFines;
      totalFactoryAdvances += f.totalAdvances;
      totalNetPayout += f.netSalary;
    });

    let text = `📊 <b>Joriy davr hisoboti (#${currentPeriod.period_number})</b>\n`;
    text += `📅 Boshlanishi: ${currentPeriod.start_date}\n\n`;
    text += `🛠 <b>Jami bajarilgan ishlar:</b> ${formatMoney(totalFactoryWork)}\n`;
    text += `🎁 <b>Jami bonuslar (+):</b> ${formatMoney(totalFactoryBonus)}\n`;
    text += `⚠️ <b>Kechikish jarimalari (-):</b> ${formatMoney(totalFactoryLateFines)}\n`;
    text += `🚫 <b>Boshqa jarimalar (-):</b> ${formatMoney(totalFactoryOtherFines)}\n`;
    text += `💸 <b>Berilgan avanslar (-):</b> ${formatMoney(totalFactoryAdvances)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 <b>TO'LANADIGAN SOF OYLIK:</b> <b>${formatMoney(totalNetPayout)}</b>\n\n`;

    const buttons = [
      [Markup.button.callback('📥 Excel hisobotini yuklab olish', 'admin_download_payroll_excel')],
      [Markup.button.callback('👥 Har bir ishchi bo\'yicha batafsil', 'admin_report_workers_breakdown')]
    ];

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Report Workers Breakdown
  bot.action('admin_report_workers_breakdown', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const currentPeriod = db.getCurrentPeriod();
    const workers = db.getAllWorkers(true);

    let text = `👥 <b>Har bir ishchi bo'yicha hisobot (#${currentPeriod.period_number}):</b>\n\n`;
    workers.forEach((w, i) => {
      const f = db.getWorkerPeriodFinancials(w.id, currentPeriod.id);
      const roleIcon = w.role === 'student' ? '🎒' : '👷‍♂️';
      text += `${i + 1}. ${roleIcon} <b>${w.full_name}</b>\n`;
      text += `   Ish: ${formatMoney(f.totalWork)} | Bonus: +${formatMoney(f.totalBonus)}\n`;
      text += `   Jarimalar: -${formatMoney(f.totalLateFine + f.totalFines)} | Avans: -${formatMoney(f.totalAdvances)}\n`;
      text += `   👉 <b>Sof oylik: ${formatMoney(f.netSalary)}</b>\n\n`;
    });

    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // -------------------------------------------------------------
  // 6. E'LON VA TOPSHIRIQLAR
  // -------------------------------------------------------------
  bot.hears('✉️ E\'lon va Topshiriqlar', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    let text = `✉️ <b>E'lon va Topshiriqlar bo'limi:</b>\n\n`;
    text += `Bu yerdan barcha ishchilarga umumiy xabar/e'lon yuborishingiz yoki tanlangan bitta ishchiga alohida topshiriq jo'natishingiz mumkin.`;

    const buttons = [
      [Markup.button.callback('📢 Barcha ishchilarga umumiy e\'lon', 'admin_broadcast_start')],
      [Markup.button.callback('👤 Alohida ishchiga topshiriq', 'admin_single_msg_start')]
    ];

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Broadcast start
  bot.action('admin_broadcast_start', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    setSession(ctx.from.id, { step: 'broadcast_message' });
    return ctx.reply(
      '📢 <b>Barcha ishchilarga e\'lon yuborish:</b>\n\n' +
      'Yubormoqchi bo\'lgan xabaringiz matnini kiriting (Masalan: <i>"Ertaga bayram munosabati bilan dam olish kuni, ish bo\'lmaydi!"</i>):',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: Single msg start
  bot.action('admin_single_msg_start', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const workers = db.getAllWorkers(true);
    const buttons = [];
    workers.forEach(w => {
      const roleIcon = w.role === 'student' ? '🎒' : '👷‍♂️';
      buttons.push([Markup.button.callback(`${roleIcon} ${w.full_name}`, `admin_msg_worker_${w.id}`)]);
    });
    return ctx.reply('👤 Xabar yubormoqchi bo\'lgan ishchini tanlang:', {
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Msg to specific worker
  bot.action(/^admin_msg_worker_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const workerId = Number(ctx.match[1]);
    const worker = db.getWorkerById(workerId);
    if (!worker) return ctx.reply('⚠️ Ishchi topilmadi.');

    setSession(ctx.from.id, { step: 'single_worker_msg', workerId });
    return ctx.reply(
      `✉️ <b>${worker.full_name}</b>ga topshiriq yoki xabar yozing:`,
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // -------------------------------------------------------------
  // 7. AVANS BERISH
  // -------------------------------------------------------------
  bot.hears('💸 Avans berish', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const workers = db.getAllWorkers(true);
    let text = `💸 <b>Ishchiga avans (qarz) berish:</b>\n\nQaysi ishchiga avans bermoqchisiz? Tanlang:`;

    const buttons = [];
    workers.forEach(w => {
      const roleIcon = w.role === 'student' ? '🎒' : '👷‍♂️';
      buttons.push([Markup.button.callback(`${roleIcon} ${w.full_name} (${formatMoney(w.balance)})`, `admin_give_advance_${w.id}`)]);
    });

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Give advance to worker
  bot.action(/^admin_give_advance_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const workerId = Number(ctx.match[1]);
    const worker = db.getWorkerById(workerId);
    if (!worker) return ctx.reply('⚠️ Ishchi topilmadi.');

    setSession(ctx.from.id, { step: 'give_advance_amount', workerId });
    return ctx.reply(
      `💸 <b>${worker.full_name}</b> uchun beriladigan <b>avans summasini</b> kiriting (Masalan: <b>50000</b>):`,
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // -------------------------------------------------------------
  // 8. JARIMA BERISH
  // -------------------------------------------------------------
  bot.hears('⚠️ Jarima berish', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const workers = db.getAllWorkers(true);
    let text = `⚠️ <b>Ishchiga jarima belgilash:</b>\n\nQaysi ishchiga jarima bermoqchisiz? Tanlang:`;

    const buttons = [];
    workers.forEach(w => {
      const roleIcon = w.role === 'student' ? '🎒' : '👷‍♂️';
      buttons.push([Markup.button.callback(`${roleIcon} ${w.full_name}`, `admin_give_fine_${w.id}`)]);
    });

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Give fine to worker
  bot.action(/^admin_give_fine_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const workerId = Number(ctx.match[1]);
    const worker = db.getWorkerById(workerId);
    if (!worker) return ctx.reply('⚠️ Ishchi topilmadi.');

    setSession(ctx.from.id, { step: 'give_fine_amount', workerId });
    return ctx.reply(
      `⚠️ <b>${worker.full_name}</b> uchun <b>jarima summasini</b> kiriting (Masalan: <b>10000</b>):`,
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // -------------------------------------------------------------
  // 9. CLIENTLAR (Mijozlar & Mahsulotlar)
  // -------------------------------------------------------------
  bot.hears('👨‍💼 Clientlar', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const clients = db.getAllClients();
    let text = `👨‍💼 <b>Clientlar va Mahsulot sotuv bo'limi:</b>\n\n`;
    text += `Sexdan tayyor mahsulotlarni sotish, pochkalar hisobi, to'lovlar va qarzdorlikni shu yerdan kuzatib borasiz.\n\n`;
    text += `Jami mijozlar: <b>${clients.length} ta</b>`;

    const buttons = [
      [Markup.button.callback('➕ Yangi client qo\'shish', 'admin_client_add')],
      [Markup.button.callback('📥 Clientlar va Sotuv Excel hisoboti', 'admin_download_clients_excel')]
    ];

    clients.forEach(c => {
      const summary = db.getClientFinancialSummary(c.id);
      const debtText = summary.total_debt > 0 ? `⚠️ Qarz: ${formatMoney(summary.total_debt)}` : `✅ Qarz yo'q`;
      buttons.push([Markup.button.callback(`👤 ${c.name} (${debtText})`, `admin_client_view_${c.id}`)]);
    });

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Add client start
  bot.action('admin_client_add', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    setSession(ctx.from.id, { step: 'add_client_name' });
    return ctx.reply(
      '👤 <b>Yangi client qo\'shish:</b>\n\nMijozning ismini kiriting (Masalan: <i>Farhod aka</i>):',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: View client profile
  bot.action(/^admin_client_view_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const clientId = Number(ctx.match[1]);
    const client = db.getClientById(clientId);
    if (!client) return ctx.reply('⚠️ Client topilmadi.');

    const summary = db.getClientFinancialSummary(clientId);
    const orders = db.getClientOrders(clientId);

    let text = `👨‍💼 <b>Mijoz kartochkasi:</b>\n\n`;
    text += `👤 <b>Ism:</b> ${client.name}\n`;
    text += `📞 <b>Telefon:</b> ${client.phone || 'Kiritilmagan'}\n`;
    text += `🏬 <b>Do'kon / Firma:</b> ${client.company_name || 'Kiritilmagan'}\n\n`;
    text += `📦 <b>Jami xarid qilingan pochkalar:</b> ${summary.total_packs} ta\n`;
    text += `💰 <b>Jami xarid summasi:</b> ${formatMoney(summary.total_bought)}\n`;
    text += `💵 <b>To'langan summa:</b> ${formatMoney(summary.total_paid)}\n`;
    text += `⚠️ <b>Qoldiq qarz:</b> <b>${formatMoney(summary.total_debt)}</b>\n\n`;

    if (orders.length > 0) {
      text += `📜 <b>So'nggi buyurtmalar:</b>\n`;
      orders.slice(0, 3).forEach((o, i) => {
        text += `${i + 1}. ${o.product_name} - ${o.packs_quantity} pochka (${formatMoney(o.total_amount)})\n`;
      });
    }

    const buttons = [
      [Markup.button.callback('📦 Yangi sotuv kiritish', `admin_client_sale_${client.id}`)],
      [Markup.button.callback('✉️ Clientga xabar yozish', `admin_client_msg_${client.id}`)],
      [
        Markup.button.callback('❌ O\'chirish', `admin_client_delete_${client.id}`),
        Markup.button.callback('⬅️ Clientlar ro\'yxati', 'admin_clients_list')
      ]
    ];

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Return to clients list
  bot.action('admin_clients_list', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const clients = db.getAllClients();
    const buttons = [
      [Markup.button.callback('➕ Yangi client qo\'shish', 'admin_client_add')],
      [Markup.button.callback('📥 Clientlar va Sotuv Excel hisoboti', 'admin_download_clients_excel')]
    ];
    clients.forEach(c => {
      const summary = db.getClientFinancialSummary(c.id);
      const debtText = summary.total_debt > 0 ? `⚠️ Qarz: ${formatMoney(summary.total_debt)}` : `✅ Qarz yo'q`;
      buttons.push([Markup.button.callback(`👤 ${c.name} (${debtText})`, `admin_client_view_${c.id}`)]);
    });
    return ctx.editMessageText('👨‍💼 <b>Clientlar ro\'yxati:</b>', {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Sale to client
  bot.action(/^admin_client_sale_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const clientId = Number(ctx.match[1]);
    const client = db.getClientById(clientId);
    if (!client) return ctx.reply('⚠️ Client topilmadi.');

    setSession(ctx.from.id, { step: 'client_sale_product', clientId });
    return ctx.reply(
      `📦 <b>${client.name} uchun sotuv kiritish:</b>\n\nSotilgan mahsulot nomini kiriting (Masalan: <b>Erkaklar klassik tufli</b>):`,
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: Send message to client
  bot.action(/^admin_client_msg_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const clientId = Number(ctx.match[1]);
    const client = db.getClientById(clientId);
    if (!client) return ctx.reply('⚠️ Client topilmadi.');

    setSession(ctx.from.id, { step: 'admin_client_msg', clientId });
    return ctx.reply(
      `✉️ <b>${client.name}</b>ga Telegram orqali xabar yozing:`,
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: Delete client
  bot.action(/^admin_client_delete_(\d+)$/, async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const clientId = Number(ctx.match[1]);
    db.deleteClient(clientId);
    return ctx.reply('✅ Client o\'chirildi.');
  });

  // Action: Download clients Excel
  bot.action('admin_download_clients_excel', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const clients = db.getAllClients();
    const ordersMap = {};
    for (const c of clients) {
      ordersMap[c.id] = db.getClientOrders(c.id);
    }
    const filePath = await generateClientReportExcel(clients, ordersMap);
    await ctx.replyWithDocument({ source: filePath, filename: `mijozlar_hisoboti_${Date.now()}.xlsx` }, {
      caption: '📊 Clientlar va savdo hisoboti'
    });
  });

  // -------------------------------------------------------------
  // 10. PUL VA HAFTALIK (Payroll & Settlement)
  // -------------------------------------------------------------
  bot.hears('💰 Pul va haftalik', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const currentPeriod = db.getCurrentPeriod();
    const workers = db.getAllWorkers(true);

    let totalPayroll = 0;
    let listText = '';

    workers.forEach((w, i) => {
      const f = db.getWorkerPeriodFinancials(w.id, currentPeriod.id);
      totalPayroll += f.netSalary;
      const roleIcon = w.role === 'student' ? '🎒' : '👷‍♂️';
      listText += `${i + 1}. ${roleIcon} <b>${w.full_name}</b>: <b>${formatMoney(f.netSalary)}</b>\n`;
    });

    let text = `💰 <b>Haftalik / Oylik to'lovlar (#${currentPeriod.period_number})</b>\n`;
    text += `📅 Davr boshlanishi: ${currentPeriod.start_date}\n\n`;
    text += `Ishchilarning barcha qilingan ishlari, bonuslari, kechikish va boshqa jarimalari hamda olingan avanslari avtomatik hisoblab chiqildi:\n\n`;
    text += listText;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💵 <b>JAMI BERILADIGAN OYLIK:</b> <b>${formatMoney(totalPayroll)}</b>\n\n`;
    text += `<i>Barcha ishchilarga oylikni tarqatib bo'lganingizdan so'ng pastdagi "Oyliklar berildi" tugmasini bosing. Bunda barcha ishchilar balansi nolga tenglanib, yangi hisob davri boshlanadi!</i>`;

    const buttons = [
      [Markup.button.callback('📥 Excel hisobotini yuklab olish', 'admin_download_payroll_excel')],
      [Markup.button.callback('✅ Barcha ishchilarning oyligi berildi', 'admin_settle_payroll_confirm')]
    ];

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Download payroll Excel
  bot.action('admin_download_payroll_excel', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const currentPeriod = db.getCurrentPeriod();
    const workers = db.getAllWorkers(true);
    const settlements = workers.map(w => ({
      worker: w,
      financials: db.getWorkerPeriodFinancials(w.id, currentPeriod.id)
    }));

    const filePath = await generatePayrollExcel(settlements, currentPeriod.period_number);
    await ctx.replyWithDocument({ source: filePath, filename: `oylik_hisoboti_${currentPeriod.period_number}.xlsx` }, {
      caption: `📊 #${currentPeriod.period_number}-davr ish haqi hisoboti`
    });
  });

  // Action: Settle Payroll Confirm
  bot.action('admin_settle_payroll_confirm', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    return ctx.reply(
      '⚠️ <b>Haqiqatan ham barcha ishchilarga oylik tarqatildimi?</b>\n\n' +
      'Ushbu amalni tasdiqlasangiz:\n' +
      '1. Ushbu davr bo\'yicha to\'liq hisobot arxivlanadi.\n' +
      '2. Barcha ishchilarning shaxsiy balansi 0 ga tenglashtiriladi.\n' +
      '3. Yangi davr boshlanadi va ishchilarga xabar yuboriladi.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('✅ Ha, oyliklar berildi (Tasdiqlash)', 'admin_settle_payroll_execute')],
            [Markup.button.callback('❌ Bekor qilish', 'admin_home')]
          ]
        }
      }
    );
  });

  // Action: Settle Payroll Execute
  bot.action('admin_settle_payroll_execute', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();

    const result = db.closePeriodAndSettleAll();

    // Generate final Excel file
    const filePath = await generatePayrollExcel(result.settlements, result.closedPeriod.period_number);

    await ctx.replyWithDocument({ source: filePath, filename: `oylik_yakuniy_${result.closedPeriod.period_number}.xlsx` }, {
      caption: `🎉 <b>#${result.closedPeriod.period_number}-davr oyliklari muvaffaqiyatli yopildi!</b>\n\n` +
        `💵 Jami to'langan summa: <b>${formatMoney(result.totalPayout)}</b>\n` +
        `🔄 Barcha ishchilar balansi 0 ga tenglashtirildi.\n` +
        `🟢 Yangi #${result.closedPeriod.period_number + 1}-davr boshlandi.`,
      parse_mode: 'HTML'
    });

    // Notify workers
    for (const item of result.settlements) {
      if (item.worker.telegram_id) {
        await notifyWorker(
          item.worker.id,
          `🎉 <b>Sizning oyligingiz berildi!</b>\n\n` +
          `💵 Ushbu davr uchun sof oyligingiz: <b>${formatMoney(item.financials.netSalary)}</b>\n` +
          `🔄 Shaxsiy balansingiz 0 ga tenglashtirildi va yangi ish davri boshlandi. Omadli mehnat tilaymiz!`,
          { parse_mode: 'HTML' }
        );
      }
    }
  });

  // -------------------------------------------------------------
  // 11. QO'SHIMCHA SOZLAMALAR
  // -------------------------------------------------------------
  bot.hears('🔧 Qo\'shimcha sozlamalar', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    clearSession(ctx.from.id);

    const settings = db.getAllSettings();
    let text = `🔧 <b>Qo'shimcha sozlamalar bo'limi:</b>\n\n`;
    text += `⏰ <b>Oddiy ishchilar vaqti:</b> ${settings.work_start_worker}\n`;
    text += `🎒 <b>O'quvchilar vaqti:</b> ${settings.work_start_student}\n`;
    text += `🎁 <b>Vaqtida kelish bonusi:</b> +${formatMoney(settings.on_time_bonus_amount)}\n`;
    text += `⚠️ <b>Kech qolish jarimasi:</b> -${formatMoney(settings.late_fine_amount)}\n`;
    text += `📍 <b>Sex geolokatsiyasi:</b> ${settings.factory_latitude ? 'O\'rnatilgan' : 'O\'rnatilmagan'}\n`;
    text += `📏 <b>Ruxsat etilgan radius:</b> ${settings.factory_radius_meters} metr\n`;
    text += `🔐 <b>Admin logini:</b> ${settings.admin_login}\n`;

    const buttons = [
      [
        Markup.button.callback('⏰ Ish vaqtlari', 'admin_set_times'),
        Markup.button.callback('🎁 Bonus va Jarimalar', 'admin_set_fines')
      ],
      [
        Markup.button.callback('📍 Sex lokatsiyasini o\'rnatish', 'admin_set_location'),
        Markup.button.callback('🔐 Parolni o\'zgartirish', 'admin_change_pwd')
      ],
      [
        Markup.button.callback('👥 Adminlar ro\'yxati', 'admin_list_admins')
      ]
    ];

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Set work times
  bot.action('admin_set_times', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    setSession(ctx.from.id, { step: 'set_work_start_worker' });
    return ctx.reply(
      '⏰ <b>Oddiy ishchilar uchun ish boshlanish vaqtini kiriting</b> (Masalan: <b>09:00</b>):',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: Set fines and bonus
  bot.action('admin_set_fines', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    setSession(ctx.from.id, { step: 'set_bonus_amount' });
    return ctx.reply(
      '🎁 <b>Ishga vaqtida kelgan ishchiga beriladigan BONUS summasini kiriting</b> (Masalan: <b>5000</b>):',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: Set factory location
  bot.action('admin_set_location', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    setSession(ctx.from.id, { step: 'awaiting_factory_location' });
    return ctx.reply(
      '📍 <b>Sex joylashuvini o\'rnatish:</b>\n\nIltimos, Telegram orqali sexning hozirgi <b>lokatsiyasini (GPS koordinatasini)</b> yuboring:',
      {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '📍 Sex lokatsiyasini yuborish', request_location: true }],
            ['❌ Bekor qilish']
          ],
          resize_keyboard: true
        }
      }
    );
  });

  // Action: Change password
  bot.action('admin_change_pwd', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    setSession(ctx.from.id, { step: 'set_admin_new_login' });
    return ctx.reply(
      '🔐 <b>Admin loginini o\'zgartirish:</b>\n\nYangi admin loginini kiriting (Hozirgi: ' + db.getSetting('admin_login') + '):',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // Action: List admins
  bot.action('admin_list_admins', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const admins = db.getAllAdmins();
    let text = `👥 <b>Adminlar ro'yxati:</b>\n\n`;
    admins.forEach((a, i) => {
      text += `${i + 1}. <b>${a.full_name}</b> (ID: ${a.telegram_id || 'Kiritilmagan'})\n   Rol: ${a.role}\n`;
    });
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // Action: Home / Cancel back
  bot.action('admin_home', async (ctx) => {
    if (!checkAdmin(ctx)) return;
    await ctx.answerCbQuery();
    clearSession(ctx.from.id);
    return ctx.reply('📌 Asosiy boshqaruv menyusi:', getAdminKeyboard());
  });

  // Cancel hearing
  bot.hears('❌ Bekor qilish', async (ctx) => {
    clearSession(ctx.from.id);
    if (checkAdmin(ctx)) {
      return ctx.reply('❌ Amal bekor qilindi.', getAdminKeyboard());
    }
    const worker = db.getWorkerByTelegramId(ctx.from.id);
    if (worker) {
      const { getWorkerKeyboard } = require('../keyboards');
      return ctx.reply('❌ Amal bekor qilindi.', getWorkerKeyboard());
    }
    return ctx.reply('❌ Amal bekor qilindi.');
  });
}

module.exports = {
  registerAdminHandlers
};
