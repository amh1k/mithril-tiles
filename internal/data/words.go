package data

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"mithrilTiles.abdulmoiz.net/internal/validator"
)

var (
	ErrDuplicateWord    = errors.New("duplicate word in word pack")
	ErrWordPackNotFound = errors.New("word pack not found")
)

type WordModel struct {
	DB *pgx.Conn
}

type Word struct {
	ID         uuid.UUID `json:"id"`
	WordPackID uuid.UUID `json:"word_pack_id"`
	Text       string    `json:"text"`
	Difficulty string    `json:"difficulty"`
	CreatedAt  time.Time `json:"created_at"`
}

func (m WordModel) GetRandomForPackWithTx(
	ctx context.Context,
	tx pgx.Tx,
	wordPackID uuid.UUID,
) (*Word, error) {
	query := `
	SELECT id, word_pack_id, text, difficulty, created_at
	FROM words
	WHERE word_pack_id = $1
	ORDER BY random()
	LIMIT 1`

	word := &Word{}
	err := tx.QueryRow(ctx, query, wordPackID).Scan(
		&word.ID,
		&word.WordPackID,
		&word.Text,
		&word.Difficulty,
		&word.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRecordNotFound
	}
	if err != nil {
		return nil, err
	}

	return word, nil
}

func ValidateWord(v *validator.Validator, word *Word) {
	v.Check(word.WordPackID != uuid.Nil, "word_pack_id", "must be provided")
	v.Check(strings.TrimSpace(word.Text) != "", "text", "must be provided")
	v.Check(len(word.Text) <= 100, "text", "must not be more than 100 bytes long")
	v.Check(
		validator.PermittedValue(word.Difficulty, "easy", "medium", "hard"),
		"difficulty",
		"must be easy, medium, or hard",
	)
}

func (m WordModel) Insert(word *Word) error {
	query := `
	INSERT INTO words (word_pack_id, text, difficulty)
	VALUES ($1, $2, $3)
	RETURNING id, created_at`

	args := []any{
		word.WordPackID,
		word.Text,
		word.Difficulty,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRow(ctx, query, args...).Scan(
		&word.ID,
		&word.CreatedAt,
	)
	if err != nil {
		return mapWordError(err)
	}

	return nil
}

func (m WordModel) Get(id uuid.UUID) (*Word, error) {
	query := `
	SELECT id, word_pack_id, text, difficulty, created_at
	FROM words
	WHERE id = $1`

	var word Word

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRow(ctx, query, id).Scan(
		&word.ID,
		&word.WordPackID,
		&word.Text,
		&word.Difficulty,
		&word.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}

	return &word, nil
}

func (m WordModel) Update(word *Word) error {
	query := `
	UPDATE words
	SET text = $1,
		difficulty = $2
	WHERE id = $3
	RETURNING id`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRow(
		ctx,
		query,
		word.Text,
		word.Difficulty,
		word.ID,
	).Scan(&word.ID)
	if err != nil {
		return mapWordError(err)
	}

	return nil
}

func (m WordModel) Delete(id uuid.UUID) error {
	query := `
	DELETE FROM words
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

func mapWordError(err error) error {
	var pgErr *pgconn.PgError
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return ErrRecordNotFound
	case errors.As(err, &pgErr) && pgErr.ConstraintName == "words_pack_normalized_text_key":
		return ErrDuplicateWord
	case errors.As(err, &pgErr) && pgErr.ConstraintName == "words_word_pack_id_fkey":
		return ErrWordPackNotFound
	default:
		return err
	}
}
