import { load, type CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { RawListing } from '@/lib/types';

// Resilient selectors ordered by stability
const LISTING_SELECTORS = [
  'a[href*="details.html?id="]',
  '[data-testid*="result-listing"]',
  '.result-item',
  'article[class*="listing"]',
  '.cBox-body--resultitem',
];

export function parseSearchResults(html: string): {
  listings: RawListing[];
  hasNext: boolean;
  totalResults?: number;
} {
  const $ = load(html);
  const listings: RawListing[] = [];
  const seenIds = new Set<string>();

  // Try each selector strategy until we find results
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listingElements: ReturnType<typeof $> | null = null;

  for (const selector of LISTING_SELECTORS) {
    const found = $(selector);
    if (found.length > 0) {
      listingElements = found;
      break;
    }
  }

  if (!listingElements || listingElements.length === 0) {
    // Fallback: find all links to detail pages
    const detailLinks = $('a[href*="/fahrzeuge/details"]');
    if (detailLinks.length > 0) {
      listingElements = detailLinks;
    }
  }

  if (listingElements) {
    listingElements.each((_i, el) => {
      try {
        const listing = parseListingElement($, el as Element);
        if (listing && !seenIds.has(listing.externalId)) {
          seenIds.add(listing.externalId);
          listings.push(listing);
        }
      } catch {
        // Skip unparseable listings
      }
    });
  }

  // Check for next page
  const hasNext =
    $('a[data-testid="pagination-next"]').length > 0 ||
    $('[class*="next"]').filter('a, button').length > 0 ||
    $('a:contains("nächste")').length > 0 ||
    $('a:contains("Nächste")').length > 0;

  // Try to get total results count
  let totalResults: number | undefined;
  const resultCountText = $('h1, [class*="result-count"], [class*="totalCount"]').first().text();
  const countMatch = resultCountText.match(/([\d.]+)\s*(Ergebnis|Treffer|Angebot)/i);
  if (countMatch) {
    totalResults = parseInt(countMatch[1].replace(/\./g, ''), 10);
  }

  return { listings, hasNext, totalResults };
}

function parseListingElement(
  $: CheerioAPI,
  el: Element,
): RawListing | null {
  const $el = $(el);

  // Find the closest container that has the listing content
  const $container = $el.is('a') ? $el.closest('[class*="result"], article, .cBox-body--resultitem').add($el) : $el;

  // Extract listing URL and ID
  let listingUrl = '';
  let externalId = '';

  const detailLink = $container.find('a[href*="details.html?id="]').first();
  if (detailLink.length > 0) {
    listingUrl = detailLink.attr('href') || '';
  } else if ($el.is('a') && ($el.attr('href') || '').includes('details.html?id=')) {
    listingUrl = $el.attr('href') || '';
  }

  if (!listingUrl) return null;

  // Ensure full URL
  if (listingUrl.startsWith('/')) {
    listingUrl = `https://suchen.mobile.de${listingUrl}`;
  }

  // Extract ID from URL
  const idMatch = listingUrl.match(/id=(\d+)/);
  if (idMatch) {
    externalId = idMatch[1];
  } else {
    return null;
  }

  // Extract title
  const title =
    $container.find('h2, h3, [class*="headline"], [data-testid*="title"]').first().text().trim() ||
    $container.find('a[href*="details"]').first().text().trim() ||
    '';

  if (!title) return null;

  // Extract all text content for parsing
  const allText = $container.text();

  // Extract price
  const priceEur = parsePrice(allText);

  // Extract mileage
  const mileageKm = parseMileage(allText);

  // Extract first registration
  const { year: firstRegistrationYear, month: firstRegistrationMonth } =
    parseFirstRegistration(allText);

  // Extract fuel type
  const fuelType = parseFuelType(allText);

  // Extract transmission
  const transmission = parseTransmission(allText);

  // Extract power
  const power = parsePower(allText);

  // Extract seller type
  const sellerType = parseSellerType(allText);

  // Extract location
  const location = parseLocation(allText);

  // Extract image
  const imageUrl =
    $container.find('img[src*="img.classistatic"], img[data-src*="img.classistatic"]').first().attr('src') ||
    $container.find('img[src*="img.classistatic"], img[data-src*="img.classistatic"]').first().attr('data-src') ||
    $container.find('img').first().attr('src') ||
    undefined;

  // Check VAT deductible
  const vatDeductible =
    allText.includes('MwSt. ausweisbar') ||
    allText.includes('MwSt. ausw.') ||
    allText.includes('Netto');

  // Check for accident damage
  const hasAccidentDamage =
    allText.includes('Unfallschaden') ||
    allText.includes('Unfallfahrzeug') ||
    allText.includes('Karosserieschaden') ||
    allText.includes('Totalschaden') ||
    allText.includes('beschädigt');

  return {
    externalId,
    title,
    priceEur: priceEur || 0,
    mileageKm: mileageKm || 0,
    firstRegistrationYear: firstRegistrationYear || 0,
    firstRegistrationMonth,
    fuelType: fuelType || 'Unknown',
    transmission: transmission || 'Unknown',
    power,
    sellerType,
    location: location || '',
    listingUrl,
    imageUrl,
    vatDeductible,
    hasAccidentDamage,
  };
}

function parsePrice(text: string): number | null {
  // Match patterns like "24.990 €", "€ 24.990", "EUR 24.990", "24990"
  const patterns = [
    /(\d{1,3}(?:\.\d{3})*)\s*€/,
    /€\s*(\d{1,3}(?:\.\d{3})*)/,
    /EUR\s*(\d{1,3}(?:\.\d{3})*)/,
    /(\d{1,3}(?:\.\d{3})*)\s*EUR/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1].replace(/\./g, ''), 10);
    }
  }

  return null;
}

function parseMileage(text: string): number | null {
  // Match "150.000 km", "150000 km"
  const match = text.match(/(\d{1,3}(?:\.\d{3})*)\s*km\b/i);
  if (match) {
    return parseInt(match[1].replace(/\./g, ''), 10);
  }
  return null;
}

function parseFirstRegistration(text: string): {
  year: number | null;
  month: number | undefined;
} {
  // Match "EZ 03/2020", "03/2020", "2020"
  const ezMatch = text.match(/(?:EZ|Erstzulassung)\s*(\d{2})\/(\d{4})/i);
  if (ezMatch) {
    return {
      month: parseInt(ezMatch[1], 10),
      year: parseInt(ezMatch[2], 10),
    };
  }

  const dateMatch = text.match(/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const year = parseInt(dateMatch[2], 10);
    if (month >= 1 && month <= 12 && year >= 1990 && year <= 2030) {
      return { month, year };
    }
  }

  return { year: null, month: undefined };
}

function parseFuelType(text: string): string | null {
  const fuelMap: Record<string, string> = {
    'Diesel': 'Diesel',
    'Benzin': 'Petrol',
    'Elektro': 'Electric',
    'Hybrid': 'Hybrid',
    'Plug-in-Hybrid': 'Plug-in Hybrid',
    'Plug-In-Hybrid': 'Plug-in Hybrid',
    'Erdgas': 'CNG',
    'Autogas': 'LPG',
    'Wasserstoff': 'Hydrogen',
  };

  for (const [de, en] of Object.entries(fuelMap)) {
    if (text.includes(de)) return en;
  }

  return null;
}

function parseTransmission(text: string): string | null {
  if (text.includes('Automatik') || text.includes('Automatisch')) return 'Automatic';
  if (text.includes('Schaltgetriebe') || text.includes('Manuell')) return 'Manual';
  if (text.includes('Halbautomatik')) return 'Semi-automatic';
  return null;
}

function parsePower(text: string): string | undefined {
  // Match "190 PS", "140 kW (190 PS)"
  const psMatch = text.match(/(\d+)\s*PS/);
  const kwMatch = text.match(/(\d+)\s*kW/);

  if (kwMatch && psMatch) {
    return `${psMatch[1]} PS (${kwMatch[1]} kW)`;
  }
  if (psMatch) return `${psMatch[1]} PS`;
  if (kwMatch) return `${kwMatch[1]} kW`;

  return undefined;
}

function parseSellerType(text: string): 'dealer' | 'private' {
  if (
    text.includes('Privat') ||
    text.includes('privat') ||
    text.includes('Von Privat')
  ) {
    return 'private';
  }
  return 'dealer';
}

function parseLocation(text: string): string | null {
  // Try to find German city/region patterns
  // Usually formatted as "DE-ZIPCODE City" or just "City"
  const locationMatch = text.match(/(?:DE-)?(\d{5})\s+([A-ZÄÖÜa-zäöüß\s-]+?)(?:\s|$)/);
  if (locationMatch) {
    return `${locationMatch[1]} ${locationMatch[2].trim()}`;
  }
  return null;
}
