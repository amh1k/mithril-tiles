DROP TABLE IF EXISTS game_final_scores;
DROP TABLE IF EXISTS round_scores;
DROP TABLE IF EXISTS game_rounds;

ALTER TABLE games
    DROP CONSTRAINT IF EXISTS games_host_participant_fk;

DROP TABLE IF EXISTS game_participants;
DROP TABLE IF EXISTS games;
