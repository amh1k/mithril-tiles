package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"

	"github.com/coder/websocket"
)
func main() {
	wsURL := os.Getenv("REALTIME_WS_URL")
	if wsURL == "" {
		wsURL = "ws://localhost:4000/v1/rooms/test-room/ws"
	}

	token := strings.TrimSpace(os.Getenv("REALTIME_AUTH_TOKEN"))
	if token == "" {
		log.Fatal("REALTIME_AUTH_TOKEN must contain a user or guest bearer token")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	headers := http.Header{}
	headers.Set("Authorization", "Bearer "+token)

	conn, response, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{
		HTTPHeader: headers,
	})
	if err != nil {
		if response != nil {
			log.Fatalf("connect to %s: %v (HTTP %s)", wsURL, err, response.Status)
		}
		log.Fatalf("connect to %s: %v", wsURL, err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "player client closed")

	fmt.Printf("Connected to %s\n", wsURL)
	fmt.Println("Enter chat messages, /commands, or /exit to disconnect.")

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

			fmt.Printf("\r%s\n>> ", strings.TrimRight(string(message), "\n"))
		}
	}()

	input := make(chan string)
	go func() {
		scanner := bufio.NewScanner(os.Stdin)
		for scanner.Scan() {
			input <- scanner.Text()
		}
		close(input)
	}()

	fmt.Print(">> ")
	for {
		select {
		case <-ctx.Done():
			return

		case err := <-readDone:
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
				errors.Is(err, context.Canceled) {
				return
			}
			log.Fatalf("WebSocket disconnected: %v", err)

		case message, ok := <-input:
			if !ok {
				return
			}

			message = strings.TrimSpace(message)
			if message == "" {
				fmt.Print(">> ")
				continue
			}
			if message == "/exit" {
				return
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
				log.Fatalf("encode chat event: %v", err)
			}
			if err := conn.Write(ctx, websocket.MessageText, payload); err != nil {
				log.Fatalf("send chat event: %v", err)
			}

			fmt.Print(">> ")
		}
	}
}
