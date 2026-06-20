# Mithril Tiles Backend MVP Plan

This plan focuses only on the backend. It assumes the backend will be completed over roughly 4 to 5 weeks, with work happening 6 days per week from Monday to Saturday.

The plan starts today, Saturday, June 20, 2026, as a light planning and setup day. The first full development week starts on Monday, June 22, 2026.

The schedule is intentionally realistic for one developer mostly coding manually, with only light AI help for debugging, review, explanation, or small implementation guidance.

## MVP Backend Goal

By the end of this plan, the backend should support:

- User signup, login, logout, and current-user lookup.
- Guest play support.
- Word packs and words.
- Bot profiles stored in the database.
- Room creation and joining.
- WebSocket lobby updates.
- Game phase management.
- Drawing event broadcasting.
- Guess validation without permanent guess storage.
- Scoring.
- Completed game persistence.
- Global leaderboard updates.
- Basic validation, rate limiting, and backend hardening.

## What Is Not Included

These features are intentionally excluded from the backend MVP:

- Replay storage.
- Permanent guess storage.
- Stored drawing strokes.
- Chat history.
- Friends leaderboard.
- Seasonal leaderboard.
- Room-only leaderboard.
- Matchmaking.
- Payments.
- Admin dashboard.
- Multi-server scaling.
- Redis-based room sharing.
- Advanced analytics.

The backend should first become a stable single-instance MVP with reliable auth, database persistence, rooms, WebSockets, game flow, and global rankings.

## Working Principles

- Build boring foundations first.
- Keep active gameplay state in memory.
- Persist completed outcomes, not live gameplay noise.
- Keep HTTP for setup and persistence.
- Keep WebSockets for live room and game events.
- Make the backend server-authoritative.
- Avoid storing guesses and drawing strokes in the database.
- Treat bot profiles as real database records.
- Make global leaderboard the first leaderboard type.

## Week 0: Light Kickoff

### Saturday, June 20, 2026

Goal: clarify direction without doing heavy implementation.

Tasks:

- Review `ARCHITECTURE.md`.
- Review `database_design.md`.
- Confirm backend language, framework, and database tooling.
- Confirm authentication strategy.
- Confirm migration strategy.
- Confirm environment variable conventions.
- Confirm API response conventions.
- Confirm WebSocket message envelope conventions.

Expected outcome:

- Backend direction is clear.
- No major architecture decisions are left vague.
- Development can start cleanly on Monday.

## Week 1: Auth, Project Base, Database Foundation

Goal: build the boring but important backend base first.

### Monday, June 22, 2026

Focus: backend project foundation.

Tasks:

- Initialize backend project.
- Add config loading.
- Add structured logging.
- Add health route.
- Add basic error response format.
- Add environment variable setup.
- Add local development command.

Expected outcome:

- Backend server can start locally.
- Health endpoint works.
- Configuration and logging are in place.

### Tuesday, June 23, 2026

Focus: database foundation.

Tasks:

- Connect backend to PostgreSQL.
- Set up migration tooling.
- Create first migrations for:
  - `users`
  - `guest_sessions`
  - `bot_profiles`
- Add database connection health check.

Expected outcome:

- Backend can connect to PostgreSQL.
- Initial migrations run successfully.
- Base identity tables exist.

### Wednesday, June 24, 2026

Focus: signup flow.

Tasks:

- Implement user signup.
- Validate email.
- Validate handle.
- Validate display name.
- Hash passwords if using email/password auth.
- Prevent duplicate email/handle.
- Return safe user response.

Expected outcome:

- A new registered user can sign up.
- Invalid signup data is rejected cleanly.

### Thursday, June 25, 2026

Focus: login and session flow.

Tasks:

- Implement login.
- Verify credentials.
- Issue session or JWT.
- Define token/session expiration behavior.
- Implement logout strategy.

Expected outcome:

- A user can log in and receive a valid auth token/session.
- A user can log out.

### Friday, June 26, 2026

Focus: auth middleware.

Tasks:

- Add auth middleware.
- Add current-user endpoint.
- Protect a test route.
- Handle invalid/expired auth.
- Add basic auth tests or manual test cases.

Expected outcome:

- Backend can identify the current authenticated user.
- Protected routes work correctly.

### Saturday, June 27, 2026

Focus: seed data and first cleanup.

Tasks:

- Seed default bot profiles.
- Add base word pack table if not already added.
- Add base words table if not already added.
- Seed one default word pack.
- Seed initial words.
- Manually test auth and seed data.

Expected outcome:

- Auth base works.
- Bot profiles exist in the database.
- Default word pack data exists.

## Week 2: Word Packs, Bots, And Room Setup

Goal: support everything needed before live gameplay starts.

### Monday, June 29, 2026

Focus: word pack endpoints.

Tasks:

- Implement list word packs.
- Implement get word pack details.
- Implement create word pack if user-created packs are enabled.
- Add visibility and status filtering.

Expected outcome:

- Backend can serve available word packs.

### Tuesday, June 30, 2026

Focus: words inside packs.

Tasks:

- Implement list words by pack.
- Implement create word if user-created packs are enabled.
- Normalize word text.
- Enforce duplicate prevention per word pack.
- Add difficulty/category filtering.

Expected outcome:

- Backend can serve words for game setup.
- Words are normalized consistently.

### Wednesday, July 1, 2026

Focus: bot profiles.

Tasks:

- Implement list active bot profiles.
- Implement get bot profile.
- Add bot difficulty filtering.
- Define bot selection rules for rooms.

Expected outcome:

- Rooms can use database-backed bot profiles.

### Thursday, July 2, 2026

Focus: room creation.

Tasks:

- Implement create room endpoint.
- Generate room code.
- Attach host identity.
- Validate room settings.
- Keep room state in memory.

Expected outcome:

- A user or allowed guest can create a room.
- Room exists in the in-memory room manager.

### Friday, July 3, 2026

Focus: room joining.

Tasks:

- Implement join room flow.
- Support registered users.
- Support guest players.
- Validate nickname/display name.
- Enforce room capacity.
- Reject invalid room codes.

Expected outcome:

- Players can join existing rooms before WebSocket work begins.

### Saturday, July 4, 2026

Focus: room manager foundation.

Tasks:

- Implement create room in room manager.
- Implement get room by code.
- Implement remove room.
- Implement host transfer basics.
- Implement empty room cleanup.
- Manually test room lifecycle.

Expected outcome:

- In-memory room manager is reliable enough for WebSocket integration.

## Week 3: WebSocket Room Layer

Goal: players can connect, join rooms, and receive live room state.

### Monday, July 6, 2026

Focus: WebSocket connection lifecycle.

Tasks:

- Add WebSocket upgrade route.
- Authenticate or identify connecting player.
- Attach connection to room.
- Add ping/pong heartbeat.
- Handle connection close.

Expected outcome:

- A client can open a WebSocket connection to a room.

### Tuesday, July 7, 2026

Focus: room registration and broadcasts.

Tasks:

- Register clients in rooms.
- Unregister clients on disconnect.
- Broadcast `room.state`.
- Broadcast `player.joined`.
- Broadcast `player.left`.

Expected outcome:

- Multiple connected players see lobby updates.

### Wednesday, July 8, 2026

Focus: WebSocket message envelope.

Tasks:

- Define message envelope validation.
- Reject unknown message types.
- Validate payload shape.
- Add structured WebSocket error responses.
- Add safe logging for bad messages.

Expected outcome:

- WebSocket layer can safely receive and reject client messages.

### Thursday, July 9, 2026

Focus: lobby settings.

Tasks:

- Add lobby setting update message.
- Enforce host-only setting changes.
- Validate round count.
- Validate round duration.
- Validate bot count.
- Broadcast updated room state.

Expected outcome:

- Host can configure the lobby live.

### Friday, July 10, 2026

Focus: start game message.

Tasks:

- Add `game.start` message.
- Enforce host-only start.
- Validate enough participants.
- Validate selected word pack.
- Validate room phase.
- Transition room out of lobby.

Expected outcome:

- Host can start a valid game.

### Saturday, July 11, 2026

Focus: WebSocket stabilization.

Tasks:

- Test with multiple clients.
- Test disconnect and reconnect basics.
- Test host disconnect behavior.
- Test invalid messages.
- Fix room cleanup issues.

Expected outcome:

- WebSocket lobby is stable enough for gameplay implementation.

## Week 4: Game Engine

Goal: the actual game loop works end to end.

### Monday, July 13, 2026

Focus: game phases.

Tasks:

- Implement phase model.
- Support:
  - Lobby
  - Word selection/internal selection
  - Drawing
  - Round results
  - Game results
- Prevent invalid phase transitions.

Expected outcome:

- Room state moves through valid game phases.

### Tuesday, July 14, 2026

Focus: drawer and word selection.

Tasks:

- Implement drawer rotation.
- Select words from the chosen word pack.
- Avoid repeated words in the same game.
- Store current hidden word in memory.
- Send drawer-only word visibility.

Expected outcome:

- Each round has a drawer and word.

### Wednesday, July 15, 2026

Focus: timer manager.

Tasks:

- Start round countdown.
- Broadcast timer updates.
- End round on timeout.
- Prevent duplicate round endings.
- Add short transition delay after round results.

Expected outcome:

- Rounds can start, tick, and end automatically.

### Thursday, July 16, 2026

Focus: drawing events.

Tasks:

- Accept drawing events from current drawer.
- Reject drawing events from non-drawers.
- Validate payload size.
- Broadcast accepted drawing events.
- Do not persist drawing events.

Expected outcome:

- Live drawing works through WebSockets.

### Friday, July 17, 2026

Focus: guesses and scoring.

Tasks:

- Accept guesses during drawing phase.
- Reject guesses from drawer.
- Normalize guess text.
- Compare against current hidden word.
- Track correct guessers in memory.
- Award score in memory.
- Do not persist guess text.

Expected outcome:

- Guess validation and live score updates work.

### Saturday, July 18, 2026

Focus: round and game transitions.

Tasks:

- End round when timer expires.
- End round when all guessers are correct if desired.
- Broadcast round results.
- Advance to next round.
- End game after final round.
- Broadcast final leaderboard.

Expected outcome:

- A full in-memory game can run from start to finish.

## Week 5: Persistence, Leaderboard, And Hardening

Goal: save completed games and make the backend MVP-ready.

### Monday, July 20, 2026

Focus: game persistence.

Tasks:

- Persist `games`.
- Persist `game_participants`.
- Persist `game_rounds`.
- Persist `round_scores`.
- Persist `game_final_scores`.
- Ensure guesses and strokes are not saved.

Expected outcome:

- Completed game outcomes are saved to PostgreSQL.

### Tuesday, July 21, 2026

Focus: global leaderboard.

Tasks:

- Update `user_stats` on game completion.
- Update `global_leaderboard`.
- Exclude bots.
- Exclude guests unless explicitly changed later.
- Apply MVP ranking formula.

Expected outcome:

- Registered users appear on the global leaderboard after completed games.

### Wednesday, July 22, 2026

Focus: game history endpoints.

Tasks:

- Add user game history endpoint.
- Add game summary endpoint.
- Add final scores endpoint.
- Add global leaderboard endpoint.
- Add basic pagination.

Expected outcome:

- Frontend can display history and leaderboard data.

### Thursday, July 23, 2026

Focus: validation and abuse prevention.

Tasks:

- Add rate limiting for guesses.
- Add rate limiting for drawing events.
- Add WebSocket payload size limits.
- Add stricter room permission checks.
- Add better error responses.

Expected outcome:

- Backend is safer against noisy or broken clients.

### Friday, July 24, 2026

Focus: integration testing.

Tasks:

- Test signup to login.
- Test guest play.
- Test room creation.
- Test room joining.
- Test WebSocket lobby.
- Test game start.
- Test drawing and guessing.
- Test game completion.
- Test leaderboard update.

Expected outcome:

- Main backend MVP flow works end to end.

### Saturday, July 25, 2026

Focus: backend MVP review and cleanup.

Tasks:

- Clean up naming.
- Review error handling.
- Review logs.
- Review config.
- Review migrations.
- Review seed data.
- Document known limitations.
- Write final backend MVP checklist.

Expected outcome:

- Backend MVP is stable enough to connect with frontend work.

## Backend Completion Checklist

The backend MVP is complete when:

- Users can sign up and log in.
- Guests can play.
- Bot profiles exist in the database.
- Word packs and words are available.
- Rooms can be created and joined.
- WebSocket lobby state works.
- Host can configure and start a game.
- Game phases work correctly.
- Drawer can draw.
- Non-drawers can guess.
- Scores update correctly.
- Guesses are not permanently stored.
- Drawing strokes are not permanently stored.
- Completed games are persisted.
- Final scores are persisted.
- Global leaderboard updates correctly.
- Basic validation and rate limiting exist.
- Main backend flow has been tested end to end.

## Risk Notes

The hardest parts are likely to be:

- WebSocket connection cleanup.
- Preventing invalid game phase transitions.
- Timer race conditions.
- Drawer disconnect behavior.
- Correct scoring without duplicate awards.
- Persisting final game results exactly once.
- Keeping global leaderboard updates consistent.

If the schedule slips, reduce scope in this order:

1. Delay user-created word packs.
2. Simplify guest session history.
3. Simplify round score breakdowns.
4. Keep only final scores for the first internal test.
5. Add advanced validation after the core game loop works.

Do not cut:

- Auth.
- Room manager.
- WebSocket lifecycle.
- Game phases.
- Guess validation.
- Final score persistence.
- Global leaderboard basics.
