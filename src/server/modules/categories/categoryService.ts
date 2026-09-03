import { asc, eq, ne, sql, and } from 'drizzle-orm';
import { db } from '@/src/db';
import { categories, products } from '@/src/db/schema';

export interface CategoryInput {
  name: string;
  slug?: string;
  icon: string;
  imageUrl: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export class CategoryService {
  /** Public catalog listing: active categories only, with live product counts. */
  static async getAllCategories() {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.displayOrder));

    return this.withProductCounts(rows);
  }

  /** Admin listing: every category regardless of active state. */
  static async getAllCategoriesForAdmin() {
    const rows = await db.select().from(categories).orderBy(asc(categories.displayOrder));
    return this.withProductCounts(rows);
  }

  private static async withProductCounts(rows: (typeof categories.$inferSelect)[]) {
    return Promise.all(
      rows.map(async (c) => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(products)
          .where(eq(products.categoryId, c.id));
        return { ...c, productCount: count };
      })
    );
  }

  static async getCategoryBySlug(slug: string) {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    return category || null;
  }

  static async createCategory(data: CategoryInput) {
    const name = data.name.trim();
    if (!name) throw new Error('Category name is required');

    const slugCandidate = normalizeSlug(data.slug || name);
    if (!slugCandidate) throw new Error('Could not derive a valid slug from the category name');

    const [existing] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slugCandidate)).limit(1);
    if (existing) throw new Error('A category with this slug already exists');

    const [created] = await db
      .insert(categories)
      .values({
        name,
        slug: slugCandidate,
        icon: data.icon?.trim() || 'Grid3x3',
        imageUrl: data.imageUrl?.trim() || '',
        description: data.description?.trim() || null,
        displayOrder: data.displayOrder ?? 0,
        isActive: data.isActive ?? true,
      })
      .returning();

    return created;
  }

  static async updateCategory(categoryId: number, data: Partial<CategoryInput>) {
    const [existing] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    if (!existing) throw new Error('Category not found');

    const updates: Partial<typeof categories.$inferInsert> = { updatedAt: new Date() };

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new Error('Category name cannot be empty');
      updates.name = name;
    }

    if (data.slug !== undefined) {
      const slugCandidate = normalizeSlug(data.slug);
      if (!slugCandidate) throw new Error('Invalid slug');
      const [dupe] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.slug, slugCandidate), ne(categories.id, categoryId)))
        .limit(1);
      if (dupe) throw new Error('A category with this slug already exists');
      updates.slug = slugCandidate;
    }

    if (data.icon !== undefined) updates.icon = data.icon.trim();
    if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl.trim();
    if (data.description !== undefined) updates.description = data.description.trim() || null;
    if (data.displayOrder !== undefined) updates.displayOrder = data.displayOrder;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    await db.update(categories).set(updates).where(eq(categories.id, categoryId));

    const [updated] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    return updated;
  }

  /**
   * Never hard-deletes a category with products attached (would either
   * orphan products or cascade-delete them, both unacceptable). Instead:
   *  - if in use: archive it (isActive = false) so it stops appearing in
   *    the public catalog / admin product-creation dropdown, but existing
   *    products keep a valid categoryId.
   *  - if unused: safe to hard-delete.
   */
  static async deleteOrArchiveCategory(categoryId: number) {
    const [existing] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1);
    if (!existing) throw new Error('Category not found');

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.categoryId, categoryId));

    if (count > 0) {
      await db.update(categories).set({ isActive: false, updatedAt: new Date() }).where(eq(categories.id, categoryId));
      return { archived: true, deleted: false, productCount: count };
    }

    await db.delete(categories).where(eq(categories.id, categoryId));
    return { archived: false, deleted: true, productCount: 0 };
  }
}
