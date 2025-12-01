# Fiverr Conversation Extractor &nbsp;&nbsp; [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-☕-orange?style=for-the-badge)](https://www.buymeacoffee.com/ianwaithaka)

A Chrome extension that extracts and saves Fiverr inbox conversations with support for attachments, replies, and markdown export. Features include batch contact fetching, conversation downloading in both markdown and json formats.

![GitHub](https://img.shields.io/github/license/royal-crisis/fiverr-conversation-extractor)
![Chrome Web Store](https://img.shields.io/badge/Platform-Chrome-green)
![Tags](https://img.shields.io/badge/Tags-Chat%20Export%20%7C%20Message%20Backup%20%7C%20Conversation%20History-blue)

## Key Features

- 💬 Extract complete chat histories from Fiverr inbox
- 📥 Download conversations in clean Markdown and JSON formats
- 📱 View conversations in a dedicated tab interface
- 📎 Download all conversation attachments
- 📚 Track and organize conversation history
- 💌 Support for message replies and threading
- ⚡ Fast contact fetching

## Why Use This Extension?

- 🔒 **Secure Backup**: Keep your important client conversations safe and accessible
- 📊 **Better Organization**: Easily manage and search through past communications
- ⏱️ **Time Saver**: Quick export of conversations
- 📱 **Accessibility**: Access your conversations offline and across devices
- 🎯 **Freelancer Focused**: Specifically designed for Fiverr freelancers' needs

## Advanced Features

- 🔍 **Smart Search**: Find conversations by keyword, date, or client
- 📋 **Rich Text Support**: Preserves formatting, links, and emoji
- 🔄 **Auto-Sync**: Keep your conversation backups up to date
- 📊 **Analytics Ready**: Export in formats suitable for analysis
- 🎨 **Custom Formatting**: Choose how your exports look

## Download Organization

When you download any file from the extension:

- It will automatically create a folder with the contact's username.
- Attachments will be stored in an `attachments` subfolder.
- Conversation files (both markdown and JSON) will be stored in a `conversations` subfolder.
- All folders will be created automatically by Chrome if they don't exist.

The files will be organized like this:

```
[Downloads Directory]
└── [username]
    ├── attachments
    │   └── [attachment files]
    └── conversations
        ├── fiverr_conversation_[username]_[date].md
        └── [username]_conversation.json
```

This structure keeps all files related to a specific contact organized in their own directory, making it easier to manage multiple conversations and their associated files.

## Use Cases

- 💼 **Portfolio Building**: Extract successful project discussions
- 📝 **Documentation**: Keep records of project requirements
- ⚖️ **Dispute Resolution**: Maintain evidence of agreements
- 📈 **Business Analysis**: Track communication patterns
- 🎓 **Learning**: Review past successful interactions

## Keywords
`fiverr-chat-export` `fiverr-message-backup` `Fiverr-inbox-manager` `Fiverr productivity tool` `conversation-extractor` `chat-history-tool` `fiverr-inbox-manager` `freelancer-tools` `client-communication-backup` `message-archiver` `chat-downloader` `fiverr-extension`

## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Open your Fiverr inbox
2. Click the extension icon
3. Either:
   - Click "Fetch All Contacts" to see all your conversations
   - Click "Extract Conversation" when viewing a specific conversation
4. Use the download button (📥) to save the conversation
5. Use the view button (📄) to open the conversation in a new tab
6. Click attachment buttons to download specific files

## Preview

Here's how the extension looks:

![Extension Preview](images/extension-preview.png)

Example contact format:
```
joykent838 (13/11/2024)
```

For the complete extension UI mockup, see [Extension UI Design](docs/final-popup-mockup.html)

## Permissions

- `activeTab`: To interact with Fiverr tabs
- `storage`: To store conversation data
- `scripting`: To inject content scripts
- `downloads`: To save conversations and attachments
- `tabs`: To open conversations in new tabs

## Technical Details

### Supported Features
- Message threading and reply chains
- Attachment handling (images, documents, etc.)
- Markdown conversion
- HTML export options
- JSON data format
- Error handling and retry mechanisms

### Performance
- Lightweight (<2MB memory usage)
- Fast contact fetching
- Efficient storage management
- Minimal CPU usage
- Quick search capabilities

## Future Updates

- 📱 Mobile version support
- 🌐 Multi-language support
- 📊 Advanced analytics dashboard
- 🔄 Real-time sync capabilities
- 🤖 AI-powered conversation insights
- 📦 Bulk export features (coming soon)

## Development

The extension uses:
- Manifest V3
- Chrome Extension APIs
- Modern JavaScript (ES6+)
- Markdown for conversation export

## Support My Work

<div align="center">
  
  [!["Buy Me A Coffee"](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/ianwaithaka)
  
  <p>If you find this project helpful, consider buying me a coffee! ☕️</p>
  
  <a href="https://www.buymeacoffee.com/ianwaithaka">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="200">
  </a>
</div>

## License

MIT License
