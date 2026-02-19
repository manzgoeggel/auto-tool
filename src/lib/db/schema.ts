import { pgTable, serial, text, integer, real, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const searchConfigs = pgTable('search_configs', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  brands: jsonb('brands').$type<string[]>().default([]),
  models: jsonb('models').$type<string[]>().default([]),
  yearMin: integer('year_min'),
  yearMax: integer('year_max'),
  mileageMax: integer('mileage_max'),
  priceMin: integer('price_min'),
  priceMax: integer('price_max'),
  fuelTypes: jsonb('fuel_types').$type<string[]>().default([]),
  transmissions: jsonb('transmissions').$type<string[]>().default([]),
  minExpectedMarginChf: integer('min_expected_margin_chf'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const listings = pgTable('listings', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  configId: integer('config_id').references(() => searchConfigs.id),
  title: text('title').notNull(),
  priceEur: integer('price_eur'),
  mileageKm: integer('mileage_km'),
  firstRegistrationYear: integer('first_registration_year'),
  firstRegistrationMonth: integer('first_registration_month'),
  fuelType: text('fuel_type'),
  transmission: text('transmission'),
  power: text('power'),
  sellerType: text('seller_type'),
  sellerName: text('seller_name'),
  location: text('location'),
  listingUrl: text('listing_url').notNull(),
  imageUrl: text('image_url'),
  bodyType: text('body_type'),
  color: text('color'),
  features: jsonb('features').$type<string[]>(),
  description: text('description'),
  vatDeductible: boolean('vat_deductible').default(false),
  hasAccidentDamage: boolean('has_accident_damage').default(false),
  priceHistory: jsonb('price_history').$type<{ date: string; price: number }[]>().default([]),
  firstSeenAt: timestamp('first_seen_at').defaultNow(),
  lastSeenAt: timestamp('last_seen_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const scores = pgTable('scores', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id').references(() => listings.id).notNull().unique(),
  heuristicScore: real('heuristic_score'),
  aiScore: real('ai_score'),
  combinedScore: real('combined_score'),
  priceDeltaPercent: real('price_delta_percent'),
  estimatedResaleMinChf: integer('estimated_resale_min_chf'),
  estimatedResaleMaxChf: integer('estimated_resale_max_chf'),
  estimatedMarginMinChf: integer('estimated_margin_min_chf'),
  estimatedMarginMaxChf: integer('estimated_margin_max_chf'),
  totalLandedCostChf: integer('total_landed_cost_chf'),
  aiExplanation: text('ai_explanation'),
  redFlags: jsonb('red_flags').$type<string[]>().default([]),
  highlights: jsonb('highlights').$type<string[]>().default([]),
  specScore: real('spec_score'),
  keySpecs: jsonb('key_specs').$type<{ spec: string; impact: 'high' | 'medium' | 'low'; note: string }[]>().default([]),
  missingSpecs: jsonb('missing_specs').$type<string[]>().default([]),
  variantClassification: text('variant_classification'),
  scoredAt: timestamp('scored_at').defaultNow(),
});

export const marketBenchmarks = pgTable('market_benchmarks', {
  id: serial('id').primaryKey(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  yearFrom: integer('year_from').notNull(),
  yearTo: integer('year_to').notNull(),
  mileageRangeMin: integer('mileage_range_min').notNull(),
  mileageRangeMax: integer('mileage_range_max').notNull(),
  fuelType: text('fuel_type'),
  medianPriceEur: integer('median_price_eur'),
  p25PriceEur: integer('p25_price_eur'),
  p75PriceEur: integer('p75_price_eur'),
  sampleSize: integer('sample_size'),
  estimatedChResaleMedian: integer('estimated_ch_resale_median'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Type exports from schema
export type SearchConfig = typeof searchConfigs.$inferSelect;
export type NewSearchConfig = typeof searchConfigs.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;
export type MarketBenchmarkRow = typeof marketBenchmarks.$inferSelect;
