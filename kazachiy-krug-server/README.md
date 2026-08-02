# kazachiy-krug-server

Backend for the Messenger monorepo (`Express + Socket.IO + Prisma`).

## Scripts

- `npm run dev` — start server with nodemon.
- `npm run start` — start server in production mode.
- `npm run prisma:generate` — generate Prisma client.
- `npm run migrate:deploy` — apply migrations.
- `npm run prisma:seed` — seed base data.
- `npm run seed:history` — seed message history.
- `npm run test` — run socket tests.

## Quick start

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Create `.env` from the example and set `DATABASE_URL` if your database is not local Docker:
   ```bash
   cp .env.example .env
   ```
3. Optional: start local PostgreSQL from the repository root:
   ```bash
   docker compose up -d postgres
   ```
4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
5. Apply migrations and seed data:
   ```bash
   npm run db:setup
   ```
6. Start development server:
   ```bash
   npm run dev
   ```
## Environment

See `.env.example` for supported variables:

- `DATABASE_URL` — PostgreSQL connection string used by Prisma.
- `PORT` — HTTP and Socket.IO port, defaults to `3000`.
- `SOCKET_MEMORY_FALLBACK_ENABLED` — local/dev fallback for socket data when DB is unavailable.
- `CALL_MEMORY_FALLBACK_ENABLED` — local/dev fallback for call state when DB is unavailable.
