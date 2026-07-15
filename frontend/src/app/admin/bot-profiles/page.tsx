import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { redirect } from "next/navigation";

import { BotProfileDashboard } from "@/features/admin/bot-profile-dashboard";
import { lookupSession } from "@/features/auth/server/session";
import { getSessionToken } from "@/lib/auth/session-cookie";

export const metadata: Metadata = {
  title: "Bot Profile Management | Mithril Tiles",
};

export default async function AdminBotProfilesPage() {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }

  const session = await lookupSession(token);
  if (!session.ok) {
    redirect(session.error.status === 401 ? "/login" : "/play");
  }

  if (session.principal.type !== "user" || session.principal.role !== "admin") {
    redirect("/play");
  }

  return (
    <main className="relative flex flex-1 overflow-hidden px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(187,168,141,0.22),transparent_38%)]"
        aria-hidden="true"
      />
      <section className="relative mx-auto w-full max-w-6xl">
        <header className="mb-8 overflow-hidden border border-[#946440]/70 bg-[#2b1e12]/90 px-5 py-6 text-center text-[#f4e7c8] shadow-[0_16px_38px_rgba(43,30,18,0.34)] sm:px-8">
          <div className="mb-3 flex justify-center">
            <span className="flex size-12 items-center justify-center rounded-full border border-[#bba88d]/70 bg-[#5d542b] text-[#f4e7c8] shadow-[0_5px_18px_rgba(0,0,0,0.3)]">
              <Bot className="size-6" aria-hidden="true" />
            </span>
          </div>
          <p className="font-heading text-xs tracking-[0.22em] text-[#d7bd89] uppercase">
            Steward&apos;s archive
          </p>
          <h1 className="font-heading mt-2 text-3xl font-semibold text-[#fff0cc] drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)] sm:text-4xl">
            Bot Profile Management
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#f4e7c8] sm:text-base">
            Create and maintain the computer players available to room hosts.
          </p>
        </header>

        <BotProfileDashboard />
      </section>
    </main>
  );
}
