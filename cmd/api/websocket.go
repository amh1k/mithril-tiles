package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"github.com/julienschmidt/httprouter"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)

func (app *application) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomID := params.ByName("roomID")

	if roomID == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		app.logger.Error("websocket accept failed", "error", err)
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "connection closed")

	room, err := app.roomManager.GetOrCreateRoom(roomID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	ctx := r.Context()
	principal := app.contextGetPrincipal(r)
	realtime.HandlePlayer(conn, room, principal, ctx)
}

func (app *application) handleStartGame(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomCode := params.ByName("roomID")
	if roomCode == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}
	var input struct {
		WordPackID       uuid.UUID       `json:"word_pack_id"`
		SettingsSnapshot json.RawMessage `json:"settings_snapshot"`
	}
	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if input.WordPackID == uuid.Nil {
		app.badRequestResponse(w, r, errors.New("word_pack_id must be provided"))
		return
	}
	if len(input.SettingsSnapshot) == 0 {
		input.SettingsSnapshot = json.RawMessage(`{}`)
	}
	room, err := app.roomManager.GetOrCreateRoom(roomCode)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	hostPlayer, players := room.GameStartSnapshot()
	if hostPlayer == nil {
		app.badRequestResponse(w, r, errors.New("room has no host player"))
		return
	}

	principal := app.contextGetPrincipal(r)
	if principal.ID() != hostPlayer.Principal.ID() {
		app.errorResponse(w, r, http.StatusForbidden, "only the room host can start the game")
		return
	}
	if len(players) <= 1 {
		app.badRequestResponse(w, r, errors.New("cannot start a game with fewer than two players"))
		return
	}

	hostIsConnected := false
	for _, player := range players {
		if player == hostPlayer {
			hostIsConnected = true
			break
		}
	}
	if !hostIsConnected {
		app.badRequestResponse(w, r, errors.New("room host is not connected"))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	tx, err := app.models.BeginTransaction(ctx)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	defer tx.Rollback(ctx)

	startedAt := time.Now()
	hostParticipantID := uuid.New()
	game := &data.Game{
		ID:                uuid.New(),
		RoomCode:          roomCode,
		HostParticipantID: hostParticipantID,
		WordPackID:        input.WordPackID,
		Status:            "started",
		SettingsSnapshot:  input.SettingsSnapshot,
		StartedAt:         startedAt,
	}

	game, err = app.models.Games.InsertWithTx(ctx, tx, game)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	participants := make([]*data.GameParticipant, 0, len(players))
	for _, player := range players {
		participantID := uuid.New()
		isHost := player == hostPlayer
		if isHost {
			participantID = hostParticipantID
		}

		participant := &data.GameParticipant{
			ID:                  participantID,
			GameID:              game.ID,
			DisplayNameSnapshot: player.Principal.DisplayName(),
			IsHost:              isHost,
			JoinedAt:            startedAt,
		}

		participant, err = app.models.GameParticipants.InsertPrincipalWithTx(
			ctx,
			tx,
			participant,
			&player.Principal,
		)
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}

		participants = append(participants, participant)
	}

	err = tx.Commit(ctx)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	room.StartGame()

	err = app.writeJSON(w, http.StatusCreated, envelope{
		"game":              game,
		"game_participants": participants,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) handleRoundStart(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomCode := params.ByName("roomID")
	if roomCode == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}
	room, err := app.roomManager.GetOrCreateRoom(roomCode)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	if room.HostPlayer == nil {
		app.badRequestResponse(w, r, errors.New("room has no host player"))
		return
	}
	if !room.CanStart() {
		app.serverErrorResponse(w, r, fmt.Errorf("Cant play with 1 user only"))
	}
	var selectedWord struct {
		ID   uuid.UUID
		Text string
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	err = app.models.Words.DB.QueryRow(ctx, `
		SELECT id, text
		FROM words
		WHERE word_pack_id = $1
		ORDER BY random()
		LIMIT 1`,
		input.WordPackID,
	).Scan(&selectedWord.ID, &selectedWord.Text)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	startedAt := time.Now()
	gameRound := &data.GameRound{
		GameID:              game.ID,
		RoundNumber:         1,
		DrawerParticipantID: room.HostPlayer.Principal.ID(),
		WordID:              selectedWord.ID,
		WordTextSnapshot:    selectedWord.Text,
		Status:              "started",
		DurationSeconds:     60,
		StartedAt:           startedAt,
	}

	gameRound, err = app.models.GameRounds.Insert(gameRound)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	room.HandleRoundStart()
	err = app.writeJSON(w, http.StatusCreated, envelope{
		"game_round": gameRound,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) handleRoundEnd(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomCode := params.ByName("roomID")
	if roomCode == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}

	room, err := app.roomManager.GetOrCreateRoom(roomCode)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	if room.HostPlayer == nil {
		app.badRequestResponse(w, r, errors.New("room has no host player"))
		return
	}

	principal := app.contextGetPrincipal(r)
	if principal.ID() != room.HostPlayer.Principal.ID() {
		app.errorResponse(w, r, http.StatusForbidden, "only the room host can end a round")
		return
	}

	scores := room.GetScores()
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	tx, err := app.models.BeginTransaction(ctx)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	defer tx.Rollback(ctx)

	endedAt := time.Now()
	gameRound, err := app.models.GameRounds.CompleteActiveForRoom(
		ctx,
		tx,
		roomCode,
		endedAt,
	)
	if errors.Is(err, data.ErrRecordNotFound) {
		app.badRequestResponse(w, r, errors.New("room has no active round"))
		return
	}
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	roundScores := make([]*data.RoundScore, 0, len(scores))
	for player, score := range scores {
		participantID, err := app.models.GameParticipants.GetIDForPrincipal(
			ctx,
			tx,
			gameRound.GameID,
			&player.Principal,
		)
		if errors.Is(err, data.ErrRecordNotFound) {
			app.serverErrorResponse(w, r, fmt.Errorf(
				"player %s is not registered as a game participant",
				player.Principal.ID(),
			))
			return
		}
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}

		roundScore := &data.RoundScore{
			RoundID:       gameRound.ID,
			ParticipantID: participantID,
			PointsEarned:  score,
			ScoreReason:   "correct_guess",
			AwardedAt:     endedAt,
		}

		roundScore, err = app.models.RoundScores.InsertWithTx(ctx, tx, roundScore)
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}

		roundScores = append(roundScores, roundScore)
	}

	err = tx.Commit(ctx)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	room.HandleRoundEnd()

	err = app.writeJSON(w, http.StatusOK, envelope{
		"game_round":   gameRound,
		"round_scores": roundScores,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
