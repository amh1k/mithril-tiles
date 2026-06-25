package realtime

import (
	"sync"
	"time"

	"github.com/coder/websocket"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

type Player struct {
    conn         *websocket.Conn      
    principal    data.Principal   //Contains guest or user info
    outgoing     chan string   // Buffered channel for writes
    lastActive   time.Time     // For idle detection
    messagesSent int           // Statistics
    messagesRecv int
    isSlowPlayer bool          // Testing flag
    reconnectToken string
    mu             sync.Mutex   // Protects stats fields
}