import {
  ArrowRight,
  Brush,
  CircleDot,
  Crown,
  DoorOpen,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { buttonVariants } from "@/components/ui/button";
import { lookupSession } from "@/features/auth/server/session";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Users,
    title: "Gather",
    description: "Create a private room and invite your friends with a code.",
    detail: "One code. Your whole fellowship.",
    label: "The fellowship forms",
  },
  {
    icon: Brush,
    title: "Draw",
    description: "Take your turn at the canvas while everyone watches live.",
    detail: "Every stroke arrives in real time.",
    label: "The canvas awakens",
  },
  {
    icon: MessageCircle,
    title: "Guess",
    description: "Race to identify the word and climb the final ranking.",
    detail: "Sharp eyes claim the crown.",
    label: "The room decides",
  },
];

export default async function Home() {
  const token = await getSessionToken();
  const session = token ? await lookupSession(token) : null;
  const principal = session?.ok ? session.principal : null;

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden bg-[#2b1e12] text-[#bba88d]"
    >
      <div
        className="pointer-events-none absolute -inset-[4%] bg-[length:100%_auto] bg-top bg-repeat-y will-change-transform motion-safe:animate-[background-drift_24s_linear_infinite] sm:bg-cover sm:bg-center sm:bg-no-repeat"
        aria-hidden="true"
        style={{
          backgroundImage: "url('/images/7%20-%2087UWVJq.jpg')",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(43,30,18,0.5),rgba(43,30,18,0.6)),radial-gradient(circle_at_center,transparent_42%,rgba(43,30,18,0.38)_125%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
        aria-hidden="true"
      >
        {[
          ["12%", "5px", "18s", "-4s"],
          ["28%", "4px", "15s", "-9s"],
          ["46%", "7px", "22s", "-13s"],
          ["67%", "4px", "17s", "-6s"],
          ["84%", "6px", "20s", "-15s"],
          ["94%", "4px", "14s", "-2s"],
        ].map(([left, size, duration, delay]) => (
          <span
            key={left}
            className="dust-mote absolute bottom-[-10%] rounded-full bg-[#bba88d]/70 blur-[0.5px]"
            style={{
              left,
              width: size,
              height: size,
              "--dust-duration": duration,
              "--dust-delay": delay,
            } as CSSProperties}
          />
        ))}
      </div>
      <div
        className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-[#946440]/20 blur-3xl motion-safe:animate-[hero-pulse_7s_ease-in-out_infinite]"
        aria-hidden="true"
      />

      <main className="relative z-10 flex-1">
        <section className="relative isolate min-h-[calc(100vh-8rem)] overflow-hidden">
          <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-5xl items-center justify-center px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl px-6 py-10 text-center sm:px-10 sm:py-12">
            <div
              className="hero-reveal mb-8 inline-flex items-center gap-3 rounded-full border border-[#bba88d]/60 bg-[#2b1e12]/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#bba88d] shadow-lg backdrop-blur-md"
              style={{ "--reveal-delay": "80ms" } as CSSProperties}
            >
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full rounded-full bg-[#946440] opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-[#946440]" />
              </span>
              Multiplayer sketch rooms
            </div>
            <h1
              className="hero-reveal hero-title-breathe font-heading text-4xl font-semibold leading-[1.18] tracking-tight text-balance text-[#f4ead7] sm:text-5xl lg:text-6xl"
              style={{ "--reveal-delay": "180ms" } as CSSProperties}
            >
              Draw the word. Outsmart the room.
            </h1>
            <p
              className="hero-reveal mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#e4d4bc] drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]"
              style={{ "--reveal-delay": "280ms" } as CSSProperties}
            >
              Mithril Tiles is a real-time drawing and guessing game built for
              quick rooms, lively rounds, and friendly competition.
            </p>

            {principal ? (
              <div
                className="hero-reveal mt-10 flex justify-center"
                style={{ "--reveal-delay": "380ms" } as CSSProperties}
              >
                <Link
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "hero-portal-cta group relative h-auto min-h-[4.75rem] min-w-[18.5rem] overflow-hidden rounded-2xl border-2 border-[#e4d4bc]/85 bg-[#75683a] px-7 py-3.5 text-[#fff7e7] shadow-[0_18px_45px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#fff7e7] hover:bg-[#827442] active:translate-y-0 sm:min-w-[24rem] sm:px-9",
                  )}
                  href="/play"
                >
                  <span className="hero-portal-frame pointer-events-none absolute inset-1 rounded-xl border border-[#f4ead7]/30" aria-hidden="true" />
                  <span className="hero-portal-glint pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#fff8e8]/70 to-transparent" aria-hidden="true" />
                  <span className="hero-portal-diamond pointer-events-none absolute left-3 top-1/2 size-1.5 -translate-y-1/2 rotate-45 border border-[#f4ead7]/65 bg-[#75683a] sm:left-4" aria-hidden="true" />
                  <span className="hero-portal-diamond pointer-events-none absolute right-3 top-1/2 size-1.5 -translate-y-1/2 rotate-45 border border-[#f4ead7]/65 bg-[#75683a] sm:right-4" aria-hidden="true" />

                  <span className="relative flex items-center justify-center gap-3.5">
                    <span className="hero-portal-emblem relative flex size-10 shrink-0 items-center justify-center rounded-full border border-[#f4ead7]/55 bg-[#2b1e12]/20 text-[#fff7e7] shadow-[inset_0_0_0_3px_rgba(244,234,215,0.08)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]">
                      <span className="absolute -inset-1 rounded-full border border-dashed border-[#f4ead7]/25" aria-hidden="true" />
                      <Sparkles className="hero-portal-sigil size-4" aria-hidden="true" />
                    </span>
                    <span className="text-left">
                      <span className="block text-base font-bold tracking-[0.055em] drop-shadow-[0_1px_2px_rgba(43,30,18,0.7)] sm:text-lg">
                        Answer the Call of Mithril
                      </span>
                      <span className="mt-1 block font-sans text-[0.7rem] font-semibold tracking-[0.14em] text-[#f4ead7]/75">
                        The fellowship awaits, {principal.display_name}
                      </span>
                    </span>
                    <ArrowRight className="size-5 shrink-0 drop-shadow-[0_1px_2px_rgba(43,30,18,0.6)] transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden="true" />
                  </span>
                </Link>
              </div>
            ) : (
              <div
                className="hero-reveal mt-9 flex flex-col justify-center gap-4 sm:flex-row"
                style={{ "--reveal-delay": "380ms" } as CSSProperties}
              >
                <Link
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "cta-shimmer h-12 min-w-44 rounded-lg border border-[#5d542b] bg-[#5d542b] px-7 text-base font-semibold text-[#bba88d] shadow-lg shadow-[#2b1e12]/25 transition-transform hover:-translate-y-0.5 hover:bg-[#6e6c34]",
                  )}
                  href="/guest"
                >
                  Play as a guest
                  <ArrowRight aria-hidden="true" />
                </Link>
                <Link
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-12 min-w-36 rounded-lg border-2 border-[#bba88d] bg-[#bba88d] px-7 text-base font-bold text-[#2b1e12] shadow-xl shadow-[#2b1e12]/30 transition-transform hover:-translate-y-0.5 hover:bg-[#946440] hover:text-[#2b1e12]",
                  )}
                  href="/login"
                >
                  Sign in
                </Link>
                <Link
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "lg" }),
                    "h-12 min-w-36 rounded-lg border border-[#bba88d]/60 bg-[#2b1e12]/45 px-7 text-base font-semibold text-[#bba88d] backdrop-blur-sm hover:bg-[#5d542b]/80 hover:text-[#bba88d]",
                  )}
                  href="/register"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>

          </div>
        </section>

        <section className="round-journey relative isolate overflow-hidden border-y border-[#bba88d]/15 py-20 sm:py-28">
          <div className="journey-halo pointer-events-none absolute left-1/2 top-16 -z-10 h-80 w-[44rem] max-w-[90vw] -translate-x-1/2 rounded-full bg-[#946440]/15 blur-[90px]" />
          <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_30%,rgba(148,100,64,0.12),transparent_28%),radial-gradient(circle_at_85%_72%,rgba(110,108,52,0.14),transparent_30%),linear-gradient(180deg,rgba(20,13,8,0.7),rgba(43,30,18,0.92))]" />

          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="mx-auto mb-16 max-w-2xl text-center sm:mb-20">
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#bba88d] sm:text-sm">
                One room. Three acts. Endless rivalries.
              </p>
              <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-[#f4ead7] sm:text-5xl">
                Every round tells a story
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#cbb99f]/80">
                Rally your company, take command of the canvas, and decipher
                each clue before the final score is carved in stone.
              </p>
            </div>

            <div className="quest-path relative grid gap-8 md:grid-cols-3 md:gap-6 lg:gap-9">
              <div className="quest-rail pointer-events-none absolute left-[12%] right-[12%] top-1/2 hidden h-px -translate-y-1/2 md:block" aria-hidden="true">
                <span className="quest-rail-spark absolute top-1/2 size-2 -translate-y-1/2 rotate-45 bg-[#e4d4bc] shadow-[0_0_16px_4px_rgba(228,212,188,0.55)]" />
              </div>

              {steps.map(
                ({ icon: Icon, title, description, detail, label }, index) => (
                  <article
                    key={title}
                    className="quest-card feature-card-reveal group relative min-h-[25rem] overflow-hidden rounded-[2rem] p-px text-[#2b1e12] shadow-[0_30px_80px_rgba(9,5,3,0.52)]"
                    style={{
                      "--reveal-delay": `${120 + index * 140}ms`,
                      "--quest-delay": `${index * -1.7}s`,
                      "--quest-index": index,
                    } as CSSProperties}
                  >
                    <div className="quest-card-surface relative flex h-full min-h-[25rem] flex-col overflow-hidden rounded-[calc(2rem-1px)] border border-[#f4ead7]/25 bg-[linear-gradient(145deg,rgba(224,204,174,0.96),rgba(148,100,64,0.82)),url('/textures/parchment-background.png')] bg-cover p-6 sm:p-7">
                      <div className="quest-card-glint pointer-events-none absolute -inset-y-16 -left-1/2 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-[#fff8e8]/40 to-transparent blur-sm" aria-hidden="true" />
                      <span className="pointer-events-none absolute -right-7 -top-10 font-heading text-[9rem] font-bold leading-none text-[#5d542b]/[0.07]" aria-hidden="true">
                        {index + 1}
                      </span>

                      <div className="relative flex items-start justify-between gap-4">
                        <div className="quest-orbit relative flex size-20 items-center justify-center">
                          <span className="absolute inset-0 rounded-full border border-dashed border-[#5d542b]/45" />
                          <span className="absolute inset-2 rounded-full border border-[#946440]/40" />
                          <span className="flex size-12 items-center justify-center rounded-full border border-[#5d542b]/45 bg-[#2b1e12] text-[#e4d4bc] shadow-[0_8px_24px_rgba(43,30,18,0.35)] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[-6deg]">
                            <Icon className="size-6" aria-hidden="true" />
                          </span>
                        </div>
                        <span className="rounded-full border border-[#5d542b]/30 bg-[#f4ead7]/30 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#5d542b]">
                          Act 0{index + 1}
                        </span>
                      </div>

                      <div className="relative mt-10">
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#5d542b]/75">
                          {label}
                        </p>
                        <h3 className="mt-2 font-heading text-3xl font-bold text-[#2b1e12] sm:text-4xl">
                          {title}
                        </h3>
                        <p className="mt-4 text-[0.95rem] leading-7 text-[#3b2818]/85">
                          {description}
                        </p>
                      </div>

                      <div className="relative mt-auto pt-8">
                        <div className="mb-5 flex items-center gap-3 text-[#946440]">
                          <span className="h-px flex-1 bg-current/40" />
                          <CircleDot className="quest-rune size-4" aria-hidden="true" />
                          <span className="h-px w-6 bg-current/40" />
                        </div>
                        <p className="flex items-center gap-2 font-serif text-sm font-bold italic text-[#5d542b]">
                          <span className="size-1.5 rotate-45 bg-[#946440]" />
                          {detail}
                        </p>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>

            <div className="journey-cta mx-auto mt-16 flex max-w-3xl flex-col items-center justify-between gap-6 rounded-[1.75rem] border border-[#bba88d]/25 bg-[#160f09]/65 px-6 py-7 text-center shadow-[0_22px_70px_rgba(9,5,3,0.42)] backdrop-blur-md sm:flex-row sm:px-8 sm:text-left">
              <div>
                <p className="font-heading text-xl font-semibold text-[#f4ead7]">
                  Your next legend starts with a room code.
                </p>
                <p className="mt-1 text-sm text-[#bba88d]/70">
                  No account needed. Gather the company and begin.
                </p>
              </div>
              <Link
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "cta-shimmer shrink-0 rounded-xl border border-[#bba88d]/30 bg-[#5d542b] px-6 text-[#f4ead7] shadow-[0_10px_28px_rgba(0,0,0,0.3)] hover:bg-[#6e6c34]",
                )}
                href="/guest"
              >
                Enter the realm
                <DoorOpen aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer relative z-10 overflow-hidden border-t border-[#946440]/45 bg-[#130d08] text-[#bba88d]">
        <div className="footer-beacon pointer-events-none absolute left-1/2 top-0 h-40 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-[#946440]/15 blur-[70px]" aria-hidden="true" />
        <div className="footer-rune-line relative h-px w-full" aria-hidden="true" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.4fr_0.6fr_0.6fr] md:py-16">
          <div className="max-w-md">
            <Image
              alt="Mithril Tiles"
              className="h-auto w-44 object-contain"
              height={950}
              src="/images/logo-gold.png"
              width={1639}
            />
            <p className="mt-5 max-w-sm text-sm leading-6 text-[#bba88d]/70">
              A real-time drawing arena where quick hands, sharp guesses, and
              unlikely alliances become stories worth retelling.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#6e6c34]/45 bg-[#6e6c34]/10 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#c7c186]">
              <span className="footer-status-dot size-2 rounded-full bg-[#9d9b52]" />
              Real-time rooms await
            </div>
          </div>

          <nav aria-label="Play Mithril Tiles">
            <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-[#f4ead7]">
              Enter
            </p>
            <div className="mt-5 flex flex-col items-start gap-3 text-sm">
              <Link className="footer-link" href="/guest">Play as guest</Link>
              <Link className="footer-link" href="/login">Sign in</Link>
              <Link className="footer-link" href="/register">Create account</Link>
            </div>
          </nav>

          <nav aria-label="Learn about Mithril Tiles">
            <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-[#f4ead7]">
              Discover
            </p>
            <div className="mt-5 flex flex-col items-start gap-3 text-sm">
              <Link className="footer-link" href="/rules">How to play</Link>
              <Link className="footer-link" href="/about">About the realm</Link>
              <Link className="footer-link" href="/play">Enter a room</Link>
            </div>
          </nav>
        </div>

        <div className="relative border-t border-[#bba88d]/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 py-5 text-center text-xs text-[#bba88d]/50 sm:flex-row sm:px-6 sm:text-left">
            <span>Crafted for bold drawers and quicker guessers.</span>
            <span className="flex items-center gap-2 font-serif italic">
              <Crown className="size-3.5 text-[#946440]" aria-hidden="true" />
              May the sharpest eye prevail.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
