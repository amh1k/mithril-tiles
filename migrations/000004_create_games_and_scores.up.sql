CREATE TABLE games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code text NOT NULL,
    host_participant_id uuid NOT NULL,
    word_pack_id uuid NOT NULL
        REFERENCES word_packs (id),
    status text NOT NULL DEFAULT 'started',
    settings_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT games_room_code_not_blank
        CHECK (length(trim(room_code)) > 0),
    CONSTRAINT games_status_check
        CHECK (status IN ('started', 'completed', 'abandoned', 'cancelled')),
    CONSTRAINT games_settings_snapshot_object_check
        CHECK (jsonb_typeof(settings_snapshot) = 'object'),
    CONSTRAINT games_ended_after_started_check
        CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT games_completed_has_ended_at_check
        CHECK (status <> 'completed' OR ended_at IS NOT NULL)
);

CREATE INDEX games_room_code_idx
    ON games (room_code);

CREATE INDEX games_status_idx
    ON games (status);

CREATE INDEX games_started_at_idx
    ON games (started_at);

CREATE INDEX games_ended_at_idx
    ON games (ended_at);

CREATE TABLE game_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL
        REFERENCES games (id) ON DELETE CASCADE,
    user_id uuid
        REFERENCES users (id),
    guest_session_id uuid
        REFERENCES guest_sessions (id),
    bot_profile_id uuid
        REFERENCES bot_profiles (id),
    display_name_snapshot text NOT NULL,
    participant_type text NOT NULL,
    is_host boolean NOT NULL DEFAULT false,
    joined_at timestamptz NOT NULL DEFAULT now(),
    left_at timestamptz,

    CONSTRAINT game_participants_game_and_id_key
        UNIQUE (game_id, id),
    CONSTRAINT game_participants_display_name_not_blank
        CHECK (length(trim(display_name_snapshot)) > 0),
    CONSTRAINT game_participants_type_check
        CHECK (participant_type IN ('user', 'guest', 'bot')),
    CONSTRAINT game_participants_identity_matches_type_check
        CHECK (
            (participant_type = 'user'
                AND user_id IS NOT NULL
                AND guest_session_id IS NULL
                AND bot_profile_id IS NULL)
            OR
            (participant_type = 'guest'
                AND user_id IS NULL
                AND guest_session_id IS NOT NULL
                AND bot_profile_id IS NULL)
            OR
            (participant_type = 'bot'
                AND user_id IS NULL
                AND guest_session_id IS NULL
                AND bot_profile_id IS NOT NULL)
        ),
    CONSTRAINT game_participants_left_after_joined_check
        CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX game_participants_game_id_idx
    ON game_participants (game_id);

CREATE INDEX game_participants_user_id_idx
    ON game_participants (user_id);

CREATE INDEX game_participants_guest_session_id_idx
    ON game_participants (guest_session_id);

CREATE INDEX game_participants_bot_profile_id_idx
    ON game_participants (bot_profile_id);

CREATE UNIQUE INDEX game_participants_one_host_per_game_key
    ON game_participants (game_id)
    WHERE is_host;

ALTER TABLE games
    ADD CONSTRAINT games_host_participant_fk
    FOREIGN KEY (id, host_participant_id)
    REFERENCES game_participants (game_id, id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE game_rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL
        REFERENCES games (id) ON DELETE CASCADE,
    round_number integer NOT NULL,
    drawer_participant_id uuid NOT NULL,
    word_id uuid NOT NULL
        REFERENCES words (id),
    word_text_snapshot text NOT NULL,
    status text NOT NULL DEFAULT 'started',
    duration_seconds integer NOT NULL,
    started_at timestamptz NOT NULL,
    ended_at timestamptz,

    CONSTRAINT game_rounds_game_and_id_key
        UNIQUE (game_id, id),
    CONSTRAINT game_rounds_game_round_number_key
        UNIQUE (game_id, round_number),
    CONSTRAINT game_rounds_drawer_participant_fk
        FOREIGN KEY (game_id, drawer_participant_id)
        REFERENCES game_participants (game_id, id),
    CONSTRAINT game_rounds_round_number_positive
        CHECK (round_number > 0),
    CONSTRAINT game_rounds_word_text_not_blank
        CHECK (length(trim(word_text_snapshot)) > 0),
    CONSTRAINT game_rounds_status_check
        CHECK (status IN ('started', 'completed', 'skipped', 'abandoned')),
    CONSTRAINT game_rounds_duration_positive
        CHECK (duration_seconds > 0),
    CONSTRAINT game_rounds_ended_after_started_check
        CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT game_rounds_completed_has_ended_at_check
        CHECK (status <> 'completed' OR ended_at IS NOT NULL)
);

CREATE INDEX game_rounds_drawer_participant_id_idx
    ON game_rounds (drawer_participant_id);

CREATE TABLE round_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id uuid NOT NULL
        REFERENCES game_rounds (id) ON DELETE CASCADE,
    participant_id uuid NOT NULL
        REFERENCES game_participants (id) ON DELETE CASCADE,
    points_earned integer NOT NULL,
    score_reason text NOT NULL,
    awarded_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT round_scores_reason_not_blank
        CHECK (length(trim(score_reason)) > 0),
    CONSTRAINT round_scores_reason_check
        CHECK (
            score_reason IN (
                'correct_guess',
                'drawer_bonus',
                'time_bonus',
                'participation_bonus',
                'penalty'
            )
        )
);

CREATE INDEX round_scores_round_id_idx
    ON round_scores (round_id);

CREATE INDEX round_scores_participant_id_idx
    ON round_scores (participant_id);

CREATE TABLE game_final_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL
        REFERENCES games (id) ON DELETE CASCADE,
    participant_id uuid NOT NULL,
    final_score integer NOT NULL,
    final_rank integer NOT NULL,
    is_winner boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT game_final_scores_game_participant_key
        UNIQUE (game_id, participant_id),
    CONSTRAINT game_final_scores_game_rank_key
        UNIQUE (game_id, final_rank),
    CONSTRAINT game_final_scores_participant_fk
        FOREIGN KEY (game_id, participant_id)
        REFERENCES game_participants (game_id, id)
        ON DELETE CASCADE,
    CONSTRAINT game_final_scores_rank_positive
        CHECK (final_rank > 0)
);

CREATE INDEX game_final_scores_participant_id_idx
    ON game_final_scores (participant_id);
