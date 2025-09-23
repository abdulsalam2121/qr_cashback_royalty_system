# VPS Deployment Checklist for Card Print Orders

## Files to ensure are uploaded:
✅ `backend/src/routes/cardPrintOrders.ts` 
✅ `backend/src/index.ts` (updated with cardPrintOrders import)
✅ `frontend/src/utils/api.ts` (updated with print order API methods)
✅ `frontend/src/pages/CardPrintOrders.tsx` (tenant admin page)
✅ `frontend/src/pages/platform/CardPrintOrders.tsx` (platform admin page)
✅ `frontend/src/components/PlatformLayout.tsx` (updated with badge)
✅ `frontend/src/utils/events.ts` (new file for refresh events)

## Backend Commands to run on VPS:
```bash
# 1. Navigate to backend directory
cd /path/to/your/backend

# 2. Install any new dependencies (if any)
npm install

# 3. Build the TypeScript code
npm run build

# 4. Restart the server (using PM2 or your process manager)
pm2 restart your-app-name
# OR if using systemctl:
sudo systemctl restart your-app-name
# OR if running directly:
npm run start
```

## Frontend Commands to run on VPS:
```bash
# 1. Navigate to frontend directory
cd /path/to/your/frontend

# 2. Install any new dependencies
npm install

# 3. Build the production version
npm run build

# 4. Copy dist files to your web server directory
cp -r dist/* /var/www/your-domain/
# OR if using nginx/apache, copy to your configured directory
```

## Database Commands (if needed):
```bash
# Make sure the database schema is up to date
cd /path/to/your/backend
npx prisma db push
# OR if using migrations:
npx prisma migrate deploy
```

## Quick Test Commands:
```bash
# Test if the route is registered (run from backend directory)
curl -X GET "http://localhost:3002/api/t/abdul-salam-ghanghro-store/card-print-orders" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check if server is running
curl http://localhost:3002/healthz
```

## Common Issues:
1. **404 Route not found**: Server wasn't restarted after deployment
2. **Module not found**: Build wasn't run or files weren't uploaded
3. **Authentication errors**: Make sure JWT tokens are valid
4. **Database errors**: Schema might be out of sync

## Files that should exist after build:
- `backend/dist/routes/cardPrintOrders.js`
- `backend/dist/index.js` (should import cardPrintOrders)
- Frontend build should include updated components