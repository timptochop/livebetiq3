// src/components/TopSpacer.js
import React from 'react';

/**
 * Κενό κάτω από το fixed TopBar ώστε να μη «σκεπάζει» το πρώτο card.
 * Το πραγματικό ύψος ορίζεται στο CSS (.top-spacer { height: var(--topbar-h); }).
 */
export default function TopSpacer() {
  return <div className="top-spacer" aria-hidden="true" />;
}