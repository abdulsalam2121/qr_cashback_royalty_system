#!/bin/bash

# Production startup script for QR Cashback Backend
# This script sets up the environment and starts the server

echo "🚀 Starting QR Cashback Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 PM2 not found. Installing PM2 globally..."
    npm install -g pm2
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

# Push database schema (for production deployments)
echo "🗄️  Pushing database schema..."
npm run db:push

# Start the application with PM2
echo "🎯 Starting application with PM2..."
npm run pm2:start

echo "✅ Backend started successfully!"
echo "📊 Monitor with: npm run pm2:monit"
echo "📋 View logs with: npm run pm2:logs"
echo "🔄 Restart with: npm run pm2:restart"
