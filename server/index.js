const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

const matches = require('./mockGoalServeAPI');

app.get('/api/predictions', (req, res) => {
  res.json(matches);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});