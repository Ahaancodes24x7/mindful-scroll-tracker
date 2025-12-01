#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Simple Naive Bayes trainer to produce a model JSON compatible with the
// extension's `trainNBFromExamples` output shape.
// Usage:
//   node tools/train_nb.js --in=data/training_import.json --out=data/nb_model.json

const argv = require('process').argv.slice(2);
const args = {};
argv.forEach(a => {
  const [k,v] = a.split('=');
  if (k.startsWith('--')) args[k.slice(2)] = v || true;
});

function tokenize(text) {
  if (!text) return [];
  return String(text).toLowerCase().split(/\W+/).filter(Boolean);
}

const repoRoot = path.resolve(__dirname, '..');
const inPath = args.in ? path.resolve(args.in) : path.join(repoRoot, 'data', 'training_import.json');
const outPath = args.out ? path.resolve(args.out) : path.join(repoRoot, 'data', 'nb_model.json');

if (!fs.existsSync(inPath)) {
  console.error('Input training file not found:', inPath);
  process.exit(1);
}

let raw = fs.readFileSync(inPath, 'utf8');
let arr;
try {
  const parsed = JSON.parse(raw);
  // support either an array or an object like { exportedAt, examples }
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.examples)) arr = parsed.examples;
  else throw new Error('Unsupported input shape');
} catch (err) {
  console.error('Failed to parse input JSON:', err && err.message);
  process.exit(1);
}

const model = { classes: {}, vocab: {}, totalDocs: 0 };
model.totalDocs = arr.length;
arr.forEach(ex => {
  const cls = ex.label;
  if (!cls) return;
  if (!model.classes[cls]) model.classes[cls] = { docCount: 0, tokenCounts: {}, totalTokens: 0 };
  model.classes[cls].docCount += 1;
  const tokens = tokenize(ex.text || '');
  tokens.forEach(t => {
    model.vocab[t] = true;
    model.classes[cls].tokenCounts[t] = (model.classes[cls].tokenCounts[t] || 0) + 1;
    model.classes[cls].totalTokens += 1;
  });
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(model, null, 2), 'utf8');
console.log('Wrote NB model to', outPath);
console.log('Classes:', Object.keys(model.classes).length, 'Vocab size:', Object.keys(model.vocab).length, 'Docs:', model.totalDocs);

process.exit(0);
