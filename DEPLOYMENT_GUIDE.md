# QR Cashback & Loyalty System - Deployment Guide

## 🚀 Production Deployment Checklist

### 1. Environment Configuration

#### Frontend Environment (.env)
```bash
# Copy .env.example to .env and configure:
VITE_API_URL=https://api.yourdomain.com/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
VITE_APP_NAME=QR Cashback & Loyalty System
VITE_APP_VERSION=1.0.0
```

#### Backend Environment (.env)
```bash
# Copy backend/.env.example to backend/.env and configure:
DATABASE_URL="postgresql://username:password@localhost:5432/qr_cashback_db?schema=public"
JWT_SECRET=your-super-secret-jwt-key-make-it-very-long-and-random
CSRF_SECRET=your-csrf-secret-key-different-from-jwt
FRONTEND_URL=https://yourdomain.com
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_ID_BASIC=price_basic_plan_id
STRIPE_PRICE_ID_PRO=price_pro_plan_id
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 2. Database Setup

#### PostgreSQL Setup
```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE qr_cashback_db;
CREATE USER qr_cashback_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE qr_cashback_db TO qr_cashback_user;
\q
```

#### Database Migration & Seeding
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

### 3. Stripe Configuration

#### Required Stripe Setup
1. Create Stripe account and get API keys
2. Set up products and prices for subscription plans
3. Configure webhook endpoint: `https://api.yourdomain.com/stripe/webhook`
4. Required webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`

### 4. Docker Deployment

#### Using Docker Compose (Recommended)
```bash
# Copy docker environment
cp .env.docker.example .env

# Configure .env with your production values

# Deploy with Docker Compose
docker-compose up -d

# Check service health
docker-compose ps
docker-compose logs
```

#### Manual Docker Build
```bash
# Build backend
cd backend
docker build -t qr-cashback-backend .

# Build frontend
cd ..
docker build -f Dockerfile.frontend -t qr-cashback-frontend .

# Run containers
docker run -d --name qr-cashback-backend \
  --env-file backend/.env \
  -p 3001:3001 \
  qr-cashback-backend

docker run -d --name qr-cashback-frontend \
  -p 80:80 \
  qr-cashback-frontend
```

### 5. SSL Certificate Setup (Production)

#### Using Let's Encrypt with Certbot
```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 6. Nginx Configuration

#### Main Site Configuration
```nginx
# /etc/nginx/sites-available/qr-cashback
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 7. Process Management

#### Using PM2 (Alternative to Docker)
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
# ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'qr-cashback-backend',
      script: 'dist/index',
      cwd: './backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8. Monitoring & Logging

#### Log Management
```bash
# Create log rotation
sudo vim /etc/logrotate.d/qr-cashback

/var/log/qr-cashback/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 app app
    postrotate
        systemctl reload nginx
    endscript
}
```

#### Health Monitoring
- Backend health endpoint: `https://api.yourdomain.com/healthz`
- Database connection monitoring
- Stripe webhook monitoring
- Server resource monitoring

### 9. Backup Strategy

#### Database Backup
```bash
#!/bin/bash
# /opt/scripts/backup-db.sh
DB_NAME="qr_cashback_db"
DB_USER="qr_cashback_user"
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

pg_dump -h localhost -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

# Crontab entry:
# 0 2 * * * /opt/scripts/backup-db.sh
```

### 10. Security Hardening

#### Server Security
- Configure firewall (UFW/iptables)
- Set up fail2ban for SSH protection
- Regular security updates
- Limited user permissions
- SSH key authentication only

#### Application Security
- HTTPS everywhere
- Secure headers configured
- Rate limiting enabled
- Input validation active
- CSRF protection enabled
- JWT token security
- Database connection encryption

### 11. Performance Optimization

#### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_transactions_tenant_created 
ON transactions(tenant_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_cards_tenant_uid 
ON cards(tenant_id, card_uid);

-- Regular maintenance
VACUUM ANALYZE;
```

#### Caching Strategy
- Redis for session storage
- Nginx caching for static assets
- Database query optimization
- CDN for global asset delivery

### 12. Testing Deployment

#### Pre-deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates valid
- [ ] Stripe webhooks configured
- [ ] Health checks passing
- [ ] Backup system tested
- [ ] Monitoring alerts configured

#### Test Scenarios
1. User registration and login
2. Card creation and activation
3. Transaction processing
4. Payment processing (Stripe)
5. Subscription management
6. Card ordering with payment
7. SMS/WhatsApp notifications
8. API rate limiting
9. Error handling
10. Database failover

### 13. Go-Live Steps

1. **Final Environment Check**
   ```bash
   # Check all services
   docker-compose ps
   curl https://api.yourdomain.com/healthz
   ```

2. **DNS Configuration**
   - Point domain to server IP
   - Configure SSL certificates
   - Test domain resolution

3. **Stripe Production Mode**
   - Switch to live API keys
   - Test payment flows
   - Configure webhook URLs

4. **Launch Monitoring**
   - Enable error tracking
   - Set up alerts
   - Monitor resource usage

### 14. Post-Deployment

#### Immediate Actions
- Monitor error logs
- Check system performance
- Verify payment processing
- Test user flows
- Monitor database performance

#### Ongoing Maintenance
- Regular security updates
- Database maintenance
- Log rotation
- Backup verification
- Performance monitoring
- User feedback collection

## 🆘 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database status
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

#### Stripe Webhook Issues
```bash
# Check webhook endpoint
curl -X POST https://api.yourdomain.com/stripe/webhook

# Verify webhook secret
echo $STRIPE_WEBHOOK_SECRET
```

#### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Test SSL configuration
openssl s_client -connect yourdomain.com:443
```

## 📞 Support Contacts

- **System Administrator**: admin@platform.com
- **Emergency Contact**: +1-XXX-XXX-XXXX
- **Documentation**: https://github.com/your-repo/docs

## 🔄 Updates & Maintenance

### Regular Update Process
1. Test updates in staging environment
2. Schedule maintenance window
3. Create database backup
4. Deploy updates
5. Run smoke tests
6. Monitor system health

Remember to update this guide as your deployment evolves and new requirements emerge.
