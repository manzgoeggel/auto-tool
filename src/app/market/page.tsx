"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlotPoint {
  id: number;
  title: string;
  priceEur: number;
  mileageKm: number;
  year: number | null;
  vatDeductible: boolean;
  listingUrl: string;
  combinedScore: number | null;
}

interface MarketStats {
  count: number;
  medianPriceEur: number;
  p25PriceEur: number;
  p75PriceEur: number;
  avgScore: number | null;
  vatCount: number;
}

interface MarketData {
  points: PlotPoint[];
  stats: MarketStats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score == null) return "#9ca3af"; // gray-400 — unscored
  if (score >= 75) return "#10b981";   // emerald-500
  if (score >= 55) return "#f59e0b";   // amber-500
  if (score >= 35) return "#6b7280";   // gray-500
  return "#ef4444";                     // red-500
}

function fmtK(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

// ─── Scatter Plot ─────────────────────────────────────────────────────────────

const PAD = { top: 24, right: 24, bottom: 52, left: 68 };
const W = 800;
const H = 460;
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function ScatterPlot({
  points,
  stats,
  onHover,
  onLeave,
  onClick,
}: {
  points: PlotPoint[];
  stats: MarketStats;
  onHover: (p: PlotPoint, svgX: number, svgY: number) => void;
  onLeave: () => void;
  onClick: (p: PlotPoint) => void;
}) {
  if (points.length === 0) return null;

  const prices = points.map((p) => p.priceEur);
  const miles = points.map((p) => p.mileageKm);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minMile = Math.min(...miles);
  const maxMile = Math.max(...miles);

  const priceRange = maxPrice - minPrice || 1;
  const mileRange = maxMile - minMile || 1;

  function toSvgX(km: number) {
    return PAD.left + ((km - minMile) / mileRange) * INNER_W;
  }
  function toSvgY(eur: number) {
    return PAD.top + INNER_H - ((eur - minPrice) / priceRange) * INNER_H;
  }

  // Axis ticks
  const yTicks = 5;
  const xTicks = 6;
  const yStep = priceRange / yTicks;
  const xStep = mileRange / xTicks;

  // Percentile Y positions
  const p25Y = toSvgY(stats.p25PriceEur);
  const p50Y = toSvgY(stats.medianPriceEur);
  const p75Y = toSvgY(stats.p75PriceEur);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ fontFamily: "inherit" }}
    >
      {/* Background */}
      <rect x={PAD.left} y={PAD.top} width={INNER_W} height={INNER_H}
        fill="currentColor" className="text-muted/20" rx="4" />

      {/* Y-axis gridlines + labels */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const val = minPrice + i * yStep;
        const y = toSvgY(val);
        return (
          <g key={`y-${i}`}>
            <line x1={PAD.left} x2={PAD.left + INNER_W} y1={y} y2={y}
              stroke="currentColor" strokeWidth="0.5" className="text-border" strokeDasharray="3 3" />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10"
              fill="currentColor" className="text-muted-foreground">
              {fmtK(Math.round(val / 1000) * 1000)}€
            </text>
          </g>
        );
      })}

      {/* X-axis gridlines + labels */}
      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const val = minMile + i * xStep;
        const x = toSvgX(val);
        return (
          <g key={`x-${i}`}>
            <line x1={x} x2={x} y1={PAD.top} y2={PAD.top + INNER_H}
              stroke="currentColor" strokeWidth="0.5" className="text-border" strokeDasharray="3 3" />
            <text x={x} y={PAD.top + INNER_H + 18} textAnchor="middle" fontSize="10"
              fill="currentColor" className="text-muted-foreground">
              {fmtK(Math.round(val / 1000) * 1000)}km
            </text>
          </g>
        );
      })}

      {/* Percentile reference lines */}
      {stats.p25PriceEur > minPrice && (
        <g>
          <line x1={PAD.left} x2={PAD.left + INNER_W} y1={p25Y} y2={p25Y}
            stroke="#6b7280" strokeWidth="1" strokeDasharray="6 3" opacity="0.6" />
          <text x={PAD.left + INNER_W - 2} y={p25Y - 3} textAnchor="end" fontSize="9"
            fill="#6b7280" opacity="0.8">P25</text>
        </g>
      )}
      {stats.medianPriceEur > minPrice && (
        <g>
          <line x1={PAD.left} x2={PAD.left + INNER_W} y1={p50Y} y2={p50Y}
            stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7" />
          <text x={PAD.left + INNER_W - 2} y={p50Y - 3} textAnchor="end" fontSize="9"
            fill="#f59e0b" opacity="0.9">Median</text>
        </g>
      )}
      {stats.p75PriceEur > minPrice && (
        <g>
          <line x1={PAD.left} x2={PAD.left + INNER_W} y1={p75Y} y2={p75Y}
            stroke="#6b7280" strokeWidth="1" strokeDasharray="6 3" opacity="0.6" />
          <text x={PAD.left + INNER_W - 2} y={p75Y - 3} textAnchor="end" fontSize="9"
            fill="#6b7280" opacity="0.8">P75</text>
        </g>
      )}

      {/* Dots */}
      {points.map((p) => {
        const cx = toSvgX(p.mileageKm);
        const cy = toSvgY(p.priceEur);
        const color = scoreColor(p.combinedScore);
        return (
          <circle
            key={p.id}
            cx={cx}
            cy={cy}
            r={5}
            fill={color}
            fillOpacity={0.75}
            stroke={color}
            strokeWidth={0.5}
            strokeOpacity={0.9}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => onHover(p, cx, cy)}
            onMouseLeave={onLeave}
            onClick={() => onClick(p)}
          />
        );
      })}

      {/* Axis labels */}
      <text x={PAD.left + INNER_W / 2} y={H - 4} textAnchor="middle" fontSize="11"
        fill="currentColor" className="text-muted-foreground">
        Kilometerstand (km)
      </text>
      <text
        x={14}
        y={PAD.top + INNER_H / 2}
        textAnchor="middle"
        fontSize="11"
        fill="currentColor"
        className="text-muted-foreground"
        transform={`rotate(-90, 14, ${PAD.top + INNER_H / 2})`}
      >
        Preis (EUR)
      </text>

      {/* Axis borders */}
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + INNER_H}
        stroke="currentColor" strokeWidth="1" className="text-border" />
      <line x1={PAD.left} x2={PAD.left + INNER_W} y1={PAD.top + INNER_H} y2={PAD.top + INNER_H}
        stroke="currentColor" strokeWidth="1" className="text-border" />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipState {
  point: PlotPoint;
  clientX: number;
  clientY: number;
}

function Tooltip({ tip, containerRef }: { tip: TooltipState; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const rect = containerRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const x = tip.clientX - rect.left;
  const y = tip.clientY - rect.top;

  // Flip tooltip if too close to right/bottom edge
  const flipX = x > rect.width - 200;
  const flipY = y > rect.height - 120;

  return (
    <div
      className="pointer-events-none absolute z-50 rounded-lg border bg-popover text-popover-foreground shadow-lg px-3 py-2.5 text-xs max-w-[200px]"
      style={{
        left: flipX ? x - 210 : x + 12,
        top: flipY ? y - 110 : y + 12,
      }}
    >
      <p className="font-semibold line-clamp-2 leading-snug mb-1.5">{tip.point.title}</p>
      <div className="space-y-0.5 text-muted-foreground">
        <p><span className="font-medium text-foreground">{formatPrice(tip.point.priceEur, "EUR")}</span></p>
        <p>{(tip.point.mileageKm / 1000).toFixed(0)}k km
          {tip.point.year ? ` · ${tip.point.year}` : ""}
        </p>
        {tip.point.combinedScore != null && (
          <p>Score: <span
            className="font-bold"
            style={{ color: scoreColor(tip.point.combinedScore) }}
          >{Math.round(tip.point.combinedScore)}</span></p>
        )}
        {tip.point.vatDeductible && (
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">MwSt. ausweisbar</p>
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground/60">Klicken zum Öffnen</p>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: "#10b981", label: "Score ≥75 (sehr gut)" },
    { color: "#f59e0b", label: "Score 55–74" },
    { color: "#6b7280", label: "Score 35–54" },
    { color: "#ef4444", label: "Score <35" },
    { color: "#9ca3af", label: "Nicht bewertet" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map(({ color, label }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color, opacity: 0.8 }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Filters
  const [brand, setBrand] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [vatOnly, setVatOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (brand) params.set("brand", brand);
      if (yearMin) params.set("yearMin", yearMin);
      if (yearMax) params.set("yearMax", yearMax);
      if (vatOnly) params.set("vatOnly", "true");
      if (maxPrice) params.set("maxPrice", maxPrice);
      const res = await fetch(`/api/market?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [brand, yearMin, yearMax, vatOnly, maxPrice]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // clientX/Y tracked via onMouseMove on the container div so tooltip follows cursor
  const lastClient = useRef({ x: 0, y: 0 });

  function handleMouseMove(e: React.MouseEvent) {
    lastClient.current = { x: e.clientX, y: e.clientY };
    setTooltip((prev) => prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null);
  }

  function handleDotEnter(p: PlotPoint) {
    setTooltip({ point: p, clientX: lastClient.current.x, clientY: lastClient.current.y });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleHover(_p: PlotPoint, _svgX: number, _svgY: number) {
    // handled via handleDotEnter
  }

  const { points, stats } = data ?? { points: [], stats: { count: 0, medianPriceEur: 0, p25PriceEur: 0, p75PriceEur: 0, avgScore: null, vatCount: 0 } };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marktübersicht</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Preis vs. Kilometerstand aller Inserate. Günstige Angebote auf einen Blick erkennen.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Nach Marke filtern…"
            className="pl-9 h-9 w-44"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            value={yearMin}
            onChange={(e) => setYearMin(e.target.value)}
            placeholder="Jahr von"
            className="h-9 w-24 text-sm"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <Input
            type="number"
            value={yearMax}
            onChange={(e) => setYearMax(e.target.value)}
            placeholder="Jahr bis"
            className="h-9 w-24 text-sm"
          />
        </div>
        <div className="relative">
          <Input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max. Preis (€)"
            className="h-9 w-36 text-sm"
          />
        </div>
        <button
          onClick={() => setVatOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium transition-colors select-none
            ${vatOnly
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Nur MwSt. ausweisbar
        </button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Inserate" value={stats.count.toLocaleString()} />
          <StatCard
            label="Medianpreis"
            value={stats.medianPriceEur ? formatPrice(stats.medianPriceEur, "EUR") : "—"}
            sub={stats.p25PriceEur && stats.p75PriceEur
              ? `P25: ${formatPrice(stats.p25PriceEur, "EUR")} · P75: ${formatPrice(stats.p75PriceEur, "EUR")}`
              : undefined}
          />
          <StatCard
            label="Ø Score"
            value={stats.avgScore != null ? `${stats.avgScore}/100` : "—"}
          />
          <StatCard
            label="MwSt. ausweisbar"
            value={stats.count ? `${Math.round((stats.vatCount / stats.count) * 100)}%` : "—"}
            sub={`${stats.vatCount.toLocaleString()} Inserate`}
          />
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <Skeleton className="w-full h-96 rounded-lg" />
          ) : points.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
              Keine Inserate entsprechen den Filtern. Filter erweitern.
            </div>
          ) : (
            <div>
              <div
                ref={containerRef}
                className="relative"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTooltip(null)}
              >
                <ScatterPlot
                  points={points}
                  stats={stats}
                  onHover={handleDotEnter}
                  onLeave={() => setTooltip(null)}
                  onClick={(p) => router.push(`/listings/${p.id}`)}
                />
                {tooltip && tooltip.clientX > 0 && (
                  <Tooltip tip={tooltip} containerRef={containerRef} />
                )}
              </div>
              <div className="mt-3 pt-3 border-t">
                <Legend />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-right">
        Bis zu 3.000 Inserate · Ausreisser über €500k oder 400k km ausgeblendet
      </p>
    </div>
  );
}
