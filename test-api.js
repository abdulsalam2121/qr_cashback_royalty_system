// Simple test script to check API connectivity
const fetch = require('node-fetch');

async function testAPI() {
    try {
        console.log('Testing backend health endpoint...');
        const healthResponse = await fetch('http://localhost:3002/healthz');
        const healthData = await healthResponse.text();
        console.log('Health check result:', healthData);
        
        console.log('\nTesting platform plans endpoint (should fail without auth)...');
        const plansResponse = await fetch('http://localhost:3002/api/platform/plans');
        console.log('Plans endpoint status:', plansResponse.status);
        console.log('Plans endpoint response:', await plansResponse.text());
        
    } catch (error) {
        console.error('Error testing API:', error.message);
    }
}

testAPI();
