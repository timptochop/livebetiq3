// src/utils/analyzeMatch.js
import classifyMatch from "./aiPredictionEngine";

export default function analyzeMatch(match) {
  try { return classifyMatch(match); }
  catch { return { label: "PENDING" }; }
}