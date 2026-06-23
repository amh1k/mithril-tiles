package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

type config struct {
	port int
	env  string
	db   struct {
		dsn          string
		maxOpenConns int
		maxIdleConns int
		maxIdleTime  time.Duration
	}
	
	cors struct {
		trustedOrigins []string
	}
}
type application struct {
	config config
	logger *slog.Logger
	models data.Models
	wg sync.WaitGroup

}
func main() {
	var cfg config
	flag.IntVar(&cfg.port, "port", 4000, "API server port")
	flag.StringVar(&cfg.env, "env", "development", "Environment (development|staging|production)")
	flag.StringVar(&cfg.db.dsn,
		"db-dsn",
		os.Getenv("DATABASE_URL"),
		"PostgreSQL DSN",
	)
	flag.IntVar(&cfg.db.maxOpenConns, "db-max-open-conns", 25, "PostgreSQL max open connections")
	flag.IntVar(&cfg.db.maxIdleConns, "db-max-idle-conns", 25, "PostgreSQL max idle connections")
	flag.DurationVar(&cfg.db.maxIdleTime, "db-max-idle-time", 15*time.Minute, "PostgreSQL max connection idle time")
	flag.Parse()
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	db, err := openDB(cfg)
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
	ctx := context.Background()
	defer db.Close(ctx)
	logger.Info("database connection pool established")
	app := &application{
		config: cfg,
		logger: logger,
		models: data.NewModels(),
	}
	err = app.serve()
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}




}




func openDB(cfg config)(*pgx.Conn, error) {
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, cfg.db.dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to connect to database: %v\n", err)
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = conn.Ping(ctx)
	if err != nil {
		conn.Close(ctx)
		return nil, err
	}
	fmt.Println("Connection established")
	return conn, nil

}