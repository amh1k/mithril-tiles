package realtime

import (
	"context"
	"fmt"
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

	

	welcomeMessage := buildWelcomeMessage(principal.DisplayName())
	if err := conn.Write(ctx, websocket.MessageText, []byte(welcomeMessage)); err != nil {
		return
	}

	go writeMessages(player, ctx)
	readMessages(player, room, ctx)
}

func buildWelcomeMessage(username string) string {
	msg := fmt.Sprintf("Welcome, %s!\n", username)
	return msg
}
