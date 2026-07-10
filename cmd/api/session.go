package main

import (
	"net/http"

	"mithrilTiles.abdulmoiz.net/internal/data"
)

type sessionPrincipal struct {
	Type        data.PrincipalType `json:"type"`
	ID          string             `json:"id"`
	DisplayName string             `json:"display_name"`
	Handle      string             `json:"handle,omitempty"`
	AvatarURL   string             `json:"avatar_url,omitempty"`
	Role        string             `json:"role,omitempty"`
}

func (app *application) handleGetSession(w http.ResponseWriter, r *http.Request) {
	principal := app.contextGetPrincipal(r)
	if !principal.IsAuthenticated() {
		app.authenticationRequiredResponse(w, r)
		return
	}

	responsePrincipal := sessionPrincipal{
		Type:        principal.Type,
		ID:          principal.ID().String(),
		DisplayName: principal.DisplayName(),
	}

	if principal.IsUser() {
		responsePrincipal.Handle = principal.User.Handle
		responsePrincipal.AvatarURL = principal.User.AvatarURL
		responsePrincipal.Role = principal.User.Role
	}

	w.Header().Set("Cache-Control", "no-store")
	err := app.writeJSON(w, http.StatusOK, envelope{
		"principal": responsePrincipal,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
