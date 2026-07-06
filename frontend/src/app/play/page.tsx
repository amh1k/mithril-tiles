import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { lookupSession } from "@/features/auth/server/session";
import { getSessionToken } from "@/lib/auth/session-cookie";

export const metadata: Metadata = {
  title: "Play | Mithril Tiles",
};

export default async function PlayPage() {
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
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-xl">Choose your room</CardTitle>
          <CardDescription>
            Welcome back, {session.principal.display_name}. Your session has
            been verified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Room creation and joining are the next implementation step.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
