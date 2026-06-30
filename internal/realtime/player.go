package realtime

import (
	"context"
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
	cancel         context.CancelFunc
	leaveOnce      sync.Once // so that player is  unregistered only once
}
func (p *Player) cancelConnection() {
	if p.cancel != nil {
		p.cancel()
	}
}
func (p *Player) unregister(room *Room) {
	p.leaveOnce.Do(func() {
		select {
		case room.leave <- p:
		case <-room.done:
		}
	})
}
