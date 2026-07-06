package realtime

import (
	"fmt"
	"sync"
)

const DefaultMessageHistoryCapacity = 100

type RingBuffer[T any] struct {
	mu     sync.RWMutex
	items  []T
	start  int
	length int
}

func NewRingBuffer[T any](capacity int) (*RingBuffer[T], error) {
	if capacity <= 0 {
		return nil, fmt.Errorf("ring buffer capacity must be greater than zero")
	}

	return &RingBuffer[T]{
		items: make([]T, capacity),
	}, nil
}

func (r *RingBuffer[T]) Add(value T) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.length < len(r.items) {
		index := (r.start + r.length) % len(r.items)
		r.items[index] = value
		r.length++
		return
	}

	r.items[r.start] = value
	r.start = (r.start + 1) % len(r.items)
}
func (r *RingBuffer[T]) Latest(count int) []T {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if count <= 0 || r.length == 0 {
		return []T{}
	}
	if count > r.length {
		count = r.length
	}

	values := make([]T, count)
	first := (r.start + r.length - count) % len(r.items)
	for i := range count {
		values[i] = r.items[(first+i)%len(r.items)]
	}
	return values
}

func (r *RingBuffer[T]) Len() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.length
}

func (r *RingBuffer[T]) Capacity() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.items)
}
