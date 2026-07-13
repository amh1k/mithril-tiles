# Bot Player Implementation Guide

## 1. Objective

Add server-controlled bot players that participate in the same rooms and games as human players. A bot must be able to:

- join and leave a lobby;
- appear in room snapshots, player lists, scores, rounds, and final rankings;
- be selected as the drawer;
- draw by emitting the existing normalized `draw_stroke` protocol;
- guess using only the public drawing and masked-word information available to human guessers;
- obey round timing, scoring, capacity, and lifecycle rules;
- persist as a `bot` game participant through the existing database schema;
- stop all work immediately when its round, game, or room ends.

Bots should run in the Go backend. They should not open fake browser sessions or fake WebSocket connections.

## 2. What Already Exists

The database already contains most of the identity foundation:

- `bot_profiles` stores a bot's name, difficulty, behavior style, avatar, and active state.
- `game_participants.participant_type` already permits `bot`.
- `game_participants.bot_profile_id` links a game participant to a bot profile.
- Database constraints ensure a bot participant has only a `bot_profile_id`.
- `game_participants_one_bot_per_game_key` prevents the same bot profile from appearing twice in one game.
- Round scores and final scores reference generic game participant IDs, so they can already store bot scores.

The realtime runtime is not bot-ready yet:

- `data.Principal` supports only users, guests, and anonymous callers.
- `Player` assumes a real WebSocket connection and an outgoing network channel.
- game-start and round persistence accept only `data.Principal` values.
- `InsertPrincipalWithTx` and `GetIDForPrincipal` reject bot identities.
- participant-name lookup explicitly filters to `user` and `guest`.
- guesses enter through chat slash commands instead of a shared typed room command.
- drawer authorization compares display names instead of stable participant IDs.
- the room currently has no command for adding or removing a bot.

Do not start with an AI model call. First make a deterministic bot a first-class participant. Add model-based drawing and visual guessing after lifecycle and persistence are correct.

## 3. Target Architecture

Use four layers:

```text
Host/admin HTTP request
        |
        v
Room command channel ------> Room owns membership and authoritative state
        |                                  |
        |                                  v
        |                         BotRuntime per bot
        |                         /              \
        v                        v                v
Room snapshots           DrawingPlanner      GuesserModel
and persistence          emits strokes       sees public canvas + mask
```

Core design rules:

1. The room remains authoritative for membership, timing, roles, guesses, and scores.
2. A bot runtime proposes actions; it never mutates room state directly.
3. AI/provider calls run outside the room event loop.
4. Every bot action carries game ID, round number, and bot ID so stale results can be rejected.
5. A guessing bot never receives `currentWord`, `drawer_word`, or database answer fields.
6. Bot and human actions eventually enter the same typed room commands.

## 4. Phase 1 — Add Bot Data Access

Create `internal/data/bot_profiles.go`.

Define a model matching the existing table:

```go
type BotProfile struct {
    ID            uuid.UUID `json:"id"`
    Name          string    `json:"name"`
    Difficulty    string    `json:"difficulty"`
    BehaviorStyle string    `json:"behavior_style"`
    AvatarURL     *string   `json:"avatar_url,omitempty"`
    IsActive      bool      `json:"is_active"`
    CreatedAt     time.Time `json:"created_at"`
    UpdatedAt     time.Time `json:"updated_at"`
}
```

Implement only the queries needed by the first bot release:

- `Get(id)`;
- `GetActive(id)`;
- `ListActive()`;
- optionally `Insert`, `Update`, and `Delete` for a later admin UI.

Register the model in `internal/data/models.go`.

Validation rules:

- only active profiles may enter new rooms;
- difficulty must match the existing database constraint;
- a room cannot contain the same bot profile twice;
- bot names should not collide with another connected participant's display name.

### Review checkpoint

- Unit tests cover active, inactive, missing, and duplicate profiles.
- No realtime behavior is introduced yet.

## 5. Phase 2 — Represent Bots as Playable Identities

Extend the identity model without making bots HTTP-authenticated users.

Add:

```go
const PrincipalBot PrincipalType = "bot"
```

Add `BotProfile *BotProfile` to `data.Principal` and implement:

- `NewBotPrincipal(profile *BotProfile)`;
- `IsBot()`;
- bot-aware `ID()`;
- bot-aware `DisplayName()`;
- bot-aware avatar lookup if principal presentation is centralized.

Keep these concepts separate:

```go
IsAuthenticated() // user or guest presenting a valid HTTP/WebSocket credential
IsPlayable()      // user, guest, or internally created bot
```

Do not change `IsAuthenticated()` to return true for bots. Otherwise a bot identity could accidentally pass HTTP authentication middleware.

Update principal score keys and equality helpers to accept `PrincipalBot`.

### Review checkpoint

- Users and guests behave exactly as before.
- Bots have stable UUID identity and display name.
- Bots cannot authenticate through public middleware.

## 6. Phase 3 — Persist Bot Participants

Update `GameParticipantModel.InsertPrincipalWithTx`:

- for users, set `user_id`;
- for guests, set `guest_session_id`;
- for bots, set `bot_profile_id` and `participant_type = 'bot'`.

Update `GetIDForPrincipal` with a bot query using `bot_profile_id`.

Update participant presentation lookup so final-score pages can resolve bots. The current query filters to `('user', 'guest')`; include `bot` and join `bot_profiles` for the bot name and avatar.

Prefer returning one neutral presentation shape:

```json
{
  "type": "bot",
  "id": "bot-profile-uuid",
  "display_name": "Gandalf Bot",
  "avatar_url": null
}
```

The existing game, round, round-score, and final-score tables should not need structural changes for the first release.

### Review checkpoint

- A transaction can persist one user, one guest, and one bot.
- Drawer participant resolution works when the drawer is a bot.
- Round and final scores accept bot participant IDs.
- Final-score name lookup returns bot presentation data.

## 7. Phase 4 — Separate Participants from Network Connections

Avoid teaching every room operation that a bot has a fake socket.

Introduce an internal participant/actor abstraction. One possible shape is:

```gok
type RoomParticipant interface {
    ID() uuid.UUID
    Principal() data.Principal
    IsConnected() bool
    Deliver(string) bool
}
```

Human participants deliver messages through their buffered WebSocket output. Bot participants consume relevant structured events through their runtime and do not receive text network frames.

An incremental alternative is to retain `Player` but add a participant kind and allow `Conn == nil`. This changes fewer lines, but every read, write, cancel, direct-message, and disconnect path must then be audited for nil connections. The interface approach is safer as the bot system grows.

Replace identity decisions based on display names. In particular, a draw action should carry the actor's stable principal ID. The room should authorize a stroke by comparing that ID with the current drawer ID.

Do not rely on:

```go
currentDrawer.Principal.DisplayName() == stroke.From
```

Display names are presentation data and may collide.

### Review checkpoint

- Human WebSocket behavior remains unchanged.
- A bot can exist in `Room.players` or its replacement without a socket.
- Broadcasts cannot block on or panic because of a bot.
- Drawer authorization uses IDs.

## 8. Phase 5 — Add Host-Controlled Bot Membership

Add typed room commands processed by `Room.Run`, for example:

```go
type AddBotCommand struct {
    RequestedBy uuid.UUID
    Profile     data.BotProfile
    Result      chan error
}

type RemoveBotCommand struct {
    RequestedBy uuid.UUID
    BotID       uuid.UUID
    Result      chan error
}
```

Validate inside the room actor:

- requester is the current human host;
- game state is `idle`;
- profile is active;
- room has capacity;
- profile is not already present;
- display name is not already in use;
- a bot cannot become host.

Suggested HTTP routes:

```text
GET    /v1/bot-profiles
POST   /v1/rooms/:roomCode/bots
DELETE /v1/rooms/:roomCode/bots/:botProfileID
```

Example add request:

```json
{
  "bot_profile_id": "uuid"
}
```

HTTP handlers must authenticate a registered user or guest as appropriate, but the room must perform the final host and state authorization. Never let the handler mutate the room's maps directly.

After add/remove, broadcast an authoritative room snapshot. Existing `RoomPlayer.Type` can expose `bot` so the frontend can render a bot badge.

### Review checkpoint

- Only the host can add/remove bots.
- Bots cannot be changed after game start.
- Bots count toward `MaxPlayers` and the minimum player count.
- Joining and leaving always produces a new snapshot.

## 9. Phase 6 — Create a Round-Scoped Bot Runtime

Add a runtime responsible for scheduling each bot's work:

```go
type BotRuntime struct {
    BotID     uuid.UUID
    Profile   data.BotProfile
    cancel    context.CancelFunc
    done      chan struct{}
}
```

The room starts one task per bot when a round starts:

- if the bot is drawer, start a drawing task;
- otherwise start a guessing task.

Use a context derived from the round context. Cancel it when:

- the round ends;
- the game ends;
- the bot is removed;
- the room closes;
- a new round supersedes the old round.

Every asynchronous completion must include:

```go
type BotActionMetadata struct {
    GameID     uuid.UUID
    RoundNo    int
    BotID      uuid.UUID
}
```

Before accepting a result, the room checks that the game, round, and role still match. This prevents a slow model response from submitting a guess in the next round.

Do not call a model provider inside `Room.Run`. Use a worker goroutine and return results through a bounded completion channel.

### Review checkpoint

- Run race tests.
- Confirm all goroutines terminate after cancellation.
- Confirm a late completion is ignored.
- Confirm a provider timeout does not delay room timers.

## 10. Phase 7 — Implement Typed Guess Submission

Create one authoritative guess command used by humans and bots:

```go
type SubmitGuessCommand struct {
    ParticipantID uuid.UUID
    Text          string
    GameID        uuid.UUID
    RoundNo       int
}
```

Move guess validation and scoring behind this command. Human `/guess apple` messages can temporarily be adapted into it. Bots submit it directly.

The room validates:

- round is active;
- participant exists and is eligible;
- participant is not the drawer;
- participant has not already guessed correctly;
- metadata belongs to the current round;
- guess length is bounded and normalized consistently.

This avoids bots manufacturing chat strings and ensures human and bot scoring use the same path.

### Review checkpoint

- Existing human guessing tests still pass.
- Bot guesses receive identical scoring and duplicate-guess protection.
- Drawer bots and drawer humans cannot guess.

## 11. Phase 8 — Implement Deterministic Bot Drawing First

The backend protocol already exchanges normalized line segments. A bot drawer should therefore produce `[]DrawStroke`, not an image.

Start with a deterministic `DrawingPlanner`:

```go
type DrawingPlanner interface {
    Plan(ctx context.Context, word string, style string) ([]DrawStroke, error)
}
```

Recommended first implementation:

- maintain curated vector templates for a limited set of words;
- store normalized points in `[0,1]`;
- convert paths into the existing stroke segments;
- use round line caps, permitted colors, and bounded brush sizes;
- emit strokes gradually at a controlled rate such as 20–30 segments per second;
- add small timing and coordinate variation based on bot difficulty;
- stop immediately when the round context is cancelled.

For words without a template, use a safe fallback:

- draw simple category symbols;
- skip the round with an explicit lifecycle event; or
- choose words only from the bot-supported subset during the first rollout.

Do not generate a bitmap and attempt to send every pixel as strokes. It produces excessive network traffic and poor gameplay.

Later, an AI planner can generate a constrained SVG or stroke-plan JSON. Validate it before use:

- maximum paths and points;
- coordinates clamped to `[0,1]`;
- permitted colors;
- permitted brush sizes;
- payload-size limit;
- execution-time limit.

Precompute and cache AI-generated plans by `(word, style, planner_version)` instead of paying for them every round.

### Review checkpoint

- Human clients display bot strokes with no protocol changes.
- The bot cannot draw when it is not the drawer.
- Stroke rate cannot overflow `drawStroke` or player output buffers.
- Cancelling a round stops drawing immediately.

## 12. Phase 9 — Build Visual Guessing from Public Information

A guessing bot must receive only:

- the public `draw_stroke` stream;
- the current masked word;
- round timing;
- optionally the public list of candidate words from the selected word pack.

It must never receive:

- `Room.currentWord`;
- `drawer_word`;
- the selected `word_id`;
- persistence objects containing `word_text_snapshot`.

Create a `BotPerception` state per guessing bot or shared per round:

```go
type BotPerception struct {
    RoundNo   int
    MaskedWord string
    Strokes   []DrawStroke
}
```

Keep the stroke history bounded. Periodically rasterize the public strokes to a fixed canvas such as 512×512. Use exactly the same coordinate and brush-size rules as the frontend.

Define a provider-neutral interface:

```go
type GuesserModel interface {
    Guess(ctx context.Context, input GuessInput) (GuessResult, error)
}

type GuessInput struct {
    CanvasPNG     []byte
    MaskedWord    string
    Candidates    []string
    SecondsLeft   int
    Difficulty    string
    BehaviorStyle string
}

type GuessResult struct {
    Guess      string
    Confidence float64
}
```

The prompt/provider adapter should require strict JSON output and one short guess. Validate the result with Zod-equivalent Go validation before submitting it to the room.

Suggested attempt schedule:

```text
Easy:   few attempts, long delay, high confidence threshold, intentional misses
Normal: moderate attempts and confidence threshold
Hard:   more frequent attempts, lower delay, better candidate ranking
```

Add jitter so multiple bots do not guess simultaneously. Stop attempts once the bot guesses correctly.

For a lower-cost first version, omit vision and rank word-pack candidates using:

- mask length and revealed positions;
- previously rejected guesses;
- simple drawing-template metadata.

Then add a multimodal provider behind the same interface without changing room logic.

### Review checkpoint

- A test spy proves the true word is absent from `GuessInput`.
- Guess attempts are bounded per bot and round.
- Timeouts, malformed output, and provider errors are recoverable.
- No model call blocks the room loop.

## 13. Phase 10 — Difficulty and Behavior

Use the existing `difficulty` and `behavior_style` fields as policy inputs, not as prompts alone.

Difficulty can control:

- reaction delay;
- guess frequency;
- confidence threshold;
- drawing speed;
- stroke precision;
- probability of an intentional wrong guess;
- how many revealed letters are required before attempting.

Behavior style can control presentation-safe behavior:

- cautious guesser;
- fast but inaccurate guesser;
- minimalist drawer;
- detailed drawer;
- monochrome or colorful drawer.

Keep gameplay limits in server code. Do not let free-form `behavior_style` override security, rate, payload, or timeout constraints.

If profiles eventually need richer configuration, add a new migration with a validated JSON object such as `behavior_config jsonb`. Never store provider API keys or secrets in `bot_profiles`.

## 14. Phase 11 — Protocol and Frontend Changes

Room snapshots should expose bots exactly like other players:

```json
{
  "id": "bot-profile-uuid",
  "type": "bot",
  "display_name": "Mithrandir",
  "avatar_url": null,
  "score": 12,
  "is_connected": true
}
```

Frontend work:

- extend room-player schemas to accept `type: "bot"`;
- display a small bot badge/icon;
- let only the host add/remove bots in the idle lobby;
- show active bot profiles in a selector;
- disable controls while a command is pending;
- use authoritative snapshots after add/remove;
- show bot names in round and final scoreboards;
- do not create a client-side socket for a bot.

No drawing protocol change is necessary if bot strokes use the existing `draw_stroke` envelope.

Prefer a structured public guess-result event rather than parsing bot chat text.

## 15. Phase 12 — Reliability, Cost, and Security

### Timeouts and circuit breaking

- Give each drawing/guess provider call a short context deadline.
- Limit attempts per bot per round.
- Add a circuit breaker after repeated provider failures.
- Fall back to deterministic behavior when the provider is unavailable.

### Backpressure

- Bound bot action and completion channels.
- Rate-limit stroke emission.
- Drop obsolete visual-analysis requests when a newer canvas revision exists.
- Never enqueue unlimited canvas images or stroke histories.

### Cost control

- Cache drawing plans.
- Share one rasterized canvas among guessing bots for each revision.
- Do not call vision on every stroke.
- Record requests, latency, failure category, and token/cost estimates without logging secrets or images by default.

### Security

- Store provider credentials only in deployment environment variables.
- Do not send chat text, player emails, tokens, room tickets, or private drawer data to the model.
- Treat provider output as untrusted input.
- Bound SVG/JSON/PNG sizes.
- Require host authorization for bot membership changes.
- Keep bots outside public authentication middleware.

### Deployment

The current in-memory room model requires one Railway API replica. Bot runtimes must run in the same process as their room for the first release. Before horizontal scaling, introduce shared room ownership and messaging; otherwise a bot worker may act on a room hosted by another replica.

## 16. Testing Strategy

### Unit tests

- bot principal ID, name, type, and authentication behavior;
- bot-profile queries and validation;
- persistence mapping for user, guest, and bot;
- add/remove authorization and capacity;
- deterministic drawing-plan validation;
- mask-only guess input construction;
- difficulty scheduling;
- stale action rejection;
- cancellation and timeout behavior.

### Realtime tests

- bot appears in snapshots;
- bot counts toward minimum and maximum players;
- bot can be selected as drawer;
- non-drawer bot strokes are rejected;
- bot guesses follow the same scoring path;
- bot receives drawer bonus;
- round transition cancels old bot work;
- room closure leaves no bot goroutines.

### Persistence tests

- game start persists `participant_type = 'bot'` and `bot_profile_id`;
- bot drawer resolves to a game participant;
- bot round score and final score persist;
- final scoreboard resolves the bot name and avatar;
- the same bot profile cannot be inserted twice into one game.

### End-to-end tests

Use a fake deterministic `GuesserModel` and `DrawingPlanner`, not a live paid provider. Test:

1. human host creates a room;
2. host adds a bot;
3. snapshot shows both participants;
4. host starts the game;
5. bot draws or guesses based on its role;
6. humans receive bot strokes;
7. scores persist;
8. final scoreboard includes the bot;
9. all bot tasks stop when the room closes.

Run `go test -race` for realtime packages. Keep optional provider contract tests behind an explicit environment flag.

## 17. Recommended Delivery Order

Implement and review in these small pull requests:

1. **Bot profile model** — queries and tests only.
2. **Bot principal support** — identity helpers and tests.
3. **Bot persistence** — game participants, drawer lookup, and scoreboard presentation.
4. **Room bot membership** — add/remove commands, host authorization, snapshots.
5. **Participant abstraction** — remove socket assumptions and ID-based drawer authorization.
6. **Typed guess command** — unify human and bot guess scoring.
7. **Deterministic bot runtime** — scheduling, cancellation, and fixed guesses.
8. **Deterministic drawing** — curated vector plans emitted as normal strokes.
9. **Frontend lobby controls** — bot selector, badges, and scoreboard support.
10. **Visual guessing provider** — rasterization, model adapter, safeguards, and fallback.
11. **Operational hardening** — metrics, budgets, circuit breaker, race and E2E tests.

Do not combine all phases into one change. The critical milestone is a deterministic bot that completes an entire persisted game correctly. Once that works, AI improves bot decisions without changing the room lifecycle.

## 18. Definition of Done

The feature is complete when:

- a host can add and remove active bot profiles in an idle lobby;
- bots are first-class participants identified by stable IDs;
- bots draw and guess through the same authoritative room paths as humans;
- guessing bots receive only public strokes and masked-word information;
- bot work is round-scoped, cancellable, bounded, and non-blocking;
- bot participants, rounds, scores, and final rankings persist correctly;
- reconnecting humans receive snapshots containing bots and current scores;
- frontend schemas and UI distinguish bots without creating fake connections;
- provider failures degrade to deterministic behavior instead of breaking games;
- race, lifecycle, persistence, and multiplayer E2E tests pass.
