import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { lookupSession } from "@/features/auth/server/session";
import { roomCodeInputSchema } from "@/features/rooms/room-code";
import { RoomShell } from "@/features/rooms/room-shell";
import { getSessionToken } from "@/lib/auth/session-cookie";

type RoomPageProps = {
  params: Promise<{
    roomCode: string;
  }>;
};

export async function generateMetadata({
  params,
}: RoomPageProps): Promise<Metadata> {
  const parsedRoomCode = roomCodeInputSchema.safeParse(
    (await params).roomCode,
  );

  return {
    title: parsedRoomCode.success
      ? `Room ${parsedRoomCode.data} | Mithril Tiles`
      : "Room | Mithril Tiles",
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const parsedRoomCode = roomCodeInputSchema.safeParse(
    (await params).roomCode,
  );

  if (!parsedRoomCode.success) {
    notFound();
  }

  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  const session = await lookupSession(token);

  if (!session.ok) {
    if (session.error.status === 401) {
      redirect("/login");
    }

    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-xl">
              Session verification unavailable
            </CardTitle>
            <CardDescription>
              Your session could not be verified right now. Please try again
              shortly.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <RoomShell
      principal={session.principal}
      roomCode={parsedRoomCode.data}
    />
  );
}
