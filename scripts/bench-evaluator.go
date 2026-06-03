// Run: go run scripts/bench-evaluator.go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

func main() {
	url := "http://localhost:3002/evaluate"
	payload, _ := json.Marshal(map[string]interface{}{
		"sdkKey":  "sdk-dev-001",
		"flagKey": "new-dashboard",
		"context": map[string]interface{}{"user_id": "user-1", "country": "CO"},
	})

	const workers = 100
	const total = 100_000

	var latencies []time.Duration
	var mu sync.Mutex
	var wg sync.WaitGroup

	start := time.Now()
	jobs := make(chan int, total)
	for i := 0; i < total; i++ {
		jobs <- i
	}
	close(jobs)

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			client := &http.Client{Timeout: 5 * time.Second}
			for range jobs {
				reqStart := time.Now()
				resp, err := client.Post(url, "application/json", bytes.NewReader(payload))
				if err == nil {
					resp.Body.Close()
				}
				mu.Lock()
				latencies = append(latencies, time.Since(reqStart))
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	elapsed := time.Since(start)

	var sum time.Duration
	for _, d := range latencies {
		sum += d
	}
	avg := sum / time.Duration(len(latencies))
	fmt.Printf("Requests: %d\n", total)
	fmt.Printf("Duration: %v\n", elapsed)
	fmt.Printf("RPS: %.0f\n", float64(total)/elapsed.Seconds())
	fmt.Printf("Avg latency: %v\n", avg)
}
