export function formatTip(raw){
  if (!raw) return null;
  const s = String(raw).replace(/^\s*TIP\s*:?\s*/i,'').trim(); // βγάζει οποιοδήποτε προϋπάρχον "TIP:"
  return s ? `TIP: ${s}` : null;
}