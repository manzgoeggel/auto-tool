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
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";

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
    country: string | null;
    listingUrl: string;
    vatDeductible: boolean | null;
    hasAccidentDamage: boolean | null;
    firstSeenAt: string | null;
  };
  score: {
    combinedScore: number | null;
    priceDeltaPercent: number | null;
    estimatedMarginMinChf: number | null;
    estimatedMarginMaxChf: number | null;
    redFlags: string[] | null;
    variantClassification: string | null;
  } | null;
}

type SortKey = "combined_score" | "price" | "year" | "margin" | "first_seen";

function SortIcon({ col, current, order }: { col: SortKey; current: SortKey; order: "asc" | "desc" }) {
  if (col !== current) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-30 inline" />;
  return order === "asc"
    ? <ChevronUp className="ml-1 h-3 w-3 inline" />
    : <ChevronDown className="ml-1 h-3 w-3 inline" />;
}

const COUNTRY_FLAG: Record<string, string> = {
  DE: "🇩🇪", AT: "🇦🇹", CH: "🇨🇭", FR: "🇫🇷", IT: "🇮🇹",
  NL: "🇳🇱", BE: "🇧🇪", ES: "🇪🇸", PT: "🇵🇹", PL: "🇵🇱",
  GB: "🇬🇧", SE: "🇸🇪", DK: "🇩🇰", NO: "🇳🇴", FI: "🇫🇮",
};

function CountryCell({ country }: { country: string | null }) {
  const code = (country || "DE").toUpperCase();
  const flag = COUNTRY_FLAG[code] ?? "🌍";
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
      <span>{flag}</span>
      <span className="text-muted-foreground">{code}</span>
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 13;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = score >= 75 ? "#10b981" : score >= 55 ? "#f59e0b" : score >= 35 ? "#6b7280" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width="34" height="34" className="-rotate-90">
        <circle cx="17" cy="17" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border" />
        <circle cx="17" cy="17" r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
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
      const params = new URLSearchParams({ page: page.toString(), limit: "40", sortBy, sortOrder });
      if (search) params.set("brand", search);
      const res = await fetch(`/api/listings?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, sortBy, sortOrder, search]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  function handleSort(col: SortKey) {
    if (col === sortBy) setSortOrder(o => o === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortOrder("desc"); }
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
      if (json.success) { setRescoreMsg(`✓ ${json.scored} rescored`); fetchListings(); }
      else setRescoreMsg("Failed");
    } catch { setRescoreMsg("Failed"); }
    finally { setRescoring(false); }
  }

  const Th = ({ col, label, right, center }: { col: SortKey; label: string; right?: boolean; center?: boolean }) => (
    <th
      onClick={() => handleSort(col)}
      className={`h-9 px-4 text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${right ? "text-right" : center ? "text-center" : "text-left"}`}
    >
      {label}<SortIcon col={col} current={sortBy} order={sortOrder} />
    </th>
  );

  const COLS = 10;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
          {data && <p className="text-sm text-muted-foreground mt-0.5">{data.total} total</p>}
        </div>
        <div className="flex items-center gap-2">
          {rescoreMsg && <span className="text-xs text-muted-foreground">{rescoreMsg}</span>}
          <Button variant="outline" size="sm" onClick={handleRescoreAll} disabled={rescoring} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${rescoring ? "animate-spin" : ""}`} />
            {rescoring ? "Rescoring…" : "Rescore All"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search…" className="pl-9 h-9" />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/30">
                <Th col="combined_score" label="Score" center />
                {/* Car type — not sortable */}
                <th className="h-9 px-4 text-xs font-medium text-muted-foreground text-left whitespace-nowrap">
                  Car
                </th>
                <Th col="price" label="Asking Price" right />
                {/* VAT — not sortable */}
                <th className="h-9 px-4 text-xs font-medium text-muted-foreground text-center whitespace-nowrap">VAT</th>
                <Th col="year" label="Year" />
                {/* Seller — not sortable */}
                <th className="h-9 px-4 text-xs font-medium text-muted-foreground text-center whitespace-nowrap">Seller</th>
                {/* Flags — not sortable */}
                <th className="h-9 px-4 text-xs font-medium text-muted-foreground text-center whitespace-nowrap">Flags</th>
                <Th col="margin" label="Est. Margin" right />
                {/* Country — not sortable */}
                <th className="h-9 px-4 text-xs font-medium text-muted-foreground text-left whitespace-nowrap">Country</th>
                <th className="h-9 w-9 px-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    {Array.from({ length: COLS }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : !data || data.listings.length === 0 ? (
                <tr><td colSpan={COLS} className="text-center py-16 text-muted-foreground text-sm">
                  No listings found. Run the scraper from Settings first.
                </td></tr>
              ) : data.listings.map((row, idx) => {
                const l = row.listings;
                const s = row.score;
                const redFlagCount = s?.redFlags?.length ?? 0;
                const priceDelta = s?.priceDeltaPercent;
                const marginMin = s?.estimatedMarginMinChf;
                const marginMax = s?.estimatedMarginMaxChf;
                const marginPositive = marginMin != null && marginMin > 0;

                // Build display name: prefer AI variant classification, fall back to title
                const displayName = s?.variantClassification || l.title;

                return (
                  <tr
                    key={l.id}
                    className={`group border-b border-border/40 last:border-0 transition-colors hover:bg-muted/25 ${idx % 2 !== 0 ? "bg-muted/[0.04]" : ""}`}
                  >
                    {/* Score */}
                    <td className="px-4 py-2.5 text-center w-14">
                      {s?.combinedScore != null
                        ? <ScoreRing score={s.combinedScore} />
                        : <div className="w-8 h-8 rounded-full border border-border/40 inline-flex items-center justify-center"><span className="text-[10px] text-muted-foreground">—</span></div>
                      }
                    </td>

                    {/* Car */}
                    <td className="px-4 py-2.5 max-w-[300px] min-w-[180px]">
                      <Link href={`/listings/${l.id}`}
                        className="font-medium text-foreground hover:underline leading-snug line-clamp-1 block">
                        {displayName}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {/* Show original title as subtitle if we have a variant classification */}
                        {s?.variantClassification && l.title !== s.variantClassification && (
                          <span className="text-[11px] text-muted-foreground/60 line-clamp-1">{l.title}</span>
                        )}
                        {priceDelta != null && priceDelta < -5 && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-1">
                            ↓{Math.abs(Math.round(priceDelta))}% mkt
                          </span>
                        )}
                        {priceDelta != null && priceDelta > 10 && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1">
                            ↑{Math.round(priceDelta)}% mkt
                          </span>
                        )}
                        {l.location && (
                          <span className="text-[11px] text-muted-foreground/50">{l.location}</span>
                        )}
                      </div>
                    </td>

                    {/* Asking Price */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span className="font-semibold tabular-nums text-foreground">
                        {l.priceEur ? formatPrice(l.priceEur, "EUR") : "—"}
                      </span>
                    </td>

                    {/* VAT */}
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      {l.vatDeductible
                        ? <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-3.5 w-3.5" />Yes
                          </span>
                        : <span className="text-muted-foreground/30 text-xs">—</span>
                      }
                    </td>

                    {/* Year */}
                    <td className="px-4 py-2.5 tabular-nums font-medium text-sm">
                      {l.firstRegistrationYear || "—"}
                    </td>

                    {/* Seller */}
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      {l.sellerType === "private"
                        ? <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Private</span>
                        : <span className="text-xs text-muted-foreground">Dealer</span>
                      }
                    </td>

                    {/* Flags */}
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {l.hasAccidentDamage && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 rounded px-1.5 py-0.5">
                            <AlertTriangle className="h-3 w-3" />Crash
                          </span>
                        )}
                        {redFlagCount > 0 && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5">
                            {redFlagCount} ⚑
                          </span>
                        )}
                        {!l.hasAccidentDamage && redFlagCount === 0 && (
                          <span className="text-muted-foreground/25 text-xs">—</span>
                        )}
                      </div>
                    </td>

                    {/* Est. Margin */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {marginMin != null && marginMax != null ? (
                        <div className={`font-semibold tabular-nums text-sm leading-tight ${marginPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                          <div>{marginPositive ? "+" : ""}{formatPrice(marginMin, "CHF")}</div>
                          {marginMax !== marginMin && (
                            <div className="text-[10px] opacity-60">→ {formatPrice(marginMax, "CHF")}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Country */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <CountryCell country={l.country} />
                    </td>

                    {/* External link */}
                    <td className="px-2 py-2.5 w-9 text-center">
                      <a href={l.listingUrl} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-muted-foreground/40 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/10">
            <p className="text-sm text-muted-foreground">
              {(data.page - 1) * 40 + 1}–{Math.min(data.page * 40, data.total)} of {data.total}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer count */}
      {data && data.totalPages <= 1 && data.total > 0 && (
        <p className="text-xs text-muted-foreground text-right">{data.total} listings</p>
      )}
    </div>
  );
}
