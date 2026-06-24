package data

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"mithrilTiles.abdulmoiz.net/internal/validator"
)

var (
	ErrDuplicateWordPackSlug = errors.New("duplicate word pack slug")
	wordPackSlugRX           = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
)

type WordPackModel struct {
	DB *pgx.Conn
}

type WordPack struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func ValidateWordPack(v *validator.Validator, wordPack *WordPack) {
	v.Check(strings.TrimSpace(wordPack.Name) != "", "name", "must be provided")
	v.Check(len(wordPack.Name) <= 100, "name", "must not be more than 100 bytes long")

	v.Check(strings.TrimSpace(wordPack.Slug) != "", "slug", "must be provided")
	v.Check(len(wordPack.Slug) <= 100, "slug", "must not be more than 100 bytes long")
	v.Check(validator.Matches(wordPack.Slug, wordPackSlugRX), "slug", "must contain only lowercase letters, numbers, and single hyphens")

	v.Check(len(wordPack.Description) <= 500, "description", "must not be more than 500 bytes long")
}

func (m WordPackModel) Insert(wordPack *WordPack) error {
	query := `
	INSERT INTO word_packs (name, slug, description, is_active)
	VALUES ($1, $2, $3, $4)
	RETURNING id, created_at, updated_at`

	args := []any{
		wordPack.Name,
		wordPack.Slug,
		wordPack.Description,
		wordPack.IsActive,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRow(ctx, query, args...).Scan(
		&wordPack.ID,
		&wordPack.CreatedAt,
		&wordPack.UpdatedAt,
	)
	if err != nil {
		return mapWordPackError(err)
	}

	return nil
}

func (m WordPackModel) Get(id uuid.UUID) (*WordPack, error) {
	query := `
	SELECT id, name, slug, description, is_active, created_at, updated_at
	FROM word_packs
	WHERE id = $1`

	var wordPack WordPack

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRow(ctx, query, id).Scan(
		&wordPack.ID,
		&wordPack.Name,
		&wordPack.Slug,
		&wordPack.Description,
		&wordPack.IsActive,
		&wordPack.CreatedAt,
		&wordPack.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}

	return &wordPack, nil
}

func (m WordPackModel) Update(wordPack *WordPack) error {
	query := `
	UPDATE word_packs
	SET name = $1,
		slug = $2,
		description = $3,
		is_active = $4,
		updated_at = now()
	WHERE id = $5
	RETURNING updated_at`

	args := []any{
		wordPack.Name,
		wordPack.Slug,
		wordPack.Description,
		wordPack.IsActive,
		wordPack.ID,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRow(ctx, query, args...).Scan(&wordPack.UpdatedAt)
	if err != nil {
		return mapWordPackError(err)
	}

	return nil
}

func (m WordPackModel) Delete(id uuid.UUID) error {
	query := `
	DELETE FROM word_packs
	WHERE id = $1`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := m.DB.Exec(ctx, query, id)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrRecordNotFound
	}

	return nil
}

func mapWordPackError(err error) error {
	var pgErr *pgconn.PgError

	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return ErrRecordNotFound
	case errors.As(err, &pgErr) && pgErr.ConstraintName == "word_packs_slug_key":
		return ErrDuplicateWordPackSlug
	default:
		return err
	}
}
