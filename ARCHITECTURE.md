# Mithril Tiles Architecture

Mithril Tiles is a real-time, multiplayer drawing-and-guessing game. It uses a Next.js application for the product experience and a Go API for authentication, durable game data, and authoritative live rooms.

The central rule is simple: the server owns game state. Browsers can request an action, but only the Go room server decides whether it is valid and what every participant should see next.

## System Overview

```text
Browser
  |
  | HTTPS: pages, session actions, room setup, administration
  v
Next.js 16 application
  |- React 19 UI and client state
  |- route handlers that proxy authenticated HTTP requests
  `- HttpOnly cookie storage for backend bearer tokens
  |
  | HTTP requests and a scoped WebSocket ticket request
  v
Go API
  |- authentication, roles, validation, rate limiting, and CORS
  |- PostgreSQL models and game-result persistence
  `- in-memory RoomManager and authoritative room actors
  |                                   |
  |                                   `- direct WebSocket room connections
  v
PostgreSQL                              Browser WebSocket clients
```

The frontend obtains a short-lived, single-use WebSocket ticket through its authenticated HTTP path. It then opens a direct WebSocket connection to the Go API. This keeps long-lived backend bearer tokens out of browser JavaScript while preserving a low-latency gameplay channel.

## Responsibilities

### Next.js frontend

The frontend owns rendering and local interaction state:

- landing, authentication, room selection, lobby, game, results, and admin pages;
- Canvas 2D drawing with normalized pointer coordinates;
- WebSocket connection lifecycle and realtime event rendering;
- browser-facing API routes that forward authenticated requests to the Go API;
- HttpOnly session-cookie storage and session restoration.

It does not decide the drawer, validate guesses, expose the secret word, calculate scores, or transition rounds.

### Go API

The Go API provides HTTP endpoints for identities, guest sessions, word packs, persistent bot profiles, game records, final scores, and WebSocket ticket issuance. Middleware authenticates user and guest principals, enforces administrator-only catalog management, validates trusted origins, and applies request rate limits.

During gameplay it is the authoritative gatekeeper. It verifies principal identity, drawer authorization, round state, game identity, and score transitions before sending realtime updates.

### Room manager and room actors

`RoomManager` holds active rooms in memory, keyed by room code. A room is created on demand and runs its own event loop. Typed commands and events are delivered through channels so joins, leaves, bot membership changes, game start, drawing, guesses, and bot actions are serialized in one place.

Each `Room` owns transient match state:

- connected human and bot players;
- host, room code, and active game metadata;
- round and game state;
- current drawer and private word;
- scores, correct-guess tracking, and bounded chat history;
- canvas revision and active-round stroke history;
- timer cancellation and lifecycle transitions;
- round-scoped bot runtimes.

The room broadcasts public snapshots and events, while private messages are used for information such as the drawer's word. Player identity is represented by stable UUIDs rather than display names.

### Game lifecycle and persistence

The realtime layer calls a `GameLifecycle` implementation at game boundaries. It creates durable games and participants when play begins, records rounds and round scores, and writes final rankings when the game completes. PostgreSQL therefore preserves the outcome, while the active room keeps only the state needed to run the match.

## Realtime Protocol

WebSockets carry the live room experience:

- room snapshots, membership changes, and chat;
- game start and round transitions;
- timer updates, score updates, and final score results;
- authorized drawing strokes and canvas resets;
- typed guess submissions and correct-guess outcomes.

Each WebSocket ticket is bound to a room and principal, has a short lifetime, and is consumed once. Origin validation applies to the socket upgrade as well as HTTP requests.

## Bot Architecture

Bots are first-class room participants backed by reusable `bot_profiles` records. Hosts can add active profiles before a game starts. The room creates a runtime for each bot and sends it round-scoped perceptions:

- a drawer bot receives its private word and returns normalized strokes;
- a guesser bot receives public masked-word and stroke information and returns a guess;
- bot guesses pass through the same typed submission and scoring path as human guesses;
- bot strokes pass through the same drawer authorization path as human strokes.

The provider interfaces keep gameplay independent of a particular AI vendor. The application selects Groq when `GROQ_API_KEY` is set, otherwise xAI Grok when `GROK_API_KEY` is set, otherwise Gemini when `GEMINI_API_KEY` is set. Deterministic guessing and template drawing remain the fallback when no provider is configured.

## Persistence Boundary

| In-memory room state | PostgreSQL state |
| --- | --- |
| connections, timers, current word, current drawer | users, guest sessions, and authentication tokens |
| live strokes, chat ring buffer, temporary correct guesses | word packs, words, and bot profiles |
| active scores and bot runtime scheduling | games, participants, rounds, round scores, and final scores |

The application deliberately does not persist raw canvas strokes, chat messages, or guess timelines. A completed match retains its game outcome rather than a replay stream.

## Operational Constraint

Active rooms are local to one Go process. The API must currently run as a single instance: horizontal replicas would maintain different room maps and would split a live room across servers. A future multi-instance design needs shared room coordination, such as sticky routing plus a distributed event and state layer.

## Related Documents

- [Database design](database_design.md)
- [Frontend specification](frontend_spec.md)
- [Bot implementation notes](implementation_bot.md)
