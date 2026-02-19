import { MOBILE_DE_MAKE_IDS, MOBILE_DE_MODEL_IDS, FUEL_TYPE_MAP, TRANSMISSION_MAP } from '@/lib/constants';
import type { SearchConfig } from '@/lib/db/schema';

export function buildSearchUrl(config: SearchConfig, page: number = 1): string {
  const params = new URLSearchParams();

  params.set('dam', '0'); // Exclude damaged
  params.set('isSearchRequest', 'true');
  params.set('s', 'Car');
  params.set('vc', 'Car');
  params.set('sfmr', 'false');

  // Make/Model
  const brands = (config.brands || []) as string[];
  const models = (config.models || []) as string[];

  if (brands.length > 0) {
    const msValues: string[] = [];

    for (const brand of brands) {
      const makeId = MOBILE_DE_MAKE_IDS[brand];
      if (!makeId) continue;

      const brandModels = models.filter(
        (m) => MOBILE_DE_MODEL_IDS[brand]?.[m] !== undefined,
      );

      if (brandModels.length > 0) {
        for (const model of brandModels) {
          const modelId = MOBILE_DE_MODEL_IDS[brand]?.[model];
          if (modelId) {
            // mobile.de ms format: makeId;;modelGroupId; (model ID is in position 3)
            msValues.push(`${makeId};;${modelId};`);
          }
        }
      } else {
        // All models for this brand
        msValues.push(`${makeId};;;`);
      }
    }

    if (msValues.length > 0) {
      // mobile.de supports multiple ms params
      for (const ms of msValues) {
        params.append('ms', ms);
      }
    }
  }

  // Year range
  if (config.yearMin || config.yearMax) {
    params.set('fr', `${config.yearMin || ''}:${config.yearMax || ''}`);
  }

  // Mileage
  if (config.mileageMax) {
    params.set('ml', `:${config.mileageMax}`);
  }

  // Price range
  if (config.priceMin || config.priceMax) {
    params.set('p', `${config.priceMin || ''}:${config.priceMax || ''}`);
  }

  // Fuel types
  const fuelTypes = (config.fuelTypes || []) as string[];
  for (const ft of fuelTypes) {
    const mapped = FUEL_TYPE_MAP[ft];
    if (mapped) params.append('ft', mapped);
  }

  // Transmissions
  const transmissions = (config.transmissions || []) as string[];
  for (const tr of transmissions) {
    const mapped = TRANSMISSION_MAP[tr];
    if (mapped) params.append('tr', mapped);
  }

  // Pagination
  if (page > 1) {
    params.set('pageNumber', String(page));
  }

  // Sort by newest first to catch fresh listings
  params.set('sb', 'doc'); // sort by date of creation

  return `https://suchen.mobile.de/fahrzeuge/search.html?${params.toString()}`;
}
