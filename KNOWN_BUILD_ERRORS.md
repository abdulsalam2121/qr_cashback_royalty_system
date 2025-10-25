# TypeScript Build Errors - Payment/Purchase Tables

## Issue
There are TypeScript errors in several files related to table naming:
- `payment_links` vs `paymentLink`
- `purchase_transactions` vs `purchaseTransaction`

## Affected Files
- `src/routes/customerDashboard.ts`
- `src/routes/purchaseTransactions.ts`
- `src/routes/stripe.ts`
- `src/routes/webhooks.ts`

## Root Cause
The Prisma schema uses snake_case table names (`payment_links`, `purchase_transactions`) but the code is trying to use camelCase accessors (`paymentLink`, `purchaseTransaction`).

## Status
⚠️ **Pre-existing issue** - Not introduced by Phone Repair System
✅ **Phone Repair System** - All TypeScript errors fixed and working

## Resolution Options

### Option 1: Update Code to Use Snake_Case (Recommended)
Replace all instances:
- `prisma.paymentLink` → `prisma.payment_links`
- `prisma.purchaseTransaction` → `prisma.purchase_transactions`

### Option 2: Update Schema to Use CamelCase
Rename models in schema:
- `model payment_links` → `model PaymentLink` with `@@map("payment_links")`
- `model purchase_transactions` → `model PurchaseTransaction` with `@@map("purchase_transactions")`

Then regenerate Prisma client: `npx prisma generate`

## Development Mode
The backend will still run in development mode (`npm run dev`) despite these TypeScript errors since it uses `ts-node` which is more forgiving. The errors only appear during `npm run build`.

## Impact
- ❌ Production build (`npm run build`) fails
- ✅ Development mode (`npm run dev`) works
- ✅ **Phone Repair System** fully functional

## Recommendation
Fix these errors when you have time, but they don't block the Phone Repair System functionality.
