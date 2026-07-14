package realtime

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

const roundDuration = 60 * time.Second
const totalRounds = 2

type GameState string

const (
	GameStateIdle      GameState = "idle"
	GameStateStarting  GameState = "starting"
	GameStateStarted   GameState = "started"
	GameStateEnding    GameState = "ending"
	GameStateCompleted GameState = "completed"
	GameStateEndFailed GameState = "end_failed"
)

type RoundState string

type RoomSnapshot struct {
	Version    int                `json:"version"`
	RoomCode   string             `json:"room_code"`
	GameState  GameState          `json:"game_state"`
	RoundState RoundState         `json:"round_state"`
	HostID     uuid.UUID          `json:"host_id"`
	Players    []RoomPlayer       `json:"players"`
	Game       *RoomGameSnapshot  `json:"game"`
	Canvas     RoomCanvasSnapshot `json:"canvas"`
	ServerTime time.Time          `json:"server_time"`
}

type RoomPlayer struct {
	ID          uuid.UUID `json:"id"`
	Type        string    `json:"type"`
	DisplayName string    `json:"display_name"`
	AvatarURL   *string   `json:"avatar_url"`
	Score       int       `json:"score"`
	IsConnected bool      `json:"is_connected"`
}

type RoomGameSnapshot struct {
	ID             uuid.UUID `json:"id"`
	WordPackID     uuid.UUID `json:"word_pack_id"`
	RoundNumber    int       `json:"round_number"`
	TotalRounds    int       `json:"total_rounds"`
	DrawerID       uuid.UUID `json:"drawer_id"`
	RoundStartedAt time.Time `json:"round_started_at"`
	RoundEndsAt    time.Time `json:"round_ends_at"`
}

type RoomCanvasSnapshot struct {
	Revision int `json:"revision"`
}

const (
	RoundStateIdle    RoundState = "idle"
	RoundStateStarted RoundState = "started"
)

type joinRequest struct {
	player *Player
	result chan error
}

const (
	GameRounds = 3
	MaxPlayers = 5
)

type endGameRetryPolicy struct {
	MaxAttempts    int
	AttemptTimeout time.Duration
	InitialBackoff time.Duration
	MaxBackoff     time.Duration
}

var defaultEndGameRetryPolicy = endGameRetryPolicy{
	MaxAttempts:    4,
	AttemptTimeout: 3 * time.Second,
	InitialBackoff: time.Second,
	MaxBackoff:     8 * time.Second,
}

type AddBotCommand struct {
	RequestedBy uuid.UUID
	Profile     data.BotProfile
	Result      chan error
}
type RemoveBotCommand struct {
	RequestedBy uuid.UUID
	BotID       uuid.UUID
	Result      chan error
}
type BotRuntime struct {
	BotID   uuid.UUID
	Profile data.BotProfile
	events  chan BotEvent

	cancel context.CancelFunc
	done   chan struct{}
}

type BotActionMetadata struct {
	GameID  uuid.UUID
	RoundNo int
	BotID   uuid.UUID
}
type BotPerception struct {
	RoundNo    int
	MaskedWord string
	Strokes    []DrawStroke
}

type botEventType string

const (
	botEventMaskedWord botEventType = "masked_word"
	botEventStroke     botEventType = "stroke"
)

type BotEvent struct {
	Metadata   BotActionMetadata
	Type       botEventType
	MaskedWord string
	Stroke     *DrawStroke
}

type botActionKind string

const (
	botActionDraw  botActionKind = "draw"
	botActionGuess botActionKind = "guess"
)

type botActionCompletion struct {
	Metadata BotActionMetadata
	Kind     botActionKind
	Strokes  []DrawStroke
}
type SubmitGuessCommand struct {
	ParticipantID uuid.UUID
	Text          string
	GameID        uuid.UUID
	RoundNo       int
}
type BotBehaviorPolicy struct {
	GuessDelay         time.Duration
	MaxGuessAttempts   int
	MinRevealedLetters int
	DrawDelay          time.Duration
	MaxDrawingStrokes  int
}

type Room struct {

	// Communication channels

	join           chan joinRequest
	leave          chan *Player
	broadcast      chan string
	listPlayers    chan *Player
	startGame      chan gameStartCommand
	gameStartDone  chan gameStartCompletion
	directMessage  chan DirectMessage
	snapshot       chan struct{}
	correctGuesses int
	HostPlayer     *Player
	currentWord    string
	roomCode       string
	currentDrawer  *Player
	currentRoundNo int
	gameID         uuid.UUID
	wordPackID     uuid.UUID
	gameState      GameState
	RoundState     RoundState
	roundInfo      chan string
	roundCancel    func()
	done           chan struct{}
	doneOnce       sync.Once
	gameLifecycle  GameLifecycle
	endGameRetry   endGameRetryPolicy
	deleteRoom     func(roomCode string)
	endGame        chan struct{} // differnt from done

	//drawing
	drawStroke chan DrawStroke

	addBot         chan AddBotCommand
	removeBot      chan RemoveBotCommand
	botAction      chan botActionCompletion
	submitGuess    chan SubmitGuessCommand
	drawingPlanner DrawingPlanner
	guessProvider  GuessProvider

	//Scores
	scoresMu     sync.Mutex
	scores       map[*Player]int
	globalScores map[principalScoreKey]PlayerFinalScore

	//draw histroy (optional)
	// strokesMu sync.Mutex
	// strokes   []DrawStroke

	// State2
	players       map[*Player]bool
	mu            sync.Mutex
	totalMessages int
	startTime     time.Time

	// Message history
	messages      *RingBuffer[Message]
	messageMu     sync.Mutex
	nextMessageID int

	// Persistence
	// walFile *os.File
	// walMu   sync.Mutex
	// dataDir string

	// Sessions
	sessions   map[string]*SessionInfo
	sessionsMu sync.Mutex

	botRuntimes map[uuid.UUID]*BotRuntime
}

func NewRoom(roomCode string, gameLifecycle GameLifecycle, deleteRoom func(roomCode string)) (*Room, error) {
	return newRoom(
		roomCode,
		gameLifecycle,
		deleteRoom,
		DefaultMessageHistoryCapacity,
	)
}

func newRoom(
	roomCode string,
	gameLifecycle GameLifecycle,
	deleteRoom func(roomCode string),
	messageHistoryCapacity int,
) (*Room, error) {
	if gameLifecycle == nil {
		return nil, fmt.Errorf("game lifecycle is required")
	}
	messages, err := NewRingBuffer[Message](messageHistoryCapacity)
	if err != nil {
		return nil, fmt.Errorf("create message history: %w", err)
	}

	cr := &Room{
		players:        make(map[*Player]bool),
		join:           make(chan joinRequest),
		leave:          make(chan *Player),
		broadcast:      make(chan string),
		listPlayers:    make(chan *Player),
		startGame:      make(chan gameStartCommand),
		gameStartDone:  make(chan gameStartCompletion, 1),
		directMessage:  make(chan DirectMessage),
		snapshot:       make(chan struct{}),
		drawStroke:     make(chan DrawStroke, 256),
		scores:         make(map[*Player]int),
		globalScores:   make(map[principalScoreKey]PlayerFinalScore),
		sessions:       make(map[string]*SessionInfo),
		messages:       messages,
		startTime:      time.Now(),
		roomCode:       roomCode,
		gameState:      GameStateIdle,
		RoundState:     RoundStateIdle,
		correctGuesses: 0,
		currentRoundNo: 0,
		roundInfo:      make(chan string, 20),
		gameLifecycle:  gameLifecycle,
		endGameRetry:   defaultEndGameRetryPolicy,
		done:           make(chan struct{}),
		endGame:        make(chan struct{}),
		deleteRoom:     deleteRoom,
		addBot:         make(chan AddBotCommand, 10),
		removeBot:      make(chan RemoveBotCommand, 10),
		botAction:      make(chan botActionCompletion, 16),
		submitGuess:    make(chan SubmitGuessCommand, 32),
		drawingPlanner: TemplateDrawingPlanner{},
		guessProvider:  DeterministicGuessProvider{},
		botRuntimes:    make(map[uuid.UUID]*BotRuntime),
	}

	return cr, nil
}
func NewRoomUnitTest(roomCode string) (*Room, error) {
	messages, err := NewRingBuffer[Message](DefaultMessageHistoryCapacity)
	if err != nil {
		return nil, fmt.Errorf("create message history: %w", err)
	}

	cr := &Room{
		players:        make(map[*Player]bool),
		join:           make(chan joinRequest),
		leave:          make(chan *Player),
		broadcast:      make(chan string),
		listPlayers:    make(chan *Player),
		startGame:      make(chan gameStartCommand),
		gameStartDone:  make(chan gameStartCompletion, 1),
		directMessage:  make(chan DirectMessage),
		snapshot:       make(chan struct{}),
		drawStroke:     make(chan DrawStroke, 256),
		scores:         make(map[*Player]int),
		globalScores:   make(map[principalScoreKey]PlayerFinalScore),
		sessions:       make(map[string]*SessionInfo),
		messages:       messages,
		startTime:      time.Now(),
		roomCode:       roomCode,
		gameState:      GameStateIdle,
		correctGuesses: 0,
		currentRoundNo: 0,
		roundInfo:      make(chan string, 20),
		endGameRetry:   defaultEndGameRetryPolicy,
		done:           make(chan struct{}),
		addBot:         make(chan AddBotCommand, 10),
		removeBot:      make(chan RemoveBotCommand, 10),
		botAction:      make(chan botActionCompletion, 16),
		submitGuess:    make(chan SubmitGuessCommand, 32),
		drawingPlanner: TemplateDrawingPlanner{},
		guessProvider:  DeterministicGuessProvider{},
		botRuntimes:    make(map[uuid.UUID]*BotRuntime),
	}

	return cr, nil

}

func (r *Room) Run() {
	fmt.Println("Room heartbeat started...")
	go r.cleanupInactiveplayers()
	for {
		select {
		case request := <-r.join:
			r.handleJoin(request)

		case player := <-r.leave:
			r.handleLeave(player)

		case message := <-r.broadcast:
			r.handleBroadcast(message)

		case player := <-r.listPlayers:
			r.sendUserList(player)

		case dm := <-r.directMessage:
			r.handleDirectMessage(dm)

		case <-r.snapshot:
			r.handleSnapshotRequest()

		case stroke := <-r.drawStroke:
			r.handleDrawStroke(stroke)
		case command := <-r.startGame:
			r.handleStartGame(command)
		case completion := <-r.gameStartDone:
			r.handleGameStartCompleted(completion)

		case <-r.roundInfo:
			go r.endRound()
		case <-r.endGame:
			go r.handleEndGame()

		case command := <-r.addBot:
			r.handleAddBot(command)
		case command := <-r.removeBot:
			r.handleRemoveBot(command)
		case completion := <-r.botAction:
			r.handleBotActionCompletion(completion)
		case command := <-r.submitGuess:
			r.handleGuess(command)
		case <-r.done:
			return
		}
	}
}
func (r *Room) GetScores() map[*Player]int {
	return r.scores
}

func (r *Room) close() {
	r.doneOnce.Do(func() {
		r.stopBotRuntimes()
		close(r.done)
	})
}
func (r *Room) handleAddBot(addBotCommand AddBotCommand) {
	r.mu.Lock()
	if r.HostPlayer == nil || addBotCommand.RequestedBy != r.HostPlayer.Principal.ID() {
		r.mu.Unlock()
		addBotCommand.Result <- fmt.Errorf("only host can add bots")
		return
	}
	if r.gameState != GameStateIdle {
		r.mu.Unlock()
		addBotCommand.Result <- fmt.Errorf("bots can only be added while the game is idle")
		return
	}
	if !addBotCommand.Profile.IsActive {
		r.mu.Unlock()
		addBotCommand.Result <- fmt.Errorf("bot profile is inactive")
		return
	}
	for existingPlayer := range r.players {
		if existingPlayer.Type == botPlayer && existingPlayer.Principal.ID() == addBotCommand.Profile.ID {
			r.mu.Unlock()
			addBotCommand.Result <- fmt.Errorf("bot profile is already in the room")
			return
		}
		if existingPlayer.Principal.DisplayName() == addBotCommand.Profile.Name {
			r.mu.Unlock()
			addBotCommand.Result <- fmt.Errorf("display name is already in use")
			return
		}
	}
	r.mu.Unlock()
	principal := data.Principal{
		Type:       data.PrincipalBot,
		BotProfile: &addBotCommand.Profile,
	}
	player := &Player{
		Conn:           nil,
		Principal:      principal,
		Outgoing:       make(chan string, 10),
		LastActive:     time.Now(),
		ReconnectToken: uuid.NewString(),
		cancel:         func() {},
		Type:           botPlayer,
	}
	joinResult := make(chan error, 1)
	r.handleJoin(joinRequest{player: player, result: joinResult})
	if err := <-joinResult; err != nil {
		addBotCommand.Result <- err
		return
	}
	r.handleSnapshotRequest()
	addBotCommand.Result <- nil
}
func (r *Room) handleRemoveBot(removeBotCommand RemoveBotCommand) {
	r.mu.Lock()
	if r.HostPlayer == nil || removeBotCommand.RequestedBy != r.HostPlayer.Principal.ID() {
		r.mu.Unlock()
		removeBotCommand.Result <- fmt.Errorf("only host can remove bots")
		return
	}
	if r.gameState != GameStateIdle {
		r.mu.Unlock()
		removeBotCommand.Result <- fmt.Errorf("bots can only be removed while the game is idle")
		return
	}

	var targetBot *Player
	for player := range r.players {
		if player.Type == botPlayer && player.Principal.ID() == removeBotCommand.BotID {
			targetBot = player
			break
		}
	}
	r.mu.Unlock()

	if targetBot == nil {
		removeBotCommand.Result <- fmt.Errorf("bot player not found")
		return
	}

	r.stopBotRuntime(targetBot.Principal.ID())
	r.handleLeave(targetBot)
	removeBotCommand.Result <- nil
}

// func runServer(code string) {
//     room, err := NewRoom(code)
//     if err != nil {
//         fmt.Printf("Failed to initialize: %v\n", err)
//         return
//     }
//     defer room.shutdown()
//     sigChan := make(chan os.Signal, 1)
//     signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
//     go func() {
//         <-sigChan
//         fmt.Println("\nReceived shutdown signal")
//         room.shutdown()
//         os.Exit(0)
//     }()
//     go room.Run()

// }

func (r *Room) AddToAddBotChannel(ctx context.Context, addBotCommand AddBotCommand) error {
	select {
	case r.addBot <- addBotCommand:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-r.done:
		return fmt.Errorf("room was closed")
	}
}
func (r *Room) AddToRemoveBotChannel(ctx context.Context, removeBotCommand RemoveBotCommand) error {
	select {
	case r.removeBot <- removeBotCommand:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-r.done:
		return fmt.Errorf("room was closed")
	}
}

func (r *Room) SubmitGuess(ctx context.Context, command SubmitGuessCommand) error {
	select {
	case r.submitGuess <- command:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-r.done:
		return fmt.Errorf("room was closed")
	}
}

func (r *Room) startBotRuntimesForRound() {
	r.stopBotRuntimes()

	r.mu.Lock()
	gameID := r.gameID
	roundNo := r.currentRoundNo
	word := r.currentWord
	drawerID := uuid.Nil
	if r.currentDrawer != nil {
		drawerID = r.currentDrawer.Principal.ID()
	}
	runtimes := make([]*BotRuntime, 0)
	for player := range r.players {
		if player.Type != botPlayer || player.Principal.BotProfile == nil {
			continue
		}

		ctx, cancel := context.WithCancel(context.Background())
		runtime := &BotRuntime{
			BotID:   player.Principal.ID(),
			Profile: *player.Principal.BotProfile,
			events:  make(chan BotEvent, 128),
			cancel:  cancel,
			done:    make(chan struct{}),
		}
		r.botRuntimes[runtime.BotID] = runtime
		runtimes = append(runtimes, runtime)
		isDrawer := runtime.BotID == drawerID
		drawerWord := ""
		if isDrawer {
			drawerWord = word
		}
		go r.runBotRuntime(ctx, runtime, BotActionMetadata{
			GameID:  gameID,
			RoundNo: roundNo,
			BotID:   runtime.BotID,
		}, isDrawer, drawerWord)
	}
	r.mu.Unlock()
}

func (r *Room) runBotRuntime(ctx context.Context, runtime *BotRuntime, metadata BotActionMetadata, isDrawer bool, word string) {
	defer close(runtime.done)
	if !isDrawer {
		r.runGuesserRuntime(ctx, runtime, metadata)
		return
	}
	policy := behaviorPolicyFor(runtime.Profile)

	timer := time.NewTimer(policy.DrawStartDelay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return
	case <-r.done:
		return
	case <-timer.C:
	}

	planner := r.drawingPlanner
	if planner == nil {
		planner = TemplateDrawingPlanner{}
	}
	for _, stroke := range limitDrawingStrokes(planner.Plan(word, runtime.Profile), policy.MaxDrawingStrokes) {
		completion := botActionCompletion{
			Metadata: metadata,
			Kind:     botActionDraw,
			Strokes:  []DrawStroke{stroke},
		}
		select {
		case r.botAction <- completion:
		case <-ctx.Done():
			return
		case <-r.done:
			return
		default:
			return
		}

		timer := time.NewTimer(policy.DrawStrokeDelay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-r.done:
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}

func (r *Room) runGuesserRuntime(ctx context.Context, runtime *BotRuntime, metadata BotActionMetadata) {
	perception := BotPerception{RoundNo: metadata.RoundNo}
	policy := behaviorPolicyFor(runtime.Profile)
	attempted := make(map[string]struct{})
	attempts := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-r.done:
			return
		case event := <-runtime.events:
			if event.Metadata != metadata {
				continue
			}
			switch event.Type {
			case botEventMaskedWord:
				perception.MaskedWord = event.MaskedWord
				if attempts >= policy.MaxGuessAttempts || revealedLetterCount(perception.MaskedWord) < policy.MinRevealedLetters {
					continue
				}
				provider := r.guessProvider
				if provider == nil {
					provider = DeterministicGuessProvider{}
				}
				input := GuessInput{
					RoundNo:         perception.RoundNo,
					MaskedWord:      perception.MaskedWord,
					Strokes:         append([]DrawStroke(nil), perception.Strokes...),
					PreviousGuesses: attemptedGuesses(attempted),
				}
				guess, err := provider.Guess(ctx, input)
				if err == nil {
					guess = validProviderGuess(perception.MaskedWord, guess, attempted)
				}
				if guess == "" {
					guess, err = DeterministicGuessProvider{}.Guess(ctx, input)
					if err != nil {
						continue
					}
				}
				guess = validProviderGuess(perception.MaskedWord, guess, attempted)
				if guess == "" {
					continue
				}

				timer := time.NewTimer(policy.GuessDelay)
				select {
				case <-ctx.Done():
					timer.Stop()
					return
				case <-r.done:
					timer.Stop()
					return
				case <-timer.C:
				}

				attempted[guess] = struct{}{}
				attempts++
				_ = r.SubmitGuess(ctx, SubmitGuessCommand{
					ParticipantID: runtime.BotID,
					Text:          guess,
					GameID:        metadata.GameID,
					RoundNo:       metadata.RoundNo,
				})
			case botEventStroke:
				if event.Stroke == nil {
					continue
				}
				perception.Strokes = append(perception.Strokes, *event.Stroke)
				if len(perception.Strokes) > 512 {
					perception.Strokes = perception.Strokes[len(perception.Strokes)-512:]
				}
			}
		}
	}
}

func deterministicTemplateGuess(maskedWord string, attempted map[string]struct{}) string {
	maskedWord = strings.ToLower(strings.TrimSpace(maskedWord))
	if maskedWord == "" {
		return ""
	}

	candidates := templateCandidates()
	for _, candidate := range candidates {
		if _, alreadyTried := attempted[candidate]; alreadyTried || len(candidate) != len(maskedWord) {
			continue
		}

		matches := true
		for i := range candidate {
			if maskedWord[i] != '_' && maskedWord[i] != candidate[i] {
				matches = false
				break
			}
		}
		if matches {
			return candidate
		}
	}

	return ""
}

func (r *Room) handleBotActionCompletion(completion botActionCompletion) {
	r.mu.Lock()
	if completion.Metadata.GameID != r.gameID ||
		completion.Metadata.RoundNo != r.currentRoundNo ||
		r.RoundState != RoundStateStarted {
		r.mu.Unlock()
		return
	}
	if _, exists := r.botRuntimes[completion.Metadata.BotID]; !exists {
		r.mu.Unlock()
		return
	}

	isDrawer := r.currentDrawer != nil && r.currentDrawer.Principal.ID() == completion.Metadata.BotID
	if (completion.Kind == botActionDraw) != isDrawer {
		r.mu.Unlock()
		return
	}
	if completion.Kind != botActionDraw || len(completion.Strokes) == 0 || len(completion.Strokes) > 64 {
		r.mu.Unlock()
		return
	}

	drawerName := r.currentDrawer.Principal.DisplayName()
	roomCode := r.roomCode
	r.mu.Unlock()

	for _, stroke := range completion.Strokes {
		if !validBotStroke(stroke) {
			return
		}
	}
	for _, stroke := range completion.Strokes {
		stroke.ActorID = completion.Metadata.BotID
		stroke.From = drawerName
		stroke.RoomCode = roomCode
		r.handleDrawStroke(stroke)
	}
}

func validBotStroke(stroke DrawStroke) bool {
	if stroke.FromX < 0 || stroke.FromX > 1 ||
		stroke.FromY < 0 || stroke.FromY > 1 ||
		stroke.ToX < 0 || stroke.ToX > 1 ||
		stroke.ToY < 0 || stroke.ToY > 1 {
		return false
	}
	if stroke.Color != "#000000" {
		return false
	}
	return stroke.BrushSize > 0 && stroke.BrushSize <= 20
}

func (r *Room) stopBotRuntime(botID uuid.UUID) {
	r.mu.Lock()
	runtime := r.botRuntimes[botID]
	delete(r.botRuntimes, botID)
	r.mu.Unlock()
	if runtime != nil {
		runtime.cancel()
	}
}

func (r *Room) stopBotRuntimes() {
	r.mu.Lock()
	runtimes := r.botRuntimes
	r.botRuntimes = make(map[uuid.UUID]*BotRuntime)
	r.mu.Unlock()
	for _, runtime := range runtimes {
		runtime.cancel()
	}
}
