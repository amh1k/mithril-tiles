import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in | Mithril Tiles",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Return to the hall</CardTitle>
          <CardDescription>
            Sign in to use your registered Mithril Tiles identity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LoginForm />
          <p className="text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <Link className="text-foreground underline" href="/register">
              Register
            </Link>
            {" · "}
            <Link className="text-foreground underline" href="/guest">
              Play as a guest
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
