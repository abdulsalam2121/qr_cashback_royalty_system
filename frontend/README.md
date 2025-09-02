# QR-Based Cashback & Loyalty System

A complete production-ready loyalty system for phone shops with QR-based cards, multi-tier rewards, and comprehensive admin/cashier/customer portals.

## Features

### Core Functionality

- **QR-Based Cards**: Generate unique QR codes for physical loyalty cards
- **Store Binding**: Cards work only at the branch where they were activated
- **Multi-Tier System**: Silver/Gold/Platinum tiers with automatic upgrades
- **Configurable Cashback**: Different rates for purchases, repairs, and other services
- **Real-time Notifications**: SMS/WhatsApp via Twilio integration
- **Comprehensive Audit Trail**: Immutable transaction logging with user tracking

### User Portals

- **Admin Dashboard**: Complete system management with analytics and reporting
- **Cashier POS**: QR scanning, transaction processing, and customer management
- **Customer Portal**: Balance viewing, transaction history, and tier information

### Security & Compliance

- JWT-based authentication with httpOnly cookies
- Role-based access control (RBAC)
- CSRF protection and rate limiting
- Input validation with Zod schemas
- Comprehensive audit logging

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL 15+
- **Authentication**: JWT with bcrypt password hashing
- **QR Codes**: QR code generation with signed tokens
- **Notifications**: Twilio SMS/WhatsApp Business API
- **Infrastructure**: Docker Compose with Nginx reverse proxy

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL 15+ (if running without Docker)

### Development Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd qr-loyalty-system
   ```

2. **Environment Configuration**

   ```bash
   # Backend environment
   cp backend/.env.example backend/.env

   # Frontend environment
   cp .env.example .env
   ```

3. **Update environment variables**
   Edit `backend/.env` with your configuration:

   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/loyalty_system"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   FRONTEND_URL="http://localhost:5173"
   APP_BASE_URL="http://localhost:5173"

   # Optional: Twilio for SMS/WhatsApp
   TWILIO_ACCOUNT_SID="your-twilio-sid"
   TWILIO_AUTH_TOKEN="your-twilio-token"
   TWILIO_FROM_NUMBER="+1234567890"
   ```

4. **Start with Docker Compose**

   ```bash
   # Start all services
   docker-compose up -d

   # View logs
   docker-compose logs -f
   ```

5. **Database Setup**

   ```bash
   # Run migrations
   docker-compose exec backend npx prisma migrate deploy

   # Seed demo data
   docker-compose exec backend npm run db:seed
   ```

6. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/healthz

### Manual Setup (without Docker)

1. **Database Setup**

   ```bash
   # Start PostgreSQL and create database
   createdb loyalty_system
   ```

2. **Backend Setup**

   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   npx prisma generate
   npm run db:seed
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   # In a new terminal
   npm install
   npm run dev
   ```

## Demo Credentials

After running the seed script, use these credentials:

- **Admin**: admin@shop.com / password
- **Cashier**: cashier@shop.com / password

## API Documentation

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/register` - Register new user (admin only)

### Cards Management

- `POST /api/cards/batch` - Create card batch
- `GET /api/cards` - List cards with filters
- `GET /api/cards/:cardUid` - Get card details
- `POST /api/cards/activate` - Activate card
- `POST /api/cards/:cardUid/block` - Block/unblock card

### Transactions

- `POST /api/transactions/earn` - Process cashback earning
- `POST /api/transactions/redeem` - Process cashback redemption
- `GET /api/transactions` - List transactions with filters

### Customer Management

- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer

### Rules & Configuration

- `GET/PUT /api/rules/cashback` - Cashback rules management
- `GET/PUT /api/rules/tiers` - Tier rules management
- `GET/POST /api/rules/offers` - Special offers management

### Reports & Export

- `GET /api/reports/dashboard` - Dashboard statistics
- `GET /api/reports/export/customers` - Export customers CSV
- `GET /api/reports/export/transactions` - Export transactions CSV

## Deployment

### Production Docker Setup

1. **Environment Configuration**

   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export DATABASE_URL="your-production-db-url"
   export JWT_SECRET="your-production-jwt-secret"
   ```

2. **Build and Deploy**

   ```bash
   # Build production images
   docker-compose -f docker-compose.prod.yml build

   # Deploy with production profile
   docker-compose -f docker-compose.prod.yml --profile production up -d
   ```

3. **SSL Configuration**
   - Place SSL certificates in `nginx/ssl/`
   - Update `nginx/nginx.conf` with your domain
   - Ensure ports 80 and 443 are open

### Single VM Deployment

1. **Server Setup**

   ```bash
   # Install Docker and Docker Compose
   sudo apt update
   sudo apt install docker.io docker-compose
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

2. **Application Deployment**

   ```bash
   # Clone repository
   git clone <repository-url>
   cd qr-loyalty-system

   # Set production environment
   cp backend/.env.example backend/.env
   # Edit backend/.env with production values

   # Deploy
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Database Migration**
   ```bash
   # Run production migrations
   docker-compose exec backend npx prisma migrate deploy
   ```

## System Architecture

### Database Schema

- **Multi-tenant**: Designed for multiple shop/branch support
- **Audit Trail**: Immutable transaction logging
- **Store Binding**: Cards locked to activation store
- **Tier System**: Automatic customer tier upgrades
- **Notification Queue**: Retry mechanism for failed notifications

### Security Features

- JWT tokens with httpOnly cookies
- CSRF protection on all mutating routes
- Rate limiting on auth and transaction endpoints
- Input validation with Zod schemas
- Role-based access control (RBAC)
- Source IP logging for all transactions

### QR Code Flow

1. Admin creates card batch with unique UIDs
2. QR codes generated with signed tokens
3. Customer scans QR → opens `/c/{cardUid}?t={token}`
4. Token verification allows secure card viewing
5. Store binding enforced on first activation

### Cashback Calculation

1. Base rate from category rules (Purchase/Repair/Other)
2. Tier multiplier applied (Silver/Gold/Platinum)
3. Active offer multipliers added
4. Total capped at configurable maximum
5. Atomic balance updates with transaction logging

## Monitoring & Logging

### Health Checks

- `/healthz` endpoint for service monitoring
- Database connectivity checks
- Redis availability verification

### Logging

- Structured JSON logging with Pino
- Request/response logging with timing
- Error tracking with stack traces
- Transaction audit trail

### Metrics

- Dashboard KPI tracking
- Transaction volume analytics
- Customer tier distribution
- Cashback earned vs. redeemed ratios

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Create an issue in the repository
- Check the documentation in `/docs`
- Review the API collection in `/postman`

 - cd backend && npx prisma migrate dev --name add-saas-features