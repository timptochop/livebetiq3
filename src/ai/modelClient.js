// src/ai/modelClient.js
import { setCutoffsRuntime } from './adaptTuner';

function modelUrl() {
  try { return String(process.env.REACT_APP_MODEL_URL || ''); } catch { return ''; }
}

export async function loadModelAndApply() {
  try {
    const base = modelUrl();
    if (!base) return { ok:false, reason:'no-url' };
    const u = base.includes('?') ? base + '&model=1' : base + '?model=1';
    const r = await fetch(u, { method: 'GET' });
    const j = await r.json();
    const cut = j?.cutoffs || j?.model?.cutoffs || null;
    if (cut && typeof cut === 'object') setCutoffsRuntime(cut);
    return { ok:true, cutoffs:cut || null };
  } catch {
    return { ok:false, reason:'fetch-failed' };
  }
}