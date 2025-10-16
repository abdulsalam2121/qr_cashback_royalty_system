const testLogin = async () => {
  try {
    const response = await fetch('http://localhost:3002/api/customer-auth/manual-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cardUid: 'W5KAJBO-FKBC'
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    const text = await response.text();
    console.log('Response text:', text);
    
    if (text) {
      try {
        const data = JSON.parse(text);
        console.log('Parsed JSON:', data);
      } catch (e) {
        console.log('Failed to parse as JSON:', e.message);
      }
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
};

testLogin();