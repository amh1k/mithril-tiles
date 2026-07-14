import type { Metadata } from "next";
import Link from "next/link";

import { AuthPageShell } from "@/features/auth/auth-page-shell";
import { LoginForm } from "@/features/auth/login-form";
import { redirectAuthenticatedPrincipal } from "@/features/auth/server/session";

export const metadata: Metadata = {
  title: "Sign in | Mithril Tiles",
};

export default async function LoginPage() {
  await redirectAuthenticatedPrincipal();

  return (
    <AuthPageShell
      eyebrow="Return to the realm"
      title="Your seat in the fellowship remains."
      description="Step back into the hall, gather your company, and continue the rivalries waiting beyond the gate."
      formTitle="Return to the hall"
      formDescription="Sign in with your registered Mithril Tiles identity."
      note="A familiar name carries every victory a little further."
      footer={
        <p>
            Need an account?{" "}
            <Link className="font-semibold text-[#2b1e12] underline decoration-[#946440] underline-offset-4" href="/register">
              Register
            </Link>
            <span className="mx-2 text-[#946440]">·</span>
            <Link className="font-semibold text-[#2b1e12] underline decoration-[#946440] underline-offset-4" href="/guest">
              Play as a guest
            </Link>
        </p>
      }
    >
      <LoginForm />
    </AuthPageShell>
  );
}
