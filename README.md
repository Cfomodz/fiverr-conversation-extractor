# Free Right Now

Free Right Now is a signal-driven availability web app that answers a simple question: are you free right now?
Instead of calendar links, it uses read-only signals (email activity, chat presence, phone unlocks, coding streaks)
to estimate availability and recommend the best channel to use.

## What this demo covers

- A live availability score with confidence
- Channel guidance for call, text, email, or async work
- A signal list that simulates real activity patterns
- Daily review feedback to teach the system your rules

## Run locally

Open `index.html` in your browser, or serve it with a local server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Project structure

- `index.html` - App layout and copy
- `styles.css` - Styling for the page
- `app.js` - Demo logic and interactions

## Notes

This is a front-end concept demo. Signals are simulated and no external services are called.
