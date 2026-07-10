import {
  Brush,
  Clock,
  Layers3,
  Network,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Mithril Tiles",
  description: "Learn about Mithril Tiles, a realtime drawing and guessing game.",
};

const pillars = [
  {
    icon: Network,
    title: "The room listens",
    description:
      "Every table has its own room code, and every player hears the same tale unfold through live websocket updates.",
  },
  {
    icon: Brush,
    title: "The quill moves quickly",
    description:
      "The canvas is fast, direct, and responsive, so the drawer can sketch while the rest of the fellowship watches.",
  },
  {
    icon: ShieldCheck,
    title: "Tokens stay behind the counter",
    description:
      "The frontend keeps authentication safer by storing bearer tokens in HttpOnly cookies through the BFF layer.",
  },
];

const progress = [
  "Registered, guest, and session-aware authentication",
  "Room entry, websocket tickets, chat, and live drawing",
  "Authoritative room snapshots with players, host, drawer, scores, and round state",
  "Synced round timer, canvas reset, and themed round transitions",
  "Word-pack selection, game start flow, final score overlay, and participant names",
];

const stack = [
  "Go API",
  "PostgreSQL",
  "WebSockets",
  "Next.js",
  "TypeScript",
  "Tailwind CSS",
  "Zustand",
  "TanStack Query",
];

export default function AboutPage() {
  return (
    <main className="relative isolate flex flex-1 overflow-hidden bg-[#2b1e12] px-4 py-10 text-[#2b1e12] sm:px-6 lg:py-14">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(43,30,18,0.5),rgba(43,30,18,0.68)),radial-gradient(circle_at_center,transparent_38%,rgba(43,30,18,0.42)_125%),url('/textures/parchment-background.png')] bg-cover bg-fixed bg-center bg-no-repeat"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(187,168,141,0.22),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(148,100,64,0.18),transparent_30%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-6xl">
        <article className="relative bg-[linear-gradient(rgba(187,168,141,0.72),rgba(148,100,64,0.34)),radial-gradient(circle_at_center,rgba(244,234,215,0.18),rgba(43,30,18,0.16)_82%),url('/textures/parchment-background.png')] bg-cover px-7 py-10 shadow-[0_34px_90px_rgba(43,30,18,0.48)] sm:px-12 sm:py-14 lg:px-16">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(43,30,18,0.2)_120%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-0 top-0 h-40 w-40 bg-[radial-gradient(circle_at_top_left,rgba(43,30,18,0.3),rgba(148,100,64,0.14)_42%,transparent_72%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute right-0 top-0 h-40 w-40 bg-[radial-gradient(circle_at_top_right,rgba(43,30,18,0.3),rgba(148,100,64,0.14)_42%,transparent_72%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 h-44 w-44 bg-[radial-gradient(circle_at_bottom_left,rgba(43,30,18,0.24),rgba(148,100,64,0.12)_45%,transparent_74%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 h-44 w-44 bg-[radial-gradient(circle_at_bottom_right,rgba(43,30,18,0.24),rgba(148,100,64,0.12)_45%,transparent_74%)]"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-4 border border-[#946440]/35" />
          <div className="pointer-events-none absolute inset-7 border border-[#5d542b]/20" />

          <header className="relative mx-auto max-w-4xl text-center">
            <div className="mx-auto flex w-fit items-center gap-2 border-y border-[#946440]/50 px-6 py-2 text-xs font-bold uppercase tracking-[0.32em] text-[#5d542b]">
              <ScrollText className="size-4" aria-hidden="true" />
              Tavern tale
            </div>
            <h1 className="mt-6 font-serif text-4xl font-bold leading-tight text-[#2b1e12] sm:text-5xl">
              Pull up a chair. The tale begins.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#3b2818]">
              Mithril Tiles is recounted here as a small tavern legend: a room,
              a canvas, a secret word, and a clock that cares nothing for
              hesitation.
            </p>
          </header>

          <div className="relative mt-12 grid gap-10 lg:grid-cols-[1fr_0.82fr]">
            <section>
              <p className="text-lg leading-8 text-[#3b2818] first-letter:float-left first-letter:mr-3 first-letter:font-serif first-letter:text-7xl first-letter:font-bold first-letter:leading-[0.82] first-letter:text-[#5d542b]">
                They say Mithril Tiles began as a simple room around a canvas:
                one drawer with a secret word, a circle of guessers, and a clock
                that cared nothing for hesitation.
              </p>
              <p className="mt-5 leading-8 text-[#3b2818]">
                Since then, the little tavern game has grown sturdier bones:
                guest and registered players, live rooms, synchronized drawings,
                round state, scoring, final rankings, and a frontend dressed in
                parchment, candlelight, and old map dust.
              </p>

              <div className="my-9 flex items-center gap-4 text-[#946440]">
                <span className="h-px flex-1 bg-current/45" />
                <SparkLine />
                <span className="h-px flex-1 bg-current/45" />
              </div>

              <div className="grid gap-7 sm:grid-cols-3">
                {pillars.map(({ icon: Icon, title, description }) => (
                  <section key={title} className="text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-[#946440]/45 bg-[#bba88d]/30 text-[#5d542b]">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 font-serif text-lg font-bold text-[#2b1e12]">
                      {title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#3b2818]">
                      {description}
                    </p>
                  </section>
                ))}
              </div>
            </section>

            <aside className="space-y-8 border-t border-[#946440]/35 pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <section>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5d542b]">
                  Innkeeper’s note
                </p>
                <h2 className="mt-2 font-serif text-2xl font-bold text-[#2b1e12]">
                  Playable alpha
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#3b2818]">
                  The candles are lit and the room is open, but the tale is not
                  finished. Some systems are still being sharpened, tested, and
                  carved into a more production-ready shape.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-3">
                  <Clock className="size-5 text-[#5d542b]" aria-hidden="true" />
                  <h2 className="font-serif text-2xl font-bold text-[#2b1e12]">
                    What the bard can sing of
                  </h2>
                </div>
                <ul className="mt-4 space-y-3">
                  {progress.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-[#3b2818]">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#5d542b]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3">
                  <Layers3 className="size-5 text-[#5d542b]" aria-hidden="true" />
                  <h2 className="font-serif text-2xl font-bold text-[#2b1e12]">
                    Tools behind the counter
                  </h2>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
                  {stack.map((item) => (
                    <span
                      key={item}
                      className="border-b border-[#946440]/60 text-sm font-semibold text-[#3b2818]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>

              <section className="border-t border-[#946440]/35 pt-5">
                <p className="font-serif font-bold text-[#2b1e12]">
                  The manuscript’s look
                </p>
                <p className="mt-2 text-sm leading-6 text-[#3b2818]">
                  Parchment surfaces, aged map tones, quiet ink rules, warm
                  accents, and readable gameplay-first contrast.
                </p>
              </section>
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}

function SparkLine() {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      <span className="size-1.5 rotate-45 bg-current" />
      <span className="size-2.5 rotate-45 border border-current" />
      <span className="size-1.5 rotate-45 bg-current" />
    </span>
  );
}
