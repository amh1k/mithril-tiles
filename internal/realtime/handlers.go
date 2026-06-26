package realtime

import (
	"encoding/json"
	"fmt"
	"time"
)
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
	r.sendHistory(player, 10)
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

func(r *Room)sendHistory(player *Player, count int) {
	r.messageMu.Lock()
	defer r.messageMu.Unlock()
	start := len(r.messages) - count
    if start < 0 {
        start = 0
    }
	historyMsg := "Recent messages:\n"
    for i := start; i < len(r.messages); i++ {
        msg := r.messages[i]
        historyMsg += fmt.Sprintf(" [%s]: %s\n", msg.From, msg.Content)
    }
	select {
	case player.outgoing <-historyMsg:
	default:
	}


}
func(r *Room)sendUserList(player *Player) {
	r.mu.Lock()
	defer r.mu.Unlock()
	list := "Users online:\n"
	for p := range r.players {
		status := ""
        if p.isInactive(1 * time.Minute) {
            status = " (idle)"
        }
        list += fmt.Sprintf("  - %s%s\n", p.principal.DisplayName(), status)
	}
	list += fmt.Sprintf("\nTotal messages: %d\n", r.totalMessages)
    list += fmt.Sprintf("Uptime: %s\n", time.Since(r.startTime).Round(time.Second))

    select {
    case player.outgoing <- list:
    default:
    }

}

func (r *Room)handleDirectMessage(dm DirectMessage) {
	select {
	case dm.toClient.outgoing <-dm.message :
		dm.toClient.mu.Lock()
        dm.toClient.messagesSent++
        dm.toClient.mu.Unlock()
	default:
        fmt.Printf("Couldn't deliver DM to %s\n", dm.toClient.principal.DisplayName())
	}
}


func(r *Room)findPlayerByUsername(username string) (*Player, error){
	r.mu.Lock()
	defer r.mu.Unlock()
	for player := range r.players {
		if player.principal.DisplayName() == username {
			return player, nil
		}

	}
	err := fmt.Errorf("Username not found")
	return nil, err

}

func(player *Player)markActive() {
	player.mu.Lock()
	defer player.mu.Unlock()
	player.lastActive = time.Now()
}
func (player *Player) isInactive(timeout time.Duration) bool {
    player.mu.Lock()
    defer player.mu.Unlock()
    return time.Since(player.lastActive) > timeout
}





func (r *Room)handleDrawStroke(stroke *DrawStroke) {
	if stroke == nil {
		return
	}
	if r.currentDrawer.principal.DisplayName() != stroke.From {
		return
	}
	r.broadcastStroke(*stroke)
}


func (r* Room)broadcastStroke(stroke DrawStroke) {
	payload := struct {
		Type string     `json:"type"`
		Data DrawStroke `json:"data"`
	}{
		Type: "draw_stroke",
		Data: stroke,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	r.mu.Lock()
	

	players := make([]*Player, 0,len(r.players))
	for p := range r.players {
		players = append(players, p)

	}
	r.mu.Unlock()
	for _,player := range players {
		select {
		case player.outgoing <- string(data):
		default:

		}
	}

}