// Modern AI-Powered Mindful Scroll Dashboard

const SITE_ICONS = {
  'facebook.com': '📘',
  'instagram.com': '📷',
  'youtube.com': '▶️',
  'tiktok.com': '🎵',
  'twitter.com': '🐦',
  'x.com': '✖️',
  'reddit.com': '🤖',
  'linkedin.com': '💼',
  'news.ycombinator.com': '🍊',
  'github.com': '🐙'
};

const SITE_NAMES = {
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
  'tiktok.com': 'TikTok',
  'twitter.com': 'Twitter',
  'x.com': 'X',
  'reddit.com': 'Reddit',
  'linkedin.com': 'LinkedIn',
  'news.ycombinator.com': 'Hacker News',
  'github.com': 'GitHub'
};

// Tab Management
class TabManager {
  constructor() {
    this.activeTab = 'dashboard';
    this.init();
  }

  init() {
    // Setup tab click handlers
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = tab.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // Setup keyboard shortcuts for tabs
    document.addEventListener('keydown', (e) => {
      if (e.altKey) {
        switch(e.key) {
          case '1': this.switchTab('dashboard'); break;
          case '2': this.switchTab('ai-insights'); break;
          case '3': this.switchTab('focus-tools'); break;
          case '4': this.switchTab('settings'); break;
        }
      }
    });
  }

  switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Deactivate all nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });

    // Show selected tab
    const targetContent = document.getElementById(tabName);
    const targetNav = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (targetContent) targetContent.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    this.activeTab = tabName;

    // Update content for the active tab
    this.updateTabContent(tabName);
  }

  updateTabContent(tabName) {
    switch(tabName) {
      case 'dashboard':
        this.updateDashboard();
        break;
      case 'ai-insights':
        this.updateAIInsights();
        break;
      case 'focus-tools':
        this.updateFocusTools();
        break;
      case 'settings':
        this.updateSettings();
        break;
    }
  }

  updateDashboard() {
    loadDashboard();
    updateStressAnalysis();
    updateCurrentTime();
  }

  updateAIInsights() {
    updateModelStatus();
    updateTrainingInterface();
  }

  updateFocusTools() {
    updateFocusSession();
    updateCurrentSiteInfo();
  }

  updateSettings() {
    loadSettings();
  }
}

// Initialize app
let tabManager;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize tab management
  tabManager = new TabManager();
  
  // Initialize core functionality
  loadDashboard();
  loadSettings();
  setupEventListeners();
  setupPauseButton();
  showPausedSites();
  setupFocusControls();
  setupExportImport();
  updateDate();
  updateCurrentTime();
  updateStressAnalysis();
  wireDomHandlers();
  
  // Setup modern UI interactions
  setupMoodSelector();
  setupLabelSelector();
  setupModeSelector();
  
  // Load initial content
  updateModelStatus();
});

// Time updates
function updateCurrentTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  safeSetText('currentTime', timeString);
  
  // Update again in 1 minute
  setTimeout(updateCurrentTime, 60000);
}

// Safe DOM helpers to avoid runtime errors if popup HTML changes or loads unexpectedly
function $id(id) { return document.getElementById(id); }
function safeSetText(id, text) { const el = $id(id); if (el) el.textContent = text; }
function safeSetValue(id, val) { const el = $id(id); if (el) el.value = val; }
function safeSetChecked(id, val) { const el = $id(id); if (el) el.checked = !!val; }
// Update current date and time
function updateDate() {
  const today = new Date();
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  safeSetText('currentDate', today.toLocaleDateString('en-US', options));
}

// Modern UI Interaction Handlers
function setupMoodSelector() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove selection from all mood buttons
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      // Add selection to clicked button
      btn.classList.add('selected');
      
      const mood = btn.getAttribute('data-mood');
      // Store mood selection
      chrome.storage.local.set({ currentMood: mood });
      
      // Update mood quality based on selection
      const moodScores = {
        'excellent': '9.2',
        'good': '7.8', 
        'neutral': '6.0',
        'low': '4.2',
        'stressed': '2.8'
      };
      safeSetText('moodQuality', moodScores[mood] + '/10');
    });
  });
}

function setupLabelSelector() {
  document.querySelectorAll('.label-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove selection from all label buttons
      document.querySelectorAll('.label-btn').forEach(b => b.classList.remove('selected'));
      // Add selection to clicked button
      btn.classList.add('selected');
      
      const label = btn.getAttribute('data-label');
      // Update hidden input
      const hiddenInput = $id('trainingLabel');
      if (hiddenInput) hiddenInput.value = label;
    });
  });
}

function setupModeSelector() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      // Remove selection from all mode cards
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
      // Add selection to clicked card
      card.classList.add('selected');
      
      const mode = card.getAttribute('data-mode');
      // Store mode selection
      chrome.storage.local.set({ focusMode: mode });
    });
  });
}

function updateModelStatus() {
  chrome.storage.local.get(['nbModel', 'trainingExamples'], (res) => {
    const hasModel = res.nbModel && Object.keys(res.nbModel).length > 0;
    const examples = res.trainingExamples || [];
    
    // Update example count
    safeSetText('exampleCount', examples.length.toString());
    
    // Update model info
    if (hasModel) {
      safeSetText('modelInfo', 'Naive Bayes v2.1');
      const badge = $id('modelBadge');
      if (badge) {
        badge.textContent = 'Active';
        badge.className = 'model-badge active';
      }
    } else {
      safeSetText('modelInfo', 'No model loaded');
      const badge = $id('modelBadge');
      if (badge) {
        badge.textContent = 'No model';
        badge.className = 'model-badge';
      }
    }
  });
}

function updateTrainingInterface() {
  // Update training status
  const statusEl = $id('trainingStatus');
  if (statusEl) {
    statusEl.innerHTML = '<span class="status-indicator ready">Ready for Training</span>';
  }
}

function updateFocusSession() {
  chrome.storage.local.get(['focusSession'], (res) => {
    const session = res.focusSession;
    if (session && session.active) {
      const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
      const remaining = Math.max(0, session.duration - elapsed);
      updateTimerDisplay(remaining);
      updateTimerProgress(elapsed, session.duration);
    } else {
      updateTimerDisplay(25 * 60); // Default 25 minutes
      updateTimerProgress(0, 25 * 60);
    }
  });
}

function updateTimerDisplay(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const display = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  safeSetText('focusTimer', display);
}

function updateTimerProgress(elapsed, total) {
  const progressRing = $id('timerProgressRing');
  if (progressRing) {
    const circumference = 2 * Math.PI * 54; // radius = 54
    const progress = elapsed / total;
    const offset = circumference - (progress * circumference);
    progressRing.style.strokeDashoffset = offset;
  }
}

function updateCurrentSiteInfo() {
  // Get current active tab
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname.replace('www.', '');
      safeSetText('currentSiteUrl', domain);
    }
  });
}

// Export daily aggregates as CSV (named function for cleaner wiring)
function exportDailyCsv() {
  chrome.storage.local.get(['dailyStressCounts'], (res) => {
    const daily = res.dailyStressCounts || {};
    // collect all site keys
    const sites = new Set();
    Object.values(daily).forEach(d => { Object.keys(d.sites||{}).forEach(s => sites.add(s)); });
    const siteList = Array.from(sites);
    const header = ['date','total', ...siteList];
    const rows = [header.join(',')];
    Object.keys(daily).sort().forEach(date => {
      const d = daily[date];
      const cols = [date, d.total || 0];
      siteList.forEach(s => cols.push(d.sites && d.sites[s] ? d.sites[s] : 0));
      rows.push(cols.map(v => typeof v === 'string' ? '"'+v.replace(/"/g,'""')+'"' : v).join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `mindful_stress_daily_${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
}

// Open stored Naive Bayes model viewer
function openModelViewer() {
  chrome.storage.local.get(['nbModel'], (res) => {
    const model = res.nbModel;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>NB Model</title></head><body style="font-family:Arial;padding:12px;background:#0b1220;color:#e6eef8"><h2>Naive Bayes Model</h2><pre style="white-space:pre-wrap;word-break:break-word;background:#071226;padding:12px;border-radius:6px;color:#cfe8ff;max-height:80vh;overflow:auto">${model ? JSON.stringify(model,null,2) : 'No model in storage'}</pre></body></html>`;
    const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    try { chrome.tabs.create({ url }); } catch (e) { window.open(url, '_blank'); }
  });
}

// Diagnostics: build status lines and show alert
function runDiagnosticsAlert() {
  const results = [];
  const ids = ['openLogsBtn','exportCsvBtn','selfTestBtn','stressSpark','stressSampleList','openModelBtn','importModelBtn'];
  ids.forEach(id => { results.push(`${id}: ${$id(id) ? 'OK' : 'MISSING'}`); });
  results.push(`chrome.runtime: ${typeof chrome !== 'undefined' && !!chrome.runtime ? 'OK' : 'MISSING'}`);
  results.push(`chrome.storage: ${typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? 'OK' : 'MISSING'}`);
  try { const url = chrome.runtime.getURL('assets/focus.html'); results.push(`focus page URL: ${url}`); } catch (e) { results.push(`focus page URL: ERROR (${e && e.message})`); }
  try { chrome.storage.local.get(['dailyStressCounts'], (res) => { results.push(`storage read: OK (dailyStressCounts keys: ${Object.keys(res.dailyStressCounts||{}).length})`); alert('Diagnostics:\n' + results.join('\n')); }); } catch (e) { results.push('storage read: ERROR'); alert('Diagnostics:\n' + results.join('\n')); }
}

// Quick action helpers
function quickFocusAction() {
  const el = $id('focusStart');
  if (el) { el.click(); return; }
  const now = Date.now(); const end = now + DEFAULT_FOCUS_SECONDS*1000;
  chrome.storage.local.set({ focusSession: { active: true, endTime: end } }, () => { notifyTabs('focusStart'); updateFocusDisplay(DEFAULT_FOCUS_SECONDS); });
}

function quickPauseAction() {
  const el = $id('pauseSiteBtn');
  if (el) { el.click(); return; }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const domainKey = getDomainKeyFromUrl(tab?.url||'');
    if (!domainKey) { alert('Pause not supported on this site'); return; }
    chrome.storage.local.get(['pausedSites'], (res) => { const paused = res.pausedSites||{}; paused[domainKey] = !paused[domainKey]; chrome.storage.local.set({ pausedSites: paused }, () => { alert((paused[domainKey] ? 'Paused ' : 'Resumed ') + (domainKey)); }); });
  });
}

function quickImportAction() { const el = $id('importModelBtn'); if (el) { el.click(); } else importPackagedModel(); }

// Load dashboard data
function loadDashboard() {
  chrome.storage.local.get(['dailyUsage', 'settings', 'moodEntries'], (result) => {
    const dailyUsage = result.dailyUsage || {};
    const settings = result.settings || {};
    const moodEntries = result.moodEntries || [];
    
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = dailyUsage[today] || {};
    
    // Calculate totals
    const totalSeconds = Object.values(todayUsage).reduce((sum, val) => sum + val, 0);
    const totalMinutes = Math.floor(totalSeconds / 60);
    
  // Update stats (use safe setters)
  safeSetText('todayTotal', formatTime(totalSeconds));
  safeSetText('dailyLimit', `${settings.timeLimit || 30}m`);
    
    // Calculate week total
    const weekTotal = calculateWeekTotal(dailyUsage);
  safeSetText('weekTotal', formatTime(weekTotal));
    
    // Update progress bar
    const limit = (settings.timeLimit || 30) * 60; // Convert to seconds
    const progress = Math.min((totalSeconds / limit) * 100, 100);
  const _progressFill = $id('progressFill'); if (_progressFill) _progressFill.style.width = `${progress}%`;
  safeSetText('progressPercent', `${Math.round(progress)}%`);
    
    // Update progress bar color based on percentage
    const _progressFill2 = $id('progressFill');
    if (_progressFill2) {
      if (progress >= 100) {
        _progressFill2.style.background = 'linear-gradient(90deg, #ff4757 0%, #ff6348 100%)';
      } else if (progress >= 75) {
        _progressFill2.style.background = 'linear-gradient(90deg, #ffa502 0%, #ff6348 100%)';
      } else {
        _progressFill2.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
      }
    }
    
    // Update app breakdown
    updateAppBreakdown(todayUsage, totalSeconds);
    
    // Update mood quality
    updateMoodQuality(moodEntries);
  });
}

// Calculate week total
function calculateWeekTotal(dailyUsage) {
  const today = new Date();
  let total = 0;
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (dailyUsage[dateStr]) {
      const dayTotal = Object.values(dailyUsage[dateStr]).reduce((sum, val) => sum + val, 0);
      total += dayTotal;
    }
  }
  
  return total;
}

// Format time (seconds to readable format)
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Update app breakdown
function updateAppBreakdown(todayUsage, totalSeconds) {
  const appList = $id('appList');
  if (!appList) return;
  appList.innerHTML = '';

  if (Object.keys(todayUsage).length === 0) {
    appList.innerHTML = '<div class="empty-state">No activity today yet. Start browsing to see your stats!</div>';
    return;
  }

  // Sort by time spent
  const sortedApps = Object.entries(todayUsage).sort((a, b) => b[1] - a[1]);

  sortedApps.forEach(([site, seconds]) => {
    const percentage = (seconds / totalSeconds) * 100;
    const appItem = document.createElement('div');
    appItem.className = 'app-item';

    appItem.innerHTML = `
      <div class="app-icon">${SITE_ICONS[site] || '🌐'}</div>
      <div class="app-info">
        <div class="app-name">${SITE_NAMES[site] || site}</div>
        <div class="app-time">${formatTime(seconds)}</div>
        <div class="app-bar">
          <div class="app-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;

    appList.appendChild(appItem);
  });
}

// Update mood quality
function updateMoodQuality(moodEntries) {
  if (!Array.isArray(moodEntries) || moodEntries.length === 0) { safeSetText('moodQuality','-'); return; }

  const moodValues = {
    'great': 5,
    'good': 4,
    'neutral': 3,
    'bad': 2,
    'terrible': 1
  };

  // Calculate average mood from last 7 days
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentMoods = moodEntries.filter(entry => entry.timestamp > weekAgo);

  if (!recentMoods || recentMoods.length === 0) { safeSetText('moodQuality','-'); return; }

  const avgMood = recentMoods.reduce((sum, entry) => sum + moodValues[entry.mood], 0) / recentMoods.length;
  const quality = Math.round(avgMood * 20); // Convert to percentage

  safeSetText('moodQuality', `${quality}%`);
}

// Load settings
function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || {};

    safeSetValue('timeLimit', settings.timeLimit || 30);
    safeSetChecked('enableAlerts', settings.enableAlerts !== false);
    safeSetChecked('enableMorphing', settings.enableMorphing !== false);
    safeSetValue('morphingIntensity', settings.morphingIntensity || 50);
    safeSetText('intensityValue', `${settings.morphingIntensity || 50}%`);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Mood buttons
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood;
      
      // Update UI
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      
      // Save mood
      chrome.runtime.sendMessage({
        action: 'saveMood',
        mood: mood
      }, () => {
        // Refresh dashboard
        setTimeout(loadDashboard, 300);
      });
    });
  });
  
  // Morphing intensity slider
  const morphSlider = $id('morphingIntensity'); if (morphSlider) morphSlider.addEventListener('input', (e) => { safeSetText('intensityValue', `${e.target.value}%`); });
  
  // Save settings button
  const saveBtn = $id('saveSettings'); if (saveBtn) saveBtn.addEventListener('click', () => {
    const settings = {
      timeLimit: parseInt(($id('timeLimit') && $id('timeLimit').value) || 30),
      enableAlerts: ($id('enableAlerts') && $id('enableAlerts').checked) || false,
      enableMorphing: ($id('enableMorphing') && $id('enableMorphing').checked) || false,
      morphingIntensity: parseInt(($id('morphingIntensity') && $id('morphingIntensity').value) || 50)
    };
    
    chrome.storage.local.set({ settings }, () => {
      // Notify content scripts
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            try {
              chrome.tabs.sendMessage(tab.id, {
                action: 'updateSettings',
                settings: settings
              }, () => { if (chrome.runtime.lastError) { /* ignore */ } });
            } catch (e) { /* ignore */ }
          });
        });
      
      // Show feedback
      const btn = saveBtn;
      const originalText = btn && btn.textContent;
      if (btn) {
        btn.textContent = '✓ Saved!';
        btn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 2000);
      }
    });
  });
  
  // Reset data button
  const resetBtn = $id('resetData'); if (resetBtn) resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset today\'s data? This cannot be undone.')) {
      chrome.storage.local.get(['dailyUsage'], (result) => {
        const dailyUsage = result.dailyUsage || {};
        const today = new Date().toISOString().split('T')[0];
        delete dailyUsage[today];
        
        chrome.storage.local.set({ dailyUsage }, () => {
          loadDashboard();
        });
      });
    }
  });
}

// -------------------------
// Per-site pause controls
// -------------------------
function getDomainKeyFromUrl(url) {
  if (!url) return null;
  const keys = Object.keys(SITE_NAMES);
  for (const k of keys) if (url.includes(k)) return k;
  return null;
}

function setupPauseButton() {
  const btn = $id('pauseSiteBtn');
  if (!btn) return;

  // Determine active tab domain and initial paused state
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const domainKey = getDomainKeyFromUrl(tab?.url || '');

    if (!domainKey) {
      btn.disabled = true;
      btn.textContent = 'Pause (not supported site)';
      return;
    }

    chrome.storage.local.get(['pausedSites'], (res) => {
      const paused = res.pausedSites || {};
      const isPaused = !!paused[domainKey];
      btn.textContent = isPaused ? 'Resume for this site' : 'Pause for this site';

      btn.addEventListener('click', () => {
        // Toggle paused state for this domain
        paused[domainKey] = !paused[domainKey];
        chrome.storage.local.set({ pausedSites: paused }, () => {
          // Notify the active tab to pause/resume immediately
          try {
            chrome.tabs.sendMessage(tab.id, { action: paused[domainKey] ? 'pauseSite' : 'resumeSite' }, () => { if (chrome.runtime.lastError) {} });
          } catch (e) {}

          btn.textContent = paused[domainKey] ? 'Resume for this site' : 'Pause for this site';
          // Refresh paused sites list
          showPausedSites();
        });
      });
    });
  });
}

// Show list of paused sites with remove buttons
function showPausedSites() {
  const container = $id('pausedSites');
  if (!container) return;
  chrome.storage.local.get(['pausedSites'], (res) => {
    const paused = res.pausedSites || {};
    container.innerHTML = '';
    const keys = Object.keys(paused).filter(k => paused[k]);
    if (keys.length === 0) {
      container.innerHTML = '<div class="empty-state" style="color:#ddd;font-size:0.9em;">No paused sites</div>';
      return;
    }

    keys.forEach(k => {
      const item = document.createElement('div');
      item.className = 'paused-site-item';
      item.innerHTML = `<div class="site-name">${SITE_NAMES[k] || k}</div><button data-site="${k}">Remove</button>`;
      const btn = item.querySelector('button');
      btn.addEventListener('click', () => {
        chrome.storage.local.get(['pausedSites'], (r2) => {
          const p = r2.pausedSites || {};
          delete p[k];
          chrome.storage.local.set({ pausedSites: p }, () => {
            // Notify all tabs to resume this domain if open
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach(tab => {
                try { chrome.tabs.sendMessage(tab.id, { action: 'resumeSite' }, () => {}); } catch (e) {}
              });
            });
            showPausedSites();
            // update pause button state for active tab
            setupPauseButton();
          });
        });
      });

      container.appendChild(item);
    });
  });
}

// -------------------------
// Focus session (25-minute pomodoro-like)
// -------------------------
let focusInterval = null;
let focusEnd = null; // timestamp ms
let focusActive = false;
const DEFAULT_FOCUS_SECONDS = 25 * 60;

function setupFocusControls() {
  const startBtn = $id('focusStart');
  const pauseBtn = $id('focusPause');
  const resetBtn = $id('focusReset');
  const display = $id('focusTimer');
  if (!startBtn || !pauseBtn || !resetBtn || !display) return;

  // load persisted session
  chrome.storage.local.get(['focusSession'], (res) => {
    const s = res.focusSession;
    if (s && s.active && s.endTime && s.endTime > Date.now()) {
      focusEnd = s.endTime;
      focusActive = true;
      startFocusInterval();
      notifyTabs('focusStart');
    } else {
      updateFocusDisplay(DEFAULT_FOCUS_SECONDS);
    }
  });

  startBtn.addEventListener('click', () => {
    if (!focusActive) {
      const now = Date.now();
      focusEnd = now + DEFAULT_FOCUS_SECONDS * 1000;
      focusActive = true;
      chrome.storage.local.set({ focusSession: { active: true, endTime: focusEnd } });
      startFocusInterval();
      notifyTabs('focusStart');
      autoPauseAll();
    }
  });

  pauseBtn.addEventListener('click', () => {
    if (!focusActive) return;
    // pause by computing remaining and clearing
    const remaining = Math.max(0, Math.round((focusEnd - Date.now()) / 1000));
    focusActive = false;
    clearInterval(focusInterval);
    focusInterval = null;
    chrome.storage.local.set({ focusSession: { active: false, remaining } });
    updateFocusDisplay(remaining);
    notifyTabs('focusPause');
  });

  resetBtn.addEventListener('click', () => {
    focusActive = false;
    focusEnd = null;
    clearInterval(focusInterval);
    focusInterval = null;
    chrome.storage.local.remove('focusSession');
    updateFocusDisplay(DEFAULT_FOCUS_SECONDS);
    notifyTabs('focusEnd');
  });
}

function startFocusInterval() {
  clearInterval(focusInterval);
  focusInterval = setInterval(() => {
    const remaining = Math.max(0, Math.round((focusEnd - Date.now()) / 1000));
    updateFocusDisplay(remaining);
    if (remaining <= 0) {
      clearInterval(focusInterval);
      focusInterval = null;
      focusActive = false;
      chrome.storage.local.remove('focusSession');
      notifyTabs('focusEnd');
      restoreAutoPaused();
    }
  }, 1000);
}

// Auto-pause all tracked sites when focus starts (but preserve user's own paused sites)
function autoPauseAll() {
  const tracked = Object.keys(SITE_NAMES);
  chrome.storage.local.get(['pausedSites'], (res) => {
    const paused = res.pausedSites || {};
    const autoPaused = [];
    tracked.forEach(domain => {
      if (!paused[domain]) {
        paused[domain] = true;
        autoPaused.push(domain);
      }
    });
    chrome.storage.local.set({ pausedSites: paused, focusAutoPaused: autoPaused }, () => {
      // notify tabs to pause
      chrome.tabs.query({}, (tabs) => { tabs.forEach(tab => { try { chrome.tabs.sendMessage(tab.id, { action: 'pauseSite' }, () => {}); } catch(e){} }); });
      showPausedSites();
      setupPauseButton();
    });
  });
}

// Restore sites that were auto-paused by focus session
function restoreAutoPaused() {
  chrome.storage.local.get(['pausedSites','focusAutoPaused'], (res) => {
    const paused = res.pausedSites || {};
    const autoPaused = res.focusAutoPaused || [];
    autoPaused.forEach(domain => { if (paused[domain]) delete paused[domain]; });
    chrome.storage.local.set({ pausedSites: paused, focusAutoPaused: [] }, () => {
      // notify tabs to resume
      chrome.tabs.query({}, (tabs) => { tabs.forEach(tab => { try { chrome.tabs.sendMessage(tab.id, { action: 'resumeSite' }, () => {}); } catch(e){} }); });
      showPausedSites();
      setupPauseButton();
    });
  });
}

// -------------------------
// Export / Import data
// -------------------------
function setupExportImport() {
  const exportBtn = $id('exportDataBtn');
  const importBtn = $id('importDataBtn');
  const fileInput = $id('importFileInput');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      chrome.storage.local.get(['dailyUsage','moodEntries'], (res) => {
        const payload = { exportedAt: Date.now(), dailyUsage: res.dailyUsage || {}, moodEntries: res.moodEntries || [] };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const name = `mindful_scroll_export_${new Date().toISOString().split('T')[0]}.json`;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object') throw new Error('Invalid JSON');
          if (!confirm('Importing will replace your current daily usage and mood entries. Continue?')) return;
          const toSet = {};
          if (data.dailyUsage) toSet.dailyUsage = data.dailyUsage;
          if (data.moodEntries) toSet.moodEntries = data.moodEntries;
          chrome.storage.local.set(toSet, () => { loadDashboard(); showPausedSites(); alert('Import successful'); });
        } catch (err) { alert('Failed to import: ' + err.message); }
      };
      reader.readAsText(file);
    });
  }
}

// -------------------------
// Naive Bayes on-device training
// -------------------------
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[\W_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function getTrainingExamples(callback) {
  chrome.storage.local.get(['trainingExamples'], (res) => {
    callback(res.trainingExamples || []);
  });
}

function saveTrainingExample(example, cb) {
  getTrainingExamples((examples) => {
    examples.push({ text: example.text, label: example.label, timestamp: Date.now() });
    chrome.storage.local.set({ trainingExamples: examples }, () => {
      updateExampleCount();
      cb && cb();
    });
  });
}

function clearTrainingExamples() {
  chrome.storage.local.remove('trainingExamples', () => { updateExampleCount(); });
}

function trainNBFromExamples(cb) {
  getTrainingExamples((examples) => {
  const retrainBtn = $id('retrainBtn');
  const modelBadge = $id('modelBadge');
  if (retrainBtn) { retrainBtn.disabled = true; retrainBtn.textContent = 'Training...'; }
  if (modelBadge) { modelBadge.classList.remove('ready'); modelBadge.classList.add('loading'); modelBadge.textContent = 'Training'; }

    // perform training (kept synchronous but UI shows loading)
    setTimeout(() => {
      const model = { classes: {}, vocab: {}, totalDocs: 0 };
      model.totalDocs = examples.length;
      examples.forEach(ex => {
        const cls = ex.label;
        if (!model.classes[cls]) model.classes[cls] = { docCount: 0, tokenCounts: {}, totalTokens: 0 };
        model.classes[cls].docCount += 1;
        const tokens = tokenize(ex.text);
        tokens.forEach(t => {
          model.vocab[t] = true;
          model.classes[cls].tokenCounts[t] = (model.classes[cls].tokenCounts[t] || 0) + 1;
          model.classes[cls].totalTokens += 1;
        });
      });
      chrome.storage.local.set({ nbModel: model }, () => {
        updateModelInfo();
        if (retrainBtn) { retrainBtn.disabled = false; retrainBtn.textContent = 'Retrain Model'; }
        if (modelBadge) { modelBadge.classList.remove('loading'); modelBadge.classList.add('ready'); modelBadge.textContent = Object.keys(model.classes).length + ' cls'; }
        cb && cb();
      });
    }, 100);
  });
}

function classifyWithModel(text, model) {
  if (!model || !model.classes || Object.keys(model.classes).length === 0) return { label: 'unknown', probabilities: {}, scores: {} };
  const tokens = tokenize(text);
  const V = Object.keys(model.vocab).length || 1;
  const logScores = {};
  Object.entries(model.classes).forEach(([cls, info]) => {
    const prior = (info.docCount + 1) / (model.totalDocs + Object.keys(model.classes).length);
    let score = Math.log(prior);
    const denom = info.totalTokens + V; // for Laplace
    tokens.forEach(t => {
      const count = info.tokenCounts[t] || 0;
      score += Math.log((count + 1) / denom);
    });
    logScores[cls] = score;
  });
  // convert logScores to probabilities
  const maxLog = Math.max(...Object.values(logScores));
  const exps = Object.fromEntries(Object.entries(logScores).map(([k,v]) => [k, Math.exp(v - maxLog)]));
  const sumExps = Object.values(exps).reduce((s,v) => s+v, 0);
  const probs = Object.fromEntries(Object.entries(exps).map(([k,v]) => [k, v / sumExps]));
  const best = Object.entries(probs).sort((a,b) => b[1]-a[1])[0];
  return { label: best ? best[0] : 'unknown', probabilities: probs, scores: logScores };
}

function updateExampleCount() {
  getTrainingExamples((examples) => {
    safeSetText('exampleCount', (examples || []).length);
  });
}

function updateModelInfo() {
  chrome.storage.local.get(['nbModel'], (res) => {
    const model = res.nbModel;
    if (!model) {
      safeSetText('modelInfo','none');
      return;
    }
    const classes = Object.keys(model.classes).length;
    safeSetText('modelInfo', `${classes} classes, vocab ${Object.keys(model.vocab||{}).length}`);
  });
}

// Wire training UI
function setupTrainingUI() {
  const addBtn = $id('addExampleBtn');
  const retrainBtn = $id('retrainBtn');
  const clearBtn = $id('clearExamplesBtn');
  const textEl = $id('trainingText');
  const labelEl = $id('trainingLabel');
  if (addBtn) addBtn.addEventListener('click', () => {
    const text = textEl.value && textEl.value.trim();
    const label = labelEl.value;
    if (!text) { alert('Please enter example text.'); return; }
    saveTrainingExample({ text, label }, () => { textEl.value = ''; });
  });
  if (retrainBtn) retrainBtn.addEventListener('click', () => { trainNBFromExamples(() => alert('Model trained.')); });
  if (clearBtn) clearBtn.addEventListener('click', () => { if (confirm('Clear all training examples?')) { clearTrainingExamples(); chrome.storage.local.remove('nbModel'); updateModelInfo(); } });
  updateExampleCount(); updateModelInfo();
}

// Make model available to content scripts by saving to storage (content listens for changes).

// Initialize training UI
setupTrainingUI();

// Import packaged model into chrome.storage (fetch from extension's data/nb_model.json)
function importPackagedModel() {
  const url = chrome.runtime.getURL('data/nb_model.json');
  const importBtn = $id('importModelBtn');
  const modelBadge = $id('modelBadge');
  if (importBtn) { importBtn.disabled = true; importBtn.textContent = 'Importing...'; }
  if (modelBadge) { modelBadge.classList.remove('ready'); modelBadge.classList.add('loading'); modelBadge.textContent = 'Importing'; }

  fetch(url).then(r => r.json()).then(model => {
    if (!model || !model.classes) { alert('Packaged model looks invalid.'); return; }
    chrome.storage.local.set({ nbModel: model }, () => {
      updateModelInfo();
      if (importBtn) { importBtn.disabled = false; importBtn.textContent = 'Import Packaged Model'; }
      if (modelBadge) { modelBadge.classList.remove('loading'); modelBadge.classList.add('ready'); modelBadge.textContent = Object.keys(model.classes).length + ' cls'; }
      // subtle toast
      const t = document.createElement('div'); t.textContent = 'Model imported'; t.className = 'import-toast'; document.body.appendChild(t);
      setTimeout(() => t.remove(), 1800);
    });
  }).catch(err => { if (importBtn) { importBtn.disabled = false; importBtn.textContent = 'Import Packaged Model'; } alert('Failed to import packaged model: ' + (err && err.message)); });
}

// DOM wiring moved into wireDomHandlers() to ensure bindings run after DOM ready

// Listen for model changes to update UI
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.nbModel) updateModelInfo();
  if (area === 'local' && changes.trainingExamples) updateExampleCount();
  if (area === 'local' && changes.stressLogs) updateStressAnalysis();
  if (area === 'local' && changes.nudgeEvents) updateStressAnalysis();
});

// Stress analysis UI helpers
function updateStressAnalysis() {
  chrome.storage.local.get(['stressLogs','nudgeEvents','dailyStressCounts'], (res) => {
    const logs = res.stressLogs || [];
    const nudges = res.nudgeEvents || [];
    const daily = res.dailyStressCounts || {};
    safeSetText('stressCount', logs.length);
    safeSetText('nudgeCount', nudges.length);
    const list = $id('stressSampleList');
    if (!list) return;
    list.innerHTML = '';
    const recent = logs.slice(-40).reverse();
    recent.forEach(l => {
      const d = new Date(l.timestamp).toLocaleTimeString();
      const row = document.createElement('div');
      row.style.padding = '6px 0';
      row.innerHTML = `<strong style="color:#ffd6a5">${l.label}</strong> <span style="color:#94a3b8">@${l.site||''} ${d}</span><div style="color:#e6eef8">${(l.snippet||'').substring(0,120)}</div>`;
      list.appendChild(row);
    });

    // compute 7-day seriesprefer daily aggregates if available
    let series = [];
    try {
      if (Object.keys(daily).length > 0) {
        series = compute7DaySeriesFromDaily(daily);
      } else {
        series = compute7DaySeries(logs);
      }
      drawBarChart('stressSpark', series);

      // compute trend percent: today vs avg(previous 6 days)
      const today = series[6] || 0;
      const prev = series.slice(0,6);
      const avgPrev = prev.reduce((s,v)=>s+v,0) / (prev.length || 1);
      const pct = Math.round(((today - avgPrev) / (avgPrev || 1)) * 100);
      const trendEl = $id('trendPercent');
      if (trendEl) {
        if (pct > 0) { trendEl.textContent = `▲ ${Math.abs(pct)}%`; trendEl.style.color = '#7ef5a0'; }
        else if (pct < 0) { trendEl.textContent = `▼ ${Math.abs(pct)}%`; trendEl.style.color = '#ff6b6b'; }
        else { trendEl.textContent = `↔ 0%`; trendEl.style.color = '#ffd6a5'; }
      }
    } catch (e) { /* ignore drawing errors */ }
  });
}

// Compute a 7-day count series (today..6 days ago)
function compute7DaySeries(logs) {
  const counts = Array(7).fill(0);
  const now = new Date();
  for (const l of logs) {
    const d = new Date(l.timestamp);
    const diffDays = Math.floor((now - d) / (24 * 60 * 60 * 1000));
    if (diffDays >= 0 && diffDays < 7) counts[6 - diffDays] += 1; // reverse so [6 days ago ... today]
  }
  return counts;
}

// Build 7-day series from daily aggregated counts object
function compute7DaySeriesFromDaily(daily) {
  const now = new Date();
  const series = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
  }
  // simpler: create array [6 days ago ... today]
  const out = Array(7).fill(0);
  Object.keys(daily).forEach(day => {
    const idx = Math.floor((new Date().toISOString().split('T')[0] > day ? 0 : 0));
    // we'll map by date difference instead
  });
  const today = new Date();
  for (let k=0;k<7;k++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - k)).toISOString().split('T')[0];
    out[k] = (daily[day] && daily[day].total) || 0;
  }
  return out;
}

// Draw a tiny sparkline on a canvas (simple bezier-ish polyline)
function drawBarChart(canvasId, data) {
  const c = $id(canvasId);
  if (!c || !c.getContext) return;
  const ctx = c.getContext('2d');
  // Make canvas crisp on HiDPI displays
  const dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  c.width = Math.floor(w * dpr);
  c.height = Math.floor(h * dpr);
  // scale drawing to device pixels but use CSS pixels for geometry
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...data, 1);
  const pad = 8; const usableW = w - pad*2; const colSpace = usableW / data.length; const barW = colSpace * 0.7; const gap = colSpace * 0.3;
  data.forEach((v,i) => {
    const x = pad + i * (barW + gap) + gap/2;
    const barH = (v / max) * (h - pad*2);
    const y = h - pad - barH;
    // gradient fill
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, '#ffd6a5');
    grad.addColorStop(1, '#ff9f7d');
    ctx.fillStyle = grad;
    const radius = Math.min(6, barW/2);
    // rounded rect
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barW - radius, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
    ctx.lineTo(x + barW, y + barH - radius);
    ctx.quadraticCurveTo(x + barW, y + barH, x + barW - radius, y + barH);
    ctx.lineTo(x + radius, y + barH);
    ctx.quadraticCurveTo(x, y + barH, x, y + barH - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  });
}

// Self-test handler (wiring happens in wireDomHandlers)
function runSelfTest() {
  // create synthetic logs across 7 days
  const now = Date.now();
  const fakeLogs = [];
  for (let d=0; d<7; d++) {
    const entries = Math.floor(Math.random()*6); // 0-5 events
    for (let i=0;i<entries;i++) {
      fakeLogs.push({ label: ['stress','demotivation','negative','neutral','positive'][Math.floor(Math.random()*5)], probability: Math.random(), snippet: 'Sample item ' + (i+1), timestamp: now - d*24*60*60*1000 - Math.floor(Math.random()*3600*1000), site: 'example.com' });
    }
  }
  const fakeNudges = [{ timestamp: now, reason: 'self-test', site: 'example.com' }];
  chrome.storage.local.get(['stressLogs','nudgeEvents','dailyStressCounts'], (res) => {
    const logs = (res.stressLogs || []).concat(fakeLogs).slice(-2000);
    const nudges = (res.nudgeEvents || []).concat(fakeNudges).slice(-1000);
    // rebuild daily aggregates from logs
    const daily = buildDailyFromLogs(logs);
    chrome.storage.local.set({ stressLogs: logs, nudgeEvents: nudges, dailyStressCounts: daily }, () => { updateStressAnalysis(); alert('Self-test injected: ' + fakeLogs.length + ' logs'); });
  });
}

// Diagnostics: quick checks for key elements and APIs
// Diagnostics wiring is attached in wireDomHandlers() to ensure DOM is ready

function buildDailyFromLogs(logs) {
  const daily = {};
  logs.forEach(l => {
    const day = new Date(l.timestamp).toISOString().split('T')[0];
    if (!daily[day]) daily[day] = { total: 0, sites: {} };
    const lbl = (l.label||'').toLowerCase();
    if (lbl === 'stress' || lbl === 'demotivation' || lbl === 'negative') {
      daily[day].total = (daily[day].total || 0) + 1;
      const s = l.site || 'unknown';
      daily[day].sites[s] = (daily[day].sites[s] || 0) + 1;
    }
  });
  // prune to last 90 days
  const keys = Object.keys(daily).sort().reverse().slice(0,90).reverse();
  const out = {}; keys.forEach(k=>out[k]=daily[k]); return out;
}

// Open logs in a new tab with a simple HTML viewer (data URL)
function openLogsViewer() {
  chrome.storage.local.get(['stressLogs','nudgeEvents'], (res) => {
    const logs = res.stressLogs || [];
    const nudges = res.nudgeEvents || [];
    const html = `<html><head><title>Mindful Scroll Logs</title><meta charset="utf-8"/></head><body style="font-family:Arial"><h2>Stress Logs (${logs.length})</h2><pre>${JSON.stringify(logs.slice(-500),null,2)}</pre><h2>Nudges (${nudges.length})</h2><pre>${JSON.stringify(nudges.slice(-500),null,2)}</pre></body></html>`;
    const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    try { chrome.tabs.create({ url }); } catch (e) { window.open(url,'_blank'); }
  });
}

function updateFocusDisplay(seconds) {
  const display = $id('focusTimer');
  if (!display) return;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  display.textContent = `${m}:${s}`;
}

function notifyTabs(action) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      try { chrome.tabs.sendMessage(tab.id, { action }, () => {}); } catch (e) {}
    });
  });
}


  // Wire DOM event handlers after DOM is ready
  function wireDomHandlers() {
    // Existing handlers
    const importModelBtn = $id('importModelBtn'); if (importModelBtn) importModelBtn.addEventListener('click', importPackagedModel);
    const openLogsBtn = $id('openLogsBtn'); if (openLogsBtn) openLogsBtn.addEventListener('click', openLogsViewer);
    const openModelBtn = $id('openModelBtn'); if (openModelBtn) openModelBtn.addEventListener('click', openModelViewer);
    const selfTestBtn = $id('selfTestBtn'); if (selfTestBtn) selfTestBtn.addEventListener('click', runSelfTest);
    const exportCsvBtn = $id('exportCsvBtn'); if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportDailyCsv);
    const diagBtn = $id('diagBtn'); if (diagBtn) diagBtn.addEventListener('click', runDiagnosticsAlert);
    
    // Quick action buttons (map to existing handlers)
    const quickFocus = $id('quickFocusStart'); if (quickFocus) quickFocus.addEventListener('click', quickFocusAction);
    const quickPause = $id('quickPauseSite'); if (quickPause) quickPause.addEventListener('click', quickPauseAction);
    const quickImport = $id('quickImportModel'); if (quickImport) quickImport.addEventListener('click', quickImportAction);
    
    // New UI elements for modern design
    const addExampleBtn = $id('addExampleBtn'); if (addExampleBtn) addExampleBtn.addEventListener('click', addTrainingExample);
    const retrainBtn = $id('retrainBtn'); if (retrainBtn) retrainBtn.addEventListener('click', retrainModel);
    const clearExamplesBtn = $id('clearExamplesBtn'); if (clearExamplesBtn) clearExamplesBtn.addEventListener('click', clearTrainingExamples);
    const importCustomModelBtn = $id('importCustomModelBtn'); if (importCustomModelBtn) importCustomModelBtn.addEventListener('click', importCustomModel);
    const exportModelBtn = $id('exportModelBtn'); if (exportModelBtn) exportModelBtn.addEventListener('click', exportModel);
    const exportDataBtn = $id('exportDataBtn'); if (exportDataBtn) exportDataBtn.addEventListener('click', exportAllData);
    const importDataBtn = $id('importDataBtn'); if (importDataBtn) importDataBtn.addEventListener('click', () => $id('importFileInput')?.click());
    const resetData = $id('resetData'); if (resetData) resetData.addEventListener('click', resetTodayData);
    const resetAllData = $id('resetAllData'); if (resetAllData) resetAllData.addEventListener('click', resetAllDataConfirm);
    const saveSettings = $id('saveSettings'); if (saveSettings) saveSettings.addEventListener('click', saveSettingsHandler);
    const pauseSiteBtn = $id('pauseSiteBtn'); if (pauseSiteBtn) pauseSiteBtn.addEventListener('click', pauseCurrentSite);
    const focusModeBtn = $id('focusModeBtn'); if (focusModeBtn) focusModeBtn.addEventListener('click', enterFocusMode);
    
    // Focus controls
    const focusStart = $id('focusStart'); if (focusStart) focusStart.addEventListener('click', startFocusSession);
    const focusPause = $id('focusPause'); if (focusPause) focusPause.addEventListener('click', pauseFocusSession);
    const focusReset = $id('focusReset'); if (focusReset) focusReset.addEventListener('click', resetFocusSession);
    
    // Settings controls
    const timeLimit = $id('timeLimit'); if (timeLimit) timeLimit.addEventListener('input', updateTimeLimitDisplay);
    const morphingIntensity = $id('morphingIntensity'); if (morphingIntensity) morphingIntensity.addEventListener('input', updateIntensityDisplay);
    const enableMorphing = $id('enableMorphing'); if (enableMorphing) enableMorphing.addEventListener('change', toggleMorphingControls);
    
    // File input
    const importFileInput = $id('importFileInput'); if (importFileInput) importFileInput.addEventListener('change', handleFileImport);

    // Enhanced keyboard shortcuts
    document.addEventListener('keydown', (ev) => {
      // Tab switching with Alt + number
      if (ev.altKey) {
        switch(ev.key) {
          case '1': tabManager?.switchTab('dashboard'); ev.preventDefault(); break;
          case '2': tabManager?.switchTab('ai-insights'); ev.preventDefault(); break;
          case '3': tabManager?.switchTab('focus-tools'); ev.preventDefault(); break;
          case '4': tabManager?.switchTab('settings'); ev.preventDefault(); break;
        }
        return;
      }
      
      // Single key shortcuts (when no modifiers)
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const k = (ev.key || '').toLowerCase();
      if (k === 'f') { const el = $id('focusStart'); if (el) { el.click(); ev.preventDefault(); } }
      else if (k === 'p') { const el = $id('pauseSiteBtn'); if (el) { el.click(); ev.preventDefault(); } }
      else if (k === 'i') { const el = $id('importModelBtn'); if (el) { el.click(); ev.preventDefault(); } }
      else if (k === 'm') { const el = $id('openModelBtn'); if (el) { el.click(); ev.preventDefault(); } }
      else if (k === 'l') { const el = $id('openLogsBtn'); if (el) { el.click(); ev.preventDefault(); } }
      else if (k === 's') { const el = $id('saveSettings'); if (el) { el.click(); ev.preventDefault(); } }
      else if (k === 't') { const el = $id('selfTestBtn'); if (el) { el.click(); ev.preventDefault(); } }
      else if (k === 'd') { const el = $id('diagBtn'); if (el) { el.click(); ev.preventDefault(); } }
    });
  }

// Additional handler functions for new UI elements
function addTrainingExample() {
  const textEl = $id('trainingText');
  const labelEl = $id('trainingLabel');
  
  if (!textEl || !labelEl) return;
  
  const text = textEl.value.trim();
  const label = labelEl.value;
  
  if (!text) {
    alert('Please enter some training content');
    return;
  }
  
  chrome.storage.local.get(['trainingExamples'], (res) => {
    const examples = res.trainingExamples || [];
    examples.push({ text, label, timestamp: Date.now() });
    
    chrome.storage.local.set({ trainingExamples: examples }, () => {
      textEl.value = '';
      updateModelStatus();
      showToast(`Added ${label} example`);
    });
  });
}

function retrainModel() {
  chrome.storage.local.get(['trainingExamples'], (res) => {
    const examples = res.trainingExamples || [];
    if (examples.length < 2) {
      alert('Need at least 2 training examples to train model');
      return;
    }
    
    try {
      const model = trainNBFromExamples(examples);
      chrome.storage.local.set({ nbModel: model }, () => {
        updateModelStatus();
        showToast('Model retrained successfully');
      });
    } catch (error) {
      alert('Error training model: ' + error.message);
    }
  });
}

function clearTrainingExamples() {
  if (confirm('Clear all training examples? This cannot be undone.')) {
    chrome.storage.local.set({ trainingExamples: [] }, () => {
      updateModelStatus();
      showToast('Training examples cleared');
    });
  }
}

function importCustomModel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const model = JSON.parse(event.target.result);
          chrome.storage.local.set({ nbModel: model }, () => {
            updateModelStatus();
            showToast('Custom model imported');
          });
        } catch (error) {
          alert('Error importing model: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function exportModel() {
  chrome.storage.local.get(['nbModel'], (res) => {
    if (!res.nbModel) {
      alert('No model to export');
      return;
    }
    
    const blob = new Blob([JSON.stringify(res.nbModel, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindful-scroll-model-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function exportAllData() {
  chrome.storage.local.get(null, (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindful-scroll-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function resetAllDataConfirm() {
  if (confirm('Reset ALL data? This will delete everything and cannot be undone.')) {
    chrome.storage.local.clear(() => {
      showToast('All data reset');
      // Reload the popup
      location.reload();
    });
  }
}

function resetTodayData() {
  if (confirm('Reset today\'s data? This cannot be undone.')) {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(['dailyUsage'], (res) => {
      const usage = res.dailyUsage || {};
      delete usage[today];
      chrome.storage.local.set({ dailyUsage: usage }, () => {
        loadDashboard();
        showToast('Today\'s data reset');
      });
    });
  }
}

function saveSettingsHandler() {
  // Collect all settings and save them
  const settings = {};
  
  const timeLimit = $id('timeLimit');
  if (timeLimit) settings.timeLimit = parseInt(timeLimit.value);
  
  const enableAlerts = $id('enableAlerts');
  if (enableAlerts) settings.enableAlerts = enableAlerts.checked;
  
  const enableMorphing = $id('enableMorphing');
  if (enableMorphing) settings.enableMorphing = enableMorphing.checked;
  
  const morphingIntensity = $id('morphingIntensity');
  if (morphingIntensity) settings.morphingIntensity = parseInt(morphingIntensity.value);
  
  chrome.storage.local.set({ settings }, () => {
    showToast('Settings saved');
  });
}

function updateTimeLimitDisplay() {
  const timeLimit = $id('timeLimit');
  const display = $id('timeLimitDisplay');
  if (timeLimit && display) {
    const minutes = parseInt(timeLimit.value);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    let text = '';
    if (hours > 0) {
      text += `${hours}h `;
    }
    if (remainingMinutes > 0 || hours === 0) {
      text += `${remainingMinutes}m`;
    }
    
    display.textContent = text.trim();
    safeSetText('dailyLimit', text.trim());
  }
}

function updateIntensityDisplay() {
  const slider = $id('morphingIntensity');
  const display = $id('intensityValue');
  if (slider && display) {
    display.textContent = slider.value + '%';
  }
}

function toggleMorphingControls() {
  const checkbox = $id('enableMorphing');
  const control = $id('morphingIntensityControl');
  if (checkbox && control) {
    control.style.display = checkbox.checked ? 'block' : 'none';
  }
}

function pauseCurrentSite() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname.replace('www.', '');
      
      chrome.storage.local.get(['pausedSites'], (res) => {
        const paused = res.pausedSites || [];
        if (!paused.includes(domain)) {
          paused.push(domain);
          chrome.storage.local.set({ pausedSites: paused }, () => {
            showToast(`Paused tracking for ${domain}`);
            showPausedSites();
          });
        }
      });
    }
  });
}

function enterFocusMode() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('assets/focus.html')
  });
}

function startFocusSession() {
  const session = {
    active: true,
    startTime: Date.now(),
    duration: 25 * 60 // 25 minutes in seconds
  };
  
  chrome.storage.local.set({ focusSession: session }, () => {
    updateFocusSession();
    showToast('Focus session started');
    
    // Update UI
    const startBtn = $id('focusStart');
    const pauseBtn = $id('focusPause');
    if (startBtn) startBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = false;
  });
}

function pauseFocusSession() {
  chrome.storage.local.get(['focusSession'], (res) => {
    const session = res.focusSession;
    if (session) {
      session.active = false;
      chrome.storage.local.set({ focusSession: session }, () => {
        showToast('Focus session paused');
        
        // Update UI
        const startBtn = $id('focusStart');
        const pauseBtn = $id('focusPause');
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
      });
    }
  });
}

function resetFocusSession() {
  chrome.storage.local.remove('focusSession', () => {
    updateFocusSession();
    showToast('Focus session reset');
    
    // Update UI
    const startBtn = $id('focusStart');
    const pauseBtn = $id('focusPause');
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;
  });
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        chrome.storage.local.set(data, () => {
          showToast('Data imported successfully');
          // Reload to reflect changes
          location.reload();
        });
      } catch (error) {
        alert('Error importing data: ' + error.message);
      }
    };
    reader.readAsText(file);
  }
}

function showToast(message, duration = 3000) {
  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface-elevated);
    border: 1px solid var(--border-strong);
    color: var(--text-primary);
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    z-index: 1000;
    animation: slideUp 0.3s ease;
    box-shadow: var(--shadow-medium);
  `;
  toast.textContent = message;
  
  // Add to document
  document.body.appendChild(toast);
  
  // Remove after duration
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, duration);
}

// Refresh dashboard every 10 seconds
setInterval(loadDashboard, 10000);