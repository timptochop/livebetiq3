// api/predictions.js
const matches = require('./_data/matches');

module.exports = (req, res) => {
  // (προαιρετικό) cache off για να βλέπεις άμεσα αλλαγές
  res.setHeader('Cache-Control', 'no-store');
  // (προαιρετικό) CORS για δοκιμές, δεν χρειάζεται αν μιλάει το ίδιο origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(matches);
};