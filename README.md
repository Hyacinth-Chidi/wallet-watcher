# 🤖 Multi-Chain Wallet Tracker Telegram Bot (Node.js)

A production-ready Telegram bot built with Node.js that tracks cryptocurrency wallet transactions across multiple blockchains in real-time using Moralis Streams API.

## ✨ Features

- **Multi-Chain Support**: ETH, BSC, Polygon, Avalanche, Arbitrum, Optimism, Base, Solana
- **Real-Time Alerts**: Instant notifications for native and token transactions
- **Multi-User**: Multiple users can track the same wallet efficiently
- **Scalable Architecture**: Separate bot and webhook services
- **Production Ready**: Docker support, health checks, logging, rate limiting
- **Rich Notifications**: Formatted alerts with transaction details and explorer links
- **Modern Stack**: Node.js 18+, Telegraf, Express, Mongoose

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Telegram  │◄────────┤  Bot Service │◄────────┤   Webhook   │
│    Users    │         │  (Telegraf)  │         │   Service   │
└─────────────┘         └──────────────┘         │  (Express)  │
                               │                  └─────────────┘
                               │                         ▲
                               ▼                         │
                        ┌──────────────┐                │
                        │   MongoDB    │                │
                        │   Database   │                │
                        └──────────────┘                │
                                                         │
                                                  ┌──────────────┐
                                                  │   Moralis    │
                                                  │  Streams API │
                                                  └──────────────┘
```

## 📋 Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Telegram Bot Token** - Get from [@BotFather](https://t.me/botfather)
3. **Moralis API Key** - Sign up at [moralis.io](https://moralis.io)
4. **MongoDB Atlas** - Free cluster at [mongodb.com](https://www.mongodb.com/cloud/atlas)
5. **Public URL** - For webhooks (ngrok for testing, or VPS/cloud for production)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Create project directory
mkdir wallet-tracker-bot
cd wallet-tracker-bot

# Copy all files to this directory

# Install dependencies
npm install
```

### 2. Configure Environment Variables

Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Get this from @BotFather
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Get this from moralis.io
MORALIS_API_KEY=your_moralis_api_key
MORALIS_WEBHOOK_SECRET=your_webhook_secret

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wallet_tracker

# Public URL for webhooks (use ngrok for testing)
WEBHOOK_PUBLIC_URL=https://your-domain.com

# Secret key for internal API communication
API_SECRET_KEY=generate_a_random_secret_key
```

### 3. Run the Application

#### Option A: Docker (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Option B: Manual (Development)

```bash
# Terminal 1: Start bot service
npm run start:bot

# Terminal 2: Start webhook service
npm run start:webhook

# Or start both together
npm start
```

#### Option C: Development with Auto-Reload

```bash
npm run dev
```

### 4. Setup Ngrok (For Testing)

If you don't have a public server:

```bash
# Install ngrok
# Download from https://ngrok.com

# Start ngrok tunnel
ngrok http 8000

# Copy the https URL (e.g., https://abc123.ngrok-free.app)
# Add it to .env as WEBHOOK_PUBLIC_URL
```

### 5. Create Bot with BotFather

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the instructions
3. Copy the bot token to your `.env` file
4. Customize your bot:
   ```
   /setdescription - Track crypto wallets across multiple chains
   /setabouttext - Real-time wallet transaction alerts
   /setcommands - Set these commands:
   start - Start the bot
   help - Show help message
   track - Track a wallet
   list - List tracked wallets
   untrack - Stop tracking a wallet
   stats - Show statistics
   ```

## 📱 Bot Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Start the bot | `/start` |
| `/help` | Show help message | `/help` |
| `/track` | Track a wallet | `/track ETH 0x742d35... MyWallet` |
| `/list` | List all tracked wallets | `/list` or `/list ETH` |
| `/untrack` | Stop tracking | `/untrack ETH 0x742d35...` |
| `/stats` | Show your statistics | `/stats` |

## 📂 Project Structure

```
wallet-tracker-bot/
├── src/
│   ├── config/
│   │   └── index.js           # Configuration management
│   ├── models/
│   │   └── index.js           # MongoDB schemas
│   ├── services/
│   │   ├── bot.service.js     # Telegram bot service
│   │   ├── webhook.service.js # Webhook receiver
│   │   └── moralis.service.js # Moralis API client
│   ├── utils/
│   │   ├── logger.js          # Winston logger
│   │   ├── validators.js      # Address validation
│   │   └── formatters.js      # Message formatting
│   └── index.js               # Main entry point
├── logs/                      # Application logs
├── .env                       # Environment variables
├── .env.example               # Environment template
├── package.json               # Dependencies
├── docker-compose.yml         # Docker orchestration
├── Dockerfile                 # Docker image
└── README.md                  # This file
```

## 🔧 Configuration

### Supported Chains

Edit `SUPPORTED_CHAINS` in `.env`:
```bash
SUPPORTED_CHAINS=ETH,BSC,POLYGON,AVALANCHE,ARBITRUM,OPTIMISM,BASE,SOL
```

### Rate Limiting

Adjust rate limits in `.env`:
```bash
RATE_LIMIT_WINDOW_MS=60000  # Window in milliseconds
RATE_LIMIT_MAX_REQUESTS=10  # Max requests per window
```

### Logging

Set log level in `.env`:
```bash
LOG_LEVEL=info  # debug, info, warn, error
```

## 🎯 Usage Examples

### Track an Ethereum Wallet
```
/track ETH 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb Vitalik
```

### Track a Solana Wallet
```
/track SOL DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK MyWallet
```

### List All Tracked Wallets
```
/list
```

### List ETH Wallets Only
```
/list ETH
```

### Stop Tracking
```
/untrack ETH 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

## 🐛 Troubleshooting

### Bot not responding
```bash
# Check bot service logs
docker-compose logs bot
# or
npm run start:bot

# Verify bot token
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
```

### Webhooks not working
```bash
# Check webhook service logs
docker-compose logs webhook

# Test webhook endpoint
curl -X POST http://localhost:8000/webhook/moralis \
  -H "Content-Type: application/json" \
  -H "x-signature: test" \
  -d '{"test": "data"}'
```

### Database connection errors
```bash
# Test MongoDB connection
node -e "
import('mongoose').then(m => {
  m.default.connect('your_mongodb_uri').then(() => {
    console.log('Connected!');
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
});
"
```

## 📊 Monitoring

### Health Checks

```bash
# Check bot service
curl http://localhost:3000/health

# Check webhook service
curl http://localhost:8000/health
```

### View Logs

```bash
# Docker logs
docker-compose logs -f

# Application logs
tail -f logs/combined.log
tail -f logs/error.log
```

### Monitor Resources

```bash
# Docker stats
docker stats

# System resources
npm install -g pm2
pm2 monit
```

## 🚀 Deployment

### Deploy to VPS

1. **Setup VPS** (Ubuntu 22.04)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo apt install docker-compose -y
```

2. **Deploy Application**
```bash
# Clone or upload files
cd /opt/wallet-tracker

# Configure environment
cp .env.example .env
nano .env

# Start with Docker
docker-compose up -d

# Or use PM2 for Node.js
npm install -g pm2
pm2 start src/index.js --name wallet-tracker
pm2 save
pm2 startup
```

3. **Setup Nginx (Optional)**
```bash
sudo apt install nginx -y

# Configure Nginx
sudo nano /etc/nginx/sites-available/wallet-tracker

# Add SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### Deploy to Heroku

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create wallet-tracker-bot

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set MORALIS_API_KEY=your_key
# ... set all other variables

# Deploy
git push heroku main
```

## 🔒 Security

- ✅ Webhook signature verification
- ✅ API key authentication between services
- ✅ Environment variable configuration
- ✅ Rate limiting per user
- ✅ Input validation and sanitization
- ✅ Helmet.js security headers
- ✅ CORS protection

## 🧪 Testing

```bash
# Run tests
npm test

# Lint code
npm run lint

# Test individual services
npm run start:bot
npm run start:webhook
```

## 📈 Performance

- Async/await throughout for non-blocking operations
- Connection pooling for MongoDB
- Rate limiting to prevent abuse
- Efficient database queries with indexes
- Logging with rotation
- Health checks for monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file

## 💡 Support

- Open an issue for bug reports
- Star the repo if you find it useful
- Share with other developers

## 🎉 Acknowledgments

- [Telegraf](https://telegraf.js.org/) - Telegram Bot framework
- [Moralis](https://moralis.io) - Blockchain data provider
- [Express](https://expressjs.com/) - Web framework
- [Mongoose](https://mongoosejs.com/) - MongoDB ODM
- [Ethers.js](https://docs.ethers.org/) - Ethereum library

---

Built with ❤️ for the crypto community