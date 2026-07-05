DROP TRIGGER IF EXISTS round_scores_set_game_id ON round_scores;
DROP FUNCTION IF EXISTS set_round_score_game_id();

ALTER TABLE round_scores
    DROP CONSTRAINT IF EXISTS round_scores_game_participant_fk,
    DROP CONSTRAINT IF EXISTS round_scores_game_round_fk,
    DROP COLUMN IF EXISTS game_id;

DROP TRIGGER IF EXISTS game_rounds_set_word_pack_id ON game_rounds;
DROP FUNCTION IF EXISTS set_game_round_word_pack_id();

ALTER TABLE game_rounds
    DROP CONSTRAINT IF EXISTS game_rounds_word_pack_word_fk,
    DROP CONSTRAINT IF EXISTS game_rounds_game_word_pack_fk,
    DROP COLUMN IF EXISTS word_pack_id;

ALTER TABLE words
    DROP CONSTRAINT IF EXISTS words_word_pack_and_id_key;

ALTER TABLE games
    DROP CONSTRAINT IF EXISTS games_id_word_pack_key;

DROP INDEX IF EXISTS round_scores_round_participant_reason_key;
DROP INDEX IF EXISTS game_participants_one_bot_per_game_key;
DROP INDEX IF EXISTS game_participants_one_guest_per_game_key;
DROP INDEX IF EXISTS game_participants_one_user_per_game_key;
DROP INDEX IF EXISTS game_rounds_one_active_per_game_key;
