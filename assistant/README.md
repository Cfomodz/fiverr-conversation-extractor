# Fiverr Project Assistant

An AI-powered assistant that learns from your Fiverr conversations and helps you respond to freelancers efficiently. Uses DeepSeek or Gemini for LLM capabilities with a simple JSON-based knowledge system.

## Features

- 🤖 **AI-Powered Responses**: Generate contextual responses based on learned Q&A pairs
- 📚 **Learning System**: Automatically extracts and stores Q&A from conversations
- 🔍 **Semantic Search**: Finds relevant knowledge using TF-IDF based search
- 🎯 **Scope Detection**: Automatically identifies relevant conversations after 20 entries
- 🚫 **Ignore List**: Tracks users whose messages should be ignored
- 📊 **Message Tracking**: Avoids reprocessing already-learned conversations

## Quick Start

### 1. Install Dependencies

```bash
cd assistant
npm install
```

### 2. Configure API Keys

```bash
# Copy the example config
cp config.example.json config.json

# Edit config.json with your API keys
```

Edit `config.json`:
```json
{
  "llm": {
    "provider": "deepseek",  // or "gemini"
    "deepseek": {
      "apiKey": "YOUR_DEEPSEEK_API_KEY",
      "model": "deepseek-chat",
      "baseUrl": "https://api.deepseek.com/v1"
    },
    "gemini": {
      "apiKey": "YOUR_GEMINI_API_KEY",
      "model": "gemini-2.0-flash-exp"
    }
  },
  "project": {
    "name": "My Project",
    "description": "Brief description of your project",
    "keywords": ["web", "development", "react"]
  }
}
```

### 3. Export Conversations from Fiverr

Use the Chrome extension to export conversations:
1. Open Fiverr inbox
2. Click the extension icon
3. Use "Bulk Export Conversations" to export all chats as JSON

### 4. Process Conversations to Learn

```bash
# Process a single conversation
node cli.js process ./path/to/conversation.json

# Process all conversations in a directory
node cli.js process ~/Downloads/fiverr-conversations/

# Dry run (preview without saving)
node cli.js process ./conversation.json --dry-run
```

### 5. Get Response Suggestions

```bash
# Generate a suggested response for a conversation
node cli.js suggest ./path/to/conversation.json
```

## CLI Commands

### Stats
Show knowledge base statistics:
```bash
node cli.js stats
```

### List Entries
List all Q&A entries in the knowledge base:
```bash
node cli.js list
node cli.js list --limit 50
node cli.js list --search "payment"
```

### Add Entry
Manually add a Q&A entry:
```bash
node cli.js add
```

### Process Conversations
Process conversations to extract and learn Q&A pairs:
```bash
# Single file
node cli.js process ./conversation.json

# Directory (recursive)
node cli.js process ./conversations/

# Force scope (skip auto-detection)
node cli.js process ./conversations/ --in-scope
node cli.js process ./conversations/ --out-of-scope

# Preview mode
node cli.js process ./conversations/ --dry-run
```

### Suggest Response
Generate a suggested response based on learned knowledge:
```bash
node cli.js suggest ./conversation.json
```

### Search Knowledge Base
Search for relevant Q&A pairs:
```bash
node cli.js search "what is the timeline"
node cli.js search "payment terms" --top-k 10
```

### Manage Ignored Users
View and manage the ignored users list:
```bash
# View all ignored users
node cli.js ignored

# Remove a user from ignored list
node cli.js ignored --remove username123
```

### Delete Entry
Delete a knowledge base entry by ID:
```bash
node cli.js delete qa_1234567890_abc123def
```

## How It Works

### Learning Process

1. **Export**: Use the Chrome extension to export Fiverr conversations as JSON
2. **Process**: The assistant extracts Q&A pairs using the LLM
3. **Deduplicate**: Checks for semantic duplicates before adding
4. **Store**: Saves unique Q&A pairs to the knowledge base

### Scope Detection

- **Manual**: For the first 20 entries, you'll be asked if each conversation is in scope
- **Automatic**: After 20 entries, the LLM automatically determines if conversations are relevant
- **Ignore List**: Out-of-scope users are added to an ignore list for future filtering

### Response Generation

1. Takes the last message from a conversation
2. Searches knowledge base for relevant Q&A pairs (top 5-7)
3. Uses LLM to generate a contextual response
4. Includes project context from config

## Data Files

All data is stored in `assistant/data/`:

- `knowledge_base.json` - Q&A pairs
- `processed_messages.json` - Tracked message IDs
- `ignored_users.json` - Users to skip
- `scoped_conversations.json` - Scope determinations

## Configuration Options

```json
{
  "llm": {
    "provider": "deepseek"  // "deepseek" or "gemini"
  },
  "search": {
    "topK": 7,           // Number of relevant Q&A to retrieve
    "minScore": 0.1      // Minimum similarity score
  },
  "learning": {
    "autoScopeThreshold": 20,  // Entries before auto-scope
    "topKForScopeCheck": 20    // Q&A used for scope detection
  },
  "project": {
    "name": "Project Name",
    "description": "Helps LLM understand context",
    "keywords": ["relevant", "keywords"]
  }
}
```

## Workflow Example

```bash
# 1. Initialize config
node cli.js init

# 2. Edit config.json with your API keys and project details

# 3. Export conversations using the Chrome extension

# 4. Process your conversations
node cli.js process ~/Downloads/fiverr-conversations/

# 5. When prompted, mark conversations as in-scope (Y) or out-of-scope (N)

# 6. Check your knowledge base
node cli.js stats
node cli.js list

# 7. When a new message comes in, get a suggested response
node cli.js suggest ~/Downloads/fiverr-conversations/freelancer123/freelancer123.json

# 8. The assistant will show:
#    - The last message from the freelancer
#    - Relevant Q&A from your knowledge base
#    - A suggested response you can copy/paste
```

## Tips

1. **Start with representative conversations**: Process your best conversations first to build a quality knowledge base

2. **Be accurate with scope**: The first 20 scope decisions train the auto-detection

3. **Review suggestions**: Always review and adapt suggested responses before sending

4. **Add manual entries**: Use `node cli.js add` to add important Q&A that wasn't in conversations

5. **Keep your project description updated**: A good project description improves response quality
