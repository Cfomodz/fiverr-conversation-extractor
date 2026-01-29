# Free Right Now

> Signal-driven availability - know when someone is free without interrupting them.

**Free Right Now** is an alternative to traditional calendar-based scheduling. Instead of asking "is now a good time?" or checking rigid calendar blocks, it learns from your digital activity signals to predict when you're actually available.

## The Concept

Traditional calendars tell people when you *might* be free. Free Right Now tells them when you *actually* are.

- **Checking Gmail?** Probably free for a call.
- **Pushing commits for 3 hours?** Deep in focus - don't interrupt.
- **Phone locked for 45 minutes?** Probably in a meeting or away.

The system watches your activity signals (read-only, privacy-first) and learns your patterns over time. Eventually, it predicts your availability like a personal assistant would - not because it has your calendar, but because it understands what you're actually doing.

## Features

- **Signal-Based Detection** - Availability based on actual activity, not calendar blocks
- **Learning System** - Gets smarter with every feedback response
- **Daily Review** - Confirm or correct predictions to improve accuracy
- **Privacy First** - Only sees activity patterns, never content
- **Confidence Scores** - Know how certain the prediction is
- **Shareable Status** - Give others a link to check your availability

## Screenshots

### Landing Page
Beautiful, modern landing page explaining the signal-driven concept.

### Dashboard
- Real-time status display with confidence scoring
- Signal feed showing recent activity
- Daily timeline for review and feedback
- Integration management
- Learning progress tracking

### Public Status Page
Clean, focused page showing someone's current availability status.

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript with modern CSS
- **Storage**: LocalStorage (demo) / would use database in production
- **Design**: Dark mode, gradient accents, smooth animations

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd free-right-now

# Install dependencies
npm install

# Start the server
npm start
```

The app will be running at `http://localhost:3000`

### Pages

- `/` - Landing page
- `/dashboard` - User dashboard (manage signals, integrations, review)
- `/u/username` - Public availability status page

## How It Works

### 1. Connect Your Stack
Link the tools you use daily:
- Email (Gmail, Outlook)
- Code (GitHub, VS Code)
- Communication (Slack, Discord)
- Browser activity
- Phone (iOS/Android)
- And more...

### 2. Signals Are Collected
The system watches for activity patterns:
- Email checks → likely free
- Code commits → deep work
- Browser activity → browsing
- Phone unlocked → available
- Screen idle → away

### 3. Predictions Form
Based on signal patterns and your feedback, the system learns:
- What activities mean you're interruptible
- What patterns indicate focus time
- Your personal rhythms and preferences

### 4. Share Your Status
Others can check your availability at your personal URL without having to ask you directly.

## Signal Types

### Free Signals
- `email_check` - Checking email
- `browser_active` - Active browsing
- `social_media` - On social media
- `chat_active` - Responding to messages

### Busy Signals
- `code_commit` - Pushing code
- `ide_active` - In code editor
- `long_typing` - Extended writing
- `meeting` - In a meeting
- `dnd_enabled` - Do Not Disturb on

### Away Signals
- `phone_locked` - Phone inactive
- `screen_off` - Computer idle
- `idle` - No activity

## API Endpoints

```
GET  /api/availability/:username  - Get user's current availability
POST /api/signals                 - Submit a new signal
GET  /api/signals/:username       - Get user's recent signals
POST /api/feedback                - Submit availability feedback
GET  /api/review/:username        - Get daily review data
```

## Privacy

Free Right Now is designed with privacy at its core:
- **Read-only integrations** - We never post, send, or modify anything
- **No content access** - We see "email was checked" not "what the email said"
- **Pattern-only analysis** - Activity timestamps, not actual data
- **User control** - Connect only what you want, disconnect anytime

## Future Roadmap

- [ ] OAuth integrations for real services
- [ ] Mobile apps (iOS/Android)
- [ ] Team/organization features
- [ ] Webhook support
- [ ] Calendar import (as signals, not restrictions)
- [ ] AI-powered pattern recognition
- [ ] Slack/Discord bots
- [ ] API for third-party integrations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Free Right Now** - Because your availability isn't about time slots. It's about what you're actually doing.
