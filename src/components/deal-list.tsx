"use client";

import { DealCard } from "@/components/deal-card";

interface DealListProps {
  deals: Array<{
    id: number;
    title: string;
    priceEur: number | null;
    mileageKm: number | null;
    firstRegistrationYear: number | null;
    fuelType: string | null;
    transmission: string | null;
    power: string | null;
    sellerType: string | null;
    location: string | null;
    listingUrl: string;
    imageUrl: string | null;
    vatDeductible: boolean | null;
    score: {
      combinedScore: number | null;
      totalLandedCostChf: number | null;
      estimatedMarginMinChf: number | null;
      estimatedMarginMaxChf: number | null;
      estimatedResaleMinChf: number | null;
      estimatedResaleMaxChf: number | null;
      aiExplanation: string | null;
      redFlags: string[] | null;
      highlights: string[] | null;
      priceDeltaPercent: number | null;
    } | null;
  }>;
  eurChfRate: number;
}

export function DealList({ deals, eurChfRate }: DealListProps) {
  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <svg
            className="h-10 w-10 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-1">No deals found</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Configure your search criteria in Settings, then run a scrape to find deals.
          New listings will appear here scored and sorted by deal quality.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {deals.map((deal) => (
        <DealCard key={deal.id} listing={deal} eurChfRate={eurChfRate} />
      ))}
    </div>
  );
}
