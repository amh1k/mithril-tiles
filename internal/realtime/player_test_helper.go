package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/coder/websocket"
)

type TestPlayer struct {
	Send    chan string
	Receive chan string
	Ready   chan struct{}
	Errors  chan error
	Cancel  context.CancelFunc
}

func StartPlayer(wsURL string, token string) *TestPlayer {
	ctx, cancel := context.WithCancel(context.Background())
	player := &TestPlayer{
		Send:    make(chan string, 200),
		Receive: make(chan string, 200),
		Ready:   make(chan struct{}),
		Errors:  make(chan error, 1),
		Cancel:  cancel,
	}

	go player.run(ctx, wsURL, token)

	return player
}

func (p *TestPlayer) run(ctx context.Context, wsURL string, token string) {
	headers := http.Header{}
	headers.Set("Authorization", "Bearer "+token)
	fmt.Println("Hello boy")
	conn, response, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{
		HTTPHeader: headers,
	})
	if err != nil {
		if response != nil {
			p.reportError(fmt.Errorf(
				"connect to %s: %w (HTTP %s)",
				wsURL,
				err,
				response.Status,
			))
			return
		}
		p.reportError(fmt.Errorf("connect to %s: %w", wsURL, err))
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "test player closed")

	close(p.Ready)

	readDone := make(chan error, 1)
	go func() {
		for {
			messageType, message, err := conn.Read(ctx)
			if err != nil {
				readDone <- err
				return
			}
			if messageType != websocket.MessageText {
				continue
			}

			select {
			case p.Receive <- strings.TrimRight(string(message), "\n"):
			case <-ctx.Done():
				return
			}
		}
	}()
	for {
		select {
		case <-ctx.Done():
			return
		case err := <-readDone:
			if websocket.CloseStatus(err) != websocket.StatusNormalClosure &&
				!errors.Is(err, context.Canceled) {
				p.reportError(fmt.Errorf("WebSocket disconnected: %w", err))
			}
			return

		case message, ok := <-p.Send:
			if !ok {
				return
			}

			message = strings.TrimSpace(message)
			if message == "" {
				continue
			}

			event := struct {
				Type string `json:"type"`
				Data string `json:"data"`
			}{
				Type: "chat_message",
				Data: message,
			}

			payload, err := json.Marshal(event)
			if err != nil {
				p.reportError(fmt.Errorf("encode chat event: %w", err))
				return
			}
			if err := conn.Write(ctx, websocket.MessageText, payload); err != nil {
				p.reportError(fmt.Errorf("send chat event: %w", err))
				return
			}
		}
	}
}

func (p *TestPlayer) reportError(err error) {
	select {
	case p.Errors <- err:
	default:
	}
}
