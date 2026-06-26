package realtime

import (
	"fmt"
	"time"
)

// can aslo map principal to sessions instead of username to sessio
// might implement in the future
func(r *Room)createSession(username string)(*SessionInfo, error) {
	r.sessionsMu.Lock()
	defer r.sessionsMu.Unlock()
	tok := token.GenerateToken()
	session := &session {
		Username:       username,
        ReconnectToken: tok,
        LastSeen:       time.Now(),
        CreatedAt:      time.Now(),
	}
	r.sessions[username] = session
	fmt.Printf("Created session for %s (token: %s...)\n", username, tok[:8])

    return session, nil
}


func(r *Room)validateReconnectToken(username, token string)bool {
	r.sessions.Lock()
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

func(r *Room)updateSessionActivity(username string ) bool {
	r.sessions.Lock()
	defer r.sessionsMu.Unlock()
    if session, exists := r.sessions[username]; exists {
        session.LastSeen = time.Now()
    }
}
