const db = require('../database');
const { formatMoney, formatDuration } = require('../utils/helpers');

let botInstance = null;

function setBotInstance(bot) {
  botInstance = bot;
}

/**
 * Send message to all admins
 */
async function notifyAllAdmins(text, extra = {}) {
  if (!botInstance) return;
  const admins = db.getAllAdmins();
  for (const admin of admins) {
    if (admin.telegram_id) {
      try {
        await botInstance.telegram.sendMessage(admin.telegram_id, text, extra);
      } catch (err) {
        console.warn(`Admin ${admin.telegram_id} ga xabar yuborilmadi:`, err.message);
      }
    }
  }
}

/**
 * Send message to a specific worker
 */
async function notifyWorker(workerId, text, extra = {}) {
  if (!botInstance) return;
  const worker = db.getWorkerById(workerId);
  if (worker && worker.telegram_id) {
    try {
      await botInstance.telegram.sendMessage(worker.telegram_id, text, extra);
    } catch (err) {
      console.warn(`Ishchi ${worker.full_name} (${worker.telegram_id}) ga xabar yuborilmadi:`, err.message);
    }
  }
}

/**
 * Send message to a specific client
 */
async function notifyClient(clientId, text, extra = {}) {
  if (!botInstance) return;
  const client = db.getClientById(clientId);
  if (client && client.telegram_id) {
    try {
      await botInstance.telegram.sendMessage(client.telegram_id, text, extra);
    } catch (err) {
      console.warn(`Client ${client.name} (${client.telegram_id}) ga xabar yuborilmadi:`, err.message);
    }
  }
}

/**
 * Broadcast announcement to all active workers
 */
async function broadcastToWorkers(text, extra = {}) {
  if (!botInstance) return 0;
  const workers = db.getAllWorkers(true);
  let count = 0;
  for (const w of workers) {
    if (w.telegram_id) {
      try {
        await botInstance.telegram.sendMessage(w.telegram_id, text, extra);
        count++;
      } catch (err) {
        console.warn(`Ishchi ${w.full_name} ga e'lon bormadi:`, err.message);
      }
    }
  }
  return count;
}

/**
 * Worker check-in notification to admins
 */
async function notifyWorkerCheckIn(worker, checkInTime, bonusAmount, fineAmount) {
  const roleIcon = worker.role === 'student' ? '🎒' : '👷‍♂️';
  const roleName = worker.role === 'student' ? "O'quvchi" : "Ishchi";
  let alertText = '';
  if (bonusAmount > 0) {
    alertText = `\n🎁 Bonus: +${formatMoney(bonusAmount)}`;
  } else if (fineAmount > 0) {
    alertText = `\n⚠️ Kechikish jarimasi: -${formatMoney(fineAmount)}`;
  }

  const message = `🟢 ${roleIcon} ${roleName} ishga keldi\n\n` +
    `👤 ${worker.full_name.toUpperCase()} ${roleIcon}\n` +
    `🟢 Vaqt: ${checkInTime}\n` +
    `⏰ Belgilangan vaqti: ${worker.work_start_time || '09:00'}` +
    alertText;

  await notifyAllAdmins(message);
}

/**
 * Worker check-out notification to admins
 * (Matches screenshot format)
 */
async function notifyWorkerCheckOut(worker, checkOutTime, workedMinutes, fineAmount = 0, bonusAmount = 0) {
  const roleIcon = worker.role === 'student' ? '🎒' : '👷‍♂️';
  const roleName = worker.role === 'student' ? "O'quvchi" : "Ishchi";
  
  let extraText = '';
  if (fineAmount > 0) {
    extraText += `\n⚠️ Jarima: -${formatMoney(fineAmount)}`;
  }
  if (bonusAmount > 0) {
    extraText += `\n🎁 Bonus: +${formatMoney(bonusAmount)}`;
  }

  const message = `🔴 ${roleIcon} ${roleName} ishni yakunladi\n\n` +
    `👤 ${worker.full_name.toUpperCase()} ${roleIcon}\n` +
    `⏱ Ishlagan: ${formatDuration(workedMinutes)}\n` +
    `🔴 Vaqt: ${checkOutTime}` +
    extraText;

  await notifyAllAdmins(message);
}

module.exports = {
  setBotInstance,
  notifyAllAdmins,
  notifyWorker,
  notifyClient,
  broadcastToWorkers,
  notifyWorkerCheckIn,
  notifyWorkerCheckOut
};
