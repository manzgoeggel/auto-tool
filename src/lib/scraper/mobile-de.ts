import { buildSearchUrl } from './url-builder';
import { parseSearchResults } from './parser';
import { fetchUnblocked, CookieJar, getProvider } from './fetch-proxy';
import type { SearchConfig } from '@/lib/db/schema';
import type { RawListing } from '@/lib/types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  let consecutiveEmpty = 0;

  // One cookie jar per scrape session — Bright Data passes cookies through,
  // so maintaining a session makes the traffic look more legitimate.
  const jar = new CookieJar();

  console.log(
    `[scraper] Starting scrape for config: "${config.name}" ` +
    `(${existingIds.size} known IDs, provider: ${getProvider()})`,
  );

  while (hasMorePages && page <= maxPages) {
    try {
      const url = buildSearchUrl(config, page);
      console.log(`[scraper] Page ${page}: ${url}`);

      const { html, setCookie } = await fetchUnblocked(url, {
        cookies: jar.toString(),
        timeoutMs: 90_000,
        retries: 4,
      });

      // Merge any new cookies into our session jar
      jar.merge(setCookie);

      const result = parseSearchResults(html);

      if (page === 1 && result.totalResults !== undefined) {
        totalResults = result.totalResults;
        console.log(`[scraper] Total results on mobile.de: ${totalResults}`);
      }

      if (result.listings.length === 0) {
        consecutiveEmpty++;
        console.log(`[scraper] No listings on page ${page} (empty run #${consecutiveEmpty})`);
        if (consecutiveEmpty >= 2) {
          console.log('[scraper] Two consecutive empty pages — stopping');
          break;
        }
        page++;
        continue;
      }

      consecutiveEmpty = 0;
      allListings.push(...result.listings);
      hasMorePages = result.hasNext;

      console.log(
        `[scraper] Page ${page}: ${result.listings.length} listings ` +
        `(total so far: ${allListings.length}${totalResults ? '/' + totalResults : ''})`,
      );

      // Stop early if we've collected everything
      if (totalResults !== undefined && allListings.length >= totalResults) {
        console.log(`[scraper] Collected all ${totalResults} results — stopping`);
        break;
      }

      page++;

      // Polite delay between pages: 4–8 seconds with randomisation
      // (longer than before since Bright Data requests are metered)
      if (hasMorePages && page <= maxPages) {
        const waitMs = 4000 + Math.random() * 4000;
        console.log(`[scraper] Waiting ${Math.round(waitMs / 1000)}s before next page…`);
        await delay(waitMs);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Page ${page}: ${msg}`);
      console.error(`[scraper] Error on page ${page}:`, msg);

      // First page failure — no point continuing
      if (page === 1) break;

      // Subsequent page failure — wait and try the next page
      page++;
      await delay(8000);
    }
  }

  // Deduplicate within this scrape run
  const seen = new Set<string>();
  const deduped = allListings.filter((l) => {
    if (seen.has(l.externalId)) return false;
    seen.add(l.externalId);
    return true;
  });

  const newListings = deduped.filter((l) => !existingIds.has(l.externalId));
  const knownListings = deduped.filter((l) => existingIds.has(l.externalId));

  console.log(
    `[scraper] Done: ${deduped.length} unique (${newListings.length} new, ` +
    `${knownListings.length} known). ` +
    `Run "Enrich Listings" to fetch VAT/details.`,
  );

  return {
    listings: deduped,
    newCount: newListings.length,
    updatedCount: knownListings.length,
    totalResults,
    pagesScraped: page - 1,
    errors,
  };
}
