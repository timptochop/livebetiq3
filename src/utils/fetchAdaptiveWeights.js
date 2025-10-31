// src/utils/fetchAdaptiveWeights.js

const ADAPTIVE_WEIGHTS_URL = 'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

export default async function fetchAdaptiveWeights() {
  if (!ADAPTIVE_WEIGHTS_URL || ADAPTIVE_WEIGHTS_URL.indexOf('http') !== 0) {
    return {
      ev: 0.3,
      confidence: 0.25,
      momentum: 0.15,
      drift: 0.1,
      surface: 0.1,
      form: 0.1,
      _source: 'local-default'
    };
  }

  try {
    const res = await fetch(ADAPTIVE_WEIGHTS_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      return {
        ev: 0.3,
        confidence: 0.25,
        momentum: 0.15,
        drift: 0.1,
        surface: 0.1,
        form: 0.1,
        _source: 'fallback-http'
      };
    }
    const data = await res.json();
    return {
      ev: Number(data.ev || 0.3),
      confidence: Number(data.confidence || 0.25),
      momentum: Number(data.momentum || 0.15),
      drift: Number(data.drift || 0.1),
      surface: Number(data.surface || 0.1),
      form: Number(data.form || 0.1),
      _source: 'remote-sheet'
    };
  } catch (err) {
    return {
      ev: 0.3,
      confidence: 0.25,
      momentum: 0.15,
      drift: 0.1,
      surface: 0.1,
      form: 0.1,
      _source: 'error'
    };
  }
}