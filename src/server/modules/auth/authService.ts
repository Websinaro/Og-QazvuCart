import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { users, addresses, orders, carts, cartItems, wishlists } from '@/src/db/schema';
import { hashPassword, verifyPassword } from '@/src/lib/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/src/lib/jwt';
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

export class AuthService {
  static async register(data: { username: string; email: string; phone: string; password: string }) {
    const cleanEmail = data.email.toLowerCase().trim();

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

    // SECURITY: public self-registration can NEVER create anything other
    // than a CUSTOMER account. Admin accounts are created exclusively via
    // the offline `npm run admin:create` bootstrap script (see
    // src/scripts/create-admin.ts), which is not reachable over HTTP.
    // Previously this compared the submitted email against a
    // well-known/guessable admin email and silently granted ADMIN — that
    // was a privilege-escalation vulnerability and has been removed.
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

  static async login(data: { identifier: string; password: string }) {
    const cleanId = data.identifier.trim().toLowerCase();

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

