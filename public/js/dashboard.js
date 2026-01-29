/**
 * Free Right Now - Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const FRN = window.FreeRightNow;
  
  // UI Elements
  const elements = {
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    userPublicLink: document.getElementById('user-public-link'),
    copyLinkBtn: document.getElementById('copy-link-btn'),
    
    statusCard: document.getElementById('status-card'),
    statusOrb: document.getElementById('status-orb'),
    statusIcon: document.getElementById('status-icon'),
    statusTitle: document.getElementById('status-title'),
    statusMessage: document.getElementById('status-message'),
    confidenceFill: document.getElementById('confidence-fill'),
    confidenceText: document.getElementById('confidence-text'),
    
    statSignals: document.getElementById('stat-signals'),
    statFreeTime: document.getElementById('stat-free-time'),
    statFocusTime: document.getElementById('stat-focus-time'),
    
    signalFeed: document.getElementById('signal-feed'),
    signalCount: document.getElementById('signal-count'),
    timeBlocks: document.getElementById('time-blocks'),
    integrationsList: document.getElementById('integrations-list'),
    
    accuracyValue: document.getElementById('accuracy-value'),
    accuracyFill: document.getElementById('accuracy-fill'),
    feedbackCount: document.getElementById('feedback-count'),
    
    markFreeBtn: document.getElementById('mark-free-btn'),
    markBusyBtn: document.getElementById('mark-busy-btn'),
    simulateBtn: document.getElementById('simulate-btn'),
    
    // Modal
    reviewModal: document.getElementById('review-modal'),
    modalClose: document.getElementById('modal-close'),
    modalCancel: document.getElementById('modal-cancel'),
    modalSubmit: document.getElementById('modal-submit'),
    reviewTime: document.getElementById('review-time'),
    reviewPredicted: document.getElementById('review-predicted'),
    reviewActual: document.getElementById('review-actual'),
    reviewNotes: document.getElementById('review-notes')
  };
  
  let currentReviewBlock = null;
  
  // Initialize dashboard
  function init() {
    updateUserInfo();
    updateStatus();
    updateStats();
    renderSignalFeed();
    renderTimeBlocks();
    setupIntegrations();
    updateLearningProgress();
    setupEventListeners();
    
    // Start auto-refresh
    setInterval(updateStatus, 10000);
    setInterval(updateStats, 30000);
  }
  
  // Update user info display
  function updateUserInfo() {
    const username = FRN.username || 'demo-user';
    elements.userAvatar.textContent = username.charAt(0).toUpperCase();
    elements.userName.textContent = `Welcome, ${username}!`;
    elements.userPublicLink.textContent = `${window.location.host}/u/${username}`;
  }
  
  // Update current status display
  function updateStatus() {
    const availability = FRN.calculateAvailability();
    
    // Update card class
    elements.statusCard.className = `status-card-large ${availability.status}`;
    elements.statusOrb.className = `status-orb ${availability.status}`;
    
    // Update icon
    const icons = {
      free: '✓',
      busy: '✗',
      maybe: '~',
      unknown: '?'
    };
    elements.statusIcon.textContent = icons[availability.status] || '?';
    
    // Update text
    const titles = {
      free: "You're Free Right Now",
      busy: "You're In Focus Mode",
      maybe: "You Might Be Available",
      unknown: "Analyzing..."
    };
    elements.statusTitle.textContent = titles[availability.status] || "Analyzing...";
    elements.statusMessage.textContent = availability.message;
    
    // Update confidence
    elements.confidenceFill.className = `confidence-fill ${availability.status}`;
    elements.confidenceFill.style.width = `${availability.confidence}%`;
    elements.confidenceText.textContent = `${availability.confidence}% confidence`;
  }
  
  // Update stats
  function updateStats() {
    // Get today's signals
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySignals = FRN.signals.filter(s => {
      return new Date(s.timestamp) >= today;
    });
    
    elements.statSignals.textContent = todaySignals.length;
    
    // Calculate free/focus time
    const blocks = FRN.generateTimeBlocks();
    const pastBlocks = blocks.filter(b => b.isPast);
    
    const freeBlocks = pastBlocks.filter(b => b.status === 'free').length;
    const busyBlocks = pastBlocks.filter(b => b.status === 'busy').length;
    
    elements.statFreeTime.textContent = `${freeBlocks}h`;
    elements.statFocusTime.textContent = `${busyBlocks}h`;
  }
  
  // Render signal feed
  function renderSignalFeed() {
    if (FRN.signals.length === 0) {
      elements.signalFeed.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📡</div>
          <p class="empty-state-text">No signals yet. Connect integrations or simulate activity.</p>
        </div>
      `;
      elements.signalCount.textContent = '0 signals';
      return;
    }
    
    const recentSignals = FRN.signals.slice(0, 20);
    elements.signalCount.textContent = `${FRN.signals.length} signals`;
    
    elements.signalFeed.innerHTML = recentSignals.map(signal => {
      const impactClass = signal.impact === 'free' ? 'free-signal' : 
                          signal.impact === 'busy' ? 'busy-signal' : 'neutral-signal';
      
      return `
        <div class="signal-item">
          <div class="signal-icon ${impactClass}">${signal.icon}</div>
          <div class="signal-content">
            <div class="signal-title">${signal.label}</div>
            <div class="signal-meta">${signal.description}</div>
          </div>
          <div class="signal-time">${FRN.formatRelativeTime(signal.timestamp)}</div>
        </div>
      `;
    }).join('');
  }
  
  // Render time blocks for daily review
  function renderTimeBlocks() {
    const blocks = FRN.generateTimeBlocks();
    
    elements.timeBlocks.innerHTML = blocks.map(block => {
      const statusLabels = {
        free: 'Free',
        busy: 'Focused',
        maybe: 'Maybe',
        unknown: 'Unknown'
      };
      
      return `
        <div class="time-block" data-hour="${block.hour}" data-status="${block.status}">
          <div class="time-block-time">${block.label}</div>
          <div class="time-block-bar ${block.status}">
            <span class="time-block-label">${statusLabels[block.status]} (${block.signalCount} signals)</span>
          </div>
          ${block.isPast ? `
            <div class="time-block-actions">
              <button class="time-block-btn confirm" title="Correct">✓</button>
              <button class="time-block-btn reject" title="Wrong">✗</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('.time-block').forEach(block => {
      block.querySelector('.time-block-btn.confirm')?.addEventListener('click', (e) => {
        e.stopPropagation();
        quickFeedback(block.dataset.hour, true, block.dataset.status);
      });
      
      block.querySelector('.time-block-btn.reject')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openReviewModal(block.dataset.hour, block.dataset.status);
      });
    });
  }
  
  // Setup integration toggles
  function setupIntegrations() {
    document.querySelectorAll('.integration-item').forEach(item => {
      const integration = item.dataset.integration;
      const toggle = item.querySelector('.toggle-switch');
      const statusEl = item.querySelector('.integration-item-status');
      
      // Load saved state
      const isConnected = FRN.integrations[integration] || false;
      if (isConnected) {
        toggle.classList.add('active');
        toggle.dataset.connected = 'true';
        statusEl.textContent = 'Connected';
        statusEl.classList.add('connected');
      }
      
      // Click handler
      item.addEventListener('click', () => {
        const newState = toggle.dataset.connected !== 'true';
        toggle.classList.toggle('active', newState);
        toggle.dataset.connected = newState.toString();
        
        FRN.integrations[integration] = newState;
        FRN.saveState();
        
        if (newState) {
          statusEl.textContent = 'Connected';
          statusEl.classList.add('connected');
          
          // Simulate some initial signals from this integration
          simulateIntegrationSignals(integration);
        } else {
          statusEl.textContent = 'Click to connect';
          statusEl.classList.remove('connected');
        }
      });
    });
  }
  
  // Simulate signals from an integration
  function simulateIntegrationSignals(integration) {
    const integrationSignals = {
      gmail: ['email_check'],
      github: ['code_commit', 'ide_active'],
      slack: ['chat_active'],
      discord: ['chat_active', 'social_media'],
      browser: ['browser_active', 'social_media'],
      vscode: ['ide_active', 'long_typing']
    };
    
    const signals = integrationSignals[integration] || [];
    if (signals.length > 0) {
      const randomSignal = signals[Math.floor(Math.random() * signals.length)];
      FRN.addSignal(randomSignal, { source: integration });
    }
  }
  
  // Update learning progress
  function updateLearningProgress() {
    const accuracy = FRN.getAccuracy();
    const feedbackCount = FRN.feedbackHistory.length;
    
    elements.feedbackCount.textContent = feedbackCount;
    
    if (accuracy !== null) {
      elements.accuracyValue.textContent = `${accuracy}%`;
      elements.accuracyFill.style.width = `${accuracy}%`;
    } else {
      elements.accuracyValue.textContent = 'Learning...';
      elements.accuracyFill.style.width = '0%';
    }
  }
  
  // Quick feedback (correct prediction)
  function quickFeedback(hour, wasCorrect, status) {
    const today = new Date();
    today.setHours(parseInt(hour), 0, 0, 0);
    
    FRN.submitFeedback(today.toISOString(), wasCorrect, status);
    updateLearningProgress();
    
    // Visual feedback
    const block = document.querySelector(`.time-block[data-hour="${hour}"]`);
    if (block) {
      block.style.opacity = '0.5';
      setTimeout(() => {
        block.style.opacity = '1';
      }, 300);
    }
  }
  
  // Open review modal
  function openReviewModal(hour, predictedStatus) {
    currentReviewBlock = { hour, predictedStatus };
    
    elements.reviewTime.textContent = FRN.formatHour(parseInt(hour));
    
    const statusLabels = {
      free: '🟢 Free',
      busy: '🔴 Focused',
      maybe: '🟡 Maybe',
      unknown: '❓ Unknown'
    };
    elements.reviewPredicted.textContent = statusLabels[predictedStatus] || predictedStatus;
    elements.reviewPredicted.className = predictedStatus;
    
    elements.reviewModal.classList.add('active');
  }
  
  // Close review modal
  function closeReviewModal() {
    elements.reviewModal.classList.remove('active');
    currentReviewBlock = null;
    elements.reviewNotes.value = '';
  }
  
  // Submit review feedback
  function submitReview() {
    if (!currentReviewBlock) return;
    
    const actualStatus = elements.reviewActual.value;
    const notes = elements.reviewNotes.value;
    const wasCorrect = actualStatus === currentReviewBlock.predictedStatus;
    
    const today = new Date();
    today.setHours(parseInt(currentReviewBlock.hour), 0, 0, 0);
    
    FRN.submitFeedback(today.toISOString(), wasCorrect, actualStatus, notes);
    
    updateLearningProgress();
    closeReviewModal();
  }
  
  // Setup event listeners
  function setupEventListeners() {
    // Copy link
    elements.copyLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(elements.userPublicLink.textContent);
      elements.copyLinkBtn.innerHTML = '✓';
      setTimeout(() => {
        elements.copyLinkBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        `;
      }, 2000);
    });
    
    // Quick actions
    elements.markFreeBtn.addEventListener('click', () => {
      FRN.addSignal('browser_active', { manual: true });
      FRN.addSignal('email_check', { manual: true });
    });
    
    elements.markBusyBtn.addEventListener('click', () => {
      FRN.addSignal('ide_active', { manual: true });
      FRN.addSignal('dnd_enabled', { manual: true });
    });
    
    elements.simulateBtn.addEventListener('click', () => {
      // Add several random signals
      for (let i = 0; i < 3; i++) {
        setTimeout(() => FRN.simulateActivity(), i * 200);
      }
    });
    
    // Modal events
    elements.modalClose.addEventListener('click', closeReviewModal);
    elements.modalCancel.addEventListener('click', closeReviewModal);
    elements.modalSubmit.addEventListener('click', submitReview);
    elements.reviewModal.addEventListener('click', (e) => {
      if (e.target === elements.reviewModal) {
        closeReviewModal();
      }
    });
    
    // View public link
    document.getElementById('view-public-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(`/u/${FRN.username}`, '_blank');
    });
    
    // Listen for signal updates
    window.addEventListener('signal-added', () => {
      updateStatus();
      updateStats();
      renderSignalFeed();
      renderTimeBlocks();
    });
    
    window.addEventListener('feedback-added', () => {
      updateLearningProgress();
    });
  }
  
  // Initialize
  init();
});
