package data

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const DefaultWebSocketTicketTTL = 30 * time.Second

type WebSocketTicketModel struct {
	DB *pgxpool.Pool
}

type WebSocketTicket struct {
	Plaintext      string     `json:"ticket"`
	Hash           []byte     `json:"-"`
	UserID         *uuid.UUID `json:"-"`
	GuestSessionID *uuid.UUID `json:"-"`
	RoomCode       string     `json:"room_code"`
	ExpiresAt      time.Time  `json:"expires_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

func (m WebSocketTicketModel) Issue(
	ctx context.Context,
	principal *Principal,
	roomCode string,
	ttl time.Duration,
) (*WebSocketTicket, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if principal == nil || !principal.IsAuthenticated() {
		return nil, fmt.Errorf("authenticated principal is required")
	}
	if strings.TrimSpace(roomCode) == "" {
		return nil, fmt.Errorf("room code is required")
	}
	if ttl <= 0 {
		return nil, fmt.Errorf("ticket TTL must be positive")
	}

	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return nil, fmt.Errorf("generate websocket ticket: %w", err)
	}
	plaintext := base64.RawURLEncoding.EncodeToString(randomBytes)
	hash := sha256.Sum256([]byte(plaintext))
	ticket := &WebSocketTicket{
		Plaintext: plaintext,
		Hash:      hash[:],
		RoomCode:  roomCode,
		ExpiresAt: time.Now().Add(ttl),
	}

	var query string
	switch {
	case principal.IsUser():
		principalID := principal.ID()
		ticket.UserID = &principalID
		query = `
			INSERT INTO websocket_tickets (
				hash,
				user_id,
				room_code,
				expires_at
			)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (user_id, room_code)
				WHERE user_id IS NOT NULL
			DO UPDATE SET
				hash = EXCLUDED.hash,
				expires_at = EXCLUDED.expires_at,
				created_at = now()
			RETURNING created_at`
	case principal.IsGuest():
		principalID := principal.ID()
		ticket.GuestSessionID = &principalID
		query = `
			INSERT INTO websocket_tickets (
				hash,
				guest_session_id,
				room_code,
				expires_at
			)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (guest_session_id, room_code)
				WHERE guest_session_id IS NOT NULL
			DO UPDATE SET
				hash = EXCLUDED.hash,
				expires_at = EXCLUDED.expires_at,
				created_at = now()
			RETURNING created_at`
	default:
		return nil, fmt.Errorf("unsupported principal type %q", principal.Type)
	}

	err := m.DB.QueryRow(
		ctx,
		query,
		ticket.Hash,
		principal.ID(),
		ticket.RoomCode,
		ticket.ExpiresAt,
	).Scan(&ticket.CreatedAt)
	if err != nil {
		return nil, err
	}
	return ticket, nil
}

func (m WebSocketTicketModel) Consume(
	ctx context.Context,
	plaintext string,
	roomCode string,
) (*Principal, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if plaintext == "" || strings.TrimSpace(roomCode) == "" {
		return nil, ErrRecordNotFound
	}

	hash := sha256.Sum256([]byte(plaintext))
	tx, err := m.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var (
		userID         *uuid.UUID
		guestSessionID *uuid.UUID
	)
	err = tx.QueryRow(
		ctx,
		`
		DELETE FROM websocket_tickets
		WHERE hash = $1
			AND room_code = $2
			AND expires_at > now()
		RETURNING user_id, guest_session_id`,
		hash[:],
		roomCode,
	).Scan(&userID, &guestSessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRecordNotFound
	}
	if err != nil {
		return nil, err
	}

	var principal *Principal
	switch {
	case userID != nil:
		user := &User{}
		err = tx.QueryRow(
			ctx,
			`
			SELECT id, display_name, account_status
			FROM users
			WHERE id = $1
				AND account_status = 'active'`,
			*userID,
		).Scan(&user.ID, &user.DisplayName, &user.AccountStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			if commitErr := tx.Commit(ctx); commitErr != nil {
				return nil, commitErr
			}
			return nil, ErrRecordNotFound
		}
		if err != nil {
			return nil, err
		}
		principal = NewUserPrincipal(user)
	case guestSessionID != nil:
		guestSession := &GuestSession{}
		err = tx.QueryRow(
			ctx,
			`
			SELECT id, display_name, created_at
			FROM guest_sessions
			WHERE id = $1`,
			*guestSessionID,
		).Scan(
			&guestSession.ID,
			&guestSession.DisplayName,
			&guestSession.CreatedAt,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			if commitErr := tx.Commit(ctx); commitErr != nil {
				return nil, commitErr
			}
			return nil, ErrRecordNotFound
		}
		if err != nil {
			return nil, err
		}
		principal = NewGuestPrincipal(guestSession)
	default:
		return nil, fmt.Errorf("websocket ticket has no owner")
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return principal, nil
}
