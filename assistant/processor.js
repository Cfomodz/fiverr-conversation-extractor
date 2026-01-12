/**
 * Conversation Processor Module
 * Handles processing exported Fiverr conversations
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  loadKnowledgeBase,
  addToKnowledgeBase,
  isMessageProcessed,
  markMessagesProcessed,
  isUserIgnored,
  addIgnoredUser,
  getConversationScope,
  markConversationInScope,
  getKnowledgeStats
} from './knowledge.js';
import { search } from './search.js';
import { extractQAPairs, checkScope, generateResponse } from './llm.js';

/**
 * Load a conversation from JSON file
 */
export function loadConversation(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

/**
 * Format conversation for display/processing
 */
export function formatConversation(conversationData) {
  if (!conversationData || !conversationData.messages) return '';
  return conversationData.messages.map(msg => {
    const sender = msg.sender || 'Unknown';
    const body = msg.body || '';
    const time = msg.formattedTime || new Date(msg.createdAt).toLocaleString();
    return `[${time}] ${sender}: ${body}`;
  }).join('\n\n');
}

/**
 * Get new messages from a conversation (not yet processed)
 */
export function getNewMessages(conversationData) {
  if (!conversationData || !conversationData.messages) return [];
  return conversationData.messages.filter(msg => {
    const messageId = msg.id || `${msg.createdAt}_${msg.sender}`;
    return !isMessageProcessed(messageId);
  });
}

/**
 * Get project context from config
 */
export function getProjectContext() {
  try {
    const configPath = join(process.cwd(), 'assistant', 'config.json');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const project = config.project || {};
      return `Project: ${project.name || 'Unnamed'}\nDescription: ${project.description || 'None'}\nKeywords: ${(project.keywords || []).join(', ')}`;
    }
  } catch (e) { /* ignore */ }
  return 'No project context configured';
}

/**
 * Process a conversation file and extract/learn Q&A pairs
 */
export async function processConversation(filePath, options = {}) {
  const { forceScope = null, dryRun = false } = options;
  const conversationData = loadConversation(filePath);
  const username = conversationData.username || conversationData.currentUsername || 'unknown';
  const conversationId = conversationData.conversationId || `conv_${username}_${Date.now()}`;

  const result = {
    username, conversationId,
    totalMessages: conversationData.messages?.length || 0,
    newMessages: 0, extractedQA: [], addedQA: [], skippedQA: [],
    isInScope: null, wasIgnored: false
  };

  if (isUserIgnored(username)) {
    result.wasIgnored = true;
    result.isInScope = false;
    return result;
  }

  const newMessages = getNewMessages(conversationData);
  result.newMessages = newMessages.length;
  if (newMessages.length === 0) return result;

  const conversationText = formatConversation(conversationData);
  const knowledgeBase = loadKnowledgeBase();
  const stats = getKnowledgeStats();

  // Determine scope
  let isInScope = forceScope;
  if (isInScope === null) {
    const existingScope = getConversationScope(conversationId);
    if (existingScope) {
      isInScope = existingScope.inScope;
    } else if (stats.totalEntries >= 20) {
      const projectContext = getProjectContext();
      isInScope = await checkScope(conversationText, knowledgeBase, projectContext);
      if (!dryRun) {
        markConversationInScope(conversationId, username, isInScope);
        if (!isInScope) addIgnoredUser(username, 'Auto-detected as out of scope');
      }
    }
  } else if (!dryRun) {
    markConversationInScope(conversationId, username, isInScope);
    if (!isInScope) addIgnoredUser(username, 'Manually marked as out of scope');
  }

  result.isInScope = isInScope;
  if (isInScope === false) return result;

  // Extract Q&A pairs
  const extractedQA = await extractQAPairs(conversationText, knowledgeBase);
  result.extractedQA = extractedQA;

  if (!dryRun && extractedQA.length > 0) {
    for (const qa of extractedQA) {
      const addResult = await addToKnowledgeBase(qa, { source: 'conversation', conversationId, username });
      if (addResult.added) result.addedQA.push(addResult.entry);
      else result.skippedQA.push({ qa, reason: addResult.reason, duplicate: addResult.duplicate });
    }
    const messageIds = conversationData.messages.map(msg => msg.id || `${msg.createdAt}_${msg.sender}`);
    markMessagesProcessed(messageIds, conversationId, username);
  }

  return result;
}

/**
 * Generate a suggested response for a conversation
 */
export async function getSuggestedResponse(conversationFilePath) {
  const conversationData = loadConversation(conversationFilePath);
  const conversationText = formatConversation(conversationData);
  const knowledgeBase = loadKnowledgeBase();
  const messages = conversationData.messages || [];
  const lastMessage = messages[messages.length - 1];
  
  if (!lastMessage) return { error: 'No messages in conversation' };

  const query = lastMessage.body || '';
  let config;
  try {
    config = JSON.parse(readFileSync(join(process.cwd(), 'assistant', 'config.json'), 'utf-8'));
  } catch { config = { search: { topK: 7, minScore: 0.1 } }; }
  
  const relevantKnowledge = search(query, knowledgeBase, config.search?.topK || 7, config.search?.minScore || 0.1);
  const projectContext = getProjectContext();
  const suggestedResponse = await generateResponse(conversationText, relevantKnowledge, projectContext);
  
  return {
    lastMessage: { sender: lastMessage.sender, body: lastMessage.body, time: lastMessage.formattedTime || new Date(lastMessage.createdAt).toLocaleString() },
    relevantKnowledge: relevantKnowledge.map(k => ({ question: k.question, answer: k.answer, score: k.score })),
    suggestedResponse
  };
}

/**
 * Find conversation files in a directory
 */
export function findConversationFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  
  function scanDir(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) scanDir(fullPath);
      else if (entry.name.endsWith('.json') && !entry.name.includes('export-summary')) {
        try {
          const data = JSON.parse(readFileSync(fullPath, 'utf-8'));
          if (data.messages && Array.isArray(data.messages)) {
            files.push({ path: fullPath, username: data.username || data.currentUsername || 'unknown', messageCount: data.messages.length });
          }
        } catch { /* skip */ }
      }
    }
  }
  
  scanDir(directory);
  return files;
}

/**
 * Batch process multiple conversation files
 */
export async function batchProcessConversations(files, options = {}) {
  const results = { processed: 0, skipped: 0, inScope: 0, outOfScope: 0, needsManualScope: 0, totalQAExtracted: 0, totalQAAdded: 0, errors: [] };
  for (const file of files) {
    try {
      const result = await processConversation(file.path || file, options);
      results.processed++;
      if (result.wasIgnored) results.skipped++;
      else if (result.isInScope === true) { results.inScope++; results.totalQAExtracted += result.extractedQA.length; results.totalQAAdded += result.addedQA.length; }
      else if (result.isInScope === false) results.outOfScope++;
      else results.needsManualScope++;
    } catch (error) { results.errors.push({ file: file.path || file, error: error.message }); }
  }
  return results;
}

export default { loadConversation, formatConversation, getNewMessages, processConversation, getSuggestedResponse, findConversationFiles, batchProcessConversations, getProjectContext };
