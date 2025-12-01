#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Augment the bundled training_import.json to create a larger balanced dataset.
// Usage:
// node tools/augment_and_prepare.js --in=data/training_import.json --out=data/prepared_training.json --max=2000

const argv = process.argv.slice(2);
const args = {};
argv.forEach(a => { const [k,v]=a.split('='); if (k.startsWith('--')) args[k.slice(2)] = v||true; });

const repoRoot = path.resolve(__dirname, '..');
const inPath = args.in ? path.resolve(args.in) : path.join(repoRoot, 'data', 'training_import.json');
const outPath = args.out ? path.resolve(args.out) : path.join(repoRoot, 'data', 'prepared_training.json');
const max = args.max ? parseInt(args.max,10) : 2000;

if (!fs.existsSync(inPath)) { console.error('Input not found:', inPath); process.exit(1); }
const raw = fs.readFileSync(inPath,'utf8');
let arr = JSON.parse(raw);
if (arr && arr.examples) arr = arr.examples;

function tokenize(s){ return String(s).split(/(\s+)/).filter(Boolean); }
function randomChoice(a){ return a[Math.floor(Math.random()*a.length)]; }

const fillers = ['Honestly,', 'Right now,', 'I think', 'It feels like', 'To be honest,', 'Just saying,'];

function augmentOnce(text){
  const words = tokenize(text);
  if (words.length < 3) return text;
  const r = Math.random();
  if (r < 0.25) {
    // swap two random words
    const i = Math.floor(Math.random()*(words.length-1));
    const j = Math.floor(Math.random()*(words.length-1));
    const tmp = words[i]; words[i]=words[j]; words[j]=tmp;
    return words.join('');
  } else if (r < 0.5) {
    // remove a small word (not punctuation)
    const idx = Math.floor(Math.random()*(words.length));
    words.splice(idx,1);
    return words.join('');
  } else if (r < 0.8) {
    // add a filler prefix
    return randomChoice(fillers) + ' ' + text;
  } else {
    // append a short clause
    return text + ' ' + randomChoice(['I guess.', 'Just saying.', 'It felt that way.']);
  }
}

// Group by label
const byLabel = {};
arr.forEach(ex => { if (!ex || !ex.label) return; byLabel[ex.label]=byLabel[ex.label]||[]; byLabel[ex.label].push(ex.text); });
const labels = Object.keys(byLabel);
if (labels.length === 0) { console.error('No labeled examples found'); process.exit(1); }

const perLabel = Math.ceil(max / labels.length);
const out = [];
const seen = new Set();

labels.forEach(lbl => {
  const pool = byLabel[lbl];
  let i = 0;
  while (out.filter(e=>e.label===lbl).length < perLabel) {
    const base = pool[i % pool.length];
    let text = base;
    // sometimes keep original, other times augment
    if (Math.random() > 0.3) text = augmentOnce(base);
    const key = text.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ text, label: lbl });
    }
    i++;
    // safety cap
    if (i > pool.length * 20) break;
  }
});

// Trim to max
const final = out.slice(0, max);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(final, null, 2), 'utf8');
console.log('Wrote prepared examples:', final.length, 'to', outPath);

process.exit(0);
