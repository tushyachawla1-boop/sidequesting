import { runCleaner, verifyLinkStatus } from '../src/workers/cleaner.js';

/**
 * Mock database client to test cleaner transition states and conditions.
 */
class MockDbClient {
  public isMock = true;
  public store = [
    {
      id: 'quest-expired-404',
      title: 'Rotten Quest (404)',
      raw_source_url: 'https://httpstat.us/404',
      status: 'active',
      retry_count: 0,
      last_crawled: new Date(Date.now() - 50 * 60 * 60 * 1000) // 50 hours ago
    },
    {
      id: 'quest-expired-redirect',
      title: 'Redirected Quest (Root)',
      raw_source_url: 'https://mit.edu/redirect-to-homepage', // We will mock this response specifically
      status: 'active',
      retry_count: 0,
      last_crawled: new Date(Date.now() - 60 * 60 * 60 * 1000) // 60 hours ago
    },
    {
      id: 'quest-temp-500',
      title: 'Temporary Server Error (500)',
      raw_source_url: 'https://httpstat.us/500',
      status: 'active',
      retry_count: 0,
      last_crawled: new Date(Date.now() - 49 * 60 * 60 * 1000) // 49 hours ago
    },
    {
      id: 'quest-suspended-500',
      title: 'About to Suspend (500)',
      raw_source_url: 'https://httpstat.us/503',
      status: 'active',
      retry_count: 2, // Already failed twice
      last_crawled: new Date(Date.now() - 55 * 60 * 60 * 1000) // 55 hours ago
    },
    {
      id: 'quest-healthy',
      title: 'Healthy Quest (200)',
      raw_source_url: 'https://httpstat.us/200',
      status: 'active',
      retry_count: 1, // Should reset to 0
      last_crawled: new Date(Date.now() - 52 * 60 * 60 * 1000) // 52 hours ago
    },
    {
      id: 'quest-recently-crawled',
      title: 'Recently Crawled Quest',
      raw_source_url: 'https://httpstat.us/404', // Even though broken, last_crawled is too fresh
      status: 'active',
      retry_count: 0,
      last_crawled: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago (should be skipped)
    }
  ];

  public async runCleanerCheck() {
    const expired: string[] = [];
    const suspended: string[] = [];
    const verified: string[] = [];

    // Filter quests: active and last_crawled older than 48 hours
    const cutOff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const candidateQuests = this.store.filter(q => q.status === 'active' && q.last_crawled < cutOff);

    console.log(`[MOCK DB] Running cleaner check. Found ${candidateQuests.length} candidate quests.`);

    for (const quest of candidateQuests) {
      console.log(`\n[MOCK DB] Processing cleaner for "${quest.title}" (${quest.raw_source_url})...`);
      
      let statusCode = 200;
      let isRootRedirect = false;

      // Mock verifyLinkStatus response based on URL to keep tests reliable and avoid actual web dependency
      if (quest.raw_source_url.includes('404')) {
        statusCode = 404;
      } else if (quest.raw_source_url.includes('redirect-to-homepage')) {
        statusCode = 200;
        isRootRedirect = true; // Simulating a redirect to global home page
      } else if (quest.raw_source_url.includes('500') || quest.raw_source_url.includes('503')) {
        statusCode = 500;
      } else if (quest.raw_source_url.includes('200')) {
        statusCode = 200;
      }

      if (statusCode === 404 || statusCode === 410 || isRootRedirect) {
        console.log(`  -> Status Code: ${statusCode} | Root Redirect: ${isRootRedirect} -> TRANSITION TO 'Expired'`);
        quest.status = 'Expired';
        quest.retry_count = 0;
        quest.last_crawled = new Date();
        expired.push(quest.id);
      } else if (statusCode >= 500 && statusCode < 600) {
        quest.retry_count += 1;
        console.log(`  -> Status Code: ${statusCode} -> Incremented retry_count to ${quest.retry_count}/3`);
        
        if (quest.retry_count >= 3) {
          console.log(`  -> Retry count reached limit. TRANSITION TO 'Suspended'`);
          quest.status = 'Suspended';
          quest.last_crawled = new Date();
          suspended.push(quest.id);
        } else {
          quest.last_crawled = new Date();
          verified.push(quest.id);
        }
      } else if (statusCode === 200) {
        console.log(`  -> Status Code: 200 -> Resetting retry_count to 0 | Keeping status 'active'`);
        quest.retry_count = 0;
        quest.last_crawled = new Date();
        verified.push(quest.id);
      }
    }

    return { expired, suspended, verified };
  }

  public getRecord(id: string) {
    return this.store.find(item => item.id === id);
  }
}

async function runTestHarness() {
  console.log('========================================================================');
  console.log('                   AUTOMATED CLEANER WORKER TEST HARNESS                ');
  console.log('========================================================================');

  const mockDb = new MockDbClient();

  // Run the cleaner
  const result = await runCleaner(mockDb);

  console.log('\n========================================================================');
  console.log('                           CLEANER RUN RESULTS                          ');
  console.log('========================================================================');
  console.log('Expired IDs:  ', result.expired);
  console.log('Suspended IDs:', result.suspended);
  console.log('Verified IDs: ', result.verified);

  console.log('\n========================================================================');
  console.log('                        VERIFYING TRANSITIONS                           ');
  console.log('========================================================================');

  // Verify Quest 1 (404) -> Expired
  const quest404 = mockDb.getRecord('quest-expired-404');
  console.log(`Quest (404) Status: ${quest404?.status} | Retry Count: ${quest404?.retry_count} (Expected: Expired / 0)`);
  if (quest404?.status !== 'Expired') throw new Error('Assertion Failed: quest-expired-404 did not expire.');

  // Verify Quest 2 (Redirect) -> Expired
  const questRedirect = mockDb.getRecord('quest-expired-redirect');
  console.log(`Quest (Redirect) Status: ${questRedirect?.status} | Retry Count: ${questRedirect?.retry_count} (Expected: Expired / 0)`);
  if (questRedirect?.status !== 'Expired') throw new Error('Assertion Failed: quest-expired-redirect did not expire.');

  // Verify Quest 3 (500, first retry) -> active, retry_count = 1
  const quest500Temp = mockDb.getRecord('quest-temp-500');
  console.log(`Quest (500 Temp) Status: ${quest500Temp?.status} | Retry Count: ${quest500Temp?.retry_count} (Expected: active / 1)`);
  if (quest500Temp?.status !== 'active' || quest500Temp?.retry_count !== 1) {
    throw new Error('Assertion Failed: quest-temp-500 state is incorrect.');
  }

  // Verify Quest 4 (500, third retry) -> Suspended
  const quest500Suspend = mockDb.getRecord('quest-suspended-500');
  console.log(`Quest (500 Suspend) Status: ${quest500Suspend?.status} | Retry Count: ${quest500Suspend?.retry_count} (Expected: Suspended / 3)`);
  if (quest500Suspend?.status !== 'Suspended') throw new Error('Assertion Failed: quest-suspended-500 did not suspend.');

  // Verify Quest 5 (Healthy) -> active, retry_count = 0
  const questHealthy = mockDb.getRecord('quest-healthy');
  console.log(`Quest (Healthy) Status: ${questHealthy?.status} | Retry Count: ${questHealthy?.retry_count} (Expected: active / 0)`);
  if (questHealthy?.status !== 'active' || questHealthy?.retry_count !== 0) {
    throw new Error('Assertion Failed: quest-healthy state was not reset.');
  }

  // Verify Quest 6 (Freshly crawled, should not be updated or run)
  const questFresh = mockDb.getRecord('quest-recently-crawled');
  console.log(`Quest (Freshly Crawled) Status: ${questFresh?.status} (Expected: active - untouched)`);
  if (result.expired.includes('quest-recently-crawled')) {
    throw new Error('Assertion Failed: quest-recently-crawled was incorrectly processed.');
  }

  console.log('\nSUCCESS: All cleaner state transitions verified successfully!');
}

runTestHarness().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
