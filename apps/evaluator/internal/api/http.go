package api

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/flagforge/evaluator/internal/cache"
	"github.com/flagforge/evaluator/internal/evaluator"
	"github.com/flagforge/evaluator/internal/messaging"
)

type Server struct {
	app   *fiber.App
	cache *cache.RedisCache
}

type EvaluateRequest struct {
	SDKKey  string                 `json:"sdkKey"`
	FlagKey string                 `json:"flagKey"`
	Context map[string]interface{} `json:"context"`
}

type EvaluateResponse struct {
	Enabled bool        `json:"enabled"`
	Value   interface{} `json:"value,omitempty"`
}

func NewServer(rdb *cache.RedisCache, natsAddr string) *Server {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})
	app.Use(recover.New())

	s := &Server{app: app, cache: rdb}
	app.Post("/evaluate", s.handleEvaluate)
	app.Get("/health", s.handleHealth)

	// Subscribe to flag changes via NATS
	go s.subscribeNATS(natsAddr)

	return s
}

func (s *Server) Listen(addr string) error {
	return s.app.Listen(addr)
}

func (s *Server) handleEvaluate(c *fiber.Ctx) error {
	var req EvaluateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}

	cfg, err := s.cache.GetFlag(req.SDKKey, req.FlagKey)
	if err != nil {
		log.Printf("redis error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "cache failure", "enabled": false})
	}

	enabled, value := evaluator.Evaluate(cfg, req.Context)
	res := EvaluateResponse{Enabled: enabled, Value: value}
	return c.JSON(res)
}

func (s *Server) handleHealth(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok"})
}

func (s *Server) subscribeNATS(natsAddr string) {
	sub, err := messaging.NewNATSSubscriber(natsAddr, s.cache)
	if err != nil {
		log.Printf("nats subscribe init failed: %v", err)
		return
	}
	defer sub.Close()
	if err := sub.Subscribe(); err != nil {
		log.Printf("nats subscribe error: %v", err)
	}
}
