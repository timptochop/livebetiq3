// src/tipFix.js
// Καθαρίζει ΔΥΟ περιπτώσεις:
// 1) "TIP: TIP: ..." στο ίδιο textNode
// 2) "TIP:" σε γειτονικά nodes (π.χ. <strong>TIP:</strong> <span>TIP: ...</span>)

function dedupeTipText(s) {
  if (!s) return s;
  // Μείωσε πολλαπλά "TIP:" σε ένα
  return s.replace(/\bTIP:\s*TIP:\s*/gi, 'TIP: ');
}

function fixContainer(el) {
  if (!el || !el.textContent) return;

  // Αν ΟΛΟ το textContent έχει "TIP: TIP:", απλό replace χωρίς να πειράξουμε άλλους τίτλους
  if (/TIP:\s*TIP:/i.test(el.textContent)) {
    // Προσπάθησε πρώτα να “κουρέψεις” το ΔΕΥΤΕΡΟ "TIP:" αν είναι σε ξεχωριστό node
    const kids = Array.from(el.childNodes);
    // Βρες τον πρώτο κόμβο που “μοιάζει” με TIP:
    const firstIdx = kids.findIndex(n => (n.textContent || '').trim().toUpperCase().startsWith('TIP:'));
    if (firstIdx >= 0) {
      // Ψάξε τον αμέσως επόμενο text-like node που ΞΕΚΙΝΑ με "TIP:"
      for (let i = firstIdx + 1; i < kids.length; i++) {
        const n = kids[i];
        const txt = (n.textContent || '').trim();
        if (!txt) continue;
        if (txt.toUpperCase().startsWith('TIP:')) {
          // “Κούρεμα” του δεύτερου TIP:
          const newTxt = n.textContent.replace(/^\s*TIP:\s*/i, '');
          if (newTxt !== n.textContent) n.textContent = newTxt;
          break;
        }
        // Αν πέσουμε σε block με κείμενο, κάνε inline replace
        if (/TIP:\s*TIP:/i.test(n.textContent || '')) {
          n.textContent = dedupeTipText(n.textContent);
          break;
        }
      }
    }

    // Τελικός καθαρισμός στο container (πιάνει και την περίπτωση 1)
    if (/TIP:\s*TIP:/i.test(el.textContent)) {
      // Προσοχή: αλλάζουμε μόνο textNodes (όχι ολόκληρο innerHTML για να μη χαθεί styling)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let t;
      while ((t = walker.nextNode())) {
        const v = t.nodeValue;
        if (!v) continue;
        const nv = dedupeTipText(v);
        if (nv !== v) t.nodeValue = nv;
      }
    }
  }
}

function scan(root) {
  if (!root) return;
  // Στόχευση: όποιο στοιχείο περιέχει "TIP: TIP:" στο textContent
  const all = root.querySelectorAll('*');
  all.forEach(el => {
    const txt = el.textContent || '';
    if (txt && /TIP:\s*TIP:/i.test(txt)) fixContainer(el);
  });
}

// ── bootstrap ────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined' && document?.body) {
  // αρχικό πέρασμα
  scan(document.body);

  // παρακολούθηση μεταβολών (live updates)
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(n => {
        if (n.nodeType === 1) scan(n);
      });
      if (m.type === 'characterData' && m.target?.nodeType === 3) {
        const parent = m.target.parentElement;
        if (parent && /TIP:\s*TIP:/i.test(parent.textContent || '')) {
          fixContainer(parent);
        }
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
}