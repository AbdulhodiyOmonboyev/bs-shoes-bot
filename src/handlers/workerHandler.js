const { Markup } = require('telegraf');
const db = require('../database');
const { getWorkerKeyboard, getWorkerCheckInKeyboard, getCancelKeyboard } = require('../keyboards');
const { setSession, getSession, clearSession } = require('../utils/session');
const { formatMoney, formatDuration, getTashkentDate, getTashkentTime, diffMinutes } = require('../utils/helpers');
const { calculateDistance } = require('../utils/distance');
const {
  notifyAllAdmins,
  notifyWorkerCheckIn,
  notifyWorkerCheckOut
} = require('../services/notificationService');

function registerWorkerHandlers(bot) {
  function getWorker(ctx) {
    return db.getWorkerByTelegramId(ctx.from.id);
  }

  // -------------------------------------------------------------
  // 1. ISHGA KELDIM (Check-in)
  // -------------------------------------------------------------
  bot.hears('🟢 Ishga keldim', async (ctx) => {
    const worker = getWorker(ctx);
    if (!worker) return;
    clearSession(ctx.from.id);

    const today = getTashkentDate();
    const existing = db.getWorkerTodayAttendance(worker.id, today);
    if (existing) {
      return ctx.reply(
        `⚠️ Siz bugun soat <b>${existing.check_in_time}</b> da allaqachon ishga kelgansiz!`,
        { parse_mode: 'HTML' }
      );
    }

    const settings = db.getAllSettings();

    // Check if GPS geofencing is enabled and configured
    if (settings.factory_location_enabled === '1' && settings.factory_latitude && settings.factory_longitude) {
      setSession(ctx.from.id, { step: 'awaiting_worker_checkin_location' });
      return ctx.reply(
        '📍 Davomatni tasdiqlash uchun iltimos, <b>hozirgi joylashuvingizni (lokatsiyangizni)</b> yuboring:',
        { parse_mode: 'HTML', ...getWorkerCheckInKeyboard() }
      );
    }

    // Direct check-in without geofencing
    await performCheckIn(ctx, worker);
  });

  async function performCheckIn(ctx, worker, latitude = null, longitude = null) {
    const today = getTashkentDate();
    const checkInTime = getTashkentTime();
    const settings = db.getAllSettings();

    // Work start time
    const expectedTime = worker.work_start_time || (worker.role === 'student' ? settings.work_start_student : settings.work_start_worker);
    const graceMinutes = Number(settings.grace_period_minutes || 15);
    const lateFine = Number(settings.late_fine_amount || 10000);
    const onTimeBonus = Number(settings.on_time_bonus_amount || 5000);

    const minutesDiff = diffMinutes(checkInTime, expectedTime);

    let bonusAmount = 0;
    let fineAmount = 0;
    let statusMsg = '';

    if (minutesDiff <= graceMinutes) {
      // On time or early!
      bonusAmount = onTimeBonus;
      statusMsg = `\n🎁 <b>Vaqtida kelganingiz uchun bonus:</b> +${formatMoney(bonusAmount)}`;
    } else {
      // Late!
      fineAmount = lateFine;
      statusMsg = `\n⚠️ <b>Kechikkaningiz uchun jarima:</b> -${formatMoney(fineAmount)} (Kechikish: ${minutesDiff} daqiqa)`;
    }

    db.checkInWorker(worker.id, {
      checkInTime,
      bonusAmount,
      fineAmount,
      latitude,
      longitude
    });

    clearSession(ctx.from.id);

    const roleIcon = worker.role === 'student' ? '🎒' : '👷‍♂️';
    await ctx.reply(
      `🟢 <b>Ishga kelishingiz muvaffaqiyatli qayd etildi!</b>\n\n` +
      `👤 ${roleIcon} <b>${worker.full_name}</b>\n` +
      `⏰ Belgilangan vaqtingiz: <b>${expectedTime}</b>\n` +
      `🕒 Kelgan vaqtingiz: <b>${checkInTime}</b>` +
      statusMsg + `\n\nKuningiz barakali va unumli o'tsin!`,
      { parse_mode: 'HTML', ...getWorkerKeyboard() }
    );

    // Notify admins
    await notifyWorkerCheckIn(worker, checkInTime, bonusAmount, fineAmount);
  }

  // Handle location for worker check-in
  bot.on('location', async (ctx) => {
    const session = getSession(ctx.from.id);
    const location = ctx.message.location;

    // 1. Factory location setup by Admin
    if (session && session.step === 'awaiting_factory_location') {
      const admin = db.getAdminByTelegramId(ctx.from.id);
      if (admin) {
        db.setSetting('factory_latitude', location.latitude);
        db.setSetting('factory_longitude', location.longitude);
        db.setSetting('factory_location_enabled', '1');
        clearSession(ctx.from.id);
        const { getAdminKeyboard } = require('../keyboards');
        return ctx.reply(
          `✅ <b>Sex lokatsiyasi muvaffaqiyatli saqlandi va faollashtirildi!</b>\n\n` +
          `Latitude: ${location.latitude}\nLongitude: ${location.longitude}\n` +
          `Endi ishchilar faqat sex hududidan davomat qila olishadi.`,
          { parse_mode: 'HTML', ...getAdminKeyboard() }
        );
      }
    }

    // 2. Worker check-in location
    if (session && session.step === 'awaiting_worker_checkin_location') {
      const worker = getWorker(ctx);
      if (!worker) return;

      const settings = db.getAllSettings();
      const factoryLat = Number(settings.factory_latitude);
      const factoryLon = Number(settings.factory_longitude);
      const radius = Number(settings.factory_radius_meters || 250);

      const distance = calculateDistance(location.latitude, location.longitude, factoryLat, factoryLon);

      if (distance > radius) {
        return ctx.reply(
          `⚠️ <b>Siz sex hududidan tashqaridasiz!</b>\n\n` +
          `Siz sexdan <b>${distance} metr</b> uzoqlikdasiz. Ruxsat etilgan masofa: <b>${radius} metr</b>.\n` +
          `Iltimos, sex hududiga kelib qayta urinib ko'ring.`,
          { parse_mode: 'HTML' }
        );
      }

      await performCheckIn(ctx, worker, location.latitude, location.longitude);
    }
  });

  // -------------------------------------------------------------
  // 2. ISHNI TUGATDIM (Check-out)
  // -------------------------------------------------------------
  bot.hears('🔴 Ishni tugatdim', async (ctx) => {
    const worker = getWorker(ctx);
    if (!worker) return;
    clearSession(ctx.from.id);

    const today = getTashkentDate();
    const attendance = db.getWorkerTodayAttendance(worker.id, today);

    if (!attendance) {
      return ctx.reply('⚠️ Siz bugun ishga kelishni belgilamagansiz!');
    }

    if (attendance.check_out_time) {
      return ctx.reply(
        `⚠️ Siz bugun soat <b>${attendance.check_out_time}</b> da allaqachon ishni yakunlagansiz!`,
        { parse_mode: 'HTML' }
      );
    }

    const checkOutTime = getTashkentTime();
    const workedMinutes = Math.max(0, diffMinutes(checkOutTime, attendance.check_in_time));

    db.checkOutWorker(worker.id, {
      checkOutTime,
      workedMinutes
    });

    const roleIcon = worker.role === 'student' ? '🎒' : '👷‍♂️';
    await ctx.reply(
      `🔴 <b>Ishni yakunlashingiz muvaffaqiyatli qayd etildi!</b>\n\n` +
      `👤 ${roleIcon} <b>${worker.full_name}</b>\n` +
      `⏱ Ishlagan vaqtingiz: <b>${formatDuration(workedMinutes)}</b>\n` +
      `🕒 Yakunlangan vaqt: <b>${checkOutTime}</b>\n\n` +
      `Charchamang, yaxshi dam oling!`,
      { parse_mode: 'HTML', ...getWorkerKeyboard() }
    );

    // Notify admins (matching user screenshot)
    await notifyWorkerCheckOut(
      worker,
      checkOutTime,
      workedMinutes,
      attendance.fine_amount,
      attendance.bonus_amount
    );
  });

  // -------------------------------------------------------------
  // 3. ISH TOPSHIRISH (Submit work)
  // -------------------------------------------------------------
  bot.hears('📥 Ish topshirish', async (ctx) => {
    const worker = getWorker(ctx);
    if (!worker) return;
    clearSession(ctx.from.id);

    const jobTypes = db.getAllJobTypes(true);
    if (jobTypes.length === 0) {
      return ctx.reply('⚠️ Hozircha sexda ish turlari belgilanmagan.');
    }

    let text = `📥 <b>Qaysi ish turidan topshirmoqchisiz?</b>\n\nQuyidagi bo'limlardan birini tanlang:`;
    const buttons = [];
    jobTypes.forEach(j => {
      buttons.push([
        Markup.button.callback(`🛠 ${j.name} (${formatMoney(j.price)} / ${j.unit})`, `worker_submit_job_${j.id}`)
      ]);
    });

    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Action: Select Job Type to Submit
  bot.action(/^worker_submit_job_(\d+)$/, async (ctx) => {
    const worker = getWorker(ctx);
    if (!worker) return;
    await ctx.answerCbQuery();

    const jobId = Number(ctx.match[1]);
    const job = db.getJobTypeById(jobId);
    if (!job) return ctx.reply('⚠️ Ish turi topilmadi.');

    setSession(ctx.from.id, { step: 'worker_input_job_qty', jobId });
    return ctx.reply(
      `🛠 <b>${job.name}</b> bo'yicha nechta <b>${job.unit}</b> ish qildingiz?\n\n` +
      `Faqat son kiriting (Masalan: <b>120</b>):`,
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });

  // -------------------------------------------------------------
  // 4. MENING HISOBIM (My Balance & Financials)
  // -------------------------------------------------------------
  bot.hears('💰 Mening hisobim', async (ctx) => {
    const worker = getWorker(ctx);
    if (!worker) return;
    clearSession(ctx.from.id);

    const currentPeriod = db.getCurrentPeriod();
    const f = db.getWorkerPeriodFinancials(worker.id, currentPeriod.id);
    const submissions = db.getWorkerSubmissionsByPeriod(worker.id, currentPeriod.id);

    let text = `💰 <b>Mening hisobim (#${currentPeriod.period_number}-davr)</b>\n\n`;
    text += `🛠 <b>Bajarilgan ishlar:</b> ${formatMoney(f.totalWork)}\n`;
    text += `🎁 <b>Bonuslar (+):</b> ${formatMoney(f.totalBonus)}\n`;
    text += `⚠️ <b>Kechikish jarimasi (-):</b> ${formatMoney(f.totalLateFine)}\n`;
    text += `🚫 <b>Boshqa jarimalar (-):</b> ${formatMoney(f.totalFines)}\n`;
    text += `💸 <b>Olingan avanslar (-):</b> ${formatMoney(f.totalAdvances)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💵 <b>JORIY SOF BALANSINGIZ:</b> <b>${formatMoney(f.netSalary)}</b>\n\n`;

    if (submissions.length > 0) {
      text += `📋 <b>So'nggi tasdiqlangan ishlar:</b>\n`;
      submissions.slice(0, 5).forEach((s, i) => {
        text += `${i + 1}. ${s.job_name}: ${s.quantity} ${s.job_unit} = ${formatMoney(s.total_price)}\n`;
      });
    } else {
      text += `<i>Ushbu davrda hali tasdiqlangan ishlar yo'q.</i>\n`;
    }

    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // -------------------------------------------------------------
  // 5. DAVOMATIM (My Attendance)
  // -------------------------------------------------------------
  bot.hears('⏱ Davomatim', async (ctx) => {
    const worker = getWorker(ctx);
    if (!worker) return;
    clearSession(ctx.from.id);

    const history = db.getAttendanceHistory(worker.id, 10);
    if (history.length === 0) {
      return ctx.reply('⚠️ Hozircha sizda davomat yozuvlari yo\'q.');
    }

    let text = `⏱ <b>Sizning so'nggi kunlardagi davomatingiz:</b>\n\n`;
    history.forEach((h, i) => {
      const out = h.check_out_time ? `dan ${h.check_out_time} gacha (${formatDuration(h.worked_minutes)})` : ' (Hali ishda)';
      const bonusFine = h.bonus_amount > 0 ? ` 🎁 +${formatMoney(h.bonus_amount)}` : h.fine_amount > 0 ? ` ⚠️ -${formatMoney(h.fine_amount)}` : '';
      text += `📅 <b>${h.date}</b>: ${h.check_in_time} ${out}${bonusFine}\n`;
    });

    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  // -------------------------------------------------------------
  // 6. AVANS SO'RASH (Request advance)
  // -------------------------------------------------------------
  bot.hears('💸 Avans so\'rash', async (ctx) => {
    const worker = getWorker(ctx);
    if (!worker) return;
    clearSession(ctx.from.id);

    setSession(ctx.from.id, { step: 'worker_request_advance' });
    return ctx.reply(
      '💸 <b>Avans so\'rash:</b>\n\nSizga qancha avans kerak? Summani kiriting (Masalan: <b>50000</b>):',
      { parse_mode: 'HTML', ...getCancelKeyboard() }
    );
  });
}

module.exports = {
  registerWorkerHandlers
};
