import dotenv from 'dotenv';
import { parseUnstructuredText, ingestQuest, IngestedQuest } from '../src/workers/ingestor.js';

dotenv.config();

/**
 * Robust in-memory mock database client for testing spatial-temporal and vector similarity checks.
 * Uses exact Haversine distance for spatial radius (8000m) and cosine similarity for 1536-dimensional vectors.
 */
class MockDbClient {
  public isMock = true;
  private store: Array<{
    id: string;
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
    embedding: number[];
    tags: string[];
    last_crawled: Date;
  }> = [];

  // Haversine distance in meters
  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Cosine similarity
  private getCosineSimilarity(v1: number[], v2: number[]): number {
    if (v1.length !== v2.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      normA += v1[i] * v1[i];
      normB += v2[i] * v2[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public checkAndIngest(rawData: IngestedQuest, embedding: number[]) {
    console.log(`\n[MOCK DB] Processing ingest check for: "${rawData.title}"`);
    console.log(`[MOCK DB] Location: Lat ${rawData.latitude}, Lon ${rawData.longitude} | Start Date: ${rawData.start_date}`);

    // Layer A: Spatial-temporal search (same start_date, within 8000m radius)
    const spatialTemporalCandidates = this.store.filter(item => {
      const sameDate = item.start_date === rawData.start_date;
      const dist = this.getDistance(item.latitude, item.longitude, rawData.latitude, rawData.longitude);
      
      console.log(`  -> Candidate comparison with "${item.title}": Same Date = ${sameDate}, Distance = ${dist.toFixed(1)}m`);
      return sameDate && dist <= 8000;
    });

    console.log(`[MOCK DB] Layer A filtered candidates count: ${spatialTemporalCandidates.length}`);

    // Layer B: Vector cosine similarity matching
    let bestMatch: any = null;
    let highestSimilarity = -1;

    for (const candidate of spatialTemporalCandidates) {
      const similarity = this.getCosineSimilarity(candidate.embedding, embedding);
      console.log(`  -> Cosine similarity with candidate "${candidate.title}": ${similarity.toFixed(4)}`);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = candidate;
      }
    }

    // Programmatic threshold check
    if (bestMatch && highestSimilarity > 0.92) {
      console.log(`[MOCK DB] Layer B Match Found! Cosine similarity ${highestSimilarity.toFixed(4)} is greater than threshold 0.92.`);
      console.log(`[MOCK DB] Merging tags and updating last_crawled for existing record ID: ${bestMatch.id}`);

      // Merge tags uniquely
      const originalTags = [...bestMatch.tags];
      bestMatch.tags = Array.from(new Set([...bestMatch.tags, ...rawData.tags]));
      bestMatch.last_crawled = new Date();

      console.log(`  - Original Tags: [${originalTags.join(', ')}]`);
      console.log(`  - Incoming Tags: [${rawData.tags.join(', ')}]`);
      console.log(`  - Merged Tags:   [${bestMatch.tags.join(', ')}]`);
      console.log(`  - Updated last_crawled to: ${bestMatch.last_crawled.toISOString()}`);

      return { status: 'duplicate_merged' as const, id: bestMatch.id };
    }

    // Clean Insert
    const newId = `mock-uuidv7-${Math.floor(Date.now() / 1000).toString(16)}-${Math.floor(Math.random() * 10000)}`;
    const newRecord = {
      ...rawData,
      id: newId,
      embedding,
      last_crawled: new Date()
    };
    this.store.push(newRecord);
    console.log(`[MOCK DB] No duplicates found. Clean insert completed. Saved with ID: ${newId}`);
    return { status: 'inserted' as const, id: newId };
  }

  public getRecord(id: string) {
    return this.store.find(item => item.id === id);
  }
}

async function runTestHarness() {
  console.log('========================================================================');
  console.log('                 AI INGESTION & DEDUPLICATION TEST HARNESS              ');
  console.log('========================================================================');

  const mockDb = new MockDbClient();

  // Test Case 1: Unstructured text of Quantum Computing Workshop
  const rawTextSnippet1 = `
    Quantum Computing Workshop
    Presented by: MIT Physics Department
    Date: August 15, 2026, 9:00 AM - 5:00 PM
    Location: MIT campus (77 Massachusetts Ave, Cambridge, MA 02139)
    Cost: Free admission
    Registration: Open until August 1, 2026
    Url: https://mit.edu/quantum-workshop
    Description:
    Join us for a comprehensive one-day workshop introducing quantum computation basics. 
    Ideal for students, developers, and researchers. Learn about qubits, quantum gates, 
    and simple algorithms. Prerequisites: linear algebra basics.
  `;

  console.log('\n--- [TEST CASE 1] Ingesting original event description ---');
  console.log('Sending text snippet to parser...');
  const quest1 = await parseUnstructuredText(rawTextSnippet1);
  console.log('\nParsed JSON Output from AI Ingestion Engine:');
  console.log(JSON.stringify(quest1, null, 2));

  console.log('\nSubmitting to ingestion pipeline...');
  const result1 = await ingestQuest(quest1, mockDb);
  console.log('Ingestion result:', result1);

  // Test Case 2: Ingesting the same event description (re-parsed/re-crawled)
  // We'll add some slightly updated tags inside this duplicate snippet to test tagging merge
  const rawTextSnippet2 = `
    Second Call: Quantum Computing Workshop
    Presented by: MIT Physics Department
    When: August 15, 2026, 9:00 AM to 5:00 PM
    Where: 77 Massachusetts Ave, Cambridge, MA 02139 (MIT campus)
    Registration deadline: August 1, 2026
    Web: https://mit.edu/quantum-workshop
    Prerequisites: linear algebra.
    Summary: A comprehensive one-day workshop introducing quantum computation basics. 
    Learn qubits, quantum gates, and simple circuits. Free.
  `;

  console.log('\n--- [TEST CASE 2] Ingesting identical event (re-crawled) ---');
  console.log('Sending re-crawled text snippet to parser...');
  const quest2 = await parseUnstructuredText(rawTextSnippet2);
  
  console.log('\nParsed JSON Output from AI Ingestion Engine:');
  console.log(JSON.stringify(quest2, null, 2));

  console.log('\nSubmitting to ingestion pipeline...');
  const result2 = await ingestQuest(quest2, mockDb);
  console.log('Ingestion result:', result2);

  // Asserting duplicate was merged
  if (result2.status === 'duplicate_merged' && result2.id === result1.id) {
    console.log('\nSUCCESS: Duplicate event was blocked and merged correctly into ID:', result2.id);
    const updatedRecord = mockDb.getRecord(result1.id);
    console.log('Verifying merged record:');
    console.log(`  - Title: ${updatedRecord?.title}`);
    console.log(`  - Tags:  [${updatedRecord?.tags.join(', ')}]`);
    console.log(`  - Last Crawled: ${updatedRecord?.last_crawled.toISOString()}`);
  } else {
    console.error('\nFAILURE: Event deduplication failed to detect duplicate.');
  }

  // Test Case 3: Ingesting validation failure
  console.log('\n--- [TEST CASE 3] Ingesting invalid quest (missing title) ---');
  const invalidQuestMissingTitle: IngestedQuest = {
    ...quest1,
    title: ''
  };
  try {
    console.log('Submitting invalid quest (missing title)...');
    await ingestQuest(invalidQuestMissingTitle, mockDb);
    console.error('FAILURE: Expected validation error for missing title, but insert succeeded.');
  } catch (error: any) {
    console.log('SUCCESS: Validation failed as expected with error:', error.message);
  }

  console.log('\n--- [TEST CASE 4] Ingesting invalid quest (missing raw_source_url) ---');
  const invalidQuestMissingUrl: IngestedQuest = {
    ...quest1,
    raw_source_url: ''
  };
  try {
    console.log('Submitting invalid quest (missing raw_source_url)...');
    await ingestQuest(invalidQuestMissingUrl, mockDb);
    console.error('FAILURE: Expected validation error for missing raw_source_url, but insert succeeded.');
  } catch (error: any) {
    console.log('SUCCESS: Validation failed as expected with error:', error.message);
  }

  console.log('\n--- [TEST CASE 5] Ingesting invalid quest (chronological error) ---');
  const invalidQuestDateOrder: IngestedQuest = {
    ...quest1,
    start_date: '2026-08-15T18:00:00Z', // Starts at 6 PM
    end_date: '2026-08-15T17:00:00Z'    // Ends at 5 PM
  };
  try {
    console.log('Submitting invalid quest (start_date > end_date)...');
    await ingestQuest(invalidQuestDateOrder, mockDb);
    console.error('FAILURE: Expected validation error for invalid chronological dates, but insert succeeded.');
  } catch (error: any) {
    console.log('SUCCESS: Validation failed as expected with error:', error.message);
  }

  console.log('\n========================================================================');
  console.log('                         ALL TEST CASES COMPLETED                       ');
  console.log('========================================================================');
}

runTestHarness().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
