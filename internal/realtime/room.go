package realtime

import (
	"fmt"
	"os"
	"sync"
	"time"

	"mithrilTiles.abdulmoiz.net/internal/data"
)

type Room struct {

	// Communication channels

	join           chan *Player
	leave          chan *Player
	broadcast      chan string
	listPlayers    chan *Player
	directMessage  chan DirectMessage
	correctGuesses int
	HostPlayer     *Player
	currentWord    string
	roomCode       string
	currentDrawer  *Player
	currentRoundNo int

	//Scores
	scoresMu sync.Mutex
	scores   map[*Player]int

	// State2
	Player        map[*Player]bool
	mu            sync.Mutex
	totalMessages int
	startTime     time.Time

	// Message history
	messages      []Message
	messageMu     sync.Mutex
	nextMessageID int

	// Persistence
	walFile *os.File
	walMu   sync.Mutex
	dataDir string

	// Sessions
	sessions   map[string]*data.Token
	sessionsMu sync.Mutex
}

func NewRoom(roomCode string) (*Room, error) {
	cr := &Room{
		Player:        make(map[*Player]bool),
		join:          make(chan *Player),
		leave:         make(chan *Player),
		broadcast:     make(chan string),
		listPlayers:   make(chan *Player),
		directMessage: make(chan DirectMessage),
		scores:        make(map[*Player]int),
		sessions:      make(map[string]*data.Token),
		messages:      make([]Message, 0),
		startTime:     time.Now(),
		dataDir:       roomCode,
	}

	return cr, nil
}


func (r *Room)Run() {
    fmt.Println("Room heartbeat started...")
    // go cr.cleanupInactiveClients()
    for {
        select {
        case player := <-r.join:
            r.handleJoin(player)
        
        case player := <-r.leave:
            r.handleLeave(player)
        
        case message := <-r.broadcast:
            r.handleBroadcast(player)

        case player := <-r.listPlayers:
            r.sendUserList(player)

        case dm := <-r.directMessage:
            r.handleDirectMessage(dm)
        }
    }
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
