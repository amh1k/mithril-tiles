# Mithril Tiles Backend Shortcomings

## Overall assessment

The backend has a solid architectural foundation, especially the `GameLifecycle` abstraction, transaction-based round persistence, PostgreSQL pooling, authenticated principals, and Docker-backed E2E testing.

However, it is currently an early alpha rather than production-ready. The happy path works, but several release-blocking problems exist around browser WebSocket authentication, account endpoints, room cleanup, concurrency, game-rule enforcement, and database invariants.

## Release blockers

### 1. Browser clients cannot authenticate the WebSocket

The WebSocket endpoint requires an `Authorization: Bearer` header through middleware:

- `cmd/api/routes.go:26`
- `cmd/api/middleware.go:28`

Normal browser `WebSocket` clients cannot attach arbitrary `Authorization` headers. The Go test client works because it can set headers, but the frontend will not.

Use one of:

- Secure HTTP-only authentication cookies.
- A short-lived WebSocket ticket acquired through authenticated HTTP.
- A WebSocket subprotocol carrying an ephemeral credential.

At the same time, replace the unrestricted origin policy in `cmd/api/websocket.go:26`:

```go
OriginPatterns: []string{"*"}
```

Once cookie authentication is introduced, accepting every origin becomes a cross-site WebSocket hijacking risk.

### 2. User registration never returns a successful response

The registration handler in `cmd/api/users.go:13` inserts the user but does not:

- Validate display name, handle, email, or password.
- Handle duplicate handles.
- Return the created user.
- Return an authentication token.
- Explicitly send a success status.

Furthermore, duplicate email detection compares an exact `lib/pq` error string while the project uses `pgx`, meaning duplicate emails will likely become HTTP 500 responses.

Use `errors.As(err, *pgconn.PgError)` and inspect the constraint name, as the update method already does.

### 3. User update and deletion routes are broken

The routes in `cmd/api/routes.go:15` do not contain an `:id` parameter, but both handlers call `readIDParam()`, which expects `:id`:

- `cmd/api/users.go:97`
- `cmd/api/users.go:119`

Consequences:

- Update always returns not found.
- Delete writes a bad-request response, fails to return, then attempts to delete `uuid.Nil`.
- Multiple HTTP responses may be attempted.

Because these endpoints represent current-user operations, they should use `app.contextGetPrincipal(r).ID()` rather than accepting a user ID from the URL.

### 4. Disconnected WebSocket players can leak goroutines

`HandlePlayer` starts a reader goroutine and then blocks in the writer in `internal/realtime/io.go:60`.

When the reader detects a disconnected client, it simply returns. It does not cancel the writer or notify the room. Unless another server message triggers a failed write, the handler may remain blocked until inactive-player cleanup runs.

There are also two leave operations:

- `internal/realtime/io.go:57`
- `internal/realtime/io.go:64`

Use a connection-scoped context and coordinate reader/writer completion with `errgroup` or a shared cancellation channel. Exactly one cleanup path should unregister the player.

### 5. Closing `Outgoing` is unsafe and incorrectly detected

The leave handler tries to determine whether a channel is closed by reading from it in `internal/realtime/handlers.go:76`.

This is unreliable:

- If buffered messages exist, one message is consumed and the channel stays open.
- Other goroutines can send concurrently while the room closes the channel.
- A direct message racing with closure can panic with `send on closed channel`.

Prefer cancellation over closing a channel that has multiple possible senders. The player writer should own its lifecycle.

### 6. A drawing event before game start can panic

`currentDrawer` can be `nil`, but it is dereferenced directly in `internal/realtime/handlers.go:163`.

Any player can send a `draw_stroke` before the first round and panic their reader goroutine. Drawing should require:

- An active round.
- A non-nil drawer.
- The sender's principal ID matching the drawer.
- Valid coordinate, brush-size, and colour limits.

### 7. Game-start state can become permanently inconsistent

The HTTP handler commits the game and participants before signaling the room in `cmd/api/websocket.go:162`.

The room then marks `gameStarted = true` before asynchronously starting the first round in `internal/realtime/handlers.go:323`.

If round creation fails—for example, because the pack has no words—the following occurs:

- HTTP has already returned a successful game.
- The database contains an active game.
- `gameStarted` remains true.
- No round exists.
- Another start request cannot recover the room.

Game creation and first-round creation need a coordinated state transition, or failure must move the room and game into a retryable or failed state.

### 8. Duplicate active games can be created

Concurrent start requests can both observe `gameStarted == false`, insert separate games, and commit before the room processes the start signal.

The schema does not prevent multiple active games for the same room.

Add a partial unique index similar to:

```sql
CREATE UNIQUE INDEX games_one_active_per_room
ON games (room_code)
WHERE status = 'started';
```

The room actor should also serialize the start operation and return a result to the HTTP handler.

## Realtime and gameplay shortcomings

### Room capacity is not enforced

`GetOrCreateRoom()` checks capacity only after creating a new room. Existing rooms return before `canJoin()` is called in `internal/realtime/room_manager.go:24`.

Additionally, checking capacity separately from joining is race-prone. Admission must happen atomically inside the room event loop.

### Rooms are never removed

`DeleteRoom()` exists in `internal/realtime/room_manager.go:45` but is never called.

Authenticated clients can create unlimited room codes through WebSocket connections. Every room retains:

- A room goroutine.
- An inactive-player cleanup goroutine.
- Message history.
- Session state.
- Timers.

This creates an unbounded memory and goroutine exhaustion path.

### Cleanup goroutines ignore room shutdown

`cleanupInactiveplayers()` in `internal/realtime/sessions.go:74` only waits on its ticker.

Even after `Room.Run()` receives `done`, cleanup continues forever. It should select on both the ticker and room cancellation.

### Message history grows indefinitely

Every broadcast appends to `r.messages` in `internal/realtime/handlers.go:24`.

There is no retention limit. Use a bounded ring buffer.

### Room state locking is inconsistent

Examples include:

- `currentWord` is read without `r.mu` in the guess handler.
- `currentDrawer` is dereferenced without `r.mu`.
- `currentRoundNo` is read outside locking.
- `len(r.players)` is used after unlocking in `handleLeave`.
- `GetScores()` returns the internal map without locking or copying.

The cleanest direction is to make the room actor exclusively own gameplay state and expose request/response channels for snapshots and mutations.

### Guess scoring is exploitable

Currently:

- The drawer can guess.
- A player can guess correctly repeatedly and gain unlimited points.
- Guessing is not explicitly restricted to an active round.
- Guesses are case-sensitive.
- Multi-word answers cannot work because only `parts[1]` is checked.
- Points are awarded only if the success message fits into `Outgoing`.

Track a set of players who have already guessed correctly, identify players by principal ID rather than `*Player`, and separate scoring from message delivery.

### Leaving players are still persisted in round scores

The round score map is created at round start and players are not removed when they leave in `internal/realtime/handlers.go:299`.

Therefore, a player who leaves before round end is still persisted with a score. This conflicts with the intended participant policy.

`game_participants.left_at` is also never updated.

### No complete game lifecycle exists

Rounds continue indefinitely in `internal/realtime/handlers.go:258`.

Missing behavior includes:

- Maximum rounds.
- Drawer rotation.
- Game completion.
- Final score calculation.
- Final rank persistence.
- Game `ended_at` and status update.
- Room shutdown and removal.

The `game_final_scores` code exists but is not integrated.

### Test timing leaked into production behavior

The production round duration is globally hard-coded to ten seconds in `internal/realtime/room.go:9`.

The settings snapshot is persisted but never used. Inject game timing and configuration so tests can use short durations without changing production rules.

### Protocol is inconsistent

Some messages are plain text:

```text
Round1 has started
Correct Guess! Congrats
```

Drawing messages are structured JSON.

This will make frontend parsing brittle. Define a single versioned event envelope such as:

```json
{
  "type": "round_started",
  "data": {},
  "request_id": "...",
  "version": 1
}
```

Also add a room-state snapshot for reconnecting and late-joining players.

## Data integrity shortcomings

Important missing constraints include:

- One active game per room.
- One active round per game.
- One participant row per user or guest per game.
- One score entry per round, participant, and reason.
- Assurance that a round score participant belongs to the round's game.
- Assurance that a round word belongs to the game's selected word pack.

The current `round_scores.participant_id` foreign key only confirms that the participant exists somewhere, not that they belong to the same game.

Other data-layer issues:

- `DeleteAllForUser()` accepts `int64`, but user IDs are UUIDs.
- Suspended or deleted account status is not checked during authentication.
- Expired tokens and guest sessions are never cleaned up.
- No logout or token revocation flow exists.
- Most model methods use `context.Background()`, ignoring request cancellation.
- Zero-point players are stored with reason `correct_guess`, which is semantically inaccurate.
- `ORDER BY random()` will become expensive for large word packs.
- Word-pack mutation is permitted to every registered user; no owner or admin authorization exists.

## API and security shortcomings

- No rate limiting for login, guest creation, WebSocket connections, chat, guesses, or drawing events.
- No duplicate-connection policy; one token can create multiple players in one room.
- Display names are not unique, making direct-message targeting ambiguous.
- Avatar MIME type and content are not validated.
- User-controlled avatar filenames are used as Cloudinary public IDs, allowing collisions.
- The standalone game creation endpoint is structurally broken because it creates a game referencing a host participant that cannot yet exist.
- After WebSocket acceptance, `serverErrorResponse()` cannot safely write a normal HTTP 500 response.

## Testing shortcomings

Current verification results:

- `go vet ./...`: passed.
- `go test ./... -count=1`: passed.
- Race-enabled realtime and API tests: passed.
- Coverage:
  - `cmd/api`: 26.1%
  - `internal/realtime`: 15.2%
  - `internal/data`: 0%
  - `internal/validator`: 0%

The passing race test does not prove the realtime code is race-free; existing tests do not produce enough overlapping operations.

Specific test problems:

- The E2E test ignores the first guest-token error because `err` is overwritten.
- Several channel loops have no timeout and can hang forever.
- The test assumes player 1 may guess even if player 1 is randomly selected as drawer.
- Unit tests ignore constructor errors.
- Tests use `time.Sleep()` for synchronization.
- The second draw-stroke recipient assertion is commented out.
- `principal_test.go` contains no tests.
- `player_test_helper.go` is production code rather than `_test.go` code and prints `"Hello boy"`.

## Operational and maintainability shortcomings

- Twenty-one Go files are not formatted according to `gofmt`.
- `go.mod` is not tidy; all direct dependencies are incorrectly marked indirect and stale dependencies remain.
- A compiled 1.8 MB `api` binary is committed to Git.
- `README.md` contains only the project name.
- No CI workflow, Dockerfile, release process, or production runbook exists.
- Startup fails if `.env` is absent, even when real environment variables are configured.
- No graceful HTTP or room shutdown exists.
- `application.wg` and CORS configuration are unused.
- Healthcheck reports availability without checking database readiness.
- Migration paths depend on the current working directory.
- Realtime logging uses `fmt.Printf` instead of structured logging.
- Panic logging does not include stack traces or request IDs.

## Recommended order of work

1. Fix browser-compatible WebSocket authentication and origin validation.
2. Repair registration, login error handling, user update, and user deletion.
3. Redesign WebSocket reader/writer cancellation and room admission.
4. Make room gameplay state actor-owned and eliminate unsafe channel closure.
5. Enforce capacity, delete empty rooms, bound history, and cancel timers.
6. Make game start idempotent and transactionally consistent.
7. Correct guess eligibility, deduplication, participant departure, and scoring.
8. Add game completion and final-score persistence.
9. Strengthen database constraints.
10. Add focused unit and integration tests before expanding gameplay features.
11. Finish with formatting, dependency cleanup, CI, documentation, and graceful shutdown.

The architecture is promising, but the backend should not be exposed publicly yet. The next milestone should be a correct and recoverable multiplayer lifecycle rather than additional gameplay features.
