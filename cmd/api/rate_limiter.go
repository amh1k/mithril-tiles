package main

import (
	"fmt"
	"math"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

const (
	rateLimiterClientTTL       = 3 * time.Minute
	rateLimiterCleanupInterval = time.Minute
)

type rateLimitClient struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type clientRateLimiter struct {
	mu              sync.Mutex
	clients         map[string]*rateLimitClient
	rps             rate.Limit
	burst           int
	clientTTL       time.Duration
	cleanupInterval time.Duration
	lastCleanup     time.Time
	now             func() time.Time
}

func newClientRateLimiter(rps float64, burst int) *clientRateLimiter {
	return &clientRateLimiter{
		clients:         make(map[string]*rateLimitClient),
		rps:             rate.Limit(rps),
		burst:           burst,
		clientTTL:       rateLimiterClientTTL,
		cleanupInterval: rateLimiterCleanupInterval,
		now:             time.Now,
	}
}

func (l *clientRateLimiter) allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if l.lastCleanup.IsZero() || now.Sub(l.lastCleanup) >= l.cleanupInterval {
		for key, client := range l.clients {
			if now.Sub(client.lastSeen) > l.clientTTL {
				delete(l.clients, key)
			}
		}
		l.lastCleanup = now
	}

	client, found := l.clients[key]
	if !found {
		client = &rateLimitClient{
			limiter: rate.NewLimiter(l.rps, l.burst),
		}
		l.clients[key] = client
	}
	client.lastSeen = now

	if client.limiter.AllowN(now, 1) {
		return true, 0
	}

	missingTokens := math.Max(1-client.limiter.TokensAt(now), 0)
	retryAfter := time.Duration(
		(missingTokens / float64(l.rps)) * float64(time.Second),
	)
	if retryAfter < time.Millisecond {
		retryAfter = time.Millisecond
	}
	return false, retryAfter
}

func retryAfterSeconds(retryAfter time.Duration) int {
	seconds := int(math.Ceil(retryAfter.Seconds()))
	if seconds < 1 {
		return 1
	}
	return seconds
}

func validateLimiterConfig(cfg config) error {
	if !cfg.limiter.enabled {
		return nil
	}
	if cfg.limiter.rps <= 0 ||
		math.IsNaN(cfg.limiter.rps) ||
		math.IsInf(cfg.limiter.rps, 0) {
		return fmt.Errorf("limiter-rps must be a finite value greater than zero")
	}
	if cfg.limiter.burst <= 0 {
		return fmt.Errorf("limiter-burst must be greater than zero")
	}
	return nil
}

func parseTrustedProxyCIDRs(value string) ([]netip.Prefix, error) {
	values := strings.Fields(strings.ReplaceAll(value, ",", " "))
	prefixes := make([]netip.Prefix, 0, len(values))

	for _, value := range values {
		prefix, err := netip.ParsePrefix(value)
		if err != nil {
			return nil, fmt.Errorf(
				"invalid trusted proxy CIDR %q: use CIDR notation such as 10.0.0.0/8",
				value,
			)
		}
		prefixes = append(prefixes, prefix.Masked())
	}
	return prefixes, nil
}

func clientIP(r *http.Request, trustedProxies []netip.Prefix) string {
	remoteIP := parseRemoteIP(r.RemoteAddr)
	if !isTrustedProxy(remoteIP, trustedProxies) {
		return remoteIP.String()
	}

	forwardedFor := r.Header.Values("X-Forwarded-For")
	if len(forwardedFor) > 0 {
		chain := strings.Split(strings.Join(forwardedFor, ","), ",")
		current := remoteIP
		for i := len(chain) - 1; i >= 0; i-- {
			candidate, err := netip.ParseAddr(strings.TrimSpace(chain[i]))
			if err != nil {
				return remoteIP.String()
			}
			candidate = candidate.Unmap()
			current = candidate
			if !isTrustedProxy(candidate, trustedProxies) {
				return candidate.String()
			}
		}
		return current.String()
	}

	realIP, err := netip.ParseAddr(strings.TrimSpace(r.Header.Get("X-Real-IP")))
	if err == nil {
		return realIP.Unmap().String()
	}
	return remoteIP.String()
}

func parseRemoteIP(remoteAddress string) netip.Addr {
	host, _, err := net.SplitHostPort(remoteAddress)
	if err != nil {
		host = remoteAddress
	}
	ip, err := netip.ParseAddr(strings.TrimSpace(host))
	if err != nil {
		return netip.Addr{}
	}
	return ip.Unmap()
}

func isTrustedProxy(ip netip.Addr, trustedProxies []netip.Prefix) bool {
	if !ip.IsValid() {
		return false
	}
	for _, prefix := range trustedProxies {
		if prefix.Contains(ip) {
			return true
		}
	}
	return false
}
