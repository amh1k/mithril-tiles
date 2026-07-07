import { z } from "zod";

import { roomCodeInputSchema } from "@/features/rooms/room-code";

export const websocketTicketSchema = z.object({
  ticket: z.string().min(1),
  room_code: roomCodeInputSchema,
  expires_at: z.iso.datetime({ offset: true }),
  created_at: z.iso.datetime({ offset: true }),
});

export const websocketTicketResponseSchema = z.object({
  websocket_ticket: websocketTicketSchema,
});

export type WebSocketTicket = z.infer<typeof websocketTicketSchema>;
export type WebSocketTicketResponse = z.infer<
  typeof websocketTicketResponseSchema
>;
