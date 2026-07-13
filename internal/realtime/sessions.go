package realtime

import (
	"fmt"
	"time"
)

type SessionInfo struct {
	Username       string
	ReconnectToken string
	LastSeen       time.Time
	CreatedAt      time.Time
}

// can aslo map principal to sessions instead of username to sessio
// might implement in the future
func (r *Room) createSession(username string) (*SessionInfo, error) {
	r.sessionsMu.Lock()
	defer r.sessionsMu.Unlock()
	tok := GenerateToken()
	session := &SessionInfo{
		Username:       username,
		ReconnectToken: tok,
		LastSeen:       time.Now(),
		CreatedAt:      time.Now(),
	}
	r.sessions[username] = session
	fmt.Printf("Created session for %s (token: %s...)\n", username, tok[:8])

	return session, nil
}

func (r *Room) validateReconnectToken(username, token string) bool {
	r.sessionsMu.Lock()
	defer r.sessionsMu.Unlock()
	session, exists := r.sessions[username]
	if !exists {
		return false
	}

	if session.ReconnectToken != token {
		return false
	}

	if time.Since(session.LastSeen) > 1*time.Hour {
		delete(r.sessions, username)
		return false
	}
	session.LastSeen = time.Now()

	return true
}

func (r *Room) updateSessionActivity(username string) {
	r.sessionsMu.Lock()
	defer r.sessionsMu.Unlock()
	if session, exists := r.sessions[username]; exists {
		session.LastSeen = time.Now()
	}
}
func (r *Room) isUsernameConnected(username string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	for player := range r.players {
		if player.Principal.DisplayName() == username {
			return true
		}
	}

	return false
}

func (r *Room) cleanupInactiveplayers() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			r.mu.Lock()
			var toRemove []*Player
			for player := range r.players {
				if player.isInactive(5 * time.Minute) && player.Type != botPlayer {
					fmt.Printf("Removing inactive: %s\n", player.Principal.DisplayName())
					toRemove = append(toRemove, player)
				}
			}
			r.mu.Unlock()
			for _, player := range toRemove {
				player.unregister(r)
			}
		case <-r.done:
			return

		}
	}
}
