# VPS Deployment Guide for loyalty-qr.com

This guide helps you deploy the QR Cashback Backend to your VPS alongside your existing cover-cell.com website.

## 🎯 Deployment Overview

- **Existing site**: cover-cell.com (Port 3000) → **Will remain unchanged**
- **New site**: loyalty-qr.com (Port 3002) → **QR Cashback System**
- **No conflicts**: Both sites will run simultaneously

## Prerequisites

1. Your VPS with existing cover-cell.com setup
2. Node.js and PM2 already installed
3. Nginx already configured
4. Domain `loyalty-qr.com` pointed to your VPS IP

## Quick Deployment

### Option 1: Docker Only (Recommended for VPS)

1. **Upload your backend files to VPS:**
```bash
scp -r ./backend user@your-vps-ip:/path/to/your/app/
```

2. **SSH into your VPS:**
```bash
ssh user@your-vps-ip
cd /path/to/your/app/backend
```

3. **Create environment file:**
```bash
nano .env
```

Add your environment variables:
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@localhost:5432/database
PORT=3002
HOST=0.0.0.0
JWT_SECRET=your_jwt_secret
CSRF_SECRET=your_csrf_secret
FRONTEND_URL=https://yourdomain.com
# Add other variables as needed
```

4. **Build and run with Docker:**
```bash
# Build the image
docker build -t qr-cashback-backend .

# Run the container
docker run -d \
  --name qr-cashback-backend \
  --restart unless-stopped \
  -p 3002:3002 \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/uploads:/app/uploads \
  qr-cashback-backend
```

### Option 2: Docker Compose (Backend Only)

1. **Use the production compose file:**
```bash
docker-compose -f docker-compose.production.yml up -d
```

### Option 3: Direct Node.js (Alternative)

If you prefer not to use Docker:

1. **Install Node.js 20+ on your VPS**
2. **Upload and install dependencies:**
```bash
cd /path/to/your/app/backend
npm install --production
```

3. **Set up environment:**
```bash
cp .env.example .env
nano .env  # Edit with your values
```

4. **Run with PM2:**
```bash
npm install -g pm2
npm run pm2:start
```

## Nginx Configuration

Add this to your Nginx configuration:

```nginx
# Backend API proxy
location /api/ {
    proxy_pass http://localhost:3002/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 86400;
}

# Health check endpoint
location /healthz {
    proxy_pass http://localhost:3002/healthz;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then reload Nginx:
```bash
sudo systemctl reload nginx
```

## Management Commands

### Docker Commands
```bash
# View logs
docker logs qr-cashback-backend -f

# Restart container
docker restart qr-cashback-backend

# Stop container
docker stop qr-cashback-backend

# Update (rebuild and restart)
docker stop qr-cashback-backend
docker rm qr-cashback-backend
docker build -t qr-cashback-backend .
docker run -d --name qr-cashback-backend --restart unless-stopped -p 3001:3001 --env-file .env qr-cashback-backend
```

### PM2 Commands (if using Node.js directly)
```bash
# View status
pm2 status

# View logs
pm2 logs qr-cashback-backend

# Restart
pm2 restart qr-cashback-backend

# Stop
pm2 stop qr-cashback-backend
```

## Health Check

Test if your backend is running:
```bash
curl http://localhost:3002/healthz
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123.45,
  "version": "1.0.0",
  "database": "connected"
}
```

## Troubleshooting

1. **Container won't start:**
   - Check logs: `docker logs qr-cashback-backend`
   - Verify environment variables in `.env`
   - Ensure database is accessible

2. **Database connection issues:**
   - Verify DATABASE_URL in environment
   - Check if database server is running
   - Test connection manually

3. **Port conflicts:**
   - Change PORT in environment variables
   - Update Docker run command with new port mapping

4. **Permission issues:**
   - Ensure proper file permissions
   - Check if user has Docker access

## Security Notes

- Always use strong passwords and secrets
- Keep your environment file secure (never commit to git)
- Regularly update your Docker images
- Use HTTPS in production
- Configure firewall properly
