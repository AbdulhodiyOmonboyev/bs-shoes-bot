require('dotenv').config();
const { createBot } = require('./src/bot');
const { startWebServer } = require('./src/server');

const token = process.env.BOT_TOKEN;

if (!token || token.trim() === '') {
  console.error('❌ [XATOLIK] BOT_TOKEN .env faylida topilmadi!');
  process.exit(1);
}

// 1. Web serverni ishga tushirish
const PORT = process.env.PORT || 3000;
startWebServer(PORT);

// 2. Telegram botni yaratish
const bot = createBot(token);

// 3. Botni polling orqali ishga tushirish
async function launchBot() {
  try {
    const me = await bot.telegram.getMe();
    console.log('\n' + '='.repeat(60));
    console.log(' 🚀 BS-SHOES Boshqaruv Telegram Boti muvaffaqiyatli ishga tushdi!');
    console.log(` 🤖 Bot username: @${me.username}`);
    console.log(` 🔑 Admin kirish uchun Telegramda /admin buyrug'ini bering.`);
    console.log(` 👤 Standart login: admin | Parol: admin777`);
    console.log('='.repeat(60) + '\n');

    await bot.launch({
      dropPendingUpdates: false
    });
  } catch (err) {
    console.error('❌ Botni ishga tushirishda xatolik:', err.message);
    console.log('5 soniyadan so\'ng qayta ulanishga harakat qilinmoqda...');
    setTimeout(launchBot, 5000);
  }
}

launchBot();

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('Bot to\'xtatilmoqda (SIGINT)...');
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  console.log('Bot to\'xtatilmoqda (SIGTERM)...');
  bot.stop('SIGTERM');
  process.exit(0);
});
