package data

import "github.com/jackc/pgx/v5"
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