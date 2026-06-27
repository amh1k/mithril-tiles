package data

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
	"mithrilTiles.abdulmoiz.net/internal/validator"
)

type UserModel struct {
	DB *pgx.Conn
}

var (
	ErrDuplicateEmail  = errors.New("duplicate email")
	ErrDuplicateHandle = errors.New("duplicate handle")
)

type User struct {
	ID            uuid.UUID `json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	DisplayName   string    `json:"display_name"`
	AccountStatus string    `json:"account_status"`
	Handle        string    `json:"handle"`
	Email         string    `json:"email"`
	Password      Password  `json:"-"`
	Activated     bool      `json:"activated"`
	AvatarURL     string    `json:"avatar_url"`
}
type Password struct {
	Plaintext *string
	Hash      []byte
}


func (p *Password) Set(plaintextpassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plaintextpassword), 12)
	if err != nil {
		return err
	}
	p.Plaintext = &plaintextpassword
	p.Hash = hash
	return nil
}
func (p *Password) Matches(plaintextPassword string) (bool, error) {
	err := bcrypt.CompareHashAndPassword(p.Hash, []byte(plaintextPassword))
	if err != nil {
		switch {
		case errors.Is(err, bcrypt.ErrMismatchedHashAndPassword):
			return false, nil
		default:
			return false, err
		}
	}
	return true, nil
}
func ValidateEmail(v *validator.Validator, email string) {
	v.Check(email != "", "email", "must be provided")
	v.Check(validator.Matches(email, validator.EmailRX), "email", "must be a valid email address")
}
func ValidatePasswordPlaintext(v *validator.Validator, password string) {
	v.Check(password != "", "password", "must be provided")
	v.Check(len(password) >= 8, "password", "must be at least 8 bytes long")
	v.Check(len(password) <= 72, "password", "must not be more than 72 bytes long")
}
func ValidateDisplayName(v *validator.Validator, displayName string) {
	v.Check(displayName != "", "displayName", "must be provided")
	v.Check(len(displayName) >= 3, "displayName", "must be atleast 3 bytes long")
	v.Check(len(displayName) <= 60, "displayName", "must not be more than 60 bytes long")
}
func Validatehandle(v *validator.Validator, handle string) {
	v.Check(handle != "", "handle", "must be provided")
	v.Check(len(handle) >= 3, "handle", "must be atleast 3 bytes long")
	v.Check(len(handle) <= 60, "handle", "must not be more than 60 bytes long")
}

func (m UserModel) Insert(user *User) error {
	query := `
	INSERT INTO users (display_name, handle, email, password, avatar_url)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING id, created_at, updated_at`
	args := []any{user.DisplayName, user.Handle, user.Email, user.Password.Hash, user.AvatarURL}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := m.DB.QueryRow(ctx, query, args...).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		switch {
		case err.Error() == `pq: duplicate key value violates unique constraint users_email_key`:

			return ErrDuplicateEmail
		default:
			fmt.Println(err)
			return err
		}
	}
	return nil
}

func (m UserModel) Delete(id uuid.UUID) error {
	query := `
	DELETE FROM users
	WHERE id = $1`
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := m.DB.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	rowsAffected := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrRecordNotFound
	}
	return nil

}

func (m UserModel) GetByEmail(email string) (*User, error) {
	query := `
	SELECT id, created_at, account_status, avatar_url,display_name, email, password, handle,updated_at
	FROM users
	WHERE email = $1`
	var user User
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := m.DB.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.CreatedAt,
		&user.AccountStatus,
		&user.AvatarURL,
		&user.DisplayName,
		&user.Email,
		&user.Password.Hash,
		&user.Handle,
		&user.UpdatedAt,
	)
	if err != nil {
		switch {

		case errors.Is(err, pgx.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}

	}
	return &user, nil
}

func (m UserModel) Get(id uuid.UUID) (*User, error) {
	query := `
	SELECT id, created_at, account_status, avatar_url,display_name, email, password, handle,updated_at
	FROM users
	WHERE id = $1`
	var user User
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := m.DB.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.CreatedAt,
		&user.AccountStatus,
		&user.AvatarURL,
		&user.DisplayName,
		&user.Email,
		&user.Password.Hash,
		&user.Handle,
		&user.UpdatedAt,
	)
	if err != nil {
		switch {

		case errors.Is(err, pgx.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}

	}
	return &user, nil

}

func (m UserModel) Update(user *User) error {
	query := `
	UPDATE users
	SET display_name = $1,
		handle = $2,
		email = $3,
		password = $4,
		avatar_url = $5,
		updated_at = now()
	WHERE id = $6
	RETURNING updated_at`

	args := []any{
		user.DisplayName,
		user.Handle,
		user.Email,
		user.Password.Hash,
		user.AvatarURL,
		user.ID,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRow(ctx, query, args...).Scan(&user.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return ErrRecordNotFound
		case errors.As(err, &pgErr) && pgErr.ConstraintName == "users_email_key":
			return ErrDuplicateEmail
		case errors.As(err, &pgErr) && pgErr.ConstraintName == "users_handle_key":
			return ErrDuplicateHandle
		default:
			return err
		}
	}

	return nil
}

func (m UserModel) UpdateAvatar(ctx context.Context, id uuid.UUID, avatarURL string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	user, err := m.Get(id)
	if err != nil {
		return err
	}
	user.AvatarURL = avatarURL
	if err := ctx.Err(); err != nil {
		return err
	}
	return m.Update(user)
}

func (m UserModel) GetForToken(tokenScope, tokenPlaintext string) (*User, error) {
	tokenHash := sha256.Sum256([]byte(tokenPlaintext))

	query := `
	SELECT id, created_at, account_status, avatar_url,display_name, email, password, handle,updated_at
	FROM users
	INNER JOIN tokens
	ON users.id = tokens.user_id
	WHERE tokens.hash = $1
	AND tokens.scope = $2
	AND tokens.expiry > $3`
	args := []any{tokenHash[:], tokenScope, time.Now()}

	var user User
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := m.DB.QueryRow(ctx, query, args...).Scan(
		&user.ID,
		&user.CreatedAt,
		&user.AccountStatus,
		&user.AvatarURL,
		&user.DisplayName,
		&user.Email,
		&user.Password.Hash,
		&user.Handle,
		&user.UpdatedAt,
	)
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}
	return &user, nil

}
