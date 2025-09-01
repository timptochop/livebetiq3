const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

function parseUrlArg() {
  const arg = process.argv.find(a => a.startsWith('--url='));
  const val = arg ? arg.slice(6) : (process.env.GOALSERVE_TEST_URL || '');
  if (!val) {
    console.error('Λείπει το URL. Χρήση: node testGoalServe.js --url="https://.../endpoint?key=...&json=1"');
    process.exit(1);
  }
  return val;
}

function get(urlStr) {
  return new Promise((resolve, reject) => {
    const lib = urlStr.startsWith('https') ? https : http;
    const req = lib.get(urlStr, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ statusCode: res.statusCode, statusMessage: res.statusMessage, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

function ts() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function ensureOutDir() {
  const dir = path.join(process.cwd(), 'goalserve_test_output');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function tryXmlToJson(xmlText) {
  try {
    const { parseStringPromise } = require('xml2js');
    const json = await parseStringPromise(xmlText, { explicitArray: false, mergeAttrs: true, trim: true });
    return json;
  } catch {
    return null;
  }
}

(async () => {
  const url = parseUrlArg();
  console.log('URL:', url);
  let resp;
  try {
    resp = await get(url);
  } catch (e) {
    console.error('HTTP error:', e.message);
    process.exit(2);
  }
  console.log('Status:', resp.statusCode, resp.statusMessage);
  console.log('--- Headers ---');
  Object.entries(resp.headers || {}).forEach(([k, v]) => console.log(`${k}: ${v}`));
  const ct = (resp.headers && (resp.headers['content-type'] || resp.headers['Content-Type'])) || '';
  const body = resp.body || '';
  const outDir = ensureOutDir();
  const stamp = ts();
  const trimmed = body.trim();
  let rawExt = 'txt';
  if (ct.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) rawExt = 'json';
  else if (ct.includes('xml') || trimmed.startsWith('<')) rawExt = 'xml';
  const rawPath = path.join(outDir, `raw_${stamp}.${rawExt}`);
  fs.writeFileSync(rawPath, body);
  console.log('Raw saved:', rawPath, `(${body.length} bytes)`);
  if (rawExt === 'json') {
    try {
      const obj = JSON.parse(body);
      const prettyPath = path.join(outDir, `pretty_${stamp}.json`);
      fs.writeFileSync(prettyPath, JSON.stringify(obj, null, 2));
      console.log('Pretty JSON:', prettyPath);
      if (obj && typeof obj === 'object') console.log('Top-level keys:', Object.keys(obj));
    } catch {
      console.warn('JSON parse failed. Κρατήθηκε μόνο το raw.');
    }
  } else if (rawExt === 'xml') {
    const json = await tryXmlToJson(body);
    if (json) {
      const xmlJsonPath = path.join(outDir, `xml_as_json_${stamp}.json`);
      fs.writeFileSync(xmlJsonPath, JSON.stringify(json, null, 2));
      console.log('XML→JSON:', xmlJsonPath);
      if (json && typeof json === 'object') console.log('Top-level keys:', Object.keys(json));
    } else {
      console.log('XML parse skipped. Ίσως να λείπει το xml2js.');
    }
  } else {
    console.log('Άγνωστο content-type. Ελέγξτε το raw αρχείο.');
  }
  console.log('Done.');
})();