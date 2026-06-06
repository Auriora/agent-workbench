package graph

func Reset(cache *ResponseCache) {
	cache.StoreConfig("reset", "true")
}
