// server/telemetry.js
import fs from 'fs';
import path from 'path';
import express from 'express';

const router = express.Router();

// simple JSONL logs (one JSON object per line)
const DATA_DIR = path.join(process.cwd(), '.data');
const PRED_LOG = path.join(DATA_DIR, 'predictions.jsonl');
const OUTC_LOG = path.join(DATA_DIR, 'outcomes.jsonl');

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(PRED_LOG)) fs.writeFileSync(PRED_LOG, '');
  if (!fs.existsSync(OUTC_LOG)) fs.writeFileSync(OUTC_LOG, '');
}
ensureFiles();

router.post('/log-prediction', (req, res) => {
  try {
    const row = {
      ts: Date.now(),
      id: req.body.id,
      player1: req.body.player1,
      player2: req.body.player2,
      currentSet: req.body.currentSet,
      ev: req.body.ev,
      confidence: req.body.confidence,
      label: req.body.label, // SAFE | RISKY | AVOID
      odds1: req.body.odds1,
      odds2: req.body.odds2,
      form: req.body.form ?? null,
      momentum: req.body.momentum ?? null,
      h2h: req.body.h2h ?? null,
      surfaceFit: req.body.surfaceFit ?? null,
      fatigue: req.body.fatigue ?? null,
      volatility: req.body.volatility ?? null,
    };
    fs.appendFileSync(PRED_LOG, JSON.stringify(row) + '\n');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

router.post('/log-outcome', (req, res) => {
  try {
    const row = {
      ts: Date.now(),
      id: req.body.id,
      winner: req.body.winner, // "player1" | "player2" | "void"
      sets: req.body.sets ?? null, // e.g. "2-1"
    };
    fs.appendFileSync(OUTC_LOG, JSON.stringify(row) + '\n');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

export default router;