package data

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrRecordNotFound = errors.New("record not found")
	ErrEditConflict   = errors.New("edit conflict")
)

type Models struct {
	db               *pgxpool.Pool
	Users            UserModel
	Tokens           TokenModel
	GuestSessions    GuestSessionsModel
	WordPacks        WordPackModel
	Words            WordModel
	Games            GameModel
	GameParticipants GameParticipantModel
	GameRounds       GameRoundModel
	RoundScores      RoundScoreModel
	GameFinalScores  GameFinalScoreModel
	WebSocketTickets WebSocketTicketModel
}

func NewModels(db *pgxpool.Pool) Models {
	return Models{
		db:               db,
		Users:            UserModel{DB: db},
		Tokens:           TokenModel{DB: db},
		GuestSessions:    GuestSessionsModel{DB: db},
		WordPacks:        WordPackModel{DB: db},
		Words:            WordModel{DB: db},
		Games:            GameModel{DB: db},
		GameParticipants: GameParticipantModel{DB: db},
		GameRounds:       GameRoundModel{DB: db},
		RoundScores:      RoundScoreModel{DB: db},
		GameFinalScores:  GameFinalScoreModel{DB: db},
		WebSocketTickets: WebSocketTicketModel{DB: db},
	}
}

func (m Models) BeginTransaction(ctx context.Context) (pgx.Tx, error) {
	return m.db.Begin(ctx)
}
