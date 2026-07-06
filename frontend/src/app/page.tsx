import {
  ArrowRight,
  Brush,
  MessageCircle,
  Sparkles,
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
    <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.16),transparent_42%)]"
        aria-hidden="true"
      />

      <main className="relative z-10 flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-32">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-sm text-muted-foreground shadow-sm">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Live drawing, clever guesses, glorious chaos
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Draw the word. Outsmart the room.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Mithril Tiles is a real-time drawing and guessing game built for
              quick rooms, lively rounds, and friendly competition.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 px-5 text-base",
                )}
                href="/guest"
              >
                Play as a guest
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 px-5 text-base",
                )}
                href="/login"
              >
                Sign in
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "h-12 px-5 text-base",
                )}
                href="/register"
              >
                Create account
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/80 p-3 shadow-2xl shadow-black/10 backdrop-blur">
            <div className="rounded-xl border border-border/80 bg-muted/40 p-6 sm:p-8">
              <p className="text-sm font-medium text-muted-foreground">
                Ready to enter?
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Find your next room
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Create a fresh room or join friends using their room code.
                Authentication comes first, then you will enter the lobby.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Link
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "h-11",
                  )}
                  href="/play"
                >
                  Create room
                </Link>
                <Link
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-11",
                  )}
                  href="/play"
                >
                  Join room
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-muted/25">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-8">
              <p className="text-sm font-medium text-muted-foreground">
                One room, three simple moves
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                How a round unfolds
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-4 py-6 text-center text-sm text-muted-foreground">
        Mithril Tiles · Draw boldly, guess quickly.
      </footer>
    </div>
  );
}
