// server/index.js
import express from 'express';
import path from 'path';
import telemetry from './telemetry.js'; // ⬅️ NEW

const app = express();
app.use(express.json());

// --- existing API routes of yours ---
// import your other routers here and app.use('/api/xxx', ...)

// telemetry endpoints (silent logs)
app.use('/api', telemetry);

// static (CRA build) — keep whatever you already had
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log('server up on', port));