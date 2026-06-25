package realtime

import "time"
type Message struct {
    ID        int       `json:"id"`
    From      string    `json:"from"`
    Content   string    `json:"content"`
    Timestamp time.Time `json:"timestamp"`
    Channel   string    `json:"channel"` // "global" or "private:username"
}

type DirectMessage struct {
    toClient *Client
    message  string
}