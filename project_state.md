# LiveBet IQ – Project State (v0.95-stable)

## Summary
- Frontend: React (CRA), mobile-first UI
- Data source: `/api/predictions` (mock για τώρα, έτοιμο για live API)
- AI Core: `src/utils/aiPredictionEngine.js`
  - EV: fair probabilities (overround normalization), ποσοστό %
  - Confidence: odds spread + overround quality, clamped 30–92
  - Labels: SAFE / RISKY / AVOID / STARTS SOON
  - Notes: auto-generated
- Notifications: SAFE/RISKY με EV>5, ήχος `public/notification.mp3` + vibration (όπου υποστηρίζεται)

## Key Files
- `src/App.js`
- `src/components/TopBar.js` + `src/components/TopBar.css`
- `src/LiveTennis.js`
- `src/utils/aiPredictionEngine.js`
- `public/notification.mp3`
- `api/predictions.js` (ή `server/mockGoalServeAPI.js`)

## ENV
- (Προαιρετικό) `REACT_APP_API_URL=<url του backend>`. Αν λείπει, ο client καλεί `/api/predictions`.

## Local run
- `npm install`
- `npm start`
- (αν έχεις local server) `npm run server`

## Deploy (Vercel)
- Build Command: `npm run build`
- Output: `build`
- Προαιρετικά: ορισμός `REACT_APP_API_URL` στα Project Settings → Environment Variables

## Current Version
- Tag (στόχος): `v0.95-stable`
- Status: ✅ stable UI, ✅ notifications, ✅ filters, ⏳ live API integration

## Next Milestones
1) Σύνδεση live API & normalizer
2) Feature engineering (momentum/leverage)
3) Backtesting & calibration
4) ML baseline (logistic/GBM)

## Changelog
- 2025-08-XX: Προσθήκη fair EV & improved Confidence, notifications refine.