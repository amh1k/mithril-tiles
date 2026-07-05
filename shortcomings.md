# Mithril Tiles Backend Shortcomings

## Overall assessment

The backend now has a credible multiplayer lifecycle: user authentication works, WebSocket reader/writer shutdown is coordinated, drawing no longer panics before drawer selection, room admission and capacity enforcement are serialized by the room actor, game start is transactional, only one active game is allowed per room code, rounds are capped, and final scores plus game completion are persisted atomically with bounded recovery.

It is still an early alpha rather than production-ready. The main remaining risks are browser WebSocket authentication, drawing-path locking and validation, misleading user routes, incomplete gameplay rules, and operational hardening.

## Release blockers

### 1. Browser clients cannot authenticate the WebSocket

The WebSocket route requires an `Authorization: Bearer` header. A normal browser `WebSocket` client cannot attach arbitrary authorization headers, even though the Go test client can.

Use one of:

- Secure HTTP-only authentication cookies.
- A short-lived, single-use WebSocket ticket acquired over authenticated HTTP.
- An ephemeral credential carried in a WebSocket subprotocol.

The WebSocket server also accepts every origin. This must be replaced with an explicit production allowlist, particularly if cookie authentication is introduced, or the endpoint will be exposed to cross-site WebSocket hijacking.

### 2. Current-user routes require an unused ID and the E2E test fails

The update and deletion handlers operate on the authenticated principal, but the routes still require an `:id`:

- `DELETE /v1/users/delete/:id`
- `PATCH /v1/users/update/:id`

The ID is ignored, so clients must supply a meaningless value. The routes should represent current-user operations without an ID.

This is not merely cosmetic: the current `TestUserLifecycle` calls the update path without an ID and receives `404` instead of the expected `200`, causing the full test suite to fail.

### 3. Drawing can deadlock the room and remains insufficiently validated

The drawing path acquires `room.mu` but does not release it during an active round before sending to `drawStroke`. This can block joins, leaves, round transitions, and other state operations indefinitely. Sending a stroke while the round is idle also disconnects the reader instead of rejecting or ignoring the event.

Additional authorization and validation gaps are:

- The sender is compared to the drawer using a display name rather than an immutable principal ID.
- Coordinates, brush size, colour, payload size, and event frequency are not validated or bounded.

Copy the round state and drawer identity while holding the mutex, unlock immediately, validate the payload, and only then enqueue the stroke.

## Realtime and gameplay shortcomings

### Empty, abandoned, and failed rooms are not reclaimed

Successfully completed games now remove their room, but rooms are not removed when:

- Everyone disconnects before completion.
- A game is abandoned.
- Start or end persistence fails.
- A room is created but never starts.

Because clients may choose room codes, this still permits unbounded room, goroutine, timer, history, and session accumulation. Add an idle-room policy and make shutdown/removal idempotent.

### Message history grows indefinitely

Every broadcast is appended to `r.messages`, with no retention limit. Use a bounded ring buffer or persist only the event history that reconnecting clients actually need.

### Room state ownership is inconsistent

Some gameplay state is protected by mutexes while other state is read directly. Examples include:

- `RoundState` is written without locking at round end.
- Reading `currentRoundNo` outside its protecting lock.
- Returning the internal score map from `GetScores()` without locking and copying it.

Prefer a single ownership model: either all gameplay mutations and snapshots go through the room actor, or every shared field has a clear locking contract.

### Guess handling still has rule and reliability gaps

Repeat correct guesses in the same round are now rejected, but:

- The drawer can guess.
- Comparison is case-sensitive and does not normalize whitespace.
- Multi-word guesses are truncated because only one split token is checked.
- Score mutation depends on successfully enqueueing the “correct guess” response to the player's outgoing channel.

Scoring must be independent of message delivery, and eligibility should be based on stable principal IDs.

### Disconnect and reconnect lifecycle is incomplete

Final scores now use stable principal identity and survive disconnects, but leaving players are removed from the current round score map and `game_participants.left_at` is never populated. Durable history therefore cannot accurately distinguish a participant who left mid-round, and reconnecting players do not reliably recover their current-round role or score.

Session and reconnect-token helpers exist, but they are not wired into the active connection flow. Clients do not receive and exercise a complete reconnect protocol, and the room does not send an authoritative state snapshot after reconnection.

Either finish the feature with token issuance, expiry, identity restoration, and snapshots, or remove the unused subsystem until it can be supported.

### Lifecycle rules are scattered and partly hard-coded

Game completion now exists, but:

- Round count, duration, and cooldown are hard-coded instead of being supplied by an immutable game configuration.
- Drawer selection is random each round rather than a deterministic fair rotation.
- A timer is created before the final-round completion check, leaving unnecessary timer work.
- Round-end persistence failure leaves the live room in its previous active state with no retry or recovery transition.
- The persisted settings snapshot does not drive the live room rules.

Create one immutable game configuration and use it for persistence, runtime behavior, and tests.

### The realtime protocol is inconsistent

Some server events are plain text while drawing events are structured JSON. This forces clients to parse ad hoc strings and makes protocol evolution difficult.

Use a versioned event envelope with stable event types and structured data. Add an authoritative room-state snapshot for late joiners and reconnecting clients.

## Data integrity shortcomings

- User/guest creation and authentication-token insertion are separate transactions. Token insertion failure leaves a created identity behind, and a retry may then fail as a duplicate.
- Email addresses and handles are not consistently canonicalized, making case behavior surprising.
- Expired authentication tokens and guest sessions are never cleaned up.
- No logout or token-revocation flow exists.
- Most model methods use `context.Background()` rather than propagating request or connection cancellation.
- Zero-point round scores are recorded with a `correct_guess` reason.
- `ORDER BY random()` will become expensive for large word packs.
- Word-pack mutation is available to every registered user; there is no owner or administrator authorization.

## API and security shortcomings

- No rate limiting exists for login, registration, guest creation, WebSocket connections, chat, guesses, or drawing events.
- There is no duplicate-connection policy; one credential can create multiple players in the same room.
- Display names are not unique, while direct messages and some realtime state use them as identifiers.
- Avatar MIME type, decoded content, dimensions, and size are not fully validated.
- User-controlled avatar filenames are used as Cloudinary public IDs, allowing collisions.
- Avatar upload reloads environment configuration per request instead of using validated startup configuration.
- The standalone game-creation endpoint is structurally broken: it creates a game referencing a host participant that cannot yet exist in that transaction flow.
- Once a WebSocket has been accepted, a normal HTTP error response can no longer be sent safely.
- Public handler methods exist for game rounds, scores, and final scores without corresponding routes, leaving dead or unfinished API surface.

## Testing shortcomings

Current verification results:

- `go vet ./...`: passed.
- Compile-only `go test ./... -run '^$' -count=1`: passed.
- `TestChat`, including final-score persistence, passes normally and with the race detector.
- The full suite still fails in `TestUserLifecycle` because the update request receives `404`.
- Race-enabled `internal/realtime` tests: passed.
- `go mod tidy -diff`: clean.

Passing race tests do not prove that realtime state is race-free; the current tests do not exercise enough concurrent joins, leaves, guesses, drawing events, and lifecycle transitions.

Specific test gaps:

- Real database outage and lost-commit-acknowledgement behavior are not covered by fault-injection integration tests.
- The chat test assumes a player may guess even when that player is randomly selected as drawer.
- Some unit tests ignore constructor errors.
- Tests use `time.Sleep()` for synchronization.
- A draw-stroke recipient assertion is commented out.
- `principal_test.go` contains no tests.
- `player_test_helper.go` is production code instead of `_test.go` code and prints debug text.
- Capacity boundaries are tested, but there are no focused tests for concurrent room admission, abandoned-room cleanup, reconnection, or duplicate connections.

## Operational and maintainability shortcomings

- `internal/realtime/room_manager.go` is not formatted according to `gofmt` and contains trailing whitespace.
- A compiled 1.8 MB `api` binary is committed to Git.
- `README.md` contains only the project name.
- No CI workflow, Dockerfile, release process, or production runbook exists.
- Startup requires a `.env` file even when real environment variables are supplied.
- There is no graceful HTTP shutdown or coordinated shutdown of active rooms.
- `application.wg` and CORS configuration are unused.
- The healthcheck does not verify database readiness.
- Migration paths depend on the process working directory.
- Realtime logging uses `fmt.Printf` instead of structured logging.
- Panic logging lacks stack traces and request IDs.
- Migration helpers terminate the process directly, making startup behavior difficult to compose and test.

## Recommended order of work

1. Fix drawing-path locking and enforce drawer eligibility using principal IDs.
2. Make WebSocket authentication browser-compatible and enforce an origin allowlist.
3. Correct the current-user route contract and restore a fully passing test suite.
4. Reclaim idle or abandoned rooms and bound message history.
5. Correct guess eligibility and decouple scoring from message delivery.
6. Persist participant departure and complete or remove the reconnect subsystem.
7. Centralize game configuration and move shared gameplay state under one ownership model.
8. Make identity/token creation atomic, add rate limits, standardize the realtime protocol, and finish operational hardening.

The next milestone should be a correct, recoverable, and browser-usable multiplayer lifecycle. New gameplay features should wait until the lifecycle and its failure paths are covered by tests.
