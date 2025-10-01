// Wrapper πάνω από τον predictor ώστε να μείνει σταθερό το public API
import predictMatch from "./predictor";

// Προστατεύει το UI από undefined και δίνει ασφαλή defaults
export default function analyzeMatch(m = {}) {
  try {
    const ai = predictMatch(m) || {};
    // Επιστρέφουμε μόνο τα πεδία που χρησιμοποιεί το UI
    return {
      label: ai.label || "PENDING",
      conf: Number.isFinite(ai.conf) ? ai.conf : 0.6,
      kellyLevel: ai.kellyLevel || "LOW",
      tip: ai.tip || null,
      features: ai.features || undefined
    };
  } catch (err) {
    // Σε οποιοδήποτε σφάλμα -> PENDING για να πέσει σε SET n / SOON
    return {
      label: "PENDING",
      conf: 0.6,
      kellyLevel: "LOW",
      tip: null
    };
  }
}