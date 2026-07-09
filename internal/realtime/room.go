package realtime

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
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
	AvatarURL   string    `json:"avatar_url,omitempty"`
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
	done           chan struct{}
	doneOnce       sync.Once
	gameLifecycle  GameLifecycle
	endGameRetry   endGameRetryPolicy
	deleteRoom     func(roomCode string)
	endGame        chan struct{} // differnt from done

	//drawing
	drawStroke chan DrawStroke

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
		close(r.done)
	})
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
