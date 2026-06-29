package main

import (
	"context"
	"log/slog"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)

func NewTestApplicationE2E(t *testing.T) (*application, *httptest.Server) {
	t.Helper()

	ctx := context.Background()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve test utility path")
	}

	migrations, err := filepath.Glob(
		filepath.Join(filepath.Dir(filename), "..", "..", "migrations", "*.up.sql"),
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(migrations) == 0 {
		t.Fatal("no database migrations found")
	}
	sort.Strings(migrations)

	container, err := tcpostgres.Run(
		ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("mithril_test"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		tcpostgres.WithInitScripts(migrations...),
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

	var cfg config
	cfg.env = "test"
	cfg.db.dsn = dsn
	cfg.db.maxOpenConns = 5
	cfg.db.minIdleConns = 1
	cfg.db.maxIdleTime = time.Minute

	db, err := openDB(cfg, ctx)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		db.Close()
	})

	models := data.NewModels(db)
	gameLifecycle := newGameLifecycleService(models)
	roomManager := realtime.NewRoomManager(gameLifecycle)
	app := &application{
		config:      cfg,
		logger:      slog.New(slog.NewTextHandler(os.Stdout, nil)),
		models:      models,
		roomManager: roomManager,
	}

	server := httptest.NewServer(app.routes())
	t.Cleanup(server.Close)

	return app, server
}
