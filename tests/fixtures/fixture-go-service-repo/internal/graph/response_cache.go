package graph

type ResponseCache struct {
	values map[string]string
}

func NewResponseCache() *ResponseCache {
	return &ResponseCache{values: map[string]string{}}
}

func (cache *ResponseCache) LoadConfig(path string) string {
	return cache.values[path]
}

