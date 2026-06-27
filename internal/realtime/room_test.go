package realtime

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

func TestBroadcast(t *testing.T) {
	roomTest, err := NewRoomUnitTest("abc")
	if err != nil {

	}
	go roomTest.Run()
	principal1 := data.Principal{
		Type: data.PrincipalUser,
		User: &data.User{
			ID:            uuid.MustParse("11111111-1111-1111-1111-111111111111"),
			DisplayName:   "Test User",
			AccountStatus: "active",
			Handle:        "test-user",
			Email:         "test-user@example.com",
			Activated:     true,
		},
		GuestSession: nil,
	}
	player1 := &Player{
		Principal: principal1,
		Outgoing:  make(chan string, 10),
	}
	principal2 := data.Principal{
		Type: data.PrincipalGuest,
		GuestSession: &data.GuestSession{
			ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
			DisplayName: "Test Guest",
			CreatedAt:   time.Now(),
		},
		User: nil,
	}
	player2 := &Player{
		Principal: principal2,
		Outgoing:  make(chan string, 10),
	}
	select {
	case roomTest.join <- player1:
	}
	select {
	case roomTest.join <- player2:
	}

	time.Sleep(100 * time.Millisecond)
	select {
	case roomTest.broadcast <- "Hi there bros":
	}
	waitForMessage(t, player1.Outgoing,"Hi there bros")
	waitForMessage(t, player2.Outgoing, "Hi there bros")

	// select {
	// case msg := <-player1.Outgoing:
	// 	fmt.Println(msg)
	// 	if !strings.Contains(msg, "Hi") {

	// 		t.Fatal("Player1 didn't receive correct message")
	// 	}
	// case <-time.After(1 * time.Second):
	// 	t.Fatal("Player1 didn't receive message")
	// }
	// select {
	// case msg := <-player2.Outgoing:
	// 	fmt.Println(msg)
	// 	if !strings.Contains(msg, "Hi") {

	// 		t.Fatal("Player2 didn't receive correct message")
	// 	}
	// case <-time.After(1 * time.Second):
	// 	t.Fatal("Player2 didn't receive message")
	// }

}

func waitForMessage(t *testing.T, outgoing <-chan string, expected string) {
	t.Helper()

	timeout := time.After(time.Second)

	for {
		select {
		case msg := <-outgoing:
			if strings.Contains(msg, expected) {
				return
			}
		case <-timeout:
			t.Fatalf("did not receive message containing %q", expected)
		}
	}
}
