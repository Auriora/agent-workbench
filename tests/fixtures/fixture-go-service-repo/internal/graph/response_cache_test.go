package graph

import "testing"

func TestResponseCacheLoadConfig(t *testing.T) {
	cache := NewResponseCache()
	cache.StoreConfig(" config.yaml ", "enabled")

	if got := cache.LoadConfig("config.yaml"); got != "enabled" {
		t.Fatalf("LoadConfig() = %q", got)
	}
}
