import React from 'react';
import LiveTennis from './LiveTennis'; // ✅ Σωστό path (όχι ./components)

function App() {
  return (
    <div className="App">
      <LiveTennis />
    </div>
  );
}

export default App;