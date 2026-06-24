
CREATE TABLE word_packs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT word_packs_name_not_blank
        CHECK (length(trim(name)) > 0),
    CONSTRAINT word_packs_slug_format_check
        CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX word_packs_active_idx
    ON word_packs (is_active);

CREATE TABLE words (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    word_pack_id uuid NOT NULL
        REFERENCES word_packs (id) ON DELETE CASCADE,
    text text NOT NULL,
    difficulty text NOT NULL DEFAULT 'medium',
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT words_text_not_blank
        CHECK (length(trim(text)) > 0),
    CONSTRAINT words_difficulty_check
        CHECK (difficulty IN ('easy', 'medium', 'hard'))
);

CREATE INDEX words_word_pack_id_idx
    ON words (word_pack_id);

CREATE UNIQUE INDEX words_pack_normalized_text_key
    ON words (word_pack_id, lower(trim(text)));
