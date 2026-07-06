package realtime

import (
	"reflect"
	"sync"
	"testing"
)

func TestNewRingBufferRejectsInvalidCapacity(t *testing.T) {
	for _, capacity := range []int{-1, 0} {
		if _, err := NewRingBuffer[int](capacity); err == nil {
			t.Fatalf("expected capacity %d to be rejected", capacity)
		}
	}
}

func TestRingBuffer(t *testing.T) {
	buffer, err := NewRingBuffer[int](3)
	if err != nil {
		t.Fatal(err)
	}

	if got := buffer.Latest(3); len(got) != 0 {
		t.Fatalf("expected empty buffer, got %v", got)
	}

	buffer.Add(1)
	buffer.Add(2)
	if got, want := buffer.Latest(10), []int{1, 2}; !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}

	buffer.Add(3)
	if got, want := buffer.Latest(2), []int{2, 3}; !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}

	buffer.Add(4)
	if got, want := buffer.Latest(3), []int{2, 3, 4}; !reflect.DeepEqual(got, want) {
		t.Fatalf("after first wraparound got %v, want %v", got, want)
	}

	buffer.Add(5)
	buffer.Add(6)
	if got, want := buffer.Latest(3), []int{4, 5, 6}; !reflect.DeepEqual(got, want) {
		t.Fatalf("after multiple wraparounds got %v, want %v", got, want)
	}
	if got := buffer.Len(); got != 3 {
		t.Fatalf("got length %d, want 3", got)
	}
	if got := buffer.Capacity(); got != 3 {
		t.Fatalf("got capacity %d, want 3", got)
	}
	if got := buffer.Latest(-1); len(got) != 0 {
		t.Fatalf("expected negative count to return no values, got %v", got)
	}
}

func TestRingBufferLatestReturnsCopy(t *testing.T) {
	buffer, err := NewRingBuffer[int](2)
	if err != nil {
		t.Fatal(err)
	}
	buffer.Add(1)
	buffer.Add(2)

	values := buffer.Latest(2)
	values[0] = 99

	if got, want := buffer.Latest(2), []int{1, 2}; !reflect.DeepEqual(got, want) {
		t.Fatalf("snapshot mutation changed buffer: got %v, want %v", got, want)
	}
}

func TestRingBufferConcurrentAccess(t *testing.T) {
	buffer, err := NewRingBuffer[int](32)
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	for writer := range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for value := range 100 {
				buffer.Add(writer*100 + value)
				_ = buffer.Latest(10)
			}
		}()
	}
	wg.Wait()

	if got := buffer.Len(); got != buffer.Capacity() {
		t.Fatalf("got length %d, want capacity %d", got, buffer.Capacity())
	}
}
