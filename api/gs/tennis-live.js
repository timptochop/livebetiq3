export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const matches = await fetchLiveTennis(); // ή fetchGoalServeData
    res.status(200).json({ matches });
  } catch (error) {
    console.error('[API] tennis-live error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}