import { db } from '../index';
import { scores } from '../schema';
import { eq } from 'drizzle-orm';
import type { NewScore } from '../schema';

export async function upsertScore(listingId: number, data: Omit<NewScore, 'listingId'>) {
  const existing = await db
    .select()
    .from(scores)
    .where(eq(scores.listingId, listingId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(scores)
      .set({
        ...data,
        scoredAt: new Date(),
      })
      .where(eq(scores.listingId, listingId));
    return existing[0].id;
  }

  const result = await db
    .insert(scores)
    .values({
      listingId,
      ...data,
    })
    .returning({ id: scores.id });

  return result[0].id;
}

export async function getScoreByListingId(listingId: number) {
  const results = await db
    .select()
    .from(scores)
    .where(eq(scores.listingId, listingId))
    .limit(1);

  return results[0] || null;
}
