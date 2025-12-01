// mindful_scroll_content.js
// global click listener to open permission prompt on any blurred video
document.addEventListener('click', function(ev){
  try{
    const path = ev.composedPath ? ev.composedPath() : (ev.path || []);
    let blurredEl = null;
    for(const el of path){
      if(el && el.getAttribute && el.getAttribute('data-mindful-blurred')==='1'){
        blurredEl = el; break;
      }
    }
    if(!blurredEl) return;
    ev.stopPropagation(); ev.preventDefault();
    // find container
    const container = blurredEl.parentElement;
    if(!container) return;
    if(container.querySelector('.mindful-video-block-overlay')) return;
    const overlay2 = document.createElement('div');
    overlay2.className = 'mindful-video-block-overlay';
    overlay2.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:2147483647; pointer-events:auto;';
    const box2 = document.createElement('div');
    box2.style.cssText = 'background: rgba(0,0,0,0.88); color:#fff; padding:16px; border-radius:10px; min-width:260px; text-align:center; font-family: sans-serif;';
    box2.innerHTML = '<div style="font-size:15px; margin-bottom:10px;">⚠️ This clip may be upsetting. View anyway?</div>';
    const allow2 = document.createElement('button'); allow2.textContent = 'Allow'; allow2.style.cssText='margin:6px;padding:8px 12px;border-radius:6px;cursor:pointer;';
    const skip2 = document.createElement('button'); skip2.textContent = 'Skip'; skip2.style.cssText='margin:6px;padding:8px 12px;border-radius:6px;cursor:pointer;';
    box2.appendChild(allow2); box2.appendChild(skip2); overlay2.appendChild(box2);
    if (getComputedStyle(container).position === 'static' || getComputedStyle(container).position==='') container.style.position='relative';
    container.appendChild(overlay2);
    allow2.addEventListener('click', function(){ try{ blurredEl.style.filter='none'; blurredEl.removeAttribute('data-mindful-blurred'); blurredEl.play && blurredEl.play(); overlay2.remove(); }catch(e){} });
    skip2.addEventListener('click', function(){ try{ overlay2.remove(); container.style.display='none'; }catch(e){} });
  }catch(e){}
}, true);

// Final integrated content script — Mindful Scroll (strong morphing, resolution-safe, modal + strong mode)

// -------------------
//  CONFIG & GLOBALS
// -------------------
let focusAlertShown = false; // guard so focus/time-limit alerts show only once per page session

// Nudge / toast cooldown
let lastNudgeTimestamp = 0;
const NUDGE_COOLDOWN_MS = 12 * 1000; // 12 seconds between nudges

// Adaptive blur guard (single interval handle)
let adaptiveBlurInterval = null;

// Core state
let morphingInterval = null;
let currentTimeSpent = 0; // seconds (populated by background via message)
let morphingEnabled = true;
let morphingIntensity = 80; // 0-100 — increased default for stronger effect
let overlayElement = null;
let feedObserver = null;
let pausedForSite = false;
let nbModel = null;
let classifyThreshold = 0.6; // default threshold for NB probabilities

// Toast container
let toastContainer = null;

// Single-run guard
if (!window.__mindful_scroll_globals) window.__mindful_scroll_globals = {};
if (!window.__mindful_scroll_globals.initDone) window.__mindful_scroll_globals.initDone = false;

// -------------------
//  SAFE CHROME WRAPPERS
// -------------------
window.safeSendMessage = function(msg, cb) {
  try {
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      cb && cb(null);
      return;
    }
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) {
        cb && cb(null);
        return;
      }
      cb && cb(res);
    });
  } catch (e) {
    cb && cb(null);
  }
};

window.safeStorageGet = function(keys, cb) {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local || !chrome.storage.local.get) {
      cb && cb({});
      return;
    }
    chrome.storage.local.get(keys, (res) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        cb && cb({});
        return;
      }
      cb && cb(res || {});
    });
  } catch (e) {
    cb && cb({});
  }
};

// -------------------
//  SAFE FILTER APPLIER
// -------------------
function applySafeContentFilter(el, filterCss) {
  if (!el || !(el instanceof HTMLElement)) return;
  const tag = (el.tagName || '').toLowerCase();

  // If the element is or contains a <video> element, never apply blur to actual video player
  try {
    if (tag === 'video' || (el.closest && el.closest('video'))) {
      el.style.filter = 'none';
      return;
    }
  } catch (e) {}

  try {
    if (filterCss && filterCss !== 'none') {
      el.style.filter = filterCss;
      el.style.transition = 'filter 340ms ease';
      el.style.imageRendering = 'auto';
      el.style.willChange = 'filter';
    } else {
      el.style.filter = 'none';
      el.style.transition = 'filter 220ms ease';
      el.style.imageRendering = 'auto';
      el.style.willChange = 'auto';
    }
  } catch (e) {
    try { el.style.filter = filterCss || 'none'; } catch (e2) {}
  }
}

// -------------------
//  TOAST / ALERT HELPERS
// -------------------
function ensureToastContainer() {
  if (toastContainer) return;
  toastContainer = document.createElement('div');
  toastContainer.id = 'mindful-scroll-toast-container';
  toastContainer.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000020;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
  document.documentElement.appendChild(toastContainer);
}

function showInPageToast(message, duration = 4000) {
  try {
    ensureToastContainer();
    const t = document.createElement('div');
    t.textContent = message;
    t.style.cssText = 'background:rgba(17,17,17,0.95);color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.25);pointer-events:auto;opacity:0.98;font-size:13px;max-width:320px;';
    toastContainer.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity 300ms'; t.style.opacity = '0'; setTimeout(() => { try { t.remove(); } catch(e){} }, 350); }, duration);
  } catch (e) {}
}

function showAlertInPage(message) {
  try {
    if (focusAlertShown) return;
    focusAlertShown = true;
    showInPageToast(message || 'Mindful Scroll Alert', 6000);
  } catch (e) { try { showInPageToast(message || 'Mindful Scroll Alert', 6000); } catch(e2){} }
}

// -------------------
//  OVERLAY CREATION
// -------------------
function createOverlay() {
  if (overlayElement) return;
  overlayElement = document.createElement('div');
  overlayElement.id = 'mindful-scroll-overlay';
  overlayElement.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999998;
    transition: opacity 600ms ease, transform 800ms ease, backdrop-filter 600ms ease;
    opacity: 0;
  `;
  document.documentElement.appendChild(overlayElement);
  // Add a color layer inside for better color manipulation
  const colorLayer = document.createElement('div');
  colorLayer.id = 'mindful-scroll-overlay-color';
  colorLayer.style.cssText = `
    position:absolute; inset:0; pointer-events:none;
    background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 100%);
    mix-blend-mode: multiply; opacity:0; transition: opacity 600ms ease, filter 600ms ease;
  `;
  overlayElement.appendChild(colorLayer);

  // subtle pulsing using CSS animation (added dynamically)
  const style = document.createElement('style');
  style.id = 'mindful-scroll-overlay-style';
  style.textContent = `
    @keyframes mindful-pulse {
      0% { transform: scale(1); opacity: 0.95; }
      50% { transform: scale(1.01); opacity: 1; }
      100% { transform: scale(1); opacity: 0.95; }
    }
  `;
  document.head.appendChild(style);
}

// -------------------
//  TOKENIZE & NB CLASSIFIER
// -------------------
function tokenize(text) {
  return (text || '').toLowerCase().replace(/[\W_]+/g, ' ').split(/\s+/).filter(Boolean);
}

function classifyWithModel(text, model) {
  if (!model || !model.classes || Object.keys(model.classes).length === 0) return { label: 'unknown', probabilities: {}, scores: {} };
  const tokens = tokenize(text);
  const V = Math.max(1, Object.keys(model.vocab || {}).length);
  const logScores = {};
  Object.entries(model.classes).forEach(([cls, info]) => {
    const prior = ((info.docCount || 0) + 1) / ((model.totalDocs || 0) + Object.keys(model.classes).length);
    let score = Math.log(prior);
    const denom = (info.totalTokens || 0) + V;
    tokens.forEach(t => {
      const cnt = (info.tokenCounts && info.tokenCounts[t]) || 0;
      score += Math.log((cnt + 1) / denom);
    });
    logScores[cls] = score;
  });
  const maxLog = Math.max(...Object.values(logScores));
  const exps = Object.fromEntries(Object.entries(logScores).map(([k,v]) => [k, Math.exp(v - maxLog)]));
  const sumExps = Object.values(exps).reduce((s,v) => s+v, 0) || 1;
  const probs = Object.fromEntries(Object.entries(exps).map(([k,v]) => [k, v / sumExps]));
  const best = Object.entries(probs).sort((a,b) => b[1]-a[1])[0];
  return { label: best ? best[0] : 'unknown', probabilities: probs, scores: logScores };
}

// -------------------
//  SIMPLE SENTIMENT FALLBACK
// -------------------
const negativeWords = ["accident","crash","death","dead","kill","war","fight","blood","attack","violence","angry","sad","hurt","destroyed","explosion","crying","tragic"];
const positiveWords = ["peace","calm","love","hope","beautiful","smile","happy","joy","success","relax","motivation","travel"];

function analyzeSentiment(text) {
  let score = 0;
  const lower = (text || '').toLowerCase();
  negativeWords.forEach(w => { if (lower.includes(w)) score -= 1; });
  positiveWords.forEach(w => { if (lower.includes(w)) score += 1; });
  return score;
}

// -------------------
//  CURATE FEED
// -------------------

function curateFeed() {
  // New curated feed function — focused on video-only heavy blur + prompt for negative content.
  try {
    if (pausedForSite) return;
    const feedItems = document.querySelectorAll(
      "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, article, section main article, div[role='article'], div[role='presentation'], .post, .feed-item, .story, ._aagu, ._aakl, .ytd-rich-item-renderer"
    );
    if (!feedItems || feedItems.length === 0) return;

    feedItems.forEach(el => {
      // skip interactive input containers (search boxes, editors)
      try { if (el.matches && el.matches('input, textarea, [contenteditable="true"]')) return; } catch(e){}
      try { if (el.querySelector && (el.querySelector('input, textarea, [contenteditable="true"]'))) return; } catch(e){}

      try {
        // Extract associated text/title to classify
        const titleEl = el.querySelector && (el.querySelector('#video-title') || el.querySelector('h3') || el.querySelector('h2') || el.querySelector('h1') || el.querySelector('a[aria-label]') || el.querySelector('[aria-label]'));
        const aria = el.querySelector && (el.querySelector('a[aria-label]') || el.querySelector('[aria-label]'));
        let text = (titleEl && titleEl.textContent) || (aria && aria.getAttribute && aria.getAttribute('aria-label')) || el.innerText || '';
        text = (text || '').trim();
        if (!text) { 
          // ensure any previous filters are cleared on this element
          try { applySafeContentFilter(el, 'none'); el.title = ''; } catch(e){}
          return; 
        }

        // Helper to find a video-like element inside this feed item
        const findVideoElement = (container) => {
          if (!container) return null;
          const vid = container.querySelector && (container.querySelector('video') || container.querySelector('iframe') || container.querySelector('yt-player') || container.querySelector('ytd-player'));
          if (vid) return vid;
          // also look for picture/video wrappers
          const videoCandidates = container.querySelectorAll && container.querySelectorAll('div, figure, .video, .thumb, iframe, video');
          if (videoCandidates && videoCandidates.length) {
            for (let c of videoCandidates) {
              if (c.querySelector && c.querySelector('video')) return c.querySelector('video');
              if (c.tagName && (c.tagName.toLowerCase() === 'iframe' || c.tagName.toLowerCase() === 'video')) return c;
            }
          }
          return null;
        };

        // Decide negative via model or fallback sentiment
        let isNegative = false;
        let confidence = 0;
        if (nbModel) {
          const res = classifyWithModel(text, nbModel);
          confidence = res.probabilities && res.probabilities[res.label] ? res.probabilities[res.label] : 0;
          const lbl = res.label || '';
          if ((lbl === 'negative' || lbl === 'sad' || lbl === 'stress' || lbl === 'demotivation') && confidence >= (typeof classifyThreshold === 'number' ? classifyThreshold : 0.6)) {
            isNegative = true;
          }
        } else {
          // simple fallback scoring
          try {
            const score = analyzeSentiment(text);
            if (typeof score === 'number' && score <= -1) isNegative = true;
          } catch(e){}
        }

        // Additional fallback: negative word presence even if score not triggered
        try {
          if (!isNegative) {
            const lower = (text||'').toLowerCase();
            if (negativeWords && negativeWords.some(w => lower.includes(w))) {
              isNegative = true;
            }
          }
        } catch(e){}

        // If not negative, clear any previous filter and continue (unless item locked as negative)
        if (!isNegative) {
          try {
            if (el.__mindful_negative_locked) {
              // keep strongly blurred if previously locked
              try { applySafeContentFilter(el, 'blur(25px)'); } catch(e){}
              return;
            }
            applySafeContentFilter(el, 'none'); el.title = '';
          } catch(e){}
          return;
        }

        // At this point, the item is considered negative. Lock it to prevent flicker and only act on video frames.
        try { el.__mindful_negative_locked = true; } catch(e){}
        const videoEl = findVideoElement(el);
        if (videoEl) {
          // Avoid re-prompting the same item in this page session
          if (el.__mindful_prompt_shown) {
            // Keep it strongly blurred
            try { videoEl.style.filter = 'blur(25px)'; try{videoEl.setAttribute('data-mindful-blurred','1');}catch(e){}; videoEl.style.transition = 'filter 200ms ease'; } catch(e){}
          // ensure clicking on the blurred video (or its container) shows the permission prompt
          try {
            videoEl.addEventListener('click', function(ev){
              try { if (videoEl.style.filter && videoEl.style.filter.indexOf('blur')!==-1) {
                ev.preventDefault(); ev.stopPropagation();
                // create a simple overlay prompt (if not already present)
                const container = videoEl.parentElement || el;
                if (!container.querySelector('.mindful-video-block-overlay')) {
                  const overlay2 = document.createElement('div');
                  overlay2.className = 'mindful-video-block-overlay';
                  overlay2.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:2147483647; pointer-events:auto;';
                  const box2 = document.createElement('div');
                  box2.style.cssText = 'background: rgba(0,0,0,0.88); color:#fff; padding:16px; border-radius:10px; min-width:260px; text-align:center; font-family: sans-serif;';
                  box2.innerHTML = `<div style="font-size:15px; margin-bottom:10px;">⚠️ This clip may be upsetting. View anyway?</div>`;
                  const allow2 = document.createElement('button'); allow2.textContent = 'Allow'; allow2.style.cssText='margin:6px;padding:8px 12px;border-radius:6px;cursor:pointer;';
                  const skip2 = document.createElement('button'); skip2.textContent = 'Skip'; skip2.style.cssText='margin:6px;padding:8px 12px;border-radius:6px;cursor:pointer;';
                  box2.appendChild(allow2); box2.appendChild(skip2); overlay2.appendChild(box2);
                  if (getComputedStyle(container).position === 'static' || getComputedStyle(container).position==='') container.style.position='relative';
                  container.appendChild(overlay2);
                  allow2.addEventListener('click', function(){ try{ videoEl.style.filter='none'; videoEl.play && videoEl.play(); overlay2.remove(); }catch(e){} });
                  skip2.addEventListener('click', function(){ try{ overlay2.remove(); container.style.display='none'; }catch(e){} });
                }
              }} catch(e){} }, true);
          } catch(e){}
            return;
          }
          el.__mindful_prompt_shown = true;

          // Apply very strong blur and pause if possible
          try { videoEl.style.filter = 'blur(25px)'; try{videoEl.setAttribute('data-mindful-blurred','1');}catch(e){}; videoEl.style.transition = 'filter 200ms ease'; } catch(e){}
          // ensure clicking on the blurred video (or its container) shows the permission prompt
          try {
            videoEl.addEventListener('click', function(ev){
              try { if (videoEl.style.filter && videoEl.style.filter.indexOf('blur')!==-1) {
                ev.preventDefault(); ev.stopPropagation();
                // create a simple overlay prompt (if not already present)
                const container = videoEl.parentElement || el;
                if (!container.querySelector('.mindful-video-block-overlay')) {
                  const overlay2 = document.createElement('div');
                  overlay2.className = 'mindful-video-block-overlay';
                  overlay2.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:2147483647; pointer-events:auto;';
                  const box2 = document.createElement('div');
                  box2.style.cssText = 'background: rgba(0,0,0,0.88); color:#fff; padding:16px; border-radius:10px; min-width:260px; text-align:center; font-family: sans-serif;';
                  box2.innerHTML = `<div style="font-size:15px; margin-bottom:10px;">⚠️ This clip may be upsetting. View anyway?</div>`;
                  const allow2 = document.createElement('button'); allow2.textContent = 'Allow'; allow2.style.cssText='margin:6px;padding:8px 12px;border-radius:6px;cursor:pointer;';
                  const skip2 = document.createElement('button'); skip2.textContent = 'Skip'; skip2.style.cssText='margin:6px;padding:8px 12px;border-radius:6px;cursor:pointer;';
                  box2.appendChild(allow2); box2.appendChild(skip2); overlay2.appendChild(box2);
                  if (getComputedStyle(container).position === 'static' || getComputedStyle(container).position==='') container.style.position='relative';
                  container.appendChild(overlay2);
                  allow2.addEventListener('click', function(){ try{ videoEl.style.filter='none'; videoEl.play && videoEl.play(); overlay2.remove(); }catch(e){} });
                  skip2.addEventListener('click', function(){ try{ overlay2.remove(); container.style.display='none'; }catch(e){} });
                }
              }} catch(e){} }, true);
          } catch(e){}
          try { if (videoEl.tagName && videoEl.tagName.toLowerCase()==='video') { videoEl.pause && videoEl.pause(); } } catch(e){}

          // Create overlay prompt
          const overlay = document.createElement('div');
          overlay.className = 'mindful-video-block-overlay';
          overlay.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:2147483647; pointer-events:auto;';
          const box = document.createElement('div');
          box.style.cssText = 'background: rgba(0,0,0,0.88); color:#fff; padding:16px; border-radius:10px; min-width:260px; text-align:center; font-family: sans-serif; box-shadow: 0 6px 18px rgba(0,0,0,0.6);';
          const message = document.createElement('div');
          message.style.cssText = 'font-size:15px; margin-bottom:10px;';
          message.textContent = '⚠️ This clip may be upsetting. View anyway?';
          const btnAllow = document.createElement('button');
          btnAllow.textContent = 'Allow';
          btnAllow.style.cssText = 'margin:6px; padding:8px 12px; border-radius:6px; cursor:pointer;';
          const btnSkip = document.createElement('button');
          btnSkip.textContent = 'Skip';
          btnSkip.style.cssText = 'margin:6px; padding:8px 12px; border-radius:6px; cursor:pointer;';

          box.appendChild(message);
          box.appendChild(btnAllow);
          box.appendChild(btnSkip);
          overlay.appendChild(box);

          // Attach overlay to a positioned container covering video area.
          let container = videoEl.parentElement || el;
          const cs = window.getComputedStyle(container);
          if (!cs || cs.position === 'static' || cs.position === '') {
            container.style.position = 'relative';
            overlay.__mindful_positioned = true;
          }
          container.appendChild(overlay);

          // Handler: Allow -> remove blur and play if possible
          btnAllow.addEventListener('click', function(ev){
            try { videoEl.style.filter = 'none'; } catch(e){}
            try { if (videoEl.tagName && videoEl.tagName.toLowerCase()==='video') videoEl.play && videoEl.play(); } catch(e){}
            try { overlay.remove(); } catch(e){}
          });
          // Handler: Skip -> remove overlay and hide the item
          btnSkip.addEventListener('click', function(ev){
            try { overlay.remove(); } catch(e){}
            try { el.style.display = 'none'; } catch(e){}
          });

          // If iframe / cross-origin doesn't accept filter, ensure overlay fully covers it visually
          try {
            if (videoEl.tagName && videoEl.tagName.toLowerCase() === 'iframe') {
              // ensure iframe is visually blocked by our overlay (we already appended overlay)
              videoEl.style.pointerEvents = 'none';
            }
          } catch(e){}
        } else {
          // No video element found — fallback to blurring the whole item strongly
          try { applySafeContentFilter(el, 'blur(25px) brightness(0.85)'); el.title = '⚠️ Negative content filtered'; } catch(e){}
        }

      } catch(e) {
        try { applySafeContentFilter(el, 'none'); el.title = ''; } catch(e) {}
      }
    });
  } catch(e) {
    // swallow errors — don't stop the rest of the extension
    try { safeSendMessage && safeSendMessage({ action: 'error', msg: 'curateFeed failed', err: (e && e.toString && e.toString()) || e }); } catch(_){}
  }
}


// -------------------
//  MONITOR SCROLL & NEGATIVE BURSTS
// -------------------
let lastScrollY = window.scrollY || 0;
let lastScrollTime = Date.now();
let negativeBurstCount = 0;

function monitorUserScrollAndBursts() {
  window.addEventListener('scroll', () => {
    const now = Date.now();
    const dy = Math.abs(window.scrollY - lastScrollY);
    const dt = Math.max(1, now - lastScrollTime);
    const speed = dy / dt; // px per ms
    lastScrollY = window.scrollY;
    lastScrollTime = now;

    if (speed > 0.8) {
      const nowTs = Date.now();
      if (nowTs - lastNudgeTimestamp > NUDGE_COOLDOWN_MS) {
        lastNudgeTimestamp = nowTs;
        showInPageToast('⏱️ Quick scrolling? Take a short break — click to focus.', 4000);
        try { safeSendMessage({ action: 'recordNudge', reason: 'fast-scroll', site: window.location.hostname }, ()=>{}); } catch (e) {}
      }
    }
  }, { passive: true });

  setInterval(() => {
    const negatives = document.querySelectorAll('[title*="Negative or stressful content"]');
    if (negatives.length > 6) negativeBurstCount++; else negativeBurstCount = Math.max(0, negativeBurstCount - 1);

    if (negativeBurstCount >= 2) {
      const nowTs = Date.now();
      if (nowTs - lastNudgeTimestamp > NUDGE_COOLDOWN_MS) {
        lastNudgeTimestamp = nowTs;
        showInPageToast('🌿 Too much stressful content — try Focus Mode', 6000);
        try { safeSendMessage({ action: 'recordNudge', reason: 'negative-burst', site: window.location.hostname }, ()=>{}); } catch(e){}
        if (!document.getElementById('mindful-focus-cta')) {
          const btn = document.createElement('button');
          btn.id = 'mindful-focus-cta';
          btn.textContent = 'Go to Focus Mode';
          btn.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10000001;padding:12px 18px;background:#2ecc71;color:#fff;border-radius:8px;border:none;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-size:16px;cursor:pointer;';
          btn.addEventListener('click', () => { try { safeSendMessage({ action: 'openFocusPage' }, ()=>{}); } catch(e){}; btn.remove(); });
          document.documentElement.appendChild(btn);
          setTimeout(() => { try { btn.remove(); } catch(e) {} }, 20000);
        }
      }
    }
  }, 4000);
}

// -------------------
//  FEED OBSERVER
// -------------------
function startFeedObserver() {
  if (feedObserver) { try { feedObserver.disconnect(); } catch(e){}; feedObserver = null; }
  feedObserver = new MutationObserver(() => { try { setTimeout(curateFeed, 900); } catch(e){} });
  try { feedObserver.observe(document.body, { childList: true, subtree: true }); } catch(e){}
  // fallback periodic scan
  setInterval(() => { if (!pausedForSite) curateFeed(); }, 5000);
}

// -------------------
//  ADAPTIVE BLUR (STRONGER) — single interval
// -------------------
function adaptiveBlurForPlatforms() {
  try {
    const url = window.location.href || '';
    const minutes = (currentTimeSpent || 0) / 60;
    let blurLevel = 0;

    // increased strength for Choice C
    if (minutes < 3) blurLevel = 0;
    else if (minutes < 6) blurLevel = 1.5;
    else if (minutes < 10) blurLevel = 3.5;
    else blurLevel = 6; // strong but still avoid blurring video players

    // Instagram
    if (url.includes('instagram.com')) {
      const igSelectors = ['article', 'section main article', 'div[role="presentation"]', '._aagu', '._aakl'];
      igSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => applySafeContentFilter(el, blurLevel > 0 ? `blur(${blurLevel}px)` : 'none'));
      });
      document.querySelectorAll('video').forEach(v => applySafeContentFilter(v, 'none'));
    }

    // YouTube
    if (url.includes('youtube.com')) {
      const ytSelectors = ['#contents ytd-rich-item-renderer','ytd-video-renderer','ytd-grid-video-renderer','ytd-rich-grid-media','ytd-thumbnail'];
      ytSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => applySafeContentFilter(el, blurLevel > 0 ? `blur(${blurLevel}px)` : 'none'));
      });
      document.querySelectorAll('video').forEach(v => applySafeContentFilter(v, 'none'));
    }

    // Clear filters on core media when blur==0
    if (blurLevel === 0) {
      document.querySelectorAll('img, video, picture, source').forEach(media => {
        try { media.style.filter = 'none'; media.style.imageRendering = 'auto'; } catch(e){}
      });
    }
  } catch (err) {
    console.warn('adaptiveBlurForPlatforms error:', err);
  }
}

function startAdaptiveBlur() {
  try { if (adaptiveBlurInterval) { clearInterval(adaptiveBlurInterval); adaptiveBlurInterval = null; } } catch(e){}
  adaptiveBlurInterval = setInterval(adaptiveBlurForPlatforms, 1000);
  adaptiveBlurForPlatforms();
}

// -------------------
//  CLEANUP LEGACY
// -------------------
(function cleanupLegacyIntervals(){
  try {
    if (typeof forceBlurInterval !== 'undefined' && forceBlurInterval) { clearInterval(forceBlurInterval); forceBlurInterval = null; }
    if (typeof forceBlurInstagramInterval !== 'undefined' && forceBlurInstagramInterval) { clearInterval(forceBlurInstagramInterval); forceBlurInstagramInterval = null; }
  } catch(e) {}
})();

// -------------------
//  AUDIO & VISUAL ALERTS
// -------------------
function playAlertSound() {
  try {
    const audio = new Audio(chrome.runtime.getURL('assets/alert.mp3'));
    audio.volume = 0.35;
    audio.play().catch(() => showInPageToast('🔔 Mindful Scroll: time limit reached', 3000));
  } catch (e) { showInPageToast('🔔 Mindful Scroll: time limit reached', 3000); }
}

function visualFlash() {
  try {
    const f = document.createElement('div');
    f.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.75);z-index:10000002;pointer-events:none;transition:opacity 500ms;';
    document.documentElement.appendChild(f);
    setTimeout(() => { f.style.opacity = '0'; setTimeout(() => { try { f.remove(); } catch(e){} }, 520); }, 120);
  } catch(e){}
}

// -------------------
//  ENABLE / DISABLE FEATURES
// -------------------
function disableSiteFeatures() {
  morphingEnabled = false;
  if (overlayElement) overlayElement.style.opacity = '0';
  try { if (adaptiveBlurInterval) { clearInterval(adaptiveBlurInterval); adaptiveBlurInterval = null; } } catch(e){}
}

function enableSiteFeatures() {
  morphingEnabled = true;
  if (overlayElement) overlayElement.style.opacity = '' ;
  updateMorphing();
  curateFeed();
  startAdaptiveBlur();
}

// -------------------
//  UTILITIES
// -------------------
function formatSeconds(sec) {
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`; return `${m}m`;
}

function runSelfTest() {
  showInPageToast('MindfulScroll self test — toast OK', 2000);
  visualFlash();
  const el = document.querySelector('article, ytd-video-renderer, .post, .feed-item');
  if (el) { applySafeContentFilter(el, 'blur(1px)'); setTimeout(() => applySafeContentFilter(el, 'none'), 1200); }
}

// -------------------
//  NEGATIVE CONTENT MODAL + CLICK INTERCEPTION
// -------------------
function showNegativeContentModal(text, onAllow) {
  const existing = document.getElementById('mindful-negative-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'mindful-negative-modal';
  modal.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.65);
    display:flex; align-items:center; justify-content:center;
    z-index:100000030; backdrop-filter: blur(6px);
  `;
  modal.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:20px; width:380px; max-width:90%;
                box-shadow:0 14px 36px rgba(0,0,0,0.35); text-align:center; font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <h2 style="margin:0 0 10px; color:#b71c1c;">⚠️ Potentially Negative Video</h2>
      <p style="font-size:14px;color:#333;margin-bottom:14px;">This content appears to be negative or stressful.<br>Are you sure you want to watch it?</p>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button id="btnNegativeCancel" style="padding:10px 16px;background:#ddd;border:none;border-radius:8px;cursor:pointer;">Cancel</button>
        <button id="btnNegativeAllow" style="padding:10px 16px;background:#d32f2f;color:#fff;border:none;border-radius:8px;cursor:pointer;">Watch Anyway</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnNegativeCancel').onclick = () => modal.remove();
  document.getElementById('btnNegativeAllow').onclick = () => { modal.remove(); onAllow && onAllow(); };
}

// allow-click window
let allowClickUntil = 0;

function interceptClicksForNegativeContent() {
  // attach in capture phase so we can block early
  document.addEventListener('click', (event) => {
    try {
      const now = Date.now();
      if (now < allowClickUntil) return; // user allowed recently

      let target = event.target;
      if (!target) return;

      // detect clickable containers for youtube & instagram
      const clickableYT = target.closest && target.closest("ytd-rich-item-renderer, ytd-video-renderer, a#thumbnail, #video-title");
      const clickableIG = target.closest && target.closest("article, div[role='presentation'], a[href*='/reel/'], a[href*='/p/']");

      const clickable = clickableYT || clickableIG;
      if (!clickable) return;

      // find a title / aria label / alt text
      const titleEl = clickable.querySelector && (clickable.querySelector('#video-title') || clickable.querySelector('h3') || clickable.querySelector('h2') || clickable.querySelector('h1'));
      const aria = clickable.querySelector && (clickable.querySelector('a[aria-label]') || clickable.querySelector('[aria-label]')) ;
      const text = (titleEl && titleEl.textContent) || (aria && aria.getAttribute && aria.getAttribute('aria-label')) || clickable.getAttribute('aria-label') || clickable.innerText || '';
      const trimmed = (text || '').trim();
      if (!trimmed) return;

      // If no model, skip blocking
      if (!nbModel) return;

      const res = classifyWithModel(trimmed, nbModel);
      const label = res.label;
      const prob = (res.probabilities && res.probabilities[label]) || 0;

      if ((label === 'negative' || label === 'stress' || label === 'demotivation') && prob >= classifyThreshold) {
        // block click
        event.preventDefault();
        event.stopImmediatePropagation();

        // Show modal and on confirm allow one-time click
        showNegativeContentModal(trimmed, () => {
          allowClickUntil = Date.now() + 5000; // allow 5 seconds
          // Try to trigger default behavior in a safe way:
          try {
            // If element is a link, follow URL
            const a = clickable.closest && clickable.closest('a[href]');
            if (a && a.href) {
              window.location.href = a.href;
            } else {
              // otherwise dispatch a synthetic click after a short delay
              setTimeout(() => { try { clickable.click(); } catch(e){} }, 50);
            }
          } catch (err) { try { clickable.click(); } catch(e){} }
        });
      }
    } catch (e) { /* ignore */ }
  }, true); // capture phase
}

// -------------------
//  INITIALIZATION
// -------------------
function initContentScript() {
  if (window.__mindful_scroll_globals.initDone) {
    // already initialized
    return;
  }
  window.__mindful_scroll_globals.initDone = true;

  createOverlay();

  // Read persisted settings + model
  safeStorageGet(['settings', 'nbModel', 'pausedSites'], (res) => {
    const settings = (res && res.settings) || {};
    morphingEnabled = settings.enableMorphing !== false;
    morphingIntensity = typeof settings.morphingIntensity === 'number' ? settings.morphingIntensity : morphingIntensity;
    classifyThreshold = (settings && typeof settings.classifyThreshold === 'number') ? settings.classifyThreshold : classifyThreshold;
    nbModel = (res && res.nbModel) || nbModel;

    // paused sites
    const paused = (res && res.pausedSites) || {};
    for (const k of Object.keys(paused || {})) {
      if (paused[k] && window.location.href.includes(k)) {
        pausedForSite = true;
        disableSiteFeatures();
        break;
      }
    }

    // start features
    startTracking();
    if (morphingEnabled) updateMorphing();
    startFeedObserver();
    startAdaptiveBlur();
    monitorUserScrollAndBursts();
    // start click interception after model loaded
    interceptClicksForNegativeContent();
  });

  // storage change listener
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.nbModel) nbModel = changes.nbModel.newValue || null;
    if (changes.settings) {
      const s = changes.settings.newValue || {};
      morphingEnabled = s.enableMorphing !== false;
      morphingIntensity = typeof s.morphingIntensity === 'number' ? s.morphingIntensity : morphingIntensity;
      classifyThreshold = (s && typeof s.classifyThreshold === 'number') ? s.classifyThreshold : classifyThreshold;
      if (!morphingEnabled && overlayElement) overlayElement.style.opacity = '0';
    }
  });

  // message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return;
    switch (request.action) {
      case 'playAlertSound': playAlertSound(); sendResponse({ played: true }); break;
      case 'visualAlert': visualFlash(); sendResponse({ flashed: true }); break;
      case 'showAlert': showAlertInPage(request.message || 'Mindful Scroll Alert'); sendResponse({ shown: true }); break;
      case 'pauseSite': pausedForSite = true; disableSiteFeatures(); sendResponse({ paused: true }); break;
      case 'resumeSite': pausedForSite = false; enableSiteFeatures(); sendResponse({ resumed: true }); break;
      case 'startTracking':
        safeSendMessage({ action: 'getTimeSpent' }, (r) => { if (r && typeof r.timeSpent === 'number') { currentTimeSpent = r.timeSpent; updateMorphing(); }});
        sendResponse({ ok: true }); break;
      default: break;
    }
  });

  // scroll listener for morphing responsiveness
  window.addEventListener("scroll", () => {
    clearTimeout(window.scrollTimeout);
    window.scrollTimeout = setTimeout(updateMorphing, 200);
  }, { passive: true });
}

// Kick-off
initContentScript();

// -------------------
//  TRACKING / MORPHING POLL
// -------------------
function startTracking() {
  safeSendMessage({ action: 'getTimeSpent' }, (response) => {
    if (response && typeof response.timeSpent === 'number') currentTimeSpent = response.timeSpent;
    updateMorphing();
  });

  if (morphingInterval) clearInterval(morphingInterval);
  morphingInterval = setInterval(() => {
    safeSendMessage({ action: 'getTimeSpent' }, (response) => {
      if (response && typeof response.timeSpent === 'number') {
        currentTimeSpent = response.timeSpent;
        updateMorphing();
      }
    });
  }, 10000);
}

// -------------------
//  UPDATE MORPHING (STRONG, COLOR SHIFT + PULSE) - CHOICE C
// -------------------
function updateMorphing() {
  try {
    if (!morphingEnabled || !overlayElement || pausedForSite) {
      if (overlayElement) overlayElement.style.opacity = '0';
      return;
    }

    const minutes = (currentTimeSpent || 0) / 60;
    const intensity = Math.max(0, Math.min(100, morphingIntensity || 80));

    // compute values
    let overlayOpacity = 0;
    let colorHueShift = 0;
    let vignette = 0;
    let colorSaturation = 1;

    // ramp up strongly
    if (minutes < 3) {
      overlayOpacity = 0.04 + (intensity / 100) * 0.02;
      colorHueShift = 0;
      vignette = 0.02;
      colorSaturation = 1;
    } else if (minutes < 6) {
      overlayOpacity = 0.08 + (intensity / 100) * 0.08;
      colorHueShift = 8; // slight warm shift
      vignette = 0.06;
      colorSaturation = 0.96;
    } else if (minutes < 10) {
      overlayOpacity = 0.14 + (intensity / 100) * 0.14;
      colorHueShift = 18; // more warm/orange
      vignette = 0.12;
      colorSaturation = 0.9;
    } else {
      overlayOpacity = 0.22 + (intensity / 100) * 0.28; // can approach ~0.5
      colorHueShift = 28; // clear tint toward red/orange to create discomfort
      vignette = 0.28;
      colorSaturation = 0.78;
    }

    // build color overlay using HSL with multiply blend for intensity
    const hue = Math.round(10 + colorHueShift); // base 10 + shift
    const colorTop = `hsla(${hue}, ${Math.round(60 * colorSaturation)}%, ${Math.round(50 * (0.9))}%, ${Math.min(0.6, overlayOpacity * 1.0)})`;
    const colorBottom = `hsla(${hue + 10}, ${Math.round(50 * colorSaturation)}%, ${Math.round(36 * (0.9))}%, ${Math.min(0.6, overlayOpacity * 1.2)})`;

    // apply to overlay
    const colorLayer = document.getElementById('mindful-scroll-overlay-color');
    if (overlayElement) {
      overlayElement.style.opacity = `${Math.min(0.95, overlayOpacity + vignette)}`;
      overlayElement.style.transform = `scale(${1 + ((overlayOpacity + vignette) * 0.002)})`;
      if (colorLayer) {
        colorLayer.style.background = `linear-gradient(180deg, ${colorTop} 0%, ${colorBottom} 100%)`;
        colorLayer.style.opacity = `${Math.min(0.92, overlayOpacity * 1.2 + vignette)}`;
        colorLayer.style.filter = `saturate(${Math.max(0.6, colorSaturation)})`;
        colorLayer.style.transition = 'opacity 600ms ease, background 800ms ease, filter 600ms ease';
      }
      // subtle backdrop blur on overlay but small to avoid rasterize heavy
      overlayElement.style.backdropFilter = `blur(${Math.min(3, Math.max(0.3, vignette * 6))}px)`;
    }

    // pulse effect when very high intensity
    try {
      if (minutes >= 10 && overlayElement) {
        overlayElement.style.animation = 'mindful-pulse 4000ms ease-in-out infinite';
      } else if (overlayElement) {
        overlayElement.style.animation = '';
      }
    } catch (e) {}

  } catch (e) {
    console.warn('updateMorphing error', e);
  }
}

// -------------------
//  CLEAN START & DEBUG EXPOSE
// -------------------
(function ensureSingleRun() {
  if (window.__mindful_scroll_loaded) return;
  Object.defineProperty(window, '__mindful_scroll_loaded', { value: true, configurable: false, writable: false });
})();

console.log('Mindful Scroll: content script loaded. MorphingEnabled:', morphingEnabled, 'Intensity:', morphingIntensity);

window.MindfulScrollDebug = {
  showToast: showInPageToast,
  runSelfTest,
  getState: () => ({ currentTimeSpent, morphingEnabled, morphingIntensity, pausedForSite })
};

// End of file



// =======================
// X.COM OVERRIDE PATCH
// =======================

(function initMindfulXOverride(){
    console.log("MindfulScroll X-Override Active");

    const X_SELECTORS = [
        'div[data-testid="cellInnerDiv"]',
        'article div[data-testid="tweet"]',
        'article',
        'div[data-testid="tweetText"]',
        'div[aria-label*="Timeline"] article'
    ];

    function applySensitiveContentBlock(el, reason = "This post may contain negative or harmful content.") {
        if (el.__mindful_block_applied) return;
        el.__mindful_block_applied = true;

        el.__originalDisplay = el.style.display;
        el.style.display = "none";

        const wrapper = document.createElement("div");
        wrapper.className = "mindful-sensitive-blocker";
        wrapper.style.cssText = `
            border: 1px solid #444;
            background: #111;
            padding: 16px;
            margin: 8px 0;
            border-radius: 12px;
            color: white;
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;

        const title = document.createElement("div");
        title.style.cssText = `font-size: 18px; font-weight: 600;`;
        title.textContent = "⚠️ Sensitive Content";

        const desc = document.createElement("div");
        desc.style.cssText = `opacity: 0.9; line-height: 1.4;`;
        desc.textContent = reason;

        const btn = document.createElement("button");
        btn.textContent = "Reveal anyway";
        btn.style.cssText = `
            padding: 8px 14px;
            border-radius: 8px;
            background: #fff;
            color: #000;
            border: none;
            cursor: pointer;
            font-weight: 600;
            width: fit-content;
        `;
        btn.onclick = () => {
            wrapper.remove();
            el.style.display = el.__originalDisplay || "";
            el.__mindful_revealed = true;
        };

        wrapper.appendChild(title);
        wrapper.appendChild(desc);
        wrapper.appendChild(btn);
        el.parentNode.insertBefore(wrapper, el);
    }

    function extractText(el){
        let t = el.innerText || "";
        const tweet = el.querySelector("div[data-testid='tweetText']");
        if (tweet) t += " " + tweet.innerText;
        return t.trim();
    }

    function isNegativeText(t){
        t = t.toLowerCase();
        return (
            t.includes("dead") ||
            t.includes("kill") ||
            t.includes("accident") ||
            t.includes("suicide") ||
            t.includes("depressed") ||
            t.includes("sad") ||
            t.includes("violence") ||
            t.includes("abuse") ||
            t.includes("hurt")
        );
    }

    const observer = new MutationObserver(() => {
        const items = document.querySelectorAll(X_SELECTORS.join(","));
        items.forEach(el => {
            if (el.__mindful_revealed) return;
            const text = extractText(el);
            if (isNegativeText(text)) {
                applySensitiveContentBlock(el, "Detected potentially negative or harmful content.");
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
