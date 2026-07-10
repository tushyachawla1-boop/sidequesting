import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { generateEmbedding } from '../utils/embeddings.js';

dotenv.config();

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/sidequest',
});

export interface IngestedQuest {
  title: string;
  organizer: string;
  status: string;
  lifecycle_type: string;
  application_deadline: string | null;
  start_date: string;
  end_date: string;
  price: number;
  currency: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  raw_source_url: string;
  tags: string[];
  target_audience: string;
  difficulty_level: string;
  summary: string;
}

const ingestSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'The title of the event/internship/workshop.' },
    organizer: { type: Type.STRING, description: 'The organizer, company, or host hosting the event.' },
    status: { type: Type.STRING, description: 'Current status: active, completed, cancelled, upcoming.' },
    lifecycle_type: { type: Type.STRING, description: 'Type of quest: internship, workshop, event, hackathon, course.' },
    application_deadline: { type: Type.STRING, description: 'Application deadline in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ). Null if not found.', nullable: true },
    start_date: { type: Type.STRING, description: 'Start date and time in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ).' },
    end_date: { type: Type.STRING, description: 'End date and time in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ).' },
    price: { type: Type.NUMBER, description: 'Price or cost to attend. Use 0.00 if free.' },
    currency: { type: Type.STRING, description: '3-letter currency code, e.g. USD.' },
    formatted_address: { type: Type.STRING, description: 'Full physical address of the event, or "Online" if virtual.' },
    latitude: { type: Type.NUMBER, description: 'Latitude coordinate of the location. Use 0.0 if online.' },
    longitude: { type: Type.NUMBER, description: 'Longitude coordinate of the location. Use 0.0 if online.' },
    raw_source_url: { type: Type.STRING, description: 'The URL or source link representing the source of information.' },
    tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of relevant keywords/tags.' },
    target_audience: { type: Type.STRING, description: 'Primary target audience.' },
    difficulty_level: { type: Type.STRING, description: 'Difficulty level (e.g., Beginner, Intermediate, Advanced).' },
    summary: { type: Type.STRING, description: 'A clean, context-aware 2-sentence summary of the event.' }
  },
  required: [
    'title',
    'organizer',
    'status',
    'lifecycle_type',
    'start_date',
    'end_date',
    'price',
    'currency',
    'formatted_address',
    'latitude',
    'longitude',
    'raw_source_url',
    'tags',
    'target_audience',
    'difficulty_level',
    'summary'
  ]
};

/**
 * Parses unstructured text into a structured quest JSON format using gemini-2.5-flash.
 */
export async function parseUnstructuredText(text: string): Promise<IngestedQuest> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    console.log('[INGESTOR] No Gemini API key provided. Using local mock parser.');
    
    // Simulate parsing the text based on keywords for testing purposes
    const isQuantum = text.includes('Quantum') || text.includes('quantum');
    const isSecondCall = text.includes('identical') || text.includes('Second Call');
    
    return {
      title: isQuantum ? 'Quantum Computing Workshop' : 'AI Bootcamp',
      organizer: isQuantum ? 'MIT Physics Department' : 'Tech Academy',
      status: 'active',
      lifecycle_type: 'workshop',
      application_deadline: '2026-08-01T23:59:59Z',
      start_date: '2026-08-15T09:00:00Z',
      end_date: '2026-08-15T17:00:00Z',
      price: isQuantum ? 0.00 : 49.99,
      currency: 'USD',
      formatted_address: '77 Massachusetts Ave, Cambridge, MA 02139',
      latitude: 42.3592,
      longitude: -71.0932,
      raw_source_url: 'https://mit.edu/quantum-workshop',
      tags: isSecondCall ? ['Quantum', 'Physics', 'Computing', 'AdvancedTech'] : ['Quantum', 'Physics', 'Computing'],
      target_audience: 'College Students & Researchers',
      difficulty_level: 'Intermediate',
      summary: 'A comprehensive one-day workshop introducing quantum computation basics. Learn qubits, quantum gates, and simple circuits.'
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Analyze the following unstructured web text representing an event, internship, workshop, or course. Extract the details according to the schema provided.
Deduce any missing tags, target audience, and difficulty level based on the context. Write a clean, context-aware 2-sentence summary of the event/internship/workshop.
If dates are relative, resolve them relative to the current year/date (Today is ${new Date().toISOString()}).
Return a valid JSON object matching the requested schema.

Text:
${text}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: ingestSchema,
      systemInstruction: 'You are an expert data parser. You extract structured data from unstructured event descriptions. You deduce missing fields like tags, target audience, difficulty level, and calculate a clean, context-aware 2-sentence summary.',
    }
  });

  const textOutput = response.text;
  if (!textOutput) {
    throw new Error('Gemini API returned an empty response.');
  }

  try {
    return JSON.parse(textOutput) as IngestedQuest;
  } catch (error) {
    throw new Error(`Failed to parse Gemini JSON output: ${textOutput}`);
  }
}

/**
 * Validates, checks for duplicates using dual-layer deduplication, and inserts or updates a quest.
 */
export async function ingestQuest(rawData: IngestedQuest, overrideDb?: Pool | any): Promise<{ status: 'inserted' | 'duplicate_merged'; id: string }> {
  // 1. Data Validation Checks
  if (!rawData.title || rawData.title.trim() === '') {
    throw new Error('Validation Error: Missing title.');
  }
  if (!rawData.start_date || isNaN(Date.parse(rawData.start_date))) {
    throw new Error('Validation Error: Missing or invalid start_date.');
  }
  if (!rawData.raw_source_url || rawData.raw_source_url.trim() === '') {
    throw new Error('Validation Error: Missing raw_source_url.');
  }

  const startDate = new Date(rawData.start_date);
  const endDate = new Date(rawData.end_date);
  if (startDate > endDate) {
    throw new Error('Validation Error: start_date must occur before end_date.');
  }

  // 2. Generate Embedding
  const embedding = await generateEmbedding(rawData.title, rawData.organizer, rawData.summary);

  const client = overrideDb || pool;

  // 3. Check if DB is in Mock Mode
  if (client.isMock) {
    return client.checkAndIngest(rawData, embedding);
  }

  try {
    // Layer A (Spatial-Temporal Check) & Layer B (Vector cosine distance matching)
    // ST_DWithin is applied with geography casting to calculate distance in meters (8000m).
    // pgvector <=> operator returns cosine distance (cosine similarity = 1 - cosine_distance).
    const checkQuery = `
      SELECT id, tags, (1 - (embedding <=> $4::vector)) as similarity
      FROM side_quests
      WHERE start_date = $1
        AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 8000)
      ORDER BY similarity DESC
      LIMIT 1;
    `;
    const checkResult = await client.query(checkQuery, [
      rawData.start_date,
      rawData.longitude,
      rawData.latitude,
      `[${embedding.join(',')}]`,
    ]);

    if (checkResult.rows.length > 0) {
      const bestMatch = checkResult.rows[0];
      const similarity = parseFloat(bestMatch.similarity);
      if (similarity > 0.92) {
        console.log(`[INGESTOR] Duplicate detected: Cosine Similarity = ${similarity.toFixed(4)} (> 0.92). Merging...`);
        
        // Update last_crawled and merge arrays uniquely in PostgreSQL
        const updateQuery = `
          UPDATE side_quests
          SET last_crawled = CURRENT_TIMESTAMP,
              tags = ARRAY(SELECT DISTINCT unnest(array_cat(tags, $2::text[])))
          WHERE id = $1;
        `;
        await client.query(updateQuery, [bestMatch.id, rawData.tags]);
        return { status: 'duplicate_merged', id: bestMatch.id };
      }
    }

    // Clean Insert
    const insertQuery = `
      INSERT INTO side_quests (
        title, organizer, status, lifecycle_type, application_deadline,
        start_date, end_date, price, currency, formatted_address,
        coordinates, embedding, tags, last_crawled
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        ST_SetSRID(ST_MakePoint($11, $12), 4326),
        $13::vector, $14, CURRENT_TIMESTAMP
      ) RETURNING id;
    `;
    
    const insertResult = await client.query(insertQuery, [
      rawData.title,
      rawData.organizer,
      rawData.status,
      rawData.lifecycle_type,
      rawData.application_deadline,
      rawData.start_date,
      rawData.end_date,
      rawData.price,
      rawData.currency,
      rawData.formatted_address,
      rawData.longitude,
      rawData.latitude,
      `[${embedding.join(',')}]`,
      rawData.tags
    ]);

    return { status: 'inserted', id: insertResult.rows[0].id };
  } catch (error) {
    console.error('[INGESTOR] PostgreSQL database query failed.', error);
    throw error;
  }
}
