import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionToken } from "@/lib/auth/session-cookie";

export const metadata: Metadata = {
  title: "Play | Mithril Tiles",
};

export default async function PlayPage() {
  const token = await getSessionToken();

  if (!token) {
    redirect("/guest");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-xl">Choose your room</CardTitle>
          <CardDescription>
            Your session is ready. Room creation and joining are the next
            implementation step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Identity restoration will become authoritative when the backend
            session endpoint is available.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
