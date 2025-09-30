// src/utils/aiPredictionEngine.js
import { computeFeatures, score, impliedProbFromMatch } from "./aiEngineV2";

/** Επιστρέφει το όνομα του φαβορί (με βάση τις αποδόσεις) */
function favoriteName(m = {}) {
  const players = Array.isArray(m.players) ? m.players
                : Array.isArray(m.player)  ? m.player  : [];
  const p1 = players[0] || {}, p2 = players[1] || {};
  const name1 = p1.name || p1["@name"] || "";
  const name2 = p2.name || p2["@name"] || "";

  const o = m.odds || m.liveOdds || {};
  const h = Number(o.home ?? o.h ?? o.a1 ?? o.p1);
  const a = Number(o.away ?? o.a ?? o.a2 ?? o.p2);

  if (Number.isFinite(h) && Number.isFinite(a)) {
    return h <= a ? name1 : name2;
  }
  // fallback: αν δεν έχουμε odds, πάρε τον πρώτο για συνέπεια
  return name1 || name2 || "";
}

/** Χαρτογράφηση conf -> label + kellyLevel */
function decideLabel(conf, live, features) {
  // Συγκρατημένα thresholds για λιγότερα false-positives
  if (conf >= 0.86) return { label: "SAFE",       kellyLevel: "HIGH" };
  if (conf >= 0.76) return { label: "RISKY",      kellyLevel: "MED"  };
  if (!live)        return { label: "SOON",       kellyLevel: "LOW"  };
  return             { label: "AVOID",            kellyLevel: "LOW"  };
}

/** Κύρια συνάρτηση ταξινόμησης */
export default function classifyMatch(m = {}) {
  const f = computeFeatures(m);
  const conf = score(f);
  const { label, kellyLevel } = decideLabel(conf, f.live, f);

  // TIP: προς το φαβορί. Αν δεν υπάρχει, παραλείπεται.
  const fav = favoriteName(m);
  const tip = fav ? fav : undefined;

  return {
    label,
    conf,
    kellyLevel,
    tip,
    features: {
      pOdds: f.pOdds,
      momentum: f.momentum,
      drift: f.drift,
      setNum: f.setNum,
      live: f.live
    }
  };
}