"use client";

import Link from "next/link";
import { ExternalLink, MapPin, Fuel, Gauge, Calendar, Zap, ShieldCheck, TrendingDown, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/score-badge";
import { formatPrice, formatMileage } from "@/lib/format";

interface DealCardProps {
  listing: {
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
  };
  eurChfRate: number;
}

export function DealCard({ listing, eurChfRate }: DealCardProps) {
  const { score } = listing;
  const priceChf = listing.priceEur
    ? Math.round(listing.priceEur * eurChfRate)
    : null;

  const marginMin = score?.estimatedMarginMinChf;
  const marginMax = score?.estimatedMarginMaxChf;
  const isPositiveMargin = marginMin !== null && marginMin !== undefined && marginMin > 0;

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
      {/* Score badge overlay */}
      {score?.combinedScore != null && (
        <div className="absolute top-3 right-3 z-10">
          <ScoreBadge score={score.combinedScore} size="md" />
        </div>
      )}

      {/* Image */}
      <div className="relative h-48 bg-muted overflow-hidden">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Gauge className="h-12 w-12 opacity-20" />
          </div>
        )}

        {/* VAT badge */}
        {listing.vatDeductible && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 left-2 bg-emerald-500/90 text-white text-xs"
          >
            <ShieldCheck className="mr-1 h-3 w-3" />
            VAT deductible
          </Badge>
        )}

        {/* Price delta */}
        {score?.priceDeltaPercent != null && score.priceDeltaPercent < -5 && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 right-2 bg-blue-500/90 text-white text-xs"
          >
            <TrendingDown className="mr-1 h-3 w-3" />
            {Math.abs(Math.round(score.priceDeltaPercent))}% below market
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 pr-6">
          {listing.title}
        </h3>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold">
            {listing.priceEur ? formatPrice(listing.priceEur, "EUR") : "N/A"}
          </span>
          {priceChf && (
            <span className="text-sm text-muted-foreground">
              ({formatPrice(priceChf, "CHF")})
            </span>
          )}
        </div>

        {/* Specs row */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {listing.firstRegistrationYear && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {listing.firstRegistrationYear}
            </span>
          )}
          {listing.mileageKm != null && (
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {formatMileage(listing.mileageKm)}
            </span>
          )}
          {listing.fuelType && (
            <span className="flex items-center gap-1">
              <Fuel className="h-3 w-3" />
              {listing.fuelType}
            </span>
          )}
          {listing.power && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {listing.power}
            </span>
          )}
        </div>

        {/* Location */}
        {listing.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {listing.location}
          </div>
        )}

        {/* Margin estimate */}
        {score && score.totalLandedCostChf != null && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Landed cost</span>
              <span className="font-medium">
                {formatPrice(score.totalLandedCostChf, "CHF")}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Est. resale</span>
              <span className="font-medium">
                {score.estimatedResaleMinChf && score.estimatedResaleMaxChf
                  ? `${formatPrice(score.estimatedResaleMinChf, "CHF")} - ${formatPrice(score.estimatedResaleMaxChf, "CHF")}`
                  : "N/A"}
              </span>
            </div>
            <div className="h-px bg-border my-1" />
            <div className="flex justify-between text-sm">
              <span className="font-medium">Est. margin</span>
              <span
                className={
                  isPositiveMargin
                    ? "font-bold text-emerald-600 dark:text-emerald-400"
                    : "font-bold text-red-600 dark:text-red-400"
                }
              >
                {marginMin != null && marginMax != null
                  ? `${formatPrice(marginMin, "CHF")} - ${formatPrice(marginMax, "CHF")}`
                  : "N/A"}
              </span>
            </div>
          </div>
        )}

        {/* AI Explanation */}
        {score?.aiExplanation && score.aiExplanation !== "AI analysis pending" && (
          <p className="text-xs text-muted-foreground italic leading-relaxed">
            &ldquo;{score.aiExplanation}&rdquo;
          </p>
        )}

        {/* Highlights & Red flags */}
        <div className="flex flex-wrap gap-1">
          {(score?.highlights || []).slice(0, 3).map((h, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              {h}
            </Badge>
          ))}
          {(score?.redFlags || []).slice(0, 2).map((f, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] bg-red-500/10 text-red-700 dark:text-red-400">
              <AlertTriangle className="mr-1 h-2.5 w-2.5" />
              {f}
            </Badge>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/listings/${listing.id}`}>Details</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a
              href={listing.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              mobile.de
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
