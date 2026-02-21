/**
 * fetch-proxy.ts
 *
 * Centralised "fetch a URL through an unblocking proxy" utility.
 *
 * Primary provider: Bright Data Web Unlocker
 *   Uses Bright Data's "Proxy API" REST endpoint — works from Vercel serverless
 *   without needing a proxy agent (no HTTP CONNECT required).
 *   - Handles TLS fingerprinting, residential IPs, CAPTCHA, JS rendering
 *   - Only successful responses are billed (~$1–$1.50 per 1,000 requests)
 *   - German exit node for localised content
 *
 * Fallback: ScraperAPI (used when Bright Data env vars are absent)
 *
 * Required env vars (Bright Data):
 *   BRIGHTDATA_API_TOKEN  — API token from brightdata.com → Account → API Token
 *   BRIGHTDATA_ZONE       — Web Unlocker zone name (default "web_unlocker1")
 *
 * Legacy fallback:
 *   SCRAPER_API_KEY       — ScraperAPI key (used only when BRIGHTDATA_API_TOKEN is absent)
 */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Bright Data Web Unlocker ─────────────────────────────────────────────────
//
// Bright Data's Web Unlocker works as an HTTPS proxy (HTTP CONNECT tunnel).
// Node's built-in fetch() does NOT support HTTP proxy agents.
//
// Solution: use Bright Data's "Proxy API" REST endpoint:
//   POST https://api.brightdata.com/request
//   Authorization: Bearer <API_TOKEN>
//   Body: { url, zone, country, format: "raw" }
//
// Alternatively, use the superproxy in "direct fetch" mode by embedding
// credentials in the URL with the undici/https-proxy-agent package.
//
// We use the REST API approach since it requires zero extra npm packages
// and works identically across Node/Vercel/Edge runtimes.
//
// Sign up at brightdata.com → Products → Web Unlocker
// Your API token: brightdata.com → Account → API Token

function getBrightDataConfig(): {
  apiToken: string;
  zone: string;
} {
  const apiToken = process.env.BRIGHTDATA_API_TOKEN;
  const zone = process.env.BRIGHTDATA_ZONE || 'web_unlocker1';

  if (!apiToken) {
    throw new Error('BRIGHTDATA_API_TOKEN must be set');
  }

  return { apiToken, zone };
}

// Chrome 120 headers — sent in correct order to match browser fingerprint
const CHROME_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-CH-UA': '"Google Chrome";v="120", "Chromium";v="120", "Not-A.Brand";v="24"',
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchViaBrightData(
  url: string,
  cookies: string,
  timeoutMs: number,
): Promise<{ html: string; setCookie: string }> {
  const { apiToken, zone } = getBrightDataConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Build the headers we want the unlocker to send to mobile.de
    const forwardHeaders: Record<string, string> = {
      ...CHROME_HEADERS,
      ...(cookies ? { 'Cookie': cookies } : {}),
    };

    // Bright Data Proxy API — REST endpoint, no proxy agent needed
    // Docs: https://docs.brightdata.com/scraping-automation/web-unlocker/web-unlocker-api
    const res = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zone,
        url,
        format: 'raw',            // return raw HTML
        country: 'de',             // German exit node
        headers: forwardHeaders,   // headers forwarded to the target
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Bright Data API ${res.status}: ${body.slice(0, 300)}`);
    }

    const html = await res.text();
    const setCookie = res.headers.get('set-cookie') || '';
    return { html, setCookie };
  } finally {
    clearTimeout(timer);
  }
}

// ─── ScraperAPI fallback ──────────────────────────────────────────────────────
//
// Strategy: try cheapest/fastest mode first, escalate on failure:
//   1. premium=true only (residential IP, no headless browser) — fast, ~5-15s
//   2. render=true&premium=true (residential + headless Chrome) — slow, ~30-60s
//
// mobile.de search result pages are server-side rendered — they don't need
// a headless browser. Most blocks are IP-reputation based, so premium proxies
// alone (without render) often succeed and are ~5x faster.

function buildScraperApiUrl(url: string, render: boolean): string {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error('SCRAPER_API_KEY is not set');
  const base = `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&country_code=de&premium=true`;
  return render ? base + '&render=true' : base;
}

async function fetchViaScraperApi(
  url: string,
  timeoutMs: number,
): Promise<{ html: string; setCookie: string }> {
  // Attempt 1: premium residential proxy, no render (fast)
  for (const render of [false, true]) {
    const controller = new AbortController();
    // No-render mode: 30s is plenty. Render mode: allow up to timeoutMs.
    const perAttemptTimeout = render ? timeoutMs : Math.min(30_000, timeoutMs);
    const timer = setTimeout(() => controller.abort(), perAttemptTimeout);
    try {
      const res = await fetch(buildScraperApiUrl(url, render), {
        headers: CHROME_HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 403 || res.status === 500) {
        if (!render) {
          console.warn(`[fetch-proxy] ScraperAPI ${res.status} without render — escalating to render=true`);
          continue; // try with render
        }
        throw new Error(`ScraperAPI ${res.status} even with render=true — blocked`);
      }
      if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
      const html = await res.text();
      console.log(`[fetch-proxy] ScraperAPI success (render=${render}, ${html.length} bytes)`);
      return { html, setCookie: '' };
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      if (!render) {
        console.warn(`[fetch-proxy] ScraperAPI no-render failed (${msg}) — escalating to render=true`);
        continue;
      }
      throw err; // render=true also failed — let outer retry handle it
    }
  }
  throw new Error('ScraperAPI: all modes exhausted');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getProvider(): 'brightdata' | 'scraperapi' {
  return process.env.BRIGHTDATA_API_TOKEN ? 'brightdata' : 'scraperapi';
}

/**
 * Fetch a URL through the configured unblocking proxy with automatic retry.
 *
 * @param url        Target URL to fetch
 * @param options    Optional: cookies (for session continuity), timeoutMs, retries
 * @returns          { html, setCookie } — setCookie should be merged into session
 */
export async function fetchUnblocked(
  url: string,
  options: {
    cookies?: string;
    timeoutMs?: number;
    retries?: number;
  } = {},
): Promise<{ html: string; setCookie: string }> {
  const { cookies = '', timeoutMs = 90_000, retries = 3 } = options;
  const provider = getProvider();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      let result: { html: string; setCookie: string };

      if (provider === 'brightdata') {
        result = await fetchViaBrightData(url, cookies, timeoutMs);
      } else {
        result = await fetchViaScraperApi(url, timeoutMs);
      }

      // Sanity check: if we got an empty or obviously blocked page, throw
      if (result.html.length < 500) {
        throw new Error(`Response too short (${result.html.length} bytes) — likely blocked`);
      }

      // Cloudflare challenge page detection
      if (
        result.html.includes('cf-browser-verification') ||
        result.html.includes('cf_clearance') ||
        result.html.includes('Just a moment...') ||
        result.html.includes('Enable JavaScript and cookies to continue')
      ) {
        throw new Error('Got Cloudflare challenge page — proxy did not bypass it');
      }

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[fetch-proxy] Attempt ${attempt + 1}/${retries} failed for ${url}: ${msg}`);

      if (attempt < retries - 1) {
        // Exponential backoff with jitter: 3s, 8s, 20s
        const baseDelay = Math.pow(2.5, attempt) * 3000;
        const jitter = Math.random() * 3000;
        const wait = Math.round(baseDelay + jitter);
        console.log(`[fetch-proxy] Waiting ${Math.round(wait / 1000)}s before retry…`);
        await delay(wait);
      } else {
        throw new Error(`[fetch-proxy] All ${retries} attempts failed for ${url}: ${msg}`);
      }
    }
  }

  throw new Error('fetch-proxy: unreachable');
}

/**
 * Simple cookie jar for a scrape session.
 * Merges Set-Cookie response headers into a single cookie string.
 */
export class CookieJar {
  private cookies: Map<string, string> = new Map();

  /** Merge a Set-Cookie header string into the jar */
  merge(setCookieHeader: string): void {
    if (!setCookieHeader) return;
    // Set-Cookie headers can be comma-separated (though technically should be one per header)
    const pairs = setCookieHeader.split(/,(?=[^;]+=[^;]+)/);
    for (const pair of pairs) {
      const [nameValue] = pair.trim().split(';');
      const [name, value] = nameValue.split('=').map((s) => s.trim());
      if (name) this.cookies.set(name, value ?? '');
    }
  }

  /** Get cookie string to send in requests */
  toString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}
