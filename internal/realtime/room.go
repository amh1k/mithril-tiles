package realtime

import (
	"fmt"
	"sync"
	"time"
)

const roundDuration = 10 * time.Second

type GameState string

const (
	GameStateIdle     GameState = "idle"
	GameStateStarting GameState = "starting"
	GameStateStarted  GameState = "started"
)
const (
	GameRounds = 3
)

type Room struct {

	// Communication channels

	join           chan *Player
	leave          chan *Player
	broadcast      chan string
	listPlayers    chan *Player
	startGame      chan gameStartCommand
	gameStartDone  chan gameStartCompletion
	directMessage  chan DirectMessage
	correctGuesses int
	HostPlayer     *Player
	currentWord    string
	roomCode       string
	currentDrawer  *Player
	currentRoundNo int
	gameState      GameState
	roundInfo      chan string
	done           chan struct{}
	gameLifecycle  GameLifecycle
	deleteRoom     func(roomCode string)
	endGame        chan struct{} // differnt from done

	//drawing
	drawStroke chan DrawStroke

	//Scores
	scoresMu     sync.Mutex
	scores       map[*Player]int
	globalScores map[*Player]int

	//draw histroy (optional)
	// strokesMu sync.Mutex
	// strokes   []DrawStroke

	// State2
	players       map[*Player]bool
	mu            sync.Mutex
	totalMessages int
	startTime     time.Time

	// Message history
	messages      []Message
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
	if gameLifecycle == nil {
		return nil, fmt.Errorf("game lifecycle is required")
	}

	cr := &Room{
		players:        make(map[*Player]bool),
		join:           make(chan *Player),
		leave:          make(chan *Player),
		broadcast:      make(chan string),
		listPlayers:    make(chan *Player),
		startGame:      make(chan gameStartCommand),
		gameStartDone:  make(chan gameStartCompletion, 1),
		directMessage:  make(chan DirectMessage),
		drawStroke:     make(chan DrawStroke, 256),
		scores:         make(map[*Player]int),
		globalScores:   make(map[*Player]int),
		sessions:       make(map[string]*SessionInfo),
		messages:       make([]Message, 0),
		startTime:      time.Now(),
		roomCode:       roomCode,
		gameState:      GameStateIdle,
		correctGuesses: 0,
		currentRoundNo: 0,
		roundInfo:      make(chan string, 20),
		gameLifecycle:  gameLifecycle,
		done:           make(chan struct{}),
		endGame:        make(chan struct{}),
		deleteRoom:     deleteRoom,
	}

	return cr, nil
}
func NewRoomUnitTest(roomCode string) (*Room, error) {

	cr := &Room{
		players:        make(map[*Player]bool),
		join:           make(chan *Player),
		leave:          make(chan *Player),
		broadcast:      make(chan string),
		listPlayers:    make(chan *Player),
		startGame:      make(chan gameStartCommand),
		gameStartDone:  make(chan gameStartCompletion, 1),
		directMessage:  make(chan DirectMessage),
		drawStroke:     make(chan DrawStroke, 256),
		scores:         make(map[*Player]int),
		globalScores:   make(map[*Player]int),
		sessions:       make(map[string]*SessionInfo),
		messages:       make([]Message, 0),
		startTime:      time.Now(),
		roomCode:       roomCode,
		gameState:      GameStateIdle,
		correctGuesses: 0,
		currentRoundNo: 0,
		roundInfo:      make(chan string, 20),
		done:           make(chan struct{}),
	}

	return cr, nil

}

func (r *Room) Run() {
	fmt.Println("Room heartbeat started...")
	go r.cleanupInactiveplayers()
	for {
		select {
		case player := <-r.join:
			r.handleJoin(player)

		case player := <-r.leave:
			r.handleLeave(player)

		case message := <-r.broadcast:
			r.handleBroadcast(message)

		case player := <-r.listPlayers:
			r.sendUserList(player)

		case dm := <-r.directMessage:
			r.handleDirectMessage(dm)

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
