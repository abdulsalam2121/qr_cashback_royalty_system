# Backend Webhook Tester

A comprehensive testing utility for validating the backend's Stripe webhook endpoints. This tool sends mock webhook events with proper signatures to test your webhook handler implementation.

## Location

This testing utility is located in the backend directory (`backend/webhook-tester/`) as it specifically tests backend webhook functionality.

## Features

- ✅ **Proper Signature Verification** - Generates authentic Stripe webhook signatures
- 🎯 **Multiple Event Types** - Tests all major webhook events (payments, subscriptions, invoices)
- 🌍 **Environment Support** - Works with local development and production endpoints
- 📊 **Detailed Reporting** - Comprehensive test results with success/failure analysis
- 🔧 **Debug Mode** - Detailed logging for troubleshooting
- 🚀 **Easy to Use** - Simple CLI interface with helpful options

## Installation

1. Navigate to the backend webhook-tester directory:
```bash
cd backend/webhook-tester
```

2. Install dependencies:
```bash
npm install
```

## Quick Start

### Test Production Webhook
```bash
npm run test
# or
node test-webhook.js
```

### Test Local Development Webhook
```bash
npm run test:local
# or
node test-webhook.js --local
```

### Test with Debug Output
```bash
npm run test:debug
# or
node test-webhook.js --debug
```

## Usage Examples

### Basic Usage
```bash
# Test production endpoint (default)
node test-webhook.js

# Test local development endpoint
node test-webhook.js --local

# Test custom endpoint
node test-webhook.js --url https://your-domain.com/api/stripe/webhook
```

### Advanced Usage
```bash
# Test with custom webhook secret
node test-webhook.js --secret "whsec_your_webhook_secret_here"

# Run specific test only
node test-webhook.js --test payment_intent

# Enable debug mode for troubleshooting
node test-webhook.js --debug --local
```

### Available Test Types
```bash
node test-webhook.js --test payment_intent       # Test payment_intent.succeeded
node test-webhook.js --test checkout             # Test checkout.session.completed
node test-webhook.js --test subscription_created # Test customer.subscription.created
node test-webhook.js --test subscription_updated # Test customer.subscription.updated
node test-webhook.js --test subscription_deleted # Test customer.subscription.deleted
node test-webhook.js --test invoice_succeeded    # Test invoice.payment_succeeded
node test-webhook.js --test invoice_failed       # Test invoice.payment_failed
```

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url` | Webhook endpoint URL | `https://loyalty-qr.com/api/stripe/webhook` |
| `--secret` | Stripe webhook secret | Uses test secret from .env |
| `--local` | Use local development URL | `http://localhost:3002/api/stripe/webhook` |
| `--debug` | Enable debug output | `false` |
| `--test` | Run specific test | Runs all tests |
| `--help` | Show help message | - |

## Tested Webhook Events

The tester covers all major Stripe webhook events used in your application:

### Payment Events
- ✅ `payment_intent.succeeded` - Card payments, QR payments
- ✅ `checkout.session.completed` - Customer fund additions, card orders

### Subscription Events
- ✅ `customer.subscription.created` - New subscriptions
- ✅ `customer.subscription.updated` - Plan changes, renewals
- ✅ `customer.subscription.deleted` - Subscription cancellations

### Invoice Events
- ✅ `invoice.payment_succeeded` - Successful subscription payments
- ✅ `invoice.payment_failed` - Failed subscription payments

## Understanding Test Results

### Successful Test Output
```
🧪 Testing: Payment Intent Succeeded
✅ Payment Intent Succeeded - PASSED (200)

📊 Test Summary
==================================================
Total Tests: 7
Passed: 7 ✅
Failed: 0 ❌
Success Rate: 100%
```

### Failed Test Output
```
🧪 Testing: Payment Intent Succeeded
❌ Payment Intent Succeeded - FAILED (400) - Webhook Error: Invalid signature

❌ Failed Tests:
  • Payment Intent Succeeded: Webhook Error: Invalid signature
```

## Common Issues and Solutions

### 1. Signature Verification Failed
**Problem**: `Webhook Error: Invalid signature`
**Solution**: 
- Check your webhook secret in the backend `.env` file
- Use `--secret` flag with correct webhook secret
- Ensure your webhook endpoint is configured correctly

### 2. Connection Refused
**Problem**: `connect ECONNREFUSED`
**Solution**:
- Make sure your backend server is running
- Use `--local` flag for local testing
- Check the correct port (default: 3002)

### 3. 404 Not Found
**Problem**: `Request failed with status code 404`
**Solution**:
- Verify the webhook endpoint URL is correct
- Check that the `/api/stripe/webhook` route is properly configured
- Ensure the backend server is running

### 4. Timeout Errors
**Problem**: Request timeout
**Solution**:
- Check server is responsive
- Verify database connection
- Look for errors in server logs

## Integration with Your Webhook Handler

Your webhook endpoint should handle these events properly. Make sure your handler:

1. **Verifies Signatures** - Uses the same webhook secret
2. **Returns 200 Status** - For successful processing
3. **Handles All Event Types** - As tested by this script
4. **Logs Appropriately** - For debugging failed tests

## Environment Configuration

### Local Development
```bash
# Backend .env file
STRIPE_WEBHOOK_SECRET="whsec_your_local_secret"
PORT=3002
```

### Production
```bash
# Production environment
STRIPE_WEBHOOK_SECRET="whsec_your_production_secret"
```

## Extending the Tester

You can add custom tests by extending the `StripeWebhookTester` class:

```javascript
const StripeWebhookTester = require('./test-webhook');

const tester = new StripeWebhookTester({
  webhookUrl: 'https://your-custom-endpoint.com/webhook',
  webhookSecret: 'your_secret_here',
  debug: true
});

// Add custom test
tester.testCustomEvent('custom.event.type', {
  id: 'custom_object_id',
  // ... your custom event data
}).then(result => {
  console.log('Custom test result:', result);
});
```

## Troubleshooting

1. **Enable Debug Mode** - Use `--debug` flag to see detailed request/response data
2. **Check Server Logs** - Look at your backend server logs for errors
3. **Verify Environment** - Ensure webhook secrets match between tester and server
4. **Test Connectivity** - Make sure the endpoint URL is accessible

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Enable debug mode for detailed error information
3. Verify your webhook configuration matches the tester settings
4. Check server logs for processing errors

---

**Happy Testing! 🎉**