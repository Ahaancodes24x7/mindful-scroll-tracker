Mindful Scroll — On-device training helper

This repository includes a small on-device Naive Bayes training pipeline and a sample dataset to bootstrap the classifier used by the content script for feed curation.

Files added:
- tools/fetch_prepare_dataset.js — Node script that prepares a JSON training file. By default it copies the bundled sample `data/training_import.json` to `data/prepared_training.json`.
- data/training_import.json — a small balanced sample dataset (30+ examples) covering labels: stress, demotivation, negative, neutral, positive.

Quick start (locally):
1. Ensure you have Node.js installed (>=14).
2. From the project root, run:

   node tools/fetch_prepare_dataset.js --out=data/prepared_training.json --max=2000

   This will create `data/prepared_training.json` with up to `--max` examples (sample included).

3. Open the extension popup in the browser and use the Training > Import button to import the generated file.
4. Click "Retrain Model" in the popup to compute the Naive Bayes model. Content scripts will pick up the model automatically.

Notes:
- The included sample dataset is small and intended to bootstrap the model. For better performance, run the script against a larger dataset (you can modify the script to fetch from a public dataset URL) or create/import your own labeled examples.
- All data and models are stored locally in `chrome.storage.local` by the extension.

If you'd like, I can extend the script to fetch real datasets from HuggingFace and map labels to our target set — confirm and I'll add that option.