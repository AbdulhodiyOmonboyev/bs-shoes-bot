const { Telegraf } = require('telegraf');
const { registerAuthHandlers } = require('./handlers/authHandler');
const { registerAdminHandlers } = require('./handlers/adminHandler');
const { registerWorkerHandlers } = require('./handlers/workerHandler');
const { registerClientHandlers } = require('./handlers/clientHandler');
const { registerWizardHandlers } = require('./handlers/wizardHandler');
const { setBotInstance } = require('./services/notificationService');

function createBot(token) {
  const bot = new Telegraf(token);

  // Set bot instance for background alerts/notifications
  setBotInstance(bot);

  // Register all handlers in proper priority order
  registerAuthHandlers(bot);
  registerAdminHandlers(bot);
  registerWorkerHandlers(bot);
  registerClientHandlers(bot);
  registerWizardHandlers(bot);

  // Error handling
  bot.catch((err, ctx) => {
    console.error(`[Telegraf Error] (${ctx?.updateType}):`, err.message);
  });

  return bot;
}

module.exports = {
  createBot
};
