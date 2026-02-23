CREATE TABLE "deal_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"margin_min_chf" integer,
	"margin_max_chf" integer,
	"combined_score" real,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"budget_chf" integer NOT NULL,
	"brands" jsonb DEFAULT '[]'::jsonb,
	"models" jsonb DEFAULT '[]'::jsonb,
	"year_min" integer,
	"year_max" integer,
	"mileage_max" integer,
	"vat_only" boolean DEFAULT false,
	"notes" text,
	"status" text DEFAULT 'active',
	"last_search_at" timestamp,
	"last_result_count" integer,
	"pinned_listing_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"config_id" integer,
	"title" text NOT NULL,
	"price_eur" integer,
	"mileage_km" integer,
	"first_registration_year" integer,
	"first_registration_month" integer,
	"fuel_type" text,
	"transmission" text,
	"power" text,
	"seller_type" text,
	"seller_name" text,
	"location" text,
	"country" text DEFAULT 'DE',
	"listing_url" text NOT NULL,
	"image_url" text,
	"body_type" text,
	"color" text,
	"features" jsonb,
	"description" text,
	"vat_deductible" boolean DEFAULT false,
	"has_accident_damage" boolean DEFAULT false,
	"source_vat_rate" double precision,
	"price_history" jsonb DEFAULT '[]'::jsonb,
	"first_seen_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "listings_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "market_benchmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"year_from" integer NOT NULL,
	"year_to" integer NOT NULL,
	"mileage_range_min" integer NOT NULL,
	"mileage_range_max" integer NOT NULL,
	"fuel_type" text,
	"median_price_eur" integer,
	"p25_price_eur" integer,
	"p75_price_eur" integer,
	"sample_size" integer,
	"estimated_ch_resale_median" integer,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"heuristic_score" real,
	"ai_score" real,
	"combined_score" real,
	"price_delta_percent" real,
	"estimated_resale_min_chf" integer,
	"estimated_resale_max_chf" integer,
	"estimated_margin_min_chf" integer,
	"estimated_margin_max_chf" integer,
	"total_landed_cost_chf" integer,
	"ai_explanation" text,
	"red_flags" jsonb DEFAULT '[]'::jsonb,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"spec_score" real,
	"key_specs" jsonb DEFAULT '[]'::jsonb,
	"missing_specs" jsonb DEFAULT '[]'::jsonb,
	"variant_classification" text,
	"scored_at" timestamp DEFAULT now(),
	CONSTRAINT "scores_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE TABLE "search_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brands" jsonb DEFAULT '[]'::jsonb,
	"models" jsonb DEFAULT '[]'::jsonb,
	"year_min" integer,
	"year_max" integer,
	"mileage_max" integer,
	"price_min" integer,
	"price_max" integer,
	"fuel_types" jsonb DEFAULT '[]'::jsonb,
	"transmissions" jsonb DEFAULT '[]'::jsonb,
	"min_expected_margin_chf" integer,
	"is_active" boolean DEFAULT true,
	"last_scraped_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "deal_listings" ADD CONSTRAINT "deal_listings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_listings" ADD CONSTRAINT "deal_listings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_config_id_search_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."search_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;