<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/afbd5c5c-ba38-4589-a4ae-67ed4f146060

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Database (PostgreSQL only)

This app uses **PostgreSQL as the only production database**, accessed
through Drizzle ORM (`drizzle-orm/node-postgres`) via a pooled connection.
There is no SQLite / sql.js / PGlite / in-memory fallback anywhere in the
codebase — if `DATABASE_URL` is missing or unreachable, requests fail
loudly instead of silently degrading.

```
Next.js → Service layer (src/server/modules/*) → Drizzle ORM → PostgreSQL
```

### Setup

1. Provision a PostgreSQL database and set `DATABASE_URL` in `.env.local`
   (see `.env.example`). Also set `JWT_SECRET`, `JWT_REFRESH_SECRET`, and
   `PAYMENT_SECRET` — these have no hardcoded fallback and the app will
   refuse to start without them.
2. Apply the schema:
   ```
   npm run db:migrate
   ```
   This runs `src/db/migrate.mjs`, a small runner that applies every
   `*.sql` file in `src/db/migrations/` in order, tracked in a
   `schema_migrations` table so re-running it is a no-op. It does **not**
   recreate tables on every server boot.
3. (Optional) Seed demo data — categories, products, a demo customer,
   and seller account, plus one delivered order so review
   eligibility can be tested immediately:
   ```
   npm run db:seed
   ```
4. `npm run dev`

### Admin access (one-time bootstrap)

Nobody can become an admin by registering or logging in — public
registration always creates a `CUSTOMER`. The first admin is created once,
from the server shell:

```
ADMIN_BOOTSTRAP_EMAIL=you@example.com \
ADMIN_BOOTSTRAP_PASSWORD='a-long-Strong-pass-123' \
npm run admin:bootstrap
```

(`ADMIN_BOOTSTRAP_USERNAME` is optional.) The command refuses to run if any
admin already exists, so it is a one-time operation; unset the variables
afterwards. Further admins can only be promoted by an existing admin from the
admin dashboard. The old `ADMIN_EMAIL` / `ADMIN_PASSWORD` variables are no
longer read.

### Schema changes going forward

`src/db/schema.ts` is the source of truth. For schema changes:
- Hand-write a new numbered file in `src/db/migrations/` (e.g.
  `0001_add_something.sql`) and update `schema.ts` to match, or
- Use `npm run db:generate` (drizzle-kit) to diff `schema.ts` against the
  database and scaffold a migration, then adjust as needed.

Either way, `npm run db:migrate` applies whatever is in
`src/db/migrations/` that hasn't been applied yet.

## Auth

Access and refresh tokens are issued as `HttpOnly`, `Secure` (in
production), `SameSite=Lax` cookies — never exposed to client JavaScript
and never stored in `localStorage`. Refresh sessions are tracked in the
`sessions` table in PostgreSQL, so logout and "change password" can revoke
them server-side instead of just deleting a client-side token.

## Orders

Checkout (`POST /api/orders`) runs entirely inside one PostgreSQL
transaction: validate cart/products/variants → price → atomically reserve
inventory (`UPDATE ... WHERE stock >= qty`) → create order/items/timeline →
clear cart → commit. Any failure rolls the whole transaction back.

Order status transitions are validated against an explicit state machine
(`src/lib/orderStateMachine.ts`) — e.g. `DELIVERED → PROCESSING` is always
rejected, regardless of caller.

## UI / design system

The storefront UI was rebuilt with a modern, premium visual language. All
business logic (contexts, API routes, services, DB) is unchanged.

- **Icons:** [Phosphor Icons](https://phosphoricons.com) (`@phosphor-icons/react`), replacing `lucide-react`.
  Every screen imports from `src/components/ui/icons.tsx`, a thin layer that keeps the
  existing icon names (e.g. `ShoppingBag`, `Truck`) but renders Phosphor glyphs. Swap the
  icon library again by editing that single file.
- **Typography:** [Geist](https://vercel.com/font) via the `geist` package (`GeistSans` / `GeistMono`).
- **Tokens:** defined in `app/globals.css` with Tailwind v4 `@theme`: `brand-50…950`
  (indigo-violet), `shadow-soft / lift / glow`, plus reusable utilities `glass`, `surface`,
  `text-gradient`, `no-scrollbar`, `shimmer-bg`.
- **Dark mode:** class-based (`.dark`), toggled by `ThemeContext`; every screen has dark styling.
- **Motion:** `motion` (already a dependency) for entrances, drawers and toasts;
  respects `prefers-reduced-motion`.

After pulling these changes run `npm install` to fetch the new packages.

---

## Multi-vendor marketplace

Sellers register, get approved by an admin, manage their own catalog and orders, and are paid out net of commission.

### Setup

```bash
openssl rand -base64 32          # put the result in PAYOUT_ENCRYPTION_KEY (.env)
npm run db:migrate               # applies 0004_multivendor_sellers.sql
npm test                         # unit tests for commission / status / crypto logic
```

`PAYOUT_ENCRYPTION_KEY` encrypts seller bank account numbers (AES-256-GCM). There is no fallback; saving payout details fails loudly without it.

### Lifecycle

| Step | Where | What happens |
|---|---|---|
| Apply | `/sell` (or `POST /api/seller/apply`, `POST /api/auth/register-seller`) | Creates a store with status `PENDING`. The account stays a `CUSTOMER`. |
| Review | Admin → **Sellers** | Approve (account becomes `SELLER`, store goes live), Reject (with reason, seller may re-apply), Suspend / Reinstate. |
| Sell | `/seller-center` | Products, inventory, orders, earnings, payouts, Q&A, settings. |
| Get paid | Admin → **Payouts & Commission** | Admin settles payable earnings into a payout, transfers the money, marks it paid. |

Storefront, search, cart and checkout only expose products from `APPROVED` sellers. A suspended seller's products disappear immediately but they can still fulfil open orders and see their earnings.

### Orders are split per seller

A customer still places **one** order. Internally each seller gets a parcel (`seller_orders` row) containing only their items, which they pack/ship/deliver independently. The customer-facing order status is derived from the parcels (the least advanced live parcel). Customers can cancel only while every live parcel is still pre-dispatch.

### Commission

* Rate precedence: **seller override → category override → platform default** (`platform_settings.default_commission_bps`, default 10%).
* Rates are stored in basis points; commission is rounded half-up to whole rupees **per line item**.
* The rate and amounts are **snapshotted on `order_items`** when the order is placed, so changing a rate never rewrites history.
* Commission is charged on item sales value. Coupon discounts are platform-funded (sellers still earn on the pre-discount price) and the delivery fee stays with the platform.

### Earnings, payouts, settlement

* Seller earning for a parcel = items − commission.
* A parcel becomes **payable** when it is `DELIVERED`, the return window has passed (`payout_hold_days`, default 7), and it is paid for (online payment captured, or COD).
* Admin creates a payout per seller: all payable parcels plus unapplied adjustments are claimed atomically (seller row locked, single `UPDATE … RETURNING`), so double-payouts are impossible. Minimum payout: `min_payout_amount`.
* `MARK_PAID` records method + reference (a reference can only settle one payout). `MARK_FAILED` releases everything back to the seller's balance.
* A return after payout creates a negative **adjustment** that is netted against the next payout. Admins can add manual credits/debits.
* Settlement report per payout (JSON or `?format=csv`) for both sellers and admins; admin commission report at `/api/admin/reports/commission`.

### Seller isolation (how one seller can't see another's data)

1. Seller routes never accept a seller id. `requireSeller()` derives it from the authenticated session (role `SELLER` **and** a linked, `APPROVED`/`SUSPENDED` store).
2. Every service method takes that id and puts it in every `WHERE` clause (`id = ? AND seller_id = ?`). Foreign ids behave exactly like missing ones (`404`, never `403`).
3. Order items, payouts, adjustments, questions and stock updates are all scoped the same way; bulk stock updates are all-or-nothing.
4. `SELLER` can no longer be granted from the role dropdown; it only comes from approving an application. Demoting a seller suspends their store. Admins cannot change their own role.
5. Changing payout details requires the account password and notifies the seller.

### Key endpoints

Seller: `/api/seller/{me,dashboard,products,inventory,orders,earnings,payouts,questions,payout-details,rate-card}`
Admin: `/api/admin/{sellers,payouts,payouts/overview,adjustments,settings/commission,settings/commission/categories/[id],reports/commission}`

### Migration note

Existing sellers are grandfathered as `APPROVED`. Orders placed before this migration get parcels with 0% commission and settlement status `LEGACY` (never auto-paid). If you still owe sellers money for any of them, credit it with a manual adjustment.
