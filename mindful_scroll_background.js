// =============================================
// Mindful Scroll Tracker – Enhanced Background Script
// Added: Sound Alerts + Visual Flash Trigger + Stable Notifications
// =============================================

let activeTabId = null;
let startTime = null;
let currentSite = null;
let alertTriggeredFor = {}; // prevent duplicate alerts

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
    moodEntries: []
  });

  chrome.alarms.create('dailyReset', {
    when: getNextMidnight(),
    periodInMinutes: 1440 // 24 hours
  });
});

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
      chrome.tabs.sendMessage(tabId, {
        action: 'startTracking',
        site: site.name
      });
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

  chrome.storage.local.get(['dailyUsage', 'settings'], (result) => {
    const dailyUsage = result.dailyUsage || {};
    const settings = result.settings || {};
    const limit = settings.timeLimit || 30;

    if (!dailyUsage[today]) dailyUsage[today] = {};
    if (!dailyUsage[today][currentSite]) dailyUsage[today][currentSite] = 0;

    dailyUsage[today][currentSite] += timeSpent;
    chrome.storage.local.set({ dailyUsage });

    const totalMinutes = dailyUsage[today][currentSite] / 60;

    // 🚨 Trigger alert once per day per site
    if (settings.enableAlerts && totalMinutes >= limit && !alertTriggeredFor[currentSite]) {
      alertTriggeredFor[currentSite] = true;

      showMindfulNotification(
        "⏳ Time Limit Reached",
        `You've spent ${Math.floor(totalMinutes)} minutes on ${TRACKED_SITES[currentSite]} today.`
      );

      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, {
          action: 'showAlert',
          message: `You've spent ${Math.floor(totalMinutes)} minutes here today.`,
        });
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

    // Play soft chime
    playAlertSound();

    // Trigger flash overlay in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "visualAlert" });
      }
    });
  } catch (err) {
    console.error("Notification error:", err);
  }
}

// ---------------------------------------------
// 🎵 Gentle alert sound
// ---------------------------------------------
function playAlertSound() {
  try {
    const audio = new Audio(chrome.runtime.getURL("assets/alert.mp3"));
    audio.volume = 0.35;
    audio.play().catch((err) => console.warn("Audio play blocked:", err));
  } catch (err) {
    console.error("Sound error:", err);
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
