// src/hooks/useLiveCount.js
// Ενημερώνει το LIVE chip με βάση το πλήθος στοιχείων της λίστας.
// Δεν αλλάζει τίποτα στο UI, απλώς πυροδοτεί το event.

import { useEffect } from 'react';
import { setLiveCount } from '../utils/liveCounter';

export default function useLiveCount(items) {
  useEffect(() => {
    const n = Array.isArray(items) ? items.length : 0;
    setLiveCount(n);
  }, [items]);
}