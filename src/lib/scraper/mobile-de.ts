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

function buildProxiedUrl(url: string): string {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) {
    throw new Error('SCRAPER_API_KEY is not set');
  }
  // render=true  → headless Chrome (handles JS-heavy pages and Cloudflare)
  // premium=true → residential proxies (bypasses IP blocks on mobile.de)
  // country_code=de → German exit node for localised content
  return `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&country_code=de&render=true&premium=true`;
}

async function fetchWithRetry(
  url: string,
  retries: number = 3,
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const proxiedUrl = buildProxiedUrl(url);
      const res = await fetch(proxiedUrl, {
        headers: {
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (res.status === 429) {
        const waitTime = Math.pow(2, attempt + 1) * 10000;
        console.warn(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}`);
        await delay(waitTime);
        continue;
      }

      if (res.status === 403 || res.status === 500) {
        // 500 from ScraperAPI = target blocked the request; retry with longer back-off
        console.warn(`ScraperAPI returned ${res.status} (attempt ${attempt + 1}/${retries}) — retrying`);
        if (attempt < retries - 1) {
          await delay(10000 + Math.random() * 5000);
          continue;
        }
        throw new Error(`ScraperAPI ${res.status} after ${retries} attempts — mobile.de is blocking`);
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
  existingIds: Set<string> = new Set(),
): Promise<{
  listings: RawListing[];
  newCount: number;
  updatedCount: number;
  totalResults?: number;
  pagesScraped: number;
  errors: string[];
}> {
  const allListings: RawListing[] = [];
  const errors: string[] = [];
  let page = 1;
  let hasMorePages = true;
  let totalResults: number | undefined;

  console.log(`Starting scrape for config: ${config.name} (${existingIds.size} known IDs to skip detail fetch)`);

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

      // Rate limiting: random delay between 3-6 seconds (render=true requests are slower)
      if (hasMorePages && page <= maxPages) {
        const waitMs = 3000 + Math.random() * 3000;
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

  // Deduplicate within this scrape run by externalId
  const seen = new Set<string>();
  const deduped = allListings.filter((l) => {
    if (seen.has(l.externalId)) return false;
    seen.add(l.externalId);
    return true;
  });

  // Split into new (need detail fetch) and already-known (skip detail fetch)
  const newListings = deduped.filter((l) => !existingIds.has(l.externalId));
  const knownListings = deduped.filter((l) => existingIds.has(l.externalId));

  console.log(
    `Scrape complete: ${deduped.length} unique listings (${newListings.length} new, ${knownListings.length} already known). Fetching detail pages for new ones...`,
  );

  // NOTE: Detail page enrichment (VAT, description, features, country) is intentionally
  // NOT done here during scraping to avoid Vercel function timeouts.
  // Use the separate "Enrich Listings" action in Settings after scraping.

  console.log(`Scrape complete. ${newListings.length} new listings saved (without detail enrichment). Run "Enrich Listings" to fetch VAT/details.`);

  return {
    listings: deduped,
    newCount: newListings.length,
    updatedCount: knownListings.length,
    totalResults,
    pagesScraped: page - 1,
    errors,
  };
}
