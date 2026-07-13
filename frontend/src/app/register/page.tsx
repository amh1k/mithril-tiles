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
import { redirectAuthenticatedPrincipal } from "@/features/auth/server/session";

export const metadata: Metadata = {
  title: "Register | Mithril Tiles",
};

export default async function RegisterPage() {
  await redirectAuthenticatedPrincipal();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <section className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-[#946440]/45 bg-[#2b1e12]/65 shadow-[0_28px_90px_rgba(43,30,18,0.4)] backdrop-blur-[2px] md:grid-cols-[1.15fr_0.85fr]">
        <div className="relative min-h-64 overflow-hidden border-b border-[#bba88d]/25 p-6 md:min-h-[44rem] md:border-r md:border-b-0 md:p-10">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/images/tree.jpg')" }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#2b1e12]/90 via-[#2b1e12]/15 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute inset-x-6 bottom-6 max-w-md md:inset-x-10 md:bottom-10">
            <p className="font-heading text-sm uppercase tracking-[0.24em] text-[#bba88d]">
              Your tale begins here
            </p>
            <h1 className="mt-3 font-heading text-4xl leading-tight text-[#f4ead7]">
              Take your place in the fellowship.
            </h1>
          </div>
        </div>

      <Card className="w-full rounded-none border-0 bg-[#2b1e12]/88 text-[#bba88d] shadow-none backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl text-[#f4ead7]">
            Forge your identity
          </CardTitle>
          <CardDescription className="text-[#cdbb9f]">
            Create a permanent account for your Mithril Tiles games.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RegisterForm />
          <p className="text-center text-sm text-[#cdbb9f]">
            Already registered?{" "}
            <Link className="font-medium text-[#f4ead7] underline" href="/login">
              Sign in
            </Link>
            {" · "}
            <Link className="font-medium text-[#f4ead7] underline" href="/guest">
              Play as a guest
            </Link>
          </p>
        </CardContent>
      </Card>
      </section>
    </main>
  );
}
