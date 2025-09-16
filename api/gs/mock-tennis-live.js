// File: api/gs/mock-tennis-live.js
export default function handler(req, res) {
  res.status(200).json({
    matches: [
      {
        id: "demo-1",
        tournament: "US Open",
        home: "J. Sinner",
        away: "C. Alcaraz",
        status: "In Progress",
        time: "1:23",
      },
      {
        id: "demo-2",
        tournament: "ATP 250",
        home: "S. Tsitsipas",
        away: "A. Zverev",
        status: "Not Started",
        time: "18:30",
      },
    ],
    error: null,
  });
}