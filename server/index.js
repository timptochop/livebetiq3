const express = require('express');
const cors = require('cors');
const mockGoalServeAPI = require('./mockGoalServeAPI');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use('/api/tennis', mockGoalServeAPI); // Mount mock tennis API

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});