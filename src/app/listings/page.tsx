"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Fuel,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatMileage, timeAgo } from "@/lib/format";

interface ListingRow {
  listings: {
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
    hasAccidentDamage: boolean | null;
    firstSeenAt: string | null;
  };
  score: {
    combinedScore: number | null;
    heuristicScore: number | null;
    aiScore: number | null;
    specScore: number | null;
    priceDeltaPercent: number | null;
    estimatedMarginMinChf: number | null;
    estimatedMarginMaxChf: number | null;
    totalLandedCostChf: number | null;
    aiExplanation: string | null;
    redFlags: string[] | null;
    highlights: string[] | null;
    variantClassification: string | null;
  } | null;
}

type SortKey =
  | "combined_score"
  | "price"
  | "mileage"
  | "year"
  | "first_seen"
  | "margin";

function SortIcon({
  col,
  current,
  order,
}: {
  col: SortKey;
  current: SortKey;
  order: "asc" | "desc";
}) {
  if (col !== current)
    return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-35 inline" />;
  return order === "asc" ? (
    <ChevronUp className="ml-1 h-3 w-3 inline" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3 inline" />
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 13;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color =
    score >= 75
      ? "#10b981"
      : score >= 55
      ? "#f59e0b"
      : score >= 35
      ? "#6b7280"
      : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="34" height="34" className="-rotate-90">
        <circle
          cx="17"
          cy="17"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-muted/30"
        />
        <circle
          cx="17"
          cy="17"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute text-[10px] font-bold tabular-nums"
        style={{ color }}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

function MarginPill({ min, max }: { min: number; max: number }) {
  const positive = min > 0;
  return (
    <span
      className={`inline-flex flex-col items-end text-xs font-semibold tabular-nums leading-tight ${
        positive
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      <span>
        {positive ? "+" : ""}
        {formatPrice(min, "CHF")}
      </span>
      {max !== min && (
        <span className="opacity-55 text-[10px]">
          → {formatPrice(max, "CHF")}
        </span>
      )}
    </span>
  );
}

export default function ListingsPage() {
  const [data, setData] = useState<{
    listings: ListingRow[];
    total: number;
    page: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreMsg, setRescoreMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>("combined_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "30",
        sortBy,
        sortOrder,
      });
      if (search) params.set("brand", search);
      const res = await fetch(`/api/listings?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, search]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  function handleSort(col: SortKey) {
    if (col === sortBy) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
    setPage(1);
  }

  async function handleRescoreAll() {
    setRescoring(true);
    setRescoreMsg(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreAll: true }),
      });
      const json = await res.json();
      if (json.success) {
        setRescoreMsg(`✓ Rescored ${json.scored} listings`);
        fetchListings();
      } else {
        setRescoreMsg("Rescore failed");
      }
    } catch {
      setRescoreMsg("Rescore failed");
    } finally {
      setRescoring(false);
    }
  }

  const Th = ({
    col,
    label,
    right,
    center,
  }: {
    col: SortKey;
    label: string;
    right?: boolean;
    center?: boolean;
  }) => (
    <th
      className={`h-10 px-3 text-xs font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${
        right ? "text-right" : center ? "text-center" : "text-left"
      }`}
      onClick={() => handleSort(col)}
    >
      {label}
      <SortIcon col={col} current={sortBy} order={sortOrder} />
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.total} listings · page {data.page} of {data.totalPages}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rescoreMsg && (
            <span className="text-xs text-muted-foreground">{rescoreMsg}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRescoreAll}
            disabled={rescoring}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${rescoring ? "animate-spin" : ""}`}
            />
            {rescoring ? "Rescoring…" : "Rescore All"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search listings…"
          className="pl-9 h-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th col="combined_score" label="Score" />
                <th className="h-10 px-3 text-xs font-semibold text-muted-foreground text-left">
                  Car
                </th>
                <Th col="price" label="Price" right />
                <Th col="mileage" label="Mileage" right />
                <Th col="year" label="Year" />
                <th className="h-10 px-3 text-xs font-semibold text-muted-foreground text-left whitespace-nowrap">
                  Fuel / Power
                </th>
                <th className="h-10 px-3 text-xs font-semibold text-muted-foreground text-center whitespace-nowrap">
                  Seller
                </th>
                <th className="h-10 px-3 text-xs font-semibold text-muted-foreground text-center whitespace-nowrap">
                  Flags
                </th>
                <Th col="margin" label="Est. Margin" right />
                <Th col="first_seen" label="Seen" />
                <th className="h-10 w-8 px-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !data || data.listings.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center py-16 text-muted-foreground text-sm"
                  >
                    No listings found. Run the scraper from Settings first.
                  </td>
                </tr>
              ) : (
                data.listings.map((row, idx) => {
                  const l = row.listings;
                  const s = row.score;
                  const redFlagCount = s?.redFlags?.length ?? 0;
                  const priceDelta = s?.priceDeltaPercent;

                  return (
                    <tr
                      key={l.id}
                      className={`group border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors ${
                        idx % 2 === 0 ? "" : "bg-muted/10"
                      }`}
                    >
                      {/* Score */}
                      <td className="px-3 py-3 w-12">
                        {s?.combinedScore != null ? (
                          <ScoreRing score={s.combinedScore} />
                        ) : (
                          <div className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground">
                              —
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Car */}
                      <td className="px-3 py-3 max-w-[280px] min-w-[200px]">
                        <Link
                          href={`/listings/${l.id}`}
                          className="font-medium leading-tight hover:underline line-clamp-1 text-foreground"
                        >
                          {l.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {priceDelta != null && priceDelta < -5 && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                              ↓{Math.abs(Math.round(priceDelta))}% market
                            </span>
                          )}
                          {priceDelta != null && priceDelta > 10 && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                              ↑{Math.round(priceDelta)}% market
                            </span>
                          )}
                          {l.location && (
                            <span className="text-[11px] text-muted-foreground/60 truncate max-w-[120px]">
                              {l.location}
                            </span>
                          )}
                        </div>
                        {s?.aiExplanation &&
                          s.aiExplanation !== "AI analysis pending" && (
                            <p className="text-[11px] text-muted-foreground/60 line-clamp-1 mt-0.5 leading-snug">
                              {s.aiExplanation}
                            </p>
                          )}
                      </td>

                      {/* Price */}
                      <td className="px-3 py-3 text-right whitespace-nowrap align-top pt-3.5">
                        <span className="font-semibold tabular-nums">
                          {l.priceEur ? formatPrice(l.priceEur, "EUR") : "—"}
                        </span>
                        {l.vatDeductible && (
                          <div className="flex justify-end mt-0.5">
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              VAT
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Mileage */}
                      <td className="px-3 py-3 text-right whitespace-nowrap align-middle">
                        {l.mileageKm != null ? (
                          <span className="flex items-center justify-end gap-1 text-sm tabular-nums">
                            <Gauge className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {formatMileage(l.mileageKm)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Year */}
                      <td className="px-3 py-3 font-medium tabular-nums align-middle">
                        {l.firstRegistrationYear || "—"}
                      </td>

                      {/* Fuel / Power */}
                      <td className="px-3 py-3 whitespace-nowrap align-middle">
                        <div className="flex items-center gap-1 text-sm">
                          <Fuel className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{l.fuelType || "—"}</span>
                        </div>
                        {l.power && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {l.power}
                          </div>
                        )}
                      </td>

                      {/* Seller */}
                      <td className="px-3 py-3 text-center align-middle">
                        {l.sellerType === "private" ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-5"
                          >
                            Private
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground"
                          >
                            Dealer
                          </Badge>
                        )}
                      </td>

                      {/* Flags */}
                      <td className="px-3 py-3 text-center align-middle">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {l.hasAccidentDamage && (
                            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Crash
                            </Badge>
                          )}
                          {redFlagCount > 0 && (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-full px-1.5 py-0.5">
                              {redFlagCount}⚑
                            </span>
                          )}
                          {!l.hasAccidentDamage && redFlagCount === 0 && (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Est. Margin */}
                      <td className="px-3 py-3 text-right align-middle">
                        {s?.estimatedMarginMinChf != null &&
                        s?.estimatedMarginMaxChf != null ? (
                          <MarginPill
                            min={s.estimatedMarginMinChf}
                            max={s.estimatedMarginMaxChf}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Seen */}
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap align-middle">
                        {l.firstSeenAt ? timeAgo(l.firstSeenAt) : "—"}
                      </td>

                      {/* External link */}
                      <td className="px-3 py-3 w-8 align-middle">
                        <a
                          href={l.listingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/20">
            <p className="text-sm text-muted-foreground">
              {(data.page - 1) * 30 + 1}–{Math.min(data.page * 30, data.total)}{" "}
              of {data.total}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
