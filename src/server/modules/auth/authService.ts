import { createHash, timingSafeEqual } from 'node:crypto';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { users, addresses, orders, carts, cartItems, wishlists } from '@/src/db/schema';
import { hashPassword, verifyPassword } from '@/src/lib/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/src/lib/jwt';
import { adminEnv } from '@/src/lib/env';
import { createSession, findActiveSessionByToken, revokeAllSessionsForUser, revokeSessionByToken } from '@/src/lib/sessionService';


export interface UserResponse {
  id: number;
  username: string;
  email: string;
  phone: string;
  role: string;
  isVerified: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}

function toUserResponse(u: typeof users.$inferSelect): UserResponse {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isVerified: u.isVerified,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Constant-time string comparison (hashes first so length can't leak). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when `identifier` is the configured admin email (or optional admin username). */
function isAdminIdentifier(identifier: string): boolean {
  const id = identifier.trim().toLowerCase();
  const email = adminEnv.email;
  const username = adminEnv.username?.toLowerCase();
  return Boolean(email && id === email) || Boolean(username && id === username);
}

/** True only when BOTH the identifier and the password match the admin env credentials. */
function matchesAdminEnv(identifier: string, password: string): boolean {
  const envPassword = adminEnv.password;
  if (!adminEnv.email || !envPassword) return false;
  return isAdminIdentifier(identifier) && safeEqual(password, envPassword);
}

function usernameBase(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
  return cleaned.length >= 3 ? cleaned : 'admin';
}

export class AuthService {
  static async register(data: { username: string; email: string; phone: string; password: string }) {
    const cleanEmail = data.email.toLowerCase().trim();

    // Signing up with the admin env credentials (email AND password) makes
    // this account an ADMIN. Both must match, and they live only in the
    // server environment, so nobody can obtain admin by guessing an email.
    if (matchesAdminEnv(cleanEmail, data.password)) {
      const admin = await this.provisionAdmin({
        email: cleanEmail,
        password: data.password,
        username: data.username,
        phone: data.phone,
      });
      return this.issueTokens(admin);
    }

    // The admin email is reserved. Without this, anyone could register it
    // first as a CUSTOMER and lock the real admin out of signing up.
    if (adminEnv.email && cleanEmail === adminEnv.email) {
      throw new Error('This email address is reserved and cannot be used to sign up.');
    }

    const [existingEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existingEmail) {
      throw new Error('An account with this email already exists.');
    }

    const [existingUsername] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, data.username.trim()))
      .limit(1);
    if (existingUsername) {
      throw new Error('This username is already taken. Please choose another.');
    }

    const passwordHash = await hashPassword(data.password);

    const [user] = await db
      .insert(users)
      .values({
        username: data.username.trim(),
        email: cleanEmail,
        phone: data.phone.trim(),
        passwordHash,
        role: 'CUSTOMER',
        isVerified: true,
        avatarUrl: null,
      })
      .returning();

    return this.issueTokens(user);
  }

  /**
   * Creates the admin account, or repairs it if it already exists (wrong
   * role, stale password). Only ever called after the caller has proven
   * they hold the admin env credentials.
   */
  private static async provisionAdmin(input: { email: string; password: string; username?: string; phone?: string }) {
    const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

    if (existing) {
      const passwordOk = await verifyPassword(input.password, existing.passwordHash);
      if (existing.role === 'ADMIN' && passwordOk) return existing;

      const [updated] = await db
        .update(users)
        .set({
          role: 'ADMIN',
          isVerified: true,
          ...(passwordOk ? {} : { passwordHash: await hashPassword(input.password) }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();

      // A password reset must not leave older sessions alive.
      if (!passwordOk) await revokeAllSessionsForUser(existing.id);
      return updated;
    }

    // New account: pick a free username (suffix digits on collision).
    const base = usernameBase(input.username?.trim() || adminEnv.username || input.email.split('@')[0]);
    let username = base;
    for (let attempt = 0; attempt < 20; attempt++) {
      const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (!taken) break;
      username = `${base.slice(0, 20)}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const [created] = await db
      .insert(users)
      .values({
        username,
        email: input.email,
        phone: input.phone?.trim() ?? '',
        passwordHash: await hashPassword(input.password),
        role: 'ADMIN',
        isVerified: true,
        avatarUrl: null,
      })
      .returning();
    return created;
  }

  static async login(data: { identifier: string; password: string }) {
    const cleanId = data.identifier.trim().toLowerCase();

    // Admin env credentials always work: they create the admin account on
    // first use and repair its role/password afterwards, so signing in
    // with them can never fail because of stale database state.
    if (matchesAdminEnv(cleanId, data.password)) {
      const admin = await this.provisionAdmin({ email: adminEnv.email as string, password: data.password });
      return this.issueTokens(admin);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${cleanId} OR LOWER(${users.username}) = ${cleanId}`)
      .limit(1);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await verifyPassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    return this.issueTokens(user);
  }

  private static async issueTokens(user: typeof users.$inferSelect) {
    const basePayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role as 'CUSTOMER' | 'SELLER' | 'ADMIN',
    };

    const accessToken = generateAccessToken(basePayload);
    const refreshToken = generateRefreshToken(basePayload);

    // Persist the refresh session server-side so it can be looked up and
    // revoked (logout, password change) independently of the JWT signature.
    await createSession({ userId: user.id, refreshToken });

    return { user: toUserResponse(user), accessToken, refreshToken };
  }

  static async getMe(userId: number) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error('User not found');

    const [addressCount] = await db.select({ count: sql<number>`count(*)::int` }).from(addresses).where(eq(addresses.userId, userId));
    const [orderCount] = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.userId, userId));
    const [wishlistCount] = await db.select({ count: sql<number>`count(*)::int` }).from(wishlists).where(eq(wishlists.userId, userId));

    const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
    let cartItemCount = 0;
    if (cart) {
      const [row] = await db
        .select({ count: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.id));
      cartItemCount = row?.count || 0;
    }

    return {
      user: toUserResponse(user),
      stats: {
        addresses: addressCount?.count || 0,
        orders: orderCount?.count || 0,
        cartItems: cartItemCount,
        wishlistItems: wishlistCount?.count || 0,
      },
    };
  }

  static async updateProfile(userId: number, data: { username?: string; email?: string; phone?: string; avatarUrl?: string }) {
    const updates: Partial<typeof users.$inferInsert> = {};

    if (data.username) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, data.username.trim()), ne(users.id, userId)))
        .limit(1);
      if (existing) throw new Error('Username is already in use');
      updates.username = data.username.trim();
    }

    if (data.email) {
      const cleanEmail = data.email.toLowerCase().trim();
      // The admin email is reserved for the holder of the admin credentials.
      if (adminEnv.email && cleanEmail === adminEnv.email) {
        const [self] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
        if (self?.email !== cleanEmail) throw new Error('Email is already in use');
      }
      const [existing] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, cleanEmail), ne(users.id, userId))).limit(1);
      if (existing) throw new Error('Email is already in use');
      updates.email = cleanEmail;
    }

    if (data.phone) updates.phone = data.phone.trim();
    if (data.avatarUrl) updates.avatarUrl = data.avatarUrl;

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(users).set(updates).where(eq(users.id, userId));
    }

    return this.getMe(userId);
  }

  static async changePassword(userId: number, currentPass: string, newPass: string) {
    const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error('User not found');

    const isValid = await verifyPassword(currentPass, user.passwordHash);
    if (!isValid) throw new Error('Current password does not match');

    const newHash = await hashPassword(newPass);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, userId));

    // Forces every other signed-in device to re-authenticate.
    await revokeAllSessionsForUser(userId);

    return { success: true, message: 'Password updated successfully' };
  }

  /** Exchanges a valid, non-revoked refresh token cookie for a new access token. */
  static async refreshAccessToken(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) throw new Error('Invalid or expired refresh token');

    const session = await findActiveSessionByToken(refreshToken);
    if (!session) throw new Error('Session has been revoked or expired');

    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    if (!user) throw new Error('User not found');

    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role as 'CUSTOMER' | 'SELLER' | 'ADMIN',
    });

    return { accessToken, user: toUserResponse(user) };
  }

  static async logout(refreshToken: string | undefined) {
    if (refreshToken) {
      await revokeSessionByToken(refreshToken);
    }
    return { success: true };
  }
}

