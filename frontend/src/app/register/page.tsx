import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = {
  title: "Register | Mithril Tiles",
};

export default function RegisterPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Forge your identity</CardTitle>
          <CardDescription>
            Create a permanent account for your Mithril Tiles games.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RegisterForm />
          <p className="text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link className="text-foreground underline" href="/login">
              Sign in
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
