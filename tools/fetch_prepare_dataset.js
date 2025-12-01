#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Simple helper script to prepare training data for the extension.
// By default it copies the bundled sample dataset to data/prepared_training.json
// Usage:
//   node tools/fetch_prepare_dataset.js --out=data/training_import.json --max=100

const argv = require('process').argv.slice(2);
const args = {};
argv.forEach(a => {
  const [k,v] = a.split('=');
  if (k.startsWith('--')) args[k.slice(2)] = v || true;
});

const repoRoot = path.resolve(__dirname, '..');
const samplePath = path.join(repoRoot, 'data', 'training_import.json');
const outPath = args.out ? path.resolve(args.out) : path.join(repoRoot, 'data', 'prepared_training.json');
const max = args.max ? parseInt(args.max, 10) : null;

if (!fs.existsSync(samplePath)) {
  console.error('Sample training data not found at', samplePath);
  process.exit(1);
}

const raw = fs.readFileSync(samplePath, 'utf8');
let examples = JSON.parse(raw || '[]');
if (max && examples.length > max) examples = examples.slice(0, max);

fs.writeFileSync(outPath, JSON.stringify({ exportedAt: Date.now(), examples }, null, 2));
console.log('Prepared training data written to', outPath);
console.log('Examples:', examples.length);

console.log('\nNext steps: open the extension popup -> Training -> Import the generated JSON file (using the Import button)');

process.exit(0);
