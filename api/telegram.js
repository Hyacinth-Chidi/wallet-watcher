import bot from '../src/services/bot.service.js';

export default async function handler(req, res) {
  // Silence unhandled promise rejection logging if not relevant for response
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });

  if (req.method === 'POST') {
    try {
      // Handle the update from Telegram
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Error handling update:', err);
      // Determine if we should fail or just log (fail might cause Telegram to retry)
      res.status(500).json({ error: 'Failed to process update' });
    }
  } else {
    // Basic health check for the endpoint
    res.status(200).json({ 
      status: 'online', 
      message: 'Telegram Bot Webhook Endpoint',
      info: 'Set this URL as your webhook in Telegram: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<THIS_URL>'
    });
  }
}
