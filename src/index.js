import { validateConfig } from './config/index.js';
import logger from './utils/logger.js';

/**
 * Main entry point - starts both bot and webhook services
 */
async function main() {
  try {
    logger.info('🚀 Starting Wallet Tracker Bot...');

    // Validate configuration
    validateConfig();
    logger.info('✅ Configuration validated');

    // Import and start both services
    const botServiceModule = await import('./services/bot.service.js');
    const webhookServiceModule = await import('./services/webhook.service.js');

    logger.info('✅ All services started successfully');
    logger.info('📊 Bot is now running and ready to track wallets!');

  } catch (error) {
    logger.error(`❌ Failed to start application: ${error.message}`);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Start application
main();