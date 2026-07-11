# Production deployment guide

Mithril Tiles should be deployed as three separate managed services:

```text
https://app.yourdomain.com  → Vercel → Next.js frontend and BFF routes
https://api.yourdomain.com  → Railway → Go HTTP and WebSocket API
Managed PostgreSQL          → Railway Postgres, Neon, Supabase, or AWS RDS
```

The browser uses HTTPS for the frontend and connects directly to the Go API at
`wss://api.yourdomain.com` for realtime rooms. Next.js BFF routes call the Go
API server-to-server, keeping long-lived bearer tokens in HttpOnly cookies.

> [!IMPORTANT]
> The current room manager is in-memory. Deploy **exactly one backend instance**
> in one region. Do not enable horizontal scaling or multiple API replicas yet:
> separate instances will hold separate room state and break live gameplay.

## Recommended platform setup

| Concern | Recommended service | Reason |
| --- | --- | --- |
| Next.js frontend | Vercel | First-class Next.js deployment, CDN, custom domains, and BFF support |
| Go API and WebSockets | Railway service | Supports public networking, custom domains, TLS, health checks, and Git-based deploys |
| PostgreSQL | Railway Postgres or Neon | Managed credentials, private networking, TLS, and operational tooling |
| Avatar storage | Cloudinary | Already supported by the backend |
| DNS | Cloudflare or domain registrar | Maps `app` and `api` subdomains to Vercel and Railway |

Vercel deploys Next.js with minimal configuration, and environment-variable
changes apply only to new deployments. [Vercel Next.js deployment](https://vercel.com/docs/frameworks/full-stack/nextjs)
[Vercel environment variables](https://vercel.com/docs/environment-variables)

Railway services support public networking, custom domains with TLS, health
checks, and Git-based deployments. [Railway public networking](https://docs.railway.com/public-networking)
[Railway health checks](https://docs.railway.com/deployments/healthchecks)

## 1. Prepare the domains

Create these two subdomains:

```text
app.yourdomain.com
api.yourdomain.com
```

Use the Vercel-provided DNS record for `app.yourdomain.com` and the
Railway-provided DNS record for `api.yourdomain.com`.

The exact production frontend origin is important because the Go API checks it
for CORS and WebSocket origins:

```text
https://app.yourdomain.com
```

Do not include a trailing slash in `CORS_TRUSTED_ORIGINS`.

## 2. Provision PostgreSQL

Create one production PostgreSQL project in the same or nearest region to the
Railway API service. Enable backups before inviting real users.

Use the provider's connection string as `DATABASE_URL`. For Neon with Go `pgx`,
use TLS:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=verify-full
```

Neon documents support for Go `pgx` and secure connection options.
[Neon connection guidance](https://neon.com/docs/connect/connection-errors)

## 3. Resolve current backend deployment blockers

Before public deployment, resolve these items in the backend:

1. **Optional `.env` loading**

   `cmd/api/main.go` currently exits if a root `.env` file does not exist.
   Production platforms provide secrets as environment variables, so `.env`
   loading should be optional outside local development.

2. **Migration lifecycle**

   The API currently runs migrations during application startup using the
   relative path `file://migrations`. This works for the first single-instance
   deployment when the service runs from the repository root. Later, move
   migrations into a dedicated pre-deploy job.

3. **Single-instance deployment**

   Do not configure autoscaling. Also schedule deploys outside active games:
   a backend replacement disconnects players and cannot preserve in-memory
   rooms.

## 4. Deploy the Go API to Railway

Create a Railway project, then add:

1. A **PostgreSQL** service.
2. A service deployed from this Git repository for the Go API.

Railway's PostgreSQL service exposes a `DATABASE_URL` variable that another
service in the same project can reference. [Railway PostgreSQL](https://docs.railway.com/databases/postgresql)

Use these settings:

```text
Root directory: .
Branch: main
Build command:
go build -tags netgo -ldflags='-s -w' -o bin/mithril-api ./cmd/api

Start command:
./bin/mithril-api -port 4000 -env production -db-max-open-conns 10 -db-min-idle-conns 1

Health check path:
/v1/healthcheck

Instances:
1
```

Set this Railway service variable as well:

```dotenv
PORT=4000
```

Your Go program does not read `PORT` automatically, so the explicit `-port
4000` start flag and Railway `PORT=4000` variable must agree. Railway routes
public requests to the service port defined by `PORT`. [Railway public networking](https://docs.railway.com/public-networking)

Railway detects build/start commands through Railpack, but explicit overrides
keep this Go service predictable. [Railway build and start commands](https://docs.railway.com/builds/build-and-start-commands)

Configure these Railway service variables:

```dotenv
# Replace Postgres with the exact Railway PostgreSQL service name.
DATABASE_URL=${{Postgres.DATABASE_URL}}

CORS_TRUSTED_ORIGINS=https://app.yourdomain.com

# Optional: required only for avatar uploads.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Leave blank until Railway proxy CIDRs are verified.
RATE_LIMIT_TRUSTED_PROXIES=
```

Do not set `RATE_LIMIT_TRUSTED_PROXIES=0.0.0.0/0`. That would make forwarded
client IP headers spoofable. Obtain the provider's documented proxy CIDRs and
trust only those networks.

Railway uses the configured endpoint to verify a deployment before activating
it. Configure `/v1/healthcheck`, which already returns HTTP 200 from the API.
[Railway health checks](https://docs.railway.com/deployments/healthchecks)

Use Railway variables for credentials. Do not commit `.env` or database
credentials. The recommended long-term fix is still making dotenv loading
optional in production.

After the first successful deployment, add `api.yourdomain.com` as a custom
domain in Railway. Railway supplies both a CNAME and a TXT ownership-verification
record; create both exactly as shown before expecting traffic to work.
[Railway custom domains](https://docs.railway.com/networking/domains/working-with-domains)

## 5. Deploy the Next.js frontend to Vercel

Import the same Git repository into Vercel with:

```text
Root Directory: frontend
Framework: Next.js
Install Command: npm ci
Build Command: npm run build
Production Branch: main
```

Set these **Production** environment variables:

```dotenv
BACKEND_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_BACKEND_WS_URL=wss://api.yourdomain.com
APP_ORIGIN=https://app.yourdomain.com
```

Variable responsibilities:

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `BACKEND_API_URL` | Server-only | Base URL used by Next.js BFF route handlers |
| `NEXT_PUBLIC_BACKEND_WS_URL` | Browser | Direct WebSocket base URL |
| `APP_ORIGIN` | Server-only | Origin validation for mutating BFF requests |

`NEXT_PUBLIC_BACKEND_WS_URL` is compiled into browser code, so it must use
`wss://` in production. Redeploy after changing any Vercel environment
variable.

Add `app.yourdomain.com` as a Vercel custom domain and create the requested
DNS record.

## 6. Deployment order

1. Provision the managed PostgreSQL database and save `DATABASE_URL`.
2. Reserve and configure the `app` and `api` domains.
3. Deploy the backend with production environment variables and one instance.
4. Verify the API health check:

   ```bash
   curl https://api.yourdomain.com/v1/healthcheck
   ```

5. Deploy the Vercel frontend with its three production environment variables.
6. Verify login, registration, guest creation, logout, and session restoration.
7. Open two isolated browser sessions, join the same room, and test chat,
   drawing, guessing, a complete game, final scores, and returning to `/play`.
8. Confirm browser DevTools shows a secure socket connection similar to:

   ```text
   wss://api.yourdomain.com/v1/rooms/ROOMCODE/ws?ticket=...
   ```

## 7. Production verification checklist

- [ ] `https://api.yourdomain.com/v1/healthcheck` returns HTTP 200.
- [ ] Frontend registration, login, guest session, logout, and refresh work.
- [ ] Browser cookies are Secure and HttpOnly in production.
- [ ] WebSocket connections use `wss://`.
- [ ] The backend accepts the frontend WebSocket origin.
- [ ] Two independent browser sessions can complete a full game.
- [ ] Final scores persist and the overlay returns players to `/play`.
- [ ] Database backups are enabled and restoration steps are documented.
- [ ] Railway API service remains pinned to one instance.
- [ ] Deployment logs contain no tokens, tickets, or database credentials.

## 8. Preview and staging deployments

Do not point arbitrary Vercel preview deployments at production by default.

Each preview has a different frontend origin, while the frontend validates
`APP_ORIGIN` and the backend validates `CORS_TRUSTED_ORIGINS`. A preview needs
its own matching frontend environment variables, backend CORS entry, and
preferably a separate staging database.

Create separate staging resources before exposing previews to real users:

```text
https://staging-app.yourdomain.com
https://staging-api.yourdomain.com
staging PostgreSQL database
```

## 9. Operating rules for the current architecture

- Keep a single Go API instance.
- Do not deploy while active games are running.
- Use managed database backups and budget alerts.
- Monitor API errors, WebSocket disconnects, database connectivity, and the
  health endpoint.
- Store all production secrets in Vercel/Railway variables.
- Run frontend and backend checks before every deployment.

## 10. Work required before calling the system fully production-ready

- Make `.env` loading optional in production.
- Add graceful HTTP and room shutdown.
- Move migrations into a dedicated deploy step.
- Add Dockerfiles and CI/CD.
- Add metrics, error tracking, uptime monitoring, and alerts.
- Add realtime event-rate limits and stronger drawing validation.
- Replace in-memory room coordination with shared realtime infrastructure
  before adding backend replicas.

Until these are complete, treat the deployment as a public alpha rather than a
high-availability production service.
