// src/utils/aiFixture.js
import analyzeMatch from './analyzeMatch';

const FIXTURES = {
  safe: {
    name: 'A Player vs B Player',
    date: '02.11.2025',
    time: '12:15',
    status: 'Set 2',
    categoryName: 'WTA - Singles',
    surface: 'Hard',
    players: [
      { name: 'A Player', s1: 6, s2: 3 },
      { name: 'B Player', s1: 3, s2: 2 }
    ],
    odds: {
      p1: 1.55,
      p2: 2.35
    }
  },
  risky: {
    name: 'C Player vs D Player',
    date: '02.11.2025',
    time: '12:20',
    status: 'Set 2',
    categoryName: 'Challenger Men - Singles',
    surface: 'Hard',
    players: [
      { name: 'C Player', s1: 6, s2: 2 },
      { name: 'D Player', s1: 4, s2: 3 }
    ],
    odds: {
      p1: 1.62,
      p2: 2.25
    }
  },
  avoid: {
    name: 'E Player vs F Player',
    date: '02.11.2025',
    time: '12:25',
    status: 'Set 2',
    categoryName: 'ITF Men - Singles',
    surface: 'Clay',
    players: [
      { name: 'E Player', s1: 5, s2: 1 },
      { name: 'F Player', s1: 7, s2: 5 }
    ],
    odds: {
      p1: 1.48,
      p2: 2.55
    }
  }
};

function runFixture(key) {
  const f = FIXTURES[key];
  if (!f) {
    return {
      ok: false,
      error: 'unknown-fixture',
      fixtures: Object.keys(FIXTURES)
    };
  }
  const res = analyzeMatch(f);
  return {
    ok: true,
    fixture: key,
    input: f,
    output: res
  };
}

if (typeof window !== 'undefined') {
  window.LBQ_testFixture = runFixture;
  window.LBQ_listFixtures = () => Object.keys(FIXTURES);
  console.log('[LBQ][dev] fixtures ready:', Object.keys(FIXTURES));
}

export default runFixture;