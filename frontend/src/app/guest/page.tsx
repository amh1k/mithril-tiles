import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GuestForm } from "@/features/auth/guest-form";

export const metadata: Metadata = {
  title: "Play as a guest | Mithril Tiles",
};

export default function GuestPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Enter the hall</CardTitle>
          <CardDescription>
            Choose a display name to play without creating an account. Guest
            identity and game history are temporary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <GuestForm />
          <p className="text-center text-sm text-muted-foreground">
            Prefer a permanent account?{" "}
            <Link className="text-foreground underline" href="/register">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
