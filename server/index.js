// server/index.js
import express from 'express';
import path from 'path';

import mockGoalServeAPI from './mockGoalServeAPI.js'; // κρατάει τα /api/predictions (ή ό,τι έχεις)
import telemetry from './telemetry.js';               // ΝΕΟ: τα endpoints για telemetry

const app = express();
app.use(express.json());

// ---- API routes ----
app.use('/api', mockGoalServeAPI); // υπάρχον
app.use('/api', telemetry);        // ΝΕΟ

// ---- static (CRA build) ----
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log('[server] listening on', port));