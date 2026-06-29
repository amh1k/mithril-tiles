package main

import (
	"context"
	"log"
	"log/slog"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/joho/godotenv"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)
func NewTestApplicationE2E(t *testing.T) (*application, *httptest.Server){
	var cfg config
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	ctx := context.Background()
	container, err := tcpostgres.Run(
		ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("mithril_test"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		// tcpostgres.WithInitScripts(migrations...),
		tcpostgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Fatal(err)
	}
	testcontainers.CleanupContainer(t, container)

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}

	cfg.port= 4000
	cfg.env="development"
	cfg.db.dsn= dsn
	cfg.db.maxOpenConns = 25
	cfg.db.maxIdleConns=  25
	cfg.db.maxIdleTime= 15*time.Minute
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	
	db, err := openDB(cfg, ctx)
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
	runMigrations(cfg.db.dsn)
	defer db.Close(ctx)
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
	ts := httptest.NewServer(app.routes())
	return app, ts
}