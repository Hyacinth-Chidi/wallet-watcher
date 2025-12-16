import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import crypto from 'crypto';
import axios from 'axios';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

console.log('✅ Imports successful');

// Use top-level awaits (Node.js 18+)
let config, CHAIN_CONFIG;
try {
  const configModule = await import('../config/index.js');
  config = configModule.default;
  CHAIN_CONFIG = configModule.CHAIN_CONFIG;
  console.log('✅ Config loaded');
} catch (e) {
  console.error('❌ Error loading config:', e.message);
  process.exit(1);
}

let connectDatabase, TrackedWallet;
try {
  const modelsModule = await import('../models/index.js');
  connectDatabase = modelsModule.connectDatabase;
  TrackedWallet = modelsModule.TrackedWallet;
  console.log('✅ Models loaded');
} catch (e) {
  console.error('❌ Error loading models:', e.message);
  process.exit(1);
}

let logger;
try {
  const loggerModule = await import('../utils/logger.js');
  logger = loggerModule.default;
  console.log('✅ Logger loaded');
} catch (e) {
  console.error('❌ Error loading logger:', e.message);
  process.exit(1);
}

let formatNativeTransaction, formatTokenTransaction;
try {
  const formattersModule = await import('../utils/formatters.js');
  formatNativeTransaction = formattersModule.formatNativeTransaction;
  formatTokenTransaction = formattersModule.formatTokenTransaction;
  console.log('✅ Formatters loaded');
} catch (e) {
  console.error('❌ Error loading formatters:', e.message);
  process.exit(1);
}

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Serverless DB Connection Middleware
app.use(async (req, res, next) => {
  // If it's a root path test request, we might want to skip DB connection to pass verification?
  // But strictly, we shouldn't. Let's try to connect.
  if (mongoose.connection.readyState !== 1) {
    try {
      if (!config.mongodb.uri) {
        console.error('CRITICAL: MONGODB_URI is missing!');
        return res.status(500).json({ error: 'Configuration Error: MONGODB_URI missing' });
      }
      await connectDatabase(config.mongodb.uri);
    } catch (error) {
      logger.error('Database connection failed in middleware:', error);
      return res.status(500).json({ error: 'Database connection failed. Check your connection string and network access.' });
    }
  }
  next();
});

/**
 * Verify Moralis webhook signature
 */
function verifyWebhookSignature(body, signature) {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', config.moralis.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error(`Signature verification error: ${error.message}`);
    return false;
  }
}

/**
 * Send alert directly to Telegram
 */
async function sendAlertToBot(userId, message) {
  try {
    const token = config.telegram.botToken;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    // Send directly to Telegram API
    const response = await axios.post(url, {
      chat_id: userId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    if (response.data && response.data.ok) {
      logger.info(`✅ Alert sent to user ${userId}`);
    } else {
      logger.error(`Failed to send alert: ${response.data?.description || 'Unknown error'}`);
    }
  } catch (error) {
    logger.error(`Error sending alert to user ${userId}: ${error.message}`);
    if (error.response?.data) {
      logger.error('Telegram API error:', error.response.data);
    }
  }
}

/**
 * Process a single transaction
 */
async function processTransaction(txData, webhookData) {
  try {
    // Extract chain information
    const chainId = webhookData.chainId || '';

    // Map chain_id to chain_ticker
    let chainTicker = null;
    for (const [ticker, chainConfig] of Object.entries(CHAIN_CONFIG)) {
      if (chainConfig.moralisChain === chainId) {
        chainTicker = ticker;
        break;
      }
    }

    if (!chainTicker) {
      logger.warn(`Unknown chain ID: ${chainId}`);
      return;
    }

    // Get addresses involved
    const fromAddr = (txData.fromAddress || '').toLowerCase();
    const toAddr = (txData.toAddress || '').toLowerCase();

    // Check both addresses for tracked wallets
    const trackedAddresses = [];
    if (fromAddr) trackedAddresses.push(fromAddr);
    if (toAddr) trackedAddresses.push(toAddr);

    // Process each tracked address
    for (const address of trackedAddresses) {
      // Get subscribers for this wallet
      const wallet = await TrackedWallet.findOne({
        address: address,
        chainTicker: chainTicker
      });

      if (!wallet || !wallet.trackingUserIds || wallet.trackingUserIds.length === 0) {
        continue;
      }

      const subscribers = wallet.trackingUserIds;

      // Determine transaction type and format message
      let message;

      if (webhookData.erc20Transfers && webhookData.erc20Transfers.length > 0) {
        // Token transfer
        for (const tokenTransfer of webhookData.erc20Transfers) {
          message = formatTokenTransaction(tokenTransfer, chainTicker, address);

          // Send to all subscribers
          for (const userId of subscribers) {
            await sendAlertToBot(userId, message);
          }
        }
      } else {
        // Native transaction
        message = formatNativeTransaction(txData, chainTicker, address);

        // Send to all subscribers
        for (const userId of subscribers) {
          await sendAlertToBot(userId, message);
        }
      }
    }
  } catch (error) {
    logger.error(`Error processing transaction: ${error.message}`);
  }
}

/**
 * Main webhook endpoint
 */
app.post(config.server.webhookPath, async (req, res) => {
  try {
    console.log('🔔 Webhook received');
    
    const signature = req.headers['x-signature'];

    // Handle Moralis test request (no signature)
    if (!signature) {
      console.log('📝 No signature - likely a test request from Moralis');
      return res.status(200).json({ 
        success: true, 
        message: 'Webhook endpoint is working. Ready to receive events.' 
      });
    }

    if (!verifyWebhookSignature(req.body, signature)) {
      logger.warn('⚠️ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhookData = req.body;
    logger.info(`📨 Webhook received: ${webhookData.tag || 'unknown'}`);

    // Extract transactions
    const txs = webhookData.txs || [];

    if (txs.length === 0) {
      logger.warn('No transactions in webhook');
      return res.json({ status: 'ok', message: 'No transactions' });
    }

    // Process each transaction (async, don't wait)
    await Promise.all(txs.map(tx => processTransaction(tx, webhookData)))
      .catch(error => logger.error(`Error processing transactions: ${error.message}`));

    res.json({
      status: 'ok',
      processed: txs.length
    });

  } catch (error) {
    logger.error(`❌ Webhook processing error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: 'Wallet Tracker Webhook Service',
    status: 'running',
    webhook_endpoint: config.server.webhookPath,
    version: '1.0.0'
  });
});

// Handle POST to root (common configuration error)
app.post('/', (req, res) => {
  console.log('⚠️ Webhook received at root path /');
  
  // If it's a test request (no signature), return 200 to pass verification
  if (!req.headers['x-signature']) {
    console.log('📝 Root path test request - returning 200');
    return res.status(200).json({ 
      success: true, 
      message: 'Service is running. Please use /webhook/moralis for actual events.' 
    });
  }
  
  res.status(400).json({ error: `Please use ${config.server.webhookPath} endpoint for webhook events` });
});

/**
 * Start webhook service
 */
async function startWebhookService() {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    console.log('URI:', config.mongodb.uri ? 'Set (Hidden)' : 'Not Set');
    
    // Connect to database if not already connected
    if (mongoose.connection.readyState !== 1) {
      await connectDatabase(config.mongodb.uri);
      console.log('✅ MongoDB connected successfully');
    }

    // Start server
    const port = config.server.webhookPort;
    app.listen(port, () => {
      if (logger) {
        logger.info(`🚀 Webhook service started on port ${port}`);
        logger.info(`📡 Webhook endpoint: ${config.server.webhookPath}`);
      }
      console.log(`✅ Server is listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start webhook service:', error.message);
    if (logger) logger.error(`Failed to start webhook service: ${error.message}`);
    process.exit(1);
  }
}

// Start the service ONLY if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('🚀 Starting webhook service...');
  startWebhookService().catch(err => {
    console.error('❌ Unhandled error in startWebhookService:', err);
    process.exit(1);
  });
}

export default app;
