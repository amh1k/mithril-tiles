# Mithril Tiles

Mithril Tiles is a real-time multiplayer drawing and guessing game inspired by party drawing games and presented through a Middle-earth-inspired manuscript aesthetic.

The project combines a Go HTTP/WebSocket backend, PostgreSQL persistence, and a separately deployable Next.js frontend. It currently supports the core path from authentication and room entry through live drawing, guessing, round progression, and persisted final scores.

> [!IMPORTANT]
> Mithril Tiles is under active development and should currently be treated as an **alpha**. The core multiplayer flow works, but the repository is not yet production-ready. See [Current status](#current-status) and [Known limitations](#known-limitations).

## What works today

- Registered-user login and registration
- Temporary guest sessions
- HttpOnly cookie-based frontend sessions through a Next.js backend-for-frontend
- Session restoration after page refresh
- Client-generated room codes and room entry
- Short-lived, single-use WebSocket tickets
- Authenticated WebSocket room connections
- Bounded room chat history
- Live chat and slash-command guesses
- Mouse, touch, and pen drawing with normalized coordinates
- Multiple drawing colours and an eraser
- Host detection and host-only game start
- Word-pack discovery and selection
- Persisted games, participants, rounds, round scores, and final scores
- Authoritative room snapshots for players, scores, host, drawer, and lifecycle state
- Private round-word delivery to the active drawer
- Round and game lifecycle transitions
- Final-score retrieval and game-over presentation
- Reconnection attempts with fresh WebSocket tickets
- Responsive, themed landing and authentication pages
- HTTP authentication rate limiting and bounded in-memory message history

## Current status

| Area | Status | Notes |
| --- | --- | --- |
| Authentication | Implemented | Registered and guest flows work; server-side token revocation/logout is not implemented |
| Frontend session BFF | Implemented | Bearer tokens remain in secure HttpOnly cookies |
| Rooms | Implemented, evolving | Join, capacity, host assignment, and snapshots exist |
| Chat and guesses | Implemented, evolving | Uses legacy text messages and slash-command guesses |
| Drawing | Implemented, hardening required | Live strokes work; validation and realtime throttling need further work |
| Game lifecycle | Implemented, evolving | Start, rounds, completion, and persistence exist |
| Reconnection | Partial | Socket retries and snapshots exist; durable reconnect-token flow is incomplete |
| Testing | Partial | Backend and frontend unit/integration coverage exists; CI is not configured |
| Operations | Not production-ready | No Dockerfile, CI/CD pipeline, graceful shutdown, or production runbook |

## Architecture

```text
Browser
  │
  ├── HTTPS ──> Next.js frontend / BFF
  │               │
  │               ├── authentication Route Handlers
  │               ├── session cookie management
  │               └── authenticated API forwarding
  │
  └── WebSocket ───────────────────────┐
                                      ▼
                                Go API server
                                  │       │
                                  │       └── in-memory room actors
                                  │           ├── players
                                  │           ├── chat history
                                  │           ├── game/round state
                                  │           └── drawing broadcasts
                                  │
                                  ▼
                              PostgreSQL
```

The browser never receives the long-lived backend bearer token. Authentication forms submit to Next.js Route Handlers, which store the backend token in an HttpOnly cookie. For realtime access, the frontend requests a 30-second, single-use ticket and then connects directly to the Go WebSocket endpoint.

More detailed diagrams and design notes are available in:

- [Architecture overview](ARCHITECTURE.md)
- [Frontend specification](frontend_spec.md)
- [Database design](database_design.md)
- [Backend plan](backend_plan.md)
- [Known backend shortcomings](shortcomings.md)

## Technology stack

### Backend

- Go 1.26
- `net/http` and `httprouter`
- PostgreSQL with `pgx`
- `coder/websocket`
- `golang-migrate`
- Cloudinary integration for avatars
- In-memory token-bucket HTTP rate limiting
- Testcontainers for database-backed tests

### Frontend

- Next.js 16 App Router
- React 19 and strict TypeScript
- Tailwind CSS and shadcn-style UI primitives
- TanStack Query for HTTP server state
- Zustand for room state
- React Hook Form and Zod
- Native Canvas 2D and Pointer Events
- Vitest and React Testing Library

## Repository layout

```text
.
├── cmd/
│   ├── api/                  # HTTP API, middleware, BFF-facing handlers
│   └── player-test/          # Development WebSocket client
├── internal/
│   ├── data/                 # PostgreSQL models and persistence
│   ├── realtime/             # Rooms, players, WebSockets, game lifecycle
│   └── validator/            # Backend input validation
├── migrations/               # Versioned PostgreSQL migrations
├── frontend/
│   ├── src/app/              # Next.js routes and BFF Route Handlers
│   ├── src/features/         # Auth, rooms, realtime, and drawing modules
│   ├── src/components/       # Shared UI and layout components
│   └── src/stores/           # Zustand stores
├── docs/                     # Architecture and flow diagrams
├── ARCHITECTURE.md
└── shortcomings.md
```

## Local development

### Prerequisites

- Go 1.26 or the version declared in [`go.mod`](go.mod)
- Node.js 20.9 or later
- npm
- PostgreSQL
- A database user allowed to create and modify the development schema
- Optional Cloudinary credentials for avatar uploads

### 1. Clone the repository

```bash
git clone <repository-url>
cd mithril-tiles
```

### 2. Configure the backend

Copy the example environment file:

```bash
cp .env.example .env
```

Configure at least:

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mithril_tiles?sslmode=disable
CORS_TRUSTED_ORIGINS=http://localhost:3000

CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_CLOUD_NAME=

# Comma-separated CIDRs for reverse proxies trusted to supply client IP headers.
RATE_LIMIT_TRUSTED_PROXIES=
```

The backend currently requires a root `.env` file at startup. Migrations in [`migrations/`](migrations) run automatically when the API starts, and the process must be launched from the repository root so the migration path resolves correctly.

Start the API:

```bash
go run ./cmd/api
```

The API listens on `http://localhost:4000` by default.

Useful development flags:

```text
-port
-env
-db-dsn
-db-max-open-conns
-db-min-idle-conns
-db-max-idle-time
-cors-trusted-origins
-limiter-enabled
-limiter-rps
-limiter-burst
-limiter-trusted-proxies
-message-history-capacity
```

Example:

```bash
go run ./cmd/api \
  -port=4000 \
  -env=development \
  -limiter-rps=10 \
  -limiter-burst=20
```

### 3. Configure the frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
```

The default local configuration is:

```dotenv
BACKEND_API_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:4000
APP_ORIGIN=http://localhost:3000
```

Start the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Verify the backend

```bash
curl http://localhost:4000/v1/healthcheck
```

## Configuration reference

### Backend environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CORS_TRUSTED_ORIGINS` | Yes for browser use | Comma-separated frontend origins accepted by CORS and WebSocket origin checks |
| `RATE_LIMIT_TRUSTED_PROXIES` | No | Comma-separated proxy CIDRs trusted for client-IP forwarding |
| `CLOUDINARY_CLOUD_NAME` | Avatar uploads only | Cloudinary account name |
| `CLOUDINARY_API_KEY` | Avatar uploads only | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Avatar uploads only | Cloudinary API secret |

### Frontend environment variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `BACKEND_API_URL` | Server only | Base URL used by Next.js Route Handlers |
| `NEXT_PUBLIC_BACKEND_WS_URL` | Browser | Public WebSocket origin for direct room connections |
| `APP_ORIGIN` | Server only | Expected frontend origin for mutating BFF requests |

For production, use HTTPS URLs and a `wss://` WebSocket URL.

## API overview

The Go API is rooted at `/v1`.

### Identity and sessions

| Method | Path | Authentication |
| --- | --- | --- |
| `POST` | `/v1/users/register` | Public, rate-limited |
| `POST` | `/v1/users/login` | Public, rate-limited |
| `POST` | `/v1/guest-sessions` | Public, rate-limited |
| `GET` | `/v1/session` | Bearer token |
| `PATCH` | `/v1/users/update` | Registered user |
| `DELETE` | `/v1/users/delete` | Registered user |
| `PATCH` | `/v1/users/avatar` | Registered user |

### Word packs

| Method | Path | Authentication |
| --- | --- | --- |
| `GET` | `/v1/word-packs-getall` | Registered user or guest |
| `GET` | `/v1/word-packs/:id` | Registered user |
| `POST` | `/v1/word-packs` | Registered user |
| `PATCH` / `DELETE` | `/v1/word-packs/:id` | Registered user |
| `POST` | `/v1/word-packs/:id/words` | Registered user |
| `PATCH` / `DELETE` | `/v1/words/:id` | Registered user |

### Rooms and realtime

| Method | Path | Authentication |
| --- | --- | --- |
| `POST` | `/v1/rooms/:roomID/start` | Registered user or guest |
| `POST` | `/v1/rooms/:roomID/ws-ticket` | Registered user or guest |
| `GET` | `/v1/rooms/:roomID/ws?ticket=...` | Single-use WebSocket ticket |

The frontend should use its BFF endpoints instead of calling authenticated backend routes directly from browser JavaScript.

## Realtime protocol

Client messages use JSON envelopes:

```json
{
  "type": "chat_message",
  "data": "hello"
}
```

```json
{
  "type": "draw_stroke",
  "data": {
    "from_x": 0.1,
    "from_y": 0.2,
    "to_x": 0.15,
    "to_y": 0.25,
    "color": "#111827",
    "brush_size": 0.012
  }
}
```

The server emits structured drawing strokes, authoritative room snapshots, and private drawer-word events. Some chat, lifecycle, and guessing responses are still legacy plain text.

The drawer word is sent through a private event and is deliberately excluded from the shared room snapshot:

```json
{
  "type": "drawer_word",
  "data": {
    "word": "Gandalf",
    "round_number": 1
  }
}
```

## Testing and quality checks

### Backend

Compile and run the backend tests:

```bash
go test ./...
```

Run race-enabled realtime tests:

```bash
go test -race ./internal/realtime
```

Run static analysis:

```bash
go vet ./...
```

Some API end-to-end tests use Testcontainers and therefore require a running Docker daemon.

### Frontend

```bash
cd frontend
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Security model

Implemented protections include:

- Password hashing with bcrypt
- Scoped, expiring authentication tokens
- HttpOnly frontend session cookies
- Bearer tokens hidden from browser JavaScript
- Origin validation on mutating BFF routes
- Explicit CORS and WebSocket origin allowlists
- Short-lived, single-use WebSocket tickets
- HTTP server timeouts
- Authentication endpoint rate limiting
- Bounded per-room message history
- Database constraints for active games and score integrity

This is not a security certification. Realtime event rate limiting, comprehensive drawing validation, token revocation, upload hardening, and operational monitoring remain incomplete.

## Known limitations

The most important outstanding work includes:

- Harden drawing validation, authorization, locking, and event-rate limits
- Standardize all server events on one versioned JSON protocol
- Complete reconnect identity restoration and late-join canvas recovery
- Reclaim idle, abandoned, and failed rooms
- Improve guess normalization, eligibility, and multi-word handling
- Replace hard-coded round configuration with persisted immutable settings
- Add server-side logout/token revocation and expired-token cleanup
- Propagate request cancellation through data-model operations
- Add graceful HTTP and room shutdown
- Add CI, container images, deployment manifests, observability, and runbooks
- Expand concurrent, failure-injection, accessibility, and browser E2E coverage

For the detailed engineering backlog, see [`shortcomings.md`](shortcomings.md).

## Production readiness

Before deploying publicly:

1. Resolve the release blockers documented in `shortcomings.md`.
2. Run the complete backend, race, frontend, and browser test suites.
3. Place both applications behind TLS-capable reverse proxies.
4. Configure exact CORS origins and trusted proxy CIDRs.
5. Use a managed PostgreSQL instance with backups and migration controls.
6. Store secrets in the deployment platform's secret manager.
7. Add graceful shutdown, structured logs, metrics, tracing, and alerts.
8. Add realtime abuse controls and load-test representative room traffic.

The frontend and backend are designed to deploy separately while remaining in the same repository.

## Contributing

Until formal contribution guidelines are added:

1. Create a focused branch.
2. Keep changes scoped and preserve existing behavior unless the change is intentional.
3. Add or update tests for behavioral changes.
4. Run the relevant backend and frontend checks.
5. Document known trade-offs in the pull request.

When reporting a bug, include reproduction steps, expected and actual behavior, browser or client information, and relevant sanitized logs. Never include tokens, WebSocket ticket URLs, database credentials, or other secrets.
