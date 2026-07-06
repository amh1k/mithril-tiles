package realtime

import (
	"reflect"
	"testing"
)

func TestRoomMessageHistoryIsBounded(t *testing.T) {
	room, err := NewRoomUnitTest("bounded-history")
	if err != nil {
		t.Fatal(err)
	}
	room.messages, err = NewRingBuffer[Message](3)
	if err != nil {
		t.Fatal(err)
	}

	for _, message := range []string{"one", "two", "three", "four"} {
		room.handleBroadcast(message)
	}

	history := room.messages.Latest(10)
	if len(history) != 3 {
		t.Fatalf("got %d retained messages, want 3", len(history))
	}

	got := make([]string, len(history))
	for i, message := range history {
		got[i] = message.Content
	}
	want := []string{"two", "three", "four"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got history %v, want %v", got, want)
	}

	if history[0].ID != 1 || history[2].ID != 3 {
		t.Fatalf(
			"message IDs did not remain monotonic after eviction: got %d through %d",
			history[0].ID,
			history[2].ID,
		)
	}
}
