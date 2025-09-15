// File: api/gs/tennis-live.js
import { fetchGoalServeLive } from "../_lib/goalServeLiveAPI.js";

export default async function handler(req, res) {
  // CORS (ώστε να μην έχουμε μπλοκάρισμα από preview domains)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const debug = String(req.query.debug || "") === "1";

  try {
    const { matches, error, meta } = await fetchGoalServeLive({ debug });

    // ΠΟΤΕ δεν ρίχνουμε την function: αν έχει πρόβλημα ο πάροχος, απαντάμε 200 με error πεδίο
    return res.status(200).json({
      matches: Array.isArray(matches) ? matches : [],
      error: error || null,
      ...(debug ? { meta } : {}),
    });
  } catch (e) {
    // Ακόμα κι εδώ, δίνουμε ασφαλή 200 + error
    return res.status(200).json({
      matches: [],
      error: e?.message || "Unhandled error",
      ...(debug ? { meta: { crashed: true } } : {}),
    });
  }
}