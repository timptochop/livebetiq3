// src/ai/fixtures.js
import analyzeMatch from '../utils/analyzeMatch';

function makeMatch(overrides = {}) {
  return {
    id: overrides.id || 'fx-' + Math.random().toString(36).slice(2, 8),
    name: overrides.name || 'Player A vs Player B',
    date: overrides.date || '02.11.2025',
    time: overrides.time || '12:00',
    status: overrides.status || 'Set 2',
    categoryName: overrides.categoryName || 'Atp - Singles: Test (Hard)',
    surface: overrides.surface || 'Hard',
    players: overrides.players || [
      {
        name: 'Player A',
        s1: 6,
        s2: 2,
      },
      {
        name: 'Player B',
        s1: 4,
        s2: 1,
      },
    ],
    odds: overrides.odds || {
      p1: 1.55,
      p2: 2.35,
    },
    ...overrides,
  };
}

const FIX_SAFE = makeMatch({
  id: 'fx-safe-001',
  name: 'Alcaraz vs Medvedev',
  categoryName: 'ATP - Singles: Test',
  status: 'Set 2',
  players: [
    { name: 'Alcaraz', s1: 6, s2: 3 },
    { name: 'Medvedev', s1: 4, s2: 2 },
  ],
  odds: { p1: 1.52, p2: 2.55 },
  surface: 'Hard (Indoor)',
});

const FIX_RISKY = makeMatch({
  id: 'fx-risky-001',
  name: 'Sinner vs Rublev',
  categoryName: 'ATP - Singles: Test',
  status: 'Set 2',
  players: [
    { name: 'Sinner', s1: 6, s2: 2 },
    { name: 'Rublev', s1: 4, s2: 3 },
  ],
  odds: { p1: 1.6, p2: 2.4 },
  surface: 'Hard',
});

const FIX_AVOID = makeMatch({
  id: 'fx-avoid-001',
  name: 'Unknown vs Random',
  categoryName: 'ITF Men - Whatever',
  status: 'Set 2',
  players: [
    { name: 'Unknown', s1: 6, s2: 6 },
    { name: 'Random', s1: 7, s2: 6 },
  ],
  odds: { p1: 1.75, p2: 1.95 },
  surface: 'Clay',
});

const FIX_BORDER = makeMatch({
  id: 'fx-border-001',
  name: 'Border Guy vs Edge Man',
  categoryName: 'Challenger Men - Test',
  status: 'Set 2',
  players: [
    { name: 'Border Guy', s1: 6, s2: 3 },
    { name: 'Edge Man', s1: 6, s2: 3 },
  ],
  odds: { p1: 1.58, p2: 2.3 },
  surface: 'Hard',
});

export function runFixtureSafe() {
  const res = analyzeMatch(FIX_SAFE);
  console.log('[LBQ][fixtures] SAFE →', res, FIX_SAFE);
  return res;
}

export function runFixtureRisky() {
  const res = analyzeMatch(FIX_RISKY);
  console.log('[LBQ][fixtures] RISKY →', res, FIX_RISKY);
  return res;
}

export function runFixtureAvoid() {
  const res = analyzeMatch(FIX_AVOID);
  console.log('[LBQ][fixtures] AVOID →', res, FIX_AVOID);
  return res;
}

export function runFixtureBorder() {
  const res = analyzeMatch(FIX_BORDER);
  console.log('[LBQ][fixtures] BORDER →', res, FIX_BORDER);
  return res;
}

export function runAllFixtures() {
  const safe = runFixtureSafe();
  const risky = runFixtureRisky();
  const avoid = runFixtureAvoid();
  const border = runFixtureBorder();
  return { safe, risky, avoid, border };
}

export function listFixtures() {
  return [
    { id: 'fx-safe-001', label: 'SAFE candidate', match: FIX_SAFE },
    { id: 'fx-risky-001', label: 'RISKY candidate', match: FIX_RISKY },
    { id: 'fx-avoid-001', label: 'AVOID candidate', match: FIX_AVOID },
    { id: 'fx-border-001', label: 'BORDER candidate', match: FIX_BORDER },
  ];
}

export function runFixtureByKey(key) {
  switch (key) {
    case 'safe':
    case 'fx-safe-001':
      return runFixtureSafe();
    case 'risky':
    case 'fx-risky-001':
      return runFixtureRisky();
    case 'avoid':
    case 'fx-avoid-001':
      return runFixtureAvoid();
    case 'border':
    case 'fx-border-001':
      return runFixtureBorder();
    default:
      console.warn('[LBQ][fixtures] unknown key:', key);
      return null;
  }
}

export default {
  runFixtureSafe,
  runFixtureRisky,
  runFixtureAvoid,
  runFixtureBorder,
  runAllFixtures,
  listFixtures,
  runFixtureByKey,
};