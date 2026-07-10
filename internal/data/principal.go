package data

import "github.com/google/uuid"

type PrincipalType string

const (
	PrincipalAnonymous PrincipalType = "anonymous"
	PrincipalUser      PrincipalType = "user"
	PrincipalGuest     PrincipalType = "guest"
)

type Principal struct {
	Type         PrincipalType
	User         *User
	GuestSession *GuestSession
}

var AnonymousPrincipal = &Principal{
	Type: PrincipalAnonymous,
}

func NewUserPrincipal(user *User) *Principal {
	return &Principal{
		Type: PrincipalUser,
		User: user,
	}
}

func NewGuestPrincipal(guestSession *GuestSession) *Principal {
	return &Principal{
		Type:         PrincipalGuest,
		GuestSession: guestSession,
	}
}

func (p *Principal) IsAuthenticated() bool {
	return p != nil && (p.IsUser() || p.IsGuest())
}

func (p *Principal) IsUser() bool {
	return p != nil && p.Type == PrincipalUser && p.User != nil
}

func (p *Principal) IsGuest() bool {
	return p != nil && p.Type == PrincipalGuest && p.GuestSession != nil
}

func (p *Principal) IsAdmin() bool {
	return p.IsUser() && p.User.Role == UserRoleAdmin
}

func (p *Principal) ID() uuid.UUID {
	switch {
	case p.IsUser():
		return p.User.ID
	case p.IsGuest():
		return p.GuestSession.ID
	default:
		return uuid.Nil
	}
}

func (p *Principal) DisplayName() string {
	switch {
	case p.IsUser():
		return p.User.DisplayName
	case p.IsGuest():
		return p.GuestSession.DisplayName
	default:
		return ""
	}
}
