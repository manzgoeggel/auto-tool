import { load } from 'cheerio';
import { getVatRateForCountry } from '@/lib/constants';

export interface DetailPageData {
  vatDeductible: boolean;
  hasAccidentDamage: boolean;
  description?: string;
  features?: string[];
  sellerName?: string;
  color?: string;
  bodyType?: string;
  country?: string;
  sourceVatRate?: number;
}

export function parseDetailPage(html: string): DetailPageData {
  const $ = load(html);
  const allText = $.text();

  // --- Country detection ---
  // Try structured data first (schema.org, meta tags, data attributes)
  const countryCode = detectCountry($, allText);
  const sourceVatRate = getVatRateForCountry(countryCode);

  // VAT deductible — look for all known patterns from detail pages (DE, AT, FR, NL, IT, ES, etc.)
  const vatDeductible =
    // German patterns
    allText.includes('MwSt. ausweisbar') ||
    allText.includes('MwSt. ausw.') ||
    allText.includes('zzgl. MwSt') ||
    allText.includes('zzgl. gesetzlicher MwSt') ||
    /\(Netto\)/.test(allText) ||
    /\d+\s*%\s*MwSt/.test(allText) ||
    allText.includes('Mehrwertsteuer ausweisbar') ||
    allText.includes('Nettopreis') ||
    // French patterns
    allText.includes('TVA récupérable') ||
    allText.includes('HT (hors taxe)') ||
    allText.includes('prix HT') ||
    /\d+\s*%\s*TVA/.test(allText) ||
    // Dutch / Belgian patterns
    allText.includes('BTW verrekenbaar') ||
    allText.includes('ex. BTW') ||
    allText.includes('excl. BTW') ||
    /\d+\s*%\s*BTW/.test(allText) ||
    // Italian patterns
    allText.includes('IVA detraibile') ||
    allText.includes('IVA recuperabile') ||
    allText.includes('+ IVA') ||
    allText.includes('iva escl') ||
    /\d+\s*%\s*IVA/.test(allText) ||
    // Spanish patterns
    allText.includes('IVA deducible') ||
    allText.includes('sin IVA') ||
    // Polish patterns
    allText.includes('VAT do odliczenia') ||
    allText.includes('netto VAT') ||
    // Generic EU indicator via DOM
    $('[data-testid*="vat"], [class*="vat"], [class*="mwst"]').length > 0;

  // Accident damage — use targeted approach to avoid false positives from "kein Unfallschaden" etc.
  const hasAccidentDamage = (() => {
    // First try structured data-testid / known label patterns
    const damageEls = $('[data-testid*="damage"], [data-testid*="accident"], [class*="damage"]');
    if (damageEls.length > 0) {
      const txt = damageEls.text().toLowerCase();
      if (txt.includes('ja') || txt.includes('yes') || txt.includes('vorhanden')) return true;
      if (txt.includes('nein') || txt.includes('no') || txt.includes('kein')) return false;
    }

    // Try to find the specific "Unfallschaden" label row and check the value next to it
    let damaged = false;
    $('dt, th, [class*="label"], [class*="key"]').each((_, el) => {
      const label = $(el).text().trim().toLowerCase();
      if (label.includes('unfallschaden') || label.includes('schaden')) {
        const value = $(el).next().text().trim().toLowerCase();
        if (value.includes('ja') || value.includes('yes') || value.includes('vorhanden')) {
          damaged = true;
        }
      }
    });
    if (damaged) return true;

    // Fallback: only very strong signals, never "kein Vorschaden" / "Unfallschaden: Nein"
    const lower = allText.toLowerCase();
    if (lower.includes('totalschaden')) return true;
    if (lower.includes('unfallfahrzeug')) return true;
    if (lower.includes('karosserieschaden')) return true;

    // "Unfallschaden" — check context
    const unfallMatch = allText.match(/Unfallschaden[:\s]*([^\n,]{0,30})/i);
    if (unfallMatch) {
      const ctx = unfallMatch[1].toLowerCase().trim();
      if (ctx.startsWith('ja') || ctx.includes('vorhanden')) return true;
      if (ctx.startsWith('nein') || ctx.includes('kein') || ctx.startsWith('ohne')) return false;
      if (ctx === '' || ctx === ':') return true;
    }

    return false;
  })();

  // Description — try multiple selectors
  const description =
    $('[data-testid="description"], [class*="description"], #beschreibung, .g-col-12.description')
      .first()
      .text()
      .trim()
      .slice(0, 2000) || undefined;

  // Features / Ausstattung
  const features: string[] = [];
  $('[data-testid*="feature"], [class*="feature"], [class*="ausstattung"] li, .vip-features li')
    .each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 80) features.push(text);
    });

  // Seller name
  const sellerName =
    $('[data-testid*="seller-name"], [class*="seller-name"], [class*="vendorName"]')
      .first()
      .text()
      .trim() || undefined;

  // Color
  const colorMatch = allText.match(/Außenfarbe[:\s]+([A-ZÄÖÜa-zäöüß\s/-]+?)(?:\n|,|Metallic|$)/);
  const color = colorMatch?.[1]?.trim() || undefined;

  // Body type
  const bodyTypeMatch = allText.match(/Fahrzeugtyp[:\s]+([A-ZÄÖÜa-zäöüß\s/-]+?)(?:\n|,|$)/);
  const bodyType = bodyTypeMatch?.[1]?.trim() || undefined;

  return {
    vatDeductible,
    hasAccidentDamage,
    description,
    features: features.length > 0 ? features : undefined,
    sellerName,
    color,
    bodyType,
    country: countryCode || undefined,
    sourceVatRate,
  };
}

/**
 * Attempt to detect the seller's country from the detail page HTML.
 * Returns a 2-letter ISO country code or null.
 */
function detectCountry($: ReturnType<typeof load>, allText: string): string | null {
  // 1. Explicit data attributes / meta tags often found on mobile.de international pages
  const metaCountry = $('meta[name="country"], meta[property="og:country-name"]').attr('content');
  if (metaCountry) {
    const code = isoFromName(metaCountry);
    if (code) return code;
  }

  // 2. Look for a "Standort" (location) line with a country code prefix like "AT-" or "IT-"
  const standortMatch = allText.match(/Standort[:\s]+([A-Z]{2})-\d{4,5}/);
  if (standortMatch) return standortMatch[1];

  // 3. mobile.de sometimes embeds the country in the seller address block
  const addressMatch = allText.match(/\b(AT|FR|IT|NL|BE|ES|PT|PL|SE|DK|FI|CZ|HU|RO|HR|SK|SI|BG|EE|LV|LT|LU|MT|CY|GR|IE|GB|NO|DE)\s*\n/);
  if (addressMatch) return addressMatch[1];

  // 4. Zip-code heuristics
  // Austrian 4-digit zip (e.g. 1010, 8020)
  if (/\b[A-Z]{0,2}-?(1[0-9]{3}|[2-9][0-9]{3})\b/.test(allText) &&
      /\bA-\d{4}\b/.test(allText)) return 'AT';

  // Italian 5-digit zip preceded by "I-" or followed by Italian city names
  if (/\bI-\d{5}\b/.test(allText)) return 'IT';

  // French 5-digit zip preceded by "F-"
  if (/\bF-\d{5}\b/.test(allText)) return 'FR';

  // Dutch 4-digit + 2-letter zip (e.g. "1234 AB")
  if (/\b\d{4}\s[A-Z]{2}\b/.test(allText)) return 'NL';

  // Belgian: "B-" prefix
  if (/\bB-\d{4}\b/.test(allText)) return 'BE';

  // Spanish 5-digit zip preceded by "E-"
  if (/\bE-\d{5}\b/.test(allText)) return 'ES';

  // 5. Look for currency / language signals unique to certain countries
  if (allText.includes('TVA') && !allText.includes('MwSt')) return 'FR';
  if (/\bBTW\b/.test(allText) && !allText.includes('MwSt')) return 'NL';
  if (/\bIVA\b/.test(allText) && !allText.includes('MwSt')) return 'IT';

  // Default: no country detected (caller should fall back to 'DE' for mobile.de)
  return null;
}

/** Map common country names to ISO codes */
function isoFromName(name: string): string | null {
  const map: Record<string, string> = {
    germany: 'DE', deutschland: 'DE',
    austria: 'AT', österreich: 'AT', oesterreich: 'AT',
    france: 'FR', frankreich: 'FR',
    italy: 'IT', italien: 'IT', italia: 'IT',
    netherlands: 'NL', niederlande: 'NL', nederland: 'NL',
    belgium: 'BE', belgien: 'BE',
    spain: 'ES', spanien: 'ES', españa: 'ES',
    portugal: 'PT',
    poland: 'PL', polen: 'PL',
    sweden: 'SE', schweden: 'SE',
    denmark: 'DK', dänemark: 'DK',
    finland: 'FI', finnland: 'FI',
    czechia: 'CZ', 'czech republic': 'CZ', tschechien: 'CZ',
    hungary: 'HU', ungarn: 'HU',
    romania: 'RO', rumänien: 'RO',
    croatia: 'HR', kroatien: 'HR',
    slovakia: 'SK', slowakei: 'SK',
    slovenia: 'SI', slowenien: 'SI',
    norway: 'NO', norwegen: 'NO',
    'united kingdom': 'GB', uk: 'GB', großbritannien: 'GB',
    luxembourg: 'LU', luxemburg: 'LU',
  };
  return map[name.toLowerCase().trim()] ?? null;
}
