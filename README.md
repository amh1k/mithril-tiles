<p align="center">
  <img src="frontend/public/images/logo-gold.png" alt="Mithril Tiles" width="430" />
</p>

<h1 align="center">Gather. Draw. Guess.</h1>

<p align="center">
  <strong>A realtime drawing-and-guessing adventure for fellowships, friends, and rival wizards.</strong>
</p>

<p align="center">
  Realtime rooms &nbsp;&bull;&nbsp; Shared canvas &nbsp;&bull;&nbsp; Persisted scores &nbsp;&bull;&nbsp; AI rivals
</p>

<p align="center">
  <a href="#the-experience">Experience</a> &middot;
  <a href="#what-makes-it-special">Features</a> &middot;
  <a href="#bots-enter-the-fellowship">Bots</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#run-it-locally">Run locally</a>
</p>

---

Mithril Tiles transforms the familiar draw-and-guess party game into a complete Middle-earth-inspired multiplayer experience. Create a private room, gather a company, choose a word pack, race against the round clock, and discover whose score will be carved into the final standings.

This is not a static frontend demonstration. It is a full game system with authenticated identities, guest access, realtime WebSockets, authoritative room state, cross-device canvas input, round rotation, bot participants, and PostgreSQL-backed results.

<p align="center">
  <a href="https://raw.githubusercontent.com/amh1k/mithril-tiles/main/mithril-tiles-vid.mp4"><strong>Watch the full gameplay showcase</strong></a>
</p>

## The Experience

<p align="center">
  <strong>Enter the Drawing Halls</strong><br />
  <sub>A manuscript-inspired landing experience calls every fellowship to the game.</sub>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/amh1k/mithril-tiles/main/mithril-tiles-vid.mp4">
    <img src="docs/images/mithril-tiles-hero-preview.gif" alt="Mithril Tiles animated hero page with a Middle-earth map and Call of Mithril action" width="800" />
  </a>
</p>

<p align="center">
  <strong>Then take command of the canvas</strong><br />
  <sub>Draw, decipher, score, and survive every round together in realtime.</sub>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/amh1k/mithril-tiles/main/mithril-tiles-vid.mp4">
    <img src="docs/images/mithril-tiles-gameplay-preview.gif" alt="Mithril Tiles realtime room with players, drawing canvas, chat, guesses, and round timer" width="800" />
  </a>
</p>

## One Room. A Complete Game.

1. **Enter quickly.** Create an account or choose a guest identity and reach the game without unnecessary friction.
2. **Gather the fellowship.** Create a private room or join friends with a shareable room code.
3. **Shape the match.** The host selects a word pack and can invite active bot profiles before starting.
4. **Draw and decipher.** One participant receives the secret word while everyone else watches the shared canvas and submits guesses.
5. **Rotate and compete.** The drawer changes between rounds, correct guesses earn authoritative points, and the game advances on the server.
6. **Reveal the victor.** Completed rounds and final rankings are persisted and presented on the closing scoreboard.

## What Makes It Special

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>Realtime by design</h3>
      Each room coordinates chat, drawing strokes, guesses, timers, participants, and lifecycle events through a dedicated in-memory room actor.
    </td>
    <td width="50%" valign="top">
      <h3>An authoritative game loop</h3>
      The server assigns drawers, protects secret words, verifies drawing identity, evaluates guesses, calculates scores, and controls round transitions.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>A canvas for every device</h3>
      Mouse, touch, and pen input become normalized Canvas 2D strokes, keeping the drawing consistent across different viewport sizes.
    </td>
    <td width="50%" valign="top">
      <h3>Identity without friction</h3>
      Registered users and temporary guests share the same room model, while the frontend keeps backend credentials inside secure HttpOnly cookies.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>Results that outlive the room</h3>
      Games, participants, rounds, round scores, and final rankings are persisted in PostgreSQL instead of disappearing with the socket connection.
    </td>
    <td width="50%" valign="top">
      <h3>A world, not a template</h3>
      The interface carries one visual language from the hero page to authentication, room selection, live gameplay, administration, and final scores.
    </td>
  </tr>
</table>

## More Than a Pretty Canvas

- **Private drawer knowledge:** the selected word is delivered only to the active drawer and never included in shared room snapshots.
- **Stable participant identity:** drawing authorization and scoring use principal UUIDs rather than display names.
- **Authoritative snapshots:** newly connected and reconnecting clients receive current membership, phase, drawer, timing, and score state.
- **Secure browser sessions:** Next.js BFF routes keep backend bearer tokens away from client-side JavaScript.
- **Purpose-built WebSocket access:** clients connect using short-lived, single-use tickets with explicit origin validation.
- **Admin control:** administrators can manage word packs, words, and the persistent catalog of bot profiles.
- **Bounded room history:** chat history is intentionally capped to keep long-lived rooms from growing without limit.

## Bots Enter the Fellowship

Bots are integrated participants, not decorative chat responses. Administrators create persistent bot profiles; hosts choose from active profiles before the match; and the room can assign a bot as either drawer or guesser.

| As the drawer | As a guesser |
| --- | --- |
| Receives the private word through its round-scoped runtime | Receives only public masked-word and drawing information |
| Produces validated, normalized drawing strokes | Submits guesses through the same typed command path as humans |
| Must pass the room's stable-ID drawer authorization | Must pass the same round, identity, and scoring checks |

Optional Groq, xAI Grok, and Gemini adapters can power bot drawing and guessing. Without an AI key, Mithril Tiles retains deterministic guessing and template-drawing fallbacks.

> **Experimental frontier:** the bot architecture and complete gameplay path are working, while the quality of AI-generated line art and raw-stroke visual inference remains an active area of exploration. Human multiplayer is the heart of the experience; bots extend it when another challenger is needed.

## Architecture

```text
Browser
  |
  | HTTPS: pages, authentication, and BFF requests
  v
Next.js 16 + React 19
  |- themed product interface
  |- HttpOnly session-cookie management
  |- authenticated API forwarding
  `- short-lived WebSocket ticket acquisition
  |
  | direct WebSocket connection
  v
Go API + realtime room server
  |- authentication and authorization middleware
  |- room actors and authoritative game lifecycle
  |- chat, drawing, guessing, scoring, and snapshots
  `- round-scoped bot runtimes and provider adapters
  |
  | pgx
  v
PostgreSQL
  |- users, guests, tokens, and bot profiles
  |- word packs and words
  `- games, participants, rounds, and scores
```

The browser never receives the long-lived backend bearer token. Next.js stores it in an HttpOnly cookie and forwards authenticated HTTP requests from server-side route handlers. Realtime clients request a scoped ticket and then connect directly to the Go WebSocket server.

Detailed engineering references:

- [System architecture](ARCHITECTURE.md)
- [Database design](database_design.md)
- [Frontend specification](frontend_spec.md)
- [Bot implementation design](implementation_bot.md)

## Built With

| Area | Technology |
| --- | --- |
| Realtime backend | Go 1.26, `net/http`, `httprouter`, `coder/websocket` |
| Persistence | PostgreSQL, `pgx`, `golang-migrate` |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| State and validation | Zustand, TanStack Query, React Hook Form, Zod |
| Drawing | Native Canvas 2D, Pointer Events, normalized strokes |
| Verification | Go testing, Testcontainers, Vitest, React Testing Library |

## Run It Locally

<details>
<summary><strong>Prerequisites and complete setup</strong></summary>

### Prerequisites

- Go 1.26.3 or the version declared in [go.mod](go.mod)
- Node.js 20.9 or later and npm
- PostgreSQL
- Docker when running Testcontainers-backed API tests

### 1. Clone and install

```bash
git clone https://github.com/amh1k/mithril-tiles.git
cd mithril-tiles
cd frontend && npm install && cd ..
```

### 2. Start the API

```bash
cp .env.example .env
go run ./cmd/api
```

Set the backend environment at minimum:

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mithril_tiles?sslmode=disable
CORS_TRUSTED_ORIGINS=http://localhost:3000
RATE_LIMIT_TRUSTED_PROXIES=
```

The API listens on `http://localhost:4000` by default and applies database migrations during startup.

### 3. Start the frontend

```bash
cp frontend/.env.local.example frontend/.env.local
cd frontend
npm run dev
```

The local frontend environment uses:

```dotenv
BACKEND_API_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:4000
APP_ORIGIN=http://localhost:3000
```

Open `http://localhost:3000` and answer the Call of Mithril.

</details>

### Optional bot providers

Only one provider is selected at startup. Precedence follows the order below.

| Priority | Environment variable | Provider |
| ---: | --- | --- |
| 1 | `GROQ_API_KEY` | Groq-hosted models |
| 2 | `GROK_API_KEY` | xAI Grok models |
| 3 | `GEMINI_API_KEY` | Google Gemini models |
| Fallback | No key | Deterministic guesses and template drawings |

`GROQ_MODEL` can override the configured Groq model. Never commit `.env` files, provider keys, database credentials, or WebSocket ticket URLs.

## Quality Gates

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

Database-backed integration tests require Docker. The repository contains focused coverage for data persistence, room lifecycle behavior, provider parsing, realtime events, frontend routes, stores, and room presentation.

## Project Stage

Mithril Tiles already delivers its end-to-end multiplayer loop, from identity and room entry through realtime rounds and persisted final scores. Current work is focused on production hardening: richer reconnect recovery, realtime abuse controls, graceful shutdown, observability, CI, browser-level end-to-end coverage, and continued bot-quality improvements.

## Repository Guide

```text
cmd/api/                 HTTP API, middleware, startup, and handlers
cmd/player-test/         development WebSocket client
internal/data/           PostgreSQL models and persistence
internal/realtime/       rooms, game lifecycle, WebSockets, and bots
internal/validator/      backend input validation
migrations/              versioned database migrations
frontend/                Next.js product UI and BFF routes
docs/                    architecture and game-flow diagrams
```

## Contributing

Keep contributions focused, document intentional behavior changes, and add tests when behavior changes. Before opening a pull request, run the relevant quality gates and verify that no credentials, provider keys, ticket URLs, database URLs, or unsanitized logs are included.

<p align="center">
  <strong>May the sharpest eye claim the Mithril.</strong>
</p>
