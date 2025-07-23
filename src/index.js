import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LiveTennis from "./LiveTennis";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LiveTennis />} />
        {/* Για μελλοντικές σελίδες */}
        {/* <Route path="/settings" element={<Settings />} /> */}
        {/* <Route path="/login" element={<Login />} /> */}
      </Routes>
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);