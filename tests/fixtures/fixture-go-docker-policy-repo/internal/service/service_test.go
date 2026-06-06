package service

import "testing"

func TestRun(t *testing.T) {
	if Run() != "ok" {
		t.Fatal("Run() returned unexpected value")
	}
}
