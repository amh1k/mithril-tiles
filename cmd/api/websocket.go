package main

import (
	"errors"
	"net/http"

	"github.com/coder/websocket"
	"github.com/julienschmidt/httprouter"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)
func (app *application) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomID := params.ByName("roomID")

	if roomID == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		app.logger.Error("websocket accept failed", "error", err)
		return
	}

	defer conn.Close(websocket.StatusNormalClosure, "connection closed")

	room, err := app.roomManager.GetOrCreateRoom(roomID)
	if err != nil {
		app.serverErrorResponse(w,r,err)
	}

	ctx := r.Context()

	// Temporary username flow.
	// Later replace this with authenticated user from JWT.
	// err = conn.Write(ctx, websocket.MessageText, []byte("Enter username:"))
	// if err != nil {
	// 	return
	// }

	// _, inputBytes, err := conn.Read(ctx)
	// if err != nil {
	// 	return
	// }

	// username := strings.TrimSpace(string(inputBytes))
	// if username == "" {
	// 	username = fmt.Sprintf("Guest%d", time.Now().UnixNano()%1000)
	// }

	// client := chatroom.NewClient(conn, username, roomID)
	// for {
	// 	conn.
	// }
	principal := app.contextGetPrincipal(r)
	realtime.HandlePlayer(conn, room, principal, ctx)
}