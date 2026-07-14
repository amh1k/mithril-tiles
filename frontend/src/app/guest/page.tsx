import type { Metadata } from "next";
import Link from "next/link";

import { AuthPageShell } from "@/features/auth/auth-page-shell";
import { GuestForm } from "@/features/auth/guest-form";
import { redirectAuthenticatedPrincipal } from "@/features/auth/server/session";

export const metadata: Metadata = {
  title: "Play as a guest | Mithril Tiles",
};

export default async function GuestPage() {
  await redirectAuthenticatedPrincipal();

  return (
    <AuthPageShell
      eyebrow="A swift passage"
      title="No oath required. Only a name."
      description="Enter the hall in moments, join your company, and let tonight's deeds speak for themselves."
      formTitle="Enter as a guest"
      formDescription="Choose a display name to play without creating an account. Guest identity and game history are temporary."
      note="Even the shortest journeys can become worthy tales."
      footer={
        <p>
            Prefer a permanent account?{" "}
            <Link className="font-semibold text-[#2b1e12] underline decoration-[#946440] underline-offset-4" href="/register">
              Register
            </Link>
        </p>
      }
    >
      <GuestForm />
    </AuthPageShell>
  );
}
