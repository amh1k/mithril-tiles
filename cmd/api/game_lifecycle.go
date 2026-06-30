package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)

type gameLifecycleService struct {
	models data.Models
}

func newGameLifecycleService(models data.Models) *gameLifecycleService {
	return &gameLifecycleService{models: models}
}

func (s *gameLifecycleService) StartGame(
	ctx context.Context,
	request realtime.GamePersistenceRequest,
) (*realtime.GamePersistenceResult, error) {
	if request.RoomCode == "" {
		return nil, fmt.Errorf("room code is required")
	}
	if request.WordPackID == uuid.Nil {
		return nil, fmt.Errorf("word pack is required")
	}
	if request.Host.ID() == uuid.Nil {
		return nil, fmt.Errorf("host is required")
	}
	if request.Drawer.ID() == uuid.Nil {
		return nil, fmt.Errorf("drawer is required")
	}
	if len(request.Participants) < 2 {
		return nil, fmt.Errorf("at least two participants are required")
	}
	if request.DurationSeconds <= 0 {
		return nil, fmt.Errorf("round duration must be positive")
	}
	if len(request.SettingsSnapshot) == 0 {
		request.SettingsSnapshot = json.RawMessage(`{}`)
	}

	tx, err := s.models.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin game-start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	word, err := s.models.Words.GetRandomForPackWithTx(
		ctx,
		tx,
		request.WordPackID,
	)
	if err != nil {
		return nil, fmt.Errorf("select first-round word: %w", err)
	}

	startedAt := time.Now()
	hostParticipantID := uuid.New()
	game := &data.Game{
		ID:                uuid.New(),
		RoomCode:          request.RoomCode,
		HostParticipantID: hostParticipantID,
		WordPackID:        request.WordPackID,
		Status:            "started",
		SettingsSnapshot:  request.SettingsSnapshot,
		StartedAt:         startedAt,
	}
	game, err = s.models.Games.InsertWithTx(ctx, tx, game)
	if err != nil {
		return nil, fmt.Errorf("insert game: %w", err)
	}

	participants := make([]*data.GameParticipant, 0, len(request.Participants))
	var drawerParticipantID uuid.UUID
	hostFound := false
	for i := range request.Participants {
		principal := &request.Participants[i]
		isHost := samePrincipal(*principal, request.Host)
		participantID := uuid.New()
		if isHost {
			participantID = hostParticipantID
			hostFound = true
		}
		if samePrincipal(*principal, request.Drawer) {
			drawerParticipantID = participantID
		}

		participant := &data.GameParticipant{
			ID:                  participantID,
			GameID:              game.ID,
			DisplayNameSnapshot: principal.DisplayName(),
			IsHost:              isHost,
			JoinedAt:            startedAt,
		}
		participant, err = s.models.GameParticipants.InsertPrincipalWithTx(
			ctx,
			tx,
			participant,
			principal,
		)
		if err != nil {
			return nil, fmt.Errorf("insert game participant: %w", err)
		}
		participants = append(participants, participant)
	}

	if !hostFound {
		return nil, fmt.Errorf("host is not present in participants")
	}
	if drawerParticipantID == uuid.Nil {
		return nil, fmt.Errorf("drawer is not present in participants")
	}

	gameRound := &data.GameRound{
		GameID:              game.ID,
		RoundNumber:         1,
		DrawerParticipantID: drawerParticipantID,
		WordID:              word.ID,
		WordTextSnapshot:    word.Text,
		Status:              "started",
		DurationSeconds:     request.DurationSeconds,
		StartedAt:           startedAt,
	}
	gameRound, err = s.models.GameRounds.InsertWithTx(ctx, tx, gameRound)
	if err != nil {
		return nil, fmt.Errorf("insert first game round: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit game-start transaction: %w", err)
	}

	return &realtime.GamePersistenceResult{
		Game:         game,
		Participants: participants,
		Round:        gameRound,
		Word:         word.Text,
	}, nil
}

func samePrincipal(a, b data.Principal) bool {
	return a.Type == b.Type && a.ID() != uuid.Nil && a.ID() == b.ID()
}

func (s *gameLifecycleService) StartRound(
	ctx context.Context,
	request realtime.RoundStartRequest,
) (*realtime.RoundStartResult, error) {
	tx, err := s.models.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin round-start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	game, err := s.models.Games.GetActiveForRoomWithTx(ctx, tx, request.RoomCode)
	if err != nil {
		return nil, fmt.Errorf("get active game: %w", err)
	}

	startedAt := time.Now()
	for i := range request.Participants {
		principal := &request.Participants[i]
		_, err = s.models.GameParticipants.GetIDForPrincipal(
			ctx,
			tx,
			game.ID,
			principal,
		)
		if err == nil {
			continue
		}
		if !errors.Is(err, data.ErrRecordNotFound) {
			return nil, fmt.Errorf("find game participant: %w", err)
		}

		participant := &data.GameParticipant{
			ID:                  uuid.New(),
			GameID:              game.ID,
			DisplayNameSnapshot: principal.DisplayName(),
			JoinedAt:            startedAt,
		}
		_, err = s.models.GameParticipants.InsertPrincipalWithTx(
			ctx,
			tx,
			participant,
			principal,
		)
		if err != nil {
			return nil, fmt.Errorf("insert game participant: %w", err)
		}
	}

	drawerParticipantID, err := s.models.GameParticipants.GetIDForPrincipal(
		ctx,
		tx,
		game.ID,
		&request.Drawer,
	)
	if err != nil {
		return nil, fmt.Errorf("resolve drawer participant: %w", err)
	}

	word, err := s.models.Words.GetRandomForPackWithTx(
		ctx,
		tx,
		game.WordPackID,
	)
	if err != nil {
		return nil, fmt.Errorf("select round word: %w", err)
	}

	gameRound := &data.GameRound{
		GameID:              game.ID,
		RoundNumber:         request.RoundNumber,
		DrawerParticipantID: drawerParticipantID,
		WordID:              word.ID,
		WordTextSnapshot:    word.Text,
		Status:              "started",
		DurationSeconds:     request.DurationSeconds,
		StartedAt:           startedAt,
	}
	_, err = s.models.GameRounds.InsertWithTx(ctx, tx, gameRound)
	if err != nil {
		return nil, fmt.Errorf("insert game round: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit round-start transaction: %w", err)
	}

	return &realtime.RoundStartResult{
		Word:      word.Text,
		StartedAt: startedAt,
	}, nil
}

func (s *gameLifecycleService) EndRound(
	ctx context.Context,
	request realtime.RoundEndRequest,
) error {
	tx, err := s.models.BeginTransaction(ctx)
	if err != nil {
		return fmt.Errorf("begin round-end transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	endedAt := request.EndedAt
	if endedAt.IsZero() {
		endedAt = time.Now()
	}

	gameRound, err := s.models.GameRounds.CompleteActiveForRoom(
		ctx,
		tx,
		request.RoomCode,
		endedAt,
	)
	if err != nil {
		return fmt.Errorf("complete active round: %w", err)
	}

	for i := range request.Scores {
		score := &request.Scores[i]
		participantID, err := s.models.GameParticipants.GetIDForPrincipal(
			ctx,
			tx,
			gameRound.GameID,
			&score.Principal,
		)
		if err != nil {
			return fmt.Errorf("resolve score participant: %w", err)
		}

		roundScore := &data.RoundScore{
			RoundID:       gameRound.ID,
			ParticipantID: participantID,
			PointsEarned:  score.Points,
			ScoreReason:   "correct_guess",
			AwardedAt:     endedAt,
		}
		_, err = s.models.RoundScores.InsertWithTx(ctx, tx, roundScore)
		if err != nil {
			return fmt.Errorf("insert round score: %w", err)
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit round-end transaction: %w", err)
	}

	return nil
}
