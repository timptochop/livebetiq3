import React from "react";
import "./App.css";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img
          src={`${process.env.PUBLIC_URL}/logo192.png`}
          alt="LiveBet IQ Logo"
          style={{ width: "120px", marginBottom: "20px" }}
        />
        <h1>Welcome to LiveBet IQ 3.0</h1>
        <p>AI Betting Predictions running live.</p>
      </header>
    </div>
  );
}

export default App;