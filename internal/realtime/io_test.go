package realtime

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

func TestWriteMessagesStopsWhenContextIsCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	player := &Player{
		Outgoing: make(chan string),
	}

	done := make(chan error, 1)
	go func() {
		done <- writeMessages(player, ctx, "test-player")
	}()

	cancel()

	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected context cancellation, got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("writer did not stop after context cancellation")
	}
}

func TestPlayerUnregistersOnlyOnce(t *testing.T) {
	room := &Room{
		leave: make(chan *Player, 2),
		done:  make(chan struct{}),
	}
	player := &Player{}
	player.unregister(room)
	player.unregister(room)

	if got := len(room.leave); got != 1 {
		t.Fatalf("expected one leave event, got %d", got)
	}
}

func TestHandlePlayerStopsAfterClientDisconnect(t *testing.T) {
	room, err := NewRoomUnitTest("disconnect-test")
	if err != nil {
		t.Fatal(err)
	}
	go room.Run()
	t.Cleanup(func() {
		room.close()
	})

	principal := data.NewGuestPrincipal(&data.GuestSession{
		ID:          uuid.New(),
		DisplayName: "Disconnecting Player",
	})
	handlerDone := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			t.Error(err)
			return
		}
		HandlePlayer(conn, room, principal, r.Context())
		close(handlerDone)
	}))
	t.Cleanup(server.Close)

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client, _, err := websocket.Dial(context.Background(), wsURL, nil)
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, _, err := client.Read(ctx); err != nil {
		t.Fatalf("read welcome message: %v", err)
	}
	if err := client.CloseNow(); err != nil {
		t.Fatal(err)
	}

	select {
	case <-handlerDone:
	case <-time.After(time.Second):
		t.Fatal("player handler did not stop after client disconnect")
	}
}
