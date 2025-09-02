#!/bin/bash

# VPS Deployment Script for QR Cashback System (loyalty-qr.com)
# This script deploys the application alongside your existing cover-cell.com website

set -e  # Exit on any error

echo "🚀 Deploying QR Cashback System to VPS (loyalty-qr.com)..."
echo "📋 This will NOT affect your existing cover-cell.com website"

# Configuration
DOMAIN="loyalty-qr.com"
PROJECT_DIR="/var/www/loyalty-qr"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
BACKEND_PORT=3002

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run this script with sudo or as root"
    exit 1
fi

# Create project directory
echo "📁 Creating project directory..."
mkdir -p ${PROJECT_DIR}/{backend,frontend,logs,uploads}
chown -R www-data:www-data ${PROJECT_DIR}

# Copy backend files
echo "📦 Setting up backend..."
if [ -d "./backend" ]; then
    cp -r ./backend/* ${PROJECT_DIR}/backend/
    chown -R www-data:www-data ${PROJECT_DIR}/backend
else
    echo "⚠️  Backend directory not found. Please upload your backend files to ${PROJECT_DIR}/backend/"
fi

# Copy frontend files (if built)
echo "🎨 Setting up frontend..."
if [ -d "./frontend/dist" ]; then
    cp -r ./frontend/dist/* ${PROJECT_DIR}/frontend/
    chown -R www-data:www-data ${PROJECT_DIR}/frontend
else
    echo "⚠️  Frontend build not found. Please build your frontend and copy to ${PROJECT_DIR}/frontend/"
fi

# Install Node.js dependencies for backend
echo "📦 Installing backend dependencies..."
cd ${PROJECT_DIR}/backend
if [ -f "package.json" ]; then
    # Check if Node.js is installed
    if command -v node >/dev/null 2>&1; then
        npm install --production
    else
        echo "⚠️  Node.js not found. Please install Node.js first."
    fi
fi

# Set up environment file
echo "⚙️  Setting up environment configuration..."
if [ ! -f "${PROJECT_DIR}/backend/.env" ]; then
    cat > ${PROJECT_DIR}/backend/.env << EOF
NODE_ENV=production
PORT=${BACKEND_PORT}
HOST=0.0.0.0
DATABASE_URL=postgresql://username:password@localhost:5432/qr_cashback_db
JWT_SECRET=your_secure_jwt_secret_here
CSRF_SECRET=your_secure_csrf_secret_here
FRONTEND_URL=https://${DOMAIN}
# Add other environment variables as needed
EOF
    echo "📝 Created .env file at ${PROJECT_DIR}/backend/.env"
    echo "⚠️  Please edit this file with your actual configuration values!"
fi

# Copy Nginx configuration
echo "🌐 Setting up Nginx configuration..."
if [ -f "./nginx/sites-available/loyalty-qr.com" ]; then
    cp ./nginx/sites-available/loyalty-qr.com ${NGINX_AVAILABLE}/
    echo "✅ Nginx configuration copied to ${NGINX_AVAILABLE}/loyalty-qr.com"
else
    echo "⚠️  Nginx configuration not found!"
fi

# Enable the site (create symbolic link)
echo "🔗 Enabling Nginx site..."
if [ ! -L "${NGINX_ENABLED}/loyalty-qr.com" ]; then
    ln -s ${NGINX_AVAILABLE}/loyalty-qr.com ${NGINX_ENABLED}/loyalty-qr.com
    echo "✅ Site enabled"
else
    echo "ℹ️  Site already enabled"
fi

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors!"
    exit 1
fi

# Install PM2 if not already installed
echo "🔧 Setting up PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Start the backend with PM2
echo "🚀 Starting backend with PM2..."
cd ${PROJECT_DIR}/backend
if [ -f "ecosystem.config.json" ]; then
    pm2 start ecosystem.config.json
else
    pm2 start server.js --name "loyalty-qr-backend" --env production
fi

# Save PM2 configuration
pm2 save
pm2 startup

echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. 🔐 Get SSL certificate for your domain:"
echo "   sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
echo "2. ⚙️  Edit your environment file:"
echo "   sudo nano ${PROJECT_DIR}/backend/.env"
echo ""
echo "3. 🗄️  Set up your database and run migrations"
echo ""
echo "4. 🔄 Reload Nginx:"
echo "   sudo systemctl reload nginx"
echo ""
echo "5. ✅ Test your application:"
echo "   curl https://${DOMAIN}/healthz"
echo ""
echo "📊 Management Commands:"
echo "====================="
echo "View backend logs:    pm2 logs loyalty-qr-backend"
echo "Restart backend:      pm2 restart loyalty-qr-backend"
echo "View PM2 status:      pm2 status"
echo "Reload Nginx:         sudo systemctl reload nginx"
echo ""
echo "🌐 Your sites:"
echo "cover-cell.com     → Port 3000 (unchanged)"
echo "loyalty-qr.com     → Port ${BACKEND_PORT} (new)"
echo ""
echo "✅ Deployment completed!"
