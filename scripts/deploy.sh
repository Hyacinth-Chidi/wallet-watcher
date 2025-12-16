#!/bin/bash

# Wallet Tracker Bot Deployment Script
# Usage: ./scripts/deploy.sh [production|staging]

set -e

ENV=${1:-production}

echo "🚀 Deploying Wallet Tracker Bot to $ENV environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file from .env.example"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Validate required variables
REQUIRED_VARS=(
    "TELEGRAM_BOT_TOKEN"
    "MORALIS_API_KEY"
    "MORALIS_WEBHOOK_SECRET"
    "MONGODB_URI"
    "WEBHOOK_PUBLIC_URL"
    "API_SECRET_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env"
        exit 1
    fi
done

echo "✅ Environment variables validated"

# Stop existing services
echo "🛑 Stopping existing services..."
if command -v docker-compose &> /dev/null; then
    docker-compose down 2>/dev/null || true
fi

if command -v pm2 &> /dev/null; then
    pm2 delete all 2>/dev/null || true
fi

# Clean up
echo "🧹 Cleaning up..."
rm -rf node_modules package-lock.json

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create logs directory
mkdir -p logs

# Choose deployment method
if [ "$ENV" = "production" ]; then
    if command -v docker-compose &> /dev/null; then
        echo "🐳 Deploying with Docker Compose..."
        docker-compose up -d --build
        echo "✅ Docker services started"
        
        # Wait for services to be healthy
        echo "⏳ Waiting for services to be healthy..."
        sleep 10
        
        # Check health
        echo "🏥 Checking service health..."
        curl -f http://localhost:3000/health || echo "⚠️ Bot service health check failed"
        curl -f http://localhost:8000/health || echo "⚠️ Webhook service health check failed"
        
    elif command -v pm2 &> /dev/null; then
        echo "📊 Deploying with PM2..."
        pm2 start ecosystem.config.js
        pm2 save
        echo "✅ PM2 services started"
        
    else
        echo "❌ Error: Neither Docker nor PM2 found!"
        echo "Please install Docker or PM2 to deploy"
        exit 1
    fi
else
    echo "🔧 Starting development servers..."
    npm run dev
fi

echo ""
echo "✨ Deployment completed successfully!"
echo ""
echo "📊 Service Status:"
if command -v docker-compose &> /dev/null && [ "$ENV" = "production" ]; then
    docker-compose ps
elif command -v pm2 &> /dev/null && [ "$ENV" = "production" ]; then
    pm2 status
fi

echo ""
echo "📝 Next steps:"
echo "1. Check logs: docker-compose logs -f (or) pm2 logs"
echo "2. Monitor health: curl http://localhost:3000/health"
echo "3. Test bot: Open Telegram and send /start to your bot"
echo ""
echo "🎉 Happy tracking!"