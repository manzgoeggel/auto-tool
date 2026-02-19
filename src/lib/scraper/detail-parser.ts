import { load } from 'cheerio';

export interface DetailPageData {
  vatDeductible: boolean;
  hasAccidentDamage: boolean;
  description?: string;
  features?: string[];
  sellerName?: string;
  color?: string;
  bodyType?: string;
}

export function parseDetailPage(html: string): DetailPageData {
  const $ = load(html);
  const allText = $.text();

  // VAT deductible — look for all known patterns from detail pages
  const vatDeductible =
    allText.includes('MwSt. ausweisbar') ||
    allText.includes('MwSt. ausw.') ||
    allText.includes('zzgl. MwSt') ||
    allText.includes('zzgl. gesetzlicher MwSt') ||
    /\(Netto\)/.test(allText) ||
    /\d+\s*%\s*MwSt/.test(allText) ||                 // "19% MwSt" / "20% MwSt"
    allText.includes('Mehrwertsteuer ausweisbar') ||
    allText.includes('Nettopreis') ||
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
  };
}
