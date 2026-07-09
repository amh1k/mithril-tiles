package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

func (r *Room) handleBroadcast(message string) {
	from := "system"
	actualContent := message
	r.messageMu.Lock()
	msg := Message{
		ID:      r.nextMessageID,
		From:    from,
		Content: actualContent,
		Channel: "global",
	}
	r.nextMessageID++
	r.messages.Add(msg)
	r.messageMu.Unlock()
	r.mu.Lock()
	players := make([]*Player, 0, len(r.players))
	for player := range r.players {
		players = append(players, player)
	}
	r.totalMessages++
	r.mu.Unlock()
	for _, player := range players {
		select {
		case player.Outgoing <- message:
			player.Mu.Lock()
			player.MessagesSent++
			player.Mu.Unlock()
		default:
			fmt.Printf("Skipped %s (channel full)\n", player.Principal.DisplayName())
		}
	}
}

func (r *Room) handleJoin(request joinRequest) {
	player := request.player
	r.mu.Lock()
	if len(r.players) >= MaxPlayers {
		r.mu.Unlock()
		request.result <- fmt.Errorf("room capacity filled to the brim")
		return
	}
	r.players[player] = true

	if len(r.players) == 1 {
		r.HostPlayer = player
	}
	r.mu.Unlock()
	r.scoresMu.Lock()
	key := newPrincipalScoreKey(player.Principal)
	if _, exists := r.globalScores[key]; !exists {
		r.globalScores[key] = PlayerFinalScore{Principal: player.Principal}
	}
	r.scoresMu.Unlock()
	player.markActive()
	r.sendHistory(player, 10)
	announcement := fmt.Sprintf("*** %s joined the room ***\n", player.Principal.DisplayName())
	r.handleBroadcast(announcement)
	request.result <- nil

}

func (r *Room) handleLeave(player *Player) {
	r.mu.Lock()
	if !r.players[player] {
		r.mu.Unlock()
		return
	}
	
	delete(r.players, player)
	if len(r.players) == 0 {
		r.HostPlayer = nil
	}else if r.HostPlayer == player {
    players := make([]*Player, 0, len(r.players))
    for remainingPlayer := range r.players {
        players = append(players, remainingPlayer)
    }
    r.HostPlayer = players[rand.Intn(len(players))]
	}
	playerCount := len(r.players)
	r.mu.Unlock()

	r.scoresMu.Lock()
	delete(r.scores, player)
	r.scoresMu.Unlock()

	fmt.Printf("%s left (total: %d)\n", player.Principal.DisplayName(), playerCount)
	player.cancelConnection()
	announcement := fmt.Sprintf("*** %s left the room ***\n", player.Principal.DisplayName())
	r.handleBroadcast(announcement)
	r.handleSnapshotRequest()
}

func (r *Room) sendHistory(player *Player, count int) {
	r.messageMu.Lock()
	defer r.messageMu.Unlock()
	messages := r.messages.Latest(count)
	historyMsg := "Recent messages:\n"
	for _, msg := range messages {
		historyMsg += fmt.Sprintf(" [%s]: %s\n", msg.From, msg.Content)
	}
	select {
	case player.Outgoing <- historyMsg:
	default:
	}

}
func (r *Room) sendUserList(player *Player) {
	r.mu.Lock()
	defer r.mu.Unlock()
	list := "Users online:\n"
	for p := range r.players {
		status := ""
		if p.isInactive(1 * time.Minute) {
			status = " (idle)"
		}
		list += fmt.Sprintf("  - %s%s\n", p.Principal.DisplayName(), status)
	}
	list += fmt.Sprintf("\nTotal messages: %d\n", r.totalMessages)
	list += fmt.Sprintf("Uptime: %s\n", time.Since(r.startTime).Round(time.Second))

	select {
	case player.Outgoing <- list:
	default:
	}

}

func (r *Room) handleDirectMessage(dm DirectMessage) {
	select {
	case dm.toClient.Outgoing <- dm.message:
		dm.toClient.Mu.Lock()
		dm.toClient.MessagesSent++
		dm.toClient.Mu.Unlock()
	default:
		fmt.Printf("Couldn't deliver DM to %s\n", dm.toClient.Principal.DisplayName())
	}
}

func (r *Room) sendDrawerWord(
	drawer *Player,
	word string,
	roundNumber int,
) {
	payload := struct {
		Type string `json:"type"`
		Data struct {
			Word        string `json:"word"`
			RoundNumber int    `json:"round_number"`
		} `json:"data"`
	}{
		Type: "drawer_word",
	}
	payload.Data.Word = word
	payload.Data.RoundNumber = roundNumber

	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	r.handleDirectMessage(DirectMessage{
		toClient: drawer,
		message:  string(data),
	})
}

func (r *Room) handleSnapshotRequest() {
	r.mu.Lock()
	recipients := make([]*Player, 0, len(r.players))
	for player := range r.players {
		recipients = append(recipients, player)
	}
	snapshot := RoomSnapshot{
		Version:    1,
		RoomCode:   r.roomCode,
		GameState:  r.gameState,
		RoundState: r.RoundState,
		Players:    make([]RoomPlayer, 0, len(r.players)),
		Canvas:     RoomCanvasSnapshot{},
		ServerTime: time.Now().UTC(),
	}
	if r.HostPlayer != nil {
		snapshot.HostID = r.HostPlayer.Principal.ID()
	}
	for player := range r.players {
		snapshot.Players = append(snapshot.Players, RoomPlayer{
			ID:          player.Principal.ID(),
			Type:        string(player.Principal.Type),
			DisplayName: player.Principal.DisplayName(),
			IsConnected: true,
		})
	}
	if r.gameID != uuid.Nil {
		snapshot.Game = &RoomGameSnapshot{
			ID:             r.gameID,
			WordPackID:     r.wordPackID,
			RoundNumber:    r.currentRoundNo,
			TotalRounds:    totalRounds,
			RoundStartedAt: r.startTime,
			RoundEndsAt:    r.startTime.Add(roundDuration),
		}
		if r.currentDrawer != nil {
			snapshot.Game.DrawerID = r.currentDrawer.Principal.ID()
		}
	}
	r.mu.Unlock()

	r.scoresMu.Lock()
	scores := make(map[uuid.UUID]int, len(r.scores))
	for player, score := range r.scores {
		scores[player.Principal.ID()] = score
	}
	r.scoresMu.Unlock()
	for i := range snapshot.Players {
		snapshot.Players[i].Score = scores[snapshot.Players[i].ID]
	}

	payload := struct {
		Type string       `json:"type"`
		Data RoomSnapshot `json:"data"`
	}{
		Type: "room_snapshot",
		Data: snapshot,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	for _, player := range recipients {
		r.handleDirectMessage(DirectMessage{
			toClient: player,
			message:  string(data),
		})
	}
}

func (r *Room) findPlayerByUsername(username string) (*Player, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for player := range r.players {
		if player.Principal.DisplayName() == username {
			return player, nil
		}

	}
	err := fmt.Errorf("Username not found")
	return nil, err

}

func (player *Player) markActive() {
	player.Mu.Lock()
	defer player.Mu.Unlock()
	player.LastActive = time.Now()
}
func (player *Player) isInactive(timeout time.Duration) bool {
	player.Mu.Lock()
	defer player.Mu.Unlock()
	return time.Since(player.LastActive) > timeout
}

func (r *Room) handleDrawStroke(stroke DrawStroke) {
	r.mu.Lock()
	currentDrawer := r.currentDrawer
	r.mu.Unlock()

	if currentDrawer == nil {
		return
	}
	if currentDrawer.Principal.DisplayName() != stroke.From {
		fmt.Println(currentDrawer.Principal.DisplayName())
		fmt.Println(stroke.From)
		return
	}
	r.broadcastStroke(stroke)
}

func (r *Room) broadcastStroke(stroke DrawStroke) {
	payload := struct {
		Type string     `json:"type"`
		Data DrawStroke `json:"data"`
	}{
		Type: "draw_stroke",
		Data: stroke,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	r.mu.Lock()

	players := make([]*Player, 0, len(r.players))
	for p := range r.players {
		players = append(players, p)

	}
	r.mu.Unlock()
	for _, player := range players {
		select {
		case player.Outgoing <- string(data):
		default:

		}
	}

}

func (r *Room) canJoin() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.players) >= 5 {
		return false
	}

	return true

}
func (r *Room) CanStart() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.players) <= 1 {
		return false
	}
	return true
}

func (r *Room) endRound() {
	r.scoresMu.Lock()
	scores := make([]PlayerRoundScore, 0, len(r.scores))
	for player, points := range r.scores {
		scores = append(scores, PlayerRoundScore{
			Principal: player.Principal,
			Points:    points,
		})
	}
	r.scoresMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err := r.gameLifecycle.EndRound(ctx, RoundEndRequest{
		RoomCode: r.roomCode,
		EndedAt:  time.Now(),
		Scores:   scores,
	})
	if err != nil {
		fmt.Printf("failed to end round in room %s: %v\n", r.roomCode, err)
		return
	}
	r.mu.Lock()
	r.currentWord = ""
	r.RoundState = RoundStateIdle
	r.mu.Unlock()
	// close(r.done)
	r.broadcast <- fmt.Sprintf("Round%d has ended", r.currentRoundNo)
	r.handleSnapshotRequest()
	timer := time.NewTimer(2 * time.Second)
	if r.currentRoundNo == totalRounds {
		select {
		case r.endGame <- struct{}{}:
			return
		case <-r.done:
			return

		}

	}
	select {
	case <-timer.C:
		r.startRound()
	case <-r.done:
		return
	}
}

func (r *Room) startRound() {
	fmt.Println("Start round called")
	r.mu.Lock()
	if r.gameState != GameStateStarted || len(r.players) < 2 {
		r.mu.Unlock()
		return
	}
	roundNumber := r.currentRoundNo + 1
	players := make([]*Player, 0, len(r.players))
	for player := range r.players {
		players = append(players, player)
	}
	drawer := players[rand.Intn(len(players))]
	r.mu.Unlock()
	participants := make([]data.Principal, 0, len(players))
	for _, player := range players {
		participants = append(participants, player.Principal)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	result, err := r.gameLifecycle.StartRound(ctx, RoundStartRequest{
		RoomCode:        r.roomCode,
		RoundNumber:     roundNumber,
		Drawer:          drawer.Principal,
		Participants:    participants,
		DurationSeconds: int(roundDuration / time.Second),
	})
	if err != nil {
		fmt.Printf("failed to start round in room %s: %v\n", r.roomCode, err)
		return
	}
	r.scoresMu.Lock()
	r.scores = make(map[*Player]int, len(players))
	for _, player := range players {
		r.scores[player] = 0
	}
	r.correctGuesses = 0
	r.scoresMu.Unlock()

	r.mu.Lock()
	r.currentRoundNo = roundNumber
	r.currentDrawer = drawer
	r.currentWord = result.Word
	r.startTime = result.StartedAt
	r.RoundState = RoundStateStarted
	r.mu.Unlock()
	r.sendDrawerWord(drawer, result.Word, roundNumber)
	r.broadcast <- fmt.Sprintf("Round%d has started", r.currentRoundNo)
	r.handleSnapshotRequest()

	time.AfterFunc(roundDuration, func() {
		select {
		case r.roundInfo <- "end round":
		case <-r.done:
			return
		default:
		}
	})
}

func (r *Room) handleStartGame(command gameStartCommand) {
	r.mu.Lock()
	var err error
	switch {
	case r.gameState == GameStateStarting:
		err = ErrGameStartInProgress
	case r.gameState != GameStateIdle && r.gameState != GameStateCompleted:
		fmt.Println(r.gameState)
		err = ErrGameAlreadyStarted
	case len(r.players) < 2:
		err = ErrNotEnoughPlayers
	case r.HostPlayer == nil || r.HostPlayer.Principal.ID() != command.request.RequestedBy:
		err = ErrOnlyHostCanStart
	}
	if err != nil {
		r.mu.Unlock()
		command.result <- GameStartResult{Err: err}
		return
	}

	r.gameState = GameStateStarting
	players := make([]*Player, 0, len(r.players))
	for player := range r.players {
		players = append(players, player)
	}
	host := r.HostPlayer
	drawer := players[rand.Intn(len(players))]
	r.mu.Unlock()
	r.handleSnapshotRequest()

	participants := make([]data.Principal, 0, len(players))
	for _, player := range players {
		participants = append(participants, player.Principal)
	}

	go func() {
		result, err := r.gameLifecycle.StartGame(
			command.ctx,
			GamePersistenceRequest{
				RoomCode:         r.roomCode,
				WordPackID:       command.request.WordPackID,
				SettingsSnapshot: command.request.SettingsSnapshot,
				Host:             host.Principal,
				Participants:     participants,
				Drawer:           drawer.Principal,
				DurationSeconds:  int(roundDuration / time.Second),
			},
		)
		completion := gameStartCompletion{
			command:     command,
			persistence: result,
			drawer:      drawer,
			players:     players,
			err:         err,
		}
		select {
		case r.gameStartDone <- completion:
		case <-r.done:
		}
	}()
}

func (r *Room) handleGameStartCompleted(completion gameStartCompletion) {
	if completion.err != nil {
		r.mu.Lock()
		r.gameState = GameStateStarted
		fmt.Println(completion.err)
		r.mu.Unlock()
		completion.command.result <- GameStartResult{Err: completion.err}
		return
	}

	result := completion.persistence
	r.scoresMu.Lock()
	r.scores = make(map[*Player]int, len(completion.players))
	for _, player := range completion.players {
		r.scores[player] = 0
	}
	r.correctGuesses = 0
	r.scoresMu.Unlock()

	r.mu.Lock()
	r.gameState = GameStateStarted
	r.gameID = result.Game.ID
	r.wordPackID = result.Game.WordPackID
	r.currentRoundNo = result.Round.RoundNumber
	r.currentDrawer = completion.drawer
	r.currentWord = result.Word
	r.startTime = result.Round.StartedAt
	r.RoundState = RoundStateStarted
	r.mu.Unlock()

	r.sendDrawerWord(completion.drawer, result.Word, result.Round.RoundNumber)
	r.handleBroadcast(fmt.Sprintf("Round%d has started", result.Round.RoundNumber))
	r.handleSnapshotRequest()

	time.AfterFunc(roundDuration, func() {
		select {
		case r.roundInfo <- "end round":
		case <-r.done:
		default:
		}
	})

	completion.command.result <- GameStartResult{
		Game:         result.Game,
		Participants: result.Participants,
		Round:        result.Round,
	}
}

func (r *Room) handleCorrectGuess(player *Player) {

	r.scoresMu.Lock()
	defer r.scoresMu.Unlock()
	if _, eligible := r.scores[player]; !eligible {
		return
	}
	if r.scores[player] == 1 {
		select {
		case  player.Outgoing <- "You have already guessed brother":
	default:
	}
		return
	}
	select {
	case  player.Outgoing <- "Correct Guess! Congrats":
	default:
	}
	
	r.scores[player]++
	key := newPrincipalScoreKey(player.Principal)
	finalScore := r.globalScores[key]
	finalScore.Principal = player.Principal
	finalScore.Points++
	r.globalScores[key] = finalScore
	r.correctGuesses++
}
func (r *Room) handleEndGame() {
	if !r.beginEndGame() {
		return
	}

	r.mu.Lock()
	gameID := r.gameID
	r.mu.Unlock()
	request := GameEndRequest{
		GameID:   gameID,
		RoomCode: r.roomCode,
		Scores:   r.finalScoreSnapshot(),
	}

	_, err := r.persistEndGame(request)
	if err != nil {
		if errors.Is(err, ErrRoomClosed) {
			return
		}
		r.setGameState(GameStateEndFailed)
		r.handleSnapshotRequest()
		slog.Error(
			"game completion failed",
			"room_code", r.roomCode,
			"game_id", gameID,
			"error", err,
		)
		select {
		case r.broadcast <- "Game completion failed. The room has been frozen for recovery.":
		case <-r.done:
		}
		return
	}

	r.setGameState(GameStateCompleted)
	r.handleSnapshotRequest()
	select {
	case r.broadcast <- "Game has ended":
	case <-r.done:
		return
	}
	timer := time.NewTimer(60 * time.Second)
	select {
	case <- timer.C:
		if r.deleteRoom != nil {
		r.deleteRoom(r.roomCode)
		}
		r.close()
	}

	
}

func (r *Room) persistEndGame(request GameEndRequest) (*GameEndResult, error) {
	policy := r.endGameRetry.normalized()
	var lastErr error
	for attempt := 1; attempt <= policy.MaxAttempts; attempt++ {
		select {
		case <-r.done:
			return nil, ErrRoomClosed
		default:
		}

		attemptCtx, cancel := context.WithTimeout(context.Background(), policy.AttemptTimeout)
		go func() {
			select {
			case <-r.done:
				cancel()
			case <-attemptCtx.Done():
			}
		}()
		result, err := r.gameLifecycle.EndGame(attemptCtx, request)
		cancel()
		if err == nil {
			if attempt > 1 {
				slog.Info(
					"game completion recovered",
					"room_code", request.RoomCode,
					"game_id", request.GameID,
					"attempt", attempt,
				)
			}
			return result, nil
		}
		select {
		case <-r.done:
			return nil, ErrRoomClosed
		default:
		}

		lastErr = err
		retryable := !errors.Is(err, ErrGameEndNotRetryable)
		slog.Warn(
			"game completion attempt failed",
			"room_code", request.RoomCode,
			"game_id", request.GameID,
			"attempt", attempt,
			"max_attempts", policy.MaxAttempts,
			"retryable", retryable,
			"error", err,
		)
		if !retryable {
			return nil, err
		}
		if attempt == policy.MaxAttempts {
			break
		}

		timer := time.NewTimer(policy.backoffAfter(attempt))
		select {
		case <-timer.C:
		case <-r.done:
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			return nil, ErrRoomClosed
		}
	}

	return nil, fmt.Errorf(
		"%w after %d attempts: %w",
		ErrGameEndRetriesExhausted,
		policy.MaxAttempts,
		lastErr,
	)
}

func (r *Room) finalScoreSnapshot() []PlayerFinalScore {
	r.scoresMu.Lock()
	defer r.scoresMu.Unlock()

	scores := make([]PlayerFinalScore, 0, len(r.globalScores))
	for _, score := range r.globalScores {
		scores = append(scores, score)
	}
	return scores
}

func (r *Room) beginEndGame() bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.gameState != GameStateStarted {
		return false
	}

	r.gameState = GameStateEnding
	r.RoundState = RoundStateIdle
	return true
}

func (r *Room) setGameState(state GameState) {
	r.mu.Lock()
	r.gameState = state
	r.mu.Unlock()
}

func (p endGameRetryPolicy) normalized() endGameRetryPolicy {
	if p.MaxAttempts <= 0 {
		p.MaxAttempts = defaultEndGameRetryPolicy.MaxAttempts
	}
	if p.AttemptTimeout <= 0 {
		p.AttemptTimeout = defaultEndGameRetryPolicy.AttemptTimeout
	}
	if p.InitialBackoff <= 0 {
		p.InitialBackoff = defaultEndGameRetryPolicy.InitialBackoff
	}
	if p.MaxBackoff <= 0 {
		p.MaxBackoff = defaultEndGameRetryPolicy.MaxBackoff
	}
	if p.MaxBackoff < p.InitialBackoff {
		p.MaxBackoff = p.InitialBackoff
	}
	return p
}

func (p endGameRetryPolicy) backoffAfter(failedAttempt int) time.Duration {
	delay := p.InitialBackoff
	for i := 1; i < failedAttempt && delay < p.MaxBackoff; i++ {
		delay *= 2
		if delay > p.MaxBackoff {
			return p.MaxBackoff
		}
	}
	return delay
}
