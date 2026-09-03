import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { addresses } from '@/src/db/schema';

export interface AddressData {
  fullName: string;
  phoneNumber: string;
  houseBuilding: string;
  streetArea: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  type?: 'HOME' | 'WORK' | 'OTHER';
  isDefault?: boolean;
}

export class AddressService {
  static async getAddresses(userId: number) {
    const rows = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(sql`${addresses.isDefault} DESC, ${addresses.id} DESC`);

    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  static async createAddress(userId: number, data: AddressData) {
    const existing = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, userId));
    const makeDefault = Boolean(data.isDefault) || existing.length === 0;

    if (makeDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    }

    const [created] = await db
      .insert(addresses)
      .values({
        userId,
        fullName: data.fullName.trim(),
        phoneNumber: data.phoneNumber.trim(),
        houseBuilding: data.houseBuilding.trim(),
        streetArea: data.streetArea.trim(),
        city: data.city.trim(),
        state: data.state.trim(),
        postalCode: data.postalCode.trim(),
        country: data.country?.trim() || 'India',
        type: data.type || 'HOME',
        isDefault: makeDefault,
      })
      .returning({ id: addresses.id });

    return this.getAddressById(userId, created.id);
  }

  static async getAddressById(userId: number, addressId: number) {
    const [r] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .limit(1);

    if (!r) return null;
    return { ...r, createdAt: r.createdAt.toISOString() };
  }

  static async updateAddress(userId: number, addressId: number, data: Partial<AddressData>) {
    const existing = await this.getAddressById(userId, addressId);
    if (!existing) throw new Error('Address not found');

    if (data.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    }

    const updates: Partial<typeof addresses.$inferInsert> = { updatedAt: new Date() };
    if (data.fullName !== undefined) updates.fullName = data.fullName.trim();
    if (data.phoneNumber !== undefined) updates.phoneNumber = data.phoneNumber.trim();
    if (data.houseBuilding !== undefined) updates.houseBuilding = data.houseBuilding.trim();
    if (data.streetArea !== undefined) updates.streetArea = data.streetArea.trim();
    if (data.city !== undefined) updates.city = data.city.trim();
    if (data.state !== undefined) updates.state = data.state.trim();
    if (data.postalCode !== undefined) updates.postalCode = data.postalCode.trim();
    if (data.country !== undefined) updates.country = data.country.trim();
    if (data.type !== undefined) updates.type = data.type;
    if (data.isDefault !== undefined) updates.isDefault = data.isDefault;

    await db.update(addresses).set(updates).where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));

    return this.getAddressById(userId, addressId);
  }

  static async deleteAddress(userId: number, addressId: number) {
    const existing = await this.getAddressById(userId, addressId);
    if (!existing) throw new Error('Address not found');

    await db.delete(addresses).where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));

    if (existing.isDefault) {
      const [remaining] = await db
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, userId))
        .orderBy(sql`${addresses.id} DESC`)
        .limit(1);
      if (remaining) {
        await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, remaining.id));
      }
    }

    return { success: true };
  }

  static async setDefault(userId: number, addressId: number) {
    const existing = await this.getAddressById(userId, addressId);
    if (!existing) throw new Error('Address not found');

    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    await db.update(addresses).set({ isDefault: true }).where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));

    return this.getAddressById(userId, addressId);
  }
}
