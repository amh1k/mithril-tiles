package data

import (
	"context"
	"crypto/sha256"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type GuestSessionsModel struct {
	DB *pgxpool.Pool
}

type GuestSession struct {
	ID          uuid.UUID `json:"id"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

func (m *GuestSessionsModel) Insert(guestSession *GuestSession) (*GuestSession, error) {
	query := `
	INSERT INTO guest_sessions (display_name)
	VALUES ($1)
	RETURNING id, display_name, created_at`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRow(ctx, query, guestSession.DisplayName).Scan(
		&guestSession.ID,
		&guestSession.DisplayName,
		&guestSession.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return guestSession, nil
}

func (m *GuestSessionsModel) GetForToken(tokenScope, tokenPlaintext string) (*GuestSession, error) {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))
	query := `
	SELECT guest_sessions.id, guest_sessions.display_name, guest_sessions.created_at
	FROM guest_sessions
	INNER JOIN tokens
	ON guest_sessions.id = tokens.guest_session_id
	WHERE tokens.hash = $1
	AND tokens.scope = $2
	AND tokens.expiry > $3`
	args := []any{tokenHash[:], tokenScope, time.Now()}
	var guestSession GuestSession
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := m.DB.QueryRow(ctx, query, args...).Scan(
		&guestSession.ID,
		&guestSession.DisplayName,
		&guestSession.CreatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}
	return &guestSession, nil

}
