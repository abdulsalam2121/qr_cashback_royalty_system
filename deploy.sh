#!/bin/bash

# Docker deployment script for QR Cashback System
# This script builds and deploys the application using Docker Compose

set -e  # Exit on any error

echo "🐳 Starting Docker deployment for QR Cashback System..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cat > .env << EOF
# Database Configuration
POSTGRES_DB=qr_cashback_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_PORT=5432

# Redis Configuration
REDIS_PASSWORD=your_redis_password_here
REDIS_PORT=6379

# Application Configuration
NODE_ENV=production
JWT_SECRET=your_super_secret_jwt_key_here
CSRF_SECRET=your_csrf_secret_key_here
FRONTEND_URL=https://yourdomain.com
BACKEND_PORT=3002
FRONTEND_PORT=80

# Stripe Configuration (Optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_BASIC=
STRIPE_PRICE_ID_PRO=

# Twilio Configuration (Optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_NUMBER=

# Frontend Configuration
VITE_API_URL=https://api.yourdomain.com/api
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_APP_NAME=QR Cashback System
VITE_APP_VERSION=1.0.0

# Nginx Configuration
HTTP_PORT=80
HTTPS_PORT=443
EOF
    echo "⚠️  Please edit the .env file with your actual configuration values before proceeding."
    echo "📍 Location: $(pwd)/.env"
    exit 0
fi

# Function to check if environment variables are set
check_env_vars() {
    local required_vars=("POSTGRES_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "CSRF_SECRET")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo "❌ Missing required environment variables:"
        printf " - %s\n" "${missing_vars[@]}"
        echo "Please set these variables in your .env file."
        exit 1
    fi
}

# Load environment variables
if [ -f .env ]; then
    echo "📁 Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
    check_env_vars
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down || true

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
docker-compose ps

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose exec backend npx prisma migrate deploy || echo "⚠️  Migration failed or no migrations to run"

# Show service status
echo "📊 Service Status:"
echo "=================="
docker-compose logs --tail=10 backend
echo ""
echo "✅ Deployment completed!"
echo ""
echo "🌐 Your application should be available at:"
echo "   Frontend: http://localhost:${FRONTEND_PORT:-80}"
echo "   Backend:  http://localhost:${BACKEND_PORT:-3002}"
echo "   Health:   http://localhost:${BACKEND_PORT:-3002}/healthz"
echo ""
echo "📋 Useful commands:"
echo "   View logs:     docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart:       docker-compose restart"
echo "   Update:        docker-compose pull && docker-compose up -d"
