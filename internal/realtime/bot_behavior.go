package realtime

import (
	"strings"
	"time"

	"mithrilTiles.abdulmoiz.net/internal/data"
)

type botBehaviorPolicy struct {
	GuessDelay         time.Duration
	MaxGuessAttempts   int
	MinRevealedLetters int
	DrawStartDelay     time.Duration
	DrawStrokeDelay    time.Duration
	MaxDrawingStrokes  int
}

func behaviorPolicyFor(profile data.BotProfile) botBehaviorPolicy {
	policy := botBehaviorPolicy{
		GuessDelay:         800 * time.Millisecond,
		MaxGuessAttempts:   3,
		MinRevealedLetters: 2,
		DrawStartDelay:     time.Second,
		DrawStrokeDelay:    150 * time.Millisecond,
		MaxDrawingStrokes:  64,
	}

	switch strings.ToLower(strings.TrimSpace(profile.Difficulty)) {
	case "easy":
		policy.GuessDelay = 1200 * time.Millisecond
		policy.MaxGuessAttempts = 1
		policy.MinRevealedLetters = 3
		policy.DrawStartDelay = 1200 * time.Millisecond
		policy.DrawStrokeDelay = 300 * time.Millisecond
		policy.MaxDrawingStrokes = 32
	case "hard":
		policy.GuessDelay = 400 * time.Millisecond
		policy.MaxGuessAttempts = 5
		policy.MinRevealedLetters = 1
		policy.DrawStartDelay = 500 * time.Millisecond
		policy.DrawStrokeDelay = 80 * time.Millisecond
	}

	switch strings.ToLower(strings.TrimSpace(profile.BehaviorStyle)) {
	case "cautious":
		policy.GuessDelay = 1400 * time.Millisecond
		policy.MaxGuessAttempts = min(policy.MaxGuessAttempts, 2)
		policy.MinRevealedLetters = max(policy.MinRevealedLetters, 3)
	case "fast":
		policy.GuessDelay = 350 * time.Millisecond
		policy.MinRevealedLetters = 1
	case "minimalist":
		policy.MaxDrawingStrokes = min(policy.MaxDrawingStrokes, 3)
	case "detailed":
		policy.MaxDrawingStrokes = 64
	}

	return policy
}

func limitDrawingStrokes(strokes []DrawStroke, maximum int) []DrawStroke {
	if maximum <= 0 || len(strokes) == 0 {
		return nil
	}
	if len(strokes) <= maximum {
		return strokes
	}
	if maximum == 1 {
		return []DrawStroke{strokes[0]}
	}

	limited := make([]DrawStroke, maximum)
	for i := range limited {
		limited[i] = strokes[i*(len(strokes)-1)/(maximum-1)]
	}
	return limited
}

func revealedLetterCount(maskedWord string) int {
	count := 0
	for _, character := range maskedWord {
		if character != '_' && character != ' ' {
			count++
		}
	}
	return count
}
