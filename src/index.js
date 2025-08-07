const express = require('express');
const cors = require('cors');
const app = express();
const mockAPI = require('./mockGoalServeAPI');

app.use(cors());

app.get('/api/live-matches', (req, res) => {
  res.json(mockAPI());
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});