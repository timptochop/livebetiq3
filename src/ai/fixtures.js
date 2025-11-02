// src/ai/fixtures.js
import analyzeMatch from '../utils/analyzeMatch';

const SAFE_FIXTURE = {
  id: 'fx-safe-1',
  name: 'Player A vs Player B',
  status: 'Set 2',
  categoryName: 'ATP 250',
  surface: 'hard',
  players: [
    { name: 'Player A', s1: 6, s2: 3 },
    { name: 'Player B', s1: 4, s2: 2 }
  ],
  odds: {
    p1: 1.55,
    p2: 2.4
  }
};

const RISKY_FIXTURE = {
  id: 'fx-risky-1',
  name: 'Player A vs Player B',
  status: 'Set 2',
  categoryName: 'Challenger',
  surface: 'clay',
  players: [
    { name: 'Player A', s1: 4, s2: 3 },
    { name: 'Player B', s1: 6, s2: 2 }
  ],
  odds: {
    p1: 1.65,
    p2: 2.1
  }
};

const AVOID_FIXTURE = {
  id: 'fx-avoid-1',
  name: 'Player A vs Player B',
  status: 'Set 2',
  categoryName: 'ITF',
  surface: 'clay',
  players: [
    { name: 'Player A', s1: 5, s2: 2 },
    { name: 'Player B', s1: 7, s2: 4 }
  ],
  odds: {
    p1: 1.45,
    p2: 2.8
  }
};

const BORDER_FIXTURE = {
  id: 'fx-border-1',
  name: 'Player A vs Player B',
  status: 'Set 2',
  categoryName: 'WTA',
  surface: 'hard',
  players: [
    { name: 'Player A', s1: 6, s2: 2 },
    { name: 'Player B', s1: 4, s2: 3 }
  ],
  odds: {
    p1: 1.52,
    p2: 2.35
  }
};

export function runFixtureSafe() {
  return analyzeMatch(SAFE_FIXTURE);
}

export function runFixtureRisky() {
  return analyzeMatch(RISKY_FIXTURE);
}

export function runFixtureAvoid() {
  return analyzeMatch(AVOID_FIXTURE);
}

export function runFixtureBorder() {
  return analyzeMatch(BORDER_FIXTURE);
}

export function runAllFixtures() {
  return {
    safe: runFixtureSafe(),
    risky: runFixtureRisky(),
    avoid: runFixtureAvoid(),
    border: runFixtureBorder()
  };
}