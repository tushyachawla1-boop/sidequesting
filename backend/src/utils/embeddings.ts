import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generates a deterministic normalized mock vector of length 1536 for testing.
 * This ensures that identical input strings produce identical vectors (cosine similarity = 1.0),
 * while distinct strings produce different vectors.
 */
function generateMockVector(text: string): number[] {
  const vector = new Array(1536).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  for (let i = 0; i < 1536; i++) {
    const val = Math.sin(hash + i) * 10000;
    vector[i] = val - Math.floor(val);
  }
  
  // Normalize vector to unit length
  let sumSq = 0;
  for (let i = 0; i < 1536; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq);
  for (let i = 0; i < 1536; i++) {
    vector[i] /= norm;
  }
  return vector;
}

/**
 * Generates a 1536-dimension text embedding for a quest based on: title + organizer_name + summary.
 */
export async function generateEmbedding(title: string, organizerName: string, summary: string): Promise<number[]> {
  const text = `${title} ${organizerName} ${summary}`;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    console.log('[EMBEDDINGS] No Gemini API key provided. Using deterministic mock vector.');
    return generateMockVector(text);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
      config: {
        outputDimensionality: 1536,
      },
    });

    if (!response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
      throw new Error('Received empty embedding from Gemini API');
    }

    return response.embeddings[0].values;
  } catch (error: any) {
    console.warn(`[EMBEDDINGS] Gemini API call failed: ${error.message}. Falling back to mock vector.`);
    return generateMockVector(text);
  }
}
