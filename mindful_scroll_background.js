// =============================================
// Mindful Scroll Tracker – Enhanced Background Script
// Added: Sound Alerts + Visual Flash Trigger + Stable Notifications
// =============================================

let activeTabId = null;
let startTime = null;
let currentSite = null;
let alertTriggeredFor = {}; // prevent duplicate alerts

// Persisted alert triggers (per-day) will be loaded into alertTriggeredFor on startup
// Supported sites
const TRACKED_SITES = {
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
  'tiktok.com': 'TikTok',
  'twitter.com': 'Twitter',
  'x.com': 'X'
};

// ---------------------------------------------
// 🧩 On Install – Initialize storage and reset timer
// ---------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    dailyUsage: {},
    settings: {
      timeLimit: 30, // minutes
      enableAlerts: true,
      enableMorphing: true,
      morphingIntensity: 50
    },
    moodEntries: [],
    alertTriggers: {},
    pausedSites: {}
  });

  chrome.alarms.create('dailyReset', {
    when: getNextMidnight(),
    periodInMinutes: 1440 // 24 hours
  });

  // Attempt to import a packaged NB model into storage on install so content scripts
  // and popup have a working model without manual steps.
  try {
    const modelUrl = chrome.runtime.getURL('data/nb_model.json');
    fetch(modelUrl).then(res => res.json()).then(model => {
      if (model && model.classes) {
        chrome.storage.local.get(['nbModel'], (r) => {
          if (!r.nbModel) {
            chrome.storage.local.set({ nbModel: model }, () => {
              console.log('Imported packaged nb_model.json into storage on install');
            });
          }
        });
      }
    }).catch(() => { /* ignore fetch errors */ });
  } catch (e) { /* ignore runtime errors */ }
});

// Load today's persisted alert triggers into memory when the service worker starts
(() => {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['alertTriggers'], (res) => {
    const all = res.alertTriggers || {};
    alertTriggeredFor = all[today] || {};
  });
})();

// On service worker startup, if there's no nbModel in storage, try to load the packaged model.
(function tryLoadPackagedModelOnStartup() {
  chrome.storage.local.get(['nbModel'], (res) => {
    if (res.nbModel) return; // already present
    try {
      const modelUrl = chrome.runtime.getURL('data/nb_model.json');
      fetch(modelUrl).then(r => r.json()).then(m => {
        if (m && m.classes) {
          chrome.storage.local.set({ nbModel: m }, () => {
            console.log('Loaded packaged nb_model.json into storage on startup');
          });
        }
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  });
})();

// ---------------------------------------------
// ⏰ Daily reset at midnight
// ---------------------------------------------
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    chrome.storage.local.get(['dailyUsage'], (result) => {
      const usage = result.dailyUsage || {};
      const daysToKeep = 30;
      const sortedDates = Object.keys(usage).sort().reverse();

      const newUsage = {};
      sortedDates.slice(0, daysToKeep).forEach(date => {
        newUsage[date] = usage[date];
      });

      chrome.storage.local.set({ dailyUsage: newUsage });
      alertTriggeredFor = {}; // reset alerts
    });
  }
});

function getNextMidnight() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow.getTime();
}

// ---------------------------------------------
// 🌐 Determine tracked site from URL
// ---------------------------------------------
function getTrackedSite(url) {
  if (!url) return null;
  for (const [domain, name] of Object.entries(TRACKED_SITES)) {
    if (url.includes(domain)) return { domain, name };
  }
  return null;
}

// ---------------------------------------------
// ⏱️ Update time tracking when tab/site changes
// ---------------------------------------------
function updateTimeTracking(tabId, url) {
  const site = getTrackedSite(url);

  if (site) {
    if (currentSite !== site.domain) {
      if (currentSite) saveTimeSpent();

      currentSite = site.domain;
      startTime = Date.now();
      activeTabId = tabId;

      // Notify content script to start morphing
      try {
        chrome.tabs.sendMessage(tabId, {
          action: 'startTracking',
          site: site.name
        }, (resp) => {
          if (chrome.runtime.lastError) {
            // content script not ready in this tab — ignore silently
            // console.warn('sendMessage startTracking failed:', chrome.runtime.lastError.message);
          }
        });
      } catch (e) {
        // ignore
      }
    }
  } else {
    if (currentSite) {
      saveTimeSpent();
      currentSite = null;
      startTime = null;
      activeTabId = null;
    }
  }
}

// ---------------------------------------------
// 💾 Save tracked time and trigger alerts
// ---------------------------------------------
function saveTimeSpent() {
  if (!currentSite || !startTime) return;

  const timeSpent = Math.floor((Date.now() - startTime) / 1000); // seconds
  const today = new Date().toISOString().split('T')[0];

  // Include pausedSites and alertTriggers when checking alerts
  chrome.storage.local.get(['dailyUsage', 'settings', 'pausedSites', 'alertTriggers'], (result) => {
    const dailyUsage = result.dailyUsage || {};
    const settings = result.settings || {};
    const pausedSites = result.pausedSites || {};
    const allAlertTriggers = result.alertTriggers || {};
    const limit = settings.timeLimit || 30;

    if (!dailyUsage[today]) dailyUsage[today] = {};
    if (!dailyUsage[today][currentSite]) dailyUsage[today][currentSite] = 0;

    dailyUsage[today][currentSite] += timeSpent;
    chrome.storage.local.set({ dailyUsage });

    const totalMinutes = dailyUsage[today][currentSite] / 60;

    // Skip alerts for paused sites
    if (pausedSites[currentSite]) return;

    // Check persisted alert triggers for today
    const todaysTriggers = allAlertTriggers[today] || {};

    // 🚨 Trigger alert once per day per site
    if (settings.enableAlerts && totalMinutes >= limit && !todaysTriggers[currentSite]) {
      // mark in-memory and persist
      alertTriggeredFor[currentSite] = true;
      todaysTriggers[currentSite] = true;
      allAlertTriggers[today] = todaysTriggers;
      chrome.storage.local.set({ alertTriggers: allAlertTriggers });

      showMindfulNotification(
        "⏳ Time Limit Reached",
        `You've spent ${Math.floor(totalMinutes)} minutes on ${TRACKED_SITES[currentSite]} today.`
      );

      if (activeTabId) {
        // notify tab to show in-page alert (guard against tabs without content script)
        try {
          chrome.tabs.sendMessage(activeTabId, {
            action: 'showAlert',
            message: `You've spent ${Math.floor(totalMinutes)} minutes here today.`,
          }, (resp) => {
            if (chrome.runtime.lastError) {
              // no receiver — ignore
            }
          });
        } catch (e) { /* ignore */ }
      }
    }
  });
}

// ---------------------------------------------
// 🔔 Show Chrome Notification + Sound + Flash
// ---------------------------------------------
function showMindfulNotification(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: 2
    });

    // Ask the active tab to play the sound (more reliable than service-worker audio)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        try {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'playAlertSound' }, (res) => {
            if (chrome.runtime.lastError) {
              // no receiver
              return;
            }
            // Visual flash overlay in active tab too
            try {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'visualAlert' }, () => { if (chrome.runtime.lastError) {} });
            } catch (e) {}
          });
        } catch (e) { /* ignore */ }
      }
    });
  } catch (err) {
    console.error("Notification error:", err);
  }
}


// ---------------------------------------------
// 🪶 Tab and focus listeners
// ---------------------------------------------
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    updateTimeTracking(tab.id, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateTimeTracking(tabId, tab.url);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (currentSite) {
      saveTimeSpent();
      startTime = Date.now(); // reset timer
    }
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) updateTimeTracking(tabs[0].id, tabs[0].url);
    });
  }
});

// ---------------------------------------------
// 🧠 Message Handlers
// ---------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTimeSpent') {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(['dailyUsage'], (result) => {
      const usage = result.dailyUsage || {};
      const todayUsage = usage[today] || {};
      const site = getTrackedSite(sender.tab.url);
      const timeSpent = site ? (todayUsage[site.domain] || 0) : 0;
      sendResponse({ timeSpent });
    });
    return true;
  }

  if (request.action === 'saveMood') {
    chrome.storage.local.get(['moodEntries'], (result) => {
      const entries = result.moodEntries || [];
      entries.push({
        mood: request.mood,
        timestamp: Date.now(),
        site: currentSite
      });

      if (entries.length > 100) entries.shift();
      chrome.storage.local.set({ moodEntries: entries });
      sendResponse({ success: true });
    });
    return true;
  }

  // Log classification events from content scripts
  if (request.action === 'logClassification') {
    try {
      const entry = request.entry || {};
      // entry: { label, probability, snippet, timestamp, site }
      chrome.storage.local.get(['stressLogs','dailyStressCounts'], (res) => {
        const all = res.stressLogs || [];
        all.push(entry);
        const capped = all.slice(-2000);

        // update daily aggregated counts for quick trends
        const daily = res.dailyStressCounts || {};
        const ts = entry.timestamp || Date.now();
        const day = new Date(ts).toISOString().split('T')[0];
        if (!daily[day]) daily[day] = { total: 0, sites: {} };
        // treat stress/demotivation/negative as stress events
        const lbl = (entry.label || '').toLowerCase();
        if (lbl === 'stress' || lbl === 'demotivation' || lbl === 'negative') {
          daily[day].total = (daily[day].total || 0) + 1;
          const s = entry.site || 'unknown';
          daily[day].sites[s] = (daily[day].sites[s] || 0) + 1;
        }

        // keep only last 90 days to limit storage
        const keepDays = 90;
        const keys = Object.keys(daily).sort().reverse().slice(0, keepDays).reverse();
        const pruned = {};
        keys.forEach(k => { pruned[k] = daily[k]; });

        chrome.storage.local.set({ stressLogs: capped, dailyStressCounts: pruned });
      });
      sendResponse({ ok: true });
    } catch (e) { sendResponse({ ok: false, error: e && e.message }); }
    return true;
  }


  // Record nudges / in-page reminders triggered by content
  if (request.action === 'recordNudge') {
    try {
      const n = { timestamp: Date.now(), reason: request.reason || 'nudge', site: request.site || null };
      chrome.storage.local.get(['nudgeEvents'], (res) => {
        const arr = res.nudgeEvents || [];
        arr.push(n);
        chrome.storage.local.set({ nudgeEvents: arr.slice(-1000) });
      });
      sendResponse({ ok: true });
    } catch (e) { sendResponse({ ok: false, error: e && e.message }); }
    return true;
  }

  // Open a local focus page in a new tab (personalized feed redirect)
  if (request.action === 'openFocusPage') {
    const url = chrome.runtime.getURL('assets/focus.html');
    try {
      chrome.tabs.create({ url });
      sendResponse({ ok: true });
    } catch (e) { sendResponse({ ok: false, error: e && e.message }); }
    return true;
  }
});

// ---------------------------------------------
// 🕒 Auto-save every minute
// ---------------------------------------------
setInterval(() => {
  if (currentSite && startTime) {
    saveTimeSpent();
    startTime = Date.now();
  }
}, 60000);
