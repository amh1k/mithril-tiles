package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
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

func (s *gameLifecycleService) EndGame(
	ctx context.Context,
	request realtime.GameEndRequest,
) (*realtime.GameEndResult, error) {
	if request.GameID == uuid.Nil {
		return nil, nonRetryableGameEndError("game ID is required")
	}
	if request.RoomCode == "" {
		return nil, nonRetryableGameEndError("room code is required")
	}
	if len(request.Scores) == 0 {
		return nil, nonRetryableGameEndError("at least one final score is required")
	}
	scores := append([]realtime.PlayerFinalScore(nil), request.Scores...)
	seenPrincipals := make(map[string]struct{}, len(scores))
	for i := range scores {
		principal := scores[i].Principal
		if principal.ID() == uuid.Nil {
			return nil, nonRetryableGameEndError(
				"final score %d has an invalid principal",
				i,
			)
		}
		key := fmt.Sprintf("%s:%s", principal.Type, principal.ID())
		if _, exists := seenPrincipals[key]; exists {
			return nil, nonRetryableGameEndError(
				"duplicate final score for principal %s",
				key,
			)
		}
		seenPrincipals[key] = struct{}{}
	}

	sort.SliceStable(scores, func(i, j int) bool {
		if scores[i].Points != scores[j].Points {
			return scores[i].Points > scores[j].Points
		}
		left := fmt.Sprintf("%s:%s", scores[i].Principal.Type, scores[i].Principal.ID())
		right := fmt.Sprintf("%s:%s", scores[j].Principal.Type, scores[j].Principal.ID())
		return left < right
	})

	tx, err := s.models.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin game-end transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	game, err := s.models.Games.GetByIDForUpdate(ctx, tx, request.GameID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			return nil, nonRetryableGameEndError("game %s was not found", request.GameID)
		}
		return nil, classifyGameEndPersistenceError("get game for update", err)
	}
	if game.RoomCode != request.RoomCode {
		return nil, nonRetryableGameEndError(
			"game does not belong to room %q",
			request.RoomCode,
		)
	}
	if game.Status == "completed" {
		finalScores, err := s.models.GameFinalScores.GetAllForGameWithTx(ctx, tx, game.ID)
		if err != nil {
			return nil, classifyGameEndPersistenceError(
				"get completed game final scores",
				err,
			)
		}
		if len(finalScores) == 0 {
			return nil, nonRetryableGameEndError(
				"completed game %s has no final scores",
				game.ID,
			)
		}
		return &realtime.GameEndResult{
			GameID:      game.ID,
			FinalScores: finalScores,
		}, nil
	}
	if game.Status != "started" {
		return nil, nonRetryableGameEndError(
			"cannot complete game in status %q",
			game.Status,
		)
	}

	finalScores := make([]*data.GameFinalScore, 0, len(scores))
	for i := range scores {
		score := &scores[i]
		participantID, err := s.models.GameParticipants.GetIDForPrincipal(
			ctx,
			tx,
			game.ID,
			&score.Principal,
		)
		if err != nil {
			if errors.Is(err, data.ErrRecordNotFound) {
				return nil, nonRetryableGameEndError(
					"final-score participant %s is not part of game %s",
					score.Principal.ID(),
					game.ID,
				)
			}
			return nil, classifyGameEndPersistenceError(
				"resolve final-score participant",
				err,
			)
		}

		finalScores = append(finalScores, &data.GameFinalScore{
			GameID:        game.ID,
			ParticipantID: participantID,
			FinalScore:    score.Points,
			FinalRank:     i + 1,
			IsWinner:      i == 0,
		})
	}

	finalScores, err = s.models.GameFinalScores.InsertManyWithTx(
		ctx,
		tx,
		finalScores,
	)
	if err != nil {
		return nil, classifyGameEndPersistenceError("insert game final scores", err)
	}

	endedAt := time.Now()
	game, err = s.models.Games.CompleteWithTx(ctx, tx, game.ID, endedAt)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			return nil, nonRetryableGameEndError(
				"game %s is no longer startable",
				game.ID,
			)
		}
		return nil, classifyGameEndPersistenceError("complete game", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit game-end transaction: %w", err)
	}

	return &realtime.GameEndResult{
		GameID:      game.ID,
		FinalScores: finalScores,
	}, nil
}

func nonRetryableGameEndError(format string, args ...any) error {
	return fmt.Errorf(
		"%w: %s",
		realtime.ErrGameEndNotRetryable,
		fmt.Sprintf(format, args...),
	)
}

func classifyGameEndPersistenceError(operation string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) &&
		(strings.HasPrefix(pgErr.Code, "22") ||
			strings.HasPrefix(pgErr.Code, "23") ||
			strings.HasPrefix(pgErr.Code, "42")) {
		return nonRetryableGameEndError("%s: %v", operation, err)
	}
	return fmt.Errorf("%s: %w", operation, err)
}
