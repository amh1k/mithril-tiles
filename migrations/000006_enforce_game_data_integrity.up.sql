CREATE UNIQUE INDEX game_rounds_one_active_per_game_key
    ON game_rounds (game_id)
    WHERE status = 'started';

CREATE UNIQUE INDEX game_participants_one_user_per_game_key
    ON game_participants (game_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX game_participants_one_guest_per_game_key
    ON game_participants (game_id, guest_session_id)
    WHERE guest_session_id IS NOT NULL;

CREATE UNIQUE INDEX game_participants_one_bot_per_game_key
    ON game_participants (game_id, bot_profile_id)
    WHERE bot_profile_id IS NOT NULL;

CREATE UNIQUE INDEX round_scores_round_participant_reason_key
    ON round_scores (round_id, participant_id, score_reason);

ALTER TABLE games
    ADD CONSTRAINT games_id_word_pack_key
    UNIQUE (id, word_pack_id);

ALTER TABLE words
    ADD CONSTRAINT words_word_pack_and_id_key
    UNIQUE (word_pack_id, id);

ALTER TABLE game_rounds
    ADD COLUMN word_pack_id uuid;

UPDATE game_rounds AS game_round
SET word_pack_id = game.word_pack_id
FROM games AS game
WHERE game.id = game_round.game_id;

ALTER TABLE game_rounds
    ALTER COLUMN word_pack_id SET NOT NULL,
    ADD CONSTRAINT game_rounds_game_word_pack_fk
        FOREIGN KEY (game_id, word_pack_id)
        REFERENCES games (id, word_pack_id),
    ADD CONSTRAINT game_rounds_word_pack_word_fk
        FOREIGN KEY (word_pack_id, word_id)
        REFERENCES words (word_pack_id, id);

CREATE FUNCTION set_game_round_word_pack_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT game.word_pack_id
    INTO NEW.word_pack_id
    FROM games AS game
    WHERE game.id = NEW.game_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'game % does not exist', NEW.game_id
            USING ERRCODE = '23503';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER game_rounds_set_word_pack_id
BEFORE INSERT OR UPDATE OF game_id, word_pack_id
ON game_rounds
FOR EACH ROW
EXECUTE FUNCTION set_game_round_word_pack_id();

ALTER TABLE round_scores
    ADD COLUMN game_id uuid;

UPDATE round_scores AS score
SET game_id = game_round.game_id
FROM game_rounds AS game_round
WHERE game_round.id = score.round_id;

ALTER TABLE round_scores
    ALTER COLUMN game_id SET NOT NULL,
    ADD CONSTRAINT round_scores_game_round_fk
        FOREIGN KEY (game_id, round_id)
        REFERENCES game_rounds (game_id, id)
        ON DELETE CASCADE,
    ADD CONSTRAINT round_scores_game_participant_fk
        FOREIGN KEY (game_id, participant_id)
        REFERENCES game_participants (game_id, id)
        ON DELETE CASCADE;

CREATE FUNCTION set_round_score_game_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT game_round.game_id
    INTO NEW.game_id
    FROM game_rounds AS game_round
    WHERE game_round.id = NEW.round_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'game round % does not exist', NEW.round_id
            USING ERRCODE = '23503';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER round_scores_set_game_id
BEFORE INSERT OR UPDATE OF round_id, game_id
ON round_scores
FOR EACH ROW
EXECUTE FUNCTION set_round_score_game_id();
