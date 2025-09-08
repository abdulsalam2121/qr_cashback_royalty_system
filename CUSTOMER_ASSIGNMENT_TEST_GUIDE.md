# Customer Assignment Logic - Quick Test Guide

## 🎯 How to Test the Fix

### 1. **Prepare Test Data**
1. Create some customers (if not already existing)
2. Assign cards to some customers (make them "active")
3. Block some customer cards
4. Leave some customers without any cards

### 2. **Test the Customer Dropdown Logic**

#### ✅ **Should Appear in Dropdown:**
- **John Doe** - New customer, no cards assigned
- **Jane Smith** - Has blocked cards only
- **Bob Wilson** - Had a card, but it was blocked

#### ❌ **Should NOT Appear in Dropdown:**
- **Alice Johnson** - Has an active card already
- **Mike Brown** - Has an unassigned card waiting for activation

### 3. **Testing Steps**

1. **Go to Cards Management page**
2. **Create a new unassigned card** (if needed)
3. **Click "Assign" on an unassigned card**
4. **Check "Assign to existing customer" radio button**
5. **Open the customer dropdown**

**Expected Result**: Only customers without active cards or with blocked cards only should appear.

### 4. **Test Scenarios**

#### Scenario A: Customer with No Cards
- **Status**: Should appear in dropdown ✅
- **Reason**: New customer, available for first card

#### Scenario B: Customer with Active Card
- **Status**: Should NOT appear in dropdown ❌
- **Reason**: Already has an active card

#### Scenario C: Customer with Blocked Card
- **Status**: Should appear in dropdown ✅
- **Reason**: Can be assigned a new card to replace blocked one

#### Scenario D: Customer with Mixed Cards (Active + Blocked)
- **Status**: Should NOT appear in dropdown ❌
- **Reason**: Has at least one active card

### 5. **UI Messages to Verify**

#### When Customers Available:
- Dropdown shows eligible customers
- Blue info box explains the logic
- "Each customer can only have one active card at a time"

#### When No Customers Available:
- Empty dropdown
- Message: "No customers available for card assignment. All customers already have active cards or create a new customer instead."
- User should create new customer

### 6. **Business Logic Verification**

**Rule**: One customer = One active card maximum

**Before Fix**: Could assign multiple active cards to same customer ❌
**After Fix**: Only shows customers eligible for new card assignment ✅

## 🎉 Success Criteria

✅ Dropdown only shows customers without active cards
✅ Customers with blocked cards appear (can get replacement)
✅ Customers with active cards don't appear
✅ Clear messaging explains the logic
✅ "Create new customer" option always available
✅ Search works within available customers only

**The customer assignment logic now perfectly prevents duplicate active card assignments!**
