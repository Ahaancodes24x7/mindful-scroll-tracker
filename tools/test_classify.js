#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function tokenize(text) {
  if (!text) return [];
  return String(text).toLowerCase().split(/\W+/).filter(Boolean);
}

function classifyWithModel(text, model) {
  if (!model || !model.classes || Object.keys(model.classes).length === 0) return { label: 'unknown', probabilities: {}, scores: {} };
  const tokens = tokenize(text);
  const V = Object.keys(model.vocab).length || 1;
  const logScores = {};
  Object.entries(model.classes).forEach(([cls, info]) => {
    const prior = (info.docCount + 1) / (model.totalDocs + Object.keys(model.classes).length);
    let score = Math.log(prior);
    const denom = info.totalTokens + V;
    tokens.forEach(t => {
      const count = info.tokenCounts[t] || 0;
      score += Math.log((count + 1) / denom);
    });
    logScores[cls] = score;
  });
  const maxLog = Math.max(...Object.values(logScores));
  const exps = Object.fromEntries(Object.entries(logScores).map(([k,v]) => [k, Math.exp(v - maxLog)]));
  const sumExps = Object.values(exps).reduce((s,v) => s+v, 0);
  const probs = Object.fromEntries(Object.entries(exps).map(([k,v]) => [k, v / sumExps]));
  const best = Object.entries(probs).sort((a,b) => b[1]-a[1])[0];
  return { label: best ? best[0] : 'unknown', probabilities: probs, scores: logScores };
}

const modelPath = path.resolve(__dirname, '..', 'data', 'nb_model.json');
if (!fs.existsSync(modelPath)) {
  console.error('Model not found at', modelPath);
  process.exit(1);
}
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

const samples = [
  'I am so stressed about my exams, my hands shake and I cannot sleep.',
  'I feel no energy to start my hobbies anymore, nothing motivates me.',
  'The weather is fine, meeting at 2pm.',
  'I enjoyed a peaceful walk and felt happy and content.'
];

samples.forEach(s => {
  const r = classifyWithModel(s, model);
  console.log('TEXT:', s);
  console.log('PREDICT:', r.label);
  console.log('PROBS:', r.probabilities);
  console.log('---');
});

process.exit(0);
