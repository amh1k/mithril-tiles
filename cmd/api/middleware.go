package main

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/validator"
)

func (app *application) recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			pv := recover()
			if pv != nil {
				w.Header().Set("Connection", "close")
				app.serverErrorResponse(w, r, fmt.Errorf("%v", pv))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (app *application) rateLimit(next http.HandlerFunc) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if app.config.limiter.enabled {
			ip := clientIP(r, app.config.limiter.trustedProxies)
			allowed, retryAfter := app.requestLimiter.allow(ip)
			if !allowed {
				w.Header().Set(
					"Retry-After",
					strconv.Itoa(retryAfterSeconds(retryAfter)),
				)
				app.rateLimitExceededResponse(w, r)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func (app *application) enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		w.Header().Add("Vary", "Access-Control-Request-Method")
		origin := r.Header.Get("Origin")
		if origin != "" && app.isTrustedOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			if r.Method == http.MethodOptions &&
				r.Header.Get("Access-Control-Request-Method") != "" {
				w.Header().Set(
					"Access-Control-Allow-Methods",
					"GET, POST, PATCH, DELETE, OPTIONS",
				)
				w.Header().Set(
					"Access-Control-Allow-Headers",
					"Authorization, Content-Type",
				)
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func (app *application) isTrustedOrigin(origin string) bool {
	for _, trustedOrigin := range app.config.cors.trustedOrigins {
		if strings.EqualFold(origin, trustedOrigin) {
			return true
		}
	}
	return false
}

func (app *application) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Authorization")
		authorizationHeader := r.Header.Get("Authorization")

		if authorizationHeader == "" {
			r = app.contextSetPrincipal(r, data.AnonymousPrincipal)
			next.ServeHTTP(w, r)
			return
		}
		headerParts := strings.Split(authorizationHeader, " ")
		if len(headerParts) != 2 || headerParts[0] != "Bearer" {
			app.invalidAuthenticationTokenResponse(w, r)
			return
		}
		token := headerParts[1]
		v := validator.New()
		if data.ValidateTokenPlaintext(v, token); !v.Valid() {
			app.invalidAuthenticationTokenResponse(w, r)
			return
		}

		user, err := app.models.Users.GetForToken(data.ScopeAuthentication, token)
		if err == nil {
			r = app.contextSetPrincipal(r, data.NewUserPrincipal(user))
			next.ServeHTTP(w, r)
			return
		}
		if !errors.Is(err, data.ErrRecordNotFound) {
			app.serverErrorResponse(w, r, err)
			return
		}
		guestSession, err := app.models.GuestSessions.GetForToken(data.ScopeGuest, token)
		if err == nil {
			r = app.contextSetPrincipal(r, data.NewGuestPrincipal(guestSession))
			next.ServeHTTP(w, r)
			return
		}
		if errors.Is(err, data.ErrRecordNotFound) {
			app.invalidAuthenticationTokenResponse(w, r)
			return
		}

		app.serverErrorResponse(w, r, err)
	})
}

func (app *application) requireAuthenticatedPrincipal(next http.HandlerFunc) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal := app.contextGetPrincipal(r)
		if !principal.IsAuthenticated() {
			app.authenticationRequiredResponse(w, r)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (app *application) requireRegisteredUser(next http.HandlerFunc) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal := app.contextGetPrincipal(r)
		if !principal.IsUser() {
			app.authenticationRequiredResponse(w, r)
			return
		}

		next.ServeHTTP(w, r)
	})
}
