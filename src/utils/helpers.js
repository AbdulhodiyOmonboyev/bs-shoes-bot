const dayjs = require('dayjs');

/**
 * Format number as currency string: 10000 -> "10 000 so'm"
 */
function formatMoney(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return "0 so'm";
  const num = Math.round(Number(amount));
  const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} so'm`;
}

/**
 * Format minutes into hours and minutes: 125 -> "2 soat 5 daqiqa"
 */
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0 daqiqa';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) {
    return `${hrs} soat ${mins} daqiqa`;
  } else if (hrs > 0) {
    return `${hrs} soat`;
  }
  return `${mins} daqiqa`;
}

/**
 * Get current Tashkent date (YYYY-MM-DD)
 */
function getTashkentDate() {
  const now = new Date();
  // Uzbekistan is UTC+5
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const uzTime = new Date(utc + 3600000 * 5);
  return uzTime.toISOString().slice(0, 10);
}

/**
 * Get current Tashkent time (HH:mm)
 */
function getTashkentTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const uzTime = new Date(utc + 3600000 * 5);
  const hours = String(uzTime.getHours()).padStart(2, '0');
  const minutes = String(uzTime.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get current ISO datetime string formatted
 */
function getTashkentDateTime() {
  return `${getTashkentDate()} ${getTashkentTime()}`;
}

/**
 * Compare time HH:mm with another time HH:mm
 * returns difference in minutes (time1 - time2)
 */
function diffMinutes(time1, time2) {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return (h1 * 60 + m1) - (h2 * 60 + m2);
}

module.exports = {
  formatMoney,
  formatDuration,
  getTashkentDate,
  getTashkentTime,
  getTashkentDateTime,
  diffMinutes
};
