#!/bin/bash

# Quick backend deployment script
echo "🚀 Deploying backend changes..."

# Build TypeScript
echo "📦 Building TypeScript..."
cd backend
npm run build
cd ..

# Copy files to server
echo "📤 Uploading files to server..."
scp -r backend/dist/ root@cover-cell.com:/root/project/backend/
scp backend/server.js root@cover-cell.com:/root/project/backend/
scp backend/package.json root@cover-cell.com:/root/project/backend/

# Restart server
echo "🔄 Restarting server..."
ssh root@cover-cell.com "cd /root/project/backend && pm2 restart ecosystem.config.json"

echo "✅ Backend deployment complete!"
