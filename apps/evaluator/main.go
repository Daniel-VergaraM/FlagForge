package main

import (
	"log"
	"os"

	"github.com/flagforge/evaluator/internal/api"
	"github.com/flagforge/evaluator/internal/cache"
)

func main() {
	redisAddr := getEnv("REDIS_URL", "localhost:6379")
	natsAddr := getEnv("NATS_URL", "nats://localhost:4222")
	port := getEnv("PORT", "3002")

	rdb := cache.NewRedis(redisAddr)
	defer rdb.Close()

	server := api.NewServer(rdb, natsAddr)
	log.Fatal(server.Listen(":" + port))
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
