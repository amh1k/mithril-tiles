CREATE UNIQUE INDEX games_one_active_per_room_key
    ON games (room_code)
    WHERE status = 'started';
