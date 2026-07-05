CREATE TABLE websocket_tickets (
    hash bytea PRIMARY KEY,
    user_id uuid
        REFERENCES users (id) ON DELETE CASCADE,
    guest_session_id uuid
        REFERENCES guest_sessions (id) ON DELETE CASCADE,
    room_code text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT websocket_tickets_exactly_one_owner_check
        CHECK (num_nonnulls(user_id, guest_session_id) = 1),
    CONSTRAINT websocket_tickets_room_code_not_blank
        CHECK (length(trim(room_code)) > 0),
    CONSTRAINT websocket_tickets_expires_after_created_check
        CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX websocket_tickets_one_user_room_key
    ON websocket_tickets (user_id, room_code)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX websocket_tickets_one_guest_room_key
    ON websocket_tickets (guest_session_id, room_code)
    WHERE guest_session_id IS NOT NULL;

CREATE INDEX websocket_tickets_expires_at_idx
    ON websocket_tickets (expires_at);
