# Mithril Tiles Database Design

PostgreSQL stores durable identities, game content, secure connection credentials, bot profiles, and completed game outcomes. The live game loop remains in the Go server's in-memory room actors; raw strokes, chat messages, temporary guesses, and timers are intentionally not persisted.

The schema is defined by the migrations in [`migrations/`](migrations). This document describes the database as it exists after migration `000008`.

## Entity Overview

```text
users ────────< tokens
  |
  |          guest_sessions ───────< tokens
  |                 |
  |                 `──────────────< websocket_tickets
  |
  +──< word_packs ───< words
  |
  `──< game_participants >── bot_profiles
              |
games ────────+──< game_rounds ───< round_scores
  |                    |
  `──────────────< game_final_scores
```

## Identity and Access

### `users`

Registered accounts. A user has a display name, optional unique handle and email, password hash, optional avatar, account status, and a role. Roles are constrained to `normal` and `admin`; administrator privileges protect word-pack and bot-profile management.

### `guest_sessions`

Temporary guest identities. Guests have a UUID and display name but no password or stored credential on this table. Their authentication token is stored in `tokens`.

### `tokens`

Hashed bearer tokens for either a registered user or a guest session. A database check constraint requires exactly one owner, and each token has an expiry and scope. Foreign keys cascade token removal when the owning identity is deleted.

### `websocket_tickets`

One-time, short-lived credentials for direct room WebSocket connections. Each ticket stores only a hash, is bound to one user or guest principal and one room code, and expires after its short TTL. Partial unique indexes allow only one outstanding ticket per principal and room.

## Content Catalog

### `word_packs`

Administrator-managed word collections. Each pack has a unique slug, description, active flag, and timestamps. `is_active` controls whether the pack may be selected for a game.

### `words`

Words belong to one word pack and have a difficulty of `easy`, `medium`, or `hard`. A case-insensitive unique index prevents duplicate normalized word text inside one pack.

### `bot_profiles`

Reusable bot identities. A profile has a unique name, difficulty (`easy`, `normal`, `hard`, or `custom`), behavior style, optional avatar, active flag, and timestamps. Only active profiles are available for room selection.

## Completed Game Records

### `games`

One durable game record per started match. It stores the room code, selected word pack, host participant, lifecycle status, settings snapshot, and timestamps. Status is constrained to `started`, `completed`, `abandoned`, or `cancelled`.

There may be only one `started` game for a room code at a time. The host foreign key is deferred because participants and the game are created together in a transaction.

### `game_participants`

A participant snapshot for a particular game. It records a user, guest session, or bot profile plus the display name visible during that match, participant type, host status, and join/leave times.

The identity/type constraint requires exactly the matching identity column:

| Participant type | Required identity |
| --- | --- |
| `user` | `user_id` |
| `guest` | `guest_session_id` |
| `bot` | `bot_profile_id` |

Partial unique indexes prevent the same user, guest, or bot profile from appearing twice in one game. At most one participant can be the host.

### `game_rounds`

Each round records its game, sequential number, drawer participant, selected word, word-text snapshot, duration, status, and timestamps. The row also receives its `word_pack_id` through a trigger, which ensures the word belongs to the pack selected by the game.

Each game can have only one `started` round at a time, and its round number is unique inside the game.

### `round_scores`

Individual score awards for a round. Valid reasons are `correct_guess`, `drawer_bonus`, `time_bonus`, `participation_bonus`, and `penalty`. The schema derives `game_id` from the round using a trigger and validates that both the round and participant belong to that same game.

The same score reason can be recorded once per participant per round.

### `game_final_scores`

Final standings for a completed game. Each row stores a participant's final score, unique rank within the game, winner flag, and creation time. A composite foreign key guarantees that the participant belongs to the game.

## Integrity and Deletion Rules

- Deleting a game cascades to participants, rounds, scores, and final scores.
- Deleting a word pack cascades to its words; games retain a normal foreign-key reference and therefore protect words already used by a game.
- Deleting a user or guest session cascades to authentication tokens and WebSocket tickets; game participation history remains protected by the foreign-key policy on its identity reference.
- Database checks enforce nonblank display names and content names, valid lifecycle states, positive round numbers and durations, and chronological timestamps.
- Composite foreign keys and triggers prevent a round from referring to a word from another pack or a score from referring to a participant from another game.

## Deliberately Not Stored

The MVP does not persist replay-level data:

- drawing strokes or canvas snapshots;
- chat messages;
- individual incorrect guesses or guess timelines;
- bot runtime prompts, responses, or scheduling events;
- global leaderboard aggregates or user-stat rollups.

The database stores completed game history and scores. Replays, analytics, and leaderboards can be introduced later with explicit retention and aggregation policies.

## Migration Lifecycle

Migrations run during API startup from the repository's `migrations` directory. Migration files are ordered and versioned; changes to the schema should be made as a new migration pair rather than editing migrations that may already have been applied.
