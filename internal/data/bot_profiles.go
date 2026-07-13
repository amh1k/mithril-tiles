package data

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)
var (
	ErrDuplicateBotProfileName = errors.New("duplicate bot profile name")
)
type BotProfile struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Difficulty    string    `json:"difficulty"`
	BehaviorStyle string    `json:"behavior_style"`
	AvatarURL     *string   `json:"avatar_url,omitempty"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type BotProfileModel struct {
	DB *pgxpool.Pool
}

func (m *BotProfileModel) Get(id uuid.UUID) (*BotProfile, error) {
	query := `
	SELECT id, name, difficulty, behavior_style, avatar_url, is_active, created_at, updated_at
	FROM bot_profiles
	WHERE id = $1`

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	var botProfile BotProfile
	err := m.DB.QueryRow(ctx, query, id).Scan(
		&botProfile.ID,
		&botProfile.Name,
		&botProfile.Difficulty,
		&botProfile.BehaviorStyle,
		&botProfile.AvatarURL,
		&botProfile.IsActive,
		&botProfile.CreatedAt,
		&botProfile.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}

	return &botProfile, nil
}

func (m *BotProfileModel) GetActive(id uuid.UUID) (*BotProfile, error) {
	query := `
	SELECT id, name, difficulty, behavior_style, avatar_url, is_active, created_at, updated_at
	FROM bot_profiles
	WHERE id = $1
		AND is_active = true`

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	var botProfile BotProfile
	err := m.DB.QueryRow(ctx, query, id).Scan(
		&botProfile.ID,
		&botProfile.Name,
		&botProfile.Difficulty,
		&botProfile.BehaviorStyle,
		&botProfile.AvatarURL,
		&botProfile.IsActive,
		&botProfile.CreatedAt,
		&botProfile.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}

	return &botProfile, nil
}

func (m *BotProfileModel) ListActive() ([]*BotProfile, error) {
	query := `
	SELECT id, name, difficulty, behavior_style, avatar_url, is_active, created_at, updated_at
	FROM bot_profiles
	WHERE is_active = true
	ORDER BY name ASC`

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	rows, err := m.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	botProfiles := []*BotProfile{}
	for rows.Next() {
		var botProfile BotProfile
		err := rows.Scan(
			&botProfile.ID,
			&botProfile.Name,
			&botProfile.Difficulty,
			&botProfile.BehaviorStyle,
			&botProfile.AvatarURL,
			&botProfile.IsActive,
			&botProfile.CreatedAt,
			&botProfile.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		botProfiles = append(botProfiles, &botProfile)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return botProfiles, nil
}

func (m *BotProfileModel) Insert(botProfile *BotProfile) error {
	query := `
	INSERT INTO bot_profiles (name, difficulty, behavior_style, avatar_url, is_active)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING id, created_at, updated_at`

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	err := m.DB.QueryRow(
		ctx,
		query,
		botProfile.Name,
		botProfile.Difficulty,
		botProfile.BehaviorStyle,
		botProfile.AvatarURL,
		botProfile.IsActive,
	).Scan(
		&botProfile.ID,
		&botProfile.CreatedAt,
		&botProfile.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		switch {
		case errors.As(err, &pgErr) && pgErr.ConstraintName == "bot_profiles_name_key":
			return ErrDuplicateBotProfileName
		default:
			return err
		}
	}

	return nil
}

func (m *BotProfileModel) Update(botProfile *BotProfile) error {
	query := `
	UPDATE bot_profiles
	SET name = $1,
		difficulty = $2,
		behavior_style = $3,
		avatar_url = $4,
		is_active = $5,
		updated_at = now()
	WHERE id = $6
	RETURNING updated_at`

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	err := m.DB.QueryRow(
		ctx,
		query,
		botProfile.Name,
		botProfile.Difficulty,
		botProfile.BehaviorStyle,
		botProfile.AvatarURL,
		botProfile.IsActive,
		botProfile.ID,
	).Scan(&botProfile.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return ErrRecordNotFound
		case errors.As(err, &pgErr) && pgErr.ConstraintName == "bot_profiles_name_key":
			return ErrDuplicateBotProfileName
		default:
			return err
		}
	}

	return nil
}

func (m *BotProfileModel) Delete(id uuid.UUID) error {
	query := `
	DELETE FROM bot_profiles
	WHERE id = $1`

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	res, err := m.DB.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrRecordNotFound
	}

	return nil
}
