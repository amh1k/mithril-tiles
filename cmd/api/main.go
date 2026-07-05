package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"log/slog"
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
}
type application struct {
	config      config
	logger      *slog.Logger
	models      data.Models
	wg          sync.WaitGroup
	roomManager *realtime.RoomManager
}

func main() {
	var cfg config
	var corsTrustedOrigins string
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	flag.IntVar(&cfg.port, "port", 4000, "API server port")
	flag.StringVar(&cfg.env, "env", "development", "Environment (development|staging|production)")
	flag.StringVar(&cfg.db.dsn,
		"db-dsn",
		os.Getenv("DATABASE_URL"),
		"PostgreSQL DSN",
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
	cfg.cors.trustedOrigins, err = parseTrustedOrigins(corsTrustedOrigins)
	if err != nil {
		log.Fatal(err)
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
	roomManager := realtime.NewRoomManager(gameLifecycle)
	app := &application{
		config:      cfg,
		logger:      logger,
		models:      models,
		roomManager: roomManager,
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
