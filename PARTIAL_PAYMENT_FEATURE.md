# Card Balance Partial Payment Feature

## Overview
Successfully implemented a new feature that allows customers to use their existing card balance as partial payment during purchases at POS terminals. This enhances the customer experience by providing flexible payment options.

## Feature Description
When a customer has balance on their loyalty card, they can now:
- Use all or part of their card balance to pay for purchases
- Pay the remaining amount using traditional payment methods (CASH, CARD, QR_PAYMENT)
- Complete transactions entirely with card balance if sufficient funds are available

## Implementation Details

### Frontend Changes (POSTerminal.tsx)
1. **New State Variables:**
   - `useCardBalance`: Boolean to enable/disable balance usage
   - `balanceToUse`: Amount from balance to apply to purchase

2. **Helper Functions:**
   - `getAvailableBalance()`: Returns card's available balance in cents
   - `getBalanceToUseCents()`: Converts balance input to cents
   - `getTotalAmountCents()`: Converts total amount to cents
   - `getRemainingAmountCents()`: Calculates remaining amount after balance usage
   - `canUseFullBalance()`: Checks if full purchase can be paid with balance

3. **UI Components:**
   - Checkbox to enable card balance usage
   - Input field for balance amount with validation
   - Quick action buttons ("Use Full Amount", "Use All Balance")
   - Payment summary showing breakdown of balance used vs remaining payment
   - Updated payment method label to indicate "for remaining amount"

4. **Validation:**
   - Ensures card is scanned before allowing balance usage
   - Validates sufficient balance availability
   - Prevents balance amount from exceeding total purchase amount
   - Ensures positive balance amounts

### Backend Changes (purchaseTransactions.ts)
1. **Schema Updates:**
   - Added `useCardBalance`: boolean (optional)
   - Added `balanceUsedCents`: number (optional)
   - Added `remainingAmountCents`: number (optional)

2. **Validation Logic:**
   - Validates card UID requirement for balance payments
   - Ensures balance used amount is positive
   - Verifies balance + remaining = total amount
   - Checks sufficient card balance availability

3. **Transaction Processing:**
   - Deducts used balance from card
   - Records balance usage as REDEEM transaction
   - Records cashback earning as EARN transaction (if applicable)
   - Updates payment status to COMPLETED for full balance payments
   - Handles both partial and full balance payments

4. **Email Notifications:**
   - Enhanced email template to show payment breakdown
   - Displays "Paid with Balance" and remaining payment method
   - Maintains existing cashback notification structure

### Email Service Updates (customerEmailService.ts)
1. **Interface Extension:**
   - Added `balanceUsed` field to CashbackEmailData
   - Added `remainingPaid` field for other payment method amount
   - Added `paymentMethod` field to specify remaining payment type

2. **Template Enhancement:**
   - Shows payment breakdown when balance is used
   - Displays amount paid with balance vs other methods
   - Maintains professional email formatting

## Usage Flow

### For Cashiers:
1. Scan customer's loyalty card
2. Enter purchase amount
3. If customer wants to use balance:
   - Check "Use Card Balance for Payment" checkbox
   - Enter amount to use from balance (or use quick buttons)
   - View payment summary showing remaining amount
4. Select payment method for remaining amount (if any)
5. Complete transaction

### For Customers:
1. Present loyalty card for scanning
2. Choose how much balance to use for payment
3. Pay remaining amount using preferred method
4. Receive email notification with payment breakdown
5. Keep updated card balance for future use

## Validation Rules
- Card must be scanned and active
- Balance used amount must be positive
- Balance used cannot exceed available balance
- Balance used cannot exceed total purchase amount
- Balance used + remaining payment = total amount

## Transaction Recording
- **Balance Usage**: Recorded as REDEEM transaction
- **Cashback Earning**: Recorded as EARN transaction
- **Card Balance**: Updated to reflect both deduction and addition
- **Customer Spend**: Updated with total purchase amount

## Payment Status Logic
- **COMPLETED**: CASH payments or full balance payments
- **PENDING**: CARD or QR_PAYMENT methods (with remaining amounts)

## Email Notifications
Enhanced to show:
- Total purchase amount
- Amount paid with balance
- Amount paid with other method
- Payment method used for remaining amount
- Updated balance information

## Testing Scenarios Covered
1. ✅ Full balance payment (balance ≥ purchase amount)
2. ✅ Partial balance + CASH payment
3. ✅ Partial balance + CARD payment  
4. ✅ Partial balance + QR_PAYMENT
5. ✅ Insufficient balance validation
6. ✅ Zero balance handling
7. ✅ Form clearing after successful transaction
8. ✅ Email notification with payment breakdown

## Technical Benefits
- Seamless integration with existing payment flow
- Maintains transaction integrity and audit trail
- Preserves existing cashback and tier systems
- Enhanced customer experience with flexible payments
- Comprehensive validation and error handling

## Customer Benefits
- Use accumulated loyalty balance for purchases
- Reduce out-of-pocket payment amounts
- Flexible payment combinations
- Clear transaction breakdown in email notifications
- Immediate balance updates after transactions

This feature significantly enhances the loyalty program's value proposition by allowing customers to directly benefit from their accumulated cashback during purchase transactions.