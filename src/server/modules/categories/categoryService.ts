import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { categories, products } from '@/src/db/schema';

export class CategoryService {
  static async getAllCategories() {
    const rows = await db.select().from(categories).orderBy(asc(categories.displayOrder));

    const withCounts = await Promise.all(
      rows.map(async (c) => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(products)
          .where(eq(products.categoryId, c.id));
        return { ...c, productCount: count };
      })
    );

    return withCounts;
  }

  static async getCategoryBySlug(slug: string) {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    return category || null;
  }
}
