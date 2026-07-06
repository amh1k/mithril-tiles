package main

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestRateLimitMiddleware(t *testing.T) {
	newApp := func(rps float64, burst int) *application {
		var cfg config
		cfg.limiter.enabled = true
		cfg.limiter.rps = rps
		cfg.limiter.burst = burst
		return &application{
			config:         cfg,
			requestLimiter: newClientRateLimiter(rps, burst),
		}
	}

	t.Run("allows burst then returns 429", func(t *testing.T) {
		app := newApp(0.01, 2)
		handler := app.rateLimit(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		for requestNumber := 1; requestNumber <= 3; requestNumber++ {
			request := httptest.NewRequest(http.MethodPost, "/v1/users/login", nil)
			request.RemoteAddr = "203.0.113.10:1234"
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)

			if requestNumber <= 2 && response.Code != http.StatusOK {
				t.Fatalf("request %d: expected 200, got %d", requestNumber, response.Code)
			}
			if requestNumber == 3 {
				if response.Code != http.StatusTooManyRequests {
					t.Fatalf("expected 429, got %d", response.Code)
				}
				if response.Header().Get("Retry-After") == "" {
					t.Fatal("expected Retry-After header")
				}
			}
		}
	})

	t.Run("ignores forwarding headers from untrusted peers", func(t *testing.T) {
		app := newApp(0.01, 1)
		handler := app.rateLimit(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		for requestNumber, forwardedIP := range []string{"198.51.100.1", "198.51.100.2"} {
			request := httptest.NewRequest(http.MethodPost, "/v1/users/login", nil)
			request.RemoteAddr = "203.0.113.10:1234"
			request.Header.Set("X-Forwarded-For", forwardedIP)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)

			want := http.StatusOK
			if requestNumber == 1 {
				want = http.StatusTooManyRequests
			}
			if response.Code != want {
				t.Fatalf("request %d: expected %d, got %d", requestNumber+1, want, response.Code)
			}
		}
	})

	t.Run("accepts forwarding headers from trusted proxy", func(t *testing.T) {
		app := newApp(0.01, 1)
		app.config.limiter.trustedProxies = []netip.Prefix{
			netip.MustParsePrefix("192.0.2.0/24"),
		}
		handler := app.rateLimit(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		for _, forwardedIP := range []string{"198.51.100.1", "198.51.100.2"} {
			request := httptest.NewRequest(http.MethodPost, "/v1/users/login", nil)
			request.RemoteAddr = "192.0.2.10:1234"
			request.Header.Set("X-Forwarded-For", forwardedIP)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("expected 200 for client %s, got %d", forwardedIP, response.Code)
			}
		}
	})

	t.Run("disabled limiter passes requests through", func(t *testing.T) {
		app := &application{}
		handler := app.rateLimit(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		for range 10 {
			response := httptest.NewRecorder()
			handler.ServeHTTP(
				response,
				httptest.NewRequest(http.MethodPost, "/v1/users/login", nil),
			)
			if response.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", response.Code)
			}
		}
	})
}

func TestClientRateLimiterConcurrentAccess(t *testing.T) {
	const burst = 10
	limiter := newClientRateLimiter(0.000001, burst)

	var allowed atomic.Int64
	var wg sync.WaitGroup
	for range 100 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if ok, _ := limiter.allow("203.0.113.10"); ok {
				allowed.Add(1)
			}
		}()
	}
	wg.Wait()

	if got := allowed.Load(); got != burst {
		t.Fatalf("expected %d allowed requests, got %d", burst, got)
	}
}

func TestClientRateLimiterCleanup(t *testing.T) {
	now := time.Unix(1_000, 0)
	limiter := newClientRateLimiter(1, 1)
	limiter.now = func() time.Time { return now }

	limiter.allow("203.0.113.1")
	now = now.Add(rateLimiterClientTTL + rateLimiterCleanupInterval)
	limiter.allow("203.0.113.2")

	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	if _, found := limiter.clients["203.0.113.1"]; found {
		t.Fatal("expected inactive client to be removed")
	}
	if len(limiter.clients) != 1 {
		t.Fatalf("expected one active client, got %d", len(limiter.clients))
	}
}

func TestClientRateLimiterRefill(t *testing.T) {
	now := time.Unix(1_000, 0)
	limiter := newClientRateLimiter(1, 1)
	limiter.now = func() time.Time { return now }

	if allowed, _ := limiter.allow("203.0.113.1"); !allowed {
		t.Fatal("expected initial request to be allowed")
	}
	if allowed, _ := limiter.allow("203.0.113.1"); allowed {
		t.Fatal("expected burst to be exhausted")
	}

	now = now.Add(time.Second)
	if allowed, _ := limiter.allow("203.0.113.1"); !allowed {
		t.Fatal("expected bucket to refill after one second")
	}
}

func TestLimiterConfiguration(t *testing.T) {
	var cfg config
	cfg.limiter.enabled = true

	if err := validateLimiterConfig(cfg); err == nil {
		t.Fatal("expected zero limiter configuration to be rejected")
	}
	cfg.limiter.rps = 1
	cfg.limiter.burst = 1
	if err := validateLimiterConfig(cfg); err != nil {
		t.Fatalf("expected valid limiter configuration: %v", err)
	}

	proxies, err := parseTrustedProxyCIDRs("10.0.0.0/8, 192.168.0.0/16")
	if err != nil {
		t.Fatal(err)
	}
	if len(proxies) != 2 {
		t.Fatalf("expected two trusted proxy ranges, got %d", len(proxies))
	}
	if _, err := parseTrustedProxyCIDRs("not-a-cidr"); err == nil {
		t.Fatal("expected invalid proxy CIDR to be rejected")
	}
}
