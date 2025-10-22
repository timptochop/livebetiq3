// src/ai/exposeDev.js
import { calculateEV, estimateConfidence, generateLabel, generateNote } from './aiEngine';

if (typeof window !== 'undefined') {
  window.LBQ_ai = { calculateEV, estimateConfidence, generateLabel, generateNote };
}