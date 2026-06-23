CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name text NOT NULL,
    handle text UNIQUE,
    email text UNIQUE,
    password text NOT NULL,
    avatar_url text,
    account_status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_display_name_not_blank CHECK (length(trim(display_name)) > 0),
    CONSTRAINT users_handle_not_blank CHECK (handle IS NULL OR length(trim(handle)) > 0),
    CONSTRAINT users_email_not_blank CHECK (email IS NULL OR length(trim(email)) > 0),
    CONSTRAINT users_password_not_blank CHECK (length(trim(password)) > 0),
    CONSTRAINT users_account_status_check CHECK (
        account_status IN ('active', 'suspended', 'deleted', 'pending')
    )
);

CREATE TABLE tokens (
    hash bytea PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expiry timestamptz NOT NULL,
    scope text NOT NULL,

    CONSTRAINT tokens_scope_not_blank CHECK (length(trim(scope)) > 0)
);

CREATE INDEX tokens_user_id_idx ON tokens (user_id);
CREATE INDEX tokens_expiry_idx ON tokens (expiry);

CREATE TABLE guest_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name text NOT NULL,
    session_token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,

    CONSTRAINT guest_sessions_display_name_not_blank CHECK (length(trim(display_name)) > 0),
    CONSTRAINT guest_sessions_token_hash_not_blank CHECK (length(trim(session_token_hash)) > 0),
    CONSTRAINT guest_sessions_expires_after_created CHECK (expires_at > created_at)
);

CREATE INDEX guest_sessions_expires_at_idx ON guest_sessions (expires_at);

CREATE TABLE bot_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    difficulty text NOT NULL,
    behavior_style text NOT NULL,
    avatar_url text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT bot_profiles_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT bot_profiles_behavior_style_not_blank CHECK (length(trim(behavior_style)) > 0),
    CONSTRAINT bot_profiles_difficulty_check CHECK (
        difficulty IN ('easy', 'normal', 'hard', 'custom')
    )
);

CREATE INDEX bot_profiles_active_idx ON bot_profiles (is_active);
