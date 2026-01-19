// Keep track of active tabs with content scripts
let activeTabsWithContentScript = new Set();

// Track ongoing processes
let ongoingProcesses = {
    contacts: new Map(),  // tabId -> status
    conversations: new Map(),  // tabId -> status
    bulkExport: {
        status: null,
        progress: 0,
        total: 0,
        completed: 0,
        failed: 0,
        message: '',
        startTime: null,
        timestamp: null
    }
};

// Load LLM helper utilities for assistant features.
try {
  importScripts('llm_utils.js');
} catch (error) {
  console.warn('Failed to load llm_utils.js:', error);
}

// ========== ADDED FUNCTIONS FROM CONTENT.JS ==========

// Function to extract username from URL
function extractUsername(url) {
  // Only extract username from specific inbox URL format
  const match = url.match(/^https:\/\/www\.fiverr\.com\/inbox\/([^\/\?]+)$/);
  return match ? match[1] : null;
}

// Helper function to format date according to user preference
async function formatDate(timestamp) {
  const date = new Date(parseInt(timestamp));
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  
  // Get user's preferred format from storage, default to DD/MM/YYYY
  return new Promise((resolve) => {
    chrome.storage.local.get(['dateFormat'], function(result) {
      const format = result.dateFormat || 'DD/MM/YYYY';
      
      let dateStr;
      switch(format) {
        case 'MM/DD/YYYY':
          dateStr = `${month}/${day}/${year}`;
          break;
        case 'YYYY/MM/DD':
          dateStr = `${year}/${month}/${day}`;
          break;
        case 'DD-MM-YYYY':
          dateStr = `${day}-${month}-${year}`;
          break;
        default: // DD/MM/YYYY
          dateStr = `${day}/${month}/${year}`;
      }
      
      resolve(`${dateStr}, ${time}`);
    });
  });
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return 'size unknown';
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Function to convert conversation to markdown for background processing
async function convertToMarkdownBg(data) {
  // Get the other user's username from the first message
  let otherUsername = '';
  if (data.messages && data.messages.length > 0) {
    // First try to use the username from URL/extraction command
    if (data.currentUsername) {
      otherUsername = data.currentUsername;
    } else {
      // Get usernames from the first message
      const firstMessage = data.messages[0];
      const sender = firstMessage.sender;
      const recipient = firstMessage.recipient;
      
      // If we have both sender and recipient, determine which one is not the current user
      if (sender && recipient) {
        // Check if data.username is set and is one of the participants
        if (data.username) {
          otherUsername = data.username === sender ? recipient : sender;
        } else {
          // If we can't determine, just use the other user from the first message
          // Typically, if you're viewing a conversation, you're the recipient of the first message
          otherUsername = sender;
        }
      } else {
        // Fallback to whatever username we can find
        otherUsername = recipient || sender || 'unknown';
      }
    }
  }

  let markdown = `# Conversation with ${otherUsername}\n\n`;
  
  // Process messages sequentially to maintain order
  for (const message of data.messages) {
    // Convert Unix timestamp to formatted date using user's preferred format
    const timestamp = await formatDate(message.createdAt);
    const sender = message.sender || 'Unknown';
    
    markdown += `### ${sender} (${timestamp})\n`;
    
    // Show replied-to message if exists
    if (message.repliedToMessage) {
      const repliedMsg = message.repliedToMessage;
      const repliedTime = await formatDate(repliedMsg.createdAt);
      markdown += `> Replying to ${repliedMsg.sender} (${repliedTime}):\n`;
      markdown += `> ${repliedMsg.body.replace(/\n/g, '\n> ')}\n\n`;
    }
    
    // Add message text
    if (message.body) {
      markdown += `${message.body}\n`;
    }
    
    // Add attachments if any
    if (message.attachments && message.attachments.length > 0) {
      markdown += '\n**Attachments:**\n';
      for (const attachment of message.attachments) {
        // Check if attachment has required fields
        if (attachment && typeof attachment === 'object') {
          const fileName = attachment.file_name || attachment.filename || 'Unnamed File';
          const fileSize = attachment.file_size || attachment.fileSize || 0;
          const attachmentTime = attachment.created_at ? ` (uploaded on ${await formatDate(attachment.created_at)})` : '';
          markdown += `- ${fileName} (${formatFileSize(fileSize)})${attachmentTime}\n`;
        } else {
          markdown += `- File attachment (size unknown)\n`;
        }
      }
    }
    
    markdown += '\n---\n\n';
  }
  
  return markdown;
}

// Function to convert conversation data to HTML
async function convertToHtmlBg(data) {
  if (!data || !data.messages) {
    return '<html><body><h1>No conversation data available</h1></body></html>';
  }

  // Get the other user's username from the first message using the same logic as markdown
  let otherUsername = '';
  if (data.messages.length > 0) {
    // First try to use the username from URL/extraction command
    if (data.currentUsername) {
      otherUsername = data.currentUsername;
    } else {
      // Get usernames from the first message
      const firstMessage = data.messages[0];
      const sender = firstMessage.sender;
      const recipient = firstMessage.recipient;
      
      // If we have both sender and recipient, determine which one is not the current user
      if (sender && recipient) {
        // Check if data.username is set and is one of the participants
        if (data.username) {
          otherUsername = data.username === sender ? recipient : sender;
        } else {
          // If we can't determine, just use the other user from the first message
          // Typically, if you're viewing a conversation, you're the recipient of the first message
          otherUsername = sender;
        }
      } else {
        // Fallback to whatever username we can find
        otherUsername = recipient || sender || 'unknown';
      }
    }
  }

  // Start building HTML with CSS styles
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversation with ${otherUsername}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    h1 {
      color: #1dbf73;
      text-align: center;
      padding-bottom: 10px;
      border-bottom: 2px solid #eee;
      margin-bottom: 30px;
    }
    .message-container {
      margin-bottom: 25px;
      clear: both;
    }
    .message {
      padding: 15px;
      border-radius: 10px;
      max-width: 80%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      position: relative;
    }
    .sender-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 14px;
      color: #666;
    }
    .sender-name {
      font-weight: bold;
      color: #1976d2;
    }
    .timestamp {
      color: #999;
    }
    .message-text {
      white-space: pre-wrap;
      word-break: break-word;
    }
    .sent {
      float: right;
      background-color: #e3f2fd;
      border: 1px solid #bbdefb;
    }
    .received {
      float: left;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
    }
    .attachments {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(0,0,0,0.1);
    }
    .attachment {
      background-color: rgba(0,0,0,0.05);
      padding: 8px;
      border-radius: 5px;
      margin-bottom: 5px;
      font-size: 14px;
      display: flex;
      align-items: center;
    }
    .attachment-icon {
      margin-right: 8px;
      color: #1976d2;
    }
    .replied-message {
      background-color: rgba(0,0,0,0.05);
      border-left: 3px solid #1976d2;
      padding: 8px;
      margin-bottom: 10px;
      border-radius: 0 5px 5px 0;
      font-size: 14px;
    }
    .replied-name {
      font-weight: bold;
      color: #555;
    }
    .replied-text {
      color: #666;
    }
    .clearfix::after {
      content: "";
      clear: both;
      display: table;
    }
    .date-divider {
      text-align: center;
      margin: 30px 0;
      position: relative;
    }
    .date-divider::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background-color: #e0e0e0;
      z-index: -1;
    }
    .date-text {
      background-color: #f9f9f9;
      padding: 0 15px;
      color: #999;
      font-size: 14px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <h1>Conversation with ${otherUsername}</h1>`;

  let currentDate = null;
  
  // Process messages
  for (const message of data.messages) {
    // Check if we need to add a date divider
    const messageDate = new Date(parseInt(message.createdAt)).toDateString();
    if (messageDate !== currentDate) {
      html += `
  <div class="date-divider">
    <span class="date-text">${messageDate}</span>
  </div>`;
      currentDate = messageDate;
    }

    // Format timestamp
    const formattedTime = await formatDate(message.createdAt);
    
    // Determine message position: always show contact (otherUsername) on the left
    // If the sender is the contact, it should be "received" (left), otherwise "sent" (right)
    const messageType = message.sender === otherUsername ? 'received' : 'sent';
    
    // Start message container
    html += `
  <div class="message-container clearfix">
    <div class="message ${messageType}">
      <div class="sender-info">
        <span class="sender-name">${message.sender}</span>
        <span class="timestamp">${formattedTime}</span>
      </div>`;
    
    // Add replied-to message if it exists
    if (message.repliedToMessage) {
      const repliedMsg = message.repliedToMessage;
      const repliedTime = await formatDate(repliedMsg.createdAt);
      html += `
      <div class="replied-message">
        <div class="replied-name">${repliedMsg.sender} (${repliedTime}):</div>
        <div class="replied-text">${repliedMsg.body}</div>
      </div>`;
    }
    
    // Add message body
    html += `
      <div class="message-text">${message.body || ''}</div>`;
    
    // Add attachments if any
    if (message.attachments && message.attachments.length > 0) {
      html += `
      <div class="attachments">`;
      for (const attachment of message.attachments) {
        if (attachment) {
          const fileName = attachment.filename || attachment.file_name || 'Unnamed File';
          const fileSize = formatFileSize(attachment.fileSize || attachment.file_size || 0);
          const attachmentTime = attachment.created_at ? ` (uploaded on ${await formatDate(attachment.created_at)})` : '';
          html += `
        <div class="attachment">
          <span class="attachment-icon">📎</span>
          ${fileName} (${fileSize})${attachmentTime}
        </div>`;
        }
      }
      html += `
      </div>`;
    }
    
    // Close message container
    html += `
    </div>
  </div>`;
  }
  
  // Close HTML document
  html += `
</body>
</html>`;

  return html;
}

// Function to fetch all contacts recursively in background
async function fetchAllContactsBg(tabId) {
  let allContacts = [];
  let oldestTimestamp = null;
  let batchNumber = 1;
  let totalContactsEstimate = 0;
  
  // Update process tracking
  ongoingProcesses.contacts.set(tabId, {
    status: 'running',
    progress: 'Starting contacts fetch...',
    timestamp: Date.now()
  });
  
  // Clear existing contacts at the start of fetch
  chrome.storage.local.set({ 
    allContacts: [],
    lastContactsFetch: Date.now()
  });
  
  async function fetchContactsBatch(olderThan = null) {
    try {
      const url = olderThan 
        ? `https://www.fiverr.com/inbox/contacts?older_than=${olderThan}`
        : 'https://www.fiverr.com/inbox/contacts';
      
      console.log(`Fetching batch ${batchNumber}...`);
      
      // Update status in background
      ongoingProcesses.contacts.set(tabId, {
        status: 'running',
        progress: `Fetching batch ${batchNumber}...`,
        batch: batchNumber,
        percentComplete: estimatePercentComplete(allContacts.length, totalContactsEstimate),
        timestamp: Date.now()
      });
      
      // Send progress update
      chrome.runtime.sendMessage({
        type: 'CONTACTS_PROGRESS',
        message: `Fetching batch ${batchNumber}...`,
        batch: batchNumber,
        percentComplete: estimatePercentComplete(allContacts.length, totalContactsEstimate)
      });

      // Use executeScript to fetch from the tab's context
      const fetchResult = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: async (url) => {
          try {
            const response = await fetch(url, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });
            
            if (!response.ok) {
              throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
          } catch (error) {
            return { error: error.message };
          }
        },
        args: [url]
      });

      // Check for errors
      if (!fetchResult || fetchResult[0].result.error) {
        throw new Error(fetchResult[0].result.error || 'Failed to fetch contacts');
      }

      const contacts = fetchResult[0].result;
      
      if (!contacts || contacts.length === 0) {
        console.log('No more contacts found.');
        
        // Update status
        ongoingProcesses.contacts.set(tabId, {
          status: 'running',
          progress: 'No more contacts found.',
          percentComplete: 100,
          timestamp: Date.now()
        });
        
        // Send progress update
        chrome.runtime.sendMessage({
          type: 'CONTACTS_PROGRESS',
          message: 'No more contacts found.',
          percentComplete: 100
        });
        
        return null;
      }
      
      // Add contacts to our collection
      allContacts = [...allContacts, ...contacts];
      
      // Update our estimate of total contacts after first batch
      if (batchNumber === 1) {
        // Roughly estimate based on first batch size and a typical pattern
        totalContactsEstimate = contacts.length * 3; 
      } else if (contacts.length < 20) {
        // If we get a small batch, we're likely near the end
        totalContactsEstimate = allContacts.length + Math.floor(contacts.length / 2);
      }
      
      // Update storage with current total
      chrome.storage.local.set({ 
        allContacts: allContacts,
        lastContactsFetch: Date.now()
      });
      
      // Find the oldest timestamp
      const timestamps = contacts.map(c => c.recentMessageDate);
      oldestTimestamp = Math.min(...timestamps);
      
      console.log(`Batch ${batchNumber}: Found ${contacts.length} contacts (Total: ${allContacts.length})`);
      
      // Update status
      ongoingProcesses.contacts.set(tabId, {
        status: 'running',
        progress: `Batch ${batchNumber}: Found ${contacts.length} contacts (Total: ${allContacts.length})`,
        totalContacts: allContacts.length,
        batch: batchNumber,
        batchSize: contacts.length,
        percentComplete: estimatePercentComplete(allContacts.length, totalContactsEstimate),
        timestamp: Date.now()
      });
      
      // Send progress update
      chrome.runtime.sendMessage({
        type: 'CONTACTS_PROGRESS',
        message: `Batch ${batchNumber}: Found ${contacts.length} contacts (Total: ${allContacts.length})`,
        totalContacts: allContacts.length,
        batch: batchNumber,
        batchSize: contacts.length,
        percentComplete: estimatePercentComplete(allContacts.length, totalContactsEstimate)
      });

      batchNumber++;
      return oldestTimestamp;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      
      // Update status
      ongoingProcesses.contacts.set(tabId, {
        status: 'error',
        error: error.message,
        progress: `Error in batch ${batchNumber}: ${error.message}`,
        timestamp: Date.now()
      });
      
      // Send progress update
      chrome.runtime.sendMessage({
        type: 'CONTACTS_PROGRESS',
        message: `Error in batch ${batchNumber}: ${error.message}`,
        isError: true
      });
      
      return null;
    }
  }
  
  // Helper to estimate completion percentage
  function estimatePercentComplete(currentCount, estimatedTotal) {
    if (estimatedTotal <= 0) return 10; // Default to 10% if we don't have an estimate yet
    const percent = Math.floor((currentCount / estimatedTotal) * 100);
    return Math.min(99, percent); // Cap at 99% until we're truly done
  }
  
  // First batch
  let nextTimestamp = await fetchContactsBatch();
  
  // Keep fetching while we have older messages
  while (nextTimestamp) {
    // Add a small delay to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
    nextTimestamp = await fetchContactsBatch(nextTimestamp);
  }

  // Update final status
  ongoingProcesses.contacts.set(tabId, {
    status: 'completed',
    message: `Completed! Total contacts found: ${allContacts.length}`,
    timestamp: Date.now()
  });

  // Send final results
  chrome.runtime.sendMessage({
    type: 'CONTACTS_FETCHED',
    data: allContacts,
    message: `Completed! Total contacts found: ${allContacts.length}`
  });
  
  return allContacts;
}

// Function to fetch conversation data with pagination in background
async function fetchConversationBg(username, tabId) {
  try {
    console.log(`fetchConversationBg started for ${username}`);
    
    // Update process tracking
    ongoingProcesses.conversations.set(tabId, {
      status: 'running',
      progress: `Starting conversation extraction for ${username}...`,
      timestamp: Date.now()
    });
    
    let allMessages = [];
    let lastPage = false;
    let timestamp = null;
    let batchNumber = 1;
    let conversationId = null;
    let totalBatchesEstimate = 5; // Initial estimate

    while (!lastPage) {
      // Update status
      ongoingProcesses.conversations.set(tabId, {
        status: 'running',
        progress: `Fetching message batch ${batchNumber}...`,
        percentComplete: Math.min(95, Math.round((batchNumber / totalBatchesEstimate) * 100)),
        currentBatch: batchNumber,
        estimatedTotalBatches: totalBatchesEstimate,
        timestamp: Date.now()
      });
      
      // Send progress update
      chrome.runtime.sendMessage({
        type: 'EXTRACTION_PROGRESS',
        message: `Fetching message batch ${batchNumber}...`,
        percentComplete: Math.min(95, Math.round((batchNumber / totalBatchesEstimate) * 100)),
        currentBatch: batchNumber,
        estimatedTotalBatches: totalBatchesEstimate
      });

      // Build URL with timestamp if not first batch
      const url = timestamp 
        ? `https://www.fiverr.com/inbox/contacts/${username}/conversation?timestamp=${timestamp}`
        : `https://www.fiverr.com/inbox/contacts/${username}/conversation`;

      console.log(`Fetching from URL: ${url}`);
      
      // Use executeScript to fetch from the tab's context
      const fetchResult = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: async (url) => {
          try {
            const response = await fetch(url, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });
            
            if (!response.ok) {
              throw new Error(`Failed to fetch conversation: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
          } catch (error) {
            return { error: error.message };
          }
        },
        args: [url]
      });

      // Check for errors
      if (!fetchResult || fetchResult[0].result.error) {
        throw new Error(fetchResult[0].result.error || 'Failed to fetch conversation');
      }

      const data = fetchResult[0].result;
      
      console.log(`Received batch ${batchNumber} with ${data.messages ? data.messages.length : 0} messages`);
      
      // Store conversation ID from first batch
      if (!conversationId) {
        conversationId = data.conversationId;
      }

      // Adjust our total batches estimate based on first batch response
      if (batchNumber === 1 && data.messages && data.messages.length > 0) {
        // Estimate based on typical message count
        const messagesPerBatch = data.messages.length;
        // Check if data has information about total message count
        if (data.totalMessages && data.totalMessages > 0) {
          totalBatchesEstimate = Math.ceil(data.totalMessages / messagesPerBatch);
        } else {
          // Make a guess based on first batch size
          totalBatchesEstimate = Math.max(5, Math.ceil(messagesPerBatch * 3 / messagesPerBatch));
        }
      }

      // Process messages in this batch
      const processedMessages = await Promise.all((data.messages || []).map(async message => ({
        ...message,
        formattedTime: await formatDate(message.createdAt),
        attachments: await Promise.all((message.attachments || []).map(async attachment => ({
          filename: attachment.file_name,
          downloadUrl: attachment.download_url,
          fileSize: attachment.file_size,
          contentType: attachment.content_type,
          created_at: attachment.created_at || message.createdAt,
          formattedTime: await formatDate(attachment.created_at || message.createdAt)
        }))),
        repliedToMessage: message.repliedToMessage ? {
          ...message.repliedToMessage,
          formattedTime: await formatDate(message.repliedToMessage.createdAt)
        } : null
      })));

      // Add messages to our collection
      allMessages = [...allMessages, ...processedMessages];

      // Update lastPage status
      lastPage = data.lastPage;

      // If not last page, get timestamp for next batch
      if (!lastPage && processedMessages.length > 0) {
        // Use the oldest message's timestamp for next batch
        timestamp = Math.min(...processedMessages.map(m => m.createdAt));
      }

      // Increment batch number
      batchNumber++;

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Create final processed data
    const processedData = {
      username: username,
      currentUsername: username,
      conversationId: conversationId,
      messages: allMessages.sort((a, b) => a.createdAt - b.createdAt)
    };

    console.log(`Conversation fetched for ${username} with ${processedData.messages.length} messages`);

    // Generate markdown for display
    const markdown = await convertToMarkdownBg(processedData);

    // Store the complete conversation data
    chrome.storage.local.set({ 
      conversationData: processedData,
      markdownContent: markdown,
      jsonContent: processedData
    });

    // Update status as completed
    ongoingProcesses.conversations.set(tabId, {
      status: 'completed',
      message: `Conversation with ${username} extracted successfully!`,
      timestamp: Date.now()
    });

    // Notify popup about completion with username
    chrome.runtime.sendMessage({
      type: 'CONVERSATION_EXTRACTED',
      data: processedData,
      message: `Conversation with ${username} extracted successfully!`
    });

    // Return the processed data for the bulk export
    return processedData;

  } catch (error) {
    console.error('Error fetching conversation:', error);
    
    // Update status as error
    ongoingProcesses.conversations.set(tabId, {
      status: 'error',
      error: error.message,
      timestamp: Date.now()
    });
    
    // Send error message
    chrome.runtime.sendMessage({
      type: 'EXTRACTION_ERROR',
      error: error.message
    });
    
    throw error; // Re-throw the error so it can be caught by the caller
  }
}

// ========== END OF ADDED FUNCTIONS ==========

// Listen for navigation to Fiverr pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('fiverr.com')) {
    console.log(`Injecting content script into tab ${tabId}`);
    // Inject content script
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).then(() => {
      activeTabsWithContentScript.add(tabId);
      console.log(`Content script injected into tab ${tabId}`);
    }).catch(err => console.error('Failed to inject content script:', err));
  }
});

// Remove tab from tracking when closed
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabsWithContentScript.delete(tabId);
  ongoingProcesses.contacts.delete(tabId);
  ongoingProcesses.conversations.delete(tabId);
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request.type);
  const tabId = sender.tab ? sender.tab.id : (request.tabId || null);

  // Handle FETCH_CONVERSATION_FOR_EXPORT_RESPONSE from content script (keeping for backward compatibility)
  if (request.type === 'FETCH_CONVERSATION_FOR_EXPORT_RESPONSE') {
    console.log('Received export response from content script (legacy mode):', request);
    
    // Forward the response to the popup (in case it's still open)
    chrome.runtime.sendMessage(request);
    return true;
  }

  // Handle START_BULK_EXPORT request from popup
  if (request.type === 'START_BULK_EXPORT') {
    console.log('Starting bulk export process:', request);
    
    // Initialize the bulk export state
    ongoingProcesses.bulkExport = {
      status: 'running',
      progress: 0,
      total: request.contacts.length,
      completed: 0,
      failed: 0,
      current: null,
      message: 'Starting bulk export...',
      contacts: request.contacts,
      format: request.format,
      includeAttachments: request.includeAttachments,
      conversations: [],
      startTime: Date.now(),
      timestamp: Date.now(),
      tabId: request.tabId
    };
    
    // Start the bulk export process
    startBulkExportProcess(request.tabId);
    
    // Send immediate response
    sendResponse({ success: true, message: 'Bulk export started' });
    return true;
  }

  // Handle GET_BULK_EXPORT_STATUS request from popup
  if (request.type === 'GET_BULK_EXPORT_STATUS') {
    console.log('Sending bulk export status to popup');
    sendResponse(ongoingProcesses.bulkExport);
    return true;
  }

  if (request.type === 'INIT_POPUP') {
    // Inject content script when popup is opened
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (tab.url.includes('fiverr.com')) {
        try {
          console.log(`Injecting content script into active tab ${tab.id}`);
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          console.log(`Content script injected into active tab ${tab.id}`);
        } catch (error) {
          console.error('Failed to inject content script:', error);
        }
      }
    });
  }

  // Track process status updates
  else if (request.type === 'CONTACTS_PROGRESS' || request.type === 'EXTRACTION_PROGRESS') {
    if (tabId) {
      const processType = request.type === 'CONTACTS_PROGRESS' ? 'contacts' : 'conversations';
      ongoingProcesses[processType].set(tabId, {
        status: 'running',
        progress: request.message,
        timestamp: Date.now()
      });
    }
  }
  // Handle process completion
  else if (request.type === 'CONTACTS_FETCHED' || request.type === 'CONVERSATION_EXTRACTED') {
    if (tabId) {
      const processType = request.type === 'CONTACTS_FETCHED' ? 'contacts' : 'conversations';
      ongoingProcesses[processType].set(tabId, {
        status: 'completed',
        message: request.message,
        timestamp: Date.now()
      });
    }
  }
  // Handle errors
  else if (request.type === 'EXTRACTION_ERROR') {
    if (tabId) {
      ongoingProcesses.conversations.set(tabId, {
        status: 'error',
        error: request.error,
        timestamp: Date.now()
      });
    }
  }
  // Handle popup requesting status
  else if (request.type === 'GET_PROCESS_STATUS') {
    if (tabId) {
      const status = {
        contacts: ongoingProcesses.contacts.get(tabId),
        conversations: ongoingProcesses.conversations.get(tabId)
      };
      sendResponse(status);
      return true; // Keep message channel open for async response
    }
  }
  // Forward process requests to content script
  else if (['EXTRACT_CONVERSATION', 'FETCH_ALL_CONTACTS', 'FETCH_CONVERSATION_FOR_EXPORT'].includes(request.type)) {
    console.log(`Processing ${request.type} request in background`);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url && tab.url.includes('fiverr.com')) {
        // Handle different request types
        if (request.type === 'EXTRACT_CONVERSATION') {
          // Get username from storage
          chrome.storage.local.get(['currentUsername'], function(result) {
            if (result.currentUsername) {
              // Call our background function instead of forwarding to content script
              fetchConversationBg(result.currentUsername, tab.id);
            } else {
              // Update status with error
              ongoingProcesses.conversations.set(tab.id, {
                status: 'error',
                error: 'No username found for conversation extraction.',
          timestamp: Date.now()
        });
        
              // Send error message
              chrome.runtime.sendMessage({
                type: 'EXTRACTION_ERROR',
                error: 'No username found for conversation extraction.'
              });
      }
    });
  }
        else if (request.type === 'FETCH_ALL_CONTACTS') {
          // Call our background function instead of forwarding to content script
          fetchAllContactsBg(tab.id);
        }
        else if (request.type === 'FETCH_CONVERSATION_FOR_EXPORT') {
          // For individual message export requests (outside bulk export)
          // we'll handle them using our background function now
          if (request.username) {
            console.log(`Processing conversation export for ${request.username} in background`);
            try {
              fetchConversationBg(request.username, tab.id)
                .then(data => {
                  sendResponse({
                    success: true,
                    username: request.username,
                    data: data,
                    status: 'completed'
                  });
                })
                .catch(error => {
                  console.error(`Error fetching conversation for ${request.username}:`, error);
                  sendResponse({
                    success: false,
                    username: request.username,
                    error: error.message || 'Unknown error'
                  });
                });
            } catch (error) {
              console.error(`Error initiating conversation fetch for ${request.username}:`, error);
              sendResponse({
                success: false,
                username: request.username,
                error: error.message || 'Unknown error'
              });
            }
          } else {
            console.error('No username provided for FETCH_CONVERSATION_FOR_EXPORT');
            sendResponse({
              success: false,
              message: 'No username provided'
            });
          }
          
          // Return true to indicate we'll send a response asynchronously
          return true;
        }
      } else {
        console.error('No active Fiverr tab found');
        
        if (request.type === 'FETCH_ALL_CONTACTS') {
          chrome.runtime.sendMessage({
            type: 'CONTACTS_PROGRESS',
            message: 'No active Fiverr tab found. Please open Fiverr in a tab.',
            isError: true
          });
        } 
        else if (request.type === 'EXTRACT_CONVERSATION') {
          chrome.runtime.sendMessage({
            type: 'EXTRACTION_ERROR',
            error: 'No active Fiverr tab found. Please open Fiverr in a tab.'
          });
        }
        else if (request.type === 'FETCH_CONVERSATION_FOR_EXPORT') {
          sendResponse({
            success: false,
            message: 'No active Fiverr tab found. Please open Fiverr in a tab.'
          });
          return true;
        }
      }
    });
    
    // Return true for FETCH_CONVERSATION_FOR_EXPORT to keep the message channel open
    if (request.type === 'FETCH_CONVERSATION_FOR_EXPORT') {
      return true;
    }
  }

  // Add this new case
  else if (request.type === 'CONVERT_FORMATS') {
    if (request.data) {
      Promise.all([
        convertToMarkdownBg(request.data),
        convertToHtmlBg(request.data)
      ])
      .then(([markdown, html]) => {
        sendResponse({
          success: true,
          markdown: markdown,
          html: html
        });
      })
      .catch(error => {
        console.error('Error converting formats:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
      
      return true; // Indicate async response
    } else {
      sendResponse({
        success: false,
        error: 'No data provided for conversion'
      });
    }
  }
});

// Function to start the bulk export process
async function startBulkExportProcess(tabId) {
  console.log('Background: Starting bulk export process');
  
  try {
    // Validate the tab ID
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.url.includes('fiverr.com')) {
      throw new Error('Invalid tab or not a Fiverr page');
    }
    
    // Ensure we have valid data to process
    const bulkExport = ongoingProcesses.bulkExport;
    if (!bulkExport || !bulkExport.contacts || !Array.isArray(bulkExport.contacts) || bulkExport.contacts.length === 0) {
      throw new Error('No contacts selected for export');
    }
    
    // Update status
    updateBulkExportStatus('Preparing export...');
    
    // Inject content script if not already injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      console.log('Content script injected successfully');
    } catch (error) {
      console.log('Content script already injected or injection failed:', error);
      // Continue anyway as the script might already be injected
    }
    
    // Start processing contacts one by one
    processNextContact(tabId);
  } catch (error) {
    console.error('Error starting bulk export:', error);
    updateBulkExportStatus(`Error: ${error.message}`, 'error');
  }
}

// Function to process the next contact in the queue
function processNextContact(tabId) {
  const bulkExport = ongoingProcesses.bulkExport;
  
  // If the export is no longer running, stop
  if (bulkExport.status !== 'running') {
    return;
  }
  
  // Get the next contact to process
  const contactIndex = bulkExport.completed + bulkExport.failed;
  if (contactIndex >= bulkExport.contacts.length) {
    // All contacts processed, finalize the export
    finalizeBulkExport();
    return;
  }
  
  const contact = bulkExport.contacts[contactIndex];
  bulkExport.current = contact.username;
  
  // Update status
  updateBulkExportStatus(`Exporting conversation ${contactIndex + 1} of ${bulkExport.total}: ${contact.username}`);
  
  // Use our background function directly instead of sending a message to content script
  console.log(`Starting background fetch for ${contact.username}`);
  fetchConversationBg(contact.username, tabId)
    .then(data => {
      // Process the response directly
      processConversationData(contact.username, data);
    })
    .catch(error => {
      console.error(`Error fetching conversation for ${contact.username}:`, error);
      
      // Add to failed conversations
      bulkExport.conversations.push({
        username: contact.username,
        success: false,
        error: error.message || 'Unknown error'
      });
      
      bulkExport.failed++;
      
      // Update progress
      bulkExport.progress = Math.round(((bulkExport.completed + bulkExport.failed) / bulkExport.total) * 100);
      
      // Broadcast progress update
      chrome.runtime.sendMessage({
        type: 'BULK_EXPORT_PROGRESS',
        progress: bulkExport.progress,
        completed: bulkExport.completed,
        failed: bulkExport.failed,
        total: bulkExport.total,
        current: bulkExport.current
      });
      
      // Process next contact
      processNextContact(tabId);
    });
}

// Function to process conversation data for bulk export
async function processConversationData(username, data) {
  const bulkExport = ongoingProcesses.bulkExport;
  
  try {
    let processed = false;
    
    if (data) {
      console.log(`Processing conversation data for ${username}`);
      
      const format = bulkExport.format;
      
      // Add the currentUsername to the data object to ensure correct titles
      const processedData = {
        ...data,
        currentUsername: username
      };
      
      // Process the conversation data and download directly
      try {
        // Create folder structure
        const folderPrefix = `fiverr-conversations/${username}`;
        
        // Track all download promises
        const downloadPromises = [];
        
        // Process markdown if needed
        if (format === 'all' || format === 'both' || format === 'markdown') {
          // Convert to markdown
          const markdownContent = await convertToMarkdownBg(processedData);
          
          // Download the markdown file
          const mdFilename = `${folderPrefix}/${username}.md`;
          downloadPromises.push(downloadTextFile(markdownContent, mdFilename, 'text/markdown'));
        }
        
        // Process JSON if needed
        if (format === 'all' || format === 'both' || format === 'json') {
          // Download the JSON file
          const jsonFilename = `${folderPrefix}/${username}.json`;
          downloadPromises.push(downloadTextFile(JSON.stringify(processedData, null, 2), jsonFilename, 'application/json'));
        }
        
        // Process HTML if needed
        if (format === 'all' || format === 'html') {
          // Convert to HTML
          const htmlContent = await convertToHtmlBg(processedData);
          
          // Download the HTML file
          const htmlFilename = `${folderPrefix}/${username}.html`;
          downloadPromises.push(downloadTextFile(htmlContent, htmlFilename, 'text/html'));
        }
        
        // Process attachments if needed
        if (bulkExport.includeAttachments && data.messages) {
          // For each message that has attachments
          for (const message of data.messages) {
            if (message.attachments && message.attachments.length > 0) {
              for (const attachment of message.attachments) {
                if (attachment.downloadUrl) {
                  const downloadPromise = new Promise((resolve, reject) => {
                    const filename = attachment.filename || 
                                   attachment.file_name || 
                                   attachment.name || 
                                   attachment.downloadUrl.split('/').pop() || 
                                   `attachment-${Date.now()}`;
                    
                    chrome.downloads.download({
                      url: attachment.downloadUrl,
                      filename: `${folderPrefix}/attachments/${filename}`,
                      conflictAction: 'uniquify'
                    }, (downloadId) => {
                      if (chrome.runtime.lastError) {
                        console.error(`Error downloading attachment: ${chrome.runtime.lastError.message}`);
                        reject(new Error(`Download error: ${chrome.runtime.lastError.message}`));
                      } else {
                        resolve(downloadId);
                      }
                    });
                  });
                  
                  downloadPromises.push(downloadPromise);
                }
              }
            }
          }
        }
        
        // Wait for all downloads to complete
        await Promise.all(downloadPromises);
        
        // Count this as ONE successful conversation regardless of format
        bulkExport.conversations.push({
          username: username,
          success: true
        });
        
        bulkExport.completed++;
        processed = true;
      } catch (error) {
        console.error(`Error processing files for ${username}:`, error);
        
        // Add to failed conversations
        bulkExport.conversations.push({
          username: username,
          success: false,
          error: error.message
        });
        
        bulkExport.failed++;
        processed = true;
      }
    } else {
      console.error(`No data received for ${username}`);
      
      // Add to failed conversations
      bulkExport.conversations.push({
        username: username,
        success: false,
        error: 'No conversation data received'
      });
      
      bulkExport.failed++;
      processed = true;
    }
    
    // Update progress
    bulkExport.progress = Math.round(((bulkExport.completed + bulkExport.failed) / bulkExport.total) * 100);
    
    // Broadcast progress update
    chrome.runtime.sendMessage({
      type: 'BULK_EXPORT_PROGRESS',
      progress: bulkExport.progress,
      completed: bulkExport.completed,
      failed: bulkExport.failed,
      total: bulkExport.total,
      current: bulkExport.current
    });
    
    // Process the next contact
    processNextContact(bulkExport.tabId);
  } catch (error) {
    console.error('Error processing conversation data:', error);
    bulkExport.failed++;
    
    // Process the next contact despite the error
    processNextContact(bulkExport.tabId);
  }
}

// Function to process the response from a fetch conversation request
async function processBulkExportResponse(response) {
  const bulkExport = ongoingProcesses.bulkExport;
  
  // If export is no longer running, ignore
  if (bulkExport.status !== 'running') {
    return;
  }
  
  try {
    let processed = false;
    
    // Check if this is a successful response with conversation data
    if (response.success && response.data) {
      console.log(`Received conversation data for ${response.username}`);
      
      const format = bulkExport.format;
      
      // Add the currentUsername to the data object to ensure correct titles
      const processedData = {
        ...response.data,
        currentUsername: response.username
      };
      
      // Process the conversation data and download directly
      try {
        // Create folder structure
        const folderPrefix = `fiverr-conversations/${response.username}`;
        
        // Track all download promises
        const downloadPromises = [];
        
        // Process markdown if needed
        if (format === 'both' || format === 'markdown') {
          // Convert to markdown
          const markdownContent = await convertToMarkdownBg(processedData);
          
          // Download the markdown file
          const mdFilename = `${folderPrefix}/${response.username}.md`;
          downloadPromises.push(downloadTextFile(markdownContent, mdFilename, 'text/markdown'));
        }
        
        // Process JSON if needed
        if (format === 'both' || format === 'json') {
          // Download the JSON file
          const jsonFilename = `${folderPrefix}/${response.username}.json`;
          downloadPromises.push(downloadTextFile(JSON.stringify(response.data, null, 2), jsonFilename, 'application/json'));
        }
        
        // Process HTML if needed
        if (format === 'html') {
          // Convert to HTML
          const htmlContent = await convertToHtmlBg(processedData);
          
          // Download the HTML file
          const htmlFilename = `${folderPrefix}/${response.username}.html`;
          downloadPromises.push(downloadTextFile(htmlContent, htmlFilename, 'text/html'));
        }
        
        // Process attachments if needed
        if (bulkExport.includeAttachments && response.data.messages) {
          downloadPromises.push(downloadAttachmentsDirectly(response.data, response.username, folderPrefix));
        }
        
        // Wait for all downloads to complete
        await Promise.all(downloadPromises);
        
        // Count this as ONE successful conversation regardless of format
        bulkExport.conversations.push({
          username: response.username,
          success: true
        });
        
        bulkExport.completed++;
        processed = true;
      } catch (error) {
        console.error(`Error processing files for ${response.username}:`, error);
        
        // Add to failed conversations
        bulkExport.conversations.push({
          username: response.username,
          success: false,
          error: error.message
        });
        
        bulkExport.failed++;
        processed = true;
      }
    } else if (response.error) {
      console.error(`Error exporting conversation for ${response.username}:`, response.error);
      
      // Add to failed conversations
      bulkExport.conversations.push({
        username: response.username,
        success: false,
        error: response.error
      });
      
      bulkExport.failed++;
      processed = true;
    }
    
    // Only process next if this response was successfully handled
    if (processed) {
      // Update progress
      bulkExport.progress = Math.round(((bulkExport.completed + bulkExport.failed) / bulkExport.total) * 100);
      
      // Broadcast progress update
      chrome.runtime.sendMessage({
        type: 'BULK_EXPORT_PROGRESS',
        progress: bulkExport.progress,
        completed: bulkExport.completed,
        failed: bulkExport.failed,
        total: bulkExport.total,
        current: bulkExport.current
      });
      
      // Process the next contact
      processNextContact(bulkExport.tabId);
    }
  } catch (error) {
    console.error('Error processing export response:', error);
    bulkExport.failed++;
    
    // Process the next contact despite the error
    processNextContact(bulkExport.tabId);
  }
}

// Helper function to download a text file directly
async function downloadTextFile(content, filename, mimeType) {
  return new Promise((resolve, reject) => {
    try {
      // Create a blob from the content
      const blob = new Blob([content], { type: mimeType });
      
      // Create a data URL
      const reader = new FileReader();
      reader.onload = function() {
        // Download the file
        chrome.downloads.download({
          url: reader.result,
          filename: filename,
          conflictAction: 'uniquify'
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Download error: ${chrome.runtime.lastError.message}`));
          } else {
            resolve(downloadId);
          }
        });
      };
      
      reader.onerror = function() {
        reject(new Error('Error reading blob as data URL'));
      };
      
      // Start reading the blob as a data URL
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to download attachments directly
async function downloadAttachmentsDirectly(conversation, username, folderPrefix) {
  if (!conversation || !conversation.messages) return;
  
  const attachmentPromises = [];
  let attachmentsCount = 0;
  
  // Process each message for attachments
  for (const message of conversation.messages) {
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        if (attachment.downloadUrl) {
          attachmentsCount++;
          console.log(`Processing attachment ${attachmentsCount} for ${username}:`, attachment);
          
          const promise = fetch(attachment.downloadUrl)
            .then(response => {
              if (!response.ok) throw new Error(`Failed to fetch attachment: ${response.statusText}`);
              return response.blob();
            })
            .then(blob => {
              // Create a safe filename using the correct property
              const filename = attachment.filename || 
                             attachment.file_name || 
                             attachment.name || 
                             attachment.downloadUrl.split('/').pop() || 
                             `attachment-${Date.now()}`;
              
              // Create a safe path
              const safePath = `${folderPrefix}/attachments/${filename}`.replace(/[<>:"/\\|?*]/g, '_');
              
              // Create a data URL and download
              return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function() {
                  chrome.downloads.download({
                    url: reader.result,
                    filename: safePath,
                    conflictAction: 'uniquify'
                  }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                      console.error(`Error downloading attachment: ${chrome.runtime.lastError.message}`);
                      reject(new Error(`Download error: ${chrome.runtime.lastError.message}`));
                    } else {
                      resolve(downloadId);
                    }
                  });
                };
                
                reader.onerror = function() {
                  reject(new Error('Error reading blob as data URL'));
                };
                
                reader.readAsDataURL(blob);
              });
            })
            .catch(error => {
              console.error(`Error processing attachment for ${username}:`, error);
            });
          
          attachmentPromises.push(promise);
        }
      }
    }
  }
  
  // Wait for all attachment downloads to complete
  if (attachmentPromises.length > 0) {
    updateBulkExportStatus(`Downloading ${attachmentPromises.length} attachments for ${username}...`);
    await Promise.allSettled(attachmentPromises);
    console.log(`Completed downloading ${attachmentPromises.length} attachments for ${username}`);
  }
  
  return attachmentsCount;
}

// Function to finalize the bulk export
async function finalizeBulkExport() {
  const bulkExport = ongoingProcesses.bulkExport;
  
  try {
    // Ensure the completed count doesn't exceed the total
    if (bulkExport.completed > bulkExport.total) {
      console.warn(`Count mismatch detected: completed (${bulkExport.completed}) > total (${bulkExport.total}). Fixing count.`);
      bulkExport.completed = bulkExport.total;
    }
    
    // Deduplicate the conversations array based on username
    const uniqueUsernames = new Set();
    const uniqueConversations = [];
    
    for (const conv of bulkExport.conversations) {
      if (!uniqueUsernames.has(conv.username)) {
        uniqueUsernames.add(conv.username);
        uniqueConversations.push(conv);
      }
    }
    
    // Update with deduplicated list
    bulkExport.conversations = uniqueConversations;
    
    // Set the completed count based on unique successful conversations
    const successfulConversations = uniqueConversations.filter(conv => conv.success).length;
    bulkExport.completed = successfulConversations;
    
    // Update status to completed
    updateBulkExportStatus(`Export completed. Downloaded ${bulkExport.completed} conversations to individual folders.`, 'completed');
    
    // Create a summary file with export details
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    const summary = {
      timestamp: timestamp,
      completed: bulkExport.completed,
      failed: bulkExport.conversations.filter(conv => !conv.success).length,
      total: bulkExport.total,
      format: bulkExport.format,
      includeAttachments: bulkExport.includeAttachments,
      conversations: bulkExport.conversations
    };
    
    // Download the summary file
    await downloadTextFile(
      JSON.stringify(summary, null, 2),
      `fiverr-conversations/export-summary-${timestamp}.json`,
      'application/json'
    );
    
    console.log('Export completed successfully:', summary);
  } catch (error) {
    console.error('Error finalizing bulk export:', error);
    updateBulkExportStatus(`Error finalizing export: ${error.message}`, 'error');
  }
}

// Function to update the bulk export status
function updateBulkExportStatus(message, status = null) {
  // Get a reference to the bulk export state
  const bulkExport = ongoingProcesses.bulkExport;
  
  // If there's no ongoing export, just log the message
  if (!bulkExport) {
    console.log('No ongoing bulk export to update status for:', message);
    return;
  }
  
  // Update status if provided
  if (status) {
    bulkExport.status = status;
    
    // Set timestamp when status changes
    if (status === 'completed' || status === 'error') {
      bulkExport.timestamp = Date.now();
      
      // Log completion statistics
      console.log(`Bulk export ${status}: ${bulkExport.completed} completed, ${bulkExport.failed} failed out of ${bulkExport.total}`);
    }
  }
  
  // Update message
  bulkExport.message = message;
  
  // Validate that completed + failed doesn't exceed total
  if (bulkExport.completed + bulkExport.failed > bulkExport.total) {
    console.warn('Export counting error detected. Fixing counts.');
    // If we somehow have more completed+failed than total, adjust the completed count
    // This can happen if we accidentally count formats separately
    bulkExport.completed = Math.max(0, bulkExport.total - bulkExport.failed);
  }
  
  // Recalculate progress
  bulkExport.progress = Math.round(((bulkExport.completed + bulkExport.failed) / bulkExport.total) * 100);
  
  // Send status update to popup
  chrome.runtime.sendMessage({
    type: 'BULK_EXPORT_STATUS',
    status: bulkExport.status,
    progress: bulkExport.progress,
    completed: bulkExport.completed,
    failed: bulkExport.failed,
    total: bulkExport.total,
    current: bulkExport.current,
    message: message,
    timestamp: bulkExport.timestamp
  });
}

// ==========================================
// ALWAYS RUNNING ASSISTANT LOGIC
// ==========================================

// Global state for assistant
let assistantState = {
    apiKey: null,
    projectScope: '',
    alwaysRunning: false,
    learningMode: true,
    myUsername: null,
    processedMessageIds: new Set(),
    ignoredUsers: new Set(),
    qaDatabase: [], // Array of { question, answer, timestamp, context? }
    conversationScopes: {} // username -> { inScope: boolean, checked: boolean }
};

// Load state on startup
chrome.runtime.onStartup.addListener(loadAssistantState);
chrome.runtime.onInstalled.addListener(async () => {
    await loadAssistantState();
    setupAlarm();
});

async function loadAssistantState() {
    const result = await chrome.storage.local.get([
        'apiKey', 'projectScope', 'alwaysRunning', 'learningMode', 
        'processedMessageIds', 'ignoredUsers', 'qaDatabase', 'conversationScopes', 'myUsername'
    ]);
    
    assistantState.apiKey = result.apiKey || null;
    assistantState.projectScope = result.projectScope || '';
    assistantState.alwaysRunning = result.alwaysRunning || false;
    assistantState.learningMode = result.learningMode !== undefined ? result.learningMode : true;
    assistantState.myUsername = result.myUsername || null; // Needs to be captured
    
    // Restore Sets/Maps
    assistantState.processedMessageIds = new Set(result.processedMessageIds || []);
    assistantState.ignoredUsers = new Set(result.ignoredUsers || []);
    assistantState.qaDatabase = result.qaDatabase || [];
    assistantState.conversationScopes = result.conversationScopes || {};
    
    updateAlarm();
}

// Update state when settings change
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SETTINGS_UPDATED') {
        const { apiKey, projectScope, alwaysRunning, learningMode } = request.settings;
        assistantState.apiKey = apiKey;
        assistantState.projectScope = projectScope;
        assistantState.alwaysRunning = alwaysRunning;
        assistantState.learningMode = learningMode;
        
        updateAlarm();
        saveAssistantState(); // Persist
    }
});

function updateAlarm() {
    if (assistantState.alwaysRunning) {
        chrome.alarms.get('pollInbox', (alarm) => {
            if (!alarm) {
                chrome.alarms.create('pollInbox', { periodInMinutes: 2 }); // Poll every 2 mins
            }
        });
    } else {
        chrome.alarms.clear('pollInbox');
    }
}

function setupAlarm() {
    updateAlarm();
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pollInbox') {
        pollInbox();
    }
});

async function saveAssistantState() {
    await chrome.storage.local.set({
        processedMessageIds: Array.from(assistantState.processedMessageIds),
        ignoredUsers: Array.from(assistantState.ignoredUsers),
        qaDatabase: assistantState.qaDatabase,
        conversationScopes: assistantState.conversationScopes
    });
}

async function pollInbox() {
    if (!assistantState.apiKey) return; // Can't do much without API key

    console.log('Polling inbox...');
    
    try {
        const response = await fetch('https://www.fiverr.com/inbox/contacts', {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) return; // Not logged in or error
        
        const contacts = await response.json();
        if (!contacts || !Array.isArray(contacts)) return;

        // Iterate contacts
        // Limit to 10 recent contacts to avoid overloading
        for (const contact of contacts.slice(0, 10)) {
            if (assistantState.ignoredUsers.has(contact.username)) continue;
            
            await processConversation(contact.username);
        }
    } catch (e) {
        console.error('Polling failed:', e);
    }
}

async function processConversation(username) {
    // Fetch conversation
    const url = `https://www.fiverr.com/inbox/contacts/${username}/conversation`;
    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/json' }});
        if (!response.ok) return;
        const data = await response.json();
        
        if (!data.messages) return;

        // Capture myUsername if not set
        if (!assistantState.myUsername && data.messages.length > 0) {
            const first = data.messages[0];
            if (first.sender === username) assistantState.myUsername = first.recipient;
            else assistantState.myUsername = first.sender;
            chrome.storage.local.set({ myUsername: assistantState.myUsername });
        }

        const messages = data.messages.sort((a, b) => a.createdAt - b.createdAt);
        
        // Scope Check Logic
        let scope = assistantState.conversationScopes[username];
        if (!scope) {
            // New conversation found. Mark pending.
            // In a real app, we'd use LLM here if DB is large enough.
            if (assistantState.qaDatabase.length >= 20) {
                 const inScope = await checkScopeLLM(messages, username);
                 scope = { inScope, checked: true };
            } else {
                 scope = { inScope: true, checked: false }; // Assume true until marked false
            }
            assistantState.conversationScopes[username] = scope;
            saveAssistantState();
        }
        
        if (!scope.inScope) return; // Ignore

        // Iterate messages
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const msgId = msg._id || msg.id || `${msg.sender}_${msg.createdAt}`; // Fallback ID

            if (assistantState.processedMessageIds.has(msgId)) continue;
            
            // New message!
            
            // LEARNING: If MY message (msg.sender != username), check previous PARTNER message
            if (msg.sender !== username) {
                if (i > 0 && messages[i-1].sender === username) {
                    const prevMsg = messages[i-1];
                    await learnFromInteraction(prevMsg.body, msg.body, username);
                }
            } 
            // DRAFTING: If PARTNER message (msg.sender == username) and it's the last one
            else if (msg.sender === username && i === messages.length - 1) {
                await draftResponse(msg.body, username);
            }

            assistantState.processedMessageIds.add(msgId);
        }
        
        saveAssistantState();

    } catch (e) {
        console.error(`Error processing conversation ${username}:`, e);
    }
}

async function learnFromInteraction(question, answer, username) {
    if (!assistantState.learningMode) return;
    
    // Check if duplicate
    const relevant = findRelevantEntries(question, assistantState.qaDatabase, 1);
    if (relevant.length > 0 && relevant[0].score > 0.9) {
        console.log('Skipping duplicate learning');
        return;
    }

    // Add to DB
    assistantState.qaDatabase.push({
        id: Date.now().toString(),
        question: question,
        answer: answer,
        timestamp: Date.now(),
        sourceUser: username
    });
    console.log('Learned new Q&A pair');
}

async function checkScopeLLM(messages, username) {
    // Construct prompt
    const transcript = messages.slice(-10).map(m => `${m.sender}: ${m.body}`).join('\n');
    const prompt = `
    Project Scope: ${assistantState.projectScope}
    
    Conversation with ${username}:
    ${transcript}
    
    Is this conversation related to the project scope? Reply with YES or NO.
    `;
    
    const res = await callLLM(prompt, assistantState.apiKey);
    return res.text && res.text.toUpperCase().includes('YES');
}

async function draftResponse(lastMessage, username) {
    // 1. Search DB
    const relevant = findRelevantEntries(lastMessage, assistantState.qaDatabase, 5);
    if (relevant.length === 0) return; // Nothing to say

    // 2. Draft
    const context = relevant.map(e => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n');
    const prompt = `
    You are an assistant for a Fiverr project.
    Project Scope: ${assistantState.projectScope}
    
    Relevant Q&A from past conversations:
    ${context}
    
    Freelancer (${username}) says: "${lastMessage}"
    
    Draft a response based on the relevant Q&A. Be concise and professional.
    `;
    
    const res = await callLLM(prompt, assistantState.apiKey);
    
    if (res.text) {
        // Store draft
        const draft = {
            text: res.text,
            timestamp: Date.now()
        };
        chrome.storage.local.set({
            [`draft_${username}`]: draft
        });
        
        // Notify user
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/extension-preview.png',
            title: `Draft for ${username}`,
            message: res.text.substring(0, 50) + '...'
        });
    }
}
