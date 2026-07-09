import {
  ArrowRight,
  Brush,
  MessageCircle,
  Users,
} from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Users,
    title: "Gather",
    description: "Create a private room and invite your friends with a code.",
  },
  {
    icon: Brush,
    title: "Draw",
    description: "Take your turn at the canvas while everyone watches live.",
  },
  {
    icon: MessageCircle,
    title: "Guess",
    description: "Race to identify the word and climb the final ranking.",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#e8d5aa] text-[#35251a]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_68%_28%,rgba(184,150,90,0.28),transparent_32%),radial-gradient(circle_at_18%_78%,rgba(45,74,43,0.16),transparent_28%),radial-gradient(circle_at_center,transparent_45%,rgba(62,42,30,0.2)_120%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-[#b8965a]/20 blur-3xl motion-safe:animate-[hero-pulse_7s_ease-in-out_infinite]"
        aria-hidden="true"
      />

      <main className="relative z-10 flex-1">
        <section className="relative isolate min-h-[calc(100vh-8rem)] overflow-hidden">
          <div
            className="absolute inset-0 -z-20 bg-[url('/middle-earth-map.svg')] bg-cover bg-center opacity-45 saturate-[0.85]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_74%_34%,rgba(255,240,196,0.34),transparent_30%),linear-gradient(90deg,rgba(232,213,170,0.96)_0%,rgba(232,213,170,0.82)_42%,rgba(232,213,170,0.54)_100%),radial-gradient(circle_at_center,transparent_40%,rgba(62,42,30,0.42)_125%)]"
            aria-hidden="true"
          />

          <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-24">
          <div className="max-w-2xl text-center lg:text-left">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#9a783f]/60 bg-[#f3e4bd]/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#5c472f] shadow-sm backdrop-blur">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full rounded-full bg-[#7d2929] opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-[#7d2929]" />
              </span>
              Multiplayer sketch rooms
            </div>
            <h1 className="font-heading text-4xl font-semibold leading-[1.18] tracking-tight text-balance text-[#3e2a1e] sm:text-5xl lg:text-6xl">
              Draw the word. Outsmart the room.
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-[#624d34] lg:mx-0">
              Mithril Tiles is a real-time drawing and guessing game built for
              quick rooms, lively rounds, and friendly competition.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Link
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 min-w-44 rounded-lg border border-[#1f351e] bg-[#2d4a2b] px-7 text-base font-semibold text-[#fff3d2] shadow-lg shadow-[#3e2a1e]/25 transition-transform hover:-translate-y-0.5 hover:bg-[#385b35]",
                )}
                href="/guest"
              >
                Play as a guest
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 min-w-36 rounded-lg border-[#71542e] bg-[#f3e4bd]/40 px-7 text-base font-semibold text-[#3e2a1e] transition-transform hover:-translate-y-0.5 hover:bg-[#d7bf87] hover:text-[#2a1c13]",
                )}
                href="/login"
              >
                Sign in
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "h-12 min-w-36 rounded-lg px-7 text-base font-semibold text-[#5d472f] hover:bg-[#b8965a]/20 hover:text-[#2a1c13]",
                )}
                href="/register"
              >
                Create account
              </Link>
            </div>
          </div>

          <div className="relative hidden min-h-[30rem] items-center justify-center lg:flex">
            <div
              className="absolute left-4 top-28 h-72 w-12 rounded-md border border-[#795a31] bg-[#4a3524]/90 shadow-2xl shadow-[#3e2a1e]/35 motion-safe:animate-[hero-float_6s_ease-in-out_infinite]"
              aria-hidden="true"
            >
              <div className="h-10 border-b border-[#b8965a]/20 bg-[#60452c]/70" />
              <div className="h-10 border-b border-[#b8965a]/15" />
              <div className="h-10 border-b border-[#b8965a]/15" />
              <div className="absolute bottom-10 left-1/2 size-20 -translate-x-1/2 rounded-full border-8 border-[#ead7aa] bg-[#71855a] shadow-lg" />
              <ArrowRight
                className="absolute bottom-8 left-8 size-12 text-[#d9c797]"
                aria-hidden="true"
              />
            </div>

            <div className="relative w-full max-w-2xl overflow-hidden rounded-md border-4 border-[#5a4028] bg-[#3e2a1e] shadow-2xl shadow-[#3e2a1e]/45 motion-safe:animate-[hero-float_7s_ease-in-out_infinite]">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#e0bd70] to-transparent motion-safe:animate-[hero-scan_4s_ease-in-out_infinite]"
                aria-hidden="true"
              />
              <div className="flex h-7 items-center border-b border-[#b8965a]/30 bg-[#4a3524] px-3">
                <div className="flex gap-2">
                  <span className="size-3 rounded-full bg-[#7d2929]" />
                  <span className="size-3 rounded-full bg-[#b8965a]" />
                  <span className="size-3 rounded-full bg-[#596b3c]" />
                </div>
                <p className="flex-1 text-center text-xs text-[#dfcca1]">
                  Mithril Room
                </p>
              </div>

              <div className="relative flex min-h-[22rem] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#f6ebc9,#e2ca94_55%,#c1a36a_100%)] p-8">
                <div
                  className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.18)_42%,transparent_55%)] opacity-60 motion-safe:animate-[hero-glint_6s_ease-in-out_infinite]"
                  aria-hidden="true"
                />
                <div className="absolute left-6 top-0 rounded-b-md bg-[#3e2a1e] px-5 py-2 text-sm font-semibold text-[#f2dfb4] shadow-xl">
                  ✎ Draw
                </div>

                <div className="text-center">
                  <div className="mx-auto flex size-28 items-center justify-center rounded-full border border-[#9a783f] bg-[#f5e8c2] shadow-xl">
                    <Brush className="size-14 text-[#3e2a1e]" aria-hidden="true" />
                  </div>
                  <h2 className="mt-8 text-xl font-semibold text-[#3e2a1e]">
                    Waiting for the next sketch
                  </h2>
                  <p className="mt-2 text-sm text-[#624d34]">
                    Guess fast, draw boldly, and keep the room laughing.
                  </p>
                </div>
              </div>

              <div className="flex h-10 items-center justify-between bg-[#4a3524] px-4 text-xs font-semibold text-[#d8c398]">
                <span>
                  ROOM: <span className="text-[#fff0cb]">READY</span>
                </span>
                <span className="text-[#d8b86d]">v1.0.0</span>
              </div>
            </div>

            <div
              className="absolute -right-10 top-36 h-56 w-24 rounded border border-[#846538] bg-[#f2e3bc] shadow-2xl shadow-[#3e2a1e]/35 motion-safe:animate-[hero-float_8s_ease-in-out_infinite]"
              aria-hidden="true"
            >
              <div className="h-4 rounded-t bg-[#493323]" />
              <div className="p-2">
                <div className="mb-2 flex gap-1">
                  <span className="size-1.5 rounded-full bg-[#7d2929]" />
                  <span className="size-1.5 rounded-full bg-[#b8965a]" />
                  <span className="size-1.5 rounded-full bg-[#596b3c]" />
                </div>
                <div className="h-1.5 w-16 rounded bg-[#9e8356]" />
                <div className="mt-3 space-y-1.5">
                  <div className="h-1 w-14 rounded bg-[#c5ac78]" />
                  <div className="h-1 w-10 rounded bg-[#c5ac78]" />
                </div>
              </div>
            </div>
          </div>
          </div>
        </section>

        <section className="border-y border-[#9a783f]/50 bg-[#deca9b]/65">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-8">
              <p className="text-sm font-medium text-[#70583a]">
                One room, three simple moves
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#3e2a1e]">
                How a round unfolds
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-xl border border-[#9a783f]/60 bg-[#f1e1b8]/65 p-5 shadow-sm shadow-[#3e2a1e]/10"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[#2d4a2b]/10 text-[#2d4a2b]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-semibold text-[#3e2a1e]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#624d34]">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#9a783f]/50 bg-[#3e2a1e] px-4 py-6 text-center text-sm text-[#d8c398]">
        Mithril Tiles · Draw boldly, guess quickly.
      </footer>
    </div>
  );
}
