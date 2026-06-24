package data

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type GuestSessionsModel struct {
	DB *pgx.Conn
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
