package main

import (
	"context"
	"net/http"

	"mithrilTiles.abdulmoiz.net/internal/data"
)
type contextKey string
const principalContextKey = contextKey("principal")
func (app *application) contextSetPrincipal(r *http.Request, principal *data.Principal) *http.Request {
	ctx := context.WithValue(r.Context(), principalContextKey, principal)
	return r.WithContext(ctx)
}

func (app *application) contextGetPrincipal(r *http.Request) *data.Principal {
	principal, ok := r.Context().Value(principalContextKey).(*data.Principal)
	if !ok {
		panic("missing principal value in request context")
	}
	return principal
}
