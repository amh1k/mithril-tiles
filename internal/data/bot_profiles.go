package data

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)


type BotProfile struct {
    ID            uuid.UUID `json:"id"`
    Name          string    `json:"name"`
    Difficulty    string    `json:"difficulty"`
    BehaviorStyle string    `json:"behavior_style"`
    AvatarURL     *string   `json:"avatar_url,omitempty"`
    IsActive      bool      `json:"is_active"`
    CreatedAt     time.Time `json:"created_at"`
    UpdatedAt     time.Time `json:"updated_at"`
}

type BotProfileModel struct {
	DB pgx.Conn
}
// Get(id)`;
// - `GetActive(id)`;
// - `ListActive()`;

func(m *BotProfileModel)Get(id uuid.UUID)(*BotProfile, error) {
	query := ``
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()
	var botProfile BotProfile
	
	err := m.DB.QueryRow(ctx, query, id).Scan(

	)
	if err != nil {
		return nil, err

	}
	return &botProfile, nil
}

func(m *BotProfileModel)Insert(botProfile *BotProfile)(error) {
	query := ``
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()
	args := []any{botProfile.Name, botProfile.Difficulty, botProfile.BehaviorStyle, botProfile.AvatarURL}
	err := m.DB.QueryRow(ctx,query, args).Scan(&botProfile.ID, &botProfile.Name, )
	if err != nil {
		return err
	}
	return nil

}