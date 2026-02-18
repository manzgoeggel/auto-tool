import { Suspense } from "react";
import { Radar, TrendingUp, Car, Clock } from "lucide-react";
import { DealList } from "@/components/deal-list";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

async function getDeals() {
  try {
    const { getTodaysTopDeals } = await import("@/lib/db/queries/listings");
    return await getTodaysTopDeals(15);
  } catch {
    return [];
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

async function getStats() {
  try {
    const { db } = await import("@/lib/db");
    const { listings, scores } = await import("@/lib/db/schema");
    const { sql, eq } = await import("drizzle-orm");
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(eq(listings.isActive, true));
    const [scoredResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(scores);
    return {
      totalListings: Number(totalResult?.count || 0),
      scoredListings: Number(scoredResult?.count || 0),
    };
  } catch {
    return { totalListings: 0, scoredListings: 0 };
  }
}

function StatsCards({
  totalListings,
  scoredListings,
  dealsCount,
  eurChfRate,
}: {
  totalListings: number;
  scoredListings: number;
  dealsCount: number;
  eurChfRate: number;
}) {
  const stats = [
    {
      label: "Today's Deals",
      value: dealsCount.toString(),
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Active Listings",
      value: totalListings.toString(),
      icon: Car,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Scored",
      value: scoredListings.toString(),
      icon: Radar,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "EUR/CHF",
      value: eurChfRate.toFixed(4),
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg p-2.5 ${stat.bg}`}>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DealListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="h-48 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

async function DashboardContent() {
  const [deals, eurChfRate, stats] = await Promise.all([
    getDeals(),
    getRate(),
    getStats(),
  ]);

  return (
    <>
      <StatsCards
        totalListings={stats.totalListings}
        scoredListings={stats.scoredListings}
        dealsCount={deals.length}
        eurChfRate={eurChfRate}
      />

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Top Deals</h2>
            <p className="text-sm text-muted-foreground">
              Sorted by deal score. Higher scores indicate better DE &rarr; CH arbitrage opportunities.
            </p>
          </div>
        </div>
        <DealList deals={deals} eurChfRate={eurChfRate} />
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deal Radar</h1>
        <p className="text-muted-foreground mt-1">
          Your daily car import deal finder. DE &rarr; CH arbitrage opportunities.
        </p>
      </div>

      <Suspense fallback={<DealListSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
