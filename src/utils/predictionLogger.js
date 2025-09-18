// src/utils/predictionLogger.js
// Log SAFE/RISKY μία φορά ανά match-id στο localStorage (για calibration).

const KEY = 'lbq_predictions_v1';

function safeGet(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  }catch{ return []; }
}
function safeSet(arr){
  try{
    localStorage.setItem(KEY, JSON.stringify(arr.slice(-500)));
  }catch{}
}

export function logPredictionOnce(match, ai){
  try{
    const status = match?.status || match?.['@status'] || '';
    if (!status) return;
    const id = match?.id || match?.['@id'] ||
      `${match?.date || match?.['@date']}-${match?.time || match?.['@time']}-${ai?.pick || 'NA'}`;

    const arr = safeGet();
    if (arr.some(x => x.id === id)) return;

    const players = Array.isArray(match?.players) ? match.players
                  : Array.isArray(match?.player)  ? match.player : [];
    const name1 = players?.[0]?.name || players?.[0]?.['@name'] || '';
    const name2 = players?.[1]?.name || players?.[1]?.['@name'] || '';

    const row = {
      ts: Date.now(),
      id,
      label: ai?.label || null,
      pick: ai?.pick || ai?.tip || null,
      name1, name2,
      date: match?.date || match?.['@date'] || '',
      time: match?.time || match?.['@time'] || '',
      status,
    };
    arr.push(row);
    safeSet(arr);
    console.log('[LBQ][LOG]', row);
  }catch{}
}

export function getPredictionsLog(){ return safeGet(); }
export function clearPredictionsLog(){ safeSet([]); }