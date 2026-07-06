package realtime

import (
	"fmt"
	"sync"
)

type RoomManager struct {
	mu                     sync.Mutex
	rooms                  map[string]*Room
	gameLifecycle          GameLifecycle
	messageHistoryCapacity int
}

func NewRoomManager(gameLifecycle GameLifecycle) *RoomManager {
	return NewRoomManagerWithMessageHistoryCapacity(
		gameLifecycle,
		DefaultMessageHistoryCapacity,
	)
}

func NewRoomManagerWithMessageHistoryCapacity(
	gameLifecycle GameLifecycle,
	messageHistoryCapacity int,
) *RoomManager {
	return &RoomManager{
		rooms:                  make(map[string]*Room),
		gameLifecycle:          gameLifecycle,
		messageHistoryCapacity: messageHistoryCapacity,
	}
}
func (rm *RoomManager) GetOrCreateRoom(roomCode string) (*Room, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, exists := rm.rooms[roomCode]
	if exists {
		return room, nil
	}

	room, err := newRoom(
		roomCode,
		rm.gameLifecycle,
		rm.DeleteRoom,
		rm.messageHistoryCapacity,
	) //main way though which we are able to manipulate database in realtime
	if err != nil {
		return nil, err
	}
	rm.rooms[roomCode] = room
	err = fmt.Errorf("Room capacity filled to the brim")
	if !room.canJoin() {
		return nil, err
	}

	go room.Run()
	// if len(room.players)

	return room, nil
}

func (rm *RoomManager) DeleteRoom(roomCode string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	delete(rm.rooms, roomCode)
}
