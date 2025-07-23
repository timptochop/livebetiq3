import React from "react";
import logo from "../public/logo192.png";

const matches = [
  {
    name: "Alexander Zverev vs Roberto Bautista Agut",
    status: "LIVE",
    label: "SAFE",
    labelClass: "safe",
  },
  {
    name: "Taro Daniel vs Luca Nardi",
    status: "LIVE",
    label: "RISKY",
    labelClass: "risky",
  },
  {
    name: "Denis Shapovalov vs Taro Daniel",
    status: "LIVE",
    label: "AVOID",
    labelClass: "avoid",
  },
  {
    name: "Linda Noskova vs Katie Boulter",
    status: "SOON",
    label: "STARTS SOON",
    labelClass: "soon",
  },
];

function LiveTennis() {
  return (
    <div>
      <header className="header">
        <div className="header-left">
          <img src={logo} alt="Logo" className="logo" />
          <span className="app-name">LIVE BET IQ</span>
        </div>
        <div className="header-icons">
          <i className="fas fa-cog"></i>
          <i className="fas fa-lock"></i>
        </div>
      </header>

      <div className="container">
        {matches.map((match, index) => (
          <div className="match-card" key={index}>
            <div className="match-left">
              <div
                className={`status-dot ${
                  match.status === "LIVE" ? "status-live" : "status-soon"
                }`}
              ></div>
              <span className="match-name">{match.name}</span>
            </div>
            <div className={`match-badge ${match.labelClass}`}>
              {match.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveTennis;