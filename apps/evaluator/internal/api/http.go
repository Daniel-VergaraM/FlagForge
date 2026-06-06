package api

import (
	"log"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/valyala/fasthttp/fasthttpadaptor"

	"github.com/daniel-vergaram/flagforge/evaluator/internal/cache"
	"github.com/daniel-vergaram/flagforge/evaluator/internal/evaluator"
	"github.com/daniel-vergaram/flagforge/evaluator/internal/messaging"
)

var (
	evalRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "evaluator_requests_total",
		Help: "Total number of evaluate requests",
	}, []string{"status"})

	evalRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "evaluator_request_duration_seconds",
		Help:    "Evaluate request duration in seconds",
		Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5},
	}, []string{"status"})

	cacheHitsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "evaluator_cache_hits_total",
		Help: "Total number of cache hits",
	})

	cacheMissesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "evaluator_cache_misses_total",
		Help: "Total number of cache misses",
	})
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
	app.Get("/metrics", adaptor(promhttp.Handler()))

	// Subscribe to flag changes via NATS
	go s.subscribeNATS(natsAddr)

	return s
}

func (s *Server) Listen(addr string) error {
	return s.app.Listen(addr)
}

func (s *Server) handleEvaluate(c *fiber.Ctx) error {
	start := time.Now()
	status := "200"

	var req EvaluateRequest
	if err := c.BodyParser(&req); err != nil {
		status = "400"
		evalRequestsTotal.WithLabelValues(status).Inc()
		evalRequestDuration.WithLabelValues(status).Observe(time.Since(start).Seconds())
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}

	cfg, err := s.cache.GetFlag(req.SDKKey, req.FlagKey)
	if err != nil {
		log.Printf("redis error: %v", err)
		status = "500"
		evalRequestsTotal.WithLabelValues(status).Inc()
		evalRequestDuration.WithLabelValues(status).Observe(time.Since(start).Seconds())
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "cache failure", "enabled": false})
	}

	if cfg == nil {
		cacheMissesTotal.Inc()
	} else {
		cacheHitsTotal.Inc()
	}

	enabled, value := evaluator.Evaluate(cfg, req.Context)
	res := EvaluateResponse{Enabled: enabled, Value: value}

	evalRequestsTotal.WithLabelValues(status).Inc()
	evalRequestDuration.WithLabelValues(status).Observe(time.Since(start).Seconds())

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

// adaptor converts a standard http.Handler to a Fiber handler
func adaptor(h interface{}) fiber.Handler {
	switch handler := h.(type) {
	case func(http.ResponseWriter, *http.Request):
		return func(c *fiber.Ctx) error {
			fasthttpadaptor.NewFastHTTPHandler(http.HandlerFunc(handler))(c.Context())
			return nil
		}
	default:
		return func(c *fiber.Ctx) error {
			fasthttpadaptor.NewFastHTTPHandler(handler.(http.Handler))(c.Context())
			return nil
		}
	}
}
