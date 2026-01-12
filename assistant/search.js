/**
 * Semantic Search Module
 * Uses TF-IDF based loose semantic search for finding relevant Q&A pairs
 */

import natural from 'natural';

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

/**
 * Preprocess text for search
 */
function preprocess(text) {
  if (!text) return '';
  
  // Convert to lowercase
  text = text.toLowerCase();
  
  // Remove special characters but keep spaces
  text = text.replace(/[^a-z0-9\s]/g, ' ');
  
  // Tokenize and stem
  const tokens = tokenizer.tokenize(text) || [];
  const stemmed = tokens.map(token => stemmer.stem(token));
  
  return stemmed.join(' ');
}

/**
 * Calculate similarity score between two texts using Jaccard + TF-IDF hybrid
 */
function calculateSimilarity(query, document) {
  const queryTokens = new Set(preprocess(query).split(/\s+/).filter(t => t.length > 0));
  const docTokens = new Set(preprocess(document).split(/\s+/).filter(t => t.length > 0));
  
  if (queryTokens.size === 0 || docTokens.size === 0) return 0;
  
  // Calculate Jaccard similarity
  const intersection = new Set([...queryTokens].filter(x => docTokens.has(x)));
  const union = new Set([...queryTokens, ...docTokens]);
  
  return intersection.size / union.size;
}

/**
 * Search knowledge base for relevant Q&A pairs
 * @param {string} query - The search query (typically a question from freelancer)
 * @param {Array} knowledgeBase - Array of Q&A objects
 * @param {number} topK - Number of results to return
 * @param {number} minScore - Minimum similarity score threshold
 * @returns {Array} - Sorted array of relevant Q&A pairs with scores
 */
export function search(query, knowledgeBase, topK = 7, minScore = 0.1) {
  if (!knowledgeBase || knowledgeBase.length === 0) {
    return [];
  }

  // Create TF-IDF index
  const tfidf = new TfIdf();
  
  // Add all documents to the index
  knowledgeBase.forEach(qa => {
    const document = `${qa.question} ${qa.answer}`;
    tfidf.addDocument(preprocess(document));
  });

  // Calculate scores for each document
  const results = knowledgeBase.map((qa, index) => {
    // Combine TF-IDF score with direct similarity
    let tfidfScore = 0;
    tfidf.tfidfs(preprocess(query), (i, measure) => {
      if (i === index) tfidfScore = measure;
    });
    
    // Also calculate direct similarity (helps with short queries)
    const directSimilarity = calculateSimilarity(query, `${qa.question} ${qa.answer}`);
    
    // Question-specific similarity (weight questions more)
    const questionSimilarity = calculateSimilarity(query, qa.question);
    
    // Combined score: TF-IDF + direct similarity + question similarity
    // Normalize TF-IDF to 0-1 range approximately
    const normalizedTfidf = Math.min(tfidfScore / 10, 1);
    const combinedScore = (normalizedTfidf * 0.4) + (directSimilarity * 0.3) + (questionSimilarity * 0.3);
    
    return {
      ...qa,
      score: combinedScore
    };
  });

  // Sort by score (descending) and filter by minimum score
  return results
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Find potential duplicates in knowledge base
 * @param {Object} newQA - New Q&A to check
 * @param {Array} knowledgeBase - Existing knowledge base
 * @param {number} threshold - Similarity threshold for duplicate detection
 * @returns {Array} - Array of potential duplicates with scores
 */
export function findPotentialDuplicates(newQA, knowledgeBase, threshold = 0.4) {
  if (!knowledgeBase || knowledgeBase.length === 0) {
    return [];
  }

  const newText = `${newQA.question} ${newQA.answer}`;
  
  const duplicates = knowledgeBase.map(qa => {
    const existingText = `${qa.question} ${qa.answer}`;
    const score = calculateSimilarity(newText, existingText);
    return { ...qa, similarity: score };
  })
  .filter(qa => qa.similarity >= threshold)
  .sort((a, b) => b.similarity - a.similarity);

  return duplicates;
}

/**
 * Extract key terms from a query for highlighting
 */
export function extractKeyTerms(query) {
  const tokens = tokenizer.tokenize(query.toLowerCase()) || [];
  
  // Filter out common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'to', 'of', 'in', 'for', 'on', 'with',
    'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
    'because', 'until', 'while', 'what', 'which', 'who', 'whom', 'this',
    'that', 'these', 'those', 'am', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
  ]);

  return tokens.filter(token => !stopWords.has(token) && token.length > 2);
}

export default {
  search,
  findPotentialDuplicates,
  extractKeyTerms,
  preprocess
};
