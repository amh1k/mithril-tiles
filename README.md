# Mithril Tiles

<p align="center">
  <strong>A realtime drawing-and-guessing game for fellowships, friends, and rival wizards.</strong>
</p>

<p align="center">
  <a href="./mithril-tiles-vid.mp4">Watch the Mithril Tiles gameplay demo</a>
</p>

<video src="./mithril-tiles-vid.mp4" controls muted playsinline width="100%">
  Your browser does not support embedded video. <a href="./mithril-tiles-vid.mp4">Watch the gameplay demo</a>.
</video>

Mithril Tiles turns the classic draw-and-guess party game into a shared realtime experience with a Middle-earth-inspired visual world. Create a room, gather a company, choose a word pack, race against the round clock, and see the final standings when the game ends.

Built as a full-stack project, it combines a Go API and WebSocket room server, PostgreSQL persistence, and a Next.js frontend with a secure backend-for-frontend layer.

## What You Can Do

- Create an account or enter as a guest.
- Create private rooms or join an existing fellowship with a room code.
- Pick a word pack and start a timed multiplayer game.
- Draw with mouse, touch, or pen input on a shared canvas.
- Submit guesses in realtime and receive authoritative score updates.
- Rotate the drawer every round and finish with persisted final rankings.
- Chat with the room while the game is in progress.
- Add active bot profiles to a room before play begins.
- Manage bot profiles from the administrator dashboard.

## Gameplay At A Glance

```text
Create or join a room
        |
Choose a word pack and gather players
        |
Host starts the game
        |
One drawer receives the secret word
        |
Shared canvas + realtime guesses + scoring
        |
Next drawer rotates in
        |
Final rankings are persisted and revealed
```

The room server is authoritative. It assigns drawers, protects the secret word, validates drawing actors, evaluates guesses, manages scores, and writes completed game results to PostgreSQL.

## Product Highlights

### Realtime multiplayer rooms

Every active room is an in-memory actor coordinating players, chat, canvas strokes, round progression, scores, and snapshots. Players connect through short-lived, single-use WebSocket tickets rather than exposing long-lived API credentials to the browser.

### A canvas built for play

The drawing experience supports mouse, touch, and pen input. Strokes are normalized before broadcast so every participant sees a consistent drawing regardless of screen size. Late room updates are synchronized through server snapshots.

### Complete game history

Games are more than temporary UI state. Mithril Tiles persists games, participants, rounds, round scores, and final scores, allowing the final scoreboard to be derived from authoritative results.

### Guests and registered players

People can join quickly as guests or create an account. The frontend keeps backend bearer tokens in HttpOnly cookies through its BFF routes, keeping them out of browser JavaScript.

### Bot-enabled rooms

Hosts can add administrator-managed bot profiles before a game starts. Bots participate through the same room rules as human players: they can be assigned as drawers or guessers, submit typed guesses, and receive the same round and score validation.

Bot gameplay is an experimental enhancement rather than the core promise of the product. Deterministic fallbacks keep the room playable when an optional AI provider is unavailable; AI-generated line drawings and raw-stroke guessing are still being refined.

## Architecture

```text
Browser
  |
  | HTTPS and authenticated BFF routes
  v
Next.js frontend
  |- App Router UI
  |- HttpOnly session-cookie management
  `- WebSocket ticket requests
  |
  | short-lived WebSocket ticket
  v
Go API and realtime room server
  |- HTTP handlers and authorization
  |- room actors and game lifecycle
  |- drawing, chat, guessing, and scoring
  `- optional bot runtimes and AI adapters
  |
  v
PostgreSQL
  |- users, guests, and bot profiles
  |- word packs and words
  `- games, participants, rounds, and scores
```

For deeper implementation details, see [ARCHITECTURE.md](ARCHITECTURE.md), [database_design.md](database_design.md), and [frontend_spec.md](frontend_spec.md).

## Technology

| Layer | Tools |
| --- | --- |
| API and realtime | Go, `net/http`, `httprouter`, `coder/websocket` |
| Data | PostgreSQL, `pgx`, `golang-migrate` |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| Client state and validation | Zustand, TanStack Query, Zod |
| Canvas | Native Canvas 2D and Pointer Events |
| Tests | Go testing, Testcontainers, Vitest, React Testing Library |

## Run Locally

### Prerequisites

- Go 1.26.3 or the version in [go.mod](go.mod)
- Node.js 20.9+ and npm
- PostgreSQL
- Docker for Testcontainers-backed API tests

### 1. Install the frontend

```bash
git clone <repository-url>
cd mithril-tiles
cd frontend && npm install && cd ..
```

### 2. Configure and start the API

```bash
cp .env.example .env
go run ./cmd/api
```

The API starts on `http://localhost:4000` by default and applies database migrations during startup.

At minimum, set the following in `.env`:

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mithril_tiles?sslmode=disable
CORS_TRUSTED_ORIGINS=http://localhost:3000
RATE_LIMIT_TRUSTED_PROXIES=
```

### 3. Configure and start the frontend

```bash
cp frontend/.env.local.example frontend/.env.local
cd frontend
npm run dev
```

Use these local defaults in `frontend/.env.local`:

```dotenv
BACKEND_API_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:4000
APP_ORIGIN=http://localhost:3000
```

Open `http://localhost:3000` to begin.

## Bots And Optional AI Providers

Bot profiles are persistent records managed by administrators. Room hosts can only choose active profiles, and can add or remove them before gameplay begins. Difficulty and behavior style let each profile use a different pacing and drawing policy.

At round start, a drawer bot receives the private target word. A guesser bot only receives public information, such as masked-word updates and canvas strokes. The room server remains the authority for round identity, drawing permission, score changes, and persistence.

Optional providers are selected at API startup:

| Environment variable | Provider |
| --- | --- |
| `GROQ_API_KEY` | Groq-hosted models |
| `GROK_API_KEY` | xAI Grok models |
| `GEMINI_API_KEY` | Google Gemini models |

Without a provider key, the game uses template drawing and deterministic guessing fallbacks. Keep provider keys and all `.env` files out of version control.

## Security And Reliability

The project already includes password hashing, scoped expiring tokens, HttpOnly session cookies, origin checks, explicit CORS and WebSocket allowlists, WebSocket tickets, bounded message history, database integrity constraints, and stable principal IDs for drawing authorization.

Mithril Tiles is an active project, not yet a public production service. The next engineering milestones are stronger realtime rate limiting, reconnection recovery, operational monitoring, CI, browser end-to-end coverage, graceful shutdown, and further accessibility work. The detailed backlog lives in [shortcomings.md](shortcomings.md).

## Quality Checks

```bash
# Backend
go test ./...
go test -race ./internal/realtime
go vet ./...

# Frontend
cd frontend
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Contributing

Keep changes focused, add tests when behavior changes, and never commit credentials, database URLs, provider keys, WebSocket tickets, or production logs.
