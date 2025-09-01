function App() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'red', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '32px', 
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          color: '#111827',
          margin: 0
        }}>
          App is working!
        </h1>
        <p style={{ 
          color: '#6B7280', 
          marginTop: '8px',
          margin: '8px 0 0 0'
        }}>
          React is loaded correctly.
        </p>
      </div>
    </div>
  );
}

export default App;
