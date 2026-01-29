/**
 * Free Right Now - Public Status Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const FRN = window.FreeRightNow;
  
  // Get username from URL
  const pathParts = window.location.pathname.split('/');
  const username = pathParts[pathParts.length - 1] || 'demo-user';
  
  // UI Elements
  const elements = {
    statusPage: document.getElementById('status-page'),
    loadingState: document.getElementById('loading-state'),
    mainContent: document.getElementById('main-content'),
    errorState: document.getElementById('error-state'),
    
    statusAvatar: document.getElementById('status-avatar'),
    statusName: document.getElementById('status-name'),
    statusBio: document.getElementById('status-bio'),
    
    statusOrbMain: document.getElementById('status-orb-main'),
    statusIconMain: document.getElementById('status-icon-main'),
    statusTextMain: document.getElementById('status-text-main'),
    statusTextSub: document.getElementById('status-text-sub'),
    confidenceFillMini: document.getElementById('confidence-fill-mini'),
    confidenceTextMini: document.getElementById('confidence-text-mini'),
    
    recommendationList: document.getElementById('recommendation-list'),
    lastUpdated: document.getElementById('last-updated')
  };
  
  // Status configurations
  const statusConfig = {
    free: {
      icon: '✓',
      title: 'Free Right Now',
      pageClass: 'free',
      recommendations: [
        { icon: 'check', text: 'Great time for a quick call' },
        { icon: 'check', text: 'Email will be seen soon' },
        { icon: 'check', text: 'Text messages welcome' }
      ]
    },
    busy: {
      icon: '✗',
      title: 'In Focus Mode',
      pageClass: 'busy',
      recommendations: [
        { icon: 'cross', text: 'Not a good time for calls' },
        { icon: 'maybe', text: 'Email for non-urgent things' },
        { icon: 'cross', text: 'Wait for status change' }
      ]
    },
    maybe: {
      icon: '~',
      title: 'Might Be Available',
      pageClass: 'maybe',
      recommendations: [
        { icon: 'maybe', text: 'Quick message might work' },
        { icon: 'check', text: 'Email is safe' },
        { icon: 'maybe', text: 'Call only if urgent' }
      ]
    },
    unknown: {
      icon: '?',
      title: 'Status Unknown',
      pageClass: 'unknown',
      recommendations: [
        { icon: 'maybe', text: 'Try sending an email' },
        { icon: 'maybe', text: 'Message and wait for response' },
        { icon: 'cross', text: 'Avoid calling without checking' }
      ]
    }
  };
  
  // Fetch availability (simulated - would be API call in production)
  async function fetchAvailability() {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In production, this would be: await fetch(`/api/availability/${username}`)
    // For demo, we use local state
    const availability = FRN.calculateAvailability();
    
    return {
      username: username,
      displayName: username.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      bio: 'Signal-driven availability',
      ...availability,
      lastUpdated: new Date().toISOString()
    };
  }
  
  // Render the status
  function renderStatus(data) {
    const config = statusConfig[data.status] || statusConfig.unknown;
    
    // Update page title
    document.title = `${data.displayName} is ${data.status} - Free Right Now`;
    
    // Update page class for background effect
    elements.statusPage.className = `status-page ${config.pageClass}`;
    
    // User info
    elements.statusAvatar.textContent = data.displayName.charAt(0).toUpperCase();
    elements.statusName.textContent = data.displayName;
    elements.statusBio.textContent = data.bio;
    
    // Status orb
    elements.statusOrbMain.className = `status-orb-large ${data.status}`;
    elements.statusIconMain.textContent = config.icon;
    
    // Status text
    elements.statusTextMain.textContent = config.title;
    elements.statusTextMain.className = `status-text-main ${data.status}`;
    elements.statusTextSub.textContent = data.message;
    
    // Confidence
    elements.confidenceFillMini.className = `confidence-bar-mini-fill ${data.status}`;
    elements.confidenceFillMini.style.width = `${data.confidence}%`;
    elements.confidenceTextMini.textContent = `${data.confidence}% confident`;
    
    // Recommendations
    elements.recommendationList.innerHTML = config.recommendations.map(rec => `
      <li>
        <span class="${rec.icon}">${rec.icon === 'check' ? '✓' : rec.icon === 'cross' ? '✗' : '~'}</span>
        ${rec.text}
      </li>
    `).join('');
    
    // Last updated
    elements.lastUpdated.textContent = FRN.formatRelativeTime(data.lastUpdated);
    
    // Show content
    elements.loadingState.style.display = 'none';
    elements.mainContent.style.display = 'block';
  }
  
  // Show error state
  function showError() {
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'block';
  }
  
  // Initialize
  async function init() {
    try {
      const data = await fetchAvailability();
      renderStatus(data);
      
      // Auto-refresh every 30 seconds
      setInterval(async () => {
        try {
          const freshData = await fetchAvailability();
          renderStatus(freshData);
        } catch (e) {
          console.warn('Failed to refresh status:', e);
        }
      }, 30000);
      
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      showError();
    }
  }
  
  init();
});
