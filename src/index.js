import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

// Βρίσκει το div με id="root" από το index.html
const container = document.getElementById("root");
const root = createRoot(container);

// Κάνει render το App component
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Optional: καταγράφει performance metrics
reportWebVitals();