# Quick VPS Deployment Guide for loyalty-qr.com

## 🚀 Fast Setup (Recommended)

### Step 1: Upload Files to VPS
```bash
# Upload the entire project to your VPS
scp -r ./project/ user@your-vps-ip:/tmp/loyalty-qr-deploy/
```

### Step 2: Run Automated Deployment
```bash
# SSH into your VPS
ssh user@your-vps-ip

# Navigate to uploaded files
cd /tmp/loyalty-qr-deploy/

# Make deployment script executable and run it
chmod +x vps-deploy.sh
sudo ./vps-deploy.sh
```

### Step 3: Configure SSL
```bash
# Get SSL certificate for your domain
sudo certbot --nginx -d loyalty-qr.com -d www.loyalty-qr.com
```

### Step 4: Update Environment
```bash
# Edit the environment file with your actual values
sudo nano /var/www/loyalty-qr/backend/.env
```

### Step 5: Test Everything
```bash
# Test backend health
curl https://loyalty-qr.com/healthz

# Check PM2 status
pm2 status

# Verify both sites are running
curl https://cover-cell.com/api/  # Your existing site
curl https://loyalty-qr.com/api/ # New QR cashback site
```

## 📋 Quick Reference

### Directory Structure on VPS:
```
/var/www/
├── cover-cell/           # Your existing website (unchanged)
│   ├── backend/          # Port 3000
│   └── frontend/
└── loyalty-qr/           # New QR cashback website
    ├── backend/          # Port 3002
    ├── frontend/
    ├── uploads/
    └── logs/
```

### Port Configuration:
- **cover-cell.com**: Port 3000 (existing, unchanged)
- **loyalty-qr.com**: Port 3002 (new QR cashback)

### PM2 Process Names:
- Your existing backend: (whatever you named it)
- New QR cashback backend: `loyalty-qr-backend`

### Nginx Configuration:
- **Existing**: `/etc/nginx/sites-available/cover-cell.com`
- **New**: `/etc/nginx/sites-available/loyalty-qr.com`

## 🔧 Management Commands

### Backend Management:
```bash
# View all PM2 processes
pm2 status

# View QR cashback logs
pm2 logs loyalty-qr-backend

# Restart QR cashback backend
pm2 restart loyalty-qr-backend

# View system logs
sudo journalctl -u nginx
```

### Nginx Management:
```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check Nginx status
sudo systemctl status nginx
```

### Database Management:
```bash
# If using PostgreSQL
sudo -u postgres psql

# Create database for QR cashback
CREATE DATABASE qr_cashback_db;

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE qr_cashback_db TO your_user;
```

## 🛠️ Troubleshooting

### Backend Won't Start:
```bash
# Check logs
pm2 logs loyalty-qr-backend

# Check environment file
sudo nano /var/www/loyalty-qr/backend/.env

# Test database connection
cd /var/www/loyalty-qr/backend
node -e "console.log(process.env.DATABASE_URL)"
```

### Nginx Issues:
```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Verify sites are enabled
ls -la /etc/nginx/sites-enabled/
```

### SSL Certificate Issues:
```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

## ✅ Success Indicators

Your deployment is successful when:

1. **Both websites are accessible:**
   - ✅ https://cover-cell.com (existing)
   - ✅ https://loyalty-qr.com (new)

2. **Backend health checks pass:**
   - ✅ `curl https://loyalty-qr.com/healthz` returns success

3. **PM2 shows both backends running:**
   - ✅ `pm2 status` shows all processes online

4. **No conflicts between sites:**
   - ✅ Different ports (3000 vs 3002)
   - ✅ Different directories
   - ✅ Separate configurations

## 🆘 Need Help?

If you encounter issues:

1. Check PM2 logs: `pm2 logs loyalty-qr-backend`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables in `/var/www/loyalty-qr/backend/.env`
4. Test database connectivity
5. Ensure ports 3002 is not blocked by firewall
