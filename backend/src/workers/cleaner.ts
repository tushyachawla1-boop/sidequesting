import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/sidequest',
});

export interface QuestLinkStatus {
  id: string;
  title: string;
  raw_source_url: string;
  status: string;
  retry_count: number;
  last_crawled: Date;
}

/**
 * Checks a URL for link rot or root redirections.
 * Returns the final URL, status code, and whether it redirected to home root.
 */
export async function verifyLinkStatus(url: string): Promise<{ statusCode: number; finalUrl: string; isRootRedirect: boolean }> {
  try {
    // Lightweight HEAD request
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'SidequestCleaner/1.0' }
    });

    // If HEAD fails with 405 or other method errors, fallback to GET
    if (response.status === 405 || response.status === 404) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'SidequestCleaner/1.0' }
      });
    }

    const finalUrl = response.url;
    const statusCode = response.status;

    // Check if the link redirected straight to a global homepage root directory
    let isRootRedirect = false;
    try {
      const parsedOriginal = new URL(url);
      const parsedFinal = new URL(finalUrl);

      const originalPath = parsedOriginal.pathname.replace(/\/$/, '');
      const finalPath = parsedFinal.pathname.replace(/\/$/, '');

      // If original path was not root, but final path is root, it is a root redirect
      if (originalPath !== '' && finalPath === '') {
        isRootRedirect = true;
      }
    } catch {
      // Ignore URL parsing errors
    }

    return { statusCode, finalUrl, isRootRedirect };
  } catch (error) {
    // Return 500 if the connection itself fails (host unresolved, timeout, etc.)
    return { statusCode: 500, finalUrl: url, isRootRedirect: false };
  }
}

/**
 * Main automated cleaner loop. Runs against the DB or a Mock client.
 */
export async function runCleaner(overrideDb?: Pool | any): Promise<{ expired: string[]; suspended: string[]; verified: string[] }> {
  const client = overrideDb || pool;
  
  const expired: string[] = [];
  const suspended: string[] = [];
  const verified: string[] = [];

  // Check if DB is in Mock Mode
  if (client.isMock) {
    return client.runCleanerCheck();
  }

  try {
    // Find active listings where last_crawled is older than 48 hours
    const fetchQuery = `
      SELECT id, title, raw_source_url, status, retry_count, last_crawled
      FROM side_quests
      WHERE status = 'active'
        AND last_crawled < NOW() - INTERVAL '48 hours';
    `;
    const result = await client.query(fetchQuery);
    const quests: QuestLinkStatus[] = result.rows;

    console.log(`[CLEANER] Found ${quests.length} active listings older than 48 hours to verify.`);

    for (const quest of quests) {
      console.log(`[CLEANER] Verifying "${quest.title}" (${quest.raw_source_url})...`);
      const { statusCode, isRootRedirect } = await verifyLinkStatus(quest.raw_source_url);

      if (statusCode === 404 || statusCode === 410 || isRootRedirect) {
        // Expire immediately
        console.log(`[CLEANER] Link rot detected (status: ${statusCode}, rootRedirect: ${isRootRedirect}). Expiring: ${quest.id}`);
        await client.query(
          `UPDATE side_quests SET status = 'Expired', retry_count = 0, last_crawled = CURRENT_TIMESTAMP WHERE id = $1;`,
          [quest.id]
        );
        expired.push(quest.id);
      } else if (statusCode >= 500 && statusCode < 600) {
        // Increment retry count for temporary server errors
        const newRetryCount = quest.retry_count + 1;
        console.log(`[CLEANER] Temporary error ${statusCode} received. Retry count: ${newRetryCount}/3. ID: ${quest.id}`);

        if (newRetryCount >= 3) {
          console.log(`[CLEANER] Threshold reached. Suspending listing ID: ${quest.id}`);
          await client.query(
            `UPDATE side_quests SET status = 'Suspended', retry_count = $2, last_crawled = CURRENT_TIMESTAMP WHERE id = $1;`,
            [quest.id, newRetryCount]
          );
          suspended.push(quest.id);
        } else {
          await client.query(
            `UPDATE side_quests SET retry_count = $2, last_crawled = CURRENT_TIMESTAMP WHERE id = $1;`,
            [quest.id, newRetryCount]
          );
          verified.push(quest.id);
        }
      } else if (statusCode >= 200 && statusCode < 300) {
        // Link is healthy, reset retry count and update last_crawled
        console.log(`[CLEANER] Link is healthy (status: ${statusCode}). Resetting retry count. ID: ${quest.id}`);
        await client.query(
          `UPDATE side_quests SET retry_count = 0, last_crawled = CURRENT_TIMESTAMP WHERE id = $1;`,
          [quest.id]
        );
        verified.push(quest.id);
      }
    }
  } catch (error) {
    console.error('[CLEANER] Database execution failed.', error);
    throw error;
  }

  return { expired, suspended, verified };
}
