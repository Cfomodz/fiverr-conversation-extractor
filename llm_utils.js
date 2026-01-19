// llm_utils.js

/**
 * Calls the LLM API (Gemini or DeepSeek)
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - The API Key
 * @param {string} model - The model to use (default: gemini-1.5-flash)
 * @returns {Promise<{text: string, error?: string}>}
 */
async function callLLM(prompt, apiKey, model = 'gemini-1.5-flash') {
  if (!apiKey) return { error: 'No API Key provided' };

  // Simple heuristic for provider
  const isGemini = model.toLowerCase().includes('gemini');
  // For DeepSeek, we'd need their specific endpoint. Assuming standard OpenAI-compatible for DeepSeek or similar.
  
  if (isGemini) {
      const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(GEMINI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }]
          })
        });
    
        if (!response.ok) {
            const err = await response.text();
            console.error('Gemini API Error details:', err);
            throw new Error(`LLM API Error: ${response.status}`);
        }
    
        const data = await response.json();
        return { 
            text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
            raw: data 
        };
    
      } catch (error) {
        console.error('LLM Call Failed:', error);
        return { error: error.message };
      }
  } else {
      // Placeholder for DeepSeek or other OpenAI-compatible APIs
      // This requires the user to provide the correct endpoint or we hardcode DeepSeek's
      const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'; // Example URL
      try {
          const response = await fetch(DEEPSEEK_URL, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                  model: model,
                  messages: [{ role: 'user', content: prompt }]
              })
          });

          if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API Error: ${response.status} - ${err}`);
        }
    
        const data = await response.json();
        return { 
            text: data.choices?.[0]?.message?.content || '',
            raw: data 
        };

      } catch (error) {
          return { error: error.message };
      }
  }
}

/**
 * Calculates Jaccard Similarity between two strings
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} 0 to 1
 */
function getJaccardSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const clean = (s) => s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(x => x.length > 2);
    const set1 = new Set(clean(str1));
    const set2 = new Set(clean(str2));
    
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
}

/**
 * Finds relevant entries from the QA database
 * @param {string} query - The user's question or message
 * @param {Array} entries - Array of {question, answer} objects
 * @param {number} limit - Number of results to return
 * @returns {Array} Top matching entries
 */
function findRelevantEntries(query, entries, limit = 7) {
    if (!entries || !Array.isArray(entries) || entries.length === 0) return [];
    
    // Calculate similarity for each entry
    const scored = entries.map(entry => ({
        ...entry,
        score: getJaccardSimilarity(query, entry.question)
    }));

    // Sort by score desc
    scored.sort((a, b) => b.score - a.score);

    // Filter out zero scores if wanted, or just return top N
    return scored.filter(e => e.score > 0).slice(0, limit);
}
