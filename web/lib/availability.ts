import db from '@/lib/db';

type AvailabilityStatus = 'FREE' | 'BUSY' | 'UNCERTAIN';

interface Signal {
  type: string;
  payload: string; // JSON string
  timestamp: number;
}

export function calculateAvailability(userId: string): { status: AvailabilityStatus; confidence: number; reason: string } {
  // Get signals from the last 30 minutes
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  const signals = db.prepare('SELECT type, payload, timestamp FROM signals WHERE user_id = ? AND timestamp > ? ORDER BY timestamp ASC').all(userId, thirtyMinutesAgo) as Signal[];

  if (signals.length === 0) {
    return { status: 'UNCERTAIN', confidence: 0, reason: 'No recent data' };
  }

  let score = 0;
  let lastStrongSignal = '';

  for (const signal of signals) {
    const payload = JSON.parse(signal.payload || '{}');
    
    if (signal.type === 'heartbeat') {
      // Analyze active tab
      if (payload.active_tab) {
        if (payload.active_tab.includes('gmail.com') || payload.active_tab.includes('slack.com')) {
           score += 2; // Communication apps -> likely free
           lastStrongSignal = 'Checking communication apps';
        } else if (payload.active_tab.includes('github.com') || payload.active_tab.includes('vscode.dev') || payload.active_tab.includes('stackoverflow.com')) {
           score -= 2; // Dev tools -> likely busy
           lastStrongSignal = 'Coding / Researching';
        }
      }

      // Analyze idle state
      if (payload.idle_state === 'idle' || payload.idle_state === 'locked') {
        score -= 1; // Idle/Locked -> likely busy/away
      } else if (payload.idle_state === 'active') {
        // Active but not on specific sites... neutral?
        // Maybe slight positive if we assume active = reachable? 
        // But user said "pushing commits... haven't opened browser... -> busy".
        // So generic activity might be busy.
        // Let's rely on the URL for "Free" signal.
      }
    }
  }

  // Determine status
  if (score > 5) {
    return { status: 'FREE', confidence: Math.min(100, score * 5), reason: lastStrongSignal || 'Active on communication channels' };
  } else if (score < -5) {
    return { status: 'BUSY', confidence: Math.min(100, Math.abs(score) * 5), reason: lastStrongSignal || 'Deep work or Away' };
  } else {
    // In the middle
    return { status: score >= 0 ? 'FREE' : 'BUSY', confidence: 30, reason: 'Mixed signals' };
  }
}
