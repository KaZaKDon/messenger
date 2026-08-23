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
- `npm run admin:bootstrap` — create or update the first active administrator from `ADMIN_*` variables.
- `npm run db:cleanup:legacy-users -- --confirm=DELETE_ALL_EXCEPT_ADMIN` — one-time cleanup that keeps the active administrator from `ADMIN_USER_ID` and deletes every other account with its test data.

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
- `CORS_ORIGINS` — comma-separated allowed frontend origins; set the public HTTPS origin on a host.
- `UPLOAD_DIR` — upload directory; it must be backed by persistent storage.
- `TRUST_PROXY` — set to `true` behind one trusted reverse proxy so generated upload URLs use HTTPS.
- `SOCKET_MEMORY_FALLBACK_ENABLED` — local/dev fallback for socket data when DB is unavailable.
- `CALL_MEMORY_FALLBACK_ENABLED` — local/dev fallback for call state when DB is unavailable.
- `REGISTRATION_CONTACT_PHONE` — Russian mobile number shown to an applicant for the confirmation call.
- `REGISTRATION_*_VERSION` — versions stored with the three legal acceptances.

The registration contact must be configured in the private `.env`. The registration module and `.env.example` do not hard-code that contact.

## Deploy with Docker Compose

Подробный русскоязычный план для VPS, трёх frontend-сайтов, переноса данных, reverse proxy и резервных копий находится в [`DEPLOYMENT.ru.md`](./DEPLOYMENT.ru.md).

After applying migrations, create the first administrator once:

```bash
ADMIN_LOGIN=admin \
ADMIN_PASSWORD='replace-with-a-unique-long-password' \
ADMIN_PHONE='+79000000000' \
ADMIN_NICK='Администратор' \
docker compose run --rm \
  -e ADMIN_LOGIN -e ADMIN_PASSWORD -e ADMIN_PHONE -e ADMIN_NICK \
  backend npm run admin:bootstrap
```

The command is idempotent by login. It activates that account and assigns the `admin` role. Do not reuse the database password as the administrator password.

1. Point the DNS record at the host and install Docker with the Compose plugin.
2. Create a host-only `.env` next to `docker-compose.yml`:
   ```dotenv
   POSTGRES_PASSWORD=replace-with-a-long-random-secret
   CORS_ORIGINS=https://messenger.example.com
   TRUST_PROXY=true
   BACKEND_PORT=3000
   ```
3. Build the image and start PostgreSQL:
   ```bash
   docker compose build backend
   docker compose up -d postgres
   ```
4. Apply migrations before starting the new application version:
   ```bash
   docker compose run --rm backend npm run migrate:deploy
   ```
5. Start the backend and verify both probes:
   ```bash
   docker compose up -d backend
   curl --fail http://127.0.0.1:3000/health/live
   curl --fail http://127.0.0.1:3000/health/ready
   ```
6. Put an HTTPS reverse proxy in front of port 3000 and enable WebSocket forwarding. Do not expose PostgreSQL publicly. Back up both the `postgres_data` and `uploads_data` volumes.

The liveness endpoint only checks the Node.js process. The readiness endpoint checks the database and returns HTTP 503 while PostgreSQL is unavailable. The server handles `SIGTERM`/`SIGINT`, stops accepting connections, closes Socket.IO, and disconnects Prisma before exiting.

### Required security work before a public launch

The current phone login and `auth:restore` flows accept a phone number or user ID without proving ownership. `/me` and `/upload` also have no authenticated HTTP session. Before exposing the service to untrusted users, add OTP/password authentication, short-lived access tokens plus refresh-token rotation, HTTP and Socket.IO authorization middleware, rate limiting, and ownership checks for profile changes and uploads. Treat this as a release blocker, not an optional hardening task.

For multiple backend replicas, replace the process-local presence/call fallback maps with a shared store (for example Redis), configure the Socket.IO Redis adapter, and move uploads to shared object storage. Keep both memory fallback flags disabled in production.
