ALTER TABLE tokens
    ADD COLUMN guest_session_id uuid
        REFERENCES guest_sessions (id) ON DELETE CASCADE;

ALTER TABLE tokens
    ALTER COLUMN user_id DROP NOT NULL;

INSERT INTO tokens (hash, user_id, guest_session_id, expiry, scope)
SELECT
    CASE
        WHEN session_token_hash ~ '^[0-9A-Fa-f]{64}$'
            THEN decode(session_token_hash, 'hex')
        ELSE convert_to(session_token_hash, 'UTF8')
    END,
    NULL,
    id,
    expires_at,
    'guest_authentication'
FROM guest_sessions;

ALTER TABLE tokens
    ADD CONSTRAINT tokens_exactly_one_owner_check
    CHECK (num_nonnulls(user_id, guest_session_id) = 1);

CREATE INDEX tokens_guest_session_id_idx
    ON tokens (guest_session_id);

DROP INDEX guest_sessions_expires_at_idx;

ALTER TABLE guest_sessions
    DROP COLUMN session_token_hash,
    DROP COLUMN expires_at;
