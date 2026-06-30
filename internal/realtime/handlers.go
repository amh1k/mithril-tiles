package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

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
	r.messages = append(r.messages, msg)
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
	r.globalScores[player] = 0
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
	playerCount := len(r.players)
	r.mu.Unlock()

	r.scoresMu.Lock()
	delete(r.scores, player)
	delete(r.globalScores, player)
	r.scoresMu.Unlock()

	fmt.Printf("%s left (total: %d)\n", player.Principal.DisplayName(), playerCount)
	player.cancelConnection()
	announcement := fmt.Sprintf("*** %s left the room ***\n", player.Principal.DisplayName())
	r.handleBroadcast(announcement)
}

func (r *Room) sendHistory(player *Player, count int) {
	r.messageMu.Lock()
	defer r.messageMu.Unlock()
	start := len(r.messages) - count
	if start < 0 {
		start = 0
	}
	historyMsg := "Recent messages:\n"
	for i := start; i < len(r.messages); i++ {
		msg := r.messages[i]
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
		fmt.Println("Error happend : (")
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

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
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
	r.mu.Unlock()
	// close(r.done)
	r.broadcast <- fmt.Sprintf("Round%d has ended", r.currentRoundNo)
	timer := time.NewTimer(10 * time.Second)
	if r.currentRoundNo == 3 {
		select {
		case r.endGame <- struct{}{}:
			return
		case <-r.done:
			return

		}

	}
	r.RoundState = RoundStateIdle // cooldown after a round ends
	select {
	case <-timer.C:
		r.startRound()
	case <-r.done:
		return
	}
}

func (r *Room) startRound() {
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

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
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
	r.broadcast <- fmt.Sprintf("Round%d has started", r.currentRoundNo)

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
	case r.gameState == GameStateStarted:
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
		r.gameState = GameStateIdle
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
	r.currentRoundNo = result.Round.RoundNumber
	r.currentDrawer = completion.drawer
	r.currentWord = result.Word
	r.startTime = result.Round.StartedAt
	r.mu.Unlock()

	r.handleBroadcast(fmt.Sprintf("Round%d has started", result.Round.RoundNumber))
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
		return
	}
	r.scores[player]++
	r.globalScores[player]++
	r.correctGuesses++
}
func (r *Room) handleEndGame() {

	// we have to cleanup the room
	r.scoresMu.Lock()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	scores := make([]PlayerFinalScore, 0)
	for player, points := range r.globalScores {
		scores = append(scores, PlayerFinalScore{
			Principal: player.Principal,
			Points:    points,
		})
	}
	r.scoresMu.Unlock()
	defer cancel()
	req := GameEndRequest{
		RoomCode: r.roomCode,
		Scores:   scores,
	}
	_, err := r.gameLifecycle.EndGame(ctx, req)
	if err != nil {
		fmt.Printf("Error in persisting final scores so ending game not possible")
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

	L1:
		for {
			select {
			case <-ticker.C:
				_, err := r.gameLifecycle.EndGame(ctx, req)
				if err == nil {
					break L1

				}

			}

		}
	}

	r.broadcast <- "Game has ended"
	r.deleteRoom(r.roomCode)
	close(r.done)

}
