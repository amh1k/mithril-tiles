import type { Metadata } from "next";
import Link from "next/link";

import { AuthPageShell } from "@/features/auth/auth-page-shell";
import { RegisterForm } from "@/features/auth/register-form";
import { redirectAuthenticatedPrincipal } from "@/features/auth/server/session";

export const metadata: Metadata = {
  title: "Register | Mithril Tiles",
};

export default async function RegisterPage() {
  await redirectAuthenticatedPrincipal();

  return (
    <AuthPageShell
      eyebrow="Your tale begins"
      title="Take your place in the fellowship."
      description="Forge a lasting identity for every room entered, every word uncovered, and every victory earned."
      formTitle="Forge your identity"
      formDescription="Create a permanent account for your Mithril Tiles games."
      note="Names written in mithril are not easily forgotten."
      spacious
      footer={
        <p>
            Already registered?{" "}
            <Link className="font-semibold text-[#2b1e12] underline decoration-[#946440] underline-offset-4" href="/login">
              Sign in
            </Link>
            <span className="mx-2 text-[#946440]">·</span>
            <Link className="font-semibold text-[#2b1e12] underline decoration-[#946440] underline-offset-4" href="/guest">
              Play as a guest
            </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthPageShell>
  );
}
