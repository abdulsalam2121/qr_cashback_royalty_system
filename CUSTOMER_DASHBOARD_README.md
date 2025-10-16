# Customer Dashboard Implementation

## Overview
This implementation adds a customer-facing dashboard to the QR Cashback Loyalty System, allowing customers to:

1. **Login using QR card scanning or manual Card UID entry**
2. **View their card balance and transaction history**
3. **Add funds to their card using credit/debit cards**
4. **Receive email notifications for transactions**

## Features Implemented

### 🔐 Customer Authentication
- **QR Code Scanning**: Customers can scan their QR loyalty card to log in
- **Manual Card UID Entry**: Alternative login method by entering Card UID manually
- **Session-based Authentication**: Secure token-based sessions (24-hour expiry)
- **No Password Required**: Uses card possession as authentication factor

### 💳 Customer Dashboard
- **Balance Overview**: Real-time display of current card balance
- **Statistics**: Total earned cashback, total redeemed, total funds added
- **Transaction History**: Complete history with pagination
- **Multi-tab Interface**: Organized sections for overview, transactions, and fund management

### 💰 Fund Addition System
- **Credit Card Integration**: Secure Stripe payment processing
- **Real-time Balance Updates**: Instant balance updates after successful payment
- **Payment Security**: PCI-compliant payment handling with Stripe Elements
- **Transaction Recording**: All fund additions are recorded as transactions

### 📧 Email Notifications
- **Fund Addition Confirmations**: Automatic emails when funds are added
- **Transaction Receipts**: Email notifications for balance changes
- **Professional Templates**: HTML email templates with transaction details

### 🔒 Security Features
- **Rate Limiting**: Protection against brute force attacks
- **Session Management**: Secure session tokens with expiration
- **Input Validation**: Server-side validation of all inputs
- **CORS Protection**: Proper cross-origin request handling

## API Endpoints

### Customer Authentication Routes (`/api/customer-auth/`)
- `POST /qr-login` - Login using QR code scan
- `POST /manual-login` - Login using manual Card UID entry
- `POST /logout` - Invalidate session
- `GET /verify` - Verify session validity

### Customer Dashboard Routes (`/api/customer/`)
- `GET /dashboard` - Get dashboard data (balance, stats, recent transactions)
- `GET /transactions` - Get transaction history with pagination
- `POST /add-funds/create-payment-intent` - Create Stripe payment intent
- `POST /add-funds/confirm` - Confirm fund addition after payment

## Frontend Components

### 📱 Customer Pages
- **CustomerLogin.tsx** - QR scanning and manual login interface
- **CustomerDashboard.tsx** - Main dashboard with balance and transactions
- **QRScanner.tsx** - QR code scanning component using html5-qrcode

### 🎨 UI Features
- **Responsive Design** - Works on mobile and desktop
- **Real-time Updates** - Live balance updates after payments
- **Error Handling** - User-friendly error messages
- **Loading States** - Proper loading indicators

## Database Changes

### New Transaction Types
- Enhanced transaction recording for fund additions
- Support for `ADJUST` transaction type for manually added funds
- Proper balance tracking (before/after amounts)

### Email Notification System
- Extended notification system to support customer emails
- HTML email templates for fund addition confirmations
- Queued notification processing

## Setup Instructions

### 1. Environment Variables
Add these to your `.env` file:
```env
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173
```

### 2. Frontend Environment
Create `.env` in the frontend directory:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### 3. Database Migration
The existing database schema supports the new features without migrations.

### 4. Dependencies
All required dependencies are already included:
- Backend: `stripe`, `html5-qrcode`, `express-rate-limit`
- Frontend: `@stripe/stripe-js`, `@stripe/react-stripe-js`, `html5-qrcode`

## Usage Flow

### Customer Login Flow
1. Customer visits `/customer/login`
2. Chooses QR scan or manual entry
3. For QR: Scans card with camera
4. For Manual: Enters Card UID
5. System validates card and creates session
6. Redirects to dashboard

### Fund Addition Flow
1. Customer navigates to "Add Funds" tab
2. Enters amount ($1-$500 range)
3. Enters credit card details (Stripe Elements)
4. Payment is processed securely
5. Fund addition is confirmed via webhook
6. Balance updates immediately
7. Email notification sent (if email available)

### Security Considerations
- Sessions expire after 24 hours
- Rate limiting prevents abuse
- Card UIDs are validated against database
- Payment processing is PCI compliant
- Input sanitization on all endpoints

## Testing

### Test the Complete Flow
1. **Create a test card** in the admin panel
2. **Activate the card** and assign to a customer with email
3. **Visit** `/customer/login`
4. **Scan QR or enter Card UID** to login
5. **View dashboard** - check balance display
6. **Add funds** - test payment processing
7. **Check email** - verify notification received
8. **View transactions** - confirm fund addition recorded

### Test Security
- Try accessing dashboard without login (should redirect)
- Test rate limiting by making many requests
- Verify session expiration after 24 hours
- Test with invalid card UIDs

## Production Considerations

### 1. Session Storage
- Replace in-memory session storage with Redis
- Implement session cleanup background job
- Add session refresh mechanism

### 2. Email Processing
- Set up proper email service (SendGrid, AWS SES)
- Process notification queue with background workers
- Add email delivery tracking

### 3. Monitoring
- Add logging for all customer actions
- Monitor payment success/failure rates
- Track session creation and expiration

### 4. Performance
- Add caching for customer dashboard data
- Optimize transaction history queries
- Consider CDN for static assets

## Integration with Existing System

The customer dashboard integrates seamlessly with the existing loyalty system:

- **Uses existing Card and Customer models**
- **Leverages current transaction recording system**
- **Extends existing notification framework**
- **Integrates with current Stripe subscription system**
- **Maintains all existing admin functionality**

Customers can now independently manage their loyalty cards while all admin features remain unchanged.

## Support Features

### For Customers
- Clear error messages for all scenarios
- Help text for QR scanning and manual entry
- Professional email notifications
- Transaction history for reference

### For Administrators
- All customer actions are logged
- Fund additions appear in transaction reports
- Email notifications are queued in notification system
- No changes to existing admin workflows