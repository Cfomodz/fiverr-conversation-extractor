/**
 * Free Right Now - Core Application Logic
 * Signal-driven availability system
 */

// Global state
window.FreeRightNow = {
  username: 'demo-user',
  signals: [],
  integrations: {},
  feedbackHistory: [],
  
  // Signal types and their availability implications
  signalTypes: {
    // Free signals - suggest availability
    email_check: { label: 'Checking Email', icon: '📧', impact: 'free', description: 'Opened email client' },
    browser_active: { label: 'Browsing', icon: '🌐', impact: 'free', description: 'Active browser session' },
    social_media: { label: 'Social Media', icon: '📱', impact: 'free', description: 'Using social media' },
    chat_active: { label: 'Chat Active', icon: '💬', impact: 'free', description: 'Responding to messages' },
    spotify_playing: { label: 'Listening to Music', icon: '🎵', impact: 'free', description: 'Spotify is playing' },
    
    // Busy signals - suggest deep work
    code_commit: { label: 'Code Commit', icon: '💻', impact: 'busy', description: 'Pushed code to repository' },
    ide_active: { label: 'IDE Active', icon: '⌨️', impact: 'busy', description: 'Active in code editor' },
    long_typing: { label: 'Deep Writing', icon: '📝', impact: 'busy', description: 'Extended typing session' },
    meeting: { label: 'In Meeting', icon: '📅', impact: 'busy', description: 'Calendar shows meeting' },
    dnd_enabled: { label: 'Do Not Disturb', icon: '🔕', impact: 'busy', description: 'DND mode enabled' },
    
    // Away signals
    phone_locked: { label: 'Phone Locked', icon: '📱', impact: 'away', description: 'Phone not used recently' },
    screen_off: { label: 'Screen Off', icon: '🖥️', impact: 'away', description: 'Computer screen is off' },
    idle: { label: 'Idle', icon: '💤', impact: 'away', description: 'No activity detected' }
  },
  
  // Calculate availability from signals
  calculateAvailability(signals = this.signals) {
    if (!signals || signals.length === 0) {
      return {
        status: 'unknown',
        confidence: 0,
        message: "No signals yet - availability unknown",
        icon: '❓'
      };
    }
    
    const now = Date.now();
    const recentSignals = signals.filter(s => {
      const signalTime = new Date(s.timestamp).getTime();
      return now - signalTime < 60 * 60 * 1000; // Last hour
    });
    
    if (recentSignals.length === 0) {
      return {
        status: 'unknown',
        confidence: 30,
        message: "No recent activity - might be away",
        icon: '❓'
      };
    }
    
    let freeScore = 0;
    let busyScore = 0;
    
    recentSignals.forEach(signal => {
      const age = (now - new Date(signal.timestamp).getTime()) / (60 * 1000);
      const recencyMultiplier = Math.max(0.1, 1 - (age / 60));
      const signalInfo = this.signalTypes[signal.type];
      
      if (signalInfo) {
        switch (signalInfo.impact) {
          case 'free':
            freeScore += 2 * recencyMultiplier;
            break;
          case 'busy':
            busyScore += 3 * recencyMultiplier;
            break;
          case 'away':
            busyScore += 1 * recencyMultiplier;
            break;
        }
      }
    });
    
    const totalScore = freeScore + busyScore;
    const freeRatio = totalScore > 0 ? freeScore / totalScore : 0.5;
    const confidence = Math.min(95, Math.round(50 + (recentSignals.length * 5)));
    
    let status, message, icon;
    
    if (freeRatio > 0.6) {
      status = 'free';
      message = "Looks available - good time to reach out!";
      icon = '✓';
    } else if (freeRatio > 0.4) {
      status = 'maybe';
      message = "Might be available - try a quick message first";
      icon = '~';
    } else {
      status = 'busy';
      message = "Deep in focus mode - best to wait";
      icon = '✗';
    }
    
    return { status, confidence, message, icon, freeScore, busyScore };
  },
  
  // Add a signal
  addSignal(type, metadata = {}) {
    const signalInfo = this.signalTypes[type];
    if (!signalInfo) {
      console.warn('Unknown signal type:', type);
      return null;
    }
    
    const signal = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      type,
      timestamp: new Date().toISOString(),
      metadata,
      ...signalInfo
    };
    
    this.signals.unshift(signal);
    
    // Keep only last 100 signals
    if (this.signals.length > 100) {
      this.signals.pop();
    }
    
    // Save to localStorage
    this.saveState();
    
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('signal-added', { detail: signal }));
    
    return signal;
  },
  
  // Simulate random signals (for demo)
  simulateActivity() {
    const signalKeys = Object.keys(this.signalTypes);
    const randomType = signalKeys[Math.floor(Math.random() * signalKeys.length)];
    return this.addSignal(randomType);
  },
  
  // Submit feedback for a time block
  submitFeedback(timestamp, wasCorrect, actualStatus, notes = '') {
    const feedback = {
      id: Date.now().toString(36),
      timestamp,
      wasCorrect,
      actualStatus,
      notes,
      recordedAt: new Date().toISOString()
    };
    
    this.feedbackHistory.push(feedback);
    this.saveState();
    
    window.dispatchEvent(new CustomEvent('feedback-added', { detail: feedback }));
    
    return feedback;
  },
  
  // Calculate model accuracy
  getAccuracy() {
    if (this.feedbackHistory.length === 0) return null;
    const correct = this.feedbackHistory.filter(f => f.wasCorrect).length;
    return Math.round((correct / this.feedbackHistory.length) * 100);
  },
  
  // Generate time blocks for daily review
  generateTimeBlocks() {
    const blocks = [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (let hour = 8; hour < 22; hour++) {
      const blockStart = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000);
      const blockEnd = new Date(blockStart.getTime() + 60 * 60 * 1000);
      
      // Find signals in this block
      const blockSignals = this.signals.filter(s => {
        const signalTime = new Date(s.timestamp);
        return signalTime >= blockStart && signalTime < blockEnd;
      });
      
      const availability = this.calculateAvailability(blockSignals);
      const isPast = blockEnd < now;
      const isCurrent = blockStart <= now && blockEnd > now;
      
      blocks.push({
        hour,
        startTime: blockStart.toISOString(),
        endTime: blockEnd.toISOString(),
        label: this.formatHour(hour),
        status: availability.status,
        confidence: availability.confidence,
        signalCount: blockSignals.length,
        isPast,
        isCurrent
      });
    }
    
    return blocks;
  },
  
  // Format hour for display
  formatHour(hour) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${ampm}`;
  },
  
  // Format relative time
  formatRelativeTime(timestamp) {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  },
  
  // Save state to localStorage
  saveState() {
    try {
      localStorage.setItem('frn-signals', JSON.stringify(this.signals));
      localStorage.setItem('frn-feedback', JSON.stringify(this.feedbackHistory));
      localStorage.setItem('frn-integrations', JSON.stringify(this.integrations));
      localStorage.setItem('frn-username', this.username);
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  },
  
  // Load state from localStorage
  loadState() {
    try {
      const signals = localStorage.getItem('frn-signals');
      const feedback = localStorage.getItem('frn-feedback');
      const integrations = localStorage.getItem('frn-integrations');
      const username = localStorage.getItem('frn-username');
      
      if (signals) this.signals = JSON.parse(signals);
      if (feedback) this.feedbackHistory = JSON.parse(feedback);
      if (integrations) this.integrations = JSON.parse(integrations);
      if (username) this.username = username;
    } catch (e) {
      console.warn('Could not load state:', e);
    }
  },
  
  // Initialize
  init() {
    this.loadState();
    console.log('Free Right Now initialized');
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.FreeRightNow.init();
});
