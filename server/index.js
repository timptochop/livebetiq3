const express = require('express');
const cors = require('cors');
const mockGoalServeAPI = require('./mockGoalServeAPI');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// Κύρια διαδρομή
app.use('/api/tennis', mockGoalServeAPI);

// ✅ Alias διαδρομή για το frontend
app.use('/api/predictions', mockGoalServeAPI);

app.listen(PORT, () => {
  console.log('✅ Server running on port ' + PORT);
});