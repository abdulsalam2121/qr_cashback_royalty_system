#!/usr/bin/env node

const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config({ path: '../.env' });



/**
 * Stripe Webhook Testing Script
 * 
 * This script tests your Stripe webhook endpoint by sending mock webhook events
 * with proper signatures to verify that your webhook handler is working correctly.
 */

class StripeWebhookTester {
  constructor(config = {}) {
    this.config = {
  webhookUrl: config.webhookUrl || process.env.STRIPE_WEBHOOK_URL || 'https://www.loyalty-qr.com/api/webhooks/stripe',

  webhookSecret: config.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET,
  debug: config.debug || false,
  timeout: config.timeout || 10000,
  ...config
};

  }

  /**
   * Generate Stripe webhook signature
   * @param {string} payload - The webhook payload as a string
   * @param {string} secret - The webhook secret
   * @param {number} timestamp - Unix timestamp
   * @returns {string} The signature header value
   */
  generateSignature(payload, secret, timestamp) {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    
    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Send a webhook event to the endpoint
   * @param {object} eventData - The Stripe event data
   * @returns {Promise<object>} Response data
   */
  async sendWebhookEvent(eventData) {
    const payload = JSON.stringify(eventData);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(payload, this.config.webhookSecret, timestamp);

    if (this.config.debug) {
      console.log('🔧 Debug Info:');
      console.log('Payload:', payload);
      console.log('Timestamp:', timestamp);
      console.log('Signature:', signature);
      console.log('---');
    }

    try {
      const response = await axios.post(this.config.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
          'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
        },
        timeout: this.config.timeout,
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      const errorResponse = {
        success: false,
        status: error.response?.status || 0,
        error: error.message,
        data: error.response?.data,
        headers: error.response?.headers,
      };

      // Add more detailed error information
      if (error.code) {
        errorResponse.errorCode = error.code;
      }
      if (error.response?.statusText) {
        errorResponse.statusText = error.response.statusText;
      }

      return errorResponse;
    }
  }

  /**
   * Run all webhook tests
   */
  async runAllTests() {
    console.log('🎯 Starting Stripe Webhook Tests');
    console.log(`📍 Endpoint: ${this.config.webhookUrl}`);
    console.log('='.repeat(50));

    const tests = [
      { name: 'Payment Intent Succeeded (QR)', fn: () => this.testPaymentIntentSucceeded() },
      { name: 'Payment Intent Succeeded (POS)', fn: () => this.testPaymentIntentSucceededPOS() },
      { name: 'Checkout Session Completed', fn: () => this.testCheckoutSessionCompleted() },
      { name: 'Subscription Created', fn: () => this.testSubscriptionCreated() },
      { name: 'Subscription Updated', fn: () => this.testSubscriptionUpdated() },
      { name: 'Subscription Deleted', fn: () => this.testSubscriptionDeleted() },
      { name: 'Invoice Payment Succeeded', fn: () => this.testInvoicePaymentSucceeded() },
      { name: 'Invoice Payment Failed', fn: () => this.testInvoicePaymentFailed() },
    ];

    const results = [];

    for (const test of tests) {
      console.log(`\n🧪 Testing: ${test.name}`);
      try {
        const result = await test.fn();
        results.push({ name: test.name, ...result });
        
        if (result.success) {
          console.log(`✅ ${test.name} - PASSED (${result.status})`);
          if (this.config.debug && result.data) {
            console.log('   Response data:', result.data);
          }
        } else {
          console.log(`❌ ${test.name} - FAILED (${result.status}) - ${result.error}`);
          if (result.data) {
            console.log('   Response:', result.data);
          }
          if (result.headers && this.config.debug) {
            console.log('   Response headers:', result.headers);
          }
        }
      } catch (error) {
        console.log(`💥 ${test.name} - ERROR: ${error.message}`);
        results.push({ name: test.name, success: false, error: error.message });
      }
    }

    this.printSummary(results);
    return results;
  }

  /**
   * Print test summary
   */
  printSummary(results) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));

    const passed = results.filter(r => r.success).length;
    const failed = results.length - passed;

    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${Math.round((passed / results.length) * 100)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  • ${r.name}: ${r.error || 'Unknown error'}`);
      });
    }
  }

  // Test Methods for Different Webhook Events

  async testPaymentIntentSucceeded() {
    const event = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'pi_test_payment_intent',
          object: 'payment_intent',
          amount: 2000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            paymentLinkId: 'link_test_123', // This matches QR payment flow
          },
          client_secret: 'pi_test_client_secret',
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: 'payment_intent.succeeded'
    };

    return await this.sendWebhookEvent(event);
  }

  async testPaymentIntentSucceededPOS() {
    const event = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'pi_test_pos_payment_intent',
          object: 'payment_intent',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
          description: 'POS Terminal Payment',
          metadata: {
            tenantId: 'tenant_test_123',
            storeId: 'store_test_123', 
            cashierId: 'cashier_test_123',
            customerId: 'customer_test_123'
          },
          client_secret: 'pi_test_pos_client_secret',
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: 'payment_intent.succeeded'
    };

    return await this.sendWebhookEvent(event);
  }

  async testCheckoutSessionCompleted() {
    const event = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'cs_test_session',
          object: 'checkout.session',
          amount_total: 2000,
          currency: 'usd',
          customer: 'cus_test_customer',
          payment_status: 'paid',
          metadata: {
            type: 'customer_funds',
            tenantId: 'tenant_test_123',
            customerId: 'customer_test_123'
          },
          mode: 'payment',
          status: 'complete',
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: 'checkout.session.completed'
    };

    return await this.sendWebhookEvent(event);
  }

  async testSubscriptionCreated() {
    const event = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'sub_test_subscription',
          object: 'subscription',
          customer: 'cus_test_customer',
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          items: {
            data: [{
              price: {
                id: 'price_test_basic',
                nickname: 'Basic Plan'
              }
            }]
          },
          metadata: {
            tenantId: 'tenant_test_123'
          }
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: 'customer.subscription.created'
    };

    return await this.sendWebhookEvent(event);
  }

  async testSubscriptionUpdated() {
    const event = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'sub_test_subscription',
          object: 'subscription',
          customer: 'cus_test_customer',
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          items: {
            data: [{
              price: {
                id: 'price_test_premium',
                nickname: 'Premium Plan'
              }
            }]
          },
          metadata: {
            tenantId: 'tenant_test_123'
          }
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: 'customer.subscription.updated'
    };

    return await this.sendWebhookEvent(event);
  }

  async testSubscriptionDeleted() {
    const event = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'sub_test_subscription',
          object: 'subscription',
          customer: 'cus_test_customer',
          status: 'canceled',
          canceled_at: Math.floor(Date.now() / 1000),
          metadata: {
            tenantId: 'tenant_test_123'
          }
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: 'customer.subscription.deleted'
    };

    return await this.sendWebhookEvent(event);
  }

  async testInvoicePaymentSucceeded() {
    const event = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'in_test_invoice',
          object: 'invoice',
          customer: 'cus_test_customer',
          subscription: 'sub_test_subscription',
          status: 'paid',
          amount_paid: 2000,
          currency: 'usd'
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: 'invoice.payment_succeeded'
    };

    return await this.sendWebhookEvent(event);
  }

  async testInvoicePaymentFailed() {
    const event = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'in_test_invoice',
          object: 'invoice',
          customer: 'cus_test_customer',
          subscription: 'sub_test_subscription',
          status: 'open',
          amount_due: 2000,
          currency: 'usd'
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: 'invoice.payment_failed'
    };

    return await this.sendWebhookEvent(event);
  }

  async testCustomEvent(eventType, eventData) {
    const event = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: eventData
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: eventType
    };

    return await this.sendWebhookEvent(event);
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const config = {};
  let runSpecificTest = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        config.webhookUrl = args[++i];
        break;
      case '--secret':
        config.webhookSecret = args[++i];
        break;
      case '--debug':
        config.debug = true;
        break;
      case '--local':
        config.webhookUrl = 'http://localhost:3002/api/stripe/webhook';
        break;
      case '--test':
        runSpecificTest = args[++i];
        break;
      case '--help':
        console.log(`
Stripe Webhook Tester

Usage: node test-webhook.js [options]

Options:
  --url <url>          Webhook endpoint URL (default: https://loyalty-qr.com/api/stripe/webhook)
  --secret <secret>    Webhook secret key
  --local              Use local development URL (http://localhost:3002/api/stripe/webhook)
  --debug              Enable debug output
  --test <name>        Run specific test (payment_intent, checkout, subscription_created, etc.)
  --help               Show this help message

Examples:
  node test-webhook.js                                    # Run all tests on production
  node test-webhook.js --local                           # Run all tests locally
  node test-webhook.js --url http://localhost:3002/api/stripe/webhook --debug
  node test-webhook.js --test payment_intent             # Run specific test
        `);
        process.exit(0);
    }
  }

  const tester = new StripeWebhookTester(config);

  if (runSpecificTest) {
    // Run specific test
    const testMethods = {
      'payment_intent': () => tester.testPaymentIntentSucceeded(),
      'payment_intent_pos': () => tester.testPaymentIntentSucceededPOS(),
      'checkout': () => tester.testCheckoutSessionCompleted(),
      'subscription_created': () => tester.testSubscriptionCreated(),
      'subscription_updated': () => tester.testSubscriptionUpdated(),
      'subscription_deleted': () => tester.testSubscriptionDeleted(),
      'invoice_succeeded': () => tester.testInvoicePaymentSucceeded(),
      'invoice_failed': () => tester.testInvoicePaymentFailed(),
    };

    const testFn = testMethods[runSpecificTest];
    if (testFn) {
      console.log(`🧪 Running specific test: ${runSpecificTest}`);
      testFn().then(result => {
        if (result.success) {
          console.log(`✅ Test passed: ${result.status}`);
        } else {
          console.log(`❌ Test failed: ${result.error}`);
          process.exit(1);
        }
      }).catch(error => {
        console.error(`💥 Test error: ${error.message}`);
        process.exit(1);
      });
    } else {
      console.error(`❌ Unknown test: ${runSpecificTest}`);
      console.log('Available tests:', Object.keys(testMethods).join(', '));
      process.exit(1);
    }
  } else {
    // Run all tests
    tester.runAllTests().then(results => {
      const failed = results.filter(r => !r.success).length;
      process.exit(failed > 0 ? 1 : 0);
    }).catch(error => {
      console.error(`💥 Test suite error: ${error.message}`);
      process.exit(1);
    });
  }
}

module.exports = StripeWebhookTester;