#!/usr/bin/env node
/*
Generic fetch-and-prepare script
Usage (PowerShell):
node .\tools\fetch_and_prepare_dataset.js --url="<raw_file_url>" --format=jsonl --textField=text --labelField=label --out=data\prepared_training.json --max=2000

Supported formats: json (array), jsonl (one JSON per line), csv
For csv, specify --textField and --labelField column names.
Optionally provide a mapping file (JSON) via --map=<path> or inline mappings via --mapInline='{"anger":["stress"],"joy":["positive"]}'

The script writes an array of {text,label} objects to the output file.
*/

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const args = {};
argv.forEach(a => {
  const [k,v] = a.split('=');
  if (k.startsWith('--')) args[k.slice(2)] = v || true;
});

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.headers.location) {
        resolve(fetchUrl(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('Failed to fetch: ' + res.statusCode));
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const sep = ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(l => {
    // naive CSV split, will fail on quoted commas but acceptable for many simple CSVs
    const parts = l.split(sep).map(p => p.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h,i) => obj[h] = parts[i] || '');
    return obj;
  });
  return rows;
}

function loadMap(mapPath, mapInline) {
  if (mapInline) return JSON.parse(mapInline);
  if (!mapPath) return null;
  const p = path.resolve(mapPath);
  if (!fs.existsSync(p)) throw new Error('Mapping file not found: ' + p);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  try {
    const url = args.url;
    if (!url) {
      console.error('Please provide --url=<raw_file_url>');
      process.exit(1);
    }
    const format = (args.format || 'jsonl').toLowerCase();
    const textField = args.textField || 'text';
    const labelField = args.labelField || 'label';
    const out = args.out ? path.resolve(args.out) : path.resolve(__dirname, '..', 'data', 'prepared_training.json');
    const max = args.max ? parseInt(args.max, 10) : null;
    const mapInline = args.mapInline ? args.mapInline : null;
    const mapPath = args.map ? args.map : null;
    const mapping = loadMap(mapPath, mapInline);

    console.log('Fetching', url);
    const raw = await fetchUrl(url);
    let examples = [];
    if (format === 'jsonl') {
      const lines = raw.split(/\r?\n/).filter(Boolean);
      lines.forEach(l => {
        try {
          const o = JSON.parse(l);
          if (o[textField] && o[labelField]) examples.push({ text: String(o[textField]), label: String(o[labelField]) });
        } catch (e) {}
      });
    } else if (format === 'json') {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) {
        obj.forEach(o => { if (o[textField] && o[labelField]) examples.push({ text: String(o[textField]), label: String(o[labelField]) }); });
      } else {
        console.error('JSON root is not an array');
        process.exit(1);
      }
    } else if (format === 'csv') {
      const rows = parseCSV(raw);
      rows.forEach(r => { if (r[textField] && r[labelField]) examples.push({ text: String(r[textField]), label: String(r[labelField]) }); });
    } else {
      throw new Error('Unsupported format: ' + format);
    }

    console.log('Fetched examples count:', examples.length);

    // Apply mapping if provided (mapping maps sourceLabel -> targetLabel or array)
    if (mapping) {
      const mapped = [];
      examples.forEach(ex => {
        const src = ex.label;
        if (mapping[src]) {
          const targets = Array.isArray(mapping[src]) ? mapping[src] : [mapping[src]];
          targets.forEach(t => mapped.push({ text: ex.text, label: t }));
        } else if (mapping['*']) {
          // default mapping
          mapped.push({ text: ex.text, label: mapping['*'] });
        }
      });
      examples = mapped;
      console.log('After mapping, examples:', examples.length);
    }

    // Deduplicate by text (simple)
    const seen = new Set();
    const unique = [];
    for (const ex of examples) {
      const key = ex.text.trim().toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(ex); }
    }
    examples = unique;

    // Balance classes roughly by sampling up to max per class if max specified
    if (max) {
      const byClass = {};
      examples.forEach(e => { byClass[e.label] = byClass[e.label] || []; byClass[e.label].push(e); });
      const labels = Object.keys(byClass);
      const perClass = Math.max(1, Math.floor(max / Math.max(1, labels.length)));
      const sampled = [];
      labels.forEach(lbl => {
        const arr = byClass[lbl];
        if (!arr) return;
        // shuffle
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        sampled.push(...arr.slice(0, perClass));
      });
      examples = sampled;
    }

    // Write output
    const payload = examples.map(e => ({ text: e.text, label: e.label }));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
    console.log('Wrote', payload.length, 'examples to', out);
    console.log('Done. Import the file from the popup Training -> Import.');
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
