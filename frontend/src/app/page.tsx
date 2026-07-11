import {
  ArrowRight,
  Brush,
  MessageCircle,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

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
          </div>

          </div>
        </section>

        <section>
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-10 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#bba88d]">
                One room, three simple moves
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#f4ead7]">
                How a round unfolds
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, description }, index) => (
                <article
                  key={title}
                  className="feature-card-reveal feature-card-ambient group relative overflow-hidden rounded-[1.75rem] border border-[#946440]/55 bg-[linear-gradient(rgba(187,168,141,0.82),rgba(148,100,64,0.34)),url('/textures/parchment-background.png')] bg-cover p-5 text-[#2b1e12] shadow-[0_22px_60px_rgba(43,30,18,0.46)] transition duration-300 before:pointer-events-none before:absolute before:inset-3 before:rounded-[1.25rem] before:border before:border-[#5d542b]/25 hover:-translate-y-2 hover:border-[#bba88d] hover:shadow-[0_30px_75px_rgba(43,30,18,0.62)]"
                  style={{
                    "--reveal-delay": `${120 + index * 120}ms`,
                    "--ambient-delay": `${index * 420}ms`,
                  } as CSSProperties}
                >
                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className="feature-icon-float flex size-12 items-center justify-center rounded-t-full border-2 border-[#5d542b]/50 bg-[#2b1e12]/12 text-[#5d542b] transition-transform duration-300 group-hover:scale-110"
                        style={{
                          "--ambient-delay": `${index * 420}ms`,
                        } as CSSProperties}
                      >
                        <Icon className="size-6" aria-hidden="true" />
                      </span>
                      <span className="font-serif text-4xl font-bold leading-none text-[#946440]/55">
                        0{index + 1}
                      </span>
                    </div>

                    <div className="my-5 flex items-center gap-3 text-[#946440]">
                      <span className="h-px flex-1 bg-current/45" />
                      <span className="size-2 rotate-45 border border-current" />
                      <span className="h-px flex-1 bg-current/45" />
                    </div>

                    <h3 className="font-serif text-2xl font-bold text-[#2b1e12]">
                      {title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#3b2818]">
                      {description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 flex flex-col items-center gap-1 border-t border-[#946440]/50 bg-[#2b1e12] px-4 py-4 text-center text-sm text-[#bba88d]">
        <Image
          alt="Mithril Tiles"
          className="h-16 w-32 object-contain"
          height={950}
          src="/images/logo-gold.png"
          width={1639}
        />
        <span>Draw boldly, guess quickly.</span>
      </footer>
    </div>
  );
}
