// server/index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { fetchLiveTennis } = require('../api/_lib/goalServeLiveAPI');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/gs/tennis-live', async (req, res) => {
  try {
    const data = await fetchLiveTennis();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'fetch_failed', message: err.message || 'unknown_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});