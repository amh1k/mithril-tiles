# Mithril Tiles

Mithril Tiles is a real-time multiplayer drawing-and-guessing game with a Middle-earth-inspired manuscript interface. Players join a room, select a word pack, take turns drawing, submit guesses, and receive persisted round and final scores. Rooms can also include configurable bot players managed by administrators.

The repository contains a Go API and WebSocket server, a PostgreSQL data layer, and a separately deployable Next.js frontend that acts as a backend-for-frontend (BFF) for browser HTTP requests.

> [!IMPORTANT]
> Mithril Tiles is an active **alpha** project. The complete human multiplayer path and the initial bot flow are implemented, but the project is not yet ready for public production deployment. In particular, AI-generated bot drawings are experimental. See [Bot limitations](#bot-limitations) and [Production readiness](#production-readiness).

## Highlights

- Registered-user and guest-session authentication flows.
- Secure frontend sessions backed by HttpOnly cookies.
- Short-lived, single-use WebSocket tickets for room connections.
- Real-time rooms with chat, drawing, guessing, round progression, and final scores.
- Mouse, touch, and pen drawing with normalized Canvas 2D strokes.
- Host-selected word packs and authoritative room snapshots.
- Persisted games, participants, rounds, round scores, and final scores.
- Admin-managed persistent bot profiles.
- Host-controlled bot membership before a game begins.
- Round-scoped bot runtimes for deterministic and AI-assisted drawing and guessing.
- Optional Gemini, xAI Grok, and Groq provider integrations with safe fallbacks.
- Responsive Next.js interface with a deliberately themed visual design.

## Demo Flow

1. A registered user or guest creates or joins a room.
2. The host chooses a word pack and may add active bot profiles.
3. The host starts the game.
4. Each round assigns one participant as the drawer and privately sends that participant the target word.
5. The drawer emits normalized strokes; other participants submit guesses.
6. Correct guesses update authoritative room scores and are persisted with the game.
7. The API persists final results and the frontend renders the final-score view.

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Authentication | Implemented | Registered-user and guest flows are available. Server-side logout/revocation remains incomplete. |
| Frontend BFF | Implemented | Backend bearer tokens are stored in secure HttpOnly cookies rather than browser JavaScript. |
| Rooms and WebSockets | Implemented, evolving | Room actors, tickets, snapshots, chat, drawing, and lifecycle handling are in place. |
| Drawing and guesses | Implemented, hardening required | Human gameplay works; realtime rate limiting and further validation are still needed. |
| Game persistence | Implemented | Games, participants, rounds, scores, and final scores are stored in PostgreSQL. |
| Bot profiles | Implemented | Admin CRUD, active-profile discovery, and host-controlled room membership are available. |
| Bot gameplay | Experimental | Bots can draw and guess through the same room lifecycle, with deterministic fallbacks. |
| AI providers | Experimental | Gemini, xAI Grok, and Groq adapters exist. External provider reliability, cost controls, and quality need work. |
| Reconnection | Partial | Socket retries and snapshots exist; durable reconnect identity restoration is incomplete. |
| Testing | Partial | Backend and frontend automated tests exist; CI and browser E2E coverage are not yet configured. |
| Operations | Not production-ready | No full deployment runbook, observability stack, or graceful shutdown strategy yet. |

## Architecture

```text
Browser
  |
  | HTTPS
  v
Next.js frontend and BFF
  |- authentication Route Handlers
  |- HttpOnly session-cookie management
  |- authenticated backend API forwarding
  |
  | WebSocket ticket request
  v
Go API and WebSocket server
  |- HTTP handlers and authorization middleware
  |- in-memory room actors
  |  |- players and bot participants
  |  |- room snapshots and lifecycle state
  |  |- chat, guesses, and drawing broadcasts
  |  `- round-scoped bot runtimes
  |
  v
PostgreSQL
  |- users and guest sessions
  |- bot profiles
  |- word packs and words
  `- games, participants, rounds, and scores
```

The browser does not receive the long-lived backend bearer token. Next.js stores it in an HttpOnly cookie and calls the Go API from server-side Route Handlers. For realtime gameplay, the browser obtains a short-lived single-use ticket and connects directly to the Go WebSocket endpoint.

More detailed diagrams and design notes are available in [ARCHITECTURE.md](ARCHITECTURE.md), [database_design.md](database_design.md), [frontend_spec.md](frontend_spec.md), and [implementation_bot.md](implementation_bot.md).

## Technology Stack

### Backend

- Go 1.26
- `net/http` and `httprouter`
- PostgreSQL with `pgx`
- `coder/websocket`
- `golang-migrate`
- `bcrypt` password hashing
- Cloudinary avatar integration
- Testcontainers for database-backed tests

### Frontend

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS and shadcn-style UI primitives
- Zod validation
- TanStack Query and Zustand
- Native Canvas 2D and Pointer Events
- Vitest and React Testing Library

## Repository Layout

```text
.
|- cmd/api/                 # HTTP API, middleware, startup, and handlers
|- cmd/player-test/         # Development WebSocket client
|- internal/data/           # PostgreSQL models and persistence
|- internal/realtime/       # Rooms, WebSockets, game lifecycle, and bots
|- internal/validator/      # Backend input validation
|- migrations/              # Versioned PostgreSQL migrations
|- frontend/                # Next.js frontend and BFF routes
|- docs/                    # Architecture and game-flow diagrams
|- implementation_bot.md    # Bot implementation design and phases
`- shortcomings.md          # Engineering backlog and known shortcomings
```

## Local Development

### Prerequisites

- Go 1.26.3 or the version declared in [go.mod](go.mod)
- Node.js 20.9 or later and npm
- PostgreSQL
- Docker, if running Testcontainers-backed API tests
- Optional Cloudinary credentials for avatar uploads
- Optional AI-provider key for experimental bots

### 1. Clone and install frontend dependencies

```bash
git clone <repository-url>
cd mithril-tiles
cd frontend && npm install && cd ..
```

### 2. Configure the backend

Create a root `.env` file from the example:

```bash
cp .env.example .env
```

At minimum, configure:

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mithril_tiles?sslmode=disable
CORS_TRUSTED_ORIGINS=http://localhost:3000
RATE_LIMIT_TRUSTED_PROXIES=

# Optional avatar uploads
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Start the API from the repository root. Migrations run automatically during startup.

```bash
go run ./cmd/api
```

The API listens on `http://localhost:4000` by default.

### 3. Configure the frontend

```bash
cp frontend/.env.local.example frontend/.env.local
```

Default local configuration:

```dotenv
BACKEND_API_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:4000
APP_ORIGIN=http://localhost:3000
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`.

### 4. Verify the API

```bash
curl http://localhost:4000/v1/healthcheck
```

## Bot Profiles and Gameplay

Bot profiles are persistent database records, separate from a bot's temporary membership in a room.

### Bot profile management

Registered administrators can manage the global bot catalog:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/admin/bot-profiles` | List active and inactive bot profiles |
| `POST` | `/v1/admin/bot-profiles` | Create a bot profile |
| `PATCH` | `/v1/admin/bot-profiles/:id` | Update a bot profile |
| `DELETE` | `/v1/admin/bot-profiles/:id` | Delete an unused bot profile |

Authenticated room hosts discover only active profiles through:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/bot-profiles` | List active profiles available to rooms |
| `POST` | `/v1/rooms/:roomID/bots` | Add a selected active bot to a room |
| `DELETE` | `/v1/rooms/:roomID/bots` | Remove a bot from a room |

Bot profiles support `easy`, `normal`, `hard`, and `custom` difficulty values plus a free-form behavior style such as `cautious`, `fast`, `minimalist`, or `detailed`.

### Bot runtime

At round start, every bot receives a round-scoped runtime:

- A drawer bot receives the private target word and produces validated drawing strokes.
- A guesser bot receives only public information: the masked word and public drawing strokes.
- Bot guesses are submitted through the same typed room command path as human guesses.
- The room remains authoritative for drawer authorization, round identity, score changes, and persistence.
- If a provider fails, drawing falls back to templates and guessing falls back to deterministic candidates where possible.

### Optional AI providers

Provider selection occurs at API startup. Only configure one provider key unless intentional precedence is desired.

| Priority | Environment variable | Provider |
| --- | --- | --- |
| 1 | `GROQ_API_KEY` | Groq-hosted models |
| 2 | `GROK_API_KEY` | xAI Grok models |
| 3 | `GEMINI_API_KEY` | Google Gemini models |
| Fallback | none | Template drawing and deterministic guesses |

Groq optionally accepts a model override:

```dotenv
GROQ_API_KEY=your_groq_key
GROQ_MODEL=openai/gpt-oss-120b
```

When `GROQ_MODEL` is absent, the current default is `llama-3.3-70b-versatile`.

Never commit `.env`, frontend `.env.local`, provider keys, database URLs, or WebSocket ticket URLs.

## Bot Limitations

The bots are a meaningful engineering milestone, not a finished AI gameplay system. Their weaknesses are intentional to document because they materially affect game quality.

### Drawing quality is experimental

AI drawing providers are text models asked to emit low-level normalized line segments. They may return a valid JSON stroke plan that is visually unrelated to the requested word, overly abstract, repetitive, or difficult for humans to recognize. Prompting can reduce grids, borders, and text, but cannot guarantee semantic drawing quality.

The most reliable current drawings are deterministic templates for a small set of concrete words. The generic fallback is deliberately simple and is not intended to represent the target word.

### Guessing is constrained and incomplete

Guesser bots never receive the secret target word. They infer from the masked word and raw stroke coordinates, which is much less informative than a rendered image. Provider guesses must exactly satisfy the revealed-letter mask, and many plausible responses are rejected because they include punctuation, explanation, wrong spacing, or an incompatible length.

Guess evaluation is currently driven primarily by masked-word updates rather than every incoming stroke, so a bot can miss the moment when enough visual information becomes available. This needs a throttled stroke-driven evaluation strategy.

### External providers are nondeterministic

Hosted AI calls can time out, rate-limit, return malformed JSON, wrap JSON in Markdown fences, return an empty candidate, or incur usage cost. The code validates provider output and falls back when possible, but it does not yet include circuit breaking, budgets, queueing, or production-grade metrics.

### Bots are not network clients

Bots are in-process room participants, not WebSocket connections. Their behavior is driven through internal runtime events rather than a client socket. Direct-message paths intended for human players are therefore not a bot perception channel.

### Recommended next steps

1. Expand curated drawing templates and compose them from reusable shapes.
2. Trigger guesses after meaningful stroke batches with rate limiting and debouncing.
3. Add provider circuit breakers, request budgets, metrics, and tracing.
4. Add deterministic replay fixtures for complete bot rounds.
5. Consider an SVG or image-generation pipeline for richer bot art instead of raw coordinate generation.

## Realtime Protocol

Client messages use JSON envelopes.

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

The server emits structured room snapshots, draw strokes, private `drawer_word` events, public `guesser_word` events, and correct-guess events. Some chat and lifecycle messages remain legacy plain text while the protocol is standardized.

The private drawer-word event is deliberately excluded from shared room snapshots:

```json
{
  "type": "drawer_word",
  "data": {
    "word": "Gandalf",
    "round_number": 1
  }
}
```

## Security Model

Implemented safeguards include:

- bcrypt password hashing
- expiring scoped authentication tokens
- HttpOnly frontend session cookies
- backend bearer tokens hidden from browser JavaScript
- origin validation on mutating BFF routes
- explicit CORS and WebSocket origin allowlists
- short-lived, single-use WebSocket tickets
- HTTP server timeouts
- authentication endpoint rate limiting
- bounded per-room message history
- database constraints for game and score integrity
- stable principal IDs for drawing authorization
- validation of provider-generated bot strokes before broadcast

This is not a security certification. Realtime event rate limiting, comprehensive abuse protection, token revocation, upload hardening, and operational monitoring remain incomplete.

## Testing and Quality Checks

### Backend

```bash
go test ./...
go test -race ./internal/realtime
go vet ./...
```

Some API end-to-end tests use Testcontainers and require a running Docker daemon.

### Frontend

```bash
cd frontend
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Known Limitations

Beyond the bot limitations above, important outstanding work includes:

- harden drawing validation, locking, authorization, and realtime event-rate limits
- standardize all events on one versioned JSON protocol
- complete reconnect identity restoration and late-join canvas recovery
- reclaim idle, abandoned, and failed rooms
- improve guess normalization, eligibility, and multi-word handling
- replace hard-coded round configuration with persisted immutable settings
- add server-side logout/token revocation and expired-token cleanup
- propagate request cancellation through data-model operations
- add graceful HTTP and room shutdown
- add CI, deployment manifests, structured metrics, tracing, alerts, and runbooks
- expand concurrent, failure-injection, accessibility, and browser E2E coverage

For the detailed engineering backlog, see [shortcomings.md](shortcomings.md).

## Production Readiness

Before public deployment:

1. Resolve the release blockers documented in [shortcomings.md](shortcomings.md).
2. Add CI that runs backend, frontend, race, and browser E2E checks.
3. Place both applications behind TLS-capable reverse proxies and use exact CORS origins.
4. Configure managed PostgreSQL backups, migration controls, and secret management.
5. Add graceful shutdown, structured logs, metrics, tracing, and alerting.
6. Add WebSocket abuse controls and load-test realistic room traffic.
7. Treat AI providers as optional integrations with budgets, rate limits, and fallbacks.

## Contributing

1. Create a focused branch.
2. Keep changes scoped and document intentional behavior changes.
3. Add or update tests for behavioral changes.
4. Run the relevant backend and frontend quality checks.
5. Never include secrets, provider keys, ticket URLs, database credentials, or unsanitized production logs in commits, issues, or pull requests.
