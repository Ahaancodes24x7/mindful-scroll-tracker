// Dashboard functionality

const SITE_ICONS = {
  'facebook.com': '📘',
  'instagram.com': '📷',
  'youtube.com': '▶️',
  'tiktok.com': '🎵',
  'twitter.com': '🐦',
  'x.com': '✖️'
};

const SITE_NAMES = {
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
  'tiktok.com': 'TikTok',
  'twitter.com': 'Twitter',
  'x.com': 'X'
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadSettings();
  setupEventListeners();
  updateDate();
});

// Update current date
function updateDate() {
  const today = new Date();
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  document.getElementById('currentDate').textContent = today.toLocaleDateString('en-US', options);
}

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
    
    // Update stats
    document.getElementById('todayTotal').textContent = formatTime(totalSeconds);
    document.getElementById('dailyLimit').textContent = `${settings.timeLimit || 30}m`;
    
    // Calculate week total
    const weekTotal = calculateWeekTotal(dailyUsage);
    document.getElementById('weekTotal').textContent = formatTime(weekTotal);
    
    // Update progress bar
    const limit = (settings.timeLimit || 30) * 60; // Convert to seconds
    const progress = Math.min((totalSeconds / limit) * 100, 100);
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressPercent').textContent = `${Math.round(progress)}%`;
    
    // Update progress bar color based on percentage
    const progressFill = document.getElementById('progressFill');
    if (progress >= 100) {
      progressFill.style.background = 'linear-gradient(90deg, #ff4757 0%, #ff6348 100%)';
    } else if (progress >= 75) {
      progressFill.style.background = 'linear-gradient(90deg, #ffa502 0%, #ff6348 100%)';
    } else {
      progressFill.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
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
  const appList = document.getElementById('appList');
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
  if (moodEntries.length === 0) {
    document.getElementById('moodQuality').textContent = '-';
    return;
  }
  
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
  
  if (recentMoods.length === 0) {
    document.getElementById('moodQuality').textContent = '-';
    return;
  }
  
  const avgMood = recentMoods.reduce((sum, entry) => sum + moodValues[entry.mood], 0) / recentMoods.length;
  const quality = Math.round(avgMood * 20); // Convert to percentage
  
  document.getElementById('moodQuality').textContent = `${quality}%`;
}

// Load settings
function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || {};
    
    document.getElementById('timeLimit').value = settings.timeLimit || 30;
    document.getElementById('enableAlerts').checked = settings.enableAlerts !== false;
    document.getElementById('enableMorphing').checked = settings.enableMorphing !== false;
    document.getElementById('morphingIntensity').value = settings.morphingIntensity || 50;
    document.getElementById('intensityValue').textContent = `${settings.morphingIntensity || 50}%`;
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
  document.getElementById('morphingIntensity').addEventListener('input', (e) => {
    document.getElementById('intensityValue').textContent = `${e.target.value}%`;
  });
  
  // Save settings button
  document.getElementById('saveSettings').addEventListener('click', () => {
    const settings = {
      timeLimit: parseInt(document.getElementById('timeLimit').value),
      enableAlerts: document.getElementById('enableAlerts').checked,
      enableMorphing: document.getElementById('enableMorphing').checked,
      morphingIntensity: parseInt(document.getElementById('morphingIntensity').value)
    };
    
    chrome.storage.local.set({ settings }, () => {
      // Notify content scripts
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateSettings',
            settings: settings
          }).catch(() => {
            // Ignore errors for tabs without content script
          });
        });
      });
      
      // Show feedback
      const btn = document.getElementById('saveSettings');
      const originalText = btn.textContent;
      btn.textContent = '✓ Saved!';
      btn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
    });
  });
  
  // Reset data button
  document.getElementById('resetData').addEventListener('click', () => {
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

// Refresh dashboard every 10 seconds
setInterval(loadDashboard, 10000);