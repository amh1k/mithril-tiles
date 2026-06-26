package realtime

type DrawStroke struct {
	From      string  `json:"from"`
	RoomCode  string  `json:"room_code"`
	FromX     float64 `json:"from_x"`
	FromY     float64 `json:"from_y"`
	ToX       float64 `json:"to_x"`
	ToY       float64 `json:"to_y"`
	Color     string  `json:"color"`
	BrushSize float64 `json:"brush_size"`
}
