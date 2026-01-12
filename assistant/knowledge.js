/**
 * Knowledge Base Management Module
 * Handles storing, retrieving, and managing Q&A pairs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { findPotentialDuplicates } from './search.js';
import { checkDuplicate } from './llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, 'data');
const KNOWLEDGE_FILE = join(DATA_DIR, 'knowledge_base.json');
const PROCESSED_FILE = join(DATA_DIR, 'processed_messages.json');
const IGNORED_FILE = join(DATA_DIR, 'ignored_users.json');
const SCOPED_FILE = join(DATA_DIR, 'scoped_conversations.json');

/**
 * Initialize data files if they don't exist
 */
function initDataFiles() {
  if (!existsSync(KNOWLEDGE_FILE)) {
    writeFileSync(KNOWLEDGE_FILE, JSON.stringify({ entries: [], lastUpdated: null }, null, 2));
  }
  if (!existsSync(PROCESSED_FILE)) {
    writeFileSync(PROCESSED_FILE, JSON.stringify({ messageIds: [], conversations: {} }, null, 2));
  }
  if (!existsSync(IGNORED_FILE)) {
    writeFileSync(IGNORED_FILE, JSON.stringify({ users: [] }, null, 2));
  }
  if (!existsSync(SCOPED_FILE)) {
    writeFileSync(SCOPED_FILE, JSON.stringify({ conversations: {} }, null, 2));
  }
}

/**
 * Load knowledge base
 */
export function loadKnowledgeBase() {
  initDataFiles();
  try {
    const data = JSON.parse(readFileSync(KNOWLEDGE_FILE, 'utf-8'));
    return data.entries || [];
  } catch (error) {
    console.error('Error loading knowledge base:', error.message);
    return [];
  }
}

/**
 * Save knowledge base
 */
export function saveKnowledgeBase(entries) {
  initDataFiles();
  const data = {
    entries: entries,
    lastUpdated: new Date().toISOString()
  };
  writeFileSync(KNOWLEDGE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Get knowledge base stats
 */
export function getKnowledgeStats() {
  const entries = loadKnowledgeBase();
  const processed = loadProcessedMessages();
  const ignored = loadIgnoredUsers();
  const scoped = loadScopedConversations();
  
  return {
    totalEntries: entries.length,
    processedConversations: Object.keys(processed.conversations).length,
    ignoredUsers: ignored.users.length,
    scopedConversations: Object.keys(scoped.conversations).length
  };
}

/**
 * Add new Q&A to knowledge base with duplicate checking
 * @param {Object} qa - { question, answer } object
 * @param {Object} metadata - Additional metadata (source, timestamp, etc.)
 * @returns {Object} - { added: boolean, reason: string, duplicate?: Object }
 */
export async function addToKnowledgeBase(qa, metadata = {}) {
  const knowledgeBase = loadKnowledgeBase();
  
  // Step 1: Programmatic duplicate check
  const potentialDuplicates = findPotentialDuplicates(qa, knowledgeBase, 0.35);
  
  if (potentialDuplicates.length > 0) {
    // Step 2: LLM-based duplicate check for high-similarity matches
    for (const duplicate of potentialDuplicates) {
      if (duplicate.similarity > 0.5) {
        // High similarity - use LLM to confirm
        const isDuplicate = await checkDuplicate(qa, duplicate);
        if (isDuplicate) {
          return {
            added: false,
            reason: 'Duplicate entry detected (confirmed by LLM)',
            duplicate: duplicate
          };
        }
      }
    }
  }
  
  // Add the new entry
  const newEntry = {
    id: generateId(),
    question: qa.question,
    answer: qa.answer,
    createdAt: new Date().toISOString(),
    source: metadata.source || 'manual',
    conversationId: metadata.conversationId || null,
    username: metadata.username || null
  };
  
  knowledgeBase.push(newEntry);
  saveKnowledgeBase(knowledgeBase);
  
  return {
    added: true,
    reason: 'Entry added successfully',
    entry: newEntry
  };
}

/**
 * Generate a unique ID
 */
function generateId() {
  return `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load processed messages tracking
 */
export function loadProcessedMessages() {
  initDataFiles();
  try {
    return JSON.parse(readFileSync(PROCESSED_FILE, 'utf-8'));
  } catch (error) {
    return { messageIds: [], conversations: {} };
  }
}

/**
 * Save processed messages tracking
 */
export function saveProcessedMessages(data) {
  initDataFiles();
  writeFileSync(PROCESSED_FILE, JSON.stringify(data, null, 2));
}

/**
 * Check if a message ID has been processed
 */
export function isMessageProcessed(messageId) {
  const processed = loadProcessedMessages();
  return processed.messageIds.includes(messageId);
}

/**
 * Mark messages as processed
 */
export function markMessagesProcessed(messageIds, conversationId, username) {
  const processed = loadProcessedMessages();
  
  // Add new message IDs
  for (const id of messageIds) {
    if (!processed.messageIds.includes(id)) {
      processed.messageIds.push(id);
    }
  }
  
  // Track conversation
  if (conversationId) {
    processed.conversations[conversationId] = {
      username: username,
      lastProcessed: new Date().toISOString(),
      messageCount: messageIds.length
    };
  }
  
  saveProcessedMessages(processed);
}

/**
 * Load ignored users list
 */
export function loadIgnoredUsers() {
  initDataFiles();
  try {
    return JSON.parse(readFileSync(IGNORED_FILE, 'utf-8'));
  } catch (error) {
    return { users: [] };
  }
}

/**
 * Save ignored users list
 */
export function saveIgnoredUsers(data) {
  initDataFiles();
  writeFileSync(IGNORED_FILE, JSON.stringify(data, null, 2));
}

/**
 * Add user to ignored list
 */
export function addIgnoredUser(username, reason = 'Out of scope') {
  const ignored = loadIgnoredUsers();
  
  if (!ignored.users.find(u => u.username === username)) {
    ignored.users.push({
      username: username,
      reason: reason,
      addedAt: new Date().toISOString()
    });
    saveIgnoredUsers(ignored);
    return true;
  }
  return false;
}

/**
 * Check if user is ignored
 */
export function isUserIgnored(username) {
  const ignored = loadIgnoredUsers();
  return ignored.users.some(u => u.username === username);
}

/**
 * Remove user from ignored list
 */
export function removeIgnoredUser(username) {
  const ignored = loadIgnoredUsers();
  const index = ignored.users.findIndex(u => u.username === username);
  if (index > -1) {
    ignored.users.splice(index, 1);
    saveIgnoredUsers(ignored);
    return true;
  }
  return false;
}

/**
 * Load scoped conversations tracking
 */
export function loadScopedConversations() {
  initDataFiles();
  try {
    return JSON.parse(readFileSync(SCOPED_FILE, 'utf-8'));
  } catch (error) {
    return { conversations: {} };
  }
}

/**
 * Save scoped conversations
 */
export function saveScopedConversations(data) {
  initDataFiles();
  writeFileSync(SCOPED_FILE, JSON.stringify(data, null, 2));
}

/**
 * Mark conversation as in scope
 */
export function markConversationInScope(conversationId, username, isInScope) {
  const scoped = loadScopedConversations();
  
  scoped.conversations[conversationId] = {
    username: username,
    inScope: isInScope,
    determinedAt: new Date().toISOString()
  };
  
  saveScopedConversations(scoped);
}

/**
 * Check if conversation scope has been determined
 */
export function getConversationScope(conversationId) {
  const scoped = loadScopedConversations();
  return scoped.conversations[conversationId] || null;
}

/**
 * Delete a knowledge base entry by ID
 */
export function deleteKnowledgeEntry(entryId) {
  const knowledgeBase = loadKnowledgeBase();
  const index = knowledgeBase.findIndex(e => e.id === entryId);
  
  if (index > -1) {
    const removed = knowledgeBase.splice(index, 1);
    saveKnowledgeBase(knowledgeBase);
    return removed[0];
  }
  return null;
}

/**
 * Update a knowledge base entry
 */
export function updateKnowledgeEntry(entryId, updates) {
  const knowledgeBase = loadKnowledgeBase();
  const index = knowledgeBase.findIndex(e => e.id === entryId);
  
  if (index > -1) {
    knowledgeBase[index] = {
      ...knowledgeBase[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveKnowledgeBase(knowledgeBase);
    return knowledgeBase[index];
  }
  return null;
}

/**
 * Search knowledge base entries
 */
export function searchEntries(query) {
  const knowledgeBase = loadKnowledgeBase();
  const lowerQuery = query.toLowerCase();
  
  return knowledgeBase.filter(entry => 
    entry.question.toLowerCase().includes(lowerQuery) ||
    entry.answer.toLowerCase().includes(lowerQuery)
  );
}

export default {
  loadKnowledgeBase,
  saveKnowledgeBase,
  addToKnowledgeBase,
  getKnowledgeStats,
  loadProcessedMessages,
  saveProcessedMessages,
  isMessageProcessed,
  markMessagesProcessed,
  loadIgnoredUsers,
  saveIgnoredUsers,
  addIgnoredUser,
  isUserIgnored,
  removeIgnoredUser,
  loadScopedConversations,
  saveScopedConversations,
  markConversationInScope,
  getConversationScope,
  deleteKnowledgeEntry,
  updateKnowledgeEntry,
  searchEntries
};
