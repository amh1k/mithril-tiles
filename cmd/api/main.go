package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"log/slog"
	"net/netip"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)

type config struct {
	port int
	env  string
	db   struct {
		dsn          string
		maxOpenConns int
		minIdleConns int
		maxIdleTime  time.Duration
	}

	cors struct {
		trustedOrigins []string
	}
	limiter struct {
		rps            float64
		burst          int
		enabled        bool
		trustedProxies []netip.Prefix
	}
	realtime struct {
		messageHistoryCapacity int
		geminiAPIKey           string
	}
}
type application struct {
	config         config
	logger         *slog.Logger
	models         data.Models
	wg             sync.WaitGroup
	roomManager    *realtime.RoomManager
	requestLimiter *clientRateLimiter
}

func main() {
	var cfg config
	var corsTrustedOrigins string
	var trustedProxies string
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		log.Fatalf("load .env: %v", err)
	}
	var err error
	flag.IntVar(&cfg.port, "port", 4000, "API server port")
	flag.StringVar(&cfg.env, "env", "development", "Environment (development|staging|production)")
	flag.StringVar(&cfg.db.dsn,
		"db-dsn",
		os.Getenv("DATABASE_URL"),
		"PostgreSQL DSN",
	)
	flag.Float64Var(&cfg.limiter.rps, "limiter-rps", 2, "Rate limiter maximum requests per second")
	flag.IntVar(&cfg.limiter.burst, "limiter-burst", 4, "Rate limiter maximum burst")
	flag.BoolVar(&cfg.limiter.enabled, "limiter-enabled", true, "Enable rate limiter")
	flag.IntVar(
		&cfg.realtime.messageHistoryCapacity,
		"message-history-capacity",
		realtime.DefaultMessageHistoryCapacity,
		"Maximum number of messages retained per room",
	)
	flag.StringVar(
		&trustedProxies,
		"limiter-trusted-proxies",
		os.Getenv("RATE_LIMIT_TRUSTED_PROXIES"),
		"Trusted reverse-proxy CIDRs (comma separated)",
	)
	flag.IntVar(&cfg.db.maxOpenConns, "db-max-open-conns", 25, "PostgreSQL max open connections")
	flag.IntVar(&cfg.db.minIdleConns, "db-min-idle-conns", 2, "PostgreSQL minimum idle connections")
	flag.DurationVar(&cfg.db.maxIdleTime, "db-max-idle-time", 15*time.Minute, "PostgreSQL max connection idle time")
	flag.StringVar(
		&corsTrustedOrigins,
		"cors-trusted-origins",
		os.Getenv("CORS_TRUSTED_ORIGINS"),
		"Trusted CORS origins (comma separated)",
	)
	flag.Parse()
	cfg.realtime.geminiAPIKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	cfg.cors.trustedOrigins, err = parseTrustedOrigins(corsTrustedOrigins)
	if err != nil {
		log.Fatal(err)
	}
	cfg.limiter.trustedProxies, err = parseTrustedProxyCIDRs(trustedProxies)
	if err != nil {
		log.Fatal(err)
	}
	if err := validateLimiterConfig(cfg); err != nil {
		log.Fatal(err)
	}
	if cfg.realtime.messageHistoryCapacity <= 0 {
		log.Fatal("message-history-capacity must be greater than zero")
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	ctx := context.Background()
	db, err := openDB(cfg, ctx)
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
	runMigrations(cfg.db.dsn)

	defer db.Close()
	logger.Info("database connection pool established")
	models := data.NewModels(db)
	gameLifecycle := newGameLifecycleService(models)
	roomManager := realtime.NewRoomManagerWithMessageHistoryCapacity(
		gameLifecycle,
		cfg.realtime.messageHistoryCapacity,
	)
	if cfg.realtime.geminiAPIKey != "" {
		roomManager.SetGuessProvider(realtime.GeminiGuessProvider{
			APIKey: cfg.realtime.geminiAPIKey,
		})
		roomManager.SetDrawingProvider(realtime.GeminiDrawingProvider{
			APIKey: cfg.realtime.geminiAPIKey,
		})
		logger.Info("Gemini bot providers enabled")
	}
	app := &application{
		config:         cfg,
		logger:         logger,
		models:         models,
		roomManager:    roomManager,
		requestLimiter: newClientRateLimiter(cfg.limiter.rps, cfg.limiter.burst),
	}
	err = app.serve()
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
}

func parseTrustedOrigins(value string) ([]string, error) {
	values := strings.Fields(strings.ReplaceAll(value, ",", " "))
	origins := make([]string, 0, len(values))

	for _, value := range values {
		origin, err := url.Parse(value)
		if err != nil ||
			(origin.Scheme != "http" && origin.Scheme != "https") ||
			origin.Host == "" ||
			origin.User != nil ||
			origin.Path != "" ||
			origin.RawQuery != "" ||
			origin.Fragment != "" {
			return nil, fmt.Errorf(
				"invalid trusted origin %q: use a full HTTP origin such as https://app.example.com",
				value,
			)
		}
		origins = append(origins, origin.Scheme+"://"+origin.Host)
	}

	return origins, nil
}

func openDB(cfg config, ctx context.Context) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.db.dsn)
	if err != nil {
		return nil, fmt.Errorf("parse database configuration: %w", err)
	}

	poolConfig.MaxConns = int32(cfg.db.maxOpenConns)
	poolConfig.MinIdleConns = int32(cfg.db.minIdleConns)
	poolConfig.MaxConnIdleTime = cfg.db.maxIdleTime

	db, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("create database pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := db.Ping(pingCtx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	fmt.Println("Connection established")

	return db, nil

}
