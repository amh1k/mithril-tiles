package data

import (
	"errors"

	"github.com/jackc/pgx/v5"
)

var (
	ErrRecordNotFound = errors.New("record not found")
	ErrEditConflict   = errors.New("edit conflict")
)

type Models struct {
	Users         UserModel
	Tokens        TokenModel
	GuestSessions GuestSessionsModel
	WordPacks     WordPackModel
	Words         WordModel
	Games         GameModel
}

func NewModels(db *pgx.Conn) Models {
	return Models{
		Users:         UserModel{DB: db},
		Tokens:        TokenModel{DB: db},
		GuestSessions: GuestSessionsModel{DB: db},
		WordPacks:     WordPackModel{DB: db},
		Words:         WordModel{DB: db},
		Games:         GameModel{DB: db},
	}
}
