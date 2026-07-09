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
    <div
      className="relative flex flex-1 flex-col overflow-hidden bg-[#2b1e12] text-[#bba88d]"
    >
      <div
        className="pointer-events-none absolute -inset-[4%] bg-cover bg-center bg-no-repeat will-change-transform motion-safe:animate-[background-drift_24s_linear_infinite]"
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
        className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-[#946440]/20 blur-3xl motion-safe:animate-[hero-pulse_7s_ease-in-out_infinite]"
        aria-hidden="true"
      />

      <main className="relative z-10 flex-1">
        <section className="relative isolate min-h-[calc(100vh-8rem)] overflow-hidden">
          <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-5xl items-center justify-center px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl px-6 py-10 text-center sm:px-10 sm:py-12">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#bba88d]/60 bg-[#2b1e12]/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#bba88d] shadow-lg backdrop-blur-md">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full rounded-full bg-[#946440] opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-[#946440]" />
              </span>
              Multiplayer sketch rooms
            </div>
            <h1 className="font-heading text-4xl font-semibold leading-[1.18] tracking-tight text-balance text-[#f4ead7] drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)] sm:text-5xl lg:text-6xl">
              Draw the word. Outsmart the room.
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#e4d4bc] drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]">
              Mithril Tiles is a real-time drawing and guessing game built for
              quick rooms, lively rounds, and friendly competition.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 min-w-44 rounded-lg border border-[#5d542b] bg-[#5d542b] px-7 text-base font-semibold text-[#bba88d] shadow-lg shadow-[#2b1e12]/25 transition-transform hover:-translate-y-0.5 hover:bg-[#6e6c34]",
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
          </div>

          </div>
        </section>

        <section>
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-8">
              <p className="text-sm font-medium text-[#bba88d]">
                One room, three simple moves
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#bba88d]">
                How a round unfolds
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-[#bba88d]/30 bg-[#2b1e12]/72 p-5 text-[#bba88d] shadow-[0_18px_50px_rgba(43,30,18,0.42)] backdrop-blur-[3px]"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg border border-[#bba88d]/20 bg-[#946440]/25 text-[#bba88d]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-semibold text-[#f4ead7]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#d8c7ad]">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#946440]/50 bg-[#2b1e12] px-4 py-6 text-center text-sm text-[#bba88d]">
        Mithril Tiles · Draw boldly, guess quickly.
      </footer>
    </div>
  );
}
