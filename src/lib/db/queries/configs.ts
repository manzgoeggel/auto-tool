import { db } from '../index';
import { searchConfigs } from '../schema';
import { eq } from 'drizzle-orm';
import type { SearchConfigInput } from '@/lib/types';

export async function getActiveConfigs() {
  return db
    .select()
    .from(searchConfigs)
    .where(eq(searchConfigs.isActive, true));
}

export async function getAllConfigs() {
  return db.select().from(searchConfigs).orderBy(searchConfigs.createdAt);
}

export async function getConfigById(id: number) {
  const results = await db
    .select()
    .from(searchConfigs)
    .where(eq(searchConfigs.id, id))
    .limit(1);
  return results[0] || null;
}

export async function createConfig(data: SearchConfigInput) {
  const result = await db
    .insert(searchConfigs)
    .values({
      name: data.name,
      brands: data.brands,
      models: data.models,
      yearMin: data.yearMin,
      yearMax: data.yearMax,
      mileageMax: data.mileageMax,
      priceMin: data.priceMin,
      priceMax: data.priceMax,
      fuelTypes: data.fuelTypes || [],
      transmissions: data.transmissions || [],
      minExpectedMarginChf: data.minExpectedMarginChf,
    })
    .returning();

  return result[0];
}

export async function updateConfig(id: number, data: Partial<SearchConfigInput> & { isActive?: boolean }) {
  const result = await db
    .update(searchConfigs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(searchConfigs.id, id))
    .returning();

  return result[0];
}

export async function deleteConfig(id: number) {
  await db.delete(searchConfigs).where(eq(searchConfigs.id, id));
}
