ALTER TABLE users
ADD COLUMN role text NOT NULL DEFAULT 'normal',
ADD CONSTRAINT users_role_check CHECK (role IN ('normal', 'admin'));
