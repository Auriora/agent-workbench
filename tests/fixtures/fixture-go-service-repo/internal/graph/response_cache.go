package graph

import "strings"

type ResponseCache struct {
	values map[string]string
}

func NewResponseCache() *ResponseCache {
	return &ResponseCache{values: map[string]string{}}
}

func (cache *ResponseCache) LoadConfig(path string) string {
	return cache.values[cache.normalizeKey(path)]
}

func (cache *ResponseCache) StoreConfig(path string, value string) {
	cache.values[cache.normalizeKey(path)] = value
}

func (cache *ResponseCache) normalizeKey(path string) string {
	return strings.TrimSpace(path)
}

func LoadConfig(cache *ResponseCache, path string) string {
	return cache.LoadConfig(path)
}
