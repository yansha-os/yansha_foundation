> **ARCHIVAL NOTICE:** This document reflects the retired monolithic shared Neon database setup and Prisma monolith. Current Yansha products maintain independent database boundaries.

# Backend setup (Neon + Prisma + Neon Auth)

## 1. Copy env

```bash
cp .env.example .env.local
```

Fill in from Neon Console:

- **DATABASE_URL** — pooled connection (`-pooler` in hostname)
- **DATABASE_URL_UNPOOLED** — direct connection (no `-pooler`)
- **NEON_AUTH_BASE_URL** — Project → Branch → Auth → Configuration
- **NEON_AUTH_COOKIE_SECRET** — `openssl rand -base64 32`

Also copy the same keys into `.env` for Prisma CLI (`prisma.config.ts` loads dotenv).

## 2. Apply schema

```bash
npx prisma migrate deploy
# or for first push without migration history:
npx prisma db push
```

## 3. Apply RLS + public leaderboard view

In the Neon SQL Editor, paste and run:

[`prisma/migrations/rls.sql`](prisma/migrations/rls.sql)

Or:

```bash
npx prisma db execute --file prisma/migrations/rls.sql
```

## 4. Generate client & run

```bash
npx prisma generate
npm run dev
```

## Privacy rules (enforced in code + SQL)

- `hunterXp` is public (leaderboards / guilds).
- `worshipXp`, `prayer_days`, `qada_items`, `worship_events`, and `faith` are private — never joined into `public_profile_stats` or guild challenge metrics.
- Guild challenge titles/metrics that mention prayer/worship are rejected server-side.
