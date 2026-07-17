# Mithril Tiles Product Audit

## Audit Verdict

Mithril Tiles has a strong technical foundation and is already beyond a typical portfolio demo. It has guest and registered authentication, private rooms, realtime gameplay, server-authoritative scoring, persistent results, AI bots, administration tools, tests, and a polished visual identity.

However, it should currently be considered a **closed-alpha product**, not yet a reliable public MVP.

The biggest problem is not missing features. It is that the essential social loop can still fail:

> Create room -> invite friends -> finish a match -> play again with the same group.

The next milestone should be making that loop extremely reliable and frictionless.

## Product Position

The clearest positioning would be:

> **Mithril Tiles is an instant medieval drawing game for small friend groups. Join from one link, play without an account, and optionally summon AI opponents when your party is short.**

Lead with:

- No installation.
- Guest-first entry.
- Private friend groups.
- Strong medieval presentation.
- Optional AI seat-fillers.

Do not lead with "AI drawing." The bot drawing quality is currently too unpredictable to carry the product promise.

Existing products already provide private rooms, custom words, moderation, and extensive settings. Skribbl supports private rooms, custom words, moderation, mobile play, and configurable rounds, while Gartic Phone competes through many replayable modes. [Skribbl official site](https://skribbl.io/?language=en), [Gartic Phone modes](https://garticphone.com/en/lobby)

Mithril Tiles should not copy every feature. Its differentiation should be **atmosphere, instant access, and satisfying small-group sessions**.

## Critical Blockers

### 1. Game lifecycle failures can permanently freeze rooms

When starting a game fails, the room is incorrectly marked as started:

- [handlers.go:795](internal/realtime/handlers.go#L795)
- [handlers.go:798](internal/realtime/handlers.go#L798)

That prevents the host from retrying after a temporary database failure.

Round persistence failure is worse:

- [handlers.go:584](internal/realtime/handlers.go#L584)
- [handlers.go:623](internal/realtime/handlers.go#L623)

Bot runtimes are stopped, but the round is not reset and no retry or recovery transition occurs.

**Required fix**

- Introduce explicit round_ending, round_end_failed, and recoverable game-start states.
- Run database persistence asynchronously.
- Send a typed completion back into Room.Run.
- Let the room actor perform the final state transition.
- Allow safe retry or controlled game cancellation.

**Acceptance criterion:** A forced database failure during start, round end, or game end must never leave a room permanently unusable.

### 2. Duplicate connections create duplicate players

Every WebSocket connection creates a new Player:

- [io.go:25](internal/realtime/io.go#L25)
- [io.go:36](internal/realtime/io.go#L36)

Joining only checks room capacity. Membership is keyed by player pointer rather than principal ID:

- [handlers.go:72](internal/realtime/handlers.go#L72)
- [handlers.go:83](internal/realtime/handlers.go#L83)

Refreshing or opening a second tab can therefore:

- Consume another room slot.
- Duplicate the same database participant.
- Break host and drawer identity.
- Lose in-progress scores during reconnection.
- Cause game-start persistence errors.

**Required fix:** Maintain one logical room participant per stable principal UUID. A new connection should replace the old connection or reconnect to the existing participant instead of inserting another player.

**Acceptance criterion:** Refreshing, disconnecting, or opening another tab must preserve the same room membership and score without increasing the player count.

### 3. Realtime payloads are insufficiently protected

The WebSocket reader currently has:

- No maximum message size.
- No per-connection rate limit.
- No chat length limit.
- No stroke-coordinate validation.
- No brush-size validation.
- No valid-color validation.
- No finite-number checks.

Relevant path:

- [io.go:124](internal/realtime/io.go#L124)
- [io.go:134](internal/realtime/io.go#L134)
- [io.go:156](internal/realtime/io.go#L156)

A public client could send oversized messages, thousands of strokes per second, invalid coordinates, or pathological numeric values.

**Required fix**

- Set a WebSocket read limit.
- Limit chat to approximately 300-500 characters.
- Validate normalized coordinates as finite values within 0..1.
- Validate brush size and color.
- Add a token bucket per connection.
- Rate-limit WebSocket ticket creation.
- Close persistent abusive connections with a policy violation.

### 4. Slow clients silently lose canvas events

Outgoing messages use a channel of only ten entries:

- [io.go:39](internal/realtime/io.go#L39)

Messages and strokes are silently dropped when that channel fills:

- [handlers.go:53](internal/realtime/handlers.go#L53)
- [handlers.go:488](internal/realtime/handlers.go#L488)

The snapshot contains only a canvas revision, not enough data to rebuild the drawing:

- [room.go:61](internal/realtime/room.go#L61)

Consequently, two players can see different canvases.

**Required fix:** Keep a bounded list of validated strokes for the current round and include it in snapshots. A reconnecting or slow client can then rebuild the canvas. If a client remains too slow, disconnect it and allow a clean reconnect rather than silently diverging.

### 5. Empty rooms live indefinitely

When the final player leaves, the host is cleared, but the room is not deleted:

- [handlers.go:105](internal/realtime/handlers.go#L105)
- [handlers.go:114](internal/realtime/handlers.go#L114)

Every room has a goroutine and supporting state. Automated room creation or abandoned links can therefore accumulate memory indefinitely.

**Required fix:** Delete idle empty rooms after a short grace period, such as 5-10 minutes. Closing a room must stop bot runtimes, cleanup workers, timers, and the main room goroutine.

### 6. Drawing UI still trusts the display name

The frontend determines whether the current player is the drawer by comparing display names:

- [room-shell.tsx:593](frontend/src/features/rooms/room-shell.tsx#L593)

The backend correctly authorizes using stable IDs, but duplicate names can make the wrong player see an active canvas that the server silently rejects.

**Required fix:** Compare principal.id against roomSnapshot.game.drawer_id.

### 7. Drawing while idle disconnects the player

A stroke received while the round is idle causes the message reader to return:

- [io.go:161](internal/realtime/io.go#L161)

This disconnects the player because of a harmless stale event.

**Required fix:** Ignore or explicitly reject the stroke without ending the connection.

## Release Quality

The current checks produced:

- go test ./...: passed.
- go test -race ./internal/realtime: passed.
- go vet ./...: passed.
- Frontend tests: 85 passed.
- TypeScript checking: passed.
- Production frontend build: passed.
- Frontend lint: **failed with two errors**.

Lint failures:

- [use-room-socket.ts:129](frontend/src/features/realtime/use-room-socket.ts#L129)
- [room-shell.tsx:211](frontend/src/features/rooms/room-shell.tsx#L211)

There are no browser-level end-to-end tests or realtime load tests. Unit tests are good, but they cannot prove that five browsers can complete multiple rounds under disconnects and network delay.

**Minimum CI pipeline**

- go test ./...
- go test -race ./internal/realtime
- go vet ./...
- npm ci
- npm test
- npm run lint
- npx tsc --noEmit
- npm run build

Add one Playwright flow:

- Guest host creates room.
- Second guest joins through invite URL.
- Host starts game.
- Drawer sends strokes.
- Guesser scores.
- Drawer rotates.
- Game finishes.
- Scoreboard appears.
- Party starts another match.

Add a load scenario for at least 100 simultaneous rooms with five connections each.

## Core Product Loop

### Invitation

The current lobby copies only the room code:

- [room-shell.tsx:522](frontend/src/features/rooms/room-shell.tsx#L522)

People should not manually explain where to paste a code.

**Change it to**

- Primary action: Invite the Fellowship.
- Copy the complete room URL.
- Use navigator.share() on supported mobile devices.
- Fall back to clipboard.
- Add a QR code only if real users request it.

The Web Share API can pass URLs into native messaging and sharing applications, though it requires HTTPS and should retain a clipboard fallback. [MDN Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)

### Rematches

Currently a completed room code is retired, and players are returned to the game menu. This protects the current one-room/one-game database model, but it directly harms retention.

The long-term model should be:

- Party room
- Game 1
- Game 2
- Game 3

The room code identifies the party. Every match has a separate game UUID.

The scoreboard should offer:

- Play Again.
- Change Word Pack.
- Return to Hall.
- Share Result.

The same connected players should stay together for the next match.

### Room Configuration

The current game uses hardcoded values:

- [room.go:14](internal/realtime/room.go#L14)
- [room.go:15](internal/realtime/room.go#L15)
- [room.go:76](internal/realtime/room.go#L76)

There are conflicting round constants of two and three.

For the first usable release, hosts need only:

- Number of rounds.
- Drawing time.
- Word pack.
- Bots enabled or disabled.

Do not build a large settings system yet.

### Custom Words

Custom words are established expectations in private drawing games. For retention, let hosts create temporary room-scoped custom words without entering the admin dashboard.

Add:

- Custom words for the current party.
- Use-only-custom-words option.
- Duplicate and empty-word validation.
- Basic profanity controls.
- Family-safe default packs.

### Moderation

Before opening rooms publicly, hosts need:

- Kick player.
- Ban player from the current room.
- Mute chat.
- Disable bots.
- Clear canvas as host.
- Report abusive content if public discovery is ever added.

Public matchmaking should wait until moderation is mature.

## Bots

The bot architecture is impressive, but its product role should be reduced temporarily.

Current limitations include:

- Text models are being asked to produce vector stroke plans rather than actual images.
- Semantic drawing quality is inconsistent.
- Providers may time out or return malformed structured output.
- Guess quality depends on an incomplete representation of the drawing.
- Provider calls introduce cost and latency into a time-sensitive game.
- External provider outages can affect gameplay.

For the MVP:

- Label bots Experimental.
- Make them opt-in.
- Never block a round on an AI response.
- Preserve deterministic fallback behavior.
- Set strict latency and spending limits.
- Record provider, latency, success, fallback, and token usage.
- Avoid adding more providers until one path is reliable.
- Consider curated procedural drawings for common words rather than relying entirely on LLM-generated geometry.

Bots can become the differentiator later, but first they should solve one practical problem: **letting two friends play when they do not have enough people**.

## Accounts And Safety

Guest-first access is the correct decision. Avoid forcing account creation before the player experiences a match.

Account functionality still needs:

- Password reset.
- Backend token revocation on logout.
- Expired token and guest-session cleanup.
- Account deletion confirmation.
- Clear avatar upload validation.
- Unique generated Cloudinary public IDs.
- Privacy policy.
- Terms of service.
- AI data disclosure.

The health endpoint currently returns a static response and does not verify database availability:

- [healthcheck.go:7](cmd/api/healthcheck.go#L7)

The server also lacks graceful shutdown:

- [server.go:11](cmd/api/server.go#L11)

Before launch, add readiness checks, graceful SIGTERM handling, structured request IDs, error tracking, metrics, and database backups.

Initially, deploy only one backend instance because active room state is process-local. Do not horizontally scale until room coordination is externalized.

## Brand Risk

The visual direction should remain medieval, but public marketing should move away from explicit Tolkien intellectual property, including names such as Frodo, Gandalf, Middle-earth, and direct "Lord of the Rings" claims.

Middle-earth Enterprises explicitly operates a licensing program for products based on The Lord of the Rings and The Hobbit, and the Tolkien Estate notes that many character names, places, and elements are trademarked. [Middle-earth Enterprises licensing](https://www.middleearth.com/licensing), [Tolkien Estate FAQ](https://www.tolkienestate.com/frequently-asked-questions-and-links/)

This is not legal advice, but before monetization or widespread promotion I strongly recommend:

- Original bot names.
- Original fantasy locations and terminology.
- Original artwork.
- Medieval-fantasy positioning rather than LOTR-themed positioning.
- A short consultation with an intellectual-property lawyer if you retain references.

This is one of the most important nontechnical launch risks.

## API Cleanup

These are not launch blockers, but they should be cleaned up after reliability work:

- Typographical route: [routes.go:31](cmd/api/routes.go#L31)
- Inconsistent word-packs-getall route: [routes.go:23](cmd/api/routes.go#L23)
- Suspicious duplicate word creation route: [routes.go:26](cmd/api/routes.go#L26)
- Potentially obsolete direct game creation route: [routes.go:28](cmd/api/routes.go#L28)
- Final scoreboard performs one principal request per score: [room-shell.tsx:393](frontend/src/features/rooms/room-shell.tsx#L393)

Return presentation data directly with final scores to eliminate the N+1 request pattern.

## Launch Roadmap

Assuming one focused developer, a credible closed-beta launch is approximately **four to six weeks**, not months.

### Week 1: Reliability

- Fix game-start and round-end failure states.
- Enforce one player per principal.
- Preserve player identity and score across reconnection.
- Validate and rate-limit WebSocket input.
- Add bounded stroke replay.
- Remove empty rooms.
- Fix the drawer-ID comparison.
- Make lint pass.

**Exit criterion:** Repeated automated matches complete without frozen rooms, duplicate players, or divergent canvases.

### Week 2: Social Loop

- Copy complete invite URLs.
- Add native sharing with clipboard fallback.
- Support rematches with the same party.
- Add minimal host settings.
- Add room-scoped custom words.
- Add a first-time explanation requiring no separate rules page.

**Exit criterion:** A new host can invite friends and start a match in under 90 seconds.

### Week 3: Operations And Safety

- Add CI.
- Add browser E2E tests.
- Add realtime load tests.
- Add graceful shutdown and readiness.
- Add structured logging and error tracking.
- Add host kick/mute controls.
- Add privacy policy and terms.
- Replace protected fantasy names and artwork.

**Exit criterion:** A failed deployment or provider outage does not destroy active games silently, and operational failures are visible.

### Weeks 4-6: Closed Beta

Recruit approximately ten real friend groups. Do not only ask developers to test it.

Observe sessions without explaining the interface. Record:

- Where invitations fail.
- How long starting takes.
- Whether players understand whose turn it is.
- Whether they request rematches.
- Whether mobile drawing is comfortable.
- Whether bots improve or reduce enjoyment.

Fix repeated problems before adding features.

## Product Metrics

Instrument these events without recording secret words or private chat content:

- landing_viewed
- guest_created
- room_created
- invite_copied
- invite_shared
- room_joined
- game_started
- round_completed
- game_completed
- rematch_started
- player_disconnected
- player_reconnected
- bot_request_succeeded
- bot_fallback_used

Initial targets:

- Median time from landing page to room: under 30 seconds.
- Median room creation to game start: under 90 seconds.
- Invite-to-join conversion: above 50%.
- Match completion rate: above 95% during beta.
- Successful reconnect rate: above 95%.
- Rematch rate: above 25%.
- Bot provider fallback rate: below 10%.
- Unrecoverable room failures: zero.

The most valuable metric is not registered users. It is **completed friend-group matches per week**.

## Do Not Build Yet

Avoid spending the next cycle on:

- Public matchmaking.
- Global leaderboards.
- More AI providers.
- Advanced image generation.
- More admin dashboards.
- Spectator mode.
- Monetization.
- Native mobile applications.
- Kubernetes or multi-region deployment.
- Large numbers of game modes.

Those features will not matter if invitations, reconnects, match completion, and rematches are unreliable.

The correct immediate goal is:

> Make one private match so easy to start, reliable to finish, and satisfying to replay that players invite another group without being asked.

