// server/index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, server: "legacy" }));

/**
 * HARD BLOCK legacy route:
 * Ensures we do NOT serve /api/gs/tennis-live from Express.
 * Vercel must serve it from api/gs/tennis-live.js instead.
 */
app.use("/api/gs/tennis-live", (req, res) => {
  res.status(410).json({
    blocked: true,
    reason: "Legacy Express route disabled. Use Vercel API route: /api/gs/tennis-live",
  });
});

app.get("/", (req, res) => {
  res.status(200).send("Legacy server running (tennis-live disabled).");
});

app.listen(PORT, () => {
  console.log(`Legacy server listening on port ${PORT}`);
});