package realtime

import (
	"fmt"
	"sync"
)

type RoomManager struct {
	mu    sync.Mutex
	rooms map[string]*Room
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}
func (rm *RoomManager) GetOrCreateRoom(roomCode string) (*Room, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, exists := rm.rooms[roomCode]
	if exists {
		return room, nil
	}

	room, err := NewRoom(roomCode)
	if err != nil {
		return nil, err
	}
	rm.rooms[roomCode] = room

	go room.Run()
	// if len(room.players)
	err = fmt.Errorf("Room capacity filled to the brim")
	if !room.canJoin() {
		return nil, err
	}

	return room, nil
}

func (rm *RoomManager) DeleteRoom(roomCode string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	delete(rm.rooms, roomCode)
}
