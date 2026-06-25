package realtime

import "fmt"


func(r *Room)handleBroadcast(message string) {
	from := "system"
    actualContent := message
	r.messageMu.Lock()
	msg := Message{
		ID: r.nextMessageID,
		From: from,
		Content: actualContent,
		Channel: "global",
	}
	r.nextMessageID++
	r.messages = append(r.messages, msg)
	r.messageMu.Unlock()
	r.mu.Lock()
	players := make([]*Player, 0, len(r.players))
    for player := range r.players {
        players = append(players, player)
    }
    r.totalMessages++
    r.mu.Unlock()
	for _, player := range players {
        select {
        case player.outgoing <- message:
            player.mu.Lock()
            player.messagesSent++
            player.mu.Unlock()
        default:
            fmt.Printf("Skipped %s (channel full)\n", player.principal.DisplayName())
        }
    }
}

func(r *Room)handleJoin(player *Player) {
	r.mu.Lock()
	r.players[player] = true
	r.mu.Unlock()
	player.markActive()
	r.sendHistory(client, 10)
	announcement := fmt.Sprintf("*** %s joined the room ***\n", player.principal.DisplayName())
    r.handleBroadcast(announcement)

}

func(r *Room)handleLeave(player *Player) {
	r.mu.Lock()
	if !r.players[player] {
		r.mu.Unlock()
		return
	}
	delete(r.players, player)
	r.mu.Unlock()
	fmt.Printf("%s left (total: %d)\n", player.principal.DisplayName(), len(r.players))

    // Close channel safely
    select {
    case <-player.outgoing:
        // Already closed
    default:
        close(player.outgoing)
    }

    announcement := fmt.Sprintf("*** %s left the room ***\n", player.principal.DisplayName())
    r.handleBroadcast(announcement)
}


