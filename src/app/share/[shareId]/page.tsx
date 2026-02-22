import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, ShieldCheck, AlertTriangle, Radar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice, formatMileage } from '@/lib/format';

async function getShareData(shareId: string) {
  try {
    const { getDealByShareId, getDealResults } = await import('@/lib/db/queries/deals');
    const deal = await getDealByShareId(shareId);
    if (!deal) return null;
    const results = await getDealResults(deal.id);
    return { deal, results };
  } catch {
    return null;
  }
}

function ScoreRing({ score }: { score: number }) {
  const r = 13;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = score >= 75 ? '#10b981' : score >= 55 ? '#f59e0b' : score >= 35 ? '#6b7280' : '#ef4444';
  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width="34" height="34" className="-rotate-90">
        <circle cx="17" cy="17" r={r} fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
        <circle cx="17" cy="17" r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const data = await getShareData(shareId);
  if (!data) notFound();

  const { deal, results } = data;
  const pinnedIds = (deal.pinnedListingIds ?? []) as number[];

  // Sort: pinned first, then by combined score desc
  const sorted = [...results].sort((a, b) => {
    const ap = pinnedIds.includes(a.listing.id) ? 1 : 0;
    const bp = pinnedIds.includes(b.listing.id) ? 1 : 0;
    if (bp !== ap) return bp - ap;
    const as = a.score?.combinedScore ?? a.dealListing.combinedScore ?? 0;
    const bs = b.score?.combinedScore ?? b.dealListing.combinedScore ?? 0;
    return bs - as;
  });

  const createdAt = deal.createdAt ? new Date(deal.createdAt).toLocaleDateString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) : '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Radar className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight">Deal Radar</span>
          </div>
          <span className="text-xs text-muted-foreground">Geteilte Auswahl · {createdAt}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Deal header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{deal.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="outline" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              Budget: {formatPrice(deal.budgetChf, 'CHF')}
            </Badge>
            {(deal.brands as string[]).map((b) => (
              <Badge key={b} variant="secondary">{b}</Badge>
            ))}
            {(deal.models as string[]).map((m) => (
              <Badge key={m} variant="outline">{m}</Badge>
            ))}
            {deal.yearMin && deal.yearMax && (
              <Badge variant="secondary">{deal.yearMin}–{deal.yearMax}</Badge>
            )}
            {deal.mileageMax && (
              <Badge variant="secondary">max {(deal.mileageMax / 1000).toFixed(0)}k km</Badge>
            )}
            {deal.vatOnly && (
              <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                <ShieldCheck className="h-3 w-3" />MwSt. ausweisbar
              </Badge>
            )}
          </div>
          {deal.notes && (
            <p className="mt-2 text-sm text-muted-foreground italic">{deal.notes}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Gefundene Angebote</p>
              <p className="text-2xl font-bold mt-0.5">{sorted.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Angeheftet</p>
              <p className="text-2xl font-bold mt-0.5">{pinnedIds.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ø Score</p>
              <p className="text-2xl font-bold mt-0.5">
                {sorted.length > 0
                  ? Math.round(
                      sorted.reduce((s, r) => s + (r.score?.combinedScore ?? r.dealListing.combinedScore ?? 0), 0) /
                      sorted.length
                    )
                  : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Results table */}
        {sorted.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Noch keine Ergebnisse für diesen Deal.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="h-9 px-3 text-xs font-medium text-muted-foreground text-center">Score</th>
                    <th className="h-9 px-3 text-xs font-medium text-muted-foreground text-left">Fahrzeug</th>
                    <th className="h-9 px-3 text-xs font-medium text-muted-foreground text-right whitespace-nowrap">Preis</th>
                    <th className="h-9 px-3 text-xs font-medium text-muted-foreground text-right whitespace-nowrap">Landed CHF</th>
                    <th className="h-9 px-3 text-xs font-medium text-muted-foreground text-center whitespace-nowrap">MwSt.</th>
                    <th className="h-9 px-3 text-xs font-medium text-muted-foreground text-center">Hinweise</th>
                    <th className="h-9 w-9 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, idx) => {
                    const l = row.listing;
                    const s = row.score;
                    const dl = row.dealListing;
                    const score = s?.combinedScore ?? dl.combinedScore;
                    const landed = s?.totalLandedCostChf;
                    const isPinned = pinnedIds.includes(l.id);
                    const redFlagCount = s?.redFlags?.length ?? 0;
                    const displayName = s?.variantClassification || l.title;

                    return (
                      <tr
                        key={l.id}
                        className={`group border-b border-border/40 last:border-0 transition-colors hover:bg-muted/25 ${
                          isPinned ? 'bg-amber-500/5' : idx % 2 !== 0 ? 'bg-muted/[0.04]' : ''
                        }`}
                      >
                        {/* Score */}
                        <td className="px-3 py-2.5 text-center w-12">
                          {score != null
                            ? <ScoreRing score={score} />
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>

                        {/* Car */}
                        <td className="px-3 py-2.5 min-w-[160px] max-w-[280px]">
                          <div className="flex items-center gap-1.5">
                            {isPinned && (
                              <span className="text-amber-500 text-xs">★</span>
                            )}
                            <span className="font-medium line-clamp-1">{displayName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground/70 flex-wrap">
                            {l.firstRegistrationYear && <span>{l.firstRegistrationYear}</span>}
                            {l.mileageKm && <span>{formatMileage(l.mileageKm)}</span>}
                            {l.power && <span>{l.power}</span>}
                            {l.location && <span>{l.location}</span>}
                          </div>
                          {s?.aiExplanation && s.aiExplanation !== 'AI analysis pending' && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-1 italic">
                              {s.aiExplanation}
                            </p>
                          )}
                        </td>

                        {/* Price */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="font-semibold tabular-nums">
                            {l.priceEur ? formatPrice(l.priceEur, 'EUR') : '—'}
                          </span>
                        </td>

                        {/* Landed CHF */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="tabular-nums text-sm">
                            {landed ? formatPrice(landed, 'CHF') : '—'}
                          </span>
                        </td>

                        {/* VAT */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {l.vatDeductible
                            ? <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <ShieldCheck className="h-3.5 w-3.5" />
                              </span>
                            : <span className="text-muted-foreground/30 text-xs">—</span>}
                        </td>

                        {/* Flags */}
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {l.hasAccidentDamage && (
                              <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 rounded px-1">
                                <AlertTriangle className="h-3 w-3 inline" />
                              </span>
                            )}
                            {redFlagCount > 0 && (
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1.5">
                                {redFlagCount}⚑
                              </span>
                            )}
                            {!l.hasAccidentDamage && redFlagCount === 0 && (
                              <span className="text-muted-foreground/25 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        {/* External link */}
                        <td className="px-2 py-2.5 w-9 text-center">
                          <a
                            href={l.listingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground/40 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t bg-muted/10 text-xs text-muted-foreground">
              {sorted.length} Inserate · Budget CHF {(deal.budgetChf / 1000).toFixed(0)}k
              {pinnedIds.length > 0 && ` · ${pinnedIds.length} angeheftet`}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground border-t">
          <Radar className="h-3.5 w-3.5" />
          <span>Erstellt mit <Link href="/" className="underline underline-offset-2 hover:text-foreground">Deal Radar</Link> — DE→CH Fahrzeugimport-Finder</span>
        </div>
      </div>
    </div>
  );
}
