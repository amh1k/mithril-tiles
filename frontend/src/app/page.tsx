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
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#17181a] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_68%_28%,rgba(239,68,68,0.18),transparent_32%),radial-gradient(circle_at_18%_78%,rgba(14,165,233,0.1),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-red-600/10 blur-3xl motion-safe:animate-[hero-pulse_7s_ease-in-out_infinite]"
        aria-hidden="true"
      />

      <main className="relative z-10 flex-1">
        <section className="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-7xl gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-24">
          <div className="max-w-2xl text-center lg:text-left">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 shadow-sm backdrop-blur">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
              </span>
              Multiplayer sketch rooms
            </div>
            <h1 className="text-4xl font-normal leading-[1.18] tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
              Draw the word. Outsmart the room.
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-slate-300 lg:mx-0">
              Mithril Tiles is a real-time drawing and guessing game built for
              quick rooms, lively rounds, and friendly competition.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Link
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 min-w-44 rounded-lg bg-red-600 px-7 text-base font-semibold text-white shadow-lg shadow-red-950/30 transition-transform hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-red-900/40",
                )}
                href="/guest"
              >
                Play as a guest
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 min-w-36 rounded-lg border-white/60 bg-transparent px-7 text-base font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-white/10 hover:text-white",
                )}
                href="/login"
              >
                Sign in
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "h-12 min-w-36 rounded-lg px-7 text-base font-semibold text-slate-300 hover:bg-white/10 hover:text-white",
                )}
                href="/register"
              >
                Create account
              </Link>
            </div>
          </div>

          <div className="relative hidden min-h-[30rem] items-center justify-center lg:flex">
            <div
              className="absolute left-4 top-28 h-72 w-12 rounded-md border border-white/10 bg-slate-800/80 shadow-2xl shadow-black/40 motion-safe:animate-[hero-float_6s_ease-in-out_infinite]"
              aria-hidden="true"
            >
              <div className="h-10 border-b border-white/5 bg-slate-700/70" />
              <div className="h-10 border-b border-white/5" />
              <div className="h-10 border-b border-white/5" />
              <div className="absolute bottom-10 left-1/2 size-20 -translate-x-1/2 rounded-full border-8 border-white bg-cyan-200/90 shadow-lg" />
              <ArrowRight
                className="absolute bottom-8 left-8 size-12 text-cyan-100"
                aria-hidden="true"
              />
            </div>

            <div className="relative w-full max-w-2xl overflow-hidden rounded-md border border-white/10 bg-slate-950 shadow-2xl shadow-black/50 motion-safe:animate-[hero-float_7s_ease-in-out_infinite]">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-red-300/80 to-transparent motion-safe:animate-[hero-scan_4s_ease-in-out_infinite]"
                aria-hidden="true"
              />
              <div className="flex h-7 items-center border-b border-white/10 bg-slate-800 px-3">
                <div className="flex gap-2">
                  <span className="size-3 rounded-full bg-red-500" />
                  <span className="size-3 rounded-full bg-yellow-400" />
                  <span className="size-3 rounded-full bg-slate-500" />
                </div>
                <p className="flex-1 text-center text-xs text-slate-300">
                  Mithril Room
                </p>
              </div>

              <div className="relative flex min-h-[22rem] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(254,240,138,0.95),rgba(248,113,113,0.82)_42%,rgba(88,28,135,0.72)_100%)] p-8">
                <div
                  className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.18)_42%,transparent_55%)] opacity-60 motion-safe:animate-[hero-glint_6s_ease-in-out_infinite]"
                  aria-hidden="true"
                />
                <div className="absolute left-6 top-0 rounded-b-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-xl">
                  ✎ Draw
                </div>

                <div className="text-center">
                  <div className="mx-auto flex size-28 items-center justify-center rounded-full bg-white shadow-xl">
                    <Brush className="size-14 text-slate-800" aria-hidden="true" />
                  </div>
                  <h2 className="mt-8 text-xl font-semibold text-slate-800">
                    Waiting for the next sketch
                  </h2>
                  <p className="mt-2 text-sm text-slate-700">
                    Guess fast, draw boldly, and keep the room laughing.
                  </p>
                </div>
              </div>

              <div className="flex h-10 items-center justify-between bg-slate-800 px-4 text-xs font-semibold text-slate-300">
                <span>
                  ROOM: <span className="text-white">READY</span>
                </span>
                <span className="text-yellow-200">v1.0.0</span>
              </div>
            </div>

            <div
              className="absolute -right-10 top-36 h-56 w-24 rounded border border-white/10 bg-white shadow-2xl shadow-black/40 motion-safe:animate-[hero-float_8s_ease-in-out_infinite]"
              aria-hidden="true"
            >
              <div className="h-4 rounded-t bg-stone-700" />
              <div className="p-2">
                <div className="mb-2 flex gap-1">
                  <span className="size-1.5 rounded-full bg-red-400" />
                  <span className="size-1.5 rounded-full bg-yellow-400" />
                  <span className="size-1.5 rounded-full bg-green-400" />
                </div>
                <div className="h-1.5 w-16 rounded bg-slate-300" />
                <div className="mt-3 space-y-1.5">
                  <div className="h-1 w-14 rounded bg-slate-200" />
                  <div className="h-1 w-10 rounded bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#17181a]">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-8">
              <p className="text-sm font-medium text-slate-400">
                One room, three simple moves
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                How a round unfolds
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-sm"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 bg-[#17181a] px-4 py-6 text-center text-sm text-slate-400">
        Mithril Tiles · Draw boldly, guess quickly.
      </footer>
    </div>
  );
}
