ALTER TABLE guest_sessions
    ADD COLUMN session_token_hash text,
    ADD COLUMN expires_at timestamptz;

UPDATE guest_sessions AS guest
SET
    session_token_hash = COALESCE(
        (
            SELECT encode(token.hash, 'hex')
            FROM tokens AS token
            WHERE token.guest_session_id = guest.id
            ORDER BY token.expiry DESC
            LIMIT 1
        ),
        encode(digest(guest.id::text, 'sha256'), 'hex')
    ),
    expires_at = GREATEST(
        COALESCE(
            (
                SELECT token.expiry
                FROM tokens AS token
                WHERE token.guest_session_id = guest.id
                ORDER BY token.expiry DESC
                LIMIT 1
            ),
            guest.created_at + interval '1 microsecond'
        ),
        guest.created_at + interval '1 microsecond'
    );

ALTER TABLE guest_sessions
    ALTER COLUMN session_token_hash SET NOT NULL,
    ALTER COLUMN expires_at SET NOT NULL,
    ADD CONSTRAINT guest_sessions_session_token_hash_key UNIQUE (session_token_hash),
    ADD CONSTRAINT guest_sessions_token_hash_not_blank
        CHECK (length(trim(session_token_hash)) > 0),
    ADD CONSTRAINT guest_sessions_expires_after_created
        CHECK (expires_at > created_at);

CREATE INDEX guest_sessions_expires_at_idx
    ON guest_sessions (expires_at);

DELETE FROM tokens
WHERE guest_session_id IS NOT NULL;

DROP INDEX tokens_guest_session_id_idx;

ALTER TABLE tokens
    DROP CONSTRAINT tokens_exactly_one_owner_check,
    DROP COLUMN guest_session_id,
    ALTER COLUMN user_id SET NOT NULL;
