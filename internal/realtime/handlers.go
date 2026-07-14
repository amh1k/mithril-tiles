package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"strings"
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
		if player.Type == botPlayer {
			// logic here for sending data to the bot
			continue
		}
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

func (r *Room) broadcastRealtimeEvent(message string) {
	r.mu.Lock()
	players := make([]*Player, 0, len(r.players))
	for player := range r.players {
		players = append(players, player)
	}
	r.mu.Unlock()

	for _, player := range players {
		if player.Type == botPlayer {
			continue
		}
		select {
		case player.Outgoing <- message:
		default:
		}
	}
}

func (r *Room) handleJoin(request joinRequest) {
	player := request.player
	// if player.Conn == nil && player.Type == botPlayer {
	// 	return
	// }
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
	if request.player.Type != botPlayer {
		r.sendHistory(player, 10)
	}
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
	} else if r.HostPlayer == player {
		players := make([]*Player, 0, len(r.players))
		for remainingPlayer := range r.players {
			if remainingPlayer.Conn == nil && remainingPlayer.Type == botPlayer {
				continue
			}
			players = append(players, remainingPlayer)
		}
		if len(players) == 0 {
			r.HostPlayer = nil

		} else {
			r.HostPlayer = players[rand.Intn(len(players))]

		}

	}
	playerCount := len(r.players)
	r.mu.Unlock()

	r.scoresMu.Lock()
	delete(r.scores, player)
	r.scoresMu.Unlock()

	fmt.Printf("%s left (total: %d)\n", player.Principal.DisplayName(), playerCount)
	if player.Type != botPlayer {
		player.cancelConnection()
	}
	announcement := fmt.Sprintf("*** %s left the room ***\n", player.Principal.DisplayName())
	r.handleBroadcast(announcement)
	r.handleSnapshotRequest()
}

func (r *Room) sendHistory(player *Player, count int) {
	if player.Conn == nil && player.Type == botPlayer {
		return
	}
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
	if player.Conn == nil && player.Type == botPlayer {
		return
	}
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
	if dm.toClient.Type == botPlayer && dm.toClient.Conn == nil {
		// have to handle direct message to bot
	}
	select {
	case dm.toClient.Outgoing <- dm.message:
		dm.toClient.Mu.Lock()
		dm.toClient.MessagesSent++
		dm.toClient.Mu.Unlock()
	default:
		fmt.Printf("Couldn't deliver DM to %s\n", dm.toClient.Principal.DisplayName())
	}
}
func maskedWordhelper(word string, arr []int) string {
	mp := make(map[int]int)
	var builder strings.Builder
	for _, i := range arr {
		mp[i] = 1
	}
	for i := range len(word) {
		_, exists := mp[i]
		if exists {
			builder.WriteByte(word[i])

		} else {
			builder.WriteByte('_')
		}

	}
	return builder.String()

}

func (r *Room) sendGuesserWord(word string, roundNumber int, ctx context.Context) {
	payload := struct {
		Type string `json:"type"`
		Data struct {
			RoundNumber int    `json:"round_number"`
			Word        string `json:"word"`
		} `json:"data"`
	}{
		Type: "guesser_word",
	}
	wordLength := len(word)
	var arr []int
	for i := range wordLength {
		arr = append(arr, i)
	}
	rand.Shuffle(len(arr), func(i, j int) {
		arr[i], arr[j] = arr[j], arr[i]
	})
	timer1 := time.NewTimer(10 * time.Second)
	timer2 := time.NewTimer(30 * time.Second)
	timer3 := time.NewTimer(50 * time.Second)
	defer timer1.Stop()
	defer timer2.Stop()
	for {
		select {
		case <-timer1.C:
			tempArr := arr[:1]
			wordToSend := maskedWordhelper(word, tempArr)
			payload.Data.RoundNumber = roundNumber
			payload.Data.Word = wordToSend
			data, err := json.Marshal(payload)
			if err != nil {
				continue
			}
			r.broadcast <- string(data)
			r.publishMaskedWordToGuessers(wordToSend, roundNumber)

		case <-timer2.C:
			tempArr := arr[:3]
			wordToSend := maskedWordhelper(word, tempArr)
			payload.Data.RoundNumber = roundNumber
			payload.Data.Word = wordToSend
			data, err := json.Marshal(payload)
			if err != nil {
				continue
			}
			r.broadcast <- string(data)
			r.publishMaskedWordToGuessers(wordToSend, roundNumber)
		case <-timer3.C:
			tempArr := arr[:4]
			wordToSend := maskedWordhelper(word, tempArr)
			payload.Data.RoundNumber = roundNumber
			payload.Data.Word = wordToSend
			data, err := json.Marshal(payload)
			if err != nil {
				continue
			}
			r.broadcast <- string(data)
			r.publishMaskedWordToGuessers(wordToSend, roundNumber)

		case <-ctx.Done():
			return
		case <-r.done:
			return
		}
	}

}

func (r *Room) startGuesserWord(word string, roundNumber int) {
	roundCtx, roundCancel := context.WithCancel(context.Background())

	r.mu.Lock()
	previousRoundCancel := r.roundCancel
	r.roundCancel = roundCancel
	r.mu.Unlock()

	if previousRoundCancel != nil {
		previousRoundCancel()
	}

	go r.sendGuesserWord(word, roundNumber, roundCtx)
}

func (r *Room) cancelGuesserWord() {
	r.mu.Lock()
	roundCancel := r.roundCancel
	r.roundCancel = nil
	r.mu.Unlock()

	if roundCancel != nil {
		roundCancel()
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
		avatarURL := playerAvatarURL(player.Principal)
		snapshot.Players = append(snapshot.Players, RoomPlayer{
			ID:          player.Principal.ID(),
			Type:        string(player.Principal.Type),
			DisplayName: player.Principal.DisplayName(),
			AvatarURL:   avatarURL,
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

func playerAvatarURL(principal data.Principal) *string {
	switch {
	case principal.IsUser() && principal.User.AvatarURL != "":
		avatarURL := principal.User.AvatarURL
		return &avatarURL
	case principal.IsBot():
		return principal.BotProfile.AvatarURL
	default:
		return nil
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
	if currentDrawer.Principal.ID() != stroke.ActorID {
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
	r.publishStrokeToGuessers(stroke)

}

func (r *Room) publishMaskedWordToGuessers(maskedWord string, roundNo int) {
	r.mu.Lock()
	if r.RoundState != RoundStateStarted || r.currentRoundNo != roundNo {
		r.mu.Unlock()
		return
	}
	gameID := r.gameID
	drawerID := uuid.Nil
	if r.currentDrawer != nil {
		drawerID = r.currentDrawer.Principal.ID()
	}
	runtimes := make(map[uuid.UUID]*BotRuntime, len(r.botRuntimes))
	for botID, runtime := range r.botRuntimes {
		runtimes[botID] = runtime
	}
	r.mu.Unlock()

	for botID, runtime := range runtimes {
		if botID == drawerID {
			continue
		}
		select {
		case runtime.events <- BotEvent{
			Metadata:   BotActionMetadata{GameID: gameID, RoundNo: roundNo, BotID: botID},
			Type:       botEventMaskedWord,
			MaskedWord: maskedWord,
		}:
		default:
		}
	}
}

func (r *Room) publishStrokeToGuessers(stroke DrawStroke) {
	r.mu.Lock()
	if r.RoundState != RoundStateStarted {
		r.mu.Unlock()
		return
	}
	gameID := r.gameID
	roundNo := r.currentRoundNo
	drawerID := uuid.Nil
	if r.currentDrawer != nil {
		drawerID = r.currentDrawer.Principal.ID()
	}
	runtimes := make(map[uuid.UUID]*BotRuntime, len(r.botRuntimes))
	for botID, runtime := range r.botRuntimes {
		runtimes[botID] = runtime
	}
	r.mu.Unlock()

	for botID, runtime := range runtimes {
		if botID == drawerID {
			continue
		}
		strokeCopy := stroke
		select {
		case runtime.events <- BotEvent{
			Metadata: BotActionMetadata{GameID: gameID, RoundNo: roundNo, BotID: botID},
			Type:     botEventStroke,
			Stroke:   &strokeCopy,
		}:
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
	r.cancelGuesserWord()
	r.stopBotRuntimes()

	r.mu.Lock()
	drawer := r.currentDrawer
	r.mu.Unlock()

	r.scoresMu.Lock()
	if drawer != nil {
		if _, eligible := r.scores[drawer]; eligible {
			drawerBonus := r.correctGuesses * 2
			r.scores[drawer] += drawerBonus

			key := newPrincipalScoreKey(drawer.Principal)
			finalScore := r.globalScores[key]
			finalScore.Principal = drawer.Principal
			finalScore.Points += drawerBonus
			r.globalScores[key] = finalScore
		}
	}

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
	r.startBotRuntimesForRound()
	r.sendDrawerWord(drawer, result.Word, roundNumber)
	r.startGuesserWord(result.Word, roundNumber)

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
	r.startGuesserWord(result.Word, result.Round.RoundNumber)
	r.startBotRuntimesForRound()
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
	if _, eligible := r.scores[player]; !eligible {
		r.scoresMu.Unlock()
		return
	}
	if r.scores[player] > 0 {
		r.scoresMu.Unlock()
		select {
		case player.Outgoing <- "You have already guessed brother":
		default:
		}
		return
	}
	select {
	case player.Outgoing <- "Correct Guess! Congrats":
	default:
	}
	diff := time.Since(r.startTime)
	pointsAwarded := 1
	key := newPrincipalScoreKey(player.Principal)
	finalScore := r.globalScores[key]
	finalScore.Principal = player.Principal
	if diff < 10*time.Second {
		r.scores[player] += 5
		finalScore.Points += 5
		pointsAwarded = 5

	} else if diff < 30*time.Second {
		r.scores[player] += 3
		finalScore.Points += 3
		pointsAwarded = 3

	} else if diff < 50*time.Second {
		r.scores[player] += 2
		finalScore.Points += 2
		pointsAwarded = 2

	} else {
		r.scores[player] += 1
		finalScore.Points += 1

	}

	r.globalScores[key] = finalScore
	r.correctGuesses++
	r.scoresMu.Unlock()

	r.publishGuessResult(player, pointsAwarded)
}

func (r *Room) publishGuessResult(player *Player, pointsAwarded int) {
	payload := struct {
		Type string `json:"type"`
		Data struct {
			ParticipantID string `json:"participant_id"`
			DisplayName   string `json:"display_name"`
			Correct       bool   `json:"correct"`
			PointsAwarded int    `json:"points_awarded"`
		} `json:"data"`
	}{
		Type: "guess_result",
	}
	payload.Data.ParticipantID = player.Principal.ID().String()
	payload.Data.DisplayName = player.Principal.DisplayName()
	payload.Data.Correct = true
	payload.Data.PointsAwarded = pointsAwarded

	encoded, err := json.Marshal(payload)
	if err != nil {
		return
	}
	r.broadcastRealtimeEvent(string(encoded))
}

func (r *Room) handleGuess(command SubmitGuessCommand) {
	guess := strings.ToLower(strings.TrimSpace(command.Text))
	if guess == "" || len(guess) > 128 {
		return
	}

	r.mu.Lock()
	if r.gameID != command.GameID ||
		r.currentRoundNo != command.RoundNo ||
		r.RoundState != RoundStateStarted {
		r.mu.Unlock()
		return
	}

	var player *Player
	for candidate := range r.players {
		if candidate.Principal.ID() == command.ParticipantID {
			player = candidate
			break
		}
	}
	if player == nil {
		r.mu.Unlock()
		return
	}
	if r.currentDrawer == player {
		r.mu.Unlock()
		select {
		case player.Outgoing <- "You are the drawer! You cant guess!":
		default:
		}
		return
	}
	targetWord := strings.ToLower(strings.TrimSpace(r.currentWord))
	r.mu.Unlock()

	if guess != targetWord {
		select {
		case player.Outgoing <- "Wrong Guess":
		default:
		}
		return
	}

	r.handleCorrectGuess(player)
}

func (r *Room) handleEndGame() {
	if !r.beginEndGame() {
		return
	}
	r.stopBotRuntimes()

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
	case <-timer.C:
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
