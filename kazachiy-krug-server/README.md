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
2. Create `.env` and set `DATABASE_URL`.
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Apply migrations and seed data:
   ```bash
   npm run db:setup
   ```
5. Start development server:
   ```bash
   npm run dev
   ```