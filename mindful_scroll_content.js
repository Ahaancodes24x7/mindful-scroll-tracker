// ====================================================
// Mindful Scroll Tracker — Content Script (Final Version)
// Features: Ambient Morphing + Smart Feed Curation
// ====================================================

// ✅ Confirm activation
console.log("%cMindful Scroll: content script active ✅", "color:#6c5ce7;font-weight:bold;font-size:14px");

// -------------------
//  GLOBAL VARIABLES
// -------------------
let morphingInterval = null;
let currentTimeSpent = 0;
let morphingEnabled = true;
let morphingIntensity = 50;
let overlayElement = null;
let feedObserver = null;

// -------------------
//  INITIALIZATION
// -------------------
function init() {
  createOverlay();
  loadSettings(() => {
    startTracking();
    if (morphingEnabled) updateMorphing();
    startFeedObserver(); // Feed filter always on by default
  });

  window.addEventListener("scroll", () => {
    clearTimeout(window.scrollTimeout);
    window.scrollTimeout = setTimeout(updateMorphing, 200);
  });
}

init();

// -------------------
//  LOAD SETTINGS
// -------------------
function loadSettings(callback) {
  chrome.storage.local.get(["settings"], (result) => {
    const settings = result.settings || {};
    morphingEnabled = settings.enableMorphing !== false;
    morphingIntensity = settings.morphingIntensity || 50;
    callback && callback();
  });
}

// -------------------
//  OVERLAY CREATION
// -------------------
function createOverlay() {
  overlayElement = document.createElement("div");
  overlayElement.id = "mindful-scroll-overlay";
  overlayElement.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 999999;
    mix-blend-mode: multiply;
    transition: all 0.5s ease;
  `;
  document.documentElement.appendChild(overlayElement);
}

// -------------------
//  AMBIENT MORPHING
// -------------------
function startTracking() {
  chrome.runtime.sendMessage({ action: "getTimeSpent" }, (response) => {
    if (response) currentTimeSpent = response.timeSpent;
    updateMorphing();
  });

  morphingInterval = setInterval(() => {
    chrome.runtime.sendMessage({ action: "getTimeSpent" }, (response) => {
      if (response) {
        currentTimeSpent = response.timeSpent;
        updateMorphing();
      }
    });
  }, 10000);
}

function updateMorphing() {
  if (!morphingEnabled || !overlayElement) return;

  const minutes = currentTimeSpent / 60;
  const intensity = Math.min((minutes / 10) * morphingIntensity, morphingIntensity);

  let color, saturation, darken;
  if (minutes < 3) {
    color = `rgba(100,150,255,${intensity / 100})`;
    saturation = 1;
    darken = 0;
  } else if (minutes < 6) {
    color = `rgba(255,220,100,${intensity / 90})`;
    saturation = 0.9;
    darken = 0.05;
  } else {
    color = `rgba(255,80,80,${intensity / 50})`;
    saturation = 0.8;
    darken = 0.15;
  }

  overlayElement.style.background = `radial-gradient(circle at center, transparent 0%, ${color} 100%)`;
  document.body.style.filter = `saturate(${saturation}) brightness(${1 - darken})`;
}

// -------------------
//  FEED CURATION
// -------------------
const negativeWords = [
  "accident", "crash", "death", "dead", "kill", "war",
  "fight", "blood", "attack", "violence", "angry",
  "sad", "hurt", "destroyed", "explosion", "crying", "tragic"
];

const positiveWords = [
  "peace", "calm", "love", "hope", "beautiful", "smile",
  "happy", "joy", "success", "relax", "motivation", "travel"
];

function analyzeSentiment(text) {
  let score = 0;
  const lower = text.toLowerCase();
  negativeWords.forEach(w => { if (lower.includes(w)) score -= 1; });
  positiveWords.forEach(w => { if (lower.includes(w)) score += 1; });
  return score;
}

function curateFeed() {
  // YouTube, Shorts, Twitter, Instagram posts
  const feedItems = document.querySelectorAll(
    "ytd-rich-item-renderer, ytd-video-renderer, ytd-reel-item-renderer, " +
    "article, div[role='article'], .post, .feed-item"
  );

  console.log(`🟣 MindfulScroll: scanning ${feedItems.length} feed items`);

  feedItems.forEach(el => {
    let text = "";

    // YouTube homepage and results titles
    const videoTitle = el.querySelector("#video-title")?.textContent?.trim();
    const titleAttr = el.querySelector("#video-title")?.getAttribute("title");
    const ariaLabel = el.querySelector("a#thumbnail")?.getAttribute("aria-label");
    const shortsTitle = el.querySelector("yt-formatted-string#title")?.textContent?.trim();

    // Combine multiple title sources
    text = videoTitle || titleAttr || ariaLabel || shortsTitle || el.innerText || "";

    if (!text.trim()) return; // skip empty elements

    const score = analyzeSentiment(text);

    // Debug log
    console.log(`  ↳ "${text.substring(0, 80)}" → ${score}`);

    if (score < 0) {
      el.style.filter = "blur(6px) brightness(0.5)";
      el.style.transition = "filter 0.4s ease";
      el.title = "⚠️ Negative or stressful content filtered";
    } else if (score > 0) {
      el.style.filter = "brightness(1.15)";
      el.title = "🌿 Positive content";
    } else {
      el.style.filter = "";
      el.title = "";
    }
  });
}


// -------------------
//  FEED OBSERVER
// -------------------
function startFeedObserver() {
  if (feedObserver) feedObserver.disconnect();

  console.log("🟣 MindfulScroll Feed Observer started");
  curateFeed();

  feedObserver = new MutationObserver(() => {
    setTimeout(curateFeed, 1000); // run 1s after DOM mutation
  });

  feedObserver.observe(document.body, { childList: true, subtree: true });

  // Repeat scanning every 5 seconds (for dynamic loads)
  setInterval(curateFeed, 5000);
}

