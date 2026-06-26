package realtime

import (
	"sync"
	"time"

	"github.com/coder/websocket"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

type Player struct {
	Conn           *websocket.Conn
	Principal      data.Principal //Contains guest or user info
	Outgoing       chan string    // Buffered channel for writes
	LastActive     time.Time      // For idle detection
	MessagesSent   int            // Statistics
	MessagesRecv   int
	IsSlowPlayer   bool // Testing flag
	ReconnectToken string
	Mu             sync.Mutex // Protects stats fields
}
