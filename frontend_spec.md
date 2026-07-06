# Mithril Tiles Frontend Specification

## 1. Purpose

This document specifies the production direction for the Mithril Tiles web
frontend. The frontend will be a separately deployable Next.js application,
kept in the `/frontend` directory of this repository during development.

The first milestone is a responsive gameplay MVP:

- Registered-user and guest authentication.
- Room creation and joining.
- Ticket-authenticated WebSocket connections.
- Lobby presence and chat.
- Real-time drawing with mouse, pen, and touch.
- Guess submission.
- Round status, scores, and final results once the required backend protocol is
  available.

Profile editing, avatar management, word-pack administration, replays, and
advanced drawing tools are outside the first frontend milestone.

## 2. Current Backend Readiness

The frontend may immediately integrate with:

- User registration and login.
- Guest-session creation.
- Bearer-authenticated HTTP requests.
- Single-use, room-bound WebSocket tickets.
- Origin-validated WebSocket upgrades.
- Room creation through the first WebSocket join.
- Text chat.
- Basic draw-stroke broadcasting.
- Host-triggered game start when a word-pack ID is already known.

The following are not sufficiently supported for a production gameplay UI:

- Restoring the authenticated principal after a browser refresh.
- Discovering active word packs.
- Receiving an authoritative room snapshot.
- Identifying the host, current drawer, and players through structured events.
- Privately delivering the selected word to the drawer.
- Receiving structured round, score, guess, and game-completion events.
- Restoring the canvas for late joiners or reconnecting players.
- Distinguishing a locally rendered stroke from its server echo using stable
  principal and stroke IDs.

The frontend must not permanently encode gameplay logic by parsing human-readable
server strings. A temporary legacy adapter is allowed only to unblock early
integration.

## 3. Technology Stack

Use current stable versions when the frontend is scaffolded and commit the npm
lockfile.

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js App Router | Server Components, Route Handlers, layouts, and a clean BFF boundary |
| Language | TypeScript with `strict: true` | Enforces explicit contracts at HTTP and WebSocket boundaries |
| Styling | Tailwind CSS | Responsive design and a small custom design system |
| UI primitives | shadcn/ui | Accessible, editable components without locking the UI into a large framework |
| HTTP server state | TanStack Query | Query caching, mutation state, retries, and invalidation |
| Realtime client state | Zustand | Small state machine-oriented store without putting high-frequency canvas data in React |
| Forms | React Hook Form | Controlled form lifecycle with minimal rerenders |
| Runtime validation | Zod | Validates untrusted HTTP and WebSocket payloads |
| Icons | Lucide React | Consistent, accessible icon set |
| Toasts | Sonner | Lightweight mutation and connection feedback |
| Drawing | Native Canvas 2D and Pointer Events | Direct match for the backend line-segment protocol |
| Unit tests | Vitest | Fast TypeScript unit tests |
| Component tests | React Testing Library | Behavior-oriented component verification |
| API/WebSocket mocks | MSW plus a test WebSocket adapter | Deterministic frontend tests without requiring the Go server |
| End-to-end tests | Playwright | Multi-browser and multi-context multiplayer testing |
| Package manager | npm | Keep a committed `package-lock.json` |

References:

- [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation)
- [shadcn/ui for Next.js](https://ui.shadcn.com/docs/installation/next)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [Zod](https://zod.dev/)
- [Playwright](https://playwright.dev/docs/intro)

Do not introduce Fabric.js or Konva for the MVP. Mithril Tiles exchanges raster
line segments, not selectable scene-graph objects. A retained-object library
would add bundle size and state synchronization complexity without helping the
current protocol.

## 4. Repository and Project Structure

```text
frontend/
  src/
    app/
      (marketing)/
        page.tsx

      (auth)/
        login/
          page.tsx
        register/
          page.tsx
        guest/
          page.tsx

      play/
        page.tsx

      room/
        [roomCode]/
          page.tsx
          loading.tsx
          error.tsx

      api/
        auth/
          login/route.ts
          register/route.ts
          guest/route.ts
          logout/route.ts
          session/route.ts
        rooms/
          [roomCode]/
            ticket/route.ts
            start/route.ts
        word-packs/route.ts

      layout.tsx
      error.tsx
      not-found.tsx
      globals.css

    components/
      ui/
      layout/
      feedback/

    features/
      auth/
        components/
        schemas/
        hooks/
      rooms/
        components/
        schemas/
        room-code.ts
      realtime/
        hooks/
        protocol/
        socket-state.ts
      drawing/
        components/
        canvas-engine.ts
        coordinates.ts
        schemas.ts
      chat/
        components/
        schemas.ts
      game/
        components/
        schemas/

    lib/
      api/
        backend.ts
        errors.ts
      auth/
        cookies.ts
        origin.ts
      env/
        client.ts
        server.ts
      validation/

    stores/
      room-store.ts

    types/
      backend.ts
      protocol.ts

    styles/
      tokens.css

  e2e/
    auth.spec.ts
    room.spec.ts
    drawing.spec.ts
    game.spec.ts

  public/
  .env.local.example
  next.config.ts
  package.json
  package-lock.json
  playwright.config.ts
  vitest.config.ts
```

Rules:

- Route files compose features; they do not contain reusable business logic.
- Feature-specific components, schemas, hooks, and tests stay in their feature
  folder.
- Generic shadcn primitives stay in `components/ui`.
- Browser-only modules begin with `"use client"` only where required.
- Canvas and WebSocket modules must not access `window` during module import.
- Use the `@/*` alias for `frontend/src/*`.

## 5. Application Routes and Screens

### `/`

Landing page with:

- Create Room.
- Join Room.
- Login.
- Register.
- Play as Guest.
- Short explanation of the drawing-and-guessing loop.

### `/login`

- Email and password.
- Inline backend validation and credential errors.
- Link to registration and guest play.
- Redirect to `/play` after successful login.

### `/register`

- Display name, handle, email, password, and password confirmation.
- Do not include avatar upload during initial registration.
- Enforce backend-compatible limits before submission.
- Redirect to `/play` after successful registration.

### `/guest`

- Display-name field.
- Explain that guest identity and history are temporary.
- Redirect to `/play` after successful creation.

### `/play`

- Create a room using a cryptographically generated, uppercase, human-readable
  room code.
- Join an existing room by code.
- Normalize room codes consistently before navigation.
- Do not call the existing standalone `POST /v1/rooms/:roomID` endpoint; the
  current backend creates in-memory rooms when the first authenticated player
  opens the WebSocket.

### `/room/[roomCode]`

One state-driven page covering:

- Obtaining a ticket.
- Connecting.
- Lobby.
- Active drawing round.
- Round cooldown.
- Game completion.
- Reconnecting.
- Room full.
- Authentication failure.
- Fatal backend/protocol failure.

Do not create separate URLs for lobby, round, and results. Remaining on one URL
preserves the socket and avoids navigation races during server-driven phase
changes.

## 6. Responsive Game Layout

### Desktop

- Top bar: room code, copy action, connection status, round number, countdown.
- Left panel: players, host, current drawer, readiness, scores.
- Center: responsive drawing canvas and drawer toolbar.
- Right panel: chat, guesses, and system events.
- Game-over overlay: final ranking, winner, leave, and play-again actions.

### Mobile

- Canvas remains the primary surface.
- Player list, scores, and chat use tabs or bottom sheets.
- Drawer toolbar stays reachable without covering the drawing surface.
- Interactive controls have a minimum 44-by-44 CSS-pixel target.
- Respect safe-area insets.
- Keep the message input visible when the software keyboard opens.

### Visual direction

- Dark fantasy/tile aesthetic.
- Charcoal and deep slate surfaces with restrained mithril/silver accents.
- Strong contrast and readable typography over decorative effects.
- Clear differentiation between chat, guesses, and system announcements.
- Respect `prefers-reduced-motion`.
- Do not communicate player role or connection status by color alone.

## 7. Authentication Architecture

### Decision

Use Next.js as a backend-for-frontend. The browser must not store the Go bearer
token in `localStorage`, `sessionStorage`, Zustand, or React state.

### Authentication flow

1. The browser submits login, registration, or guest data to a same-origin
   Next.js Route Handler.
2. The Route Handler validates the request with Zod.
3. It calls the corresponding Go endpoint.
4. It validates the Go response.
5. It stores the returned token in an HttpOnly cookie.
6. It returns only the safe principal/session representation to the browser.

Cookie requirements:

```text
HttpOnly: true
Secure: true in staging and production
SameSite: Lax
Path: /
Expires/Max-Age: no later than the backend token expiry
```

The cookie name must not start with `NEXT_PUBLIC_`. Recommended production name:
`__Host-mithril_session`.

Mutating Route Handlers must:

- Accept only intended methods and content types.
- Compare `Origin` with `APP_ORIGIN`.
- Reject missing or mismatched production origins.
- Proxy only fixed backend paths.
- Never accept a caller-provided backend URL.

Logout currently clears the frontend cookie only. The backend has no token
revocation endpoint, so the spec must not claim that logout invalidates the
underlying token.

### Session restoration blocker

The backend does not expose a current-principal endpoint. Production session
restoration requires an authenticated endpoint such as:

```http
GET /v1/session
Authorization: Bearer <token>
```

Expected response:

```json
{
  "principal": {
    "type": "user",
    "id": "uuid",
    "display_name": "Player",
    "handle": "player",
    "avatar_url": ""
  }
}
```

Do not permanently solve this by duplicating the entire user object into a
long-lived browser-readable cookie.

## 8. Next.js BFF Routes

| Frontend route | Go route | Purpose |
|---|---|---|
| `POST /api/auth/register` | `POST /v1/users/register` | Register and establish cookie session |
| `POST /api/auth/login` | `POST /v1/users/login` | Login and establish cookie session |
| `POST /api/auth/guest` | `POST /v1/guest-sessions` | Create guest and establish cookie session |
| `POST /api/auth/logout` | None | Clear frontend cookie |
| `GET /api/auth/session` | Required new session endpoint | Restore principal |
| `POST /api/rooms/:roomCode/ticket` | `POST /v1/rooms/:roomID/ws-ticket` | Obtain one-use WebSocket ticket |
| `POST /api/rooms/:roomCode/start` | `POST /v1/rooms/:roomID/start` | Host starts game |
| `GET /api/word-packs` | Required new list endpoint | Select active word pack |

The BFF maps backend failures into one consistent frontend error:

```ts
type FrontendApiError = {
  status: number
  code:
    | "bad_request"
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "conflict"
    | "validation_failed"
    | "rate_limited"
    | "server_error"
  message: string
  fieldErrors?: Record<string, string>
  retryAfterSeconds?: number
}
```

Preserve the backend `Retry-After` value on HTTP 429 responses.

## 9. Verified Go HTTP Contracts

The Go server rejects unknown JSON fields and bodies larger than 1 MiB for
ordinary JSON endpoints.

All failures use:

```json
{ "error": "message" }
```

Validation failures use:

```json
{
  "error": {
    "email": "must be a valid email address"
  }
}
```

### Register

```http
POST /v1/users/register
Content-Type: application/json
```

```json
{
  "display_name": "Player One",
  "handle": "player-one",
  "email": "player@example.com",
  "password": "minimum-eight-characters",
  "avatar_url": ""
}
```

Success: `201 Created`.

```json
{
  "user": {
    "id": "uuid",
    "created_at": "RFC3339",
    "updated_at": "RFC3339",
    "display_name": "Player One",
    "account_status": "active",
    "handle": "player-one",
    "email": "player@example.com",
    "activated": false,
    "avatar_url": ""
  },
  "authentication_token": {
    "token": "plaintext-token",
    "expiry": "RFC3339"
  }
}
```

Backend validation:

- Display name: 3–60 bytes.
- Handle: 3–60 bytes.
- Email: required and email-shaped.
- Password: 8–72 bytes.

### Login

```http
POST /v1/users/login
Content-Type: application/json
```

```json
{
  "email": "player@example.com",
  "password": "password"
}
```

Success: `201 Created`, with the same `user` and `authentication_token` envelope
as registration.

### Guest session

```http
POST /v1/guest-sessions
Content-Type: application/json
```

```json
{ "display_name": "Guest One" }
```

Success: `201 Created`.

```json
{
  "guest_session": {
    "id": "uuid",
    "display_name": "Guest One",
    "created_at": "RFC3339"
  },
  "authentication_token": {
    "token": "plaintext-token",
    "expiry": "RFC3339"
  }
}
```

### WebSocket ticket

```http
POST /v1/rooms/{roomCode}/ws-ticket
Authorization: Bearer <token>
```

Success: `201 Created`.

```json
{
  "websocket_ticket": {
    "ticket": "single-use-ticket",
    "room_code": "ROOM01",
    "expires_at": "RFC3339",
    "created_at": "RFC3339"
  }
}
```

The ticket is room-bound, single use, and currently valid for 30 seconds.

### Start game

```http
POST /v1/rooms/{roomCode}/start
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "word_pack_id": "uuid",
  "settings_snapshot": {}
}
```

Success: `201 Created`.

```json
{
  "game": {},
  "game_participants": [],
  "round": {}
}
```

Possible failures:

- `400`: fewer than two players.
- `401`: missing/invalid authentication.
- `403`: requester is not the host.
- `409`: start in progress, game already started, or room closed.

Important: the response currently contains `round.word_text_snapshot`. Because
the HTTP requester is the host and the drawer is randomly chosen, this may
reveal the word to a non-drawer. The frontend must not treat this response as
the final secure word-delivery design.

### Current-user operations

```http
PATCH /v1/users/update
DELETE /v1/users/delete
PATCH /v1/users/avatar
```

These require a registered-user bearer token. Avatar upload is multipart form
data with field name `avatar` and a current request limit of 5 MiB.

### Word-pack and word mutations

The backend currently supports create/update/delete mutations but no list/read
route suitable for gameplay discovery. They are not part of the MVP UI.

## 10. WebSocket Connection Lifecycle

The browser cannot attach the Bearer header to `new WebSocket()`, so it uses the
ticket flow:

1. Call `POST /api/rooms/{roomCode}/ticket`.
2. Receive the plaintext ticket.
3. Immediately open:

```text
{NEXT_PUBLIC_BACKEND_WS_URL}/v1/rooms/{roomCode}/ws?ticket={urlEncodedTicket}
```

4. Discard the ticket after the connection attempt.

`useRoomSocket` states:

```text
idle
requesting_ticket
connecting
connected
reconnecting
closed
failed
```

Rules:

- Every attempt obtains a fresh ticket.
- Never retry an already-used ticket.
- Close the socket with route cleanup.
- Prevent simultaneous socket instances for one room page.
- Use exponential backoff with jitter: 500 ms, 1 s, and 2 s, capped at three
  automatic reconnect attempts.
- Do not reconnect after explicit logout, route exit, policy violation, or a
  terminal authentication error.
- If automatic reconnect fails, show a manual reconnect action and preserve the
  room code.
- The backend reconnect-token command is not part of frontend v1.

Because the backend does not yet send an authoritative snapshot, reconnecting
cannot reliably restore role, score, round, word, or canvas. The UI must describe
reconnection as degraded until the snapshot contract exists.

## 11. Current Realtime Protocol

### Client to server

Chat:

```json
{ "type": "chat_message", "data": "hello" }
```

Temporary guess submission:

```json
{ "type": "chat_message", "data": "/guess apple" }
```

Drawing:

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

The backend overwrites `from` and `room_code`; the browser should not claim
another sender or room.

### Server to client

Draw strokes are structured:

```json
{
  "type": "draw_stroke",
  "data": {
    "from": "Player One",
    "room_code": "ROOM01",
    "from_x": 0.1,
    "from_y": 0.2,
    "to_x": 0.15,
    "to_y": 0.25,
    "color": "#111827",
    "brush_size": 0.012
  }
}
```

Most other messages are plain text, including:

- Welcome message.
- Recent-message history.
- Join/leave announcements.
- `RoundN has started`.
- `RoundN has ended`.
- Correct/wrong guess feedback.
- Game completion or persistence failure.

The frontend protocol adapter must:

1. Attempt JSON parsing.
2. Validate known JSON envelopes with Zod.
3. Route `draw_stroke` to the canvas engine.
4. Treat other frames as escaped plain text.
5. Optionally classify known legacy text for temporary display only.
6. Never use plain-text parsing as the permanent source of authoritative game
   state.

## 12. Required Structured Realtime Contract

Before full gameplay is considered complete, the backend should emit:

```ts
type ServerEvent<TType extends string, TData> = {
  version: 1
  type: TType
  room_code: string
  sequence: number
  occurred_at: string
  data: TData
}
```

Required events:

- `room_snapshot`
- `player_joined`
- `player_left`
- `host_changed`
- `game_starting`
- `game_started`
- `round_started`
- `canvas_cleared`
- `draw_stroke`
- `guess_submitted`
- `guess_result`
- `score_updated`
- `round_ended`
- `game_ended`
- `game_persistence_failed`
- `error`

`room_snapshot` must contain:

- Stable room code.
- Stable principal IDs and principal types.
- Display names and avatars.
- Host ID.
- Game and round states.
- Current round and total rounds.
- Drawer ID.
- Server time and round deadline.
- Current scores.
- Whether the receiving principal may draw.
- Current word only when the recipient is the drawer.
- Recent chat/activity.
- Canvas snapshot or retained strokes.

The backend must create recipient-specific payloads so the secret word cannot
leak to guessers.

Replace the slash-command guess protocol with:

```json
{
  "type": "submit_guess",
  "data": {
    "guess": "apple",
    "client_message_id": "uuid"
  }
}
```

Drawing events should add:

```json
{
  "stroke_id": "uuid",
  "sender_id": "uuid"
}
```

## 13. Client State Ownership

| State | Owner |
|---|---|
| HTTP queries and mutations | TanStack Query |
| Authenticated principal returned to UI | Session query |
| Room snapshot, players, scores, phases | Zustand room store |
| Socket object and reconnect timers | `useRoomSocket` refs |
| Chat draft and open dialogs | Local component state |
| Canvas context and active pointer | Mutable refs in drawing feature |
| Stroke transmit queue | Mutable queue in canvas engine |
| Room code | URL |
| Bearer token | HttpOnly cookie only |

Do not put these in Zustand:

- `WebSocket` instances.
- Canvas contexts.
- Pointer-move coordinates.
- Animation-frame IDs.
- Every incoming stroke.

Bound chat and activity arrays on the client. Retain at most 200 rendered entries
unless pagination is introduced.

## 14. Drawing Engine

### Rendering model

- Use `<canvas>` with a `CanvasRenderingContext2D`.
- Keep drawing operations imperative.
- React owns canvas placement, permissions, toolbar props, and lifecycle.
- The canvas engine owns sizing, pointer tracking, rendering, and outbound
  segment batching.

### Resolution and resizing

1. Observe the CSS dimensions with `ResizeObserver`.
2. Set backing dimensions to CSS dimensions multiplied by
   `window.devicePixelRatio`.
3. Reset the context transform before applying the DPR scale.
4. Redraw retained local strokes after a resize.
5. Keep the canvas responsive with a consistent aspect ratio on desktop and the
   maximum practical area on mobile.

### Coordinates

Transmit normalized coordinates:

```text
normalizedX = pointerX / canvasCssWidth
normalizedY = pointerY / canvasCssHeight
```

Clamp coordinates to `[0,1]`. Render remote coordinates by multiplying them by
the receiving canvas’s CSS dimensions.

Transmit brush size relative to the smaller canvas dimension:

```text
normalizedBrush = brushPixels / min(canvasWidth, canvasHeight)
```

### Pointer handling

- Handle `pointerdown`, `pointermove`, `pointerup`, and `pointercancel`.
- Call `setPointerCapture` on pointer down.
- Track only the active pointer ID.
- Use `touch-action: none` on the drawing surface.
- Ignore non-primary mouse buttons.
- Support pressure later; do not include pressure in MVP protocol.

### Stroke appearance

- `lineCap = "round"`.
- `lineJoin = "round"`.
- Provide a small validated color palette rather than arbitrary CSS strings.
- Provide a bounded brush-size selector.
- Use a neutral canvas background that is identical for all clients.

### Local and network performance

- Render the drawer’s stroke locally before receiving the echo.
- Use `requestAnimationFrame` for rendering work.
- Coalesce outbound movement into no more than 30 network segments per second.
- Never call React state setters for every pointer event.
- Stop and clear transmit queues when the round ends or permissions change.
- Clear the canvas only from an authoritative round/canvas event.

The current temporary echo rule is:

```text
If incoming stroke.from equals the current display name, do not draw it again.
```

This is knowingly ambiguous because display names are not unique. Replace it
with `sender_id` and `stroke_id` as soon as the backend emits them.

Excluded from MVP:

- Undo/redo.
- Eraser history semantics.
- Fill tool.
- Shapes.
- Text.
- Image upload.
- Export.
- Replay.
- Collaborative multi-drawer mode.

## 15. Error and Connection UX

Provide distinct UI for:

- Initial loading.
- Offline browser.
- Ticket request failure.
- Ticket expiry.
- Authentication expiry.
- Room full.
- Forbidden game start.
- Not enough players.
- Game already starting/started.
- Reconnecting.
- Reconnect exhausted.
- Unsupported/malformed protocol event.
- Game persistence failure.
- Generic server failure.

Never silently convert a fatal connection state into an empty lobby.

Use:

- Inline errors for forms.
- Toasts for transient actions.
- Persistent banners for degraded connection.
- Blocking dialogs only for terminal room/session failures.

## 16. Security Requirements

- Bearer tokens remain server-side in HttpOnly cookies.
- Validate BFF request origins.
- Use `Secure` cookies outside local development.
- Validate all environment variables at startup.
- Validate all backend JSON with Zod.
- Escape all user and server text; never use `dangerouslySetInnerHTML`.
- Never log bearer tokens, cookies, ticket plaintext, or complete ticket URLs.
- Add a Content Security Policy. At minimum, configure `connect-src` for the
  frontend origin and backend `wss:` origin.
- Restrict image origins in `next.config.ts`.
- Redact sensitive values from frontend telemetry.
- Treat client role restrictions as UX only; the backend remains authoritative.
- Do not expose the drawer word in shared Zustand state delivered to all users.

## 17. Accessibility Requirements

- All forms use visible labels and associated error descriptions.
- All controls are keyboard accessible.
- Focus moves to the primary heading after major route transitions.
- Dialogs and sheets trap and restore focus.
- Connection and game status are available as text, not color alone.
- Chat/system updates use a polite `aria-live` region.
- Do not announce every draw stroke.
- Canvas includes a text fallback explaining the current round and whether the
  user is drawing or guessing.
- Respect reduced motion.
- Maintain WCAG AA contrast.

## 18. Testing Strategy

### Unit tests

- Zod schemas for every backend envelope.
- Error normalization.
- Room-code normalization and generation.
- Legacy frame parsing.
- Structured event reducer.
- Connection backoff and retry decisions.
- Coordinate normalization/clamping.
- DPR resize calculations.
- Stroke batching.
- Bounded frontend message history.

### Component tests

- Login, registration, and guest forms.
- Backend field errors.
- Room-code entry.
- Connection-state banners.
- Player and score lists.
- Drawer toolbar permissions.
- Chat submission and message rendering.
- Mobile tabs/sheets.
- Game-over ranking.

### BFF tests

- Cookie attributes.
- Bearer header forwarding.
- Origin rejection.
- Backend error mapping.
- `Retry-After` preservation.
- Ticket response redaction.
- Logout cookie clearing.

### End-to-end tests

Use separate Playwright browser contexts to represent separate players:

1. Two guests authenticate and join one room.
2. Both receive chat.
3. One sends drawing strokes and the other renders them.
4. A disconnect shows reconnecting state and obtains a new ticket.
5. A non-host cannot start.
6. The host starts after two players join.
7. The drawer alone sees the word and drawing controls.
8. Guess results and scores update.
9. Round and canvas reset occur once.
10. Final ranking matches persisted scores.

Run Chromium, Firefox, and WebKit. Include at least one touch/mobile project and
automated accessibility checks for auth, lobby, and room screens.

## 19. Environment and Deployment

`frontend/.env.local.example`:

```text
BACKEND_API_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:4000
APP_ORIGIN=http://localhost:3000
```

Production:

- Deploy the frontend as a Node-capable Next.js application because Route
  Handlers are required.
- Deploy independently from the Go backend.
- Use HTTPS and WSS.
- Add the exact frontend origin to backend `CORS_TRUSTED_ORIGINS`.
- Keep `BACKEND_API_URL` server-only.
- Expose only the WebSocket base URL through `NEXT_PUBLIC_`.
- Run `next build`, unit/component tests, and critical Playwright smoke tests
  before deployment.
- Commit `package-lock.json`; do not use floating dependency versions in
  deployed builds.

## 20. Delivery Plan and Acceptance Criteria

### Phase 1: Foundation and BFF

Deliver:

- Next.js scaffold.
- Tailwind and shadcn setup.
- Environment validation.
- Query and theme providers.
- BFF request helper.
- Error normalization.
- Test infrastructure.

Acceptance:

- Production build succeeds.
- Invalid environment fails clearly.
- Server-only environment values do not enter the client bundle.
- Unit and component test commands run in CI.

### Phase 2: Authentication

Deliver:

- Registration.
- Login.
- Guest creation.
- HttpOnly cookie session.
- Logout.
- Protected `/play` and room entry.

Acceptance:

- Browser storage contains no bearer token.
- Cookie flags are correct.
- Backend field and rate-limit errors are displayed correctly.
- Refresh restoration works after the backend session endpoint exists.

### Phase 3: Room connection and chat

Deliver:

- Create/join room.
- WebSocket ticket BFF.
- Connection state machine.
- Legacy text adapter.
- Chat and bounded activity history.

Acceptance:

- Tickets are never reused.
- Room code and ticket are URL encoded.
- Route exit closes the socket.
- Two browser contexts exchange chat.

### Phase 4: Drawing

Deliver:

- Responsive Canvas 2D engine.
- Drawer toolbar.
- Pointer Events.
- Local optimistic rendering.
- Normalized network strokes.
- Remote rendering.

Acceptance:

- Mouse, touch, and pen input function.
- Different canvas sizes render equivalent strokes.
- Network transmission is capped at 30 segments per second.
- Pointer movement does not trigger React rerenders.
- Two clients see matching drawings.

### Phase 5: Structured game protocol

Deliver after backend blockers:

- Room snapshot.
- Stable player/host/drawer identity.
- Secure word delivery.
- Structured lifecycle events.
- Canvas restoration.

Acceptance:

- No gameplay state depends on parsing human-readable text.
- Refresh/reconnect restores authoritative room state.
- Guessers never receive the secret word.

### Phase 6: Complete gameplay MVP

Deliver:

- Host start flow.
- Word-pack selection.
- Round timer.
- Guessing.
- Scores.
- Round results.
- Final leaderboard.
- Mobile polish and accessibility.

Acceptance:

- Two-player game completes through persisted final scores.
- Host and drawer permissions are represented correctly.
- Desktop and mobile Playwright projects pass.
- Critical screens pass accessibility checks.

## 21. Explicit Backend Blockers

The following backend work is required before declaring the frontend gameplay
MVP complete:

1. Authenticated current-principal/session endpoint.
2. Active word-pack list endpoint.
3. Versioned structured WebSocket envelopes.
4. Authoritative recipient-specific room snapshot.
5. Secure private drawer-word delivery.
6. Structured player, game, round, guess, score, and completion events.
7. Final-score delivery.
8. Structured guess submission.
9. Canvas reset and restoration.
10. Stable principal IDs and stroke IDs in drawing events.

Frontend work may proceed through authentication, room connection, chat, and
basic drawing while these blockers are implemented. Mocks and the legacy adapter
must stay isolated behind the protocol boundary so they can be removed without
rewriting UI components.
