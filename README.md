<div align="center">

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
   seller, and admin account, plus one delivered order so review
   eligibility can be tested immediately:
   ```
   npm run db:seed
   ```
4. `npm run dev`

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
