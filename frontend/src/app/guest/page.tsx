import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GuestArtCarousel } from "@/features/auth/guest-art-carousel";
import { GuestForm } from "@/features/auth/guest-form";

export const metadata: Metadata = {
  title: "Play as a guest | Mithril Tiles",
};

export default function GuestPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#946440]/45 bg-[#2b1e12]/65 shadow-[0_28px_90px_rgba(43,30,18,0.4)] backdrop-blur-[2px] md:grid-cols-2">
        <div className="relative min-h-64 overflow-hidden border-b border-[#bba88d]/25 md:min-h-[36rem] md:border-r md:border-b-0">
          <GuestArtCarousel />
          <div
            className="absolute inset-0 z-10 bg-gradient-to-t from-[#2b1e12]/78 via-[#2b1e12]/10 to-transparent"
            aria-hidden="true"
          />
        </div>

      <Card className="w-full rounded-none border-0 bg-[#2b1e12]/88 text-[#bba88d] shadow-none backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl text-[#f4ead7]">
            Enter the hall
          </CardTitle>
          <CardDescription className="text-[#cdbb9f]">
            Choose a display name to play without creating an account. Guest
            identity and game history are temporary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <GuestForm />
          <p className="text-center text-sm text-[#cdbb9f]">
            Prefer a permanent account?{" "}
            <Link className="font-medium text-[#f4ead7] underline" href="/register">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
      </section>
    </main>
  );
}
