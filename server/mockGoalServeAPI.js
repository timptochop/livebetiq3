// server/mockGoalServeAPI.js
// Επιστρέφει mock αγώνες με currentSet ώστε να τεστάρουμε:
// - 3ο σετ => SAFE / RISKY
// - <3 σετ  => PENDING
// - Starts Soon => STARTS SOON

module.exports = function mockGoalServeAPI() {
  return [
    {
      id: 'm1',
      player1: 'Player A',
      player2: 'Player B',
      odds1: 1.85,
      odds2: 2.05,
      time: 'Live',
      currentSet: 3, // 👈 θα βγάλει SAFE/RISKY
      // προαιρετικά hints για το AI:
      form: 72,
      momentum: 68,
      h2h: 60,
      surfaceFit: 65,
      fatigue: 25,
      volatility: 35
    },
    {
      id: 'm2',
      player1: 'Player C',
      player2: 'Player D',
      odds1: 2.10,
      odds2: 1.75,
      time: 'Live',
      currentSet: 2, // 👈 PENDING
      form: 58,
      momentum: 52,
      h2h: 48,
      surfaceFit: 55,
      fatigue: 35,
      volatility: 45
    },
    {
      id: 'm3',
      player1: 'Player E',
      player2: 'Player F',
      odds1: 1.95,
      odds2: 1.95,
      time: 'Starts Soon',
      currentSet: 0, // 👈 STARTS SOON
      form: 61,
      momentum: 50,
      h2h: 50,
      surfaceFit: 50,
      fatigue: 30,
      volatility: 40
    }
  ];
};