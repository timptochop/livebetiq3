import React from "react";
import "./styles.css";
import logo from "../public/logo192.png";

const LiveTennis = () => {
  const predictions = [
    { match: "Alexander Zverev vs Roberto Bautista Agut", status: "SAFE", live: true },
    { match: "Taro Daniel vs Luca Nardi", status: "RISKY", live: true },
    { match: "Denis Shapovalov vs Taro Daniel", status: "AVOID", live: false },
    { match: "Linda Noskova vs Katie Boulter", status: "STARTS SOON", live: false },
  ];

  const getStatusClass = (status) => {
    switch (status) {
      case "SAFE": return "status-safe";
      case "RISKY": return "status-risky";
      case "AVOID": return "status-avoid";
      default: return "status-soon";
    }
  };

  return (
    <div>
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Live Bet IQ Logo" />
          <h1>LIVE BET IQ</h1>
        </div>
        <div className="header-icons">
          <i className="fas fa-cog"></i>
          <i className="fas fa-lock"></i>
        </div>
      </header>

      <div className="prediction-container">
        {predictions.map((item, index) => (
          <div key={index} className="prediction-card">
            <div className="prediction-left">
              <div className={item.live ? "dot-live" : "dot-offline"}></div>
              <div className="prediction-text">{item.match}</div>
            </div>
            <div className={`status-label ${getStatusClass(item.status)}`}>
              {item.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveTennis;