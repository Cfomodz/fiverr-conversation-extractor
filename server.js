const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory storage (would be database in production)
const users = new Map();
const signals = new Map();
const availabilityHistory = new Map();

// API Routes

// Get user availability
app.get('/api/availability/:username', (req, res) => {
  const { username } = req.params;
  const userSignals = signals.get(username) || [];
  const availability = calculateAvailability(userSignals);
  
  res.json({
    username,
    availability,
    lastUpdated: new Date().toISOString(),
    confidence: availability.confidence,
    status: availability.status,
    message: availability.message
  });
});

// Submit a signal
app.post('/api/signals', (req, res) => {
  const { username, signalType, metadata } = req.body;
  
  if (!signals.has(username)) {
    signals.set(username, []);
  }
  
  const signal = {
    type: signalType,
    timestamp: new Date().toISOString(),
    metadata
  };
  
  signals.get(username).push(signal);
  
  // Keep only last 100 signals
  if (signals.get(username).length > 100) {
    signals.get(username).shift();
  }
  
  res.json({ success: true, signal });
});

// Get user's signals
app.get('/api/signals/:username', (req, res) => {
  const { username } = req.params;
  const userSignals = signals.get(username) || [];
  res.json({ signals: userSignals });
});

// Record availability feedback
app.post('/api/feedback', (req, res) => {
  const { username, timestamp, wasCorrect, actualStatus, notes } = req.body;
  
  if (!availabilityHistory.has(username)) {
    availabilityHistory.set(username, []);
  }
  
  availabilityHistory.get(username).push({
    timestamp,
    wasCorrect,
    actualStatus,
    notes,
    recordedAt: new Date().toISOString()
  });
  
  res.json({ success: true });
});

// Get daily review data
app.get('/api/review/:username', (req, res) => {
  const { username } = req.params;
  const userSignals = signals.get(username) || [];
  const history = availabilityHistory.get(username) || [];
  
  // Generate time blocks for the day
  const timeBlocks = generateTimeBlocks(userSignals);
  
  res.json({
    username,
    timeBlocks,
    history,
    accuracy: calculateAccuracy(history)
  });
});

// Calculate availability from signals
function calculateAvailability(userSignals) {
  if (userSignals.length === 0) {
    return {
      status: 'unknown',
      confidence: 0,
      message: "No signals yet - availability unknown"
    };
  }
  
  const now = Date.now();
  const recentSignals = userSignals.filter(s => {
    const signalTime = new Date(s.timestamp).getTime();
    return now - signalTime < 60 * 60 * 1000; // Last hour
  });
  
  if (recentSignals.length === 0) {
    return {
      status: 'unknown',
      confidence: 30,
      message: "No recent activity - might be away"
    };
  }
  
  // Score signals
  let freeScore = 0;
  let busyScore = 0;
  
  recentSignals.forEach(signal => {
    const age = (now - new Date(signal.timestamp).getTime()) / (60 * 1000); // minutes
    const recencyMultiplier = Math.max(0.1, 1 - (age / 60)); // Decay over an hour
    
    switch (signal.type) {
      // Signals that suggest free
      case 'email_check':
      case 'browser_active':
      case 'social_media':
      case 'chat_active':
        freeScore += 2 * recencyMultiplier;
        break;
      
      // Signals that suggest busy/focused
      case 'code_commit':
      case 'long_typing':
      case 'ide_active':
      case 'meeting':
        busyScore += 3 * recencyMultiplier;
        break;
      
      // Signals that suggest away
      case 'phone_locked':
      case 'screen_off':
      case 'idle':
        busyScore += 1 * recencyMultiplier;
        break;
      
      // Neutral
      default:
        freeScore += 0.5 * recencyMultiplier;
    }
  });
  
  const totalScore = freeScore + busyScore;
  const freeRatio = totalScore > 0 ? freeScore / totalScore : 0.5;
  
  let status, message;
  const confidence = Math.min(95, Math.round(50 + (recentSignals.length * 5)));
  
  if (freeRatio > 0.6) {
    status = 'free';
    message = "Looks available - good time to reach out!";
  } else if (freeRatio > 0.4) {
    status = 'maybe';
    message = "Might be available - try a quick message first";
  } else {
    status = 'busy';
    message = "Deep in focus mode - best to wait";
  }
  
  return { status, confidence, message, freeScore, busyScore };
}

// Generate time blocks for daily review
function generateTimeBlocks(userSignals) {
  const blocks = [];
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  for (let hour = 8; hour < 22; hour++) {
    const blockStart = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000);
    const blockEnd = new Date(blockStart.getTime() + 60 * 60 * 1000);
    
    const blockSignals = userSignals.filter(s => {
      const signalTime = new Date(s.timestamp);
      return signalTime >= blockStart && signalTime < blockEnd;
    });
    
    const availability = calculateAvailability(blockSignals);
    
    blocks.push({
      hour,
      startTime: blockStart.toISOString(),
      endTime: blockEnd.toISOString(),
      status: availability.status,
      confidence: availability.confidence,
      signalCount: blockSignals.length
    });
  }
  
  return blocks;
}

// Calculate accuracy from history
function calculateAccuracy(history) {
  if (history.length === 0) return null;
  
  const correct = history.filter(h => h.wasCorrect).length;
  return Math.round((correct / history.length) * 100);
}

// Serve main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/u/:username', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

app.listen(PORT, () => {
  console.log(`🟢 Free Right Now is running at http://localhost:${PORT}`);
});
