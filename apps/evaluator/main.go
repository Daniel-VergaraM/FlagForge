package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/daniel-vergaram/flagforge/evaluator/internal/api"
	"github.com/daniel-vergaram/flagforge/evaluator/internal/cache"
)

const shutdownTimeout = 15 * time.Second

func main() {
	redisAddr := getEnv("REDIS_URL", "localhost:6379")
	natsAddr := getEnv("NATS_URL", "nats://localhost:4222")
	port := getEnv("PORT", "3002")

	rdb := cache.NewRedis(redisAddr)
	defer rdb.Close()

	server := api.NewServer(rdb, natsAddr)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Listen(":" + port)
	}()
	log.Printf("evaluator listening on :%s", port)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

	select {
	case err := <-errCh:
		if err != nil {
			log.Fatalf("server error: %v", err)
		}
	case sig := <-sigCh:
		log.Printf("received %s, shutting down gracefully (timeout %s)", sig, shutdownTimeout)
		ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("graceful shutdown error: %v", err)
		}
		log.Println("shutdown complete")
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
