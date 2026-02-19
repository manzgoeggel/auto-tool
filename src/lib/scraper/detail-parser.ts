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

  // Accident damage
  const hasAccidentDamage =
    allText.includes('Unfallschaden') ||
    allText.includes('Unfallfahrzeug') ||
    allText.includes('Karosserieschaden') ||
    allText.includes('Totalschaden') ||
    allText.includes('beschädigt') ||
    allText.includes('Vorschaden');

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
