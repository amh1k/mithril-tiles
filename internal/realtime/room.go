package realtime

import (
	"os"
	"sync"
	"time"

	"mithrilTiles.abdulmoiz.net/internal/data"
)


type Room struct {

// Communication channels
    join          chan *Client
    leave         chan *Client
    broadcast     chan string
    listUsers     chan *Client
    directMessage chan DirectMessage

    // State
    clients       map[*Client]bool
    mu            sync.Mutex
    totalMessages int
    startTime     time.Time

    // Message history
    messages      []Message
    messageMu     sync.Mutex
    nextMessageID int

    // Persistence
    walFile       *os.File
    walMu         sync.Mutex
    dataDir       string

    // Sessions
    sessions      map[string]*data.Token
    sessionsMu    sync.Mutex
}