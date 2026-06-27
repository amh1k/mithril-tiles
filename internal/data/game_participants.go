package data

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type GameParticipantModel struct {
	DB *pgx.Conn
}

type GameParticipant struct {
	ID                  uuid.UUID  `json:"id"`
	GameID              uuid.UUID  `json:"game_id"`
	UserID              *uuid.UUID `json:"user_id,omitempty"`
	GuestSessionID      *uuid.UUID `json:"guest_session_id,omitempty"`
	BotProfileID        *uuid.UUID `json:"bot_profile_id,omitempty"`
	DisplayNameSnapshot string     `json:"display_name_snapshot"`
	ParticipantType     string     `json:"participant_type"`
	IsHost              bool       `json:"is_host"`
	JoinedAt            time.Time  `json:"joined_at"`
	LeftAt              *time.Time `json:"left_at"`
}

func (m *GameParticipantModel) InsertPrincipalWithTx(
	ctx context.Context,
	tx pgx.Tx,
	participant *GameParticipant,
	principal *Principal,
) (*GameParticipant, error) {
	switch {
	case principal.IsUser():
		principalID := principal.ID()
		participant.UserID = &principalID
		participant.ParticipantType = string(PrincipalUser)
	case principal.IsGuest():
		principalID := principal.ID()
		participant.GuestSessionID = &principalID
		participant.ParticipantType = string(PrincipalGuest)
	default:
		return nil, fmt.Errorf("unsupported principal type %q", principal.Type)
	}

	query := `
	INSERT INTO game_participants (
		id,
		game_id,
		user_id,
		guest_session_id,
		bot_profile_id,
		display_name_snapshot,
		participant_type,
		is_host,
		joined_at,
		left_at
	)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	RETURNING
		id,
		game_id,
		user_id,
		guest_session_id,
		bot_profile_id,
		display_name_snapshot,
		participant_type,
		is_host,
		joined_at,
		left_at`

	err := tx.QueryRow(
		ctx,
		query,
		participant.ID,
		participant.GameID,
		participant.UserID,
		participant.GuestSessionID,
		participant.BotProfileID,
		participant.DisplayNameSnapshot,
		participant.ParticipantType,
		participant.IsHost,
		participant.JoinedAt,
		participant.LeftAt,
	).Scan(
		&participant.ID,
		&participant.GameID,
		&participant.UserID,
		&participant.GuestSessionID,
		&participant.BotProfileID,
		&participant.DisplayNameSnapshot,
		&participant.ParticipantType,
		&participant.IsHost,
		&participant.JoinedAt,
		&participant.LeftAt,
	)
	if err != nil {
		return nil, err
	}

	return participant, nil
}

func (m *GameParticipantModel) GetIDForPrincipal(
	ctx context.Context,
	tx pgx.Tx,
	gameID uuid.UUID,
	principal *Principal,
) (uuid.UUID, error) {
	var query string

	switch {
	case principal.IsUser():
		query = `
			SELECT id
			FROM game_participants
			WHERE game_id = $1 AND user_id = $2`
	case principal.IsGuest():
		query = `
			SELECT id
			FROM game_participants
			WHERE game_id = $1 AND guest_session_id = $2`
	default:
		return uuid.Nil, fmt.Errorf("unsupported principal type %q", principal.Type)
	}

	var participantID uuid.UUID
	err := tx.QueryRow(ctx, query, gameID, principal.ID()).Scan(&participantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrRecordNotFound
	}
	if err != nil {
		return uuid.Nil, err
	}

	return participantID, nil
}
