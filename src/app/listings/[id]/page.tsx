import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Fuel,
  Gauge,
  Calendar,
  Zap,
  ShieldCheck,
  User,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScoreBadge } from "@/components/score-badge";
import { ImportCalculator } from "@/components/import-calculator";
import { formatPrice, formatMileage, timeAgo } from "@/lib/format";

async function getListing(id: number) {
  try {
    const { getListingById } = await import("@/lib/db/queries/listings");
    return await getListingById(id);
  } catch {
    return null;
  }
}

async function getRate() {
  try {
    const { getEurChfRate } = await import("@/lib/import-costs/exchange-rate");
    return await getEurChfRate();
  } catch {
    return 0.94;
  }
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) notFound();

  const [listing, eurChfRate] = await Promise.all([
    getListing(listingId),
    getRate(),
  ]);

  if (!listing) notFound();

  const score = listing.score;
  const priceChf = listing.priceEur ? Math.round(listing.priceEur * eurChfRate) : null;

  const specs = [
    { icon: Calendar, label: "Year", value: listing.firstRegistrationYear?.toString() },
    { icon: Gauge, label: "Mileage", value: listing.mileageKm != null ? formatMileage(listing.mileageKm) : null },
    { icon: Fuel, label: "Fuel", value: listing.fuelType },
    { icon: Zap, label: "Power", value: listing.power },
    { icon: User, label: "Seller", value: listing.sellerType },
    { icon: MapPin, label: "Location", value: listing.location },
  ].filter((s) => s.value);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href="/listings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Image */}
        <div className="md:w-1/2">
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted">
            {listing.imageUrl ? (
              <img
                src={listing.imageUrl}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Gauge className="h-16 w-16 opacity-20" />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="md:w-1/2 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold leading-tight">{listing.title}</h1>
            {score?.combinedScore != null && (
              <ScoreBadge score={score.combinedScore} size="lg" showLabel />
            )}
          </div>

          {/* Price */}
          <div>
            <div className="text-3xl font-bold">
              {listing.priceEur ? formatPrice(listing.priceEur, "EUR") : "N/A"}
            </div>
            {priceChf && (
              <p className="text-lg text-muted-foreground">
                {formatPrice(priceChf, "CHF")}
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {listing.vatDeductible && (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                VAT deductible (19%)
              </Badge>
            )}
            {score?.priceDeltaPercent != null && score.priceDeltaPercent < -5 && (
              <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">
                {Math.abs(Math.round(score.priceDeltaPercent))}% below market
              </Badge>
            )}
            {listing.firstSeenAt && (
              <Badge variant="secondary">
                First seen: {timeAgo(listing.firstSeenAt)}
              </Badge>
            )}
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-2 gap-3">
            {specs.map((spec) => {
              const Icon = spec.icon;
              return (
                <div key={spec.label} className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{spec.label}:</span>
                  <span className="font-medium">{spec.value}</span>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <Button size="lg" className="w-full" asChild>
            <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View on mobile.de
            </a>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Import calculator */}
        {listing.priceEur && (
          <ImportCalculator
            priceEur={listing.priceEur}
            isVatDeductible={listing.vatDeductible || false}
            eurChfRate={eurChfRate}
          />
        )}

        {/* Margin estimate */}
        {score && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Margin Estimate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Landed cost</span>
                <span className="font-medium">
                  {score.totalLandedCostChf != null
                    ? formatPrice(score.totalLandedCostChf, "CHF")
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Est. resale range</span>
                <span className="font-medium">
                  {score.estimatedResaleMinChf != null && score.estimatedResaleMaxChf != null
                    ? `${formatPrice(score.estimatedResaleMinChf, "CHF")} - ${formatPrice(score.estimatedResaleMaxChf, "CHF")}`
                    : "N/A"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Est. margin</span>
                <span
                  className={
                    score.estimatedMarginMinChf != null && score.estimatedMarginMinChf > 0
                      ? "font-bold text-emerald-600 dark:text-emerald-400"
                      : "font-bold text-red-600 dark:text-red-400"
                  }
                >
                  {score.estimatedMarginMinChf != null && score.estimatedMarginMaxChf != null
                    ? `${formatPrice(score.estimatedMarginMinChf, "CHF")} - ${formatPrice(score.estimatedMarginMaxChf, "CHF")}`
                    : "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Analysis */}
      {score && (score.aiExplanation || (score.highlights && (score.highlights as string[]).length > 0) || (score.redFlags && (score.redFlags as string[]).length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {score.aiExplanation && score.aiExplanation !== "AI analysis pending" && (
              <p className="text-sm leading-relaxed">{score.aiExplanation}</p>
            )}

            {(score.highlights as string[] | null)?.length ? (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Highlights</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(score.highlights as string[]).map((h, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    >
                      {h}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {(score.redFlags as string[] | null)?.length ? (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Red Flags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(score.redFlags as string[]).map((f, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-red-500/10 text-red-700 dark:text-red-400"
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Score breakdown */}
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Score Breakdown</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{score.heuristicScore?.toFixed(0) ?? "--"}</p>
                  <p className="text-xs text-muted-foreground">Heuristic</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{score.aiScore?.toFixed(0) ?? "--"}</p>
                  <p className="text-xs text-muted-foreground">AI</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{score.combinedScore?.toFixed(0) ?? "--"}</p>
                  <p className="text-xs text-muted-foreground">Combined</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price History */}
      {listing.priceHistory && (listing.priceHistory as { date: string; price: number }[]).length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Price History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(listing.priceHistory as { date: string; price: number }[]).map((entry, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{entry.date}</span>
                  <span className="font-medium">{formatPrice(entry.price, "EUR")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
