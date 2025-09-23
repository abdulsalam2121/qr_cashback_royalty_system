// Test script to verify cardPrintOrders route is properly registered
import express from 'express';

const app = express();

// Check if routes are registered
console.log('Checking registered routes...');

// This would show all registered routes (if we had access to the app._router)
// For now, let's just verify the file imports properly

try {
  console.log('Testing cardPrintOrders import...');
  const cardPrintOrderRoutes = await import('./src/routes/cardPrintOrders.js');
  console.log('✅ cardPrintOrders.js imported successfully');
  console.log('Default export type:', typeof cardPrintOrderRoutes.default);
  
  // Test if it's a proper router
  if (cardPrintOrderRoutes.default && typeof cardPrintOrderRoutes.default === 'function') {
    console.log('✅ Router function exported correctly');
  } else {
    console.log('❌ Router export issue');
  }
  
} catch (error) {
  console.error('❌ Import failed:', error);
}

console.log('Test completed.');