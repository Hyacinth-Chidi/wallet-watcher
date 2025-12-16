import dotenv from 'dotenv';

dotenv.config();

// Chain configurations
export const CHAIN_CONFIG = {
  ETH: {
    name: 'Ethereum',
    moralisChain: '0x1',
    explorer: 'https://etherscan.io',
    nativeSymbol: 'ETH',
    decimals: 18,
    icon: '⟠'
  },
  BSC: {
    name: 'BNB Smart Chain',
    moralisChain: '0x38',
    explorer: 'https://bscscan.com',
    nativeSymbol: 'BNB',
    decimals: 18,
    icon: '🟡'
  },
  POLYGON: {
    name: 'Polygon',
    moralisChain: '0x89',
    explorer: 'https://polygonscan.com',
    nativeSymbol: 'MATIC',
    decimals: 18,
    icon: '🟣'
  },
  AVALANCHE: {
    name: 'Avalanche',
    moralisChain: '0xa86a',
    explorer: 'https://snowtrace.io',
    nativeSymbol: 'AVAX',
    decimals: 18,
    icon: '🔺'
  },
  ARBITRUM: {
    name: 'Arbitrum',
    moralisChain: '0xa4b1',
    explorer: 'https://arbiscan.io',
    nativeSymbol: 'ETH',
    decimals: 18,
    icon: '🔵'
  },
  OPTIMISM: {
    name: 'Optimism',
    moralisChain: '0xa',
    explorer: 'https://optimistic.etherscan.io',
    nativeSymbol: 'ETH',
    decimals: 18,
    icon: '🔴'
  },
  BASE: {
    name: 'Base',
    moralisChain: '0x2105',
    explorer: 'https://basescan.org',
    nativeSymbol: 'ETH',
    decimals: 18,
    icon: '🔷'
  },
  SOL: {
    name: 'Solana',
    moralisChain: 'solana',
    explorer: 'https://solscan.io',
    nativeSymbol: 'SOL',
    decimals: 9,
    icon: '◎'
  }
};

// Application configuration
export const config = {
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    adminIds: process.env.TELEGRAM_ADMIN_IDS ? 
      process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : []
  },

  // Moralis
  moralis: {
    apiKey: process.env.MORALIS_API_KEY,
    webhookSecret: process.env.MORALIS_WEBHOOK_SECRET,
    baseUrl: 'https://api.moralis-streams.com/streams'
  },

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Server
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 3000,
    webhookPort: parseInt(process.env.WEBHOOK_PORT) || 8000,
    webhookPublicUrl: process.env.WEBHOOK_PUBLIC_URL,
    webhookPath: process.env.WEBHOOK_PATH || '/webhook/moralis'
  },

  // Security
  security: {
    apiSecretKey: process.env.API_SECRET_KEY,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },

  // Chains
  chains: {
    supported: process.env.SUPPORTED_CHAINS ? 
      process.env.SUPPORTED_CHAINS.split(',').map(chain => chain.trim().toUpperCase()) : 
      ['ETH', 'BSC', 'POLYGON', 'AVALANCHE', 'ARBITRUM', 'OPTIMISM', 'BASE', 'SOL']
  }
};

// Validate required environment variables
export function validateConfig() {
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'MORALIS_API_KEY',
    'MORALIS_WEBHOOK_SECRET',
    'MONGODB_URI',
    'WEBHOOK_PUBLIC_URL',
    'API_SECRET_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;