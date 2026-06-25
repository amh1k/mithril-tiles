package realtime

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

func HandlePlayer(conn *websocket.Conn, room *Room, principal *data.Principal, ctx context.Context) {
	if conn == nil || room == nil || principal == nil || !principal.IsAuthenticated() {
		if conn != nil {
			conn.Close(websocket.StatusPolicyViolation, "authentication required")
		}
		return
	}
	player := &Player{
		conn:           conn,
		principal:      *principal,
		outgoing:       make(chan string, 10),
		lastActive:     time.Now(),
		reconnectToken: uuid.NewString(),
	}

	defer func() {
		status := websocket.StatusNormalClosure
		reason := "connection closed"
		if recovered := recover(); recovered != nil {
			fmt.Printf("panic in HandlePlayer: %v\n", recovered)
			status = websocket.StatusInternalError
			reason = "internal server error"
		}
		conn.Close(status, reason)
	}()
	username := principal.DisplayName()

	welcomeMessage := buildWelcomeMessage(username)
	if err := conn.Write(ctx, websocket.MessageText, []byte(welcomeMessage)); err != nil {
		return
	}
	go readMessages(player, room, username, ctx)
	writeMessages(player, ctx, username)
	
	room.updateSessionActivity(username)
	room.leave <- player
}

func buildWelcomeMessage(username string) string {
	msg := fmt.Sprintf("Welcome, %s!\n", username)
	return msg
}

func readMessages(player *Player, room *Room, username string, ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Panic in readMessages for %s: %v\n", username, r)
		}
	}()

	for {
		_, messageBytes, err := player.conn.Read(ctx)
		if err != nil {
			return
		}
		message := string(messageBytes)

		player.markActive()
		message = strings.TrimSpace(message)
		if message == "" {
			continue
		}
		player.mu.Lock()
		player.messagesRecv++
		player.mu.Unlock()
		formatted := fmt.Sprintf("[%s]: %s\n", username, message)
		room.broadcast <- formatted
	}
}

func writeMessages(player *Player, ctx context.Context, username string) {
	defer func() {
        if r := recover(); r != nil {
            fmt.Printf("Panic in writeMessages for %s: %v\n", username, r)
        }
    }()
	for message := range player.outgoing {
		err := player.conn.Write(ctx, websocket.MessageText, []byte(message))
		 if err != nil {
            fmt.Printf("Write error for %s: %v\n",username, err)
            return
        }
	}



}
