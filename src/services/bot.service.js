import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config, { CHAIN_CONFIG } from '../config/index.js';
import { connectDatabase, User, TrackedWallet } from '../models/index.js';
import logger from '../utils/logger.js';
import { validateAddress, validateAlias, formatAddress } from '../utils/validators.js';
import moralisService from './moralis.service.js';
import {
  formatWalletList,
  formatHelpMessage,
  formatStatsMessage
} from '../utils/formatters.js';
import { fileURLToPath } from 'url';

// Initialize bot
const bot = new Telegraf(config.telegram.botToken);

// Initialize Express for internal API
const app = express();
app.use(helmet());
app.use(express.json());

// Rate limiting for commands
const userCommandCounts = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = config.security.rateLimitWindowMs;
  const maxRequests = config.security.rateLimitMaxRequests;

  if (!userCommandCounts.has(userId)) {
    userCommandCounts.set(userId, []);
  }

  const timestamps = userCommandCounts.get(userId);

  // Remove old timestamps
  const filtered = timestamps.filter(ts => now - ts < windowMs);
  userCommandCounts.set(userId, filtered);

  // Check limit
  if (filtered.length >= maxRequests) {
    return false;
  }

  // Add current timestamp
  filtered.push(now);
  return true;
}

/**
 * /start command
 */
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username;

    // Create or get user
    await User.findOneAndUpdate(
      { telegramId: userId },
      { telegramId: userId, username: username },
      { upsert: true, new: true }
    );

    const welcomeText = `
👋 <b>Welcome to Wallet Tracker Bot!</b>

Track crypto wallets across multiple blockchains and get instant notifications for every transaction.

<b>🔗 Supported Chains:</b>
${Object.entries(CHAIN_CONFIG).map(([ticker, cfg]) => 
  `${cfg.icon} ${ticker} - ${cfg.name}`
).join('\n')}

<b>Quick Start:</b>
1️⃣ Use /track to start monitoring a wallet
2️⃣ Receive real-time alerts for all transactions
3️⃣ Use /list to see your tracked wallets

Type /help for all commands.
`;

    await ctx.replyWithHTML(
      welcomeText,
      Markup.inlineKeyboard([
        [Markup.button.callback('📖 Help', 'help')],
        [Markup.button.callback('📊 My Wallets', 'list')]
      ])
    );
  } catch (error) {
    logger.error(`Error in /start: ${error.message}`);
    await ctx.reply('An error occurred. Please try again.');
  }
});

/**
 * /help command
 */
bot.help(async (ctx) => {
  try {
    await ctx.replyWithHTML(formatHelpMessage());
  } catch (error) {
    logger.error(`Error in /help: ${error.message}`);
  }
});

/**
 * /track command
 */
bot.command('track', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username;

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return await ctx.reply('⚠️ You\'re sending commands too quickly. Please wait a moment.');
    }

    const args = ctx.message.text.split(/\s+/).slice(1);

    if (args.length < 2) {
      return await ctx.replyWithHTML(
        '❌ <b>Invalid format!</b>\n\n' +
        'Usage: <code>/track &lt;CHAIN&gt; &lt;ADDRESS&gt; [ALIAS]</code>\n\n' +
        'Example:\n' +
        '<code>/track ETH 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb MyWallet</code>'
      );
    }

    const chainTicker = args[0].toUpperCase();
    const address = args[1];
    const alias = args.slice(2).join(' ') || null;

    // Validate chain
    if (!config.chains.supported.includes(chainTicker)) {
      return await ctx.replyWithHTML(
        `❌ <b>Unsupported chain: ${chainTicker}</b>\n\n` +
        `Supported chains: ${config.chains.supported.join(', ')}`
      );
    }

    // Validate alias
    if (alias) {
      const aliasValidation = validateAlias(alias);
      if (!aliasValidation.isValid) {
        return await ctx.reply(`❌ ${aliasValidation.error}`);
      }
    }

    // Validate address
    const validation = validateAddress(address, chainTicker);
    if (!validation.isValid) {
      return await ctx.reply(`❌ ${validation.error}`);
    }

    const normalizedAddress = validation.normalizedAddress;

    // Send processing message
    const processingMsg = await ctx.reply('⏳ Setting up tracking...');

    // Ensure user exists
    await User.findOneAndUpdate(
      { telegramId: userId },
      { telegramId: userId, username: username },
      { upsert: true, new: true }
    );

    // Check if wallet already exists
    let wallet = await TrackedWallet.findOne({
      address: normalizedAddress.toLowerCase(),
      chainTicker: chainTicker
    });

    if (wallet) {
      // Check if user is already tracking
      if (wallet.trackingUserIds.includes(userId)) {
        return await ctx.telegram.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          null,
          'ℹ️ You\'re already tracking this wallet!'
        );
      }

      // Add user to existing wallet
      wallet.trackingUserIds.push(userId);
      await wallet.save();

      await User.findOneAndUpdate(
        { telegramId: userId },
        { $addToSet: { trackedWalletIds: wallet._id } }
      );

      const chainConfig = CHAIN_CONFIG[chainTicker];
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        null,
        `✅ <b>Now tracking wallet!</b>\n\n` +
        `${chainConfig.icon} Chain: <b>${chainConfig.name}</b>\n` +
        `💼 Address: <code>${formatAddress(normalizedAddress, false)}</code>\n` +
        `🏷️ Alias: <b>${alias || 'None'}</b>\n\n` +
        `You'll receive alerts for all transactions on this wallet.`,
        { parse_mode: 'HTML' }
      );
    } else {
      // Create new stream on Moralis
      const webhookUrl = `${config.server.webhookPublicUrl}${config.server.webhookPath}`;
      const streamData = await moralisService.createStream(
        normalizedAddress,
        chainTicker,
        webhookUrl,
        `Track ${normalizedAddress.slice(0, 8)}... on ${chainTicker}`
      );

      if (!streamData) {
        return await ctx.telegram.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          null,
          '❌ Failed to create tracking stream. Please try again later.'
        );
      }

      // Create wallet in database
      wallet = new TrackedWallet({
        address: normalizedAddress.toLowerCase(),
        chainTicker: chainTicker,
        alias: alias,
        trackingUserIds: [userId],
        moralisStreamId: streamData.id
      });

      await wallet.save();

      // Add wallet to user
      await User.findOneAndUpdate(
        { telegramId: userId },
        { $addToSet: { trackedWalletIds: wallet._id } }
      );

      const chainConfig = CHAIN_CONFIG[chainTicker];
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        null,
        `✅ <b>Tracking started!</b>\n\n` +
        `${chainConfig.icon} Chain: <b>${chainConfig.name}</b>\n` +
        `💼 Address: <code>${formatAddress(normalizedAddress, false)}</code>\n` +
        `🏷️ Alias: <b>${alias || 'None'}</b>\n\n` +
        `🔔 You'll now receive real-time alerts for this wallet!`,
        { parse_mode: 'HTML' }
      );

      logger.info(`✅ User ${userId} tracking ${normalizedAddress} on ${chainTicker}`);
    }
  } catch (error) {
    logger.error(`Error in /track: ${error.message}`);
    await ctx.reply('❌ An error occurred while setting up tracking. Please try again later.');
  }
});

/**
 * /list command
 */
bot.command('list', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(/\s+/).slice(1);
    const chainFilter = args[0] ? args[0].toUpperCase() : null;

    // Validate chain filter
    if (chainFilter && !config.chains.supported.includes(chainFilter)) {
      return await ctx.reply(`❌ Unknown chain: ${chainFilter}`);
    }

    // Get user's wallets
    const wallets = await TrackedWallet.find({
      trackingUserIds: userId
    });

    const listMessage = formatWalletList(wallets, chainFilter);
    await ctx.replyWithHTML(listMessage);
  } catch (error) {
    logger.error(`Error in /list: ${error.message}`);
    await ctx.reply('An error occurred. Please try again.');
  }
});

/**
 * /untrack command
 */
bot.command('untrack', async (ctx) => {
  try {
    const userId = ctx.from.id;

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return await ctx.reply('⚠️ You\'re sending commands too quickly. Please wait a moment.');
    }

    const args = ctx.message.text.split(/\s+/).slice(1);

    if (args.length < 2) {
      return await ctx.replyWithHTML(
        '❌ <b>Invalid format!</b>\n\n' +
        'Usage: <code>/untrack &lt;CHAIN&gt; &lt;ADDRESS&gt;</code>\n\n' +
        'Example:\n' +
        '<code>/untrack ETH 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb</code>'
      );
    }

    const chainTicker = args[0].toUpperCase();
    const address = args[1];

    // Validate address
    const validation = validateAddress(address, chainTicker);
    if (!validation.isValid) {
      return await ctx.reply(`❌ ${validation.error}`);
    }

    const normalizedAddress = validation.normalizedAddress;
    const processingMsg = await ctx.reply('⏳ Removing tracking...');

    // Check if wallet exists and user is tracking it
    const wallet = await TrackedWallet.findOne({
      address: normalizedAddress.toLowerCase(),
      chainTicker: chainTicker
    });

    if (!wallet || !wallet.trackingUserIds.includes(userId)) {
      return await ctx.telegram.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        null,
        'ℹ️ You\'re not tracking this wallet.'
      );
    }

    // Remove user from wallet
    wallet.trackingUserIds = wallet.trackingUserIds.filter(id => id !== userId);

    if (wallet.trackingUserIds.length === 0) {
      // Delete Moralis stream
      if (wallet.moralisStreamId) {
        const isSolana = chainTicker === 'SOL';
        await moralisService.deleteStream(wallet.moralisStreamId, isSolana);
      }

      // Delete wallet
      await TrackedWallet.deleteOne({ _id: wallet._id });
    } else {
      await wallet.save();
    }

    // Remove wallet from user
    await User.findOneAndUpdate(
      { telegramId: userId },
      { $pull: { trackedWalletIds: wallet._id } }
    );

    const chainConfig = CHAIN_CONFIG[chainTicker];
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      processingMsg.message_id,
      null,
      `✅ <b>Stopped tracking wallet</b>\n\n` +
      `${chainConfig.icon} Chain: <b>${chainConfig.name}</b>\n` +
      `💼 Address: <code>${formatAddress(normalizedAddress, false)}</code>\n\n` +
      `You'll no longer receive alerts for this wallet.`,
      { parse_mode: 'HTML' }
    );

    logger.info(`✅ User ${userId} untracked ${normalizedAddress} on ${chainTicker}`);
  } catch (error) {
    logger.error(`Error in /untrack: ${error.message}`);
    await ctx.reply('❌ An error occurred. Please try again later.');
  }
});

/**
 * /stats command
 */
bot.command('stats', async (ctx) => {
  try {
    const userId = ctx.from.id;

    // Get user data
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return await ctx.reply('❌ User not found. Use /start first.');
    }

    // Get wallets
    const wallets = await TrackedWallet.find({
      trackingUserIds: userId
    });

    const statsMessage = formatStatsMessage(user, wallets);
    await ctx.replyWithHTML(statsMessage);
  } catch (error) {
    logger.error(`Error in /stats: ${error.message}`);
    await ctx.reply('An error occurred. Please try again.');
  }
});

/**
 * Callback query handlers
 */
bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithHTML(formatHelpMessage());
});

bot.action('list', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const wallets = await TrackedWallet.find({ trackingUserIds: userId });
  await ctx.replyWithHTML(formatWalletList(wallets));
});

/**
 * Express API endpoint for receiving alerts from webhook service
 */
const apiLimiter = rateLimit({
  windowMs: 1000,
  max: 100,
  message: 'Too many requests'
});

app.post('/send-alert', apiLimiter, async (req, res) => {
  try {
    const { userId, message, apiKey } = req.body;

    // Verify API key
    if (apiKey !== config.security.apiSecretKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Send message to user
    await bot.telegram.sendMessage(userId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    res.json({ status: 'sent' });
  } catch (error) {
    logger.error(`Error sending alert: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const dbState = mongoose.connection.readyState;

    // Check bot
    const botInfo = await bot.telegram.getMe();

    const status = {
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      service: 'bot',
      bot_username: botInfo.username,
      database: dbState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    };

    res.status(dbState === 1 ? 200 : 503).json(status);
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * Start bot service
 */
async function startBotService() {
  try {
    console.log('🚀 Starting bot service...');

    // Validate configuration
    console.log('🔍 Validating config...');
    const { validateConfig } = await import('../config/index.js');
    validateConfig();
    console.log('✅ Config validated');

    // Connect to database
    console.log('🔄 Connecting to MongoDB...');
    await connectDatabase(config.mongodb.uri);
    console.log('✅ MongoDB connected');

    // Start Express API server
    const port = config.server.port;
    app.listen(port, () => {
      console.log(`✅ Bot API server started on port ${port}`);
      logger.info(`🚀 Bot API server started on port ${port}`);
    });

    // Start bot
    console.log('🤖 Starting Telegram bot...');
    console.log('Bot token exists:', !!config.telegram.botToken);
    
    try {
      await Promise.race([
        bot.launch(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Bot launch timeout after 15 seconds')), 15000)
        )
      ]);
      
      const botInfo = await bot.telegram.getMe();
      console.log(`✅ Telegram bot started: @${botInfo.username}`);
      logger.info(`🤖 Telegram bot started: @${botInfo.username}`);
    } catch (botError) {
      console.error('❌ Bot launch failed:', botError.message);
      console.log('Trying polling mode instead...');
      
      // Try with polling mode
      bot.launch({ polling: true });
      console.log('✅ Bot started in polling mode');
      logger.info('✅ Bot started in polling mode');
    }

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

  } catch (error) {
    console.error('❌ Failed to start bot service:', error.message);
    console.error('Error stack:', error);
    logger.error(`Failed to start bot service: ${error.message}`);
    process.exit(1);
  }
}

// Start the service if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('🚀 Initializing bot service...');
  startBotService().catch(err => {
    console.error('❌ Unhandled error:', err);
    process.exit(1);
  });
}

export default bot;