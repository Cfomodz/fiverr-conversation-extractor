/**
 * LLM Integration Module
 * Supports DeepSeek and Gemini APIs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let config = null;

function loadConfig() {
  if (!config) {
    try {
      const configPath = join(__dirname, 'config.json');
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (error) {
      console.error('Error loading config.json. Please copy config.example.json to config.json and add your API keys.');
      process.exit(1);
    }
  }
  return config;
}

/**
 * Call DeepSeek API
 */
async function callDeepSeek(messages, options = {}) {
  const cfg = loadConfig();
  const { apiKey, model, baseUrl } = cfg.llm.deepseek;
  
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call Gemini API
 */
async function callGemini(messages, options = {}) {
  const cfg = loadConfig();
  const { apiKey, model } = cfg.llm.gemini;
  
  // Convert messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : msg.role,
    parts: [{ text: msg.content }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 2000
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

/**
 * Main LLM call function - routes to configured provider
 */
export async function callLLM(messages, options = {}) {
  const cfg = loadConfig();
  const provider = cfg.llm.provider;

  if (provider === 'deepseek') {
    return callDeepSeek(messages, options);
  } else if (provider === 'gemini') {
    return callGemini(messages, options);
  } else {
    throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Generate a suggested response based on context and knowledge base
 */
export async function generateResponse(conversation, relevantKnowledge, projectContext) {
  const cfg = loadConfig();
  
  const systemPrompt = `You are an AI assistant helping manage freelancer communications on Fiverr. 
Your job is to draft professional, helpful responses to freelancer questions about the project.

PROJECT CONTEXT:
${projectContext}

RELEVANT KNOWLEDGE FROM PAST CONVERSATIONS:
${relevantKnowledge.map((k, i) => `${i + 1}. Q: ${k.question}\n   A: ${k.answer}`).join('\n\n')}

INSTRUCTIONS:
- Use the relevant knowledge to inform your response
- Be professional and concise
- If you're unsure about something not covered in the knowledge base, say so clearly
- Match the tone of previous responses
- Don't make up information not provided in the knowledge base`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Here is the recent conversation:\n\n${conversation}\n\nPlease draft a response to the freelancer's latest question/message.` }
  ];

  return callLLM(messages);
}

/**
 * Check if a new Q&A is semantically similar to an existing one
 */
export async function checkDuplicate(newQA, existingQA) {
  const messages = [
    {
      role: 'system',
      content: `You are a semantic similarity checker. Compare two question-answer pairs and determine if they cover essentially the same information.

Respond with ONLY "DUPLICATE" or "UNIQUE".
- DUPLICATE: The new Q&A covers information already present in the existing Q&A
- UNIQUE: The new Q&A contains meaningfully different information`
    },
    {
      role: 'user',
      content: `EXISTING Q&A:
Q: ${existingQA.question}
A: ${existingQA.answer}

NEW Q&A:
Q: ${newQA.question}
A: ${newQA.answer}

Is the new Q&A a duplicate of the existing one?`
    }
  ];

  const response = await callLLM(messages, { temperature: 0.1 });
  return response.trim().toUpperCase().includes('DUPLICATE');
}

/**
 * Check if a conversation is in scope for the project
 */
export async function checkScope(conversation, knowledgeBase, projectContext) {
  const cfg = loadConfig();
  
  // Get top knowledge entries for context
  const topK = Math.min(cfg.learning.topKForScopeCheck, knowledgeBase.length);
  const sampleKnowledge = knowledgeBase.slice(0, topK);
  
  const messages = [
    {
      role: 'system',
      content: `You are determining if a Fiverr conversation is about a specific project.

PROJECT CONTEXT:
${projectContext}

SAMPLE Q&A FROM THIS PROJECT:
${sampleKnowledge.map((k, i) => `${i + 1}. Q: ${k.question}\n   A: ${k.answer}`).join('\n\n')}

Respond with ONLY "IN_SCOPE" or "OUT_OF_SCOPE".
- IN_SCOPE: The conversation is clearly about this project or related inquiries
- OUT_OF_SCOPE: The conversation is about something else entirely (different project, spam, unrelated)`
    },
    {
      role: 'user',
      content: `CONVERSATION:
${conversation}

Is this conversation in scope for the project?`
    }
  ];

  const response = await callLLM(messages, { temperature: 0.1 });
  return response.trim().toUpperCase().includes('IN_SCOPE');
}

/**
 * Extract Q&A pairs from a conversation
 */
export async function extractQAPairs(conversation, existingQA = []) {
  const existingContext = existingQA.length > 0 
    ? `\nEXISTING Q&A (avoid duplicating these):\n${existingQA.slice(0, 10).map((k, i) => `${i + 1}. Q: ${k.question}`).join('\n')}`
    : '';

  const messages = [
    {
      role: 'system',
      content: `You extract question-answer pairs from Fiverr conversations. Focus on:
1. Questions the freelancer asked about the project
2. The client's (your) answers to those questions
3. Important clarifications or specifications discussed

${existingContext}

Output format (JSON array):
[
  {"question": "What is X?", "answer": "X is..."},
  {"question": "How should Y be done?", "answer": "Y should be..."}
]

Only extract meaningful Q&A pairs. Skip small talk and generic messages.
Return an empty array [] if there are no extractable Q&A pairs.`
    },
    {
      role: 'user',
      content: conversation
    }
  ];

  const response = await callLLM(messages, { temperature: 0.3 });
  
  // Try to parse JSON from response
  try {
    // Find JSON array in response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('Failed to parse Q&A extraction:', error.message);
    return [];
  }
}

export default {
  callLLM,
  generateResponse,
  checkDuplicate,
  checkScope,
  extractQAPairs
};
