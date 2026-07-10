import type { Metadata } from "next";
import { Archive, ScrollText, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { lookupSession } from "@/features/auth/server/session";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin Dashboard | Mithril Tiles",
};

const comingSoon = [
  {
    icon: UsersRound,
    title: "Fellowship records",
    description: "Review player accounts and moderation tools when the archive expands.",
  },
  {
    icon: ScrollText,
    title: "Game chronicles",
    description: "Inspect completed games, scores, and room activity in a future chapter.",
  },
];

export default async function AdminDashboardPage() {
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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(187,168,141,0.26),transparent_38%)]"
        aria-hidden="true"
      />
      <section className="relative mx-auto w-full max-w-6xl">
        <header className="mb-8 overflow-hidden border border-[#946440]/70 bg-[#2b1e12]/90 px-5 py-7 text-center text-[#f4e7c8] shadow-[0_16px_38px_rgba(43,30,18,0.34)] sm:px-8">
          <div className="mb-3 flex justify-center">
            <span className="flex size-12 items-center justify-center rounded-full border border-[#bba88d]/70 bg-[#5d542b] text-[#f4e7c8] shadow-[0_5px_18px_rgba(0,0,0,0.3)]">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
          </div>
          <p className="font-heading text-xs tracking-[0.22em] text-[#d7bd89] uppercase">
            Steward&apos;s archive
          </p>
          <h1 className="font-heading mt-2 text-3xl font-semibold text-[#fff0cc] drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)] sm:text-4xl">
            Admin Dashboard
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#f4e7c8] sm:text-base">
            Keep the realms, their words, and their future chronicles in order.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          <article className="relative overflow-hidden rounded-t-[6rem] border border-[#946440]/75 bg-[linear-gradient(145deg,rgba(244,231,200,0.9),rgba(187,168,141,0.82)_45%,rgba(148,100,64,0.58)),url('/textures/parchment-background.png')] bg-cover p-6 pt-8 text-[#2b1e12] shadow-[0_16px_32px_rgba(43,30,18,0.28)] before:pointer-events-none before:absolute before:inset-2 before:rounded-t-[5.5rem] before:border before:border-[#5d542b]/30">
            <div className="relative">
              <span className="flex size-11 items-center justify-center rounded-t-full border border-[#5d542b]/50 bg-[#bba88d]/45 text-[#5d542b]">
                <Archive className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-bold">Word packs</h2>
              <p className="mt-3 min-h-20 text-sm leading-6 text-[#3b2818]">
                Create, revise, activate, and archive the vocabularies available to each room.
              </p>
              <Link
                className={cn(
                  buttonVariants(),
                  "mt-6 bg-[#2b1e12] text-[#f4e7c8] hover:bg-[#5d542b]",
                )}
                href="/admin/word-packs"
              >
                Manage word packs
              </Link>
            </div>
          </article>

          {comingSoon.map(({ icon: Icon, title, description }) => (
            <article
              className="relative overflow-hidden rounded-t-[6rem] border border-dashed border-[#946440]/65 bg-[#bba88d]/55 p-6 pt-8 text-[#2b1e12] shadow-[0_12px_26px_rgba(43,30,18,0.18)] before:pointer-events-none before:absolute before:inset-2 before:rounded-t-[5.5rem] before:border before:border-[#5d542b]/20"
              key={title}
            >
              <div className="relative">
                <span className="flex size-11 items-center justify-center rounded-t-full border border-[#5d542b]/40 bg-[#bba88d]/40 text-[#5d542b]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-5 text-xs font-bold tracking-[0.18em] text-[#6e6c34] uppercase">
                  Future chapter
                </p>
                <h2 className="mt-2 text-xl font-bold">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#3b2818]">{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
