package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

type IncomingEvent struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}
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
		_, data, err := player.conn.Read(ctx)
		if err != nil {
			return
		}
		var event IncomingEvent
		if err := json.Unmarshal(data, &event); err != nil {
			continue
		}
		switch(event.Type ) {
		case "chat_message":
			message := string(event.Data)
			player.markActive()
			message = strings.TrimSpace(message)
			if message == "" {
				continue
			}
			player.mu.Lock()
			player.messagesRecv++
			player.mu.Unlock()
			if strings.HasPrefix(message, "/") {
				handleCommand(player, room, message)
				continue
			}
			formatted := fmt.Sprintf("[%s]: %s\n", username, message)
			room.broadcast <- formatted

		case "draw_stroke":
			var stroke DrawStroke
			if err := json.Unmarshal(event.Data, &stroke); err != nil {
				continue
			}

			stroke.From = player.principal.DisplayName()
			stroke.RoomCode = room.roomCode
			room.drawStroke <- stroke

		}
		
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
			fmt.Printf("Write error for %s: %v\n", username, err)
			return
		}
	}
}

func handleCommand(player *Player, room *Room, command string) {
	parts := strings.Fields(command)
	if len(parts) == 0 {
		return
	}

	switch parts[0] {
	case "/players":
		room.listPlayers <- player

	case "/stats":
		player.mu.Lock()
		stats := fmt.Sprintf("Your Stats:\n")
		stats += fmt.Sprintf("  Messages sent: %d\n", player.messagesSent)
		stats += fmt.Sprintf("  Messages received: %d\n", player.messagesRecv)
		stats += fmt.Sprintf("  Last active: %s ago\n",
			time.Since(player.lastActive).Round(time.Second))
		player.mu.Unlock()

		select {
		case player.outgoing <- stats:
		default:
		}

	case "/msg":
		if len(parts) < 3 {
			select {
			case player.outgoing <- "Usage: /msg <username> <message>\n":
			default:
			}
			return
		}

		targetUsername := parts[1]
		messageText := strings.Join(parts[2:], " ")

		targetplayer, err := room.findPlayerByUsername(targetUsername)
		if err != nil {
			select {
			case player.outgoing <- fmt.Sprintf("User '%s' not found\n", targetUsername):
			default:
			}
			return
		}

		privateMsg := fmt.Sprintf("[From %s]: %s\n", player.principal.DisplayName(), messageText)
		select {
		case targetplayer.outgoing <- privateMsg:
		default:
			select {
			case player.outgoing <- fmt.Sprintf("%s's inbox is full\n", targetUsername):
			default:
			}
			return
		}

		select {
		case player.outgoing <- fmt.Sprintf("Message sent to %s\n", targetUsername):
		default:
		}

	case "/history":
		count := 20
		if len(parts) > 1 {
			if _, err := fmt.Sscanf(parts[1], "%d", &count); err != nil {
				select {
				case player.outgoing <- "Usage: /history [count]\n":
				default:
				}
				return
			}
		}
		if count > 100 {
			count = 100
		}
		room.sendHistory(player, count)

	case "/token":
		room.sessionsMu.Lock()
		session := room.sessions[player.principal.DisplayName()]
		room.sessionsMu.Unlock()

		if session != nil {
			msg := fmt.Sprintf("Your reconnect token:\n")
			msg += fmt.Sprintf("   reconnect:%s:%s\n", player.principal.DisplayName(), session.ReconnectToken)
			select {
			case player.outgoing <- msg:
			default:
			}
		}

	case "/quit":
		announcement := fmt.Sprintf("%s left the chat\n", player.principal.DisplayName())
		room.broadcast <- announcement

		select {
		case player.outgoing <- "Goodbye!\n":
		default:
		}

		time.Sleep(100 * time.Millisecond)
		player.conn.Close(websocket.StatusGoingAway, "player wants to quit")

	default:
		select {
		case player.outgoing <- fmt.Sprintf("Unknown: %s\n", parts[0]):
		default:
		}
	}
}
