package main

import "example.com/go-service/internal/graph"

func main() {
	cache := graph.NewResponseCache()
	cache.StoreConfig("config.yaml", "enabled")
	_ = graph.LoadConfig(cache, "config.yaml")
}
