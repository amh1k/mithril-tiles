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
	Users UserModel
	Tokens TokenModel

}


func NewModels(db *pgx.Conn)Models{
	return Models{
		UserModel{DB: db},
		TokenModel{DB: db},
	}
}