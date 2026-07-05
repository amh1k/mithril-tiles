package main

import (
	"context"
	"errors"
	"testing"
	"time"

	"mithrilTiles.abdulmoiz.net/internal/data"
)

func TestWebSocketTicketLifecycle(t *testing.T) {
	app, _ := NewTestApplicationE2E(t)
	ctx := context.Background()

	guest, err := app.models.GuestSessions.Insert(&data.GuestSession{
		DisplayName: "Ticket Guest",
	})
	if err != nil {
		t.Fatal(err)
	}
	guestPrincipal := data.NewGuestPrincipal(guest)

	first, err := app.models.WebSocketTickets.Issue(
		ctx,
		guestPrincipal,
		"room-one",
		data.DefaultWebSocketTicketTTL,
	)
	if err != nil {
		t.Fatal(err)
	}
	if first.Plaintext == "" || len(first.Hash) == 0 {
		t.Fatal("expected ticket plaintext and hash")
	}
	if !first.ExpiresAt.After(first.CreatedAt) {
		t.Fatal("expected ticket expiry after creation")
	}

	var stored int
	err = app.models.WebSocketTickets.DB.QueryRow(
		ctx,
		`SELECT count(*) FROM websocket_tickets WHERE hash = $1`,
		first.Hash,
	).Scan(&stored)
	if err != nil {
		t.Fatal(err)
	}
	if stored != 1 {
		t.Fatalf("expected one hashed ticket row, got %d", stored)
	}

	replacement, err := app.models.WebSocketTickets.Issue(
		ctx,
		guestPrincipal,
		"room-one",
		data.DefaultWebSocketTicketTTL,
	)
	if err != nil {
		t.Fatal(err)
	}
	if replacement.Plaintext == first.Plaintext {
		t.Fatal("replacement ticket reused plaintext")
	}
	if _, err := app.models.WebSocketTickets.Consume(
		ctx,
		first.Plaintext,
		"room-one",
	); !errors.Is(err, data.ErrRecordNotFound) {
		t.Fatalf("expected replaced ticket to be invalid, got %v", err)
	}
	if _, err := app.models.WebSocketTickets.Consume(
		ctx,
		replacement.Plaintext,
		"wrong-room",
	); !errors.Is(err, data.ErrRecordNotFound) {
		t.Fatalf("expected wrong-room ticket rejection, got %v", err)
	}

	principal, err := app.models.WebSocketTickets.Consume(
		ctx,
		replacement.Plaintext,
		"room-one",
	)
	if err != nil {
		t.Fatal(err)
	}
	if !principal.IsGuest() || principal.ID() != guest.ID {
		t.Fatal("consumed ticket returned the wrong guest principal")
	}
	if _, err := app.models.WebSocketTickets.Consume(
		ctx,
		replacement.Plaintext,
		"room-one",
	); !errors.Is(err, data.ErrRecordNotFound) {
		t.Fatalf("expected consumed ticket to be single-use, got %v", err)
	}

	expired, err := app.models.WebSocketTickets.Issue(
		ctx,
		guestPrincipal,
		"expired-room",
		10*time.Millisecond,
	)
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(25 * time.Millisecond)
	if _, err := app.models.WebSocketTickets.Consume(
		ctx,
		expired.Plaintext,
		"expired-room",
	); !errors.Is(err, data.ErrRecordNotFound) {
		t.Fatalf("expected expired ticket rejection, got %v", err)
	}

	concurrent, err := app.models.WebSocketTickets.Issue(
		ctx,
		guestPrincipal,
		"concurrent-room",
		data.DefaultWebSocketTicketTTL,
	)
	if err != nil {
		t.Fatal(err)
	}
	results := make(chan error, 2)
	for range 2 {
		go func() {
			_, err := app.models.WebSocketTickets.Consume(
				context.Background(),
				concurrent.Plaintext,
				"concurrent-room",
			)
			results <- err
		}()
	}
	var successes, rejected int
	for range 2 {
		err := <-results
		switch {
		case err == nil:
			successes++
		case errors.Is(err, data.ErrRecordNotFound):
			rejected++
		default:
			t.Fatal(err)
		}
	}
	if successes != 1 || rejected != 1 {
		t.Fatalf(
			"expected one successful and one rejected consumer, got %d and %d",
			successes,
			rejected,
		)
	}

	user := &data.User{
		DisplayName: "Ticket User",
		Handle:      "ticket-user",
		Email:       "ticket-user@example.com",
	}
	if err := user.Password.Set("long-enough-password"); err != nil {
		t.Fatal(err)
	}
	if err := app.models.Users.Insert(user); err != nil {
		t.Fatal(err)
	}
	userTicket, err := app.models.WebSocketTickets.Issue(
		ctx,
		data.NewUserPrincipal(user),
		"user-room",
		data.DefaultWebSocketTicketTTL,
	)
	if err != nil {
		t.Fatal(err)
	}
	userPrincipal, err := app.models.WebSocketTickets.Consume(
		ctx,
		userTicket.Plaintext,
		"user-room",
	)
	if err != nil {
		t.Fatal(err)
	}
	if !userPrincipal.IsUser() || userPrincipal.ID() != user.ID {
		t.Fatal("consumed ticket returned the wrong user principal")
	}

	suspendedTicket, err := app.models.WebSocketTickets.Issue(
		ctx,
		data.NewUserPrincipal(user),
		"suspended-room",
		time.Minute,
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = app.models.Users.DB.Exec(
		ctx,
		`UPDATE users SET account_status = 'suspended' WHERE id = $1`,
		user.ID,
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := app.models.WebSocketTickets.Consume(
		ctx,
		suspendedTicket.Plaintext,
		"suspended-room",
	); !errors.Is(err, data.ErrRecordNotFound) {
		t.Fatalf("expected suspended-user ticket rejection, got %v", err)
	}
	err = app.models.WebSocketTickets.DB.QueryRow(
		ctx,
		`SELECT count(*) FROM websocket_tickets WHERE hash = $1`,
		suspendedTicket.Hash,
	).Scan(&stored)
	if err != nil {
		t.Fatal(err)
	}
	if stored != 0 {
		t.Fatal("expected suspended-user ticket to be consumed")
	}
}
