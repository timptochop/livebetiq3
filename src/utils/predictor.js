// src/utils/predictor.js
import analyzeMatch from "./analyzeMatch";

/**
 * Thin wrapper kept for backwards compatibility.
 * Usage: import predict from '../utils/predictor';
 */
export default function predict(match) {
  return analyzeMatch(match);
}