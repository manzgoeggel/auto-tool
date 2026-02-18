import { buildSearchUrl } from './url-builder';
import { parseSearchResults } from './parser';
import { USER_AGENTS } from '@/lib/constants';
import type { SearchConfig } from '@/lib/db/schema';
import type { RawListing } from '@/lib/types';

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  retries: number = 3,
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Referer': 'https://www.mobile.de/',
        },
      });

      if (res.status === 429) {
        const waitTime = Math.pow(2, attempt + 1) * 5000;
        console.warn(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}`);
        await delay(waitTime);
        continue;
      }

      if (res.status === 403) {
        console.warn(`Access forbidden (attempt ${attempt + 1}/${retries})`);
        if (attempt < retries - 1) {
          await delay(5000 + Math.random() * 5000);
          continue;
        }
        throw new Error('Access forbidden by mobile.de - may need to adjust scraping approach');
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.text();
    } catch (error) {
      if (attempt === retries - 1) throw error;
      const waitTime = Math.pow(2, attempt) * 2000 + Math.random() * 2000;
      console.warn(`Fetch failed (attempt ${attempt + 1}), retrying in ${waitTime}ms:`, error);
      await delay(waitTime);
    }
  }

  throw new Error('All fetch retries exhausted');
}

export async function scrapeMobileDe(
  config: SearchConfig,
  maxPages: number = 10,
): Promise<{
  listings: RawListing[];
  totalResults?: number;
  pagesScraped: number;
  errors: string[];
}> {
  const allListings: RawListing[] = [];
  const errors: string[] = [];
  let page = 1;
  let hasMorePages = true;
  let totalResults: number | undefined;

  console.log(`Starting scrape for config: ${config.name}`);

  while (hasMorePages && page <= maxPages) {
    try {
      const url = buildSearchUrl(config, page);
      console.log(`Scraping page ${page}: ${url}`);

      const html = await fetchWithRetry(url);
      const result = parseSearchResults(html);

      if (page === 1 && result.totalResults !== undefined) {
        totalResults = result.totalResults;
        console.log(`Total results found: ${totalResults}`);
      }

      if (result.listings.length === 0) {
        console.log(`No listings found on page ${page}, stopping`);
        break;
      }

      allListings.push(...result.listings);
      hasMorePages = result.hasNext;
      page++;

      console.log(
        `Page ${page - 1}: found ${result.listings.length} listings (total: ${allListings.length})`,
      );

      // Rate limiting: random delay between 2-5 seconds
      if (hasMorePages && page <= maxPages) {
        const waitMs = 2000 + Math.random() * 3000;
        await delay(waitMs);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Page ${page}: ${msg}`);
      console.error(`Error on page ${page}:`, msg);

      // If first page fails, no point continuing
      if (page === 1) break;

      // Otherwise try next page
      page++;
      await delay(5000);
    }
  }

  // Deduplicate by externalId
  const seen = new Set<string>();
  const deduped = allListings.filter((l) => {
    if (seen.has(l.externalId)) return false;
    seen.add(l.externalId);
    return true;
  });

  console.log(
    `Scrape complete: ${deduped.length} unique listings from ${page - 1} pages`,
  );

  return {
    listings: deduped,
    totalResults,
    pagesScraped: page - 1,
    errors,
  };
}
