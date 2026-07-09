package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"golang.org/x/sync/errgroup"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

// curl -X POST http://localhost:4000/v1/guest-sessions \
//   -H "Content-Type: application/json" \
//   -d '{"display_name":"Player One"}'

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

	connectionCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	player := &Player{
		Conn:           conn,
		Principal:      *principal,
		Outgoing:       make(chan string, 10),
		LastActive:     time.Now(),
		ReconnectToken: uuid.NewString(),
		cancel:         cancel,
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
	if err := conn.Write(connectionCtx, websocket.MessageText, []byte(welcomeMessage)); err != nil {
		return
	}
	joinResult := make(chan error, 1)
	select {
	case room.join <- joinRequest{player: player, result: joinResult}:
	case <-connectionCtx.Done():
		return
	case <-room.done:
		return
	}
	select {
	case err := <-joinResult:
		if err != nil {
			return
		}
	case <-connectionCtx.Done():
		return
	case <-room.done:
		return
	}
	select {
	case room.snapshot <- snapshotRequest{player: player}:
	case <-connectionCtx.Done():
		return
	case <-room.done:
		return
	}
	defer func() {
		player.unregister(room)
	}()

	group, groupCtx := errgroup.WithContext(connectionCtx)
	group.Go(func() error {
		return readMessages(player, room, username, groupCtx)
	})
	group.Go(func() error {
		return writeMessages(player, groupCtx, username)
	})
	group.Go(func() error {
		select {
		case <-groupCtx.Done():

			return groupCtx.Err()
		case <-room.done:
			return fmt.Errorf("room closed")
		}
	})

	_ = group.Wait()
	room.updateSessionActivity(username)
}

func buildWelcomeMessage(username string) string {
	msg := fmt.Sprintf("Welcome, %s!\n", username)
	return msg
}

func readMessages(player *Player, room *Room, username string, ctx context.Context) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("panic in readMessages for %s: %v", username, recovered)
		}
	}()

	for {
		_, data, err := player.Conn.Read(ctx)
		if err != nil {
			return err
		}
		var event IncomingEvent
		if err := json.Unmarshal(data, &event); err != nil {
			continue
		}
		switch event.Type {
		case "chat_message":
			var message string
			if err := json.Unmarshal(event.Data, &message); err != nil {
				continue
			}
			player.markActive()
			message = strings.TrimSpace(message)

			if message == "" {
				continue
			}
			player.Mu.Lock()
			player.MessagesRecv++
			player.Mu.Unlock()
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
			room.mu.Lock()
			if room.RoundState == RoundStateIdle {
				room.mu.Unlock()
				return nil

			}
			room.mu.Unlock()

			stroke.From = player.Principal.DisplayName()
			stroke.RoomCode = room.roomCode
			room.drawStroke <- stroke

		}

	}
}

func writeMessages(player *Player, ctx context.Context, username string) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("panic in writeMessages for %s: %v", username, recovered)
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case message, ok := <-player.Outgoing:
			if !ok {
				return nil
			}
			if err := player.Conn.Write(ctx, websocket.MessageText, []byte(message)); err != nil {
				return fmt.Errorf("write message for %s: %w", username, err)
			}
		}
	}
}

func handleCommand(player *Player, room *Room, command string) {
	// fmt.Println("handle command check")
	parts := strings.Fields(command)
	if len(parts) == 0 {
		return
	}

	switch parts[0] {
	case "/players":
		room.listPlayers <- player

	case "/stats":
		player.Mu.Lock()
		stats := fmt.Sprintf("Your Stats:\n")
		stats += fmt.Sprintf("  Messages sent: %d\n", player.MessagesSent)
		stats += fmt.Sprintf("  Messages received: %d\n", player.MessagesRecv)
		stats += fmt.Sprintf("  Last active: %s ago\n",
			time.Since(player.LastActive).Round(time.Second))
		player.Mu.Unlock()

		select {
		case player.Outgoing <- stats:
		default:
		}

	case "/msg":
		if len(parts) < 3 {
			select {
			case player.Outgoing <- "Usage: /msg <username> <message>\n":
			default:
			}
			return
		}

		targetUsername := parts[1]
		messageText := strings.Join(parts[2:], " ")

		targetplayer, err := room.findPlayerByUsername(targetUsername)
		if err != nil {
			select {
			case player.Outgoing <- fmt.Sprintf("User '%s' not found\n", targetUsername):
			default:
			}
			return
		}

		privateMsg := fmt.Sprintf("[From %s]: %s\n", player.Principal.DisplayName(), messageText)
		select {
		case targetplayer.Outgoing <- privateMsg:
		default:
			select {
			case player.Outgoing <- fmt.Sprintf("%s's inbox is full\n", targetUsername):
			default:
			}
			return
		}

		select {
		case player.Outgoing <- fmt.Sprintf("Message sent to %s\n", targetUsername):
		default:
		}

	case "/history":
		count := 20
		if len(parts) > 1 {
			if _, err := fmt.Sscanf(parts[1], "%d", &count); err != nil {
				select {
				case player.Outgoing <- "Usage: /history [count]\n":
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
		session := room.sessions[player.Principal.DisplayName()]
		room.sessionsMu.Unlock()

		if session != nil {
			msg := fmt.Sprintf("Your reconnect token:\n")
			msg += fmt.Sprintf("   reconnect:%s:%s\n", player.Principal.DisplayName(), session.ReconnectToken)
			select {
			case player.Outgoing <- msg:
			default:
			}
		}

	case "/quit":
		announcement := fmt.Sprintf("%s left the chat\n", player.Principal.DisplayName())
		room.broadcast <- announcement

		select {
		case player.Outgoing <- "Goodbye!\n":
		default:
		}

		time.Sleep(100 * time.Millisecond)
		player.Conn.Close(websocket.StatusGoingAway, "player wants to quit")

	case "/guess":
		if len(parts) < 2 {
			select {
			case player.Outgoing <- "Usage: /guess <word>\n":
			default:
			}
			return
		}
		room.mu.Lock()
		if room.RoundState == RoundStateIdle {
			select {
			case player.Outgoing <- "Round isnt active yet so no need to guess":

			default:
			}
			room.mu.Unlock()
			return

		}
		targetWord := room.currentWord
		room.mu.Unlock()
		guessedWord := parts[1]
		if targetWord != guessedWord {
			select {
			case player.Outgoing <- "Wrong Guess":
			default:
			}
		} else {
			
				room.handleCorrectGuess(player)

			
		}
	default:
		select {
		case player.Outgoing <- fmt.Sprintf("Unknown: %s\n", parts[0]):
		default:
		}
	}
}
